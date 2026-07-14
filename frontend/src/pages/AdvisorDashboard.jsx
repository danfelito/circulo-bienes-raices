import React, { useEffect, useMemo, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, CheckCircle2, Eye, ImagePlus, LogOut, MapPin, Plus, Trash2, Upload, Video } from 'lucide-react';
import api from '../api';
import BrandLogo from '../components/BrandLogo';

const initialForm = {
  title: '', description: '', operation: 'venta', type: 'casa', price: '', currency: 'MXN',
  bedrooms: '', bathrooms: '', area: '', lotArea: '', parking: '', city: 'Veracruz', state: 'Veracruz',
  country: 'México', address: '', lat: '', lng: '', features: '',
};

const inputClass = 'w-full rounded-xl border border-slate-300 bg-white px-4 py-3 text-slate-950 outline-none transition focus:border-[#d71920] focus:ring-4 focus:ring-red-100';

const AdvisorDashboard = () => {
  const navigate = useNavigate();
  const [user, setUser] = useState(null);
  const [properties, setProperties] = useState([]);
  const [form, setForm] = useState(initialForm);
  const [files, setFiles] = useState([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState(null);
  const [showForm, setShowForm] = useState(true);

  const fileSummary = useMemo(() => ({
    images: files.filter((file) => file.type.startsWith('image/')).length,
    videos: files.filter((file) => file.type.startsWith('video/')).length,
  }), [files]);

  const loadDashboard = async () => {
    try {
      const [{ user: currentUser }, myProperties] = await Promise.all([api.getMe(), api.getMyProperties()]);
      if (currentUser.role !== 'advisor' && currentUser.role !== 'admin') throw new Error('Acceso no autorizado');
      setUser(currentUser);
      setProperties(myProperties);
    } catch (error) {
      localStorage.removeItem('token');
      navigate('/asesores');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadDashboard(); }, []);

  const update = (field, value) => setForm((current) => ({ ...current, [field]: value }));

  const submit = async (event) => {
    event.preventDefault();
    setSaving(true);
    setNotice(null);
    try {
      const property = await api.createProperty(form);
      if (files.length) await api.uploadMedia(property.id, files);
      setNotice({ type: 'success', text: 'La propiedad fue publicada correctamente.' });
      setForm(initialForm);
      setFiles([]);
      setProperties(await api.getMyProperties());
      window.scrollTo({ top: 0, behavior: 'smooth' });
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    } finally {
      setSaving(false);
    }
  };

  const removeProperty = async (property) => {
    if (!window.confirm(`¿Eliminar “${property.title}”?`)) return;
    try {
      await api.deleteProperty(property.id);
      setProperties((items) => items.filter((item) => item.id !== property.id));
    } catch (error) {
      setNotice({ type: 'error', text: error.message });
    }
  };

  const logout = async () => {
    await api.logout();
    navigate('/asesores');
  };

  if (loading) return <main className="grid min-h-screen place-items-center bg-slate-50 text-slate-600">Cargando panel...</main>;

  return (
    <main className="min-h-screen bg-slate-100 text-slate-950">
      <header className="sticky top-0 z-40 border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex max-w-[1500px] items-center justify-between gap-4 px-4 py-4 sm:px-6 lg:px-8">
          <BrandLogo compact />
          <div className="flex items-center gap-3">
            <div className="hidden text-right sm:block"><p className="text-sm font-bold">{user?.name}</p><p className="text-xs text-emerald-600">Asesor autorizado</p></div>
            <button onClick={logout} className="inline-flex items-center gap-2 rounded-xl border border-slate-200 px-4 py-2 text-sm font-bold hover:border-red-200 hover:bg-red-50 hover:text-[#d71920]"><LogOut size={17} /> Salir</button>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-[1500px] px-4 py-8 sm:px-6 lg:px-8">
        <div className="flex flex-col justify-between gap-5 md:flex-row md:items-center">
          <div>
            <span className="text-xs font-bold uppercase tracking-[0.2em] text-[#d71920]">Panel de asesor</span>
            <h1 className="mt-2 text-3xl font-black">Publicación de propiedades</h1>
            <p className="mt-2 text-slate-600">Lo que registres aquí se relaciona directamente con el catálogo público.</p>
          </div>
          <button onClick={() => setShowForm((value) => !value)} className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#d71920] px-5 py-3 font-bold text-white hover:bg-[#b91319]"><Plus size={18} /> {showForm ? 'Ocultar formulario' : 'Nueva propiedad'}</button>
        </div>

        {notice && <div className={`mt-6 rounded-xl border px-4 py-3 text-sm ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}>{notice.text}</div>}

        <div className={`mt-8 grid gap-8 ${showForm ? 'xl:grid-cols-[minmax(0,1.15fr)_minmax(360px,.85fr)]' : ''}`}>
          {showForm && (
            <form onSubmit={submit} className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm sm:p-8">
              <div className="flex items-center gap-3 border-b border-slate-100 pb-5"><div className="grid h-11 w-11 place-items-center rounded-xl bg-red-50 text-[#d71920]"><Upload /></div><div><h2 className="text-xl font-black">Nueva propiedad</h2><p className="text-sm text-slate-500">Completa la ficha para publicarla.</p></div></div>

              <div className="mt-6">
                <label className="mb-2 block text-sm font-bold">Título de la propiedad</label>
                <input required className={inputClass} value={form.title} onChange={(event) => update('title', event.target.value)} placeholder="Ej. Residencia con alberca en Riviera Veracruzana" />
              </div>

              <div className="mt-5 rounded-2xl border-2 border-dashed border-slate-300 bg-slate-50 p-6 text-center transition hover:border-[#d71920]">
                <ImagePlus className="mx-auto text-[#d71920]" size={34} />
                <label className="mt-3 block cursor-pointer font-bold text-slate-950">
                  Seleccionar fotografías y videos
                  <input className="sr-only" type="file" accept="image/*,video/*" multiple onChange={(event) => setFiles(Array.from(event.target.files || []))} />
                </label>
                <p className="mt-2 text-xs text-slate-500">Hasta 12 archivos. Cada archivo puede pesar hasta 80 MB.</p>
                {files.length > 0 && <div className="mt-4 flex justify-center gap-4 text-sm font-semibold text-slate-700"><span className="inline-flex items-center gap-1"><ImagePlus size={16} /> {fileSummary.images} fotos</span><span className="inline-flex items-center gap-1"><Video size={16} /> {fileSummary.videos} videos</span></div>}
              </div>

              <div className="mt-5">
                <label className="mb-2 block text-sm font-bold">Todos los detalles de la propiedad</label>
                <textarea required rows={7} className={inputClass} value={form.description} onChange={(event) => update('description', event.target.value)} placeholder="Describe distribución, acabados, amenidades, condiciones de venta o renta, entorno y cualquier información relevante." />
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                <label className="text-sm font-bold">Operación<select className={`${inputClass} mt-2`} value={form.operation} onChange={(event) => update('operation', event.target.value)}><option value="venta">Venta</option><option value="renta">Renta</option></select></label>
                <label className="text-sm font-bold">Tipo<select className={`${inputClass} mt-2`} value={form.type} onChange={(event) => update('type', event.target.value)}><option value="casa">Casa</option><option value="departamento">Departamento</option><option value="terreno">Terreno</option><option value="oficina">Oficina</option><option value="local">Local</option><option value="bodega">Bodega</option><option value="otro">Otro</option></select></label>
                <label className="text-sm font-bold">Precio<input required min="0" type="number" className={`${inputClass} mt-2`} value={form.price} onChange={(event) => update('price', event.target.value)} /></label>
                <label className="text-sm font-bold">Moneda<select className={`${inputClass} mt-2`} value={form.currency} onChange={(event) => update('currency', event.target.value)}><option>MXN</option><option>USD</option><option>COP</option></select></label>
                <label className="text-sm font-bold">Recámaras<input type="number" min="0" className={`${inputClass} mt-2`} value={form.bedrooms} onChange={(event) => update('bedrooms', event.target.value)} /></label>
                <label className="text-sm font-bold">Baños<input type="number" min="0" className={`${inputClass} mt-2`} value={form.bathrooms} onChange={(event) => update('bathrooms', event.target.value)} /></label>
                <label className="text-sm font-bold">Construcción m²<input type="number" min="0" step="0.01" className={`${inputClass} mt-2`} value={form.area} onChange={(event) => update('area', event.target.value)} /></label>
                <label className="text-sm font-bold">Terreno m²<input type="number" min="0" step="0.01" className={`${inputClass} mt-2`} value={form.lotArea} onChange={(event) => update('lotArea', event.target.value)} /></label>
                <label className="text-sm font-bold">Estacionamientos<input type="number" min="0" className={`${inputClass} mt-2`} value={form.parking} onChange={(event) => update('parking', event.target.value)} /></label>
              </div>

              <div className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-bold">Ciudad<input required className={`${inputClass} mt-2`} value={form.city} onChange={(event) => update('city', event.target.value)} /></label>
                <label className="text-sm font-bold">Estado<input required className={`${inputClass} mt-2`} value={form.state} onChange={(event) => update('state', event.target.value)} /></label>
                <label className="text-sm font-bold sm:col-span-2">Dirección<input className={`${inputClass} mt-2`} value={form.address} onChange={(event) => update('address', event.target.value)} placeholder="Calle, colonia o referencia" /></label>
                <label className="text-sm font-bold">Latitud<input type="number" step="any" className={`${inputClass} mt-2`} value={form.lat} onChange={(event) => update('lat', event.target.value)} placeholder="19.1738" /></label>
                <label className="text-sm font-bold">Longitud<input type="number" step="any" className={`${inputClass} mt-2`} value={form.lng} onChange={(event) => update('lng', event.target.value)} placeholder="-96.1342" /></label>
                <label className="text-sm font-bold sm:col-span-2">Características adicionales<input className={`${inputClass} mt-2`} value={form.features} onChange={(event) => update('features', event.target.value)} placeholder="Alberca, seguridad, jardín, elevador..." /></label>
              </div>

              <button disabled={saving} className="mt-7 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#d71920] px-6 py-4 font-black text-white shadow-lg shadow-red-200 transition hover:bg-[#b91319] disabled:opacity-60"><CheckCircle2 size={20} /> {saving ? 'Publicando...' : 'Publicar propiedad'}</button>
            </form>
          )}

          <section className="min-w-0">
            <div className="flex items-center justify-between"><div><h2 className="text-xl font-black">Mis propiedades</h2><p className="text-sm text-slate-500">{properties.length} publicaciones</p></div><Link to="/propiedades" className="inline-flex items-center gap-2 text-sm font-bold text-[#d71920]"><Eye size={17} /> Ver catálogo</Link></div>
            <div className="mt-5 space-y-4">
              {properties.length === 0 ? (
                <div className="rounded-3xl border border-dashed border-slate-300 bg-white p-10 text-center"><Building2 className="mx-auto text-slate-300" size={44} /><p className="mt-4 font-bold">Todavía no has publicado propiedades.</p></div>
              ) : properties.map((property) => {
                const cover = property.photos?.find((media) => media.mediaType !== 'video') || property.photos?.[0];
                return (
                  <article key={property.id} className="overflow-hidden rounded-2xl border border-slate-200 bg-white shadow-sm">
                    <div className="flex gap-4 p-4">
                      <div className="h-28 w-32 shrink-0 overflow-hidden rounded-xl bg-slate-100">{cover?.url ? (cover.mediaType === 'video' ? <video src={cover.url} className="h-full w-full object-cover" /> : <img src={cover.url} alt="" className="h-full w-full object-cover" />) : <div className="grid h-full place-items-center text-slate-300"><Building2 /></div>}</div>
                      <div className="min-w-0 flex-1"><div className="flex items-start justify-between gap-3"><div><p className="text-xs font-bold uppercase tracking-wider text-[#d71920]">{property.operation}</p><h3 className="mt-1 truncate font-black">{property.title}</h3></div><button onClick={() => removeProperty(property)} className="rounded-lg p-2 text-slate-400 hover:bg-red-50 hover:text-[#d71920]" aria-label="Eliminar propiedad"><Trash2 size={18} /></button></div><p className="mt-2 flex items-center gap-1 text-xs text-slate-500"><MapPin size={13} /> {property.city}, {property.state}</p><div className="mt-3 flex items-center justify-between"><span className="text-sm font-black">${Number(property.price).toLocaleString('es-MX')} {property.currency}</span><Link to={`/propiedades/${property.slug}`} className="text-xs font-bold text-[#d71920]">Abrir publicación</Link></div></div>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
};

export default AdvisorDashboard;
