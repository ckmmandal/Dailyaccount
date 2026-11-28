import React, { useState, useRef, useEffect } from 'react';
import { useAuth } from '../AuthContext';
import { storageService } from '../services/storageService';
import { setAuthToken } from '../services/authToken';
import { 
  Lock, User as UserIcon, AlertCircle, Eye, EyeOff, ArrowRight, 
  KeyRound, CheckCircle2, ShieldCheck, Mail, ArrowLeft, RefreshCw, Smartphone
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
  const [needsBootstrap, setNeedsBootstrap] = useState(false);
  const [twoStepChallenge, setTwoStepChallenge] = useState<{
    challengeId: string;
    maskedEmail: string;
    username: string;
    method: 'authenticator' | 'authenticator_setup' | 'email';
    qrDataUrl?: string;
  } | null>(null);
  const [twoStepOtp, setTwoStepOtp] = useState('');
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const [isResendingOtp, setIsResendingOtp] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const [bootstrapForm, setBootstrapForm] = useState({
    fullName: 'System Administrator',
    username: 'admin',
    email: '',
    password: '',
    confirmPassword: ''
  });
  const usernameInputRef = useRef<HTMLInputElement>(null);
  const otpInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const t = setTimeout(() => setResendCooldown(prev => Math.max(0, prev - 1)), 1000);
    return () => clearTimeout(t);
  }, [resendCooldown]);

  useEffect(() => {
    if (twoStepChallenge) {
      setTimeout(() => otpInputRef.current?.focus(), 60);
    }
  }, [twoStepChallenge]);

  useEffect(() => {
    // Fast fetch latest system logo from server or storage
    fetch('/api/system-logo')
      .then(r => r.json())
      .then(d => {
        if (d && d.logoUrl) setServerLogo(d.logoUrl);
      })
      .catch(() => {});

    // Check if first-run admin bootstrap is required (only when database has 0 users)
    fetch('/api/auth/bootstrap-status')
      .then(r => r.json())
      .then(d => {
        if (d && d.needsBootstrap === true) {
          setNeedsBootstrap(true);
        }
      })
      .catch(() => {});
  }, []);

  const handleBootstrapAdmin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (bootstrapForm.password !== bootstrapForm.confirmPassword) {
      setError('Passwords do not match.');
      return;
    }
    setIsLoggingIn(true);
    try {
      const response = await fetch('/api/auth/bootstrap-admin', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          fullName: bootstrapForm.fullName,
          username: bootstrapForm.username,
          email: bootstrapForm.email,
          password: bootstrapForm.password
        })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.user) {
        setError(data.message || 'Could not create initial administrator.');
        return;
      }
      if (data.token) {
        setAuthToken(data.token);
      }
      setNeedsBootstrap(false);
      login(data.user as User);
    } catch (err) {
      console.error('Bootstrap admin error', err);
      setError('Could not connect to server. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoggingIn(true);
    setError('');

    try {
      const enteredUsername = (credentials.username || '').trim();
      const enteredPassword = credentials.password || '';

      const response = await fetch('/api/auth/login', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          username: enteredUsername,
          password: enteredPassword
        })
      });

      const data = await response.json().catch(() => ({}));
      if (response.ok && data.success && data.requiresTwoStep && data.challengeId) {
        const method: 'authenticator' | 'authenticator_setup' | 'email' =
          data.twoStepMethod === 'authenticator_setup'
            ? 'authenticator_setup'
            : data.twoStepMethod === 'authenticator'
            ? 'authenticator'
            : 'email';
        const safeQrUrl =
          typeof data.qrDataUrl === 'string' && data.qrDataUrl.startsWith('data:image/png;base64,')
            ? data.qrDataUrl
            : undefined;
        setTwoStepChallenge({
          challengeId: String(data.challengeId),
          maskedEmail: String(data.maskedEmail || 'your registered email'),
          username: enteredUsername,
          method,
          qrDataUrl: safeQrUrl
        });
        setTwoStepOtp('');
        setResendCooldown(method === 'email' ? 30 : 0);
        setSuccessToast(
          data.message ||
            (method === 'authenticator_setup'
              ? 'Scan the QR code in Google Authenticator and enter the 6-digit code to complete setup & sign in.'
              : method === 'authenticator'
              ? 'Enter the 6-digit code from your Google Authenticator app.'
              : 'Verification code sent to your registered email.')
        );
        return;
      }

      if (!response.ok || !data.success || !data.user) {
        if (typeof data.message === 'string' && data.message.trim()) {
          setError(data.message);
        } else if (response.status === 404) {
          setError('Login API (/api/auth/login) not found on this deployment. Please push the latest code and redeploy.');
        } else if (response.status >= 500) {
          setError(`Server error (HTTP ${response.status}) while verifying login. Please check Vercel Environment Variables and redeploy.`);
        } else {
          setError('Invalid username or password.');
        }
        return;
      }

      if (data.token) {
        setAuthToken(data.token);
      }

      const authenticatedUser = data.user as User;
      login(authenticatedUser);
      void storageService.saveLog(
        authenticatedUser.id || authenticatedUser.username,
        'USER_LOGIN',
        `User @${authenticatedUser.username} (${authenticatedUser.fullName}) signed in`,
        authenticatedUser.branchId || 'main'
      ).catch(() => {});
    } catch (err) {
      console.error("Login error", err);
      setError('Could not connect to server. Please try again.');
    } finally {
      setIsLoggingIn(false);
    }
  };

  const handleVerifyTwoStepOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!twoStepChallenge) return;
    const cleanOtp = twoStepOtp.replace(/\D/g, '').trim();
    if (cleanOtp.length !== 6) {
      setError(
        twoStepChallenge.method === 'authenticator' || twoStepChallenge.method === 'authenticator_setup'
          ? 'Please enter the 6-digit code from your Google Authenticator app.'
          : 'Please enter the 6-digit verification code sent to your email.'
      );
      return;
    }

    setIsVerifyingOtp(true);
    setError('');
    setSuccessToast(null);

    try {
      const response = await fetch('/api/auth/verify-login-otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId: twoStepChallenge.challengeId,
          otpCode: cleanOtp
        })
      });

      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success || !data.user) {
        setError(data.message || 'Invalid or expired verification code. Please try again.');
        return;
      }

      if (data.token) {
        setAuthToken(data.token);
      }

      const verifiedMethodLabel =
        twoStepChallenge.method === 'authenticator_setup'
          ? '2-Step Google Authenticator (First-Time Setup)'
          : twoStepChallenge.method === 'authenticator'
          ? '2-Step Google Authenticator'
          : '2-Step Email OTP';
      const authenticatedUser = data.user as User;
      setTwoStepChallenge(null);
      setTwoStepOtp('');
      login(authenticatedUser);
      void storageService.saveLog(
        authenticatedUser.id || authenticatedUser.username,
        'USER_LOGIN',
        `User @${authenticatedUser.username} (${authenticatedUser.fullName}) signed in via ${verifiedMethodLabel}`,
        authenticatedUser.branchId || 'main'
      ).catch(() => {});
    } catch (err) {
      console.error('2-Step OTP verification error', err);
      setError('Could not verify code. Please check your connection and try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  const handleResendTwoStepOtp = async () => {
    if (!twoStepChallenge || resendCooldown > 0 || isResendingOtp) return;
    setIsResendingOtp(true);
    setError('');
    setSuccessToast(null);
    try {
      const response = await fetch('/api/auth/resend-login-otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ challengeId: twoStepChallenge.challengeId })
      });
      const data = await response.json().catch(() => ({}));
      if (!response.ok || !data.success) {
        setError(data.message || 'Could not resend verification code. Please sign in again.');
        return;
      }
      if (data.challengeId) {
        setTwoStepChallenge(prev =>
          prev
            ? {
                ...prev,
                challengeId: String(data.challengeId),
                maskedEmail: String(data.maskedEmail || prev.maskedEmail)
              }
            : null
        );
      }
      setTwoStepOtp('');
      setResendCooldown(30);
      setSuccessToast('A new 6-digit verification code has been sent to your email.');
    } catch (err) {
      console.error('Resend 2-Step OTP error', err);
      setError('Could not resend code. Please try again.');
    } finally {
      setIsResendingOtp(false);
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
      <div
        className={`relative z-10 w-full ${
          twoStepChallenge?.method === 'authenticator_setup' ? 'max-w-[400px]' : 'max-w-[850px]'
        } rounded-3xl overflow-hidden border border-white/25 bg-transparent shadow-[0_25px_65px_rgba(0,0,0,0.45)] flex flex-col md:flex-row`}
      >
        {/* Left Side - Transparent Emerald Glass Brand Panel (hidden during 1-time QR setup) */}
        {twoStepChallenge?.method !== 'authenticator_setup' && (
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
        )}

        {/* Right Side - Transparent Glass Sign-In Form */}
        <div
          className={`w-full ${
            twoStepChallenge?.method === 'authenticator_setup'
              ? 'bg-[#091124]/60 backdrop-blur-md px-6 py-7 sm:px-8 sm:py-8'
              : 'md:w-[56%] bg-[#0f1322]/20 backdrop-blur-sm p-7 sm:p-10 md:p-11'
          } flex flex-col justify-center`}
        >
          {twoStepChallenge?.method === 'authenticator_setup' ? (
            <div className="text-center mb-5">
              <div className="w-10 h-10 rounded-xl bg-emerald-500/20 border border-emerald-400/35 text-emerald-300 flex items-center justify-center mx-auto mb-3">
                <ShieldCheck size={20} />
              </div>
              <h2 className="text-[20px] sm:text-[22px] font-bold text-white tracking-tight leading-none whitespace-nowrap">
                Setup Google Authenticator
              </h2>
              <p className="text-slate-200/80 text-[12px] font-medium mt-2 whitespace-nowrap">
                Scan the QR code and enter the 6-digit code
              </p>
            </div>
          ) : (
            <div className="mb-6">
              <h2 className="text-2xl sm:text-[30px] font-black text-white tracking-tight leading-tight drop-shadow-sm">
                {needsBootstrap
                  ? 'Initial Admin Setup'
                  : twoStepChallenge
                  ? '2-Step Verification'
                  : 'Sign in to your account'}
              </h2>
              <p className="text-slate-100/85 text-xs sm:text-sm font-medium mt-1.5">
                {needsBootstrap
                  ? 'No accounts exist yet. Create your primary administrator account with a strong password.'
                  : twoStepChallenge
                  ? twoStepChallenge.method === 'authenticator'
                    ? 'Open Google Authenticator and enter the 6-digit code.'
                    : `Enter the 6-digit code sent to ${twoStepChallenge.maskedEmail}`
                  : 'Enter your credentials to access the system.'}
              </p>
            </div>
          )}

          {needsBootstrap ? (
            <form onSubmit={handleBootstrapAdmin} className="space-y-3.5">
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/95 block">Admin Full Name</label>
                <input
                  type="text"
                  value={bootstrapForm.fullName}
                  onChange={e => setBootstrapForm({ ...bootstrapForm, fullName: e.target.value })}
                  className="login-glass-input w-full h-10 bg-white/10 border border-white/30 rounded-xl px-3.5 text-sm font-medium text-white outline-none focus:border-white/60"
                  required
                />
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/95 block">Username</label>
                  <input
                    type="text"
                    value={bootstrapForm.username}
                    onChange={e => setBootstrapForm({ ...bootstrapForm, username: e.target.value })}
                    className="login-glass-input w-full h-10 bg-white/10 border border-white/30 rounded-xl px-3.5 text-sm font-medium text-white outline-none focus:border-white/60"
                    required
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-xs font-bold text-white/95 block">Admin Email</label>
                  <input
                    type="email"
                    value={bootstrapForm.email}
                    onChange={e => setBootstrapForm({ ...bootstrapForm, email: e.target.value })}
                    placeholder="admin@cooperative.org"
                    className="login-glass-input w-full h-10 bg-white/10 border border-white/30 rounded-xl px-3.5 text-sm font-medium text-white outline-none focus:border-white/60 placeholder:text-white/50"
                  />
                </div>
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/95 block">Strong Password (min 8 chars, upper, lower, number, symbol)</label>
                <input
                  type="password"
                  value={bootstrapForm.password}
                  onChange={e => setBootstrapForm({ ...bootstrapForm, password: e.target.value })}
                  className="login-glass-input w-full h-10 bg-white/10 border border-white/30 rounded-xl px-3.5 text-sm font-medium text-white outline-none focus:border-white/60"
                  required
                />
              </div>
              <div className="space-y-1">
                <label className="text-xs font-bold text-white/95 block">Confirm Password</label>
                <input
                  type="password"
                  value={bootstrapForm.confirmPassword}
                  onChange={e => setBootstrapForm({ ...bootstrapForm, confirmPassword: e.target.value })}
                  className="login-glass-input w-full h-10 bg-white/10 border border-white/30 rounded-xl px-3.5 text-sm font-medium text-white outline-none focus:border-white/60"
                  required
                />
              </div>
              {error && (
                <div className="flex items-center space-x-2.5 bg-rose-500/25 text-rose-100 p-3 rounded-xl border border-rose-400/40 text-xs font-bold">
                  <AlertCircle size={16} className="shrink-0 text-rose-300" />
                  <span>{error}</span>
                </div>
              )}
              <button
                type="submit"
                disabled={isLoggingIn}
                className="w-full bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white h-11 rounded-xl font-bold text-sm flex items-center justify-center space-x-2 shadow-lg transition-all disabled:opacity-50"
              >
                <ShieldCheck size={17} />
                <span>{isLoggingIn ? 'Creating Admin...' : 'Create Administrator Account'}</span>
              </button>
            </form>
          ) : twoStepChallenge ? (
            <form onSubmit={handleVerifyTwoStepOtp} className="space-y-4">
              {twoStepChallenge.method === 'authenticator_setup' ? (
                twoStepChallenge.qrDataUrl ? (
                  <div className="flex justify-center">
                    <div className="inline-flex items-center justify-center bg-white rounded-2xl p-2 shadow-[0_12px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/40">
                      <img
                        src={twoStepChallenge.qrDataUrl}
                        alt="Google Authenticator Setup QR Code"
                        className="w-[176px] h-[176px] block rounded-lg"
                      />
                    </div>
                  </div>
                ) : null
              ) : twoStepChallenge.method === 'authenticator' ? (
                <div className="flex items-center space-x-2.5 bg-emerald-500/20 border border-emerald-400/35 text-emerald-100 p-3 rounded-xl text-xs font-semibold backdrop-blur-sm">
                  <Smartphone size={16} className="shrink-0 text-emerald-300" />
                  <span>Google Authenticator code (refreshes every 30 seconds)</span>
                </div>
              ) : (
                <div className="flex items-center space-x-2.5 bg-emerald-500/20 border border-emerald-400/35 text-emerald-100 p-3 rounded-xl text-xs font-semibold backdrop-blur-sm">
                  <Mail size={16} className="shrink-0 text-emerald-300" />
                  <span>Code sent to <strong className="text-white">{twoStepChallenge.maskedEmail}</strong> (valid for 5 minutes)</span>
                </div>
              )}

              <div className="space-y-1.5 pt-1">
                <label
                  className={`text-xs font-semibold text-slate-200/95 block whitespace-nowrap ${
                    twoStepChallenge.method === 'authenticator_setup' ? 'text-center' : ''
                  }`}
                >
                  {twoStepChallenge.method === 'authenticator_setup'
                    ? 'Enter 6-Digit Verification Code'
                    : twoStepChallenge.method === 'authenticator'
                    ? 'Google Authenticator 6-Digit Code'
                    : '6-Digit Verification Code (OTP)'}
                </label>
                <input
                  ref={otpInputRef}
                  type="text"
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  maxLength={6}
                  value={twoStepOtp}
                  onChange={e => setTwoStepOtp(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="000000"
                  className="login-glass-input w-full h-12 bg-white/10 hover:bg-white/15 focus:bg-white/20 border border-white/30 focus:border-emerald-400/80 rounded-xl pl-[0.45em] pr-2 text-center text-[22px] font-mono tabular-nums font-bold tracking-[0.45em] text-white outline-none focus:ring-2 focus:ring-emerald-400/25 transition-all placeholder:text-white/35"
                  required
                />
              </div>

              {error && (
                <div className="flex items-center space-x-2 bg-rose-500/25 text-rose-100 px-3 py-2.5 rounded-xl border border-rose-400/40 text-xs font-semibold animate-in fade-in">
                  <AlertCircle size={15} className="shrink-0 text-rose-300" />
                  <span>{error}</span>
                </div>
              )}

              {successToast && !error && twoStepChallenge.method !== 'authenticator_setup' && (
                <div className="flex items-center space-x-2.5 bg-emerald-500/25 text-emerald-100 p-3 rounded-xl border border-emerald-400/40 text-xs font-bold animate-in fade-in backdrop-blur-sm">
                  <CheckCircle2 size={16} className="text-emerald-300 shrink-0" />
                  <span>{successToast}</span>
                </div>
              )}

              <button
                type="submit"
                disabled={isVerifyingOtp || twoStepOtp.length !== 6}
                className="w-full bg-emerald-600 hover:bg-emerald-500 disabled:bg-emerald-600/45 disabled:text-white/65 text-white h-11 rounded-xl font-semibold text-sm flex items-center justify-center space-x-2 shadow-lg active:scale-[0.99] transition-all whitespace-nowrap disabled:cursor-not-allowed"
              >
                <ShieldCheck size={17} className="shrink-0" />
                <span className="whitespace-nowrap">
                  {isVerifyingOtp ? 'Verifying...' : 'Verify & Sign In'}
                </span>
              </button>

              <div
                className={`flex items-center pt-0.5 text-xs ${
                  twoStepChallenge.method === 'email' ? 'justify-between' : 'justify-center'
                }`}
              >
                <button
                  type="button"
                  onClick={() => {
                    setTwoStepChallenge(null);
                    setTwoStepOtp('');
                    setError('');
                    setSuccessToast(null);
                  }}
                  className="text-slate-200/80 hover:text-white font-semibold inline-flex items-center space-x-1.5 transition-colors whitespace-nowrap"
                >
                  <ArrowLeft size={14} className="shrink-0" />
                  <span>Back to Login</span>
                </button>

                {twoStepChallenge.method === 'email' && (
                  <button
                    type="button"
                    disabled={resendCooldown > 0 || isResendingOtp}
                    onClick={handleResendTwoStepOtp}
                    className="text-emerald-300 hover:text-emerald-200 font-bold inline-flex items-center space-x-1 transition-colors whitespace-nowrap disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <RefreshCw size={13} className={isResendingOtp ? 'animate-spin' : ''} />
                    <span>
                      {isResendingOtp
                        ? 'Sending...'
                        : resendCooldown > 0
                        ? `Resend in ${resendCooldown}s`
                        : 'Resend Code'}
                    </span>
                  </button>
                )}
              </div>
            </form>
          ) : (

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
          )}
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
