# Círculo Internacional de Bienes Raíces

Plataforma inmobiliaria con frontend React, API Express, PostgreSQL mediante Prisma y almacenamiento de fotografías en Cloudinary. El frontend y la API se ejecutan en un único contenedor Docker compatible con Render.

## Funciones

- Catálogo público con búsqueda, filtros y paginación.
- Página individual de cada propiedad.
- Panel administrativo protegido mediante cookie HttpOnly.
- Creación y edición manual de propiedades.
- Publicación, despublicación, destacados y archivado.
- Importación de propiedades desde una carpeta local o un archivo ZIP.
- Fotografías persistentes en Cloudinary.
- Migraciones automáticas de PostgreSQL.
- Health check en `/api/health`.

## Rutas principales

| Ruta | Descripción |
|---|---|
| `/` | Página principal |
| `/propiedades` | Catálogo público |
| `/propiedades/:slug` | Detalle público |
| `/admin/login` | Acceso administrativo |
| `/admin` | Dashboard |
| `/admin/propiedades` | Inventario completo |
| `/admin/propiedades/nueva` | Alta manual |
| `/admin/propiedades/:id/editar` | Edición |
| `/admin/importar` | Importación por carpetas o ZIP |
| `/admin/consultas` | Solicitudes de clientes |
| `/api/health` | Estado del servicio y la base de datos |

## Formato de carpetas

Cada subcarpeta representa una propiedad:

```text
propiedades/
├── casa-costa-de-oro/
│   ├── propiedad.json
│   ├── portada.jpg
│   ├── 01-sala.jpg
│   └── 02-cocina.jpg
└── departamento-boca-del-rio/
    ├── propiedad.json
    ├── portada.webp
    └── 01-vista.webp
```

Ejemplo de `propiedad.json`:

```json
{
  "referenceCode": "MX-VER-0001",
  "slug": "casa-costa-de-oro",
  "title": "Casa en Costa de Oro",
  "description": "Residencia con jardín y excelente ubicación.",
  "operationType": "SALE",
  "propertyType": "Casa",
  "status": "PUBLISHED",
  "featured": true,
  "price": {
    "amount": 8500000,
    "currency": "MXN"
  },
  "location": {
    "country": "México",
    "state": "Veracruz",
    "city": "Boca del Río",
    "address": "Costa de Oro",
    "latitude": 19.1738,
    "longitude": -96.1342
  },
  "features": {
    "bedrooms": 4,
    "bathrooms": 4.5,
    "parkingSpaces": 3,
    "builtAreaM2": 380,
    "landAreaM2": 500,
    "yearBuilt": 2022
  },
  "amenities": ["Alberca", "Jardín", "Seguridad"],
  "cover": "portada.jpg",
  "images": [
    { "file": "portada.jpg", "alt": "Fachada", "isCover": true, "order": 0 },
    { "file": "01-sala.jpg", "alt": "Sala", "order": 1 }
  ]
}
```

La importación es idempotente. `referenceCode` identifica la propiedad; si el contenido no cambió se omite, y si cambió se actualizan los datos y fotografías sin crear duplicados.

Estados admitidos en el manifiesto:

- `PUBLISHED`: visible públicamente.
- `DRAFT`: guardada únicamente en el panel.
- `ARCHIVED`: retirada del catálogo.

## Desarrollo local

```bash
cp backend/.env.example backend/.env

cd backend
npm ci
npx prisma generate
npx prisma migrate dev
node prisma/seed.js
npm run dev
```

En otra terminal:

```bash
cd frontend
npm ci
npm run dev
```

Frontend: `http://localhost:5173`

Backend: `http://localhost:5000`

## Variables de entorno

```dotenv
DATABASE_URL=postgresql://...
JWT_SECRET=un-secreto-aleatorio-de-32-caracteres-o-mas
COOKIE_NAME=circulo_admin_session
ADMIN_EMAIL=administrador@dominio.com
ADMIN_PASSWORD=una-contrasena-segura-de-12-caracteres-o-mas
CLOUDINARY_CLOUD_NAME=...
CLOUDINARY_API_KEY=...
CLOUDINARY_API_SECRET=...
APP_URL=https://circulo-bienes-raices-1.onrender.com
NODE_ENV=production
```

No guardes valores reales en el repositorio.

## Despliegue en Render

1. Conecta el repositorio `danfelito/circulo-bienes-raices` al servicio existente.
2. Usa Docker como runtime y la raíz del repositorio como contexto.
3. Configura todas las variables anteriores en **Environment**.
4. Cambia inmediatamente cualquier contraseña que haya estado expuesta anteriormente.
5. Despliega la rama deseada.
6. El contenedor ejecutará:
   - `prisma migrate deploy`;
   - creación idempotente del administrador;
   - inicio de Express.
7. Verifica primero `/api/health` y después `/admin/login`.

El archivo `render.yaml` incluye el health check y marca todos los secretos como valores configurables fuera del repositorio.

## Validación

GitHub Actions ejecuta:

- instalación limpia de dependencias;
- validación y generación de Prisma;
- revisión sintáctica del backend;
- build de Vite;
- build completo de Docker.
