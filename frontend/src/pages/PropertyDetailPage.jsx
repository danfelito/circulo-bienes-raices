import React, { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { ArrowLeft, Bath, BedDouble, Building2, Car, ChevronLeft, ChevronRight, Mail, MapPin, Maximize2, MessageCircle, Phone, Play, Square } from 'lucide-react';
import api from '../api';

const markerIcon = L.divIcon({
  className: '',
  html: '<div style="width:38px;height:38px;border-radius:999px;background:#d71920;border:3px solid white;box-shadow:0 4px 16px rgba(0,0,0,.3);display:grid;place-items:center;color:white;font-size:18px">⌂</div>',
  iconSize: [38, 38],
  iconAnchor: [19, 19],
});

const money = (value, currency = 'MXN') => new Intl.NumberFormat('es-MX', {
  style: 'currency', currency, maximumFractionDigits: 0,
}).format(value || 0);

const parseFeatures = (value) => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    if (Array.isArray(parsed)) return parsed;
  } catch {
    // Plain comma-separated text from the advisor form.
  }
  return String(value).split(',').map((item) => item.trim()).filter(Boolean);
};

const PropertyDetailPage = () => {
  const { slug } = useParams();
  const [property, setProperty] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentMedia, setCurrentMedia] = useState(0);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '', honeypot: '' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setLoading(true);
    setCurrentMedia(0);
    api.getProperty(slug)
      .then((data) => { setProperty(data.property); setRelated(data.related || []); })
      .catch(() => setProperty(null))
      .finally(() => setLoading(false));
  }, [slug]);

  const features = useMemo(() => parseFeatures(property?.features), [property?.features]);
  const media = property?.photos || [];
  const selectedMedia = media[currentMedia];

  const handleInquiry = async (event) => {
    event.preventDefault();
    try {
      await api.submitInquiry({ ...formData, propertyId: property?.id });
      setSubmitted(true);
    } catch (error) {
      window.alert(error.message);
    }
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-50 pt-[78px] text-slate-500">Cargando propiedad...</main>;
  if (!property) return <main className="grid min-h-screen place-items-center bg-slate-50 pt-[78px]"><div className="text-center"><Building2 className="mx-auto text-slate-300" size={48} /><p className="mt-4 font-bold">Propiedad no encontrada</p><Link to="/propiedades" className="mt-3 inline-block text-[#d71920]">Volver al catálogo</Link></div></main>;

  return (
    <main className="min-h-screen bg-slate-50 pt-[78px] text-slate-950">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6 lg:px-8">
        <Link to="/propiedades" className="inline-flex items-center gap-2 text-sm font-bold text-slate-600 hover:text-[#d71920]"><ArrowLeft size={17} /> Volver al catálogo</Link>

        <div className="mt-6 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px]">
          <div className="min-w-0 space-y-7">
            <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-sm">
              <div className="relative h-[300px] bg-slate-100 sm:h-[520px]">
                {selectedMedia ? (
                  selectedMedia.mediaType === 'video' ? (
                    <video key={selectedMedia.id} src={selectedMedia.url} controls className="h-full w-full bg-black object-contain" />
                  ) : (
                    <img src={selectedMedia.url} alt={selectedMedia.alt || property.title} className="h-full w-full object-cover" />
                  )
                ) : <div className="grid h-full place-items-center text-slate-300"><Building2 size={56} /></div>}

                {media.length > 1 && (
                  <>
                    <button onClick={() => setCurrentMedia((value) => (value - 1 + media.length) % media.length)} className="absolute left-4 top-1/2 -translate-y-1/2 rounded-full bg-black/65 p-3 text-white backdrop-blur hover:bg-black" aria-label="Archivo anterior"><ChevronLeft /></button>
                    <button onClick={() => setCurrentMedia((value) => (value + 1) % media.length)} className="absolute right-4 top-1/2 -translate-y-1/2 rounded-full bg-black/65 p-3 text-white backdrop-blur hover:bg-black" aria-label="Archivo siguiente"><ChevronRight /></button>
                  </>
                )}
              </div>

              {media.length > 1 && (
                <div className="flex gap-3 overflow-x-auto p-4">
                  {media.map((item, index) => (
                    <button key={item.id} onClick={() => setCurrentMedia(index)} className={`relative h-20 w-28 shrink-0 overflow-hidden rounded-xl border-2 bg-slate-100 ${index === currentMedia ? 'border-[#d71920]' : 'border-transparent'}`}>
                      {item.mediaType === 'video' ? <><video src={item.url} muted className="h-full w-full object-cover" /><span className="absolute inset-0 grid place-items-center bg-black/25 text-white"><Play size={20} fill="currentColor" /></span></> : <img src={item.url} alt="" className="h-full w-full object-cover" />}
                    </button>
                  ))}
                </div>
              )}
            </section>

            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">
              <div className="flex flex-col justify-between gap-5 sm:flex-row sm:items-start">
                <div>
                  <div className="flex flex-wrap gap-2"><span className="rounded-full bg-[#d71920] px-3 py-1.5 text-xs font-black uppercase tracking-wider text-white">{property.operation}</span><span className="rounded-full bg-slate-100 px-3 py-1.5 text-xs font-bold capitalize text-slate-700">{property.type}</span>{property.status !== 'available' && <span className="rounded-full bg-amber-100 px-3 py-1.5 text-xs font-bold capitalize text-amber-800">{property.status}</span>}</div>
                  <h1 className="mt-4 text-3xl font-black tracking-tight sm:text-4xl">{property.title}</h1>
                  <p className="mt-3 flex items-center gap-2 text-slate-600"><MapPin size={18} className="text-[#d71920]" /> {property.address ? `${property.address}, ` : ''}{property.city}, {property.state}</p>
                </div>
                <div className="sm:text-right"><p className="text-3xl font-black text-[#d71920]">{money(property.price, property.currency)}</p>{property.operation === 'renta' && <p className="text-sm text-slate-500">por mes</p>}</div>
              </div>

              <div className="mt-7 grid grid-cols-2 gap-3 sm:grid-cols-4">
                {property.bedrooms ? <div className="rounded-2xl bg-slate-50 p-4"><BedDouble className="text-[#d71920]" /><p className="mt-2 font-black">{property.bedrooms}</p><p className="text-xs text-slate-500">Recámaras</p></div> : null}
                {property.bathrooms ? <div className="rounded-2xl bg-slate-50 p-4"><Bath className="text-[#d71920]" /><p className="mt-2 font-black">{property.bathrooms}</p><p className="text-xs text-slate-500">Baños</p></div> : null}
                {property.area ? <div className="rounded-2xl bg-slate-50 p-4"><Maximize2 className="text-[#d71920]" /><p className="mt-2 font-black">{property.area} m²</p><p className="text-xs text-slate-500">Construcción</p></div> : null}
                {property.lotArea ? <div className="rounded-2xl bg-slate-50 p-4"><Square className="text-[#d71920]" /><p className="mt-2 font-black">{property.lotArea} m²</p><p className="text-xs text-slate-500">Terreno</p></div> : null}
                {property.parking ? <div className="rounded-2xl bg-slate-50 p-4"><Car className="text-[#d71920]" /><p className="mt-2 font-black">{property.parking}</p><p className="text-xs text-slate-500">Estacionamientos</p></div> : null}
              </div>

              <div className="mt-8 border-t border-slate-100 pt-7"><h2 className="text-xl font-black">Detalles de la propiedad</h2><p className="mt-4 whitespace-pre-line leading-8 text-slate-600">{property.description}</p></div>

              {features.length > 0 && <div className="mt-8 border-t border-slate-100 pt-7"><h2 className="text-xl font-black">Características</h2><div className="mt-4 flex flex-wrap gap-2">{features.map((feature) => <span key={feature} className="rounded-full border border-slate-200 bg-slate-50 px-4 py-2 text-sm font-semibold text-slate-700">{feature}</span>)}</div></div>}

              {property.createdBy && <div className="mt-8 border-t border-slate-100 pt-7"><h2 className="text-xl font-black">Asesor responsable</h2><p className="mt-3 font-bold">{property.createdBy.name || 'Círculo Internacional'}</p>{property.createdBy.email && <a href={`mailto:${property.createdBy.email}`} className="mt-1 block text-sm text-[#d71920]">{property.createdBy.email}</a>}</div>}
            </section>

            {property.lat && property.lng && (
              <section className="overflow-hidden rounded-3xl border border-slate-200 bg-white p-4 shadow-sm"><h2 className="px-2 pb-4 text-xl font-black">Ubicación</h2><div className="h-80 overflow-hidden rounded-2xl"><MapContainer center={[Number(property.lat), Number(property.lng)]} zoom={15} className="h-full w-full" scrollWheelZoom={false}><TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" /><Marker position={[Number(property.lat), Number(property.lng)]} icon={markerIcon}><Popup>{property.title}</Popup></Marker></MapContainer></div></section>
            )}
          </div>

          <aside className="space-y-5 lg:sticky lg:top-28 lg:self-start">
            <section className="rounded-3xl border border-slate-200 bg-white p-6 shadow-lg">
              <h2 className="text-xl font-black">¿Te interesa esta propiedad?</h2>
              <p className="mt-2 text-sm leading-6 text-slate-500">Envía tus datos y un asesor dará seguimiento.</p>
              {submitted ? <div className="mt-5 rounded-xl bg-emerald-50 p-4 font-semibold text-emerald-800">Consulta enviada. Te contactaremos pronto.</div> : (
                <form onSubmit={handleInquiry} className="mt-5 space-y-3">
                  <input type="text" name="honeypot" value={formData.honeypot} onChange={(event) => setFormData({ ...formData, honeypot: event.target.value })} className="hidden" tabIndex={-1} autoComplete="off" />
                  <input required className="detail-input" placeholder="Nombre" value={formData.name} onChange={(event) => setFormData({ ...formData, name: event.target.value })} />
                  <input required type="email" className="detail-input" placeholder="Correo" value={formData.email} onChange={(event) => setFormData({ ...formData, email: event.target.value })} />
                  <input className="detail-input" placeholder="Teléfono" value={formData.phone} onChange={(event) => setFormData({ ...formData, phone: event.target.value })} />
                  <textarea required rows={4} className="detail-input resize-none" placeholder="Mensaje" value={formData.message} onChange={(event) => setFormData({ ...formData, message: event.target.value })} />
                  <button className="w-full rounded-xl bg-[#d71920] px-5 py-3.5 font-bold text-white hover:bg-[#b91319]">Enviar consulta</button>
                </form>
              )}
            </section>

            <a href={`https://wa.me/522291234567?text=${encodeURIComponent(`Hola, me interesa la propiedad: ${property.title}`)}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 rounded-2xl bg-emerald-600 p-4 font-bold text-white hover:bg-emerald-700"><MessageCircle size={20} /> WhatsApp</a>
            <a href={property.createdBy?.phone ? `tel:${property.createdBy.phone}` : 'tel:+522291234567'} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white p-4 font-bold text-slate-800 hover:border-[#d71920] hover:text-[#d71920]"><Phone size={20} /> Llamar</a>
            {property.createdBy?.email && <a href={`mailto:${property.createdBy.email}?subject=${encodeURIComponent(property.title)}`} className="flex items-center justify-center gap-2 rounded-2xl border border-slate-300 bg-white p-4 font-bold text-slate-800 hover:border-[#d71920] hover:text-[#d71920]"><Mail size={20} /> Escribir al asesor</a>}

            {related.length > 0 && <section className="rounded-3xl border border-slate-200 bg-white p-5"><h2 className="font-black">Propiedades similares</h2><div className="mt-4 space-y-3">{related.map((item) => { const cover = item.photos?.find((mediaItem) => mediaItem.mediaType !== 'video') || item.photos?.[0]; return <Link key={item.id} to={`/propiedades/${item.slug}`} className="flex gap-3 rounded-xl p-2 hover:bg-slate-50"><div className="h-16 w-20 overflow-hidden rounded-lg bg-slate-100">{cover?.url ? <img src={cover.url} alt="" className="h-full w-full object-cover" /> : null}</div><div className="min-w-0"><p className="truncate text-sm font-bold">{item.title}</p><p className="mt-1 text-xs text-slate-500">{item.city}</p><p className="mt-1 text-sm font-black text-[#d71920]">{money(item.price, item.currency)}</p></div></Link>; })}</div></section>}
          </aside>
        </div>
      </div>
    </main>
  );
};

export default PropertyDetailPage;
