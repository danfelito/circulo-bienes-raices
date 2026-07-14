import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Mail, MapPin, Phone } from 'lucide-react';
import BrandLogo from './BrandLogo';

const Footer = () => {
  const location = useLocation();
  if (location.pathname.startsWith('/admin')) return null;

  return (
    <footer id="contacto" className="border-t border-slate-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-10 px-4 py-14 sm:px-6 md:grid-cols-3 lg:px-8">
        <div>
          <BrandLogo />
          <p className="mt-5 max-w-sm text-sm leading-7 text-slate-600">
            Acompañamiento profesional para comprar, vender, rentar y promover propiedades en Veracruz y mercados internacionales.
          </p>
        </div>

        <div>
          <h3 className="font-bold text-slate-950">Navegación</h3>
          <div className="mt-4 grid gap-2 text-sm text-slate-600">
            <Link to="/propiedades" className="hover:text-[#d71920]">Propiedades</Link>
            <Link to="/asesores" className="hover:text-[#d71920]">Acceso para asesores</Link>
            <a href="/#servicios" className="hover:text-[#d71920]">Servicios</a>
            <Link to="/admin/login" className="hover:text-[#d71920]">Administración</Link>
          </div>
        </div>

        <div>
          <h3 className="font-bold text-slate-950">Contacto</h3>
          <div className="mt-4 space-y-3 text-sm text-slate-600">
            <p className="flex items-center gap-2"><MapPin size={16} className="text-[#d71920]" /> Veracruz, México</p>
            <p className="flex items-center gap-2"><Phone size={16} className="text-[#d71920]" /> +52 229 XXX XXXX</p>
            <a className="flex items-center gap-2 hover:text-[#d71920]" href="mailto:circulointernacionalveracruz1@gmail.com">
              <Mail size={16} className="text-[#d71920]" /> circulointernacionalveracruz1@gmail.com
            </a>
          </div>
        </div>
      </div>
      <div className="border-t border-slate-100 px-4 py-5 text-center text-xs text-slate-500">
        © {new Date().getFullYear()} Círculo Internacional de Bienes Raíces. Todos los derechos reservados.
      </div>
    </footer>
  );
};

export default Footer;
