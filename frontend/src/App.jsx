import React from 'react';
import { BrowserRouter, Route, Routes } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import PropertiesPage from './pages/PropertiesPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import AdvisorsPage from './pages/AdvisorsPage';
import AdvisorDashboard from './pages/AdvisorDashboard';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProperties from './pages/admin/AdminProperties';
import AdminPropertyForm from './pages/admin/AdminPropertyForm';
import AdminInquiries from './pages/admin/AdminInquiries';
import ProtectedRoute from './components/admin/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-white text-slate-950">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/propiedades" element={<PropertiesPage />} />
          <Route path="/propiedades/:slug" element={<PropertyDetailPage />} />
          <Route path="/asesores" element={<AdvisorsPage />} />
          <Route path="/asesores/panel" element={<AdvisorDashboard />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/propiedades" element={<ProtectedRoute><AdminProperties /></ProtectedRoute>} />
          <Route path="/admin/propiedades/nueva" element={<ProtectedRoute><AdminPropertyForm /></ProtectedRoute>} />
          <Route path="/admin/propiedades/:id/editar" element={<ProtectedRoute><AdminPropertyForm /></ProtectedRoute>} />
          <Route path="/admin/consultas" element={<ProtectedRoute><AdminInquiries /></ProtectedRoute>} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
