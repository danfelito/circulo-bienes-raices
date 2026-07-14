const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'circulo-bienes-raices-secret-key-change-in-production';

const generateToken = (user) => {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role, status: user.status },
    JWT_SECRET,
    { expiresIn: '7d' }
  );
};

const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.cookies?.token || req.headers.authorization?.replace('Bearer ', '');

    if (!token) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const decoded = verifyToken(token);
    const prisma = require('../config/db');
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    req.user = user;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token inválido' });
  }
};

const requireRole = (...roles) => (req, res, next) => {
  if (!req.user || !roles.includes(req.user.role)) {
    return res.status(403).json({ error: 'No tienes permisos para realizar esta acción' });
  }
  next();
};

const requireApprovedAdvisor = (req, res, next) => {
  if (req.user?.role === 'admin') return next();
  if (req.user?.role !== 'advisor' || req.user.status !== 'approved') {
    return res.status(403).json({ error: 'Tu cuenta de asesor aún no está autorizada' });
  }
  next();
};

module.exports = {
  generateToken,
  verifyToken,
  authMiddleware,
  requireRole,
  requireApprovedAdvisor,
};
