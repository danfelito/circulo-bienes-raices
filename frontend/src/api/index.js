const API_BASE = '/api';

const parseError = async (res, fallback) => {
  try {
    const payload = await res.json();
    return payload.error || fallback;
  } catch {
    return fallback;
  }
};

const api = {
  login: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error de login'));
    return res.json();
  },

  logout: async () => {
    const res = await fetch(`${API_BASE}/auth/logout`, {
      method: 'POST',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await parseError(res, 'No se pudo cerrar la sesión'));
    return res.json();
  },

  getMe: async () => {
    const res = await fetch(`${API_BASE}/auth/me`, { credentials: 'include' });
    if (!res.ok) throw new Error('No autenticado');
    return res.json();
  },

  getProperties: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/properties?${query}`);
    if (!res.ok) throw new Error('Error al cargar propiedades');
    return res.json();
  },

  getAdminProperties: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/properties/admin/all?${query}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al cargar propiedades administrativas'));
    return res.json();
  },

  getAdminProperty: async (id) => {
    const res = await fetch(`${API_BASE}/properties/admin/${id}`, {
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await parseError(res, 'Propiedad no encontrada'));
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

  createProperty: async (data) => {
    const res = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al crear'));
    return res.json();
  },

  updateProperty: async (id, data) => {
    const res = await fetch(`${API_BASE}/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al actualizar'));
    return res.json();
  },

  deleteProperty: async (id) => {
    const res = await fetch(`${API_BASE}/properties/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al archivar'));
    return res.json();
  },

  changeStatus: async (id, status) => {
    const res = await fetch(`${API_BASE}/properties/${id}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ status }),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al cambiar estado'));
    return res.json();
  },

  uploadPhotos: async (propertyId, files) => {
    const formData = new FormData();
    files.forEach((file) => formData.append('photos', file));
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al subir fotos'));
    return res.json();
  },

  deletePhoto: async (propertyId, photoId) => {
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos/${photoId}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al eliminar foto'));
    return res.json();
  },

  setMainPhoto: async (propertyId, photoId) => {
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos/${photoId}/main`, {
      method: 'PATCH',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al establecer foto principal'));
    return res.json();
  },

  importPropertyFolders: async ({ files = [], relativePaths = [], archive = null }) => {
    const formData = new FormData();
    if (archive) formData.append('archive', archive);
    files.forEach((file) => formData.append('files', file));
    formData.append('relativePaths', JSON.stringify(relativePaths));

    const res = await fetch(`${API_BASE}/imports/property-folder`, {
      method: 'POST',
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al importar propiedades'));
    return res.json();
  },

  getImports: async () => {
    const res = await fetch(`${API_BASE}/imports`, { credentials: 'include' });
    if (!res.ok) throw new Error(await parseError(res, 'Error al cargar importaciones'));
    return res.json();
  },

  submitInquiry: async (data) => {
    const res = await fetch(`${API_BASE}/inquiries`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(data),
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al enviar consulta'));
    return res.json();
  },

  getInquiries: async (params = {}) => {
    const query = new URLSearchParams(params).toString();
    const res = await fetch(`${API_BASE}/inquiries?${query}`, { credentials: 'include' });
    if (!res.ok) throw new Error(await parseError(res, 'Error al cargar consultas'));
    return res.json();
  },

  markInquiryRead: async (id) => {
    const res = await fetch(`${API_BASE}/inquiries/${id}/read`, {
      method: 'PATCH',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al marcar consulta'));
    return res.json();
  },

  deleteInquiry: async (id) => {
    const res = await fetch(`${API_BASE}/inquiries/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (!res.ok) throw new Error(await parseError(res, 'Error al eliminar consulta'));
    return res.json();
  },

  getStats: async () => {
    const res = await fetch(`${API_BASE}/stats`, { credentials: 'include' });
    if (!res.ok) throw new Error(await parseError(res, 'Error al cargar estadísticas'));
    return res.json();
  },
};

export default api;
