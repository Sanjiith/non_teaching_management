import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import { ROUTES } from '../../config/constants';
import { getAttendanceStats } from '../../services/attendance.service';
import { getAllLeaves, approveLeave, rejectLeave } from '../../services/leave.service';

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

const SectionCard = ({ title, children, action }) => (
  <div className="bit-card">
    <div className="flex items-center justify-between mb-md">
      <h3 className="font-title-md text-title-md text-on-surface">{title}</h3>
      {action}
    </div>
    {children}
  </div>
);

const deptStats = [
  { dept: 'CSE', total: 24, present: 22, absent: 1, leave: 1 },
  { dept: 'ECE', total: 18, present: 16, absent: 2, leave: 0 },
  { dept: 'ME',  total: 15, present: 13, absent: 1, leave: 1 },
  { dept: 'CE',  total: 12, present: 12, absent: 0, leave: 0 },
  { dept: 'IT',  total: 20, present: 18, absent: 1, leave: 1 },
];

const AdminDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [stats, setStats] = useState({
    totalStaff: 0,
    presentToday: 0,
    absentToday: 0,
    onLeaveToday: 0,
    attendanceRateToday: 0,
  });
  const [recentLeaves, setRecentLeaves] = useState([]);
  const [processingId, setProcessingId] = useState(null);

  const loadData = useCallback(async () => {
    try {
      const [statsData, leavesData] = await Promise.all([
        getAttendanceStats(),
        getAllLeaves({ limit: 5 }),
      ]);
      if (statsData) setStats(statsData);
      if (leavesData.leaves) setRecentLeaves(leavesData.leaves);
    } catch (err) {
      console.error('Failed to load admin dashboard data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      await approveLeave(id, 'Approved by Administrator');
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve leave.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection remarks:', 'Administrative decision');
    if (reason === null) return;

    setProcessingId(id);
    try {
      await rejectLeave(id, reason);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject leave.');
    } finally {
      setProcessingId(null);
    }
  };

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
          <button
            onClick={() => navigate(ROUTES.ADMIN_ATTENDANCE)}
            className="btn-primary hidden sm:flex"
          >
            <span className="material-symbols-outlined text-sm">calendar_month</span>
            Attendance Log
          </button>
        </div>
      </div>

      {/* ── KPI Grid ────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-md">
        <KPICard
          label="Total Staff"
          value={stats.totalStaff || 89}
          icon="groups"
          sub="Across all departments"
        />
        <KPICard
          label="Present Today"
          value={stats.presentToday || 0}
          icon="how_to_reg"
          sub={`${stats.attendanceRateToday || 0}% rate`}
          valueColor="text-primary-container"
        />
        <KPICard
          label="Absent"
          value={stats.absentToday || 0}
          icon="person_off"
          sub="Requires attention"
          valueColor="text-error"
        />
        <KPICard
          label="On Leave"
          value={stats.onLeaveToday || 0}
          icon="flight_takeoff"
          sub="Approved leaves"
          valueColor="text-amber-600"
        />
        <KPICard
          label="Pending Leaves"
          value={recentLeaves.filter((l) => l.status === 'Pending').length}
          icon="pending_actions"
          sub="Awaiting review"
          valueColor="text-amber-600"
        />
      </div>

      {/* ── Mid row ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        {/* Recent Leave Requests */}
        <div className="lg:col-span-2">
          <SectionCard
            title="Recent Leave Requests"
            action={
              <button
                onClick={() => navigate(ROUTES.ADMIN_LEAVE)}
                className="btn-ghost text-xs"
              >
                View all
              </button>
            }
          >
            <div className="overflow-x-auto">
              {recentLeaves.length === 0 ? (
                <p className="text-secondary text-center py-xl font-body-sm">
                  No leave requests found.
                </p>
              ) : (
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
                    {recentLeaves.map((row) => {
                      const fromStr = new Date(row.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                      const toStr = new Date(row.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                      const dateStr = fromStr === toStr ? fromStr : `${fromStr}–${toStr}`;

                      return (
                        <tr key={row._id}>
                          <td className="font-medium">{row.user?.name || 'Staff Member'}</td>
                          <td><span className="badge-neutral">{row.department?.code || '—'}</span></td>
                          <td className="text-secondary">{row.type}</td>
                          <td className="text-secondary">{dateStr}</td>
                          <td><StatusBadge status={row.status} /></td>
                          <td>
                            {row.status === 'Pending' && (
                              <div className="flex gap-xs">
                                <button
                                  onClick={() => handleApprove(row._id)}
                                  disabled={processingId === row._id}
                                  className="btn-secondary text-xs py-xs px-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(row._id)}
                                  disabled={processingId === row._id}
                                  className="btn-ghost text-xs py-xs px-sm text-error"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </SectionCard>
        </div>

        {/* Quick Actions */}
        <SectionCard title="Quick Actions">
          <div className="flex flex-col gap-sm">
            {[
              { label: 'Attendance Management', icon: 'how_to_reg', path: ROUTES.ADMIN_ATTENDANCE, cls: 'btn-primary' },
              { label: 'Leave Approvals',       icon: 'event_busy',  path: ROUTES.ADMIN_LEAVE,      cls: 'btn-secondary' },
              { label: 'Staff Directory',        icon: 'group',       path: ROUTES.ADMIN_STAFF,      cls: 'btn-secondary' },
              { label: 'Departments',            icon: 'account_balance', path: ROUTES.ADMIN_DEPARTMENTS, cls: 'btn-ghost' },
            ].map(({ label, icon, path, cls }) => (
              <button
                key={label}
                onClick={() => navigate(path)}
                className={`${cls} w-full justify-start`}
              >
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
