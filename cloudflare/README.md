# Despliegue en Cloudflare Workers + D1

Esta carpeta contiene la nueva API para Cloudflare. Durante la migración, el
servicio actual de Render permanece intacto y el dominio no se cambia hasta
que la dirección temporal `workers.dev` supere todas las pruebas.

## Preparación local

1. Instalar dependencias en la raíz con `npm install`.
2. Copiar `cloudflare/.dev.vars.example` como `.dev.vars` en la raíz y completar
   los secretos. Nunca subir `.dev.vars` a Git.
3. Sustituir `REPLACE_WITH_CLOUDFLARE_D1_DATABASE_ID` en `wrangler.jsonc` por el
   identificador que entregue Cloudflare al crear D1.
4. Aplicar el esquema local con `npm run d1:local`.
5. Iniciar la vista de prueba con `npm run cf:dev`.

## Recursos de producción

- Worker: `circulo-bienes-raices`
- D1: `circulo-bienes-raices-db`
- Binding D1: `DB`
- Archivos estáticos: `frontend/dist`

Los secretos se cargan con `wrangler secret put` o mediante el complemento de
Cloudflare. Las credenciales no deben escribirse en este repositorio.
