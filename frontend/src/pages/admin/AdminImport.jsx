import React, { useMemo, useState } from 'react';
import { Archive, CheckCircle2, FolderOpen, Upload, XCircle } from 'lucide-react';
import api from '../../api';

const dirname = (value) => {
  const normalized = String(value || '').replace(/\\/g, '/');
  const index = normalized.lastIndexOf('/');
  return index < 0 ? '.' : normalized.slice(0, index);
};

const basename = (value) => String(value || '').replace(/\\/g, '/').split('/').pop();
const isImage = (name) => /\.(jpe?g|png|webp|avif)$/i.test(name);

const AdminImport = () => {
  const [groups, setGroups] = useState([]);
  const [zipFile, setZipFile] = useState(null);
  const [zipProgress, setZipProgress] = useState(0);
  const [zipResult, setZipResult] = useState(null);
  const [busy, setBusy] = useState(false);

  const selectedGroups = useMemo(
    () => groups.filter((group) => group.selected && group.valid),
    [groups],
  );

  const handleFolderSelection = (event) => {
    const files = Array.from(event.target.files || []);
    const manifestFiles = files.filter(
      (file) => basename(file.webkitRelativePath || file.name).toLowerCase() === 'propiedad.json',
    );

    const nextGroups = manifestFiles.map((manifestFile, index) => {
      const manifestPath = manifestFile.webkitRelativePath || manifestFile.name;
      const folder = dirname(manifestPath);
      const prefix = folder === '.' ? '' : `${folder}/`;
      const propertyFiles = files.filter((file) => {
        const relative = (file.webkitRelativePath || file.name).replace(/\\/g, '/');
        if (!prefix) return dirname(relative) === '.';
        if (!relative.startsWith(prefix)) return false;
        const nestedManifest = manifestFiles.some((candidate) => {
          const candidateFolder = dirname(candidate.webkitRelativePath || candidate.name);
          return candidateFolder !== folder && relative.startsWith(`${candidateFolder}/`);
        });
        return !nestedManifest;
      });
      const imageCount = propertyFiles.filter((file) => isImage(file.name)).length;

      return {
        id: `${folder}-${index}`,
        folder,
        files: propertyFiles,
        paths: propertyFiles.map((file) => file.webkitRelativePath || file.name),
        imageCount,
        selected: true,
        valid: imageCount > 0,
        status: 'ready',
        progress: 0,
        message: imageCount > 0 ? 'Lista para importar' : 'Falta al menos una imagen',
      };
    });

    setGroups(nextGroups);
  };

  const toggleGroup = (id) => {
    setGroups((current) => current.map((group) => (
      group.id === id ? { ...group, selected: !group.selected } : group
    )));
  };

  const updateGroup = (id, patch) => {
    setGroups((current) => current.map((group) => (
      group.id === id ? { ...group, ...patch } : group
    )));
  };

  const importFolders = async () => {
    if (!selectedGroups.length) return;
    setBusy(true);
    for (const group of selectedGroups) {
      updateGroup(group.id, { status: 'uploading', progress: 0, message: 'Subiendo...' });
      try {
        const result = await api.importPropertyFiles({
          files: group.files,
          paths: group.paths,
          folderName: group.folder,
        }, (progress) => updateGroup(group.id, { progress }));
        const item = result.results?.[0];
        updateGroup(group.id, {
          status: 'success',
          progress: 100,
          message: item?.action === 'updated'
            ? 'Propiedad actualizada'
            : item?.action === 'skipped'
              ? 'Sin cambios'
              : 'Propiedad creada',
        });
      } catch (error) {
        updateGroup(group.id, { status: 'error', message: error.message });
      }
    }
    setBusy(false);
  };

  const importZip = async () => {
    if (!zipFile) return;
    setBusy(true);
    setZipProgress(0);
    setZipResult(null);
    try {
      const result = await api.importPropertyArchive(zipFile, setZipProgress);
      setZipResult({ type: 'success', message: `${result.results?.length || 0} propiedades procesadas` });
    } catch (error) {
      setZipResult({ type: 'error', message: error.message });
    } finally {
      setBusy(false);
    }
  };

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-6xl mx-auto px-4 py-8">
        <div className="mb-8">
          <h1 className="text-2xl font-bold text-white">Importar propiedades</h1>
          <p className="text-sm text-gray-400 mt-1">
            Cada subcarpeta debe incluir un archivo propiedad.json y por lo menos una fotografía.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-8">
          <section className="p-6 bg-white/5 border border-white/10 rounded-2xl">
            <FolderOpen className="text-amber-400 mb-3" size={30} />
            <h2 className="text-lg font-semibold text-white">Seleccionar carpeta raíz</h2>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              El navegador detectará las subcarpetas que contengan propiedad.json.
            </p>
            <label className="inline-flex cursor-pointer items-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500 text-black font-semibold hover:bg-amber-400">
              <FolderOpen size={18} /> Examinar carpeta
              <input
                type="file"
                multiple
                webkitdirectory=""
                directory=""
                className="hidden"
                onChange={handleFolderSelection}
              />
            </label>
          </section>

          <section className="p-6 bg-white/5 border border-white/10 rounded-2xl">
            <Archive className="text-amber-400 mb-3" size={30} />
            <h2 className="text-lg font-semibold text-white">Cargar archivo ZIP</h2>
            <p className="text-sm text-gray-400 mt-1 mb-4">
              El ZIP puede contener una o varias subcarpetas de propiedades.
            </p>
            <input
              type="file"
              accept=".zip,application/zip"
              onChange={(event) => setZipFile(event.target.files?.[0] || null)}
              className="block w-full text-sm text-gray-300 file:mr-4 file:rounded-lg file:border-0 file:bg-white/10 file:px-4 file:py-2 file:text-gray-200"
            />
            {zipFile && (
              <div className="mt-4">
                <div className="flex items-center justify-between text-xs text-gray-400 mb-2">
                  <span>{zipFile.name}</span><span>{zipProgress}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-amber-500 transition-all" style={{ width: `${zipProgress}%` }} />
                </div>
                <button
                  type="button"
                  disabled={busy}
                  onClick={importZip}
                  className="mt-4 inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-white text-black font-semibold disabled:opacity-50"
                >
                  <Upload size={17} /> Importar ZIP
                </button>
              </div>
            )}
            {zipResult && (
              <p className={`mt-3 text-sm ${zipResult.type === 'success' ? 'text-green-400' : 'text-red-400'}`}>
                {zipResult.message}
              </p>
            )}
          </section>
        </div>

        {groups.length > 0 && (
          <section className="bg-white/5 border border-white/10 rounded-2xl overflow-hidden">
            <div className="p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-b border-white/10">
              <div>
                <h2 className="font-semibold text-white">Propiedades detectadas</h2>
                <p className="text-xs text-gray-400">{groups.length} carpetas · {selectedGroups.length} seleccionadas y válidas</p>
              </div>
              <button
                type="button"
                disabled={busy || selectedGroups.length === 0}
                onClick={importFolders}
                className="inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-amber-500 text-black font-semibold disabled:opacity-40"
              >
                <Upload size={17} /> Importar seleccionadas
              </button>
            </div>

            <div className="divide-y divide-white/5">
              {groups.map((group) => (
                <div key={group.id} className="p-4 flex gap-4 items-start">
                  <input
                    type="checkbox"
                    checked={group.selected}
                    disabled={!group.valid || busy}
                    onChange={() => toggleGroup(group.id)}
                    className="mt-1"
                  />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      {group.status === 'success' ? <CheckCircle2 className="text-green-400" size={17} />
                        : group.status === 'error' || !group.valid ? <XCircle className="text-red-400" size={17} />
                          : <FolderOpen className="text-amber-400" size={17} />}
                      <p className="text-sm font-medium text-white truncate">{group.folder}</p>
                    </div>
                    <p className={`text-xs mt-1 ${group.status === 'error' || !group.valid ? 'text-red-400' : 'text-gray-400'}`}>
                      {group.imageCount} imágenes · {group.message}
                    </p>
                    {group.status === 'uploading' && (
                      <div className="h-1.5 mt-3 rounded-full bg-white/10 overflow-hidden">
                        <div className="h-full bg-amber-500" style={{ width: `${group.progress}%` }} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}
      </div>
    </main>
  );
};

export default AdminImport;
