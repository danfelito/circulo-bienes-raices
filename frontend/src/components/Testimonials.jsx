const testimonials = [
  { quote: 'Encontraron la casa de mis sueños en tiempo récord.', name: 'María González', role: 'Compradora - CDMX', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=200&q=80' },
  { quote: 'Vendí mi propiedad en menos de 30 días al precio que quería.', name: 'Carlos Mendoza', role: 'Vendedor - Guadalajara', image: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=200&q=80' },
  { quote: 'Como inversionista extranjero, necesité confianza y claridad.', name: 'Roberto Silva', role: 'Inversionista - Monterrey', image: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=200&q=80' },
];
export default function Testimonials() {
  return (
    <section className="py-32 px-6 lg:px-16 bg-black">
      <div className="text-center mb-16">
        <div className="liquid-glass rounded-full px-4 py-2 inline-block mb-6"><span className="text-xs font-medium text-white">Testimonios</span></div>
        <h2 className="text-4xl md:text-6xl font-heading italic text-white">Lo que dicen nuestros clientes</h2>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-3 gap-8 max-w-7xl mx-auto">
        {testimonials.map((t, i) => (
          <div key={i} className="liquid-glass rounded-2xl p-8">
            <div className="flex items-center gap-1 mb-6">
              {[...Array(5)].map((_, j) => (<svg key={j} className="w-5 h-5 text-yellow-500 fill-current" viewBox="0 0 20 20"><path d="M10 15l-5.878 3.09 1.123-6.545L.489 6.91l6.572-.955L10 0l2.939 5.955 6.572.955-4.756 4.635 1.123 6.545z" /></svg>))}
            </div>
            <p className="text-white/80 font-body font-light text-base italic mb-6">"{t.quote}"</p>
            <div className="flex items-center gap-4">
              <img src={t.image} alt={t.name} className="w-12 h-12 rounded-full object-cover" />
              <div><div className="text-white font-body font-medium text-sm">{t.name}</div><div className="text-white/50 font-body font-light text-xs">{t.role}</div></div>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
