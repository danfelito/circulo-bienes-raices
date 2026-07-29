import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import BrandLogo from './BrandLogo';
import api from '../api';

const Footer = () => {
  const [config, setConfig] = useState({});

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => {});
  }, []);

  return (
    <footer className="bg-[#050505] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <BrandLogo />
            <p className="mt-5 text-gray-400 text-sm leading-relaxed">Tu agencia de bienes raíces de confianza. Conectamos personas con su propiedad ideal.</p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Navegación</h4>
            <div className="space-y-2">
              <Link to="/" className="block text-sm text-gray-400 hover:text-amber-400 transition-colors">Inicio</Link>
              <Link to="/propiedades" className="block text-sm text-gray-400 hover:text-amber-400 transition-colors">Propiedades</Link>
              <a href="/#servicios" className="block text-sm text-gray-400 hover:text-amber-400 transition-colors">Servicios</a>
              <Link to="/admin/login" className="block text-sm text-gray-400 hover:text-amber-400 transition-colors">Administración</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Contacto</h4>
            <div className="space-y-3">
              {config.contactAddress && <div className="flex items-start gap-2 text-sm text-gray-400"><MapPin size={14} className="mt-0.5" /> {config.contactAddress}</div>}
              {config.contactPhone && <a href={`tel:${config.contactPhone.replace(/[^+\d]/g, '')}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-amber-400"><Phone size={14} /> {config.contactPhone}</a>}
              {config.contactEmail && <a href={`mailto:${config.contactEmail}`} className="flex items-center gap-2 text-sm text-gray-400 hover:text-amber-400"><Mail size={14} /> {config.contactEmail}</a>}
              {!config.contactAddress && !config.contactPhone && !config.contactEmail && <p className="text-sm text-gray-500">Configura los datos de contacto en Render.</p>}
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-xs text-gray-500">© {new Date().getFullYear()} Círculo Internacional de Bienes Raíces. Todos los derechos reservados.</p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
