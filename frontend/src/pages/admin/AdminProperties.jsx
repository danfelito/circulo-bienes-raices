import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ChevronLeft, ChevronRight, Eye, Pencil, Plus, Star, Trash2 } from 'lucide-react';
import api from '../../api';

const AdminProperties = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });

  const loadProperties = () => {
    setLoading(true);
    api.getAdminProperties({ page, limit: 20 })
      .then(data => {
        setProperties(data.properties);
        setPagination(data.pagination);
      })
      .catch(err => alert(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadProperties, [page]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`¿Eliminar "${title}"? Esta acción es irreversible.`)) return;
    try {
      await api.deleteProperty(id);
      loadProperties();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.changeStatus(id, status);
      setProperties(current => current.map(property => property.id === id ? { ...property, status } : property));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleFeatured = async (id, featured) => {
    try {
      await api.updateProperty(id, { featured: !featured });
      setProperties(current => current.map(property => property.id === id ? { ...property, featured: !featured } : property));
    } catch (err) {
      alert(err.message);
    }
  };

  const statusLabels = {
    available: 'Disponible', sold: 'Vendida', rented: 'Rentada', reserved: 'Reservada',
  };

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Propiedades</h1>
            <p className="text-gray-400 text-sm">{pagination.total} propiedades registradas</p>
          </div>
          <Link to="/admin/propiedades/nueva" className="flex items-center gap-2 px-4 py-2 bg-amber-500 text-white font-semibold rounded-lg">
            <Plus size={18} /> Nueva propiedad
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-8">Cargando...</p>
        ) : properties.length === 0 ? (
          <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/5 text-gray-400">No hay propiedades registradas.</div>
        ) : (
          <div className="overflow-x-auto bg-white/5 rounded-2xl border border-white/5">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-white/5 text-gray-400">
                  <th className="p-3 text-left font-medium">Propiedad</th>
                  <th className="p-3 text-left font-medium">Operación</th>
                  <th className="p-3 text-left font-medium">Precio</th>
                  <th className="p-3 text-left font-medium">Publicación</th>
                  <th className="p-3 text-left font-medium">Estado</th>
                  <th className="p-3 text-left font-medium">Destacada</th>
                  <th className="p-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {properties.map(property => (
                  <tr key={property.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={property.photos?.[0]?.url || '/images/placeholder.svg'} alt={property.title} className="w-10 h-10 rounded-lg object-cover" />
                        <div>
                          <p className="font-medium text-white">{property.title}</p>
                          <p className="text-xs text-gray-400">{property.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-300 capitalize">{property.operation}</td>
                    <td className="p-3 text-amber-400 font-medium">${property.price.toLocaleString('es-MX')} {property.currency}</td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded ${property.published ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                        {property.published ? 'Publicada' : 'Borrador'}
                      </span>
                    </td>
                    <td className="p-3">
                      <select value={property.status} onChange={event => handleStatusChange(property.id, event.target.value)} className="text-xs px-2 py-1 rounded bg-white/5 text-gray-300">
                        {Object.entries(statusLabels).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                      </select>
                    </td>
                    <td className="p-3">
                      <button type="button" onClick={() => handleToggleFeatured(property.id, property.featured)} className="text-amber-400" aria-label="Cambiar propiedad destacada">
                        <Star size={18} fill={property.featured ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-3 justify-end">
                        {property.published && <Link to={`/propiedades/${property.slug}`} className="text-gray-400 hover:text-white" aria-label="Ver propiedad"><Eye size={16} /></Link>}
                        <Link to={`/admin/propiedades/${property.id}/editar`} className="text-amber-400" aria-label="Editar propiedad"><Pencil size={16} /></Link>
                        <button type="button" onClick={() => handleDelete(property.id, property.title)} className="text-red-400" aria-label="Eliminar propiedad"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1} className="p-2 bg-white/5 rounded-lg disabled:opacity-30"><ChevronLeft size={18} /></button>
            <span className="text-sm text-gray-400">Página {pagination.page} de {pagination.pages}</span>
            <button type="button" onClick={() => setPage(current => Math.min(pagination.pages, current + 1))} disabled={page >= pagination.pages} className="p-2 bg-white/5 rounded-lg disabled:opacity-30"><ChevronRight size={18} /></button>
          </div>
        )}
      </div>
    </main>
  );
};

export default AdminProperties;
