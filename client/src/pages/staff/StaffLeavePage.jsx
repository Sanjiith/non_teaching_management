import { useState, useEffect, useCallback, useMemo } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { getMyLeaves, applyLeave, cancelLeave } from '../../services/leave.service';
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

  const [form, setForm] = useState({
    type: 'Casual Leave',
    startDate: '',
    startTime: '09:00 AM',
    endDate: '',
    endTime: '05:00 PM',
    reason: '',
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

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  // ─── Frontend validation ────────────────────────────────────────────────

  const validateForm = () => {
    const { startDate, endDate, startTime, endTime, reason } = form;

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
      await applyLeave(form);
      setFormSuccess('Leave application submitted successfully!');
      setForm({
        type: 'Casual Leave',
        startDate: '',
        startTime: '09:00 AM',
        endDate: '',
        endTime: '05:00 PM',
        reason: '',
      });
      fetchLeaves();
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
          Submit new leave requests and track your available balance
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
                disabled={submitting}
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
    </div>
  );
};

export default StaffLeavePage;
