import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { getAllLeaves, approveLeave, rejectLeave } from '../../services/leave.service';

const AdminLeavePage = () => {
  const [leaves, setLeaves] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [processingId, setProcessingId] = useState(null);

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getAllLeaves({
        status: statusFilter || undefined,
      });
      setLeaves(data.leaves || []);
    } catch (err) {
      console.error('Error fetching admin leaves:', err);
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
      await approveLeave(id, 'Approved by Administrator');
      fetchLeaves();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to approve leave.');
    } finally {
      setProcessingId(null);
    }
  };

  const handleReject = async (id) => {
    const reason = window.prompt('Enter rejection remarks:', 'Administrative decision');
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
          <h2 className="font-headline-md text-headline-md text-on-surface">Leave Applications Overview</h2>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            Review, track, and manage all staff leave requests across institutions
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

      <div className="bit-card">
        <h3 className="font-title-md text-title-md text-on-surface mb-md">All Staff Leave Applications</h3>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-xl">
              <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : leaves.length === 0 ? (
            <p className="text-secondary text-center py-xl font-body-sm">
              No leave requests found.
            </p>
          ) : (
            <table className="bit-table">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Department</th>
                  <th>Type</th>
                  <th>Dates</th>
                  <th>Days</th>
                  <th>Reason</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => {
                  const fromStr = new Date(l.fromDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                  const toStr = new Date(l.toDate).toLocaleDateString('en-IN', { month: 'short', day: 'numeric' });
                  const dateStr = fromStr === toStr ? fromStr : `${fromStr} – ${toStr}`;

                  return (
                    <tr key={l._id}>
                      <td className="font-medium">
                        <div>
                          <p>{l.user?.name}</p>
                          <span className="font-label-sm text-label-sm text-outline">{l.user?.employeeId}</span>
                        </div>
                      </td>
                      <td>
                        <span className="badge-neutral">
                          {l.department?.code || l.department?.name || '—'}
                        </span>
                      </td>
                      <td className="text-secondary">{l.type}</td>
                      <td className="text-secondary font-mono text-xs">{dateStr}</td>
                      <td>{l.totalDays}</td>
                      <td className="text-secondary text-sm max-w-xs truncate" title={l.reason}>
                        {l.reason}
                      </td>
                      <td><StatusBadge status={l.status} /></td>
                      <td>
                        {l.status === 'Pending' && (
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

export default AdminLeavePage;
