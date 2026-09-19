import { useState } from 'react';

/**
 * NotificationButton — bell icon with badge and dropdown panel
 * Full notification logic will be implemented in a later day.
 */
const NotificationButton = () => {
  const [open, setOpen] = useState(false);

  // Placeholder notifications for UI structure
  const mockNotifications = [
    { id: 1, title: 'Leave Request', message: 'Your leave request has been submitted.', time: '2 min ago', type: 'info', isRead: false },
    { id: 2, title: 'Attendance Alert', message: 'Attendance marked for today.', time: '1 hr ago', type: 'success', isRead: true },
    { id: 3, title: 'Payroll', message: 'August payroll has been processed.', time: 'Yesterday', type: 'success', isRead: true },
  ];

  const unreadCount = mockNotifications.filter((n) => !n.isRead).length;

  const typeIcon = { info: 'info', success: 'check_circle', warning: 'warning', error: 'error' };
  const typeColor = { info: 'text-blue-600', success: 'text-emerald-600', warning: 'text-amber-600', error: 'text-red-600' };

  return (
    <div className="relative">
      <button
        onClick={() => setOpen((prev) => !prev)}
        className="p-xs hover:bg-surface-container-low rounded-full transition-colors relative cursor-pointer active:opacity-80"
        title="Notifications"
        aria-label="Notifications"
      >
        <span className="material-symbols-outlined">notifications</span>
        {unreadCount > 0 && (
          <span className="absolute top-1 right-1 w-2 h-2 bg-error rounded-full" />
        )}
      </button>

      {open && (
        <>
          {/* Backdrop */}
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />

          {/* Dropdown panel */}
          <div className="absolute right-0 top-full mt-sm w-80 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-md z-50 overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant">
              <h3 className="font-title-md text-title-md text-on-surface">Notifications</h3>
              {unreadCount > 0 && (
                <span className="badge-info">{unreadCount} new</span>
              )}
            </div>

            {/* Items */}
            <ul className="max-h-64 overflow-y-auto divide-y divide-outline-variant">
              {mockNotifications.map((n) => (
                <li
                  key={n.id}
                  className={`flex items-start gap-sm px-md py-sm hover:bg-surface-container-low transition-colors cursor-pointer ${!n.isRead ? 'bg-surface-container' : ''}`}
                >
                  <span className={`material-symbols-outlined text-xl mt-xs ${typeColor[n.type]}`}>
                    {typeIcon[n.type]}
                  </span>
                  <div className="flex-1 min-w-0">
                    <p className="font-label-md text-label-md text-on-surface">{n.title}</p>
                    <p className="font-body-sm text-body-sm text-secondary truncate">{n.message}</p>
                    <p className="font-label-sm text-label-sm text-outline mt-xs">{n.time}</p>
                  </div>
                  {!n.isRead && (
                    <div className="w-2 h-2 bg-primary rounded-full mt-sm flex-shrink-0" />
                  )}
                </li>
              ))}
            </ul>

            {/* Footer */}
            <div className="px-md py-sm border-t border-outline-variant">
              <button className="btn-ghost w-full justify-center text-center">
                View all notifications
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationButton;
