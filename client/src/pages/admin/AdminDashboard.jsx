import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';

// KPI Card component
const KPICard = ({ label, value, icon, sub, valueColor = 'text-on-surface' }) => (
  <div className="kpi-card">
    <div className="flex justify-between items-start mb-sm">
      <span className="kpi-label">{label}</span>
      <span className="material-symbols-outlined text-outline text-xl">{icon}</span>
    </div>
    <div className={`kpi-value ${valueColor}`}>{value}</div>
    {sub && <div className="kpi-sub">{sub}</div>}
  </div>
);

// Stat section card
const SectionCard = ({ title, children, action }) => (
  <div className="bit-card">
    <div className="flex items-center justify-between mb-md">
      <h3 className="font-title-md text-title-md text-on-surface">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

const recentLeaves = [
  { name: 'Rajesh Kumar',   dept: 'CSE', type: 'Casual Leave',  dates: 'Sep 18–19',  status: 'Pending'  },
  { name: 'Meena Devi',     dept: 'CSE', type: 'Medical Leave', dates: 'Sep 15–17',  status: 'Approved' },
  { name: 'Suresh Babu',    dept: 'ECE', type: 'Earned Leave',  dates: 'Sep 10–12',  status: 'Approved' },
  { name: 'Lakshmi Priya',  dept: 'ME',  type: 'Casual Leave',  dates: 'Sep 8',      status: 'Rejected' },
];

const deptStats = [
  { dept: 'CSE', total: 24, present: 22, absent: 1, leave: 1 },
  { dept: 'ECE', total: 18, present: 16, absent: 2, leave: 0 },
  { dept: 'ME',  total: 15, present: 13, absent: 1, leave: 1 },
  { dept: 'CE',  total: 12, present: 12, absent: 0, leave: 0 },
  { dept: 'IT',  total: 20, present: 18, absent: 1, leave: 1 },
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  return (
    <div className="space-y-lg">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">
              Good {new Date().getHours() < 12 ? 'Morning' : new Date().getHours() < 17 ? 'Afternoon' : 'Evening'}, {user?.name?.split(' ')[0]}
            </h2>
            <p className="font-body-sm text-body-sm text-secondary mt-xs">{today}</p>
          </div>
          <button className="btn-primary hidden sm:flex">
            <span className="material-symbols-outlined text-sm">download</span>
            Export Report
          </button>
        </div>
      </div>

      {/* ── KPI Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-md">
        <KPICard label="Total Staff"       value="89"   icon="groups"          sub="Across all departments" />
        <KPICard label="Present Today"     value="76"   icon="how_to_reg"      sub="85.4% attendance"       valueColor="text-primary-container" />
        <KPICard label="Absent"            value="6"    icon="person_off"      sub="Requires attention"     valueColor="text-error" />
        <KPICard label="On Leave"          value="7"    icon="flight_takeoff"  sub="Approved leaves" />
        <KPICard label="Pending Requests"  value="4"    icon="pending_actions" sub="Awaiting approval"      valueColor="text-amber-600" />
      </div>

      {/* ── Mid row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">

        {/* Recent Leave Requests */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Recent Leave Requests"
            action={
              <button className="btn-ghost text-xs">View all</button>
            }
          >
            <div className="overflow-x-auto">
              <table className="bit-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Dept</th>
                    <th>Type</th>
                    <th>Dates</th>
                    <th>Status</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {recentLeaves.map((row, i) => (
                    <tr key={i}>
                      <td className="font-medium">{row.name}</td>
                      <td><span className="badge-neutral">{row.dept}</span></td>
                      <td className="text-secondary">{row.type}</td>
                      <td className="text-secondary">{row.dates}</td>
                      <td><StatusBadge status={row.status} /></td>
                      <td>
                        {row.status === 'Pending' && (
                          <div className="flex gap-xs">
                            <button className="btn-secondary text-xs py-xs px-sm">Approve</button>
                            <button className="btn-ghost text-xs py-xs px-sm">Reject</button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </SectionCard>
        </div>

        {/* Quick Actions */}
        <SectionCard title="Quick Actions">
          <div className="flex flex-col gap-sm">
            {[
              { label: 'Add Staff Member',    icon: 'person_add',      cls: 'btn-primary' },
              { label: 'Mark Attendance',     icon: 'how_to_reg',      cls: 'btn-secondary' },
              { label: 'Process Payroll',     icon: 'payments',        cls: 'btn-secondary' },
              { label: 'Create Shift',        icon: 'schedule',        cls: 'btn-secondary' },
              { label: 'Send Notification',   icon: 'notifications',   cls: 'btn-ghost' },
            ].map(({ label, icon, cls }) => (
              <button key={label} className={`${cls} w-full justify-start`}>
                <span className="material-symbols-outlined text-xl">{icon}</span>
                {label}
              </button>
            ))}
          </div>
        </SectionCard>
      </div>

      {/* ── Department Attendance Summary ────────────────────────── */}
      <SectionCard title="Department Attendance Summary">
        <div className="overflow-x-auto">
          <table className="bit-table">
            <thead>
              <tr>
                <th>Department</th>
                <th>Total Staff</th>
                <th>Present</th>
                <th>Absent</th>
                <th>On Leave</th>
                <th>Attendance %</th>
              </tr>
            </thead>
            <tbody>
              {deptStats.map((row) => {
                const pct = Math.round((row.present / row.total) * 100);
                return (
                  <tr key={row.dept}>
                    <td><span className="badge-neutral">{row.dept}</span></td>
                    <td>{row.total}</td>
                    <td className="text-emerald-700 font-medium">{row.present}</td>
                    <td className="text-red-700 font-medium">{row.absent}</td>
                    <td className="text-amber-700 font-medium">{row.leave}</td>
                    <td>
                      <div className="flex items-center gap-sm">
                        <div className="flex-1 bg-surface-container-high rounded-full h-1.5">
                          <div
                            className={`h-1.5 rounded-full ${pct >= 90 ? 'bg-emerald-500' : pct >= 75 ? 'bg-amber-500' : 'bg-red-500'}`}
                            style={{ width: `${pct}%` }}
                          />
                        </div>
                        <span className="font-label-md text-label-md text-secondary w-10 text-right">{pct}%</span>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </SectionCard>
    </div>
  );
};

export default AdminDashboard;
