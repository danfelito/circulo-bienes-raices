import { categoryOf, relativeName, retry } from '../lib/propertyImport';

const API_BASE = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const readError = async (res, fallback) => {
  try {
    const payload = await res.json();
    const message = payload.error || fallback;
    return payload.requestId ? `${message} Referencia: ${payload.requestId}` : message;
  } catch {
    return fallback;
  }
};

const api = {
  getImportReadiness: async signal => {
    const res = await fetch(`${API_BASE}/admin/property-import/readiness`, {
      headers: getAuthHeaders(), credentials: 'include', cache: 'no-store', signal,
    });
    if (res.status === 401) throw new Error('La sesión venció. Inicia sesión de nuevo para cargar la propiedad.');
    if (res.status === 404) throw new Error('El servidor tiene una versión anterior del importador. Falta publicar la actualización; abrir Cloudflare no activa la carga.');
    if (!res.ok) throw new Error(await readError(res, 'No se pudo comprobar el servicio de carga.'));
    const result = await res.json();
    if (!result.ready || result.importerVersion !== '2026-09-05.1') throw new Error('Las versiones del portal y del importador no coinciden. Se necesita actualizar el servidor.');
    return result;
  },
  getConfig: async () => {
    const res = await fetch(`${API_BASE}/config`);
    if (!res.ok) throw new Error('Error al cargar la configuración');
    return res.json();
  },

  // Auth
  login: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await readError(res, 'Error de login'));
    return res.json();
  },

  logout: async () => {
    await fetch(`${API_BASE}/auth/logout`, { method: 'POST', credentials: 'include' });
    localStorage.removeItem('token');
  },

  getMe: async () => {
    const res = await fetch(`${API_BASE}/auth/me`, {
      credentials: 'include',
      headers: { ...getAuthHeaders() },
    });
    if (!res.ok) throw new Error('No autenticado');
    return res.json();
  },

  // Properties - Public
  getProperties: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/properties?${query}`);
    if (!res.ok) throw new Error('Error al cargar propiedades');
    return res.json();
  },

  getFeatured: async () => {
    const res = await fetch(`${API_BASE}/properties/featured`);
    if (!res.ok) throw new Error('Error al cargar destacadas');
    return res.json();
  },

  getCities: async () => {
    const res = await fetch(`${API_BASE}/properties/cities`);
    if (!res.ok) throw new Error('Error al cargar ciudades');
    return res.json();
  },

  getProperty: async (slug) => {
    const res = await fetch(`${API_BASE}/properties/${slug}`);
    if (!res.ok) throw new Error('Propiedad no encontrada');
    return res.json();
  },

  // Properties - Admin
  getAdminProperties: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/admin/properties?${query}`, {
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al cargar propiedades administrativas');
    return res.json();
  },

  getAdminProperty: async (id) => {
    const res = await fetch(`${API_BASE}/admin/properties/${id}`, {
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Propiedad no encontrada');
    return res.json();
  },

  createProperty: async (data) => {
    const res = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await readError(res, 'Error al crear'));
    return res.json();
  },

  updateProperty: async (id, data) => {
    const res = await fetch(`${API_BASE}/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await readError(res, 'Error al actualizar'));
    return res.json();
  },

  deleteProperty: async (id) => {
    const res = await fetch(`${API_BASE}/properties/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar');
    return res.json();
  },

  changeStatus: async (id, status) => {
    const res = await fetch(`${API_BASE}/properties/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error('Error al cambiar estado');
    return res.json();
  },

  uploadPhotos: async (propertyId, files) => {
    const signedRes = await fetch(`${API_BASE}/admin/uploads/sign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify({ propertyId, expectedFiles: files.map(file => file.name), maxFiles: files.length }),
    });

    // Compatibilidad temporal con el backend anterior de Render.
    if (signedRes.status === 404) {
      const legacyForm = new FormData();
      files.forEach(file => legacyForm.append('photos', file));
      const legacyRes = await fetch(`${API_BASE}/properties/${propertyId}/photos`, {
        method: 'POST',
        headers: { ...getAuthHeaders() },
        credentials: 'include',
        body: legacyForm,
      });
      if (!legacyRes.ok) throw new Error(await readError(legacyRes, 'Error al subir archivos multimedia'));
      return legacyRes.json();
    }

    if (!signedRes.ok) throw new Error(await readError(signedRes, 'No se pudo preparar la carga multimedia'));
    const signed = await signedRes.json();
    const uploaded = [];

    for (const file of files) {
      const upload = signed.uploads?.find(item => item.sourceFilename === file.name);
      if (!upload) throw new Error(`La sesión no autorizó ${file.name}`);
      const cloudinaryForm = new FormData();
      cloudinaryForm.append('file', file, file.name);
      cloudinaryForm.append('api_key', signed.apiKey);
      cloudinaryForm.append('timestamp', String(signed.timestamp));
      cloudinaryForm.append('folder', signed.folder);
      cloudinaryForm.append('public_id', upload.publicId);
      cloudinaryForm.append('signature', upload.signature);

      const cloudinaryRes = await fetch(signed.uploadUrl, { method: 'POST', body: cloudinaryForm });
      const cloudinary = await cloudinaryRes.json().catch(() => ({}));
      if (!cloudinaryRes.ok || !cloudinary.secure_url || !cloudinary.public_id) {
        throw new Error(cloudinary.error?.message || `No se pudo subir ${file.name}`);
      }

      const completeRes = await fetch(`${API_BASE}/admin/uploads/complete`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
        credentials: 'include',
        body: JSON.stringify({
          propertyId,
          uploadSessionId: signed.uploadSessionId,
          secureUrl: cloudinary.secure_url,
          publicId: cloudinary.public_id,
          version: cloudinary.version,
          signature: cloudinary.signature,
          resourceType: cloudinary.resource_type,
          sourceFilename: file.name,
          originalBytes: file.size,
          optimizedBytes: cloudinary.bytes,
          width: cloudinary.width,
          height: cloudinary.height,
          duration: cloudinary.duration,
          format: cloudinary.format,
        }),
      });
      if (!completeRes.ok) throw new Error(await readError(completeRes, `No se pudo registrar ${file.name}`));
      uploaded.push(await completeRes.json());
    }

    return uploaded;
  },

  deletePhoto: async (propertyId, photoId) => {
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos/${photoId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar archivo');
    return res.json();
  },

  setMainPhoto: async (propertyId, photoId) => {
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos/${photoId}/main`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await readError(res, 'Error al establecer foto principal'));
    return res.json();
  },

  analyzePropertyInventory: async (inventory, documents, signal) => {
    const res = await fetch(`${API_BASE}/admin/property-import/analyze`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      signal,
      body: JSON.stringify({ inventory, documents }),
    });
    if (!res.ok) throw new Error(await readError(res, 'No se pudo analizar la carpeta'));
    return res.json();
  },

  importProperty: async (draft, files, inventory, { signal, onProgress = () => {}, onRetry = () => {} } = {}) => {
    await api.getImportReadiness(signal);
    const startRes = await fetch(`${API_BASE}/admin/property-import/start`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      signal,
      body: JSON.stringify({ inventory }),
    });
    if (!startRes.ok) throw new Error(`Inicio de carga: ${await readError(startRes, 'No se pudo iniciar la importación')}`);
    const session = await startRes.json();
    const mediaInventory = inventory.files.filter(item => ['image', 'video'].includes(item.category));
    const filesByPath = new Map(files.map(file => [relativeName(file), file]));
    const assets = [];
    const cancel = async () => {
      await fetch(`${API_BASE}/admin/property-import/cancel`, {
        method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, credentials: 'include',
        body: JSON.stringify({ importId: session.importId, uploadSessionId: session.signed.uploadSessionId,
          files: mediaInventory.map(item => ({ sourceFilename: item.path, resourceType: item.category })) }),
      }).catch(() => {});
    };
    try {
      for (const [index, item] of mediaInventory.entries()) {
        const file = filesByPath.get(item.path);
        const authorization = session.signed.uploads.find(upload => upload.sourceFilename === item.path);
        if (!file || !authorization) throw new Error(`No se encontró el archivo autorizado ${item.path}`);
        const cloudinary = await retry(async attempt => {
          onProgress({ phase: 'uploading', completed: index, total: mediaInventory.length, current: item.path, attempt });
          const form = new FormData();
          form.append('file', file, file.name);
          form.append('api_key', session.signed.apiKey);
          form.append('timestamp', String(session.signed.timestamp));
          form.append('folder', session.signed.folder);
          form.append('public_id', authorization.publicId);
          form.append('signature', authorization.signature);
          const response = await fetch(session.signed.uploadUrl, { method: 'POST', body: form, signal });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || !payload.secure_url || !payload.public_id || !payload.signature) {
            throw new Error(payload.error?.message || `Cloudinary no pudo cargar ${item.path}`);
          }
          return payload;
        }, { signal, onRetry: event => onRetry({ ...event, file: item.path }) });
        assets.push({
          uploadSessionId: session.signed.uploadSessionId,
          sourceFilename: item.path,
          resourceType: cloudinary.resource_type || item.category,
          secureUrl: cloudinary.secure_url,
          publicId: cloudinary.public_id,
          version: cloudinary.version,
          signature: cloudinary.signature,
          originalBytes: file.size,
          optimizedBytes: cloudinary.bytes,
          width: cloudinary.width,
          height: cloudinary.height,
          duration: cloudinary.duration,
          format: cloudinary.format,
        });
        onProgress({ phase: 'uploading', completed: index + 1, total: mediaInventory.length, current: item.path });
      }
      onProgress({ phase: 'registering', completed: mediaInventory.length, total: mediaInventory.length });
      return await retry(async () => {
        const completeRes = await fetch(`${API_BASE}/admin/property-import/complete`, {
          method: 'POST', headers: { 'Content-Type': 'application/json', ...getAuthHeaders() }, credentials: 'include', signal,
          body: JSON.stringify({ importId: session.importId, draft, assets }),
        });
        if (!completeRes.ok) throw new Error(`Registro del inmueble: ${await readError(completeRes, 'No se pudo registrar la propiedad')}`);
        return completeRes.json();
      }, { signal, onRetry: event => onRetry({ ...event, file: 'registro D1' }) });
    } catch (error) {
      await cancel();
      throw error;
    }
  },

  // Inquiries
  submitInquiry: async data => {
    const res = await fetch(`${API_BASE}/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error('Error al enviar consulta');
    return res.json();
  },

  getInquiries: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inquiries?${query}`, {
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al cargar consultas');
    return res.json();
  },

  markInquiryRead: async id => {
    const res = await fetch(`${API_BASE}/inquiries/${id}/read`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al marcar consulta');
    return res.json();
  },

  deleteInquiry: async id => {
    const res = await fetch(`${API_BASE}/inquiries/${id}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar consulta');
    return res.json();
  },

  // Stats
  getStats: async () => {
    const res = await fetch(`${API_BASE}/stats`, {
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al cargar estadísticas');
    return res.json();
  },
};

export default api;
