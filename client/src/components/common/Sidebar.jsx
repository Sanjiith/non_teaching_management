import { NavLink } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getInitials, getRoleLabel } from '../../utils/roleHelpers';

/**
 * Sidebar — reusable across all roles
 * Props:
 *   navItems: [{ label, icon, path }]
 *   bottomItems: [{ label, icon, path?, onClick? }]
 */
const Sidebar = ({ navItems = [], bottomItems = [] }) => {
  const { user } = useAuth();

  return (
    <aside className="fixed left-0 top-0 h-full w-64 flex flex-col z-40 bg-surface-container-lowest border-r border-outline-variant hidden md:flex">
      {/* ── Brand ─────────────────────────────────────────────────── */}
      <div className="px-md pt-lg pb-md flex items-center gap-md border-b border-outline-variant">
        <div className="w-10 h-10 rounded-lg bg-primary-container text-on-primary flex items-center justify-center font-bold text-title-md select-none">
          BIT
        </div>
        <div>
          <h1 className="font-headline-sm text-title-md text-primary leading-tight">BIT Sathy</h1>
          <p className="font-label-md text-label-md text-secondary">Staff Portal</p>
        </div>
      </div>

      {/* ── User Info ─────────────────────────────────────────────── */}
      <div className="px-md py-sm mt-sm">
        <div className="flex items-center gap-sm p-sm rounded-lg bg-surface-container">
          <div className="w-8 h-8 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center font-semibold text-sm flex-shrink-0">
            {getInitials(user?.name)}
          </div>
          <div className="min-w-0">
            <p className="font-label-md text-label-md text-on-surface truncate">{user?.name}</p>
            <p className="font-label-sm text-label-sm text-secondary truncate">{getRoleLabel(user?.role)}</p>
          </div>
        </div>
      </div>

      {/* ── Navigation ────────────────────────────────────────────── */}
      <nav className="flex-1 overflow-y-auto px-sm mt-sm">
        <ul className="flex flex-col gap-xs">
          {navItems.map((item) => (
            <li key={item.path}>
              <NavLink
                to={item.path}
                className={({ isActive }) =>
                  `sidebar-nav-item ${isActive ? 'active' : ''}`
                }
              >
                <span className="material-symbols-outlined text-xl">{item.icon}</span>
                <span className="nav-label">{item.label}</span>
                {item.badge && (
                  <span className="ml-auto badge-error text-xs px-xs py-0 rounded-full min-w-[18px] text-center">
                    {item.badge}
                  </span>
                )}
              </NavLink>
            </li>
          ))}
        </ul>
      </nav>

      {/* ── Bottom items ──────────────────────────────────────────── */}
      <div className="px-sm border-t border-outline-variant pt-sm pb-lg">
        <ul className="flex flex-col gap-xs">
          {bottomItems.map((item, idx) => (
            <li key={idx}>
              {item.onClick ? (
                <button
                  onClick={item.onClick}
                  className="sidebar-nav-item w-full text-left"
                >
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </button>
              ) : (
                <NavLink to={item.path} className="sidebar-nav-item">
                  <span className="material-symbols-outlined text-xl">{item.icon}</span>
                  <span className="nav-label">{item.label}</span>
                </NavLink>
              )}
            </li>
          ))}
        </ul>
      </div>
    </aside>
  );
};

export default Sidebar;
