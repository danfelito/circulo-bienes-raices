import React, { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { motion } from 'framer-motion';
import { ArrowLeft, Bath, Bed, Car, ChevronLeft, ChevronRight, Mail, MapPin, Maximize, MessageCircle, Phone, Play } from 'lucide-react';
import { MapContainer, Marker, Popup, TileLayer } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../api';

delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const parseFeatures = value => {
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
};

const isVideo = media => media?.publicId?.startsWith('video:') || /\.(mp4|mov|m4v|webm|avi|mkv)(?:\?|$)/i.test(media?.url || '');
const firstImage = property => property?.photos?.find(photo => !isVideo(photo));

const PropertyDetailPage = () => {
  const { slug } = useParams();
  const [property, setProperty] = useState(null);
  const [related, setRelated] = useState([]);
  const [config, setConfig] = useState({});
  const [loading, setLoading] = useState(true);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '', honeypot: '' });
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    api.getConfig().then(setConfig).catch(() => {});
  }, []);

  useEffect(() => {
    setLoading(true);
    setCurrentPhoto(0);
    api.getProperty(slug)
      .then(data => {
        setProperty(data.property);
        setRelated(data.related || []);
      })
      .catch(() => {
        setProperty(null);
        setRelated([]);
      })
      .finally(() => setLoading(false));
  }, [slug]);

  const handleInquiry = async event => {
    event.preventDefault();
    setSubmitting(true);
    try {
      await api.submitInquiry({ ...formData, propertyId: property?.id });
      setSubmitted(true);
    } catch (err) {
      alert(err.message);
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) return <main className="pt-20 min-h-screen bg-[#0a0a0a] text-center py-16 text-gray-500">Cargando propiedad...</main>;
  if (!property) return <main className="pt-20 min-h-screen bg-[#0a0a0a] text-center py-16"><p className="text-gray-400">Propiedad no encontrada</p><Link to="/propiedades" className="text-amber-400 hover:underline">Volver al catálogo</Link></main>;

  const features = parseFeatures(property.features);
  const photos = property.photos || [];
  const currentMedia = photos[currentPhoto];
  const whatsappNumber = (config.whatsappNumber || '').replace(/\D/g, '');
  const whatsappText = encodeURIComponent(`Hola, me interesa la propiedad: ${property.title}`);
  const phoneHref = config.contactPhone ? `tel:${config.contactPhone.replace(/[^+\d]/g, '')}` : '';
  const emailHref = config.contactEmail
    ? `mailto:${config.contactEmail}?subject=${encodeURIComponent(`Consulta sobre ${property.title}`)}`
    : '';

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <Link to="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-amber-400 mb-6"><ArrowLeft size={16} /> Volver al catálogo</Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          <div className="lg:col-span-2 space-y-6">
            <div className="relative h-64 sm:h-96 rounded-2xl overflow-hidden bg-white/5">
              {currentMedia && isVideo(currentMedia) ? (
                <video
                  key={currentMedia.id || currentMedia.url}
                  src={currentMedia.url}
                  controls
                  playsInline
                  preload="metadata"
                  className="w-full h-full object-contain bg-black"
                  aria-label={currentMedia.alt || `Video de ${property.title}`}
                />
              ) : (
                <img src={currentMedia?.url || '/images/placeholder.svg'} alt={currentMedia?.alt || property.title} className="w-full h-full object-cover" />
              )}
              {currentMedia && isVideo(currentMedia) && <span className="absolute top-3 left-3 px-3 py-1.5 bg-black/70 rounded-full text-white text-xs flex items-center gap-1.5 pointer-events-none"><Play size={13} /> Video del inmueble</span>}
              {photos.length > 1 && (
                <>
                  <button type="button" onClick={() => setCurrentPhoto(current => (current - 1 + photos.length) % photos.length)} className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 rounded-full text-white" aria-label="Archivo anterior"><ChevronLeft size={20} /></button>
                  <button type="button" onClick={() => setCurrentPhoto(current => (current + 1) % photos.length)} className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 rounded-full text-white" aria-label="Archivo siguiente"><ChevronRight size={20} /></button>
                  <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5 max-w-[80%] overflow-x-auto p-1 rounded-full bg-black/25">
                    {photos.map((media, index) => <button type="button" key={media.id || index} onClick={() => setCurrentPhoto(index)} className={`w-2.5 h-2.5 shrink-0 rounded-full ${index === currentPhoto ? 'bg-amber-400' : isVideo(media) ? 'bg-blue-400/80' : 'bg-white/50'}`} aria-label={`Ver ${isVideo(media) ? 'video' : 'foto'} ${index + 1}`} />)}
                  </div>
                </>
              )}
            </div>

            {photos.length > 1 && (
              <div className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-2">
                {photos.map((media, index) => (
                  <button type="button" key={`thumb-${media.id || index}`} onClick={() => setCurrentPhoto(index)} className={`relative h-16 rounded-lg overflow-hidden border ${index === currentPhoto ? 'border-amber-400' : 'border-white/10'} bg-black`}>
                    {isVideo(media) ? <><video src={media.url} muted preload="metadata" className="w-full h-full object-cover opacity-70" /><Play size={18} className="absolute inset-0 m-auto text-white" /></> : <img src={media.url} alt={media.alt || property.title} className="w-full h-full object-cover" />}
                  </button>
                ))}
              </div>
            )}

            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className={`px-3 py-1 text-xs font-bold rounded ${property.operation === 'venta' ? 'bg-amber-400 text-black' : 'bg-green-500 text-white'}`}>{property.operation === 'venta' ? 'En Venta' : 'En Renta'}</span>
                <span className="px-3 py-1 text-xs rounded bg-white/10 text-gray-300 capitalize">{property.type}</span>
                {property.status !== 'available' && <span className="px-3 py-1 text-xs rounded bg-red-500/20 text-red-400 capitalize">{property.status}</span>}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{property.title}</h1>
              <div className="flex items-center gap-2 text-gray-400 mb-4"><MapPin size={16} /> {property.city}, {property.state}, {property.country}</div>
              <p className="text-3xl font-bold text-amber-400 mb-6">${property.price.toLocaleString('es-MX')} {property.currency}{property.operation === 'renta' ? '/mes' : ''}</p>

              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {property.bedrooms != null && <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl"><Bed size={18} className="text-amber-400" /><span className="text-white">{property.bedrooms} recámaras</span></div>}
                {property.bathrooms != null && <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl"><Bath size={18} className="text-amber-400" /><span className="text-white">{property.bathrooms} baños</span></div>}
                {property.area != null && <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl"><Maximize size={18} className="text-amber-400" /><span className="text-white">{property.area} m²</span></div>}
                {property.parking != null && <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl"><Car size={18} className="text-amber-400" /><span className="text-white">{property.parking} estacionamientos</span></div>}
              </div>

              <section className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-3">Descripción</h2>
                <p className="text-gray-400 leading-relaxed whitespace-pre-line">{property.description}</p>
              </section>

              {features.length > 0 && (
                <section className="mb-6">
                  <h2 className="text-lg font-semibold text-white mb-3">Características</h2>
                  <div className="flex flex-wrap gap-2">{features.map(feature => <span key={feature} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300">{feature}</span>)}</div>
                </section>
              )}

              {property.lat != null && property.lng != null && (
                <section className="mb-6">
                  <h2 className="text-lg font-semibold text-white mb-3">Ubicación</h2>
                  <div className="h-64 rounded-2xl overflow-hidden border border-white/10">
                    <MapContainer center={[property.lat, property.lng]} zoom={15} className="h-full w-full" scrollWheelZoom={false}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap contributors" />
                      <Marker position={[property.lat, property.lng]}><Popup>{property.title}</Popup></Marker>
                    </MapContainer>
                  </div>
                </section>
              )}
            </motion.div>
          </div>

          <aside className="space-y-6">
            <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
              <h3 className="font-semibold text-white mb-4">¿Te interesa esta propiedad?</h3>
              {submitted ? (
                <p className="text-green-400">Consulta enviada. Te contactaremos pronto.</p>
              ) : (
                <form onSubmit={handleInquiry} className="space-y-3">
                  <input type="text" name="honeypot" value={formData.honeypot} onChange={event => setFormData({ ...formData, honeypot: event.target.value })} className="hidden" tabIndex={-1} autoComplete="off" />
                  <input type="text" placeholder="Nombre" required value={formData.name} onChange={event => setFormData({ ...formData, name: event.target.value })} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm" />
                  <input type="email" placeholder="Email" required value={formData.email} onChange={event => setFormData({ ...formData, email: event.target.value })} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm" />
                  <input type="tel" placeholder="Teléfono" value={formData.phone} onChange={event => setFormData({ ...formData, phone: event.target.value })} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm" />
                  <textarea placeholder="Mensaje" required rows={3} value={formData.message} onChange={event => setFormData({ ...formData, message: event.target.value })} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm resize-none" />
                  <button type="submit" disabled={submitting} className="w-full py-2.5 bg-amber-500 text-white font-semibold rounded-lg disabled:opacity-50">{submitting ? 'Enviando...' : 'Enviar Consulta'}</button>
                </form>
              )}
            </div>

            {whatsappNumber && <a href={`https://wa.me/${whatsappNumber}?text=${whatsappText}`} target="_blank" rel="noopener noreferrer" className="flex items-center justify-center gap-2 p-4 bg-green-600 rounded-2xl text-white font-semibold"><MessageCircle size={20} /> WhatsApp</a>}
            {phoneHref && <a href={phoneHref} className="flex items-center justify-center gap-2 p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-300 font-medium"><Phone size={20} /> Llamar</a>}
            {emailHref && <a href={emailHref} className="flex items-center justify-center gap-2 p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-300 font-medium"><Mail size={20} /> Enviar correo</a>}

            {related.length > 0 && (
              <div>
                <h3 className="font-semibold text-white mb-4">Propiedades Similares</h3>
                <div className="space-y-3">
                  {related.map(item => (
                    <Link key={item.id} to={`/propiedades/${item.slug}`} className="block group">
                      <div className="flex gap-3 p-3 bg-white/5 rounded-xl border border-white/5">
                        <img src={firstImage(item)?.url || '/images/placeholder.svg'} alt={item.title} className="w-16 h-16 rounded-lg object-cover" />
                        <div><p className="text-sm font-medium text-white">{item.title}</p><p className="text-xs text-gray-400">{item.city}</p><p className="text-sm font-bold text-amber-400">${item.price.toLocaleString('es-MX')}</p></div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </aside>
        </div>
      </div>
    </main>
  );
};

export default PropertyDetailPage;
