const crypto = require('crypto');
const path = require('path');
const prisma = require('../config/db');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const MAX_IMAGE_SIZE = 12 * 1024 * 1024;
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif']);

const slugify = (value = '') => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const naturalCompare = (left, right) => left.localeCompare(right, 'es', {
  numeric: true,
  sensitivity: 'base',
});

const isSupportedImage = (name) => IMAGE_EXTENSIONS.has(path.extname(name).toLowerCase());

const detectImageType = (buffer) => {
  if (!Buffer.isBuffer(buffer) || buffer.length < 12) return null;
  if (buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff) return 'jpeg';
  if (buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) return 'png';
  if (buffer.subarray(0, 4).toString('ascii') === 'RIFF' && buffer.subarray(8, 12).toString('ascii') === 'WEBP') return 'webp';
  if (buffer.subarray(4, 8).toString('ascii') === 'ftyp') {
    const brand = buffer.subarray(8, 12).toString('ascii');
    if (['avif', 'avis'].includes(brand)) return 'avif';
  }
  return null;
};

const parseNumber = (value, fallback = null) => {
  if (value === '' || value === undefined || value === null) return fallback;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const normalizeOperation = (value) => {
  const normalized = String(value || 'venta').toLowerCase();
  if (['rent', 'renta', 'alquiler', 'lease'].includes(normalized)) return 'renta';
  return 'venta';
};

const normalizeManifest = (manifest, sourceFolder) => {
  if (!manifest || typeof manifest !== 'object' || Array.isArray(manifest)) {
    throw new Error('propiedad.json debe contener un objeto JSON');
  }

  const location = manifest.location || {};
  const details = manifest.features && !Array.isArray(manifest.features) ? manifest.features : {};
  const priceData = manifest.price && typeof manifest.price === 'object' ? manifest.price : {};
  const title = String(manifest.title || '').trim();
  const description = String(manifest.description || '').trim();
  const city = String(location.city || manifest.city || '').trim();
  const type = String(manifest.propertyType || manifest.type || 'otros').trim().toLowerCase();
  const price = parseNumber(priceData.amount ?? manifest.price);

  const missing = [];
  if (!title) missing.push('title');
  if (!description) missing.push('description');
  if (!city) missing.push('location.city');
  if (price === null || price < 0) missing.push('price');
  if (missing.length) throw new Error(`Campos inválidos o faltantes: ${missing.join(', ')}`);

  const declaredStatus = String(manifest.status || '').toUpperCase();
  const published = manifest.published === false
    ? false
    : !['DRAFT', 'ARCHIVED'].includes(declaredStatus);
  const availabilityStatus = ['available', 'sold', 'rented', 'reserved', 'archived'].includes(String(manifest.availabilityStatus || '').toLowerCase())
    ? String(manifest.availabilityStatus).toLowerCase()
    : declaredStatus === 'ARCHIVED' ? 'archived' : 'available';

  const amenities = Array.isArray(manifest.amenities)
    ? manifest.amenities
    : Array.isArray(manifest.features)
      ? manifest.features
      : [];

  return {
    referenceCode: manifest.referenceCode ? String(manifest.referenceCode).trim() : null,
    slug: slugify(manifest.slug || title),
    title,
    description,
    operation: normalizeOperation(manifest.operationType || manifest.operation),
    type,
    price,
    currency: String(priceData.currency || manifest.currency || 'MXN').toUpperCase(),
    bedrooms: parseNumber(details.bedrooms ?? manifest.bedrooms),
    bathrooms: parseNumber(details.bathrooms ?? manifest.bathrooms),
    parking: parseNumber(details.parkingSpaces ?? manifest.parking),
    area: parseNumber(details.builtAreaM2 ?? manifest.area),
    lotArea: parseNumber(details.landAreaM2 ?? manifest.lotArea),
    yearBuilt: parseNumber(details.yearBuilt ?? manifest.yearBuilt),
    country: String(location.country || manifest.country || 'México').trim(),
    state: String(location.state || manifest.state || 'Veracruz').trim(),
    city,
    address: String(location.address || manifest.address || '').trim() || null,
    lat: parseNumber(location.latitude ?? manifest.lat),
    lng: parseNumber(location.longitude ?? manifest.lng),
    features: amenities.length ? JSON.stringify(amenities.map(String)) : null,
    featured: manifest.featured === true,
    published,
    status: availabilityStatus,
    sourceType: 'ADMIN_FOLDER',
    sourceFolder: sourceFolder || null,
    archivedAt: availabilityStatus === 'archived' ? new Date() : null,
  };
};

const buildImagePlan = (manifest, files) => {
  const imageFiles = files
    .filter((file) => isSupportedImage(file.relativePath || file.name))
    .sort((a, b) => naturalCompare(a.relativePath || a.name, b.relativePath || b.name));

  if (!imageFiles.length) throw new Error('La propiedad debe contener al menos una imagen');

  imageFiles.forEach((file) => {
    if (!file.buffer || file.buffer.length > MAX_IMAGE_SIZE) {
      throw new Error(`La imagen ${file.name} supera 12 MB o está vacía`);
    }
    if (!detectImageType(file.buffer)) {
      throw new Error(`El archivo ${file.name} no contiene una imagen válida`);
    }
  });

  const declared = Array.isArray(manifest.images) ? manifest.images : [];
  const byName = new Map();
  imageFiles.forEach((file) => {
    byName.set(path.basename(file.relativePath || file.name).toLowerCase(), file);
    byName.set((file.relativePath || file.name).replace(/\\/g, '/').toLowerCase(), file);
  });

  const planned = [];
  declared.forEach((image, index) => {
    const requestedName = typeof image === 'string' ? image : image.file;
    const file = byName.get(String(requestedName || '').replace(/\\/g, '/').toLowerCase())
      || byName.get(path.basename(String(requestedName || '')).toLowerCase());
    if (!file || planned.some((item) => item.file === file)) return;
    planned.push({
      file,
      alt: typeof image === 'object' ? image.alt : null,
      order: typeof image === 'object' && Number.isFinite(Number(image.order)) ? Number(image.order) : index,
      isCover: typeof image === 'object' && image.isCover === true,
    });
  });

  imageFiles.forEach((file) => {
    if (!planned.some((item) => item.file === file)) {
      planned.push({ file, alt: null, order: planned.length, isCover: false });
    }
  });

  planned.sort((a, b) => a.order - b.order || naturalCompare(a.file.name, b.file.name));

  const explicitCover = String(manifest.cover || '').toLowerCase();
  let coverIndex = planned.findIndex((item) => item.isCover);
  if (coverIndex < 0 && explicitCover) {
    coverIndex = planned.findIndex((item) => {
      const relative = (item.file.relativePath || item.file.name).replace(/\\/g, '/').toLowerCase();
      return relative === explicitCover || path.basename(relative) === path.basename(explicitCover);
    });
  }
  if (coverIndex < 0) {
    coverIndex = planned.findIndex((item) => /^(portada|cover|fachada)([._-]|$)/i.test(path.basename(item.file.name)));
  }
  if (coverIndex < 0) coverIndex = 0;

  return planned.map((item, index) => ({
    ...item,
    order: index,
    isCover: index === coverIndex,
  }));
};

const calculateSourceHash = (manifestBuffer, imagePlan) => {
  const hash = crypto.createHash('sha256');
  hash.update(manifestBuffer);
  imagePlan.forEach((item) => {
    hash.update(item.file.relativePath || item.file.name);
    hash.update(item.file.buffer);
  });
  return hash.digest('hex');
};

const ensureUniqueSlug = async (baseSlug, existingId) => {
  const cleanBase = baseSlug || `propiedad-${Date.now()}`;
  let slug = cleanBase;
  let suffix = 2;
  while (true) {
    const found = await prisma.property.findUnique({ where: { slug } });
    if (!found || found.id === existingId) return slug;
    slug = `${cleanBase}-${suffix}`;
    suffix += 1;
  }
};

const importProperty = async ({ manifest, manifestBuffer, files, sourceFolder }) => {
  const data = normalizeManifest(manifest, sourceFolder);
  const imagePlan = buildImagePlan(manifest, files);
  const sourceHash = calculateSourceHash(manifestBuffer, imagePlan);

  let existing = null;
  if (data.referenceCode) {
    existing = await prisma.property.findUnique({ where: { referenceCode: data.referenceCode } });
  }
  if (!existing && data.slug) {
    existing = await prisma.property.findUnique({ where: { slug: data.slug } });
  }

  if (existing?.sourceHash === sourceHash) {
    return { action: 'skipped', property: existing, reason: 'Sin cambios' };
  }

  data.slug = await ensureUniqueSlug(data.slug, existing?.id);
  data.sourceHash = sourceHash;

  const oldPhotos = existing
    ? await prisma.photo.findMany({ where: { propertyId: existing.id } })
    : [];
  const uploaded = [];
  const folderIdentity = slugify(data.referenceCode || data.slug);

  try {
    for (const [index, item] of imagePlan.entries()) {
      const upload = await uploadToCloudinary(item.file.buffer, {
        folder: `circulo-bienes-raices/properties/${folderIdentity}`,
        public_id: `${String(index + 1).padStart(2, '0')}-${slugify(path.parse(item.file.name).name)}`,
        overwrite: true,
        invalidate: true,
      });
      uploaded.push({
        url: upload.secure_url,
        publicId: upload.public_id,
        alt: item.alt || data.title,
        order: index,
        isMain: item.isCover,
      });
    }

    const property = await prisma.$transaction(async (transaction) => {
      const saved = existing
        ? await transaction.property.update({ where: { id: existing.id }, data })
        : await transaction.property.create({ data });

      await transaction.photo.deleteMany({ where: { propertyId: saved.id } });
      for (const photo of uploaded) {
        await transaction.photo.create({ data: { ...photo, propertyId: saved.id } });
      }

      return transaction.property.findUnique({
        where: { id: saved.id },
        include: { photos: { orderBy: [{ isMain: 'desc' }, { order: 'asc' }] } },
      });
    });

    await Promise.allSettled(
      oldPhotos.filter((photo) => photo.publicId).map((photo) => deleteFromCloudinary(photo.publicId)),
    );

    return { action: existing ? 'updated' : 'created', property };
  } catch (error) {
    await Promise.allSettled(uploaded.map((photo) => deleteFromCloudinary(photo.publicId)));
    throw error;
  }
};

module.exports = {
  importProperty,
  isSupportedImage,
};
