# CRM Círculo Internacional Veracruz — especificación funcional

## Objetivo
Sustituir progresivamente GoHighLevel por un CRM inmobiliario propio dentro de `/admin`, manteniendo la relación completa entre propiedad, prospecto, actividad comercial, contenido, publicación y cierre.

## Regla de migración
GoHighLevel no se desconecta hasta validar en producción: captura de leads, pipeline, tareas, auditoría audiovisual, publicación directa y métricas.

## Pipeline
`new` → `contacted` → `qualified` → `visit_scheduled` → `visited` → `negotiation` → `won|lost`.

## Entidades
- Lead: datos del prospecto, fuente, campaña, asesor, etapa, temperatura y próxima acción.
- LeadProperty: relación N:M entre prospectos y propiedades.
- Activity: llamada, WhatsApp, email, nota, cambio de etapa, visita y seguimiento.
- Task: próxima acción, vencimiento, responsable y estado.
- Visit: fecha/hora, propiedad, prospecto, asesor y resultado.
- SocialAccount: red, identificador externo, scopes, estado de autorización; tokens cifrados fuera de logs/UI.
- MediaAsset: video/imagen final, propiedad, versión, estado de auditoría.
- MediaAudit: controles técnicos/comerciales y resultado `approved|rejected`.
- SocialPost: copy, red, estado, ID/URL externo, métricas y errores.
- Attribution: UTM/click/session/lead para unir publicación → web → lead → visita → cierre.

## Auditoría obligatoria antes de publicar
1. 9:16 y 1080×1920 para reels.
2. Full bleed, sin franjas ni espacios vacíos.
3. Fotografías pertenecen a la propiedad correcta.
4. Precio, operación, recámaras, baños y estacionamientos coinciden con la base de datos.
5. Logo oficial visible y consistente.
6. Tipografía corporativa consistente.
7. Movimiento: zoom in/out y paneos laterales suaves.
8. Transiciones discretas.
9. Música autorizada, audible, con fade-in/fade-out.
10. CTA y marca al cierre.
11. Sin espacios, características o acabados inventados.
12. Codec/formato válido para las redes destino.

**Fail closed:** cualquier control crítico fallido deja el activo en `rejected`; ningún endpoint de publicación acepta un activo no `approved`.

## Publicación directa
Adaptadores independientes por proveedor: Meta (Facebook/Instagram), YouTube y LinkedIn. OAuth por cuenta; refresh de tokens; scopes mínimos; webhook/polling de estado; reintentos idempotentes. Guardar `externalPostId`, `permalink`, timestamps y respuesta normalizada.

## Analítica
Dashboard por propiedad/campaña/red con impresiones, reproducciones, clics, leads, visitas, negociaciones y cierres. UTM estándar: `utm_source`, `utm_medium=social`, `utm_campaign=<property-slug>`, `utm_content=<asset-version>`.

## Seguridad
- OAuth state + PKCE cuando el proveedor lo soporte.
- Tokens cifrados en reposo y nunca enviados al frontend.
- RBAC: admin, asesor, marketing.
- Bitácora inmutable de acciones sensibles.
- Rate limiting y validación de webhooks.
- No almacenar contraseñas de redes sociales.

## Entrega incremental
Fase 1: CRM/pipeline + tareas + actividad + relación propiedad/prospecto.
Fase 2: biblioteca audiovisual + auditoría fail-closed.
Fase 3: OAuth/publicación directa y registro de URLs/IDs.
Fase 4: atribución y métricas de embudo.
Fase 5: migración final desde GHL y retiro del cuello de botella.
