import { useState, useEffect, useCallback } from 'react';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';

const AdminStaffPage = () => {
  const [staffList, setStaffList] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');

  const fetchStaff = useCallback(async (search = '') => {
    try {
      setLoading(true);
      const url = search ? `/users?search=${encodeURIComponent(search)}` : '/users';
      const res = await api.get(url);
      setStaffList(res.data.data.users || []);
    } catch (err) {
      console.error('Failed to fetch staff', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStaff();
  }, [fetchStaff]);

  const handleSearch = (e) => {
    e.preventDefault();
    fetchStaff(searchTerm);
  };

  return (
    <div className="space-y-lg">
      <div className="page-header">
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-sm">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Staff Directory</h2>
            <p className="font-body-sm text-body-sm text-secondary mt-xs">
              View all Non-Teaching Staff, roles, and leave balances.
            </p>
          </div>
          
          <form onSubmit={handleSearch} className="flex gap-sm w-full sm:w-auto">
            <input 
              type="text" 
              placeholder="Search ID, Name..." 
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="bit-input py-xs w-full sm:w-64"
            />
            <button type="submit" className="btn-secondary py-xs">Search</button>
          </form>
        </div>
      </div>

      <div className="bit-card">
        {loading ? (
          <p className="text-secondary text-center py-xl">Loading staff...</p>
        ) : staffList.length === 0 ? (
          <p className="text-secondary text-center py-xl">No staff members found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="bit-table text-sm">
              <thead>
                <tr>
                  <th>Employee</th>
                  <th>Contact</th>
                  <th>Department</th>
                  <th>Designation / Role</th>
                  <th>Joining Date</th>
                  <th>Basic Salary</th>
                  <th>Earned Leave Balance</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {staffList.map((staff) => (
                  <tr key={staff._id}>
                    <td>
                      <div className="font-medium text-on-surface">{staff.name}</div>
                      <div className="text-xs text-secondary font-mono">{staff.employeeId || staff.staffId}</div>
                    </td>
                    <td>
                      <div className="text-xs">{staff.email}</div>
                      <div className="text-xs text-secondary">{staff.phone || '—'}</div>
                    </td>
                    <td>
                      {staff.department ? (
                        <span className="badge-neutral">{staff.department.code}</span>
                      ) : (
                        <span className="italic text-outline">Unassigned</span>
                      )}
                    </td>
                    <td>
                      <div>{staff.designation || '—'}</div>
                      <div className="text-xs text-secondary">{staff.role}</div>
                    </td>
                    <td className="text-secondary">
                      {staff.joiningDate ? new Date(staff.joiningDate).toLocaleDateString('en-IN') : '—'}
                    </td>
                    <td className="font-mono text-secondary">
                      ₹{(staff.basicSalary || 0).toLocaleString('en-IN')}
                    </td>
                    <td className="font-medium text-center">
                      {staff.leaveBalances?.earnedLeave?.balance ?? (staff.leaveBalances?.earnedLeave?.total || 12)}
                    </td>
                    <td>
                      {staff.isActive ? (
                        <span className="badge-success">Active</span>
                      ) : (
                        <span className="badge-error">Inactive</span>
                      )}
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

export default AdminStaffPage;
