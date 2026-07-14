import React, { useEffect, useMemo, useState } from 'react';
import { Link } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Bath, BedDouble, Building2, ChevronLeft, ChevronRight, Grid2X2, List, Map as MapIcon, MapPin, Search, SlidersHorizontal, Square, Star, Video } from 'lucide-react';
import api from '../api';

const money = (value, currency = 'MXN') => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(value || 0);

const createMarkerIcon = (active) => L.divIcon({
  className: '',
  html: `<div style="width:${active ? 42 : 34}px;height:${active ? 42 : 34}px;border-radius:999px;background:${active ? '#111827' : '#d71920'};border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,.3);display:grid;place-items:center;color:white;font-size:15px;font-weight:800;transition:.2s">$</div>`,
  iconSize: [active ? 42 : 34, active ? 42 : 34],
  iconAnchor: [active ? 21 : 17, active ? 21 : 17],
});

const MapFocus = ({ property }) => {
  const map = useMap();
  useEffect(() => {
    if (property?.lat && property?.lng) map.flyTo([property.lat, property.lng], Math.max(map.getZoom(), 14), { duration: 0.65 });
  }, [property?.id]);
  return null;
};

const PropertiesMap = ({ properties, activeId, onActivate }) => {
  const mapped = properties.filter((property) => Number.isFinite(Number(property.lat)) && Number.isFinite(Number(property.lng)));
  const active = properties.find((property) => property.id === activeId);

  return (
    <MapContainer center={[19.1738, -96.1342]} zoom={11} scrollWheelZoom className="h-full w-full">
      <TileLayer attribution="&copy; OpenStreetMap contributors" url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
      <MapFocus property={active} />
      {mapped.map((property) => (
        <Marker
          key={property.id}
          position={[Number(property.lat), Number(property.lng)]}
          icon={createMarkerIcon(property.id === activeId)}
          eventHandlers={{ click: () => onActivate(property.id) }}
        >
          <Popup>
            <div className="min-w-[210px]">
              <p className="font-bold">{property.title}</p>
              <p className="mt-1 text-sm">{money(property.price, property.currency)}</p>
              <Link to={`/propiedades/${property.slug}`} className="mt-2 inline-block font-bold text-[#d71920]">Ver propiedad</Link>
            </div>
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
};

const PropertyCard = ({ property, active, onActivate, view }) => {
  const cover = property.photos?.find((item) => item.mediaType !== 'video') || property.photos?.[0];
  const hasVideo = property.photos?.some((item) => item.mediaType === 'video');

  return (
    <article
      onMouseEnter={() => onActivate(property.id)}
      className={`group overflow-hidden rounded-2xl border bg-white shadow-sm transition hover:shadow-lg ${active ? 'border-[#d71920] ring-2 ring-red-100' : 'border-slate-200'} ${view === 'list' ? 'sm:grid sm:grid-cols-[250px_1fr]' : ''}`}
    >
      <Link to={`/propiedades/${property.slug}`} className="relative block h-52 overflow-hidden bg-slate-100 sm:h-full sm:min-h-[220px]">
        {cover?.url ? (
          cover.mediaType === 'video' ? <video src={cover.url} muted className="h-full w-full object-cover" /> : <img src={cover.url} alt={property.title} className="h-full w-full object-cover transition duration-500 group-hover:scale-105" loading="lazy" />
        ) : <div className="grid h-full place-items-center text-slate-300"><Building2 size={44} /></div>}
        <span className="absolute left-3 top-3 rounded-full bg-[#d71920] px-3 py-1.5 text-[11px] font-black uppercase tracking-wider text-white">{property.operation}</span>
        {property.featured && <span className="absolute right-3 top-3 inline-flex items-center gap-1 rounded-full bg-white px-3 py-1.5 text-[11px] font-bold text-slate-950"><Star size={12} fill="currentColor" /> Destacada</span>}
        {hasVideo && <span className="absolute bottom-3 right-3 inline-flex items-center gap-1 rounded-full bg-black/75 px-3 py-1.5 text-xs font-bold text-white"><Video size={13} /> Video</span>}
      </Link>

      <div className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="flex items-center gap-1 text-xs font-bold text-[#d71920]"><MapPin size={13} /> {property.city}, {property.state}</p>
            <Link to={`/propiedades/${property.slug}`}><h2 className="mt-2 line-clamp-2 text-lg font-black leading-6 text-slate-950 group-hover:text-[#d71920]">{property.title}</h2></Link>
          </div>
          <p className="shrink-0 text-right text-lg font-black text-slate-950">{money(property.price, property.currency)}{property.operation === 'renta' && <span className="block text-xs font-semibold text-slate-500">por mes</span>}</p>
        </div>
        <p className="mt-3 line-clamp-2 text-sm leading-6 text-slate-600">{property.description}</p>
        <div className="mt-5 flex flex-wrap gap-4 border-t border-slate-100 pt-4 text-sm font-semibold text-slate-600">
          {property.bedrooms ? <span className="inline-flex items-center gap-1.5"><BedDouble size={16} /> {property.bedrooms}</span> : null}
          {property.bathrooms ? <span className="inline-flex items-center gap-1.5"><Bath size={16} /> {property.bathrooms}</span> : null}
          {property.area ? <span className="inline-flex items-center gap-1.5"><Square size={15} /> {property.area} m²</span> : null}
          <span className="ml-auto capitalize text-slate-400">{property.type}</span>
        </div>
      </div>
    </article>
  );
};

const PropertiesPage = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [cities, setCities] = useState([]);
  const [activeId, setActiveId] = useState(null);
  const [mobilePanel, setMobilePanel] = useState('list');
  const [view, setView] = useState('grid');
  const [searchDraft, setSearchDraft] = useState('');
  const [filters, setFilters] = useState({ operation: '', type: '', city: '', minPrice: '', maxPrice: '', bedrooms: '', sort: 'newest', search: '', page: 1, limit: 12 });

  useEffect(() => { api.getCities().then(setCities).catch(() => setCities([])); }, []);

  useEffect(() => {
    setLoading(true);
    const params = Object.fromEntries(Object.entries(filters).filter(([, value]) => value !== '' && value !== null));
    api.getProperties(params)
      .then((data) => {
        setProperties(data.properties || []);
        setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
        setActiveId(data.properties?.[0]?.id || null);
      })
      .catch(() => setProperties([]))
      .finally(() => setLoading(false));
  }, [filters]);

  const mappedCount = useMemo(() => properties.filter((item) => item.lat && item.lng).length, [properties]);
  const updateFilter = (field, value) => setFilters((current) => ({ ...current, [field]: value, page: 1 }));
  const submitSearch = (event) => { event.preventDefault(); updateFilter('search', searchDraft); };
  const clearFilters = () => { setSearchDraft(''); setFilters({ operation: '', type: '', city: '', minPrice: '', maxPrice: '', bedrooms: '', sort: 'newest', search: '', page: 1, limit: 12 }); };

  return (
    <main className="min-h-screen bg-slate-50 pt-[78px] text-slate-950">
      <section className="sticky top-[78px] z-30 border-b border-slate-200 bg-white/95 shadow-sm backdrop-blur">
        <div className="mx-auto max-w-[1700px] px-4 py-4 sm:px-6 lg:px-8">
          <form onSubmit={submitSearch} className="flex gap-2">
            <div className="relative flex-1"><Search className="absolute left-4 top-1/2 -translate-y-1/2 text-slate-400" size={19} /><input value={searchDraft} onChange={(event) => setSearchDraft(event.target.value)} className="w-full rounded-xl border border-slate-300 py-3 pl-11 pr-4 outline-none focus:border-[#d71920] focus:ring-4 focus:ring-red-100" placeholder="Ciudad, colonia, dirección o palabra clave" /></div>
            <button className="rounded-xl bg-[#d71920] px-5 font-bold text-white hover:bg-[#b91319]">Buscar</button>
          </form>
          <div className="mt-3 flex gap-2 overflow-x-auto pb-1">
            <select value={filters.operation} onChange={(event) => updateFilter('operation', event.target.value)} className="filter-select"><option value="">Comprar o rentar</option><option value="venta">Venta</option><option value="renta">Renta</option></select>
            <select value={filters.type} onChange={(event) => updateFilter('type', event.target.value)} className="filter-select"><option value="">Tipo de propiedad</option><option value="casa">Casa</option><option value="departamento">Departamento</option><option value="terreno">Terreno</option><option value="oficina">Oficina</option><option value="local">Local</option><option value="bodega">Bodega</option></select>
            <select value={filters.city} onChange={(event) => updateFilter('city', event.target.value)} className="filter-select"><option value="">Todas las ciudades</option>{cities.map((city) => <option key={city}>{city}</option>)}</select>
            <input value={filters.minPrice} onChange={(event) => updateFilter('minPrice', event.target.value)} type="number" min="0" className="filter-select w-36" placeholder="Precio mínimo" />
            <input value={filters.maxPrice} onChange={(event) => updateFilter('maxPrice', event.target.value)} type="number" min="0" className="filter-select w-36" placeholder="Precio máximo" />
            <select value={filters.bedrooms} onChange={(event) => updateFilter('bedrooms', event.target.value)} className="filter-select"><option value="">Recámaras</option><option value="1">1+</option><option value="2">2+</option><option value="3">3+</option><option value="4">4+</option></select>
            <select value={filters.sort} onChange={(event) => updateFilter('sort', event.target.value)} className="filter-select"><option value="newest">Más recientes</option><option value="price_asc">Menor precio</option><option value="price_desc">Mayor precio</option><option value="area_desc">Mayor área</option></select>
            <button type="button" onClick={clearFilters} className="shrink-0 rounded-xl border border-slate-300 bg-white px-4 py-2.5 text-sm font-bold text-slate-600 hover:border-red-300 hover:text-[#d71920]">Limpiar</button>
          </div>
        </div>
      </section>

      <div className="mx-auto max-w-[1700px]">
        <div className="flex items-center justify-between border-b border-slate-200 bg-white px-4 py-4 sm:px-6 lg:px-8">
          <div><h1 className="text-xl font-black">Propiedades disponibles</h1><p className="text-sm text-slate-500">{pagination.total} resultados · {mappedCount} con ubicación en mapa</p></div>
          <div className="flex items-center gap-2">
            <div className="hidden rounded-lg border border-slate-200 bg-slate-50 p-1 sm:flex"><button onClick={() => setView('grid')} className={`rounded-md p-2 ${view === 'grid' ? 'bg-white text-[#d71920] shadow-sm' : 'text-slate-400'}`} aria-label="Vista de cuadrícula"><Grid2X2 size={17} /></button><button onClick={() => setView('list')} className={`rounded-md p-2 ${view === 'list' ? 'bg-white text-[#d71920] shadow-sm' : 'text-slate-400'}`} aria-label="Vista de lista"><List size={17} /></button></div>
            <div className="flex rounded-lg border border-slate-200 p-1 lg:hidden"><button onClick={() => setMobilePanel('list')} className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-bold ${mobilePanel === 'list' ? 'bg-slate-950 text-white' : 'text-slate-500'}`}><List size={16} /> Lista</button><button onClick={() => setMobilePanel('map')} className={`inline-flex items-center gap-1 rounded-md px-3 py-2 text-sm font-bold ${mobilePanel === 'map' ? 'bg-slate-950 text-white' : 'text-slate-500'}`}><MapIcon size={16} /> Mapa</button></div>
          </div>
        </div>

        <div className="lg:grid lg:h-[calc(100vh-278px)] lg:grid-cols-[minmax(520px,48%)_1fr]">
          <section className={`${mobilePanel === 'map' ? 'hidden' : 'block'} overflow-y-auto border-r border-slate-200 p-4 sm:p-6 lg:block`}>
            {loading ? (
              <div className="grid gap-5 sm:grid-cols-2">{Array.from({ length: 6 }, (_, i) => <div key={i} className="h-96 animate-pulse rounded-2xl bg-slate-200" />)}</div>
            ) : properties.length === 0 ? (
              <div className="grid min-h-[420px] place-items-center rounded-3xl border border-dashed border-slate-300 bg-white p-8 text-center"><div><SlidersHorizontal className="mx-auto text-slate-300" size={44} /><h2 className="mt-4 text-xl font-black">No encontramos propiedades</h2><p className="mt-2 text-slate-500">Prueba con otros filtros o elimina algunos criterios.</p><button onClick={clearFilters} className="mt-5 rounded-xl bg-[#d71920] px-5 py-3 font-bold text-white">Limpiar filtros</button></div></div>
            ) : (
              <div className={view === 'grid' ? 'grid gap-5 sm:grid-cols-2' : 'space-y-5'}>
                {properties.map((property) => <PropertyCard key={property.id} property={property} active={property.id === activeId} onActivate={setActiveId} view={view} />)}
              </div>
            )}

            {pagination.pages > 1 && (
              <div className="mt-8 flex items-center justify-center gap-2 pb-6">
                <button disabled={filters.page <= 1} onClick={() => setFilters((current) => ({ ...current, page: current.page - 1 }))} className="rounded-lg border border-slate-300 bg-white p-2 disabled:opacity-30"><ChevronLeft /></button>
                <span className="px-4 text-sm font-bold">Página {pagination.page} de {pagination.pages}</span>
                <button disabled={filters.page >= pagination.pages} onClick={() => setFilters((current) => ({ ...current, page: current.page + 1 }))} className="rounded-lg border border-slate-300 bg-white p-2 disabled:opacity-30"><ChevronRight /></button>
              </div>
            )}
          </section>

          <aside className={`${mobilePanel === 'list' ? 'hidden' : 'block'} h-[calc(100vh-278px)] min-h-[520px] bg-slate-200 lg:block lg:h-full`}>
            <PropertiesMap properties={properties} activeId={activeId} onActivate={setActiveId} />
          </aside>
        </div>
      </div>
    </main>
  );
};

export default PropertiesPage;
