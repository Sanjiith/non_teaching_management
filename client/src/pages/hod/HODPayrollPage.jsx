import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { getPayrollList } from '../../services/payroll.service';

const MONTHS = [
  { value: 1, label: 'January' },   { value: 2, label: 'February' },
  { value: 3, label: 'March' },     { value: 4, label: 'April' },
  { value: 5, label: 'May' },       { value: 6, label: 'June' },
  { value: 7, label: 'July' },      { value: 8, label: 'August' },
  { value: 9, label: 'September' }, { value: 10, label: 'October' },
  { value: 11, label: 'November' }, { value: 12, label: 'December' },
];
const YEARS = [2024, 2025, 2026, 2027];

const fmtINR = (n) =>
  new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 2 }).format(n || 0);

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

const BreakdownRow = ({ label, value, highlight = false, indent = false }) => (
  <div className={`flex justify-between py-xs border-b border-outline-variant ${highlight ? 'font-semibold text-on-surface' : 'text-secondary'} ${indent ? 'pl-md' : ''}`}>
    <span className="text-body-sm font-body-sm">{label}</span>
    <span className="text-body-sm font-body-sm font-mono">{value}</span>
  </div>
);

const HODPayrollPage = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());
  const [payrolls, setPayrolls]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [detailPayroll, setDetailPayroll] = useState(null);
  const [expandedRow, setExpandedRow]     = useState(null);

  const fetchPayrolls = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getPayrollList({ month: selectedMonth, year: selectedYear });
      setPayrolls(data?.payrolls || []);
    } catch (err) {
      console.error('Error fetching HOD payrolls:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedMonth, selectedYear]);

  useEffect(() => { fetchPayrolls(); }, [fetchPayrolls]);

  const monthName = (m) => MONTHS.find((x) => x.value === m)?.label || '';

  // KPI aggregates
  const totalStaff      = payrolls.length;
  const totalNetSalary  = payrolls.reduce((s, p) => s + p.netSalary, 0);
  const totalAbsentDays = payrolls.reduce((s, p) => s + p.absentDays, 0);
  const totalDeductions = payrolls.reduce((s, p) => s + p.absenceDeduction, 0);

  return (
    <div className="space-y-lg">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Department Payroll</h2>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            View payroll information for your department staff
          </p>
        </div>
        <div className="flex gap-sm">
          <select value={selectedMonth} onChange={(e) => setSelectedMonth(Number(e.target.value))} className="bit-input py-xs text-body-sm w-36">
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select value={selectedYear} onChange={(e) => setSelectedYear(Number(e.target.value))} className="bit-input py-xs text-body-sm w-28">
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
        </div>
      </div>

      {/* ── KPI Cards ───────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <KPICard label="Staff on Payroll"  value={totalStaff}               icon="group"        sub={`${monthName(selectedMonth)} ${selectedYear}`} />
        <KPICard label="Total Net Salary"  value={fmtINR(totalNetSalary)}   icon="payments"     sub="Combined payable"     valueColor="text-emerald-700" />
        <KPICard label="Absence Days"      value={totalAbsentDays}          icon="person_off"   sub="Across department"    valueColor="text-error" />
        <KPICard label="Total Deductions"  value={fmtINR(totalDeductions)}  icon="remove_circle" sub="From unauthorized absence" valueColor="text-amber-600" />
      </div>

      {/* ── Payroll Table ────────────────────────────────────────────── */}
      <div className="bit-card">
        <h3 className="font-title-md text-title-md text-on-surface mb-md">
          Staff Payroll — {monthName(selectedMonth)} {selectedYear}
        </h3>

        {loading ? (
          <div className="flex justify-center py-xl">
            <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          </div>
        ) : payrolls.length === 0 ? (
          <div className="flex flex-col items-center py-xl gap-md text-secondary">
            <span className="material-symbols-outlined text-[48px] text-outline">receipt_long</span>
            <p className="font-body-sm text-body-sm">
              No payroll records for {monthName(selectedMonth)} {selectedYear}.
            </p>
            <p className="text-xs text-outline">Contact Admin to generate payroll for this period.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="bit-table">
              <thead>
                <tr>
                  <th>Staff</th>
                  <th>Basic Salary</th>
                  <th>Applicable</th>
                  <th>Working Days</th>
                  <th>Present</th>
                  <th>Leave</th>
                  <th>Absent</th>
                  <th>Deduction</th>
                  <th>Net Salary</th>
                  <th>Status</th>
                  <th></th>
                </tr>
              </thead>
              <tbody>
                {payrolls.map((p) => (
                  <>
                    <tr key={p._id}>
                      <td>
                        <div className="font-medium text-on-surface">{p.user?.name || '—'}</div>
                        <div className="text-xs text-secondary">{p.user?.employeeId || p.user?.staffId}</div>
                      </td>
                      <td className="font-mono text-xs">{fmtINR(p.basicSalary)}</td>
                      <td className="font-mono text-xs">{fmtINR(p.applicableSalary)}</td>
                      <td className="text-center">{p.totalWorkingDays}</td>
                      <td className="text-center text-emerald-700">{p.presentDays}</td>
                      <td className="text-center text-amber-600">{p.leaveDays}</td>
                      <td className="text-center text-error font-semibold">{p.absentDays}</td>
                      <td className="font-mono text-xs text-error">-{fmtINR(p.absenceDeduction)}</td>
                      <td className="font-mono text-sm font-semibold text-emerald-700">{fmtINR(p.netSalary)}</td>
                      <td><StatusBadge status={p.status} /></td>
                      <td>
                        <div className="flex gap-xs">
                          <button
                            onClick={() => setExpandedRow(expandedRow === p._id ? null : p._id)}
                            className="btn-ghost py-xs px-xs text-xs"
                            title="View breakdown"
                          >
                            <span className="material-symbols-outlined text-sm">
                              {expandedRow === p._id ? 'expand_less' : 'expand_more'}
                            </span>
                          </button>
                          <button
                            onClick={() => setDetailPayroll(p)}
                            className="btn-secondary py-xs px-xs text-xs"
                            title="View full detail"
                          >
                            <span className="material-symbols-outlined text-sm">open_in_new</span>
                          </button>
                        </div>
                      </td>
                    </tr>
                    {expandedRow === p._id && (
                      <tr key={`${p._id}-expanded`}>
                        <td colSpan="11" className="bg-surface-container-low p-md">
                          <div className="grid grid-cols-2 md:grid-cols-3 gap-md text-sm">
                            <div>
                              <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-xs">Salary</p>
                              <BreakdownRow label="Basic Salary"      value={fmtINR(p.basicSalary)} />
                              <BreakdownRow label="Applicable Salary" value={fmtINR(p.applicableSalary)} highlight />
                              <BreakdownRow label="Daily Salary"      value={fmtINR(p.dailySalary)} indent />
                            </div>
                            <div>
                              <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-xs">Attendance</p>
                              <BreakdownRow label="Working Days" value={p.totalWorkingDays} />
                              <BreakdownRow label="Present"      value={p.presentDays}    indent />
                              <BreakdownRow label="Leave"        value={p.leaveDays}      indent />
                              <BreakdownRow label="Absent"       value={p.absentDays}     indent />
                              <BreakdownRow label="Weekly Off"   value={p.weeklyOffDays}  indent />
                            </div>
                            <div>
                              <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-xs">Totals</p>
                              <BreakdownRow label="Absence Deduction" value={`-${fmtINR(p.absenceDeduction)}`} />
                              <BreakdownRow label="Net Salary"        value={fmtINR(p.netSalary)} highlight />
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* ── Detail Modal (read-only) ─────────────────────────────────── */}
      {detailPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface-container-lowest rounded-lg shadow-lg w-full max-w-md mx-md p-lg space-y-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-title-md text-title-md text-on-surface">Payslip Detail</h3>
              <button onClick={() => setDetailPayroll(null)} className="btn-ghost py-xs px-xs">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            <div className="bg-surface-container rounded p-sm">
              <p className="font-semibold text-on-surface">{detailPayroll.user?.name}</p>
              <p className="text-xs text-secondary">{detailPayroll.user?.employeeId || detailPayroll.user?.staffId}</p>
              <p className="text-xs text-secondary mt-xs">
                Period: <strong>{monthName(detailPayroll.month)} {detailPayroll.year}</strong>
              </p>
            </div>

            <div className="space-y-xs">
              <p className="font-label-md text-label-md text-secondary uppercase tracking-wide">Full Breakdown</p>
              <BreakdownRow label="Basic Salary"           value={fmtINR(detailPayroll.basicSalary)} />
              <BreakdownRow label="Applicable Salary"      value={fmtINR(detailPayroll.applicableSalary)} highlight />
              <BreakdownRow label="Total Working Days"     value={detailPayroll.totalWorkingDays} indent />
              <BreakdownRow label="Daily Salary"           value={fmtINR(detailPayroll.dailySalary)} indent />
              <BreakdownRow label="Present Days"           value={detailPayroll.presentDays} />
              <BreakdownRow label="Leave Days (approved)"  value={detailPayroll.leaveDays} />
              <BreakdownRow label="Absent Days"            value={detailPayroll.absentDays} />
              <BreakdownRow label="Absence Deduction"      value={`-${fmtINR(detailPayroll.absenceDeduction)}`} />
              <BreakdownRow label="Net Salary"             value={fmtINR(detailPayroll.netSalary)} highlight />
            </div>

            <div className="flex items-center gap-sm">
              <span className="font-label-md text-label-md text-secondary">Status:</span>
              <StatusBadge status={detailPayroll.status} />
            </div>

            <button onClick={() => setDetailPayroll(null)} className="btn-secondary w-full justify-center">Close</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default HODPayrollPage;
