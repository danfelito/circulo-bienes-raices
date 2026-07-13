const express = require('express');
const multer = require('multer');
const prisma = require('../config/db');
const { authMiddleware } = require('../config/auth');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const router = express.Router();

const ALLOWED_IMAGE_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'image/avif',
]);

const imageUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, callback) => {
    if (ALLOWED_IMAGE_TYPES.has(file.mimetype)) callback(null, true);
    else callback(new Error('Formato de imagen no permitido'));
  },
});

const toInt = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : null;
};

const toFloat = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number.parseFloat(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const slugify = (value = '') => value
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const parseFeatures = (features) => {
  if (features === null || features === undefined || features === '') return null;
  if (Array.isArray(features)) return JSON.stringify(features);
  if (typeof features !== 'string') return null;
  try {
    const parsed = JSON.parse(features);
    return JSON.stringify(Array.isArray(parsed) ? parsed : []);
  } catch (_) {
    return JSON.stringify(features.split(',').map((item) => item.trim()).filter(Boolean));
  }
};

const normalizePropertyPayload = (body, { partial = false } = {}) => {
  const data = {};
  const strings = [
    'title', 'slug', 'description', 'operation', 'type', 'currency', 'city',
    'state', 'country', 'address', 'status', 'referenceCode', 'sourceType',
    'sourceFolder', 'sourceHash',
  ];

  strings.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) {
      const value = typeof body[key] === 'string' ? body[key].trim() : body[key];
      data[key] = value || null;
    }
  });

  const floats = ['price', 'area', 'lotArea', 'lat', 'lng'];
  floats.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) data[key] = toFloat(body[key]);
  });

  const integers = ['bedrooms', 'bathrooms', 'parking', 'yearBuilt'];
  integers.forEach((key) => {
    if (Object.prototype.hasOwnProperty.call(body, key)) data[key] = toInt(body[key]);
  });

  if (Object.prototype.hasOwnProperty.call(body, 'features')) {
    data.features = parseFeatures(body.features);
  }
  if (Object.prototype.hasOwnProperty.call(body, 'featured')) {
    data.featured = body.featured === true || body.featured === 'true';
  }
  if (Object.prototype.hasOwnProperty.call(body, 'published')) {
    data.published = body.published === true || body.published === 'true';
  }

  if (!partial) {
    const required = ['title', 'description', 'operation', 'type', 'city'];
    const missing = required.filter((key) => !data[key]);
    if (missing.length) {
      const error = new Error(`Campos obligatorios: ${missing.join(', ')}`);
      error.statusCode = 400;
      throw error;
    }
    if (!Number.isFinite(data.price) || data.price < 0) {
      const error = new Error('El precio debe ser un número válido');
      error.statusCode = 400;
      throw error;
    }
    data.currency = data.currency || 'MXN';
    data.state = data.state || 'Veracruz';
    data.country = data.country || 'México';
    data.status = data.status || 'available';
    data.published = data.published !== false;
    data.featured = data.featured === true;
  }

  return data;
};

const uniqueSlug = async (requestedSlug, title, excludeId) => {
  const base = slugify(requestedSlug || title) || `propiedad-${Date.now()}`;
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await prisma.property.findUnique({ where: { slug: candidate } });
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
};

const getPagination = (query) => {
  const page = Math.max(1, Number.parseInt(query.page || '1', 10));
  const limit = Math.min(100, Math.max(1, Number.parseInt(query.limit || '12', 10)));
  return { page, limit, skip: (page - 1) * limit };
};

// Public property catalog
router.get('/', async (req, res) => {
  try {
    const {
      operation, type, city, state, country, minPrice, maxPrice,
      bedrooms, bathrooms, sort, search, featured,
    } = req.query;
    const { page, limit, skip } = getPagination(req.query);
    const where = { published: true };

    if (operation) where.operation = operation;
    if (type) where.type = type;
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (state) where.state = { equals: state, mode: 'insensitive' };
    if (country) where.country = { equals: country, mode: 'insensitive' };
    if (featured === 'true') where.featured = true;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = Number.parseFloat(minPrice);
      if (maxPrice) where.price.lte = Number.parseFloat(maxPrice);
    }
    if (bedrooms) where.bedrooms = { gte: Number.parseInt(bedrooms, 10) };
    if (bathrooms) where.bathrooms = { gte: Number.parseInt(bathrooms, 10) };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { state: { contains: search, mode: 'insensitive' } },
      ];
    }

    const sortOptions = {
      price_asc: { price: 'asc' },
      price_desc: { price: 'desc' },
      oldest: { createdAt: 'asc' },
      newest: { createdAt: 'desc' },
      area_asc: { area: 'asc' },
      area_desc: { area: 'desc' },
    };
    const orderBy = sortOptions[sort] || { createdAt: 'desc' };

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: { photos: { orderBy: [{ isMain: 'desc' }, { order: 'asc' }] } },
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      properties,
      data: properties,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ error: 'Error al cargar propiedades' });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      where: { featured: true, published: true },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { photos: { orderBy: [{ isMain: 'desc' }, { order: 'asc' }] } },
    });
    res.json(properties);
  } catch (error) {
    console.error('Get featured error:', error);
    res.status(500).json({ error: 'Error al cargar propiedades destacadas' });
  }
});

router.get('/cities', async (req, res) => {
  try {
    const cities = await prisma.property.findMany({
      where: { published: true },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    });
    res.json(cities.map(({ city }) => city));
  } catch (error) {
    res.status(500).json({ error: 'Error al cargar ciudades' });
  }
});

// Administrative inventory includes drafts and unpublished properties.
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    const { page, limit, skip } = getPagination(req.query);
    const where = {};
    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search, mode: 'insensitive' } },
        { city: { contains: req.query.search, mode: 'insensitive' } },
        { referenceCode: { contains: req.query.search, mode: 'insensitive' } },
      ];
    }
    if (req.query.published === 'true') where.published = true;
    if (req.query.published === 'false') where.published = false;

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: limit,
        include: { photos: { orderBy: [{ isMain: 'desc' }, { order: 'asc' }] } },
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      properties,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get admin properties error:', error);
    res.status(500).json({ error: 'Error al cargar el inventario' });
  }
});

router.get('/admin/:id', authMiddleware, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: { photos: { orderBy: [{ isMain: 'desc' }, { order: 'asc' }] } },
    });
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });
    return res.json(property);
  } catch (error) {
    return res.status(500).json({ error: 'Error al cargar la propiedad' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const property = await prisma.property.findFirst({
      where: { slug: req.params.slug, published: true },
      include: { photos: { orderBy: [{ isMain: 'desc' }, { order: 'asc' }] } },
    });
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    await prisma.property.update({
      where: { id: property.id },
      data: { views: { increment: 1 } },
    });

    const related = await prisma.property.findMany({
      where: {
        published: true,
        id: { not: property.id },
        OR: [
          { city: property.city },
          { operation: property.operation },
          { type: property.type },
        ],
      },
      take: 3,
      include: { photos: { orderBy: [{ isMain: 'desc' }, { order: 'asc' }] } },
    });

    return res.json({ property, related });
  } catch (error) {
    console.error('Get property error:', error);
    return res.status(500).json({ error: 'Error al cargar la propiedad' });
  }
});

router.post('/', authMiddleware, async (req, res, next) => {
  try {
    const data = normalizePropertyPayload(req.body);
    data.slug = await uniqueSlug(data.slug, data.title);
    data.sourceType = data.sourceType || 'MANUAL';
    const property = await prisma.property.create({ data });
    res.status(201).json(property);
  } catch (error) {
    next(error);
  }
});

router.put('/:id', authMiddleware, async (req, res, next) => {
  try {
    const current = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!current) return res.status(404).json({ error: 'Propiedad no encontrada' });
    const data = normalizePropertyPayload(req.body, { partial: true });
    if (data.slug || data.title) {
      data.slug = await uniqueSlug(data.slug || current.slug, data.title || current.title, current.id);
    }
    const property = await prisma.property.update({ where: { id: current.id }, data });
    return res.json(property);
  } catch (error) {
    return next(error);
  }
});

// Archive by default instead of destroying business data.
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: { published: false, status: 'archived', archivedAt: new Date() },
    });
    res.json({ message: 'Propiedad archivada', property });
  } catch (error) {
    res.status(404).json({ error: 'Propiedad no encontrada' });
  }
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const allowed = new Set(['available', 'sold', 'rented', 'reserved', 'archived']);
    if (!allowed.has(req.body.status)) {
      return res.status(400).json({ error: 'Estado no permitido' });
    }
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: { status: req.body.status },
    });
    return res.json(property);
  } catch (error) {
    return res.status(500).json({ error: 'Error al cambiar el estado' });
  }
});

router.patch('/:id/published', authMiddleware, async (req, res) => {
  try {
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: { published: req.body.published === true },
    });
    return res.json(property);
  } catch (error) {
    return res.status(500).json({ error: 'Error al cambiar la publicación' });
  }
});

router.post('/:id/photos', authMiddleware, imageUpload.array('photos', 50), async (req, res) => {
  const uploadedCloudinaryIds = [];
  try {
    const property = await prisma.property.findUnique({ where: { id: req.params.id } });
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });
    if (!req.files?.length) return res.status(400).json({ error: 'Selecciona al menos una imagen' });

    const existingPhotos = await prisma.photo.findMany({
      where: { propertyId: property.id },
      orderBy: { order: 'desc' },
    });
    let nextOrder = existingPhotos.length ? existingPhotos[0].order + 1 : 0;
    const uploadedPhotos = [];

    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer, {
        folder: `circulo-bienes-raices/properties/${property.id}`,
      });
      uploadedCloudinaryIds.push(result.public_id);
      const isFirstPhoto = existingPhotos.length === 0 && uploadedPhotos.length === 0;
      const photo = await prisma.photo.create({
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          alt: property.title,
          order: nextOrder,
          isMain: isFirstPhoto,
          propertyId: property.id,
        },
      });
      nextOrder += 1;
      uploadedPhotos.push(photo);
    }

    return res.status(201).json(uploadedPhotos);
  } catch (error) {
    await Promise.allSettled(uploadedCloudinaryIds.map((publicId) => deleteFromCloudinary(publicId)));
    console.error('Upload photos error:', error);
    return res.status(500).json({ error: 'Error al subir fotos' });
  }
});

router.delete('/:propertyId/photos/:photoId', authMiddleware, async (req, res) => {
  try {
    const photo = await prisma.photo.findFirst({
      where: { id: req.params.photoId, propertyId: req.params.propertyId },
    });
    if (!photo) return res.status(404).json({ error: 'Foto no encontrada' });
    if (photo.publicId) await deleteFromCloudinary(photo.publicId);
    await prisma.photo.delete({ where: { id: photo.id } });

    if (photo.isMain) {
      const replacement = await prisma.photo.findFirst({
        where: { propertyId: req.params.propertyId },
        orderBy: { order: 'asc' },
      });
      if (replacement) {
        await prisma.photo.update({ where: { id: replacement.id }, data: { isMain: true } });
      }
    }
    return res.json({ message: 'Foto eliminada' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al eliminar la foto' });
  }
});

router.patch('/:propertyId/photos/:photoId/main', authMiddleware, async (req, res) => {
  try {
    const photo = await prisma.photo.findFirst({
      where: { id: req.params.photoId, propertyId: req.params.propertyId },
    });
    if (!photo) return res.status(404).json({ error: 'Foto no encontrada' });

    await prisma.$transaction([
      prisma.photo.updateMany({
        where: { propertyId: req.params.propertyId, isMain: true },
        data: { isMain: false },
      }),
      prisma.photo.update({
        where: { id: photo.id },
        data: { isMain: true, order: 0 },
      }),
    ]);
    return res.json({ message: 'Foto principal actualizada' });
  } catch (error) {
    return res.status(500).json({ error: 'Error al actualizar la foto principal' });
  }
});

module.exports = router;
