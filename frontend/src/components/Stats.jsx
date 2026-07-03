const stats = [
  { value: '15+', label: 'Años de experiencia' },
  { value: '2,500+', label: 'Propiedades vendidas' },
  { value: '98%', label: 'Clientes satisfechos' },
  { value: '12', label: 'Países con presencia' },
];
export default function Stats() {
  return (
    <section className="relative py-32 px-6 lg:px-16 overflow-hidden">
      <div className="absolute inset-0 z-0">
        <div className="w-full h-full bg-[url('https://images.unsplash.com/photo-1486406146926-c627a92ad1ab?w=1920&q=80')] bg-cover bg-center opacity-10" />
        <div className="absolute inset-0 bg-gradient-to-b from-black via-transparent to-black" />
      </div>
      <div className="relative z-10 liquid-glass rounded-3xl p-12 md:p-20 max-w-6xl mx-auto">
        <div className="grid grid-cols-2 md:grid-cols-4 gap-8">
          {stats.map((s, i) => (
            <div key={i} className="text-center">
              <div className="text-5xl md:text-6xl lg:text-7xl font-heading italic text-white mb-3">{s.value}</div>
              <div className="text-white/60 font-body font-light text-sm">{s.label}</div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
