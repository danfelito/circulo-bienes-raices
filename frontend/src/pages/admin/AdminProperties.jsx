import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Plus, Pencil, Trash2, Star, Eye, ToggleLeft } from 'lucide-react';
import api from '../../api';

const AdminProperties = () => {
  const navigate = useNavigate();
  const [properties, setProperties] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);

  useEffect(() => {
    setLoading(true);
    api.getProperties({ page, limit: 20 })
      .then(data => {
        setProperties(data.properties);
        setTotal(data.pagination.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page]);

  const handleDelete = async (id, title) => {
    if (!window.confirm(`¿Eliminar "${title}"? Esta acción es irreversible.`)) return;
    try {
      await api.deleteProperty(id);
      setProperties(prev => prev.filter(p => p.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleStatusChange = async (id, status) => {
    try {
      await api.changeStatus(id, status);
      setProperties(prev => prev.map(p => p.id === id ? { ...p, status } : p));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleToggleFeatured = async (id, featured) => {
    try {
      await api.updateProperty(id, { featured: !featured });
      setProperties(prev => prev.map(p => p.id === id ? { ...p, featured: !featured } : p));
    } catch (err) {
      alert(err.message);
    }
  };

  const statusLabels = {
    available: { label: 'Disponible', color: 'bg-green-500/10 text-green-400' },
    sold: { label: 'Vendida', color: 'bg-red-500/10 text-red-400' },
    rented: { label: 'Rentada', color: 'bg-blue-500/10 text-blue-400' },
    reserved: { label: 'Reservada', color: 'bg-yellow-500/10 text-yellow-400' },
  };

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Propiedades</h1>
            <p className="text-gray-400 text-sm">{total} propiedades</p>
          </div>
          <Link
            to="/admin/propiedades/nueva"
            className="flex items-center gap-2 px-4 py-2 bg-gradient-to-r from-amber-500 to-amber-600 text-black font-semibold rounded-lg hover:from-amber-600 hover:to-amber-700"
          >
            <Plus size={18} /> Nueva Propiedad
          </Link>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-8">Cargando...</p>
        ) : (
          <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-white/5 text-gray-400">
                  <th className="p-3 text-left font-medium">Propiedad</th>
                  <th className="p-3 text-left font-medium">Operación</th>
                  <th className="p-3 text-left font-medium">Precio</th>
                  <th className="p-3 text-left font-medium">Estado</th>
                  <th className="p-3 text-left font-medium">Destacada</th>
                  <th className="p-3 text-right font-medium">Acciones</th>
                </tr>
              </thead>
              <tbody>
                {properties.map(p => (
                  <tr key={p.id} className="border-b border-white/5 hover:bg-white/5">
                    <td className="p-3">
                      <div className="flex items-center gap-3">
                        <img src={p.photos?.[0]?.url || '/images/placeholder.jpg'} alt={p.title} className="w-10 h-10 rounded-lg object-cover" />
                        <div>
                          <p className="font-medium text-white">{p.title}</p>
                          <p className="text-xs text-gray-400">{p.city}</p>
                        </div>
                      </div>
                    </td>
                    <td className="p-3 text-gray-300 capitalize">{p.operation}</td>
                    <td className="p-3 text-amber-400 font-medium">${p.price.toLocaleString()}</td>
                    <td className="p-3">
                      <select
                        value={p.status}
                        onChange={e => handleStatusChange(p.id, e.target.value)}
                        className={`text-xs px-2 py-1 rounded ${statusLabels[p.status]?.color || 'bg-gray-500/10 text-gray-400'}`}
                      >
                        <option value="available">Disponible</option>
                        <option value="sold">Vendida</option>
                        <option value="rented">Rentada</option>
                        <option value="reserved">Reservada</option>
                      </select>
                    </td>
                    <td className="p-3">
                      <button onClick={() => handleToggleFeatured(p.id, p.featured)} className="text-amber-400 hover:text-amber-300">
                        <Star size={18} fill={p.featured ? 'currentColor' : 'none'} />
                      </button>
                    </td>
                    <td className="p-3 text-right">
                      <div className="flex items-center gap-2 justify-end">
                        <Link to={`/propiedades/${p.slug}`} className="text-gray-400 hover:text-white"><Eye size={16} /></Link>
                        <Link to={`/admin/propiedades/${p.id}/editar`} className="text-amber-400 hover:text-amber-300"><Pencil size={16} /></Link>
                        <button onClick={() => handleDelete(p.id, p.title)} className="text-red-400 hover:text-red-300"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </main>
  );
};

export default AdminProperties;
