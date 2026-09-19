import { useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import Sidebar from '../components/common/Sidebar';
import TopBar from '../components/common/TopBar';
import { useAuth } from '../context/AuthContext';
import { ROUTES } from '../config/constants';

const pageTitles = {
  [ROUTES.HOD_DASHBOARD]:  'Department Dashboard',
  [ROUTES.HOD_STAFF]:      'Department Staff',
  [ROUTES.HOD_ATTENDANCE]: 'Staff Attendance',
  [ROUTES.HOD_LEAVE]:      'Leave Approvals',
  [ROUTES.HOD_SCHEDULE]:   'Staff Schedules',
};

const navItems = [
  { label: 'Dashboard',   icon: 'dashboard',      path: ROUTES.HOD_DASHBOARD },
  { label: 'My Staff',    icon: 'group',           path: ROUTES.HOD_STAFF },
  { label: 'Attendance',  icon: 'calendar_month',  path: ROUTES.HOD_ATTENDANCE },
  { label: 'Leave',       icon: 'event_busy',      path: ROUTES.HOD_LEAVE },
  { label: 'Schedules',   icon: 'schedule',        path: ROUTES.HOD_SCHEDULE },
];

const HODLayout = () => {
  const { logout } = useAuth();
  const location = useLocation();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  const pageTitle = pageTitles[location.pathname] || 'HOD Portal';

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

export default HODLayout;
