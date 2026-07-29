const jwt = require('jsonwebtoken');

const configuredSecret = process.env.JWT_SECRET;

if (!configuredSecret && process.env.NODE_ENV === 'production') {
  throw new Error('JWT_SECRET es obligatorio en producción');
}

const JWT_SECRET = configuredSecret || 'development-only-secret-change-before-production';

const generateToken = user => jwt.sign(
  { id: user.id, email: user.email, role: user.role },
  JWT_SECRET,
  { expiresIn: '7d' },
);

const verifyToken = token => jwt.verify(token, JWT_SECRET);

const authMiddleware = async (req, res, next) => {
  try {
    const authorization = req.headers.authorization || '';
    const bearerToken = authorization.startsWith('Bearer ')
      ? authorization.slice(7)
      : '';
    const token = req.cookies?.token || bearerToken;

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

module.exports = { generateToken, verifyToken, authMiddleware };
