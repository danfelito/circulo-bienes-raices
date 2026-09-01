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

## Vulnerabilidades de dependencias verificadas y corregidas

No se ejecutó `npm audit fix --force`. Cada actualización se instaló primero en una copia Git aislada, después se probó en conjunto y finalmente se aplicó a la rama local.

| Dependencia anterior | Alcance | Vulnerabilidad verificada | Versión aplicada | Resultado |
|---|---|---|---|---|
| `vite@5.4.21` / `esbuild@0.21.5` | Desarrollo y compilación del frontend; el servidor Vite no forma parte del Worker publicado | GHSA-4w7w-66w2-5vf9, GHSA-v6wh-96g9-6wx3, GHSA-fx2h-pf6j-xcff y GHSA-67mh-4wv8-2f99. Incluyen lectura de rutas y exposición de respuestas del servidor de desarrollo; una era alta. | `vite@8.2.2` y `@vitejs/plugin-react@6.1.1` | Build correcto con Node 24; cambio de Rollup/esbuild a Rolldown. Sigue el aviso no vulnerable de fragmento mayor de 500 KiB. |
| `react-router-dom@6.30.6` / `react-router@6.30.6` | Navegación del frontend | GHSA-wrjc-x8rr-h8h6 (redirección abierta) y GHSA-337j-9hxr-rhxg (deserialización SSR). La aplicación es SPA, pero el paquete vulnerable estaba instalado. | `react-router-dom@7.18.3` | Compilación y pruebas automatizadas del importador correctas. La regresión visual completa de rutas queda pendiente por el bloqueo de la extensión de Chrome. Requiere Node `>=20`. |
| `sharp@0.33.5` | Aplicación local Media Sync; procesa imágenes no confiables | GHSA-f88m-g3jw-g9cj: vulnerabilidades heredadas de libvips CVE-2026-33327, CVE-2026-33328, CVE-2026-35590 y CVE-2026-35591. Alta. | `sharp@0.35.4` | Sintaxis y pruebas de metadatos/español correctas; conversión real PNG a WebP de 1200×801 correcta. Requiere Node `>=20.9`. |

Resultado de las tres auditorías después de aplicar los cambios: raíz `0`, frontend `0` y Media Sync `0`.

## Entorno remoto de pruebas

- La configuración `staging` se valida con `wrangler deploy --env staging --dry-run` y produciría el Worker `circulo-bienes-raices-staging`.
- La D1 reservada en configuración se llama `circulo-bienes-raices-staging`; su identificador sigue como marcador hasta crear la base en la cuenta correcta.
- `CLOUDINARY_ROOT=circulo-bienes-raices-staging` separa firmas, cargas y limpieza de la raíz productiva `circulo-bienes-raices`.
- Los bindings, variables y secretos se declaran por entorno porque Wrangler no los hereda automáticamente.
- La creación remota está bloqueada: Wrangler no tiene una sesión autenticada ni `CLOUDFLARE_API_TOKEN`. También faltan las credenciales de la cuenta Cloudinary de pruebas. No se usó el modo temporal de Wrangler.

## Pendientes operativos

- Completar en Chrome la selección visual de carpeta y ZIP. La extensión bloqueó `setFiles` hasta habilitar “Allow access to file URLs”; la validación directa del mismo fixture sí pasó con 7 archivos, 6 imágenes y README con `Cabaña`, `México` y `city: Lomas del Porvenir`.
- Conectar Wrangler con la cuenta Cloudflare correcta y aportar credenciales Cloudinary de pruebas; después crear D1, aplicar migraciones, configurar secretos y desplegar sólo `staging`.
- Antes de producción, configurar un disparador programado o Queue para procesar la limpieza incluso cuando no haya tráfico. El Worker ya expone el manejador `scheduled`, pero este cambio local no crea ningún recurso.
- Dividir el bundle del frontend; el build local avisa que el fragmento principal supera 500 KiB.
