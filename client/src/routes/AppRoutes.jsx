import { Routes, Route, Navigate } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import { ROLES, ROUTES } from '../config/constants';
import { getRoleDashboard } from '../utils/roleHelpers';

import ProtectedRoute from './ProtectedRoute';

// Layouts
import AuthLayout from '../layouts/AuthLayout';
import AdminLayout from '../layouts/AdminLayout';
import HODLayout from '../layouts/HODLayout';
import StaffLayout from '../layouts/StaffLayout';

// Auth pages
import LoginPage from '../pages/auth/LoginPage';

// Admin pages
import AdminDashboard from '../pages/admin/AdminDashboard';
import AdminAttendancePage from '../pages/admin/AdminAttendancePage';
import AdminLeavePage from '../pages/admin/AdminLeavePage';
import AdminShiftPage from '../pages/admin/AdminShiftPage';

// HOD pages
import HODDashboard from '../pages/hod/HODDashboard';
import HODAttendancePage from '../pages/hod/HODAttendancePage';
import HODLeavePage from '../pages/hod/HODLeavePage';
import HODSchedulePage from '../pages/hod/HODSchedulePage';

// Staff pages
import StaffDashboard from '../pages/staff/StaffDashboard';
import StaffAttendancePage from '../pages/staff/StaffAttendancePage';
import StaffLeavePage from '../pages/staff/StaffLeavePage';
import StaffSchedulePage from '../pages/staff/StaffSchedulePage';

// Placeholder for future pages
const ComingSoon = ({ title }) => (
  <div className="flex flex-col items-center justify-center h-64 gap-md">
    <span className="material-symbols-outlined text-[48px] text-outline">construction</span>
    <h2 className="font-headline-sm text-headline-sm text-secondary">{title}</h2>
    <p className="font-body-sm text-body-sm text-outline">This module will be available in a future update.</p>
  </div>
);

const AppRoutes = () => {
  const { isAuthenticated, user } = useAuth();

  return (
    <Routes>
      {/* ── Root redirect ──────────────────────────────────────────── */}
      <Route
        path="/"
        element={
          isAuthenticated && user
            ? <Navigate to={getRoleDashboard(user.role)} replace />
            : <Navigate to={ROUTES.LOGIN} replace />
        }
      />

      {/* ── Auth routes ────────────────────────────────────────────── */}
      <Route element={<AuthLayout />}>
        <Route path={ROUTES.LOGIN} element={<LoginPage />} />
      </Route>

      {/* ── Admin routes ───────────────────────────────────────────── */}
      <Route
        path="/admin"
        element={
          <ProtectedRoute allowedRoles={[ROLES.ADMIN]}>
            <AdminLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={ROUTES.ADMIN_DASHBOARD} replace />} />
        <Route path="dashboard"   element={<AdminDashboard />} />
        <Route path="staff"       element={<ComingSoon title="Staff Management" />} />
        <Route path="departments" element={<ComingSoon title="Department Management" />} />
        <Route path="attendance"  element={<AdminAttendancePage />} />
        <Route path="leave"       element={<AdminLeavePage />} />
        <Route path="payroll"     element={<ComingSoon title="Payroll Processing" />} />
        <Route path="shifts"      element={<AdminShiftPage />} />
      </Route>

      {/* ── HOD routes ─────────────────────────────────────────────── */}
      <Route
        path="/hod"
        element={
          <ProtectedRoute allowedRoles={[ROLES.HOD]}>
            <HODLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={ROUTES.HOD_DASHBOARD} replace />} />
        <Route path="dashboard"  element={<HODDashboard />} />
        <Route path="staff"      element={<ComingSoon title="Department Staff" />} />
        <Route path="attendance" element={<HODAttendancePage />} />
        <Route path="leave"      element={<HODLeavePage />} />
        <Route path="schedule"   element={<HODSchedulePage />} />
      </Route>

      {/* ── Staff routes ───────────────────────────────────────────── */}
      <Route
        path="/staff"
        element={
          <ProtectedRoute allowedRoles={[ROLES.STAFF]}>
            <StaffLayout />
          </ProtectedRoute>
        }
      >
        <Route index element={<Navigate to={ROUTES.STAFF_DASHBOARD} replace />} />
        <Route path="dashboard"  element={<StaffDashboard />} />
        <Route path="profile"    element={<ComingSoon title="My Profile" />} />
        <Route path="attendance" element={<StaffAttendancePage />} />
        <Route path="leave"      element={<StaffLeavePage />} />
        <Route path="schedule"   element={<StaffSchedulePage />} />
        <Route path="payroll"    element={<ComingSoon title="My Payroll" />} />
      </Route>

      {/* ── 404 ────────────────────────────────────────────────────── */}
      <Route
        path="*"
        element={
          <div className="min-h-screen flex flex-col items-center justify-center gap-md bg-background">
            <span className="material-symbols-outlined text-[64px] text-outline">error</span>
            <h1 className="font-headline-md text-headline-md text-on-surface">404 — Page Not Found</h1>
            <a href="/" className="btn-primary">Go to Home</a>
          </div>
        }
      />
    </Routes>
  );
};

export default AppRoutes;
