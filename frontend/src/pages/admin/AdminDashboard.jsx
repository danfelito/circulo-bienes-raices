import React, { useState, useEffect } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Building2, TrendingUp, Users, Eye, Mail, Star, ArrowRight, LogOut } from 'lucide-react';
import api from '../../api';

const AdminDashboard = () => {
  const navigate = useNavigate();
  const [stats, setStats] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.getStats()
      .then(setStats)
      .catch(() => {
        localStorage.removeItem('token');
        navigate('/admin/login');
      })
      .finally(() => setLoading(false));
  }, []);

  const handleLogout = async () => {
    await api.logout();
    navigate('/admin/login');
  };

  if (loading) return <main className="pt-20 min-h-screen bg-[#0a0a0a] text-center py-16 text-gray-500">Cargando...</main>;

  const statCards = [
    { icon: Building2, label: 'Total Propiedades', value: stats?.totalProperties || 0, color: 'text-blue-400' },
    { icon: Star, label: 'Destacadas', value: stats?.featuredProperties || 0, color: 'text-amber-400' },
    { icon: TrendingUp, label: 'Disponibles', value: stats?.availableProperties || 0, color: 'text-green-400' },
    { icon: Eye, label: 'Vistas Totales', value: stats?.totalViews || 0, color: 'text-purple-400' },
    { icon: Mail, label: 'Consultas', value: stats?.totalInquiries || 0, color: 'text-cyan-400' },
    { icon: Users, label: 'No Leídas', value: stats?.unreadInquiries || 0, color: 'text-red-400' },
  ];

  return (
    <main className="pt-20 min-h-screen bg-[#0a0a0a]">
      <div className="max-w-7xl mx-auto px-4 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Dashboard</h1>
            <p className="text-gray-400 text-sm">Panel de administración</p>
          </div>
          <button onClick={handleLogout} className="flex items-center gap-2 px-4 py-2 bg-red-500/10 text-red-400 rounded-lg hover:bg-red-500/20">
            <LogOut size={16} /> Cerrar Sesión
          </button>
        </div>

        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4 mb-8">
          {statCards.map(({ icon: Icon, label, value, color }) => (
            <div key={label} className="p-4 bg-white/5 rounded-2xl border border-white/5">
              <Icon className={`${color} mb-2`} size={24} />
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-xs text-gray-400">{label}</p>
            </div>
          ))}
        </div>

        {/* Quick Actions */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <Link to="/admin/propiedades/nueva" className="flex items-center gap-3 p-4 bg-amber-400/10 border border-amber-400/20 rounded-xl text-amber-400 hover:bg-amber-400/20">
            <Building2 size={20} /> Nueva Propiedad <ArrowRight size={16} className="ml-auto" />
          </Link>
          <Link to="/admin/propiedades" className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10">
            <Building2 size={20} /> Gestionar Propiedades <ArrowRight size={16} className="ml-auto" />
          </Link>
          <Link to="/admin/consultas" className="flex items-center gap-3 p-4 bg-white/5 border border-white/10 rounded-xl text-gray-300 hover:bg-white/10">
            <Mail size={20} /> Consultas {stats?.unreadInquiries > 0 && <span className="bg-red-500 text-white text-xs px-2 py-0.5 rounded-full ml-1">{stats.unreadInquiries}</span>}
            <ArrowRight size={16} className="ml-auto" />
          </Link>
        </div>

        {/* Recent Properties */}
        <div className="mb-8">
          <h2 className="text-lg font-semibold text-white mb-4">Propiedades Recientes</h2>
          <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            {stats?.recentProperties?.map(p => (
              <div key={p.id} className="flex items-center gap-4 p-4 border-b border-white/5 last:border-0">
                <img src={p.photos?.[0]?.url || '/images/placeholder.jpg'} alt={p.title} className="w-12 h-12 rounded-lg object-cover" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{p.title}</p>
                  <p className="text-xs text-gray-400">{p.city} · {p.operation === 'venta' ? 'Venta' : 'Renta'} · ${p.price.toLocaleString()}</p>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${p.status === 'available' ? 'bg-green-500/10 text-green-400' : 'bg-gray-500/10 text-gray-400'}`}>
                  {p.status === 'available' ? 'Disponible' : p.status === 'sold' ? 'Vendida' : 'Rentada'}
                </span>
              </div>
            )) || <p className="p-4 text-gray-500 text-sm">Sin propiedades</p>}
          </div>
        </div>

        {/* Recent Inquiries */}
        <div>
          <h2 className="text-lg font-semibold text-white mb-4">Consultas Recientes</h2>
          <div className="bg-white/5 rounded-2xl border border-white/5 overflow-hidden">
            {stats?.recentInquiries?.map(inq => (
              <div key={inq.id} className="flex items-center gap-4 p-4 border-b border-white/5 last:border-0">
                <div className={`w-2 h-2 rounded-full ${inq.isRead ? 'bg-gray-500' : 'bg-amber-400'}`} />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{inq.name}</p>
                  <p className="text-xs text-gray-400 truncate">{inq.message}</p>
                </div>
                <span className="text-xs text-gray-500">{new Date(inq.createdAt).toLocaleDateString('es-MX')}</span>
              </div>
            )) || <p className="p-4 text-gray-500 text-sm">Sin consultas</p>}
          </div>
        </div>
      </div>
    </main>
  );
};

export default AdminDashboard;
