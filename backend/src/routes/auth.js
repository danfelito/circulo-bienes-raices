const express = require('express');
const bcrypt = require('bcrypt');
const prisma = require('../config/db');
const { generateToken, authMiddleware } = require('../config/auth');

const router = express.Router();

router.post('/login', async (req, res) => {
  try {
    const email = String(req.body.email || '').trim().toLowerCase();
    const password = String(req.body.password || '');

    if (!email || !password) {
      return res.status(400).json({ error: 'Email y contraseña requeridos' });
    }

    const user = await prisma.user.findUnique({ where: { email } });
    if (!user) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    const validPassword = await bcrypt.compare(password, user.password);
    if (!validPassword) {
      return res.status(401).json({ error: 'Credenciales inválidas' });
    }

    if (user.role === 'advisor' && user.status !== 'approved') {
      const messages = {
        pending: 'Tu solicitud está pendiente de autorización.',
        rejected: 'Tu solicitud de asesor no fue autorizada.',
        suspended: 'Tu cuenta de asesor está suspendida.',
      };
      return res.status(403).json({ error: messages[user.status] || 'Tu cuenta no está autorizada.' });
    }

    const token = generateToken(user);
    res.cookie('token', token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    res.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        phone: user.phone,
        role: user.role,
        status: user.status,
      },
      token,
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Error del servidor' });
  }
});

router.post('/logout', (req, res) => {
  res.clearCookie('token');
  res.json({ message: 'Sesión cerrada' });
});

router.get('/me', authMiddleware, (req, res) => {
  res.json({
    user: {
      id: req.user.id,
      email: req.user.email,
      name: req.user.name,
      phone: req.user.phone,
      role: req.user.role,
      status: req.user.status,
    },
  });
});

module.exports = router;
