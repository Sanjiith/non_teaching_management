import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { getDepartmentLeaves, approveLeave, rejectLeave } from '../../services/leave.service';

const HODLeavePage = () => {
  const [leaves, setLeaves] = useState([]);
  const [leaveStats, setLeaveStats] = useState(null);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDepartmentLeaves({
        status: statusFilter || undefined,
      });
      setLeaves(data.leaves || []);
      if (data.stats) setLeaveStats(data.stats);
    } catch (err) {
      console.error('Error fetching department leaves:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchLeaves();
  }, [fetchLeaves]);

  const handleApprove = async (id) => {
    setProcessingId(id);
    try {
      await approveLeave(id, 'Approved by HOD');
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve leave.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection remarks:', 'Department workload requirements');
    if (reason === null) return;

    setProcessingId(id);
    try {
      await rejectLeave(id, reason);
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to reject leave.');
    } finally {
      setProcessingId(null);
    }
  };

  return (
    <div className="space-y-lg">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Department Leave Approvals</h2>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            Review and approve leave applications submitted by department staff
          </p>
        </div>

        <div>
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="bit-input py-xs text-body-sm w-44"
          >
            <option value="">All Applications</option>
            <option value="Pending">Pending Only</option>
            <option value="Approved">Approved</option>
            <option value="Rejected">Rejected</option>
            <option value="Cancelled">Cancelled</option>
          </select>
        </div>
      </div>

      {/* Leave Summary Stats */}
      {leaveStats && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
          {[
            { label: 'Total Applications', value: leaveStats.total || leaveStats.totalApplications || leaves.length, color: 'text-on-surface' },
            { label: 'Pending', value: leaveStats.pending || 0, color: 'text-amber-600' },
            { label: 'Approved', value: leaveStats.approved || 0, color: 'text-emerald-600' },
            { label: 'Rejected', value: leaveStats.rejected || 0, color: 'text-red-600' },
          ].map(({ label, value, color }) => (
            <div key={label} className="kpi-card">
              <div className="kpi-label">{label}</div>
              <div className={`kpi-value ${color}`}>{value}</div>
            </div>
          ))}
        </div>
      )}

      <div className="bit-card">
        <h3 className="font-title-md text-title-md text-on-surface mb-md">Leave Requests</h3>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-xl">
              <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : leaves.length === 0 ? (
            <p className="text-secondary text-center py-xl font-body-sm">
              No leave applications found.
            </p>
          ) : (
            <table className="bit-table">
              <thead>
                <tr>
                  <th>Staff Member</th>
                  <th>Leave Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Substitute</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => {
                  const fromStr = new Date(l.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                  const toStr = new Date(l.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                  const dateStr = fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;
                  const isAwaitingSub = l.requiresSubstitute && l.substituteStatus !== 'Accepted';

                  return (
                    <tr key={l._id}>
                      <td className="font-medium">
                        <div>
                          <p>{l.user?.name}</p>
                          <span className="font-label-sm text-label-sm text-outline">{l.user?.employeeId}</span>
                        </div>
                      </td>
                      <td className="text-secondary">{l.type}</td>
                      <td className="text-secondary font-mono text-xs">{dateStr}</td>
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
                          </div>
                        ) : (
                          <span className="text-outline text-xs">Not required</span>
                        )}
                      </td>
                      <td><StatusBadge status={l.status} /></td>
                      <td>
                        {l.status === 'Pending' && (
                          <div>
                            {isAwaitingSub ? (
                              <div className="space-y-1">
                                <span className={`text-[11px] font-medium block ${l.substituteStatus === 'Rejected' ? 'text-error' : 'text-amber-600'}`}>
                                  {l.substituteStatus === 'Rejected'
                                    ? 'Substitute declined'
                                    : 'Awaiting substitute'}
                                </span>
                                <div className="flex gap-xs opacity-50 cursor-not-allowed">
                                  <button
                                    disabled
                                    title="Disabled: Substitute must accept before HOD can approve"
                                    className="btn-primary text-xs py-xs px-sm pointer-events-none"
                                  >
                                    Approve
                                  </button>
                                  <button
                                    disabled
                                    title="Disabled: Substitute must accept before HOD can reject"
                                    className="btn-ghost text-xs py-xs px-sm text-error pointer-events-none"
                                  >
                                    Reject
                                  </button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex gap-xs">
                                <button
                                  onClick={() => handleApprove(l._id)}
                                  disabled={processingId === l._id}
                                  className="btn-primary text-xs py-xs px-sm"
                                >
                                  Approve
                                </button>
                                <button
                                  onClick={() => handleReject(l._id)}
                                  disabled={processingId === l._id}
                                  className="btn-ghost text-xs py-xs px-sm text-error hover:bg-error-container/20"
                                >
                                  Reject
                                </button>
                              </div>
                            )}
                          </div>
                        )}
                        {l.status !== 'Pending' && (
                          <span className="text-xs text-outline">{l.approvalRemarks || 'Processed'}</span>
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
  );
};

export default HODLeavePage;
