import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { getAllAttendance, markOrCorrectAttendance } from '../../services/attendance.service';
import { getAdminAttendanceReport } from '../../services/report.service';
import { exportCSV, getAttendanceRateColor } from '../../utils/exportCSV';

const MONTHS = [
  { value: '', label: 'All Months' },
  { value: 1, label: 'January' }, { value: 2, label: 'February' }, { value: 3, label: 'March' },
  { value: 4, label: 'April' },   { value: 5, label: 'May' },       { value: 6, label: 'June' },
  { value: 7, label: 'July' },    { value: 8, label: 'August' },    { value: 9, label: 'September' },
  { value: 10, label: 'October' }, { value: 11, label: 'November' }, { value: 12, label: 'December' },
];

const AdminAttendancePage = () => {
  const now = new Date();
  const [records, setRecords] = useState([]);
  const [reportStats, setReportStats] = useState(null);
  const [deptBreakdown, setDeptBreakdown] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [correctingRecord, setCorrectingRecord] = useState(null);
  const [newStatus, setNewStatus] = useState('Present');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [listData, reportData] = await Promise.all([
        getAllAttendance({ status: statusFilter || undefined }),
        getAdminAttendanceReport({
          month: selectedMonth || undefined,
          year: selectedYear || undefined,
        }),
      ]);
      setRecords(listData.records || []);
      if (reportData) {
        setReportStats(reportData.stats);
        setDeptBreakdown(reportData.departmentBreakdown || []);
      }
    } catch (err) {
      console.error('Error fetching admin attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedMonth, selectedYear]);

  useEffect(() => { fetchData(); }, [fetchData]);

  const handleCorrectSubmit = async (e) => {
    e.preventDefault();
    if (!correctingRecord) return;
    setSubmitting(true);
    try {
      await markOrCorrectAttendance({
        user: correctingRecord.user?._id || correctingRecord.user,
        date: correctingRecord.date,
        status: newStatus,
        remarks: remarks || 'Corrected by Admin',
      });
      setCorrectingRecord(null);
      setRemarks('');
      fetchData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleExportCSV = () => {
    const columns = [
      { key: 'employee', label: 'Employee', getValue: (r) => r.user?.name || '—' },
      { key: 'employeeId', label: 'Employee ID', getValue: (r) => r.user?.employeeId || '—' },
      { key: 'department', label: 'Department', getValue: (r) => r.user?.department?.code || '—' },
      { key: 'date', label: 'Date', getValue: (r) => new Date(r.date).toLocaleDateString('en-IN') },
      { key: 'status', label: 'Status', getValue: (r) => r.status },
      { key: 'remarks', label: 'Remarks', getValue: (r) => r.remarks || '' },
    ];
    const period = selectedMonth ? `${MONTHS.find(m => m.value === selectedMonth)?.label}-${selectedYear}` : selectedYear;
    exportCSV(records, `Attendance_Report_${period}`, columns);
  };

  const rateColor = reportStats ? getAttendanceRateColor(reportStats.attendanceRate) : 'text-on-surface';

  return (
    <div className="space-y-lg">
      {/* Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Attendance Management</h2>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            Monitor, filter, and correct staff attendance records across all departments
          </p>
        </div>
        <button onClick={handleExportCSV} className="btn-secondary flex items-center gap-xs">
          <span className="material-symbols-outlined text-sm">download</span>
          Export CSV
        </button>
      </div>

      {/* Report Filters */}
      <div className="bit-card">
        <h3 className="font-title-md text-title-md text-on-surface mb-md">Attendance Summary Report</h3>
        <div className="flex flex-wrap gap-sm mb-md">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : '')}
            className="bit-input py-xs text-body-sm w-40"
          >
            {MONTHS.map((m) => (<option key={m.value} value={m.value}>{m.label}</option>))}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bit-input py-xs text-body-sm w-28"
          >
            {[2024, 2025, 2026, 2027].map((y) => (<option key={y} value={y}>{y}</option>))}
          </select>
        </div>

        {/* KPI Summary Cards */}
        {reportStats && (
          <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-md">
            {[
              { label: 'Present', value: reportStats.Present, color: 'text-emerald-600' },
              { label: 'Absent', value: reportStats.Absent, color: 'text-red-600' },
              { label: 'On Leave', value: (reportStats.Leave || 0) + (reportStats['On-Leave'] || 0), color: 'text-amber-600' },
              { label: 'Holiday', value: reportStats.Holiday, color: 'text-blue-600' },
              { label: 'Weekly Off', value: reportStats['Weekly Off'], color: 'text-secondary' },
              { label: 'Attendance %', value: `${reportStats.attendanceRate}%`, color: rateColor },
            ].map(({ label, value, color }) => (
              <div key={label} className="kpi-card">
                <div className="kpi-label">{label}</div>
                <div className={`kpi-value ${color}`}>{value}</div>
              </div>
            ))}
          </div>
        )}

        {/* Dept Breakdown Table */}
        {deptBreakdown.length > 0 && (
          <div className="mt-md overflow-x-auto">
            <h4 className="font-label-md text-label-md text-secondary uppercase mb-sm">Department Breakdown</h4>
            <table className="bit-table">
              <thead>
                <tr>
                  <th>Department</th>
                  <th>Present</th>
                  <th>Absent</th>
                  <th>Leave</th>
                  <th>Holiday</th>
                  <th>Weekly Off</th>
                  <th>Total</th>
                </tr>
              </thead>
              <tbody>
                {deptBreakdown.map((d) => (
                  <tr key={d.dept}>
                    <td><span className="badge-neutral">{d.dept}</span></td>
                    <td className="text-emerald-600 font-medium">{d.Present}</td>
                    <td className="text-red-600 font-medium">{d.Absent}</td>
                    <td className="text-amber-600 font-medium">{d.Leave || 0}</td>
                    <td className="text-blue-600 font-medium">{d.Holiday || 0}</td>
                    <td className="text-secondary">{d['Weekly Off'] || 0}</td>
                    <td className="font-medium">{d.total}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Attendance Log */}
      <div className="bit-card">
        <div className="flex items-center justify-between mb-md">
          <h3 className="font-title-md text-title-md text-on-surface">Institution-wide Attendance Log</h3>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bit-input py-xs text-body-sm w-44"
          >
            <option value="">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Leave">Leave</option>
            <option value="Absent">Absent</option>
            <option value="Weekly Off">Weekly Off</option>
            <option value="Holiday">Holiday</option>
          </select>
        </div>

        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-xl">
              <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : records.length === 0 ? (
            <p className="text-secondary text-center py-xl font-body-sm">No attendance records found.</p>
          ) : (
            <table className="bit-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {records.map((r) => {
                  const dateStr = new Date(r.date).toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <tr key={r._id}>
                      <td className="font-medium">
                        <div>
                          <p>{r.user?.name}</p>
                          <span className="font-label-sm text-label-sm text-outline">{r.user?.employeeId}</span>
                        </div>
                      </td>
                      <td><span className="badge-neutral">{r.user?.department?.code || r.user?.department?.name || '—'}</span></td>
                      <td className="text-secondary font-mono text-xs">{dateStr}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="text-secondary text-sm">{r.remarks || '—'}</td>
                      <td>
                        <button
                          onClick={() => { setCorrectingRecord(r); setNewStatus(r.status === 'On-Leave' ? 'Leave' : r.status); setRemarks(r.remarks || ''); }}
                          className="btn-ghost text-xs py-xs px-sm"
                        >
                          Correct
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Correction Modal */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg max-w-md w-full shadow-lg">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-sm">Admin Attendance Correction</h3>
            <p className="font-body-sm text-secondary mb-md">
              Correcting for <strong className="text-on-surface">{correctingRecord.user?.name}</strong> on {new Date(correctingRecord.date).toLocaleDateString('en-IN')}
            </p>
            <form onSubmit={handleCorrectSubmit} className="space-y-md">
              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Status</label>
                <select value={newStatus} onChange={(e) => setNewStatus(e.target.value)} className="bit-input">
                  <option value="Present">Present</option>
                  <option value="Leave">Leave</option>
                  <option value="Absent">Absent</option>
                  <option value="Weekly Off">Weekly Off</option>
                  <option value="Holiday">Holiday</option>
                </select>
              </div>
              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Reason / Remarks</label>
                <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} placeholder="e.g. Administrative adjustment" className="bit-input" required />
              </div>
              <div className="flex gap-sm justify-end pt-sm border-t border-outline-variant">
                <button type="button" onClick={() => setCorrectingRecord(null)} className="btn-ghost">Cancel</button>
                <button type="submit" disabled={submitting} className="btn-primary">{submitting ? 'Saving...' : 'Apply Correction'}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminAttendancePage;
