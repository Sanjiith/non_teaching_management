import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { getMySchedules } from '../../services/schedule.service';

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

const StaffSchedulePage = () => {
  const [schedules, setSchedules] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterMode, setFilterMode] = useState('upcoming'); // 'upcoming', 'today', 'all'

  const fetchSchedules = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMySchedules();
      setSchedules(data || []);
    } catch (err) {
      console.error('Error fetching staff schedules:', err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchedules();
  }, [fetchSchedules]);

  const todayStr = new Date().toISOString().split('T')[0];

  const todaySchedule = schedules.find((s) => {
    const sDate = new Date(s.date).toISOString().split('T')[0];
    return sDate === todayStr;
  });

  const upcomingSchedules = schedules.filter((s) => {
    const sDate = new Date(s.date).toISOString().split('T')[0];
    return sDate >= todayStr;
  });

  const completedCount = schedules.filter((s) => s.status === 'Completed').length;
  const onLeaveCount = schedules.filter((s) => s.status === 'On Leave').length;

  const filteredSchedules = schedules.filter((s) => {
    const sDate = new Date(s.date).toISOString().split('T')[0];
    if (filterMode === 'today') return sDate === todayStr;
    if (filterMode === 'upcoming') return sDate >= todayStr;
    return true; // 'all'
  });

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
      {/* Header */}
      <div className="page-header">
        <div>
          <h1 className="page-title">My Shift Schedule</h1>
          <p className="page-subtitle">
            View your assigned duty shifts, work hours, and schedule status
          </p>
        </div>
      </div>

      {/* KPI Summary Cards */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <KPICard
          label="Today's Shift"
          value={todaySchedule ? `${todaySchedule.startTime} - ${todaySchedule.endTime}` : 'No Shift'}
          icon="today"
          sub={todaySchedule ? todaySchedule.shift?.name || 'Assigned' : 'Off / Unscheduled'}
          valueColor={todaySchedule ? 'text-primary' : 'text-outline'}
        />
        <KPICard
          label="Upcoming Shifts"
          value={upcomingSchedules.length}
          icon="event_upcoming"
          sub="Next assigned duties"
          valueColor="text-secondary"
        />
        <KPICard
          label="Completed Shifts"
          value={completedCount}
          icon="task_alt"
          sub="Past duties fulfilled"
          valueColor="text-success"
        />
        <KPICard
          label="Leave Conflicts"
          value={onLeaveCount}
          icon="flight_takeoff"
          sub="Shifts during approved leave"
          valueColor={onLeaveCount > 0 ? 'text-warning' : 'text-on-surface'}
        />
      </div>

      {/* Today's Shift Spotlight Card */}
      {todaySchedule && (
        <div className="card p-md border-l-4 border-l-primary bg-primary/5 flex flex-col md:flex-row justify-between items-start md:items-center gap-md">
          <div className="space-y-xs">
            <div className="flex items-center gap-sm">
              <span className="material-symbols-outlined text-primary text-2xl">alarm_on</span>
              <h3 className="font-title-md text-title-md text-on-surface">
                Today's Duty: <span className="text-primary font-bold">{todaySchedule.shift?.name}</span>
              </h3>
              <StatusBadge status={todaySchedule.status} />
            </div>
            <p className="font-body-sm text-body-sm text-secondary">
              Department: {todaySchedule.department?.name || 'General'} | Timing: {todaySchedule.startTime} – {todaySchedule.endTime} ({todaySchedule.shift?.workingHours || 8} hrs)
            </p>
            {todaySchedule.remarks && (
              <p className="font-label-sm text-label-sm text-outline italic">
                Note: {todaySchedule.remarks}
              </p>
            )}
          </div>
          <div className="flex items-center gap-sm">
            <span className="text-xs px-3 py-1 bg-surface-container rounded-full font-medium text-secondary">
              {formatDate(todaySchedule.date)}
            </span>
          </div>
        </div>
      )}

      {/* Schedule Table Card */}
      <div className="card p-md">
        <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-md mb-md pb-md border-b border-outline-variant">
          <div className="flex items-center gap-sm">
            <span className="material-symbols-outlined text-primary text-xl">calendar_month</span>
            <h2 className="font-title-md text-title-md text-on-surface">Assigned Duty Schedule</h2>
            <span className="text-xs text-outline">({filteredSchedules.length} records)</span>
          </div>

          {/* View Filter Buttons */}
          <div className="flex rounded-lg border border-outline-variant p-1 bg-surface-container">
            <button
              onClick={() => setFilterMode('upcoming')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filterMode === 'upcoming'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              Upcoming
            </button>
            <button
              onClick={() => setFilterMode('today')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filterMode === 'today'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              Today
            </button>
            <button
              onClick={() => setFilterMode('all')}
              className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${
                filterMode === 'all'
                  ? 'bg-surface text-primary shadow-sm'
                  : 'text-outline hover:text-on-surface'
              }`}
            >
              All Records
            </button>
          </div>
        </div>

        {loading ? (
          <div className="text-center py-xl text-outline">Loading your schedule...</div>
        ) : filteredSchedules.length === 0 ? (
          <div className="text-center py-xl space-y-sm">
            <span className="material-symbols-outlined text-4xl text-outline">event_busy</span>
            <p className="font-body-md text-body-md text-outline">No shifts found for this selection.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-outline-variant text-label-md text-secondary uppercase tracking-wider">
                  <th className="py-sm px-md">Date & Day</th>
                  <th className="py-sm px-md">Shift Name</th>
                  <th className="py-sm px-md">Timing</th>
                  <th className="py-sm px-md">Hours</th>
                  <th className="py-sm px-md">Department</th>
                  <th className="py-sm px-md">Status</th>
                  <th className="py-sm px-md">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-outline-variant font-body-sm text-body-sm">
                {filteredSchedules.map((item) => {
                  const isConflict = item.status === 'On Leave' || item.status === 'Conflict';
                  return (
                    <tr
                      key={item._id}
                      className={`hover:bg-surface-container/50 transition-colors ${
                        isConflict ? 'bg-warning/5' : ''
                      }`}
                    >
                      <td className="py-sm px-md font-medium text-on-surface">
                        {formatDate(item.date)}
                      </td>
                      <td className="py-sm px-md">
                        <div className="font-semibold text-primary">
                          {item.shift?.name || 'Custom Shift'}
                        </div>
                        {item.shift?.description && (
                          <div className="text-xs text-outline truncate max-w-[180px]">
                            {item.shift.description}
                          </div>
                        )}
                      </td>
                      <td className="py-sm px-md whitespace-nowrap">
                        <span className="font-mono text-xs bg-surface-container px-2 py-0.5 rounded border border-outline-variant">
                          {item.startTime} – {item.endTime}
                        </span>
                      </td>
                      <td className="py-sm px-md">
                        {item.shift?.workingHours ? `${item.shift.workingHours} hrs` : '8 hrs'}
                      </td>
                      <td className="py-sm px-md text-secondary">
                        {item.department?.name || 'General'}
                      </td>
                      <td className="py-sm px-md">
                        <StatusBadge status={item.status} />
                      </td>
                      <td className="py-sm px-md max-w-xs">
                        {item.remarks ? (
                          <span
                            className={`text-xs ${
                              isConflict ? 'text-warning font-semibold' : 'text-outline'
                            }`}
                          >
                            {item.remarks}
                          </span>
                        ) : (
                          <span className="text-outline text-xs">—</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};

export default StaffSchedulePage;
