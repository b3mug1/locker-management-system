import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import AdminDashboard from './pages/AdminDashboard';
import UsersPage from './pages/UsersPage';
import StudentsPage from './pages/StudentsPage';
import LockersPage from './pages/LockersPage';
import AssignmentsPage from './pages/AssignmentsPage';
import UserDashboard from './pages/UserDashboard';
import ChangePasswordPage from './pages/ChangePasswordPage';

function App() {
  const { user } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/" />} />

      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          {/* Admin routes */}
          <Route
            path="/"
            element={
              user?.role === 'admin' ? <AdminDashboard /> : <UserDashboard />
            }
          />
          <Route path="/users" element={<ProtectedRoute requiredRole="admin"><UsersPage /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute requiredRole="admin"><StudentsPage /></ProtectedRoute>} />
          <Route path="/lockers" element={<ProtectedRoute requiredRole="admin"><LockersPage /></ProtectedRoute>} />
          <Route path="/assignments" element={<ProtectedRoute requiredRole="admin"><AssignmentsPage /></ProtectedRoute>} />
          <Route path="/my-locker" element={<UserDashboard />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Route>

      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
