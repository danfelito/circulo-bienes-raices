# Círculo Internacional de Bienes Raíces

Plataforma inmobiliaria completa con frontend React y backend Express + Prisma + PostgreSQL.

## Funcionalidades principales

- Identidad visual blanca, roja y negra con logotipo tipográfico adaptable.
- Catálogo público con búsqueda, filtros, tarjetas, mapa OpenStreetMap/Leaflet y detalle multimedia.
- Portal de asesores con solicitud de alta, autorización por correo y acceso protegido.
- Carga de fotografías y videos en Cloudinary.
- Publicación conectada: una propiedad creada por un asesor autorizado aparece en el catálogo público.
- Panel administrativo existente para propiedades, consultas y estadísticas.

## Flujo de asesores

1. El asesor entra a `/asesores` y registra nombre, correo, teléfono y contraseña.
2. El backend crea la cuenta con estado `pending`.
3. Se envía un correo a `ADMIN_APPROVAL_EMAIL` con botones para autorizar o rechazar.
4. Al autorizar, el asesor puede iniciar sesión y entrar a `/asesores/panel`.
5. Desde el panel sube fotos, videos y detalles; la propiedad queda publicada y vinculada a su cuenta.

## Servicios gratuitos o con plan gratuito

- **Render**: despliegue del servicio Docker y PostgreSQL.
- **Cloudinary**: almacenamiento y optimización de imágenes y videos.
- **Resend**: correo de autorización del asesor.
- **OpenStreetMap + Leaflet**: mapas sin licencia comercial de Google Maps.

## Variables de entorno

Configura las variables existentes de base de datos, autenticación, Cloudinary y servidor. Agrega también:

- `APP_URL`: URL pública del servicio.
- `ADMIN_APPROVAL_EMAIL`: correo que recibe las solicitudes; el valor previsto es `circulointernacionalveracruz1@gmail.com`.
- `RESEND_API_KEY`: clave privada creada en Resend.
- `RESEND_FROM_EMAIL`: remitente autorizado en Resend.

Sin `RESEND_API_KEY`, el registro se conserva y los enlaces de autorización se escriben en los logs del servidor para facilitar pruebas.

## Rutas

| Ruta | Descripción |
|------|-------------|
| `/` | Landing page |
| `/propiedades` | Catálogo con filtros y mapa |
| `/propiedades/:slug` | Detalle con fotos, videos y contacto |
| `/asesores` | Registro e inicio de sesión de asesores |
| `/asesores/panel` | Carga y administración de propiedades del asesor |
| `/admin/login` | Login administración |
| `/admin` | Dashboard administración |
| `/admin/propiedades/nueva` | Crear propiedad |
| `/admin/propiedades/:id/editar` | Editar propiedad |
| `/admin/consultas` | Gestión de consultas |

## Desarrollo local

```bash
cd backend && npm install
cd ../frontend && npm install

cp backend/.env.example backend/.env

cd backend
npx prisma migrate dev
npm run seed
npm run dev

# Otra terminal
cd frontend
npm run dev
```

## Despliegue en Render

1. Crear o conectar PostgreSQL y copiar su URL a `DATABASE_URL`.
2. Configurar credenciales de Cloudinary.
3. Crear una API key en Resend y configurar las variables de correo.
4. Configurar `APP_URL` con la URL pública final del servicio.
5. Definir `ADMIN_EMAIL`, `ADMIN_PASSWORD` y un `JWT_SECRET` seguro.
6. Conectar el repositorio como servicio Docker; las migraciones se aplican al iniciar.
