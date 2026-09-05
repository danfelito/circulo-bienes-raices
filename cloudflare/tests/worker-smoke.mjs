import assert from 'node:assert/strict';
import { createHash, createHmac } from 'node:crypto';
import fs from 'node:fs';
import { DatabaseSync } from 'node:sqlite';
import worker, { processCloudinaryCleanup } from '../src/index.mjs';

class D1StatementMock {
  constructor(owner, sql) {
    this.owner = owner;
    this.database = owner.database;
    this.sql = sql;
    this.values = [];
  }

  bind(...values) {
    this.values = values;
    return this;
  }

  async first() {
    const result = this.database.prepare(this.sql).get(...this.values) || null;
    if (/SELECT \* FROM properties WHERE sourceId = \?/i.test(this.sql)) await this.owner.afterSourceLookup();
    return result;
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
    this.sourceLookupRemaining = 0;
    this.sourceLookupWaiters = [];
    this.batchTail = Promise.resolve();
  }

  prepare(sql) {
    return new D1StatementMock(this, sql);
  }

  armSourceLookupBarrier(count) {
    this.sourceLookupRemaining = count;
    this.sourceLookupWaiters = [];
  }

  async afterSourceLookup() {
    if (this.sourceLookupRemaining <= 0) return;
    this.sourceLookupRemaining -= 1;
    if (this.sourceLookupRemaining === 0) {
      this.sourceLookupWaiters.splice(0).forEach(resolve => resolve());
      return;
    }
    await new Promise(resolve => this.sourceLookupWaiters.push(resolve));
  }

  async batch(statements) {
    const execute = async () => {
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
    };
    const pending = this.batchTail.then(execute, execute);
    this.batchTail = pending.catch(() => {});
    return pending;
  }
}

const database = new DatabaseSync(':memory:');
for (const migration of ['0001_initial_schema.sql', '0002_secure_upload_sessions.sql']) {
  database.exec(fs.readFileSync(new URL(`../migrations/${migration}`, import.meta.url), 'utf8'));
}

const env = {
  DB: new D1Mock(database),
  ASSETS: { fetch: async () => new Response('<html>Círculo Internacional</html>', { headers: { 'content-type': 'text/html' } }) },
  JWT_SECRET: 'worker-smoke-secret-with-more-than-thirty-two-characters',
  ADMIN_EMAIL: 'admin@circulointernacionalveracruz.org',
  ADMIN_PASSWORD: 'WorkerSmokePassword123!',
  CLOUDINARY_CLOUD_NAME: 'demo-cloud',
  CLOUDINARY_API_KEY: '1234567890',
  CLOUDINARY_API_SECRET: 'cloudinary-smoke-secret',
  CLOUDINARY_ROOT: 'circulo-bienes-raices-staging-test',
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

const cloudinaryAsset = ({ sourceFilename, checksum, publicId, uploadSessionId, resourceType = 'image', version = 1730000000 }) => ({
  uploadSessionId,
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

const request = async (path, options = {}, expected = 200, requestEnv = env) => {
  const response = await worker.fetch(new Request(`https://circulo.test${path}`, options), requestEnv);
  const text = await response.text();
  const payload = text && response.headers.get('content-type')?.includes('json') ? JSON.parse(text) : text;
  assert.equal(response.status, expected, `${options.method || 'GET'} ${path}: ${text}`);
  return { response, payload };
};

const authHeaders = token => ({ authorization: `Bearer ${token}`, 'content-type': 'application/json' });

const signUpload = async ({ propertyId, sourceId, files }) => (await request(
  propertyId ? '/api/admin/uploads/sign' : '/api/admin/property-sync/sign-upload',
  { method: 'POST', headers: authHeaders(token), body: JSON.stringify({
    ...(propertyId ? { propertyId } : { sourceId }), expectedFiles: files, maxFiles: Math.max(1, files.length),
  }) },
)).payload;

const assetForSession = (signed, { sourceFilename, checksum, resourceType = 'image', version = 1730000000 }) => {
  const authorization = signed.uploads.find(item => item.sourceFilename === sourceFilename);
  assert.ok(authorization, `No upload authorization for ${sourceFilename}`);
  return cloudinaryAsset({
    sourceFilename, checksum, resourceType, version, uploadSessionId: signed.uploadSessionId,
    publicId: `${signed.folder}/${authorization.publicId}`,
  });
};

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
const secondWorkerEnv = { ...env, DB: new D1Mock(database) };
for (let attempt = 0; attempt < 4; attempt += 1) {
  await request('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
    body: JSON.stringify({ email: env.ADMIN_EMAIL, password: 'incorrecta' }),
  }, 401, attempt % 2 ? secondWorkerEnv : env);
}
await request('/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
  body: JSON.stringify({ email: env.ADMIN_EMAIL, password: 'incorrecta' }),
}, 429, secondWorkerEnv);
await request('/api/auth/login', {
  method: 'POST',
  headers: { 'content-type': 'application/json', 'cf-connecting-ip': '203.0.113.10' },
  body: JSON.stringify({ email: env.ADMIN_EMAIL, password: env.ADMIN_PASSWORD }),
}, 429, secondWorkerEnv);
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

const manualSigned = await signUpload({ propertyId: created.payload.id, files: ['fachada-cabaña.jpg'] });
const manualAsset = assetForSession(manualSigned, {
  sourceFilename: 'fachada-cabaña.jpg', checksum: 'manual-checksum', version: 1730000010,
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

const signed = await signUpload({ sourceId: 'CI-VER-0002', files: ['fotos/01-cabaña.jpg'] });
assert.match(signed.uploadUrl, /cloudinary\.com/);
assert.ok(signed.signature);
const firstSyncAsset = assetForSession(signed, {
  sourceFilename: 'fotos/01-cabaña.jpg', checksum: 'checksum-cabana', version: 1730000000,
});

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
    assets: [firstSyncAsset],
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

const retrySigned = await signUpload({ sourceId: 'CI-VER-0002', files: ['fotos/01-cabaña.jpg'] });
const retryAsset = assetForSession(retrySigned, {
  sourceFilename: 'fotos/01-cabaña.jpg', checksum: 'checksum-cabana', version: 1730000001,
});
const idempotentRetry = await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify(syncRequestBody([retryAsset])),
});
assert.equal(idempotentRetry.payload.summary.uploaded, 0);
assert.equal(idempotentRetry.payload.summary.unchanged, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS total FROM photos WHERE propertyId = ?').get(remote.payload.id).total, 1);
assert.ok(database.prepare('SELECT publicId FROM cloudinary_cleanup_queue WHERE publicId = ?').get(retryAsset.publicId));

// Una respuesta perdida puede provocar que el cliente repita exactamente la misma solicitud.
const lostResponseRetry = await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify(syncRequestBody([retryAsset])),
});
assert.equal(lostResponseRetry.payload.summary.unchanged, 1);
assert.equal(database.prepare('SELECT COUNT(*) AS total FROM photos WHERE propertyId = ?').get(remote.payload.id).total, 1);

const failedSigned = await signUpload({ sourceId: 'CI-VER-0002', files: ['fotos/01-cabaña.jpg'] });
const failedReplacement = assetForSession(failedSigned, {
  sourceFilename: 'fotos/01-cabaña.jpg', checksum: 'checksum-v2', version: 1730000002,
});
env.DB.failNextBatchAt = 1;
await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify(syncRequestBody([failedReplacement])),
}, 500);
assert.equal(database.prepare('SELECT checksum FROM photos WHERE propertyId = ?').get(remote.payload.id).checksum, 'checksum-cabana');
assert.ok(database.prepare('SELECT publicId FROM cloudinary_cleanup_queue WHERE publicId = ?').get(failedReplacement.publicId));
assert.ok(!cloudinaryDeletes.includes(firstSyncAsset.publicId));

const replacementSigned = await signUpload({ sourceId: 'CI-VER-0002', files: ['fotos/01-cabaña.jpg'] });
const replacement = assetForSession(replacementSigned, {
  sourceFilename: 'fotos/01-cabaña.jpg', checksum: 'checksum-v2', version: 1730000003,
});
const replaced = await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify(syncRequestBody([replacement])),
});
assert.equal(replaced.payload.summary.uploaded, 1);
assert.equal(replaced.payload.property.photos.length, 1);
assert.equal(replaced.payload.property.photos[0].checksum, 'checksum-v2');
assert.ok(database.prepare('SELECT publicId FROM cloudinary_cleanup_queue WHERE publicId = ?').get(firstSyncAsset.publicId));

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

const invalidSigned = await signUpload({ sourceId: 'CI-VER-0002', files: ['fotos/02-cabaña.jpg'] });
const invalidSignature = { ...assetForSession(invalidSigned, {
  sourceFilename: 'fotos/02-cabaña.jpg', checksum: 'checksum-invalid', version: 1730000004,
}), signature: '0'.repeat(40) };
await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify(syncRequestBody([invalidSignature])),
}, 400);

// Una respuesta auténtica de Cloudinary no puede cambiar de propiedad/sourceId.
const wrongOwnerSigned = await signUpload({ sourceId: 'CI-VER-OWNER-A', files: ['fotos/fachada.jpg'] });
const wrongOwnerAsset = assetForSession(wrongOwnerSigned, {
  sourceFilename: 'fotos/fachada.jpg', checksum: 'owner-a', version: 1730000005,
});
await request('/api/admin/property-sync/sync/upsert', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify({
    sourceId: 'CI-VER-OWNER-B', draft: { ...syncDraft, title: 'Destino incorrecto' },
    manifest: { mediaOrder: ['fotos/fachada.jpg'], removedFilenames: [] }, assets: [wrongOwnerAsset],
  }),
}, 403);

// Aunque una limpieza haya sido programada por una carrera, D1 tiene la última palabra.
database.prepare(`INSERT INTO cloudinary_cleanup_queue
  (publicId, owners, notBefore, attempts, lastError, createdAt, updatedAt)
  VALUES (?, ?, 0, 0, NULL, 0, 0)
  ON CONFLICT(publicId) DO UPDATE SET notBefore = 0`).run(replacement.publicId, JSON.stringify(['CI-VER-0002']));
database.prepare('UPDATE upload_sessions SET expiresAt = 0 WHERE id = ?').run(replacement.uploadSessionId);
const deletesBeforeReferenceGuard = cloudinaryDeletes.length;
const cleanupSummary = await processCloudinaryCleanup(env);
assert.ok(cleanupSummary.retained >= 1);
assert.equal(cloudinaryDeletes.length, deletesBeforeReferenceGuard);
assert.equal(database.prepare('SELECT COUNT(*) AS total FROM photos WHERE publicId = ?').get(replacement.publicId).total, 1);

// Dos instancias leen la misma revisión; sólo una puede confirmarla y la otra deja su carga en limpieza segura.
const concurrentSignedA = await signUpload({ sourceId: 'CI-VER-0002', files: ['fotos/01-cabaña.jpg'] });
const concurrentSignedB = await signUpload({ sourceId: 'CI-VER-0002', files: ['fotos/01-cabaña.jpg'] });
const concurrentAssetA = assetForSession(concurrentSignedA, {
  sourceFilename: 'fotos/01-cabaña.jpg', checksum: 'concurrent-a', version: 1730000011,
});
const concurrentAssetB = assetForSession(concurrentSignedB, {
  sourceFilename: 'fotos/01-cabaña.jpg', checksum: 'concurrent-b', version: 1730000012,
});
env.DB.armSourceLookupBarrier(2);
const concurrentResponses = await Promise.all([concurrentAssetA, concurrentAssetB].map(asset => worker.fetch(
  new Request('https://circulo.test/api/admin/property-sync/sync/upsert', {
    method: 'POST', headers: authHeaders(token), body: JSON.stringify(syncRequestBody([asset])),
  }), env,
)));
assert.deepEqual(concurrentResponses.map(response => response.status).sort(), [200, 500]);
const concurrentWinner = database.prepare('SELECT checksum, publicId FROM photos WHERE propertyId = ?').get(remote.payload.id);
assert.ok(['concurrent-a', 'concurrent-b'].includes(concurrentWinner.checksum));
const losingAsset = concurrentWinner.checksum === 'concurrent-a' ? concurrentAssetB : concurrentAssetA;
assert.ok(database.prepare('SELECT publicId FROM cloudinary_cleanup_queue WHERE publicId = ?').get(losingAsset.publicId));
assert.ok(!cloudinaryDeletes.includes(concurrentWinner.publicId));

const importInventory = {
  files: [
    { path: 'expediente/fachada.jpg', name: 'fachada.jpg', size: 12000, category: 'image' },
    { path: 'expediente/README.txt', name: 'README.txt', size: 120, category: 'document' },
  ],
};
const importAnalysis = await request('/api/admin/property-import/analyze', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify({
    inventory: importInventory,
    documents: [{ name: 'expediente/README.txt', text: 'Título: Casa del Malecón\nPrecio: $2,500,000\nMoneda: MXN\nCiudad: Veracruz\nEstado: Veracruz\nPaís: México\nDescripción: Frente al mar.\nOperación: venta\nTipo: casa\nEstatus: disponible' }],
  }),
});
assert.equal(importAnalysis.payload.ai.used, false);
assert.equal(importAnalysis.payload.draft.city, 'Veracruz');
assert.equal(importAnalysis.payload.draft.price, 2500000);
assert.equal(importAnalysis.payload.review.method, 'structured-metadata');
const importStart = await request('/api/admin/property-import/start', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify({ inventory: importInventory }),
}, 201);
const importedAsset = assetForSession(importStart.payload.signed, {
  sourceFilename: 'expediente/fachada.jpg', checksum: 'import-checksum', version: 1730000006,
});
const imported = await request('/api/admin/property-import/complete', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify({
    importId: importStart.payload.importId,
    draft: { ...importAnalysis.payload.draft, published: true, mainPhotoFilename: 'expediente/fachada.jpg' },
    assets: [importedAsset],
  }),
}, 201);
assert.equal(imported.payload.summary.published, true);
assert.equal(imported.payload.property.photos.length, 1);
const repeatedImport = await request('/api/admin/property-import/complete', {
  method: 'POST', headers: authHeaders(token), body: JSON.stringify({
    importId: importStart.payload.importId, draft: importAnalysis.payload.draft, assets: [importedAsset],
  }),
});
assert.equal(repeatedImport.payload.repeated, true);

const accentSearch = await request(`/api/properties?search=${encodeURIComponent('CABANA')}`);
assert.equal(accentSearch.payload.properties.length, 2);

await request('/api', {}, 404);

const adminList = await request('/api/admin/properties?limit=100', {
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(adminList.payload.properties.length, 3);

const stats = await request('/api/stats', { headers: { authorization: `Bearer ${token}` } });
assert.equal(stats.payload.totalProperties, 3);
assert.equal(stats.payload.totalInquiries, 1);

console.log('Cloudflare Worker smoke test passed: D1, auth distribuida, importador, limpieza segura, español y Media Sync directo.');
