import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import { getDepartmentAttendance } from '../../services/attendance.service';
import { getDepartmentLeaves, approveLeave, rejectLeave } from '../../services/leave.service';
import { getDepartmentSchedules } from '../../services/schedule.service';
import { useNavigate } from 'react-router-dom';
import { ROUTES } from '../../config/constants';

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

const HODDashboard = () => {
  const { user } = useAuth();
  const dept = user?.department?.name || 'Department';

  const navigate = useNavigate();

  const [staffAttendance, setStaffAttendance] = useState([]);
  const [pendingLeaves, setPendingLeaves] = useState([]);
  const [deptSchedules, setDeptSchedules] = useState([]);
  const [deptStaffCount, setDeptStaffCount] = useState(0);
  const [processingId, setProcessingId] = useState(null);
  const [actionMessage, setActionMessage] = useState('');

  const loadData = useCallback(async () => {
    try {
      const today = new Date().toISOString().split('T')[0];
      const [attData, leavesData, schedData] = await Promise.all([
        getDepartmentAttendance(),
        getDepartmentLeaves({ status: 'Pending' }),
        getDepartmentSchedules({ startDate: today, endDate: today }),
      ]);
      setStaffAttendance(attData.records || []);
      setDeptStaffCount(attData.departmentStaffCount || (attData.records || []).length);
      setPendingLeaves(leavesData.leaves || []);
      setDeptSchedules(schedData || []);
    } catch (err) {
      console.error('Failed to load HOD data:', err);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleApprove = async (leaveId) => {
    setProcessingId(leaveId);
    try {
      await approveLeave(leaveId, 'Approved by HOD');
      setActionMessage('Leave approved successfully!');
      setTimeout(() => setActionMessage(''), 3000);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve leave.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (leaveId) => {
    const reason = window.prompt('Enter rejection remarks (optional):', 'Cannot be approved at this time');
    if (reason === null) return;

    setProcessingId(leaveId);
    try {
      await rejectLeave(leaveId, reason);
      setActionMessage('Leave rejected and balance restored.');
      setTimeout(() => setActionMessage(''), 3000);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject leave.');
    } finally {
      setProcessingId(null);
    }
  };

  // KPI calculations
  const presentCount = staffAttendance.filter((r) => r.status === 'Present').length;
  const absentCount = staffAttendance.filter((r) => r.status === 'Absent').length;
  const onLeaveCount = staffAttendance.filter((r) => r.status === 'Leave' || r.status === 'On-Leave').length;

  return (
    <div className="space-y-lg">
      {/* ── Header ──────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-sm">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">
            {dept} — Overview
          </h2>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
        {actionMessage && (
          <div className="px-md py-xs bg-emerald-50 text-emerald-800 rounded border border-emerald-200 text-body-sm font-medium animate-in fade-in">
            {actionMessage}
          </div>
        )}
      </div>

      {/* ── KPIs ─────────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <KPICard label="Department Staff" value={deptStaffCount} icon="groups" sub="In your department" />
        <KPICard label="Present Today" value={presentCount} icon="how_to_reg" sub="Staff on duty" valueColor="text-primary-container" />
        <KPICard label="Absent" value={absentCount} icon="person_off" sub="Unexcused" valueColor="text-error" />
        <KPICard label="Pending Leave" value={pendingLeaves.length} icon="pending_actions" sub="Awaiting approval" valueColor="text-amber-600" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-md">
        {/* Staff Table */}
        <div className="lg:col-span-3">
          <div className="bit-card">
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-title-md text-title-md text-on-surface">Department Staff Attendance</h3>
              <span className="text-xs text-secondary font-medium">{staffAttendance.length} records</span>
            </div>
            <div className="overflow-x-auto">
              {staffAttendance.length === 0 ? (
                <p className="text-secondary text-center py-xl font-body-sm">
                  No attendance records recorded for department staff today.
                </p>
              ) : (
                <table className="bit-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Designation</th>
                      <th>Date</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {staffAttendance.map((s) => {
                      const d = new Date(s.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                      return (
                        <tr key={s._id}>
                          <td className="font-medium">{s.user?.name || 'Staff Member'}</td>
                          <td className="text-secondary">{s.user?.designation || 'Staff'}</td>
                          <td className="text-secondary text-xs">{d}</td>
                          <td><StatusBadge status={s.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>

        {/* Leave Approvals */}
        <div className="lg:col-span-2">
          <div className="bit-card h-full flex flex-col">
            <h3 className="font-title-md text-title-md text-on-surface mb-md">Pending Leave Approvals</h3>
            {pendingLeaves.length === 0 ? (
              <div className="flex flex-col items-center justify-center flex-1 py-xl gap-sm text-outline">
                <span className="material-symbols-outlined text-[40px] text-emerald-600">task_alt</span>
                <p className="font-body-sm text-body-sm text-secondary">All requests are reviewed</p>
              </div>
            ) : (
              <div className="flex flex-col gap-sm">
                {pendingLeaves.map((l) => {
                  const fromStr = new Date(l.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                  const toStr = new Date(l.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                  const dateStr = fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;

                  return (
                    <div key={l._id} className="p-sm border border-outline-variant rounded-lg bg-surface-container-lowest shadow-xs">
                      <div className="flex items-start justify-between mb-xs">
                        <div>
                          <p className="font-label-md text-label-md text-on-surface">{l.user?.name}</p>
                          <p className="font-body-sm text-body-sm text-secondary">{l.type}</p>
                          <p className="font-label-sm text-label-sm text-outline">
                            {dateStr} · {l.totalDays} day{l.totalDays !== 1 ? 's' : ''}
                          </p>
                          {l.reason && (
                            <p className="text-xs text-secondary italic mt-xs bg-surface-container p-xs rounded">
                              "{l.reason}"
                            </p>
                          )}
                        </div>
                        <StatusBadge status={l.status} />
                      </div>
                      <div className="flex gap-sm mt-sm">
                        <button
                          onClick={() => handleApprove(l._id)}
                          disabled={processingId === l._id}
                          className="btn-primary flex-1 justify-center text-xs py-xs"
                        >
                          {processingId === l._id ? 'Processing...' : 'Approve'}
                        </button>
                        <button
                          onClick={() => handleReject(l._id)}
                          disabled={processingId === l._id}
                          className="btn-ghost flex-1 justify-center text-xs py-xs text-error hover:bg-error-container/20"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>

        {/* Department Schedules (Today) */}
        <div className="lg:col-span-3">
          <div className="bit-card h-full">
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-title-md text-title-md text-on-surface">Today's Department Schedules</h3>
              <button
                onClick={() => navigate(ROUTES.HOD_SCHEDULE)}
                className="btn-ghost text-xs"
              >
                View full roster
              </button>
            </div>
            <div className="overflow-x-auto">
              {deptSchedules.length === 0 ? (
                <p className="text-secondary text-center py-xl font-body-sm">
                  No schedules assigned for today.
                </p>
              ) : (
                <table className="bit-table">
                  <thead>
                    <tr>
                      <th>Staff Member</th>
                      <th>Shift</th>
                      <th>Timing</th>
                      <th>Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {deptSchedules.map((s) => (
                      <tr key={s._id}>
                        <td className="font-medium">{s.staff?.name}</td>
                        <td className="text-secondary">{s.shift?.name || 'Custom'}</td>
                        <td className="text-secondary text-xs">{s.startTime} - {s.endTime}</td>
                        <td><StatusBadge status={s.status} /></td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default HODDashboard;
