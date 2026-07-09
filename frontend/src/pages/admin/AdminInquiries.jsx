import React, { useState, useEffect } from 'react';
import { Mail, Eye, Trash2, CheckCircle } from 'lucide-react';
import api from '../../api';

const AdminInquiries = () => {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [total, setTotal] = useState(0);
  const [filter, setFilter] = useState('');

  useEffect(() => {
    setLoading(true);
    const params = { page, limit: 20 };
    if (filter === 'unread') params.unread = 'true';
    api.getInquiries(params)
      .then(data => {
        setInquiries(data.inquiries);
        setTotal(data.pagination.total);
      })
      .catch(console.error)
      .finally(() => setLoading(false));
  }, [page, filter]);

  const handleMarkRead = async (id) => {
    try {
      await api.markInquiryRead(id);
      setInquiries(prev => prev.map(i => i.id === id ? { ...i, isRead: true } : i));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('¿Eliminar esta consulta?')) return;
    try {
      await api.deleteInquiry(id);
      setInquiries(prev => prev.filter(i => i.id !== id));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMarkAllRead = async () => {
    for (const inq of inquiries.filter(i => !i.isRead)) {
      await handleMarkRead(inq.id);
    }
  };

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Consultas</h1>
            <p className="text-gray-400 text-sm">{total} consultas recibidas</p>
          </div>
          <div className="flex gap-2">
            <select
              value={filter}
              onChange={e => { setFilter(e.target.value); setPage(1); }}
              className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm focus:outline-none"
            >
              <option value="" className="bg-[#111]">Todas</option>
              <option value="unread" className="bg-[#111]">No leídas</option>
            </select>
            {inquiries.some(i => !i.isRead) && (
              <button onClick={handleMarkAllRead} className="px-3 py-2 bg-amber-400/10 text-amber-400 rounded-lg text-sm hover:bg-amber-400/20">
                Marcar todas leídas
              </button>
            )}
          </div>
        </div>

        {loading ? (
          <p className="text-gray-500 text-center py-8">Cargando...</p>
        ) : inquiries.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay consultas</p>
        ) : (
          <div className="space-y-3">
            {inquiries.map(inq => (
              <div
                key={inq.id}
                className={`p-4 rounded-2xl border transition-all ${
                  inq.isRead ? 'bg-white/3 border-white/5' : 'bg-amber-400/5 border-amber-400/10'
                }`}
              >
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      {!inq.isRead && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                      <span className="font-medium text-white text-sm">{inq.name}</span>
                      <span className="text-xs text-gray-500">{inq.email}</span>
                      {inq.phone && <span className="text-xs text-gray-500">· {inq.phone}</span>}
                    </div>
                    {inq.property && (
                      <p className="text-xs text-gray-400 mb-1">
                        Propiedad: <span className="text-amber-400">{inq.property.title}</span>
                      </p>
                    )}
                    <p className="text-sm text-gray-300 leading-relaxed">{inq.message}</p>
                    <p className="text-xs text-gray-500 mt-2">{new Date(inq.createdAt).toLocaleString('es-MX')}</p>
                  </div>
                  <div className="flex items-center gap-2">
                    {!inq.isRead && (
                      <button onClick={() => handleMarkRead(inq.id)} className="p-2 text-amber-400 hover:bg-amber-400/10 rounded-lg" title="Marcar leída">
                        <Eye size={16} />
                      </button>
                    )}
                    <button onClick={() => handleDelete(inq.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg" title="Eliminar">
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </main>
  );
};

export default AdminInquiries;
