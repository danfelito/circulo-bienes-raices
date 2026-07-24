import { Zap, Shield, Award, TrendingUp, Users, Clock } from 'lucide-react';
const features = [
  { icon: Zap, title: 'Respuesta Inmediata', description: 'Atención 24/7. Respondemos en menos de 2 horas.' },
  { icon: Shield, title: 'Transacción Segura', description: 'Todos los procesos con respaldo legal.' },
  { icon: Award, title: 'Agentes Certificados', description: 'Profesionales con certificaciones internacionales.' },
  { icon: TrendingUp, title: 'Valoración Precisa', description: 'Análisis de mercado para el mejor precio.' },
  { icon: Users, title: 'Red Internacional', description: 'Conexiones con inversionistas globales.' },
  { icon: Clock, title: 'Proceso Ágil', description: 'Cierre de operaciones en tiempo récord.' },
];
export default function FeaturesGrid() {
  return (
    <section id="nosotros" className="py-32 px-6 lg:px-16 bg-black">
      <div className="text-center mb-16">
        <div className="liquid-glass rounded-full px-4 py-2 inline-block mb-6"><span className="text-xs font-medium text-white">¿Por Qué Elegirnos?</span></div>
        <h2 className="text-4xl md:text-6xl font-heading italic text-white">La diferencia está en los detalles</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-7xl mx-auto">
        {features.map((f, i) => {
          const Icon = f.icon;
          return (
            <div key={i} className="liquid-glass rounded-2xl p-8 hover:bg-white/5 transition-colors">
              <div className="liquid-glass-strong rounded-full w-12 h-12 flex items-center justify-center mb-6"><Icon className="w-6 h-6 text-white" /></div>
              <h3 className="text-xl font-heading italic text-white mb-3">{f.title}</h3>
              <p className="text-white/60 font-body font-light text-sm">{f.description}</p>
            </div>
          );
        })}
      </div>
    </section>
  );
}
