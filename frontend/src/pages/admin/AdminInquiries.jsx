import React, { useEffect, useState } from 'react';
import { ChevronLeft, ChevronRight, Eye, Mail, Phone, Trash2 } from 'lucide-react';
import api from '../../api';

const AdminInquiries = () => {
  const [inquiries, setInquiries] = useState([]);
  const [loading, setLoading] = useState(true);
  const [page, setPage] = useState(1);
  const [pagination, setPagination] = useState({ page: 1, pages: 1, total: 0 });
  const [filter, setFilter] = useState('');
  const [error, setError] = useState('');

  const loadInquiries = () => {
    setLoading(true);
    setError('');
    const params = { page, limit: 20 };
    if (filter === 'unread') params.unread = 'true';

    api.getInquiries(params)
      .then(data => {
        setInquiries(data.inquiries || []);
        setPagination(data.pagination || { page: 1, pages: 1, total: 0 });
      })
      .catch(err => setError(err.message))
      .finally(() => setLoading(false));
  };

  useEffect(loadInquiries, [page, filter]);

  const handleMarkRead = async id => {
    try {
      await api.markInquiryRead(id);
      setInquiries(current => current.map(inquiry => inquiry.id === id ? { ...inquiry, isRead: true } : inquiry));
    } catch (err) {
      alert(err.message);
    }
  };

  const handleDelete = async id => {
    if (!window.confirm('¿Eliminar esta consulta?')) return;
    try {
      await api.deleteInquiry(id);
      const remaining = inquiries.filter(inquiry => inquiry.id !== id);
      if (!remaining.length && page > 1) setPage(current => current - 1);
      else {
        setInquiries(remaining);
        setPagination(current => ({ ...current, total: Math.max(0, current.total - 1) }));
      }
    } catch (err) {
      alert(err.message);
    }
  };

  const handleMarkAllRead = async () => {
    const unread = inquiries.filter(inquiry => !inquiry.isRead);
    try {
      await Promise.all(unread.map(inquiry => api.markInquiryRead(inquiry.id)));
      setInquiries(current => current.map(inquiry => ({ ...inquiry, isRead: true })));
    } catch (err) {
      alert(err.message);
      loadInquiries();
    }
  };

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-5xl mx-auto px-4 py-8">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white">Consultas</h1>
            <p className="text-gray-400 text-sm">{pagination.total} consultas recibidas</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <select value={filter} onChange={event => { setFilter(event.target.value); setPage(1); }} className="px-3 py-2 bg-white/5 border border-white/10 rounded-lg text-white text-sm">
              <option value="">Todas</option>
              <option value="unread">No leídas</option>
            </select>
            {inquiries.some(inquiry => !inquiry.isRead) && <button type="button" onClick={handleMarkAllRead} className="px-3 py-2 bg-amber-400/10 text-amber-400 rounded-lg text-sm">Marcar página como leída</button>}
          </div>
        </div>

        {error ? (
          <div className="text-center py-8"><p className="text-red-400 mb-4">{error}</p><button type="button" onClick={loadInquiries} className="px-4 py-2 bg-white/5 rounded-lg">Reintentar</button></div>
        ) : loading ? (
          <p className="text-gray-500 text-center py-8">Cargando...</p>
        ) : inquiries.length === 0 ? (
          <p className="text-gray-500 text-center py-8">No hay consultas</p>
        ) : (
          <div className="space-y-3">
            {inquiries.map(inquiry => (
              <article key={inquiry.id} className={`p-4 rounded-2xl border ${inquiry.isRead ? 'bg-white/3 border-white/5' : 'bg-amber-400/5 border-amber-400/10'}`}>
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex flex-wrap items-center gap-2 mb-1">
                      {!inquiry.isRead && <span className="w-2 h-2 rounded-full bg-amber-400" />}
                      <span className="font-medium text-white text-sm">{inquiry.name}</span>
                      <a href={`mailto:${inquiry.email}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-amber-400"><Mail size={12} /> {inquiry.email}</a>
                      {inquiry.phone && <a href={`tel:${inquiry.phone.replace(/[^+\d]/g, '')}`} className="inline-flex items-center gap-1 text-xs text-gray-500 hover:text-amber-400"><Phone size={12} /> {inquiry.phone}</a>}
                    </div>
                    {inquiry.property && <p className="text-xs text-gray-400 mb-1">Propiedad: <span className="text-amber-400">{inquiry.property.title}</span></p>}
                    <p className="text-sm text-gray-300 leading-relaxed whitespace-pre-wrap break-words">{inquiry.message}</p>
                    <p className="text-xs text-gray-500 mt-2">{new Date(inquiry.createdAt).toLocaleString('es-MX')}</p>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    {!inquiry.isRead && <button type="button" onClick={() => handleMarkRead(inquiry.id)} className="p-2 text-amber-400 hover:bg-amber-400/10 rounded-lg" aria-label="Marcar como leída"><Eye size={16} /></button>}
                    <button type="button" onClick={() => handleDelete(inquiry.id)} className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg" aria-label="Eliminar consulta"><Trash2 size={16} /></button>
                  </div>
                </div>
              </article>
            ))}
          </div>
        )}

        {pagination.pages > 1 && (
          <nav className="flex items-center justify-center gap-3 mt-6" aria-label="Paginación de consultas">
            <button type="button" onClick={() => setPage(current => Math.max(1, current - 1))} disabled={page <= 1} className="p-2 bg-white/5 rounded-lg disabled:opacity-30"><ChevronLeft size={18} /></button>
            <span className="text-sm text-gray-400">Página {pagination.page} de {pagination.pages}</span>
            <button type="button" onClick={() => setPage(current => Math.min(pagination.pages, current + 1))} disabled={page >= pagination.pages} className="p-2 bg-white/5 rounded-lg disabled:opacity-30"><ChevronRight size={18} /></button>
          </nav>
        )}
      </div>
    </main>
  );
};

export default AdminInquiries;
