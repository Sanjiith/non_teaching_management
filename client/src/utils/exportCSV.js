/**
 * exportCSV — A reusable CSV export utility.
 * Converts an array of objects into a downloadable CSV file.
 *
 * @param {Array<Object>} rows    - Array of flat objects (each key becomes a column)
 * @param {string}        filename - Desired filename (without .csv)
 * @param {Array<{key: string, label: string}>} columns - Optional column definitions
 */
export const exportCSV = (rows, filename = 'export', columns = null) => {
  if (!rows || rows.length === 0) {
    alert('No data available to export.');
    return;
  }

  // Determine columns
  const cols = columns || Object.keys(rows[0]).map((k) => ({ key: k, label: k }));

  // Build header
  const header = cols.map((c) => `"${c.label}"`).join(',');

  // Build data rows
  const data = rows.map((row) =>
    cols
      .map((c) => {
        const val = c.getValue ? c.getValue(row) : row[c.key];
        if (val === null || val === undefined) return '""';
        const str = String(val).replace(/"/g, '""'); // escape quotes
        return `"${str}"`;
      })
      .join(',')
  );

  const csvContent = [header, ...data].join('\n');
  const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' }); // BOM for Excel
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.setAttribute('download', `${filename}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

/**
 * Helper to get attendance rate color class
 */
export const getAttendanceRateColor = (rate) => {
  if (rate >= 90) return 'text-emerald-600';
  if (rate >= 75) return 'text-amber-600';
  return 'text-red-600';
};

/**
 * Helper to get leave balance warning level
 */
export const getLeaveBalanceWarning = (remaining, total) => {
  if (total === 0) return null;
  const pct = (remaining / total) * 100;
  if (pct <= 20 || remaining <= 2) return 'critical'; // < 20% or ≤ 2 days
  if (pct <= 33 || remaining <= 4) return 'warning';  // < 33% or ≤ 4 days
  return null;
};

export default exportCSV;
