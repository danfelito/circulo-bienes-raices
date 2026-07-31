import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Image, Play, Save, Star, Upload, X } from 'lucide-react';
import api from '../../api';

const emptyForm = {
  title: '', slug: '', description: '', operation: 'venta', type: 'casa',
  price: '', currency: 'MXN', bedrooms: '', bathrooms: '', area: '', lotArea: '',
  parking: '', yearBuilt: '', city: '', state: 'Veracruz', country: 'México',
  address: '', lat: '', lng: '', features: '', status: 'available', featured: false,
  published: true,
};

const parseFeatures = value => {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.join(', ') : '';
  } catch {
    return '';
  }
};

const isVideo = media => media?.publicId?.startsWith('video:') || /\.(mp4|mov|m4v|webm|avi|mkv)(?:\?|$)/i.test(media?.url || '');

const AdminPropertyForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [form, setForm] = useState(emptyForm);
  const [photos, setPhotos] = useState([]);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    if (!isEdit) return;

    api.getAdminProperty(id)
      .then(prop => {
        setForm({
          title: prop.title || '',
          slug: prop.slug || '',
          description: prop.description || '',
          operation: prop.operation || 'venta',
          type: prop.type || 'casa',
          price: prop.price ?? '',
          currency: prop.currency || 'MXN',
          bedrooms: prop.bedrooms ?? '',
          bathrooms: prop.bathrooms ?? '',
          area: prop.area ?? '',
          lotArea: prop.lotArea ?? '',
          parking: prop.parking ?? '',
          yearBuilt: prop.yearBuilt ?? '',
          city: prop.city || '',
          state: prop.state || 'Veracruz',
          country: prop.country || 'México',
          address: prop.address || '',
          lat: prop.lat ?? '',
          lng: prop.lng ?? '',
          features: parseFeatures(prop.features),
          status: prop.status || 'available',
          featured: Boolean(prop.featured),
          published: prop.published !== false,
        });
        setPhotos(prop.photos || []);
      })
      .catch(err => {
        alert(err.message);
        navigate('/admin/propiedades');
      })
      .finally(() => setLoading(false));
  }, [id, isEdit, navigate]);

  const handleChange = event => {
    const { name, value, type, checked } = event.target;
    setForm(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async event => {
    event.preventDefault();
    setSaving(true);

    const data = {
      ...form,
      price: Number.parseFloat(form.price) || 0,
      bedrooms: form.bedrooms === '' ? null : Number.parseInt(form.bedrooms, 10),
      bathrooms: form.bathrooms === '' ? null : Number.parseFloat(form.bathrooms),
      area: form.area === '' ? null : Number.parseFloat(form.area),
      lotArea: form.lotArea === '' ? null : Number.parseFloat(form.lotArea),
      parking: form.parking === '' ? null : Number.parseInt(form.parking, 10),
      yearBuilt: form.yearBuilt === '' ? null : Number.parseInt(form.yearBuilt, 10),
      lat: form.lat === '' ? null : Number.parseFloat(form.lat),
      lng: form.lng === '' ? null : Number.parseFloat(form.lng),
      features: form.features
        ? JSON.stringify(form.features.split(',').map(item => item.trim()).filter(Boolean))
        : null,
    };

    try {
      if (isEdit) await api.updateProperty(id, data);
      else await api.createProperty(data);
      navigate('/admin/propiedades');
    } catch (err) {
      alert(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async event => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (!isEdit) {
      alert('Primero guarda la propiedad para poder subir fotografías o videos');
      return;
    }

    setUploading(true);
    try {
      const uploaded = await api.uploadPhotos(id, files);
      setPhotos(current => [...current, ...uploaded]);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDeletePhoto = async photoId => {
    if (!window.confirm('¿Eliminar este archivo?')) return;
    try {
      await api.deletePhoto(id, photoId);
      setPhotos(current => current.filter(photo => photo.id !== photoId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSetMain = async photoId => {
    try {
      await api.setMainPhoto(id, photoId);
      setPhotos(current => current.map(photo => ({ ...photo, isMain: photo.id === photoId })));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return <main className="pt-20 min-h-screen bg-[#0a0a0a] text-center py-16 text-gray-500">Cargando...</main>;
  }

  const inputClass = 'w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm';
  const fields = [
    ['title', 'Título *', 'text', true], ['slug', 'Slug', 'text'],
    ['price', 'Precio *', 'number', true], ['currency', 'Moneda', 'text'],
    ['bedrooms', 'Recámaras', 'number'], ['bathrooms', 'Baños', 'number'],
    ['area', 'Área construcción (m²)', 'number'], ['lotArea', 'Área terreno (m²)', 'number'],
    ['parking', 'Estacionamientos', 'number'], ['yearBuilt', 'Año de construcción', 'number'],
    ['city', 'Ciudad *', 'text', true], ['state', 'Estado', 'text'],
    ['country', 'País', 'text'], ['address', 'Dirección', 'text'],
    ['lat', 'Latitud', 'number'], ['lng', 'Longitud', 'number'],
  ];

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-4xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? 'Editar Propiedad' : 'Nueva Propiedad'}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-semibold text-white">Información de la propiedad</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {fields.map(([name, label, type, required]) => (
                <label key={name} className="text-xs text-gray-400">
                  <span className="mb-1 block">{label}</span>
                  <input name={name} type={type} step={['lat', 'lng', 'bathrooms'].includes(name) ? 'any' : undefined} value={form[name]} onChange={handleChange} required={required} className={inputClass} />
                </label>
              ))}
            </div>

            <label className="text-xs text-gray-400 block">
              <span className="mb-1 block">Descripción *</span>
              <textarea name="description" value={form.description} onChange={handleChange} required rows={5} className={`${inputClass} resize-none`} />
            </label>

            <label className="text-xs text-gray-400 block">
              <span className="mb-1 block">Características separadas por coma</span>
              <input name="features" value={form.features} onChange={handleChange} className={inputClass} placeholder="Alberca, jardín, seguridad" />
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <label className="text-xs text-gray-400">Operación
                <select name="operation" value={form.operation} onChange={handleChange} className={inputClass}>
                  <option value="venta">Venta</option><option value="renta">Renta</option>
                </select>
              </label>
              <label className="text-xs text-gray-400">Tipo
                <select name="type" value={form.type} onChange={handleChange} className={inputClass}>
                  {['casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', 'rancho', 'otros'].map(type => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-400">Estado
                <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
                  <option value="available">Disponible</option><option value="sold">Vendida</option><option value="rented">Rentada</option><option value="reserved">Reservada</option>
                </select>
              </label>
            </div>

            <div className="flex gap-6 text-sm text-gray-300">
              <label className="flex items-center gap-2"><input type="checkbox" name="featured" checked={form.featured} onChange={handleChange} /> Destacada</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="published" checked={form.published} onChange={handleChange} /> Publicada</label>
            </div>
          </section>

          {isEdit && (
            <section className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
              <div className="flex items-center justify-between gap-3">
                <div><h2 className="text-lg font-semibold text-white">Fotografías y videos</h2><p className="text-xs text-gray-500 mt-1">Las fotografías se optimizan para web; los videos conservan controles de reproducción.</p></div>
                <label className="flex items-center gap-2 px-4 py-2 bg-amber-400/10 border border-amber-400/20 text-amber-400 rounded-lg cursor-pointer">
                  <Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir medios'}
                  <input type="file" accept="image/*,video/*" multiple onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                </label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {photos.map(photo => {
                  const video = isVideo(photo);
                  return <div key={photo.id} className="relative group bg-black/40 rounded-lg overflow-hidden">
                    {video ? <video src={photo.url} className="w-full h-32 object-cover" muted preload="metadata" /> : <img src={photo.url} alt={photo.alt || form.title} className="w-full h-32 object-cover" />}
                    {photo.isMain && !video && <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-400 text-black text-xs rounded flex items-center gap-1"><Star size={10} /> Principal</span>}
                    {video && <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-black/70 text-white text-xs rounded flex items-center gap-1"><Play size={10} /> Video</span>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 rounded-lg flex items-center justify-center gap-2">
                      {!video && !photo.isMain && <button type="button" onClick={() => handleSetMain(photo.id)} className="p-2 bg-amber-400 text-black rounded" aria-label="Establecer foto principal"><Star size={14} /></button>}
                      <button type="button" onClick={() => handleDeletePhoto(photo.id)} className="p-2 bg-red-500 text-white rounded" aria-label="Eliminar archivo"><X size={14} /></button>
                    </div>
                  </div>;
                })}
                {!photos.length && <div className="col-span-full text-center py-8 text-gray-500"><Image size={32} className="mx-auto mb-2" />Sin fotografías ni videos</div>}
              </div>
            </section>
          )}

          {!isEdit && <p className="text-sm text-gray-400">Guarda la propiedad y después entra a editarla para subir fotografías o videos.</p>}

          <div className="flex gap-4">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-amber-500 text-white font-semibold rounded-lg disabled:opacity-50"><Save size={18} /> {saving ? 'Guardando...' : isEdit ? 'Guardar cambios' : 'Crear propiedad'}</button>
            <button type="button" onClick={() => navigate('/admin/propiedades')} className="px-6 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-lg">Cancelar</button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default AdminPropertyForm;
