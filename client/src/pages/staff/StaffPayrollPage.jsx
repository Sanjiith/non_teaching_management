import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import { getMyPayroll } from '../../services/payroll.service';
import { exportCSV } from '../../utils/exportCSV';

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

const BreakdownRow = ({ label, value, highlight = false, indent = false, deduction = false }) => (
  <div className={`flex justify-between py-xs border-b border-outline-variant ${highlight ? 'font-semibold text-on-surface' : deduction ? 'text-error' : 'text-secondary'} ${indent ? 'pl-md' : ''}`}>
    <span className="text-body-sm font-body-sm">{label}</span>
    <span className={`text-body-sm font-body-sm font-mono ${highlight ? 'text-primary' : ''}`}>{value}</span>
  </div>
);

const StaffPayrollPage = () => {
  const now = new Date();
  const [selectedMonth, setSelectedMonth] = useState(now.getMonth() + 1);
  const [selectedYear, setSelectedYear]   = useState(now.getFullYear());
  const [payrolls, setPayrolls]           = useState([]);
  const [loading, setLoading]             = useState(true);
  const [selectedPayroll, setSelectedPayroll] = useState(null);

  const fetchPayrolls = useCallback(async () => {
    setLoading(true);
    try {
      const data = await getMyPayroll({ year: selectedYear });
      setPayrolls(data?.payrolls || []);

      // Auto-select the matching month's payroll if it exists
      const match = (data?.payrolls || []).find(
        (p) => p.month === selectedMonth && p.year === selectedYear
      );
      setSelectedPayroll(match || null);
    } catch (err) {
      console.error('Error fetching payroll:', err);
    } finally {
      setLoading(false);
    }
  }, [selectedYear]);

  // Update selected payroll when month changes
  useEffect(() => {
    const match = payrolls.find((p) => p.month === selectedMonth && p.year === selectedYear);
    setSelectedPayroll(match || null);
  }, [selectedMonth, payrolls, selectedYear]);

  useEffect(() => { fetchPayrolls(); }, [fetchPayrolls]);

  const monthName = (m) => MONTHS.find((x) => x.value === m)?.label || '';

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="space-y-lg">
      {/* ── Header ─────────────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">My Payroll</h2>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            View your monthly salary breakdown and payslip history
          </p>
        </div>
        <div className="flex gap-sm flex-wrap">
          <select
            value={selectedMonth}
            onChange={(e) => setSelectedMonth(Number(e.target.value))}
            className="bit-input py-xs text-body-sm w-36"
          >
            {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
          </select>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="bit-input py-xs text-body-sm w-28"
          >
            {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
          </select>
          <button
            onClick={() => {
              const cols = [
                { key: 'period', label: 'Period', getValue: (p) => `${monthName(p.month)} ${p.year}` },
                { key: 'grossSalary', label: 'Gross Salary (₹)', getValue: (p) => p.grossSalary?.toFixed(2) },
                { key: 'netSalary', label: 'Net Salary (₹)', getValue: (p) => p.netSalary?.toFixed(2) },
                { key: 'presentDays', label: 'Present Days', getValue: (p) => p.presentDays },
                { key: 'status', label: 'Status', getValue: (p) => p.status },
              ];
              exportCSV(payrolls, `My_Payroll_${selectedYear}`, cols);
            }}
            className="btn-secondary"
          >
            <span className="material-symbols-outlined text-sm">download</span>
            Export
          </button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-xl">
          <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
        </div>
      ) : !selectedPayroll ? (
        /* ── No Payroll ───────────────────────────────────────────── */
        <div className="bit-card flex flex-col items-center py-xl gap-md text-secondary">
          <span className="material-symbols-outlined text-[56px] text-outline">receipt_long</span>
          <h3 className="font-title-md text-title-md text-on-surface">No Payroll Record</h3>
          <p className="font-body-sm text-body-sm text-center max-w-sm">
            Your payroll for <strong>{monthName(selectedMonth)} {selectedYear}</strong> has not been generated yet.
            Please contact Admin.
          </p>

          {/* History of other months */}
          {payrolls.length > 0 && (
            <div className="w-full max-w-sm mt-md">
              <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-sm">Available Records</p>
              <div className="space-y-xs">
                {payrolls.map((p) => (
                  <button
                    key={p._id}
                    onClick={() => { setSelectedMonth(p.month); setSelectedPayroll(p); }}
                    className="w-full flex items-center justify-between p-sm border border-outline-variant rounded hover:bg-surface-container transition-colors"
                  >
                    <span className="font-body-sm text-on-surface">{monthName(p.month)} {p.year}</span>
                    <div className="flex items-center gap-sm">
                      <span className="font-mono text-sm text-emerald-700">{fmtINR(p.netSalary)}</span>
                      <StatusBadge status={p.status} />
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      ) : (
        <>
          {/* ── KPI Cards ──────────────────────────────────────────── */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
            <KPICard
              label="Net Salary"
              value={fmtINR(selectedPayroll.netSalary)}
              icon="payments"
              sub={`${monthName(selectedPayroll.month)} ${selectedPayroll.year}`}
              valueColor="text-emerald-700"
            />
            <KPICard
              label="Present Days"
              value={selectedPayroll.presentDays}
              icon="how_to_reg"
              sub={`of ${selectedPayroll.totalWorkingDays} working days`}
              valueColor="text-primary"
            />
            <KPICard
              label="Leave Days"
              value={selectedPayroll.leaveDays}
              icon="flight_takeoff"
              sub="Approved leave"
              valueColor="text-amber-600"
            />
            <KPICard
              label="Absent Days"
              value={selectedPayroll.absentDays}
              icon="person_off"
              sub="Unauthorized absence"
              valueColor="text-error"
            />
          </div>

          {/* ── Payslip Card ────────────────────────────────────────── */}
          <div className="bit-card">
            {/* Payslip Header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-md mb-md pb-md border-b border-outline-variant">
              <div>
                <h3 className="font-title-md text-title-md text-on-surface">
                  Payslip — {monthName(selectedPayroll.month)} {selectedPayroll.year}
                </h3>
                <p className="text-xs text-secondary mt-xs">
                  01/{String(selectedPayroll.month).padStart(2, '0')}/{selectedPayroll.year}
                  {' '}–{' '}
                  {new Date(Date.UTC(selectedPayroll.year, selectedPayroll.month, 0)).getDate()}/{String(selectedPayroll.month).padStart(2, '0')}/{selectedPayroll.year}
                </p>
              </div>
              <div className="flex items-center gap-sm">
                <StatusBadge status={selectedPayroll.status} />
                {selectedPayroll.status === 'Paid' && selectedPayroll.paidAt && (
                  <span className="text-xs text-secondary">
                    Paid {new Date(selectedPayroll.paidAt).toLocaleDateString('en-IN')}
                  </span>
                )}
              </div>
            </div>

            {/* Two-column breakdown */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-lg">
              {/* Left — Salary & Working Days */}
              <div className="space-y-md">
                <div>
                  <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-xs">Salary Basis</p>
                  <BreakdownRow label="Basic Monthly Salary" value={fmtINR(selectedPayroll.basicSalary)} />
                  <BreakdownRow
                    label={`Applicable Salary${selectedPayroll.basicSalary > 40000 ? ' (capped at ₹40,000)' : ''}`}
                    value={fmtINR(selectedPayroll.applicableSalary)}
                    highlight
                  />
                </div>

                <div>
                  <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-xs">Working Days</p>
                  <BreakdownRow label="Total Working Days"  value={selectedPayroll.totalWorkingDays} />
                  <BreakdownRow label="Daily Salary"        value={fmtINR(selectedPayroll.dailySalary)} indent />
                  <BreakdownRow label="Days Present"        value={selectedPayroll.presentDays}     indent />
                  <BreakdownRow label="Leave (approved)"    value={selectedPayroll.leaveDays}       indent />
                  <BreakdownRow label="Weekly Off"          value={selectedPayroll.weeklyOffDays}   indent />
                  <BreakdownRow label="Holidays"            value={selectedPayroll.holidayDays}     indent />
                </div>
              </div>

              {/* Right — Earnings, Deductions, Net */}
              <div className="space-y-md">
                <div>
                  <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-xs">Earnings</p>
                  <BreakdownRow label="Applicable Salary"   value={fmtINR(selectedPayroll.applicableSalary)} />
                  {selectedPayroll.allowances?.hra > 0     && <BreakdownRow label="HRA Allowance"     value={fmtINR(selectedPayroll.allowances.hra)} indent />}
                  {selectedPayroll.allowances?.da > 0      && <BreakdownRow label="DA Allowance"      value={fmtINR(selectedPayroll.allowances.da)} indent />}
                  {selectedPayroll.allowances?.ta > 0      && <BreakdownRow label="Travel Allowance"  value={fmtINR(selectedPayroll.allowances.ta)} indent />}
                  {selectedPayroll.allowances?.medical > 0 && <BreakdownRow label="Medical Allowance" value={fmtINR(selectedPayroll.allowances.medical)} indent />}
                  {selectedPayroll.allowances?.other > 0   && <BreakdownRow label="Other Allowance"   value={fmtINR(selectedPayroll.allowances.other)} indent />}
                  <BreakdownRow label="Gross Salary"        value={fmtINR(selectedPayroll.grossSalary)} highlight />
                </div>

                <div>
                  <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-xs">Deductions</p>
                  <BreakdownRow
                    label={`Absence Deduction (${selectedPayroll.absentDays} day${selectedPayroll.absentDays !== 1 ? 's' : ''})`}
                    value={selectedPayroll.absentDays > 0 ? `-${fmtINR(selectedPayroll.absenceDeduction)}` : fmtINR(0)}
                    deduction={selectedPayroll.absentDays > 0}
                  />
                  {selectedPayroll.deductions?.pf > 0            && <BreakdownRow label="PF Deduction"       value={`-${fmtINR(selectedPayroll.deductions.pf)}`}           deduction indent />}
                  {selectedPayroll.deductions?.pt > 0            && <BreakdownRow label="PT Deduction"       value={`-${fmtINR(selectedPayroll.deductions.pt)}`}           deduction indent />}
                  {selectedPayroll.deductions?.tds > 0           && <BreakdownRow label="TDS"                value={`-${fmtINR(selectedPayroll.deductions.tds)}`}          deduction indent />}
                  {selectedPayroll.deductions?.loanRepayment > 0 && <BreakdownRow label="Loan Repayment"     value={`-${fmtINR(selectedPayroll.deductions.loanRepayment)}`} deduction indent />}
                  {selectedPayroll.deductions?.other > 0         && <BreakdownRow label="Other Deductions"   value={`-${fmtINR(selectedPayroll.deductions.other)}`}        deduction indent />}
                </div>

                {/* Net Salary highlight */}
                <div className="bg-primary-container rounded p-md flex items-center justify-between">
                  <div>
                    <p className="font-label-md text-label-md text-on-primary uppercase tracking-wide">Net Salary</p>
                    <p className="text-xs text-on-primary opacity-80 mt-xs">After all deductions</p>
                  </div>
                  <div className="text-right">
                    <p className="font-display-lg text-display-lg text-on-primary">{fmtINR(selectedPayroll.netSalary)}</p>
                  </div>
                </div>
              </div>
            </div>

            {selectedPayroll.remarks && (
              <div className="mt-md pt-md border-t border-outline-variant">
                <p className="text-xs text-secondary italic">Remarks: {selectedPayroll.remarks}</p>
              </div>
            )}
          </div>

          {/* ── Payroll History ──────────────────────────────────────── */}
          {payrolls.length > 1 && (
            <div className="bit-card">
              <h3 className="font-title-md text-title-md text-on-surface mb-md">Payslip History</h3>
              <div className="overflow-x-auto">
                <table className="bit-table">
                  <thead>
                    <tr>
                      <th>Period</th>
                      <th>Net Salary</th>
                      <th>Working Days</th>
                      <th>Absent</th>
                      <th>Deduction</th>
                      <th>Status</th>
                      <th></th>
                    </tr>
                  </thead>
                  <tbody>
                    {payrolls.map((p) => (
                      <tr key={p._id} className={selectedPayroll._id === p._id ? 'bg-surface-container' : ''}>
                        <td className="font-medium">{monthName(p.month)} {p.year}</td>
                        <td className="font-mono text-sm text-emerald-700 font-semibold">{fmtINR(p.netSalary)}</td>
                        <td className="text-center">{p.totalWorkingDays}</td>
                        <td className="text-center text-error">{p.absentDays}</td>
                        <td className="font-mono text-xs text-error">-{fmtINR(p.absenceDeduction)}</td>
                        <td><StatusBadge status={p.status} /></td>
                        <td>
                          <button
                            onClick={() => setSelectedPayroll(p)}
                            className="btn-ghost py-xs px-xs text-xs"
                          >
                            View
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
};

export default StaffPayrollPage;
