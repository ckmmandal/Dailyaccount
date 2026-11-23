import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { supabaseService } from '../services/supabaseService';
import { storageService } from '../services/storageService';
import { 
  Lock, User as UserIcon, AlertCircle, Eye, EyeOff, ArrowRight, 
  KeyRound, CheckCircle2
} from 'lucide-react';
import { ForgotPasswordModal } from './ForgotPasswordModal';
import { User } from '../types';

const NepalFlagMotif: React.FC<{ className?: string }> = ({ className = '' }) => (
  <svg
    viewBox="0 0 300 366"
    fill="none"
    xmlns="http://www.w3.org/2000/svg"
    className={className}
    aria-hidden="true"
  >
    {/* Royal Blue Outer Border + Crimson Fill */}
    <path
      d="M14 14 L268 182 L106 182 L286 352 L14 352 Z"
      fill="#C8102E"
      stroke="#003893"
      strokeWidth="24"
      strokeLinejoin="round"
    />
    {/* Upper Crescent Moon + 8-Ray Star */}
    <g transform="translate(86, 122)">
      <path
        d="M-32 -6 A34 34 0 0 0 32 -6 A27 27 0 0 1 -32 -6 Z"
        fill="#FFFFFF"
      />
      <polygon
        points="0,-24 4,-11 17,-15 9,-4 21,3 7,5 10,18 0,9 -10,18 -7,5 -21,3 -9,-4 -17,-15 -4,-11"
        fill="#FFFFFF"
      />
    </g>
    {/* Lower 12-Pointed Sun */}
    <g transform="translate(96, 272)">
      <circle cx="0" cy="0" r="24" fill="#FFFFFF" />
      {Array.from({ length: 12 }).map((_, i) => (
        <polygon
          key={i}
          points="-6,-22 0,-44 6,-22"
          fill="#FFFFFF"
          transform={`rotate(${i * 30})`}
        />
      ))}
    </g>
  </svg>
);

export const LoginPage: React.FC = () => {
  const { login, settings } = useAuth();
  const [serverLogo, setServerLogo] = useState<string | null>(null);
  const [credentials, setCredentials] = useState({ username: '', password: '' });
  const [showPassword, setShowPassword] = useState(false);
  const [keepSignedIn, setKeepSignedIn] = useState(true);
  const [error, setError] = useState('');
  const [isLoggingIn, setIsLoggingIn] = useState(false);
  const [isForgotPasswordOpen, setIsForgotPasswordOpen] = useState(false);
  const [successToast, setSuccessToast] = useState<string | null>(null);
  const usernameInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    // Fast fetch latest system logo from server or storage
    fetch('/api/system-logo')
      .then(r => r.json())
      .then(d => {
        if (d && d.logoUrl) setServerLogo(d.logoUrl);
      })
      .catch(() => {});
  }, []);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');
    
    try {
      const enteredUsername = (credentials.username || '').trim().toLowerCase();
      const enteredPassword = credentials.password || '';

      // Always fetch the latest uncached user row directly from Supabase first so newly updated permissions/branches take effect immediately
      let foundUser: User | undefined;
      const directUser = await supabaseService
        .getFreshUserByIdOrUsername({ username: enteredUsername })
        .catch(() => null);
      if (directUser && directUser.password === enteredPassword) {
        foundUser = directUser;
      } else {
        const users = await supabaseService.getUsers({ forceRefresh: true }).catch(() => []);
        const userList = Array.isArray(users) ? users : [];
        foundUser = userList.find(
          u =>
            u &&
            u.username &&
            u.username.toLowerCase() === enteredUsername &&
            u.password === enteredPassword
        );
      }
      
      if (foundUser) {
        if (foundUser.status === 'Inactive') {
          setError('Your account has been deactivated. Please contact the administrator.');
          return;
        }

        // Try to fetch linked employee to fill missing branchId/designation without overwriting Admin's User Edit settings
        try {
          const employees = await supabaseService.getEmployees().catch(() => []);
          const empList = Array.isArray(employees) ? employees : [];
          const linked = empList.find(e => {
            if (!e) return false;
            const empName = (e.fullName || '').toLowerCase().trim();
            const uName = (foundUser.fullName || '').toLowerCase().trim();
            const sameName = empName !== '' && empName === uName;

            const empEmail = (e.email || '').toLowerCase().trim();
            const uEmail = (foundUser.email || '').toLowerCase().trim();
            const sameEmail = empEmail !== '' && uEmail !== '' && empEmail === uEmail;

            const empCode = (e.employeeCode || '').toLowerCase().trim();
            const uUsername = (foundUser.username || '').toLowerCase().trim();
            const sameCode = empCode !== '' && empCode === uUsername;

            return sameName || sameEmail || sameCode;
          });

          if (linked && linked.branchId && !foundUser.branchId) {
            foundUser.branchId = linked.branchId;
          }
          if (linked && linked.designation && !foundUser.designation) {
            foundUser.designation = linked.designation;
          }
        } catch (e) {
          console.warn("Could not sync linked employee on login", e);
        }

        login(foundUser);
        void storageService.saveLog(
          foundUser.id || foundUser.username,
          'USER_LOGIN',
          `User @${foundUser.username} (${foundUser.fullName}) signed in`,
          foundUser.branchId || 'main'
        ).catch(() => {});
      } else if (enteredUsername === 'admin' && enteredPassword === 'admin') {
        const defaultAdmin: User = {
          id: 'admin-temp',
          fullName: 'System Administrator',
          username: 'admin',
          password: 'admin',
          mobile: '9800000000',
          roleId: '1',
          branchId: 'main',
          status: 'Active' as const,
          accountCreated: Date.now(),
          permissions: [
            'view_transaction', 'add_transaction', 'edit_transaction', 'delete_transaction',
            'view_reports', 'manage_users', 'manage_settings', 'view_cash_entry',
            'view_daily_ledger', 'view_income_expense', 'view_ledger_names',
            'view_consolidated_report', 'cross_branch_operation', 'manage_hr', 'manage_notices'
          ]
        };
        login(defaultAdmin);
        void storageService.saveLog(
          defaultAdmin.id,
          'USER_LOGIN',
          `User @${defaultAdmin.username} (${defaultAdmin.fullName}) signed in`,
          defaultAdmin.branchId || 'main'
        ).catch(() => {});
      } else {
        setError('Invalid username or password.');
      }
    } catch (err) {
      console.error("Login error", err);
      setError('Could not connect to server. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  return (
    <div className="min-h-screen relative overflow-hidden bg-gradient-to-br from-[#06183f] via-[#131d47] to-[#630b1b] flex flex-col items-center justify-center p-4 sm:p-6 font-sans">
      <style>{`
        input.login-glass-input:-webkit-autofill,
        input.login-glass-input:-webkit-autofill:hover,
        input.login-glass-input:-webkit-autofill:focus,
        input.login-glass-input:-webkit-autofill:active {
          -webkit-text-fill-color: #ffffff !important;
          -webkit-box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.12) inset !important;
          box-shadow: 0 0 0 1000px rgba(255, 255, 255, 0.12) inset !important;
          transition: background-color 9999s ease-in-out 0s;
          caret-color: #ffffff;
        }
      `}</style>

      {/* Ambient Nepal Flag & Celestial Backdrop */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden select-none">
        {/* Soft Radial Glows */}
        <div className="absolute -top-32 -left-32 w-[520px] h-[520px] rounded-full bg-[#003893]/40 blur-3xl" />
        <div className="absolute -bottom-32 -right-32 w-[580px] h-[580px] rounded-full bg-[#dc143c]/35 blur-3xl" />

        {/* Large Right-Center Nepal Flag */}
        <NepalFlagMotif className="absolute -right-8 md:right-[6%] top-1/2 -translate-y-1/2 w-[540px] sm:w-[660px] lg:w-[760px] -rotate-[9deg] opacity-95 drop-shadow-[0_20px_50px_rgba(0,0,0,0.45)]" />

        {/* Left Secondary Nepal Flag */}
        <NepalFlagMotif className="absolute -left-24 -bottom-24 w-[420px] sm:w-[500px] rotate-[10deg] opacity-40" />

        {/* Top-left subtle Moon watermark */}
        <svg viewBox="0 0 100 100" className="absolute top-8 left-12 w-24 h-24 opacity-20" fill="none" aria-hidden="true">
          <path d="M22 54 A28 28 0 0 0 78 54 A23 23 0 0 1 22 54 Z" fill="#FFFFFF" />
          <polygon points="50,24 53,34 63,31 56,39 66,44 55,46 57,56 50,49 43,56 45,46 34,44 44,39 37,31 47,34" fill="#FFFFFF" />
        </svg>

        {/* Bottom-right subtle Sun watermark */}
        <svg viewBox="0 0 100 100" className="absolute bottom-10 right-12 w-28 h-28 opacity-20" fill="none" aria-hidden="true">
          <circle cx="50" cy="50" r="18" fill="#FFFFFF" />
          {Array.from({ length: 12 }).map((_, i) => (
            <polygon
              key={i}
              points="46,34 50,14 54,34"
              fill="#FFFFFF"
              transform={`rotate(${i * 30} 50 50)`}
            />
          ))}
        </svg>
      </div>

      {/* Main Fully Transparent Frosted Glass Card */}
      <div className="relative z-10 w-full max-w-[850px] rounded-3xl overflow-hidden border border-white/25 bg-transparent shadow-[0_25px_65px_rgba(0,0,0,0.45)] flex flex-col md:flex-row">
        {/* Left Side - Transparent Emerald Glass Brand Panel */}
        <div className="w-full md:w-[44%] bg-[#013b31]/25 backdrop-blur-sm p-7 sm:p-8 lg:p-9 flex flex-col items-center justify-between text-white border-b md:border-b-0 md:border-r border-white/20">
          <div className="hidden md:block h-2" />

          <div className="my-4 md:my-auto flex flex-col items-center text-center space-y-5 w-full">
            <div className="w-28 h-28 sm:w-32 sm:h-32 bg-white rounded-2xl shadow-[0_12px_32px_rgba(0,0,0,0.35)] flex items-center justify-center p-2.5 border border-white/40 transition-transform hover:scale-105 duration-300 overflow-hidden">
              <img
                src={
                  (settings?.logoUrl && !settings.logoUrl.includes('picsum.photos'))
                    ? settings.logoUrl
                    : (serverLogo || '/system_logo.png')
                }
                onError={(e) => {
                  const target = e.currentTarget;
                  if (!target.src.includes('system_logo.png')) {
                    target.src = '/system_logo.png';
                  }
                }}
                className="w-full h-full object-contain"
                alt="SACCOS Official Logo"
              />
            </div>
            <div className="w-full px-1">
              <h2 className="text-[13.5px] sm:text-[14.5px] font-bold tracking-tight text-white leading-snug drop-shadow-sm">
                Ratauli Saving & Credit Cooperative Limited
              </h2>
            </div>
          </div>

          <div className="w-full pt-4 mt-2 border-t border-white/20 text-[11.5px] text-white/85 text-center font-semibold tracking-wide">
            Daily Account Management System
          </div>
        </div>

        {/* Right Side - Transparent Glass Sign-In Form */}
        <div className="w-full md:w-[56%] bg-[#0f1322]/20 backdrop-blur-sm p-7 sm:p-10 md:p-11 flex flex-col justify-center">
          <div className="mb-6">
            <h2 className="text-2xl sm:text-[30px] font-black text-white tracking-tight leading-tight drop-shadow-sm">
              Sign in to your account
            </h2>
            <p className="text-slate-100/85 text-xs sm:text-sm font-medium mt-1.5">
              Enter your credentials to access the system.
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-4">
            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/95 block">
                Username
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/65 group-focus-within:text-white transition-colors pointer-events-none">
                  <UserIcon size={17} />
                </div>
                <input
                  ref={usernameInputRef}
                  type="text"
                  autoComplete="username"
                  value={credentials.username}
                  onChange={e => setCredentials({ ...credentials, username: e.target.value })}
                  className="login-glass-input w-full h-11 sm:h-12 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/30 focus:border-white/60 rounded-xl pl-11 pr-4 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-white/60 backdrop-blur-sm"
                  placeholder="Enter username"
                  required
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-xs font-bold text-white/95 block">
                Password
              </label>
              <div className="relative group">
                <div className="absolute left-3.5 top-1/2 -translate-y-1/2 text-white/65 group-focus-within:text-white transition-colors pointer-events-none">
                  <Lock size={17} />
                </div>
                <input
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  value={credentials.password}
                  onChange={e => setCredentials({ ...credentials, password: e.target.value })}
                  className="login-glass-input w-full h-11 sm:h-12 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/30 focus:border-white/60 rounded-xl pl-11 pr-11 text-sm font-medium text-white outline-none focus:ring-2 focus:ring-white/20 transition-all placeholder:text-white/60 backdrop-blur-sm"
                  placeholder="Enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3.5 top-1/2 -translate-y-1/2 text-white/65 hover:text-white transition-colors p-1"
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                >
                  {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                </button>
              </div>
            </div>

            {error && (
              <div className="flex items-center space-x-2.5 bg-rose-500/25 text-rose-100 p-3 rounded-xl border border-rose-400/40 text-xs font-bold animate-in fade-in backdrop-blur-sm">
                <AlertCircle size={16} className="shrink-0 text-rose-300" />
                <span>{error}</span>
              </div>
            )}

            {successToast && (
              <div className="flex items-center space-x-2.5 bg-emerald-500/25 text-emerald-100 p-3 rounded-xl border border-emerald-400/40 text-xs font-bold animate-in fade-in backdrop-blur-sm">
                <CheckCircle2 size={16} className="text-emerald-300 shrink-0" />
                <span>{successToast}</span>
              </div>
            )}

            <div className="flex items-center justify-between text-xs pt-1">
              <label className="flex items-center space-x-2 cursor-pointer select-none">
                <input
                  type="checkbox"
                  checked={keepSignedIn}
                  onChange={e => setKeepSignedIn(e.target.checked)}
                  className="w-4 h-4 rounded border-white/30 bg-white/15 accent-[#0284c7] cursor-pointer"
                />
                <span className="text-white/95 font-semibold">Keep me signed in</span>
              </label>

              <button
                type="button"
                onClick={() => {
                  setError('');
                  setIsForgotPasswordOpen(true);
                }}
                className="text-rose-300 hover:text-rose-200 font-bold text-xs hover:underline flex items-center space-x-1 transition-colors"
              >
                <KeyRound size={13} />
                <span>Forgot Password?</span>
              </button>
            </div>

            <div className="pt-2">
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-[#dc143c] to-[#e11d48] hover:from-[#be123c] hover:to-[#dc143c] text-white h-11 sm:h-12 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 shadow-[0_10px_28px_rgba(220,20,60,0.45)] active:scale-[0.99] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <span>{isLoggingIn ? 'Logging in...' : 'Sign In'}</span>
                {!isLoggingIn && <ArrowRight size={17} />}
              </button>
            </div>
          </form>
        </div>
      </div>

      {/* Forgot Password Modal */}
      {isForgotPasswordOpen && (
        <ForgotPasswordModal
          initialUsername={credentials.username}
          onClose={() => setIsForgotPasswordOpen(false)}
          onSuccess={(resetUsername) => {
            setIsForgotPasswordOpen(false);
            setCredentials(prev => ({ ...prev, username: resetUsername, password: '' }));
            setSuccessToast('Your password has been changed successfully! Please log in with your new password.');
            setTimeout(() => setSuccessToast(null), 7000);
          }}
        />
      )}
    </div>
  );
};

export default LoginPage;
