import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import { getRoleLabel } from '../../utils/roleHelpers';

const InfoRow = ({ label, value }) => (
  <div className="flex flex-col sm:flex-row sm:items-center py-sm border-b border-outline-variant last:border-0">
    <span className="font-label-md text-label-md text-secondary uppercase w-40 flex-shrink-0">{label}</span>
    <span className="font-body-md text-body-md text-on-surface mt-xs sm:mt-0">{value || '—'}</span>
  </div>
);

const attendanceThisMonth = [
  { date: 'Sep 19', day: 'Fri', status: 'Present' },
  { date: 'Sep 18', day: 'Thu', status: 'Present' },
  { date: 'Sep 17', day: 'Wed', status: 'Present' },
  { date: 'Sep 16', day: 'Tue', status: 'Absent' },
  { date: 'Sep 15', day: 'Mon', status: 'Present' },
  { date: 'Sep 12', day: 'Fri', status: 'Present' },
  { date: 'Sep 11', day: 'Thu', status: 'On-Leave' },
];

const recentLeaves = [
  { type: 'Casual Leave', from: 'Sep 11', to: 'Sep 11', days: 1, status: 'Approved' },
  { type: 'Medical Leave', from: 'Aug 5', to: 'Aug 7', days: 3, status: 'Approved' },
];

const StaffDashboard = () => {
  const { user } = useAuth();

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="space-y-lg">
      {/* ── Welcome Header ───────────────────────────────────────── */}
      <div className="page-header">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          Welcome, {user?.name?.split(' ')[0]}
        </h2>
        <p className="font-body-sm text-body-sm text-secondary mt-xs">{today}</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        {/* ── Profile Card ─────────────────────────────────────── */}
        <div className="lg:col-span-1">
          <div className="bit-card flex flex-col items-center text-center p-lg">
            <div className="w-20 h-20 rounded-full bg-primary-container text-on-primary flex items-center justify-center text-2xl font-bold mb-md">
              {user?.name?.split(' ').map((n) => n[0]).join('').slice(0, 2).toUpperCase()}
            </div>
            <h3 className="font-headline-sm text-headline-sm text-on-surface">{user?.name}</h3>
            <p className="font-body-sm text-body-sm text-secondary mt-xs">{user?.designation || getRoleLabel(user?.role)}</p>
            <span className="badge-info mt-sm">{user?.department?.name || 'Department'}</span>

            <div className="w-full mt-lg border-t border-outline-variant pt-md">
              <InfoRow label="Employee ID" value={user?.employeeId} />
              <InfoRow label="Email"       value={user?.email} />
              <InfoRow label="Phone"       value={user?.phone} />
            </div>

            <button className="btn-secondary w-full justify-center mt-md">
              <span className="material-symbols-outlined text-xl">edit</span>
              Edit Profile
            </button>
          </div>

          {/* Leave Balance card */}
          <div className="bit-card mt-md">
            <h3 className="font-title-md text-title-md text-on-surface mb-md">Leave Balance</h3>
            <div className="space-y-sm">
              {[
                { type: 'Casual Leave',   total: 12, used: 3  },
                { type: 'Medical Leave',  total: 12, used: 3  },
                { type: 'Earned Leave',   total: 30, used: 5  },
              ].map(({ type, total, used }) => {
                const remaining = total - used;
                const pct = Math.round((remaining / total) * 100);
                return (
                  <div key={type}>
                    <div className="flex justify-between mb-xs">
                      <span className="font-body-sm text-body-sm text-on-surface">{type}</span>
                      <span className="font-label-md text-label-md text-secondary">{remaining}/{total}</span>
                    </div>
                    <div className="bg-surface-container-high rounded-full h-1.5">
                      <div
                        className={`h-1.5 rounded-full ${pct > 50 ? 'bg-emerald-500' : pct > 25 ? 'bg-amber-500' : 'bg-red-500'}`}
                        style={{ width: `${pct}%` }}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
            <button className="btn-primary w-full justify-center mt-md">
              <span className="material-symbols-outlined text-xl">add</span>
              Apply for Leave
            </button>
          </div>
        </div>

        {/* ── Right Column ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-md">
          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-md">
            <div className="kpi-card">
              <div className="kpi-label">This Month</div>
              <div className="kpi-value text-primary-container">18</div>
              <div className="kpi-sub">Days present</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Absent</div>
              <div className="kpi-value text-error">1</div>
              <div className="kpi-sub">This month</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Leave Taken</div>
              <div className="kpi-value text-amber-600">1</div>
              <div className="kpi-sub">This month</div>
            </div>
          </div>

          {/* Attendance log */}
          <div className="bit-card">
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-title-md text-title-md text-on-surface">Recent Attendance</h3>
              <button className="btn-ghost text-xs">View all</button>
            </div>
            <div className="overflow-x-auto">
              <table className="bit-table">
                <thead>
                  <tr>
                    <th>Date</th>
                    <th>Day</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {attendanceThisMonth.map((row, i) => (
                    <tr key={i}>
                      <td className="font-medium">{row.date}</td>
                      <td className="text-secondary">{row.day}</td>
                      <td><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          {/* Leave history */}
          <div className="bit-card">
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-title-md text-title-md text-on-surface">Recent Leave Requests</h3>
              <button className="btn-ghost text-xs">View all</button>
            </div>
            <div className="overflow-x-auto">
              <table className="bit-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>From</th>
                    <th>To</th>
                    <th>Days</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeaves.map((row, i) => (
                    <tr key={i}>
                      <td className="font-medium">{row.type}</td>
                      <td className="text-secondary">{row.from}</td>
                      <td className="text-secondary">{row.to}</td>
                      <td>{row.days}</td>
                      <td><StatusBadge status={row.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default StaffDashboard;
