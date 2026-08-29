import assert from 'node:assert/strict';
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
  }

  prepare(sql) {
    return new D1StatementMock(this.database, sql);
  }

  async batch(statements) {
    this.database.exec('BEGIN');
    try {
      const results = [];
      for (const statement of statements) results.push(await statement.execute());
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

const me = await request('/api/auth/me', { headers: { authorization: `Bearer ${token}` } });
assert.equal(me.payload.user.email, env.ADMIN_EMAIL);

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

const catalog = await request(`/api/properties?search=${encodeURIComponent('Cabaña')}`);
assert.equal(catalog.payload.properties.length, 1);

const detail = await request(`/api/properties/${created.payload.slug}`);
assert.equal(detail.payload.property.title, 'Cabaña en Venta en Lomas del Porvenir');

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
    assets: [{
      sourceFilename: 'fotos/01-cabaña.jpg',
      checksum: 'checksum-cabana',
      resourceType: 'image',
      secureUrl: 'https://res.cloudinary.com/demo/image/upload/cabana.webp',
      publicId: 'circulo-bienes-raices/ci-ver-0002/cabana',
      optimizedBytes: 9000,
      width: 1200,
      height: 800,
      format: 'webp',
    }],
  }),
}, 201);
assert.equal(synced.payload.summary.images, 1);
assert.equal(synced.payload.property.city, 'Lomas del Porvenir');
assert.equal(synced.payload.property.published, true);

const remote = await request('/api/admin/property-sync/CI-VER-0002', {
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(remote.payload.photos[0].sourceFilename, 'fotos/01-cabaña.jpg');

const adminList = await request('/api/admin/properties?limit=100', {
  headers: { authorization: `Bearer ${token}` },
});
assert.equal(adminList.payload.properties.length, 2);

const stats = await request('/api/stats', { headers: { authorization: `Bearer ${token}` } });
assert.equal(stats.payload.totalProperties, 2);
assert.equal(stats.payload.totalInquiries, 1);

console.log('Cloudflare Worker smoke test passed: D1, auth, catálogo, español, consultas, estadísticas y Media Sync directo.');
