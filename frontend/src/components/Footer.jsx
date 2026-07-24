import React from 'react';
import { Link } from 'react-router-dom';
import { MapPin, Phone, Mail } from 'lucide-react';
import BrandLogo from './BrandLogo';

const Footer = () => {
  return (
    <footer className="bg-[#050505] border-t border-white/5">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-8">
          <div>
            <BrandLogo />
            <p className="mt-5 text-gray-400 text-sm leading-relaxed">
              Tu agencia de bienes raíces de confianza en Veracruz, México. Conectamos personas con su hogar ideal.
            </p>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Navegación</h4>
            <div className="space-y-2">
              <Link to="/" className="block text-sm text-gray-400 hover:text-amber-400 transition-colors">Inicio</Link>
              <Link to="/propiedades" className="block text-sm text-gray-400 hover:text-amber-400 transition-colors">Propiedades</Link>
              <Link to="/admin/login" className="block text-sm text-gray-400 hover:text-amber-400 transition-colors">Admin</Link>
            </div>
          </div>
          <div>
            <h4 className="text-sm font-semibold text-white mb-4">Contacto</h4>
            <div className="space-y-2">
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <MapPin size={14} /> Veracruz, México
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Phone size={14} /> +52 229 XXX XXXX
              </div>
              <div className="flex items-center gap-2 text-sm text-gray-400">
                <Mail size={14} /> info@circulobienesraices.com
              </div>
            </div>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-white/5 text-center">
          <p className="text-xs text-gray-500">
            © {new Date().getFullYear()} Círculo Internacional de Bienes Raíces. Todos los derechos reservados.
          </p>
        </div>
      </div>
    </footer>
  );
};

export default Footer;
