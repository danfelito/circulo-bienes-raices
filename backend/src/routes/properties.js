const express = require('express');
const multer = require('multer');
const prisma = require('../config/db');
const { authMiddleware } = require('../config/auth');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const router = express.Router();

// Multer config (memory storage for Cloudinary)
const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes'), false);
    }
  },
});

// ── PUBLIC ROUTES ──

// GET /api/properties - List with filters & pagination
router.get('/', async (req, res) => {
  try {
    const {
      operation, type, city, minPrice, maxPrice,
      bedrooms, bathrooms, sort, page = 1, limit = 12,
      search, featured,
    } = req.query;

    const where = { published: true };

    if (operation) where.operation = operation;
    if (type) where.type = type;
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (featured === 'true') where.featured = true;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms) };
    if (bathrooms) where.bathrooms = { gte: parseInt(bathrooms) };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
      ];
    }

    // Sorting
    let orderBy = { createdAt: 'desc' };
    if (sort === 'price_asc') orderBy = { price: 'asc' };
    if (sort === 'price_desc') orderBy = { price: 'desc' };
    if (sort === 'newest') orderBy = { createdAt: 'desc' };
    if (sort === 'area_desc') orderBy = { area: 'desc' };

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy,
        skip,
        take: parseInt(limit),
        include: {
          photos: { orderBy: { order: 'asc' } },
        },
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      properties,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/properties/featured
router.get('/featured', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      where: { featured: true, published: true },
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

// GET /api/properties/cities
router.get('/cities', async (req, res) => {
  try {
    const cities = await prisma.property.findMany({
      where: { published: true },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    });
    res.json(cities.map(c => c.city));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/properties/:slug
router.get('/:slug', async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { slug: req.params.slug },
      include: { photos: { orderBy: { order: 'asc' } } },
    });

    if (!property) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    // Increment views
    await prisma.property.update({
      where: { id: property.id },
      data: { views: { increment: 1 } },
    });

    // Get related properties
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
      include: { photos: { orderBy: { order: 'asc' } } },
    });

    res.json({ property, related });
  } catch (error) {
    console.error('Get property error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// ── ADMIN ROUTES ──

// POST /api/properties - Create
router.post('/', authMiddleware, async (req, res) => {
  try {
    const propertyData = req.body;
    
    // Generate slug from title
    if (!propertyData.slug) {
      propertyData.slug = propertyData.title
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');
    }

    // Ensure slug is unique
    const existing = await prisma.property.findUnique({ where: { slug: propertyData.slug } });
    if (existing) {
      propertyData.slug = propertyData.slug + '-' + Date.now();
    }

    const property = await prisma.property.create({ data: propertyData });
    res.status(201).json(property);
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PUT /api/properties/:id - Update
router.put('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const property = await prisma.property.update({
      where: { id },
      data: req.body,
    });
    res.json(property);
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/properties/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    
    // Delete photos from Cloudinary first
    const photos = await prisma.photo.findMany({ where: { propertyId: id } });
    for (const photo of photos) {
      if (photo.publicId) {
        await deleteFromCloudinary(photo.publicId);
      }
    }

    await prisma.property.delete({ where: { id } });
    res.json({ message: 'Propiedad eliminada' });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PATCH /api/properties/:id/status - Change status
router.patch('/:id/status', authMiddleware, async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;
    const property = await prisma.property.update({
      where: { id },
      data: { status },
    });
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// POST /api/properties/:id/photos - Upload photos
router.post('/:id/photos', authMiddleware, upload.array('photos', 10), async (req, res) => {
  try {
    const { id } = req.params;
    const property = await prisma.property.findUnique({ where: { id } });
    if (!property) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    const existingPhotos = await prisma.photo.findMany({
      where: { propertyId: id },
      orderBy: { order: 'desc' },
    });
    let nextOrder = existingPhotos.length > 0 ? existingPhotos[0].order + 1 : 0;

    const uploadedPhotos = [];
    for (const file of req.files) {
      const result = await uploadToCloudinary(file.buffer, {
        folder: `circulo-bienes-raices/${id}`,
      });

      const photo = await prisma.photo.create({
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          alt: req.body.alt || property.title,
          order: nextOrder++,
          isMain: nextOrder === 1,
          propertyId: id,
        },
      });
      uploadedPhotos.push(photo);
    }

    res.status(201).json(uploadedPhotos);
  } catch (error) {
    console.error('Upload photos error:', error);
    res.status(500).json({ error: 'Error al subir fotos' });
  }
});

// DELETE /api/properties/:propertyId/photos/:photoId
router.delete('/:propertyId/photos/:photoId', authMiddleware, async (req, res) => {
  try {
    const { photoId } = req.params;
    const photo = await prisma.photo.findUnique({ where: { id: photoId } });
    if (!photo) {
      return res.status(404).json({ error: 'Foto no encontrada' });
    }

    if (photo.publicId) {
      await deleteFromCloudinary(photo.publicId);
    }

    await prisma.photo.delete({ where: { id: photoId } });
    res.json({ message: 'Foto eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PATCH /api/properties/:propertyId/photos/:photoId/main - Set main photo
router.patch('/:propertyId/photos/:photoId/main', authMiddleware, async (req, res) => {
  try {
    const { propertyId, photoId } = req.params;

    // Unset current main
    await prisma.photo.updateMany({
      where: { propertyId, isMain: true },
      data: { isMain: false },
    });

    // Set new main
    await prisma.photo.update({
      where: { id: photoId },
      data: { isMain: true, order: 0 },
    });

    res.json({ message: 'Foto principal actualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
