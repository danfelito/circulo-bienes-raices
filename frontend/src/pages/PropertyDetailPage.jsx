import React, { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import { motion } from 'framer-motion';
import { MapPin, Bed, Bath, Maximize, Car, Calendar, ArrowLeft, MessageCircle, Phone, ChevronLeft, ChevronRight } from 'lucide-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import api from '../api';

// Fix leaflet default marker icon
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

const PropertyDetailPage = () => {
  const { slug } = useParams();
  const [property, setProperty] = useState(null);
  const [related, setRelated] = useState([]);
  const [loading, setLoading] = useState(true);
  const [currentPhoto, setCurrentPhoto] = useState(0);
  const [formData, setFormData] = useState({ name: '', email: '', phone: '', message: '', honeypot: '' });
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    setLoading(true);
    api.getProperty(slug)
      .then(data => {
        setProperty(data.property);
        setRelated(data.related || []);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [slug]);

  const handleInquiry = async (e) => {
    e.preventDefault();
    try {
      await api.submitInquiry({ ...formData, propertyId: property?.id });
      setSubmitted(true);
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <main className="pt-20 min-h-screen bg-[#0a0a0a] text-center py-16 text-gray-500">Cargando propiedad...</main>;
  if (!property) return <main className="pt-20 min-h-screen bg-[#0a0a0a] text-center py-16"><p className="text-gray-400">Propiedad no encontrada</p><Link to="/propiedades" className="text-amber-400 hover:underline">Volver al catálogo</Link></main>;

  const features = property.features ? JSON.parse(property.features) : [];
  const photos = property.photos || [];

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Back */}
        <Link to="/propiedades" className="inline-flex items-center gap-2 text-sm text-gray-400 hover:text-amber-400 mb-6">
          <ArrowLeft size={16} /> Volver al catálogo
        </Link>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Main content */}
          <div className="lg:col-span-2 space-y-6">
            {/* Photo Gallery */}
            <div className="relative h-64 sm:h-96 rounded-2xl overflow-hidden bg-white/5">
              {photos.length > 0 ? (
                <>
                  <img
                    src={photos[currentPhoto]?.url}
                    alt={property.title}
                    className="w-full h-full object-cover"
                  />
                  {photos.length > 1 && (
                    <>
                      <button onClick={() => setCurrentPhoto(p => (p - 1 + photos.length) % photos.length)}
                        className="absolute left-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80">
                        <ChevronLeft size={20} />
                      </button>
                      <button onClick={() => setCurrentPhoto(p => (p + 1) % photos.length)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 p-2 bg-black/60 rounded-full text-white hover:bg-black/80">
                        <ChevronRight size={20} />
                      </button>
                      <div className="absolute bottom-3 left-1/2 -translate-x-1/2 flex gap-1.5">
                        {photos.map((_, i) => (
                          <button key={i} onClick={() => setCurrentPhoto(i)}
                            className={`w-2 h-2 rounded-full ${i === currentPhoto ? 'bg-amber-400' : 'bg-white/40'}`}
                          />
                        ))}
                      </div>
                    </>
                  )}
                </>
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500">Sin fotos</div>
              )}
            </div>

            {/* Info */}
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
              <div className="flex items-center gap-3 mb-2">
                <span className={`px-3 py-1 text-xs font-bold rounded ${
                  property.operation === 'venta' ? 'bg-amber-400 text-black' : 'bg-green-500 text-white'
                }`}>
                  {property.operation === 'venta' ? 'En Venta' : 'En Renta'}
                </span>
                <span className="px-3 py-1 text-xs rounded bg-white/10 text-gray-300 capitalize">{property.type}</span>
                {property.status !== 'available' && (
                  <span className="px-3 py-1 text-xs rounded bg-red-500/20 text-red-400 capitalize">{property.status === 'sold' ? 'Vendida' : 'Rentada'}</span>
                )}
              </div>
              <h1 className="text-2xl sm:text-3xl font-bold text-white mb-2">{property.title}</h1>
              <div className="flex items-center gap-2 text-gray-400 mb-4">
                <MapPin size={16} /> {property.city}, {property.state}, {property.country}
              </div>
              <p className="text-3xl font-bold text-amber-400 mb-6">
                {property.operation === 'renta'
                  ? `$${property.price.toLocaleString()} ${property.currency}/mes`
                  : `$${property.price.toLocaleString()} ${property.currency}`}
              </p>

              {/* Features row */}
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-6">
                {property.bedrooms && (
                  <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
                    <Bed size={18} className="text-amber-400" /><span className="text-white">{property.bedrooms} recámaras</span>
                  </div>
                )}
                {property.bathrooms && (
                  <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
                    <Bath size={18} className="text-amber-400" /><span className="text-white">{property.bathrooms} baños</span>
                  </div>
                )}
                {property.area && (
                  <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
                    <Maximize size={18} className="text-amber-400" /><span className="text-white">{property.area} m²</span>
                  </div>
                )}
                {property.parking && (
                  <div className="flex items-center gap-2 p-3 bg-white/5 rounded-xl">
                    <Car size={18} className="text-amber-400" /><span className="text-white">{property.parking} estacionamientos</span>
                  </div>
                )}
              </div>

              {/* Description */}
              <div className="mb-6">
                <h2 className="text-lg font-semibold text-white mb-3">Descripción</h2>
                <p className="text-gray-400 leading-relaxed whitespace-pre-line">{property.description}</p>
              </div>

              {/* Amenities */}
              {features.length > 0 && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-white mb-3">Características</h2>
                  <div className="flex flex-wrap gap-2">
                    {features.map(f => (
                      <span key={f} className="px-3 py-1.5 bg-white/5 border border-white/10 rounded-lg text-sm text-gray-300">{f}</span>
                    ))}
                  </div>
                </div>
              )}

              {/* Map */}
              {property.lat && property.lng && (
                <div className="mb-6">
                  <h2 className="text-lg font-semibold text-white mb-3">Ubicación</h2>
                  <div className="h-64 rounded-2xl overflow-hidden border border-white/10">
                    <MapContainer center={[property.lat, property.lng]} zoom={15} className="h-full w-full" scrollWheelZoom={false}>
                      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution='&copy; OpenStreetMap' />
                      <Marker position={[property.lat, property.lng]}>
                        <Popup>{property.title}</Popup>
                      </Marker>
                    </MapContainer>
                  </div>
                </div>
              )}
            </motion.div>
          </div>

          {/* Sidebar */}
          <div className="space-y-6">
            {/* Contact form */}
            <div className="p-6 bg-white/5 rounded-2xl border border-white/5">
              <h3 className="font-semibold text-white mb-4">¿Te interesa esta propiedad?</h3>
              {submitted ? (
                <p className="text-green-400">✅ ¡Consulta enviada! Te contactaremos pronto.</p>
              ) : (
                <form onSubmit={handleInquiry} className="space-y-3">
                  <input type="text" name="honeypot" value={formData.honeypot} onChange={e => setFormData({...formData, honeypot: e.target.value})} className="hidden" tabIndex={-1} autoComplete="off" />
                  <input type="text" placeholder="Nombre" required value={formData.name} onChange={e => setFormData({...formData, name: e.target.value})} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-amber-400/50 focus:outline-none text-sm" />
                  <input type="email" placeholder="Email" required value={formData.email} onChange={e => setFormData({...formData, email: e.target.value})} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-amber-400/50 focus:outline-none text-sm" />
                  <input type="tel" placeholder="Teléfono" value={formData.phone} onChange={e => setFormData({...formData, phone: e.target.value})} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-amber-400/50 focus:outline-none text-sm" />
                  <textarea placeholder="Mensaje" required rows={3} value={formData.message} onChange={e => setFormData({...formData, message: e.target.value})} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white placeholder-gray-500 focus:border-amber-400/50 focus:outline-none text-sm resize-none" />
                  <button type="submit" className="w-full py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-lg hover:from-amber-600 hover:to-amber-700 transition-all">
                    Enviar Consulta
                  </button>
                </form>
              )}
            </div>

            {/* WhatsApp */}
            <a
              href={`https://wa.me/522291234567?text=Hola, me interesa la propiedad: ${property.title}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center justify-center gap-2 p-4 bg-green-600 rounded-2xl text-white font-semibold hover:bg-green-700 transition-all"
            >
              <MessageCircle size={20} /> WhatsApp
            </a>

            {/* Call */}
            <a
              href="tel:+522291234567"
              className="flex items-center justify-center gap-2 p-4 bg-white/5 border border-white/10 rounded-2xl text-gray-300 font-medium hover:bg-white/10 transition-all"
            >
              <Phone size={20} /> Llamar
            </a>

            {/* Related */}
            {related.length > 0 && (
              <div>
                <h3 className="font-semibold text-white mb-4">Propiedades Similares</h3>
                <div className="space-y-3">
                  {related.map(r => (
                    <Link key={r.id} to={`/propiedades/${r.slug}`} className="block group">
                      <div className="flex gap-3 p-3 bg-white/5 rounded-xl hover:border-amber-400/20 border border-white/5 transition-all">
                        <img src={r.photos?.[0]?.url || '/images/placeholder.jpg'} alt={r.title} className="w-16 h-16 rounded-lg object-cover" />
                        <div>
                          <p className="text-sm font-medium text-white group-hover:text-amber-400 transition-colors">{r.title}</p>
                          <p className="text-xs text-gray-400">{r.city}</p>
                          <p className="text-sm font-bold text-amber-400">${r.price.toLocaleString()}</p>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
    </main>
  );
};

export default PropertyDetailPage;
