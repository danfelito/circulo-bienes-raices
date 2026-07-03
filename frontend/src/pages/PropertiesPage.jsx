import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, ChevronLeft, ChevronRight, MapPin, BedDouble, Bath, Square } from 'lucide-react';

// Mock data para la previsualización
const MOCK_PROPERTIES = [
  {
    id: 'prop-1',
    title: 'Residencia Contemporánea Vista Real',
    price: '$450,000 USD',
    location: 'Zona Norte, Ciudad de México',
    beds: 4,
    baths: 3,
    sqft: '320 m²',
    images: [
      'https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600607687920-4f2850403751?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1600566753086-0d6545C212a6?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Una joya arquitectónica con acabados de mármol y vistas panorámicas.'
  },
  {
    id: 'prop-2',
    title: 'Penthouse Minimalista Centro',
    price: '$280,000 USD',
    location: 'Polanco, CDMX',
    beds: 2,
    baths: 2,
    sqft: '150 m²',
    images: [
      'https://images.unsplash.com/photo-1512917774080-9a8e3c369925?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1493809501603-38d417753ec3?auto=format&fit=crop&w=800&q=80',
      'https://images.unsplash.com/photo-1560448204-603b3bia?auto=format&fit=crop&w=800&q=80'
    ],
    description: 'Espacios abiertos y luz natural en el corazón de la ciudad.'
  }
];

const ImageGallery = ({ images }) => {
  const [currentIdx, setCurrentIdx] = useState(0);
  const [isOpen, setIsOpen] = useState(false);

  return (
    <>
      <div 
        className="relative aspect-[4/3] overflow-hidden rounded-xl cursor-pointer group"
        onClick={() => setIsOpen(true)}
      >
        <img 
          src={images[0]} 
          alt="Propiedad" 
          className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-110" 
        />
        <div className="absolute bottom-3 right-3 bg-black/60 text-white text-xs px-2 py-1 rounded-full backdrop-blur-md">
          {images.length} fotos
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div 
            initial={{ opacity: 0 }} 
            animate={{ opacity: 1 }} 
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[100] bg-black/95 backdrop-blur-xl flex items-center justify-center p-4 md:p-10"
          >
            <button 
              onClick={() => setIsOpen(false)} 
              className="absolute top-6 right-6 text-white p-2 hover:bg-white/10 rounded-full transition-colors"
            >
              <X size={32} />
            </button>

            <div className="relative max-w-5xl w-full h-full flex items-center justify-center">
              <button 
                onClick={() => setCurrentIdx((prev) => (prev === 0 ? images.length - 1 : prev - 1))}
                className="absolute left-0 z-10 p-4 text-white hover:bg-white/10 rounded-full transition-all"
              >
                <ChevronLeft size={48} />
              </button>

              <motion.img 
                key={currentIdx}
                initial={{ opacity: 0, x: 20 }}
                animate={{ opacity: 1, x: 0 }}
                src={images[currentIdx]} 
                className="max-h-[80vh] max-w-full object-contain rounded-lg shadow-2xl" 
              />

              <button 
                onClick={() => setCurrentIdx((prev) => (prev === images.length - 1 ? 0 : prev + 1))}
                className="absolute right-0 z-10 p-4 text-white hover:bg-white/10 rounded-full transition-all"
              >
                <ChevronRight size={48} />
              </button>

              <div className="absolute bottom-10 left-1/2 -translate-x-1/2 flex gap-2">
                {images.map((_, i) => (
                  <div 
                    key={i} 
                    className={`h-2 rounded-full transition-all ${i === currentIdx ? 'w-8 bg-white' : 'w-2 bg-white/30'}`}
                  />
                ))}
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
};

const PropertyCard = ({ prop }) => {
  return (
    <motion.div 
      whileHover={{ y: -10 }}
      className="bg-[#111] border border-white/10 rounded-3xl overflow-hidden hover:border-white/30 transition-colors group"
    >
      <ImageGallery images={prop.images} />
      <div className="p-6">
        <div className="flex justify-between items-start mb-4">
          <h3 className="text-xl font-bold text-white group-hover:text-gray-300 transition-colors">{prop.title}</h3>
          <span className="text-yellow-500 font-semibold">{prop.price}</span>
        </div>
        
        <div className="flex flex-wrap gap-4 mb-6 text-gray-400 text-sm">
          <div className="flex items-center gap-1"><BedDouble size={16} /> {prop.beds} Recámaras</div>
          <div className="flex items-center gap-1"><Bath size={16} /> {prop.baths} Baños</div>
          <div className="flex items-center gap-1"><Square size={16} /> {prop.sqft}</div>
        </div>

        <div className="flex items-center gap-2 text-gray-500 text-xs mb-6">
          <MapPin size={14} /> {prop.location}
        </div>

        <button className="w-full py-3 rounded-xl bg-white text-black font-bold hover:bg-gray-200 transition-all active:scale-95">
          Ver Detalles
        </button>
      </div>
    </motion.div>
  );
};

const PropertiesPage = () => {
  return (
    <div className="min-h-screen bg-black text-white pt-24 pb-20 px-6 md:px-12">
      <div className="max-w-7xl mx-auto">
        <header className="mb-12 text-center md:text-left">
          <h1 className="text-4xl md:text-6xl font-bold mb-4">Catálogo de <span className="text-yellow-500">Propiedades</span></h1>
          <p className="text-gray-400 max-w-2xl">Encuentra la residencia que se adapte a tu estilo de vida. Seleccionamos solo las propiedades más exclusivas del mercado.</p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
          {MOCK_PROPERTIES.map(prop => (
            <PropertyCard key={prop.id} prop={prop} />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PropertiesPage;
