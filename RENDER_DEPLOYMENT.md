# Configuración correcta en Render

El servicio productivo esperado es:

- **Nombre:** `circulo-bienes-raices-1`
- **Tipo:** Web Service
- **Runtime:** Docker
- **Repositorio:** `danfelito/circulo-bienes-raices`
- **Rama:** `main`
- **Root Directory:** vacío
- **Dockerfile Path:** `./Dockerfile`
- **Health Check Path:** `/api/health`
- **Auto-Deploy:** activado para `main`

## Importante

No configurar el proyecto como **Static Site**. Tampoco debe tener `Publish Directory`, `Build Command` o `Start Command` manuales que reemplacen el Dockerfile. El mismo contenedor ejecuta Express, sirve el frontend compilado y expone la API.

## PostgreSQL

Crear o conectar una base PostgreSQL en Render. Usar la **Internal Database URL** del mismo entorno como variable `DATABASE_URL`.

Al iniciar, el contenedor ejecuta:

1. `prisma migrate deploy`
2. creación o sincronización del usuario administrador
3. inicio de Express

## Variables obligatorias

| Variable | Uso |
|---|---|
| `DATABASE_URL` | Conexión PostgreSQL interna |
| `JWT_SECRET` | Firma de sesiones; usar un valor largo y aleatorio |
| `ADMIN_EMAIL` | Usuario del panel administrativo |
| `ADMIN_PASSWORD` | Contraseña del panel; mínimo 12 caracteres |
| `CLOUDINARY_CLOUD_NAME` | Cuenta para fotografías |
| `CLOUDINARY_API_KEY` | Credencial para fotografías |
| `CLOUDINARY_API_SECRET` | Secreto para fotografías |
| `CORS_ORIGIN` | `https://circulo-bienes-raices-1.onrender.com` |

## Variables públicas de contacto

| Variable | Formato recomendado |
|---|---|
| `CONTACT_EMAIL` | `contacto@dominio.com` |
| `CONTACT_PHONE` | `+52 229 000 0000` |
| `WHATSAPP_NUMBER` | Solo dígitos y código de país, por ejemplo `522290000000` |
| `CONTACT_ADDRESS` | Dirección comercial que se mostrará en el sitio |

## Despliegue

1. Fusionar el PR aprobado en `main`.
2. En Render, abrir `circulo-bienes-raices-1`.
3. Confirmar que el servicio sea Docker y apunte al repositorio y rama indicados.
4. Guardar todas las variables.
5. Ejecutar **Manual Deploy → Deploy latest commit**.
6. Revisar los logs hasta ver migraciones aplicadas, administrador preparado y servidor iniciado.

## Verificación posterior

Estas rutas deben responder:

- `/` → frontend
- `/propiedades` → catálogo
- `/admin/login` → acceso administrativo
- `/api/health` → JSON con `status: "ok"` y `database: "connected"`
- `/api/properties?limit=1` → JSON con `properties` y `pagination`

El endpoint `/api/properties` nunca debe responder HTML. Si devuelve la página de inicio, Render está sirviendo una versión estática o una configuración anterior en lugar del contenedor actual.

## Servicio duplicado

Después de validar `circulo-bienes-raices-1`, suspender o eliminar cualquier servicio antiguo que apunte al mismo dominio o repositorio. No eliminar la base PostgreSQL usada por el servicio validado.
