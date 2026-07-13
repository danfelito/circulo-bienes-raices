import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import api from '../../api';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [status, setStatus] = useState('loading');

  useEffect(() => {
    let active = true;
    api.getMe()
      .then(() => {
        if (active) setStatus('authenticated');
      })
      .catch(() => {
        if (active) setStatus('unauthenticated');
      });

    return () => {
      active = false;
    };
  }, []);

  if (status === 'loading') {
    return (
      <main className="min-h-screen pt-24 bg-[#0a0a0a] text-gray-400 flex items-center justify-center">
        Verificando sesión...
      </main>
    );
  }

  if (status === 'unauthenticated') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
