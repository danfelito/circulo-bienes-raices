const express = require('express');
const prisma = require('../config/db');

const router = express.Router();

// These exact routes belong to the main property router.
router.get('/featured', (req, res, next) => next());
router.get('/cities', (req, res, next) => next());

// Public detail must never expose unpublished records.
router.get('/:slug', async (req, res) => {
  try {
    const property = await prisma.property.findFirst({
      where: { slug: req.params.slug, published: true },
      include: { photos: { orderBy: { order: 'asc' } } },
    });

    if (!property) {
      return res.status(404).json({ error: 'Propiedad no encontrada' });
    }

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
      include: { photos: { orderBy: { order: 'asc' } } },
    });

    res.json({ property, related });
  } catch (error) {
    console.error('Get public property error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
