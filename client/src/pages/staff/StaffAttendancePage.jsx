import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { getMyAttendance } from '../../services/attendance.service';
import { exportCSV, getAttendanceRateColor } from '../../utils/exportCSV';

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

const StaffAttendancePage = () => {
  const currentDate = new Date();
  const [selectedMonth, setSelectedMonth] = useState(currentDate.getMonth() + 1);
  const [selectedYear, setSelectedYear] = useState(currentDate.getFullYear());
  const [records, setRecords] = useState([]);
  const [stats, setStats] = useState({
    presentDays: 0,
    absentDays: 0,
    leaveDays: 0,
    holidayDays: 0,
    weeklyOffDays: 0,
    attendanceRate: 100,
    totalRecords: 0,
  });
  const [loading, setLoading] = useState(true);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyAttendance({
        month: selectedMonth,
        year: selectedYear,
      });
      setRecords(data.records || []);
      if (data.stats) setStats(data.stats);
    } catch (err) {
      console.error('Error fetching staff attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const months = [
    { value: 1, label: 'January' },
    { value: 2, label: 'February' },
    { value: 3, label: 'March' },
    { value: 4, label: 'April' },
    { value: 5, label: 'May' },
    { value: 6, label: 'June' },
    { value: 7, label: 'July' },
    { value: 8, label: 'August' },
    { value: 9, label: 'September' },
    { value: 10, label: 'October' },
    { value: 11, label: 'November' },
    { value: 12, label: 'December' },
  ];

  return (
    <div className="space-y-lg">
      {/* Header with Export */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">My Attendance</h2>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            Review your daily attendance records and verified leaves
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bit-input py-xs text-body-sm w-36"
          >
            {months.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bit-input py-xs text-body-sm w-28"
          >
            {[2025, 2026, 2027].map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
          <button
            onClick={() => {
              const cols = [
                { key: 'date', label: 'Date', getValue: (r) => new Date(r.date).toLocaleDateString('en-IN') },
                { key: 'day', label: 'Day', getValue: (r) => new Date(r.date).toLocaleDateString('en-IN', { weekday: 'long' }) },
                { key: 'status', label: 'Status', getValue: (r) => r.status },
                { key: 'remarks', label: 'Remarks', getValue: (r) => r.remarks || '' },
              ];
              exportCSV(records, `My_Attendance_${months[selectedMonth-1]?.label}_${selectedYear}`, cols);
            }}
            className="btn-secondary"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-md">
        <div className="kpi-card">
          <div className="kpi-label">Present Days</div>
          <div className="kpi-value text-primary-container">{stats.presentDays}</div>
          <div className="kpi-sub">Recorded present</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Leave Days</div>
          <div className="kpi-value text-amber-600">{stats.leaveDays}</div>
          <div className="kpi-sub">Approved leaves</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Absent</div>
          <div className="kpi-value text-red-600">{stats.absentDays}</div>
          <div className="kpi-sub">Recorded absent</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Holidays</div>
          <div className="kpi-value text-blue-600">{stats.holidayDays || 0}</div>
          <div className="kpi-sub">Public holidays</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Weekly Off</div>
          <div className="kpi-value text-secondary">{stats.weeklyOffDays || 0}</div>
          <div className="kpi-sub">Non-working days</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Attendance Rate</div>
          <div className={`kpi-value ${getAttendanceRateColor(stats.attendanceRate)}`}>{stats.attendanceRate}%</div>
          <div className="kpi-sub">
            {stats.attendanceRate >= 90 ? '✓ Excellent' : stats.attendanceRate >= 75 ? '⚠ Fair' : '⚠ Low'}
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bit-card">
        <h3 className="font-title-md text-title-md text-on-surface mb-md">Daily Log</h3>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-xl">
              <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-secondary text-center py-xl font-body-sm">
              No attendance records found for this period.
            </p>
          ) : (
            <table className="bit-table">
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Day</th>
                  <th>Status</th>
                  <th>Check In</th>
                  <th>Check Out</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const d = new Date(r.date);
                  const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                  const dayStr = d.toLocaleDateString('en-IN', { weekday: 'long' });
                  const inTime = r.checkIn ? new Date(r.checkIn).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';
                  const outTime = r.checkOut ? new Date(r.checkOut).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }) : '—';

                  return (
                    <tr key={r._id}>
                      <td className="font-medium">{dateStr}</td>
                      <td className="text-secondary">{dayStr}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="text-secondary font-mono text-xs">{inTime}</td>
                      <td className="text-secondary font-mono text-xs">{outTime}</td>
                      <td className="text-secondary text-sm">{r.remarks || '—'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
};

export default StaffAttendancePage;
