/**
 * Utility functions for processing and consolidating attendance records.
 */

/**
 * Consolidates daily attendance records so multi-day approved leave requests
 * appear as a single entry with date range and total days, rather than
 * multiple separate rows counting once for each day of leave.
 *
 * Non-leave records (Present, Absent, Holiday, Weekly Off) remain as
 * individual daily records.
 *
 * @param {Array} records - Raw attendance records from API
 * @returns {Array} Consolidated records with date ranges for multi-day leaves
 */
export const consolidateAttendanceRecords = (records = []) => {
  if (!Array.isArray(records) || records.length === 0) return [];

  // Sort descending by date first
  const sorted = [...records].sort((a, b) => new Date(b.date) - new Date(a.date));

  const result = [];
  const leaveGroups = new Map();

  for (const r of sorted) {
    const isLeave = r.status === 'Leave' || r.status === 'On-Leave';

    if (isLeave) {
      const uid = r.user?._id || r.user || 'unknown';
      const match = r.remarks?.match(/Leave ID:\s*([a-f0-9]+)/i);
      const leaveId = match ? match[1] : null;

      // Group key: if leaveId present, use user + leaveId; otherwise treat as individual or contiguous
      const groupKey = leaveId ? `leave_${uid}_${leaveId}` : `single_${r._id}`;

      if (leaveId && leaveGroups.has(groupKey)) {
        const group = leaveGroups.get(groupKey);
        group.records.push(r);
        const rDate = new Date(r.date);
        if (rDate < group.startDate) group.startDate = rDate;
        if (rDate > group.endDate) group.endDate = rDate;
      } else {
        const rDate = new Date(r.date);
        const group = {
          _id: r._id,
          user: r.user,
          status: 'Leave',
          date: rDate,
          startDate: rDate,
          endDate: rDate,
          remarks: r.remarks || '',
          leaveId,
          records: [r],
          isGrouped: true,
        };

        if (leaveId) {
          leaveGroups.set(groupKey, group);
        }
        result.push(group);
      }
    } else {
      const d = new Date(r.date);
      result.push({
        ...r,
        dateDisplay: d.toLocaleDateString('en-IN', {
          month: 'short',
          day: 'numeric',
          year: 'numeric',
        }),
        isGrouped: false,
      });
    }
  }

  // Format dateDisplay, duration, and clean remarks for grouped records
  return result.map((item) => {
    if (item.isGrouped) {
      const startStr = item.startDate.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const endStr = item.endDate.toLocaleDateString('en-IN', {
        month: 'short',
        day: 'numeric',
        year: 'numeric',
      });
      const count = item.records.length;
      item.totalDays = count;
      item.dateDisplay = startStr === endStr ? startStr : `${startStr} – ${endStr}`;
      item.duration = `${count} day${count !== 1 ? 's' : ''}`;

      // Clean up remarks if they contain redundant Leave ID or add duration
      if (item.remarks) {
        // e.g. "Approved Casual Leave (Leave ID: 123)" -> "Approved Casual Leave (4 days)"
        const cleanRemarks = item.remarks.replace(/\s*\(Leave ID:\s*[a-f0-9]+\)/i, '').trim();
        item.remarksDisplay = count > 1 ? `${cleanRemarks} (${count} days)` : cleanRemarks;
      } else {
        item.remarksDisplay = count > 1 ? `Approved Leave (${count} days)` : 'Approved Leave';
      }
    } else {
      item.remarksDisplay = item.remarks || '—';
    }
    return item;
  });
};
