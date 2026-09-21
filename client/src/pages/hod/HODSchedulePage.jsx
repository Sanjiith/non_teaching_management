import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import {
  getDepartmentSchedules,
  getShifts,
  assignSchedule,
  updateSchedule,
  deleteSchedule,
} from '../../services/schedule.service';
import api from '../../services/api';

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

const HODSchedulePage = () => {
  const [schedules, setSchedules] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modals
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Assign Form State
  const [selectedStaff, setSelectedStaff] = useState('');
  const [selectedShift, setSelectedShift] = useState('');
  const [assignDate, setAssignDate] = useState(new Date().toISOString().split('T')[0]);
  const [customStartTime, setCustomStartTime] = useState('');
  const [customEndTime, setCustomEndTime] = useState('');
  const [assignRemarks, setAssignRemarks] = useState('');
  const [formError, setFormError] = useState('');
  const [formWarning, setFormWarning] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit status state
  const [editStatus, setEditStatus] = useState('Scheduled');
  const [editRemarks, setEditRemarks] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedData, shiftData, usersRes] = await Promise.all([
        getDepartmentSchedules({
          status: statusFilter || undefined,
          date: dateFilter || undefined,
        }),
        getShifts({ isActive: true }),
        api.get('/users', { params: { role: 'Staff' } }),
      ]);
      setSchedules(schedData || []);
      setShifts(shiftData || []);
      setStaffList(usersRes.data?.data?.users || []);
    } catch (err) {
      console.error('Error loading HOD schedule data:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter, dateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Handle shift template change in assign form
  const handleShiftSelect = (shiftId) => {
    setSelectedShift(shiftId);
    const found = shifts.find((s) => s._id === shiftId);
    if (found) {
      setCustomStartTime(found.startTime);
      setCustomEndTime(found.endTime);
    }
  };

  const handleOpenAssignModal = () => {
    setFormError('');
    setFormWarning('');
    setSelectedStaff(staffList[0]?._id || '');
    if (shifts.length > 0) {
      setSelectedShift(shifts[0]._id);
      setCustomStartTime(shifts[0].startTime);
      setCustomEndTime(shifts[0].endTime);
    }
    setAssignRemarks('');
    setIsAssignModalOpen(true);
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormWarning('');
    setSubmitting(true);

    try {
      const res = await assignSchedule({
        staff: selectedStaff,
        shift: selectedShift,
        date: assignDate,
        startTime: customStartTime,
        endTime: customEndTime,
        remarks: assignRemarks,
      });

      if (res.data?.hasConflict) {
        alert(
          '⚠️ Notice: Staff member has approved leave on this date. Schedule was assigned with status "On Leave".'
        );
      }

      setIsAssignModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to assign shift schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleOpenEdit = (sched) => {
    setEditingSchedule(sched);
    setEditStatus(sched.status);
    setEditRemarks(sched.remarks || '');
  };

  const handleEditSubmit = async (e) => {
    e.preventDefault();
    if (!editingSchedule) return;
    setSubmitting(true);
    try {
      await updateSchedule(editingSchedule._id, {
        status: editStatus,
        remarks: editRemarks,
      });
      setEditingSchedule(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (schedId) => {
    if (!window.confirm('Are you sure you want to remove this shift assignment?')) return;
    try {
      await deleteSchedule(schedId);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete schedule.');
    }
  };

  const todayStr = new Date().toISOString().split('T')[0];
  const todaySchedules = schedules.filter(
    (s) => new Date(s.date).toISOString().split('T')[0] === todayStr
  );
  const conflictCount = schedules.filter((s) => s.status === 'On Leave' || s.status === 'Conflict').length;

  const formatDate = (dateString) => {
    if (!dateString) return '—';
    const d = new Date(dateString);
    return d.toLocaleDateString('en-IN', {
      weekday: 'short',
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    });
  };

  return (
    <div className="space-y-lg">
      {/* Page Header */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h1 className="page-title">Department Shift Schedules</h1>
          <p className="page-subtitle">
            Manage work rosters, assign duty shifts, and resolve leave schedule conflicts
          </p>
        </div>
        <button
          onClick={handleOpenAssignModal}
          className="btn-primary flex items-center gap-xs"
        >
          <span className="material-symbols-outlined text-lg">add_circle</span>
          Assign Shift
        </button>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <KPICard
          label="Total Scheduled"
          value={schedules.length}
          icon="event"
          sub="Department duties"
          valueColor="text-primary"
        />
        <KPICard
          label="On Duty Today"
          value={todaySchedules.length}
          icon="groups"
          sub="Staff assigned today"
          valueColor="text-secondary"
        />
        <KPICard
          label="Leave Conflicts"
          value={conflictCount}
          icon="warning"
          sub="Shifts during approved leave"
          valueColor={conflictCount > 0 ? 'text-warning' : 'text-on-surface'}
        />
        <KPICard
          label="Shift Templates"
          value={shifts.length}
          icon="schedule"
          sub="Available configurations"
          valueColor="text-on-surface"
        />
      </div>

      {/* Main Table Card */}
      <div className="card p-md">
        {/* Filters */}
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md mb-md pb-md border-b border-outline-variant">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary text-xl">calendar_month</span>
            <h2 className="font-title-md text-title-md text-on-surface">Department Staff Rosters</h2>
            <span className="text-xs text-outline">({schedules.length} total)</span>
          </div>

          <div className="flex flex-wrap items-center gap-sm w-full sm:w-auto">
            {/* Date filter */}
            <input
              type="date"
              value={dateFilter}
              onChange={(e) => setDateFilter(e.target.value)}
              className="bit-input text-xs py-1 px-2 border rounded-md"
            />
            {dateFilter && (
              <button
                onClick={() => setDateFilter('')}
                className="text-xs text-outline hover:text-error"
                title="Clear date filter"
              >
                Clear Date
              </button>
            )}

            {/* Status filter */}
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="bit-input text-xs py-1 px-2 border rounded-md"
            >
              <option value="">All Statuses</option>
              <option value="Scheduled">Scheduled</option>
              <option value="Completed">Completed</option>
              <option value="On Leave">On Leave</option>
              <option value="Cancelled">Cancelled</option>
            </select>
          </div>
        </div>

        {/* Schedule List */}
        {loading ? (
          <div className="text-center py-xl text-outline">Loading department schedules...</div>
        ) : schedules.length === 0 ? (
          <div className="text-center py-xl space-y-sm">
            <span className="material-symbols-outlined text-4xl text-outline">event_busy</span>
            <p className="font-body-md text-body-md text-outline">No schedules found matching criteria.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-label-md text-secondary uppercase tracking-wider">
                  <th className="py-sm px-md">Staff Member</th>
                  <th className="py-sm px-md">Shift Details</th>
                  <th className="py-sm px-md">Date & Day</th>
                  <th className="py-sm px-md">Timings</th>
                  <th className="py-sm px-md">Status</th>
                  <th className="py-sm px-md">Remarks / Conflict</th>
                  <th className="py-sm px-md text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
                {schedules.map((item) => {
                  const isConflict = item.status === 'On Leave' || item.status === 'Conflict';
                  return (
                    <tr
                      key={item._id}
                      className={`hover:bg-surface-container/50 transition-colors ${
                        isConflict ? 'bg-warning/5' : ''
                      }`}
                    >
                      <td className="py-sm px-md">
                        <div className="font-semibold text-on-surface">
                          {item.staff?.name || 'Staff Member'}
                        </div>
                        <div className="text-xs text-outline font-mono">
                          {item.staff?.staffId || item.staff?.employeeId || '—'} • {item.staff?.designation || 'Staff'}
                        </div>
                      </td>
                      <td className="py-sm px-md">
                        <div className="font-medium text-primary">
                          {item.shift?.name || 'Shift'}
                        </div>
                        <div className="text-xs text-outline">
                          {item.shift?.workingHours ? `${item.shift.workingHours} hrs` : '8 hrs'}
                        </div>
                      </td>
                      <td className="py-sm px-md whitespace-nowrap">
                        <span className="font-medium text-on-surface">{formatDate(item.date)}</span>
                      </td>
                      <td className="py-sm px-md whitespace-nowrap">
                        <span className="font-mono text-xs bg-surface-container px-2 py-0.5 rounded border border-outline-variant">
                          {item.startTime} – {item.endTime}
                        </span>
                      </td>
                      <td className="py-sm px-md">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-sm px-md max-w-xs">
                        {item.remarks ? (
                          <span
                            className={`text-xs ${
                              isConflict ? 'text-warning font-semibold' : 'text-secondary'
                            }`}
                          >
                            {item.remarks}
                          </span>
                        ) : (
                          <span className="text-outline text-xs">—</span>
                        )}
                      </td>
                      <td className="py-sm px-md text-right whitespace-nowrap">
                        <div className="flex items-center justify-end gap-xs">
                          <button
                            onClick={() => handleOpenEdit(item)}
                            className="p-1 rounded hover:bg-surface-container text-secondary hover:text-primary transition-colors"
                            title="Edit Status"
                          >
                            <span className="material-symbols-outlined text-lg">edit</span>
                          </button>
                          <button
                            onClick={() => handleDelete(item._id)}
                            className="p-1 rounded hover:bg-surface-container text-secondary hover:text-error transition-colors"
                            title="Delete Schedule"
                          >
                            <span className="material-symbols-outlined text-lg">delete</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Assign Shift Modal */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-md">
          <div className="card w-full max-w-lg p-lg space-y-md bg-surface shadow-xl animate-scaleUp">
            <div className="flex justify-between items-center pb-sm border-b border-outline-variant">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Assign Staff Shift</h3>
              <button
                onClick={() => setIsAssignModalOpen(false)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {formError && (
              <div className="p-sm bg-error/10 border border-error/30 text-error rounded-md text-sm">
                {formError}
              </div>
            )}

            <form onSubmit={handleAssignSubmit} className="space-y-md">
              {/* Staff Select */}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Staff Member
                </label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  required
                  className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                >
                  {staffList.map((st) => (
                    <option key={st._id} value={st._id}>
                      {st.name} ({st.staffId || st.employeeId}) — {st.designation || 'Staff'}
                    </option>
                  ))}
                </select>
              </div>

              {/* Shift Select */}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Shift Template
                </label>
                <select
                  value={selectedShift}
                  onChange={(e) => handleShiftSelect(e.target.value)}
                  required
                  className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                >
                  {shifts.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.startTime} - {s.endTime} | {s.workingHours || 8} hrs)
                    </option>
                  ))}
                </select>
              </div>

              {/* Date */}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Schedule Date
                </label>
                <input
                  type="date"
                  value={assignDate}
                  onChange={(e) => setAssignDate(e.target.value)}
                  required
                  className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                >
                </input>
              </div>

              {/* Timings */}
              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={customStartTime}
                    onChange={(e) => setCustomStartTime(e.target.value)}
                    required
                    className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                    End Time
                  </label>
                  <input
                    type="time"
                    value={customEndTime}
                    onChange={(e) => setCustomEndTime(e.target.value)}
                    required
                    className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                  />
                </div>
              </div>

              {/* Remarks */}
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Remarks / Duty Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Lab server duty, Morning supervision"
                  value={assignRemarks}
                  onChange={(e) => setAssignRemarks(e.target.value)}
                  className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                />
              </div>

              <div className="flex justify-end gap-sm pt-sm border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setIsAssignModalOpen(false)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Assigning...' : 'Confirm Assignment'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Edit Status Modal */}
      {editingSchedule && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-md">
          <div className="card w-full max-w-md p-lg space-y-md bg-surface shadow-xl animate-scaleUp">
            <div className="flex justify-between items-center pb-sm border-b border-outline-variant">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Update Schedule Status</h3>
              <button
                onClick={() => setEditingSchedule(null)}
                className="text-outline hover:text-on-surface"
              >
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <form onSubmit={handleEditSubmit} className="space-y-md">
              <div>
                <p className="text-sm font-medium text-on-surface">
                  Staff: <span className="font-bold">{editingSchedule.staff?.name}</span>
                </p>
                <p className="text-xs text-outline">
                  Date: {formatDate(editingSchedule.date)} ({editingSchedule.startTime} – {editingSchedule.endTime})
                </p>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Status
                </label>
                <select
                  value={editStatus}
                  onChange={(e) => setEditStatus(e.target.value)}
                  className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                >
                  <option value="Scheduled">Scheduled</option>
                  <option value="Completed">Completed</option>
                  <option value="On Leave">On Leave</option>
                  <option value="Cancelled">Cancelled</option>
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Remarks
                </label>
                <input
                  type="text"
                  value={editRemarks}
                  onChange={(e) => setEditRemarks(e.target.value)}
                  className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                />
              </div>

              <div className="flex justify-end gap-sm pt-sm border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setEditingSchedule(null)}
                  className="btn-secondary"
                  disabled={submitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-primary"
                  disabled={submitting}
                >
                  {submitting ? 'Saving...' : 'Save Changes'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODSchedulePage;
