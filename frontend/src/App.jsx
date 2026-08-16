import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
import LoginPage from './pages/LoginPage';
import WelcomePage from './pages/WelcomePage';
import AdminDashboard from './pages/AdminDashboard';
import UsersPage from './pages/UsersPage';
import StudentsPage from './pages/StudentsPage';
import LockersPage from './pages/LockersPage';
import AssignmentsPage from './pages/AssignmentsPage';
import UserDashboard from './pages/UserDashboard';
import TechnicianDashboard from './pages/TechnicianDashboard';
import ChangePasswordPage from './pages/ChangePasswordPage';
import AnalyticsPage from './pages/AnalyticsPage';
import IncidentsPage from './pages/IncidentsPage';
import AuditLogPage from './pages/AuditLogPage';
import NotificationsPage from './pages/NotificationsPage';
import NotFoundPage from './pages/NotFoundPage';

function App() {
  const { user } = useAuth();

  const getDashboardElement = () => {
    if (user?.role === 'admin') return <AdminDashboard />;
    if (user?.role === 'technician') return <TechnicianDashboard />;
    return <UserDashboard />;
  };

  return (
    <Routes>
      {/* Public routes */}
      <Route path="/welcome" element={<WelcomePage />} />
      <Route path="/login" element={!user ? <LoginPage /> : <Navigate to="/dashboard" />} />

      {/* Protected routes */}
      <Route element={<ProtectedRoute />}>
        <Route element={<Layout />}>
          <Route path="/dashboard" element={getDashboardElement()} />
          <Route path="/technician-tasks" element={<ProtectedRoute requiredRole={['admin', 'technician']}><TechnicianDashboard /></ProtectedRoute>} />
          <Route path="/users" element={<ProtectedRoute requiredRole="admin"><UsersPage /></ProtectedRoute>} />
          <Route path="/students" element={<ProtectedRoute requiredRole="admin"><StudentsPage /></ProtectedRoute>} />
          <Route path="/lockers" element={<ProtectedRoute requiredRole="admin"><LockersPage /></ProtectedRoute>} />
          <Route path="/assignments" element={<ProtectedRoute requiredRole="admin"><AssignmentsPage /></ProtectedRoute>} />
          <Route path="/analytics" element={<ProtectedRoute requiredRole="admin"><AnalyticsPage /></ProtectedRoute>} />
          <Route path="/incidents" element={<ProtectedRoute requiredRole={['admin', 'technician']}><IncidentsPage /></ProtectedRoute>} />
          <Route path="/audit-logs" element={<ProtectedRoute requiredRole="admin"><AuditLogPage /></ProtectedRoute>} />
          <Route path="/notifications" element={<NotificationsPage />} />
          <Route path="/my-locker" element={<UserDashboard />} />
          <Route path="/change-password" element={<ChangePasswordPage />} />
        </Route>
      </Route>

      {/* Root: welcome for guests, dashboard for logged-in */}
      <Route path="/" element={user ? <Navigate to="/dashboard" /> : <Navigate to="/welcome" />} />
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

export default App;
