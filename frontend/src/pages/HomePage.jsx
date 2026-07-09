import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Building2, TrendingUp, Users, Globe, ArrowRight, Star } from 'lucide-react';
import api from '../api';

const Hero = () => {
  return (
    <section className="relative min-h-screen flex items-center justify-center overflow-hidden">
      {/* Background */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#0a0a0a] via-[#111] to-[#0a0a0a]" />
      <div className="absolute inset-0 opacity-20"
        style={{
          backgroundImage: 'radial-gradient(circle at 25% 50%, rgba(217, 119, 6, 0.15) 0%, transparent 50%), radial-gradient(circle at 75% 50%, rgba(217, 119, 6, 0.1) 0%, transparent 50%)',
        }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 text-center">
        <motion.div initial={{ opacity: 0, y: 30 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.8 }}>
          <span className="inline-block px-4 py-1.5 bg-amber-400/10 border border-amber-400/20 rounded-full text-amber-400 text-xs font-medium mb-6">
            🏠 Bienes Raíces en Veracruz
          </span>
          <h1 className="text-4xl sm:text-5xl md:text-7xl font-bold text-white mb-6 leading-tight">
            Encuentra tu <span className="bg-gradient-to-r from-amber-400 to-amber-600 bg-clip-text text-transparent">hogar ideal</span>
          </h1>
          <p className="text-lg text-gray-400 max-w-2xl mx-auto mb-8">
            En Círculo Internacional de Bienes Raíces te ayudamos a encontrar la propiedad perfecta en Veracruz. Casas, departamentos, terrenos y más.
          </p>
          <div className="flex flex-col sm:flex-row gap-4 justify-center">
            <Link
              to="/propiedades"
              className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all shadow-lg shadow-amber-500/25"
            >
              Ver Propiedades <ArrowRight size={18} />
            </Link>
            <a
              href="https://wa.me/522291234567"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 px-8 py-3 bg-white/5 border border-white/10 text-white font-medium rounded-lg hover:bg-white/10 transition-all"
            >
              📞 Contactar por WhatsApp
            </a>
          </div>
        </motion.div>
      </div>
    </section>
  );
};

const Stats = () => {
  const [stats, setStats] = useState({ properties: 0, cities: 0, years: 15 });
  const items = [
    { icon: Building2, label: 'Propiedades', value: stats.properties || '50+' },
    { icon: TrendingUp, label: 'Ventas Exitosas', value: '200+' },
    { icon: Users, label: 'Clientes Satisfechos', value: '500+' },
    { icon: Globe, label: 'Ciudades', value: stats.cities || '10+' },
  ];

  return (
    <section className="py-16 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 grid grid-cols-2 md:grid-cols-4 gap-6">
        {items.map(({ icon: Icon, label, value }, i) => (
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 20 }}
            whileInView={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.1 }}
            className="text-center p-6 bg-white/5 rounded-2xl border border-white/5"
          >
            <Icon className="mx-auto mb-3 text-amber-400" size={28} />
            <p className="text-2xl font-bold text-white">{value}</p>
            <p className="text-sm text-gray-400">{label}</p>
          </motion.div>
        ))}
      </div>
    </section>
  );
};

const FeaturedProperties = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getFeatured()
      .then(data => setProperties(data))
      .catch(console.error)
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <section className="py-16 bg-[#0a0a0a]">
        <div className="max-w-7xl mx-auto px-4 text-center text-gray-500">Cargando propiedades destacadas...</div>
      </section>
    );
  }

  if (properties.length === 0) {
    return null;
  }

  return (
    <section className="py-16 bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Propiedades Destacadas</h2>
          <p className="text-gray-400">Las mejores oportunidades inmobiliarias en Veracruz</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {properties.map((prop, i) => (
            <motion.div
              key={prop.id}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
            >
              <Link to={`/propiedades/${prop.slug}`} className="block group">
                <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden hover:border-amber-400/30 transition-all">
                  <div className="relative h-48 overflow-hidden">
                    <img
                      src={prop.photos?.[0]?.url || '/images/placeholder.jpg'}
                      alt={prop.title}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                    />
                    {prop.featured && (
                      <span className="absolute top-3 left-3 px-2 py-1 bg-amber-400 text-black text-xs font-bold rounded flex items-center gap-1">
                        <Star size={12} /> Destacada
                      </span>
                    )}
                    <span className="absolute top-3 right-3 px-2 py-1 bg-black/70 text-white text-xs rounded">
                      {prop.operation === 'venta' ? 'Venta' : 'Renta'}
                    </span>
                  </div>
                  <div className="p-4">
                    <h3 className="font-semibold text-white mb-1 group-hover:text-amber-400 transition-colors">{prop.title}</h3>
                    <p className="text-sm text-gray-400 mb-3">{prop.city}, {prop.state}</p>
                    <div className="flex items-center justify-between">
                      <span className="text-lg font-bold text-amber-400">
                        {prop.operation === 'renta' ? `$${prop.price.toLocaleString()}/mes` : `$${prop.price.toLocaleString()}`}
                      </span>
                      <span className="text-xs text-gray-500">{prop.type}</span>
                    </div>
                    {(prop.bedrooms || prop.bathrooms || prop.area) && (
                      <div className="flex gap-3 mt-3 text-xs text-gray-400">
                        {prop.bedrooms && <span>{prop.bedrooms} rec</span>}
                        {prop.bathrooms && <span>{prop.bathrooms} baños</span>}
                        {prop.area && <span>{prop.area} m²</span>}
                      </div>
                    )}
                  </div>
                </div>
              </Link>
            </motion.div>
          ))}
        </div>
        <div className="text-center mt-8">
          <Link
            to="/propiedades"
            className="inline-flex items-center gap-2 px-6 py-3 bg-amber-400/10 border border-amber-400/20 text-amber-400 rounded-lg hover:bg-amber-400/20 transition-all"
          >
            Ver todas las propiedades <ArrowRight size={16} />
          </Link>
        </div>
      </div>
    </section>
  );
};

const Services = () => {
  const services = [
    { title: 'Venta de Propiedades', desc: 'Amplio catálogo de casas, departamentos y terrenos en las mejores ubicaciones de Veracruz.', icon: '🏠' },
    { title: 'Renta de Inmuebles', desc: 'Opciones de renta para oficinas, locales comerciales y residencias con contratos flexibles.', icon: '🔑' },
    { title: 'Asesoría Inmobiliaria', desc: 'Asesoría profesional para tomar la mejor decisión en tu inversión inmobiliaria.', icon: '📊' },
    { title: 'Gestión de Propiedades', desc: 'Administración y mantenimiento de tu propiedad mientras generas ingresos.', icon: '📋' },
  ];

  return (
    <section className="py-16 bg-[#080808]">
      <div className="max-w-7xl mx-auto px-4">
        <div className="text-center mb-12">
          <h2 className="text-3xl font-bold text-white mb-4">Nuestros Servicios</h2>
          <p className="text-gray-400">Soluciones inmobiliarias integrales</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          {services.map(({ title, desc, icon }, i) => (
            <motion.div
              key={title}
              initial={{ opacity: 0, y: 20 }}
              whileInView={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.1 }}
              className="p-6 bg-white/5 rounded-2xl border border-white/5 hover:border-amber-400/20 transition-all"
            >
              <span className="text-3xl mb-4 block">{icon}</span>
              <h3 className="font-semibold text-white mb-2">{title}</h3>
              <p className="text-sm text-gray-400 leading-relaxed">{desc}</p>
            </motion.div>
          ))}
        </div>
      </div>
    </section>
  );
};

const CTA = () => (
  <section className="py-16 bg-gradient-to-r from-amber-500/5 to-amber-600/5">
    <div className="max-w-4xl mx-auto px-4 text-center">
      <h2 className="text-3xl font-bold text-white mb-4">¿Listo para encontrar tu hogar?</h2>
      <p className="text-gray-400 mb-8">Contáctanos y te ayudaremos a encontrar la propiedad perfecta.</p>
      <div className="flex flex-col sm:flex-row gap-4 justify-center">
        <Link
          to="/propiedades"
          className="inline-flex items-center gap-2 px-8 py-3 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all"
        >
          Explorar Propiedades
        </Link>
        <a
          href="https://wa.me/522291234567"
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-2 px-8 py-3 bg-green-600 text-white font-semibold rounded-lg hover:bg-green-700 transition-all"
        >
          📱 WhatsApp
        </a>
      </div>
    </div>
  </section>
);

const HomePage = () => {
  return (
    <main>
      <Hero />
      <Stats />
      <FeaturedProperties />
      <Services />
      <CTA />
    </main>
  );
};

export default HomePage;
