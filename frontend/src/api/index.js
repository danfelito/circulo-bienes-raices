const API_BASE = '/api';

const getAuthHeaders = () => {
  const token = localStorage.getItem('token');
  return token ? { Authorization: `Bearer ${token}` } : {};
};

const api = {
  // Auth
  login: async (email, password) => {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error de login');
    }
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
  createProperty: async (data) => {
    const res = await fetch(`${API_BASE}/properties`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al crear');
    }
    return res.json();
  },

  updateProperty: async (id, data) => {
    const res = await fetch(`${API_BASE}/properties/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json', ...getAuthHeaders() },
      credentials: 'include',
      body: JSON.stringify(data),
    });
    if (!res.ok) {
      const err = await res.json();
      throw new Error(err.error || 'Error al actualizar');
    }
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
    if (!res.ok) throw new Error('Error al subir fotos');
    return res.json();
  },

  deletePhoto: async (propertyId, photoId) => {
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos/${photoId}`, {
      method: 'DELETE',
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al eliminar foto');
    return res.json();
  },

  setMainPhoto: async (propertyId, photoId) => {
    const res = await fetch(`${API_BASE}/properties/${propertyId}/photos/${photoId}/main`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al establecer foto principal');
    return res.json();
  },

  // Inquiries
  submitInquiry: async (data) => {
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

  markInquiryRead: async (id) => {
    const res = await fetch(`${API_BASE}/inquiries/${id}/read`, {
      method: 'PATCH',
      headers: { ...getAuthHeaders() },
      credentials: 'include',
    });
    if (!res.ok) throw new Error('Error al marcar consulta');
    return res.json();
  },

  deleteInquiry: async (id) => {
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
