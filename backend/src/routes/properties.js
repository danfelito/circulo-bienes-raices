const express = require('express');
const multer = require('multer');
const prisma = require('../config/db');
const { authMiddleware } = require('../config/auth');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 12 * 1024 * 1024, files: 50 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) cb(null, true);
    else cb(new Error('Solo se permiten imágenes'), false);
  },
});

const numericFields = new Set(['price', 'area', 'lotArea', 'lat', 'lng']);
const integerFields = new Set(['bedrooms', 'bathrooms', 'parking', 'yearBuilt']);
const allowedFields = new Set([
  'referenceCode', 'title', 'slug', 'shortDescription', 'description', 'operation', 'type',
  'price', 'currency', 'bedrooms', 'bathrooms', 'area', 'lotArea', 'parking', 'yearBuilt',
  'city', 'state', 'country', 'neighborhood', 'address', 'lat', 'lng', 'features', 'status',
  'featured', 'published', 'contactName', 'contactPhone', 'contactEmail', 'whatsapp',
]);

const slugify = (value) => String(value || '')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const sanitizePropertyInput = (input) => {
  const data = {};
  for (const [key, value] of Object.entries(input || {})) {
    if (!allowedFields.has(key)) continue;
    if (numericFields.has(key)) {
      data[key] = value === '' || value === null ? null : Number(value);
      continue;
    }
    if (integerFields.has(key)) {
      data[key] = value === '' || value === null ? null : Number.parseInt(value, 10);
      continue;
    }
    if (key === 'featured' || key === 'published') {
      data[key] = value === true || value === 'true';
      continue;
    }
    if (key === 'features' && Array.isArray(value)) {
      data[key] = JSON.stringify(value);
      continue;
    }
    data[key] = value;
  }
  return data;
};

const buildPublicWhere = (query) => {
  const {
    operation, type, city, minPrice, maxPrice,
    bedrooms, bathrooms, search, featured,
  } = query;
  const where = { published: true, archivedAt: null };

  if (operation) where.operation = operation;
  if (type) where.type = type;
  if (city) where.city = { equals: city, mode: 'insensitive' };
  if (featured === 'true') where.featured = true;
  if (minPrice || maxPrice) {
    where.price = {};
    if (minPrice) where.price.gte = Number(minPrice);
    if (maxPrice) where.price.lte = Number(maxPrice);
  }
  if (bedrooms) where.bedrooms = { gte: Number.parseInt(bedrooms, 10) };
  if (bathrooms) where.bathrooms = { gte: Number.parseInt(bathrooms, 10) };
  if (search) {
    where.OR = [
      { title: { contains: search, mode: 'insensitive' } },
      { description: { contains: search, mode: 'insensitive' } },
      { city: { contains: search, mode: 'insensitive' } },
      { referenceCode: { contains: search, mode: 'insensitive' } },
    ];
  }
  return where;
};

const getOrderBy = (sort) => {
  if (sort === 'price_asc') return { price: 'asc' };
  if (sort === 'price_desc') return { price: 'desc' };
  if (sort === 'oldest') return { createdAt: 'asc' };
  if (sort === 'area_asc') return { area: 'asc' };
  if (sort === 'area_desc') return { area: 'desc' };
  return { createdAt: 'desc' };
};

router.get('/', async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '12', 10), 1), 100);
    const where = buildPublicWhere(req.query);
    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy: getOrderBy(req.query.sort),
        skip: (page - 1) * limit,
        take: limit,
        include: { photos: { orderBy: { order: 'asc' } } },
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      properties,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      where: { featured: true, published: true, archivedAt: null },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: { photos: { orderBy: { order: 'asc' } } },
    });
    res.json(properties);
  } catch (error) {
    console.error('Get featured error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/cities', async (req, res) => {
  try {
    const cities = await prisma.property.findMany({
      where: { published: true, archivedAt: null },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    });
    res.json(cities.map((item) => item.city).filter(Boolean));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// Administrative routes must appear before /:slug.
router.get('/admin/all', authMiddleware, async (req, res) => {
  try {
    const page = Math.max(Number.parseInt(req.query.page || '1', 10), 1);
    const limit = Math.min(Math.max(Number.parseInt(req.query.limit || '20', 10), 1), 100);
    const where = {};

    if (req.query.search) {
      where.OR = [
        { title: { contains: req.query.search, mode: 'insensitive' } },
        { city: { contains: req.query.search, mode: 'insensitive' } },
        { referenceCode: { contains: req.query.search, mode: 'insensitive' } },
      ];
    }
    if (req.query.status) where.status = req.query.status;
    if (req.query.published === 'true') where.published = true;
    if (req.query.published === 'false') where.published = false;

    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
        include: { photos: { orderBy: { order: 'asc' } } },
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      properties,
      pagination: { page, limit, total, pages: Math.ceil(total / limit) },
    });
  } catch (error) {
    console.error('Get admin properties error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/admin/:id', authMiddleware, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: { photos: { orderBy: { order: 'asc' } } },
    });
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });
    return res.json(property);
  } catch (error) {
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const property = await prisma.property.findFirst({
      where: { slug: req.params.slug, published: true, archivedAt: null },
      include: { photos: { orderBy: { order: 'asc' } } },
    });
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    await prisma.property.update({
      where: { id: property.id },
      data: { views: { increment: 1 } },
    });

    const related = await prisma.property.findMany({
      where: {
        published: true,
        archivedAt: null,
        id: { not: property.id },
        OR: [
          { city: property.city },
          { operation: property.operation },
          { type: property.type },
        ],
      },
      take: 3,
      include: { photos: { orderBy: { order: 'asc' } } },
    });

    return res.json({ property, related });
  } catch (error) {
    console.error('Get property error:', error);
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/', authMiddleware, async (req, res) => {
  try {
    const propertyData = sanitizePropertyInput(req.body);
    if (!propertyData.title || !propertyData.description || !propertyData.city) {
      return res.status(400).json({ error: 'Título, descripción y ciudad son obligatorios' });
    }
    propertyData.slug = slugify(propertyData.slug || propertyData.title);
    if (!propertyData.slug) return res.status(400).json({ error: 'Slug inválido' });

    const collision = await prisma.property.findUnique({ where: { slug: propertyData.slug } });
    if (collision) propertyData.slug = `${propertyData.slug}-${Date.now()}`;

    const property = await prisma.property.create({ data: propertyData });
    return res.status(201).json(property);
  } catch (error) {
    console.error('Create property error:', error);
    return res.status(400).json({ error: error.code === 'P2002' ? 'Código o slug duplicado' : 'No se pudo crear la propiedad' });
  }
});

router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const propertyData = sanitizePropertyInput(req.body);
    if (propertyData.slug) propertyData.slug = slugify(propertyData.slug);
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: propertyData,
    });
    return res.json(property);
  } catch (error) {
    console.error('Update property error:', error);
    return res.status(400).json({ error: error.code === 'P2002' ? 'Código o slug duplicado' : 'No se pudo actualizar la propiedad' });
  }
});

// Normal delete archives the listing and keeps its data and photos recoverable.
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data: { published: false, status: 'archived', archivedAt: new Date() },
    });
    return res.json({ message: 'Propiedad archivada', property });
  } catch (error) {
    return res.status(500).json({ error: 'No se pudo archivar la propiedad' });
  }
});

router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const status = String(req.body.status || '').toLowerCase();
    const allowedStatuses = ['available', 'sold', 'rented', 'reserved', 'archived'];
    if (!allowedStatuses.includes(status)) return res.status(400).json({ error: 'Estado inválido' });

    const data = status === 'archived'
      ? { status, published: false, archivedAt: new Date() }
      : { status, archivedAt: null };
    const property = await prisma.property.update({ where: { id: req.params.id }, data });
    return res.json(property);
  } catch (error) {
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/:id/photos', authMiddleware, upload.array('photos', 50), async (req, res) => {
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

    for (let index = 0; index < req.files.length; index += 1) {
      const file = req.files[index];
      const result = await uploadToCloudinary(file.buffer, {
        folder: `circulo-bienes-raices/properties/${property.id}`,
        resource_type: 'image',
      });
      const photo = await prisma.photo.create({
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          alt: property.title,
          order: nextOrder,
          isMain: existingPhotos.length === 0 && index === 0,
          propertyId: property.id,
        },
      });
      nextOrder += 1;
      uploadedPhotos.push(photo);
    }

    return res.status(201).json(uploadedPhotos);
  } catch (error) {
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
    return res.json({ message: 'Foto eliminada' });
  } catch (error) {
    return res.status(500).json({ error: 'Error del servidor' });
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
        where: { id: req.params.photoId },
        data: { isMain: true, order: 0 },
      }),
    ]);
    return res.json({ message: 'Foto principal actualizada' });
  } catch (error) {
    return res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
