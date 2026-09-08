import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import {
  ArrowUpRight, Bath, BedDouble, Building2, ChevronLeft, ChevronRight,
  House, MapPin, Maximize2, Search, SlidersHorizontal, Sparkles, Star, X,
} from 'lucide-react';
import api from '../api';

const initialFilters = {
  operation: '', type: '', city: '', search: '', sort: 'newest', page: 1, limit: 12,
};

const formatPrice = property => {
  const amount = Number(property.price);
  if (!Number.isFinite(amount)) return 'Precio a consultar';
  return new Intl.NumberFormat('es-MX', {
    style: 'currency', currency: property.currency || 'MXN', maximumFractionDigits: 0,
  }).format(amount);
};

const typeLabels = {
  casa: 'Casa', departamento: 'Departamento', terreno: 'Terreno', oficina: 'Oficina',
  local: 'Local', bodega: 'Bodega', rancho: 'Rancho', otros: 'Propiedad',
};

const PropertyCard = ({ property, index }) => {
  const cover = property.photos?.find(photo => photo.isMain) || property.photos?.[0];
  const location = [property.city, property.state].filter(Boolean).join(', ');
  const operation = property.operation === 'renta' ? 'En renta' : 'En venta';

  return (
    <motion.article
      initial={{ opacity: 0, y: 22 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: Math.min(index * 0.05, 0.3), duration: 0.45 }}
      className="h-full"
    >
      <Link
        to={`/propiedades/${property.slug}`}
        className="group flex h-full flex-col overflow-hidden rounded-[1.65rem] border border-white/10 bg-[#111113] shadow-[0_18px_60px_rgba(0,0,0,.28)] transition duration-300 hover:-translate-y-1 hover:border-red-500/45 hover:shadow-[0_24px_70px_rgba(0,0,0,.42)]"
      >
        <div className="relative aspect-[4/3] overflow-hidden bg-white/5">
          <img
            src={cover?.url || '/images/placeholder.svg'}
            alt={property.title}
            loading="lazy"
            className="h-full w-full object-cover transition duration-700 group-hover:scale-[1.045]"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/85 via-black/5 to-black/20" />
          <div className="absolute left-4 right-4 top-4 flex items-start justify-between gap-3">
            <span className="rounded-full bg-red-600 px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.12em] text-white shadow-lg">
              {operation}
            </span>
            {property.featured && (
              <span className="flex items-center gap-1.5 rounded-full border border-white/20 bg-black/55 px-3 py-1.5 text-[11px] font-semibold text-white backdrop-blur-md">
                <Star size={12} fill="currentColor" /> Destacada
              </span>
            )}
          </div>
          <div className="absolute bottom-4 left-4 right-4">
            <p className="mb-1 text-[11px] font-semibold uppercase tracking-[0.16em] text-white/70">
              {typeLabels[property.type] || 'Propiedad'}
            </p>
            <p className="text-2xl font-extrabold tracking-tight text-white">
              {formatPrice(property)}{property.operation === 'renta' && <span className="text-sm font-medium text-white/70"> / mes</span>}
            </p>
          </div>
        </div>

        <div className="flex flex-1 flex-col p-5">
          <h2 className="line-clamp-2 text-lg font-bold leading-snug text-white transition-colors group-hover:text-red-400">
            {property.title}
          </h2>
          <p className="mt-2 flex items-center gap-1.5 text-sm text-gray-400">
            <MapPin size={15} className="shrink-0 text-red-500" />
            <span className="truncate">{location || 'Ubicación por confirmar'}</span>
          </p>

          <div className="mt-5 grid grid-cols-3 divide-x divide-white/10 rounded-2xl border border-white/10 bg-white/[0.035] py-3">
            <span className="flex flex-col items-center gap-1 text-xs text-gray-400">
              <BedDouble size={17} className="text-white/80" />
              <strong className="font-semibold text-white">{property.bedrooms ?? '—'}</strong> rec.
            </span>
            <span className="flex flex-col items-center gap-1 text-xs text-gray-400">
              <Bath size={17} className="text-white/80" />
              <strong className="font-semibold text-white">{property.bathrooms ?? '—'}</strong> baños
            </span>
            <span className="flex flex-col items-center gap-1 text-xs text-gray-400">
              <Maximize2 size={17} className="text-white/80" />
              <strong className="font-semibold text-white">{property.area ?? property.lotArea ?? '—'}</strong> m²
            </span>
          </div>

          <div className="mt-5 flex items-center justify-between border-t border-white/10 pt-4">
            <span className="text-xs font-medium uppercase tracking-[0.13em] text-gray-500">Ver detalles</span>
            <span className="grid h-9 w-9 place-items-center rounded-full bg-white/5 text-white transition group-hover:bg-red-600">
              <ArrowUpRight size={17} />
            </span>
          </div>
        </div>
      </Link>
    </motion.article>
  );
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

  const activeFilterCount = ['operation', 'type', 'city'].filter(key => filters[key]).length;

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
    <main className="min-h-screen bg-[#080809] pt-20">
      <section className="relative overflow-hidden border-b border-white/10">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_15%_10%,rgba(237,28,46,.2),transparent_34%),radial-gradient(circle_at_85%_20%,rgba(255,255,255,.06),transparent_28%)]" />
        <div className="relative mx-auto max-w-7xl px-4 pb-12 pt-14 sm:pb-16 sm:pt-20">
          <div className="max-w-3xl">
            <p className="mb-4 flex items-center gap-2 text-xs font-bold uppercase tracking-[0.22em] text-red-500">
              <Sparkles size={15} /> Portafolio inmobiliario
            </p>
            <h1 className="text-4xl font-black tracking-[-0.035em] text-white sm:text-5xl lg:text-6xl">
              Encuentra el espacio<br className="hidden sm:block" /> que sigue en tu historia.
            </h1>
            <p className="mt-5 max-w-2xl text-base leading-relaxed text-gray-400 sm:text-lg">
              Propiedades seleccionadas en Veracruz y ubicaciones estratégicas, con información clara y atención personalizada.
            </p>
          </div>
          <div className="mt-8 inline-flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-gray-300 backdrop-blur-sm">
            <Building2 size={17} className="text-red-500" />
            <strong className="text-white">{pagination.total}</strong> {pagination.total === 1 ? 'propiedad disponible' : 'propiedades disponibles'}
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-7xl px-4 py-8 sm:py-10">
        <div className="relative z-10 mb-8 rounded-[1.4rem] border border-white/10 bg-[#111113]/95 p-3 shadow-[0_18px_60px_rgba(0,0,0,.3)] backdrop-blur-xl sm:flex sm:items-center sm:gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" size={19} />
            <input type="search" placeholder="Busca por ciudad, zona o tipo de propiedad" value={filters.search} onChange={event => updateFilter('search', event.target.value)} className="w-full rounded-xl border border-transparent bg-white/[0.045] py-3.5 pl-11 pr-10 text-white placeholder-gray-500 outline-none transition focus:border-red-500/50 focus:bg-white/[0.065]" />
            {filters.search && <button type="button" onClick={() => updateFilter('search', '')} className="absolute right-3 top-1/2 -translate-y-1/2 p-1 text-gray-500 hover:text-white" aria-label="Limpiar búsqueda"><X size={16} /></button>}
          </div>
          <button type="button" onClick={() => setShowFilters(current => !current)} className={`mt-3 flex w-full items-center justify-center gap-2 rounded-xl border px-5 py-3.5 font-semibold transition sm:mt-0 sm:w-auto ${showFilters ? 'border-red-500/40 bg-red-500/10 text-red-400' : 'border-white/10 bg-white/5 text-gray-200 hover:border-white/20'}`}>
            <SlidersHorizontal size={18} /> Filtros {activeFilterCount > 0 && <span className="grid h-5 min-w-5 place-items-center rounded-full bg-red-600 px-1 text-[10px] text-white">{activeFilterCount}</span>}
          </button>
        </div>

        {showFilters && (
          <motion.div initial={{ opacity: 0, y: -8 }} animate={{ opacity: 1, y: 0 }} className="mb-8 grid grid-cols-1 gap-4 rounded-[1.4rem] border border-white/10 bg-white/[0.035] p-5 sm:grid-cols-2 md:grid-cols-4">
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
          <div className="grid grid-cols-1 gap-7 md:grid-cols-2 xl:grid-cols-3">
            {[0, 1, 2, 3, 4, 5].map(item => <div key={item} className="overflow-hidden rounded-[1.65rem] border border-white/10 bg-white/5"><div className="aspect-[4/3] animate-pulse bg-white/10" /><div className="space-y-3 p-5"><div className="h-5 w-3/4 animate-pulse rounded bg-white/10" /><div className="h-4 w-1/2 animate-pulse rounded bg-white/10" /><div className="h-16 animate-pulse rounded-xl bg-white/10" /></div></div>)}
          </div>
        ) : properties.length === 0 ? (
          <div className="relative overflow-hidden rounded-[2rem] border border-white/10 bg-white/[0.035] px-6 py-20 text-center">
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(237,28,46,.12),transparent_45%)]" />
            <div className="relative mx-auto grid h-16 w-16 place-items-center rounded-2xl border border-red-500/20 bg-red-500/10 text-red-500"><House size={30} /></div>
            <h2 className="relative mt-6 text-2xl font-bold text-white">Nuevas propiedades en preparación</h2>
            <p className="relative mx-auto mt-3 max-w-lg leading-relaxed text-gray-400">Estamos revisando el catálogo para mostrarte información y fotografías completas. Vuelve pronto o ajusta tu búsqueda.</p>
            {(filters.search || activeFilterCount > 0) && <button type="button" onClick={() => setFilters(initialFilters)} className="relative mt-7 rounded-full bg-red-600 px-6 py-3 text-sm font-bold text-white transition hover:bg-red-700">Limpiar filtros</button>}
          </div>
        ) : (
          <>
            <div className="mb-5 flex items-center justify-between">
              <p className="text-sm text-gray-400"><strong className="text-white">{pagination.total}</strong> resultados</p>
              <p className="hidden text-xs uppercase tracking-[0.14em] text-gray-600 sm:block">Selección inmobiliaria</p>
            </div>
            <div className="grid grid-cols-1 gap-7 md:grid-cols-2 xl:grid-cols-3">
              {properties.map((property, index) => <PropertyCard key={property.id} property={property} index={index} />)}
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
