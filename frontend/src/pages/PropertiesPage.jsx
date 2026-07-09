import React, { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { Search, SlidersHorizontal, Star, ChevronLeft, ChevronRight } from 'lucide-react';
import api from '../api';

const PropertiesPage = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filters, setFilters] = useState({
    operation: '', type: '', city: '', search: '', sort: 'newest', page: 1, limit: 12,
  });
  const [cities, setCities] = useState([]);
  const [showFilters, setShowFilters] = useState(false);

  useEffect(() => {
    api.getCities().then(setCities).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    const params = {};
    Object.entries(filters).forEach(([k, v]) => { if (v) params[k] = v; });
    api.getProperties(params)
      .then(data => {
        setProperties(data.properties);
        setPagination(data.pagination);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [filters]);

  const handleFilterChange = (key, value) => {
    setFilters(prev => ({ ...prev, [key]: value, page: 1 }));
  };

  const operations = [
    { value: '', label: 'Todas' },
    { value: 'venta', label: 'Venta' },
    { value: 'renta', label: 'Renta' },
  ];

  const types = [
    { value: '', label: 'Todos' },
    { value: 'casa', label: 'Casa' },
    { value: 'departamento', label: 'Departamento' },
    { value: 'terreno', label: 'Terreno' },
    { value: 'oficina', label: 'Oficina' },
    { value: 'local', label: 'Local' },
  ];

  const sortOptions = [
    { value: 'newest', label: 'Más recientes' },
    { value: 'price_asc', label: 'Precio: menor a mayor' },
    { value: 'price_desc', label: 'Precio: mayor a menor' },
    { value: 'area_desc', label: 'Mayor área' },
  ];

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header & Search */}
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white mb-2">Propiedades</h1>
          <p className="text-gray-400">{pagination.total} propiedades disponibles</p>
        </div>

        {/* Search bar */}
        <div className="flex gap-3 mb-6">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-500" size={18} />
            <input
              type="text"
              placeholder="Buscar propiedades..."
              value={filters.search}
              onChange={e => handleFilterChange('search', e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-amber-400/50 focus:outline-none"
            />
          </div>
          <button
            onClick={() => setShowFilters(!showFilters)}
            className={`flex items-center gap-2 px-4 py-2.5 rounded-lg border transition-all ${
              showFilters ? 'bg-amber-400/10 border-amber-400/30 text-amber-400' : 'bg-white/5 border-white/10 text-gray-300'
            }`}
          >
            <SlidersHorizontal size={18} /> Filtros
          </button>
        </div>

        {/* Filters */}
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            className="mb-6 p-4 bg-white/5 rounded-xl border border-white/5 grid grid-cols-2 md:grid-cols-4 gap-4"
          >
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Operación</label>
              <select
                value={filters.operation}
                onChange={e => handleFilterChange('operation', e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-400/50 focus:outline-none"
              >
                {operations.map(o => <option key={o.value} value={o.value} className="bg-[#111]">{o.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Tipo</label>
              <select
                value={filters.type}
                onChange={e => handleFilterChange('type', e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-400/50 focus:outline-none"
              >
                {types.map(t => <option key={t.value} value={t.value} className="bg-[#111]">{t.label}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Ciudad</label>
              <select
                value={filters.city}
                onChange={e => handleFilterChange('city', e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-400/50 focus:outline-none"
              >
                <option value="" className="bg-[#111]">Todas</option>
                {cities.map(c => <option key={c} value={c} className="bg-[#111]">{c}</option>)}
              </select>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Ordenar</label>
              <select
                value={filters.sort}
                onChange={e => handleFilterChange('sort', e.target.value)}
                className="w-full px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-400/50 focus:outline-none"
              >
                {sortOptions.map(s => <option key={s.value} value={s.value} className="bg-[#111]">{s.label}</option>)}
              </select>
            </div>
          </motion.div>
        )}

        {/* Properties Grid */}
        {loading ? (
          <div className="text-center py-16 text-gray-500">Cargando propiedades...</div>
        ) : properties.length === 0 ? (
          <div className="text-center py-16">
            <p className="text-gray-400 mb-4">No se encontraron propiedades</p>
            <button
              onClick={() => setFilters({ operation: '', type: '', city: '', search: '', sort: 'newest', page: 1, limit: 12 })}
              className="px-4 py-2 bg-amber-400/10 text-amber-400 rounded-lg hover:bg-amber-400/20"
            >
              Limpiar filtros
            </button>
          </div>
        ) : (
          <>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {properties.map((prop, i) => (
                <motion.div key={prop.id} initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: i * 0.05 }}>
                  <Link to={`/propiedades/${prop.slug}`} className="block group">
                    <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden hover:border-amber-400/30 transition-all">
                      <div className="relative h-48 overflow-hidden">
                        <img
                          src={prop.photos?.[0]?.url || '/images/placeholder.jpg'}
                          alt={prop.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        {prop.featured && (
                          <span className="absolute top-3 left-3 px-2 py-1 bg-amber-400 text-black text-xs font-bold rounded flex items-center gap-1">
                            <Star size={12} /> Destacada
                          </span>
                        )}
                        <span className="absolute top-3 right-3 px-2 py-1 bg-black/70 text-white text-xs rounded">
                          {prop.operation === 'venta' ? 'Venta' : 'Renta'}
                        </span>
                      </div>
                      <div className="p-4">
                        <h3 className="font-semibold text-white mb-1 group-hover:text-amber-400 transition-colors">{prop.title}</h3>
                        <p className="text-sm text-gray-400 mb-3">{prop.city}, {prop.state}</p>
                        <div className="flex items-center justify-between">
                          <span className="text-lg font-bold text-amber-400">
                            {prop.operation === 'renta' ? `$${prop.price.toLocaleString()}/mes` : `$${prop.price.toLocaleString()}`}
                          </span>
                          <span className="text-xs text-gray-500 capitalize">{prop.type}</span>
                        </div>
                        {(prop.bedrooms || prop.bathrooms || prop.area) && (
                          <div className="flex gap-3 mt-3 text-xs text-gray-400">
                            {prop.bedrooms && <span>{prop.bedrooms} rec</span>}
                            {prop.bathrooms && <span>{prop.bathrooms} baños</span>}
                            {prop.area && <span>{prop.area} m²</span>}
                          </div>
                        )}
                      </div>
                    </div>
                  </Link>
                </motion.div>
              ))}
            </div>

            {/* Pagination */}
            {pagination.pages > 1 && (
              <div className="flex items-center justify-center gap-2 mt-8">
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.max(1, f.page - 1) }))}
                  disabled={filters.page === 1}
                  className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 disabled:opacity-30"
                >
                  <ChevronLeft size={18} />
                </button>
                {Array.from({ length: pagination.pages }, (_, i) => i + 1).map(p => (
                  <button
                    key={p}
                    onClick={() => setFilters(f => ({ ...f, page: p }))}
                    className={`w-9 h-9 rounded-lg text-sm font-medium ${
                      p === filters.page ? 'bg-amber-400 text-black' : 'bg-white/5 text-gray-400 hover:bg-white/10'
                    }`}
                  >
                    {p}
                  </button>
                ))}
                <button
                  onClick={() => setFilters(f => ({ ...f, page: Math.min(pagination.pages, f.page + 1) }))}
                  disabled={filters.page === pagination.pages}
                  className="p-2 bg-white/5 border border-white/10 rounded-lg text-gray-400 disabled:opacity-30"
                >
                  <ChevronRight size={18} />
                </button>
              </div>
            )}
          </>
        )}
      </div>
    </main>
  );
};

export default PropertiesPage;
