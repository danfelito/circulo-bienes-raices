const express = require('express');
const prisma = require('../config/db');
const { authMiddleware } = require('../config/auth');

const router = express.Router();

// POST /api/inquiries - Public (with honeypot anti-spam)
router.post('/', async (req, res) => {
  try {
    const { name, email, phone, message, propertyId, honeypot, attribution } = req.body;

    // Honeypot anti-spam: if honeypot is filled, it's a bot
    if (honeypot) {
      return res.status(201).json({ message: 'Consulta enviada' }); // Silent reject
    }

    if (!name || !email || !message) {
      return res.status(400).json({ error: 'Nombre, email y mensaje son requeridos' });
    }

    const allowedKeys = ['utm_source','utm_medium','utm_campaign','utm_content','utm_term','gclid','fbclid','ttclid','landingPath','referrerHost'];
    const safeTouch = touch => Object.fromEntries(allowedKeys.filter(key => typeof touch?.[key] === 'string').map(key => [key, touch[key].slice(0, 250)]));
    const safeAttribution = attribution && typeof attribution === 'object' && !Array.isArray(attribution)
      ? { firstTouch: safeTouch(attribution.firstTouch), lastTouch: safeTouch(attribution.lastTouch) }
      : undefined;

    const inquiry = await prisma.inquiry.create({
      data: { name, email, phone, message, propertyId, attribution: safeAttribution },
    });

    res.status(201).json(inquiry);
  } catch (error) {
    console.error('Create inquiry error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// GET /api/inquiries - Admin list
router.get('/', authMiddleware, async (req, res) => {
  try {
    const { page = 1, limit = 20, unread } = req.query;
    const where = {};
    if (unread === 'true') where.isRead = false;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const [inquiries, total] = await Promise.all([
      prisma.inquiry.findMany({
        where,
        orderBy: { createdAt: 'desc' },
        skip,
        take: parseInt(limit),
        include: {
          property: { select: { id: true, title: true, slug: true } },
        },
      }),
      prisma.inquiry.count({ where }),
    ]);

    res.json({
      inquiries,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// PATCH /api/inquiries/:id/read - Mark as read
router.patch('/:id/read', authMiddleware, async (req, res) => {
  try {
    const inquiry = await prisma.inquiry.update({
      where: { id: req.params.id },
      data: { isRead: true },
    });
    res.json(inquiry);
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

// DELETE /api/inquiries/:id
router.delete('/:id', authMiddleware, async (req, res) => {
  try {
    await prisma.inquiry.delete({ where: { id: req.params.id } });
    res.json({ message: 'Consulta eliminada' });
  } catch (error) {
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
