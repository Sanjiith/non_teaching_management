import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import { getDailyStaffAttendance } from '../../services/attendance.service';

const HODStaffPage = () => {
  const { user } = useAuth();
  const todayStr = new Date().toISOString().split('T')[0];

  const [staffData, setStaffData] = useState({
    records: [],
    totalStaff: 0,
    presentCount: 0,
    absentCount: 0,
    leaveCount: 0,
    pendingCount: 0,
    window: null,
  });
  const [loading, setLoading] = useState(true);
  const [selectedDate, setSelectedDate] = useState(todayStr);
  const [statusFilter, setStatusFilter] = useState('');
  const [searchTerm, setSearchTerm] = useState('');

  const fetchDepartmentStaff = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDailyStaffAttendance({
        date: selectedDate,
        status: statusFilter || undefined,
        search: searchTerm || undefined,
      });
      setStaffData({
        records: data.records || [],
        totalStaff: data.totalStaff || 0,
        presentCount: data.presentCount || 0,
        absentCount: data.absentCount || 0,
        leaveCount: data.leaveCount || 0,
        pendingCount: data.pendingCount || 0,
        window: data.window || null,
      });
    } catch (err) {
      console.error('Error fetching department staff attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, statusFilter, searchTerm]);

  useEffect(() => {
    fetchDepartmentStaff();
  }, [fetchDepartmentStaff]);

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    fetchDepartmentStaff();
  };

  const departmentName = user?.department?.name || 'Department';
  const departmentCode = user?.department?.code || '';

  return (
    <div className="space-y-lg">
      {/* ── Page Header ─────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <div className="flex items-center gap-xs">
            <h2 className="font-headline-md text-headline-md text-on-surface">Department Staff</h2>
            {departmentCode && <span className="badge-neutral">{departmentCode}</span>}
          </div>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            Daily attendance status and check-in records for all non-teaching staff in {departmentName}
          </p>
        </div>

        {/* Date Selector */}
        <div className="flex items-center gap-sm">
          <label className="font-label-md text-secondary whitespace-nowrap">Attendance Date:</label>
          <input
            type="date"
            value={selectedDate}
            onChange={(e) => setSelectedDate(e.target.value)}
            className="bit-input py-xs text-body-sm"
          />
        </div>
      </div>

      {/* ── KPI Summary Cards ────────────────────────────────────── */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-md">
        <div className="kpi-card">
          <div className="kpi-label">Total Staff</div>
          <div className="kpi-value text-on-surface">{staffData.totalStaff}</div>
          <div className="kpi-sub">In department</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Present</div>
          <div className="kpi-value text-emerald-600">{staffData.presentCount}</div>
          <div className="kpi-sub">Checked in</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">Absent</div>
          <div className="kpi-value text-red-600">{staffData.absentCount}</div>
          <div className="kpi-sub">{staffData.window?.isClosed ? 'Window closed' : 'Unchecked'}</div>
        </div>
        <div className="kpi-card">
          <div className="kpi-label">On Leave</div>
          <div className="kpi-value text-amber-600">{staffData.leaveCount}</div>
          <div className="kpi-sub">Approved leaves</div>
        </div>
        <div className="kpi-card col-span-2 sm:col-span-1">
          <div className="kpi-label">Pending Check-In</div>
          <div className="kpi-value text-primary">{staffData.pendingCount}</div>
          <div className="kpi-sub">Window active</div>
        </div>
      </div>

      {/* ── Filter Bar & Staff Table Card ────────────────────────── */}
      <div className="bit-card space-y-md">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-sm">
          {/* Status Filter */}
          <div className="flex items-center gap-xs">
            <span className="font-label-md text-secondary">Status:</span>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bit-input py-xs text-body-sm w-44"
            >
              <option value="">All Statuses</option>
              <option value="Present">Present</option>
              <option value="Absent">Absent</option>
              <option value="Leave">On Leave</option>
              <option value="Pending Check-In">Pending Check-In</option>
            </select>
          </div>

          {/* Search Form */}
          <form onSubmit={handleSearchSubmit} className="flex gap-xs w-full sm:w-auto">
            <input
              type="text"
              placeholder="Search by ID or Name..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bit-input py-xs w-full sm:w-64 text-body-sm"
            />
            <button type="submit" className="btn-secondary py-xs text-sm">
              Search
            </button>
            {searchTerm && (
              <button
                type="button"
                onClick={() => {
                  setSearchTerm('');
                  fetchDepartmentStaff();
                }}
                className="btn-ghost py-xs text-sm"
              >
                Clear
              </button>
            )}
          </form>
        </div>

        {/* ── Staff Table ────────────────────────────────────────── */}
        {loading ? (
          <p className="text-secondary text-center py-xl">Loading department staff attendance...</p>
        ) : staffData.records.length === 0 ? (
          <p className="text-secondary text-center py-xl">No staff records match the selected criteria.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="bit-table text-sm">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Employee ID</th>
                  <th>Department</th>
                  <th>Designation</th>
                  <th>Attendance Date</th>
                  <th>Check-In Time</th>
                  <th>Attendance Status</th>
                  <th>Remarks</th>
                </tr>
              </thead>
              <tbody>
                {staffData.records.map((staff) => (
                  <tr key={staff._id}>
                    <td>
                      <div className="font-medium text-on-surface">{staff.name}</div>
                      <div className="text-xs text-secondary">{staff.user?.email || '—'}</div>
                    </td>
                    <td>
                      <span className="font-mono text-xs font-semibold text-primary">
                        {staff.employeeId}
                      </span>
                    </td>
                    <td>
                      <span className="badge-neutral">
                        {staff.department?.code || departmentCode || '—'}
                      </span>
                    </td>
                    <td className="text-secondary">{staff.designation || 'Staff'}</td>
                    <td className="font-medium">
                      {new Date(staff.date).toLocaleDateString('en-IN', {
                        day: 'numeric',
                        month: 'short',
                        year: 'numeric',
                        timeZone: 'UTC',
                      })}
                    </td>
                    <td>
                      {staff.checkInFormatted && staff.checkInFormatted !== '—' ? (
                        <span className="font-mono text-emerald-700 font-semibold bg-emerald-50 dark:bg-emerald-950/30 px-2 py-0.5 rounded">
                          {staff.checkInFormatted}
                        </span>
                      ) : (
                        <span className="text-outline italic">—</span>
                      )}
                    </td>
                    <td>
                      <div className="flex flex-col gap-0.5 items-start">
                        <StatusBadge status={staff.status} />
                        {staff.status === 'Absent' && (staff.absenceType === 'Uninformed Absence' || staff.remarks?.includes('Uninformed')) && (
                          <span className="badge-error text-[11px] py-0 px-1.5 font-medium">
                            Uninformed Absence
                          </span>
                        )}
                        {staff.status === 'Absent' && staff.dailyDeduction > 0 && (
                          <span className="text-[11px] text-red-600 font-medium">
                            -₹{staff.dailyDeduction.toLocaleString('en-IN')} deduction
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="text-xs text-secondary max-w-xs truncate">
                      {staff.remarks || '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default HODStaffPage;
