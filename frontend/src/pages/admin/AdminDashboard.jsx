import React, { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowRight, Building2, Eye, LogOut, Mail, Star, TrendingUp, UploadCloud, Users } from 'lucide-react';
import api from '../../api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(() => navigate('/admin/login', { replace: true }))
      .finally(() => setLoading(false));
  }, [navigate]);

  const handleLogout = async () => {
    try {
      await api.logout();
    } finally {
      navigate('/admin/login', { replace: true });
    }
  };

  if (loading) {
    return <main className="pt-20 min-h-screen bg-[#0a0a0a] text-center py-16 text-gray-500">Cargando...</main>;
  }

  const statCards = [
    { icon: Building2, label: 'Total propiedades', value: stats?.totalProperties || 0, color: 'text-blue-400' },
    { icon: Star, label: 'Destacadas', value: stats?.featuredProperties || 0, color: 'text-amber-400' },
    { icon: TrendingUp, label: 'Disponibles', value: stats?.availableProperties || 0, color: 'text-green-400' },
    { icon: Eye, label: 'Vistas totales', value: stats?.totalViews || 0, color: 'text-purple-400' },
    { icon: Mail, label: 'Consultas', value: stats?.totalInquiries || 0, color: 'text-cyan-400' },
    { icon: Users, label: 'No leídas', value: stats?.unreadInquiries || 0, color: 'text-red-400' },
  ];

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 text-sm">Panel de administración</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20">
            <LogOut size={16} /> Cerrar sesión
          </button>
        </div>

        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {statCards.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <Icon className={`${color} mb-2`} size={24} />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
          <Link to="/admin/propiedades/nueva" className="flex items-center gap-3 p-4 bg-amber-400/10 border border-amber-400/20 rounded-xl text-amber-400 hover:bg-amber-400/20">
            <Building2 size={20} /> Nueva propiedad <ArrowRight size={16} className="ml-auto" />
          </Link>
          <Link to="/admin/importar" className="flex items-center gap-3 p-4 bg-amber-400/10 border border-amber-400/20 rounded-xl text-amber-400 hover:bg-amber-400/20">
            <UploadCloud size={20} /> Importar carpetas <ArrowRight size={16} className="ml-auto" />
          </Link>
          <Link to="/admin/propiedades" className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10">
            <Building2 size={20} /> Gestionar propiedades <ArrowRight size={16} className="ml-auto" />
          </Link>
          <Link to="/admin/consultas" className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10">
            <Mail size={20} /> Consultas
            {stats?.unreadInquiries > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">{stats.unreadInquiries}</span>}
            <ArrowRight size={16} className="ml-auto" />
          </Link>
        </div>

        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Propiedades recientes</h2>
          <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            {stats?.recentProperties?.length ? stats.recentProperties.map((property) => (
              <div key={property.id} className="flex items-center gap-4 p-4 border-b border-white/5 last:border-0">
                <img src={property.photos?.[0]?.url || '/images/placeholder.jpg'} alt={property.title} className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{property.title}</p>
                  <p className="text-xs text-gray-400">{property.city} · {property.operation === 'venta' ? 'Venta' : 'Renta'} · ${property.price.toLocaleString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${property.status === 'available' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                  {property.status === 'available' ? 'Disponible' : property.status === 'sold' ? 'Vendida' : property.status === 'archived' ? 'Archivada' : 'Rentada'}
                </span>
              </div>
            )) : <p className="p-4 text-gray-500 text-sm">Sin propiedades</p>}
          </div>
        </div>

        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Consultas recientes</h2>
          <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            {stats?.recentInquiries?.length ? stats.recentInquiries.map((inquiry) => (
              <div key={inquiry.id} className="flex items-center gap-4 p-4 border-b border-white/5 last:border-0">
                <div className={`w-2 h-2 rounded-full ${inquiry.isRead ? 'bg-gray-500' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{inquiry.name}</p>
                  <p className="text-xs text-gray-400 truncate">{inquiry.message}</p>
                </div>
                <span className="text-xs text-gray-500">{new Date(inquiry.createdAt).toLocaleDateString('es-MX')}</span>
              </div>
            )) : <p className="p-4 text-gray-500 text-sm">Sin consultas</p>}
          </div>
        </div>
      </div>
    </main>
  );
};

export default AdminDashboard;
