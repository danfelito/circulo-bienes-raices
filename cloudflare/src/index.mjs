import { analyzePropertyDocuments, validatePropertyDraft } from '../../shared/property-metadata.mjs';

const encoder = new TextEncoder();

const VALID_OPERATIONS = new Set(['venta', 'renta']);
const VALID_TYPES = new Set(['casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', 'rancho', 'otros']);
const VALID_STATUSES = new Set(['available', 'sold', 'rented', 'reserved']);
const VALID_CURRENCIES = new Set(['MXN', 'USD', 'COP', 'EUR']);
const JWT_ISSUER = 'circulo-bienes-raices';
const JWT_AUDIENCE = 'circulo-admin';
const JWT_TTL_SECONDS = 7 * 24 * 60 * 60;
const MAX_JSON_BYTES = 1024 * 1024;
const DEFAULT_CLOUDINARY_ROOT = 'circulo-bienes-raices';
const LOGIN_WINDOW_MS = 15 * 60 * 1000;
const LOGIN_MAX_FAILURES = 5;
const UPLOAD_SESSION_TTL_MS = 60 * 60 * 1000;
const CLEANUP_SAFETY_MS = 5 * 60 * 1000;
const CLEANUP_BATCH_SIZE = 20;
const IMPORT_MAX_FILES = 200;
const IMPORT_MAX_MEDIA = 100;
const IMPORT_MAX_TOTAL_BYTES = 1024 * 1024 * 1024;
const IMPORT_MAX_SINGLE_BYTES = 250 * 1024 * 1024;
const IMPORT_MAX_ANALYSIS_TEXT_BYTES = 256 * 1024;
const PROPERTY_FIELDS = [
  'sourceId', 'syncSource', 'sourceUpdatedAt', 'title', 'slug', 'description',
  'operation', 'type', 'price', 'currency', 'bedrooms', 'bathrooms', 'area',
  'lotArea', 'parking', 'yearBuilt', 'city', 'state', 'country', 'address',
  'lat', 'lng', 'features', 'status', 'featured', 'published', 'views',
  'citySearch', 'searchText',
];

const json = (payload, status = 200, headers = {}) => new Response(JSON.stringify(payload), {
  status,
  headers: { 'content-type': 'application/json; charset=utf-8', ...headers },
});

const now = () => new Date().toISOString();
const makeId = prefix => `${prefix}_${crypto.randomUUID().replaceAll('-', '')}`;

const base64UrlEncode = value => {
  const bytes = typeof value === 'string' ? encoder.encode(value) : new Uint8Array(value);
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary).replaceAll('+', '-').replaceAll('/', '_').replace(/=+$/g, '');
};

const base64UrlDecodeBytes = value => {
  if (!/^[A-Za-z0-9_-]+$/.test(value)) throw new Error('Base64URL no válido');
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return Uint8Array.from(binary, character => character.charCodeAt(0));
};

const base64UrlDecode = value => new TextDecoder().decode(base64UrlDecodeBytes(value));

const hmacBytes = async (secret, value) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  return new Uint8Array(await crypto.subtle.sign('HMAC', key, encoder.encode(value)));
};

const hmacHex = async (secret, value) => {
  const signature = await hmacBytes(secret, value);
  return [...signature].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const sha1Hex = async value => {
  const digest = await crypto.subtle.digest('SHA-1', encoder.encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const sha256Bytes = async value => new Uint8Array(await crypto.subtle.digest('SHA-256', encoder.encode(value)));

const sha256Hex = async value => [...await sha256Bytes(value)]
  .map(byte => byte.toString(16).padStart(2, '0')).join('');

const timingSafeBytesEqual = (left, right) => {
  if (!(left instanceof Uint8Array) || !(right instanceof Uint8Array) || left.length !== right.length) return false;
  if (typeof crypto.subtle.timingSafeEqual === 'function') return crypto.subtle.timingSafeEqual(left, right);
  let difference = 0;
  for (let index = 0; index < left.length; index += 1) difference |= left[index] ^ right[index];
  return difference === 0;
};

const timingSafeTextEqual = async (left, right) => timingSafeBytesEqual(
  await sha256Bytes(String(left)),
  await sha256Bytes(String(right)),
);

const assertAuthConfiguration = env => {
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.JWT_SECRET) {
    throw Object.assign(new Error('Credenciales administrativas incompletas'), { status: 503 });
  }
  if (String(env.ADMIN_PASSWORD).length < 12 || String(env.JWT_SECRET).length < 32) {
    throw Object.assign(new Error('Configuración administrativa insegura'), { status: 503 });
  }
};

const signToken = async (env, user) => {
  if (!env.JWT_SECRET) throw Object.assign(new Error('JWT_SECRET no está configurado'), { status: 503 });
  const issuedAt = Math.floor(Date.now() / 1000);
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    sub: user.id,
    email: user.email,
    role: user.role,
    iss: JWT_ISSUER,
    aud: JWT_AUDIENCE,
    iat: issuedAt,
    exp: issuedAt + JWT_TTL_SECONDS,
  }));
  const signingInput = `${header}.${payload}`;
  const signature = await hmacBytes(env.JWT_SECRET, signingInput);
  return `${signingInput}.${base64UrlEncode(signature)}`;
};

const verifyToken = async (env, token) => {
  if (!token || !env.JWT_SECRET) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const signingInput = `${parts[0]}.${parts[1]}`;
  try {
    const header = JSON.parse(base64UrlDecode(parts[0]));
    if (header?.alg !== 'HS256' || header?.typ !== 'JWT' || Object.keys(header).some(key => !['alg', 'typ'].includes(key))) return null;
    const expected = await hmacBytes(env.JWT_SECRET, signingInput);
    const supplied = base64UrlDecodeBytes(parts[2]);
    if (!timingSafeBytesEqual(expected, supplied)) return null;
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    const timestamp = Math.floor(Date.now() / 1000);
    if (!payload.sub || payload.iss !== JWT_ISSUER || payload.aud !== JWT_AUDIENCE) return null;
    if (!Number.isInteger(payload.iat) || !Number.isInteger(payload.exp)) return null;
    if (payload.iat > timestamp + 60 || payload.exp <= timestamp || payload.exp - payload.iat > JWT_TTL_SECONDS) return null;
    return payload;
  } catch {
    return null;
  }
};

const cookieValue = (request, name) => {
  const cookies = request.headers.get('cookie') || '';
  const entry = cookies.split(';').map(value => value.trim()).find(value => value.startsWith(`${name}=`));
  return entry ? decodeURIComponent(entry.slice(name.length + 1)) : '';
};

const authenticate = async (request, env) => {
  const authorization = request.headers.get('authorization') || '';
  const token = (authorization.startsWith('Bearer ') ? authorization.slice(7) : '') || cookieValue(request, 'token');
  const decoded = await verifyToken(env, token);
  if (!decoded) throw Object.assign(new Error('No autenticado'), { status: 401 });
  const user = await env.DB.prepare('SELECT id, email, name, role FROM users WHERE id = ?').bind(decoded.sub).first();
  if (!user) throw Object.assign(new Error('Usuario no encontrado'), { status: 401 });
  return user;
};

const requireAdmin = async (request, env) => {
  const user = await authenticate(request, env);
  if (user.role !== 'admin') throw Object.assign(new Error('Permisos administrativos requeridos'), { status: 403 });
  return user;
};

const readJson = async request => {
  const declared = Number(request.headers.get('content-length') || 0);
  if (declared > MAX_JSON_BYTES) throw Object.assign(new Error('El cuerpo JSON excede el límite permitido'), { status: 413 });
  let text;
  try { text = await request.text(); } catch { throw Object.assign(new Error('No se pudo leer el cuerpo JSON'), { status: 400 }); }
  if (encoder.encode(text).byteLength > MAX_JSON_BYTES) throw Object.assign(new Error('El cuerpo JSON excede el límite permitido'), { status: 413 });
  try { return JSON.parse(text); } catch { throw Object.assign(new Error('El cuerpo JSON no es válido'), { status: 400 }); }
};

const nullableNumber = value => {
  if (typeof value === 'number') return Number.isFinite(value) ? value : null;
  if (value === null || value === undefined || value === '') return null;
  let normalized = String(value).trim().replace(/[^0-9.,+-]/g, '');
  if (!normalized || !/[0-9]/.test(normalized)) return null;
  const comma = normalized.lastIndexOf(',');
  const dot = normalized.lastIndexOf('.');
  if (comma !== -1 && dot !== -1) {
    const decimal = comma > dot ? ',' : '.';
    normalized = normalized.split(decimal === ',' ? '.' : ',').join('');
    if (decimal === ',') normalized = normalized.replace(',', '.');
  } else {
    const separator = comma !== -1 ? ',' : dot !== -1 ? '.' : '';
    if (separator) {
      const parts = normalized.split(separator);
      if (parts.length > 2 || parts.at(-1).length === 3) normalized = parts.join('');
      else if (separator === ',') normalized = normalized.replace(',', '.');
    }
  }
  const parsed = Number(normalized);
  return Number.isFinite(parsed) ? parsed : null;
};

const nullableInteger = value => {
  const parsed = nullableNumber(value);
  return parsed === null ? null : Math.round(parsed);
};

const nullableCoordinate = (value, minimum, maximum) => {
  if (value === null || value === undefined || value === '') return null;
  const normalized = typeof value === 'number' ? value : Number(String(value).trim().replace(',', '.'));
  if (!Number.isFinite(normalized) || normalized < minimum || normalized > maximum) {
    throw Object.assign(new Error(`La coordenada debe estar entre ${minimum} y ${maximum}`), { status: 400 });
  }
  return normalized;
};

const parseBoolean = (value, fallback = false) => {
  if (value === undefined) return Number(Boolean(fallback));
  if (value === true || value === 1) return 1;
  if (value === false || value === 0 || value === null) return 0;
  const normalized = String(value).trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
  if (['true', '1', 'si', 'yes'].includes(normalized)) return 1;
  if (['false', '0', 'no'].includes(normalized)) return 0;
  throw Object.assign(new Error(`Valor booleano no válido: ${String(value).slice(0, 30)}`), { status: 400 });
};

const hasOwn = (object, key) => Object.prototype.hasOwnProperty.call(object || {}, key);
const inputValue = (input, keys, fallback = null) => {
  for (const key of keys) if (hasOwn(input, key)) return input[key];
  return fallback;
};

const foldSpanish = value => String(value || '')
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .toLocaleLowerCase('es-MX')
  .trim();

const slugBase = title => String(title || 'propiedad')
  .toLowerCase()
  .normalize('NFD')
  .replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-z0-9]+/g, '-')
  .replace(/(^-|-$)/g, '') || 'propiedad';

const uniqueSlug = async (env, title, currentId = null) => {
  const base = slugBase(title);
  let candidate = base;
  let suffix = 2;
  while (true) {
    const existing = await env.DB.prepare('SELECT id FROM properties WHERE slug = ?').bind(candidate).first();
    if (!existing || existing.id === currentId) return candidate;
    candidate = `${base}-${suffix++}`;
  }
};

const sanitizeProperty = async (env, input, existing = null) => {
  const title = String(inputValue(input, ['title', 'titulo', 'título'], existing?.title) ?? '').trim().slice(0, 180);
  const description = String(inputValue(input, ['description', 'descripcion', 'descripción'], existing?.description) ?? '').trim().slice(0, 12000);
  const city = String(inputValue(input, ['city', 'ciudad'], existing?.city) ?? '').trim().slice(0, 120);
  const price = nullableNumber(inputValue(input, ['price', 'precio'], existing?.price));
  if (!title) throw Object.assign(new Error('El título es obligatorio'), { status: 400 });
  if (!description) throw Object.assign(new Error('La descripción es obligatoria'), { status: 400 });
  if (!city) throw Object.assign(new Error('La ciudad es obligatoria'), { status: 400 });
  if (price === null || price <= 0) throw Object.assign(new Error('El precio debe ser mayor que cero'), { status: 400 });

  const rawFeatures = inputValue(input, ['features', 'caracteristicas', 'características'], existing?.features);
  const features = Array.isArray(rawFeatures)
    ? JSON.stringify([...new Set(rawFeatures.map(value => String(value).trim()).filter(Boolean))].slice(0, 80))
    : typeof rawFeatures === 'string' && rawFeatures.trim() ? rawFeatures.trim() : null;
  const requestedOperation = foldSpanish(inputValue(input, ['operation', 'operacion', 'operación'], existing?.operation));
  const requestedType = foldSpanish(inputValue(input, ['type', 'tipo'], existing?.type));
  const requestedCurrency = String(inputValue(input, ['currency', 'moneda'], existing?.currency) || '').trim().toUpperCase();
  const requestedStatus = foldSpanish(inputValue(input, ['status', 'estado'], existing?.status));
  const operation = VALID_OPERATIONS.has(requestedOperation) ? requestedOperation : existing?.operation || 'venta';
  const type = VALID_TYPES.has(requestedType) ? requestedType : existing?.type || 'otros';
  const currency = VALID_CURRENCIES.has(requestedCurrency) ? requestedCurrency : existing?.currency || 'MXN';
  const status = VALID_STATUSES.has(requestedStatus) ? requestedStatus : existing?.status || 'available';
  const state = String(inputValue(input, ['state', 'estado_nombre'], existing?.state ?? 'Veracruz') ?? '').trim().slice(0, 120);
  const country = String(inputValue(input, ['country', 'pais', 'país'], existing?.country ?? 'México') ?? '').trim().slice(0, 120);
  const address = String(inputValue(input, ['address', 'direccion', 'dirección'], existing?.address) ?? '').trim().slice(0, 300) || null;
  const citySearch = foldSpanish(city);
  const searchText = foldSpanish([title, description, city, state, country].join(' '));

  return {
    sourceId: inputValue(input, ['sourceId'], existing?.sourceId),
    syncSource: inputValue(input, ['syncSource'], existing?.syncSource),
    sourceUpdatedAt: inputValue(input, ['sourceUpdatedAt', 'updatedAt'], existing?.sourceUpdatedAt),
    title,
    slug: input.slug ? slugBase(input.slug) : existing?.slug || await uniqueSlug(env, title, existing?.id),
    description,
    operation,
    type,
    price,
    currency,
    bedrooms: nullableInteger(inputValue(input, ['bedrooms', 'recamaras', 'recámaras'], existing?.bedrooms)),
    bathrooms: nullableNumber(inputValue(input, ['bathrooms', 'banos', 'baños'], existing?.bathrooms)),
    area: nullableNumber(inputValue(input, ['area', 'construction_area'], existing?.area)),
    lotArea: nullableNumber(inputValue(input, ['lotArea', 'land_area'], existing?.lotArea)),
    parking: nullableInteger(inputValue(input, ['parking', 'estacionamientos'], existing?.parking)),
    yearBuilt: nullableInteger(inputValue(input, ['yearBuilt'], existing?.yearBuilt)),
    city,
    state,
    country,
    address,
    lat: nullableCoordinate(inputValue(input, ['lat', 'latitude'], existing?.lat), -90, 90),
    lng: nullableCoordinate(inputValue(input, ['lng', 'longitude'], existing?.lng), -180, 180),
    features,
    status,
    featured: parseBoolean(input.featured, existing?.featured),
    published: parseBoolean(input.published, existing ? existing.published : true),
    views: nullableInteger(inputValue(input, ['views'], existing?.views)) || 0,
    citySearch,
    searchText,
  };
};

const normalizePhoto = row => row ? { ...row, isMain: Boolean(row.isMain) } : row;
const normalizeProperty = row => {
  if (!row) return row;
  const { citySearch: _citySearch, searchText: _searchText, syncVersion: _syncVersion, ...publicRow } = row;
  return {
    ...publicRow,
    featured: Boolean(row.featured),
    published: Boolean(row.published),
    photos: Array.isArray(row.photos) ? row.photos.map(normalizePhoto) : row.photos,
  };
};

const attachPhotos = async (env, properties) => {
  if (!properties.length) return [];
  const placeholders = properties.map(() => '?').join(',');
  const { results } = await env.DB.prepare(`SELECT * FROM photos WHERE propertyId IN (${placeholders}) ORDER BY "order" ASC`).bind(...properties.map(item => item.id)).all();
  const grouped = new Map();
  for (const photo of results || []) {
    if (!grouped.has(photo.propertyId)) grouped.set(photo.propertyId, []);
    grouped.get(photo.propertyId).push(normalizePhoto(photo));
  }
  return properties.map(property => normalizeProperty({ ...property, photos: grouped.get(property.id) || [] }));
};

const insertProperty = async (env, data) => {
  const id = makeId('prop');
  const timestamp = now();
  const columns = PROPERTY_FIELDS.filter(field => field !== 'views');
  await env.DB.prepare(`INSERT INTO properties (id, ${columns.join(', ')}, views, createdAt, updatedAt) VALUES (?, ${columns.map(() => '?').join(', ')}, ?, ?, ?)`)
    .bind(id, ...columns.map(field => data[field]), data.views || 0, timestamp, timestamp).run();
  return env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(id).first();
};

const updateProperty = async (env, id, data) => {
  const fields = PROPERTY_FIELDS.filter(field => field !== 'views');
  await env.DB.prepare(`UPDATE properties SET ${fields.map(field => `${field} = ?`).join(', ')}, views = ?, updatedAt = ? WHERE id = ?`)
    .bind(...fields.map(field => data[field]), data.views || 0, now(), id).run();
  return env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(id).first();
};

const cloudinarySignature = async (env, params) => {
  if (!env.CLOUDINARY_API_SECRET || !env.CLOUDINARY_API_KEY || !env.CLOUDINARY_CLOUD_NAME) {
    throw Object.assign(new Error('Configuración de Cloudinary incompleta'), { status: 503 });
  }
  const signingText = Object.entries(params)
    .filter(([, value]) => value !== undefined && value !== null && value !== '')
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, value]) => `${key}=${value}`)
    .join('&');
  return sha1Hex(`${signingText}${env.CLOUDINARY_API_SECRET}`);
};

const normalizeSourceFilename = value => String(value || '').replaceAll('\\', '/').replace(/^\/+/, '').slice(0, 500);

const normalizeExpectedFiles = values => [...new Set((Array.isArray(values) ? values : [])
  .map(normalizeSourceFilename).filter(Boolean))].slice(0, IMPORT_MAX_MEDIA);

const cloudinaryRoot = env => safeFolderSegment(env.CLOUDINARY_ROOT || DEFAULT_CLOUDINARY_ROOT);

const createUploadSession = async (env, { ownerType, ownerId, expectedFiles = [], maxFiles }) => {
  const normalizedOwner = String(ownerId || '').trim().slice(0, 160);
  if (!['property', 'source', 'import'].includes(ownerType) || !normalizedOwner) {
    throw Object.assign(new Error('Destino de carga no válido'), { status: 400 });
  }
  const files = normalizeExpectedFiles(expectedFiles);
  const allowedFiles = Math.min(IMPORT_MAX_MEDIA, Math.max(1, Number(maxFiles || files.length || 1)));
  if (files.length > allowedFiles) throw Object.assign(new Error('El inventario excede la sesión de carga'), { status: 400 });
  const id = makeId('upload');
  const createdAt = Date.now();
  const expiresAt = createdAt + UPLOAD_SESSION_TTL_MS;
  const folder = `${cloudinaryRoot(env)}/${safeFolderSegment(normalizedOwner)}/${safeFolderSegment(id)}`;
  await env.DB.prepare(`INSERT INTO upload_sessions
    (id, ownerType, ownerId, folder, expectedFiles, maxFiles, usedFiles, createdAt, expiresAt, completedAt)
    VALUES (?, ?, ?, ?, ?, ?, 0, ?, ?, NULL)`)
    .bind(id, ownerType, normalizedOwner, folder, JSON.stringify(files), allowedFiles, createdAt, expiresAt).run();
  const timestamp = Math.floor(createdAt / 1000);
  const params = { folder, timestamp };
  const uploads = await Promise.all(files.map(async sourceFilename => {
    const publicId = `asset-${(await sha256Hex(`${id}\0${sourceFilename}`)).slice(0, 32)}`;
    return {
      sourceFilename,
      publicId,
      signature: await cloudinarySignature(env, { folder, public_id: publicId, timestamp }),
    };
  }));
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature: await cloudinarySignature(env, params),
    uploads,
    uploadSessionId: id,
    expiresAt,
    maxFiles: allowedFiles,
  };
};

const requireUploadSession = async (env, asset, ownerType, ownerId) => {
  const id = String(asset?.uploadSessionId || '').trim();
  if (!id) throw Object.assign(new Error('La sesión de carga es obligatoria'), { status: 400 });
  const session = await env.DB.prepare('SELECT * FROM upload_sessions WHERE id = ?').bind(id).first();
  if (!session || session.ownerType !== ownerType || session.ownerId !== ownerId) {
    throw Object.assign(new Error('La sesión de carga no pertenece a este destino'), { status: 403 });
  }
  if (Number(session.expiresAt) <= Date.now()) {
    throw Object.assign(new Error('La sesión de carga expiró; solicita una nueva'), { status: 409 });
  }
  const sourceFilename = normalizeSourceFilename(asset?.sourceFilename);
  const expectedFiles = JSON.parse(session.expectedFiles || '[]');
  if (expectedFiles.length && !expectedFiles.includes(sourceFilename)) {
    throw Object.assign(new Error('El archivo no forma parte del inventario autorizado'), { status: 403 });
  }
  return session;
};

const cloudinaryPublicId = storedPublicId => {
  const isVideo = String(storedPublicId).startsWith('video:');
  const publicId = isVideo ? String(storedPublicId).slice(6) : String(storedPublicId);
  return { isVideo, publicId };
};

const ownedCloudinaryPublicId = (env, storedPublicId, owners) => {
  const { publicId } = cloudinaryPublicId(storedPublicId);
  return owners.some(owner => publicId.startsWith(`${cloudinaryRoot(env)}/${safeFolderSegment(owner)}/`));
};

const verifyCloudinaryResponseSignature = async (env, publicId, version, signature) => {
  const serialized = `public_id=${publicId}&version=${version}${env.CLOUDINARY_API_SECRET}`;
  const expected = String(signature).length === 64 ? await sha256Hex(serialized) : await sha1Hex(serialized);
  return timingSafeTextEqual(expected, String(signature).toLowerCase());
};

const validateCloudinaryAsset = async (env, asset, ownerType, ownerId) => {
  const session = await requireUploadSession(env, asset, ownerType, ownerId);
  const publicId = String(asset?.publicId || '').trim();
  const secureUrl = String(asset?.secureUrl || '').trim();
  const signature = String(asset?.signature || '').trim();
  const resourceType = String(asset?.resourceType || '').trim().toLowerCase();
  const version = Number(asset?.version);
  if (!publicId || !secureUrl || !signature || !Number.isInteger(version) || version <= 0) {
    throw Object.assign(new Error('Respuesta firmada de Cloudinary incompleta'), { status: 400 });
  }
  if (!['image', 'video'].includes(resourceType)) {
    throw Object.assign(new Error('Tipo de recurso Cloudinary no permitido'), { status: 400 });
  }
  const expectedPrefix = `${session.folder}/`;
  const expectedPublicId = asset.sourceFilename
    ? `${session.folder}/asset-${(await sha256Hex(`${session.id}\0${normalizeSourceFilename(asset.sourceFilename)}`)).slice(0, 32)}`
    : '';
  if (!publicId.startsWith(expectedPrefix) || publicId.includes('..') || (expectedPublicId && publicId !== expectedPublicId)) {
    throw Object.assign(new Error('El recurso no pertenece a la carpeta autorizada'), { status: 400 });
  }
  let parsedUrl;
  try { parsedUrl = new URL(secureUrl); } catch { throw Object.assign(new Error('URL de Cloudinary no válida'), { status: 400 }); }
  const path = decodeURIComponent(parsedUrl.pathname);
  const expectedPathPrefix = `/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/`;
  if (parsedUrl.protocol !== 'https:' || parsedUrl.hostname !== 'res.cloudinary.com' || !path.startsWith(expectedPathPrefix)
    || !path.includes(`/${publicId}.`) || parsedUrl.username || parsedUrl.password) {
    throw Object.assign(new Error('La URL no corresponde al entorno Cloudinary configurado'), { status: 400 });
  }
  if (!await verifyCloudinaryResponseSignature(env, publicId, version, signature)) {
    throw Object.assign(new Error('La firma de respuesta de Cloudinary no es válida'), { status: 400 });
  }
  return {
    ...asset,
    publicId,
    secureUrl: parsedUrl.toString(),
    resourceType,
    version,
    sourceFilename: normalizeSourceFilename(asset.sourceFilename),
    uploadSessionId: session.id,
    uploadSession: session,
  };
};

const destroyCloudinaryAsset = async (env, storedPublicId, owners) => {
  if (!storedPublicId) return { deleted: false, skipped: true };
  if (!ownedCloudinaryPublicId(env, storedPublicId, owners)) {
    console.warn(JSON.stringify({ message: 'cloudinary_delete_skipped', reason: 'outside_owned_prefix' }));
    return { deleted: false, skipped: true };
  }
  const { isVideo, publicId } = cloudinaryPublicId(storedPublicId);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await cloudinarySignature(env, { public_id: publicId, timestamp });
  const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: env.CLOUDINARY_API_KEY, signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${isVideo ? 'video' : 'image'}/destroy`, { method: 'POST', body });
  const payload = await response.json().catch(() => ({}));
  if (!response.ok || !['ok', 'not found'].includes(payload.result)) {
    console.error(JSON.stringify({ message: 'cloudinary_delete_failed', status: response.status, result: payload.result || 'unknown' }));
    return { deleted: false, skipped: false };
  }
  return { deleted: payload.result === 'ok', skipped: payload.result === 'not found' };
};

const cleanupNotBefore = session => Math.max(
  Date.now() + CLEANUP_SAFETY_MS,
  Number(session?.expiresAt || 0) + CLEANUP_SAFETY_MS,
);

const cleanupQueueStatement = (env, storedPublicId, owners, notBefore = Date.now() + UPLOAD_SESSION_TTL_MS + CLEANUP_SAFETY_MS) => {
  const timestamp = Date.now();
  return env.DB.prepare(`INSERT INTO cloudinary_cleanup_queue
    (publicId, owners, notBefore, attempts, lastError, createdAt, updatedAt)
    VALUES (?, ?, ?, 0, NULL, ?, ?)
    ON CONFLICT(publicId) DO UPDATE SET owners = excluded.owners,
      notBefore = MAX(cloudinary_cleanup_queue.notBefore, excluded.notBefore), updatedAt = excluded.updatedAt`)
    .bind(storedPublicId, JSON.stringify([...new Set(owners.filter(Boolean))]), notBefore, timestamp, timestamp);
};

const queueCloudinaryCleanup = async (env, storedPublicIds, owners, notBefore) => {
  const unique = [...new Set(storedPublicIds.filter(Boolean))];
  if (!unique.length) return 0;
  await env.DB.batch(unique.map(publicId => cleanupQueueStatement(env, publicId, owners, notBefore)));
  return unique.length;
};

export const processCloudinaryCleanup = async env => {
  const timestamp = Date.now();
  const { results } = await env.DB.prepare(`SELECT * FROM cloudinary_cleanup_queue
    WHERE notBefore <= ? ORDER BY notBefore ASC LIMIT ?`).bind(timestamp, CLEANUP_BATCH_SIZE).all();
  const summary = { inspected: 0, deleted: 0, retained: 0, postponed: 0, failed: 0 };
  for (const queued of results || []) {
    summary.inspected += 1;
    const referenced = await env.DB.prepare('SELECT id FROM photos WHERE publicId = ? LIMIT 1').bind(queued.publicId).first();
    if (referenced) {
      await env.DB.prepare('DELETE FROM cloudinary_cleanup_queue WHERE publicId = ?').bind(queued.publicId).run();
      summary.retained += 1;
      continue;
    }
    const { publicId } = cloudinaryPublicId(queued.publicId);
    const activeSession = await env.DB.prepare(`SELECT expiresAt FROM upload_sessions
      WHERE ? LIKE folder || '/%' AND expiresAt > ? ORDER BY expiresAt DESC LIMIT 1`).bind(publicId, timestamp).first();
    if (activeSession) {
      await env.DB.prepare('UPDATE cloudinary_cleanup_queue SET notBefore = ?, updatedAt = ? WHERE publicId = ?')
        .bind(Number(activeSession.expiresAt) + CLEANUP_SAFETY_MS, timestamp, queued.publicId).run();
      summary.postponed += 1;
      continue;
    }
    let owners = [];
    try { owners = JSON.parse(queued.owners || '[]'); } catch { owners = []; }
    try {
      const result = await destroyCloudinaryAsset(env, queued.publicId, owners);
      if (result.deleted || result.skipped) {
        await env.DB.prepare('DELETE FROM cloudinary_cleanup_queue WHERE publicId = ?').bind(queued.publicId).run();
        summary.deleted += Number(result.deleted);
      } else {
        throw new Error('Cloudinary no confirmó el borrado');
      }
    } catch (error) {
      const attempts = Number(queued.attempts || 0) + 1;
      const retryAt = timestamp + Math.min(6 * 60 * 60 * 1000, (2 ** Math.min(attempts, 8)) * 60 * 1000);
      await env.DB.prepare(`UPDATE cloudinary_cleanup_queue SET attempts = ?, lastError = ?, notBefore = ?, updatedAt = ?
        WHERE publicId = ?`).bind(attempts, String(error?.message || error).slice(0, 300), retryAt, timestamp, queued.publicId).run();
      summary.failed += 1;
    }
  }
  return summary;
};

const listProperties = async (request, env, admin = false) => {
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(admin ? 100 : 48, Math.max(1, Number.parseInt(url.searchParams.get('limit') || (admin ? '20' : '12'), 10) || 12));
  const where = admin ? [] : ['published = 1'];
  const values = [];
  const equalFilters = admin ? [] : [['operation', 'operation'], ['type', 'type']];
  for (const [parameter, field] of equalFilters) {
    const value = url.searchParams.get(parameter);
    if (value) { where.push(`${field} = ?`); values.push(value); }
  }
  const city = url.searchParams.get('city');
  if (city) { where.push('citySearch = ?'); values.push(foldSpanish(city)); }
  const featured = url.searchParams.get('featured');
  if (!admin && featured === 'true') where.push('featured = 1');
  const published = url.searchParams.get('published');
  if (admin && (published === 'true' || published === 'false')) where.push(`published = ${published === 'true' ? 1 : 0}`);
  const minPrice = nullableNumber(url.searchParams.get('minPrice'));
  const maxPrice = nullableNumber(url.searchParams.get('maxPrice'));
  if (minPrice !== null) { where.push('price >= ?'); values.push(minPrice); }
  if (maxPrice !== null) { where.push('price <= ?'); values.push(maxPrice); }
  const bedrooms = nullableInteger(url.searchParams.get('bedrooms'));
  const bathrooms = nullableNumber(url.searchParams.get('bathrooms'));
  if (bedrooms !== null) { where.push('bedrooms >= ?'); values.push(bedrooms); }
  if (bathrooms !== null) { where.push('bathrooms >= ?'); values.push(bathrooms); }
  const search = url.searchParams.get('search')?.trim();
  if (search) {
    where.push('searchText LIKE ?');
    values.push(`%${foldSpanish(search)}%`);
  }
  const sortMap = { price_asc: 'price ASC', price_desc: 'price DESC', newest: 'createdAt DESC', area_desc: 'area DESC' };
  const orderBy = admin ? 'updatedAt DESC' : sortMap[url.searchParams.get('sort')] || 'createdAt DESC';
  const clause = where.length ? `WHERE ${where.join(' AND ')}` : '';
  const offset = (page - 1) * limit;
  const [rows, count] = await env.DB.batch([
    env.DB.prepare(`SELECT * FROM properties ${clause} ORDER BY ${orderBy} LIMIT ? OFFSET ?`).bind(...values, limit, offset),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM properties ${clause}`).bind(...values),
  ]);
  const properties = await attachPhotos(env, rows.results || []);
  const total = Number(count.results?.[0]?.total || 0);
  return json({ properties, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

const handleLogin = async (request, env) => {
  assertAuthConfiguration(env);
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  const password = String(body.password || '');
  const clientAddress = request.headers.get('cf-connecting-ip') || 'local';
  const attemptKey = await hmacHex(env.JWT_SECRET, `login-attempt-v1\0${clientAddress}\0${email}`);
  const timestampMs = Date.now();
  await env.DB.prepare('DELETE FROM login_attempts WHERE firstAttemptAt < ? AND lockedUntil < ?')
    .bind(timestampMs - LOGIN_WINDOW_MS, timestampMs).run();
  // Un UPDATE no-op fuerza la lectura coordinada con el escritor D1, incluso entre isolates.
  const attempt = await env.DB.prepare(`UPDATE login_attempts SET failures = failures WHERE attemptKey = ?
    RETURNING failures, firstAttemptAt, lockedUntil`).bind(attemptKey).first();
  if (Number(attempt?.lockedUntil || 0) > timestampMs) {
    throw Object.assign(new Error('Demasiados intentos. Intenta de nuevo más tarde'), { status: 429 });
  }
  const emailMatches = await timingSafeTextEqual(email, String(env.ADMIN_EMAIL).trim().toLowerCase());
  const passwordMatches = await timingSafeTextEqual(password, String(env.ADMIN_PASSWORD));
  if (!emailMatches || !passwordMatches) {
    const updatedAttempt = await env.DB.prepare(`INSERT INTO login_attempts (attemptKey, failures, firstAttemptAt, lockedUntil)
      VALUES (?, 1, ?, 0)
      ON CONFLICT(attemptKey) DO UPDATE SET
        failures = CASE WHEN excluded.firstAttemptAt - login_attempts.firstAttemptAt <= ?
          THEN login_attempts.failures + 1 ELSE 1 END,
        firstAttemptAt = CASE WHEN excluded.firstAttemptAt - login_attempts.firstAttemptAt <= ?
          THEN login_attempts.firstAttemptAt ELSE excluded.firstAttemptAt END,
        lockedUntil = CASE WHEN (CASE WHEN excluded.firstAttemptAt - login_attempts.firstAttemptAt <= ?
          THEN login_attempts.failures + 1 ELSE 1 END) >= ?
          THEN excluded.firstAttemptAt + ? ELSE 0 END
      RETURNING failures, firstAttemptAt, lockedUntil`)
      .bind(attemptKey, timestampMs, LOGIN_WINDOW_MS, LOGIN_WINDOW_MS, LOGIN_WINDOW_MS, LOGIN_MAX_FAILURES, LOGIN_WINDOW_MS).first();
    if (Number(updatedAttempt?.lockedUntil || 0) > timestampMs) {
      throw Object.assign(new Error('Demasiados intentos. Intenta de nuevo más tarde'), { status: 429 });
    }
    throw Object.assign(new Error('Credenciales inválidas'), { status: 401 });
  }
  await env.DB.prepare('DELETE FROM login_attempts WHERE attemptKey = ?').bind(attemptKey).run();
  const timestamp = now();
  const existing = await env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  const id = existing?.id || makeId('user');
  const passwordVerifier = `hmac-sha256:${await hmacHex(env.JWT_SECRET, `admin-password-v1\0${password}`)}`;
  await env.DB.prepare(`INSERT INTO users (id, email, password, name, role, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 'admin', ?, ?)
    ON CONFLICT(email) DO UPDATE SET password = excluded.password, role = 'admin', updatedAt = excluded.updatedAt`)
    .bind(id, email, passwordVerifier, existing?.name || 'Administrador', existing?.createdAt || timestamp, timestamp).run();
  const user = await env.DB.prepare('SELECT id, email, name, role FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  const token = await signToken(env, user);
  return json({ user, token }, 200, { 'set-cookie': `token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Strict; Path=/; Max-Age=${JWT_TTL_SECONDS}` });
};

const handlePropertyDetail = async (env, slug) => {
  const property = await env.DB.prepare('SELECT * FROM properties WHERE slug = ? AND published = 1').bind(slug).first();
  if (!property) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
  await env.DB.prepare('UPDATE properties SET views = views + 1 WHERE id = ?').bind(property.id).run();
  const [withMedia] = await attachPhotos(env, [property]);
  const { results } = await env.DB.prepare(`SELECT * FROM properties
    WHERE published = 1 AND id != ? AND (city = ? COLLATE NOCASE OR operation = ? OR type = ?)
    ORDER BY createdAt DESC LIMIT 3`).bind(property.id, property.city, property.operation, property.type).all();
  return json({ property: withMedia, related: await attachPhotos(env, results || []) });
};

const handleCreateProperty = async (request, env) => {
  await requireAdmin(request, env);
  const data = await sanitizeProperty(env, await readJson(request));
  const property = await insertProperty(env, data);
  return json(normalizeProperty({ ...property, photos: [] }), 201);
};

const handleUpdateProperty = async (request, env, id) => {
  await requireAdmin(request, env);
  const existing = await env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(id).first();
  if (!existing) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
  const data = await sanitizeProperty(env, await readJson(request), existing);
  const property = await updateProperty(env, id, data);
  const [result] = await attachPhotos(env, [property]);
  return json(result);
};

const handleDeleteProperty = async (request, env, id) => {
  await requireAdmin(request, env);
  const property = await env.DB.prepare('SELECT id, sourceId FROM properties WHERE id = ?').bind(id).first();
  if (!property) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
  const { results } = await env.DB.prepare('SELECT publicId FROM photos WHERE propertyId = ?').bind(id).all();
  const owners = [property.id, property.sourceId].filter(Boolean);
  const publicIds = [...new Set((results || []).map(photo => photo.publicId).filter(Boolean))];
  await env.DB.batch([
    env.DB.prepare('DELETE FROM properties WHERE id = ?').bind(id),
    ...publicIds.map(publicId => cleanupQueueStatement(env, publicId, owners)),
  ]);
  return json({ message: 'Propiedad eliminada', cleanupPending: publicIds.length });
};

const handleInquiry = async (request, env) => {
  const body = await readJson(request);
  if (body.honeypot) return json({ message: 'Consulta enviada' }, 201);
  const name = String(body.name || '').trim().slice(0, 180);
  const email = String(body.email || '').trim().slice(0, 240);
  const message = String(body.message || '').trim().slice(0, 5000);
  if (!name || !email || !message) throw Object.assign(new Error('Nombre, email y mensaje son requeridos'), { status: 400 });
  const id = makeId('inq');
  await env.DB.prepare(`INSERT INTO inquiries (id, name, email, phone, message, propertyId, honeypot, isRead, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, NULL, 0, ?)`)
    .bind(id, name, email, String(body.phone || '').trim() || null, message, body.propertyId || null, now()).run();
  return json(await env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(id).first(), 201);
};

const handleInquiryList = async (request, env) => {
  await requireAdmin(request, env);
  const url = new URL(request.url);
  const page = Math.max(1, Number.parseInt(url.searchParams.get('page') || '1', 10) || 1);
  const limit = Math.min(100, Math.max(1, Number.parseInt(url.searchParams.get('limit') || '20', 10) || 20));
  const unreadOnly = url.searchParams.get('unread') === 'true';
  const clause = unreadOnly ? 'WHERE i.isRead = 0' : '';
  const [rows, count] = await env.DB.batch([
    env.DB.prepare(`SELECT i.*, p.id AS property_id, p.title AS property_title, p.slug AS property_slug
      FROM inquiries i LEFT JOIN properties p ON p.id = i.propertyId ${clause}
      ORDER BY i.createdAt DESC LIMIT ? OFFSET ?`).bind(limit, (page - 1) * limit),
    env.DB.prepare(`SELECT COUNT(*) AS total FROM inquiries i ${clause}`),
  ]);
  const inquiries = (rows.results || []).map(row => ({
    ...row,
    isRead: Boolean(row.isRead),
    property: row.property_id ? { id: row.property_id, title: row.property_title, slug: row.property_slug } : null,
    property_id: undefined,
    property_title: undefined,
    property_slug: undefined,
  }));
  const total = Number(count.results?.[0]?.total || 0);
  return json({ inquiries, pagination: { page, limit, total, pages: Math.ceil(total / limit) } });
};

const handleStats = async (request, env) => {
  await requireAdmin(request, env);
  const results = await env.DB.batch([
    env.DB.prepare(`SELECT COUNT(*) AS totalProperties,
      SUM(status = 'available') AS availableProperties,
      SUM(status = 'sold') AS soldProperties,
      SUM(status = 'rented') AS rentedProperties,
      SUM(featured = 1) AS featuredProperties,
      COALESCE(SUM(views), 0) AS totalViews FROM properties`),
    env.DB.prepare('SELECT COUNT(*) AS totalInquiries, SUM(isRead = 0) AS unreadInquiries FROM inquiries'),
    env.DB.prepare('SELECT * FROM properties ORDER BY createdAt DESC LIMIT 5'),
    env.DB.prepare(`SELECT i.*, p.title AS property_title, p.slug AS property_slug FROM inquiries i
      LEFT JOIN properties p ON p.id = i.propertyId ORDER BY i.createdAt DESC LIMIT 5`),
    env.DB.prepare('SELECT operation, COUNT(*) AS count FROM properties GROUP BY operation'),
    env.DB.prepare('SELECT type, COUNT(*) AS count FROM properties GROUP BY type'),
  ]);
  const propertyCounts = results[0].results?.[0] || {};
  const inquiryCounts = results[1].results?.[0] || {};
  const recentProperties = await attachPhotos(env, results[2].results || []);
  return json({
    totalProperties: Number(propertyCounts.totalProperties || 0),
    availableProperties: Number(propertyCounts.availableProperties || 0),
    soldProperties: Number(propertyCounts.soldProperties || 0),
    rentedProperties: Number(propertyCounts.rentedProperties || 0),
    featuredProperties: Number(propertyCounts.featuredProperties || 0),
    totalInquiries: Number(inquiryCounts.totalInquiries || 0),
    unreadInquiries: Number(inquiryCounts.unreadInquiries || 0),
    totalViews: Number(propertyCounts.totalViews || 0),
    recentProperties,
    recentInquiries: (results[3].results || []).map(row => ({
      ...row,
      isRead: Boolean(row.isRead),
      property: row.property_title ? { title: row.property_title, slug: row.property_slug } : null,
      property_title: undefined,
      property_slug: undefined,
    })),
    byOperation: results[4].results || [],
    byType: results[5].results || [],
  });
};

const safeFolderSegment = value => String(value || 'property')
  .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  .replace(/[^a-zA-Z0-9_-]+/g, '-').replace(/^-+|-+$/g, '').slice(0, 120) || 'property';

const handleUploadSign = async (request, env) => {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const owner = String(body.propertyId || body.sourceId || '').trim().slice(0, 160);
  if (!owner) throw Object.assign(new Error('propertyId o sourceId es obligatorio'), { status: 400 });
  if (body.propertyId) {
    const property = await env.DB.prepare('SELECT id FROM properties WHERE id = ?').bind(owner).first();
    if (!property) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
  }
  return json(await createUploadSession(env, {
    ownerType: body.propertyId ? 'property' : 'source',
    ownerId: owner,
    expectedFiles: body.expectedFiles,
    maxFiles: body.maxFiles,
  }));
};

const handleUploadComplete = async (request, env) => {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const property = await env.DB.prepare('SELECT id, title FROM properties WHERE id = ?').bind(body.propertyId).first();
  if (!property) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
  const asset = await validateCloudinaryAsset(env, body, 'property', property.id);
  const storedPublicId = asset.resourceType === 'video' ? `video:${asset.publicId}` : asset.publicId;
  const duplicate = await env.DB.prepare('SELECT * FROM photos WHERE publicId = ?').bind(storedPublicId).first();
  if (duplicate) {
    if (duplicate.propertyId !== property.id) throw Object.assign(new Error('El recurso ya pertenece a otra propiedad'), { status: 409 });
    return json(normalizePhoto(duplicate));
  }
  const prior = asset.sourceFilename
    ? await env.DB.prepare('SELECT * FROM photos WHERE propertyId = ? AND sourceFilename = ?').bind(property.id, asset.sourceFilename).first()
    : null;
  const counts = await env.DB.prepare(`SELECT COUNT(*) AS total,
    SUM(publicId IS NULL OR publicId NOT LIKE 'video:%') AS images FROM photos WHERE propertyId = ?`).bind(property.id).first();
  const id = prior?.id || makeId('media');
  const isVideo = asset.resourceType === 'video';
  const mediaValues = [
    asset.secureUrl, storedPublicId, body.alt || (isVideo ? `Video de ${property.title}` : property.title),
    prior?.order ?? Number(counts?.total || 0), prior?.isMain ?? Number(!isVideo && Number(counts?.images || 0) === 0),
    asset.sourceFilename || null, body.checksum || null, nullableInteger(body.originalBytes),
    nullableInteger(body.optimizedBytes || body.bytes), nullableInteger(body.width), nullableInteger(body.height),
    nullableNumber(body.duration), body.codec || body.format || null, body.qualityPreset || null,
  ];
  const statements = [env.DB.prepare('UPDATE upload_sessions SET usedFiles = usedFiles + 1 WHERE id = ?').bind(asset.uploadSessionId)];
  if (prior) {
    statements.push(env.DB.prepare(`UPDATE photos SET url = ?, publicId = ?, alt = ?, "order" = ?, isMain = ?, sourceFilename = ?,
        checksum = ?, originalBytes = ?, optimizedBytes = ?, width = ?, height = ?, duration = ?, codec = ?, qualityPreset = ? WHERE id = ?`)
      .bind(...mediaValues, id));
  } else {
    statements.push(env.DB.prepare(`INSERT INTO photos (id, url, publicId, alt, "order", isMain, sourceFilename, checksum,
        originalBytes, optimizedBytes, width, height, duration, codec, qualityPreset, propertyId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, ...mediaValues, property.id, now()));
  }
  if (prior?.publicId && prior.publicId !== storedPublicId) {
    statements.push(cleanupQueueStatement(env, prior.publicId, [property.id]));
  }
  try {
    await env.DB.batch(statements);
  } catch (error) {
    if (!prior || prior.publicId !== storedPublicId) {
      await queueCloudinaryCleanup(env, [storedPublicId], [property.id], cleanupNotBefore(asset.uploadSession));
    }
    throw error;
  }
  return json(normalizePhoto(await env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(id).first()), prior ? 200 : 201);
};

const validateImportInventory = inventory => {
  const rawFiles = Array.isArray(inventory?.files) ? inventory.files : [];
  if (!rawFiles.length) throw Object.assign(new Error('El inventario está vacío'), { status: 400 });
  if (rawFiles.length > IMPORT_MAX_FILES) throw Object.assign(new Error(`El inventario excede ${IMPORT_MAX_FILES} archivos`), { status: 413 });
  const files = rawFiles.map(item => {
    const path = normalizeSourceFilename(item?.path || item?.name);
    const size = nullableInteger(item?.size);
    const category = String(item?.category || '').toLowerCase();
    if (!path || path.includes('../') || path.startsWith('..') || !Number.isInteger(size) || size < 0 || size > IMPORT_MAX_SINGLE_BYTES) {
      throw Object.assign(new Error('El inventario contiene una ruta o tamaño no permitido'), { status: 400 });
    }
    if (!['image', 'video', 'document', 'other'].includes(category)) {
      throw Object.assign(new Error('El inventario contiene un tipo no permitido'), { status: 400 });
    }
    return { path, name: String(item?.name || path.split('/').at(-1)).slice(0, 240), size, category };
  });
  if (new Set(files.map(item => item.path)).size !== files.length) {
    throw Object.assign(new Error('El inventario contiene rutas duplicadas'), { status: 400 });
  }
  const totalBytes = files.reduce((sum, item) => sum + item.size, 0);
  if (totalBytes > IMPORT_MAX_TOTAL_BYTES) throw Object.assign(new Error('El inventario excede el tamaño total permitido'), { status: 413 });
  const media = files.filter(item => ['image', 'video'].includes(item.category));
  if (!media.length || !media.some(item => item.category === 'image')) {
    throw Object.assign(new Error('La importación requiere al menos una fotografía'), { status: 400 });
  }
  if (media.length > IMPORT_MAX_MEDIA) throw Object.assign(new Error(`La importación excede ${IMPORT_MAX_MEDIA} archivos multimedia`), { status: 413 });
  return {
    files,
    media,
    totalBytes,
    counts: {
      images: media.filter(item => item.category === 'image').length,
      videos: media.filter(item => item.category === 'video').length,
      documents: files.filter(item => item.category === 'document').length,
      other: files.filter(item => item.category === 'other').length,
    },
  };
};

const handleImportAnalyze = async (request, env) => {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const inventory = validateImportInventory(body.inventory);
  const documents = (Array.isArray(body.documents) ? body.documents : []).slice(0, 20).map(item => ({
    name: normalizeSourceFilename(item?.name),
    text: String(item?.text || ''),
  }));
  const analysisBytes = documents.reduce((sum, item) => sum + encoder.encode(item.text).byteLength, 0);
  if (analysisBytes > IMPORT_MAX_ANALYSIS_TEXT_BYTES) {
    throw Object.assign(new Error('Los textos para análisis exceden el límite permitido'), { status: 413 });
  }
  const analysis = analyzePropertyDocuments(inventory, documents);
  return json({
    ...analysis,
    inventory: { counts: inventory.counts, totalBytes: inventory.totalBytes, files: inventory.files },
  });
};

const handleImportStart = async (request, env) => {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const inventory = validateImportInventory(body.inventory);
  const importId = makeId('import');
  const signed = await createUploadSession(env, {
    ownerType: 'import', ownerId: importId,
    expectedFiles: inventory.media.map(item => item.path), maxFiles: inventory.media.length,
  });
  return json({ importId, signed, inventory: { counts: inventory.counts, totalBytes: inventory.totalBytes } }, 201);
};

const handleImportCancel = async (request, env) => {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const importId = String(body.importId || '').trim();
  const sessionId = String(body.uploadSessionId || '').trim();
  const session = await env.DB.prepare('SELECT * FROM upload_sessions WHERE id = ? AND ownerType = ? AND ownerId = ?')
    .bind(sessionId, 'import', importId).first();
  if (!session) throw Object.assign(new Error('Sesión de importación no encontrada'), { status: 404 });
  const expected = new Set(JSON.parse(session.expectedFiles || '[]'));
  const storedPublicIds = [];
  for (const item of Array.isArray(body.files) ? body.files : []) {
    const sourceFilename = normalizeSourceFilename(item?.sourceFilename);
    const resourceType = String(item?.resourceType || '').toLowerCase();
    if (!expected.has(sourceFilename) || !['image', 'video'].includes(resourceType)) continue;
    const publicId = `${session.folder}/asset-${(await sha256Hex(`${session.id}\0${sourceFilename}`)).slice(0, 32)}`;
    storedPublicIds.push(resourceType === 'video' ? `video:${publicId}` : publicId);
  }
  const cancelledAt = Date.now();
  await env.DB.prepare('UPDATE upload_sessions SET expiresAt = ?, completedAt = ? WHERE id = ?')
    .bind(cancelledAt, cancelledAt, session.id).run();
  const queued = await queueCloudinaryCleanup(env, storedPublicIds, [importId], cancelledAt + CLEANUP_SAFETY_MS);
  return json({ cancelled: true, cleanupPending: queued });
};

const handleImportComplete = async (request, env) => {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const importId = String(body.importId || '').trim();
  const rawAssets = Array.isArray(body.assets) ? body.assets : [];
  if (!importId) throw Object.assign(new Error('importId es obligatorio'), { status: 400 });
  const draftValidation = validatePropertyDraft(body.draft);
  if (draftValidation.missingFields.length || draftValidation.invalidFields.length) {
    throw Object.assign(new Error('El borrador contiene campos obligatorios vacíos o datos no válidos'), {
      status: 422,
      details: draftValidation,
    });
  }
  const existingImport = await env.DB.prepare('SELECT * FROM properties WHERE sourceId = ? AND syncSource = ?')
    .bind(importId, 'web-import').first();
  if (existingImport) {
    const [result] = await attachPhotos(env, [existingImport]);
    return json({ property: result, repeated: true, summary: {
      images: result.photos.filter(item => !String(item.publicId || '').startsWith('video:')).length,
      videos: result.photos.filter(item => String(item.publicId || '').startsWith('video:')).length,
      published: result.published,
    } });
  }
  if (!rawAssets.length || rawAssets.length > IMPORT_MAX_MEDIA) {
    throw Object.assign(new Error('La importación final no tiene un formato válido'), { status: 400 });
  }
  const validation = await Promise.allSettled(rawAssets.map(asset => validateCloudinaryAsset(env, asset, 'import', importId)));
  const accepted = validation.filter(result => result.status === 'fulfilled').map(result => result.value);
  const rejected = validation.find(result => result.status === 'rejected');
  const queueAccepted = () => queueCloudinaryCleanup(env,
    accepted.map(asset => asset.resourceType === 'video' ? `video:${asset.publicId}` : asset.publicId), [importId],
    Math.max(0, ...accepted.map(asset => cleanupNotBefore(asset.uploadSession))));
  if (rejected) { await queueAccepted(); throw rejected.reason; }
  const session = accepted[0].uploadSession;
  if (accepted.some(asset => asset.uploadSessionId !== session.id)) {
    await queueAccepted();
    throw Object.assign(new Error('Todos los archivos deben pertenecer a la misma sesión de importación'), { status: 400 });
  }
  const expected = JSON.parse(session.expectedFiles || '[]');
  const received = accepted.map(asset => asset.sourceFilename);
  if (accepted.length !== expected.length || new Set(received).size !== received.length || expected.some(path => !received.includes(path))) {
    await queueAccepted();
    throw Object.assign(new Error('No se recibieron y validaron todos los archivos del inventario'), { status: 409 });
  }
  if (!accepted.some(asset => asset.resourceType === 'image')) {
    await queueAccepted();
    throw Object.assign(new Error('La propiedad requiere al menos una fotografía válida'), { status: 400 });
  }
  const requestedPublished = parseBoolean(body.draft?.published, false);
  const data = await sanitizeProperty(env, {
    ...body.draft, sourceId: importId, syncSource: 'web-import', sourceUpdatedAt: now(), published: false,
  });
  const propertyId = makeId('prop');
  const timestamp = now();
  const propertyColumns = PROPERTY_FIELDS.filter(field => field !== 'views');
  const requestedMain = normalizeSourceFilename(body.draft?.mainPhotoFilename);
  const ordered = [...accepted].sort((a, b) => {
    const order = Array.isArray(body.draft?.mediaOrder) ? body.draft.mediaOrder.map(normalizeSourceFilename) : expected;
    return order.indexOf(a.sourceFilename) - order.indexOf(b.sourceFilename);
  });
  const main = ordered.find(asset => asset.resourceType === 'image' && asset.sourceFilename === requestedMain)
    || ordered.find(asset => asset.resourceType === 'image');
  const statements = [env.DB.prepare(`INSERT INTO properties (id, ${propertyColumns.join(', ')}, views, createdAt, updatedAt)
    VALUES (?, ${propertyColumns.map(() => '?').join(', ')}, ?, ?, ?)`)
    .bind(propertyId, ...propertyColumns.map(field => data[field]), data.views || 0, timestamp, timestamp)];
  for (const [index, asset] of ordered.entries()) {
    const storedPublicId = asset.resourceType === 'video' ? `video:${asset.publicId}` : asset.publicId;
    statements.push(env.DB.prepare(`INSERT INTO photos (id, url, publicId, alt, "order", isMain, sourceFilename, checksum,
      originalBytes, optimizedBytes, width, height, duration, codec, qualityPreset, propertyId, createdAt)
      VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(makeId('media'), asset.secureUrl, storedPublicId,
        asset.resourceType === 'video' ? `Video de ${data.title}` : `${data.title} - ${asset.sourceFilename}`,
        index, Number(asset === main), asset.sourceFilename, asset.checksum || null, nullableInteger(asset.originalBytes),
        nullableInteger(asset.optimizedBytes || asset.bytes), nullableInteger(asset.width), nullableInteger(asset.height),
        nullableNumber(asset.duration), asset.codec || asset.format || null, asset.qualityPreset || null, propertyId, timestamp));
  }
  statements.push(env.DB.prepare('UPDATE upload_sessions SET usedFiles = usedFiles + ?, completedAt = ? WHERE id = ?')
    .bind(accepted.length, Date.now(), session.id));
  statements.push(env.DB.prepare('UPDATE properties SET published = ?, updatedAt = ? WHERE id = ?')
    .bind(requestedPublished, timestamp, propertyId));
  try {
    await env.DB.batch(statements);
  } catch (error) {
    await queueAccepted();
    throw error;
  }
  const property = await env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(propertyId).first();
  const [result] = await attachPhotos(env, [property]);
  return json({
    property: result,
    summary: {
      images: result.photos.filter(item => !String(item.publicId || '').startsWith('video:')).length,
      videos: result.photos.filter(item => String(item.publicId || '').startsWith('video:')).length,
      published: result.published,
    },
  }, 201);
};

const upsertSyncedProperty = async (request, env) => {
  await requireAdmin(request, env);
  const body = await readJson(request);
  const sourceId = String(body.sourceId || '').trim().slice(0, 160);
  if (!sourceId) throw Object.assign(new Error('sourceId es obligatorio'), { status: 400 });
  const draft = body.draft;
  if (!draft || typeof draft !== 'object') throw Object.assign(new Error('El borrador no tiene un formato válido'), { status: 400 });
  const manifest = body.manifest && typeof body.manifest === 'object' ? body.manifest : {};
  const rawAssets = Array.isArray(body.assets) ? body.assets : [];
  if (rawAssets.length > 100) throw Object.assign(new Error('La sincronización excede el máximo de 100 archivos por solicitud'), { status: 413 });
  const existing = await env.DB.prepare('SELECT * FROM properties WHERE sourceId = ?').bind(sourceId).first();
  const data = await sanitizeProperty(env, { ...draft, sourceId, syncSource: 'circulo-media-sync' }, existing);
  const propertyId = existing?.id || makeId('prop');
  const current = existing
    ? await env.DB.prepare('SELECT * FROM photos WHERE propertyId = ?').bind(propertyId).all()
    : { results: [] };
  const currentMedia = current.results || [];
  const bySource = new Map(currentMedia.filter(item => item.sourceFilename).map(item => [normalizeSourceFilename(item.sourceFilename), item]));
  const manualMedia = currentMedia.filter(item => !item.sourceFilename);
  const validationResults = await Promise.allSettled(rawAssets.map(asset => validateCloudinaryAsset(env, asset, 'source', sourceId)));
  const rejectedAsset = validationResults.find(result => result.status === 'rejected');
  if (rejectedAsset) {
    const accepted = validationResults.filter(result => result.status === 'fulfilled').map(result => result.value);
    await queueCloudinaryCleanup(env, accepted.map(value => value.resourceType === 'video' ? `video:${value.publicId}` : value.publicId),
      [sourceId], Math.max(0, ...accepted.map(value => cleanupNotBefore(value.uploadSession))));
    throw rejectedAsset.reason;
  }
  const validatedAssets = validationResults.map(result => result.value);
  const queueValidatedForCleanup = () => queueCloudinaryCleanup(env,
    validatedAssets.map(value => value.resourceType === 'video' ? `video:${value.publicId}` : value.publicId),
    [sourceId], Math.max(0, ...validatedAssets.map(value => cleanupNotBefore(value.uploadSession))));
  const seenSources = new Set();
  const seenPublicIds = new Set();
  for (const asset of validatedAssets) {
    if (!asset.sourceFilename) {
      await queueValidatedForCleanup();
      throw Object.assign(new Error('Cada archivo sincronizado requiere sourceFilename'), { status: 400 });
    }
    if (seenSources.has(asset.sourceFilename) || seenPublicIds.has(`${asset.resourceType}:${asset.publicId}`)) {
      await queueValidatedForCleanup();
      throw Object.assign(new Error('La solicitud contiene archivos duplicados'), { status: 400 });
    }
    seenSources.add(asset.sourceFilename);
    seenPublicIds.add(`${asset.resourceType}:${asset.publicId}`);
  }
  const removedFilenames = [...new Set((Array.isArray(manifest.removedFilenames) ? manifest.removedFilenames : [])
    .map(normalizeSourceFilename).filter(Boolean))];
  if (removedFilenames.some(filename => seenSources.has(filename))) {
    await queueValidatedForCleanup();
    throw Object.assign(new Error('Un archivo no puede cargarse y eliminarse en la misma sincronización'), { status: 400 });
  }

  let uploaded = 0;
  let unchanged = 0;
  let removed = 0;
  const changedRows = new Map();
  const cleanupAfterCommit = [];
  const cleanupOnFailure = [];

  for (const asset of validatedAssets) {
    const sourceFilename = asset.sourceFilename;
    const prior = bySource.get(sourceFilename);
    const isVideo = asset.resourceType === 'video';
    const storedPublicId = isVideo ? `video:${asset.publicId}` : asset.publicId;
    if (prior && asset.checksum && prior.checksum === asset.checksum) {
      unchanged += 1;
      if (prior.publicId !== storedPublicId) {
        cleanupAfterCommit.push(storedPublicId);
        cleanupOnFailure.push(storedPublicId);
      }
      continue;
    }
    const row = {
      id: prior?.id || makeId('media'),
      url: asset.secureUrl,
      publicId: storedPublicId,
      alt: isVideo ? `Video de ${data.title}` : `${data.title} - ${sourceFilename}`,
      order: 9999,
      isMain: 0,
      sourceFilename,
      checksum: asset.checksum || null,
      originalBytes: nullableInteger(asset.originalBytes),
      optimizedBytes: nullableInteger(asset.optimizedBytes || asset.bytes),
      width: nullableInteger(asset.width),
      height: nullableInteger(asset.height),
      duration: nullableNumber(asset.duration),
      codec: asset.codec || asset.format || null,
      qualityPreset: asset.qualityPreset || null,
      propertyId,
      createdAt: prior?.createdAt || now(),
    };
    bySource.set(sourceFilename, row);
    changedRows.set(sourceFilename, row);
    cleanupOnFailure.push(storedPublicId);
    if (prior?.publicId && prior.publicId !== storedPublicId) cleanupAfterCommit.push(prior.publicId);
    uploaded += 1;
  }

  const removedRows = [];
  for (const filename of removedFilenames) {
    const media = bySource.get(filename);
    if (!media) continue;
    removedRows.push(media);
    cleanupAfterCommit.push(media.publicId);
    bySource.delete(filename);
    removed += 1;
  }

  const order = Array.isArray(manifest.mediaOrder) ? manifest.mediaOrder.map(normalizeSourceFilename) : [];
  const rank = new Map(order.map((value, index) => [value, index]));
  const media = [...manualMedia, ...bySource.values()].sort((a, b) => {
    const aRank = rank.has(a.sourceFilename) ? rank.get(a.sourceFilename) : Number.MAX_SAFE_INTEGER;
    const bRank = rank.has(b.sourceFilename) ? rank.get(b.sourceFilename) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return String(a.sourceFilename || a.id).localeCompare(String(b.sourceFilename || b.id), 'es', { numeric: true });
  });
  const requested = normalizeSourceFilename(draft.mainPhotoFilename);
  const main = media.find(item => !String(item.publicId || '').startsWith('video:') && item.sourceFilename === requested)
    || media.find(item => !String(item.publicId || '').startsWith('video:') && item.isMain)
    || media.find(item => !String(item.publicId || '').startsWith('video:'));
  if (!main) {
    await queueValidatedForCleanup();
    throw Object.assign(new Error('La propiedad debe conservar al menos una fotografía'), { status: 400 });
  }

  const timestamp = now();
  const propertyColumns = PROPERTY_FIELDS.filter(field => field !== 'views');
  const statements = [];
  if (existing) {
    const nextVersion = Number(existing.syncVersion || 0) + 1;
    statements.push(env.DB.prepare(`INSERT INTO property_sync_commits (propertyId, version, createdAt) VALUES (?, ?, ?)`)
      .bind(propertyId, nextVersion, timestamp));
    statements.push(env.DB.prepare(`UPDATE properties SET ${propertyColumns.map(field => `${field} = ?`).join(', ')},
      views = ?, syncVersion = ?, updatedAt = ? WHERE id = ?`)
      .bind(...propertyColumns.map(field => data[field]), data.views || 0, nextVersion, timestamp, propertyId));
  } else {
    statements.push(env.DB.prepare(`INSERT INTO properties (id, ${propertyColumns.join(', ')}, views, createdAt, updatedAt)
      VALUES (?, ${propertyColumns.map(() => '?').join(', ')}, ?, ?, ?)`)
      .bind(propertyId, ...propertyColumns.map(field => data[field]), data.views || 0, timestamp, timestamp));
    statements.push(env.DB.prepare(`INSERT INTO property_sync_commits (propertyId, version, createdAt) VALUES (?, 0, ?)`)
      .bind(propertyId, timestamp));
  }
  for (const row of removedRows) statements.push(env.DB.prepare('DELETE FROM photos WHERE id = ? AND propertyId = ?').bind(row.id, propertyId));
  for (const [index, item] of media.entries()) {
    const isMain = Number(item.id === main.id);
    const changed = item.sourceFilename ? changedRows.get(item.sourceFilename) : null;
    if (changed) {
      statements.push(env.DB.prepare(`INSERT INTO photos (id, url, publicId, alt, "order", isMain, sourceFilename, checksum,
        originalBytes, optimizedBytes, width, height, duration, codec, qualityPreset, propertyId, createdAt)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
        ON CONFLICT(propertyId, sourceFilename) DO UPDATE SET url = excluded.url, publicId = excluded.publicId,
          alt = excluded.alt, "order" = excluded."order", isMain = excluded.isMain, checksum = excluded.checksum,
          originalBytes = excluded.originalBytes, optimizedBytes = excluded.optimizedBytes, width = excluded.width,
          height = excluded.height, duration = excluded.duration, codec = excluded.codec, qualityPreset = excluded.qualityPreset`)
        .bind(changed.id, changed.url, changed.publicId, changed.alt, index, isMain, changed.sourceFilename, changed.checksum,
          changed.originalBytes, changed.optimizedBytes, changed.width, changed.height, changed.duration, changed.codec,
          changed.qualityPreset, propertyId, changed.createdAt));
    } else {
      statements.push(env.DB.prepare('UPDATE photos SET "order" = ?, isMain = ? WHERE id = ? AND propertyId = ?')
        .bind(index, isMain, item.id, propertyId));
    }
  }
  const assetsBySession = new Map();
  for (const asset of validatedAssets) assetsBySession.set(asset.uploadSessionId, (assetsBySession.get(asset.uploadSessionId) || 0) + 1);
  for (const [sessionId, count] of assetsBySession) {
    statements.push(env.DB.prepare(`UPDATE upload_sessions SET
      usedFiles = CASE WHEN completedAt IS NULL THEN usedFiles + ? ELSE usedFiles END,
      completedAt = COALESCE(completedAt, ?) WHERE id = ?`)
      .bind(count, Date.now(), sessionId));
  }
  for (const publicId of [...new Set(cleanupAfterCommit)]) {
    statements.push(cleanupQueueStatement(env, publicId, [sourceId]));
  }

  try {
    await env.DB.batch(statements);
  } catch (error) {
    const failureNotBefore = Math.max(Date.now() + UPLOAD_SESSION_TTL_MS + CLEANUP_SAFETY_MS,
      ...validatedAssets.map(asset => cleanupNotBefore(asset.uploadSession)));
    await queueCloudinaryCleanup(env, cleanupOnFailure, [sourceId], failureNotBefore);
    throw error;
  }
  const cleanupPending = new Set(cleanupAfterCommit).size;
  const finalProperty = await env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(propertyId).first();
  const [result] = await attachPhotos(env, [finalProperty]);
  return json({
    property: result,
    created: !existing,
    summary: {
      uploaded,
      unchanged,
      removed,
      cleanupPending,
      images: result.photos.filter(item => !String(item.publicId || '').startsWith('video:')).length,
      videos: result.photos.filter(item => String(item.publicId || '').startsWith('video:')).length,
      published: result.published,
      status: result.status,
    },
  }, existing ? 200 : 201);
};

const handleApi = async (request, env) => {
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method.toUpperCase();
  let match;

  if (method === 'OPTIONS') return new Response(null, { status: 204 });
  if (method === 'GET' && path === '/api/health') {
    await env.DB.prepare('SELECT 1').first();
    return json({ status: 'ok', database: 'connected', platform: 'cloudflare-d1', timestamp: now() });
  }
  if (method === 'GET' && path === '/api/config') return json({
    contactEmail: env.CONTACT_EMAIL || '',
    contactPhone: env.CONTACT_PHONE || '',
    whatsappNumber: env.WHATSAPP_NUMBER || '',
    contactAddress: env.CONTACT_ADDRESS || '',
  });
  if (method === 'POST' && path === '/api/auth/login') return handleLogin(request, env);
  if (method === 'POST' && path === '/api/auth/logout') return json({ message: 'Sesión cerrada' }, 200, { 'set-cookie': 'token=; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=0' });
  if (method === 'GET' && path === '/api/auth/me') return json({ user: await authenticate(request, env) });
  if (method === 'GET' && path === '/api/properties') return listProperties(request, env, false);
  if (method === 'GET' && path === '/api/properties/featured') {
    const { results } = await env.DB.prepare('SELECT * FROM properties WHERE featured = 1 AND published = 1 ORDER BY createdAt DESC LIMIT 6').all();
    return json(await attachPhotos(env, results || []));
  }
  if (method === 'GET' && path === '/api/properties/cities') {
    const { results } = await env.DB.prepare('SELECT DISTINCT city FROM properties WHERE published = 1 ORDER BY city COLLATE NOCASE ASC').all();
    return json((results || []).map(item => item.city));
  }
  if (method === 'POST' && path === '/api/properties') return handleCreateProperty(request, env);
  if (method === 'POST' && path === '/api/inquiries') return handleInquiry(request, env);
  if (method === 'GET' && path === '/api/inquiries') return handleInquiryList(request, env);
  if (method === 'GET' && path === '/api/stats') return handleStats(request, env);
  if (method === 'GET' && path === '/api/admin/properties') { await requireAdmin(request, env); return listProperties(request, env, true); }
  if (method === 'POST' && path === '/api/admin/uploads/sign') return handleUploadSign(request, env);
  if (method === 'POST' && path === '/api/admin/uploads/complete') return handleUploadComplete(request, env);
  if (method === 'POST' && path === '/api/admin/property-import/analyze') return handleImportAnalyze(request, env);
  if (method === 'POST' && path === '/api/admin/property-import/start') return handleImportStart(request, env);
  if (method === 'POST' && path === '/api/admin/property-import/cancel') return handleImportCancel(request, env);
  if (method === 'POST' && path === '/api/admin/property-import/complete') return handleImportComplete(request, env);
  if (method === 'POST' && path === '/api/admin/property-sync/sign-upload') return handleUploadSign(request, env);
  if (method === 'POST' && path === '/api/admin/property-sync/sync/upsert') return upsertSyncedProperty(request, env);

  match = path.match(/^\/api\/admin\/property-sync\/([^/]+)\/status$/);
  if (match && method === 'PATCH') {
    await requireAdmin(request, env);
    const body = await readJson(request);
    const status = foldSpanish(body.status);
    if (!VALID_STATUSES.has(status)) throw Object.assign(new Error('Estado no válido'), { status: 400 });
    const published = body.published === undefined ? null : parseBoolean(body.published);
    const result = published === null
      ? await env.DB.prepare('UPDATE properties SET status = ?, sourceUpdatedAt = ?, updatedAt = ? WHERE sourceId = ?')
        .bind(status, now(), now(), decodeURIComponent(match[1])).run()
      : await env.DB.prepare('UPDATE properties SET status = ?, published = ?, sourceUpdatedAt = ?, updatedAt = ? WHERE sourceId = ?')
        .bind(status, published, now(), now(), decodeURIComponent(match[1])).run();
    if (!result.meta?.changes) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
    return json(normalizeProperty(await env.DB.prepare('SELECT * FROM properties WHERE sourceId = ?').bind(decodeURIComponent(match[1])).first()));
  }

  match = path.match(/^\/api\/admin\/property-sync\/([^/]+)$/);
  if (match && method === 'GET') {
    await requireAdmin(request, env);
    const property = await env.DB.prepare('SELECT * FROM properties WHERE sourceId = ?').bind(decodeURIComponent(match[1])).first();
    if (!property) throw Object.assign(new Error('Propiedad sincronizada no encontrada'), { status: 404 });
    return json((await attachPhotos(env, [property]))[0]);
  }

  match = path.match(/^\/api\/admin\/properties\/([^/]+)$/);
  if (match && method === 'GET') {
    await requireAdmin(request, env);
    const property = await env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(match[1]).first();
    if (!property) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
    return json((await attachPhotos(env, [property]))[0]);
  }
  match = path.match(/^\/api\/properties\/([^/]+)\/status$/);
  if (match && method === 'PATCH') {
    await requireAdmin(request, env);
    const body = await readJson(request);
    const status = foldSpanish(body.status);
    if (!VALID_STATUSES.has(status)) throw Object.assign(new Error('Estado no válido'), { status: 400 });
    const update = await env.DB.prepare('UPDATE properties SET status = ?, updatedAt = ? WHERE id = ?').bind(status, now(), match[1]).run();
    if (!update.meta?.changes) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
    return json(normalizeProperty(await env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(match[1]).first()));
  }
  match = path.match(/^\/api\/properties\/([^/]+)$/);
  if (match && method === 'GET') return handlePropertyDetail(env, decodeURIComponent(match[1]));
  if (match && method === 'PUT') return handleUpdateProperty(request, env, match[1]);
  if (match && method === 'DELETE') return handleDeleteProperty(request, env, match[1]);

  match = path.match(/^\/api\/inquiries\/([^/]+)\/read$/);
  if (match && method === 'PATCH') {
    await requireAdmin(request, env);
    await env.DB.prepare('UPDATE inquiries SET isRead = 1 WHERE id = ?').bind(match[1]).run();
    const inquiry = await env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(match[1]).first();
    if (!inquiry) throw Object.assign(new Error('Consulta no encontrada'), { status: 404 });
    return json({ ...inquiry, isRead: true });
  }
  match = path.match(/^\/api\/inquiries\/([^/]+)$/);
  if (match && method === 'DELETE') {
    await requireAdmin(request, env);
    const result = await env.DB.prepare('DELETE FROM inquiries WHERE id = ?').bind(match[1]).run();
    if (!result.meta?.changes) throw Object.assign(new Error('Consulta no encontrada'), { status: 404 });
    return json({ message: 'Consulta eliminada' });
  }

  match = path.match(/^\/api\/properties\/([^/]+)\/photos\/([^/]+)\/main$/);
  if (match && method === 'PATCH') {
    await requireAdmin(request, env);
    const photo = await env.DB.prepare('SELECT * FROM photos WHERE id = ? AND propertyId = ?').bind(match[2], match[1]).first();
    if (!photo) throw Object.assign(new Error('Fotografía no encontrada'), { status: 404 });
    if (String(photo.publicId || '').startsWith('video:')) throw Object.assign(new Error('Un video no puede usarse como fotografía principal'), { status: 400 });
    await env.DB.batch([
      env.DB.prepare('UPDATE photos SET isMain = 0 WHERE propertyId = ?').bind(match[1]),
      env.DB.prepare('UPDATE photos SET isMain = 1, "order" = 0 WHERE id = ?').bind(match[2]),
    ]);
    return json({ message: 'Foto principal actualizada' });
  }
  match = path.match(/^\/api\/properties\/([^/]+)\/photos\/([^/]+)$/);
  if (match && method === 'DELETE') {
    await requireAdmin(request, env);
    const photo = await env.DB.prepare('SELECT * FROM photos WHERE id = ? AND propertyId = ?').bind(match[2], match[1]).first();
    if (!photo) throw Object.assign(new Error('Archivo no encontrado'), { status: 404 });
    const property = await env.DB.prepare('SELECT id, sourceId, published FROM properties WHERE id = ?').bind(match[1]).first();
    const isImage = !String(photo.publicId || '').startsWith('video:');
    if (isImage && property?.published) {
      const count = await env.DB.prepare(`SELECT COUNT(*) AS total FROM photos
        WHERE propertyId = ? AND (publicId IS NULL OR publicId NOT LIKE 'video:%')`).bind(match[1]).first();
      if (Number(count?.total || 0) <= 1) {
        throw Object.assign(new Error('No se puede eliminar la última fotografía de una propiedad publicada'), { status: 409 });
      }
    }
    const replacement = photo.isMain
      ? await env.DB.prepare(`SELECT id FROM photos WHERE propertyId = ? AND id != ?
        AND (publicId IS NULL OR publicId NOT LIKE 'video:%') ORDER BY "order" LIMIT 1`).bind(match[1], photo.id).first()
      : null;
    const owners = [property?.id, property?.sourceId].filter(Boolean);
    const statements = [env.DB.prepare('DELETE FROM photos WHERE id = ? AND propertyId = ?').bind(photo.id, match[1])];
    if (replacement) statements.push(env.DB.prepare('UPDATE photos SET isMain = 1 WHERE id = ? AND propertyId = ?').bind(replacement.id, match[1]));
    if (photo.publicId) statements.push(cleanupQueueStatement(env, photo.publicId, owners));
    await env.DB.batch(statements);
    return json({ message: 'Archivo eliminado', cleanupPending: Number(Boolean(photo.publicId)) });
  }

  throw Object.assign(new Error('Ruta API no encontrada'), { status: 404 });
};

const configuredCorsOrigins = env => String(env.CORS_ORIGIN || '')
  .split(',').map(value => value.trim()).filter(value => value && value !== '*');

const corsOriginAllowed = (request, env) => {
  const origin = request.headers.get('origin');
  if (!origin) return true;
  return origin === new URL(request.url).origin || configuredCorsOrigins(env).includes(origin);
};

const withSecurityHeaders = (response, request, env) => {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(self)');
  const origin = request.headers.get('origin');
  if (origin && corsOriginAllowed(request, env)) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.set('access-control-allow-headers', 'authorization, content-type');
    headers.set('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    headers.append('vary', 'Origin');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

export default {
  async fetch(request, env, ctx) {
    try {
      const url = new URL(request.url);
      const isApi = url.pathname === '/api' || url.pathname.startsWith('/api/');
      if (isApi && !corsOriginAllowed(request, env)) {
        return withSecurityHeaders(json({ error: 'Origen no permitido' }, 403), request, env);
      }
      const response = isApi
        ? await handleApi(request, env)
        : await env.ASSETS.fetch(request);
      if (isApi && ctx?.waitUntil) {
        ctx.waitUntil(processCloudinaryCleanup(env).catch(error => console.error(JSON.stringify({
          message: 'cloudinary_cleanup_failed', error: error?.message || String(error),
        }))));
      }
      return withSecurityHeaders(response, request, env);
    } catch (error) {
      const status = Number(error?.status || 500);
      if (status >= 500) {
        console.error(JSON.stringify({
          message: 'worker_request_failed',
          error: error?.message || String(error),
          method: request.method,
          path: new URL(request.url).pathname,
        }));
      }
      return withSecurityHeaders(json({ error: status >= 500 ? 'Error interno del servidor' : error.message }, status), request, env);
    }
  },
  async scheduled(_controller, env, ctx) {
    ctx.waitUntil(processCloudinaryCleanup(env));
  },
};
