import { ArrowUpRight } from 'lucide-react';
export default function StartSection() {
  return (
    <section className="relative w-full min-h-[600px] flex items-center justify-center overflow-hidden py-32 px-6">
      <div className="absolute inset-0 z-0">
        <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1600607687939-ce8a6c25118c?w=1920&q=80')] bg-cover bg-center opacity-20" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
      </div>
      <div className="relative z-10 text-center max-w-4xl">
        <div className="liquid-glass rounded-full px-4 py-2 inline-block mb-8"><span className="text-xs font-medium text-white">Cómo Funciona</span></div>
        <h2 className="text-4xl md:text-6xl lg:text-7xl font-heading italic text-white mb-8">Tu sueño, nuestra misión</h2>
        <p className="text-white/60 font-body font-light text-lg mb-12 max-w-2xl mx-auto">Desde la búsqueda hasta la entrega de llaves. Te acompañamos en cada paso.</p>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-12">
          {[{n:'1',t:'Cuéntanos',d:'Tus necesidades'},{n:'2',t:'Buscamos',d:'Las mejores opciones'},{n:'3',t:'Concretamos',d:'Tu propiedad ideal'}].map((s) => (
            <div key={s.n} className="text-center">
              <div className="liquid-glass-strong rounded-full w-16 h-16 flex items-center justify-center mx-auto mb-4"><span className="text-2xl font-heading italic">{s.n}</span></div>
              <h3 className="text-white font-body font-medium mb-2">{s.t}</h3><p className="text-white/60 text-sm">{s.d}</p>
            </div>
          ))}
        </div>
        <button className="liquid-glass-strong rounded-full px-8 py-3.5 text-sm font-medium inline-flex items-center gap-2">Comenzar Ahora <ArrowUpRight className="w-4 h-4" /></button>
      </div>
    </section>
  );
}
