import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import TopBar from '../components/common/TopBar';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../config/constants';

const pageTitles = {
  [ROUTES.STAFF_DASHBOARD]:  'My Portal',
  [ROUTES.STAFF_PROFILE]:    'My Profile',
  [ROUTES.STAFF_ATTENDANCE]: 'My Attendance',
  [ROUTES.STAFF_LEAVE]:      'My Leave',
  [ROUTES.STAFF_SCHEDULE]:   'My Schedule',
  [ROUTES.STAFF_PAYROLL]:    'My Payroll',
};

const navItems = [
  { label: 'My Portal',    icon: 'dashboard',       path: ROUTES.STAFF_DASHBOARD },
  { label: 'My Leave',     icon: 'event_busy',      path: ROUTES.STAFF_LEAVE },
  { label: 'My Schedule',  icon: 'schedule',        path: ROUTES.STAFF_SCHEDULE },
  { label: 'My Payroll',   icon: 'payments',        path: ROUTES.STAFF_PAYROLL },
];

const StaffLayout = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitle = pageTitles[location.pathname] || 'My Portal';

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

export default StaffLayout;
