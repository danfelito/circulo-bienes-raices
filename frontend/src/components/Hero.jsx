import { motion } from 'framer-motion';
import { ArrowUpRight, Play, MapPin, Home } from 'lucide-react';
import BlurText from './BlurText';

export default function Hero() {
  return (
    <section className="relative overflow-visible min-h-screen pt-20">
      <div className="absolute inset-0 z-0">
        <div className="absolute inset-0 bg-gradient-to-br from-red-900/20 via-black to-black z-10" />
        <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1600596542815-ffad4c1539a9?w=1920&q=80')] bg-cover bg-center opacity-40" />
      </div>
      <div className="absolute bottom-0 w-full h-[300px] z-0" style={{ background: 'linear-gradient(to bottom, transparent, black)' }} />
      <div className="relative z-10 flex flex-col items-center text-center px-6 pt-32 pb-20 min-h-screen">
        <div className="liquid-glass rounded-full px-4 py-2 flex items-center gap-2 mb-8">
          <span className="bg-red-600 text-white rounded-full px-3 py-1 text-xs font-semibold">Premium</span>
          <span className="text-sm text-white font-body">Propiedades Exclusivas en Latinoamérica</span>
        </div>
        <h1 className="text-5xl md:text-7xl lg:text-8xl font-heading italic text-white leading-[0.85] max-w-4xl tracking-[-2px] mb-6">
          <BlurText text="Encuentra tu Propiedad Ideal" delay={100} direction="bottom" />
        </h1>
        <motion.p initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }} animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 0.8 }} className="text-lg md:text-xl text-white/70 font-body font-light max-w-2xl mb-10">
          Excelencia en bienes raíces internacionales. Conectamos propiedades excepcionales con clientes exigentes.
        </motion.p>
        <motion.div initial={{ filter: 'blur(10px)', opacity: 0, y: 20 }} animate={{ filter: 'blur(0px)', opacity: 1, y: 0 }} transition={{ duration: 0.6, delay: 1.1 }} className="flex flex-col sm:flex-row items-center gap-4 mb-16">
          <button className="liquid-glass-strong rounded-full px-8 py-3.5 flex items-center gap-2 text-sm font-medium">Ver Propiedades <ArrowUpRight className="w-4 h-4" /></button>
          <button className="flex items-center gap-2 text-sm font-medium text-white"><Play className="w-4 h-4 fill-white" /> Conoce Nuestros Servicios</button>
        </motion.div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 max-w-4xl w-full mb-16">
          <div className="liquid-glass rounded-2xl p-6 text-center"><Home className="w-8 h-8 text-white mx-auto mb-3" /><h3 className="text-white font-body font-medium mb-1">+500 Propiedades</h3><p className="text-white/60 text-sm">Disponibles exclusivamente</p></div>
          <div className="liquid-glass rounded-2xl p-6 text-center"><MapPin className="w-8 h-8 text-white mx-auto mb-3" /><h3 className="text-white font-body font-medium mb-1">Cobertura Total</h3><p className="text-white/60 text-sm">México y Latinoamérica</p></div>
          <div className="liquid-glass rounded-2xl p-6 text-center"><div className="w-8 h-8 mx-auto mb-3 rounded-full bg-red-600 flex items-center justify-center"><span className="text-white font-bold text-xs">CI</span></div><h3 className="text-white font-body font-medium mb-1">Certificados</h3><p className="text-white/60 text-sm">Expertos internacionales</p></div>
        </div>
      </div>
    </section>
  );
}