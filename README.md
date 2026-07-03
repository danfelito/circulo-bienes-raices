# Círculo Internacional Bienes Raíces

Landing page premium para agencia de bienes raíces internacional.

## Características
- ✅ Diseño glassmorphism premium
- ✅ Mapas con Leaflet (OpenStreetMap - gratuito)
- ✅ Animaciones con Framer Motion
- ✅ Responsive mobile-first
- ✅ Dark mode por defecto

## Instalación
```bash
cd frontend
npm install
npm run dev
```

## Scripts
- `npm run dev` - Servidor de desarrollo
- `npm run build` - Build para producción
- `npm run preview` - Preview del build

## Estructura
```
frontend/
├── src/
│   ├── components/
│   │   ├── Hero.jsx           - Hero section principal
│   │   ├── Navbar.jsx         - Navegación responsive
│   │   ├── PropertiesPage.jsx - Catálogo de propiedades
│   │   ├── FeaturesGrid.jsx   - Características en grid
│   │   ├── FeaturesChess.jsx  - Servicios en formato alternado
│   │   ├── Stats.jsx          - Estadísticas
│   │   ├── Testimonials.jsx   - Testimonios
│   │   ├── CtaFooter.jsx      - Call to action + footer
│   │   ├── BlurText.jsx       - Animación de texto
│   │   └── maps/MapProperty.jsx - Mapa con Leaflet
│   ├── App.jsx
│   └── main.jsx
├── index.html
└── package.json
```

## Despliegue
El build genera una carpeta `dist/` estática. Puedes servirla con:
- Vercel, Netlify, Render (static), o cualquier hosting estático
- El backend está en desarrollo separado