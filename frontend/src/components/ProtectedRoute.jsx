import React from 'react';
import { Navigate, Outlet } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';

function ProtectedRoute({ children, requiredRole }) {
  const { user } = useAuth();

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  if (requiredRole) {
    if (Array.isArray(requiredRole) && !requiredRole.includes(user.role)) {
      return <Navigate to="/" replace />;
    }
    if (typeof requiredRole === 'string' && user.role !== requiredRole) {
      return <Navigate to="/" replace />;
    }
  }

  return children ? children : <Outlet />;
}

export default ProtectedRoute;
