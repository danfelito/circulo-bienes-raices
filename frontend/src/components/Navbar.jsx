import React, { useState, useEffect } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion';
import { ArrowUpRight, Menu, Moon, Sun, X } from 'lucide-react';
import BrandLogo from './BrandLogo';
import { useTheme } from '../theme/ThemeContext';

const Navbar = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const location = useLocation();
  const { theme, toggleTheme } = useTheme();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 12);
    window.addEventListener('scroll', handleScroll);
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  const navLinks = [
    { to: '/', label: 'Inicio', route: true },
    { to: '/propiedades', label: 'Propiedades', route: true },
    { to: '/#servicios', label: 'Servicios' },
    { to: '/#nosotros', label: 'Nosotros' },
    { to: '/#contacto', label: 'Contacto' },
    {
      to: 'https://circulo-inmobiliario.onrender.com/',
      label: 'Buscador inteligente ↗',
      external: true,
    },
  ];

  return (
    <motion.header
      initial={{ y: -80 }}
      animate={{ y: 0 }}
      className={`site-nav fixed inset-x-0 top-0 z-50 border-b transition-all duration-300 ${
        scrolled ? 'site-nav-scrolled shadow-lg backdrop-blur-xl' : 'backdrop-blur-md'
      }`}
    >
      <div className="mx-auto flex h-[82px] max-w-[1500px] items-center justify-between gap-4 px-4 sm:px-6 lg:px-10">
        <BrandLogo compact />

        <nav className="hidden items-center gap-1 lg:flex" aria-label="Navegación principal">
          {navLinks.map((item) => item.route ? (
            <Link key={item.to} to={item.to} className={`nav-link px-3 py-2 text-sm font-semibold transition-colors ${location.pathname === item.to ? 'nav-link-active' : ''}`}>
              {item.label}
            </Link>
          ) : (
            <a
              key={item.to}
              href={item.to}
              className="nav-link px-3 py-2 text-sm font-semibold transition-colors"
              target={item.external ? '_blank' : undefined}
              rel={item.external ? 'noreferrer' : undefined}
            >
              {item.label}
            </a>
          ))}
        </nav>

        <div className="hidden items-center gap-2 lg:flex">
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label={theme === 'dark' ? 'Activar modo día' : 'Activar modo oscuro'}
            title={theme === 'dark' ? 'Modo día' : 'Modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <a href="/#contacto" className="nav-cta">
            Agendar visita <ArrowUpRight size={16} />
          </a>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <button
            type="button"
            onClick={toggleTheme}
            className="theme-toggle"
            aria-label={theme === 'dark' ? 'Activar modo día' : 'Activar modo oscuro'}
          >
            {theme === 'dark' ? <Sun size={18} /> : <Moon size={18} />}
          </button>
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="theme-toggle"
            aria-label={isOpen ? 'Cerrar menú' : 'Abrir menú'}
          >
            {isOpen ? <X size={24} /> : <Menu size={24} />}
          </button>
        </div>
      </div>

      <AnimatePresence>
        {isOpen && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="mobile-nav border-t lg:hidden"
          >
            <div className="space-y-1 px-4 py-4">
              {navLinks.map((item) => item.route ? (
                <Link
                  key={item.to}
                  to={item.to}
                  onClick={() => setIsOpen(false)}
                  className="mobile-nav-link block rounded-lg px-4 py-3 text-sm font-semibold"
                >
                  {item.label}
                </Link>
              ) : (
                <a
                  key={item.to}
                  href={item.to}
                  onClick={() => setIsOpen(false)}
                  className="mobile-nav-link block rounded-lg px-4 py-3 text-sm font-semibold"
                  target={item.external ? '_blank' : undefined}
                  rel={item.external ? 'noreferrer' : undefined}
                >
                  {item.label}
                </a>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.header>
  );
};

export default Navbar;
