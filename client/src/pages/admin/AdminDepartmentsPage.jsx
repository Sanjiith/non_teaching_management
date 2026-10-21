import { useState, useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import StatusBadge from '../../components/common/StatusBadge';

const AdminDepartmentsPage = () => {
  const [departments, setDepartments] = useState([]);
  const [loading, setLoading] = useState(true);

  const fetchDepartments = useCallback(async () => {
    try {
      setLoading(true);
      const res = await api.get('/departments');
      setDepartments(res.data.data.departments || []);
    } catch (err) {
      console.error('Failed to fetch departments', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchDepartments();
  }, [fetchDepartments]);

  return (
    <div className="space-y-lg">
      <div className="page-header">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="font-headline-md text-headline-md text-on-surface">Departments</h2>
            <p className="font-body-sm text-body-sm text-secondary mt-xs">
              Manage and view all registered departments.
            </p>
          </div>
          <button className="btn-primary hidden sm:flex disabled:opacity-50" disabled>
            <span className="material-symbols-outlined text-sm">add</span>
            New Department
          </button>
        </div>
      </div>

      <div className="bit-card">
        {loading ? (
          <p className="text-secondary text-center py-xl">Loading departments...</p>
        ) : departments.length === 0 ? (
          <p className="text-secondary text-center py-xl">No departments found.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="bit-table">
              <thead>
                <tr>
                  <th>Department Name</th>
                  <th>Code</th>
                  <th>HOD</th>
                  <th>Total Strength</th>
                  <th>Active Staff</th>
                  <th>Inactive Staff</th>
                  <th>Status</th>
                </tr>
              </thead>
              <tbody>
                {departments.map((dept) => (
                  <tr key={dept._id}>
                    <td className="font-medium text-on-surface">{dept.name}</td>
                    <td>
                      <span className="badge-neutral">{dept.code}</span>
                    </td>
                    <td className="text-secondary">
                      {dept.hod ? dept.hod.name : <span className="italic text-outline">Unassigned</span>}
                    </td>
                    <td className="font-medium">{dept.strength || 0}</td>
                    <td className="text-emerald-700">{dept.activeCount || 0}</td>
                    <td className="text-red-700">{dept.inactiveCount || 0}</td>
                    <td>
                      {dept.isActive ? (
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

export default AdminDepartmentsPage;
