const express = require('express');
const prisma = require('../config/db');
const { authMiddleware } = require('../config/auth');

const router = express.Router();

// GET /api/stats - Dashboard stats
router.get('/', authMiddleware, async (req, res) => {
  try {
    const [
      totalProperties,
      availableProperties,
      soldProperties,
      rentedProperties,
      featuredProperties,
      totalInquiries,
      unreadInquiries,
      totalViews,
    ] = await Promise.all([
      prisma.property.count(),
      prisma.property.count({ where: { status: 'available' } }),
      prisma.property.count({ where: { status: 'sold' } }),
      prisma.property.count({ where: { status: 'rented' } }),
      prisma.property.count({ where: { featured: true } }),
      prisma.inquiry.count(),
      prisma.inquiry.count({ where: { isRead: false } }),
      prisma.property.aggregate({ _sum: { views: true } }),
    ]);

    // Recent properties
    const recentProperties = await prisma.property.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: { photos: { where: { isMain: true }, take: 1 } },
    });

    // Recent inquiries
    const recentInquiries = await prisma.inquiry.findMany({
      orderBy: { createdAt: 'desc' },
      take: 5,
      include: {
        property: { select: { title: true, slug: true } },
      },
    });

    // Properties by operation
    const byOperation = await prisma.property.groupBy({
      by: ['operation'],
      _count: true,
    });

    // Properties by type
    const byType = await prisma.property.groupBy({
      by: ['type'],
      _count: true,
    });

    res.json({
      totalProperties,
      availableProperties,
      soldProperties,
      rentedProperties,
      featuredProperties,
      totalInquiries,
      unreadInquiries,
      totalViews: totalViews._sum.views || 0,
      recentProperties,
      recentInquiries,
      byOperation: byOperation.map(o => ({ operation: o.operation, count: o._count })),
      byType: byType.map(t => ({ type: t.type, count: t._count })),
    });
  } catch (error) {
    console.error('Stats error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

module.exports = router;
