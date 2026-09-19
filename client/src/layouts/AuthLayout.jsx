import { Outlet } from 'react-router-dom';

/**
 * AuthLayout — clean centered wrapper for login and other auth pages
 */
const AuthLayout = () => {
  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-md relative overflow-hidden">
      {/* Background gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-primary-container/5 via-background to-secondary-container/10 z-0" />
      {/* Content */}
      <div className="relative z-10 w-full">
        <Outlet />
      </div>
    </div>
  );
};

export default AuthLayout;
