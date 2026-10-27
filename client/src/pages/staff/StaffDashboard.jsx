import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import { getRoleLabel } from '../../utils/roleHelpers';
import { ROUTES } from '../../config/constants';
import { getMyAttendance, staffCheckIn, getTodayAttendance } from '../../services/attendance.service';
import { getMyLeaves, applyLeave } from '../../services/leave.service';
import { getMySchedules } from '../../services/schedule.service';
import { getMyPayroll } from '../../services/payroll.service';

const InfoRow = ({ label, value }) => (
  <div className="flex flex-col sm:flex-row sm:items-center py-sm border-b border-outline-variant last:border-0">
    <span className="font-label-md text-label-md text-secondary uppercase w-40 flex-shrink-0">{label}</span>
    <span className="font-body-md text-body-md text-on-surface mt-xs sm:mt-0">{value || '—'}</span>
  </div>
);

const StaffDashboard = () => {
  const { user } = useAuth();
  const navigate = useNavigate();

  const [attendanceRecords, setAttendanceRecords] = useState([]);
  const [attendanceStats, setAttendanceStats] = useState({
    presentDays: 0,
    absentDays: 0,
    leaveDays: 0,
    attendanceRate: 100,
  });
  const [leavesList, setLeavesList] = useState([]);
  const [balances, setBalances] = useState(null);
  const [todayShift, setTodayShift] = useState(null);
  const [latestPayroll, setLatestPayroll] = useState(null);
  const [loading, setLoading] = useState(true);

  // Check-In state
  const [todayAttendance, setTodayAttendance] = useState(null);
  const [checkingIn, setCheckingIn] = useState(false);
  const [checkInMessage, setCheckInMessage] = useState(null);

  // Apply Leave Modal state
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');
  const [leaveForm, setLeaveForm] = useState({
    type: 'Casual Leave',
    startDate: '',
    startTime: '09:00 AM',
    endDate: '',
    endTime: '05:00 PM',
    reason: '',
  });

  const loadDashboardData = useCallback(async () => {
    try {
      setLoading(true);
      const [attData, leavesData, schedData, payrollData, todayAttData] = await Promise.all([
        getMyAttendance({ limit: 7 }),
        getMyLeaves({ limit: 5 }),
        getMySchedules(),
        getMyPayroll({ limit: 1 }),
        getTodayAttendance().catch(() => null),
      ]);

      setAttendanceRecords(attData?.records || []);
      if (attData?.stats) setAttendanceStats(attData.stats);
      setLeavesList(leavesData?.leaves || []);
      if (leavesData?.leaveBalances) {
        setBalances(leavesData.leaveBalances);
      } else if (user?.leaveBalances) {
        setBalances(user.leaveBalances);
      }

      if (todayAttData) {
        setTodayAttendance(todayAttData);
      }

      const todayStr = new Date().toISOString().split('T')[0];
      const foundToday = (schedData || []).find(
        (s) => new Date(s.date).toISOString().split('T')[0] === todayStr
      );
      setTodayShift(foundToday || null);

      if (payrollData && payrollData.payrolls && payrollData.payrolls.length > 0) {
        setLatestPayroll(payrollData.payrolls[0]);
      }
    } catch (err) {
      console.error('Failed to load dashboard data:', err);
    } finally {
      setLoading(false);
    }
  }, [user]);

  const handleCheckIn = async () => {
    setCheckingIn(true);
    setCheckInMessage(null);
    try {
      const res = await staffCheckIn();
      setCheckInMessage({
        type: 'success',
        text: res.message || 'Check-in successful! Attendance marked as Present.',
      });
      await loadDashboardData();
    } catch (err) {
      const msg = err.response?.data?.message || err.message || 'Failed to check in.';
      setCheckInMessage({
        type: 'error',
        text: msg,
      });
      await loadDashboardData();
    } finally {
      setCheckingIn(false);
    }
  };

  useEffect(() => {
    loadDashboardData();
  }, [loadDashboardData]);

  const handleApplySubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!leaveForm.startDate) return setFormError('Start date is required.');
    if (!leaveForm.endDate) return setFormError('End date is required.');
    if (!leaveForm.reason.trim()) return setFormError('Reason is required.');

    setSubmitting(true);
    try {
      await applyLeave(leaveForm);
      setFormSuccess('Leave application submitted successfully!');
      setTimeout(() => {
        setIsModalOpen(false);
        setFormSuccess('');
        setLeaveForm({
          type: 'Casual Leave',
          startDate: '',
          startTime: '09:00 AM',
          endDate: '',
          endTime: '05:00 PM',
          reason: '',
        });
        loadDashboardData();
      }, 1000);
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to submit leave.');
    } finally {
      setSubmitting(false);
    }
  };

  const today = new Date().toLocaleDateString('en-IN', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric'
  });

  // Dynamic balances map
  const balanceItems = [
    {
      type: 'Casual Leave',
      total: balances?.casualLeave?.total ?? 12,
      used: balances?.casualLeave?.used ?? 0,
    },
    {
      type: 'Medical Leave',
      total: balances?.medicalLeave?.total ?? 12,
      used: balances?.medicalLeave?.used ?? 0,
    },
    {
      type: 'Earned Leave',
      total: balances?.earnedLeave?.total ?? 30,
      used: balances?.earnedLeave?.used ?? 0,
    },
  ];

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
              <InfoRow label="Employee ID" value={user?.employeeId || user?.staffId} />
              <InfoRow label="Email"       value={user?.email} />
              <InfoRow label="Phone"       value={user?.phone} />
            </div>
          </div>

          {/* Leave Balance card */}
          <div className="bit-card mt-md">
            <h3 className="font-title-md text-title-md text-on-surface mb-md">Leave Balance</h3>
            <div className="space-y-sm">
              {balanceItems.map(({ type, total, used }) => {
                const remaining = Math.max(0, total - used);
                const pct = total > 0 ? Math.round((remaining / total) * 100) : 0;
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
            <button
              onClick={() => setIsModalOpen(true)}
              className="btn-primary w-full justify-center mt-md"
            >
              <span className="material-symbols-outlined text-xl">add</span>
              Apply for Leave
            </button>
          </div>
        </div>

        {/* ── Right Column ─────────────────────────────────────── */}
        <div className="lg:col-span-2 space-y-md">
          {/* ── Daily Attendance & Check-In Card ────────────────── */}
          <div className="bit-card p-lg border-l-4 border-l-primary relative overflow-hidden">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md">
              <div className="space-y-xs">
                <div className="flex items-center gap-xs flex-wrap">
                  <span className="material-symbols-outlined text-primary text-2xl">how_to_reg</span>
                  <h3 className="font-title-lg text-title-lg text-on-surface font-bold">
                    Daily Attendance Check-In
                  </h3>
                  {todayAttendance && <StatusBadge status={todayAttendance.status} />}
                </div>
                <p className="font-body-sm text-body-sm text-secondary">
                  Biometric attendance alternative • Window: {todayAttendance?.window?.startTime || '08:00'} – {todayAttendance?.window?.endTime || '11:00'} ({todayAttendance?.window?.timeZone || 'Asia/Kolkata'})
                </p>

                {/* Attendance details & Check-in timestamp */}
                <div className="flex flex-wrap items-center gap-md mt-sm pt-xs text-sm">
                  <div className="flex items-center gap-xs">
                    <span className="text-secondary font-medium">Status:</span>
                    <span className="font-semibold text-on-surface">{todayAttendance?.status || 'Pending Check-In'}</span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <span className="text-secondary font-medium">Check-In Time:</span>
                    <span className="font-semibold font-mono text-on-surface">
                      {todayAttendance?.checkInFormatted || '—'}
                    </span>
                  </div>
                  <div className="flex items-center gap-xs">
                    <span className="text-secondary font-medium">Window:</span>
                    <span className="text-xs px-2 py-0.5 rounded-full font-medium bg-surface-container-high text-on-surface">
                      {todayAttendance?.window?.statusText || 'Checking window...'}
                    </span>
                  </div>
                </div>
              </div>

              {/* Check-In Action Button */}
              <div className="flex flex-col items-start sm:items-end gap-xs w-full sm:w-auto">
                {todayAttendance?.alreadyCheckedIn ? (
                  <div className="flex items-center gap-xs px-md py-sm bg-emerald-50 dark:bg-emerald-950/40 text-emerald-700 dark:text-emerald-300 rounded-lg border border-emerald-200 dark:border-emerald-800 text-sm font-semibold">
                    <span className="material-symbols-outlined text-xl">check_circle</span>
                    <span>Checked In ({todayAttendance.checkInFormatted})</span>
                  </div>
                ) : todayAttendance?.status === 'Leave' ? (
                  <div className="flex items-center gap-xs px-md py-sm bg-blue-50 dark:bg-blue-950/40 text-blue-700 dark:text-blue-300 rounded-lg border border-blue-200 dark:border-blue-800 text-sm font-semibold">
                    <span className="material-symbols-outlined text-xl">flight_takeoff</span>
                    <span>On Approved Leave</span>
                  </div>
                ) : todayAttendance?.status === 'Absent' ? (
                  <div className="flex items-center gap-xs px-md py-sm bg-red-50 dark:bg-red-950/40 text-red-700 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800 text-sm font-semibold">
                    <span className="material-symbols-outlined text-xl">cancel</span>
                    <span>Marked Absent (Window Closed)</span>
                  </div>
                ) : todayAttendance?.window?.isBefore ? (
                  <button
                    disabled
                    className="btn-secondary opacity-60 cursor-not-allowed flex items-center gap-xs py-sm px-lg"
                  >
                    <span className="material-symbols-outlined text-xl">schedule</span>
                    <span>Window Opens at {todayAttendance?.window?.startTime}</span>
                  </button>
                ) : (
                  <button
                    id="check-in-btn"
                    onClick={handleCheckIn}
                    disabled={checkingIn}
                    className="btn-primary flex items-center justify-center gap-xs py-sm px-lg text-sm font-bold shadow-md hover:shadow-lg transition-all"
                  >
                    <span className="material-symbols-outlined text-xl">fingerprint</span>
                    <span>{checkingIn ? 'Checking In...' : 'Check In Now'}</span>
                  </button>
                )}
              </div>
            </div>

            {/* Feedback message banner */}
            {checkInMessage && (
              <div
                className={`mt-md p-sm rounded-lg text-sm flex items-center gap-xs ${
                  checkInMessage.type === 'success'
                    ? 'bg-emerald-100 dark:bg-emerald-950/50 text-emerald-800 dark:text-emerald-200 border border-emerald-300 dark:border-emerald-800'
                    : 'bg-red-100 dark:bg-red-950/50 text-red-800 dark:text-red-200 border border-red-300 dark:border-red-800'
                }`}
              >
                <span className="material-symbols-outlined text-base">
                  {checkInMessage.type === 'success' ? 'check_circle' : 'error'}
                </span>
                <span>{checkInMessage.text}</span>
              </div>
            )}
          </div>

          {/* Quick stats */}
          <div className="grid grid-cols-3 gap-md">
            <div className="kpi-card">
              <div className="kpi-label">Days Present</div>
              <div className="kpi-value text-primary-container">{attendanceStats.presentDays}</div>
              <div className="kpi-sub">Total recorded</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Days on Leave</div>
              <div className="kpi-value text-amber-600">{attendanceStats.totalLeaveDays ?? attendanceStats.leaveDays}</div>
              <div className="kpi-sub">Approved leaves</div>
            </div>
            <div className="kpi-card">
              <div className="kpi-label">Attendance Rate</div>
              <div className="kpi-value text-emerald-700">{attendanceStats.attendanceRate}%</div>
              <div className="kpi-sub">Dynamic rate</div>
            </div>
          </div>

          {/* Today's Shift Card */}
          <div className="bit-card p-md border-l-4 border-l-primary flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md">
            <div className="space-y-xs">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-primary text-xl">schedule</span>
                <span className="font-label-md text-label-md text-secondary uppercase font-semibold">Today's Duty Shift</span>
                {todayShift && <StatusBadge status={todayShift.status} />}
              </div>
              <p className="font-title-md text-title-md text-on-surface font-bold">
                {todayShift ? todayShift.shift?.name : 'No Shift Scheduled for Today'}
              </p>
              <p className="font-body-sm text-body-sm text-outline">
                {todayShift
                  ? `Timing: ${todayShift.startTime} – ${todayShift.endTime} (${todayShift.shift?.workingHours || 8} hrs) • ${todayShift.remarks || 'Regular duty'}`
                  : 'You do not have an active shift assignment for today.'}
              </p>
            </div>
            <button
              onClick={() => navigate(ROUTES.STAFF_SCHEDULE)}
              className="btn-secondary text-xs flex items-center gap-xs whitespace-nowrap self-stretch sm:self-auto justify-center"
            >
              <span className="material-symbols-outlined text-sm">calendar_month</span>
              My Roster
            </button>
          </div>

          {/* Latest Payroll Card */}
          <div className="bit-card p-md border-l-4 border-l-emerald-500 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md">
            <div className="space-y-xs">
              <div className="flex items-center gap-xs">
                <span className="material-symbols-outlined text-emerald-600 text-xl">payments</span>
                <span className="font-label-md text-label-md text-secondary uppercase font-semibold">Latest Payroll</span>
                {latestPayroll && <StatusBadge status={latestPayroll.status} />}
              </div>
              <p className="font-title-md text-title-md text-on-surface font-bold">
                {latestPayroll ? `₹${latestPayroll.netSalary.toLocaleString('en-IN')}` : 'No Payroll Data'}
              </p>
              <p className="font-body-sm text-body-sm text-outline">
                {latestPayroll
                  ? `For ${new Date(Date.UTC(latestPayroll.year, latestPayroll.month - 1, 1)).toLocaleString('en-IN', { month: 'long', year: 'numeric', timeZone: 'UTC' })}`
                  : 'Payroll has not been generated for you yet.'}
              </p>
            </div>
            <button
              onClick={() => navigate(ROUTES.STAFF_PAYROLL)}
              className="btn-secondary text-xs flex items-center gap-xs whitespace-nowrap self-stretch sm:self-auto justify-center"
            >
              <span className="material-symbols-outlined text-sm">receipt_long</span>
              View Details
            </button>
          </div>

          {/* Actual Attendance log */}
          <div className="bit-card">
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-title-md text-title-md text-on-surface">Recent Attendance</h3>
              <button
                onClick={() => navigate(ROUTES.STAFF_ATTENDANCE)}
                className="btn-ghost text-xs"
              >
                View all
              </button>
            </div>
            <div className="overflow-x-auto">
              {attendanceRecords.length === 0 ? (
                <p className="text-secondary text-center py-md font-body-sm">No attendance records found.</p>
              ) : (
                <table className="bit-table">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Status</th>
                      <th>Remarks</th>
                    </tr>
                  </thead>
                  <tbody>
                    {attendanceRecords.map((row) => {
                      const d = new Date(row.date);
                      const formattedDate = d.toLocaleDateString('en-IN', {
                        month: 'short', day: 'numeric', weekday: 'short',
                      });
                      return (
                        <tr key={row._id}>
                          <td className="font-medium">{formattedDate}</td>
                          <td><StatusBadge status={row.status} /></td>
                          <td className="text-secondary text-sm">{row.remarks || '—'}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          {/* Actual Leave history */}
          <div className="bit-card">
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-title-md text-title-md text-on-surface">Recent Leave Requests</h3>
              <button
                onClick={() => navigate(ROUTES.STAFF_LEAVE)}
                className="btn-ghost text-xs"
              >
                View all
              </button>
            </div>
            <div className="overflow-x-auto">
              {leavesList.length === 0 ? (
                <p className="text-secondary text-center py-md font-body-sm">No leave requests submitted yet.</p>
              ) : (
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
                    {leavesList.map((row) => {
                      const fromStr = new Date(row.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                      const toStr = new Date(row.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                      return (
                        <tr key={row._id}>
                          <td className="font-medium">{row.type}</td>
                          <td className="text-secondary">{fromStr}</td>
                          <td className="text-secondary">{toStr}</td>
                          <td>{row.totalDays}</td>
                          <td><StatusBadge status={row.status} /></td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      </div>

      {/* ── Apply for Leave Modal ───────────────────────────────── */}
      {isModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg max-w-lg w-full shadow-lg animate-in fade-in zoom-in-95 duration-150">
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Apply for Leave</h3>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-xs text-secondary hover:text-on-surface rounded"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleApplySubmit} className="space-y-md">
              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Leave Type</label>
                <select
                  value={leaveForm.type}
                  onChange={(e) => setLeaveForm({ ...leaveForm, type: e.target.value })}
                  className="bit-input"
                >
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Medical Leave">Medical Leave</option>
                  <option value="Earned Leave">Earned Leave</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <div>
                  <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Start Date</label>
                  <input
                    type="date"
                    value={leaveForm.startDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startDate: e.target.value })}
                    className="bit-input"
                    required
                  />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">End Date</label>
                  <input
                    type="date"
                    value={leaveForm.endDate}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endDate: e.target.value })}
                    className="bit-input"
                    required
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-sm">
                <div>
                  <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Start Time</label>
                  <input
                    type="text"
                    value={leaveForm.startTime}
                    onChange={(e) => setLeaveForm({ ...leaveForm, startTime: e.target.value })}
                    placeholder="09:00 AM"
                    className="bit-input"
                  />
                </div>
                <div>
                  <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">End Time</label>
                  <input
                    type="text"
                    value={leaveForm.endTime}
                    onChange={(e) => setLeaveForm({ ...leaveForm, endTime: e.target.value })}
                    placeholder="05:00 PM"
                    className="bit-input"
                  />
                </div>
              </div>

              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Reason</label>
                <textarea
                  rows="3"
                  value={leaveForm.reason}
                  onChange={(e) => setLeaveForm({ ...leaveForm, reason: e.target.value })}
                  placeholder="Provide reason for leave..."
                  className="bit-input py-xs"
                  required
                />
              </div>

              {formError && (
                <div className="p-sm bg-error-container text-on-error-container rounded text-body-sm">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-sm bg-emerald-50 text-emerald-800 rounded text-body-sm">
                  {formSuccess}
                </div>
              )}

              <div className="flex gap-sm justify-end pt-sm border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? 'Submitting...' : 'Submit Application'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffDashboard;
