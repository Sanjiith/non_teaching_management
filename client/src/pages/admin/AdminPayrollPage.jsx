import { useState, useEffect, useCallback } from 'react';
import StatusBadge from '../../components/common/StatusBadge';
import {
  previewPayroll,
  generatePayroll,
  getPayrollList,
  updatePayrollStatus,
  getPayrollStats,
} from '../../services/payroll.service';
import api from '../../services/api';

// ── Helpers ──────────────────────────────────────────────────────────────────
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

const fmtNum = (n) => Number(n || 0).toFixed(2);

// ── Sub-components ────────────────────────────────────────────────────────────
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

// ── Main Component ────────────────────────────────────────────────────────────
const AdminPayrollPage = () => {
  const now = new Date();
  const [activeTab, setActiveTab] = useState('list'); // 'list' | 'generate'

  // ── Filters ──────────────────────────────────────────────────────
  const [filterMonth, setFilterMonth]  = useState(now.getMonth() + 1);
  const [filterYear, setFilterYear]    = useState(now.getFullYear());
  const [filterStatus, setFilterStatus] = useState('');
  const [filterDept, setFilterDept]    = useState('');

  // ── Data ─────────────────────────────────────────────────────────
  const [payrolls, setPayrolls]       = useState([]);
  const [stats, setStats]             = useState(null);
  const [departments, setDepartments] = useState([]);
  const [staffList, setStaffList]     = useState([]);
  const [loading, setLoading]         = useState(true);

  // ── Generate form ─────────────────────────────────────────────────
  const [genForm, setGenForm] = useState({
    userId: '',
    month: now.getMonth() + 1,
    year: now.getFullYear(),
    remarks: '',
  });
  const [preview, setPreview]         = useState(null);
  const [previewLoading, setPreviewLoading] = useState(false);
  const [genLoading, setGenLoading]   = useState(false);
  const [genError, setGenError]       = useState('');
  const [genSuccess, setGenSuccess]   = useState('');

  // ── Detail modal ──────────────────────────────────────────────────
  const [detailPayroll, setDetailPayroll] = useState(null);
  const [statusUpdating, setStatusUpdating] = useState(false);

  // ── Expanded row ──────────────────────────────────────────────────
  const [expandedRow, setExpandedRow] = useState(null);

  // ── Load data ─────────────────────────────────────────────────────
  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [payrollData, statsData, deptsRes, usersRes] = await Promise.all([
        getPayrollList({
          month:      filterMonth  || undefined,
          year:       filterYear   || undefined,
          status:     filterStatus || undefined,
          department: filterDept   || undefined,
        }),
        getPayrollStats({ month: filterMonth || undefined, year: filterYear || undefined }),
        api.get('/departments'),
        api.get('/users', { params: { role: 'Staff', limit: 500 } }),
      ]);
      setPayrolls(payrollData?.payrolls || []);
      setStats(statsData);
      setDepartments(deptsRes.data?.data?.departments || deptsRes.data?.data || []);
      setStaffList(usersRes.data?.data?.users || []);
    } catch (err) {
      console.error('Error loading payroll data:', err);
    } finally {
      setLoading(false);
    }
  }, [filterMonth, filterYear, filterStatus, filterDept]);

  useEffect(() => { loadData(); }, [loadData]);

  // ── Preview handler ───────────────────────────────────────────────
  const handlePreview = async () => {
    if (!genForm.userId) { setGenError('Please select a staff member.'); return; }
    setGenError('');
    setPreview(null);
    setPreviewLoading(true);
    try {
      const data = await previewPayroll({
        userId: genForm.userId,
        month: genForm.month,
        year: genForm.year,
      });
      setPreview(data);
    } catch (err) {
      setGenError(err.response?.data?.message || 'Preview failed.');
    } finally {
      setPreviewLoading(false);
    }
  };

  // ── Generate handler ──────────────────────────────────────────────
  const handleGenerate = async () => {
    setGenError('');
    setGenSuccess('');
    setGenLoading(true);
    try {
      const data = await generatePayroll({
        userId: genForm.userId || undefined,
        month: genForm.month,
        year: genForm.year,
        remarks: genForm.remarks,
      });
      setGenSuccess(`Generated payroll for ${data.totalGenerated} staff member(s).`);
      setPreview(null);
      setGenForm((f) => ({ ...f, userId: '', remarks: '' }));
      loadData();
    } catch (err) {
      setGenError(err.response?.data?.message || 'Generation failed.');
    } finally {
      setGenLoading(false);
    }
  };

  // ── Status update ─────────────────────────────────────────────────
  const handleStatusUpdate = async (payrollId, newStatus) => {
    setStatusUpdating(true);
    try {
      await updatePayrollStatus(payrollId, newStatus);
      setDetailPayroll(null);
      loadData();
    } catch (err) {
      alert(err.response?.data?.message || 'Status update failed.');
    } finally {
      setStatusUpdating(false);
    }
  };

  const monthName = (m) => MONTHS.find((x) => x.value === m)?.label || '';

  // ── Render ────────────────────────────────────────────────────────
  return (
    <div className="space-y-lg">
      {/* ── Page Header ──────────────────────────────────────────── */}
      <div className="page-header flex flex-col sm:flex-row sm:items-center justify-between gap-md">
        <div>
          <h2 className="font-headline-md text-headline-md text-on-surface">Payroll Management</h2>
          <p className="font-body-sm text-body-sm text-secondary mt-xs">
            Generate, review, and process monthly salary for non-teaching staff
          </p>
        </div>
        <div className="flex gap-sm">
          <button
            onClick={() => setActiveTab('list')}
            className={activeTab === 'list' ? 'btn-primary' : 'btn-secondary'}
          >
            <span className="material-symbols-outlined text-base">list_alt</span>
            All Payrolls
          </button>
          <button
            onClick={() => { setActiveTab('generate'); setPreview(null); setGenError(''); setGenSuccess(''); }}
            className={activeTab === 'generate' ? 'btn-primary' : 'btn-secondary'}
          >
            <span className="material-symbols-outlined text-base">calculate</span>
            Generate Payroll
          </button>
        </div>
      </div>

      {/* ── KPI Cards ─────────────────────────────────────────────── */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-md">
        <KPICard label="Total Payrolls"   value={stats?.totalPayrolls ?? '—'}  icon="receipt_long"    sub="This period" />
        <KPICard label="Draft"            value={stats?.draft ?? '—'}           icon="edit_note"       sub="Pending review"       valueColor="text-amber-600" />
        <KPICard label="Processed"        value={stats?.processed ?? '—'}       icon="check_circle"    sub="Ready to pay"         valueColor="text-blue-600" />
        <KPICard label="Total Net Salary" value={stats ? fmtINR(stats.totalNetSalary) : '—'} icon="payments" sub="Sum of net salaries" valueColor="text-emerald-700" />
      </div>

      {/* ─────────────────────────────────────────────────────────── */}
      {/* TAB: ALL PAYROLLS                                           */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeTab === 'list' && (
        <div className="bit-card">
          {/* Filters */}
          <div className="flex flex-wrap gap-sm mb-md">
            <select value={filterMonth} onChange={(e) => setFilterMonth(Number(e.target.value))} className="bit-input py-xs text-body-sm w-36">
              <option value="">All Months</option>
              {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
            </select>
            <select value={filterYear} onChange={(e) => setFilterYear(Number(e.target.value))} className="bit-input py-xs text-body-sm w-28">
              {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
            </select>
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="bit-input py-xs text-body-sm w-36">
              <option value="">All Statuses</option>
              <option value="Draft">Draft</option>
              <option value="Processed">Processed</option>
              <option value="Paid">Paid</option>
            </select>
            <select value={filterDept} onChange={(e) => setFilterDept(e.target.value)} className="bit-input py-xs text-body-sm w-44">
              <option value="">All Departments</option>
              {departments.map((d) => <option key={d._id} value={d._id}>{d.name}</option>)}
            </select>
          </div>

          {/* Table */}
          <div className="overflow-x-auto">
            {loading ? (
              <div className="flex justify-center py-xl">
                <span className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            ) : payrolls.length === 0 ? (
              <div className="flex flex-col items-center py-xl gap-md text-secondary">
                <span className="material-symbols-outlined text-[48px] text-outline">payments</span>
                <p className="font-body-sm text-body-sm">No payroll records found for this period.</p>
                <button onClick={() => setActiveTab('generate')} className="btn-primary">
                  <span className="material-symbols-outlined text-base">add</span>
                  Generate Payroll
                </button>
              </div>
            ) : (
              <table className="bit-table">
                <thead>
                  <tr>
                    <th>Employee</th>
                    <th>Period</th>
                    <th>Basic Salary</th>
                    <th>Applicable</th>
                    <th>Working Days</th>
                    <th>Absent</th>
                    <th>Deduction</th>
                    <th>Net Salary</th>
                    <th>Status</th>
                    <th>Actions</th>
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
                        <td className="text-secondary">{monthName(p.month)} {p.year}</td>
                        <td className="font-mono text-xs">{fmtINR(p.basicSalary)}</td>
                        <td className="font-mono text-xs">{fmtINR(p.applicableSalary)}</td>
                        <td className="text-center">{p.totalWorkingDays}</td>
                        <td className="text-center text-error font-semibold">{p.absentDays}</td>
                        <td className="font-mono text-xs text-error">-{fmtINR(p.absenceDeduction)}</td>
                        <td className="font-mono text-sm font-semibold text-emerald-700">{fmtINR(p.netSalary)}</td>
                        <td><StatusBadge status={p.status} /></td>
                        <td>
                          <div className="flex gap-xs">
                            <button
                              title="Expand breakdown"
                              onClick={() => setExpandedRow(expandedRow === p._id ? null : p._id)}
                              className="btn-ghost py-xs px-xs text-xs"
                            >
                              <span className="material-symbols-outlined text-sm">
                                {expandedRow === p._id ? 'expand_less' : 'expand_more'}
                              </span>
                            </button>
                            <button
                              title="Manage payroll"
                              onClick={() => setDetailPayroll(p)}
                              className="btn-secondary py-xs px-xs text-xs"
                            >
                              <span className="material-symbols-outlined text-sm">open_in_new</span>
                            </button>
                          </div>
                        </td>
                      </tr>
                      {/* Expanded breakdown row */}
                      {expandedRow === p._id && (
                        <tr key={`${p._id}-expanded`}>
                          <td colSpan="10" className="bg-surface-container-low p-md">
                            <div className="grid grid-cols-2 md:grid-cols-4 gap-md text-sm">
                              <div>
                                <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-xs">Salary</p>
                                <BreakdownRow label="Basic Salary"       value={fmtINR(p.basicSalary)} />
                                <BreakdownRow label="Applicable Salary"  value={fmtINR(p.applicableSalary)} highlight />
                                <BreakdownRow label="Daily Salary"       value={fmtINR(p.dailySalary)} indent />
                              </div>
                              <div>
                                <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-xs">Attendance</p>
                                <BreakdownRow label="Working Days"  value={p.totalWorkingDays} />
                                <BreakdownRow label="Present"       value={p.presentDays} indent />
                                <BreakdownRow label="Leave"         value={p.leaveDays}   indent />
                                <BreakdownRow label="Absent"        value={p.absentDays}  indent />
                                <BreakdownRow label="Weekly Off"    value={p.weeklyOffDays} indent />
                                <BreakdownRow label="Holiday"       value={p.holidayDays}   indent />
                              </div>
                              <div>
                                <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-xs">Deductions</p>
                                <BreakdownRow label="Absence Deduction" value={`-${fmtINR(p.absenceDeduction)}`} />
                              </div>
                              <div>
                                <p className="font-label-md text-label-md text-secondary uppercase tracking-wide mb-xs">Final</p>
                                <BreakdownRow label="Gross Salary"  value={fmtINR(p.grossSalary)} />
                                <BreakdownRow label="Net Salary"    value={fmtINR(p.netSalary)}   highlight />
                              </div>
                            </div>
                          </td>
                        </tr>
                      )}
                    </>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      )}

      {/* ─────────────────────────────────────────────────────────── */}
      {/* TAB: GENERATE PAYROLL                                       */}
      {/* ─────────────────────────────────────────────────────────── */}
      {activeTab === 'generate' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-lg">
          {/* Form */}
          <div className="bit-card space-y-md">
            <h3 className="font-title-md text-title-md text-on-surface">Payroll Parameters</h3>

            <div>
              <label className="font-label-md text-label-md text-secondary uppercase tracking-wide block mb-xs">
                Staff Member <span className="normal-case text-outline">(leave blank to generate for all)</span>
              </label>
              <select
                value={genForm.userId}
                onChange={(e) => { setGenForm((f) => ({ ...f, userId: e.target.value })); setPreview(null); }}
                className="bit-input"
              >
                <option value="">— All Active Staff —</option>
                {staffList.map((s) => (
                  <option key={s._id} value={s._id}>
                    {s.name} ({s.employeeId || s.staffId})
                  </option>
                ))}
              </select>
            </div>

            <div className="grid grid-cols-2 gap-md">
              <div>
                <label className="font-label-md text-label-md text-secondary uppercase tracking-wide block mb-xs">Month</label>
                <select
                  value={genForm.month}
                  onChange={(e) => { setGenForm((f) => ({ ...f, month: Number(e.target.value) })); setPreview(null); }}
                  className="bit-input"
                >
                  {MONTHS.map((m) => <option key={m.value} value={m.value}>{m.label}</option>)}
                </select>
              </div>
              <div>
                <label className="font-label-md text-label-md text-secondary uppercase tracking-wide block mb-xs">Year</label>
                <select
                  value={genForm.year}
                  onChange={(e) => { setGenForm((f) => ({ ...f, year: Number(e.target.value) })); setPreview(null); }}
                  className="bit-input"
                >
                  {YEARS.map((y) => <option key={y} value={y}>{y}</option>)}
                </select>
              </div>
            </div>

            <div>
              <label className="font-label-md text-label-md text-secondary uppercase tracking-wide block mb-xs">Remarks (optional)</label>
              <input
                type="text"
                value={genForm.remarks}
                onChange={(e) => setGenForm((f) => ({ ...f, remarks: e.target.value }))}
                placeholder="e.g. Includes festival bonus"
                className="bit-input"
              />
            </div>

            {genError && (
              <p className="text-error text-body-sm font-body-sm bg-red-50 border border-red-200 rounded p-sm">{genError}</p>
            )}
            {genSuccess && (
              <p className="text-emerald-700 text-body-sm font-body-sm bg-emerald-50 border border-emerald-200 rounded p-sm">{genSuccess}</p>
            )}

            <div className="flex gap-sm pt-sm border-t border-outline-variant">
              {genForm.userId && (
                <button onClick={handlePreview} disabled={previewLoading} className="btn-secondary flex-1">
                  {previewLoading
                    ? <span className="w-4 h-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
                    : <span className="material-symbols-outlined text-base">preview</span>}
                  Preview
                </button>
              )}
              <button onClick={handleGenerate} disabled={genLoading} className="btn-primary flex-1">
                {genLoading
                  ? <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  : <span className="material-symbols-outlined text-base">save</span>}
                {genForm.userId ? 'Generate' : 'Generate for All Staff'}
              </button>
            </div>

            <div className="bg-surface-container-low rounded p-sm text-xs text-secondary space-y-xs">
              <p className="font-semibold text-on-surface">Calculation Rules</p>
              <p>• Max applicable salary: ₹40,000 (capped)</p>
              <p>• Daily salary = Applicable ÷ Working days</p>
              <p>• Absent (unauthorized) → deduction</p>
              <p>• Approved Leave → no deduction</p>
              <p>• Weekly Off / Holiday → not counted</p>
            </div>
          </div>

          {/* Preview Panel */}
          <div className="bit-card">
            {!preview ? (
              <div className="flex flex-col items-center justify-center h-64 gap-md text-secondary">
                <span className="material-symbols-outlined text-[48px] text-outline">calculate</span>
                <p className="font-body-sm text-body-sm text-center">
                  Select a staff member and click <strong>Preview</strong> to see the calculation before saving.
                </p>
              </div>
            ) : (
              <div className="space-y-md">
                <div className="flex items-center justify-between">
                  <h3 className="font-title-md text-title-md text-on-surface">Preview</h3>
                  <span className="badge-info">Not Saved</span>
                </div>

                {/* Staff info */}
                <div className="bg-surface-container rounded p-sm">
                  <p className="font-semibold text-on-surface">{preview.staff?.name}</p>
                  <p className="text-xs text-secondary">{preview.staff?.employeeId} · {preview.staff?.designation}</p>
                  <p className="text-xs text-secondary mt-xs">
                    Period: <strong>{preview.period?.monthName} {preview.period?.year}</strong>
                  </p>
                </div>

                {/* Calculation breakdown */}
                <div className="space-y-xs">
                  <p className="font-label-md text-label-md text-secondary uppercase tracking-wide">Salary Calculation</p>
                  <BreakdownRow label="Basic Salary"        value={fmtINR(preview.breakdown?.basicSalary)} />
                  <BreakdownRow label="Applicable Salary (cap ₹40,000)" value={fmtINR(preview.breakdown?.applicableSalary)} highlight />
                  <BreakdownRow label="Total Working Days"  value={preview.breakdown?.totalWorkingDays} indent />
                  <BreakdownRow label="Daily Salary"        value={fmtINR(preview.breakdown?.dailySalary)} indent />
                </div>

                <div className="space-y-xs">
                  <p className="font-label-md text-label-md text-secondary uppercase tracking-wide">Attendance</p>
                  <BreakdownRow label="Present Days"   value={preview.breakdown?.presentDays} />
                  <BreakdownRow label="Leave Days"     value={preview.breakdown?.leaveDays} />
                  <BreakdownRow label="Absent Days"    value={preview.breakdown?.absentDays} />
                  <BreakdownRow label="Weekly Off"     value={preview.breakdown?.weeklyOffDays} />
                  <BreakdownRow label="Holiday"        value={preview.breakdown?.holidayDays} />
                </div>

                <div className="space-y-xs">
                  <p className="font-label-md text-label-md text-secondary uppercase tracking-wide">Final</p>
                  <BreakdownRow label="Absence Deduction"  value={`-${fmtINR(preview.breakdown?.absenceDeduction)}`} />
                  <BreakdownRow label="Gross Salary"       value={fmtINR(preview.breakdown?.grossSalary)} />
                  <BreakdownRow label="Net Salary"         value={fmtINR(preview.breakdown?.netSalary)} highlight />
                </div>

                <p className="text-xs text-outline text-center italic">
                  Preview only — click Generate to save this payroll record.
                </p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ── Detail / Status Modal ─────────────────────────────────── */}
      {detailPayroll && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40">
          <div className="bg-surface-container-lowest rounded-lg shadow-lg w-full max-w-lg mx-md p-lg space-y-md max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between">
              <h3 className="font-title-md text-title-md text-on-surface">Payroll Detail</h3>
              <button onClick={() => setDetailPayroll(null)} className="btn-ghost py-xs px-xs">
                <span className="material-symbols-outlined">close</span>
              </button>
            </div>

            {/* Staff info */}
            <div className="bg-surface-container rounded p-sm">
              <p className="font-semibold text-on-surface">{detailPayroll.user?.name}</p>
              <p className="text-xs text-secondary">{detailPayroll.user?.employeeId || detailPayroll.user?.staffId}</p>
              <p className="text-xs text-secondary">{detailPayroll.user?.designation} — {detailPayroll.user?.department?.name}</p>
              <p className="text-xs text-secondary mt-xs">
                Period: <strong>{monthName(detailPayroll.month)} {detailPayroll.year}</strong>
              </p>
            </div>

            {/* Breakdown */}
            <div className="space-y-xs">
              <p className="font-label-md text-label-md text-secondary uppercase tracking-wide">Calculation Breakdown</p>
              <BreakdownRow label="Basic Salary"           value={fmtINR(detailPayroll.basicSalary)} />
              <BreakdownRow label="Applicable Salary"      value={fmtINR(detailPayroll.applicableSalary)} highlight />
              <BreakdownRow label="Total Working Days"     value={detailPayroll.totalWorkingDays} indent />
              <BreakdownRow label="Daily Salary"           value={fmtINR(detailPayroll.dailySalary)} indent />
              <BreakdownRow label="Present Days"           value={detailPayroll.presentDays} />
              <BreakdownRow label="Leave Days (approved)"  value={detailPayroll.leaveDays} />
              <BreakdownRow label="Absent Days"            value={detailPayroll.absentDays} />
              <BreakdownRow label="Weekly Off"             value={detailPayroll.weeklyOffDays} />
              <BreakdownRow label="Absence Deduction"      value={`-${fmtINR(detailPayroll.absenceDeduction)}`} />
              <BreakdownRow label="Gross Salary"           value={fmtINR(detailPayroll.grossSalary)} />
              <BreakdownRow label="Net Salary"             value={fmtINR(detailPayroll.netSalary)} highlight />
            </div>

            {/* Status */}
            <div className="flex items-center gap-sm">
              <span className="font-label-md text-label-md text-secondary uppercase tracking-wide">Status:</span>
              <StatusBadge status={detailPayroll.status} />
            </div>
            {detailPayroll.remarks && (
              <p className="text-xs text-secondary italic">Remarks: {detailPayroll.remarks}</p>
            )}

            {/* Status actions */}
            <div className="flex gap-sm pt-sm border-t border-outline-variant flex-wrap">
              {detailPayroll.status === 'Draft' && (
                <button
                  onClick={() => handleStatusUpdate(detailPayroll._id, 'Processed')}
                  disabled={statusUpdating}
                  className="btn-primary"
                >
                  <span className="material-symbols-outlined text-base">check_circle</span>
                  Mark Processed
                </button>
              )}
              {detailPayroll.status === 'Processed' && (
                <button
                  onClick={() => handleStatusUpdate(detailPayroll._id, 'Paid')}
                  disabled={statusUpdating}
                  className="btn-primary"
                >
                  <span className="material-symbols-outlined text-base">payments</span>
                  Mark Paid
                </button>
              )}
              {detailPayroll.status === 'Paid' && (
                <span className="text-emerald-700 font-semibold text-body-sm flex items-center gap-xs">
                  <span className="material-symbols-outlined text-base">verified</span>
                  Salary Paid
                </span>
              )}
              <button onClick={() => setDetailPayroll(null)} className="btn-ghost ml-auto">Close</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminPayrollPage;
