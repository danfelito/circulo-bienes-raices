import { ArrowUpRight } from 'lucide-react';
const features = [
  { title: 'Propiedades Exclusivas', description: 'Acceso a las propiedades más exclusivas del mercado.', image: 'https://images.unsplash.com/photo-1613490493576-7fde63acd811?w=800&q=80', stats: '+500 propiedades' },
  { title: 'Asesoría Expert', description: 'Agentes certificados con experiencia internacional.', image: 'https://images.unsplash.com/photo-1560518883-ce09059eeffa?w=800&q=80', stats: '98% satisfacción' },
  { title: 'Proceso Simplificado', description: 'Gestionamos todo: visitas, documentación y cierre.', image: 'https://images.unsplash.com/photo-1450101499163-c8848c66ca85?w=800&q=80', stats: '30 días promedio' },
];
export default function FeaturesChess() {
  return (
    <section className="py-32 px-6 lg:px-16 bg-black">
      <div className="text-center mb-20">
        <div className="liquid-glass rounded-full px-4 py-2 inline-block mb-6"><span className="text-xs font-medium text-white">Nuestros Servicios</span></div>
        <h2 className="text-4xl md:text-6xl font-heading italic text-white">Excelencia en cada detalle</h2>
      </div>
      <div className="space-y-24">
        {features.map((f, i) => (
          <div key={i} className={`flex flex-col ${i % 2 === 1 ? 'lg:flex-row-reverse' : 'lg:flex-row'} items-center gap-12`}>
            <div className="flex-1"><div className="liquid-glass rounded-2xl overflow-hidden"><img src={f.image} alt={f.title} className="w-full h-[400px] object-cover" /></div></div>
            <div className="flex-1">
              <h3 className="text-3xl md:text-4xl font-heading italic text-white mb-6">{f.title}</h3>
              <p className="text-white/60 font-body font-light text-base mb-6">{f.description}</p>
              <div className="liquid-glass rounded-full px-4 py-2 inline-block mb-6"><span className="text-sm text-white">{f.stats}</span></div><br />
              <button className="liquid-glass-strong rounded-full px-6 py-3 text-sm font-medium inline-flex items-center gap-2">Saber Más <ArrowUpRight className="w-4 h-4" /></button>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
