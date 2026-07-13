const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET
  || (process.env.NODE_ENV !== 'production' ? 'development-only-change-me' : null);
const COOKIE_NAME = process.env.COOKIE_NAME || 'circulo_admin_session';

if (!JWT_SECRET) {
  throw new Error('JWT_SECRET es obligatorio en producción');
}

const generateToken = (user) => jwt.sign(
  { id: user.id, email: user.email, role: user.role },
  JWT_SECRET,
  { expiresIn: '8h' },
);

const verifyToken = (token) => jwt.verify(token, JWT_SECRET);

const authMiddleware = async (req, res, next) => {
  try {
    const bearerToken = req.headers.authorization?.startsWith('Bearer ')
      ? req.headers.authorization.slice(7)
      : null;
    const token = req.cookies?.[COOKIE_NAME] || bearerToken;

    if (!token) {
      return res.status(401).json({ error: 'No autenticado' });
    }

    const decoded = verifyToken(token);
    const prisma = require('./db');
    const user = await prisma.user.findUnique({ where: { id: decoded.id } });

    if (!user) {
      return res.status(401).json({ error: 'Usuario no encontrado' });
    }

    req.user = user;
    return next();
  } catch (error) {
    return res.status(401).json({ error: 'Sesión inválida o vencida' });
  }
};

module.exports = {
  COOKIE_NAME,
  generateToken,
  verifyToken,
  authMiddleware,
};
