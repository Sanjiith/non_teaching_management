/**
 * StatusBadge — renders color-coded status pills
 * Props: status (string), size ('sm' | 'md')
 */
const statusConfig = {
  // Attendance
  Present:      { cls: 'badge-success', icon: 'check_circle' },
  Absent:       { cls: 'badge-error',   icon: 'cancel' },
  Leave:        { cls: 'badge-info',    icon: 'flight_takeoff' },
  'On-Leave':   { cls: 'badge-info',    icon: 'flight_takeoff' },
  Holiday:      { cls: 'badge-neutral', icon: 'beach_access' },
  'Weekly Off': { cls: 'badge-neutral', icon: 'event_busy' },
  Late:         { cls: 'badge-warning', icon: 'schedule' },
  'Half-Day':   { cls: 'badge-warning', icon: 'timelapse' },
  // Leave
  Pending:    { cls: 'badge-warning', icon: 'pending' },
  Approved:   { cls: 'badge-success', icon: 'task_alt' },
  Rejected:   { cls: 'badge-error',   icon: 'block' },
  Cancelled:  { cls: 'badge-neutral', icon: 'do_not_disturb' },
  // Payroll
  Draft:      { cls: 'badge-neutral', icon: 'draft' },
  Processed:  { cls: 'badge-info',    icon: 'receipt' },
  Paid:       { cls: 'badge-success', icon: 'payments' },
  // Shift & Schedule
  Scheduled:    { cls: 'badge-info',    icon: 'event_available' },
  Completed:    { cls: 'badge-success', icon: 'task_alt' },
  'On Leave':   { cls: 'badge-warning', icon: 'flight_takeoff' },
  Conflict:     { cls: 'badge-error',   icon: 'warning' },
  // Generic
  Active:     { cls: 'badge-success', icon: 'circle' },
  Inactive:   { cls: 'badge-error',   icon: 'circle' },
};

const StatusBadge = ({ status, showIcon = true }) => {
  const config = statusConfig[status] || { cls: 'badge-neutral', icon: 'help' };

  return (
    <span className={config.cls}>
      {showIcon && (
        <span className="material-symbols-outlined text-[14px] mr-xs">{config.icon}</span>
      )}
      {status}
    </span>
  );
};

export default StatusBadge;
