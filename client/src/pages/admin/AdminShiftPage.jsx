import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import {
  getAllSchedules,
  getShifts,
  createShift,
  updateShift,
  deleteShift,
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

const AdminShiftPage = () => {
  const [activeTab, setActiveTab] = useState('schedules'); // 'schedules' | 'shifts'
  const [schedules, setSchedules] = useState([]);
  const [shifts, setShifts] = useState([]);
  const [departments, setDepartments] = useState([]);
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);

  // Filters for schedules
  const [selectedDeptFilter, setSelectedDeptFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  // Modals
  const [isShiftModalOpen, setIsShiftModalOpen] = useState(false);
  const [isAssignModalOpen, setIsAssignModalOpen] = useState(false);
  const [editingShift, setEditingShift] = useState(null);
  const [editingSchedule, setEditingSchedule] = useState(null);

  // Shift Template Form State
  const [shiftForm, setShiftForm] = useState({
    name: '',
    startTime: '09:00',
    endTime: '17:00',
    workingHours: 8,
    department: '',
    description: '',
    isActive: true,
  });

  // Assign Schedule Form State
  const [assignForm, setAssignForm] = useState({
    staff: '',
    shift: '',
    date: new Date().toISOString().split('T')[0],
    startTime: '09:00',
    endTime: '17:00',
    remarks: '',
  });

  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // Edit Schedule State
  const [editSchedStatus, setEditSchedStatus] = useState('Scheduled');
  const [editSchedRemarks, setEditSchedRemarks] = useState('');

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [schedData, shiftData, deptsRes, usersRes] = await Promise.all([
        getAllSchedules({
          department: selectedDeptFilter || undefined,
          status: statusFilter || undefined,
          date: dateFilter || undefined,
        }),
        getShifts(),
        api.get('/departments'),
        api.get('/users', { params: { role: 'Staff' } }),
      ]);
      setSchedules(schedData || []);
      setShifts(shiftData || []);
      setDepartments(deptsRes.data?.data?.departments || deptsRes.data?.data || []);
      setStaffList(usersRes.data?.data?.users || []);
    } catch (err) {
      console.error('Error loading admin shifts data:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedDeptFilter, statusFilter, dateFilter]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Recalculate working hours in shift form
  const handleShiftTimeChange = (field, val) => {
    const updated = { ...shiftForm, [field]: val };
    const [sH, sM] = updated.startTime.split(':').map(Number);
    const [eH, eM] = updated.endTime.split(':').map(Number);
    let diff = (eH * 60 + eM) - (sH * 60 + sM);
    if (diff < 0) diff += 24 * 60;
    updated.workingHours = parseFloat((diff / 60).toFixed(1));
    setShiftForm(updated);
  };

  // Open Create Shift Modal
  const handleOpenCreateShift = () => {
    setEditingShift(null);
    setShiftForm({
      name: '',
      startTime: '09:00',
      endTime: '17:00',
      workingHours: 8,
      department: '',
      description: '',
      isActive: true,
    });
    setFormError('');
    setIsShiftModalOpen(true);
  };

  // Open Edit Shift Modal
  const handleOpenEditShift = (shift) => {
    setEditingShift(shift);
    setShiftForm({
      name: shift.name,
      startTime: shift.startTime,
      endTime: shift.endTime,
      workingHours: shift.workingHours || 8,
      department: shift.department?._id || shift.department || '',
      description: shift.description || '',
      isActive: shift.isActive !== undefined ? shift.isActive : true,
    });
    setFormError('');
    setIsShiftModalOpen(true);
  };

  // Submit Shift (Create or Edit)
  const handleShiftSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      if (editingShift) {
        await updateShift(editingShift._id, shiftForm);
      } else {
        await createShift(shiftForm);
      }
      setIsShiftModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to save shift template.');
    } finally {
      setSubmitting(false);
    }
  };

  // Deactivate or Delete Shift
  const handleDeleteShift = async (shiftId) => {
    if (!window.confirm('Are you sure you want to delete or deactivate this shift?')) return;
    try {
      const res = await deleteShift(shiftId);
      alert(res.message || 'Shift deleted/deactivated successfully');
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete shift.');
    }
  };

  // Open Assign Modal
  const handleOpenAssignModal = () => {
    setFormError('');
    const firstStaff = staffList[0]?._id || '';
    const firstShift = shifts[0];
    setAssignForm({
      staff: firstStaff,
      shift: firstShift?._id || '',
      date: new Date().toISOString().split('T')[0],
      startTime: firstShift?.startTime || '09:00',
      endTime: firstShift?.endTime || '17:00',
      remarks: '',
    });
    setIsAssignModalOpen(true);
  };

  const handleAssignShiftSelect = (shiftId) => {
    const found = shifts.find((s) => s._id === shiftId);
    setAssignForm((prev) => ({
      ...prev,
      shift: shiftId,
      startTime: found ? found.startTime : prev.startTime,
      endTime: found ? found.endTime : prev.endTime,
    }));
  };

  const handleAssignSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setSubmitting(true);
    try {
      const res = await assignSchedule(assignForm);
      if (res.data?.hasConflict) {
        alert(
          '⚠️ Notice: Staff member has approved leave on this date. Schedule was assigned with status "On Leave".'
        );
      }
      setIsAssignModalOpen(false);
      loadData();
    } catch (err) {
      setFormError(err.response?.data?.message || 'Failed to assign shift.');
    } finally {
      setSubmitting(false);
    }
  };

  // Edit Schedule
  const handleOpenEditSchedule = (sched) => {
    setEditingSchedule(sched);
    setEditSchedStatus(sched.status);
    setEditSchedRemarks(sched.remarks || '');
  };

  const handleEditScheduleSubmit = async (e) => {
    e.preventDefault();
    if (!editingSchedule) return;
    setSubmitting(true);
    try {
      await updateSchedule(editingSchedule._id, {
        status: editSchedStatus,
        remarks: editSchedRemarks,
      });
      setEditingSchedule(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update schedule.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDeleteSchedule = async (schedId) => {
    if (!window.confirm('Are you sure you want to remove this schedule assignment?')) return;
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
          <h1 className="page-title">Shift Management & Rostering</h1>
          <p className="page-subtitle">
            Configure college-wide shift templates, manage duty timings, and monitor all department schedules
          </p>
        </div>
        <div className="flex items-center gap-sm">
          <button
            onClick={handleOpenCreateShift}
            className="btn-secondary flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-lg">tune</span>
            New Shift Template
          </button>
          <button
            onClick={handleOpenAssignModal}
            className="btn-primary flex items-center gap-xs"
          >
            <span className="material-symbols-outlined text-lg">calendar_add_on</span>
            Assign Shift
          </button>
        </div>
      </div>

      {/* KPI Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <KPICard
          label="Shift Templates"
          value={shifts.length}
          icon="schedule"
          sub="Configured shift timings"
          valueColor="text-primary"
        />
        <KPICard
          label="Total Scheduled"
          value={schedules.length}
          icon="event_note"
          sub="All assigned duty records"
          valueColor="text-secondary"
        />
        <KPICard
          label="On Duty Today"
          value={todaySchedules.length}
          icon="groups"
          sub="Staff scheduled today"
          valueColor="text-success"
        />
        <KPICard
          label="Leave Conflicts"
          value={conflictCount}
          icon="warning"
          sub="Shifts during approved leave"
          valueColor={conflictCount > 0 ? 'text-warning' : 'text-on-surface'}
        />
      </div>

      {/* Tabs */}
      <div className="flex border-b border-outline-variant gap-lg font-title-sm text-title-sm">
        <button
          onClick={() => setActiveTab('schedules')}
          className={`pb-sm flex items-center gap-xs transition-colors border-b-2 font-medium ${
            activeTab === 'schedules'
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">calendar_month</span>
          All Department Rosters ({schedules.length})
        </button>
        <button
          onClick={() => setActiveTab('shifts')}
          className={`pb-sm flex items-center gap-xs transition-colors border-b-2 font-medium ${
            activeTab === 'shifts'
              ? 'border-primary text-primary'
              : 'border-transparent text-secondary hover:text-on-surface'
          }`}
        >
          <span className="material-symbols-outlined text-lg">access_time</span>
          Shift Templates ({shifts.length})
        </button>
      </div>

      {/* TAB 1: Schedules / Rosters */}
      {activeTab === 'schedules' && (
        <div className="card p-md">
          {/* Filter Bar */}
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md mb-md pb-md border-b border-outline-variant">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-xl">view_timeline</span>
              <h2 className="font-title-md text-title-md text-on-surface">Institutional Schedule Records</h2>
            </div>

            <div className="flex flex-wrap items-center gap-sm w-full sm:w-auto">
              {/* Department filter */}
              <select
                value={selectedDeptFilter}
                onChange={(e) => setSelectedDeptFilter(e.target.value)}
                className="bit-input text-xs py-1 px-2 border rounded-md"
              >
                <option value="">All Departments</option>
                {departments.map((d) => (
                  <option key={d._id} value={d._id}>
                    {d.name} ({d.code})
                  </option>
                ))}
              </select>

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

          {loading ? (
            <div className="text-center py-xl text-outline">Loading institutional schedules...</div>
          ) : schedules.length === 0 ? (
            <div className="text-center py-xl space-y-sm">
              <span className="material-symbols-outlined text-4xl text-outline">event_busy</span>
              <p className="font-body-md text-body-md text-outline">No schedule records found.</p>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left border-collapse">
                <thead>
                  <tr className="border-b border-outline-variant text-label-md text-secondary uppercase tracking-wider">
                    <th className="py-sm px-md">Staff Member</th>
                    <th className="py-sm px-md">Department</th>
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
                          <span className="px-2 py-0.5 rounded text-xs font-semibold bg-surface-container border border-outline-variant">
                            {item.department?.code || 'General'}
                          </span>
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
                              onClick={() => handleOpenEditSchedule(item)}
                              className="p-1 rounded hover:bg-surface-container text-secondary hover:text-primary transition-colors"
                              title="Edit Status & Remarks"
                            >
                              <span className="material-symbols-outlined text-lg">edit</span>
                            </button>
                            <button
                              onClick={() => handleDeleteSchedule(item._id)}
                              className="p-1 rounded hover:bg-surface-container text-secondary hover:text-error transition-colors"
                              title="Delete Assignment"
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
      )}

      {/* TAB 2: Shift Templates */}
      {activeTab === 'shifts' && (
        <div className="card p-md">
          <div className="flex justify-between items-center mb-md pb-md border-b border-outline-variant">
            <div>
              <h2 className="font-title-md text-title-md text-on-surface">Shift Templates & Configurations</h2>
              <p className="text-xs text-secondary mt-0.5">
                Standard duty hours, departmental shifts, and surveillance schedules
              </p>
            </div>
            <button
              onClick={handleOpenCreateShift}
              className="btn-primary text-xs flex items-center gap-xs"
            >
              <span className="material-symbols-outlined text-base">add</span>
              Add Shift
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-md">
            {shifts.map((s) => (
              <div
                key={s._id}
                className={`p-md rounded-xl border transition-all ${
                  s.isActive
                    ? 'border-outline-variant bg-surface hover:shadow-md'
                    : 'border-outline-variant/50 bg-surface-container/30 opacity-60'
                }`}
              >
                <div className="flex justify-between items-start mb-sm">
                  <div>
                    <h3 className="font-title-md text-title-md text-on-surface font-semibold">{s.name}</h3>
                    <span className="text-xs text-outline">
                      {s.department ? `Department: ${s.department.name || s.department.code}` : 'Institution-Wide (All Depts)'}
                    </span>
                  </div>
                  <StatusBadge status={s.isActive ? 'Active' : 'Inactive'} />
                </div>

                <div className="space-y-xs my-md bg-surface-container p-sm rounded-lg border border-outline-variant/60">
                  <div className="flex justify-between text-xs">
                    <span className="text-secondary">Timings:</span>
                    <span className="font-mono font-bold text-primary">{s.startTime} – {s.endTime}</span>
                  </div>
                  <div className="flex justify-between text-xs">
                    <span className="text-secondary">Working Duration:</span>
                    <span className="font-bold text-on-surface">{s.workingHours || 8} Hours</span>
                  </div>
                </div>

                {s.description && (
                  <p className="text-xs text-secondary mb-md italic">
                    "{s.description}"
                  </p>
                )}

                <div className="flex justify-end items-center gap-sm pt-sm border-t border-outline-variant">
                  <button
                    onClick={() => handleOpenEditShift(s)}
                    className="btn-secondary text-xs py-1 px-3 flex items-center gap-xs"
                  >
                    <span className="material-symbols-outlined text-sm">edit</span>
                    Edit
                  </button>
                  <button
                    onClick={() => handleDeleteShift(s._id)}
                    className="text-xs text-error hover:underline flex items-center gap-xs py-1 px-2"
                  >
                    <span className="material-symbols-outlined text-sm">delete</span>
                    {s.isActive ? 'Deactivate' : 'Delete'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Modal: Create / Edit Shift Template */}
      {isShiftModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-md">
          <div className="card w-full max-w-lg p-lg space-y-md bg-surface shadow-xl animate-scaleUp">
            <div className="flex justify-between items-center pb-sm border-b border-outline-variant">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">
                {editingShift ? 'Edit Shift Template' : 'Create New Shift Template'}
              </h3>
              <button
                onClick={() => setIsShiftModalOpen(false)}
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

            <form onSubmit={handleShiftSubmit} className="space-y-md">
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Shift Name
                </label>
                <input
                  type="text"
                  placeholder="e.g. Morning Shift, General Shift, Night Surveillance"
                  required
                  value={shiftForm.name}
                  onChange={(e) => setShiftForm({ ...shiftForm, name: e.target.value })}
                  className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                    Start Time (24h)
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.startTime}
                    onChange={(e) => handleShiftTimeChange('startTime', e.target.value)}
                    className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                    End Time (24h)
                  </label>
                  <input
                    type="time"
                    required
                    value={shiftForm.endTime}
                    onChange={(e) => handleShiftTimeChange('endTime', e.target.value)}
                    className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                    Calculated Hours
                  </label>
                  <input
                    type="number"
                    step="0.5"
                    min="0"
                    max="24"
                    value={shiftForm.workingHours}
                    onChange={(e) =>
                      setShiftForm({ ...shiftForm, workingHours: parseFloat(e.target.value) || 0 })
                    }
                    className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                    Department Scope
                  </label>
                  <select
                    value={shiftForm.department}
                    onChange={(e) => setShiftForm({ ...shiftForm, department: e.target.value })}
                    className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                  >
                    <option value="">All Departments (General)</option>
                    {departments.map((d) => (
                      <option key={d._id} value={d._id}>
                        {d.name} ({d.code})
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Description
                </label>
                <textarea
                  rows="2"
                  placeholder="Optional notes regarding duty coverage and tasks"
                  value={shiftForm.description}
                  onChange={(e) => setShiftForm({ ...shiftForm, description: e.target.value })}
                  className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                />
              </div>

              <div className="flex items-center gap-sm">
                <input
                  type="checkbox"
                  id="isActiveToggle"
                  checked={shiftForm.isActive}
                  onChange={(e) => setShiftForm({ ...shiftForm, isActive: e.target.checked })}
                  className="rounded border-outline-variant text-primary"
                />
                <label htmlFor="isActiveToggle" className="text-sm font-medium text-on-surface">
                  Active (Available for duty assignments)
                </label>
              </div>

              <div className="flex justify-end gap-sm pt-sm border-t border-outline-variant">
                <button
                  type="button"
                  onClick={() => setIsShiftModalOpen(false)}
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
                  {submitting ? 'Saving...' : editingShift ? 'Update Shift' : 'Create Shift'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* Modal: Assign Shift Schedule */}
      {isAssignModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-md">
          <div className="card w-full max-w-lg p-lg space-y-md bg-surface shadow-xl animate-scaleUp">
            <div className="flex justify-between items-center pb-sm border-b border-outline-variant">
              <h3 className="font-headline-sm text-headline-sm text-on-surface">Assign Staff Duty Shift</h3>
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
              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Staff Member
                </label>
                <select
                  value={assignForm.staff}
                  onChange={(e) => setAssignForm({ ...assignForm, staff: e.target.value })}
                  required
                  className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                >
                  {staffList.map((st) => (
                    <option key={st._id} value={st._id}>
                      {st.name} ({st.staffId || st.employeeId}) — {st.department?.code || 'Staff'} ({st.designation || 'Staff'})
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Shift Template
                </label>
                <select
                  value={assignForm.shift}
                  onChange={(e) => handleAssignShiftSelect(e.target.value)}
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

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Schedule Date
                </label>
                <input
                  type="date"
                  value={assignForm.date}
                  onChange={(e) => setAssignForm({ ...assignForm, date: e.target.value })}
                  required
                  className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                />
              </div>

              <div className="grid grid-cols-2 gap-md">
                <div>
                  <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                    Start Time
                  </label>
                  <input
                    type="time"
                    value={assignForm.startTime}
                    onChange={(e) => setAssignForm({ ...assignForm, startTime: e.target.value })}
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
                    value={assignForm.endTime}
                    onChange={(e) => setAssignForm({ ...assignForm, endTime: e.target.value })}
                    required
                    className="w-full bit-input p-2 border rounded-md bg-surface text-on-surface"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs font-semibold text-secondary uppercase tracking-wider mb-xs">
                  Remarks / Notes (Optional)
                </label>
                <input
                  type="text"
                  placeholder="e.g. Assigned for campus server deployment"
                  value={assignForm.remarks}
                  onChange={(e) => setAssignForm({ ...assignForm, remarks: e.target.value })}
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

      {/* Modal: Edit Schedule */}
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

            <form onSubmit={handleEditScheduleSubmit} className="space-y-md">
              <div>
                <p className="text-sm font-medium text-on-surface">
                  Staff: <span className="font-bold">{editingSchedule.staff?.name}</span> ({editingSchedule.department?.code})
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
                  value={editSchedStatus}
                  onChange={(e) => setEditSchedStatus(e.target.value)}
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
                  value={editSchedRemarks}
                  onChange={(e) => setEditSchedRemarks(e.target.value)}
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

export default AdminShiftPage;
