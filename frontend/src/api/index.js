const API_BASE = '/api';

const parseResponse = async (res, fallbackMessage) => {
  if (res.ok) return res.json();
  let message = fallbackMessage;
  try {
    const body = await res.json();
    message = body.error || message;
  } catch (_) {
    // Keep fallback message when the server did not return JSON.
  }
  throw new Error(message);
};

const uploadWithProgress = (url, formData, onProgress) => new Promise((resolve, reject) => {
  const xhr = new XMLHttpRequest();
  xhr.open('POST', url);
  xhr.withCredentials = true;
  xhr.upload.onprogress = (event) => {
    if (event.lengthComputable && onProgress) {
      onProgress(Math.round((event.loaded / event.total) * 100));
    }
  };
  xhr.onload = () => {
    let body = {};
    try { body = JSON.parse(xhr.responseText || '{}'); } catch (_) { /* noop */ }
    if (xhr.status >= 200 && xhr.status < 300) resolve(body);
    else reject(new Error(body.error || 'Error al cargar archivos'));
  };
  xhr.onerror = () => reject(new Error('No fue posible conectar con el servidor'));
  xhr.send(formData);
});

const api = {
  login: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    return parseResponse(res, 'Error de login');
  },

  logout: async () => {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    return parseResponse(res, 'No se pudo cerrar la sesión');
  },

  getMe: async () => {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    return parseResponse(res, 'No autenticado');
  },

  getProperties: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/properties?${query}`);
    return parseResponse(res, 'Error al cargar propiedades');
  },

  getAdminProperties: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/properties/admin/all?${query}`, {
      credentials: 'include',
    });
    return parseResponse(res, 'Error al cargar propiedades administrativas');
  },

  getAdminProperty: async (id) => {
    const res = await fetch(`${API_BASE}/properties/admin/${encodeURIComponent(id)}`, {
      credentials: 'include',
    });
    return parseResponse(res, 'Propiedad no encontrada');
  },

  getFeatured: async () => {
    const res = await fetch(`${API_BASE}/properties/featured`);
    return parseResponse(res, 'Error al cargar destacadas');
  },

  getCities: async () => {
    const res = await fetch(`${API_BASE}/properties/cities`);
    return parseResponse(res, 'Error al cargar ciudades');
  },

  getProperty: async (slug) => {
    const res = await fetch(`${API_BASE}/properties/${encodeURIComponent(slug)}`);
    return parseResponse(res, 'Propiedad no encontrada');
  },

  createProperty: async (data) => {
    const res = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return parseResponse(res, 'Error al crear la propiedad');
  },

  updateProperty: async (id, data) => {
    const res = await fetch(`${API_BASE}/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    return parseResponse(res, 'Error al actualizar la propiedad');
  },

  deleteProperty: async (id) => {
    const res = await fetch(`${API_BASE}/properties/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return parseResponse(res, 'Error al archivar');
  },

  changeStatus: async (id, status) => {
    const res = await fetch(`${API_BASE}/properties/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    return parseResponse(res, 'Error al cambiar estado');
  },

  changePublished: async (id, published) => {
    const res = await fetch(`${API_BASE}/properties/${id}/published`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ published }),
    });
    return parseResponse(res, 'Error al cambiar publicación');
  },

  uploadPhotos: async (propertyId, files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    return parseResponse(res, 'Error al subir fotos');
  },

  importPropertyArchive: async (archive, onProgress) => {
    const formData = new FormData();
    formData.append('archive', archive);
    return uploadWithProgress(`${API_BASE}/imports/property-folder`, formData, onProgress);
  },

  importPropertyFiles: async ({ files, paths, folderName }, onProgress) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('files', file, file.name));
    formData.append('paths', JSON.stringify(paths));
    formData.append('folderName', folderName || 'carpeta-seleccionada');
    return uploadWithProgress(`${API_BASE}/imports/property-folder`, formData, onProgress);
  },

  getImportJobs: async () => {
    const res = await fetch(`${API_BASE}/imports`, { credentials: 'include' });
    return parseResponse(res, 'Error al cargar importaciones');
  },

  deletePhoto: async (propertyId, photoId) => {
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos/${photoId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return parseResponse(res, 'Error al eliminar foto');
  },

  setMainPhoto: async (propertyId, photoId) => {
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos/${photoId}/main`, {
      method: 'PATCH',
      credentials: 'include',
    });
    return parseResponse(res, 'Error al establecer foto principal');
  },

  submitInquiry: async (data) => {
    const res = await fetch(`${API_BASE}/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    return parseResponse(res, 'Error al enviar consulta');
  },

  getInquiries: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inquiries?${query}`, {
      credentials: 'include',
    });
    return parseResponse(res, 'Error al cargar consultas');
  },

  markInquiryRead: async (id) => {
    const res = await fetch(`${API_BASE}/inquiries/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    });
    return parseResponse(res, 'Error al marcar consulta');
  },

  deleteInquiry: async (id) => {
    const res = await fetch(`${API_BASE}/inquiries/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    return parseResponse(res, 'Error al eliminar consulta');
  },

  getStats: async () => {
    const res = await fetch(`${API_BASE}/stats`, { credentials: 'include' });
    return parseResponse(res, 'Error al cargar estadísticas');
  },
};

export default api;
