const BASE_URL = process.env.SMOKE_BASE_URL || 'http://127.0.0.1:5000';
const ADMIN_EMAIL = process.env.SMOKE_ADMIN_EMAIL || 'smoke-admin@example.com';
const ADMIN_PASSWORD = process.env.SMOKE_ADMIN_PASSWORD || 'SmokePassword123!';

async function request(path, options = {}, expectedStatuses = [200]) {
  const response = await fetch(`${BASE_URL}${path}`, options);
  const text = await response.text();
  let payload = null;

  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text;
    }
  }

  if (!expectedStatuses.includes(response.status)) {
    throw new Error(`${options.method || 'GET'} ${path} returned ${response.status}: ${text.slice(0, 300)}`);
  }

  return { response, payload, text };
}

function authHeaders(token, json = false) {
  return {
    Authorization: `Bearer ${token}`,
    ...(json ? { 'Content-Type': 'application/json' } : {}),
  };
}

async function main() {
  const unique = Date.now();
  const title = `Smoke Test Property ${unique}`;
  let token = '';
  let propertyId = '';
  let propertySlug = '';
  let inquiryId = '';

  try {
    const health = await request('/api/health');
    if (health.payload?.status !== 'ok' || health.payload?.database !== 'connected') {
      throw new Error('Health endpoint did not confirm the database connection');
    }

    const homepage = await request('/');
    if (!homepage.text.includes('Círculo Internacional')) {
      throw new Error('Homepage did not contain the expected brand text');
    }

    const loginPage = await request('/admin/login');
    if (!loginPage.text.includes('Círculo Internacional')) {
      throw new Error('Admin login SPA route was not served');
    }

    const config = await request('/api/config');
    if (!config.payload || typeof config.payload !== 'object') {
      throw new Error('Public configuration endpoint returned an invalid payload');
    }

    const login = await request('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email: ADMIN_EMAIL, password: ADMIN_PASSWORD }),
    });
    token = login.payload?.token;
    if (!token) throw new Error('Login did not return an authentication token');

    const me = await request('/api/auth/me', { headers: authHeaders(token) });
    if (me.payload?.user?.email !== ADMIN_EMAIL) {
      throw new Error('Authenticated user endpoint returned the wrong account');
    }

    const created = await request('/api/properties', {
      method: 'POST',
      headers: authHeaders(token, true),
      body: JSON.stringify({
        title,
        description: 'Temporary property created by the Docker runtime smoke test.',
        operation: 'venta',
        type: 'casa',
        price: 1234567,
        currency: 'MXN',
        bedrooms: 3,
        bathrooms: 2,
        area: 180,
        city: 'Veracruz',
        state: 'Veracruz',
        country: 'México',
        status: 'available',
        featured: true,
        published: true,
      }),
    }, [201]);
    propertyId = created.payload?.id;
    propertySlug = created.payload?.slug;
    if (!propertyId || !propertySlug) throw new Error('Property creation returned an incomplete record');

    const catalog = await request(`/api/properties?search=${encodeURIComponent(title)}&limit=5`);
    if (!catalog.payload?.properties?.some(property => property.id === propertyId)) {
      throw new Error('Created property was not returned by the public catalog');
    }

    const detail = await request(`/api/properties/${propertySlug}`);
    if (detail.payload?.property?.id !== propertyId) {
      throw new Error('Public property detail returned the wrong record');
    }

    const updated = await request(`/api/properties/${propertyId}`, {
      method: 'PUT',
      headers: authHeaders(token, true),
      body: JSON.stringify({ price: 1350000, published: false }),
    });
    if (updated.payload?.published !== false || updated.payload?.price !== 1350000) {
      throw new Error('Property update did not persist expected values');
    }

    await request(`/api/properties/${propertySlug}`, {}, [404]);

    const adminDetail = await request(`/api/admin/properties/${propertyId}`, {
      headers: authHeaders(token),
    });
    if (adminDetail.payload?.id !== propertyId || adminDetail.payload?.published !== false) {
      throw new Error('Admin property detail could not retrieve the unpublished record');
    }

    const adminList = await request('/api/admin/properties?limit=100', {
      headers: authHeaders(token),
    });
    if (!adminList.payload?.properties?.some(property => property.id === propertyId)) {
      throw new Error('Admin property list omitted the unpublished record');
    }

    const inquiry = await request('/api/inquiries', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: 'Runtime Smoke Test',
        email: 'smoke@example.com',
        phone: '+522290000000',
        message: 'Temporary inquiry generated during automated validation.',
        propertyId,
        honeypot: '',
      }),
    }, [201]);
    inquiryId = inquiry.payload?.id;
    if (!inquiryId) throw new Error('Inquiry creation returned an incomplete record');

    const inquiries = await request('/api/inquiries?limit=100', {
      headers: authHeaders(token),
    });
    if (!inquiries.payload?.inquiries?.some(item => item.id === inquiryId)) {
      throw new Error('Admin inquiry list omitted the created inquiry');
    }

    const markedRead = await request(`/api/inquiries/${inquiryId}/read`, {
      method: 'PATCH',
      headers: authHeaders(token),
    });
    if (markedRead.payload?.isRead !== true) {
      throw new Error('Inquiry was not marked as read');
    }

    const stats = await request('/api/stats', { headers: authHeaders(token) });
    if (!Number.isInteger(stats.payload?.totalProperties) || !Number.isInteger(stats.payload?.totalInquiries)) {
      throw new Error('Dashboard statistics returned an invalid payload');
    }

    await request(`/api/inquiries/${inquiryId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    inquiryId = '';

    await request(`/api/properties/${propertyId}`, {
      method: 'DELETE',
      headers: authHeaders(token),
    });
    propertyId = '';

    console.log('Runtime smoke test passed: SPA, health, auth, catalog, admin CRUD, inquiries and stats.');
  } finally {
    if (token && inquiryId) {
      await request(`/api/inquiries/${inquiryId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      }).catch(() => {});
    }
    if (token && propertyId) {
      await request(`/api/properties/${propertyId}`, {
        method: 'DELETE',
        headers: authHeaders(token),
      }).catch(() => {});
    }
  }
}

main().catch(error => {
  console.error(error.stack || error.message);
  process.exit(1);
});
