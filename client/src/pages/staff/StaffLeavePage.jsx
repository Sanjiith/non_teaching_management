import { useState, useEffect, useCallback, useMemo } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import {
  getMyLeaves,
  applyLeave,
  cancelLeave,
  checkSubstituteRequirement,
  getEligibleSubstitutes,
  getMySubstituteRequests,
  respondToSubstituteRequest,
  reassignSubstitute,
} from '../../services/leave.service';
import { exportCSV, getLeaveBalanceWarning } from '../../utils/exportCSV';

// ─── Date helpers ────────────────────────────────────────────────────────────

/** Returns today's date in YYYY-MM-DD (local time) — used for <input min> */
const getTodayLocal = () => {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, '0');
  const dd = String(now.getDate()).padStart(2, '0');
  return `${yyyy}-${mm}-${dd}`;
};

/** Parse "HH:MM AM/PM" or "HH:MM" (24h) → minutes since midnight. Returns null on failure. */
const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return null;
  const t = timeStr.trim().toUpperCase();

  const ampm = t.match(/^(\d{1,2}):(\d{2})\s*(AM|PM)$/);
  if (ampm) {
    let h = parseInt(ampm[1], 10);
    const m = parseInt(ampm[2], 10);
    if (ampm[3] === 'AM') { if (h === 12) h = 0; }
    else { if (h !== 12) h += 12; }
    return h * 60 + m;
  }

  const h24 = t.match(/^(\d{1,2}):(\d{2})$/);
  if (h24) return parseInt(h24[1], 10) * 60 + parseInt(h24[2], 10);

  return null;
};

/**
 * Client-side overlap check against existing leaves.
 * Returns true if [newStart, newEnd, newST, newET] overlaps with `existing`.
 * Only checks leaves with status Pending or Approved.
 */
const overlapsExisting = (newStart, newEnd, newST, newET, existing) => {
  const exStart = new Date(existing.fromDate);
  const exEnd   = new Date(existing.toDate);

  // Normalise all to midnight UTC for date comparison
  const ns = new Date(Date.UTC(
    new Date(newStart).getFullYear(),
    new Date(newStart).getMonth(),
    new Date(newStart).getDate()
  ));
  const ne = new Date(Date.UTC(
    new Date(newEnd).getFullYear(),
    new Date(newEnd).getMonth(),
    new Date(newEnd).getDate()
  ));
  const es = new Date(Date.UTC(exStart.getUTCFullYear(), exStart.getUTCMonth(), exStart.getUTCDate()));
  const ee = new Date(Date.UTC(exEnd.getUTCFullYear(), exEnd.getUTCMonth(), exEnd.getUTCDate()));

  // No date-range overlap → safe
  if (ne < es || ns > ee) return false;

  // Same-day both sides → compare times
  const newIsSingle  = ns.getTime() === ne.getTime();
  const existIsSingle = es.getTime() === ee.getTime();
  const sameDayStart = ns.getTime() === es.getTime();

  if (newIsSingle && existIsSingle && sameDayStart) {
    const nS = parseTimeToMinutes(newST);
    const nE = parseTimeToMinutes(newET);
    const eS = parseTimeToMinutes(existing.startTime);
    const eE = parseTimeToMinutes(existing.endTime);
    if (nS !== null && nE !== null && eS !== null && eE !== null) {
      return nS < eE && nE > eS;
    }
  }

  return true; // multi-day or mixed — date overlap confirmed
};

// ─── Component ───────────────────────────────────────────────────────────────

const StaffLeavePage = () => {
  const todayStr = useMemo(() => getTodayLocal(), []);

  const [leaves, setLeaves] = useState([]);
  const [balances, setBalances] = useState(null);
  const [loading, setLoading] = useState(true);

  // Substitute state
  const [subCheck, setSubCheck] = useState({ requiresSubstitute: false, datesExceedingLimit: [] });
  const [eligibleSubs, setEligibleSubs] = useState([]);
  const [checkingSub, setCheckingSub] = useState(false);
  const [subRequests, setSubRequests] = useState([]);
  const [respondingId, setRespondingId] = useState(null);

  // Reassignment modal state
  const [reassignLeave, setReassignLeave] = useState(null);
  const [reassignSubId, setReassignSubId] = useState('');
  const [reassignSubsList, setReassignSubsList] = useState([]);
  const [loadingReassignSubs, setLoadingReassignSubs] = useState(false);
  const [reassigning, setReassigning] = useState(false);

  const [form, setForm] = useState({
    type: 'Casual Leave',
    startDate: '',
    startTime: '09:00 AM',
    endDate: '',
    endTime: '05:00 PM',
    reason: '',
    substitute: '',
  });

  const [submitting, setSubmitting] = useState(false);
  const [formError, setFormError] = useState('');
  const [formSuccess, setFormSuccess] = useState('');

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyLeaves();
      setLeaves(data.leaves || []);
      setBalances(data.leaveBalances);
    } catch (err) {
      console.error('Error fetching leaves:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchSubRequests = useCallback(async () => {
    try {
      const data = await getMySubstituteRequests();
      setSubRequests(data.requests || []);
    } catch (err) {
      console.error('Error fetching substitute requests:', err);
    }
  }, []);

  useEffect(() => {
    fetchLeaves();
    fetchSubRequests();
  }, [fetchLeaves, fetchSubRequests]);

  // Check substitute requirement and eligible substitutes dynamically when dates change
  useEffect(() => {
    let isCurrent = true;
    const evaluateSubstituteRequirement = async () => {
      if (!form.startDate || !form.endDate || form.endDate < form.startDate) {
        setSubCheck({ requiresSubstitute: false, datesExceedingLimit: [] });
        setEligibleSubs([]);
        return;
      }

      setCheckingSub(true);
      try {
        const [reqData, eligibleData] = await Promise.all([
          checkSubstituteRequirement({ startDate: form.startDate, endDate: form.endDate }),
          getEligibleSubstitutes({ startDate: form.startDate, endDate: form.endDate }),
        ]);

        if (isCurrent) {
          setSubCheck(reqData || { requiresSubstitute: false, datesExceedingLimit: [] });
          setEligibleSubs(eligibleData?.substitutes || []);
          if (!reqData?.requiresSubstitute) {
            setForm((prev) => ({ ...prev, substitute: '' }));
          }
        }
      } catch (err) {
        console.error('Error checking substitute requirements:', err);
      } finally {
        if (isCurrent) setCheckingSub(false);
      }
    };

    evaluateSubstituteRequirement();
    return () => { isCurrent = false; };
  }, [form.startDate, form.endDate]);

  // ─── Frontend validation ────────────────────────────────────────────────

  const validateForm = () => {
    const { startDate, endDate, startTime, endTime, reason, substitute } = form;

    if (!startDate) return 'Start date is required.';
    if (!endDate)   return 'End date is required.';
    if (!reason.trim()) return 'Reason is required.';

    // Past-date check (client-side)
    if (startDate < todayStr) return 'Start date cannot be in the past.';
    if (endDate   < todayStr) return 'End date cannot be in the past.';

    // End must be >= start
    if (endDate < startDate) return 'End date cannot be before start date.';

    // Same-day time validation
    if (startDate === endDate) {
      const sM = parseTimeToMinutes(startTime);
      const eM = parseTimeToMinutes(endTime);
      if (sM === null) return 'Invalid start time format. Use e.g. 09:00 AM.';
      if (eM === null) return 'Invalid end time format. Use e.g. 05:00 PM.';
      if (sM >= eM)   return 'For same-day leave, start time must be before end time.';
    }

    // Overlap check against existing Pending / Approved leaves
    const activeLeavesToCheck = leaves.filter(
      (l) => l.status === 'Pending' || l.status === 'Approved'
    );

    for (const existing of activeLeavesToCheck) {
      if (overlapsExisting(startDate, endDate, startTime, endTime, existing)) {
        return 'You already have a leave request during this period. Please choose different dates.';
      }
    }

    // Substitute validation
    if (subCheck.requiresSubstitute && !substitute) {
      return 'A substitute must be selected before submitting this leave request.';
    }

    return null; // no error
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    const validationError = validateForm();
    if (validationError) {
      setFormError(validationError);
      return;
    }

    setSubmitting(true);
    try {
      await applyLeave({
        ...form,
        substitute: form.substitute || undefined,
      });
      setFormSuccess('Leave application submitted successfully!');
      setForm({
        type: 'Casual Leave',
        startDate: '',
        startTime: '09:00 AM',
        endDate: '',
        endTime: '05:00 PM',
        reason: '',
        substitute: '',
      });
      setSubCheck({ requiresSubstitute: false, datesExceedingLimit: [] });
      fetchLeaves();
      fetchSubRequests();
    } catch (err) {
      setFormError(err.response?.data?.message || err.message || 'Failed to submit leave.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleCancel = async (leaveId) => {
    if (!window.confirm('Are you sure you want to cancel this leave request?')) return;
    try {
      await cancelLeave(leaveId);
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to cancel leave.');
    }
  };

  const handleRespondSubstitute = async (leaveId, action) => {
    let remarks = '';
    if (action === 'reject') {
      const input = window.prompt('Optional remarks for declining substitute duty:');
      if (input === null) return;
      remarks = input;
    }
    setRespondingId(leaveId);
    try {
      await respondToSubstituteRequest(leaveId, action, remarks);
      fetchSubRequests();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to respond to substitute request.');
    } finally {
      setRespondingId(null);
    }
  };

  const handleOpenReassignModal = async (leave) => {
    setReassignLeave(leave);
    setReassignSubId('');
    setLoadingReassignSubs(true);
    try {
      const start = new Date(leave.fromDate).toISOString().split('T')[0];
      const end = new Date(leave.toDate).toISOString().split('T')[0];
      const data = await getEligibleSubstitutes({ startDate: start, endDate: end });
      setReassignSubsList(data.substitutes || []);
    } catch (err) {
      console.error('Error fetching substitutes for reassignment:', err);
    } finally {
      setLoadingReassignSubs(false);
    }
  };

  const handleReassignSubmit = async () => {
    if (!reassignSubId) {
      alert('Please select an eligible substitute.');
      return;
    }
    setReassigning(true);
    try {
      await reassignSubstitute(reassignLeave._id, reassignSubId);
      setReassignLeave(null);
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reassign substitute.');
    } finally {
      setReassigning(false);
    }
  };

  // Auto-correct endDate if it goes before startDate
  const handleStartDateChange = (val) => {
    const next = { ...form, startDate: val };
    if (form.endDate && form.endDate < val) next.endDate = val;
    setForm(next);
  };

  const balanceItems = [
    {
      type: 'Casual Leave',
      total: balances?.casualLeave?.total ?? 12,
      used: balances?.casualLeave?.used ?? 0,
      reserved: balances?.casualLeave?.reserved ?? 0,
    },
    {
      type: 'Medical Leave',
      total: balances?.medicalLeave?.total ?? 12,
      used: balances?.medicalLeave?.used ?? 0,
      reserved: balances?.medicalLeave?.reserved ?? 0,
    },
    {
      type: 'Earned Leave',
      total: balances?.earnedLeave?.total ?? 12,
      used: balances?.earnedLeave?.used ?? 0,
      reserved: balances?.earnedLeave?.reserved ?? 0,
    },
  ];

  return (
    <div className="space-y-lg">
      <div className="page-header">
        <h2 className="font-headline-md text-headline-md text-on-surface">Leave Management</h2>
        <p className="font-body-sm text-body-sm text-secondary mt-xs">
          Submit new leave requests, coordinate substitutes, and track your available balance
        </p>
      </div>

      {/* Dynamic Balances */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-md">
        {balanceItems.map((b) => {
          const available = Math.max(0, b.total - b.used - b.reserved);
          const warningLevel = getLeaveBalanceWarning(available, b.total);
          return (
            <div key={b.type} className={`kpi-card relative ${warningLevel === 'critical' ? 'border-red-300 bg-red-50/20' : warningLevel === 'warning' ? 'border-amber-300 bg-amber-50/20' : ''}`}>
              <div className="flex justify-between items-start mb-sm">
                <span className="kpi-label">{b.type}</span>
                {warningLevel === 'critical' && (
                  <span className="material-symbols-outlined text-red-500 text-xl" title="Critical: leave balance very low">warning</span>
                )}
                {warningLevel === 'warning' && (
                  <span className="material-symbols-outlined text-amber-500 text-xl" title="Warning: leave balance is low">info</span>
                )}
                {!warningLevel && (
                  <span className="material-symbols-outlined text-outline text-xl">event_available</span>
                )}
              </div>
              <div className="kpi-value text-primary-container">{available} <span className="text-sm font-normal text-secondary">/ {b.total} days</span></div>
              <div className="kpi-sub">
                {b.used} used {b.reserved > 0 ? `· ${b.reserved} pending` : ''}
              </div>
              {warningLevel === 'critical' && (
                <p className="text-xs text-red-600 font-medium mt-xs">⚠ Balance critically low</p>
              )}
              {warningLevel === 'warning' && (
                <p className="text-xs text-amber-600 font-medium mt-xs">Leave balance is low</p>
              )}
            </div>
          );
        })}
      </div>

      {/* Substitute Requests Assigned to You */}
      {subRequests.length > 0 && (
        <div className="bit-card border border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between mb-sm">
            <h3 className="font-title-md text-title-md text-on-surface flex items-center gap-2">
              <span className="material-symbols-outlined text-primary">person_check</span>
              Substitute Requests Assigned to You
            </h3>
            <span className="badge-warning text-xs font-semibold px-2 py-0.5 rounded-full">
              {subRequests.filter((r) => r.substituteStatus === 'Pending').length} Pending Response
            </span>
          </div>
          <div className="overflow-x-auto">
            <table className="bit-table">
              <thead>
                <tr>
                  <th>Requesting Staff</th>
                  <th>Department</th>
                  <th>Dates</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {subRequests.map((req) => {
                  const fromStr = new Date(req.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                  const toStr = new Date(req.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                  const dateStr = fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;

                  return (
                    <tr key={req._id}>
                      <td className="font-medium">
                        <div>
                          <p>{req.user?.name}</p>
                          <span className="font-label-sm text-label-sm text-outline">{req.user?.employeeId}</span>
                        </div>
                      </td>
                      <td className="text-secondary text-sm">{req.department?.name || req.user?.department?.name || '—'}</td>
                      <td className="text-secondary font-mono text-xs">{dateStr}</td>
                      <td className="text-secondary text-sm max-w-xs truncate" title={req.reason}>
                        {req.reason}
                      </td>
                      <td>
                        <StatusBadge status={req.substituteStatus} />
                      </td>
                      <td>
                        {req.substituteStatus === 'Pending' && req.status === 'Pending' ? (
                          <div className="flex gap-xs">
                            <button
                              onClick={() => handleRespondSubstitute(req._id, 'accept')}
                              disabled={respondingId === req._id}
                              className="btn-primary text-xs py-xs px-sm"
                            >
                              Accept
                            </button>
                            <button
                              onClick={() => handleRespondSubstitute(req._id, 'reject')}
                              disabled={respondingId === req._id}
                              className="btn-ghost text-xs py-xs px-sm text-error hover:bg-error-container/20"
                            >
                              Decline
                            </button>
                          </div>
                        ) : (
                          <span className="text-xs text-outline">
                            {req.substituteRemarks || req.substituteStatus}
                          </span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Apply Form & History Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-md">
        {/* Application Form */}
        <div className="lg:col-span-1">
          <div className="bit-card">
            <h3 className="font-title-md text-title-md text-on-surface mb-md">Apply for Leave</h3>
            <form onSubmit={handleSubmit} className="space-y-sm">
              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Leave Type</label>
                <select
                  value={form.type}
                  onChange={(e) => setForm({ ...form, type: e.target.value })}
                  className="bit-input"
                >
                  <option value="Casual Leave">Casual Leave</option>
                  <option value="Medical Leave">Medical Leave</option>
                  <option value="Earned Leave">Earned Leave</option>
                  <option value="Other">Other</option>
                </select>
              </div>

              {/* ── Start Date — past dates disabled via min ── */}
              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  min={todayStr}
                  onChange={(e) => handleStartDateChange(e.target.value)}
                  className="bit-input"
                  required
                />
              </div>

              {/* ── End Date — must be >= startDate ── */}
              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  min={form.startDate || todayStr}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="bit-input"
                  required
                />
              </div>

              {/* ── Times ── */}
              <div className="grid grid-cols-2 gap-xs">
                <div>
                  <label className="font-label-sm text-label-sm text-secondary uppercase block mb-xs">Start Time</label>
                  <input
                    type="text"
                    value={form.startTime}
                    onChange={(e) => setForm({ ...form, startTime: e.target.value })}
                    placeholder="09:00 AM"
                    className="bit-input text-xs"
                  />
                </div>
                <div>
                  <label className="font-label-sm text-label-sm text-secondary uppercase block mb-xs">End Time</label>
                  <input
                    type="text"
                    value={form.endTime}
                    onChange={(e) => setForm({ ...form, endTime: e.target.value })}
                    placeholder="05:00 PM"
                    className="bit-input text-xs"
                  />
                </div>
              </div>

              {/* Same-day hint */}
              {form.startDate && form.endDate && form.startDate === form.endDate && (
                <p className="text-xs text-amber-600 flex items-center gap-1">
                  <span className="material-symbols-outlined text-sm">info</span>
                  Same-day leave — ensure start time is before end time.
                </p>
              )}

              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Reason</label>
                <textarea
                  rows="3"
                  value={form.reason}
                  onChange={(e) => setForm({ ...form, reason: e.target.value })}
                  placeholder="Explain the reason for leave..."
                  className="bit-input py-xs"
                  required
                />
              </div>

              {/* ── Substitute Requirement Section ── */}
              {subCheck.requiresSubstitute && (
                <div className="p-sm bg-amber-50 border border-amber-200 rounded text-body-sm text-amber-900 space-y-xs">
                  <div className="flex items-start gap-2">
                    <span className="material-symbols-outlined text-amber-600 text-lg flex-shrink-0 mt-0.5">group_work</span>
                    <div>
                      <p className="font-semibold text-xs uppercase tracking-wide">Substitute Required</p>
                      <p className="text-xs text-amber-800 mt-0.5">
                        2 staff members in your department are already on approved leave for date(s):{' '}
                        <strong>{subCheck.datesExceedingLimit.join(', ')}</strong>. Please select an eligible substitute.
                      </p>
                    </div>
                  </div>

                  <div className="mt-xs">
                    <label className="font-label-sm text-label-sm text-on-surface uppercase block mb-xs">
                      Select Substitute <span className="text-red-500">*</span>
                    </label>
                    {checkingSub ? (
                      <div className="text-xs text-secondary flex items-center gap-2 py-1">
                        <span className="w-3 h-3 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                        Finding eligible substitutes...
                      </div>
                    ) : eligibleSubs.length === 0 ? (
                      <p className="text-xs text-red-600 font-medium">
                        No eligible substitutes currently available for these dates.
                      </p>
                    ) : (
                      <select
                        value={form.substitute}
                        onChange={(e) => setForm({ ...form, substitute: e.target.value })}
                        className="bit-input text-xs"
                        required
                      >
                        <option value="">-- Choose an eligible substitute --</option>
                        {eligibleSubs.map((s) => (
                          <option key={s._id} value={s._id}>
                            {s.name} ({s.employeeId || s.staffId}) · {s.department?.name || 'Staff'}{s.designation ? ` (${s.designation})` : ''}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </div>
              )}

              {formError && (
                <div className="p-sm bg-error-container text-on-error-container rounded text-body-sm flex items-start gap-2">
                  <span className="material-symbols-outlined text-base flex-shrink-0 mt-0.5">error</span>
                  <span>{formError}</span>
                </div>
              )}

              {formSuccess && (
                <div className="p-sm bg-emerald-50 text-emerald-800 rounded text-body-sm flex items-center gap-2">
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  {formSuccess}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting || (subCheck.requiresSubstitute && !form.substitute)}
                className="btn-primary w-full justify-center mt-sm"
              >
                {submitting ? 'Submitting...' : 'Submit Application'}
              </button>
            </form>
          </div>
        </div>

        {/* Requests History Table */}
        <div className="lg:col-span-2">
          <div className="bit-card">
            <h3 className="font-title-md text-title-md text-on-surface mb-md">My Leave Applications</h3>
            <div className="overflow-x-auto">
              {loading ? (
                <div className="flex justify-center py-xl">
                  <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
              ) : leaves.length === 0 ? (
                <p className="text-secondary text-center py-xl font-body-sm">
                  No leave requests submitted yet.
                </p>
              ) : (
                <table className="bit-table">
                  <thead>
                    <tr>
                      <th>Type</th>
                      <th>Dates</th>
                      <th>Days</th>
                      <th>Reason</th>
                      <th>Substitute</th>
                      <th>Status</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaves.map((l) => {
                      const fromStr = new Date(l.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                      const toStr   = new Date(l.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                      const isSameDay = fromStr === toStr;
                      const dateDisplay = isSameDay ? `${fromStr} (${l.startTime}–${l.endTime})` : `${fromStr} – ${toStr}`;

                      return (
                        <tr key={l._id}>
                          <td className="font-medium">{l.type}</td>
                          <td className="text-secondary text-sm">{dateDisplay}</td>
                          <td>{l.totalDays}</td>
                          <td className="text-secondary text-sm max-w-xs truncate" title={l.reason}>
                            {l.reason}
                          </td>
                          <td>
                            {l.requiresSubstitute ? (
                              <div className="space-y-1">
                                <p className="text-xs font-medium text-on-surface">
                                  {l.substitute?.name || 'Assigned'}
                                </p>
                                <StatusBadge status={l.substituteStatus} />
                                {l.substituteStatus === 'Rejected' && l.status === 'Pending' && (
                                  <button
                                    onClick={() => handleOpenReassignModal(l)}
                                    className="btn-primary text-[11px] py-0.5 px-2 mt-1 block"
                                  >
                                    Change Substitute
                                  </button>
                                )}
                              </div>
                            ) : (
                              <span className="text-outline text-xs">Not required</span>
                            )}
                          </td>
                          <td><StatusBadge status={l.status} /></td>
                          <td>
                            {(l.status === 'Pending' || l.status === 'Approved') && (
                              <button
                                onClick={() => handleCancel(l._id)}
                                className="btn-ghost text-xs py-xs px-sm text-error hover:bg-error-container/20"
                              >
                                Cancel
                              </button>
                            )}
                          </td>
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

      {/* Reassign Substitute Modal */}
      {reassignLeave && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-md">
          <div className="bit-card max-w-md w-full bg-surface shadow-xl p-lg rounded-xl border border-outline/20">
            <div className="flex items-center justify-between mb-md">
              <h3 className="font-title-md text-title-md text-on-surface flex items-center gap-2">
                <span className="material-symbols-outlined text-primary">swap_horiz</span>
                Select New Substitute
              </h3>
              <button
                onClick={() => setReassignLeave(null)}
                className="text-secondary hover:text-on-surface"
              >
                <span className="material-symbols-outlined text-lg">close</span>
              </button>
            </div>

            <p className="text-body-sm text-secondary mb-md">
              The previous substitute declined your request. Please select another eligible substitute for your leave (
              {new Date(reassignLeave.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })} –{' '}
              {new Date(reassignLeave.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' })}).
            </p>

            <div className="space-y-sm mb-lg">
              <label className="font-label-sm text-label-sm text-on-surface uppercase block">
                Eligible Non-Teaching Staff
              </label>
              {loadingReassignSubs ? (
                <div className="text-xs text-secondary flex items-center gap-2 py-2">
                  <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                  Loading eligible substitutes...
                </div>
              ) : reassignSubsList.length === 0 ? (
                <p className="text-xs text-red-600 font-medium">
                  No eligible substitutes currently available for these dates.
                </p>
              ) : (
                <select
                  value={reassignSubId}
                  onChange={(e) => setReassignSubId(e.target.value)}
                  className="bit-input text-xs w-full"
                >
                  <option value="">-- Choose an eligible substitute --</option>
                  {reassignSubsList.map((s) => (
                    <option key={s._id} value={s._id}>
                      {s.name} ({s.employeeId || s.staffId}) · {s.department?.name || 'Staff'}{s.designation ? ` (${s.designation})` : ''}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="flex justify-end gap-sm">
              <button
                onClick={() => setReassignLeave(null)}
                className="btn-ghost text-xs py-xs px-md"
              >
                Cancel
              </button>
              <button
                onClick={handleReassignSubmit}
                disabled={reassigning || !reassignSubId}
                className="btn-primary text-xs py-xs px-md"
              >
                {reassigning ? 'Sending...' : 'Confirm & Send Request'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default StaffLeavePage;
