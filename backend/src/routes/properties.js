const express = require('express');
const multer = require('multer');
const prisma = require('../config/db');
const { authMiddleware, requireApprovedAdvisor } = require('../config/auth');
const { uploadToCloudinary, deleteFromCloudinary } = require('../config/cloudinary');

const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 80 * 1024 * 1024, files: 12 },
  fileFilter: (req, file, cb) => {
    if (file.mimetype.startsWith('image/') || file.mimetype.startsWith('video/')) {
      cb(null, true);
    } else {
      cb(new Error('Solo se permiten imágenes o videos'), false);
    }
  },
});

const mediaFields = upload.fields([
  { name: 'photos', maxCount: 12 },
  { name: 'media', maxCount: 12 },
]);

const propertyInclude = {
  photos: { orderBy: [{ isMain: 'desc' }, { order: 'asc' }] },
  createdBy: { select: { id: true, name: true, email: true, phone: true } },
};

const toNumber = (value) => {
  if (value === '' || value === null || value === undefined) return null;
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : null;
};

const toInt = (value) => {
  const parsed = toNumber(value);
  return parsed === null ? null : Math.trunc(parsed);
};

const toBoolean = (value, fallback = false) => {
  if (value === undefined) return fallback;
  if (typeof value === 'boolean') return value;
  return ['true', '1', 'yes', 'si', 'sí'].includes(String(value).toLowerCase());
};

const makeSlug = (title) => String(title || 'propiedad')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '');

const normalizePropertyData = (payload, user, isUpdate = false) => {
  const data = {};
  const textFields = ['title', 'slug', 'description', 'operation', 'type', 'currency', 'city', 'state', 'country', 'address', 'features', 'status'];
  textFields.forEach((field) => {
    if (payload[field] !== undefined) data[field] = String(payload[field]).trim();
  });

  const numberFields = ['price', 'area', 'lotArea', 'lat', 'lng'];
  numberFields.forEach((field) => {
    if (payload[field] !== undefined) data[field] = toNumber(payload[field]);
  });

  const intFields = ['bedrooms', 'bathrooms', 'parking', 'yearBuilt'];
  intFields.forEach((field) => {
    if (payload[field] !== undefined) data[field] = toInt(payload[field]);
  });

  if (!isUpdate) {
    data.currency = data.currency || 'MXN';
    data.state = data.state || 'Veracruz';
    data.country = data.country || 'México';
    data.status = data.status || 'available';
    data.published = true;
    data.reviewStatus = 'published';
    data.createdById = user.id;
  }

  if (user.role === 'admin') {
    if (payload.featured !== undefined) data.featured = toBoolean(payload.featured);
    if (payload.published !== undefined) data.published = toBoolean(payload.published, true);
    if (payload.reviewStatus !== undefined) data.reviewStatus = String(payload.reviewStatus);
    if (payload.createdById !== undefined) data.createdById = payload.createdById || null;
  } else {
    data.featured = false;
    data.published = true;
    data.reviewStatus = 'published';
  }

  return data;
};

const findManageableProperty = async (id, user) => {
  const property = await prisma.property.findUnique({ where: { id }, include: propertyInclude });
  if (!property) return { error: 'Propiedad no encontrada', status: 404 };
  if (user.role !== 'admin' && property.createdById !== user.id) {
    return { error: 'No tienes permiso para modificar esta propiedad', status: 403 };
  }
  return { property };
};

router.get('/', async (req, res) => {
  try {
    const {
      operation, type, city, minPrice, maxPrice,
      bedrooms, bathrooms, sort, page = 1, limit = 12,
      search, featured,
    } = req.query;

    const where = { published: true, reviewStatus: 'published' };
    if (operation) where.operation = operation;
    if (type) where.type = type;
    if (city) where.city = { equals: city, mode: 'insensitive' };
    if (featured === 'true') where.featured = true;
    if (minPrice || maxPrice) {
      where.price = {};
      if (minPrice) where.price.gte = parseFloat(minPrice);
      if (maxPrice) where.price.lte = parseFloat(maxPrice);
    }
    if (bedrooms) where.bedrooms = { gte: parseInt(bedrooms, 10) };
    if (bathrooms) where.bathrooms = { gte: parseInt(bathrooms, 10) };
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { address: { contains: search, mode: 'insensitive' } },
      ];
    }

    let orderBy = { createdAt: 'desc' };
    if (sort === 'price_asc') orderBy = { price: 'asc' };
    if (sort === 'price_desc') orderBy = { price: 'desc' };
    if (sort === 'area_desc') orderBy = { area: 'desc' };

    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 12));
    const skip = (parsedPage - 1) * parsedLimit;

    const [properties, total] = await Promise.all([
      prisma.property.findMany({ where, orderBy, skip, take: parsedLimit, include: propertyInclude }),
      prisma.property.count({ where }),
    ]);

    res.json({
      properties,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.max(1, Math.ceil(total / parsedLimit)),
      },
    });
  } catch (error) {
    console.error('Get properties error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/featured', async (req, res) => {
  try {
    const properties = await prisma.property.findMany({
      where: { featured: true, published: true, reviewStatus: 'published' },
      orderBy: { createdAt: 'desc' },
      take: 6,
      include: propertyInclude,
    });
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/cities', async (req, res) => {
  try {
    const cities = await prisma.property.findMany({
      where: { published: true, reviewStatus: 'published' },
      select: { city: true },
      distinct: ['city'],
      orderBy: { city: 'asc' },
    });
    res.json(cities.map((item) => item.city));
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.get('/mine', authMiddleware, requireApprovedAdvisor, async (req, res) => {
  try {
    const where = req.user.role === 'admin' ? {} : { createdById: req.user.id };
    const properties = await prisma.property.findMany({
      where,
      include: propertyInclude,
      orderBy: { createdAt: 'desc' },
    });
    res.json(properties);
  } catch (error) {
    res.status(500).json({ error: 'No fue posible cargar tus propiedades' });
  }
});

router.post('/', authMiddleware, requireApprovedAdvisor, async (req, res) => {
  try {
    const data = normalizePropertyData(req.body, req.user);
    if (!data.title || !data.description || !data.operation || !data.type || data.price === null || !data.city) {
      return res.status(400).json({ error: 'Completa título, detalles, operación, tipo, precio y ciudad' });
    }

    data.slug = data.slug || makeSlug(data.title);
    const existing = await prisma.property.findUnique({ where: { slug: data.slug } });
    if (existing) data.slug = `${data.slug}-${Date.now()}`;

    const property = await prisma.property.create({ data, include: propertyInclude });
    res.status(201).json(property);
  } catch (error) {
    console.error('Create property error:', error);
    res.status(500).json({ error: 'No fue posible publicar la propiedad' });
  }
});

router.put('/:id', authMiddleware, requireApprovedAdvisor, async (req, res) => {
  try {
    const access = await findManageableProperty(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const data = normalizePropertyData(req.body, req.user, true);
    const property = await prisma.property.update({
      where: { id: req.params.id },
      data,
      include: propertyInclude,
    });
    res.json(property);
  } catch (error) {
    console.error('Update property error:', error);
    res.status(500).json({ error: 'Error al actualizar la propiedad' });
  }
});

router.delete('/:id', authMiddleware, requireApprovedAdvisor, async (req, res) => {
  try {
    const access = await findManageableProperty(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    for (const media of access.property.photos) {
      if (media.publicId) await deleteFromCloudinary(media.publicId, media.resourceType || media.mediaType || 'image');
    }

    await prisma.property.delete({ where: { id: req.params.id } });
    res.json({ message: 'Propiedad eliminada' });
  } catch (error) {
    console.error('Delete property error:', error);
    res.status(500).json({ error: 'Error al eliminar la propiedad' });
  }
});

router.patch('/:id/status', authMiddleware, requireApprovedAdvisor, async (req, res) => {
  try {
    const access = await findManageableProperty(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const status = String(req.body.status || '');
    if (!['available', 'sold', 'rented', 'reserved'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const property = await prisma.property.update({ where: { id: req.params.id }, data: { status } });
    res.json(property);
  } catch (error) {
    res.status(500).json({ error: 'Error al cambiar estado' });
  }
});

const uploadMediaHandler = async (req, res) => {
  try {
    const access = await findManageableProperty(req.params.id, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const files = [...(req.files?.photos || []), ...(req.files?.media || [])];
    if (!files.length) return res.status(400).json({ error: 'Selecciona al menos una foto o video' });

    const existingMedia = await prisma.photo.findMany({
      where: { propertyId: req.params.id },
      orderBy: { order: 'desc' },
    });
    let nextOrder = existingMedia.length ? existingMedia[0].order + 1 : 0;
    const hasMainImage = existingMedia.some((item) => item.isMain && item.mediaType === 'image');
    let mainImageAssigned = hasMainImage;
    const uploadedMedia = [];

    for (const file of files) {
      const isVideo = file.mimetype.startsWith('video/');
      const resourceType = isVideo ? 'video' : 'image';
      const result = await uploadToCloudinary(file.buffer, {
        folder: `circulo-bienes-raices/${req.params.id}`,
        resource_type: resourceType,
      });

      const isMain = !isVideo && !mainImageAssigned;
      if (isMain) mainImageAssigned = true;

      const media = await prisma.photo.create({
        data: {
          url: result.secure_url,
          publicId: result.public_id,
          alt: req.body.alt || access.property.title,
          order: nextOrder++,
          isMain,
          mediaType: isVideo ? 'video' : 'image',
          resourceType,
          propertyId: req.params.id,
        },
      });
      uploadedMedia.push(media);
    }

    res.status(201).json(uploadedMedia);
  } catch (error) {
    console.error('Upload media error:', error);
    res.status(500).json({ error: 'Error al subir fotos o videos' });
  }
};

router.post('/:id/photos', authMiddleware, requireApprovedAdvisor, mediaFields, uploadMediaHandler);
router.post('/:id/media', authMiddleware, requireApprovedAdvisor, mediaFields, uploadMediaHandler);

router.delete('/:propertyId/photos/:photoId', authMiddleware, requireApprovedAdvisor, async (req, res) => {
  try {
    const access = await findManageableProperty(req.params.propertyId, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const media = await prisma.photo.findFirst({
      where: { id: req.params.photoId, propertyId: req.params.propertyId },
    });
    if (!media) return res.status(404).json({ error: 'Archivo no encontrado' });

    if (media.publicId) await deleteFromCloudinary(media.publicId, media.resourceType || media.mediaType || 'image');
    await prisma.photo.delete({ where: { id: media.id } });
    res.json({ message: 'Archivo eliminado' });
  } catch (error) {
    res.status(500).json({ error: 'Error al eliminar el archivo' });
  }
});

router.patch('/:propertyId/photos/:photoId/main', authMiddleware, requireApprovedAdvisor, async (req, res) => {
  try {
    const access = await findManageableProperty(req.params.propertyId, req.user);
    if (access.error) return res.status(access.status).json({ error: access.error });

    const media = await prisma.photo.findFirst({
      where: { id: req.params.photoId, propertyId: req.params.propertyId, mediaType: 'image' },
    });
    if (!media) return res.status(404).json({ error: 'Foto no encontrada' });

    await prisma.$transaction([
      prisma.photo.updateMany({ where: { propertyId: req.params.propertyId, isMain: true }, data: { isMain: false } }),
      prisma.photo.update({ where: { id: media.id }, data: { isMain: true, order: 0 } }),
    ]);
    res.json({ message: 'Foto principal actualizada' });
  } catch (error) {
    res.status(500).json({ error: 'Error al establecer la foto principal' });
  }
});

router.get('/:slug', async (req, res) => {
  try {
    const property = await prisma.property.findFirst({
      where: { slug: req.params.slug, published: true, reviewStatus: 'published' },
      include: propertyInclude,
    });
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });

    await prisma.property.update({ where: { id: property.id }, data: { views: { increment: 1 } } });

    const related = await prisma.property.findMany({
      where: {
        published: true,
        reviewStatus: 'published',
        id: { not: property.id },
        OR: [{ city: property.city }, { operation: property.operation }, { type: property.type }],
      },
      take: 3,
      include: propertyInclude,
    });

    res.json({ property, related });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
