require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');
const fs = require('fs');

const prisma = require('./config/db');
const authRoutes = require('./routes/auth');
const propertyRoutes = require('./routes/properties');
const inquiryRoutes = require('./routes/inquiries');
const statsRoutes = require('./routes/stats');
const importRoutes = require('./routes/imports');

const app = express();
const PORT = Number(process.env.PORT) || 10000;

app.set('trust proxy', 1);

app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cookieParser());

const allowedOrigin = process.env.APP_URL || process.env.CORS_ORIGIN;
app.use(cors({
  origin: allowedOrigin || true,
  credentials: true,
}));

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.status(200).json({
      status: 'ok',
      database: 'ok',
      timestamp: new Date().toISOString(),
      version: process.env.APP_VERSION || '1.0.0',
    });
  } catch (error) {
    console.error('Health check failed:', error.message);
    res.status(503).json({
      status: 'error',
      database: 'unavailable',
      timestamp: new Date().toISOString(),
    });
  }
});

const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
});
app.use('/api/', apiLimiter);

app.use('/api/auth', authRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/stats', statsRoutes);
app.use('/api/imports', importRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Endpoint no encontrado' });
});

const frontendPath = path.resolve(__dirname, '../../frontend/dist');
if (fs.existsSync(frontendPath)) {
  app.use(express.static(frontendPath, {
    maxAge: process.env.NODE_ENV === 'production' ? '1d' : 0,
    index: false,
  }));

  app.get('*', (req, res) => {
    res.sendFile(path.join(frontendPath, 'index.html'));
  });
} else {
  console.warn(`Frontend build not found at ${frontendPath}`);
  app.get('*', (req, res) => {
    res.status(404).json({ error: 'Frontend no compilado' });
  });
}

app.use((err, req, res, next) => {
  console.error(err);
  res.status(err.statusCode || 500).json({
    error: err.statusCode ? err.message : 'Error interno del servidor',
  });
});

const server = app.listen(PORT, '0.0.0.0', () => {
  console.log(`Servidor disponible en el puerto ${PORT}`);
});

const shutdown = async (signal) => {
  console.log(`${signal} recibido; cerrando servidor`);
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

module.exports = app;
