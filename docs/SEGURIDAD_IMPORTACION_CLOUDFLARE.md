# Seguridad e importación Cloudflare/D1

Fecha de revisión: 2026-08-31. Alcance: copia local, rama `migration/cloudflare-d1`.

## Controles implementados

- El límite de acceso se guarda en D1 y cada fallo se incrementa con una sola sentencia atómica. No depende de memoria de un proceso o isolate.
- Cada carga usa una sesión D1 con dueño, inventario, carpeta exclusiva, expiración y máximo de archivos.
- El `public_id` de Cloudinary es determinista por sesión y ruta. La respuesta firmada debe coincidir con ese identificador, la carpeta, el cloud, el tipo de recurso y la URL esperados.
- Una sesión emitida para una propiedad, `sourceId` o importación no puede completar otro destino, aunque la firma de respuesta de Cloudinary sea auténtica.
- Los borrados externos nunca ocurren en la solicitud que modifica D1. Se registran en `cloudinary_cleanup_queue`, esperan a que venza cualquier sesión y vuelven a consultar `photos` inmediatamente antes de borrar.
- Una respuesta perdida puede repetirse: Media Sync reutiliza el mismo archivo firmado y el importador identifica el registro final con `importId`.
- El importador descomprime en navegador y rechaza rutas relativas peligrosas, ZIP cifrados, rutas duplicadas, archivos excesivos y relaciones de compresión anómalas.
- El análisis es opcional. Sólo acepta inventario JSON y hasta 256 KiB de texto; las fotos, videos y ZIP no pasan por el Worker para análisis.
- La importación inserta primero la propiedad como oculta dentro de un lote D1, inserta todos los medios y sólo en la última sentencia aplica la visibilidad solicitada. El lote es atómico.

## Límites del importador

| Control | Límite |
|---|---:|
| Archivos inventariados | 200 |
| Fotos y videos | 100 |
| Tamaño total | 1 GiB |
| Archivo individual | 250 MiB |
| ZIP comprimido | 250 MiB |
| ZIP descomprimido | 512 MiB |
| Entradas por ZIP | 200 |
| Relación de compresión | 100:1 |
| Texto opcional para análisis | 256 KiB |
| Sesión de carga | 60 minutos |
| Margen antes de limpieza | 5 minutos después de expirar |

Las cargas tienen hasta tres intentos con espera incremental. Cancelar invalida la sesión y programa para limpieza los identificadores deterministas que pudieron alcanzar Cloudinary.

## Evidencia local

- `npm run check`: sintaxis, Worker smoke, regresiones Media Sync, pruebas del importador y compilación Vite.
- Worker smoke: dos objetos de entorno independientes comparten el mismo D1 para comprobar el bloqueo de acceso; prueba de respuesta perdida; rechazo de firma válida con dueño incorrecto; limpieza forzada que conserva un `publicId` referenciado.
- Importador: ZIP válido, ruta `../` rechazada, inventario, reintentos y cancelación.
- `wrangler d1 migrations apply circulo-bienes-raices-db --local --persist-to <estado-aislado>`: `0001` (15 instrucciones) y `0002` (8 instrucciones) aplicadas desde cero.
- `wrangler d1 execute ... --local --persist-to <estado-aislado>`: confirmó `properties`, `photos`, `login_attempts`, `upload_sessions`, `cloudinary_cleanup_queue` y `property_sync_commits`.
- `wrangler dev` local: `GET /api/health` respondió 200 con D1 conectado.
- Todas las llamadas externas de las pruebas están simuladas; no se usaron recursos Cloudflare ni Cloudinary remotos.

## Vulnerabilidades de dependencias pendientes

No se ejecutó `npm audit fix --force` ni se actualizó ninguna dependencia a una versión mayor o incompatible.

| Dependencia instalada | Alcance | Vulnerabilidad | Versión corregida indicada por npm | Impacto antes de actualizar |
|---|---|---|---|---|
| `vite@5.4.21` / `esbuild@0.21.5` | Desarrollo y compilación del frontend; el servidor Vite no forma parte del Worker publicado | Lectura desde servidor de desarrollo, rutas alternativas de Windows, mapas de dependencias y solicitudes desde otros sitios. Alta por el bypass de `server.fs.deny`; las restantes son moderadas. | `vite@8.2.2` (incluye `esbuild` corregido) | Salto mayor. Requiere Node `^20.19.0` o `>=22.12.0`, revisar compatibilidad de `@vitejs/plugin-react`, configuración y salida de compilación. Ejecutar navegación y build completos. |
| `react-router-dom@6.30.6` / `react-router@6.30.6` | Navegación del frontend | Redirección abierta por barra invertida y riesgo en deserialización de errores SSR. Esta aplicación usa SPA y no SSR, por lo que el segundo alcance no está activo actualmente; los enlaces siguen requiriendo revisión. | `react-router-dom@7.18.3` | Salto mayor. Requiere Node `>=20`; revisar rutas relativas, navegación, `ProtectedRoute`, login y enlaces administrativos/públicos. |
| `sharp@0.33.5` | Aplicación local Media Sync; procesa imágenes no confiables antes de cargarlas | Vulnerabilidades heredadas de libvips (CVE-2026-33327, CVE-2026-33328, CVE-2026-35590 y CVE-2026-35591). Alta. | `sharp@0.35.4` | npm lo considera cambio mayor por estar en `0.x`. Requiere Node `>=20.9`; validar binarios nativos de Windows, orientación EXIF, conversión WebP, metadatos, consumo de memoria y escaneo real de una carpeta. |

Resultado de auditoría actual: raíz `0`; frontend `4` (3 moderadas, 1 alta); Media Sync `1` alta. La nueva dependencia `@zip.js/zip.js@2.8.61` no añadió avisos al informe.

## Pendientes operativos

- Elegir y programar el salto de Vite 8, React Router 7 y Sharp 0.35 con sus regresiones específicas.
- Antes de producción, configurar un disparador programado o Queue para procesar la limpieza incluso cuando no haya tráfico. El Worker ya expone el manejador `scheduled`, pero este cambio local no crea ningún recurso.
- Probar el importador manualmente en Chrome con una carpeta real y un ZIP grande dentro de los límites.
- Dividir el bundle del frontend; el build local avisa que el fragmento principal supera 500 KiB.
