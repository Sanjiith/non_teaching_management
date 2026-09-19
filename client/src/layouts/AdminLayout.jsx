import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import TopBar from '../components/common/TopBar';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../config/constants';

const pageTitles = {
  [ROUTES.ADMIN_DASHBOARD]:   'Dashboard Overview',
  [ROUTES.ADMIN_STAFF]:       'Staff Management',
  [ROUTES.ADMIN_DEPARTMENTS]: 'Department Management',
  [ROUTES.ADMIN_ATTENDANCE]:  'Attendance Management',
  [ROUTES.ADMIN_LEAVE]:       'Leave Applications',
  [ROUTES.ADMIN_PAYROLL]:     'Payroll Processing',
  [ROUTES.ADMIN_SHIFTS]:      'Shift Scheduling',
};

const navItems = [
  { label: 'Dashboard',    icon: 'dashboard',        path: ROUTES.ADMIN_DASHBOARD },
  { label: 'Staff',        icon: 'group',             path: ROUTES.ADMIN_STAFF },
  { label: 'Departments',  icon: 'account_balance',   path: ROUTES.ADMIN_DEPARTMENTS },
  { label: 'Attendance',   icon: 'calendar_month',    path: ROUTES.ADMIN_ATTENDANCE },
  { label: 'Leave',        icon: 'event_busy',        path: ROUTES.ADMIN_LEAVE },
  { label: 'Payroll',      icon: 'payments',          path: ROUTES.ADMIN_PAYROLL },
  { label: 'Shifts',       icon: 'schedule',          path: ROUTES.ADMIN_SHIFTS },
];

const AdminLayout = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitle = pageTitles[location.pathname] || 'Admin Portal';

  const bottomItems = [
    { label: 'Support', icon: 'contact_support', path: '#' },
    { label: 'Logout',  icon: 'logout', onClick: logout },
  ];

  return (
    <div className="bg-background text-on-background min-h-screen flex">
      <Sidebar navItems={navItems} bottomItems={bottomItems} />

      <div className="flex-1 flex flex-col md:ml-64 min-h-screen">
        <TopBar pageTitle={pageTitle} onMenuToggle={() => setMobileMenuOpen(!mobileMenuOpen)} />

        <main className="flex-1 overflow-y-auto mt-16 p-md lg:p-lg bg-background w-full max-w-[1440px] mx-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
};

export default AdminLayout;
