require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const path = require('path');

const { installOpenAIFetchNormalizer } = require('./config/openaiFetch');
const prisma = require('./config/db');
const authRoutes = require('./routes/auth');
const publicPropertyDetailRoutes = require('./routes/publicPropertyDetail');
const propertyRoutes = require('./routes/properties');
const adminPropertyRoutes = require('./routes/adminProperties');
const propertyImportRoutes = require('./routes/propertyImport');
const propertySyncRoutes = require('./routes/propertySync');
const inquiryRoutes = require('./routes/inquiries');
const statsRoutes = require('./routes/stats');

installOpenAIFetchNormalizer();

const app = express();
const PORT = process.env.PORT || 5000;

app.set('trust proxy', 1);
app.use(helmet({ contentSecurityPolicy: false }));
app.use(compression());
app.use(cookieParser());

const configuredOrigins = process.env.CORS_ORIGIN
  ? process.env.CORS_ORIGIN.split(',').map(origin => origin.trim()).filter(Boolean)
  : true;

app.use(cors({ origin: configuredOrigins, credentials: true }));

app.get('/api/health', async (req, res) => {
  try {
    await prisma.$queryRaw`SELECT 1`;
    res.json({ status: 'ok', database: 'connected', timestamp: new Date().toISOString() });
  } catch (error) {
    console.error('Health check error:', error);
    res.status(503).json({ status: 'error', database: 'unavailable' });
  }
});

app.get('/api/config', (req, res) => {
  res.json({
    contactEmail: process.env.CONTACT_EMAIL || '',
    contactPhone: process.env.CONTACT_PHONE || '',
    whatsappNumber: process.env.WHATSAPP_NUMBER || '',
    contactAddress: process.env.CONTACT_ADDRESS || '',
  });
});

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: 'Demasiadas solicitudes, intenta más tarde' },
});
app.use('/api/', limiter);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

app.use('/api/auth', authRoutes);
app.use('/api/admin/properties', adminPropertyRoutes);
app.use('/api/admin/property-import', propertyImportRoutes);
app.use('/api/admin/property-sync', propertySyncRoutes);
app.use('/api/properties', publicPropertyDetailRoutes);
app.use('/api/properties', propertyRoutes);
app.use('/api/inquiries', inquiryRoutes);
app.use('/api/stats', statsRoutes);

app.use('/api', (req, res) => {
  res.status(404).json({ error: 'Ruta API no encontrada' });
});

const frontendPath = path.join(__dirname, '../../frontend/dist');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  res.sendFile(path.join(frontendPath, 'index.html'));
});

app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.statusCode || 500).json({ error: err.message || 'Error interno del servidor' });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`🚀 Servidor corriendo en puerto ${PORT}`);
});

module.exports = app;
