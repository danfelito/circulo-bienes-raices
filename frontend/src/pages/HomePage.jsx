import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowRight, Building2, CheckCircle2, Globe2, Handshake, KeyRound, MapPin, ShieldCheck, Star, Users } from 'lucide-react';
import api from '../api';
import TestimonialsCarousel from '../components/TestimonialsCarousel';

const money = (value, currency = 'MXN') => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(value || 0);

const Hero = () => (
  <section className="relative min-h-[760px] overflow-hidden bg-slate-950 pt-[78px] text-white">
    <img
      src="https://images.unsplash.com/photo-1600585154340-be6161a56a0c?auto=format&fit=crop&w=2200&q=85"
      alt="Residencia contemporánea"
      className="absolute inset-0 h-full w-full object-cover opacity-55"
    />
    <div className="absolute inset-0 bg-gradient-to-r from-slate-950 via-slate-950/80 to-slate-950/25" />
    <div className="relative mx-auto flex min-h-[682px] max-w-7xl items-center px-4 py-20 sm:px-6 lg:px-8">
      <motion.div initial={{ opacity: 0, y: 24 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.7 }} className="max-w-3xl">
        <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-2 text-xs font-bold uppercase tracking-[0.18em] backdrop-blur">
          <MapPin size={15} className="text-red-400" /> Veracruz · México · Internacional
        </span>
        <h1 className="mt-7 text-5xl font-black leading-[0.98] tracking-[-0.045em] sm:text-6xl lg:text-7xl">
          Propiedades que conectan con tu siguiente etapa.
        </h1>
        <p className="mt-7 max-w-2xl text-lg leading-8 text-slate-200">
          Compra, vende o renta con acompañamiento profesional, información clara y una plataforma diseñada para mostrar cada propiedad con alto nivel visual.
        </p>
        <div className="mt-9 flex flex-col gap-3 sm:flex-row">
          <Link to="/propiedades" className="inline-flex items-center justify-center gap-2 rounded-full bg-[#d71920] px-7 py-3.5 font-bold text-white shadow-xl shadow-red-950/30 transition hover:bg-[#b91319]">
            Explorar propiedades <ArrowRight size={18} />
          </Link>
          <a
            href="https://circulo-inmobiliario.onrender.com/"
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 rounded-full border border-white/40 bg-white/10 px-7 py-3.5 font-bold text-white backdrop-blur transition hover:bg-white hover:text-slate-950"
          >
            Comenzar ahora <ArrowRight size={18} />
          </a>
        </div>
      </motion.div>
    </div>
  </section>
);

const FeaturedProperties = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFeatured().then(setProperties).catch(() => setProperties([])).finally(() => setLoading(false));
  }, []);

  return (
    <section className="bg-white py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-end">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.24em] text-[#d71920]">Selección destacada</span>
            <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Oportunidades para conocer hoy</h2>
            <p className="mt-3 text-slate-600">Publicaciones autorizadas desde el panel de asesores.</p>
          </div>
          <Link to="/propiedades" className="inline-flex items-center gap-2 font-bold text-[#d71920]">Ver catálogo completo <ArrowRight size={18} /></Link>
        </div>

        {loading ? (
          <div className="mt-10 grid gap-5 md:grid-cols-3">{[1, 2, 3].map((item) => <div key={item} className="h-96 animate-pulse rounded-3xl bg-slate-100" />)}</div>
        ) : properties.length ? (
          <div className="mt-10 grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            {properties.slice(0, 6).map((property, index) => {
              const cover = property.photos?.find((item) => item.mediaType !== 'video') || property.photos?.[0];
              return (
                <motion.article key={property.id} initial={{ opacity: 0, y: 18 }} whileInView={{ opacity: 1, y: 0 }} transition={{ delay: index * 0.06 }} viewport={{ once: true }} className="group overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm transition hover:-translate-y-1 hover:shadow-xl">
                  <Link to={`/propiedades/${property.slug}`}>
                    <div className="relative h-60 overflow-hidden bg-slate-100">
                      {cover?.url ? <img src={cover.url} alt={property.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" /> : <div className="grid h-full place-items-center text-slate-400"><Building2 size={42} /></div>}
                      <span className="absolute left-4 top-4 rounded-full bg-[#d71920] px-3 py-1.5 text-xs font-bold uppercase tracking-wider text-white">{property.operation}</span>
                      {property.featured && <span className="absolute right-4 top-4 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-xs font-bold text-slate-950"><Star size={13} fill="currentColor" /> Destacada</span>}
                    </div>
                    <div className="p-6">
                      <p className="text-sm font-semibold text-[#d71920]">{property.city}, {property.state}</p>
                      <h3 className="mt-2 text-xl font-black text-slate-950 transition group-hover:text-[#d71920]">{property.title}</h3>
                      <p className="mt-4 text-2xl font-black text-slate-950">{money(property.price, property.currency)}</p>
                      <div className="mt-4 flex flex-wrap gap-3 text-sm text-slate-600">
                        {property.bedrooms ? <span>{property.bedrooms} rec.</span> : null}
                        {property.bathrooms ? <span>{property.bathrooms} baños</span> : null}
                        {property.area ? <span>{property.area} m²</span> : null}
                      </div>
                    </div>
                  </Link>
                </motion.article>
              );
            })}
          </div>
        ) : (
          <div className="mt-10 rounded-3xl border border-dashed border-slate-300 p-10 text-center text-slate-600">Las propiedades destacadas aparecerán aquí cuando sean publicadas.</div>
        )}
      </div>
    </section>
  );
};

const Services = () => {
  const items = [
    { icon: KeyRound, title: 'Compra y renta', text: 'Búsqueda guiada y comparación de opciones con información útil para decidir.' },
    { icon: Building2, title: 'Promoción de propiedades', text: 'Fichas completas con fotografías, video, datos técnicos y contacto directo.' },
    { icon: ShieldCheck, title: 'Acompañamiento documental', text: 'Seguimiento ordenado del proceso y coordinación con las partes involucradas.' },
    { icon: Globe2, title: 'Operaciones internacionales', text: 'Conexión con compradores, propietarios y asesores en diferentes mercados.' },
  ];

  return (
    <section id="servicios" className="bg-slate-50 py-20">
      <div className="mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        <div className="max-w-3xl">
          <span className="text-xs font-bold uppercase tracking-[0.24em] text-[#d71920]">Servicios</span>
          <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Una experiencia inmobiliaria conectada de principio a fin</h2>
        </div>
        <div className="mt-10 grid gap-5 md:grid-cols-2 lg:grid-cols-4">
          {items.map(({ icon: Icon, title, text }) => (
            <article key={title} className="rounded-3xl border border-slate-200 bg-white p-7 shadow-sm">
              <div className="grid h-12 w-12 place-items-center rounded-2xl bg-red-50 text-[#d71920]"><Icon /></div>
              <h3 className="mt-5 text-lg font-black text-slate-950">{title}</h3>
              <p className="mt-3 text-sm leading-7 text-slate-600">{text}</p>
            </article>
          ))}
        </div>
      </div>
    </section>
  );
};

const About = () => (
  <section id="nosotros" className="bg-white py-20">
    <div className="mx-auto grid max-w-7xl items-center gap-12 px-4 sm:px-6 lg:grid-cols-2 lg:px-8">
      <div className="relative overflow-hidden rounded-[2rem]">
        <img src="https://images.unsplash.com/photo-1560518883-ce09059eeffa?auto=format&fit=crop&w=1400&q=85" alt="Asesoría inmobiliaria" className="h-[520px] w-full object-cover" />
        <div className="absolute bottom-5 left-5 right-5 rounded-2xl bg-white/95 p-5 shadow-xl backdrop-blur">
          <div className="grid grid-cols-3 gap-3 text-center">
            <div><p className="text-2xl font-black text-[#d71920]">360°</p><p className="text-xs text-slate-600">Acompañamiento</p></div>
            <div><p className="text-2xl font-black text-[#d71920]">24/7</p><p className="text-xs text-slate-600">Catálogo digital</p></div>
            <div><p className="text-2xl font-black text-[#d71920]">1</p><p className="text-xs text-slate-600">Flujo conectado</p></div>
          </div>
        </div>
      </div>
      <div>
        <span className="text-xs font-bold uppercase tracking-[0.24em] text-[#d71920]">Nosotros</span>
        <h2 className="mt-3 text-3xl font-black tracking-tight text-slate-950 sm:text-4xl">Tecnología y asesoría humana en una misma plataforma</h2>
        <p className="mt-6 text-lg leading-8 text-slate-600">Círculo Internacional de Bienes Raíces conecta el trabajo de los asesores con un catálogo público moderno. Cada propiedad se registra una sola vez y queda disponible para compradores e interesados.</p>
        <div className="mt-7 space-y-4">
          {['Asesores autorizados antes de publicar', 'Fotos, videos y detalles en una sola ficha', 'Búsqueda visual con mapa y filtros', 'Contacto directo y seguimiento comercial'].map((text) => (
            <p key={text} className="flex items-center gap-3 font-semibold text-slate-800"><CheckCircle2 className="text-[#d71920]" size={20} /> {text}</p>
          ))}
        </div>
        <Link to="/asesores" className="mt-8 inline-flex items-center gap-2 rounded-full bg-slate-950 px-7 py-3.5 font-bold text-white hover:bg-[#d71920]">Conocer el portal de asesores <ArrowRight size={18} /></Link>
      </div>
    </div>
  </section>
);

const Stats = () => (
  <section className="border-y border-slate-200 bg-white py-10">
    <div className="mx-auto grid max-w-7xl grid-cols-2 gap-6 px-4 text-center sm:px-6 md:grid-cols-4 lg:px-8">
      {[
        { icon: Users, value: 'Atención', label: 'personalizada' },
        { icon: Handshake, value: 'Proceso', label: 'transparente' },
        { icon: Globe2, value: 'Alcance', label: 'internacional' },
        { icon: ShieldCheck, value: 'Acceso', label: 'autorizado' },
      ].map(({ icon: Icon, value, label }) => (
        <div key={value} className="flex flex-col items-center"><Icon className="text-[#d71920]" /><p className="mt-2 text-xl font-black text-slate-950">{value}</p><p className="text-sm text-slate-500">{label}</p></div>
      ))}
    </div>
  </section>
);

const HomePage = () => (
  <main>
    <Hero />
    <Stats />
    <FeaturedProperties />
    <Services />
    <About />
    <TestimonialsCarousel />
  </main>
);

export default HomePage;
