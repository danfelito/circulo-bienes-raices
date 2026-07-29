import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ChevronLeft, ChevronRight, Search, SlidersHorizontal, Star } from 'lucide-react';
import api from '../api';

const initialFilters = {
  operation: '', type: '', city: '', search: '', sort: 'newest', page: 1, limit: 12,
};

const PropertiesPage = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState(initialFilters);
  const [cities, setCities] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    api.getCities().then(setCities).catch(() => setCities([]));
  }, []);

  useEffect(() => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError('');
      const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== ''));

      api.getProperties(params)
        .then(data => {
          if (controller.signal.aborted) return;
          setProperties(data.properties || []);
          setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
        })
        .catch(() => {
          if (!controller.signal.aborted) setError('No fue posible cargar las propiedades. Intenta nuevamente.');
        })
        .finally(() => {
          if (!controller.signal.aborted) setLoading(false);
        });
    }, filters.search ? 300 : 0);

    return () => {
      controller.abort();
      window.clearTimeout(timer);
    };
  }, [filters]);

  const updateFilter = (key, value) => {
    setFilters(current => ({ ...current, [key]: value, page: 1 }));
  };

  const operations = [
    { value: '', label: 'Todas' }, { value: 'venta', label: 'Venta' }, { value: 'renta', label: 'Renta' },
  ];
  const types = [
    { value: '', label: 'Todos' }, { value: 'casa', label: 'Casa' },
    { value: 'departamento', label: 'Departamento' }, { value: 'terreno', label: 'Terreno' },
    { value: 'oficina', label: 'Oficina' }, { value: 'local', label: 'Local' },
  ];
  const sorts = [
    { value: 'newest', label: 'Más recientes' }, { value: 'price_asc', label: 'Precio: menor a mayor' },
    { value: 'price_desc', label: 'Precio: mayor a menor' }, { value: 'area_desc', label: 'Mayor área' },
  ];

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Propiedades</h1>
          <p className="text-gray-400">{pagination.total} propiedades disponibles</p>
        </div>

        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input type="search" placeholder="Buscar propiedades..." value={filters.search} onChange={event => updateFilter('search', event.target.value)} className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-amber-400/50 focus:outline-none" />
          </div>
          <button type="button" onClick={() => setShowFilters(current => !current)} className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border ${showFilters ? 'bg-amber-400/10 border-amber-400/30 text-amber-400' : 'bg-white/5 border-white/10 text-gray-300'}`}>
            <SlidersHorizontal size={18} /> Filtros
          </button>
        </div>

        {showFilters && (
          <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} className="mb-6 p-4 bg-white/5 rounded-xl border border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4">
            <label className="text-xs text-gray-400">Operación
              <select value={filters.operation} onChange={event => updateFilter('operation', event.target.value)} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
                {operations.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-400">Tipo
              <select value={filters.type} onChange={event => updateFilter('type', event.target.value)} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
                {types.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-400">Ciudad
              <select value={filters.city} onChange={event => updateFilter('city', event.target.value)} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
                <option value="">Todas</option>
                {cities.map(city => <option key={city} value={city}>{city}</option>)}
              </select>
            </label>
            <label className="text-xs text-gray-400">Ordenar
              <select value={filters.sort} onChange={event => updateFilter('sort', event.target.value)} className="mt-1 w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
                {sorts.map(option => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </label>
          </motion.div>
        )}

        {error ? (
          <div className="text-center py-16">
            <p className="text-red-400 mb-4">{error}</p>
            <button type="button" onClick={() => setFilters(current => ({ ...current }))} className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-white">Reintentar</button>
          </div>
        ) : loading ? (
          <div className="text-center py-16 text-gray-500">Cargando propiedades...</div>
        ) : properties.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No se encontraron propiedades</p>
            <button type="button" onClick={() => setFilters(initialFilters)} className="px-4 py-2 bg-amber-400/10 text-amber-400 rounded-lg">Limpiar filtros</button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((property, index) => (
                <motion.article key={property.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: index * 0.04 }}>
                  <Link to={`/propiedades/${property.slug}`} className="block group">
                    <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden hover:border-amber-400/30 transition-all">
                      <div className="relative h-48 overflow-hidden">
                        <img src={property.photos?.[0]?.url || '/images/placeholder.svg'} alt={property.title} loading="lazy" className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500" />
                        {property.featured && <span className="absolute top-3 left-3 px-2 py-1 bg-amber-400 text-white text-xs font-bold rounded flex items-center gap-1"><Star size={12} /> Destacada</span>}
                        <span className="absolute top-3 right-3 px-2 py-1 bg-black/70 text-white text-xs rounded">{property.operation === 'venta' ? 'Venta' : 'Renta'}</span>
                      </div>
                      <div className="p-4">
                        <h2 className="font-semibold text-white mb-1 group-hover:text-amber-400">{property.title}</h2>
                        <p className="text-sm text-gray-400 mb-3">{property.city}, {property.state}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-amber-400">${property.price.toLocaleString('es-MX')} {property.currency}{property.operation === 'renta' ? '/mes' : ''}</span>
                          <span className="text-xs text-gray-500 capitalize">{property.type}</span>
                        </div>
                        <div className="flex gap-3 mt-3 text-xs text-gray-400">
                          {property.bedrooms != null && <span>{property.bedrooms} rec.</span>}
                          {property.bathrooms != null && <span>{property.bathrooms} baños</span>}
                          {property.area != null && <span>{property.area} m²</span>}
                        </div>
                      </div>
                    </div>
                  </Link>
                </motion.article>
              ))}
            </div>

            {pagination.pages > 1 && (
              <nav className="flex items-center justify-center gap-2 mt-8" aria-label="Paginación de propiedades">
                <button type="button" onClick={() => setFilters(current => ({ ...current, page: Math.max(1, current.page - 1) }))} disabled={filters.page === 1} className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 disabled:opacity-30"><ChevronLeft size={18} /></button>
                <span className="px-3 text-sm text-gray-400">Página {pagination.page} de {pagination.pages}</span>
                <button type="button" onClick={() => setFilters(current => ({ ...current, page: Math.min(pagination.pages, current.page + 1) }))} disabled={filters.page === pagination.pages} className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 disabled:opacity-30"><ChevronRight size={18} /></button>
              </nav>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default PropertiesPage;
