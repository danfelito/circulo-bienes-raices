import React, { useState, useEffect } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Save, Upload, X, Image, Star } from 'lucide-react';
import api from '../../api';

const AdminPropertyForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState([]);

  const [form, setForm] = useState({
    title: '', slug: '', description: '', operation: 'venta', type: 'casa',
    price: '', currency: 'MXN', bedrooms: '', bathrooms: '', area: '', lotArea: '',
    parking: '', yearBuilt: '', city: '', state: 'Veracruz', country: 'México',
    address: '', lat: '', lng: '', features: '', status: 'available', featured: false, published: true,
  });

  useEffect(() => {
    if (isEdit) {
      api.getProperty(id).then(() => {
        // Need to fetch by ID not slug for admin - use properties list
      }).catch(console.error);
      
      // Fetch property data by ID via the list endpoint
      api.getProperties({ limit: 100 }).then(data => {
        const prop = data.properties.find(p => p.id === id);
        if (prop) {
          setForm({
            title: prop.title || '',
            slug: prop.slug || '',
            description: prop.description || '',
            operation: prop.operation || 'venta',
            type: prop.type || 'casa',
            price: prop.price || '',
            currency: prop.currency || 'MXN',
            bedrooms: prop.bedrooms || '',
            bathrooms: prop.bathrooms || '',
            area: prop.area || '',
            lotArea: prop.lotArea || '',
            parking: prop.parking || '',
            yearBuilt: prop.yearBuilt || '',
            city: prop.city || '',
            state: prop.state || 'Veracruz',
            country: prop.country || 'México',
            address: prop.address || '',
            lat: prop.lat || '',
            lng: prop.lng || '',
            features: prop.features ? JSON.parse(prop.features).join(', ') : '',
            status: prop.status || 'available',
            featured: prop.featured || false,
            published: prop.published !== false,
          });
          setPhotos(prop.photos || []);
        }
        setLoading(false);
      });
    }
  }, [id]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setForm(prev => ({ ...prev, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    try {
      const data = {
        ...form,
        price: parseFloat(form.price) || 0,
        bedrooms: form.bedrooms ? parseInt(form.bedrooms) : null,
        bathrooms: form.bathrooms ? parseInt(form.bathrooms) : null,
        area: form.area ? parseFloat(form.area) : null,
        lotArea: form.lotArea ? parseFloat(form.lotArea) : null,
        parking: form.parking ? parseInt(form.parking) : null,
        yearBuilt: form.yearBuilt ? parseInt(form.yearBuilt) : null,
        lat: form.lat ? parseFloat(form.lat) : null,
        lng: form.lng ? parseFloat(form.lng) : null,
        features: form.features ? JSON.stringify(form.features.split(',').map(f => f.trim()).filter(Boolean)) : null,
      };

      if (isEdit) {
        await api.updateProperty(id, data);
      } else {
        await api.createProperty(data);
      }
      navigate('/admin/propiedades');
    } catch (err) {
      alert(err.message);
    }
  };

  const handlePhotoUpload = async (e) => {
    const files = Array.from(e.target.files);
    if (files.length === 0) return;

    // Need property ID to upload photos
    if (!isEdit) {
      alert('Primero guarda la propiedad para poder subir fotos');
      return;
    }

    setUploading(true);
    try {
      const uploaded = await api.uploadPhotos(id, files);
      setPhotos(prev => [...prev, ...uploaded]);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('¿Eliminar esta foto?')) return;
    try {
      await api.deletePhoto(id, photoId);
      setPhotos(prev => prev.filter(p => p.id !== photoId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSetMain = async (photoId) => {
    try {
      await api.setMainPhoto(id, photoId);
      setPhotos(prev => prev.map(p => ({ ...p, isMain: p.id === photoId })));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) return <main className="pt-20 min-h-screen bg-[#0a0a0a] text-center py-16 text-gray-500">Cargando...</main>;

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">
          {isEdit ? 'Editar Propiedad' : 'Nueva Propiedad'}
        </h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-semibold text-white">Información Básica</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Título *</label>
                <input name="title" value={form.title} onChange={handleChange} required className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Slug (auto-generado)</label>
                <input name="slug" value={form.slug} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" placeholder="se-genera-automaticamente" />
              </div>
            </div>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Descripción *</label>
              <textarea name="description" value={form.description} onChange={handleChange} required rows={5} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm resize-none" />
            </div>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Operación</label>
                <select name="operation" value={form.operation} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-400/50 focus:outline-none">
                  <option value="venta" className="bg-[#111]">Venta</option>
                  <option value="renta" className="bg-[#111]">Renta</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Tipo</label>
                <select name="type" value={form.type} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-400/50 focus:outline-none">
                  {['casa','departamento','terreno','oficina','local','otros'].map(t => <option key={t} value={t} className="bg-[#111]">{t.charAt(0).toUpperCase() + t.slice(1)}</option>)}
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Estado</label>
                <select name="status" value={form.status} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-400/50 focus:outline-none">
                  {['available','sold','rented','reserved'].map(s => <option key={s} value={s} className="bg-[#111]">{{available:'Disponible',sold:'Vendida',rented:'Rentada',reserved:'Reservada'}[s]}</option>)}
                </select>
              </div>
            </div>
          </div>

          {/* Price & Details */}
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-semibold text-white">Precio y Detalles</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Precio *</label>
                <input name="price" type="number" value={form.price} onChange={handleChange} required className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Moneda</label>
                <select name="currency" value={form.currency} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:border-amber-400/50 focus:outline-none">
                  <option value="MXN" className="bg-[#111]">MXN</option>
                  <option value="USD" className="bg-[#111]">USD</option>
                </select>
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Recámaras</label>
                <input name="bedrooms" type="number" value={form.bedrooms} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Baños</label>
                <input name="bathrooms" type="number" value={form.bathrooms} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Área (m²)</label>
                <input name="area" type="number" value={form.area} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Terreno (m²)</label>
                <input name="lotArea" type="number" value={form.lotArea} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Estacionamientos</label>
                <input name="parking" type="number" value={form.parking} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Año construcción</label>
                <input name="yearBuilt" type="number" value={form.yearBuilt} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
            </div>
          </div>

          {/* Location */}
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-semibold text-white">Ubicación</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Ciudad *</label>
                <input name="city" value={form.city} onChange={handleChange} required className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Dirección</label>
                <input name="address" value={form.address} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Latitud</label>
                <input name="lat" type="number" step="any" value={form.lat} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
              <div>
                <label className="text-xs text-gray-400 mb-1 block">Longitud</label>
                <input name="lng" type="number" step="any" value={form.lng} onChange={handleChange} className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
              </div>
            </div>
          </div>

          {/* Features & Options */}
          <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-semibold text-white">Características</h2>
            <div>
              <label className="text-xs text-gray-400 mb-1 block">Características (separadas por coma)</label>
              <input name="features" value={form.features} onChange={handleChange} placeholder="Alberca, Jardín, Seguridad 24/7" className="w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm" />
            </div>
            <div className="flex items-center gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" name="featured" checked={form.featured} onChange={handleChange} className="accent-amber-400" /> Destacada
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-300">
                <input type="checkbox" name="published" checked={form.published} onChange={handleChange} className="accent-amber-400" /> Publicada
              </label>
            </div>
          </div>

          {/* Photos */}
          {isEdit && (
            <div className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
              <h2 className="text-lg font-semibold text-white">Fotos</h2>
              
              {/* Upload */}
              <div className="flex items-center gap-3">
                <label className="flex items-center gap-2 px-4 py-2 bg-amber-400/10 border border-amber-400/20 text-amber-400 rounded-lg cursor-pointer hover:bg-amber-400/20">
                  <Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir Fotos'}
                  <input type="file" accept="image/*" multiple onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                </label>
              </div>

              {/* Photo grid */}
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {photos.map(photo => (
                  <div key={photo.id} className="relative group">
                    <img src={photo.url} alt={photo.alt || ''} className="w-full h-32 object-cover rounded-lg" />
                    {photo.isMain && <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-400 text-black text-xs font-bold rounded flex items-center gap-0.5"><Star size={10} />Principal</span>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      {!photo.isMain && (
                        <button onClick={() => handleSetMain(photo.id)} className="p-1.5 bg-amber-400 text-black rounded" title="Establecer como principal">
                          <Star size={14} />
                        </button>
                      )}
                      <button onClick={() => handleDeletePhoto(photo.id)} className="p-1.5 bg-red-500 text-white rounded" title="Eliminar">
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
                {photos.length === 0 && (
                  <div className="col-span-full text-center py-8 text-gray-500">
                    <Image size={32} className="mx-auto mb-2 opacity-50" />
                    <p className="text-sm">Sin fotos. Sube la primera imagen.</p>
                  </div>
                )}
              </div>
            </div>
          )}

          {!isEdit && (
            <p className="text-sm text-gray-400">💡 Guarda la propiedad primero para poder subir fotos después.</p>
          )}

          {/* Submit */}
          <div className="flex items-center gap-4">
            <button type="submit" className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-lg hover:from-amber-600 hover:to-amber-700">
              <Save size={18} /> {isEdit ? 'Guardar Cambios' : 'Crear Propiedad'}
            </button>
            <button type="button" onClick={() => navigate('/admin/propiedades')} className="px-6 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-lg hover:bg-white/10">
              Cancelar
            </button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default AdminPropertyForm;
