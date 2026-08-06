# Círculo Media Sync

Aplicación local para Windows que conserva los originales en la computadora, genera copias optimizadas de fotografías y videos, y sincroniza las propiedades con `https://circulo-bienes-raices-2.onrender.com/propiedades`.

## Instalación en Windows

1. Instalar Node.js 20 LTS o superior.
2. Abrir `INSTALAR_CIRCULO_SYNC_WINDOWS.cmd`.
3. Utilizar el acceso directo **Círculo Media Sync** creado en el escritorio.

La aplicación abre una interfaz local en `http://127.0.0.1:4317`. Ningún archivo se publica hasta presionar **Sincronizar con portal**.

## Estructura de carpetas

```text
PROPIEDADES/
├── CI-VER-0001-Casa-Costa-de-Oro/
│   ├── README.md
│   ├── fotos/
│   │   ├── 01-portada.jpg
│   │   └── 02-sala.jpg
│   └── videos/
│       └── recorrido.mov
└── CI-VER-0002-Terreno-Riviera/
    ├── README.md
    └── fotos/
```

Una carpeta con README representa una propiedad.

## Plantilla de README

```markdown
---
property_id: CI-VER-0001
status: available
published: true
featured: false
title: Casa con jardín en Costa de Oro
operation: venta
type: casa
price: 4850000
currency: MXN
city: Boca del Río
state: Veracruz
country: México
address: Costa de Oro
bedrooms: 3
bathrooms: 2.5
parking: 2
construction_area: 220
land_area: 280
year_built: 2018
cover: fotos/01-portada.jpg
updated_at: 2026-08-05
features:
  - Jardín
  - Terraza
  - Cocina integral
---

Casa de dos niveles con iluminación natural, jardín posterior y estacionamiento para dos vehículos.
```

Estados aceptados: `available`, `reserved`, `sold`, `rented` y sus equivalentes en español.

## Optimización aplicada

### Imágenes

- Rotación según metadatos.
- Resolución máxima de 2048 px.
- Conversión a WebP.
- Calidad adaptativa entre 78 y 84.
- Perfil sRGB.
- Los originales no se modifican.

### Videos

- Conversión a MP4 H.264.
- Resolución máxima 1080p.
- 30 fps.
- Audio AAC a 96 kbps.
- `faststart` para reproducción rápida en web.
- CRF adaptativo entre 22 y 24.

## Archivos locales

Las copias optimizadas y los manifiestos se guardan en:

```text
%LOCALAPPDATA%\CirculoMediaSync\cache
```

El manifiesto conserva huellas SHA-256, tamaños, dimensiones y último estado sincronizado. Solo se vuelven a enviar archivos modificados.

## Seguridad

- La contraseña administrativa no se guarda.
- La aplicación escucha únicamente en `127.0.0.1`.
- Los originales permanecen en la carpeta seleccionada.
