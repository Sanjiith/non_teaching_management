import { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '../../context/AuthContext';
import { getRoleDashboard } from '../../utils/roleHelpers';
import { APP_NAME } from '../../config/constants';

const LoginPage = () => {
  const { login, isAuthenticated, user, isLoading, error, clearError } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  const [formData, setFormData] = useState({ employeeId: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [formError, setFormError] = useState('');
  const [submitting, setSubmitting] = useState(false);

  // If already logged in, redirect to their dashboard
  useEffect(() => {
    if (isAuthenticated && user) {
      const from = location.state?.from?.pathname || getRoleDashboard(user.role);
      navigate(from, { replace: true });
    }
  }, [isAuthenticated, user, navigate, location]);

  // Sync auth context error
  useEffect(() => {
    if (error) setFormError(error);
    return () => clearError();
  }, [error, clearError]);

  const handleChange = (e) => {
    setFormError('');
    setFormData((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setFormError('');

    const { employeeId, password } = formData;
    if (!employeeId.trim()) return setFormError('Employee ID is required.');
    if (!password)          return setFormError('Password is required.');
    if (password.length < 6) return setFormError('Password must be at least 6 characters.');

    setSubmitting(true);
    try {
      const loggedInUser = await login(employeeId.trim(), password);
      navigate(getRoleDashboard(loggedInUser.role), { replace: true });
    } catch (err) {
      setFormError(err.message || 'Login failed. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center p-md relative overflow-hidden">
      {/* ── Background ───────────────────────────────────────────── */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-surface to-secondary-container/20" />

      {/* ── Login Card ───────────────────────────────────────────── */}
      <main className="w-full max-w-[440px] z-10">
        <div className="bg-surface-container-lowest border border-outline-variant rounded-lg flex flex-col items-center pt-xl pb-lg px-xl shadow-sm">

          {/* Branding */}
          <div className="flex flex-col items-center mb-xl">
            <div className="w-16 h-16 bg-primary-container text-on-primary rounded-full flex items-center justify-center mb-md shadow-sm">
              <span className="material-symbols-outlined text-display-lg" style={{ fontVariationSettings: "'FILL' 1" }}>school</span>
            </div>
            <h1 className="font-headline-md text-headline-md text-primary text-center">
              Bannari Amman Institute of Technology
            </h1>
            <p className="font-body-sm text-body-sm text-secondary text-center mt-xs">
              Non-Teaching Staff Portal
            </p>
          </div>

          {/* Form */}
          <form className="w-full flex flex-col gap-md" onSubmit={handleSubmit} noValidate>

            {/* Employee ID */}
            <div className="flex flex-col gap-xs relative">
              <label className="font-label-md text-label-md text-on-surface uppercase" htmlFor="employeeId">
                Employee ID
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">badge</span>
                <input
                  id="employeeId"
                  name="employeeId"
                  type="text"
                  autoComplete="username"
                  placeholder="e.g. BIT-ADM-001"
                  value={formData.employeeId}
                  onChange={handleChange}
                  className="bit-input pl-9"
                  style={{ height: '44px' }}
                />
              </div>
            </div>

            {/* Password */}
            <div className="flex flex-col gap-xs relative">
              <label className="font-label-md text-label-md text-on-surface uppercase" htmlFor="password">
                Password
              </label>
              <div className="relative flex items-center">
                <span className="material-symbols-outlined absolute left-sm top-1/2 -translate-y-1/2 text-outline text-xl pointer-events-none">lock</span>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? 'text' : 'password'}
                  autoComplete="current-password"
                  placeholder="Enter your password"
                  value={formData.password}
                  onChange={handleChange}
                  className="bit-input pl-9 pr-10"
                  style={{ height: '44px' }}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((p) => !p)}
                  className="absolute right-sm top-1/2 -translate-y-1/2 text-outline hover:text-secondary transition-colors"
                  tabIndex={-1}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  <span className="material-symbols-outlined text-xl">
                    {showPassword ? 'visibility_off' : 'visibility'}
                  </span>
                </button>
              </div>
            </div>

            {/* Error message */}
            {formError && (
              <div className="flex items-center gap-sm p-sm bg-error-container rounded border border-error/20">
                <span className="material-symbols-outlined text-error text-xl flex-shrink-0">error</span>
                <p className="font-body-sm text-body-sm text-on-error-container">{formError}</p>
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={submitting || isLoading}
              className="btn-primary justify-center py-sm mt-sm disabled:opacity-60 disabled:cursor-not-allowed"
              style={{ height: '44px' }}
            >
              {submitting ? (
                <>
                  <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                  Signing in...
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-xl">login</span>
                  Sign In
                </>
              )}
            </button>
          </form>

          {/* Helper credentials for dev */}
          <div className="mt-lg w-full border-t border-outline-variant pt-md">
            <p className="font-label-md text-label-md text-secondary text-center uppercase mb-sm">Demo Credentials</p>
            <div className="grid grid-cols-3 gap-sm text-center">
              {[
                { role: 'Admin', id: 'BIT-ADM-001', pw: 'Admin@123' },
                { role: 'HOD',   id: 'BIT-HOD-001', pw: 'Hod@123' },
                { role: 'Staff', id: 'BIT-NTS-001', pw: 'Staff@123' },
              ].map(({ role, id, pw }) => (
                <button
                  key={role}
                  type="button"
                  onClick={() => setFormData({ employeeId: id, password: pw })}
                  className="flex flex-col items-center p-sm rounded border border-outline-variant hover:bg-surface-container-low transition-colors cursor-pointer"
                >
                  <span className="font-label-md text-label-md text-primary">{role}</span>
                  <span className="font-label-sm text-label-sm text-secondary mt-xs">{id}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <p className="text-center font-label-sm text-label-sm text-outline mt-md">
          © {new Date().getFullYear()} Bannari Amman Institute of Technology, Sathyamangalam
        </p>
      </main>
    </div>
  );
};

export default LoginPage;
