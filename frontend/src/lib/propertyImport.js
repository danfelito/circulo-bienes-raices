import { BlobReader, BlobWriter, ZipReader } from '@zip.js/zip.js';

export const IMPORT_LIMITS = Object.freeze({
  maxFiles: 200,
  maxMedia: 100,
  maxTotalBytes: 1024 * 1024 * 1024,
  maxSingleBytes: 250 * 1024 * 1024,
  maxZipCompressedBytes: 250 * 1024 * 1024,
  maxZipExpandedBytes: 512 * 1024 * 1024,
  maxZipEntries: 200,
  maxCompressionRatio: 100,
  maxAnalysisDocuments: 20,
  maxAnalysisTextBytes: 256 * 1024,
});

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp', 'gif', 'avif', 'heic', 'heif']);
const VIDEO_EXTENSIONS = new Set(['mp4', 'mov', 'm4v', 'webm', 'avi', 'mkv']);
const DOCUMENT_EXTENSIONS = new Set(['pdf', 'doc', 'docx', 'xls', 'xlsx', 'txt', 'md', 'csv', 'json']);
const TEXT_EXTENSIONS = new Set(['txt', 'md', 'csv', 'json']);

const extensionOf = name => String(name || '').split('.').pop().toLowerCase();
export const relativeName = file => file.relativePath || file.webkitRelativePath || file.name;

export const categoryOf = file => {
  if (file.type?.startsWith('image/') || IMAGE_EXTENSIONS.has(extensionOf(file.name))) return 'image';
  if (file.type?.startsWith('video/') || VIDEO_EXTENSIONS.has(extensionOf(file.name))) return 'video';
  if (DOCUMENT_EXTENSIONS.has(extensionOf(file.name))) return 'document';
  return 'other';
};

const safeArchivePath = value => {
  const path = String(value || '').replaceAll('\\', '/').replace(/^\.\//, '');
  if (!path || path.startsWith('/') || /^[a-z]:/i.test(path) || path.includes('\0')
    || path.split('/').some(segment => !segment || segment === '.' || segment === '..')) {
    throw new Error(`El ZIP contiene una ruta no segura: ${String(value || '').slice(0, 120)}`);
  }
  return path.slice(0, 500);
};

export const attachRelativePath = (file, path) => {
  Object.defineProperty(file, 'relativePath', { value: path, configurable: true });
  return file;
};

const assertNotCancelled = signal => {
  if (signal?.aborted) throw new DOMException('Importación cancelada', 'AbortError');
};

export const expandZipFiles = async (incoming, { signal, onProgress = () => {} } = {}) => {
  const output = [];
  for (const source of incoming) {
    assertNotCancelled(signal);
    if (!source.name.toLowerCase().endsWith('.zip')) {
      output.push(source);
      continue;
    }
    if (source.size > IMPORT_LIMITS.maxZipCompressedBytes) throw new Error('El ZIP excede 250 MB comprimidos');
    const reader = new ZipReader(new BlobReader(source));
    try {
      const entries = (await reader.getEntries()).filter(entry => !entry.directory);
      if (entries.length > IMPORT_LIMITS.maxZipEntries) throw new Error(`El ZIP excede ${IMPORT_LIMITS.maxZipEntries} archivos`);
      let expandedBytes = 0;
      const paths = new Set();
      for (const [index, entry] of entries.entries()) {
        assertNotCancelled(signal);
        const path = safeArchivePath(entry.filename);
        if (paths.has(path)) throw new Error(`El ZIP contiene una ruta duplicada: ${path}`);
        paths.add(path);
        if (entry.encrypted) throw new Error(`No se admiten archivos ZIP cifrados: ${path}`);
        const size = Number(entry.uncompressedSize || 0);
        const compressed = Number(entry.compressedSize || 0);
        if (size > IMPORT_LIMITS.maxSingleBytes) throw new Error(`El archivo ${path} excede 250 MB`);
        if (compressed > 0 && size / compressed > IMPORT_LIMITS.maxCompressionRatio) {
          throw new Error(`El archivo ${path} excede la relación de compresión permitida`);
        }
        expandedBytes += size;
        if (expandedBytes > IMPORT_LIMITS.maxZipExpandedBytes) throw new Error('El ZIP excede 512 MB descomprimidos');
        const blob = await entry.getData(new BlobWriter(), { signal });
        const file = attachRelativePath(new File([blob], path.split('/').at(-1), {
          type: blob.type, lastModified: source.lastModified,
        }), path);
        output.push(file);
        onProgress({ phase: 'extracting', completed: index + 1, total: entries.length, current: path });
      }
    } finally {
      await reader.close();
    }
  }
  return output;
};

export const buildInventory = files => {
  const clean = files.filter(file => file && file.name && !['.DS_Store', 'Thumbs.db'].includes(file.name));
  if (!clean.length) throw new Error('Selecciona al menos un archivo');
  if (clean.length > IMPORT_LIMITS.maxFiles) throw new Error(`El inventario excede ${IMPORT_LIMITS.maxFiles} archivos`);
  const seen = new Set();
  let totalBytes = 0;
  const inventoryFiles = clean.map(file => {
    const path = safeArchivePath(relativeName(file));
    if (seen.has(path)) throw new Error(`Hay una ruta duplicada: ${path}`);
    seen.add(path);
    if (file.size > IMPORT_LIMITS.maxSingleBytes) throw new Error(`${path} excede 250 MB`);
    totalBytes += file.size;
    return { path, name: file.name, size: file.size, type: file.type || '', category: categoryOf(file) };
  });
  if (totalBytes > IMPORT_LIMITS.maxTotalBytes) throw new Error('El inventario excede 1 GB');
  const media = inventoryFiles.filter(item => ['image', 'video'].includes(item.category));
  if (media.length > IMPORT_LIMITS.maxMedia) throw new Error(`La importación excede ${IMPORT_LIMITS.maxMedia} archivos multimedia`);
  if (!media.some(item => item.category === 'image')) throw new Error('Agrega al menos una fotografía');
  const counts = {
    images: media.filter(item => item.category === 'image').length,
    videos: media.filter(item => item.category === 'video').length,
    documents: inventoryFiles.filter(item => item.category === 'document').length,
    other: inventoryFiles.filter(item => item.category === 'other').length,
  };
  return { files: inventoryFiles, totalBytes, counts };
};

export const readAnalysisDocuments = async (files, signal) => {
  const documents = [];
  let total = 0;
  const candidates = files.filter(file => TEXT_EXTENSIONS.has(extensionOf(file.name)))
    .sort((a, b) => Number(!/(?:^|\/)readme\.(txt|md)$/i.test(relativeName(a)))
      - Number(!/(?:^|\/)readme\.(txt|md)$/i.test(relativeName(b))));
  if (candidates.length > IMPORT_LIMITS.maxAnalysisDocuments) {
    throw new Error(`Hay ${candidates.length} textos analizables. El máximo es ${IMPORT_LIMITS.maxAnalysisDocuments}; carga una sola propiedad.`);
  }
  const utf8 = new TextDecoder('utf-8');
  const windows1252 = new TextDecoder('windows-1252');
  const decode = bytes => {
    if (bytes[0] === 0xff && bytes[1] === 0xfe) return new TextDecoder('utf-16le').decode(bytes.subarray(2));
    if (bytes[0] === 0xfe && bytes[1] === 0xff) {
      const swapped = bytes.subarray(2).slice();
      for (let index = 0; index + 1 < swapped.length; index += 2) [swapped[index], swapped[index + 1]] = [swapped[index + 1], swapped[index]];
      return new TextDecoder('utf-16le').decode(swapped);
    }
    const first = utf8.decode(bytes);
    const nulRatio = (first.match(/\0/g)?.length || 0) / Math.max(first.length, 1);
    if (nulRatio > 0.2) return new TextDecoder('utf-16le').decode(bytes);
    return first.includes('\uFFFD') ? windows1252.decode(bytes) : first;
  };
  for (const file of candidates) {
    assertNotCancelled(signal);
    const remaining = IMPORT_LIMITS.maxAnalysisTextBytes - total;
    if (file.size > remaining) throw new Error('Los textos exceden 256 KB. Reduce la ficha para evitar un análisis incompleto.');
    const bytes = new Uint8Array(await file.arrayBuffer());
    const text = decode(bytes);
    total += bytes.byteLength;
    documents.push({ name: relativeName(file), text });
  }
  return documents;
};

export const retry = async (operation, { attempts = 3, signal, onRetry = () => {} } = {}) => {
  let lastError;
  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    assertNotCancelled(signal);
    try { return await operation(attempt); } catch (error) {
      if (signal?.aborted || error?.name === 'AbortError') throw error;
      lastError = error;
      if (attempt === attempts) break;
      onRetry({ attempt, nextAttempt: attempt + 1, error });
      await new Promise((resolve, reject) => {
        const timeout = setTimeout(resolve, 300 * (2 ** (attempt - 1)));
        signal?.addEventListener('abort', () => { clearTimeout(timeout); reject(new DOMException('Importación cancelada', 'AbortError')); }, { once: true });
      });
    }
  }
  throw lastError;
};
