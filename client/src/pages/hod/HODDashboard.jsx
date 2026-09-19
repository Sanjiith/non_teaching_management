import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';

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

const staffList = [
  { name: 'Rajesh Kumar',  designation: 'Lab Technician',  status: 'Present',  shift: 'Morning' },
  { name: 'Meena Devi',    designation: 'Office Assistant', status: 'Present',  shift: 'Morning' },
  { name: 'Suresh Rajan',  designation: 'Lab Assistant',   status: 'Absent',   shift: 'Morning' },
  { name: 'Anitha K',      designation: 'Store Keeper',    status: 'On-Leave', shift: 'Morning' },
  { name: 'Karthik M',     designation: 'Lab Technician',  status: 'Present',  shift: 'Morning' },
];

const pendingLeaves = [
  { name: 'Rajesh Kumar', type: 'Casual Leave',  dates: 'Sep 20–21', days: 2 },
  { name: 'Anitha K',     type: 'Medical Leave', dates: 'Sep 18–22', days: 5 },
];

const HODDashboard = () => {
  const { user } = useAuth();
  const dept = user?.department?.name || 'Your Department';

  return (
    <div className="space-y-lg">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="page-header">
        <h2 className="font-headline-md text-headline-md text-on-surface">
          {dept} — Overview
        </h2>
        <p className="font-body-sm text-body-sm text-secondary mt-xs">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </p>
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <KPICard label="Total Staff"   value="24"  icon="groups"       sub="In your department" />
        <KPICard label="Present Today" value="21"  icon="how_to_reg"   sub="87.5% rate"         valueColor="text-primary-container" />
        <KPICard label="Absent"        value="1"   icon="person_off"   sub="Today"              valueColor="text-error" />
        <KPICard label="Pending Leave" value="2"   icon="pending_actions" sub="Needs approval"  valueColor="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-md">
        {/* Staff Table */}
        <div className="lg:col-span-3">
          <div className="bit-card">
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-title-md text-title-md text-on-surface">Today's Staff Attendance</h3>
              <button className="btn-secondary text-xs py-xs">Download</button>
            </div>
            <div className="overflow-x-auto">
              <table className="bit-table">
                <thead>
                  <tr>
                    <th>Name</th>
                    <th>Designation</th>
                    <th>Shift</th>
                    <th>Status</th>
                  </tr>
                </thead>
                <tbody>
                  {staffList.map((s, i) => (
                    <tr key={i}>
                      <td className="font-medium">{s.name}</td>
                      <td className="text-secondary">{s.designation}</td>
                      <td><span className="badge-info">{s.shift}</span></td>
                      <td><StatusBadge status={s.status} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Leave Approvals */}
        <div className="lg:col-span-2">
          <div className="bit-card h-full">
            <h3 className="font-title-md text-title-md text-on-surface mb-md">Pending Leave Approvals</h3>
            {pendingLeaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-xl gap-sm text-outline">
                <span className="material-symbols-outlined text-[40px]">task_alt</span>
                <p className="font-body-sm text-body-sm">No pending approvals</p>
              </div>
            ) : (
              <div className="flex flex-col gap-sm">
                {pendingLeaves.map((l, i) => (
                  <div key={i} className="p-sm border border-outline-variant rounded-lg">
                    <div className="flex items-start justify-between mb-xs">
                      <div>
                        <p className="font-label-md text-label-md text-on-surface">{l.name}</p>
                        <p className="font-body-sm text-body-sm text-secondary">{l.type}</p>
                        <p className="font-label-sm text-label-sm text-outline">{l.dates} · {l.days} day{l.days !== 1 ? 's' : ''}</p>
                      </div>
                      <StatusBadge status="Pending" />
                    </div>
                    <div className="flex gap-sm mt-sm">
                      <button className="btn-primary flex-1 justify-center text-xs py-xs">Approve</button>
                      <button className="btn-ghost flex-1 justify-center text-xs py-xs text-error hover:bg-red-50">Reject</button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};

export default HODDashboard;
