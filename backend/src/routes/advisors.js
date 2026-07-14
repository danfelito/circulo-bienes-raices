const express = require('express');
const bcrypt = require('bcrypt');
const crypto = require('crypto');
const prisma = require('../config/db');
const { authMiddleware, requireRole } = require('../config/auth');

const router = express.Router();
const ADMIN_EMAIL = process.env.ADMIN_APPROVAL_EMAIL || 'circulointernacionalveracruz1@gmail.com';

const hashToken = (token) => crypto.createHash('sha256').update(token).digest('hex');

const getBaseUrl = (req) => {
  const configured = process.env.APP_URL?.replace(/\/$/, '');
  return configured || `${req.protocol}://${req.get('host')}`;
};

const sendApprovalEmail = async ({ name, email, phone, approveUrl, rejectUrl }) => {
  if (!process.env.RESEND_API_KEY) {
    console.warn('RESEND_API_KEY no configurada. Enlaces de autorización:', { approveUrl, rejectUrl });
    return { delivered: false };
  }

  const from = process.env.RESEND_FROM_EMAIL || 'Círculo Internacional <onboarding@resend.dev>';
  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      from,
      to: [ADMIN_EMAIL],
      subject: `Nueva solicitud de asesor: ${name}`,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:640px;margin:auto;color:#1f2937">
          <div style="border-top:6px solid #d71920;padding:24px;border:1px solid #e5e7eb">
            <h1 style="margin:0 0 12px;font-size:24px">Solicitud de alta de asesor</h1>
            <p><strong>Nombre:</strong> ${name}</p>
            <p><strong>Correo:</strong> ${email}</p>
            <p><strong>Teléfono:</strong> ${phone || 'No proporcionado'}</p>
            <p style="margin:24px 0">Autoriza o rechaza el acceso para publicar propiedades:</p>
            <p>
              <a href="${approveUrl}" style="display:inline-block;background:#15803d;color:white;text-decoration:none;padding:12px 18px;border-radius:6px;margin-right:8px">Autorizar asesor</a>
              <a href="${rejectUrl}" style="display:inline-block;background:#b91c1c;color:white;text-decoration:none;padding:12px 18px;border-radius:6px">Rechazar</a>
            </p>
            <p style="font-size:12px;color:#6b7280;margin-top:24px">Los enlaces caducan en 7 días.</p>
          </div>
        </div>
      `,
    }),
  });

  if (!response.ok) {
    const detail = await response.text();
    throw new Error(`No se pudo enviar el correo de autorización: ${detail}`);
  }

  return { delivered: true };
};

router.post('/register', async (req, res) => {
  try {
    const name = String(req.body.name || '').trim();
    const email = String(req.body.email || '').trim().toLowerCase();
    const phone = String(req.body.phone || '').trim();
    const password = String(req.body.password || '');

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Nombre, correo y contraseña son obligatorios' });
    }

    if (!/^\S+@\S+\.\S+$/.test(email)) {
      return res.status(400).json({ error: 'Ingresa un correo válido' });
    }

    if (password.length < 8) {
      return res.status(400).json({ error: 'La contraseña debe tener al menos 8 caracteres' });
    }

    const existing = await prisma.user.findUnique({ where: { email } });
    if (existing) {
      return res.status(409).json({ error: 'Ya existe una cuenta con ese correo' });
    }

    const rawToken = crypto.randomBytes(32).toString('hex');
    const approvalTokenHash = hashToken(rawToken);
    const approvalTokenExpires = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
    const hashedPassword = await bcrypt.hash(password, 12);

    const advisor = await prisma.user.create({
      data: {
        name,
        email,
        phone: phone || null,
        password: hashedPassword,
        role: 'advisor',
        status: 'pending',
        approvalTokenHash,
        approvalTokenExpires,
      },
      select: { id: true, name: true, email: true, status: true },
    });

    const baseUrl = getBaseUrl(req);
    const approveUrl = `${baseUrl}/api/advisors/decision?token=${rawToken}&action=approve`;
    const rejectUrl = `${baseUrl}/api/advisors/decision?token=${rawToken}&action=reject`;

    let emailDelivered = false;
    try {
      const result = await sendApprovalEmail({ name, email, phone, approveUrl, rejectUrl });
      emailDelivered = result.delivered;
    } catch (mailError) {
      console.error(mailError.message);
    }

    res.status(201).json({
      advisor,
      emailDelivered,
      message: 'Solicitud recibida. Te avisaremos cuando el acceso sea autorizado.',
    });
  } catch (error) {
    console.error('Advisor register error:', error);
    res.status(500).json({ error: 'No fue posible registrar la solicitud' });
  }
});

router.get('/decision', async (req, res) => {
  const action = req.query.action;
  const token = String(req.query.token || '');

  const renderResult = (title, message, success) => res.status(success ? 200 : 400).send(`
    <!doctype html>
    <html lang="es">
      <head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${title}</title></head>
      <body style="margin:0;background:#f7f7f7;font-family:Arial,sans-serif;color:#111827;display:grid;place-items:center;min-height:100vh">
        <main style="background:white;max-width:560px;padding:36px;border-radius:14px;box-shadow:0 16px 45px rgba(0,0,0,.12);border-top:6px solid ${success ? '#15803d' : '#b91c1c'}">
          <h1 style="margin-top:0">${title}</h1>
          <p style="line-height:1.6">${message}</p>
          <a href="${process.env.APP_URL || '/'}" style="display:inline-block;margin-top:14px;background:#d71920;color:white;text-decoration:none;padding:12px 18px;border-radius:7px">Volver al sitio</a>
        </main>
      </body>
    </html>
  `);

  try {
    if (!token || !['approve', 'reject'].includes(action)) {
      return renderResult('Enlace inválido', 'El enlace de autorización no es válido.', false);
    }

    const advisor = await prisma.user.findFirst({
      where: {
        approvalTokenHash: hashToken(token),
        approvalTokenExpires: { gt: new Date() },
        role: 'advisor',
        status: 'pending',
      },
    });

    if (!advisor) {
      return renderResult('Enlace vencido o utilizado', 'La solicitud ya fue procesada o el enlace caducó.', false);
    }

    const status = action === 'approve' ? 'approved' : 'rejected';
    await prisma.user.update({
      where: { id: advisor.id },
      data: { status, approvalTokenHash: null, approvalTokenExpires: null },
    });

    if (status === 'approved') {
      return renderResult('Asesor autorizado', `${advisor.name} ya puede iniciar sesión y publicar propiedades.`, true);
    }

    return renderResult('Solicitud rechazada', `La solicitud de ${advisor.name} fue rechazada.`, true);
  } catch (error) {
    console.error('Advisor decision error:', error);
    return renderResult('No se pudo procesar', 'Ocurrió un error al procesar la solicitud.', false);
  }
});

router.get('/', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const advisors = await prisma.user.findMany({
      where: { role: 'advisor' },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        status: true,
        createdAt: true,
        _count: { select: { properties: true } },
      },
      orderBy: { createdAt: 'desc' },
    });
    res.json(advisors);
  } catch (error) {
    res.status(500).json({ error: 'No fue posible cargar los asesores' });
  }
});

router.patch('/:id/status', authMiddleware, requireRole('admin'), async (req, res) => {
  try {
    const status = String(req.body.status || '');
    if (!['approved', 'rejected', 'suspended', 'pending'].includes(status)) {
      return res.status(400).json({ error: 'Estado inválido' });
    }

    const advisor = await prisma.user.update({
      where: { id: req.params.id },
      data: { status },
      select: { id: true, name: true, email: true, status: true },
    });
    res.json(advisor);
  } catch (error) {
    res.status(500).json({ error: 'No fue posible actualizar el asesor' });
  }
});

module.exports = router;
