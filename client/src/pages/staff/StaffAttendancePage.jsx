import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { getMyAttendance } from '../../services/attendance.service';

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
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">My Attendance</h2>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            Review your daily attendance records and verified leaves
          </p>
        </div>

        {/* Filter controls */}
        <div className="flex items-center gap-sm">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bit-input py-xs text-body-sm w-36"
          >
            {months.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bit-input py-xs text-body-sm w-28"
          >
            {[2025, 2026, 2027].map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <KPICard
          label="Present Days"
          value={stats.presentDays}
          icon="how_to_reg"
          sub="Recorded present"
          valueColor="text-primary-container"
        />
        <KPICard
          label="Leave Days"
          value={stats.leaveDays}
          icon="flight_takeoff"
          sub="Approved leaves"
          valueColor="text-amber-600"
        />
        <KPICard
          label="Absent"
          value={stats.absentDays}
          icon="person_off"
          sub="Recorded absent"
          valueColor="text-error"
        />
        <KPICard
          label="Attendance Rate"
          value={`${stats.attendanceRate}%`}
          icon="percent"
          sub="Dynamic attendance rate"
          valueColor="text-emerald-700"
        />
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
