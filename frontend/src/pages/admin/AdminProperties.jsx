import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Archive, Eye, FolderUp, Pencil, Plus, Star } from 'lucide-react';
import api from '../../api';

const AdminProperties = () => {
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [search, setSearch] = useState('');

  const loadProperties = () => {
    setLoading(true);
    api.getAdminProperties({ page, limit: 20, search })
      .then((data) => {
        setProperties(data.properties);
        setTotal(data.pagination.total);
      })
      .catch((error) => alert(error.message))
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadProperties();
  }, [page]);

  const handleSearch = (event) => {
    event.preventDefault();
    setPage(1);
    loadProperties();
  };

  const handleArchive = async (id, title) => {
    if (!window.confirm(`¿Archivar "${title}"? Dejará de aparecer en el sitio público.`)) return;
    try {
      await api.deleteProperty(id);
      setProperties((current) => current.map((property) => (
        property.id === id ? { ...property, published: false, status: 'archived' } : property
      )));
    } catch (error) {
      alert(error.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.changeStatus(id, status);
      setProperties((current) => current.map((property) => (
        property.id === id ? { ...property, status } : property
      )));
    } catch (error) {
      alert(error.message);
    }
  };

  const handleToggleFeatured = async (id, featured) => {
    try {
      await api.updateProperty(id, { featured: !featured });
      setProperties((current) => current.map((property) => (
        property.id === id ? { ...property, featured: !featured } : property
      )));
    } catch (error) {
      alert(error.message);
    }
  };

  const handleTogglePublished = async (id, published) => {
    try {
      await api.changePublished(id, !published);
      setProperties((current) => current.map((property) => (
        property.id === id ? { ...property, published: !published } : property
      )));
    } catch (error) {
      alert(error.message);
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
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Propiedades</h1>
            <p className="text-gray-400 text-sm">{total} propiedades, incluyendo borradores y archivadas</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link to="/admin/importar" className="flex items-center gap-2 px-4 py-2 bg-white/10 text-white font-semibold rounded-lg hover:bg-white/15">
              <FolderUp size={18} /> Importar carpetas
            </Link>
            <Link to="/admin/propiedades/nueva" className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-lg hover:from-amber-600 hover:to-amber-700">
              <Plus size={18} /> Nueva propiedad
            </Link>
          </div>
        </div>

        <form onSubmit={handleSearch} className="flex gap-2 mb-5">
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Buscar por título, ciudad o referencia"
            className="flex-1 max-w-xl px-4 py-2.5 bg-white/5 border border-white/10 rounded-lg text-white focus:outline-none focus:border-amber-400/50"
          />
          <button type="submit" className="px-4 py-2 rounded-lg bg-white/10 text-white hover:bg-white/15">Buscar</button>
        </form>

        {loading ? (
          <p className="text-gray-500 text-center py-8">Cargando...</p>
        ) : properties.length === 0 ? (
          <div className="text-center py-12 bg-white/5 rounded-2xl border border-white/5 text-gray-400">
            No hay propiedades para mostrar.
          </div>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/5 overflow-x-auto">
            <table className="w-full min-w-[980px] text-sm">
              <thead>
                <tr className="border-b border-white/5 text-gray-400">
                  <th className="p-3 text-left font-medium">Propiedad</th>
                  <th className="p-3 text-left font-medium">Operación</th>
                  <th className="p-3 text-left font-medium">Precio</th>
                  <th className="p-3 text-left font-medium">Estado</th>
                  <th className="p-3 text-center font-medium">Publicada</th>
                  <th className="p-3 text-center font-medium">Destacada</th>
                  <th className="p-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {properties.map((property) => (
                  <tr key={property.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={property.photos?.[0]?.url || '/images/placeholder.jpg'} alt={property.title} className="w-11 h-11 rounded-lg object-cover" />
                        <div>
                          <p className="font-medium text-white">{property.title}</p>
                          <p className="text-xs text-gray-400">{property.referenceCode || 'Sin referencia'} · {property.city}</p>
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
                        className={`text-xs px-2 py-1 rounded ${statusLabels[property.status]?.color || 'bg-gray-500/10 text-gray-400'}`}
                      >
                        <option value="available">Disponible</option>
                        <option value="sold">Vendida</option>
                        <option value="rented">Rentada</option>
                        <option value="reserved">Reservada</option>
                        <option value="archived">Archivada</option>
                      </select>
                    </td>
                    <td className="p-3 text-center">
                      <button
                        onClick={() => handleTogglePublished(property.id, property.published)}
                        className={`text-xs px-2.5 py-1 rounded-full ${property.published ? 'bg-green-500/10 text-green-400' : 'bg-yellow-500/10 text-yellow-400'}`}
                      >
                        {property.published ? 'Sí' : 'Borrador'}
                      </button>
                    </td>
                    <td className="p-3 text-center">
                      <button onClick={() => handleToggleFeatured(property.id, property.featured)} className="text-amber-400 hover:text-amber-300">
                        <Star size={18} fill={property.featured ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-3 justify-end">
                        {property.published && <Link to={`/propiedades/${property.slug}`} className="text-gray-400 hover:text-white" title="Ver publicada"><Eye size={17} /></Link>}
                        <Link to={`/admin/propiedades/${property.id}/editar`} className="text-amber-400 hover:text-amber-300" title="Editar"><Pencil size={17} /></Link>
                        <button onClick={() => handleArchive(property.id, property.title)} className="text-red-400 hover:text-red-300" title="Archivar"><Archive size={17} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {total > 20 && (
          <div className="flex items-center justify-center gap-3 mt-6">
            <button disabled={page === 1} onClick={() => setPage((value) => Math.max(1, value - 1))} className="px-3 py-2 bg-white/10 rounded disabled:opacity-30">Anterior</button>
            <span className="text-sm text-gray-400">Página {page}</span>
            <button disabled={page * 20 >= total} onClick={() => setPage((value) => value + 1)} className="px-3 py-2 bg-white/10 rounded disabled:opacity-30">Siguiente</button>
          </div>
        )}
      </div>
    </main>
  );
};

export default AdminProperties;
