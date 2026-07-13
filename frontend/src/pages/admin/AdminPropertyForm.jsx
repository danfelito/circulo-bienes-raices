import React, { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Image, Save, Star, Upload, X } from 'lucide-react';
import api from '../../api';

const emptyForm = {
  referenceCode: '', title: '', slug: '', description: '', operation: 'venta', type: 'casa',
  price: '', currency: 'MXN', bedrooms: '', bathrooms: '', area: '', lotArea: '',
  parking: '', yearBuilt: '', city: '', state: 'Veracruz', country: 'México',
  address: '', lat: '', lng: '', features: '', status: 'available', featured: false, published: true,
};

const Field = ({ label, children }) => (
  <div>
    <label className="text-xs text-gray-400 mb-1 block">{label}</label>
    {children}
  </div>
);

const inputClass = 'w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/50 focus:outline-none text-sm';

const AdminPropertyForm = () => {
  const navigate = useNavigate();
  const { id } = useParams();
  const isEdit = Boolean(id);
  const [loading, setLoading] = useState(isEdit);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [photos, setPhotos] = useState([]);
  const [form, setForm] = useState(emptyForm);

  useEffect(() => {
    if (!isEdit) return;
    api.getAdminProperty(id)
      .then((property) => {
        let features = '';
        try {
          const parsed = JSON.parse(property.features || '[]');
          features = Array.isArray(parsed) ? parsed.join(', ') : '';
        } catch (_) {
          features = property.features || '';
        }
        setForm({
          referenceCode: property.referenceCode || '',
          title: property.title || '',
          slug: property.slug || '',
          description: property.description || '',
          operation: property.operation || 'venta',
          type: property.type || 'casa',
          price: property.price ?? '',
          currency: property.currency || 'MXN',
          bedrooms: property.bedrooms ?? '',
          bathrooms: property.bathrooms ?? '',
          area: property.area ?? '',
          lotArea: property.lotArea ?? '',
          parking: property.parking ?? '',
          yearBuilt: property.yearBuilt ?? '',
          city: property.city || '',
          state: property.state || 'Veracruz',
          country: property.country || 'México',
          address: property.address || '',
          lat: property.lat ?? '',
          lng: property.lng ?? '',
          features,
          status: property.status || 'available',
          featured: Boolean(property.featured),
          published: property.published !== false,
        });
        setPhotos(property.photos || []);
      })
      .catch((error) => {
        alert(error.message);
        navigate('/admin/propiedades', { replace: true });
      })
      .finally(() => setLoading(false));
  }, [id, isEdit, navigate]);

  const handleChange = (event) => {
    const { name, value, type, checked } = event.target;
    setForm((current) => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const handleSubmit = async (event) => {
    event.preventDefault();
    setSaving(true);
    try {
      const payload = {
        ...form,
        price: Number.parseFloat(form.price) || 0,
        bedrooms: form.bedrooms === '' ? null : Number.parseInt(form.bedrooms, 10),
        bathrooms: form.bathrooms === '' ? null : Number.parseInt(form.bathrooms, 10),
        area: form.area === '' ? null : Number.parseFloat(form.area),
        lotArea: form.lotArea === '' ? null : Number.parseFloat(form.lotArea),
        parking: form.parking === '' ? null : Number.parseInt(form.parking, 10),
        yearBuilt: form.yearBuilt === '' ? null : Number.parseInt(form.yearBuilt, 10),
        lat: form.lat === '' ? null : Number.parseFloat(form.lat),
        lng: form.lng === '' ? null : Number.parseFloat(form.lng),
        features: form.features
          ? JSON.stringify(form.features.split(',').map((item) => item.trim()).filter(Boolean))
          : null,
      };

      if (isEdit) await api.updateProperty(id, payload);
      else await api.createProperty(payload);
      navigate('/admin/propiedades');
    } catch (error) {
      alert(error.message);
    } finally {
      setSaving(false);
    }
  };

  const handlePhotoUpload = async (event) => {
    const files = Array.from(event.target.files || []);
    if (!files.length) return;
    if (!isEdit) {
      alert('Guarda primero la propiedad y después agrega fotografías.');
      return;
    }
    setUploading(true);
    try {
      const uploaded = await api.uploadPhotos(id, files);
      setPhotos((current) => [...current, ...uploaded]);
    } catch (error) {
      alert(error.message);
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
    } catch (error) {
      alert(error.message);
    }
  };

  const handleSetMain = async (photoId) => {
    try {
      await api.setMainPhoto(id, photoId);
      setPhotos((current) => current.map((photo) => ({ ...photo, isMain: photo.id === photoId })));
    } catch (error) {
      alert(error.message);
    }
  };

  if (loading) {
    return <main className="pt-20 min-h-screen bg-[#0a0a0a] text-center py-16 text-gray-500">Cargando...</main>;
  }

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <h1 className="text-2xl font-bold text-white mb-6">{isEdit ? 'Editar propiedad' : 'Nueva propiedad'}</h1>

        <form onSubmit={handleSubmit} className="space-y-6">
          <section className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-semibold text-white">Información básica</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Código de referencia">
                <input name="referenceCode" value={form.referenceCode} onChange={handleChange} className={inputClass} placeholder="MX-VER-0001" />
              </Field>
              <div className="md:col-span-2">
                <Field label="Título *">
                  <input name="title" value={form.title} onChange={handleChange} required className={inputClass} />
                </Field>
              </div>
              <div className="md:col-span-3">
                <Field label="Slug">
                  <input name="slug" value={form.slug} onChange={handleChange} className={inputClass} placeholder="se-genera-automaticamente" />
                </Field>
              </div>
            </div>
            <Field label="Descripción *">
              <textarea name="description" value={form.description} onChange={handleChange} required rows={6} className={`${inputClass} resize-y`} />
            </Field>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Operación">
                <select name="operation" value={form.operation} onChange={handleChange} className={inputClass}>
                  <option value="venta" className="bg-[#111]">Venta</option>
                  <option value="renta" className="bg-[#111]">Renta</option>
                </select>
              </Field>
              <Field label="Tipo">
                <select name="type" value={form.type} onChange={handleChange} className={inputClass}>
                  {['casa', 'departamento', 'terreno', 'oficina', 'local', 'otros'].map((value) => <option key={value} value={value} className="bg-[#111]">{value}</option>)}
                </select>
              </Field>
              <Field label="Estado comercial">
                <select name="status" value={form.status} onChange={handleChange} className={inputClass}>
                  <option value="available" className="bg-[#111]">Disponible</option>
                  <option value="sold" className="bg-[#111]">Vendida</option>
                  <option value="rented" className="bg-[#111]">Rentada</option>
                  <option value="reserved" className="bg-[#111]">Reservada</option>
                  <option value="archived" className="bg-[#111]">Archivada</option>
                </select>
              </Field>
            </div>
          </section>

          <section className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-semibold text-white">Precio y características</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
              <Field label="Precio *"><input name="price" type="number" min="0" step="any" value={form.price} onChange={handleChange} required className={inputClass} /></Field>
              <Field label="Moneda"><select name="currency" value={form.currency} onChange={handleChange} className={inputClass}><option className="bg-[#111]">MXN</option><option className="bg-[#111]">USD</option><option className="bg-[#111]">COP</option></select></Field>
              <Field label="Recámaras"><input name="bedrooms" type="number" min="0" value={form.bedrooms} onChange={handleChange} className={inputClass} /></Field>
              <Field label="Baños"><input name="bathrooms" type="number" min="0" value={form.bathrooms} onChange={handleChange} className={inputClass} /></Field>
              <Field label="Construcción m²"><input name="area" type="number" min="0" step="any" value={form.area} onChange={handleChange} className={inputClass} /></Field>
              <Field label="Terreno m²"><input name="lotArea" type="number" min="0" step="any" value={form.lotArea} onChange={handleChange} className={inputClass} /></Field>
              <Field label="Estacionamientos"><input name="parking" type="number" min="0" value={form.parking} onChange={handleChange} className={inputClass} /></Field>
              <Field label="Año"><input name="yearBuilt" type="number" value={form.yearBuilt} onChange={handleChange} className={inputClass} /></Field>
            </div>
            <Field label="Amenidades separadas por coma">
              <input name="features" value={form.features} onChange={handleChange} className={inputClass} placeholder="Alberca, jardín, seguridad" />
            </Field>
          </section>

          <section className="p-6 bg-white/5 rounded-2xl border border-white/5 space-y-4">
            <h2 className="text-lg font-semibold text-white">Ubicación</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <Field label="Ciudad *"><input name="city" value={form.city} onChange={handleChange} required className={inputClass} /></Field>
              <Field label="Estado"><input name="state" value={form.state} onChange={handleChange} className={inputClass} /></Field>
              <Field label="País"><input name="country" value={form.country} onChange={handleChange} className={inputClass} /></Field>
              <div className="md:col-span-3"><Field label="Dirección"><input name="address" value={form.address} onChange={handleChange} className={inputClass} /></Field></div>
              <Field label="Latitud"><input name="lat" type="number" step="any" value={form.lat} onChange={handleChange} className={inputClass} /></Field>
              <Field label="Longitud"><input name="lng" type="number" step="any" value={form.lng} onChange={handleChange} className={inputClass} /></Field>
            </div>
          </section>

          <section className="p-6 bg-white/5 rounded-2xl border border-white/5">
            <h2 className="text-lg font-semibold text-white mb-4">Publicación</h2>
            <div className="flex flex-wrap gap-6">
              <label className="flex items-center gap-2 text-sm text-gray-300"><input name="published" type="checkbox" checked={form.published} onChange={handleChange} /> Publicada en el sitio</label>
              <label className="flex items-center gap-2 text-sm text-gray-300"><input name="featured" type="checkbox" checked={form.featured} onChange={handleChange} /> Propiedad destacada</label>
            </div>
          </section>

          {isEdit && (
            <section className="p-6 bg-white/5 rounded-2xl border border-white/5">
              <div className="flex items-center justify-between gap-4 mb-4">
                <div><h2 className="text-lg font-semibold text-white">Fotografías</h2><p className="text-xs text-gray-400">JPG, PNG, WEBP o AVIF; máximo 12 MB cada una.</p></div>
                <label className="cursor-pointer flex items-center gap-2 px-4 py-2 bg-white/10 rounded-lg text-sm hover:bg-white/15">
                  <Upload size={17} /> {uploading ? 'Subiendo...' : 'Agregar'}
                  <input type="file" multiple accept="image/jpeg,image/png,image/webp,image/avif" className="hidden" disabled={uploading} onChange={handlePhotoUpload} />
                </label>
              </div>
              {photos.length ? (
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {photos.map((photo) => (
                    <div key={photo.id} className="relative aspect-square rounded-xl overflow-hidden border border-white/10 group">
                      <img src={photo.url} alt={photo.alt || form.title} className="w-full h-full object-cover" />
                      {photo.isMain && <span className="absolute left-2 top-2 text-xs bg-amber-500 text-black px-2 py-1 rounded">Portada</span>}
                      <div className="absolute inset-x-0 bottom-0 flex justify-end gap-2 p-2 bg-black/60 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button type="button" title="Usar como portada" onClick={() => handleSetMain(photo.id)} className="p-1.5 bg-amber-500 text-black rounded"><Star size={14} /></button>
                        <button type="button" title="Eliminar" onClick={() => handleDeletePhoto(photo.id)} className="p-1.5 bg-red-500 text-white rounded"><X size={14} /></button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : <div className="py-8 text-center text-gray-500"><Image className="mx-auto mb-2" />Sin fotografías</div>}
            </section>
          )}

          <div className="flex justify-end gap-3">
            <button type="button" onClick={() => navigate('/admin/propiedades')} className="px-5 py-2.5 rounded-lg bg-white/10 text-white">Cancelar</button>
            <button type="submit" disabled={saving} className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-amber-500 text-black font-semibold disabled:opacity-50"><Save size={17} />{saving ? 'Guardando...' : 'Guardar'}</button>
          </div>
        </form>
      </div>
    </main>
  );
};

export default AdminPropertyForm;
