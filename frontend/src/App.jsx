import React, { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from './context/AuthContext';
import Layout from './components/Layout';
import ProtectedRoute from './components/ProtectedRoute';
const LoginPage = lazy(() => import('./pages/LoginPage'));
const WelcomePage = lazy(() => import('./pages/WelcomePage'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const UsersPage = lazy(() => import('./pages/UsersPage'));
const StudentsPage = lazy(() => import('./pages/StudentsPage'));
const LockersPage = lazy(() => import('./pages/LockersPage'));
const AssignmentsPage = lazy(() => import('./pages/AssignmentsPage'));
const UserDashboard = lazy(() => import('./pages/UserDashboard'));
const TechnicianDashboard = lazy(() => import('./pages/TechnicianDashboard'));
const ChangePasswordPage = lazy(() => import('./pages/ChangePasswordPage'));
const AnalyticsPage = lazy(() => import('./pages/AnalyticsPage'));
const IncidentsPage = lazy(() => import('./pages/IncidentsPage'));
const AuditLogPage = lazy(() => import('./pages/AuditLogPage'));
const NotificationsPage = lazy(() => import('./pages/NotificationsPage'));
const NotFoundPage = lazy(() => import('./pages/NotFoundPage'));

function App() {
  const { user } = useAuth();

  const getDashboardElement = () => {
    if (user?.role === 'admin') return <AdminDashboard />;
    if (user?.role === 'technician') return <TechnicianDashboard />;
    return <UserDashboard />;
  };

  return (
    <Suspense fallback={<div className="loading">Loading...</div>}>
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
    </Suspense>
  );
}

export default App;
