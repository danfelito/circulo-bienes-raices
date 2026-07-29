const express = require('express');
const prisma = require('../config/db');
const { authMiddleware } = require('../config/auth');

const router = express.Router();

// GET /api/admin/properties - Includes published and unpublished records.
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, search, published } = req.query;
    const parsedPage = Math.max(1, parseInt(page, 10) || 1);
    const parsedLimit = Math.min(100, Math.max(1, parseInt(limit, 10) || 20));
    const where = {};

    if (published === 'true') where.published = true;
    if (published === 'false') where.published = false;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { city: { contains: search, mode: 'insensitive' } },
        { slug: { contains: search, mode: 'insensitive' } },
      ];
    }

    const skip = (parsedPage - 1) * parsedLimit;
    const [properties, total] = await Promise.all([
      prisma.property.findMany({
        where,
        orderBy: { updatedAt: 'desc' },
        skip,
        take: parsedLimit,
        include: { photos: { orderBy: { order: 'asc' } } },
      }),
      prisma.property.count({ where }),
    ]);

    res.json({
      properties,
      pagination: {
        page: parsedPage,
        limit: parsedLimit,
        total,
        pages: Math.ceil(total / parsedLimit),
      },
    });
  } catch (error) {
    console.error('Get admin properties error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/admin/properties/:id - Fetch by database ID for editing.
router.get('/:id', authMiddleware, async (req, res) => {
  try {
    const property = await prisma.property.findUnique({
      where: { id: req.params.id },
      include: { photos: { orderBy: { order: 'asc' } } },
    });

    if (!property) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

    res.json(property);
  } catch (error) {
    console.error('Get admin property error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
