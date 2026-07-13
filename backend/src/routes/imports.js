const express = require('express');
const multer = require('multer');
const AdmZip = require('adm-zip');
const crypto = require('crypto');
const path = require('path');
const prisma = require('../config/db');
const { authMiddleware } = require('../config/auth');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const router = express.Router();
const MAX_ARCHIVE_BYTES = 200 * 1024 * 1024;
const MAX_IMAGE_BYTES = 12 * 1024 * 1024;
const MAX_IMAGES_PER_PROPERTY = 50;
const MAX_TOTAL_FILES = 500;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: {
    fileSize: MAX_ARCHIVE_BYTES,
    files: MAX_TOTAL_FILES,
  },
});

const normalizeRelativePath = (value) => String(value || '')
  .replace(/\\/g, '/')
  .replace(/^\/+/, '')
  .replace(/\/+/g, '/');

const assertSafePath = (relativePath) => {
  const normalized = normalizeRelativePath(relativePath);
  if (!normalized || normalized.includes('\0') || path.posix.isAbsolute(normalized)) {
    throw new Error(`Ruta inválida: ${relativePath}`);
  }
  const segments = normalized.split('/');
  if (segments.some((segment) => segment === '..')) {
    throw new Error(`Ruta insegura detectada: ${relativePath}`);
  }
  return normalized;
};

const detectImageType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.toString('ascii', 0, 4) === 'RIFF' && buffer.toString('ascii', 8, 12) === 'WEBP') return 'webp';
  if (buffer.toString('ascii', 4, 12).includes('ftypavif') || buffer.toString('ascii', 4, 12).includes('ftypavis')) return 'avif';
  return null;
};

const slugify = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '')
  .slice(0, 120);

const numberOrNull = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const integerOrNull = (value) => {
  const parsed = numberOrNull(value);
  return parsed === null ? null : Math.round(parsed);
};

const normalizeOperation = (value) => {
  const operation = String(value || '').trim().toLowerCase();
  if (['sale', 'venta', 'sell'].includes(operation)) return 'venta';
  if (['rent', 'renta', 'alquiler'].includes(operation)) return 'renta';
  throw new Error('operationType debe ser SALE/RENT o venta/renta');
};

const buildFileRecords = (req) => {
  const selectedFiles = req.files?.files || [];
  const archiveFile = req.files?.archive?.[0];

  if (archiveFile) {
    const zip = new AdmZip(archiveFile.buffer);
    const entries = zip.getEntries();
    if (entries.length > MAX_TOTAL_FILES) throw new Error(`El ZIP supera el límite de ${MAX_TOTAL_FILES} archivos`);

    return {
      originalFilename: archiveFile.originalname,
      records: entries
        .filter((entry) => !entry.isDirectory)
        .map((entry) => {
          const relativePath = assertSafePath(entry.entryName);
          const buffer = entry.getData();
          if (buffer.length > MAX_ARCHIVE_BYTES) throw new Error(`Archivo demasiado grande: ${relativePath}`);
          return { relativePath, buffer, size: buffer.length };
        }),
    };
  }

  let relativePaths = [];
  try {
    relativePaths = JSON.parse(req.body.relativePaths || '[]');
  } catch {
    throw new Error('relativePaths no contiene JSON válido');
  }

  if (!Array.isArray(relativePaths) || relativePaths.length !== selectedFiles.length) {
    throw new Error('La lista de rutas no coincide con los archivos seleccionados');
  }

  return {
    originalFilename: relativePaths[0]?.split('/')[0] || 'carpeta-local',
    records: selectedFiles.map((file, index) => ({
      relativePath: assertSafePath(relativePaths[index] || file.originalname),
      buffer: file.buffer,
      size: file.size,
      mimetype: file.mimetype,
    })),
  };
};

const getManifestImageRecords = (manifest, propertyDirectory, folderFiles) => {
  const availableImages = folderFiles.filter((file) => IMAGE_EXTENSIONS.has(path.posix.extname(file.relativePath).toLowerCase()));
  let selectedImages;

  if (Array.isArray(manifest.images) && manifest.images.length > 0) {
    selectedImages = manifest.images.map((image, index) => {
      const metadata = typeof image === 'string' ? { file: image } : image;
      if (!metadata?.file) throw new Error(`La imagen ${index + 1} no incluye el campo file`);
      const expectedPath = normalizeRelativePath(path.posix.join(propertyDirectory, metadata.file));
      const record = availableImages.find((candidate) => candidate.relativePath === expectedPath);
      if (!record) throw new Error(`No se encontró la imagen declarada: ${metadata.file}`);
      return { record, metadata, index };
    });
  } else {
    selectedImages = availableImages
      .sort((a, b) => a.relativePath.localeCompare(b.relativePath, 'es', { numeric: true }))
      .map((record, index) => ({ record, metadata: {}, index }));
  }

  if (selectedImages.length === 0) throw new Error('La propiedad debe incluir al menos una imagen');
  if (selectedImages.length > MAX_IMAGES_PER_PROPERTY) throw new Error(`Máximo ${MAX_IMAGES_PER_PROPERTY} imágenes por propiedad`);

  selectedImages.forEach(({ record }) => {
    if (record.size > MAX_IMAGE_BYTES) throw new Error(`La imagen ${record.relativePath} supera 12 MB`);
    if (!detectImageType(record.buffer)) throw new Error(`El archivo no es una imagen válida: ${record.relativePath}`);
  });

  const requestedCover = manifest.cover
    ? normalizeRelativePath(path.posix.join(propertyDirectory, manifest.cover))
    : null;

  let coverIndex = selectedImages.findIndex(({ record, metadata }) => (
    metadata.isCover === true || (requestedCover && record.relativePath === requestedCover)
  ));

  if (coverIndex < 0) {
    coverIndex = selectedImages.findIndex(({ record }) => /(^|\/)(portada|cover|fachada)\.(jpe?g|png|webp|avif)$/i.test(record.relativePath));
  }
  if (coverIndex < 0) coverIndex = 0;

  return selectedImages.map((item, index) => ({ ...item, isCover: index === coverIndex }));
};

const calculateSourceHash = (manifestRecord, images) => {
  const hash = crypto.createHash('sha256');
  hash.update(manifestRecord.buffer);
  images
    .slice()
    .sort((a, b) => a.record.relativePath.localeCompare(b.record.relativePath))
    .forEach(({ record }) => {
      hash.update(record.relativePath);
      hash.update(record.buffer);
    });
  return hash.digest('hex');
};

const mapManifestToProperty = (manifest, propertyDirectory, sourceHash) => {
  if (!manifest || typeof manifest !== 'object') throw new Error('propiedad.json debe contener un objeto JSON');
  if (!manifest.title || typeof manifest.title !== 'string') throw new Error('Falta el título de la propiedad');

  const generatedSlug = slugify(manifest.slug || manifest.title);
  if (!generatedSlug) throw new Error('No fue posible generar un slug válido');

  const referenceCode = String(manifest.referenceCode || generatedSlug).trim();
  if (!referenceCode) throw new Error('Falta referenceCode');

  const priceValue = typeof manifest.price === 'object' ? manifest.price.amount : manifest.price;
  const price = numberOrNull(priceValue);
  if (price === null || price < 0) throw new Error('El precio debe ser un número válido');

  const currency = typeof manifest.price === 'object'
    ? (manifest.price.currency || manifest.currency || 'MXN')
    : (manifest.currency || 'MXN');
  const location = manifest.location || {};
  const features = manifest.features || {};
  const contact = manifest.contact || {};
  const publicationStatus = String(manifest.status || '').toUpperCase();
  const published = publicationStatus
    ? publicationStatus === 'PUBLISHED'
    : manifest.published !== false;
  const archived = publicationStatus === 'ARCHIVED';

  return {
    referenceCode,
    title: manifest.title.trim(),
    slug: generatedSlug,
    shortDescription: manifest.shortDescription || null,
    description: manifest.description || manifest.shortDescription || manifest.title,
    operation: normalizeOperation(manifest.operationType || manifest.operation),
    type: String(manifest.propertyType || manifest.type || 'otros').trim().toLowerCase(),
    price,
    currency: String(currency).toUpperCase(),
    bedrooms: integerOrNull(features.bedrooms ?? manifest.bedrooms),
    bathrooms: integerOrNull(features.bathrooms ?? manifest.bathrooms),
    area: numberOrNull(features.builtAreaM2 ?? manifest.area),
    lotArea: numberOrNull(features.landAreaM2 ?? manifest.lotArea),
    parking: integerOrNull(features.parkingSpaces ?? manifest.parking),
    yearBuilt: integerOrNull(features.yearBuilt ?? manifest.yearBuilt),
    city: String(location.city || manifest.city || '').trim(),
    state: String(location.state || manifest.state || '').trim(),
    country: String(location.country || manifest.country || 'México').trim(),
    neighborhood: location.neighborhood || manifest.neighborhood || null,
    address: location.address || manifest.address || null,
    lat: numberOrNull(location.latitude ?? manifest.lat),
    lng: numberOrNull(location.longitude ?? manifest.lng),
    features: JSON.stringify(manifest.amenities || features.amenities || manifest.featuresList || []),
    status: archived ? 'archived' : String(manifest.listingStatus || 'available').toLowerCase(),
    featured: Boolean(manifest.featured),
    published: archived ? false : published,
    contactName: contact.name || manifest.contactName || null,
    contactPhone: contact.phone || manifest.contactPhone || null,
    contactEmail: contact.email || manifest.contactEmail || null,
    whatsapp: contact.whatsapp || manifest.whatsapp || null,
    sourceType: 'ADMIN_FOLDER',
    sourceFolder: propertyDirectory,
    sourceHash,
    archivedAt: archived ? new Date() : null,
  };
};

const ensureUniqueSlug = async (desiredSlug, existingPropertyId, referenceCode) => {
  const collision = await prisma.property.findUnique({ where: { slug: desiredSlug } });
  if (!collision || collision.id === existingPropertyId) return desiredSlug;
  return `${desiredSlug}-${slugify(referenceCode).slice(0, 24)}`;
};

const importOneProperty = async (manifestRecord, allRecords) => {
  const propertyDirectory = path.posix.dirname(manifestRecord.relativePath);
  const folderPrefix = propertyDirectory === '.' ? '' : `${propertyDirectory}/`;
  const folderFiles = allRecords.filter((record) => (
    propertyDirectory === '.'
      ? !record.relativePath.includes('/')
      : record.relativePath.startsWith(folderPrefix)
  ));

  let manifest;
  try {
    manifest = JSON.parse(manifestRecord.buffer.toString('utf8').replace(/^\uFEFF/, ''));
  } catch {
    throw new Error(`${manifestRecord.relativePath}: JSON inválido`);
  }

  const images = getManifestImageRecords(manifest, propertyDirectory, folderFiles);
  const sourceHash = calculateSourceHash(manifestRecord, images);
  const propertyData = mapManifestToProperty(manifest, propertyDirectory, sourceHash);

  const existing = await prisma.property.findFirst({
    where: {
      OR: [
        { referenceCode: propertyData.referenceCode },
        { slug: propertyData.slug },
      ],
    },
    include: { photos: true },
  });

  if (existing?.sourceHash === sourceHash) {
    return { action: 'skipped', property: existing };
  }

  propertyData.slug = await ensureUniqueSlug(propertyData.slug, existing?.id, propertyData.referenceCode);

  const uploaded = [];
  try {
    for (let index = 0; index < images.length; index += 1) {
      const { record, metadata, isCover } = images[index];
      const result = await uploadToCloudinary(record.buffer, {
        folder: `circulo-bienes-raices/properties/${slugify(propertyData.referenceCode)}`,
        resource_type: 'image',
      });
      uploaded.push({
        url: result.secure_url,
        publicId: result.public_id,
        alt: metadata.alt || propertyData.title,
        order: Number.isInteger(metadata.order) ? metadata.order : index,
        isMain: isCover,
      });
    }

    const result = await prisma.$transaction(async (tx) => {
      const oldPhotos = existing
        ? await tx.photo.findMany({ where: { propertyId: existing.id } })
        : [];

      const property = existing
        ? await tx.property.update({ where: { id: existing.id }, data: propertyData })
        : await tx.property.create({ data: propertyData });

      if (existing) await tx.photo.deleteMany({ where: { propertyId: property.id } });
      await tx.photo.createMany({
        data: uploaded.map((photo) => ({ ...photo, propertyId: property.id })),
      });

      return { property, oldPhotos };
    });

    await Promise.allSettled(
      result.oldPhotos
        .filter((photo) => photo.publicId)
        .map((photo) => deleteFromCloudinary(photo.publicId)),
    );

    return { action: existing ? 'updated' : 'created', property: result.property };
  } catch (error) {
    await Promise.allSettled(uploaded.map((photo) => deleteFromCloudinary(photo.publicId)));
    throw error;
  }
};

router.post(
  '/property-folder',
  authMiddleware,
  upload.fields([
    { name: 'files', maxCount: MAX_TOTAL_FILES },
    { name: 'archive', maxCount: 1 },
  ]),
  async (req, res) => {
    let job;
    try {
      const { records, originalFilename } = buildFileRecords(req);
      const manifests = records.filter((record) => path.posix.basename(record.relativePath).toLowerCase() === 'propiedad.json');
      if (manifests.length === 0) throw new Error('No se encontró ningún archivo propiedad.json');

      job = await prisma.importJob.create({
        data: {
          status: 'PROCESSING',
          originalFilename,
          totalProperties: manifests.length,
          createdById: req.user.id,
        },
      });

      const results = [];
      const errors = [];
      for (const manifestRecord of manifests) {
        try {
          const result = await importOneProperty(manifestRecord, records);
          results.push({
            folder: path.posix.dirname(manifestRecord.relativePath),
            action: result.action,
            id: result.property.id,
            title: result.property.title,
          });
        } catch (error) {
          errors.push({
            folder: path.posix.dirname(manifestRecord.relativePath),
            error: error.message,
          });
        }
      }

      const successfulProperties = results.filter((item) => item.action !== 'skipped').length;
      const skippedProperties = results.filter((item) => item.action === 'skipped').length;
      const status = errors.length === 0 ? 'COMPLETED' : (results.length > 0 ? 'PARTIAL' : 'FAILED');

      await prisma.importJob.update({
        where: { id: job.id },
        data: {
          status,
          successfulProperties,
          skippedProperties,
          failedProperties: errors.length,
          errors: errors.length ? JSON.stringify(errors) : null,
          finishedAt: new Date(),
        },
      });

      return res.status(errors.length && results.length === 0 ? 422 : 200).json({
        jobId: job.id,
        status,
        total: manifests.length,
        successful: successfulProperties,
        skipped: skippedProperties,
        failed: errors.length,
        results,
        errors,
      });
    } catch (error) {
      console.error('Property folder import failed:', error);
      if (job) {
        await prisma.importJob.update({
          where: { id: job.id },
          data: {
            status: 'FAILED',
            failedProperties: job.totalProperties || 1,
            errors: JSON.stringify([{ error: error.message }]),
            finishedAt: new Date(),
          },
        }).catch(() => null);
      }
      return res.status(400).json({ error: error.message || 'No se pudo procesar la importación' });
    }
  },
);

router.get('/', authMiddleware, async (req, res) => {
  const jobs = await prisma.importJob.findMany({
    orderBy: { createdAt: 'desc' },
    take: 30,
  });
  res.json(jobs);
});

module.exports = router;
