# Círculo Internacional de Bienes Raíces

Plataforma inmobiliaria con frontend React/Vite, API Express, PostgreSQL mediante Prisma y almacenamiento de fotografías en Cloudinary.

## Funcionalidades

- Catálogo público con filtros, paginación y página individual por propiedad.
- Panel administrativo protegido por cookie HttpOnly.
- Creación y edición manual de propiedades.
- Publicación, ocultamiento y archivo recuperable.
- Gestión de fotografías y portada en Cloudinary.
- Importación masiva mediante carpeta local o archivo ZIP.
- Una subcarpeta por propiedad, definida mediante `propiedad.json`.
- Importaciones idempotentes mediante `referenceCode` y `sourceHash`.
- Registro de importaciones exitosas, omitidas y fallidas.
- Health check de aplicación y PostgreSQL en `/api/health`.
- Despliegue Docker en Render.

## Rutas

| Ruta | Descripción |
|---|---|
| `/` | Página principal |
| `/propiedades` | Catálogo público |
| `/propiedades/:slug` | Detalle público |
| `/admin/login` | Inicio de sesión |
| `/admin` | Dashboard |
| `/admin/propiedades` | Inventario completo |
| `/admin/propiedades/nueva` | Alta manual |
| `/admin/propiedades/:id/editar` | Edición |
| `/admin/importar` | Importación de carpetas o ZIP |
| `/admin/consultas` | Solicitudes de clientes |

## Estructura para importar propiedades

```text
propiedades/
├── casa-vista-real/
│   ├── propiedad.json
│   ├── portada.jpg
│   ├── 01-sala.jpg
│   └── 02-cocina.jpg
└── departamento-centro/
    ├── propiedad.json
    ├── portada.webp
    └── 01-vista.webp
```

Ejemplo mínimo:

```json
{
  "referenceCode": "MX-VER-0001",
  "title": "Casa en Boca del Río",
  "description": "Casa de tres recámaras con jardín.",
  "operationType": "SALE",
  "propertyType": "Casa",
  "price": {
    "amount": 4500000,
    "currency": "MXN"
  },
  "status": "PUBLISHED",
  "location": {
    "country": "México",
    "state": "Veracruz",
    "city": "Boca del Río"
  },
  "features": {
    "bedrooms": 3,
    "bathrooms": 2,
    "parkingSpaces": 2,
    "builtAreaM2": 220
  },
  "cover": "portada.jpg"
}
```

El importador también admite `images` con metadatos, amenidades, coordenadas y datos de contacto. Consulta `docs/PROPERTY_FOLDER_FORMAT.md`.

## Desarrollo local

```bash
cd backend
npm ci
cp .env.example .env
npx prisma migrate dev
node prisma/init-admin.js
npm run dev
```

En otra terminal:

```bash
cd frontend
npm ci
npm run dev
```

- Frontend: `http://localhost:5173`
- Backend: `http://localhost:3000`

El proxy de Vite dirige `/api` al backend durante el desarrollo.

## Variables de entorno

```dotenv
DATABASE_URL=
JWT_SECRET=
COOKIE_NAME=circulo_admin_session
ADMIN_EMAIL=
ADMIN_PASSWORD=
CLOUDINARY_CLOUD_NAME=
CLOUDINARY_API_KEY=
CLOUDINARY_API_SECRET=
NODE_ENV=production
```

`ADMIN_PASSWORD` debe tener al menos 12 caracteres. Las credenciales reales nunca deben guardarse en GitHub.

## Despliegue en Render

El archivo `render.yaml` declara:

- Servicio Docker `circulo-bienes-raices-1`.
- Base PostgreSQL `circulo-bienes-raices-db`.
- `DATABASE_URL` enlazada mediante `fromDatabase`.
- Health check `/api/health`.
- Secretos solicitados desde el panel de Render.

Antes del primer despliegue configura en Render:

- `ADMIN_EMAIL`
- `ADMIN_PASSWORD`
- `CLOUDINARY_CLOUD_NAME`
- `CLOUDINARY_API_KEY`
- `CLOUDINARY_API_SECRET`

`JWT_SECRET` se genera automáticamente mediante el Blueprint. Al arrancar, el contenedor ejecuta las migraciones y crea el administrador si todavía no existe.

> La base gratuita de Render expira después del periodo definido por Render. Para producción permanente se recomienda actualizarla a un plan con persistencia y copias de seguridad.

## Comprobaciones

```bash
cd backend
npm ci
npx prisma validate
npx prisma generate

cd ../frontend
npm ci
npm run build

docker build -t circulo-bienes-raices .
```

GitHub Actions ejecuta la validación de Prisma, la revisión sintáctica del backend y el build del frontend en cada pull request.
