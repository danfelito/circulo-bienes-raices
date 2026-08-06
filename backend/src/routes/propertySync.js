const express = require('express');
const multer = require('multer');
const path = require('path');
const prisma = require('../config/db');
const { authMiddleware } = require('../config/auth');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const router = express.Router();

const MAX_FILES = 80;
const MAX_FILE_BYTES = 150 * 1024 * 1024;
const VALID_TYPES = new Set(['casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', 'rancho', 'otros']);
const VALID_STATUSES = new Set(['available', 'sold', 'rented', 'reserved']);
const VALID_CURRENCIES = new Set(['MXN', 'USD', 'COP', 'EUR']);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { files: MAX_FILES, fileSize: MAX_FILE_BYTES, fields: 30 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) return cb(null, true);
    return cb(new Error(`Formato no permitido para sincronización: ${file.originalname}`));
  },
});

const isVideo = file => file?.mimetype?.startsWith('video/') || /\.(mp4|mov|m4v|webm)(?:$|\?)/i.test(file?.originalname || '');
const baseName = value => path.basename(String(value || '').replace(/\\/g, '/'));
const nullableNumber = value => {
  if (value === null || value === undefined || value === '') return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};
const nullableInteger = value => {
  const parsed = nullableNumber(value);
  return parsed === null ? null : Math.round(parsed);
};
const safeJson = (value, fallback) => {
  try { return JSON.parse(value || ''); } catch { return fallback; }
};

const slugBase = title => String(title || 'propiedad')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '') || 'propiedad';

const uniqueSlug = async title => {
  const base = slugBase(title);
  let candidate = base;
  let suffix = 2;
  while (await prisma.property.findUnique({ where: { slug: candidate }, select: { id: true } })) {
    candidate = `${base}-${suffix++}`;
  }
  return candidate;
};

const sanitizeDraft = async (draft, existing) => {
  const title = String(draft.title || '').trim().slice(0, 180);
  const description = String(draft.description || '').trim().slice(0, 12000);
  const city = String(draft.city || '').trim().slice(0, 120);
  const price = nullableNumber(draft.price);

  if (!title) throw Object.assign(new Error('El título es obligatorio'), { statusCode: 400 });
  if (!description) throw Object.assign(new Error('La descripción es obligatoria'), { statusCode: 400 });
  if (!city) throw Object.assign(new Error('La ciudad es obligatoria'), { statusCode: 400 });
  if (price === null || price <= 0) throw Object.assign(new Error('El precio debe ser mayor que cero'), { statusCode: 400 });

  const features = Array.isArray(draft.features)
    ? [...new Set(draft.features.map(value => String(value).trim()).filter(Boolean))].slice(0, 80)
    : [];

  return {
    title,
    slug: existing?.slug || await uniqueSlug(title),
    description,
    operation: draft.operation === 'renta' ? 'renta' : 'venta',
    type: VALID_TYPES.has(draft.type) ? draft.type : 'otros',
    price,
    currency: VALID_CURRENCIES.has(draft.currency) ? draft.currency : 'MXN',
    bedrooms: nullableInteger(draft.bedrooms),
    bathrooms: nullableNumber(draft.bathrooms),
    area: nullableNumber(draft.area),
    lotArea: nullableNumber(draft.lotArea),
    parking: nullableInteger(draft.parking),
    yearBuilt: nullableInteger(draft.yearBuilt),
    city,
    state: String(draft.state || 'Veracruz').trim().slice(0, 120),
    country: String(draft.country || 'México').trim().slice(0, 120),
    address: String(draft.address || '').trim().slice(0, 300) || null,
    lat: nullableNumber(draft.lat),
    lng: nullableNumber(draft.lng),
    features: features.length ? JSON.stringify(features) : null,
    status: VALID_STATUSES.has(draft.status) ? draft.status : 'available',
    featured: Boolean(draft.featured),
    published: draft.published !== false,
  };
};

const removeMediaRecord = async media => {
  if (media.publicId) await deleteFromCloudinary(media.publicId);
  await prisma.photo.delete({ where: { id: media.id } });
};

router.get('/:sourceId', authMiddleware, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { sourceId: req.params.sourceId },
      include: { photos: { orderBy: { order: 'asc' } } },
    });
    if (!property) return res.status(404).json({ error: 'Propiedad sincronizada no encontrada' });
    res.json(property);
  } catch (error) {
    console.error('Get synced property error:', error);
    res.status(500).json({ error: 'No se pudo consultar la propiedad sincronizada' });
  }
});

router.patch('/:sourceId/status', authMiddleware, async (req, res) => {
  try {
    const status = VALID_STATUSES.has(req.body.status) ? req.body.status : null;
    if (!status) return res.status(400).json({ error: 'Estado no válido' });

    const property = await prisma.property.update({
      where: { sourceId: req.params.sourceId },
      data: {
        status,
        published: req.body.published === undefined ? undefined : Boolean(req.body.published),
        sourceUpdatedAt: new Date(),
      },
    });
    res.json(property);
  } catch (error) {
    console.error('Update synced property status error:', error);
    res.status(error.code === 'P2025' ? 404 : 500).json({ error: error.code === 'P2025' ? 'Propiedad no encontrada' : 'No se pudo actualizar el estado' });
  }
});

router.post('/sync/upsert', authMiddleware, upload.array('files', MAX_FILES), async (req, res) => {
  const uploadedAssets = [];
  const createdMediaIds = [];

  try {
    const sourceId = String(req.body.sourceId || '').trim().slice(0, 160);
    if (!sourceId) return res.status(400).json({ error: 'sourceId es obligatorio' });

    const draft = safeJson(req.body.draft, null);
    const manifest = safeJson(req.body.manifest, { files: [], removedFilenames: [], mediaOrder: [] });
    if (!draft || typeof draft !== 'object') return res.status(400).json({ error: 'El borrador no tiene un formato válido' });

    const existing = await prisma.property.findUnique({
      where: { sourceId },
      include: { photos: { orderBy: { order: 'asc' } } },
    });
    const propertyData = await sanitizeDraft(draft, existing);
    const sourceUpdatedAt = draft.updatedAt && !Number.isNaN(Date.parse(draft.updatedAt)) ? new Date(draft.updatedAt) : new Date();

    const property = existing
      ? await prisma.property.update({
          where: { id: existing.id },
          data: { ...propertyData, sourceUpdatedAt, syncSource: 'circulo-media-sync' },
        })
      : await prisma.property.create({
          data: { ...propertyData, sourceId, sourceUpdatedAt, syncSource: 'circulo-media-sync', published: false },
        });

    const metadataEntries = Array.isArray(manifest.files) ? manifest.files : [];
    const metadataByUpload = new Map();
    for (const entry of metadataEntries) {
      metadataByUpload.set(baseName(entry.uploadName || entry.optimizedName || entry.sourceFilename), entry);
    }

    const currentMedia = await prisma.photo.findMany({ where: { propertyId: property.id } });
    const existingBySource = new Map(currentMedia.filter(item => item.sourceFilename).map(item => [item.sourceFilename, item]));
    const uploaded = [];
    const skipped = [];

    for (const file of req.files || []) {
      const meta = metadataByUpload.get(baseName(file.originalname)) || {};
      const sourceFilename = String(meta.sourceFilename || file.originalname).replace(/\\/g, '/').slice(0, 500);
      const prior = existingBySource.get(sourceFilename);

      if (prior && meta.checksum && prior.checksum === meta.checksum) {
        skipped.push(sourceFilename);
        continue;
      }
      if (prior) {
        await removeMediaRecord(prior);
        existingBySource.delete(sourceFilename);
      }

      const video = isVideo(file);
      const result = await uploadToCloudinary(file.buffer, {
        folder: `circulo-bienes-raices/${property.id}`,
        resource_type: video ? 'video' : 'image',
        transformation: video ? undefined : [
          { width: 2048, height: 2048, crop: 'limit' },
          { quality: 'auto:good' },
          { fetch_format: 'auto' },
        ],
      });
      const storedPublicId = video ? `video:${result.public_id}` : result.public_id;
      uploadedAssets.push(storedPublicId);

      const media = await prisma.photo.create({
        data: {
          url: result.secure_url,
          publicId: storedPublicId,
          alt: video ? `Video de ${property.title}` : `${property.title} - ${baseName(sourceFilename).replace(/[-_]/g, ' ').replace(/\.[^.]+$/, '')}`,
          order: 9999,
          isMain: false,
          sourceFilename,
          checksum: meta.checksum ? String(meta.checksum).slice(0, 128) : null,
          originalBytes: nullableInteger(meta.originalBytes),
          optimizedBytes: nullableInteger(meta.optimizedBytes || file.size),
          width: nullableInteger(meta.width),
          height: nullableInteger(meta.height),
          duration: nullableNumber(meta.duration),
          codec: meta.codec ? String(meta.codec).slice(0, 80) : null,
          qualityPreset: meta.qualityPreset ? String(meta.qualityPreset).slice(0, 80) : null,
          propertyId: property.id,
        },
      });
      createdMediaIds.push(media.id);
      existingBySource.set(sourceFilename, media);
      uploaded.push(sourceFilename);
    }

    const removedFilenames = Array.isArray(manifest.removedFilenames) ? manifest.removedFilenames.map(value => String(value).replace(/\\/g, '/')) : [];
    for (const sourceFilename of removedFilenames) {
      const media = existingBySource.get(sourceFilename);
      if (!media) continue;
      await removeMediaRecord(media);
      existingBySource.delete(sourceFilename);
    }

    const allMedia = await prisma.photo.findMany({ where: { propertyId: property.id } });
    const orderList = Array.isArray(manifest.mediaOrder) ? manifest.mediaOrder.map(value => String(value).replace(/\\/g, '/')) : [];
    const orderRank = new Map(orderList.map((value, index) => [value, index]));
    const ordered = [...allMedia].sort((a, b) => {
      const aRank = orderRank.has(a.sourceFilename) ? orderRank.get(a.sourceFilename) : Number.MAX_SAFE_INTEGER;
      const bRank = orderRank.has(b.sourceFilename) ? orderRank.get(b.sourceFilename) : Number.MAX_SAFE_INTEGER;
      if (aRank !== bRank) return aRank - bRank;
      const aVideo = String(a.publicId || '').startsWith('video:');
      const bVideo = String(b.publicId || '').startsWith('video:');
      if (aVideo !== bVideo) return aVideo ? 1 : -1;
      return String(a.sourceFilename || a.id).localeCompare(String(b.sourceFilename || b.id), 'es', { numeric: true });
    });

    const requestedMain = String(draft.mainPhotoFilename || '').replace(/\\/g, '/');
    const requestedMedia = ordered.find(media => {
      const video = String(media.publicId || '').startsWith('video:');
      return !video && requestedMain && (media.sourceFilename === requestedMain || baseName(media.sourceFilename) === baseName(requestedMain));
    });
    const fallbackMain = ordered.find(media => !String(media.publicId || '').startsWith('video:'));
    const mainId = requestedMedia?.id || fallbackMain?.id || null;
    const updates = ordered.map((media, index) => prisma.photo.update({
      where: { id: media.id },
      data: { order: index, isMain: media.id === mainId },
    }));
    if (updates.length) await prisma.$transaction(updates);

    const imageCount = ordered.filter(media => !String(media.publicId || '').startsWith('video:')).length;
    if (!imageCount) throw Object.assign(new Error('La propiedad debe conservar al menos una fotografía'), { statusCode: 400 });

    const finalProperty = await prisma.property.update({
      where: { id: property.id },
      data: { published: propertyData.published },
      include: { photos: { orderBy: { order: 'asc' } } },
    });

    res.status(existing ? 200 : 201).json({
      property: finalProperty,
      created: !existing,
      summary: {
        uploaded: uploaded.length,
        unchanged: skipped.length,
        removed: removedFilenames.length,
        images: finalProperty.photos.filter(media => !String(media.publicId || '').startsWith('video:')).length,
        videos: finalProperty.photos.filter(media => String(media.publicId || '').startsWith('video:')).length,
        published: finalProperty.published,
        status: finalProperty.status,
      },
    });
  } catch (error) {
    console.error('Property local sync error:', error);
    for (const publicId of uploadedAssets.reverse()) {
      try { await deleteFromCloudinary(publicId); } catch (cleanupError) { console.error('Sync Cloudinary cleanup error:', cleanupError); }
    }
    if (createdMediaIds.length) {
      try { await prisma.photo.deleteMany({ where: { id: { in: createdMediaIds } } }); } catch (cleanupError) { console.error('Sync database cleanup error:', cleanupError); }
    }
    res.status(error.statusCode || 500).json({ error: error.message || 'No se pudo sincronizar la propiedad' });
  }
});

module.exports = router;
