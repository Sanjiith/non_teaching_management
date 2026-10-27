import { useState, useEffect, useCallback, useMemo } from 'react';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import { getDepartmentAttendance, markOrCorrectAttendance } from '../../services/attendance.service';
import { getHODAttendanceReport } from '../../services/report.service';
import { exportCSV, getAttendanceRateColor } from '../../utils/exportCSV';
import { consolidateAttendanceRecords } from '../../utils/attendanceHelper';

const HODAttendancePage = () => {
  const { user } = useAuth();
  const now = new Date();
  const [records, setRecords] = useState([]);
  const [reportStats, setReportStats] = useState(null);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [selectedMonth, setSelectedMonth] = useState('');
  const [selectedYear, setSelectedYear] = useState(now.getFullYear());
  const [correctingRecord, setCorrectingRecord] = useState(null);
  const [newStatus, setNewStatus] = useState('Present');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const [listData, reportData] = await Promise.all([
        getDepartmentAttendance({
          status: statusFilter || undefined,
          month: selectedMonth || undefined,
          year: selectedYear || undefined,
        }),
        getHODAttendanceReport({ month: selectedMonth || undefined, year: selectedYear }),
      ]);
      setRecords(listData.records || []);
      if (reportData) setReportStats(reportData.stats);
    } catch (err) {
      console.error('Error fetching department attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, selectedMonth, selectedYear]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  // Consolidate multi-day leaves into single entries
  const displayRecords = useMemo(() => consolidateAttendanceRecords(records), [records]);

  const handleCorrectSubmit = async (e) => {
    e.preventDefault();
    if (!correctingRecord) return;

    setSubmitting(true);
    try {
      if (correctingRecord.records && correctingRecord.records.length > 1) {
        // Update all individual attendance records belonging to this leave
        await Promise.all(
          correctingRecord.records.map((rec) =>
            markOrCorrectAttendance({
              user: rec.user?._id || rec.user,
              date: rec.date,
              status: newStatus,
              remarks: remarks || 'Corrected by HOD',
            })
          )
        );
      } else {
        await markOrCorrectAttendance({
          user: correctingRecord.user?._id || correctingRecord.user,
          date: correctingRecord.date,
          status: newStatus,
          remarks: remarks || 'Corrected by HOD',
        });
      }
      setCorrectingRecord(null);
      setRemarks('');
      fetchAttendance();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  const onLeaveCount = reportStats?.Leave !== undefined
    ? reportStats.Leave
    : displayRecords.filter((r) => r.status === 'Leave' || r.status === 'On-Leave').length;

  return (
    <div className="space-y-lg">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Department Attendance</h2>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            Monitor and adjust daily attendance for staff in {user?.department?.name || 'your department'}
          </p>
        </div>
        <div className="flex flex-wrap gap-sm items-center">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value ? Number(e.target.value) : '')} className="bit-input py-xs text-body-sm w-36">
            <option value="">All Months</option>
            {['January','February','March','April','May','June','July','August','September','October','November','December'].map((m,i) => (
              <option key={i+1} value={i+1}>{m}</option>
            ))}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bit-input py-xs text-body-sm w-28">
            {[2024,2025,2026,2027].map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)} className="bit-input py-xs text-body-sm w-36">
            <option value="">All Statuses</option>
            <option value="Present">Present</option>
            <option value="Leave">Leave</option>
            <option value="Absent">Absent</option>
            <option value="Weekly Off">Weekly Off</option>
            <option value="Holiday">Holiday</option>
          </select>
          <button
            onClick={() => {
              const cols = [
                { key: 'employee', label: 'Employee', getValue: (r) => r.user?.name || '—' },
                { key: 'employeeId', label: 'Employee ID', getValue: (r) => r.user?.employeeId || '—' },
                { key: 'date', label: 'Date', getValue: (r) => r.dateDisplay || new Date(r.date).toLocaleDateString('en-IN') },
                { key: 'status', label: 'Status', getValue: (r) => r.status },
                { key: 'remarks', label: 'Remarks', getValue: (r) => r.remarksDisplay || r.remarks || '' },
              ];
              exportCSV(displayRecords, `Dept_Attendance_${selectedYear}`, cols);
            }}
            className="btn-secondary"
          >
            <span className="material-symbols-outlined text-sm">download</span> Export
          </button>
        </div>
      </div>

      {/* Dept Summary Stats */}
      {reportStats && (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-md">
          {[
            { label: 'Present', value: reportStats.Present || 0, color: 'text-emerald-600' },
            { label: 'Absent', value: reportStats.Absent || 0, color: 'text-red-600' },
            { label: 'On Leave', value: onLeaveCount, color: 'text-amber-600' },
            { label: 'Holiday', value: reportStats.Holiday || 0, color: 'text-blue-600' },
            { label: 'Weekly Off', value: reportStats['Weekly Off'] || 0, color: 'text-secondary' },
            { label: 'Attendance %', value: `${reportStats.attendanceRate}%`, color: getAttendanceRateColor(reportStats.attendanceRate) },
          ].map(({ label, value, color }) => (
            <div key={label} className="kpi-card">
              <div className="kpi-label">{label}</div>
              <div className={`kpi-value ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bit-card">
        <h3 className="font-title-md text-title-md text-on-surface mb-md">Staff Attendance Records</h3>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-xl">
              <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : displayRecords.length === 0 ? (
            <p className="text-secondary text-center py-xl font-body-sm">
              No attendance records found.
            </p>
          ) : (
            <table className="bit-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Designation</th>
                  <th>Date</th>
                  <th>Status</th>
                  <th>Remarks</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {displayRecords.map((r) => {
                  const d = new Date(r.date);
                  const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <tr key={r._id}>
                      <td className="font-medium">{r.user?.name}</td>
                      <td className="text-secondary">{r.user?.designation || 'Staff'}</td>
                      <td className="text-secondary font-mono text-xs whitespace-nowrap">
                        {r.dateDisplay || dateStr}
                      </td>
                      <td>
                        <div className="flex flex-col gap-0.5 items-start">
                          <StatusBadge status={r.status} />
                          {r.status === 'Absent' && (r.absenceType === 'Uninformed Absence' || r.remarks?.includes('Uninformed')) && (
                            <span className="badge-error text-[11px] py-0 px-1.5 font-medium">
                              Uninformed Absence
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="text-secondary text-sm">
                        <div className="flex items-center gap-xs flex-wrap">
                          <span>{r.remarksDisplay || r.remarks || '—'}</span>
                          {r.isGrouped && r.totalDays > 1 && (
                            <span className="badge-neutral text-[11px] py-0 px-1.5 font-medium text-outline">
                              {r.duration}
                            </span>
                          )}
                        </div>
                      </td>
                      <td>
                        <button
                          onClick={() => {
                            setCorrectingRecord(r);
                            setNewStatus(r.status === 'On-Leave' ? 'Leave' : r.status);
                            setRemarks(r.remarks || '');
                          }}
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

      {/* Attendance Correction Modal */}
      {correctingRecord && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-xs p-md">
          <div className="bg-surface-container-lowest border border-outline-variant rounded-lg p-lg max-w-md w-full shadow-lg">
            <h3 className="font-headline-sm text-headline-sm text-on-surface mb-sm">Correct Attendance</h3>
            <p className="font-body-sm text-secondary mb-md">
              Updating record for <strong className="text-on-surface">{correctingRecord.user?.name}</strong>{' '}
              {correctingRecord.dateDisplay
                ? `for ${correctingRecord.dateDisplay}${correctingRecord.duration ? ` (${correctingRecord.duration})` : ''}`
                : `on ${new Date(correctingRecord.date).toLocaleDateString('en-IN')}`}
            </p>

            <form onSubmit={handleCorrectSubmit} className="space-y-md">
              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Status</label>
                <select
                  value={newStatus}
                  onChange={(e) => setNewStatus(e.target.value)}
                  className="bit-input"
                >
                  <option value="Present">Present</option>
                  <option value="Leave">Leave</option>
                  <option value="Absent">Absent</option>
                  <option value="Weekly Off">Weekly Off</option>
                  <option value="Holiday">Holiday</option>
                </select>
              </div>

              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Correction Remarks</label>
                <input
                  type="text"
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  placeholder="e.g. Corrected on-duty lab schedule"
                  className="bit-input"
                  required
                />
              </div>

              <div className="flex gap-sm justify-end pt-sm border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setCorrectingRecord(null)}
                  className="btn-ghost"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn-primary"
                >
                  {submitting ? 'Saving...' : 'Save Correction'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODAttendancePage;
