import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import BrandLogo from './BrandLogo';
import api from '../api';

const propertyLinks = ['Venta', 'Renta', 'Proyectos Nuevos', 'Propiedades de Lujo', 'Inversión'];
const serviceLinks = ['Valoración', 'Asesoría Legal', 'Administración', 'Consultoría', 'Inversión'];

export default function CtaFooter() {
  const [config, setConfig] = useState({});

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => {});
  }, []);

  const emailHref = config.contactEmail
    ? `mailto:${config.contactEmail}?subject=${encodeURIComponent('Consulta inmobiliaria')}`
    : '/propiedades';

  return (
    <section id="contacto" className="relative py-32 px-6 lg:px-16 overflow-hidden bg-gradient-to-b from-black to-gray-900">
      <div className="relative z-10 text-center max-w-4xl mx-auto mb-20">
        <h2 className="text-5xl md:text-7xl font-heading italic text-white mb-8">¿Listo para encontrar tu propiedad ideal?</h2>
        <p className="text-white/60 font-body font-light text-lg mb-12 max-w-2xl mx-auto">Agenda una consulta con nuestros expertos.</p>
        <div className="flex flex-col sm:flex-row items-center justify-center gap-4">
          <a href={emailHref} className="liquid-glass-strong rounded-full px-8 py-4 text-base font-medium">Agendar Consulta</a>
          <Link to="/propiedades" className="bg-white text-black rounded-full px-8 py-4 text-base font-medium">Ver Propiedades</Link>
        </div>
      </div>

      <footer className="relative z-10 border-t border-white/10 pt-16">
        <div className="max-w-7xl mx-auto">
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-12 mb-12">
            <div>
              <BrandLogo />
              <p className="text-white/60 font-body font-light text-sm mb-6 mt-5">Excelencia en bienes raíces internacionales.</p>
            </div>
            <div>
              <h4 className="text-white font-body font-medium mb-6">Propiedades</h4>
              <ul className="space-y-3">
                {propertyLinks.map(item => <li key={item}><Link to="/propiedades" className="text-white/60 text-sm hover:text-white">{item}</Link></li>)}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-body font-medium mb-6">Servicios</h4>
              <ul className="space-y-3">
                {serviceLinks.map(item => <li key={item}><a href="#servicios" className="text-white/60 text-sm hover:text-white">{item}</a></li>)}
              </ul>
            </div>
            <div>
              <h4 className="text-white font-body font-medium mb-6">Contacto</h4>
              <ul className="space-y-4">
                {config.contactAddress && <li className="flex items-start gap-3 text-white/60 text-sm"><MapPin className="w-5 h-5 flex-shrink-0" /><span>{config.contactAddress}</span></li>}
                {config.contactPhone && <li><a href={`tel:${config.contactPhone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-3 text-white/60 text-sm hover:text-white"><Phone className="w-5 h-5 flex-shrink-0" /><span>{config.contactPhone}</span></a></li>}
                {config.contactEmail && <li><a href={`mailto:${config.contactEmail}`} className="flex items-center gap-3 text-white/60 text-sm hover:text-white"><Mail className="w-5 h-5 flex-shrink-0" /><span>{config.contactEmail}</span></a></li>}
                {!config.contactAddress && !config.contactPhone && !config.contactEmail && <li className="text-white/50 text-sm">Datos de contacto pendientes de configurar en Render.</li>}
              </ul>
            </div>
          </div>
          <div className="pt-8 border-t border-white/10 flex flex-col md:flex-row items-center justify-between gap-4">
            <div className="text-white/40 text-xs">© {new Date().getFullYear()} Círculo Internacional Bienes Raíces®. Todos los derechos reservados.</div>
            <div className="text-white/40 text-xs">Documentación legal pendiente de publicación.</div>
          </div>
        </div>
      </footer>
    </section>
  );
}
