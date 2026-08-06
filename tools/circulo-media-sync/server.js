const express = require('express');
const fs = require('fs');
const fsp = fs.promises;
const path = require('path');
const os = require('os');
const crypto = require('crypto');
const { spawn, execFile } = require('child_process');
const sharp = require('sharp');
const ffmpegPath = require('ffmpeg-static');
const ffprobePath = require('ffprobe-static').path;
const YAML = require('yaml');

const PORT = Number(process.env.CIRCULO_SYNC_PORT || 4317);
const DEFAULT_PORTAL = 'https://circulo-bienes-raices-2.onrender.com';
const IMAGE_EXTENSIONS = new Set(['.jpg', '.jpeg', '.png', '.webp', '.avif', '.heic', '.heif', '.tif', '.tiff']);
const VIDEO_EXTENSIONS = new Set(['.mp4', '.mov', '.m4v', '.webm', '.avi', '.mkv']);
const IGNORED_NAMES = new Set(['thumbs.db', '.ds_store']);
const STATUS_MAP = new Map([
  ['available', 'available'], ['disponible', 'available'],
  ['reserved', 'reserved'], ['reservada', 'reserved'], ['reservado', 'reserved'],
  ['sold', 'sold'], ['vendida', 'sold'], ['vendido', 'sold'],
  ['rented', 'rented'], ['rentada', 'rented'], ['rentado', 'rented'],
]);

const app = express();
app.use(express.json({ limit: '2mb' }));
app.use(express.static(path.join(__dirname, 'public')));

const appDataRoot = process.platform === 'win32'
  ? path.join(process.env.LOCALAPPDATA || os.homedir(), 'CirculoMediaSync')
  : path.join(os.homedir(), '.circulo-media-sync');
const cacheRoot = path.join(appDataRoot, 'cache');
const settingsPath = path.join(appDataRoot, 'settings.json');

let settings = { rootFolder: '', portalUrl: DEFAULT_PORTAL, email: '' };
let catalog = [];

const ensureDirectories = async () => {
  await fsp.mkdir(cacheRoot, { recursive: true });
  try {
    settings = { ...settings, ...JSON.parse(await fsp.readFile(settingsPath, 'utf8')) };
  } catch {}
};

const saveSettings = async patch => {
  settings = { ...settings, ...patch };
  await fsp.mkdir(appDataRoot, { recursive: true });
  await fsp.writeFile(settingsPath, JSON.stringify(settings, null, 2));
};

const normalizeSlashes = value => String(value || '').replace(/\\/g, '/');
const safeSegment = value => String(value || 'propiedad')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9._-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 100) || 'propiedad';
const fileExists = async value => {
  try { await fsp.access(value); return true; } catch { return false; }
};
const sha256File = filePath => new Promise((resolve, reject) => {
  const hash = crypto.createHash('sha256');
  const stream = fs.createReadStream(filePath);
  stream.on('error', reject);
  stream.on('data', chunk => hash.update(chunk));
  stream.on('end', () => resolve(hash.digest('hex')));
});

const parseReadme = async readmePath => {
  const raw = await fsp.readFile(readmePath, 'utf8');
  const match = raw.match(/^---\s*\r?\n([\s\S]*?)\r?\n---\s*\r?\n?/);
  let metadata = {};
  let body = raw.trim();
  if (match) {
    metadata = YAML.parse(match[1]) || {};
    body = raw.slice(match[0].length).trim();
  }
  const features = metadata.features || metadata.amenities || metadata.amenidades || [];
  return { raw, metadata, body, features: Array.isArray(features) ? features : String(features || '').split(',').map(item => item.trim()).filter(Boolean) };
};

const writeReadmeMetadata = async (readmePath, metadata, body) => {
  const frontmatter = YAML.stringify(metadata, { lineWidth: 0 }).trim();
  await fsp.writeFile(readmePath, `---\n${frontmatter}\n---\n\n${body.trim()}\n`, 'utf8');
};

const findReadmes = async (root, maxDepth = 5) => {
  const results = [];
  const visit = async (directory, depth) => {
    if (depth > maxDepth) return;
    let entries;
    try { entries = await fsp.readdir(directory, { withFileTypes: true }); } catch { return; }
    const readme = entries.find(entry => entry.isFile() && /^readme\.(md|txt)$/i.test(entry.name));
    if (readme) {
      results.push(path.join(directory, readme.name));
      return;
    }
    for (const entry of entries) {
      if (!entry.isDirectory() || entry.name.startsWith('.') || entry.name === 'node_modules') continue;
      await visit(path.join(directory, entry.name), depth + 1);
    }
  };
  await visit(root, 0);
  return results;
};

const listMediaFiles = async propertyFolder => {
  const files = [];
  const visit = async directory => {
    const entries = await fsp.readdir(directory, { withFileTypes: true });
    for (const entry of entries) {
      if (entry.name.startsWith('.') || IGNORED_NAMES.has(entry.name.toLowerCase())) continue;
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        await visit(absolutePath);
        continue;
      }
      const extension = path.extname(entry.name).toLowerCase();
      const category = IMAGE_EXTENSIONS.has(extension) ? 'image' : VIDEO_EXTENSIONS.has(extension) ? 'video' : null;
      if (!category) continue;
      const stat = await fsp.stat(absolutePath);
      files.push({
        absolutePath,
        sourceFilename: normalizeSlashes(path.relative(propertyFolder, absolutePath)),
        name: entry.name,
        category,
        extension,
        originalBytes: stat.size,
        modifiedAt: stat.mtime.toISOString(),
      });
    }
  };
  await visit(propertyFolder);
  return files.sort((a, b) => a.sourceFilename.localeCompare(b.sourceFilename, 'es', { numeric: true }));
};

const ffprobe = filePath => new Promise((resolve, reject) => {
  execFile(ffprobePath, ['-v', 'quiet', '-print_format', 'json', '-show_format', '-show_streams', filePath], { maxBuffer: 5 * 1024 * 1024 }, (error, stdout, stderr) => {
    if (error) return reject(new Error(stderr || error.message));
    try { resolve(JSON.parse(stdout)); } catch (parseError) { reject(parseError); }
  });
});

const mediaMetadata = async file => {
  if (file.category === 'image') {
    const metadata = await sharp(file.absolutePath, { failOn: 'none' }).metadata();
    return { width: metadata.width || null, height: metadata.height || null, codec: metadata.format || file.extension.slice(1), duration: null };
  }
  const probe = await ffprobe(file.absolutePath);
  const video = (probe.streams || []).find(stream => stream.codec_type === 'video') || {};
  return {
    width: Number(video.width) || null,
    height: Number(video.height) || null,
    codec: video.codec_name || null,
    duration: Number(probe.format?.duration) || null,
    bitrate: Number(probe.format?.bit_rate) || null,
    fps: video.avg_frame_rate || null,
  };
};

const metadataValue = (metadata, ...keys) => {
  for (const key of keys) {
    if (metadata[key] !== undefined && metadata[key] !== null && metadata[key] !== '') return metadata[key];
  }
  return undefined;
};

const draftFromReadme = (property, parsed) => {
  const m = parsed.metadata;
  const statusRaw = String(metadataValue(m, 'status', 'estado') || 'available').toLowerCase();
  const operationRaw = String(metadataValue(m, 'operation', 'operacion', 'operación') || 'venta').toLowerCase();
  const typeRaw = String(metadataValue(m, 'type', 'tipo') || 'otros').toLowerCase();
  const publishedValue = metadataValue(m, 'published', 'publicada', 'publicado');
  const featuredValue = metadataValue(m, 'featured', 'destacada', 'destacado');
  const cover = normalizeSlashes(metadataValue(m, 'cover', 'portada', 'main_photo') || '');

  return {
    title: String(metadataValue(m, 'title', 'titulo', 'título') || property.folderName).trim(),
    description: parsed.body || String(metadataValue(m, 'description', 'descripcion', 'descripción') || '').trim(),
    operation: operationRaw.includes('rent') || operationRaw.includes('alquil') ? 'renta' : 'venta',
    type: ['casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', 'rancho', 'otros'].includes(typeRaw) ? typeRaw : 'otros',
    price: Number(metadataValue(m, 'price', 'precio')) || null,
    currency: String(metadataValue(m, 'currency', 'moneda') || 'MXN').toUpperCase(),
    bedrooms: metadataValue(m, 'bedrooms', 'recamaras', 'recámaras', 'habitaciones') ?? null,
    bathrooms: metadataValue(m, 'bathrooms', 'banos', 'baños') ?? null,
    area: metadataValue(m, 'construction_area', 'area', 'construccion', 'construcción') ?? null,
    lotArea: metadataValue(m, 'land_area', 'lot_area', 'terreno') ?? null,
    parking: metadataValue(m, 'parking', 'estacionamientos') ?? null,
    yearBuilt: metadataValue(m, 'year_built', 'ano_construccion', 'año_construcción') ?? null,
    city: String(metadataValue(m, 'city', 'ciudad') || '').trim(),
    state: String(metadataValue(m, 'state', 'estado_region') || 'Veracruz').trim(),
    country: String(metadataValue(m, 'country', 'pais', 'país') || 'México').trim(),
    address: String(metadataValue(m, 'address', 'direccion', 'dirección') || '').trim(),
    lat: metadataValue(m, 'lat', 'latitude', 'latitud') ?? null,
    lng: metadataValue(m, 'lng', 'longitude', 'longitud') ?? null,
    features: parsed.features,
    status: STATUS_MAP.get(statusRaw) || 'available',
    featured: featuredValue === true || String(featuredValue).toLowerCase() === 'true',
    published: publishedValue === undefined ? true : publishedValue === true || String(publishedValue).toLowerCase() === 'true',
    mainPhotoFilename: cover,
    updatedAt: String(metadataValue(m, 'updated_at', 'actualizada', 'actualizado') || new Date().toISOString()),
  };
};

const manifestPathFor = sourceId => path.join(cacheRoot, safeSegment(sourceId), 'manifest.json');
const loadManifest = async sourceId => {
  try { return JSON.parse(await fsp.readFile(manifestPathFor(sourceId), 'utf8')); } catch { return null; }
};
const saveManifest = async manifest => {
  const target = manifestPathFor(manifest.sourceId);
  await fsp.mkdir(path.dirname(target), { recursive: true });
  await fsp.writeFile(target, JSON.stringify(manifest, null, 2));
};

const scanCatalog = async () => {
  if (!settings.rootFolder || !(await fileExists(settings.rootFolder))) {
    catalog = [];
    return catalog;
  }
  const readmes = await findReadmes(settings.rootFolder);
  const properties = [];
  for (const readmePath of readmes) {
    const folder = path.dirname(readmePath);
    const folderName = path.basename(folder);
    try {
      const parsed = await parseReadme(readmePath);
      const sourceId = String(metadataValue(parsed.metadata, 'property_id', 'source_id', 'id') || folderName).trim();
      const media = await listMediaFiles(folder);
      const manifest = await loadManifest(sourceId);
      const originalBytes = media.reduce((sum, file) => sum + file.originalBytes, 0);
      properties.push({
        sourceId,
        folder,
        folderName,
        readmePath,
        draft: draftFromReadme({ folderName }, parsed),
        media,
        originalBytes,
        optimizedBytes: manifest?.files?.reduce((sum, file) => sum + (file.optimizedBytes || 0), 0) || 0,
        manifest,
        error: '',
      });
    } catch (error) {
      properties.push({ sourceId: folderName, folder, folderName, readmePath, draft: {}, media: [], originalBytes: 0, optimizedBytes: 0, manifest: null, error: error.message });
    }
  }
  catalog = properties.sort((a, b) => a.folderName.localeCompare(b.folderName, 'es', { numeric: true }));
  return catalog;
};

const chooseImageQuality = (file, metadata, isCover) => {
  const megapixels = ((metadata.width || 0) * (metadata.height || 0)) / 1_000_000;
  if (isCover) return 84;
  if (megapixels >= 12 || file.originalBytes >= 8 * 1024 * 1024) return 78;
  if (megapixels <= 2) return 82;
  return 80;
};

const chooseVideoCrf = metadata => {
  const pixels = (metadata.width || 1920) * (metadata.height || 1080);
  const bitratePerPixel = metadata.bitrate ? metadata.bitrate / pixels : 0;
  if (pixels > 1920 * 1080 || bitratePerPixel > 4) return 23;
  if (bitratePerPixel && bitratePerPixel < 1.2) return 22;
  return 24;
};

const runFfmpeg = args => new Promise((resolve, reject) => {
  const process = spawn(ffmpegPath, args, { windowsHide: true });
  let stderr = '';
  process.stderr.on('data', chunk => { stderr = `${stderr}${chunk}`.slice(-12000); });
  process.on('error', reject);
  process.on('close', code => code === 0 ? resolve() : reject(new Error(`FFmpeg terminó con código ${code}: ${stderr.slice(-1500)}`)));
});

const optimizeProperty = async sourceId => {
  const property = catalog.find(item => item.sourceId === sourceId);
  if (!property) throw new Error('Propiedad no encontrada en la biblioteca local');
  if (property.error) throw new Error(property.error);
  if (!property.media.length) throw new Error('La carpeta no contiene fotografías ni videos compatibles');

  const propertyCache = path.join(cacheRoot, safeSegment(sourceId));
  const mediaCache = path.join(propertyCache, 'media');
  await fsp.mkdir(mediaCache, { recursive: true });
  const previous = await loadManifest(sourceId);
  const previousBySource = new Map((previous?.files || []).map(file => [file.sourceFilename, file]));
  const files = [];
  const usedNames = new Set();

  for (const source of property.media) {
    const checksum = await sha256File(source.absolutePath);
    const old = previousBySource.get(source.sourceFilename);
    if (old?.checksum === checksum && old.optimizedPath && await fileExists(old.optimizedPath)) {
      files.push(old);
      usedNames.add(old.uploadName);
      continue;
    }

    const metadata = await mediaMetadata(source);
    const sourceBase = safeSegment(path.basename(source.sourceFilename, source.extension));
    let uploadName = source.category === 'image' ? `${sourceBase}.webp` : `${sourceBase}.mp4`;
    let suffix = 2;
    while (usedNames.has(uploadName)) uploadName = source.category === 'image' ? `${sourceBase}-${suffix++}.webp` : `${sourceBase}-${suffix++}.mp4`;
    usedNames.add(uploadName);
    const optimizedPath = path.join(mediaCache, uploadName);
    const isCover = property.draft.mainPhotoFilename && (
      normalizeSlashes(property.draft.mainPhotoFilename) === source.sourceFilename ||
      path.basename(property.draft.mainPhotoFilename) === path.basename(source.sourceFilename)
    );

    let qualityPreset;
    if (source.category === 'image') {
      const quality = chooseImageQuality(source, metadata, isCover);
      qualityPreset = `webp-q${quality}-max2048`;
      await sharp(source.absolutePath, { failOn: 'none' })
        .rotate()
        .resize({ width: 2048, height: 2048, fit: 'inside', withoutEnlargement: true })
        .toColorspace('srgb')
        .webp({ quality, effort: 5, smartSubsample: true })
        .toFile(optimizedPath);
    } else {
      const crf = chooseVideoCrf(metadata);
      qualityPreset = `h264-crf${crf}-1080p30`;
      await runFfmpeg([
        '-y', '-i', source.absolutePath,
        '-map_metadata', '-1',
        '-vf', "scale='min(1920,iw)':'min(1080,ih)':force_original_aspect_ratio=decrease:force_divisible_by=2,fps=30",
        '-c:v', 'libx264', '-preset', 'medium', '-crf', String(crf), '-pix_fmt', 'yuv420p',
        '-c:a', 'aac', '-b:a', '96k', '-ac', '2',
        '-movflags', '+faststart', optimizedPath,
      ]);
    }

    const optimizedStat = await fsp.stat(optimizedPath);
    const optimizedMetadata = await mediaMetadata({ ...source, absolutePath: optimizedPath, extension: path.extname(optimizedPath), category: source.category });
    files.push({
      sourceFilename: source.sourceFilename,
      sourcePath: source.absolutePath,
      uploadName,
      optimizedPath,
      category: source.category,
      checksum,
      originalBytes: source.originalBytes,
      optimizedBytes: optimizedStat.size,
      width: optimizedMetadata.width,
      height: optimizedMetadata.height,
      duration: optimizedMetadata.duration,
      codec: optimizedMetadata.codec,
      qualityPreset,
      modifiedAt: source.modifiedAt,
    });
  }

  const previousSources = new Set((previous?.files || []).map(file => file.sourceFilename));
  const currentSources = new Set(files.map(file => file.sourceFilename));
  const removedFilenames = [...previousSources].filter(value => !currentSources.has(value));
  const cover = normalizeSlashes(property.draft.mainPhotoFilename || '');
  const mediaOrder = files.map(file => file.sourceFilename).sort((a, b) => {
    const aCover = cover && (a === cover || path.basename(a) === path.basename(cover));
    const bCover = cover && (b === cover || path.basename(b) === path.basename(cover));
    if (aCover !== bCover) return aCover ? -1 : 1;
    const aFile = files.find(file => file.sourceFilename === a);
    const bFile = files.find(file => file.sourceFilename === b);
    if (aFile.category !== bFile.category) return aFile.category === 'image' ? -1 : 1;
    return a.localeCompare(b, 'es', { numeric: true });
  });

  const manifest = {
    version: 1,
    sourceId,
    propertyFolder: property.folder,
    readmePath: property.readmePath,
    optimizedAt: new Date().toISOString(),
    draft: property.draft,
    files,
    removedFilenames,
    mediaOrder,
    lastSyncedChecksums: previous?.lastSyncedChecksums || {},
    remote: previous?.remote || null,
  };
  await saveManifest(manifest);
  await scanCatalog();
  return {
    sourceId,
    originalBytes: files.reduce((sum, file) => sum + file.originalBytes, 0),
    optimizedBytes: files.reduce((sum, file) => sum + file.optimizedBytes, 0),
    files: files.length,
    images: files.filter(file => file.category === 'image').length,
    videos: files.filter(file => file.category === 'video').length,
    removed: removedFilenames.length,
  };
};

const loginPortal = async (portalUrl, email, password) => {
  const response = await fetch(`${portalUrl}/api/auth/login`, {
    method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ email, password }),
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !payload.token) throw new Error(payload.error || 'No fue posible iniciar sesión en el portal');
  return payload.token;
};

const syncProperty = async (sourceId, credentials) => {
  const property = catalog.find(item => item.sourceId === sourceId);
  if (!property) throw new Error('Propiedad no encontrada');
  let manifest = await loadManifest(sourceId);
  if (!manifest) {
    await optimizeProperty(sourceId);
    manifest = await loadManifest(sourceId);
  }
  const portalUrl = String(credentials.portalUrl || settings.portalUrl || DEFAULT_PORTAL).replace(/\/$/, '');
  const token = await loginPortal(portalUrl, credentials.email, credentials.password);
  const lastSynced = manifest.lastSyncedChecksums || {};
  const changedFiles = manifest.files.filter(file => lastSynced[file.sourceFilename] !== file.checksum);

  const form = new FormData();
  form.append('sourceId', sourceId);
  form.append('draft', JSON.stringify({ ...manifest.draft, mediaOrder: manifest.mediaOrder }));
  form.append('manifest', JSON.stringify({
    files: manifest.files.map(file => ({
      sourceFilename: file.sourceFilename,
      uploadName: file.uploadName,
      checksum: file.checksum,
      originalBytes: file.originalBytes,
      optimizedBytes: file.optimizedBytes,
      width: file.width,
      height: file.height,
      duration: file.duration,
      codec: file.codec,
      qualityPreset: file.qualityPreset,
      category: file.category,
    })),
    removedFilenames: manifest.removedFilenames || [],
    mediaOrder: manifest.mediaOrder || [],
  }));

  for (const file of changedFiles) {
    const buffer = await fsp.readFile(file.optimizedPath);
    const type = file.category === 'video' ? 'video/mp4' : 'image/webp';
    form.append('files', new Blob([buffer], { type }), file.uploadName);
  }

  const response = await fetch(`${portalUrl}/api/admin/property-sync/sync/upsert`, {
    method: 'POST', headers: { Authorization: `Bearer ${token}` }, body: form,
  });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(payload.error || 'No se pudo sincronizar la propiedad');

  manifest.lastSyncedChecksums = Object.fromEntries(manifest.files.map(file => [file.sourceFilename, file.checksum]));
  manifest.removedFilenames = [];
  manifest.syncedAt = new Date().toISOString();
  manifest.remote = { id: payload.property.id, slug: payload.property.slug, url: `${portalUrl}/propiedades/${payload.property.slug}` };
  await saveManifest(manifest);
  await saveSettings({ portalUrl, email: credentials.email });
  await scanCatalog();
  return payload;
};

const selectFolderWindows = () => new Promise((resolve, reject) => {
  const script = [
    'Add-Type -AssemblyName System.Windows.Forms;',
    '$dialog = New-Object System.Windows.Forms.FolderBrowserDialog;',
    '$dialog.Description = "Selecciona la carpeta principal de propiedades";',
    '$dialog.ShowNewFolderButton = $true;',
    'if ($dialog.ShowDialog() -eq [System.Windows.Forms.DialogResult]::OK) { Write-Output $dialog.SelectedPath }',
  ].join(' ');
  execFile('powershell.exe', ['-NoProfile', '-STA', '-Command', script], { windowsHide: true }, (error, stdout) => {
    if (error) return reject(error);
    resolve(stdout.trim());
  });
});

app.get('/api/state', async (req, res) => {
  res.json({
    settings: { ...settings, password: undefined },
    properties: catalog.map(property => ({
      sourceId: property.sourceId,
      folderName: property.folderName,
      folder: property.folder,
      draft: property.draft,
      mediaCount: property.media.length,
      images: property.media.filter(file => file.category === 'image').length,
      videos: property.media.filter(file => file.category === 'video').length,
      originalBytes: property.originalBytes,
      optimizedBytes: property.optimizedBytes,
      optimized: Boolean(property.manifest),
      syncedAt: property.manifest?.syncedAt || null,
      remote: property.manifest?.remote || null,
      error: property.error,
    })),
  });
});

app.post('/api/select-folder', async (req, res) => {
  try {
    let folder = String(req.body.path || '').trim();
    if (!folder && process.platform === 'win32') folder = await selectFolderWindows();
    if (!folder) return res.status(400).json({ error: 'No se seleccionó una carpeta' });
    const stat = await fsp.stat(folder);
    if (!stat.isDirectory()) return res.status(400).json({ error: 'La ruta seleccionada no es una carpeta' });
    await saveSettings({ rootFolder: folder });
    await scanCatalog();
    res.json({ rootFolder: folder, properties: catalog.length });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

app.post('/api/scan', async (req, res) => {
  try { await scanCatalog(); res.json({ properties: catalog.length }); }
  catch (error) { res.status(500).json({ error: error.message }); }
});

app.post('/api/properties/:sourceId/optimize', async (req, res) => {
  try { res.json(await optimizeProperty(req.params.sourceId)); }
  catch (error) { console.error(error); res.status(500).json({ error: error.message }); }
});

app.post('/api/properties/:sourceId/sync', async (req, res) => {
  try {
    if (!req.body.email || !req.body.password) return res.status(400).json({ error: 'Correo y contraseña administrativos son obligatorios' });
    res.json(await syncProperty(req.params.sourceId, req.body));
  } catch (error) { console.error(error); res.status(500).json({ error: error.message }); }
});

app.patch('/api/properties/:sourceId/status', async (req, res) => {
  try {
    const property = catalog.find(item => item.sourceId === req.params.sourceId);
    if (!property) return res.status(404).json({ error: 'Propiedad no encontrada' });
    const parsed = await parseReadme(property.readmePath);
    const status = STATUS_MAP.get(String(req.body.status || '').toLowerCase());
    if (!status) return res.status(400).json({ error: 'Estado no válido' });
    const metadata = { ...parsed.metadata, status, published: req.body.published !== false, updated_at: new Date().toISOString() };
    await writeReadmeMetadata(property.readmePath, metadata, parsed.body);
    await scanCatalog();
    res.json({ status, published: metadata.published });
  } catch (error) { res.status(500).json({ error: error.message }); }
});

app.get('*', (req, res) => res.sendFile(path.join(__dirname, 'public', 'index.html')));

const openBrowser = url => {
  if (process.env.CIRCULO_SYNC_NO_BROWSER === '1') return;
  if (process.platform === 'win32') spawn('cmd', ['/c', 'start', '', url], { detached: true, stdio: 'ignore', windowsHide: true }).unref();
  else if (process.platform === 'darwin') spawn('open', [url], { detached: true, stdio: 'ignore' }).unref();
  else spawn('xdg-open', [url], { detached: true, stdio: 'ignore' }).unref();
};

ensureDirectories().then(async () => {
  await scanCatalog();
  app.listen(PORT, '127.0.0.1', () => {
    const url = `http://127.0.0.1:${PORT}`;
    console.log(`Círculo Media Sync disponible en ${url}`);
    openBrowser(url);
  });
}).catch(error => {
  console.error('No se pudo iniciar Círculo Media Sync:', error);
  process.exit(1);
});
