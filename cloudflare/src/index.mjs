const encoder = new TextEncoder();

const VALID_OPERATIONS = new Set(['venta', 'renta']);
const VALID_TYPES = new Set(['casa', 'departamento', 'terreno', 'oficina', 'local', 'bodega', 'rancho', 'otros']);
const VALID_STATUSES = new Set(['available', 'sold', 'rented', 'reserved']);
const VALID_CURRENCIES = new Set(['MXN', 'USD', 'COP', 'EUR']);
const PROPERTY_FIELDS = [
  'sourceId', 'syncSource', 'sourceUpdatedAt', 'title', 'slug', 'description',
  'operation', 'type', 'price', 'currency', 'bedrooms', 'bathrooms', 'area',
  'lotArea', 'parking', 'yearBuilt', 'city', 'state', 'country', 'address',
  'lat', 'lng', 'features', 'status', 'featured', 'published', 'views',
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

const base64UrlDecode = value => {
  const normalized = value.replaceAll('-', '+').replaceAll('_', '/').padEnd(Math.ceil(value.length / 4) * 4, '=');
  const binary = atob(normalized);
  return new TextDecoder().decode(Uint8Array.from(binary, character => character.charCodeAt(0)));
};

const hmacHex = async (secret, value) => {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(value));
  return [...new Uint8Array(signature)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const sha1Hex = async value => {
  const digest = await crypto.subtle.digest('SHA-1', encoder.encode(value));
  return [...new Uint8Array(digest)].map(byte => byte.toString(16).padStart(2, '0')).join('');
};

const signToken = async (env, user) => {
  if (!env.JWT_SECRET) throw Object.assign(new Error('JWT_SECRET no está configurado'), { status: 503 });
  const header = base64UrlEncode(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const payload = base64UrlEncode(JSON.stringify({
    id: user.id,
    email: user.email,
    role: user.role,
    exp: Math.floor(Date.now() / 1000) + 7 * 24 * 60 * 60,
  }));
  const signingInput = `${header}.${payload}`;
  const signature = await hmacHex(env.JWT_SECRET, signingInput);
  return `${signingInput}.${base64UrlEncode(signature)}`;
};

const verifyToken = async (env, token) => {
  if (!token || !env.JWT_SECRET) return null;
  const parts = token.split('.');
  if (parts.length !== 3) return null;
  const signingInput = `${parts[0]}.${parts[1]}`;
  const expected = await hmacHex(env.JWT_SECRET, signingInput);
  let supplied;
  try { supplied = base64UrlDecode(parts[2]); } catch { return null; }
  if (expected.length !== supplied.length || expected !== supplied) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(parts[1]));
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) return null;
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
  const token = cookieValue(request, 'token') || (authorization.startsWith('Bearer ') ? authorization.slice(7) : '');
  const decoded = await verifyToken(env, token);
  if (!decoded) throw Object.assign(new Error('No autenticado'), { status: 401 });
  const user = await env.DB.prepare('SELECT id, email, name, role FROM users WHERE id = ?').bind(decoded.id).first();
  if (!user) throw Object.assign(new Error('Usuario no encontrado'), { status: 401 });
  return user;
};

const readJson = async request => {
  try { return await request.json(); } catch { throw Object.assign(new Error('El cuerpo JSON no es válido'), { status: 400 }); }
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
  const title = String(input.title ?? existing?.title ?? '').trim().slice(0, 180);
  const description = String(input.description ?? existing?.description ?? '').trim().slice(0, 12000);
  const city = String(input.city ?? existing?.city ?? '').trim().slice(0, 120);
  const price = nullableNumber(input.price ?? existing?.price);
  if (!title) throw Object.assign(new Error('El título es obligatorio'), { status: 400 });
  if (!description) throw Object.assign(new Error('La descripción es obligatoria'), { status: 400 });
  if (!city) throw Object.assign(new Error('La ciudad es obligatoria'), { status: 400 });
  if (price === null || price <= 0) throw Object.assign(new Error('El precio debe ser mayor que cero'), { status: 400 });

  const rawFeatures = input.features ?? existing?.features ?? null;
  const features = Array.isArray(rawFeatures)
    ? JSON.stringify([...new Set(rawFeatures.map(value => String(value).trim()).filter(Boolean))].slice(0, 80))
    : typeof rawFeatures === 'string' && rawFeatures.trim() ? rawFeatures.trim() : null;
  const operation = VALID_OPERATIONS.has(input.operation) ? input.operation : existing?.operation || 'venta';
  const type = VALID_TYPES.has(input.type) ? input.type : existing?.type || 'otros';
  const currency = VALID_CURRENCIES.has(input.currency) ? input.currency : existing?.currency || 'MXN';
  const status = VALID_STATUSES.has(input.status) ? input.status : existing?.status || 'available';

  return {
    sourceId: input.sourceId ?? existing?.sourceId ?? null,
    syncSource: input.syncSource ?? existing?.syncSource ?? null,
    sourceUpdatedAt: input.sourceUpdatedAt ?? input.updatedAt ?? existing?.sourceUpdatedAt ?? null,
    title,
    slug: input.slug ? slugBase(input.slug) : await uniqueSlug(env, title, existing?.id),
    description,
    operation,
    type,
    price,
    currency,
    bedrooms: nullableInteger(input.bedrooms ?? existing?.bedrooms),
    bathrooms: nullableNumber(input.bathrooms ?? existing?.bathrooms),
    area: nullableNumber(input.area ?? input.construction_area ?? existing?.area),
    lotArea: nullableNumber(input.lotArea ?? input.land_area ?? existing?.lotArea),
    parking: nullableInteger(input.parking ?? existing?.parking),
    yearBuilt: nullableInteger(input.yearBuilt ?? existing?.yearBuilt),
    city,
    state: String(input.state ?? existing?.state ?? 'Veracruz').trim().slice(0, 120),
    country: String(input.country ?? existing?.country ?? 'México').trim().slice(0, 120),
    address: String(input.address ?? existing?.address ?? '').trim().slice(0, 300) || null,
    lat: nullableNumber(input.lat ?? existing?.lat),
    lng: nullableNumber(input.lng ?? existing?.lng),
    features,
    status,
    featured: input.featured === undefined ? Number(Boolean(existing?.featured)) : Number(Boolean(input.featured)),
    published: input.published === undefined ? Number(existing ? Boolean(existing.published) : true) : Number(Boolean(input.published)),
    views: nullableInteger(input.views ?? existing?.views) || 0,
  };
};

const normalizePhoto = row => row ? { ...row, isMain: Boolean(row.isMain) } : row;
const normalizeProperty = row => row ? {
  ...row,
  featured: Boolean(row.featured),
  published: Boolean(row.published),
  photos: Array.isArray(row.photos) ? row.photos.map(normalizePhoto) : row.photos,
} : row;

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

const signCloudinaryUpload = async (env, folder) => {
  const timestamp = Math.floor(Date.now() / 1000);
  const params = { folder, timestamp };
  return {
    uploadUrl: `https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/auto/upload`,
    apiKey: env.CLOUDINARY_API_KEY,
    timestamp,
    folder,
    signature: await cloudinarySignature(env, params),
  };
};

const deleteCloudinaryAsset = async (env, storedPublicId) => {
  if (!storedPublicId) return;
  const isVideo = String(storedPublicId).startsWith('video:');
  const publicId = isVideo ? String(storedPublicId).slice(6) : String(storedPublicId);
  const timestamp = Math.floor(Date.now() / 1000);
  const signature = await cloudinarySignature(env, { public_id: publicId, timestamp });
  const body = new URLSearchParams({ public_id: publicId, timestamp: String(timestamp), api_key: env.CLOUDINARY_API_KEY, signature });
  const response = await fetch(`https://api.cloudinary.com/v1_1/${env.CLOUDINARY_CLOUD_NAME}/${isVideo ? 'video' : 'image'}/destroy`, { method: 'POST', body });
  if (!response.ok) console.error('Cloudinary delete failed', response.status, await response.text());
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
  if (city) { where.push('city = ? COLLATE NOCASE'); values.push(city); }
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
    where.push(admin
      ? '(title LIKE ? COLLATE NOCASE OR city LIKE ? COLLATE NOCASE OR slug LIKE ? COLLATE NOCASE)'
      : '(title LIKE ? COLLATE NOCASE OR description LIKE ? COLLATE NOCASE OR city LIKE ? COLLATE NOCASE)');
    values.push(`%${search}%`, `%${search}%`, `%${search}%`);
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
  if (!env.ADMIN_EMAIL || !env.ADMIN_PASSWORD || !env.JWT_SECRET) {
    throw Object.assign(new Error('Credenciales administrativas incompletas'), { status: 503 });
  }
  const body = await readJson(request);
  const email = String(body.email || '').trim().toLowerCase();
  if (email !== String(env.ADMIN_EMAIL).trim().toLowerCase() || String(body.password || '') !== String(env.ADMIN_PASSWORD)) {
    throw Object.assign(new Error('Credenciales inválidas'), { status: 401 });
  }
  const timestamp = now();
  const existing = await env.DB.prepare('SELECT * FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  const id = existing?.id || makeId('user');
  const password = await hmacHex(env.JWT_SECRET, env.ADMIN_PASSWORD);
  await env.DB.prepare(`INSERT INTO users (id, email, password, name, role, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, 'admin', ?, ?)
    ON CONFLICT(email) DO UPDATE SET password = excluded.password, updatedAt = excluded.updatedAt`)
    .bind(id, email, password, existing?.name || 'Administrador', existing?.createdAt || timestamp, timestamp).run();
  const user = await env.DB.prepare('SELECT id, email, name, role FROM users WHERE email = ? COLLATE NOCASE').bind(email).first();
  const token = await signToken(env, user);
  return json({ user, token }, 200, { 'set-cookie': `token=${encodeURIComponent(token)}; HttpOnly; Secure; SameSite=Lax; Path=/; Max-Age=604800` });
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
  await authenticate(request, env);
  const data = await sanitizeProperty(env, await readJson(request));
  const property = await insertProperty(env, data);
  return json(normalizeProperty({ ...property, photos: [] }), 201);
};

const handleUpdateProperty = async (request, env, id) => {
  await authenticate(request, env);
  const existing = await env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(id).first();
  if (!existing) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
  const data = await sanitizeProperty(env, await readJson(request), existing);
  const property = await updateProperty(env, id, data);
  const [result] = await attachPhotos(env, [property]);
  return json(result);
};

const handleDeleteProperty = async (request, env, id) => {
  await authenticate(request, env);
  const { results } = await env.DB.prepare('SELECT publicId FROM photos WHERE propertyId = ?').bind(id).all();
  for (const photo of results || []) await deleteCloudinaryAsset(env, photo.publicId);
  const result = await env.DB.prepare('DELETE FROM properties WHERE id = ?').bind(id).run();
  if (!result.meta?.changes) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
  return json({ message: 'Propiedad eliminada' });
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
  await authenticate(request, env);
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
  await authenticate(request, env);
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
  await authenticate(request, env);
  const body = await readJson(request);
  const owner = body.propertyId || body.sourceId;
  if (!owner) throw Object.assign(new Error('propertyId o sourceId es obligatorio'), { status: 400 });
  return json(await signCloudinaryUpload(env, `circulo-bienes-raices/${safeFolderSegment(owner)}`));
};

const handleUploadComplete = async (request, env) => {
  await authenticate(request, env);
  const body = await readJson(request);
  const property = await env.DB.prepare('SELECT id, title FROM properties WHERE id = ?').bind(body.propertyId).first();
  if (!property) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
  if (!body.secureUrl || !body.publicId) throw Object.assign(new Error('Respuesta de Cloudinary incompleta'), { status: 400 });
  const count = await env.DB.prepare('SELECT COUNT(*) AS total FROM photos WHERE propertyId = ?').bind(property.id).first();
  const isVideo = body.resourceType === 'video';
  const id = makeId('media');
  await env.DB.prepare(`INSERT INTO photos (id, url, publicId, alt, "order", isMain, sourceFilename, checksum,
    originalBytes, optimizedBytes, width, height, duration, codec, qualityPreset, propertyId, createdAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
    .bind(id, body.secureUrl, isVideo ? `video:${body.publicId}` : body.publicId,
      body.alt || (isVideo ? `Video de ${property.title}` : property.title), Number(count?.total || 0),
      Number(!isVideo && Number(count?.total || 0) === 0), body.sourceFilename || null, body.checksum || null,
      nullableInteger(body.originalBytes), nullableInteger(body.optimizedBytes || body.bytes), nullableInteger(body.width),
      nullableInteger(body.height), nullableNumber(body.duration), body.codec || body.format || null,
      body.qualityPreset || null, property.id, now()).run();
  return json(normalizePhoto(await env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(id).first()), 201);
};

const upsertSyncedProperty = async (request, env) => {
  await authenticate(request, env);
  const body = await readJson(request);
  const sourceId = String(body.sourceId || '').trim().slice(0, 160);
  if (!sourceId) throw Object.assign(new Error('sourceId es obligatorio'), { status: 400 });
  const draft = body.draft;
  if (!draft || typeof draft !== 'object') throw Object.assign(new Error('El borrador no tiene un formato válido'), { status: 400 });
  let existing = await env.DB.prepare('SELECT * FROM properties WHERE sourceId = ?').bind(sourceId).first();
  const data = await sanitizeProperty(env, { ...draft, sourceId, syncSource: 'circulo-media-sync' }, existing);
  const intendedPublished = data.published;
  if (!existing) data.published = 0;
  const property = existing ? await updateProperty(env, existing.id, data) : await insertProperty(env, data);
  const manifest = body.manifest || {};
  const assets = Array.isArray(body.assets) ? body.assets : [];
  const current = await env.DB.prepare('SELECT * FROM photos WHERE propertyId = ?').bind(property.id).all();
  const bySource = new Map((current.results || []).filter(item => item.sourceFilename).map(item => [item.sourceFilename, item]));
  let uploaded = 0;
  let unchanged = 0;

  for (const asset of assets) {
    const sourceFilename = String(asset.sourceFilename || '').replaceAll('\\', '/').slice(0, 500);
    if (!sourceFilename || !asset.secureUrl || !asset.publicId) continue;
    const prior = bySource.get(sourceFilename);
    if (prior && asset.checksum && prior.checksum === asset.checksum) { unchanged += 1; continue; }
    if (prior) {
      await deleteCloudinaryAsset(env, prior.publicId);
      await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(prior.id).run();
    }
    const isVideo = asset.resourceType === 'video';
    const id = makeId('media');
    await env.DB.prepare(`INSERT INTO photos (id, url, publicId, alt, "order", isMain, sourceFilename, checksum,
      originalBytes, optimizedBytes, width, height, duration, codec, qualityPreset, propertyId, createdAt)
      VALUES (?, ?, ?, ?, 9999, 0, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`)
      .bind(id, asset.secureUrl, isVideo ? `video:${asset.publicId}` : asset.publicId,
        isVideo ? `Video de ${property.title}` : `${property.title} - ${sourceFilename}`,
        sourceFilename, asset.checksum || null, nullableInteger(asset.originalBytes), nullableInteger(asset.optimizedBytes || asset.bytes),
        nullableInteger(asset.width), nullableInteger(asset.height), nullableNumber(asset.duration), asset.codec || asset.format || null,
        asset.qualityPreset || null, property.id, now()).run();
    bySource.set(sourceFilename, await env.DB.prepare('SELECT * FROM photos WHERE id = ?').bind(id).first());
    uploaded += 1;
  }

  for (const filename of Array.isArray(manifest.removedFilenames) ? manifest.removedFilenames : []) {
    const normalized = String(filename).replaceAll('\\', '/');
    const media = bySource.get(normalized);
    if (!media) continue;
    await deleteCloudinaryAsset(env, media.publicId);
    await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(media.id).run();
    bySource.delete(normalized);
  }

  const order = Array.isArray(manifest.mediaOrder) ? manifest.mediaOrder.map(value => String(value).replaceAll('\\', '/')) : [];
  const rank = new Map(order.map((value, index) => [value, index]));
  const media = [...bySource.values()].sort((a, b) => {
    const aRank = rank.has(a.sourceFilename) ? rank.get(a.sourceFilename) : Number.MAX_SAFE_INTEGER;
    const bRank = rank.has(b.sourceFilename) ? rank.get(b.sourceFilename) : Number.MAX_SAFE_INTEGER;
    if (aRank !== bRank) return aRank - bRank;
    return String(a.sourceFilename || a.id).localeCompare(String(b.sourceFilename || b.id), 'es', { numeric: true });
  });
  const requested = String(draft.mainPhotoFilename || '').replaceAll('\\', '/');
  const main = media.find(item => !String(item.publicId || '').startsWith('video:') && item.sourceFilename === requested)
    || media.find(item => !String(item.publicId || '').startsWith('video:'));
  if (!main) throw Object.assign(new Error('La propiedad debe conservar al menos una fotografía'), { status: 400 });
  await env.DB.batch(media.map((item, index) => env.DB.prepare('UPDATE photos SET "order" = ?, isMain = ? WHERE id = ?').bind(index, Number(item.id === main.id), item.id)));
  await env.DB.prepare('UPDATE properties SET published = ?, updatedAt = ? WHERE id = ?').bind(Number(intendedPublished), now(), property.id).run();
  const finalProperty = await env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(property.id).first();
  const [result] = await attachPhotos(env, [finalProperty]);
  return json({
    property: result,
    created: !existing,
    summary: {
      uploaded,
      unchanged,
      removed: Array.isArray(manifest.removedFilenames) ? manifest.removedFilenames.length : 0,
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
  if (method === 'GET' && path === '/api/admin/properties') { await authenticate(request, env); return listProperties(request, env, true); }
  if (method === 'POST' && path === '/api/admin/uploads/sign') return handleUploadSign(request, env);
  if (method === 'POST' && path === '/api/admin/uploads/complete') return handleUploadComplete(request, env);
  if (method === 'POST' && path === '/api/admin/property-sync/sign-upload') return handleUploadSign(request, env);
  if (method === 'POST' && path === '/api/admin/property-sync/sync/upsert') return upsertSyncedProperty(request, env);

  match = path.match(/^\/api\/admin\/property-sync\/([^/]+)$/);
  if (match && method === 'GET') {
    await authenticate(request, env);
    const property = await env.DB.prepare('SELECT * FROM properties WHERE sourceId = ?').bind(decodeURIComponent(match[1])).first();
    if (!property) throw Object.assign(new Error('Propiedad sincronizada no encontrada'), { status: 404 });
    return json((await attachPhotos(env, [property]))[0]);
  }

  match = path.match(/^\/api\/admin\/properties\/([^/]+)$/);
  if (match && method === 'GET') {
    await authenticate(request, env);
    const property = await env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(match[1]).first();
    if (!property) throw Object.assign(new Error('Propiedad no encontrada'), { status: 404 });
    return json((await attachPhotos(env, [property]))[0]);
  }
  match = path.match(/^\/api\/properties\/([^/]+)\/status$/);
  if (match && method === 'PATCH') {
    await authenticate(request, env);
    const body = await readJson(request);
    if (!VALID_STATUSES.has(body.status)) throw Object.assign(new Error('Estado no válido'), { status: 400 });
    await env.DB.prepare('UPDATE properties SET status = ?, updatedAt = ? WHERE id = ?').bind(body.status, now(), match[1]).run();
    return json(normalizeProperty(await env.DB.prepare('SELECT * FROM properties WHERE id = ?').bind(match[1]).first()));
  }
  match = path.match(/^\/api\/properties\/([^/]+)$/);
  if (match && method === 'GET') return handlePropertyDetail(env, decodeURIComponent(match[1]));
  if (match && method === 'PUT') return handleUpdateProperty(request, env, match[1]);
  if (match && method === 'DELETE') return handleDeleteProperty(request, env, match[1]);

  match = path.match(/^\/api\/inquiries\/([^/]+)\/read$/);
  if (match && method === 'PATCH') {
    await authenticate(request, env);
    await env.DB.prepare('UPDATE inquiries SET isRead = 1 WHERE id = ?').bind(match[1]).run();
    const inquiry = await env.DB.prepare('SELECT * FROM inquiries WHERE id = ?').bind(match[1]).first();
    if (!inquiry) throw Object.assign(new Error('Consulta no encontrada'), { status: 404 });
    return json({ ...inquiry, isRead: true });
  }
  match = path.match(/^\/api\/inquiries\/([^/]+)$/);
  if (match && method === 'DELETE') {
    await authenticate(request, env);
    await env.DB.prepare('DELETE FROM inquiries WHERE id = ?').bind(match[1]).run();
    return json({ message: 'Consulta eliminada' });
  }

  match = path.match(/^\/api\/properties\/([^/]+)\/photos\/([^/]+)\/main$/);
  if (match && method === 'PATCH') {
    await authenticate(request, env);
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
    await authenticate(request, env);
    const photo = await env.DB.prepare('SELECT * FROM photos WHERE id = ? AND propertyId = ?').bind(match[2], match[1]).first();
    if (!photo) throw Object.assign(new Error('Archivo no encontrado'), { status: 404 });
    await deleteCloudinaryAsset(env, photo.publicId);
    await env.DB.prepare('DELETE FROM photos WHERE id = ?').bind(photo.id).run();
    if (photo.isMain) {
      const replacement = await env.DB.prepare(`SELECT id FROM photos WHERE propertyId = ? AND (publicId IS NULL OR publicId NOT LIKE 'video:%') ORDER BY "order" LIMIT 1`).bind(match[1]).first();
      if (replacement) await env.DB.prepare('UPDATE photos SET isMain = 1 WHERE id = ?').bind(replacement.id).run();
    }
    return json({ message: 'Archivo eliminado' });
  }

  throw Object.assign(new Error('Ruta API no encontrada'), { status: 404 });
};

const withSecurityHeaders = (response, request, env) => {
  const headers = new Headers(response.headers);
  headers.set('x-content-type-options', 'nosniff');
  headers.set('x-frame-options', 'DENY');
  headers.set('referrer-policy', 'strict-origin-when-cross-origin');
  headers.set('permissions-policy', 'camera=(), microphone=(), geolocation=(self)');
  const origin = request.headers.get('origin');
  const allowed = String(env.CORS_ORIGIN || '').split(',').map(value => value.trim()).filter(Boolean);
  if (origin && (allowed.length === 0 || allowed.includes(origin))) {
    headers.set('access-control-allow-origin', origin);
    headers.set('access-control-allow-credentials', 'true');
    headers.set('access-control-allow-headers', 'authorization, content-type');
    headers.set('access-control-allow-methods', 'GET, POST, PUT, PATCH, DELETE, OPTIONS');
    headers.append('vary', 'Origin');
  }
  return new Response(response.body, { status: response.status, statusText: response.statusText, headers });
};

export default {
  async fetch(request, env) {
    try {
      const url = new URL(request.url);
      const response = url.pathname.startsWith('/api/')
        ? await handleApi(request, env)
        : await env.ASSETS.fetch(request);
      return withSecurityHeaders(response, request, env);
    } catch (error) {
      console.error(error?.stack || error?.message || error);
      const status = Number(error?.status || 500);
      return withSecurityHeaders(json({ error: status >= 500 ? 'Error interno del servidor' : error.message }, status), request, env);
    }
  },
};
