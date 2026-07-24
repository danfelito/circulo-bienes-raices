import React from 'react';
import { BrowserRouter, Routes, Route, useLocation } from 'react-router-dom';
import Navbar from './components/Navbar';
import Footer from './components/Footer';
import Hero from './components/Hero';
import StartSection from './components/StartSection';
import FeaturesChess from './components/FeaturesChess';
import FeaturesGrid from './components/FeaturesGrid';
import Stats from './components/Stats';
import Testimonials from './components/Testimonials';
import CtaFooter from './components/CtaFooter';
import PropertiesPage from './pages/PropertiesPage';
import PropertyDetailPage from './pages/PropertyDetailPage';
import AdminLogin from './pages/admin/AdminLogin';
import AdminDashboard from './pages/admin/AdminDashboard';
import AdminProperties from './pages/admin/AdminProperties';
import AdminPropertyForm from './pages/admin/AdminPropertyForm';
import AdminInquiries from './pages/admin/AdminInquiries';
import ProtectedRoute from './components/admin/ProtectedRoute';
import { ThemeProvider } from './theme/ThemeContext';

const Home = () => (
  <main className="theme-page min-h-screen">
    <Hero />
    <StartSection />
    <FeaturesChess />
    <FeaturesGrid />
    <Stats />
    <Testimonials />
    <CtaFooter />
  </main>
);

const AppLayout = () => {
  const location = useLocation();
  const hasIntegratedFooter = location.pathname === '/';

  return (
    <div className="theme-app min-h-screen">
      <Navbar />
      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/propiedades" element={<PropertiesPage />} />
        <Route path="/propiedades/:slug" element={<PropertyDetailPage />} />
        <Route path="/admin/login" element={<AdminLogin />} />
        <Route path="/admin" element={<ProtectedRoute><AdminDashboard /></ProtectedRoute>} />
        <Route path="/admin/propiedades" element={<ProtectedRoute><AdminProperties /></ProtectedRoute>} />
        <Route path="/admin/propiedades/nueva" element={<ProtectedRoute><AdminPropertyForm /></ProtectedRoute>} />
        <Route path="/admin/propiedades/:id/editar" element={<ProtectedRoute><AdminPropertyForm /></ProtectedRoute>} />
        <Route path="/admin/consultas" element={<ProtectedRoute><AdminInquiries /></ProtectedRoute>} />
      </Routes>
      {!hasIntegratedFooter && <Footer />}
    </div>
  );
};

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <AppLayout />
      </BrowserRouter>
    </ThemeProvider>
  );
}

export default App;
