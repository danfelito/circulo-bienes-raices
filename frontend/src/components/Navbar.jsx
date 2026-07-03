import { ArrowUpRight, Menu, X } from 'lucide-react';
import { useState } from 'react';
import { Link } from 'react-router-dom';

export default function Navbar() {
  const [isOpen, setIsOpen] = useState(false);
  const navLinks = [
    { name: 'Inicio', href: '/' },
    { name: 'Propiedades', href: '/propiedades' },
    { name: 'Servicios', href: '#servicios' },
    { name: 'Nosotros', href: '#nosotros' },
    { name: 'Contacto', href: '#contacto' },
  ];

  return (
    <nav className="fixed top-0 left-0 right-0 z-50 bg-black/90 backdrop-blur-md border-b border-white/10">
      <div className="px-6 lg:px-16 py-4 flex items-center justify-between">
        <Link to="/" className="flex items-center gap-3 group">
          <div className="h-12 w-12 rounded-full bg-red-600 flex items-center justify-center">
            <span className="text-white font-bold text-xl">CI</span>
          </div>
          <span className="text-white font-heading italic text-lg hidden sm:block">Círculo Internacional</span>
        </Link>
        <div className="hidden md:flex items-center gap-1">
          {navLinks.map((link) => (
            link.href.startsWith('/') ? (
              <Link 
                key={link.name} 
                to={link.href} 
                className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
              >
                {link.name}
              </Link>
            ) : (
              <a 
                key={link.name} 
                href={link.href} 
                className="px-4 py-2 text-sm font-medium text-white/80 hover:text-white transition-colors"
              >
                {link.name}
              </a>
            )
          ))}
          <button className="liquid-glass-strong rounded-full px-5 py-2 text-sm font-medium flex items-center gap-2 ml-4">
            Agendar Visita <ArrowUpRight className="w-4 h-4" />
          </button>
        </div>
        <button className="md:hidden text-white p-2" onClick={() => setIsOpen(!isOpen)}>
          {isOpen ? <X className="w-6 h-6" /> : <Menu className="w-6 h-6" />}
        </button>
      </div>
      {isOpen && (
        <div className="md:hidden mt-4 pb-4 space-y-2 px-6">
          {navLinks.map((link) => (
            link.href.startsWith('/') ? (
              <Link 
                key={link.name} 
                to={link.href} 
                className="block px-4 py-2 text-white/80 hover:text-white" 
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </Link>
            ) : (
              <a 
                key={link.name} 
                href={link.href} 
                className="block px-4 py-2 text-white/80 hover:text-white" 
                onClick={() => setIsOpen(false)}
              >
                {link.name}
              </a>
            )
          ))}
        </div>
      )}
    </nav>
  );
}
