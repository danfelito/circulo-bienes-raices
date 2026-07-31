# Círculo Internacional de Bienes Raíces

Plataforma inmobiliaria completa con frontend React y backend Express + Prisma + PostgreSQL.

## Arquitectura

Monorepo con **frontend React** + **backend Express** + **Prisma ORM** + **PostgreSQL**, desplegable como un solo servicio Docker en Render.

### Backend (Express + Prisma + PostgreSQL)
- **Modelos**: Property, Photo/Media, Inquiry y User
- **Autenticación**: JWT en cookie HttpOnly + bcrypt
- **API Pública**: catálogo, detalle, propiedades destacadas y consultas
- **API Admin**: CRUD de propiedades, estado, estadísticas, consultas e importación asistida
- **Medios**: fotografías y videos persistentes en Cloudinary
- **IA inmobiliaria**: lectura de documentos, fotografías e inventario mediante OpenAI Responses API
- **Seguridad**: Helmet, CORS, Rate Limit, Compression y Honeypot anti-spam

### Frontend (React + Tailwind + Framer Motion)
- **Catálogo**: filtros por operación, tipo y ciudad; búsqueda, paginación y ordenamiento
- **Detalle de propiedad**: galería mixta de fotografías y videos, mapa, contacto y propiedades relacionadas
- **Panel Admin**: dashboard, CRUD, consultas e importación por carpeta o ZIP
- **Login Admin**: `/admin/login`

## Importación de propiedades con IA

Ruta administrativa: `/admin/propiedades/importar`

Flujo:

1. Arrastrar una carpeta, seleccionar una carpeta, cargar un ZIP o pegar archivos.
2. El servidor clasifica documentos, fotografías y videos.
3. La IA extrae precio, operación, tipo, ubicación, superficies, habitaciones, amenidades y descripción.
4. El administrador revisa los datos, las alertas y la fotografía principal.
5. Al confirmar, se crea la propiedad, se optimizan los medios y se publica en `/propiedades`.

Formatos principales:

- Fotografías: JPG, PNG, WebP, GIF, AVIF y HEIC/HEIF cuando Cloudinary los admite.
- Videos: MP4, MOV, M4V, WebM, AVI y MKV cuando Cloudinary los admite.
- Documentos: PDF, DOC/DOCX, XLS/XLSX, PPT/PPTX, TXT, Markdown, CSV y JSON.
- También se acepta un archivo ZIP que contenga el expediente completo.

La publicación se prepara como borrador revisable. Los datos sensibles o ausentes no se inventan; el sistema los marca para confirmación.

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page |
| `/propiedades` | Catálogo con filtros |
| `/propiedades/:slug` | Detalle de propiedad |
| `/admin/login` | Login administración |
| `/admin` | Dashboard administración |
| `/admin/propiedades` | Gestión de propiedades |
| `/admin/propiedades/importar` | Importación por carpeta con IA |
| `/admin/propiedades/nueva` | Crear propiedad manualmente |
| `/admin/propiedades/:id/editar` | Editar propiedad y medios |
| `/admin/consultas` | Gestión de consultas |

## Desarrollo Local

```bash
# 1. Instalar dependencias
cd backend && npm install
cd ../frontend && npm install

# 2. Configurar .env en backend/
cp backend/.env.example backend/.env
# Editar DATABASE_URL, JWT_SECRET, Cloudinary, OpenAI y credenciales de administrador

# 3. Base de datos
cd backend
npx prisma migrate dev
npm run seed

# 4. Iniciar backend
npm run dev

# 5. Iniciar frontend en otra terminal
cd ../frontend
npm run dev
```

## Despliegue en Render

Variables necesarias:

1. `DATABASE_URL`
2. `JWT_SECRET`
3. `ADMIN_EMAIL`
4. `ADMIN_PASSWORD`
5. `CLOUDINARY_CLOUD_NAME`
6. `CLOUDINARY_API_KEY`
7. `CLOUDINARY_API_SECRET`
8. `OPENAI_API_KEY`
9. `OPENAI_PROPERTY_MODEL` — valor recomendado en el proyecto: `gpt-5`
10. Datos públicos de contacto: `CONTACT_EMAIL`, `CONTACT_PHONE`, `WHATSAPP_NUMBER`, `CONTACT_ADDRESS`

El sistema sigue ofreciendo lectura básica si `OPENAI_API_KEY` no está configurada, pero la interpretación visual y documental completa requiere esa variable.

### Crear servicio en Render

- Conectar `danfelito/circulo-bienes-raices`.
- Seleccionar Docker como runtime.
- Usar `/api/health` como health check.
- El archivo `render.yaml` contiene la configuración del servicio `circulo-bienes-raices-2`.

## Validación automática

GitHub Actions verifica en cada cambio:

- Esquema Prisma y generación del cliente.
- Sintaxis del backend.
- Compilación del frontend.
- Construcción de la imagen Docker.
- Arranque con PostgreSQL real.
- Login, análisis de una mini carpeta inmobiliaria, catálogo, CRUD, consultas y estadísticas.
- Disponibilidad del servicio de Render y del portal conectado.
