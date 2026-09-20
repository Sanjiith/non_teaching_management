import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { getMyLeaves, applyLeave, cancelLeave } from '../../services/leave.service';

const StaffLeavePage = () => {
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');
    setFormSuccess('');

    if (!form.startDate) return setFormError('Start date is required.');
    if (!form.endDate) return setFormError('End date is required.');
    if (!form.reason.trim()) return setFormError('Reason is required.');

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
      total: balances?.earnedLeave?.total ?? 30,
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
          return (
            <div key={b.type} className="kpi-card">
              <div className="flex justify-between items-start mb-sm">
                <span className="kpi-label">{b.type}</span>
                <span className="material-symbols-outlined text-outline text-xl">event_available</span>
              </div>
              <div className="kpi-value text-primary-container">{available} <span className="text-sm font-normal text-secondary">/ {b.total} days</span></div>
              <div className="kpi-sub">
                {b.used} used {b.reserved > 0 ? `· ${b.reserved} pending` : ''}
              </div>
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

              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">Start Date</label>
                <input
                  type="date"
                  value={form.startDate}
                  onChange={(e) => setForm({ ...form, startDate: e.target.value })}
                  className="bit-input"
                  required
                />
              </div>

              <div>
                <label className="font-label-md text-label-md text-on-surface uppercase block mb-xs">End Date</label>
                <input
                  type="date"
                  value={form.endDate}
                  onChange={(e) => setForm({ ...form, endDate: e.target.value })}
                  className="bit-input"
                  required
                />
              </div>

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
                <div className="p-sm bg-error-container text-on-error-container rounded text-body-sm">
                  {formError}
                </div>
              )}

              {formSuccess && (
                <div className="p-sm bg-emerald-50 text-emerald-800 rounded text-body-sm">
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
                      const toStr = new Date(l.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                      const isSameDay = fromStr === toStr;
                      const dateDisplay = isSameDay ? fromStr : `${fromStr} – ${toStr}`;

                      return (
                        <tr key={l._id}>
                          <td className="font-medium">{l.type}</td>
                          <td className="text-secondary">{dateDisplay}</td>
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
