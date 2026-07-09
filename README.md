# Círculo Internacional de Bienes Raíces

Plataforma inmobiliaria completa con frontend React y backend Express + Prisma + PostgreSQL.

## Arquitectura

Monorepo con **frontend React** + **backend Express** + **Prisma ORM** + **PostgreSQL**, desplegable como un solo servicio Docker en Render.

### Backend (Express + Prisma + PostgreSQL)
- **Modelos**: Property (27 campos), Photo, Inquiry, User
- **Autenticación**: JWT en cookie HttpOnly + bcrypt
- **API Pública**: GET /api/properties (filtros, paginación), GET /api/properties/:slug, GET /api/properties/featured, POST /api/inquiries
- **API Admin**: CRUD completo de propiedades, cambio de estado, estadísticas, gestión de consultas
- **Fotos**: Cloudinary (persistencia entre despliegues)
- **Seguridad**: Helmet, CORS, Rate Limit, Compression, Honeypot anti-spam

### Frontend (React + Tailwind + Framer Motion)
- **Catálogo**: Filtros por operación/tipo/ciudad, búsqueda, paginación, ordenamiento
- **Detalle de propiedad**: Galería, mapa Leaflet, formulario de contacto, WhatsApp, propiedades relacionadas
- **Panel Admin**: Dashboard con estadísticas, CRUD propiedades, gestión de fotos, consultas
- **Login Admin**: /admin/login

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page |
| `/propiedades` | Catálogo con filtros |
| `/propiedades/:slug` | Detalle de propiedad |
| `/admin/login` | Login administración |
| `/admin` | Dashboard administración |
| `/admin/propiedades/nueva` | Crear propiedad |
| `/admin/propiedades/:id/editar` | Editar propiedad |
| `/admin/consultas` | Gestión de consultas |

## Desarrollo Local

```bash
# 1. Instalar dependencias
cd backend && npm install
cd ../frontend && npm install

# 2. Configurar .env en backend/
cp backend/.env.example backend/.env
# Editar DATABASE_URL, JWT_SECRET, Cloudinary, Admin credentials

# 3. Base de datos
cd backend
npx prisma migrate dev
npm run seed

# 4. Iniciar backend
npm run dev

# 5. Iniciar frontend (en otra terminal)
cd ../frontend
npm run dev
```

## Despliegue en Render

### Configuración necesaria:

1. **Push a GitHub**: `git push origin main`
2. **Crear PostgreSQL** en Render → copiar URL a `DATABASE_URL`
3. **Configurar Cloudinary**: `CLOUDINARY_CLOUD_NAME`, `CLOUDINARY_API_KEY`, `CLOUDINARY_API_SECRET`
4. **Configurar admin**: `ADMIN_EMAIL` y `ADMIN_PASSWORD`
5. **JWT_SECRET**: Generar un string aleatorio seguro (Render lo puede generar automáticamente)

### Crear servicio en Render:
- Conectar repo `danfelito/circulo-bienes-raices`
- Seleccionar **Docker** como runtime
- El `render.yaml` configura todo automáticamente

## Estructura

```
├── backend/
│   ├── prisma/
│   │   ├── schema.prisma
│   │   ├── seed.js
│   │   └── migrations/
│   ├── src/
│   │   ├── config/
│   │   │   ├── auth.js
│   │   │   ├── cloudinary.js
│   │   │   └── db.js
│   │   ├── routes/
│   │   │   ├── auth.js
│   │   │   ├── properties.js
│   │   │   ├── inquiries.js
│   │   │   └── stats.js
│   │   └── index.js
│   ├── .env.example
│   └── package.json
├── frontend/
│   ├── src/
│   │   ├── api/index.js
│   │   ├── components/
│   │   ├── pages/
│   │   │   ├── HomePage.jsx
│   │   │   ├── PropertiesPage.jsx
│   │   │   ├── PropertyDetailPage.jsx
│   │   │   └── admin/
│   │   ├── App.jsx
│   │   ├── main.jsx
│   │   └── index.css
│   ├── index.html
│   ├── vite.config.js
│   ├── tailwind.config.js
│   └── package.json
├── Dockerfile
├── render.yaml
└── .gitignore
```
