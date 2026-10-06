# Medición y experimentos de Círculo Internacional

## Estado del 6 de octubre de 2026

Implementado en la rama marketing/measurement, pendiente de despliegue y prueba real.

- Registro propio en Cloudflare D1: consultas de páginas/fichas, clics en WhatsApp/teléfono/correo y exposiciones a pruebas.
- Consentimiento: etiquetas de Google/Meta y medición interna desactivadas hasta la elección del visitante; formularios siguen funcionando.
- Primer y último origen identificado por UTM. No se conserva la URL completa ni parámetros arbitrarios en eventos.
- Solicitudes con idempotencia por requestId, metadatos separados de datos de contacto y cola de envío a GHL.
- Tablero administrativo /admin/marketing: canales, propiedades, solicitudes, etapas, estado de CRM, configuración y generador de enlaces.
- Prueba A/B opcional del texto de WhatsApp en una ficha concreta, asignación por pestaña. Sin ganador automático, anuncios ni presupuesto ejecutado.

## Cambios realmente aplicados a GoHighLevel

Grupo Daniel, pipeline Círculo Internacional | Compradores (C2PJ0kuSE8GhGBp8HWTi): etapa Visita realizada añadida y guardada entre Visita agendada y Oferta y negociación. Probabilidades preexistentes son ajustes del CRM, no estimaciones empíricas de cierre.

## Activación (con sesión autorizada de Cloudflare)

1. Descargar/inspeccionar versión activa del Worker circulo-bienes-raices-staging y comparar con migration/cloudflare-d1: el código local no incluye la ruta diagnóstica GHL descrita en trabajos previos. Conservar cualquier integración o cambio existente en producción antes de publicar.
2. Copia de seguridad/exportación D1. Aplicar migración 0003_marketing_measurement.sql al entorno staging (sirve el dominio productivo). Es aditiva.
3. Publicar build y Worker al mismo entorno. No desplegar al nombre base con database_id de ejemplo.
4. En /admin/marketing guardar ID real GA4 y Meta del negocio. No usar identificadores inventados ni píxel personal.
5. En GA4 desactivar vistas automáticas por historial: la app envía page_view manual por navegación. No duplicar la etiqueta con GTM.
6. Conservar los secretos GHL_CIRCULO_PRIVATE_TOKEN y GHL_CIRCULO_LOCATION_ID del Worker. El código los usa únicamente en servidor.
7. Verificar permisos contacts.write y política de duplicados por email/teléfono del CRM. El primer conector envía contactos vía upsert; inmueble y atribución completos permanecen en el tablero local. Pipeline, campos personalizados, notas, conversiones posteriores y automatizaciones requieren una segunda conexión verificada.
8. Confirmar recepción en GA4 DebugView y Meta Test Events antes de anunciar conexiones activas.

## Prueba de aceptación

Enlace UTM → elegir medición → navegar dos fichas → verificar una vista por navegación y ficha → clic WhatsApp (evento, no lead) → formulario de prueba → verificar un registro incluso al repetir requestId → verificar atribución y contacto GHL. Simular fallo GHL: solicitud local conservada y fallo visible. Cambiar etapa y consultar tablero autenticado. Rechazar medición: sin etiquetas/eventos y formulario operativo.

## Limitaciones explícitas

No existen datos históricos de este nuevo sistema. Los datos internos son eventos de navegadores con consentimiento; no incluyen todas las visitas y no equivalen a personas únicas. La sesión se limita a la pestaña. Los contactos no se deduplican como personas en los conteos de solicitudes. No se calculan ROAS, costo por visita ni ingreso sin conectar inversión y cierres verificados. Los eventos del navegador son señales reportadas por el cliente, no prueba de operaciones comerciales.

Meta Conversions API, sincronización bidireccional de etapas, campos CRM, Search Console y conexión Analytics→GHL pendientes de activación. No hay cron de revisión ni comunicaciones automáticas nuevas.

## Experimentación

Antes de iniciar: ID nuevo, ficha, hipótesis, fecha de revisión, indicador principal y límite de gasto. En esta primera versión el contraste es el texto del CTA; el resultado inmediato son clics, y se complementa con conversaciones/visitas verificadas. No cambiar varias variables ni declarar un ganador por diferencias pequeñas. Anotar la decisión y el aprendizaje antes del siguiente ensayo. Comparar redes solo como atribución observada; no atribuir causalidad sin diseño adecuado.

## Validación

npm run check: Worker/D1, autenticación, importador, Media Sync y build frontend. Casos nuevos: autorización del tablero, validación IDs, idempotencia de solicitudes/eventos, filtrado de parámetros, rechazo sin consentimiento/origen incorrecto, etapa y conservación ante fallo CRM.
