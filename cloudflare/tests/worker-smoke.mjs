import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker from '../src/index.mjs';

class D1StatementMock {
  constructor(database, sql) {
    this.database = database;
    this.sql = sql;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    return this.database.prepare(this.sql).get(...this.values) || null;
  }

  async all() {
    return { success: true, results: this.database.prepare(this.sql).all(...this.values), meta: {} };
  }

  async run() {
    const result = this.database.prepare(this.sql).run(...this.values);
    return {
      success: true,
      results: [],
      meta: { changes: Number(result.changes || 0), last_row_id: Number(result.lastInsertRowid || 0) },
    };
  }

  async execute() {
    return /^\s*(SELECT|PRAGMA|WITH)\b/i.test(this.sql) ? this.all() : this.run();
  }
}

class D1Mock {
  constructor(database) {
    this.database = database;
    this.failNextBatchAt = null;
  }

  prepare(sql) {
    return new D1StatementMock(this.database, sql);
  }

  async batch(statements) {
    const failAt = this.failNextBatchAt;
    this.failNextBatchAt = null;
    this.database.exec('BEGIN');
    try {
      const results = [];
      for (const [index, statement] of statements.entries()) {
        if (index === failAt) throw new Error('Fallo D1 simulado');
        results.push(await statement.execute());
      }
      this.database.exec('COMMIT');
      return results;
    } catch (error) {
      this.database.exec('ROLLBACK');
      throw error;
    }
  }
}

const database = new DatabaseSync(':memory:');
database.exec(fs.readFileSync(new URL('../migrations/0001_initial_schema.sql', import.meta.url), 'utf8'));

const env = {
  DB: new D1Mock(database),
  ASSETS: { fetch: async () => new Response('<html>Círculo Internacional</html>', { headers: { 'content-type': 'text/html' } }) },
  JWT_SECRET: 'worker-smoke-secret-with-more-than-thirty-two-characters',
  ADMIN_EMAIL: 'admin@circulointernacionalveracruz.org',
  ADMIN_PASSWORD: 'WorkerSmokePassword123!',
  CLOUDINARY_CLOUD_NAME: 'demo-cloud',
  CLOUDINARY_API_KEY: '1234567890',
  CLOUDINARY_API_SECRET: 'cloudinary-smoke-secret',
  CONTACT_EMAIL: 'contacto@example.com',
  CONTACT_PHONE: '',
  WHATSAPP_NUMBER: '',
  CONTACT_ADDRESS: 'Veracruz, México',
  CORS_ORIGIN: '',
};

const cloudinaryDeletes = [];
const originalFetch = globalThis.fetch;
globalThis.fetch = async (url, options = {}) => {
  if (String(url).includes('api.cloudinary.com') && String(url).endsWith('/destroy')) {
    cloudinaryDeletes.push(String(options.body?.get('public_id') || ''));
    return Response.json({ result: 'ok' });
  }
  return originalFetch(url, options);
};

const responseSignature = (publicId, version) => createHash('sha1')
  .update(`public_id=${publicId}&version=${version}${env.CLOUDINARY_API_SECRET}`)
  .digest('hex');

const cloudinaryAsset = ({ sourceFilename, checksum, publicId, resourceType = 'image', version = 1730000000 }) => ({
  sourceFilename,
  checksum,
  resourceType,
  secureUrl: `https://res.cloudinary.com/${env.CLOUDINARY_CLOUD_NAME}/${resourceType}/upload/v${version}/${publicId}.${resourceType === 'video' ? 'mp4' : 'webp'}`,
  publicId,
  version,
  signature: responseSignature(publicId, version),
  optimizedBytes: 9000,
  width: 1200,
  height: 800,
  format: resourceType === 'video' ? 'mp4' : 'webp',
});

const standardToken = (payload, header = { alg: 'HS256', typ: 'JWT' }) => {
  const encodedHeader = Buffer.from(JSON.stringify(header)).toString('base64url');
  const encodedPayload = Buffer.from(JSON.stringify(payload)).toString('base64url');
  const input = `${encodedHeader}.${encodedPayload}`;
  return `${input}.${createHmac('sha256', env.JWT_SECRET).update(input).digest('base64url')}`;
};

const request = async (path, options = {}, expected = 200) => {
  const response = await worker.fetch(new Request(`https://circulo.test${path}`, options), env);
  const text = await response.text();
  const payload = text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
  assert.equal(response.status, expected, `${options.method || 'GET'} ${path}: ${text}`);
  return { response, payload };
};

const authHeaders = token => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });

const health = await request('/api/health');
assert.equal(health.payload.platform, 'cloudflare-d1');

const homepage = await request('/');
assert.match(homepage.payload, /Círculo Internacional/);

const login = await request('/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
});
const token = login.payload.token;
assert.ok(token);
for (let attempt = 0; attempt < 5; attempt += 1) {
  await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
    body: JSON.stringify({ email: env.ADMIN_EMAIL, password: 'incorrecta' }),
  }, 401);
}
await request('/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
  body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
}, 429);
const tokenParts = token.split('.');
assert.equal(tokenParts.length, 3);
assert.deepEqual(JSON.parse(Buffer.from(tokenParts[0], 'base64url')), { alg: 'HS256', typ: 'JWT' });
assert.equal(tokenParts[2], createHmac('sha256', env.JWT_SECRET).update(`${tokenParts[0]}.${tokenParts[1]}`).digest('base64url'));

const me = await request('/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
assert.equal(me.payload.user.email, env.ADMIN_EMAIL);

await request('/api/auth/me', { headers: { authorization: `Bearer ${token.slice(0, -1)}x` } }, 401);
const timestamp = Math.floor(Date.now() / 1000);
const expiredToken = standardToken({
  sub: login.payload.user.id,
  email: env.ADMIN_EMAIL,
  role: 'admin',
  iss: 'circulo-bienes-raices',
  aud: 'circulo-admin',
  iat: timestamp - 120,
  exp: timestamp - 60,
});
await request('/api/auth/me', { headers: { authorization: `Bearer ${expiredToken}` } }, 401);
const noneToken = standardToken({ sub: login.payload.user.id, exp: timestamp + 60 }, { alg: 'none', typ: 'JWT' });
await request('/api/auth/me', { headers: { authorization: `Bearer ${noneToken}` } }, 401);

database.prepare(`INSERT INTO users (id, email, password, name, role, createdAt, updatedAt)
  VALUES (?, ?, ?, ?, ?, ?, ?)`).run('user_viewer', 'viewer@example.com', 'not-used', 'Lector', 'viewer', new Date().toISOString(), new Date().toISOString());
const viewerToken = standardToken({
  sub: 'user_viewer', email: 'viewer@example.com', role: 'admin', iss: 'circulo-bienes-raices', aud: 'circulo-admin',
  iat: timestamp, exp: timestamp + 300,
});
await request('/api/admin/properties', { headers: { authorization: `Bearer ${viewerToken}` } }, 403);

await request('/api/health', { headers: { origin: 'https://evil.example' } }, 403);
const sameOriginCors = await request('/api/health', { headers: { origin: 'https://circulo.test' } });
assert.equal(sameOriginCors.response.headers.get('access-control-allow-origin'), 'https://circulo.test');

const created = await request('/api/properties', {
  method: 'POST',
  headers: authHeaders(token),
  body: JSON.stringify({
    title: 'Cabaña en Venta en Lomas del Porvenir',
    description: 'Propiedad de prueba con caracteres españoles: cabaña, México y ubicación.',
    operation: 'venta',
    type: 'terreno',
    price: '$800,000',
    currency: 'MXN',
    city: 'Lomas del Porvenir',
    state: 'Veracruz',
    country: 'México',
    published: true,
  }),
}, 201);
assert.equal(created.payload.price, 800000);
assert.equal(created.payload.city, 'Lomas del Porvenir');

const originalSlug = created.payload.slug;
const updated = await request(`/api/properties/${created.payload.id}`, {
  method: 'PUT', headers: authHeaders(token), body: JSON.stringify({
    title: 'Cabaña actualizada en Lomas del Porvenir',
    description: created.payload.description,
    city: created.payload.city,
    price: '$800,000',
    featured: 'false',
    published: 'true',
    lat: '19.1738',
    lng: '-96.1342',
  }),
});
assert.equal(updated.payload.slug, originalSlug);
assert.equal(updated.payload.featured, false);
assert.equal(updated.payload.lat, 19.1738);

const manualPublicId = `circulo-bienes-raices/${created.payload.id}/fachada`;
const manualAsset = cloudinaryAsset({
  sourceFilename: 'fachada-cabaña.jpg', checksum: 'manual-checksum', publicId: manualPublicId, version: 1730000010,
});
const manualUpload = await request('/api/admin/uploads/complete', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify({ propertyId: created.payload.id, ...manualAsset }),
}, 201);
assert.equal(manualUpload.payload.isMain, true);
await request('/api/admin/uploads/complete', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify({ propertyId: created.payload.id, ...manualAsset }),
});
assert.equal(database.prepare('SELECT COUNT(*) AS total FROM photos WHERE propertyId = ?').get(created.payload.id).total, 1);
await request(`/api/properties/${created.payload.id}/photos/${manualUpload.payload.id}`, {
  method: 'DELETE', headers: { authorization: `Bearer ${token}` },
}, 409);
database.prepare(`INSERT INTO photos (id, url, publicId, alt, "order", isMain, propertyId, createdAt)
  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(
  'media_foreign', 'https://res.cloudinary.com/foreign/video/upload/v1/asset.mp4', 'video:otro-proyecto/asset',
  'Video ajeno', 2, 0, created.payload.id, new Date().toISOString(),
);
await request(`/api/properties/${created.payload.id}/photos/media_foreign`, {
  method: 'DELETE', headers: { authorization: `Bearer ${token}` },
});
assert.ok(!cloudinaryDeletes.includes('otro-proyecto/asset'));

const catalog = await request(`/api/properties?search=${encodeURIComponent('Cabaña')}`);
assert.equal(catalog.payload.properties.length, 1);

const detail = await request(`/api/properties/${created.payload.slug}`);
assert.equal(detail.payload.property.title, 'Cabaña actualizada en Lomas del Porvenir');

const inquiry = await request('/api/inquiries', {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    name: 'Cliente de prueba',
    email: 'cliente@example.com',
    message: 'Me interesa esta propiedad.',
    propertyId: created.payload.id,
  }),
}, 201);
assert.ok(inquiry.payload.id);

const signed = await request('/api/admin/property-sync/sign-upload', {
  method: 'POST',
  headers: authHeaders(token),
  body: JSON.stringify({ sourceId: 'CI-VER-0002' }),
});
assert.match(signed.payload.uploadUrl, /cloudinary\.com/);
assert.ok(signed.payload.signature);

const synced = await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST',
  headers: authHeaders(token),
  body: JSON.stringify({
    sourceId: 'CI-VER-0002',
    draft: {
      title: 'Cabaña sincronizada con ñ',
      description: 'Creada desde README.txt.',
      operation: 'venta',
      type: 'terreno',
      price: 800000,
      currency: 'MXN',
      city: 'Lomas del Porvenir',
      state: 'Veracruz',
      country: 'México',
      published: true,
      mainPhotoFilename: 'fotos/01-cabaña.jpg',
    },
    manifest: { mediaOrder: ['fotos/01-cabaña.jpg'], removedFilenames: [] },
    assets: [cloudinaryAsset({
      sourceFilename: 'fotos/01-cabaña.jpg',
      checksum: 'checksum-cabana',
      publicId: 'circulo-bienes-raices/CI-VER-0002/cabana',
    })],
  }),
}, 201);
assert.equal(synced.payload.summary.images, 1);
assert.equal(synced.payload.property.city, 'Lomas del Porvenir');
assert.equal(synced.payload.property.published, true);

const remote = await request('/api/admin/property-sync/CI-VER-0002', {
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(remote.payload.photos[0].sourceFilename, 'fotos/01-cabaña.jpg');

const syncDraft = {
  title: 'Cabaña sincronizada con ñ', description: 'Creada desde README.txt.', operation: 'venta', type: 'Terreno',
  price: '$800,000', currency: 'mxn', city: 'Lomas del Porvenir', state: 'Veracruz', country: 'México',
  published: 'true', featured: 'false', mainPhotoFilename: 'fotos/01-cabaña.jpg',
};
const syncRequestBody = (assets, removedFilenames = []) => ({
  sourceId: 'CI-VER-0002',
  draft: syncDraft,
  manifest: { mediaOrder: ['fotos/01-cabaña.jpg'], removedFilenames },
  assets,
});

const retryAsset = cloudinaryAsset({
  sourceFilename: 'fotos/01-cabaña.jpg', checksum: 'checksum-cabana',
  publicId: 'circulo-bienes-raices/CI-VER-0002/cabana-retry', version: 1730000001,
});
const idempotentRetry = await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify(syncRequestBody([retryAsset])),
});
assert.equal(idempotentRetry.payload.summary.uploaded, 0);
assert.equal(idempotentRetry.payload.summary.unchanged, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS total FROM photos WHERE propertyId = ?').get(remote.payload.id).total, 1);
assert.ok(cloudinaryDeletes.includes(retryAsset.publicId));

const failedReplacement = cloudinaryAsset({
  sourceFilename: 'fotos/01-cabaña.jpg', checksum: 'checksum-v2',
  publicId: 'circulo-bienes-raices/CI-VER-0002/cabana-v2-fail', version: 1730000002,
});
env.DB.failNextBatchAt = 1;
await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify(syncRequestBody([failedReplacement])),
}, 500);
assert.equal(database.prepare('SELECT checksum FROM photos WHERE propertyId = ?').get(remote.payload.id).checksum, 'checksum-cabana');
assert.ok(cloudinaryDeletes.includes(failedReplacement.publicId));
assert.ok(!cloudinaryDeletes.includes('circulo-bienes-raices/CI-VER-0002/cabana'));

const replacement = cloudinaryAsset({
  sourceFilename: 'fotos/01-cabaña.jpg', checksum: 'checksum-v2',
  publicId: 'circulo-bienes-raices/CI-VER-0002/cabana-v2', version: 1730000003,
});
const replaced = await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify(syncRequestBody([replacement])),
});
assert.equal(replaced.payload.summary.uploaded, 1);
assert.equal(replaced.payload.property.photos.length, 1);
assert.equal(replaced.payload.property.photos[0].checksum, 'checksum-v2');
assert.ok(cloudinaryDeletes.includes('circulo-bienes-raices/CI-VER-0002/cabana'));

const statusChanged = await request('/api/admin/property-sync/CI-VER-0002/status', {
  method: 'PATCH', headers: authHeaders(token), body: JSON.stringify({ status: 'reserved', published: 'false' }),
});
assert.equal(statusChanged.payload.status, 'reserved');
assert.equal(statusChanged.payload.published, false);
await request('/api/admin/property-sync/NO-EXISTE/status', {
  method: 'PATCH', headers: authHeaders(token), body: JSON.stringify({ status: 'available' }),
}, 404);
await request('/api/admin/property-sync/CI-VER-0002/status', {
  method: 'PATCH', headers: authHeaders(token), body: JSON.stringify({ status: 'available', published: true }),
});

await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST', headers: authHeaders(token),
  body: JSON.stringify(syncRequestBody([], ['fotos/01-cabaña.jpg'])),
}, 400);
assert.equal(database.prepare('SELECT COUNT(*) AS total FROM photos WHERE propertyId = ?').get(remote.payload.id).total, 1);

const invalidSignature = { ...cloudinaryAsset({
  sourceFilename: 'fotos/02-cabaña.jpg', checksum: 'checksum-invalid',
  publicId: 'circulo-bienes-raices/CI-VER-0002/invalid', version: 1730000004,
}), signature: '0'.repeat(40) };
await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify(syncRequestBody([invalidSignature])),
}, 400);

const accentSearch = await request(`/api/properties?search=${encodeURIComponent('CABANA')}`);
assert.equal(accentSearch.payload.properties.length, 2);

await request('/api', {}, 404);

const adminList = await request('/api/admin/properties?limit=100', {
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(adminList.payload.properties.length, 2);

const stats = await request('/api/stats', { headers: { authorization: `Bearer ${token}` } });
assert.equal(stats.payload.totalProperties, 2);
assert.equal(stats.payload.totalInquiries, 1);

console.log('Cloudflare Worker smoke test passed: D1, auth, catálogo, español, consultas, estadísticas y Media Sync directo.');
