# Formato de carpetas de propiedades

Cada subcarpeta representa una propiedad. Debe contener `propiedad.json` y por lo menos una imagen válida.

```text
propiedades/
└── codigo-o-slug/
    ├── propiedad.json
    ├── portada.jpg
    ├── 01-fachada.jpg
    └── 02-interior.webp
```

## Manifiesto completo

```json
{
  "referenceCode": "MX-VER-0001",
  "slug": "casa-vista-real-boca-del-rio",
  "title": "Casa Vista Real",
  "shortDescription": "Casa con jardín y acabados premium.",
  "description": "Descripción extensa de la propiedad.",
  "operationType": "SALE",
  "propertyType": "Casa",
  "status": "PUBLISHED",
  "featured": true,
  "price": {
    "amount": 4500000,
    "currency": "MXN"
  },
  "location": {
    "country": "México",
    "state": "Veracruz",
    "city": "Boca del Río",
    "neighborhood": "Riviera Veracruzana",
    "address": "Dirección opcional",
    "latitude": 19.1048,
    "longitude": -96.1036
  },
  "features": {
    "bedrooms": 4,
    "bathrooms": 3,
    "parkingSpaces": 2,
    "builtAreaM2": 320,
    "landAreaM2": 400,
    "yearBuilt": 2023
  },
  "amenities": [
    "Jardín",
    "Cocina integral",
    "Seguridad privada"
  ],
  "contact": {
    "name": "Círculo Bienes Raíces",
    "phone": "+52 229 000 0000",
    "email": "contacto@example.com",
    "whatsapp": "+522290000000"
  },
  "cover": "portada.jpg",
  "images": [
    {
      "file": "portada.jpg",
      "alt": "Fachada principal",
      "order": 0,
      "isCover": true
    },
    {
      "file": "01-fachada.jpg",
      "alt": "Vista exterior",
      "order": 1
    }
  ]
}
```

## Valores admitidos

- `operationType`: `SALE`, `RENT`, `venta` o `renta`.
- `status`: `PUBLISHED`, `DRAFT` o `ARCHIVED`.
- Imágenes: JPEG, PNG, WEBP o AVIF.
- Máximo por imagen: 12 MB.
- Máximo de imágenes: 50 por propiedad.
- Máximo de archivos procesados en una importación: 500.
- Máximo del ZIP: 200 MB.

## Portada

El sistema utiliza este orden:

1. Imagen con `isCover: true`.
2. Archivo indicado en `cover`.
3. Archivo denominado `portada`, `cover` o `fachada`.
4. Primera imagen en orden natural.

## Actualizaciones

`referenceCode` identifica la propiedad. Al importar nuevamente el mismo código:

- Si el manifiesto y las imágenes no cambiaron, la propiedad se omite.
- Si cambiaron, sus datos y fotografías se actualizan.
- La propiedad no se duplica.

Eliminar una carpeta no elimina automáticamente una propiedad existente. Para retirarla del catálogo, usa `status: "ARCHIVED"` o archívala desde el panel.

## Seguridad

El importador no extrae archivos al disco. Rechaza rutas absolutas, segmentos `..`, archivos que no sean imágenes reales y manifiestos JSON inválidos.
