import { useState, useEffect } from 'react';
import notificationService from '../../services/notification.service';
import { formatDistanceToNow } from 'date-fns';

const NotificationButton = () => {
  const [open, setOpen] = useState(false);
  const [notifications, setNotifications] = useState([]);
  const [unreadCount, setUnreadCount] = useState(0);

  const fetchNotifications = async () => {
    try {
      const res = await notificationService.getMyNotifications(1, 10);
      if (res.success) {
        setNotifications(res.data.notifications);
        setUnreadCount(res.data.unreadCount);
      }
    } catch (error) {
      console.error('Error fetching notifications', error);
    }
  };

  useEffect(() => {
    fetchNotifications();
    const interval = setInterval(fetchNotifications, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handleMarkAsRead = async (id, currentReadStatus) => {
    if (currentReadStatus) return;
    try {
      await notificationService.markAsRead(id);
      setNotifications((prev) =>
        prev.map((n) => (n._id === id ? { ...n, isRead: true } : n))
      );
      setUnreadCount((prev) => Math.max(0, prev - 1));
    } catch (error) {
      console.error('Error marking as read', error);
    }
  };

  const handleMarkAllRead = async () => {
    try {
      await notificationService.markAllAsRead();
      setNotifications((prev) => prev.map((n) => ({ ...n, isRead: true })));
      setUnreadCount(0);
    } catch (error) {
      console.error('Error marking all as read', error);
    }
  };

  const typeIcon = { info: 'info', success: 'check_circle', warning: 'warning', error: 'error' };
  const typeColor = { info: 'text-blue-600', success: 'text-emerald-600', warning: 'text-amber-600', error: 'text-red-600' };

  return (
    <div className="relative">
      <button
        onClick={() => {
          setOpen((prev) => !prev);
          if (!open) fetchNotifications();
        }}
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
          <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
          <div className="absolute right-0 top-full mt-sm w-80 bg-surface-container-lowest border border-outline-variant rounded-lg shadow-md z-50 overflow-hidden">
            <div className="flex items-center justify-between px-md py-sm border-b border-outline-variant">
              <h3 className="font-title-md text-title-md text-on-surface">Notifications</h3>
              {unreadCount > 0 && (
                <button
                  onClick={handleMarkAllRead}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Mark all read
                </button>
              )}
            </div>

            <ul className="max-h-80 overflow-y-auto divide-y divide-outline-variant">
              {notifications.length === 0 ? (
                <li className="px-md py-lg text-center text-secondary font-body-sm">
                  No notifications yet.
                </li>
              ) : (
                notifications.map((n) => (
                  <li
                    key={n._id}
                    onClick={() => handleMarkAsRead(n._id, n.isRead)}
                    className={`flex items-start gap-sm px-md py-sm hover:bg-surface-container-low transition-colors cursor-pointer ${
                      !n.isRead ? 'bg-surface-container' : ''
                    }`}
                  >
                    <span className={`material-symbols-outlined text-xl mt-xs ${typeColor[n.type] || typeColor.info}`}>
                      {typeIcon[n.type] || typeIcon.info}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className={`font-label-md text-label-md ${!n.isRead ? 'text-on-surface font-semibold' : 'text-on-surface'}`}>
                        {n.title}
                      </p>
                      <p className="font-body-sm text-body-sm text-secondary line-clamp-2">
                        {n.message}
                      </p>
                      <p className="font-label-sm text-label-sm text-outline mt-xs">
                        {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true })}
                      </p>
                    </div>
                    {!n.isRead && (
                      <div className="w-2 h-2 bg-primary rounded-full mt-sm flex-shrink-0" />
                    )}
                  </li>
                ))
              )}
            </ul>
          </div>
        </>
      )}
    </div>
  );
};

export default NotificationButton;
