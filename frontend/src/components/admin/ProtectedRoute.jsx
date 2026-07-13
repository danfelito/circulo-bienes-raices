import React, { useEffect, useState } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import api from '../../api';

const ProtectedRoute = ({ children }) => {
  const location = useLocation();
  const [state, setState] = useState('loading');

  useEffect(() => {
    let active = true;
    api.getMe()
      .then(() => {
        if (active) setState('authenticated');
      })
      .catch(() => {
        if (active) setState('unauthenticated');
      });

    return () => {
      active = false;
    };
  }, []);

  if (state === 'loading') {
    return (
      <main className="pt-20 min-h-screen bg-[#0a0a0a] flex items-center justify-center text-gray-400">
        Verificando sesión...
      </main>
    );
  }

  if (state === 'unauthenticated') {
    return <Navigate to="/admin/login" state={{ from: location }} replace />;
  }

  return children;
};

export default ProtectedRoute;
