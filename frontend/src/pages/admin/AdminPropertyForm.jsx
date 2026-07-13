import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Image, Save, Star, Upload, X } from 'lucide-react';
import api from '../../api';

const emptyForm = {
  referenceCode: '',
  title: '',
  slug: '',
  shortDescription: '',
  description: '',
  operation: 'venta',
  type: 'casa',
  price: '',
  currency: 'MXN',
  bedrooms: '',
  bathrooms: '',
  area: '',
  lotArea: '',
  parking: '',
  yearBuilt: '',
  city: '',
  state: 'Veracruz',
  country: 'México',
  neighborhood: '',
  address: '',
  lat: '',
  lng: '',
  features: '',
  status: 'available',
  featured: false,
  published: true,
  contactName: '',
  contactPhone: '',
  contactEmail: '',
  whatsapp: '',
};

const safeFeatures = (value) => {
  if (!value) return '';
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed.join(', ') : '';
  } catch {
    return '';
  }
};

const AdminPropertyForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [photos, setPhotos] = useState([]);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!isEdit) return;
    api.getAdminProperty(id)
      .then((property) => {
        setForm({
          ...emptyForm,
          ...property,
          referenceCode: property.referenceCode || '',
          shortDescription: property.shortDescription || '',
          bedrooms: property.bedrooms ?? '',
          bathrooms: property.bathrooms ?? '',
          area: property.area ?? '',
          lotArea: property.lotArea ?? '',
          parking: property.parking ?? '',
          yearBuilt: property.yearBuilt ?? '',
          neighborhood: property.neighborhood || '',
          address: property.address || '',
          lat: property.lat ?? '',
          lng: property.lng ?? '',
          features: safeFeatures(property.features),
          contactName: property.contactName || '',
          contactPhone: property.contactPhone || '',
          contactEmail: property.contactEmail || '',
          whatsapp: property.whatsapp || '',
        });
        setPhotos(property.photos || []);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  }, [id, isEdit]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setError('');
    try {
      const data = {
        ...form,
        price: Number(form.price) || 0,
        bedrooms: form.bedrooms === '' ? null : Number.parseInt(form.bedrooms, 10),
        bathrooms: form.bathrooms === '' ? null : Number.parseInt(form.bathrooms, 10),
        area: form.area === '' ? null : Number(form.area),
        lotArea: form.lotArea === '' ? null : Number(form.lotArea),
        parking: form.parking === '' ? null : Number.parseInt(form.parking, 10),
        yearBuilt: form.yearBuilt === '' ? null : Number.parseInt(form.yearBuilt, 10),
        lat: form.lat === '' ? null : Number(form.lat),
        lng: form.lng === '' ? null : Number(form.lng),
        features: form.features
          ? JSON.stringify(form.features.split(',').map((item) => item.trim()).filter(Boolean))
          : null,
      };

      if (isEdit) await api.updateProperty(id, data);
      else await api.createProperty(data);
      navigate('/admin/propiedades');
    } catch (err) {
      setError(err.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (!isEdit) {
      alert('Guarda la propiedad antes de subir fotografías.');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await api.uploadPhotos(id, files);
      setPhotos((current) => [...current, ...uploaded]);
    } catch (err) {
      alert(err.message);
    } finally {
      setUploading(false);
      event.target.value = '';
    }
  };

  const handleDeletePhoto = async (photoId) => {
    if (!window.confirm('¿Eliminar esta fotografía?')) return;
    try {
      await api.deletePhoto(id, photoId);
      setPhotos((current) => current.filter((photo) => photo.id !== photoId));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleSetMain = async (photoId) => {
    try {
      await api.setMainPhoto(id, photoId);
      setPhotos((current) => current.map((photo) => ({ ...photo, isMain: photo.id === photoId })));
    } catch (err) {
      alert(err.message);
    }
  };

  if (loading) {
    return <main className="pt-20 min-h-screen bg-[#0a0a0a] text-center py-16 text-gray-500">Cargando...</main>;
  }

  const inputClass = 'w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm';
  const sectionClass = 'p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4';

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? 'Editar propiedad' : 'Nueva propiedad'}</h1>

        {error && <div className="mb-5 p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-300">{error}</div>}

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className={sectionClass}>
            <h2 className="text-lg font-semibold text-white">Información básica</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className="text-xs text-gray-400">Código de referencia
                <input name="referenceCode" value={form.referenceCode} onChange={handleChange} className={`${inputClass} mt-1`} placeholder="MX-VER-0001" />
              </label>
              <label className="text-xs text-gray-400">Título *
                <input name="title" value={form.title} onChange={handleChange} required className={`${inputClass} mt-1`} />
              </label>
              <label className="text-xs text-gray-400">Slug
                <input name="slug" value={form.slug} onChange={handleChange} className={`${inputClass} mt-1`} placeholder="se-genera-automaticamente" />
              </label>
              <label className="text-xs text-gray-400">Descripción corta
                <input name="shortDescription" value={form.shortDescription} onChange={handleChange} className={`${inputClass} mt-1`} />
              </label>
            </div>
            <label className="text-xs text-gray-400">Descripción *
              <textarea name="description" value={form.description} onChange={handleChange} required rows={6} className={`${inputClass} mt-1 resize-y`} />
            </label>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="text-xs text-gray-400">Operación
                <select name="operation" value={form.operation} onChange={handleChange} className={`${inputClass} mt-1 bg-[#111]`}>
                  <option value="venta">Venta</option><option value="renta">Renta</option>
                </select>
              </label>
              <label className="text-xs text-gray-400">Tipo
                <select name="type" value={form.type} onChange={handleChange} className={`${inputClass} mt-1 bg-[#111]`}>
                  {['casa', 'departamento', 'terreno', 'oficina', 'local', 'otros'].map((type) => <option key={type} value={type}>{type}</option>)}
                </select>
              </label>
              <label className="text-xs text-gray-400">Estado
                <select name="status" value={form.status} onChange={handleChange} className={`${inputClass} mt-1 bg-[#111]`}>
                  <option value="available">Disponible</option><option value="reserved">Reservada</option><option value="sold">Vendida</option><option value="rented">Rentada</option><option value="archived">Archivada</option>
                </select>
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="text-lg font-semibold text-white">Precio y dimensiones</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              {[
                ['price', 'Precio *'], ['bedrooms', 'Recámaras'], ['bathrooms', 'Baños'], ['parking', 'Estacionamientos'],
                ['area', 'Construcción m²'], ['lotArea', 'Terreno m²'], ['yearBuilt', 'Año'],
              ].map(([name, label]) => (
                <label key={name} className="text-xs text-gray-400">{label}
                  <input name={name} type="number" step={name === 'price' || name.includes('Area') ? 'any' : '1'} value={form[name]} onChange={handleChange} required={name === 'price'} className={`${inputClass} mt-1`} />
                </label>
              ))}
              <label className="text-xs text-gray-400">Moneda
                <select name="currency" value={form.currency} onChange={handleChange} className={`${inputClass} mt-1 bg-[#111]`}><option>MXN</option><option>USD</option><option>COP</option></select>
              </label>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="text-lg font-semibold text-white">Ubicación</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {[
                ['country', 'País'], ['state', 'Estado/Departamento'], ['city', 'Ciudad *'], ['neighborhood', 'Colonia/Barrio'], ['address', 'Dirección'],
              ].map(([name, label]) => (
                <label key={name} className="text-xs text-gray-400">{label}
                  <input name={name} value={form[name]} onChange={handleChange} required={name === 'city'} className={`${inputClass} mt-1`} />
                </label>
              ))}
              <label className="text-xs text-gray-400">Latitud<input name="lat" type="number" step="any" value={form.lat} onChange={handleChange} className={`${inputClass} mt-1`} /></label>
              <label className="text-xs text-gray-400">Longitud<input name="lng" type="number" step="any" value={form.lng} onChange={handleChange} className={`${inputClass} mt-1`} /></label>
            </div>
          </section>

          <section className={sectionClass}>
            <h2 className="text-lg font-semibold text-white">Contacto y características</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {[
                ['contactName', 'Nombre de contacto'], ['contactPhone', 'Teléfono'], ['contactEmail', 'Email'], ['whatsapp', 'WhatsApp'],
              ].map(([name, label]) => (
                <label key={name} className="text-xs text-gray-400">{label}<input name={name} value={form[name]} onChange={handleChange} className={`${inputClass} mt-1`} /></label>
              ))}
            </div>
            <label className="text-xs text-gray-400">Amenidades separadas por coma
              <input name="features" value={form.features} onChange={handleChange} className={`${inputClass} mt-1`} placeholder="Alberca, Jardín, Seguridad" />
            </label>
            <div className="flex gap-6 text-sm text-gray-300">
              <label className="flex items-center gap-2"><input type="checkbox" name="featured" checked={form.featured} onChange={handleChange} className="accent-amber-400" /> Destacada</label>
              <label className="flex items-center gap-2"><input type="checkbox" name="published" checked={form.published} onChange={handleChange} className="accent-amber-400" /> Publicada</label>
            </div>
          </section>

          {isEdit && (
            <section className={sectionClass}>
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold text-white">Fotografías</h2>
                <label className="flex items-center gap-2 px-4 py-2 bg-amber-400/10 border border-amber-400/20 text-amber-400 rounded-lg cursor-pointer hover:bg-amber-400/20">
                  <Upload size={16} /> {uploading ? 'Subiendo...' : 'Subir fotos'}
                  <input type="file" accept="image/jpeg,image/png,image/webp,image/avif" multiple onChange={handlePhotoUpload} className="hidden" disabled={uploading} />
                </label>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                {photos.map((photo) => (
                  <div key={photo.id} className="relative group">
                    <img src={photo.url} alt={photo.alt || form.title} className="w-full h-32 object-cover rounded-lg" />
                    {photo.isMain && <span className="absolute top-1 left-1 px-1.5 py-0.5 bg-amber-400 text-black text-xs font-bold rounded flex items-center gap-1"><Star size={10} />Principal</span>}
                    <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity rounded-lg flex items-center justify-center gap-2">
                      {!photo.isMain && <button type="button" onClick={() => handleSetMain(photo.id)} className="p-1.5 bg-amber-400 text-black rounded"><Star size={14} /></button>}
                      <button type="button" onClick={() => handleDeletePhoto(photo.id)} className="p-1.5 bg-red-500 text-white rounded"><X size={14} /></button>
                    </div>
                  </div>
                ))}
                {!photos.length && <div className="col-span-full text-center py-8 text-gray-500"><Image size={32} className="mx-auto mb-2" />Sin fotografías</div>}
              </div>
            </section>
          )}

          {!isEdit && <p className="text-sm text-gray-400">Guarda primero la propiedad para poder añadir fotografías.</p>}

          <div className="flex gap-4">
            <button type="submit" disabled={saving} className="flex items-center gap-2 px-6 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-lg disabled:opacity-50">
              <Save size={18} /> {saving ? 'Guardando...' : (isEdit ? 'Guardar cambios' : 'Crear propiedad')}
            </button>
            <button type="button" onClick={() => navigate('/admin/propiedades')} className="px-6 py-2.5 bg-white/5 border border-white/10 text-gray-300 rounded-lg">Cancelar</button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default AdminPropertyForm;
