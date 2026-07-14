import React, { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Quote, Star } from 'lucide-react';
import { AnimatePresence, motion } from 'framer-motion';

const testimonials = [
  { name: 'Mariana López', city: 'Boca del Río, Veracruz', image: 'https://randomuser.me/api/portraits/women/44.jpg', text: 'Nos acompañaron desde la búsqueda hasta la firma. La comunicación fue clara y encontramos una casa que sí se ajustaba a nuestra familia.' },
  { name: 'Carlos Mendoza', city: 'Veracruz, Veracruz', image: 'https://randomuser.me/api/portraits/men/32.jpg', text: 'Publicaron mi propiedad con una presentación profesional y recibí prospectos mejor calificados desde las primeras semanas.' },
  { name: 'Valentina Rojas', city: 'Medellín, Colombia', image: 'https://randomuser.me/api/portraits/women/65.jpg', text: 'La asesoría internacional hizo mucho más sencillo entender documentos, tiempos y condiciones de la operación.' },
  { name: 'Santiago Herrera', city: 'Ciudad de México', image: 'https://randomuser.me/api/portraits/men/52.jpg', text: 'Me ayudaron a comparar opciones con datos y no con presión de venta. Eso marcó una gran diferencia.' },
  { name: 'Lucía Fernández', city: 'Xalapa, Veracruz', image: 'https://randomuser.me/api/portraits/women/68.jpg', text: 'El seguimiento fue constante y siempre tuve una respuesta concreta. La experiencia se sintió ordenada y segura.' },
  { name: 'Andrés Castillo', city: 'Bogotá, Colombia', image: 'https://randomuser.me/api/portraits/men/41.jpg', text: 'La ficha de la propiedad, las fotografías y la estrategia de difusión estuvieron muy por encima de lo que había probado antes.' },
  { name: 'Paola Ramírez', city: 'Riviera Veracruzana', image: 'https://randomuser.me/api/portraits/women/33.jpg', text: 'Encontramos una opción de renta en la zona que queríamos y con condiciones claras desde el inicio.' },
  { name: 'Diego Salazar', city: 'Puebla, Puebla', image: 'https://randomuser.me/api/portraits/men/46.jpg', text: 'El proceso de inversión fue explicado paso a paso. Agradecí especialmente la revisión de riesgos y documentos.' },
];

const TestimonialsCarousel = () => {
  const [index, setIndex] = useState(0);
  const visible = useMemo(() => {
    return [0, 1, 2].map((offset) => testimonials[(index + offset) % testimonials.length]);
  }, [index]);

  useEffect(() => {
    const timer = window.setInterval(() => setIndex((value) => (value + 1) % testimonials.length), 6500);
    return () => window.clearInterval(timer);
  }, []);

  return (
    <section className="bg-slate-950 py-20 text-white" aria-labelledby="testimonios-title">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-6 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.25em] text-red-400">Experiencias</span>
            <h2 id="testimonios-title" className="mt-3 text-3xl font-black tracking-tight sm:text-4xl">Historias de clientes</h2>
            <p className="mt-3 max-w-2xl text-slate-400">Ejemplos demostrativos del tipo de experiencia que la marca busca ofrecer.</p>
          </div>
          <div className="flex gap-2">
            <button onClick={() => setIndex((value) => (value - 1 + testimonials.length) % testimonials.length)} className="rounded-full border border-white/15 p-3 hover:bg-white/10" aria-label="Testimonios anteriores"><ChevronLeft /></button>
            <button onClick={() => setIndex((value) => (value + 1) % testimonials.length)} className="rounded-full border border-white/15 p-3 hover:bg-white/10" aria-label="Testimonios siguientes"><ChevronRight /></button>
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <AnimatePresence mode="popLayout">
            {visible.map((item) => (
              <motion.article
                layout
                key={`${item.name}-${index}`}
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -18 }}
                transition={{ duration: 0.35 }}
                className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 backdrop-blur"
              >
                <div className="flex items-center justify-between">
                  <div className="flex gap-0.5 text-red-400">{Array.from({ length: 5 }, (_, i) => <Star key={i} size={15} fill="currentColor" />)}</div>
                  <Quote className="text-white/20" size={30} />
                </div>
                <p className="mt-5 min-h-[120px] text-sm leading-7 text-slate-200">“{item.text}”</p>
                <div className="mt-6 flex items-center gap-3 border-t border-white/10 pt-5">
                  <img src={item.image} alt="" className="h-12 w-12 rounded-full object-cover" loading="lazy" />
                  <div>
                    <p className="font-bold">{item.name}</p>
                    <p className="text-xs text-slate-400">{item.city}</p>
                  </div>
                </div>
              </motion.article>
            ))}
          </AnimatePresence>
        </div>

        <div className="mt-8 flex justify-center gap-2">
          {testimonials.map((item, dotIndex) => (
            <button
              key={item.name}
              onClick={() => setIndex(dotIndex)}
              aria-label={`Mostrar testimonio ${dotIndex + 1}`}
              className={`h-2 rounded-full transition-all ${dotIndex === index ? 'w-8 bg-[#d71920]' : 'w-2 bg-white/25'}`}
            />
          ))}
        </div>
      </div>
    </section>
  );
};

export default TestimonialsCarousel;
