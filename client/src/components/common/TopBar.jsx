import { useState } from 'react';
import { useAuth } from '../../context/AuthContext';
import { getInitials } from '../../utils/roleHelpers';
import NotificationButton from './NotificationButton';

/**
 * TopBar — fixed header for all authenticated layouts
 * Props:
 *   pageTitle: string
 *   onMenuToggle: function (mobile hamburger)
 */
const TopBar = ({ pageTitle = 'Dashboard', onMenuToggle }) => {
  const { user } = useAuth();
  const [searchValue, setSearchValue] = useState('');

  return (
    <header className="fixed top-0 left-0 w-full z-50 flex items-center justify-between px-lg h-16 bg-surface-container-lowest border-b border-outline-variant md:pl-[280px] md:pr-lg">

      {/* ── Mobile: hamburger + brand ──────────────────────────────── */}
      <div className="flex items-center gap-md md:hidden">
        <button
          onClick={onMenuToggle}
          className="p-xs hover:bg-surface-container-low rounded transition-colors text-secondary"
          aria-label="Toggle menu"
        >
          <span className="material-symbols-outlined">menu</span>
        </button>
        <span className="font-headline-sm text-title-md font-bold text-primary">BIT Portal</span>
      </div>

      {/* ── Desktop: page title ────────────────────────────────────── */}
      <div className="hidden md:block">
        <h2 className="font-headline-md text-headline-md text-on-surface">{pageTitle}</h2>
      </div>

      {/* ── Right actions ─────────────────────────────────────────── */}
      <div className="flex items-center gap-lg ml-auto">

        {/* Search (desktop) */}
        <div className="relative hidden sm:block">
          <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline text-xl">search</span>
          <input
            type="text"
            value={searchValue}
            onChange={(e) => setSearchValue(e.target.value)}
            placeholder="Search staff, depts..."
            className="pl-9 pr-sm py-sm border border-outline-variant rounded bg-surface-container-lowest focus:border-primary-container focus:ring-1 focus:ring-primary-container/10 text-body-sm font-body-sm w-56 outline-none transition-all"
          />
        </div>

        <div className="flex items-center gap-sm text-secondary">
          {/* Notification bell */}
          <NotificationButton />

          {/* Settings */}
          <button
            className="p-xs hover:bg-surface-container-low rounded-full transition-colors cursor-pointer active:opacity-80"
            title="Settings"
          >
            <span className="material-symbols-outlined">settings</span>
          </button>
        </div>

        {/* Profile avatar */}
        <div className="w-8 h-8 rounded-full border border-outline-variant bg-primary-container text-on-primary-container flex items-center justify-center font-semibold text-sm cursor-pointer select-none">
          {getInitials(user?.name)}
        </div>
      </div>
    </header>
  );
};

export default TopBar;
