import React, { useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  AlertTriangle, Bot, CheckCircle2, FileArchive, FileText, FolderOpen, Image,
  Loader2, Play, RotateCcw, Sparkles, Star, UploadCloud, Video, X,
} from 'lucide-react';
import api from '../../api';
import {
  IMPORT_LIMITS, attachRelativePath, buildInventory, categoryOf, expandZipFiles,
  readAnalysisDocuments, relativeName,
} from '../../lib/propertyImport';
import { emptyPropertyDraft, FIELD_LABELS, validatePropertyDraft } from '../../../../shared/property-metadata.mjs';

const formatBytes = bytes => {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';
  const units = ['B', 'KB', 'MB', 'GB'];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  return `${(bytes / (1024 ** index)).toFixed(index === 0 ? 0 : 1)} ${units[index]}`;
};

const readEntry = (entry, parentPath = '') => new Promise((resolve, reject) => {
  if (entry.isFile) {
    entry.file(file => resolve([attachRelativePath(file, `${parentPath}${file.name}`)]), reject);
    return;
  }
  if (!entry.isDirectory) return resolve([]);
  const reader = entry.createReader();
  const entries = [];
  const readBatch = () => reader.readEntries(async batch => {
    if (batch.length) { entries.push(...batch); readBatch(); return; }
    try {
      const nested = await Promise.all(entries.map(child => readEntry(child, `${parentPath}${entry.name}/`)));
      resolve(nested.flat());
    } catch (error) { reject(error); }
  }, reject);
  readBatch();
});

const filesFromDrop = async dataTransfer => {
  const entries = Array.from(dataTransfer.items || []).map(item => item.webkitGetAsEntry?.()).filter(Boolean);
  if (!entries.length) return Array.from(dataTransfer.files || []);
  return (await Promise.all(entries.map(entry => readEntry(entry)))).flat();
};

const emptyDraft = emptyPropertyDraft();

const inputClass = 'w-full px-3 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:border-amber-400/60 focus:outline-none text-sm';

const AdminPropertyImporter = () => {
  const folderInput = useRef(null);
  const zipInput = useRef(null);
  const abortRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [inventory, setInventory] = useState(null);
  const [analysis, setAnalysis] = useState(null);
  const [draft, setDraft] = useState(emptyDraft);
  const [featuresText, setFeaturesText] = useState('');
  const [busy, setBusy] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [result, setResult] = useState(null);
  const [progress, setProgress] = useState(null);
  const [retryMessage, setRetryMessage] = useState('');

  const previews = useMemo(() => files.filter(file => ['image', 'video'].includes(categoryOf(file)))
    .map(file => ({ file, category: categoryOf(file), url: URL.createObjectURL(file) })), [files]);
  useEffect(() => () => previews.forEach(item => URL.revokeObjectURL(item.url)), [previews]);

  const reset = () => {
    abortRef.current?.abort();
    setFiles([]); setInventory(null); setAnalysis(null); setDraft(emptyDraft); setFeaturesText('');
    setError(''); setResult(null); setProgress(null); setRetryMessage('');
  };

  const ingest = async incoming => {
    const controller = new AbortController();
    abortRef.current = controller;
    setBusy(true); setError(''); setResult(null); setAnalysis(null);
    try {
      const expanded = await expandZipFiles(incoming, { signal: controller.signal, onProgress: setProgress });
      const byPath = new Map(files.map(file => [relativeName(file), file]));
      expanded.forEach(file => byPath.set(relativeName(file), file));
      const nextFiles = [...byPath.values()].sort((a, b) => relativeName(a).localeCompare(relativeName(b), 'es', { numeric: true }));
      const nextInventory = buildInventory(nextFiles);
      setFiles(nextFiles); setInventory(nextInventory); setProgress(null);
    } catch (ingestError) {
      if (ingestError.name !== 'AbortError') setError(ingestError.message);
    } finally { setBusy(false); }
  };

  const handleDrop = async event => {
    event.preventDefault(); setDragging(false);
    try { await ingest(await filesFromDrop(event.dataTransfer)); } catch (dropError) { setError(dropError.message); }
  };

  const removeFile = file => {
    try {
      const next = files.filter(item => item !== file);
      const nextInventory = next.length ? buildInventory(next) : null;
      setFiles(next); setInventory(nextInventory); setAnalysis(null);
      if (draft.mainPhotoFilename === relativeName(file)) setDraft(current => ({ ...current, mainPhotoFilename: '' }));
    } catch (removeError) { setError(removeError.message); }
  };

  const useAnalysis = async () => {
    const controller = new AbortController(); abortRef.current = controller;
    setBusy(true); setError('');
    try {
      const documents = await readAnalysisDocuments(files, controller.signal);
      const next = await api.analyzePropertyInventory(inventory, documents, controller.signal);
      setAnalysis(next); setDraft({ ...emptyDraft, ...next.draft, published: false });
      setFeaturesText(Array.isArray(next.draft?.features) ? next.draft.features.join(', ') : '');
    } catch (analysisError) {
      if (analysisError.name !== 'AbortError') setError(analysisError.message);
    } finally { setBusy(false); }
  };

  const skipAnalysis = () => {
    const firstImage = inventory.files.find(item => item.category === 'image');
    setAnalysis({ inventory, ai: { used: false, model: null }, review: { warnings: ['Análisis omitido.'] } });
    setDraft({ ...emptyDraft, mainPhotoFilename: firstImage?.path || '' });
  };

  const handleChange = event => {
    const { name, value, type, checked } = event.target;
    setDraft(current => ({ ...current, [name]: type === 'checkbox' ? checked : value }));
  };

  const startImport = async () => {
    const controller = new AbortController(); abortRef.current = controller;
    setBusy(true); setError(''); setRetryMessage('');
    setProgress({ phase: 'starting', completed: 0, total: inventory.counts.images + inventory.counts.videos });
    const mediaOrder = inventory.files.filter(item => ['image', 'video'].includes(item.category)).map(item => item.path);
    const numeric = value => value === '' || value === null || value === undefined ? null : Number(value);
    const payload = {
      ...draft, price: numeric(draft.price), bedrooms: numeric(draft.bedrooms), bathrooms: numeric(draft.bathrooms),
      area: numeric(draft.area), lotArea: numeric(draft.lotArea), parking: numeric(draft.parking),
      yearBuilt: numeric(draft.yearBuilt), features: featuresText.split(',').map(item => item.trim()).filter(Boolean), mediaOrder,
    };
    try {
      const imported = await api.importProperty(payload, files, inventory, {
        signal: controller.signal, onProgress: setProgress,
        onRetry: event => setRetryMessage(`Reintentando ${event.file} (${event.nextAttempt}/3)…`),
      });
      setResult(imported); setProgress(null); setRetryMessage('');
    } catch (importError) {
      setError(importError.name === 'AbortError' ? 'Importación cancelada; los archivos temporales quedaron programados para limpieza.' : importError.message);
    } finally { setBusy(false); }
  };

  const validation = validatePropertyDraft(draft);
  const requiredReady = !validation.missingFields.length && !validation.invalidFields.length;
  const pendingLabels = [...new Set([...validation.missingFields, ...validation.invalidFields])]
    .map(field => FIELD_LABELS[field] || field).join(', ');
  const mediaTotal = (inventory?.counts.images || 0) + (inventory?.counts.videos || 0);
  const percent = progress?.total ? Math.round((progress.completed / progress.total) * 100) : 0;
  const textFields = [
    ['propertyId', 'Referencia del README', 'text'], ['title', 'Título *', 'text'], ['price', 'Precio *', 'number'],
    ['bedrooms', 'Recámaras', 'number'], ['bathrooms', 'Baños', 'number'], ['area', 'Construcción (m²)', 'number'],
    ['lotArea', 'Terreno (m²)', 'number'], ['parking', 'Estacionamientos', 'number'], ['yearBuilt', 'Año', 'number'],
    ['city', 'Ciudad *', 'text'], ['state', 'Estado *', 'text'], ['country', 'País *', 'text'], ['address', 'Dirección', 'text'],
    ['lat', 'Latitud', 'number'], ['lng', 'Longitud', 'number'],
  ];

  return <main className="pt-20 min-h-screen bg-[#0a0a0a]">
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="flex justify-between gap-4 mb-7"><div><p className="text-amber-400 text-sm font-semibold flex items-center gap-2"><Sparkles size={16} /> Importación segura</p><h1 className="text-3xl font-bold text-white mt-1">Crear propiedad desde archivos</h1><p className="text-gray-400 mt-2 max-w-3xl">El navegador inventaría y descomprime con límites. Los medios van directo a Cloudinary y D1 registra la propiedad sólo al validar el lote completo.</p></div><Link to="/admin/propiedades" className="text-sm text-gray-400 hover:text-white">Volver</Link></div>
      {error && <div className="mb-5 p-4 rounded-xl border border-red-500/30 bg-red-500/10 text-red-300 flex gap-3"><AlertTriangle size={20} className="shrink-0" /><span>{error}</span></div>}
      {busy && progress && <div className="mb-5 p-4 bg-white/5 border border-white/10 rounded-xl"><div className="flex justify-between text-sm text-gray-300"><span>{progress.phase === 'extracting' ? 'Descomprimiendo' : progress.phase === 'registering' ? 'Registrando en D1' : 'Cargando archivos'}{progress.current ? `: ${progress.current}` : ''}</span><span>{percent}%</span></div><div className="h-2 bg-black/30 rounded-full mt-2 overflow-hidden"><div className="h-full bg-amber-400" style={{ width: `${percent}%` }} /></div>{retryMessage && <p className="text-xs text-amber-300 mt-2">{retryMessage}</p>}<button type="button" onClick={() => abortRef.current?.abort()} className="mt-3 text-sm text-red-300 flex items-center gap-2"><X size={15} /> Cancelar</button></div>}

      {result ? <section className="p-8 bg-green-500/10 border border-green-500/25 rounded-2xl text-center"><CheckCircle2 size={48} className="text-green-400 mx-auto" /><h2 className="text-2xl font-bold text-white mt-4">Importación completada</h2><p className="text-gray-300 mt-2">{result.summary.images} fotografías y {result.summary.videos} videos. {result.summary.published ? 'La propiedad ya es visible.' : 'Quedó oculta para revisión.'}</p><div className="flex justify-center gap-3 mt-6"><Link to={`/admin/propiedades/${result.property.id}/editar`} className="px-5 py-3 bg-amber-500 text-white rounded-lg">Revisar propiedad</Link><button type="button" onClick={reset} className="px-5 py-3 text-gray-300">Importar otra</button></div></section> : !analysis ? <div className="grid lg:grid-cols-[1.3fr_.7fr] gap-6">
        <section><div onDragOver={event => event.preventDefault()} onDragEnter={event => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={handleDrop} className={`min-h-[300px] rounded-3xl border-2 border-dashed flex flex-col items-center justify-center text-center p-8 ${dragging ? 'border-amber-400 bg-amber-400/10' : 'border-white/15 bg-white/[0.03]'}`}><UploadCloud size={54} className="text-amber-400" /><h2 className="text-xl font-semibold text-white mt-4">Suelta una carpeta o ZIP</h2><p className="text-sm text-gray-400 mt-2">Máximo {IMPORT_LIMITS.maxFiles} archivos, {IMPORT_LIMITS.maxMedia} medios y 1 GB. ZIP: 250 MB comprimido / 512 MB expandido.</p><div className="flex gap-3 mt-5"><button type="button" disabled={busy} onClick={() => folderInput.current?.click()} className="px-5 py-3 bg-amber-500 text-white rounded-xl flex gap-2"><FolderOpen size={18} /> Carpeta</button><button type="button" disabled={busy} onClick={() => zipInput.current?.click()} className="px-5 py-3 bg-white/5 border border-white/10 text-white rounded-xl flex gap-2"><FileArchive size={18} /> ZIP</button></div><input ref={folderInput} type="file" multiple webkitdirectory="" directory="" className="hidden" onChange={event => ingest(Array.from(event.target.files || []))} /><input ref={zipInput} type="file" accept=".zip" multiple className="hidden" onChange={event => ingest(Array.from(event.target.files || []))} /></div>
        {files.length > 0 && <div className="mt-5 p-5 bg-white/5 rounded-2xl"><div className="flex justify-between"><div><h3 className="text-white font-semibold">Inventario local</h3><p className="text-xs text-gray-400">{files.length} archivos · {formatBytes(inventory.totalBytes)}</p></div><button type="button" onClick={reset} className="text-red-400 text-sm">Quitar todos</button></div><div className="max-h-64 overflow-y-auto mt-3 space-y-2">{files.slice(0, 100).map(file => { const category = categoryOf(file); const Icon = category === 'image' ? Image : category === 'video' ? Video : FileText; return <div key={relativeName(file)} className="flex gap-3 items-center p-2 bg-black/20 rounded-lg"><Icon size={16} className="text-amber-400" /><span className="text-sm text-gray-300 truncate flex-1">{relativeName(file)}</span><span className="text-xs text-gray-500">{formatBytes(file.size)}</span><button type="button" onClick={() => removeFile(file)}><X size={15} className="text-gray-500" /></button></div>; })}</div></div>}</section>
        <aside className="space-y-4">{inventory && <div className="p-5 bg-white/5 rounded-2xl grid grid-cols-2 gap-3 text-sm"><span className="text-gray-400">Fotos <strong className="block text-white">{inventory.counts.images}</strong></span><span className="text-gray-400">Videos <strong className="block text-white">{inventory.counts.videos}</strong></span><span className="text-gray-400">Documentos <strong className="block text-white">{inventory.counts.documents}</strong></span><span className="text-gray-400">Otros <strong className="block text-white">{inventory.counts.other}</strong></span></div>}<div className="p-5 bg-amber-400/10 border border-amber-400/20 rounded-2xl"><Bot className="text-amber-400" /><p className="text-sm text-gray-300 mt-3">El análisis es opcional y sólo envía texto limitado; nunca manda fotos ni ZIP al analizador.</p></div><button type="button" disabled={!inventory || busy} onClick={useAnalysis} className="w-full py-3 bg-amber-500 text-white rounded-xl flex justify-center gap-2"><Sparkles size={18} /> Analizar textos</button><button type="button" disabled={!inventory || busy} onClick={skipAnalysis} className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl">Continuar sin análisis</button></aside>
      </div> : <div className="grid xl:grid-cols-[1fr_360px] gap-6"><div className="space-y-6"><section className="p-6 bg-white/5 rounded-2xl"><div className="flex justify-between mb-5"><div><h2 className="text-xl text-white font-semibold">Borrador</h2><p className="text-sm text-gray-400">Confirma los datos antes del registro final. Los campos vacíos no se inventaron.</p></div><button type="button" onClick={() => setAnalysis(null)} className="text-sm text-amber-400">Cambiar archivos</button></div><div className="grid md:grid-cols-2 gap-4">{textFields.map(([name, label, type]) => { const source = analysis.review?.sources?.[name]; return <label key={name} className="text-xs text-gray-400">{label}{source && <span className="float-right text-emerald-400">Leído · {source.line ? `línea ${source.line}` : 'dato estructurado'}</span>}<input name={name} type={type} step={['bathrooms','area','lotArea','lat','lng'].includes(name) ? 'any' : undefined} value={draft[name] ?? ''} onChange={handleChange} readOnly={name === 'propertyId'} className={`${inputClass} ${name === 'propertyId' ? 'opacity-70' : ''}`} /></label>; })}</div><label className="text-xs text-gray-400 block mt-4">Descripción *{analysis.review?.sources?.description && <span className="float-right text-emerald-400">Leída del archivo</span>}<textarea name="description" rows={6} value={draft.description} onChange={handleChange} className={`${inputClass} resize-y`} /></label><label className="text-xs text-gray-400 block mt-4">Características<input value={featuresText} onChange={event => setFeaturesText(event.target.value)} className={inputClass} placeholder="Alberca, jardín, seguridad" /></label><div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4 mt-4"><label className="text-xs text-gray-400">Operación *<select name="operation" value={draft.operation} onChange={handleChange} className={inputClass}><option value="">Seleccionar</option><option value="venta">Venta</option><option value="renta">Renta</option></select></label><label className="text-xs text-gray-400">Tipo *<select name="type" value={draft.type} onChange={handleChange} className={inputClass}><option value="">Seleccionar</option>{['casa','departamento','terreno','oficina','local','bodega','rancho','otros'].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-xs text-gray-400">Moneda *<select name="currency" value={draft.currency} onChange={handleChange} className={inputClass}><option value="">Seleccionar</option>{['MXN','USD','COP','EUR'].map(value => <option key={value}>{value}</option>)}</select></label><label className="text-xs text-gray-400">Disponibilidad *<select name="status" value={draft.status} onChange={handleChange} className={inputClass}><option value="">Seleccionar</option><option value="available">Disponible</option><option value="reserved">Reservada</option><option value="sold">Vendida</option><option value="rented">Rentada</option></select></label></div><div className="flex gap-6 mt-5 text-sm text-gray-300"><label><input type="checkbox" name="featured" checked={draft.featured} onChange={handleChange} /> Destacada</label><label><input type="checkbox" name="published" checked={draft.published} onChange={handleChange} /> Hacer visible sólo al completar</label></div></section>
        <section className="p-6 bg-white/5 rounded-2xl"><h2 className="text-xl text-white font-semibold mb-4">Portada y medios</h2><div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3">{previews.map(({ file, category, url }) => { const path = relativeName(file); const isMain = category === 'image' && draft.mainPhotoFilename === path; return <div key={path} className={`relative rounded-xl overflow-hidden border ${isMain ? 'border-amber-400' : 'border-white/10'}`}>{category === 'video' ? <video src={url} className="w-full h-32 object-cover" muted /> : <img src={url} alt={file.name} className="w-full h-32 object-cover" />}<p className="p-2 text-xs text-gray-300 truncate">{path}</p>{category === 'image' && <button type="button" onClick={() => setDraft(current => ({ ...current, mainPhotoFilename: path }))} className={`absolute top-2 left-2 p-2 rounded-full ${isMain ? 'bg-amber-400 text-black' : 'bg-black/70 text-white'}`}><Star size={14} fill={isMain ? 'currentColor' : 'none'} /></button>}{category === 'video' && <Play size={16} className="absolute top-3 left-3 text-white" />}</div>; })}</div></section></div>
        <aside className="space-y-4"><div className="p-5 bg-white/5 rounded-2xl text-sm text-gray-400"><h3 className="text-white font-semibold mb-3">Resultado de lectura</h3><p>{analysis.review?.visualSummary}</p>{analysis.review?.sourceDocument && <p className="mt-3 text-gray-300 break-all">Ficha principal: {analysis.review.sourceDocument}</p>}<p className="mt-3">Método: lectura estructurada, sin modelo de IA ni API externa.</p></div>{analysis.review?.warnings?.length > 0 && <div className="p-5 border border-amber-400/25 bg-amber-400/10 rounded-2xl"><h3 className="text-amber-300 font-semibold text-sm">Datos que requieren revisión</h3><ul className="mt-2 space-y-2 text-xs text-gray-300 list-disc pl-4">{analysis.review.warnings.map(warning => <li key={warning}>{warning}</li>)}</ul></div>}<div className="p-5 bg-white/5 rounded-2xl text-sm text-gray-400"><h3 className="text-white font-semibold mb-3">Registro final</h3><p className="flex justify-between">Archivos multimedia <strong className="text-white">{mediaTotal}</strong></p><p className="flex justify-between mt-2">Tamaño total <strong className="text-white">{formatBytes(inventory.totalBytes)}</strong></p><p className="mt-4">Si una carga falla, no se crea la propiedad. Los reintentos reutilizan el mismo identificador y la cancelación programa limpieza segura.</p></div>{!requiredReady && <p className="text-red-300 text-sm flex gap-2"><AlertTriangle size={17} /> Revisa: {pendingLabels}.</p>}<button type="button" disabled={busy || !requiredReady} onClick={startImport} className="w-full py-3.5 bg-amber-500 text-white rounded-xl disabled:opacity-40 flex justify-center gap-2">{busy ? <Loader2 size={18} className="animate-spin" /> : <CheckCircle2 size={18} />} Cargar y registrar</button>{error && <button type="button" disabled={busy} onClick={startImport} className="w-full py-3 bg-white/5 border border-white/10 text-white rounded-xl flex justify-center gap-2"><RotateCcw size={17} /> Reintentar</button>}<p className="text-xs text-gray-500 text-center">La propiedad permanece oculta hasta que D1 valida el lote completo.</p></aside></div>}
    </div>
  </main>;
};

export default AdminPropertyImporter;
