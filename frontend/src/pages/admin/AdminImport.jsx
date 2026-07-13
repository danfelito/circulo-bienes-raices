import React, { useEffect, useRef, useState } from 'react';
import { AlertCircle, CheckCircle2, FileArchive, FolderOpen, RefreshCw, UploadCloud } from 'lucide-react';
import api from '../../api';

const AdminImport = () => {
  const folderInputRef = useRef(null);
  const [files, setFiles] = useState([]);
  const [archive, setArchive] = useState(null);
  const [preview, setPreview] = useState([]);
  const [loadingPreview, setLoadingPreview] = useState(false);
  const [importing, setImporting] = useState(false);
  const [result, setResult] = useState(null);
  const [error, setError] = useState('');
  const [history, setHistory] = useState([]);

  const loadHistory = () => {
    api.getImports().then(setHistory).catch(() => setHistory([]));
  };

  useEffect(() => {
    if (folderInputRef.current) {
      folderInputRef.current.setAttribute('webkitdirectory', '');
      folderInputRef.current.setAttribute('directory', '');
    }
    loadHistory();
  }, []);

  const handleFolderSelection = async (event) => {
    const selected = Array.from(event.target.files || []);
    setFiles(selected);
    setArchive(null);
    setResult(null);
    setError('');
    setLoadingPreview(true);

    const manifestFiles = selected.filter((file) => (
      (file.webkitRelativePath || file.name).toLowerCase().endsWith('/propiedad.json')
      || file.name.toLowerCase() === 'propiedad.json'
    ));

    const rows = await Promise.all(manifestFiles.map(async (file) => {
      const relativePath = file.webkitRelativePath || file.name;
      try {
        const manifest = JSON.parse((await file.text()).replace(/^\uFEFF/, ''));
        const folder = relativePath.includes('/')
          ? relativePath.slice(0, relativePath.lastIndexOf('/'))
          : '.';
        const imageCount = selected.filter((candidate) => {
          const candidatePath = candidate.webkitRelativePath || candidate.name;
          return candidatePath.startsWith(folder === '.' ? '' : `${folder}/`)
            && /\.(jpe?g|png|webp|avif)$/i.test(candidatePath);
        }).length;
        const problems = [];
        if (!manifest.title) problems.push('Falta title');
        if (!manifest.referenceCode && !manifest.slug) problems.push('Falta referenceCode o slug');
        if (!manifest.operationType && !manifest.operation) problems.push('Falta operationType');
        if (manifest.price === undefined) problems.push('Falta price');
        if (imageCount === 0) problems.push('No hay imágenes');
        return {
          folder,
          title: manifest.title || 'Sin título',
          referenceCode: manifest.referenceCode || manifest.slug || 'Sin código',
          imageCount,
          problems,
        };
      } catch {
        return {
          folder: relativePath,
          title: 'JSON inválido',
          referenceCode: '—',
          imageCount: 0,
          problems: ['No se pudo leer propiedad.json'],
        };
      }
    }));

    setPreview(rows);
    setLoadingPreview(false);
  };

  const handleArchiveSelection = (event) => {
    const selectedArchive = event.target.files?.[0] || null;
    setArchive(selectedArchive);
    setFiles([]);
    setPreview([]);
    setResult(null);
    setError('');
  };

  const handleImport = async () => {
    if (!archive && files.length === 0) {
      setError('Selecciona una carpeta o un archivo ZIP.');
      return;
    }
    if (!archive && preview.length === 0) {
      setError('No se detectó ningún archivo propiedad.json.');
      return;
    }
    if (preview.some((item) => item.problems.length > 0)) {
      setError('Corrige los problemas de la vista previa antes de importar.');
      return;
    }

    setImporting(true);
    setResult(null);
    setError('');
    try {
      const response = await api.importPropertyFolders({
        files,
        relativePaths: files.map((file) => file.webkitRelativePath || file.name),
        archive,
      });
      setResult(response);
      loadHistory();
    } catch (err) {
      setError(err.message);
    } finally {
      setImporting(false);
    }
  };

  const statusClass = (status) => {
    if (status === 'COMPLETED') return 'text-green-400 bg-green-500/10';
    if (status === 'PARTIAL') return 'text-amber-400 bg-amber-500/10';
    if (status === 'FAILED') return 'text-red-400 bg-red-500/10';
    return 'text-blue-400 bg-blue-500/10';
  };

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-3xl font-bold text-white">Importar propiedades</h1>
          <p className="text-gray-400 mt-2">Cada subcarpeta debe contener un archivo <code className="text-amber-400">propiedad.json</code> y sus fotografías.</p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 mb-6">
          <label className="p-6 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:border-amber-400/40 transition-colors">
            <FolderOpen className="text-amber-400 mb-3" size={30} />
            <h2 className="text-lg font-semibold text-white">Seleccionar carpeta</h2>
            <p className="text-sm text-gray-400 mt-1">Selecciona la carpeta raíz que contiene las subcarpetas de propiedades.</p>
            <input ref={folderInputRef} type="file" multiple onChange={handleFolderSelection} className="hidden" />
            <span className="inline-block mt-4 px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold text-sm">Examinar carpeta</span>
          </label>

          <label className="p-6 bg-white/5 border border-white/10 rounded-2xl cursor-pointer hover:border-amber-400/40 transition-colors">
            <FileArchive className="text-amber-400 mb-3" size={30} />
            <h2 className="text-lg font-semibold text-white">Cargar archivo ZIP</h2>
            <p className="text-sm text-gray-400 mt-1">El ZIP debe conservar la misma estructura de carpetas.</p>
            <input type="file" accept=".zip,application/zip" onChange={handleArchiveSelection} className="hidden" />
            <span className="inline-block mt-4 px-4 py-2 rounded-lg bg-white/10 text-white font-semibold text-sm">Seleccionar ZIP</span>
            {archive && <p className="text-xs text-green-400 mt-3">Seleccionado: {archive.name}</p>}
          </label>
        </div>

        {loadingPreview && <p className="text-gray-400 py-6">Analizando la carpeta...</p>}

        {preview.length > 0 && (
          <section className="mb-6 bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-4 border-b border-white/10">
              <h2 className="font-semibold text-white">Vista previa: {preview.length} propiedades</h2>
              <p className="text-xs text-gray-400 mt-1">Se enviarán {files.length} archivos.</p>
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[700px] text-sm">
                <thead className="text-gray-400">
                  <tr><th className="p-3 text-left">Carpeta</th><th className="p-3 text-left">Código</th><th className="p-3 text-left">Título</th><th className="p-3 text-left">Fotos</th><th className="p-3 text-left">Validación</th></tr>
                </thead>
                <tbody>
                  {preview.map((item) => (
                    <tr key={item.folder} className="border-t border-white/5">
                      <td className="p-3 text-gray-300">{item.folder}</td>
                      <td className="p-3 text-amber-400">{item.referenceCode}</td>
                      <td className="p-3 text-white">{item.title}</td>
                      <td className="p-3 text-gray-300">{item.imageCount}</td>
                      <td className="p-3">
                        {item.problems.length === 0
                          ? <span className="flex items-center gap-1 text-green-400"><CheckCircle2 size={15} /> Lista</span>
                          : <span className="text-red-400">{item.problems.join(', ')}</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {error && (
          <div className="mb-5 flex items-center gap-2 p-4 rounded-xl bg-red-500/10 border border-red-500/20 text-red-300">
            <AlertCircle size={18} /> {error}
          </div>
        )}

        <button
          type="button"
          onClick={handleImport}
          disabled={importing || (!archive && files.length === 0)}
          className="flex items-center gap-2 px-6 py-3 rounded-xl bg-gradient-to-r from-amber-500 to-amber-600 text-black font-bold disabled:opacity-40"
        >
          {importing ? <RefreshCw className="animate-spin" size={19} /> : <UploadCloud size={19} />}
          {importing ? 'Importando y subiendo fotografías...' : 'Importar propiedades'}
        </button>

        {result && (
          <section className="mt-7 p-5 bg-white/5 border border-white/10 rounded-2xl">
            <h2 className="font-semibold text-white mb-3">Resultado de la importación</h2>
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-4">
              <div className="p-3 rounded-xl bg-white/5"><p className="text-2xl font-bold">{result.total}</p><p className="text-xs text-gray-400">Detectadas</p></div>
              <div className="p-3 rounded-xl bg-green-500/10"><p className="text-2xl font-bold text-green-400">{result.successful}</p><p className="text-xs text-gray-400">Creadas/actualizadas</p></div>
              <div className="p-3 rounded-xl bg-blue-500/10"><p className="text-2xl font-bold text-blue-400">{result.skipped}</p><p className="text-xs text-gray-400">Sin cambios</p></div>
              <div className="p-3 rounded-xl bg-red-500/10"><p className="text-2xl font-bold text-red-400">{result.failed}</p><p className="text-xs text-gray-400">Fallidas</p></div>
            </div>
            {result.errors?.map((item) => <p key={`${item.folder}-${item.error}`} className="text-sm text-red-300">{item.folder}: {item.error}</p>)}
          </section>
        )}

        <section className="mt-10">
          <h2 className="text-xl font-semibold text-white mb-4">Importaciones recientes</h2>
          <div className="space-y-2">
            {history.map((job) => (
              <div key={job.id} className="flex flex-wrap items-center gap-3 justify-between p-4 bg-white/5 border border-white/5 rounded-xl">
                <div>
                  <p className="text-sm text-white">{job.originalFilename || 'Carpeta'}</p>
                  <p className="text-xs text-gray-500">{new Date(job.createdAt).toLocaleString('es-MX')}</p>
                </div>
                <div className="text-xs text-gray-400">{job.successfulProperties} procesadas · {job.skippedProperties} omitidas · {job.failedProperties} fallidas</div>
                <span className={`text-xs px-2 py-1 rounded ${statusClass(job.status)}`}>{job.status}</span>
              </div>
            ))}
            {history.length === 0 && <p className="text-gray-500 text-sm">Todavía no hay importaciones.</p>}
          </div>
        </section>
      </div>
    </main>
  );
};

export default AdminImport;
