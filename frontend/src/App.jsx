import React from 'react';
import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import HomePage from './pages/HomePage';
import PropertiesPage from './pages/PropertiesPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProperties from './pages/admin/AdminProperties';
import AdminPropertyForm from './pages/admin/AdminPropertyForm';
import AdminInquiries from './pages/admin/AdminInquiries';
import AdminImport from './pages/admin/AdminImport';
import ProtectedRoute from './components/admin/ProtectedRoute';

function App() {
  return (
    <BrowserRouter>
      <div className="min-h-screen bg-[#0a0a0a] text-white">
        <Navbar />
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/propiedades" element={<PropertiesPage />} />
          <Route path="/propiedades/:slug" element={<PropertyDetailPage />} />
          <Route path="/admin/login" element={<AdminLogin />} />
          <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
          <Route path="/admin/propiedades" element={<ProtectedRoute><AdminProperties /></ProtectedRoute>} />
          <Route path="/admin/propiedades/nueva" element={<ProtectedRoute><AdminPropertyForm /></ProtectedRoute>} />
          <Route path="/admin/propiedades/:id/editar" element={<ProtectedRoute><AdminPropertyForm /></ProtectedRoute>} />
          <Route path="/admin/importar" element={<ProtectedRoute><AdminImport /></ProtectedRoute>} />
          <Route path="/admin/consultas" element={<ProtectedRoute><AdminInquiries /></ProtectedRoute>} />
        </Routes>
        <Footer />
      </div>
    </BrowserRouter>
  );
}

export default App;
