const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const crypto = require('crypto');
const fs = require('fs/promises');
const os = require('os');
const path = require('path');
const prisma = require('../config/db');
const { authMiddleware } = require('../config/auth');
const { importProperty, isSupportedImage } = require('../services/propertyImporter');

const router = express.Router();
const tempDirectory = path.join(os.tmpdir(), 'circulo-property-imports');

const storage = multer.diskStorage({
  destination: async (req, file, callback) => {
    try {
      await fs.mkdir(tempDirectory, { recursive: true });
      callback(null, tempDirectory);
    } catch (error) {
      callback(error);
    }
  },
  filename: (req, file, callback) => {
    callback(null, `${Date.now()}-${crypto.randomBytes(8).toString('hex')}`);
  },
});

const upload = multer({
  storage,
  limits: {
    fileSize: 200 * 1024 * 1024,
    files: 51,
    fields: 10,
  },
});

const safeEntryName = (entryName) => {
  const unixName = String(entryName || '').replace(/\\/g, '/');
  if (!unixName || unixName.includes('\0') || unixName.startsWith('/') || /^[a-zA-Z]:/.test(unixName)) {
    throw new Error(`Ruta no permitida en ZIP: ${entryName}`);
  }
  const normalized = path.posix.normalize(unixName);
  if (normalized === '..' || normalized.startsWith('../') || normalized.includes('/../')) {
    throw new Error(`Ruta no permitida en ZIP: ${entryName}`);
  }
  return normalized.replace(/^\.\//, '');
};

const parseManifest = (buffer, label) => {
  try {
    return JSON.parse(buffer.toString('utf8').replace(/^\uFEFF/, ''));
  } catch (error) {
    throw new Error(`${label}: propiedad.json no contiene JSON válido`);
  }
};

const payloadsFromZip = async (archivePath) => {
  const archive = new AdmZip(archivePath);
  const entries = archive.getEntries().filter((entry) => !entry.isDirectory);
  let totalBytes = 0;
  const safeEntries = entries.map((entry) => {
    const name = safeEntryName(entry.entryName);
    totalBytes += Number(entry.header?.size || 0);
    return { entry, name };
  });

  if (totalBytes > 300 * 1024 * 1024) {
    throw new Error('El contenido descomprimido supera 300 MB');
  }

  const manifests = safeEntries.filter(({ name }) => path.posix.basename(name).toLowerCase() === 'propiedad.json');
  if (!manifests.length) throw new Error('No se encontró ningún archivo propiedad.json');
  if (manifests.length > 100) throw new Error('El ZIP contiene demasiadas propiedades');

  return manifests.map(({ entry: manifestEntry, name: manifestName }) => {
    const directory = path.posix.dirname(manifestName);
    const manifestBuffer = manifestEntry.getData();
    const manifest = parseManifest(manifestBuffer, directory);
    const files = safeEntries
      .filter(({ name }) => {
        if (!isSupportedImage(name)) return false;
        const imageDirectory = path.posix.dirname(name);
        return imageDirectory === directory || imageDirectory.startsWith(`${directory}/`);
      })
      .map(({ entry, name }) => ({
        name: path.posix.basename(name),
        relativePath: directory === '.' ? name : name.slice(directory.length + 1),
        buffer: entry.getData(),
      }));

    if (files.length > 50) throw new Error(`${directory}: máximo 50 imágenes por propiedad`);
    return {
      manifest,
      manifestBuffer,
      files,
      sourceFolder: directory === '.' ? path.parse(archivePath).name : directory,
    };
  });
};

const payloadFromFolderUpload = async (uploadedFiles, rawPaths) => {
  if (!uploadedFiles.length) throw new Error('No se recibieron archivos de la carpeta');

  let relativePaths = [];
  if (rawPaths) {
    try {
      relativePaths = JSON.parse(rawPaths);
    } catch (error) {
      throw new Error('La lista de rutas de la carpeta no es válida');
    }
  }

  const files = await Promise.all(uploadedFiles.map(async (file, index) => ({
    name: file.originalname,
    relativePath: safeEntryName(relativePaths[index] || file.originalname),
    buffer: await fs.readFile(file.path),
  })));

  const manifestFiles = files.filter((file) => path.posix.basename(file.relativePath).toLowerCase() === 'propiedad.json');
  if (manifestFiles.length !== 1) {
    throw new Error('Cada envío de carpeta debe contener exactamente un propiedad.json');
  }

  const manifestFile = manifestFiles[0];
  const directory = path.posix.dirname(manifestFile.relativePath);
  const imageFiles = files.filter((file) => isSupportedImage(file.relativePath));
  if (imageFiles.length > 50) throw new Error('Máximo 50 imágenes por propiedad');

  return {
    manifest: parseManifest(manifestFile.buffer, directory),
    manifestBuffer: manifestFile.buffer,
    files: imageFiles,
    sourceFolder: directory === '.' ? 'carpeta-seleccionada' : directory,
  };
};

const removeTemporaryFiles = async (requestFiles) => {
  const allFiles = Object.values(requestFiles || {}).flat();
  await Promise.allSettled(allFiles.map((file) => fs.unlink(file.path)));
};

router.post(
  '/property-folder',
  authMiddleware,
  upload.fields([
    { name: 'archive', maxCount: 1 },
    { name: 'files', maxCount: 51 },
  ]),
  async (req, res) => {
    let job;
    try {
      const archiveFile = req.files?.archive?.[0];
      const folderFiles = req.files?.files || [];
      if (!archiveFile && !folderFiles.length) {
        return res.status(400).json({ error: 'Selecciona un ZIP o una carpeta de propiedad' });
      }

      job = await prisma.importJob.create({
        data: {
          status: 'PROCESSING',
          sourceType: 'ADMIN_FOLDER',
          originalFilename: archiveFile?.originalname || req.body.folderName || 'carpeta-seleccionada',
          createdById: req.user.id,
        },
      });

      const payloads = archiveFile
        ? await payloadsFromZip(archiveFile.path)
        : [await payloadFromFolderUpload(folderFiles, req.body.paths)];

      await prisma.importJob.update({
        where: { id: job.id },
        data: { totalProperties: payloads.length },
      });

      const results = [];
      const errors = [];
      for (const payload of payloads) {
        try {
          results.push(await importProperty(payload));
        } catch (error) {
          errors.push({ folder: payload.sourceFolder, error: error.message });
        }
      }

      const successful = results.length;
      const failed = errors.length;
      const status = failed === 0 ? 'COMPLETED' : successful > 0 ? 'PARTIAL' : 'FAILED';
      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status,
          successfulProperties: successful,
          failedProperties: failed,
          errors: failed ? JSON.stringify(errors) : null,
          finishedAt: new Date(),
        },
      });

      return res.status(failed && !successful ? 422 : 200).json({
        jobId: job.id,
        status,
        results,
        errors,
      });
    } catch (error) {
      console.error('Property import error:', error);
      if (job) {
        await prisma.importJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            failedProperties: 1,
            errors: JSON.stringify([{ error: error.message }]),
            finishedAt: new Date(),
          },
        }).catch(() => {});
      }
      return res.status(400).json({ error: error.message || 'No fue posible importar la propiedad' });
    } finally {
      await removeTemporaryFiles(req.files);
    }
  },
);

router.get('/', authMiddleware, async (req, res) => {
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50,
  });
  res.json(jobs);
});

router.get('/:id', authMiddleware, async (req, res) => {
  const job = await prisma.importJob.findUnique({ where: { id: req.params.id } });
  if (!job) return res.status(404).json({ error: 'Importación no encontrada' });
  return res.json(job);
});

module.exports = router;
