import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../context/AuthContext';
import StatusBadge from '../../components/common/StatusBadge';
import { getDepartmentAttendance, markOrCorrectAttendance } from '../../services/attendance.service';

const HODAttendancePage = () => {
  const { user } = useAuth();
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');
  const [correctingRecord, setCorrectingRecord] = useState(null);
  const [newStatus, setNewStatus] = useState('Present');
  const [remarks, setRemarks] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchAttendance = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getDepartmentAttendance({
        status: statusFilter || undefined,
      });
      setRecords(data.records || []);
    } catch (err) {
      console.error('Error fetching department attendance:', err);
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    fetchAttendance();
  }, [fetchAttendance]);

  const handleCorrectSubmit = async (e) => {
    e.preventDefault();
    if (!correctingRecord) return;

    setSubmitting(true);
    try {
      await markOrCorrectAttendance({
        user: correctingRecord.user?._id || correctingRecord.user,
        date: correctingRecord.date,
        status: newStatus,
        remarks: remarks || 'Corrected by HOD',
      });
      setCorrectingRecord(null);
      setRemarks('');
      fetchAttendance();
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to update attendance.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="space-y-lg">
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Department Attendance</h2>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            Monitor and adjust daily attendance for staff in {user?.department?.name || 'your department'}
          </p>
        </div>

        {/* Status Filter */}
        <div>
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
      </div>

      <div className="bit-card">
        <h3 className="font-title-md text-title-md text-on-surface mb-md">Staff Attendance Records</h3>
        <div className="overflow-x-auto">
          {loading ? (
            <div className="flex justify-center py-xl">
              <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
          ) : records.length === 0 ? (
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
                {records.map((r) => {
                  const d = new Date(r.date);
                  const dateStr = d.toLocaleDateString('en-IN', { month: 'short', day: 'numeric', year: 'numeric' });
                  return (
                    <tr key={r._id}>
                      <td className="font-medium">{r.user?.name}</td>
                      <td className="text-secondary">{r.user?.designation || 'Staff'}</td>
                      <td className="text-secondary font-mono text-xs">{dateStr}</td>
                      <td><StatusBadge status={r.status} /></td>
                      <td className="text-secondary text-sm">{r.remarks || '—'}</td>
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
              Updating record for <strong className="text-on-surface">{correctingRecord.user?.name}</strong> on {new Date(correctingRecord.date).toLocaleDateString('en-IN')}
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
