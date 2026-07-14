import React, { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { AnimatePresence, motion } from 'framer-motion';
import { Menu, X, UserRound } from 'lucide-react';
import BrandLogo from './BrandLogo';

const links = [
  { href: '/', label: 'Inicio', route: true },
  { href: '/propiedades', label: 'Propiedades', route: true },
  { href: '/#servicios', label: 'Servicios' },
  { href: '/#nosotros', label: 'Nosotros' },
  { href: '/#contacto', label: 'Contacto' },
  { href: '/asesores', label: 'Asesores', route: true },
];

const Navbar = () => {
  const [open, setOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const isPrivatePanel = location.pathname.startsWith('/admin') || location.pathname.startsWith('/asesores/panel');

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    window.addEventListener('scroll', onScroll, { passive: true });
    return () => window.removeEventListener('scroll', onScroll);
  }, []);

  if (isPrivatePanel) return null;

  const isActive = (href) => {
    if (href === '/') return location.pathname === '/';
    return location.pathname.startsWith(href.split('#')[0]);
  };

  const itemClass = (href) => `relative text-[13px] font-semibold uppercase tracking-[0.08em] transition-colors ${
    isActive(href) ? 'text-[#d71920]' : 'text-slate-700 hover:text-[#d71920]'
  }`;

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      className={`fixed inset-x-0 top-0 z-50 border-b transition-all ${
        scrolled ? 'border-slate-200 bg-white/95 shadow-sm backdrop-blur-xl' : 'border-transparent bg-white/90 backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-[78px] max-w-[1500px] items-center justify-between gap-5 px-4 sm:px-6 lg:px-8">
        <BrandLogo compact />

        <nav className="hidden items-center gap-6 lg:flex" aria-label="Navegación principal">
          {links.map((item) => item.route ? (
            <Link key={item.href} to={item.href} className={itemClass(item.href)}>
              {item.label}
              {isActive(item.href) && <span className="absolute -bottom-2 left-0 h-0.5 w-full bg-[#d71920]" />}
            </Link>
          ) : (
            <a key={item.href} href={item.href} className={itemClass(item.href)}>
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden lg:block">
          <Link
            to="/asesores"
            className="inline-flex items-center gap-2 rounded-full bg-[#d71920] px-5 py-2.5 text-sm font-bold text-white shadow-sm transition hover:bg-[#b91319]"
          >
            <UserRound size={17} /> Publicar propiedad
          </Link>
        </div>

        <button
          type="button"
          aria-label={open ? 'Cerrar menú' : 'Abrir menú'}
          onClick={() => setOpen((value) => !value)}
          className="rounded-lg border border-slate-200 p-2 text-slate-800 lg:hidden"
        >
          {open ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      <AnimatePresence>
        {open && (
          <motion.nav
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="border-t border-slate-200 bg-white lg:hidden"
          >
            <div className="space-y-1 px-4 py-4">
              {links.map((item) => item.route ? (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-4 py-3 font-semibold text-slate-800 hover:bg-red-50 hover:text-[#d71920]"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setOpen(false)}
                  className="block rounded-lg px-4 py-3 font-semibold text-slate-800 hover:bg-red-50 hover:text-[#d71920]"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </motion.nav>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Navbar;
