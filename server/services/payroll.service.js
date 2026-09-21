/**
 * Payroll Calculation Service — Day 5
 *
 * Pure business logic — no Express req/res.
 * All payroll math lives here so it can be tested in isolation.
 *
 * Key rules:
 *  - MAX_APPLICABLE_SALARY = ₹40,000
 *  - Daily salary  = applicableSalary / totalWorkingDays
 *  - Absent (unauthorized) causes deduction
 *  - Approved Leave does NOT cause deduction
 *  - Weekly Off / Holiday are NOT counted as working days (no deduction)
 *  - Working days = Mon–Sat by default (Sun = weekly off)
 *    unless the attendance record says 'Weekly Off' explicitly
 */

const MAX_APPLICABLE_SALARY = 40000;

/**
 * Returns the number of calendar working days in a given month.
 * Default weekly off: Sunday (day index 0).
 * Holidays stored as Date objects (normalized to UTC midnight).
 *
 * @param {number} year
 * @param {number} month  1-indexed
 * @param {Date[]} holidays  Array of UTC-midnight Date objects
 * @param {number[]} weeklyOffDays  0=Sun,1=Mon…6=Sat. Default [0] (Sunday off)
 * @returns {number}
 */
const calculateWorkingDays = (year, month, holidays = [], weeklyOffDays = [0]) => {
  const holidayTimestamps = new Set(
    holidays.map((h) => {
      const d = new Date(h);
      return Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate());
    })
  );

  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate(); // last day of month
  let workingDays = 0;

  for (let day = 1; day <= daysInMonth; day++) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const dayOfWeek = date.getUTCDay(); // 0=Sun

    if (weeklyOffDays.includes(dayOfWeek)) continue; // weekly off
    if (holidayTimestamps.has(date.getTime())) continue; // holiday

    workingDays++;
  }

  return workingDays;
};

/**
 * Sums all values in an allowances / deductions object.
 * @param {object} obj
 * @returns {number}
 */
const sumObject = (obj = {}) =>
  Object.values(obj).reduce((acc, v) => acc + (Number(v) || 0), 0);

/**
 * Computes the full payroll record for one user in one month.
 *
 * @param {object} params
 * @param {object}   params.user           User document (must have .basicSalary)
 * @param {number}   params.month          1–12
 * @param {number}   params.year
 * @param {object[]} params.attendanceRecords  Array of Attendance documents for this user/month
 * @param {Date[]}   params.holidays       Array of Date objects (UTC midnight) for this month
 * @param {object}   params.allowances     Optional extra allowances {hra,da,ta,medical,other}
 * @param {object}   params.deductions     Optional extra deductions {pf,pt,tds,loanRepayment,other}
 * @returns {object}  Full payroll breakdown (does NOT save to DB)
 */
const computePayroll = ({
  user,
  month,
  year,
  attendanceRecords = [],
  holidays = [],
  allowances = {},
  deductions = {},
}) => {
  // ── Salary cap ────────────────────────────────────────────────────
  const basicSalary = Number(user.basicSalary) || 0;
  const applicableSalary = Math.min(basicSalary, MAX_APPLICABLE_SALARY);

  // ── Working day count ─────────────────────────────────────────────
  // Weekly off = Sunday (index 0). This matches typical Indian institutional calendars.
  const totalWorkingDays = calculateWorkingDays(year, month, holidays, [0]);

  // ── Daily salary ──────────────────────────────────────────────────
  const dailySalary =
    totalWorkingDays > 0
      ? parseFloat((applicableSalary / totalWorkingDays).toFixed(4))
      : 0;

  // ── Attendance counters ───────────────────────────────────────────
  let presentDays = 0;
  let leaveDays = 0;
  let absentDays = 0;
  let weeklyOffDays = 0;
  let holidayDays = 0;

  attendanceRecords.forEach((record) => {
    const s = record.status;
    if (s === 'Present') presentDays++;
    else if (s === 'Leave' || s === 'On-Leave') leaveDays++;
    else if (s === 'Absent') absentDays++;
    else if (s === 'Weekly Off') weeklyOffDays++;
    else if (s === 'Holiday') holidayDays++;
  });

  // ── Deduction calculation ─────────────────────────────────────────
  const absenceDeduction = parseFloat((absentDays * dailySalary).toFixed(2));

  // ── Extras ────────────────────────────────────────────────────────
  const normalizedAllowances = {
    hra:     Number(allowances.hra)     || 0,
    da:      Number(allowances.da)      || 0,
    ta:      Number(allowances.ta)      || 0,
    medical: Number(allowances.medical) || 0,
    other:   Number(allowances.other)   || 0,
  };
  const normalizedDeductions = {
    pf:            Number(deductions.pf)            || 0,
    pt:            Number(deductions.pt)            || 0,
    tds:           Number(deductions.tds)           || 0,
    loanRepayment: Number(deductions.loanRepayment) || 0,
    other:         Number(deductions.other)         || 0,
  };

  const totalAllowances = sumObject(normalizedAllowances);
  const totalOtherDeductions = sumObject(normalizedDeductions);

  // ── Final totals ──────────────────────────────────────────────────
  const grossSalary = parseFloat((applicableSalary + totalAllowances).toFixed(2));
  const netSalary = parseFloat(
    Math.max(0, grossSalary - absenceDeduction - totalOtherDeductions).toFixed(2)
  );

  return {
    // Period
    month,
    year,

    // Salary inputs
    basicSalary,
    applicableSalary,

    // Working days
    totalWorkingDays,
    presentDays,
    leaveDays,
    absentDays,
    weeklyOffDays,
    holidayDays,

    // Calculation steps
    dailySalary,
    absenceDeduction,

    // Extras
    allowances: normalizedAllowances,
    deductions: normalizedDeductions,

    // Totals
    grossSalary,
    netSalary,

    // Snapshot
    holidays,
  };
};

module.exports = {
  calculateWorkingDays,
  computePayroll,
  MAX_APPLICABLE_SALARY,
};
