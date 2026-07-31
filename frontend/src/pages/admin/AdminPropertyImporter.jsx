import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Bot, CheckCircle2, FileArchive, FileText, FolderOpen, Image,
  Loader2, Play, Sparkles, Star, UploadCloud, Video, X,
} from 'lucide-react';
import api from '../../api';

const IMAGE_EXTENSIONS = ['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif'];
const VIDEO_EXTENSIONS = ['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv'];
const DOCUMENT_EXTENSIONS = ['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'md', 'csv', 'json'];

const extensionOf = name => String(name || '').split('.').pop().toLowerCase();
const relativeName = file => file.relativePath || file.webkitRelativePath || file.name;
const categoryOf = file => {
  if (file.type?.startsWith('image/') || IMAGE_EXTENSIONS.includes(extensionOf(file.name))) return 'image';
  if (file.type?.startsWith('video/') || VIDEO_EXTENSIONS.includes(extensionOf(file.name))) return 'video';
  if (file.name.toLowerCase().endsWith('.zip')) return 'zip';
  if (DOCUMENT_EXTENSIONS.includes(extensionOf(file.name))) return 'document';
  return 'other';
};

const formatBytes = bytes => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const attachRelativePath = (file, path) => {
  try {
    Object.defineProperty(file, 'relativePath', { value: path, configurable: true });
    return file;
  } catch {
    const copy = new File([file], file.name, { type: file.type, lastModified: file.lastModified });
    Object.defineProperty(copy, 'relativePath', { value: path, configurable: true });
    return copy;
  }
};

const readEntry = (entry, parentPath = '') => new Promise((resolve, reject) => {
  if (entry.isFile) {
    entry.file(file => resolve([attachRelativePath(file, `${parentPath}${file.name}`)]), reject);
    return;
  }

  if (!entry.isDirectory) {
    resolve([]);
    return;
  }

  const reader = entry.createReader();
  const entries = [];
  const readBatch = () => {
    reader.readEntries(async batch => {
      if (!batch.length) {
        try {
          const nested = await Promise.all(entries.map(child => readEntry(child, `${parentPath}${entry.name}/`)));
          resolve(nested.flat());
        } catch (error) {
          reject(error);
        }
        return;
      }
      entries.push(...batch);
      readBatch();
    }, reject);
  };
  readBatch();
});

const filesFromDrop = async dataTransfer => {
  const items = Array.from(dataTransfer.items || []);
  const entries = items.map(item => item.webkitGetAsEntry?.()).filter(Boolean);
  if (entries.length) {
    const nested = await Promise.all(entries.map(entry => readEntry(entry)));
    return nested.flat();
  }
  return Array.from(dataTransfer.files || []);
};

const emptyDraft = {
  title: '', description: '', operation: 'venta', type: 'casa', price: '', currency: 'MXN',
  bedrooms: '', bathrooms: '', area: '', lotArea: '', parking: '', yearBuilt: '', city: '',
  state: 'Veracruz', country: 'México', address: '', lat: '', lng: '', features: [],
  status: 'available', featured: false, published: true, mainPhotoFilename: '',
};

const inputClass = 'w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/60 focus:outline-none text-sm';

const AdminPropertyImporter = () => {
  const folderInput = useRef(null);
  const zipInput = useRef(null);
  const [files, setFiles] = useState([]);
  const [dragging, setDragging] = useState(false);
  const [analysis, setAnalysis] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [featuresText, setFeaturesText] = useState('');
  const [analyzing, setAnalyzing] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [error, setError] = useState('');
  const [publishedResult, setPublishedResult] = useState(null);
  const [previews, setPreviews] = useState([]);

  const totals = useMemo(() => files.reduce((summary, file) => {
    const category = categoryOf(file);
    summary[category] = (summary[category] || 0) + 1;
    summary.bytes += file.size || 0;
    return summary;
  }, { image: 0, video: 0, document: 0, zip: 0, other: 0, bytes: 0 }), [files]);

  useEffect(() => {
    const nextPreviews = files
      .filter(file => ['image', 'video'].includes(categoryOf(file)))
      .map(file => ({ file, url: URL.createObjectURL(file), category: categoryOf(file) }));
    setPreviews(nextPreviews);
    return () => nextPreviews.forEach(item => URL.revokeObjectURL(item.url));
  }, [files]);

  const addFiles = incoming => {
    setError('');
    setPublishedResult(null);
    setAnalysis(null);
    const clean = incoming.filter(file => file && file.name && !['.DS_Store', 'Thumbs.db'].includes(file.name));
    setFiles(current => {
      const byKey = new Map(current.map(file => [`${relativeName(file)}-${file.size}`, file]));
      clean.forEach(file => byKey.set(`${relativeName(file)}-${file.size}`, file));
      return Array.from(byKey.values()).sort((a, b) => relativeName(a).localeCompare(relativeName(b), 'es', { numeric: true }));
    });
  };

  const handleDrop = async event => {
    event.preventDefault();
    setDragging(false);
    try {
      addFiles(await filesFromDrop(event.dataTransfer));
    } catch (dropError) {
      setError(`No se pudo leer la carpeta: ${dropError.message}`);
    }
  };

  const handlePaste = event => {
    const pasted = Array.from(event.clipboardData?.files || []);
    if (pasted.length) {
      event.preventDefault();
      addFiles(pasted);
    }
  };

  const clearFiles = () => {
    setFiles([]);
    setAnalysis(null);
    setDraft(emptyDraft);
    setFeaturesText('');
    setPublishedResult(null);
    setError('');
  };

  const analyzeFolder = async () => {
    if (!files.length) return;
    setAnalyzing(true);
    setError('');
    setPublishedResult(null);
    try {
      const result = await api.analyzePropertyFolder(files);
      const nextDraft = { ...emptyDraft, ...result.draft };
      setAnalysis(result);
      setDraft(nextDraft);
      setFeaturesText(Array.isArray(nextDraft.features) ? nextDraft.features.join(', ') : '');
    } catch (analysisError) {
      setError(analysisError.message);
    } finally {
      setAnalyzing(false);
    }
  };

  const handleChange = event => {
    const { name, value, type, checked } = event.target;
    setDraft(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const removeFile = fileToRemove => {
    setFiles(current => current.filter(file => file !== fileToRemove));
    if (draft.mainPhotoFilename === fileToRemove.name) {
      const replacement = files.find(file => file !== fileToRemove && categoryOf(file) === 'image');
      setDraft(current => ({ ...current, mainPhotoFilename: replacement?.name || '' }));
    }
  };

  const publishProperty = async () => {
    setPublishing(true);
    setError('');
    try {
      const mediaOrder = files
        .filter(file => ['image', 'video'].includes(categoryOf(file)))
        .map(file => file.name);
      const payload = {
        ...draft,
        price: draft.price === '' ? null : Number(draft.price),
        bedrooms: draft.bedrooms === '' ? null : Number(draft.bedrooms),
        bathrooms: draft.bathrooms === '' ? null : Number(draft.bathrooms),
        area: draft.area === '' ? null : Number(draft.area),
        lotArea: draft.lotArea === '' ? null : Number(draft.lotArea),
        parking: draft.parking === '' ? null : Number(draft.parking),
        yearBuilt: draft.yearBuilt === '' ? null : Number(draft.yearBuilt),
        lat: draft.lat === '' ? null : Number(draft.lat),
        lng: draft.lng === '' ? null : Number(draft.lng),
        features: featuresText.split(',').map(item => item.trim()).filter(Boolean),
        mediaOrder,
      };
      const result = await api.publishPropertyFolder(payload, files);
      setPublishedResult(result);
    } catch (publishError) {
      setError(publishError.message);
    } finally {
      setPublishing(false);
    }
  };

  const serverCounts = analysis?.inventory?.counts;
  const requiredReady = Boolean(draft.title && draft.description && Number(draft.price) > 0 && draft.city);
  const hasImages = serverCounts ? serverCounts.images > 0 : totals.image > 0;

  const textFields = [
    ['title', 'Título *', 'text'], ['price', 'Precio *', 'number'], ['currency', 'Moneda', 'text'],
    ['bedrooms', 'Recámaras', 'number'], ['bathrooms', 'Baños', 'number'], ['area', 'Construcción (m²)', 'number'],
    ['lotArea', 'Terreno (m²)', 'number'], ['parking', 'Estacionamientos', 'number'],
    ['yearBuilt', 'Año de construcción', 'number'], ['city', 'Ciudad *', 'text'], ['state', 'Estado', 'text'],
    ['country', 'País', 'text'], ['address', 'Dirección', 'text'], ['lat', 'Latitud', 'number'], ['lng', 'Longitud', 'number'],
  ];

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]" onPaste={handlePaste}>
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col md:flex-row md:items-end justify-between gap-4 mb-7">
          <div>
            <p className="text-amber-400 text-sm font-semibold flex items-center gap-2"><Sparkles size={16} /> Importación asistida</p>
            <h1 className="text-3xl font-bold text-white mt-1">Crear propiedad desde una carpeta</h1>
            <p className="text-gray-400 mt-2 max-w-3xl">Arrastra una carpeta o ZIP con ficha técnica, documentos, fotografías y videos. La IA prepara la publicación y tú confirmas los datos antes de hacerla visible.</p>
          </div>
          <Link to="/admin/propiedades" className="text-sm text-gray-400 hover:text-white">Volver a propiedades</Link>
        </div>

        {error && <div className="mb-6 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 flex items-start gap-3"><AlertTriangle className="shrink-0" size={20} /><span>{error}</span></div>}

        {publishedResult ? (
          <section className="p-8 bg-green-500/10 border border-green-500/25 rounded-2xl text-center">
            <CheckCircle2 size={48} className="text-green-400 mx-auto mb-4" />
            <h2 className="text-2xl font-bold text-white">Propiedad creada correctamente</h2>
            <p className="text-gray-300 mt-2">Se cargaron {publishedResult.summary.images} fotografías y {publishedResult.summary.videos} videos.</p>
            <div className="flex flex-col sm:flex-row justify-center gap-3 mt-6">
              {publishedResult.summary.published && <Link to={`/propiedades/${publishedResult.property.slug}`} className="px-5 py-3 bg-amber-500 text-white font-semibold rounded-lg">Ver publicación</Link>}
              <Link to={`/admin/propiedades/${publishedResult.property.id}/editar`} className="px-5 py-3 bg-white/5 border border-white/10 text-white rounded-lg">Revisar y editar</Link>
              <button type="button" onClick={clearFiles} className="px-5 py-3 text-gray-300">Importar otra</button>
            </div>
          </section>
        ) : !analysis ? (
          <div className="grid grid-cols-1 lg:grid-cols-[1.3fr_.7fr] gap-6">
            <section>
              <div
                onDragEnter={event => { event.preventDefault(); setDragging(true); }}
                onDragOver={event => event.preventDefault()}
                onDragLeave={event => { if (!event.currentTarget.contains(event.relatedTarget)) setDragging(false); }}
                onDrop={handleDrop}
                className={`min-h-[330px] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center p-8 transition ${dragging ? 'border-amber-400 bg-amber-400/10' : 'border-white/15 bg-white/[0.03]'}`}
              >
                <UploadCloud size={56} className={dragging ? 'text-amber-400' : 'text-gray-500'} />
                <h2 className="text-xl font-semibold text-white mt-5">Suelta aquí la carpeta del inmueble</h2>
                <p className="text-gray-400 text-sm mt-2 max-w-xl">También puedes seleccionar una carpeta, cargar un ZIP o pegar archivos con Ctrl+V.</p>
                <div className="flex flex-wrap justify-center gap-3 mt-6">
                  <button type="button" onClick={() => folderInput.current?.click()} className="flex items-center gap-2 px-5 py-3 bg-amber-500 text-white font-semibold rounded-xl"><FolderOpen size={18} /> Seleccionar carpeta</button>
                  <button type="button" onClick={() => zipInput.current?.click()} className="flex items-center gap-2 px-5 py-3 bg-white/5 border border-white/10 text-white rounded-xl"><FileArchive size={18} /> Seleccionar ZIP</button>
                </div>
                <input ref={folderInput} type="file" multiple webkitdirectory="" directory="" className="hidden" onChange={event => addFiles(Array.from(event.target.files || []))} />
                <input ref={zipInput} type="file" accept=".zip" multiple className="hidden" onChange={event => addFiles(Array.from(event.target.files || []))} />
              </div>

              {files.length > 0 && (
                <div className="mt-5 p-5 bg-white/5 border border-white/5 rounded-2xl">
                  <div className="flex items-center justify-between gap-3 mb-4">
                    <div><h3 className="font-semibold text-white">Archivos seleccionados</h3><p className="text-xs text-gray-400">{files.length} archivos · {formatBytes(totals.bytes)}</p></div>
                    <button type="button" onClick={clearFiles} className="text-sm text-red-400">Quitar todos</button>
                  </div>
                  <div className="max-h-64 overflow-y-auto space-y-2 pr-1">
                    {files.slice(0, 100).map((file, index) => {
                      const category = categoryOf(file);
                      const Icon = category === 'image' ? Image : category === 'video' ? Video : category === 'zip' ? FileArchive : FileText;
                      return <div key={`${relativeName(file)}-${index}`} className="flex items-center gap-3 p-2.5 rounded-lg bg-black/20">
                        <Icon size={17} className="text-amber-400 shrink-0" />
                        <span className="text-sm text-gray-300 truncate flex-1" title={relativeName(file)}>{relativeName(file)}</span>
                        <span className="text-xs text-gray-500">{formatBytes(file.size)}</span>
                        <button type="button" onClick={() => removeFile(file)} className="text-gray-500 hover:text-red-400" aria-label="Quitar archivo"><X size={16} /></button>
                      </div>;
                    })}
                    {files.length > 100 && <p className="text-xs text-gray-500 text-center">Y {files.length - 100} archivos más</p>}
                  </div>
                </div>
              )}
            </section>

            <aside className="space-y-5">
              <div className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                <h3 className="font-semibold text-white mb-4">Contenido detectado</h3>
                <div className="grid grid-cols-2 gap-3 text-sm">
                  <div className="p-3 bg-black/20 rounded-xl"><Image size={18} className="text-amber-400 mb-2" /><strong className="text-white block">{totals.image}</strong><span className="text-gray-500">Fotos</span></div>
                  <div className="p-3 bg-black/20 rounded-xl"><Video size={18} className="text-amber-400 mb-2" /><strong className="text-white block">{totals.video}</strong><span className="text-gray-500">Videos</span></div>
                  <div className="p-3 bg-black/20 rounded-xl"><FileText size={18} className="text-amber-400 mb-2" /><strong className="text-white block">{totals.document}</strong><span className="text-gray-500">Documentos</span></div>
                  <div className="p-3 bg-black/20 rounded-xl"><FileArchive size={18} className="text-amber-400 mb-2" /><strong className="text-white block">{totals.zip}</strong><span className="text-gray-500">ZIP</span></div>
                </div>
              </div>

              <div className="p-6 bg-amber-400/10 border border-amber-400/20 rounded-2xl">
                <Bot size={24} className="text-amber-400" />
                <h3 className="font-semibold text-white mt-3">Qué revisará la IA</h3>
                <p className="text-sm text-gray-300 mt-2 leading-relaxed">Precio, operación, tipo, ubicación, medidas, habitaciones, amenidades, calidad visual y mejor fotografía de portada. Nunca publica sin mostrarte el borrador.</p>
              </div>

              <button type="button" onClick={analyzeFolder} disabled={!files.length || analyzing} className="w-full py-3.5 bg-amber-500 text-white font-semibold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">
                {analyzing ? <><Loader2 size={19} className="animate-spin" /> Analizando expediente...</> : <><Sparkles size={19} /> Analizar y preparar ficha</>}
              </button>
            </aside>
          </div>
        ) : (
          <div className="grid grid-cols-1 xl:grid-cols-[1fr_360px] gap-6">
            <div className="space-y-6">
              <section className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                  <div><h2 className="text-xl font-semibold text-white">Borrador de la propiedad</h2><p className="text-sm text-gray-400">Corrige cualquier dato antes de publicar.</p></div>
                  <span className={`text-xs px-3 py-1.5 rounded-full ${analysis.ai.used ? 'bg-green-500/10 text-green-400' : 'bg-amber-500/10 text-amber-300'}`}>{analysis.ai.used ? `IA ${analysis.ai.model}` : 'Lectura básica'}</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {textFields.map(([name, label, type]) => <label key={name} className="text-xs text-gray-400"><span className="block mb-1">{label}</span><input name={name} type={type} step={['lat', 'lng', 'bathrooms'].includes(name) ? 'any' : undefined} value={draft[name] ?? ''} onChange={handleChange} className={inputClass} /></label>)}
                </div>

                <label className="text-xs text-gray-400 block mt-4"><span className="block mb-1">Descripción *</span><textarea name="description" value={draft.description} onChange={handleChange} rows={7} className={`${inputClass} resize-y`} /></label>
                <label className="text-xs text-gray-400 block mt-4"><span className="block mb-1">Características separadas por coma</span><input value={featuresText} onChange={event => setFeaturesText(event.target.value)} className={inputClass} placeholder="Alberca, jardín, seguridad, vista al mar" /></label>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mt-4">
                  <label className="text-xs text-gray-400">Operación<select name="operation" value={draft.operation} onChange={handleChange} className={inputClass}><option value="venta">Venta</option><option value="renta">Renta</option></select></label>
                  <label className="text-xs text-gray-400">Tipo<select name="type" value={draft.type} onChange={handleChange} className={inputClass}>{['casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', 'rancho', 'otros'].map(value => <option key={value} value={value}>{value}</option>)}</select></label>
                  <label className="text-xs text-gray-400">Estado<select name="status" value={draft.status} onChange={handleChange} className={inputClass}><option value="available">Disponible</option><option value="reserved">Reservada</option><option value="sold">Vendida</option><option value="rented">Rentada</option></select></label>
                </div>
                <div className="flex flex-wrap gap-6 text-sm text-gray-300 mt-5"><label className="flex items-center gap-2"><input type="checkbox" name="featured" checked={draft.featured} onChange={handleChange} /> Destacada</label><label className="flex items-center gap-2"><input type="checkbox" name="published" checked={draft.published} onChange={handleChange} /> Publicar inmediatamente</label></div>
              </section>

              <section className="p-6 bg-white/5 border border-white/5 rounded-2xl">
                <div className="flex items-center justify-between gap-3 mb-4"><div><h2 className="text-xl font-semibold text-white">Fotografías y videos</h2><p className="text-sm text-gray-400">Selecciona una portada clara del exterior o del espacio principal.</p></div><button type="button" onClick={() => { setAnalysis(null); setPublishedResult(null); }} className="text-sm text-amber-400">Cambiar archivos</button></div>
                {previews.length ? (
                  <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">
                    {previews.map(({ file, url, category }, index) => {
                      const isMain = category === 'image' && draft.mainPhotoFilename === file.name;
                      return <div key={`${relativeName(file)}-${index}`} className={`relative rounded-xl overflow-hidden border ${isMain ? 'border-amber-400' : 'border-white/10'} bg-black/30 group`}>
                        {category === 'video' ? <video src={url} className="w-full h-36 object-cover" muted preload="metadata" /> : <img src={url} alt={file.name} className="w-full h-36 object-cover" />}
                        <div className="p-2"><p className="text-xs text-gray-300 truncate">{file.name}</p><p className="text-[11px] text-gray-500">{category === 'video' ? 'Video' : 'Fotografía'} · {formatBytes(file.size)}</p></div>
                        {category === 'image' && <button type="button" onClick={() => setDraft(current => ({ ...current, mainPhotoFilename: file.name }))} className={`absolute top-2 left-2 p-2 rounded-full ${isMain ? 'bg-amber-400 text-black' : 'bg-black/70 text-white opacity-0 group-hover:opacity-100'}`} title="Usar como portada"><Star size={15} fill={isMain ? 'currentColor' : 'none'} /></button>}
                        {category === 'video' && <span className="absolute top-2 left-2 p-2 rounded-full bg-black/70 text-white"><Play size={15} /></span>}
                        <button type="button" onClick={() => removeFile(file)} className="absolute top-2 right-2 p-2 bg-black/70 text-white rounded-full opacity-0 group-hover:opacity-100" title="Quitar archivo"><X size={15} /></button>
                      </div>;
                    })}
                  </div>
                ) : <div className="p-8 text-center text-gray-400 bg-black/20 rounded-xl">El contenido está dentro de un ZIP. La portada elegida por IA es: <strong className="text-white">{draft.mainPhotoFilename || 'sin definir'}</strong>.</div>}
              </section>
            </div>

            <aside className="space-y-5">
              <section className="p-5 bg-white/5 border border-white/5 rounded-2xl">
                <h3 className="font-semibold text-white flex items-center gap-2"><Bot size={18} className="text-amber-400" /> Revisión de IA</h3>
                <div className="mt-4"><div className="flex justify-between text-xs text-gray-400 mb-1"><span>Confianza</span><span>{Math.round((analysis.review.confidence || 0) * 100)}%</span></div><div className="h-2 bg-white/5 rounded-full overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${Math.round((analysis.review.confidence || 0) * 100)}%` }} /></div></div>
                {analysis.review.visualSummary && <p className="text-sm text-gray-300 mt-4 leading-relaxed">{analysis.review.visualSummary}</p>}
              </section>

              {analysis.review.missingFields?.length > 0 && <section className="p-5 bg-red-500/10 border border-red-500/20 rounded-2xl"><h3 className="font-semibold text-red-300">Datos por confirmar</h3><div className="flex flex-wrap gap-2 mt-3">{analysis.review.missingFields.map(field => <span key={field} className="text-xs px-2 py-1 bg-red-500/10 text-red-300 rounded">{field}</span>)}</div></section>}
              {analysis.review.warnings?.length > 0 && <section className="p-5 bg-amber-500/10 border border-amber-500/20 rounded-2xl"><h3 className="font-semibold text-amber-300">Observaciones</h3><ul className="text-sm text-gray-300 mt-3 space-y-2 list-disc pl-5">{analysis.review.warnings.map((warning, index) => <li key={`${warning}-${index}`}>{warning}</li>)}</ul></section>}

              <section className="p-5 bg-white/5 border border-white/5 rounded-2xl text-sm">
                <h3 className="font-semibold text-white mb-3">Contenido final</h3>
                <div className="space-y-2 text-gray-400"><p className="flex justify-between"><span>Fotografías</span><strong className="text-white">{analysis.inventory.counts.images}</strong></p><p className="flex justify-between"><span>Videos</span><strong className="text-white">{analysis.inventory.counts.videos}</strong></p><p className="flex justify-between"><span>Documentos leídos</span><strong className="text-white">{analysis.inventory.counts.documents}</strong></p><p className="flex justify-between"><span>Tamaño total</span><strong className="text-white">{formatBytes(analysis.inventory.totalBytes)}</strong></p></div>
              </section>

              {!hasImages && <p className="text-sm text-red-300 flex items-start gap-2"><AlertTriangle size={17} className="shrink-0" /> Agrega al menos una fotografía antes de publicar.</p>}
              {!requiredReady && <p className="text-sm text-red-300 flex items-start gap-2"><AlertTriangle size={17} className="shrink-0" /> Completa título, descripción, precio y ciudad.</p>}
              <button type="button" onClick={publishProperty} disabled={publishing || !requiredReady || !hasImages} className="w-full py-3.5 bg-amber-500 text-white font-semibold rounded-xl disabled:opacity-40 flex items-center justify-center gap-2">{publishing ? <><Loader2 size={19} className="animate-spin" /> Subiendo y publicando...</> : <><CheckCircle2 size={19} /> Crear propiedad</>}</button>
              <p className="text-xs text-gray-500 text-center">Los documentos se usan para la lectura, pero solo las fotos y videos quedan visibles en la publicación.</p>
            </aside>
          </div>
        )}
      </div>
    </main>
  );
};

export default AdminPropertyImporter;
