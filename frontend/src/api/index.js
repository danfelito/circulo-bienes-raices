const API_BASE = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const readError = async (res, fallback) => {
  try {
    const payload = await res.json();
    return payload.error || fallback;
  } catch {
    return fallback;
  }
};

const appendFiles = (formData, files) => {
  files.forEach(file => {
    const relativePath = file.webkitRelativePath || file.relativePath || file.name;
    formData.append('files', file, relativePath);
  });
};

const api = {
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
    const formData = new FormData();
    files.forEach(file => formData.append('photos', file));
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) throw new Error(await readError(res, 'Error al subir archivos multimedia'));
    return res.json();
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

  analyzePropertyFolder: async files => {
    const formData = new FormData();
    appendFiles(formData, files);
    const res = await fetch(`${API_BASE}/admin/property-import/analyze`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) throw new Error(await readError(res, 'No se pudo analizar la carpeta'));
    return res.json();
  },

  publishPropertyFolder: async (draft, files) => {
    const formData = new FormData();
    formData.append('draft', JSON.stringify(draft));
    appendFiles(formData, files);
    const res = await fetch(`${API_BASE}/admin/property-import/publish`, {
      method: 'POST',
      headers: { ...getAuthHeaders() },
      credentials: 'include',
      body: formData,
    });
    if (!res.ok) throw new Error(await readError(res, 'No se pudo publicar la propiedad'));
    return res.json();
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
