import { MapPin, Phone, Mail } from 'lucide-react';
import BrandLogo from './BrandLogo';
export default function CtaFooter() {
  return (
    <section id="contacto" className="relative py-32 px-6 lg:px-16 overflow-hidden bg-gradient-to-b from-black to-gray-900">
      <div className="relative z-10 text-center max-w-4xl mx-auto mb-20">
        <h2 className="text-5xl md:text-7xl font-heading italic text-white mb-8">¿Listo para encontrar tu propiedad ideal?</h2>
        <p className="text-white/60 font-body font-light text-lg mb-12 max-w-2xl mx-auto">Agenda una consulta gratuita con nuestros expertos.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <button className="liquid-glass-strong rounded-full px-8 py-4 text-base font-medium">Agendar Consulta Gratis</button>
          <button className="bg-white text-black rounded-full px-8 py-4 text-base font-medium">Ver Propiedades</button>
        </div>
      </div>
      <footer className="relative z-10 border-t border-white/10 pt-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div>
              <BrandLogo />
              <p className="text-white/60 font-body font-light text-sm mb-6">Excelencia en bienes raíces internacionales desde 2009.</p>
            </div>
            <div>
              <h4 className="text-white font-body font-medium mb-6">Propiedades</h4>
              <ul className="space-y-3">{['Venta','Renta','Proyectos Nuevos','Propiedades de Lujo','Inversión'].map((i) => (<li key={i}><a href="#" className="text-white/60 text-sm hover:text-white">{i}</a></li>))}</ul>
            </div>
            <div>
              <h4 className="text-white font-body font-medium mb-6">Servicios</h4>
              <ul className="space-y-3">{['Valoración','Asesoría Legal','Administración','Consultoría','Inversión'].map((i) => (<li key={i}><a href="#" className="text-white/60 text-sm hover:text-white">{i}</a></li>))}</ul>
            </div>
            <div>
              <h4 className="text-white font-body font-medium mb-6">Contacto</h4>
              <ul className="space-y-4">
                <li className="flex items-start gap-3 text-white/60 text-sm"><MapPin className="w-5 h-5 flex-shrink-0" /><span>Av. Reforma 123, CDMX</span></li>
                <li className="flex items-center gap-3 text-white/60 text-sm"><Phone className="w-5 h-5 flex-shrink-0" /><span>+52 (55) 1234-5678</span></li>
                <li className="flex items-center gap-3 text-white/60 text-sm"><Mail className="w-5 h-5 flex-shrink-0" /><span>contacto@circulobienesraices.com</span></li>
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-white/40 text-xs">© 2026 Círculo Internacional Bienes Raíces®. Todos los derechos reservados.</div>
            <div className="flex items-center gap-6">{['Privacidad','Términos','Aviso Legal'].map((i) => (<a key={i} href="#" className="text-white/40 text-xs hover:text-white">{i}</a>))}</div>
          </div>
        </div>
      </footer>
    </section>
  );
}
