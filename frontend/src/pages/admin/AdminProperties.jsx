import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Plus, Pencil, Archive, Star, Eye, Upload } from 'lucide-react';
import api from '../../api';

const AdminProperties = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ total: 0, pages: 1 });

  const loadProperties = () => {
    setLoading(true);
    setError('');
    api.getAdminProperties({ page, limit: 20 })
      .then((data) => {
        setProperties(data.properties);
        setPagination(data.pagination);
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadProperties, [page]);

  const handleArchive = async (id, title) => {
    if (!window.confirm(`¿Archivar "${title}"? La propiedad dejará de mostrarse públicamente, pero conservará sus datos.`)) return;
    try {
      await api.deleteProperty(id);
      loadProperties();
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      const updated = await api.changeStatus(id, status);
      setProperties((current) => current.map((property) => (
        property.id === id ? { ...property, ...updated } : property
      )));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleFeatured = async (id, featured) => {
    try {
      const updated = await api.updateProperty(id, { featured: !featured });
      setProperties((current) => current.map((property) => (
        property.id === id ? { ...property, featured: updated.featured } : property
      )));
    } catch (err) {
      alert(err.message);
    }
  };

  const statusLabels = {
    available: { label: 'Disponible', color: 'bg-green-500/10 text-green-400' },
    sold: { label: 'Vendida', color: 'bg-red-500/10 text-red-400' },
    rented: { label: 'Rentada', color: 'bg-blue-500/10 text-blue-400' },
    reserved: { label: 'Reservada', color: 'bg-yellow-500/10 text-yellow-400' },
    archived: { label: 'Archivada', color: 'bg-gray-500/10 text-gray-400' },
  };

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Propiedades</h1>
            <p className="text-gray-400 text-sm">{pagination.total} propiedades, incluyendo borradores y archivadas</p>
          </div>
          <div className="flex flex-wrap gap-3">
            <Link
              to="/admin/importar"
              className="flex items-center gap-2 px-4 py-2 bg-white/5 border border-white/10 text-gray-200 font-semibold rounded-lg hover:bg-white/10"
            >
              <Upload size={18} /> Importar carpetas
            </Link>
            <Link
              to="/admin/propiedades/nueva"
              className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-lg hover:from-amber-600 hover:to-amber-700"
            >
              <Plus size={18} /> Nueva propiedad
            </Link>
          </div>
        </div>

        {error && (
          <div className="mb-4 p-4 rounded-xl border border-red-500/20 bg-red-500/10 text-red-300">
            {error}
          </div>
        )}

        {loading ? (
          <p className="text-gray-500 text-center py-8">Cargando...</p>
        ) : properties.length === 0 ? (
          <div className="text-center py-14 bg-white/5 rounded-2xl border border-white/5 text-gray-400">
            No hay propiedades registradas.
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-white/5 text-gray-400">
                  <th className="p-3 text-left font-medium">Propiedad</th>
                  <th className="p-3 text-left font-medium">Operación</th>
                  <th className="p-3 text-left font-medium">Precio</th>
                  <th className="p-3 text-left font-medium">Estado</th>
                  <th className="p-3 text-left font-medium">Publicación</th>
                  <th className="p-3 text-left font-medium">Destacada</th>
                  <th className="p-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img
                          src={property.photos?.find((photo) => photo.isMain)?.url || property.photos?.[0]?.url || '/images/placeholder.jpg'}
                          alt={property.title}
                          className="w-10 h-10 rounded-lg object-cover"
                        />
                        <div>
                          <p className="font-medium text-white">{property.title}</p>
                          <p className="text-xs text-gray-400">
                            {property.referenceCode ? `${property.referenceCode} · ` : ''}{property.city}
                          </p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-300 capitalize">{property.operation}</td>
                    <td className="p-3 text-amber-400 font-medium">
                      {new Intl.NumberFormat('es-MX', { style: 'currency', currency: property.currency || 'MXN', maximumFractionDigits: 0 }).format(property.price)}
                    </td>
                    <td className="p-3">
                      <select
                        value={property.status}
                        onChange={(event) => handleStatusChange(property.id, event.target.value)}
                        className={`text-xs px-2 py-1 rounded bg-[#151515] ${statusLabels[property.status]?.color || 'text-gray-400'}`}
                      >
                        <option value="available">Disponible</option>
                        <option value="sold">Vendida</option>
                        <option value="rented">Rentada</option>
                        <option value="reserved">Reservada</option>
                        <option value="archived">Archivada</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <span className={`text-xs px-2 py-1 rounded ${property.published ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                        {property.published ? 'Publicada' : 'Oculta'}
                      </span>
                    </td>
                    <td className="p-3">
                      <button onClick={() => handleToggleFeatured(property.id, property.featured)} className="text-amber-400 hover:text-amber-300">
                        <Star size={18} fill={property.featured ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        {property.published && property.status !== 'archived' && (
                          <Link to={`/propiedades/${property.slug}`} className="text-gray-400 hover:text-white" title="Ver publicación"><Eye size={16} /></Link>
                        )}
                        <Link to={`/admin/propiedades/${property.id}/editar`} className="text-amber-400 hover:text-amber-300" title="Editar"><Pencil size={16} /></Link>
                        <button onClick={() => handleArchive(property.id, property.title)} className="text-red-400 hover:text-red-300" title="Archivar"><Archive size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {pagination.pages > 1 && (
          <div className="flex justify-center items-center gap-3 mt-6">
            <button disabled={page === 1} onClick={() => setPage((value) => value - 1)} className="px-4 py-2 rounded-lg bg-white/5 disabled:opacity-40">Anterior</button>
            <span className="text-sm text-gray-400">Página {page} de {pagination.pages}</span>
            <button disabled={page >= pagination.pages} onClick={() => setPage((value) => value + 1)} className="px-4 py-2 rounded-lg bg-white/5 disabled:opacity-40">Siguiente</button>
          </div>
        )}
      </div>
    </main>
  );
};

export default AdminProperties;
