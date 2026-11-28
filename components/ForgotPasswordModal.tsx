import React, { useState, useEffect, useRef } from 'react';
import { 
  KeyRound, ShieldCheck, Mail, ArrowRight, ArrowLeft, 
  AlertCircle, X, Eye, EyeOff, RefreshCw, Loader2, Check
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { validateStrongPassword } from '../utils/passwordPolicy';
import { PasswordRequirementGuide } from './PasswordRequirementGuide';
import { isEmailCategoryAllowed } from '../services/pdfEmailService';

interface ForgotPasswordModalProps {
  initialUsername?: string;
  onClose: () => void;
  onSuccess: (username: string) => void;
}

export const ForgotPasswordModal: React.FC<ForgotPasswordModalProps> = ({
  initialUsername = '',
  onClose,
  onSuccess
}) => {
  // Step 1: 'username', Step 2: 'otp', Step 3: 'new_password', Step 4: 'success'
  const [step, setStep] = useState<1 | 2 | 3 | 4>(1);
  const [usernameInput, setUsernameInput] = useState(initialUsername);
  const [matchedUsername, setMatchedUsername] = useState('');
  const [maskedEmail, setMaskedEmail] = useState('');
  const [challengeId, setChallengeId] = useState('');
  const [resetToken, setResetToken] = useState('');

  // OTP state (verification happens strictly on server)
  const [otpDigits, setOtpDigits] = useState(['', '', '', '', '', '']);
  const [resendCooldown, setResendCooldown] = useState(60);
  const [isSendingCode, setIsSendingCode] = useState(false);
  const [isVerifyingOtp, setIsVerifyingOtp] = useState(false);
  const otpInputRefs = useRef<(HTMLInputElement | null)[]>([]);

  // Password state
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showNewPassword, setShowNewPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Status & Feedback
  const [errorMessage, setErrorMessage] = useState('');

  const validation = validateStrongPassword(newPassword);

  // Timer for OTP resend
  useEffect(() => {
    let timer: ReturnType<typeof setInterval> | undefined;
    if (step === 2 && resendCooldown > 0) {
      timer = setInterval(() => {
        setResendCooldown(prev => Math.max(0, prev - 1));
      }, 1000);
    }
    return () => {
      if (timer) clearInterval(timer);
    };
  }, [step, resendCooldown]);

  // Step 1: Request server-generated 6-digit OTP code via email
  const handleRequestCode = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMessage('');

    const targetUser = usernameInput.trim();
    if (!targetUser) {
      setErrorMessage('Please enter your username or email address.');
      return;
    }

    setIsSendingCode(true);
    try {
      const emailAllowed = await isEmailCategoryAllowed('security');
      if (!emailAllowed.allowed) {
        setErrorMessage(emailAllowed.reason || 'Security password reset emails are currently disabled in System Settings.');
        return;
      }

      const settings = await storageService.getSettings().catch(() => null);
      const sysSettings = await storageService.getSystemSettings().catch(() => null);
      const effectiveLogo = settings?.logoUrl || sysSettings?.logoUrl;
      const effectiveName = settings?.systemName || sysSettings?.systemName || "Ratauli Saving and Credit Cooperative Ltd";
      const effectiveAddr = settings?.address || sysSettings?.address || "Pipra Rural Municipality -6 (Mahottari)";

      const response = await fetch('/api/auth/request-otp', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          identifier: targetUser,
          companyName: effectiveName,
          companyAddress: effectiveAddr,
          logoUrl: effectiveLogo
        })
      });

      const resData = await response.json().catch(() => ({}));
      if (!response.ok || !resData.success || !resData.challengeId) {
        setErrorMessage(resData.message || 'Could not send verification code. Please check your username or contact admin.');
        return;
      }

      setChallengeId(String(resData.challengeId));
      setMatchedUsername(String(resData.username || targetUser));
      setMaskedEmail(String(resData.maskedEmail || ''));
      setResetToken('');
      setOtpDigits(['', '', '', '', '', '']);
      setResendCooldown(60);
      setStep(2);

      setTimeout(() => {
        otpInputRefs.current[0]?.focus();
      }, 300);
    } catch (err: unknown) {
      console.error("Error in forgot password request:", err);
      const errMsg = err instanceof Error ? err.message : 'Failed to send code. Please try again.';
      setErrorMessage(errMsg);
    } finally {
      setIsSendingCode(false);
    }
  };

  // Step 2: Handle OTP input
  const handleOtpDigitChange = (index: number, value: string) => {
    if (value.length > 1) {
      const pasted = value.replace(/[^0-9]/g, '').slice(0, 6);
      if (pasted.length > 0) {
        const newDigits = [...otpDigits];
        for (let i = 0; i < 6; i++) {
          newDigits[i] = pasted[i] || '';
        }
        setOtpDigits(newDigits);
        const nextFocus = Math.min(pasted.length, 5);
        otpInputRefs.current[nextFocus]?.focus();
        return;
      }
    }

    const cleanChar = value.replace(/[^0-9]/g, '').slice(-1);
    const newDigits = [...otpDigits];
    newDigits[index] = cleanChar;
    setOtpDigits(newDigits);

    if (cleanChar && index < 5) {
      otpInputRefs.current[index + 1]?.focus();
    }
  };

  const handleOtpKeyDown = (index: number, e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Backspace' && !otpDigits[index] && index > 0) {
      otpInputRefs.current[index - 1]?.focus();
    }
  };

  // Verify OTP code on server
  const handleVerifyOtp = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    const enteredOtp = otpDigits.join('');
    if (enteredOtp.length !== 6) {
      setErrorMessage('Please enter the complete 6-digit code.');
      return;
    }

    setIsVerifyingOtp(true);
    try {
      const response = await fetch('/api/auth/verify-otp-reset', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          otpCode: enteredOtp,
          verifyOnly: true
        })
      });
      const resData = await response.json().catch(() => ({}));
      if (!response.ok || !resData.success || !resData.resetToken) {
        setErrorMessage(resData.message || 'The entered 6-digit verification code is incorrect.');
        return;
      }
      setResetToken(String(resData.resetToken));
      setStep(3);
    } catch {
      setErrorMessage('Could not verify code with server. Please try again.');
    } finally {
      setIsVerifyingOtp(false);
    }
  };

  // Step 3: Submit verified resetToken + new strong password to server (server hashes & saves)
  const handleSaveNewPassword = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMessage('');

    if (!newPassword || !confirmPassword) {
      setErrorMessage('Please enter and confirm your new password.');
      return;
    }

    if (!validation.isValid) {
      setErrorMessage(validation.errors[0] || 'Password must be at least 8 characters with upper, lower, number, and special character.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage('Passwords do not match.');
      return;
    }

    if (!challengeId || !resetToken) {
      setErrorMessage('Verification session expired. Please restart the recovery process.');
      return;
    }

    setIsSubmitting(true);
    try {
      const response = await fetch('/api/auth/verify-otp-reset', {
        method: 'POST',
        credentials: 'same-origin',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          challengeId,
          resetToken,
          newPassword
        })
      });
      const resData = await response.json().catch(() => ({}));
      if (!response.ok || !resData.success) {
        setErrorMessage(resData.message || 'Error changing password. Please try again.');
        return;
      }

      const finalUsername = String(resData.username || matchedUsername);
      void storageService.saveLog(
        finalUsername || 'user',
        'FORGOT_PASSWORD_RESET',
        `Password reset successfully via server OTP verification for @${finalUsername}`
      ).catch(() => {});

      setStep(4);
      setTimeout(() => {
        onSuccess(finalUsername);
      }, 2000);
    } catch (err: unknown) {
      console.error("Failed to reset password:", err);
      const errMsg = err instanceof Error ? err.message : 'Error changing password. Please try again.';
      setErrorMessage(errMsg);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/70 backdrop-blur-sm flex items-center justify-center p-4">
      <div className="bg-white border border-slate-200 rounded-3xl w-full max-w-lg shadow-[0_25px_60px_-15px_rgba(0,0,0,0.3)] overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Modal Header */}
        <div className="bg-gradient-to-r from-[#004d40] via-[#00695c] to-[#004d40] text-white p-5 flex items-center justify-between border-b border-white/10">
          <div className="flex items-center space-x-3">
            <div className="w-10 h-10 rounded-2xl bg-white/15 backdrop-blur-sm border border-white/20 flex items-center justify-center text-white shadow-inner">
              <KeyRound size={22} />
            </div>
            <div>
              <h3 className="text-lg font-black uppercase tracking-tight text-white">Forgot Password?</h3>
              <p className="text-xs text-teal-100 font-medium">Reset account password securely via email OTP</p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-8 h-8 rounded-full bg-white/10 hover:bg-white/20 text-white flex items-center justify-center transition-colors"
          >
            <X size={18} />
          </button>
        </div>

        {/* Body Content */}
        <div className="p-6">
          {/* Global Error message */}
          {errorMessage && (
            <div className="mb-4 p-3.5 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-rose-700 text-xs font-bold animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* STEP 1: Enter Username */}
          {step === 1 && (
            <form onSubmit={handleRequestCode} className="space-y-4">
              <div>
                <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block mb-1.5">
                  Username or Registered Email <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type="text"
                    value={usernameInput}
                    onChange={e => setUsernameInput(e.target.value)}
                    placeholder="e.g. username or admin"
                    autoFocus
                    className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-3.5 text-xs font-bold text-slate-900 outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/15 focus:bg-white transition-all font-mono"
                    required
                  />
                </div>
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSendingCode || !usernameInput.trim()}
                  className="flex-2 h-11 bg-gradient-to-r from-[#00695c] to-[#004d40] hover:from-[#00796b] hover:to-[#00382e] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-teal-900/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                >
                  {isSendingCode ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Sending...</span>
                    </>
                  ) : (
                    <>
                      <span>Send Code</span>
                      <ArrowRight size={16} />
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 2: Enter 6-Digit OTP from Email */}
          {step === 2 && (
            <form onSubmit={handleVerifyOtp} className="space-y-5">
              <div className="p-3.5 bg-teal-50/80 border border-teal-200 rounded-2xl flex items-start space-x-3 text-slate-700">
                <div className="w-8 h-8 rounded-xl bg-teal-600 text-white flex items-center justify-center shrink-0 mt-0.5">
                  <Mail size={16} />
                </div>
                <div>
                  <div className="text-[11px] font-black uppercase text-teal-800 tracking-wider">Email Verification Code Sent</div>
                  <p className="text-xs font-medium text-slate-600 mt-0.5 leading-relaxed">
                    {matchedUsername ? (
                      <>A 6-digit verification code has been sent to <strong>{maskedEmail || 'your registered email'}</strong> for user <strong>@{matchedUsername}</strong>. Please check your inbox.</>
                    ) : (
                      <>A 6-digit verification code has been sent to your registered email address. Please check your inbox.</>
                    )}
                  </p>
                </div>
              </div>

              {/* 6 Digit Input Boxes */}
              <div className="flex justify-center items-center gap-2 sm:gap-3 py-2">
                {otpDigits.map((digit, idx) => (
                  <input
                    key={idx}
                    ref={el => (otpInputRefs.current[idx] = el)}
                    type="text"
                    inputMode="numeric"
                    maxLength={1}
                    value={digit}
                    onChange={e => handleOtpDigitChange(idx, e.target.value)}
                    onKeyDown={e => handleOtpKeyDown(idx, e)}
                    className="w-11 h-12 text-center text-lg font-black font-mono bg-slate-50 border-2 border-slate-300 focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/15 focus:bg-white rounded-xl outline-none transition-all shadow-inner text-slate-900"
                  />
                ))}
              </div>

              <div className="flex items-center justify-between text-xs font-bold text-slate-500 pt-1">
                <button
                  type="button"
                  onClick={() => setStep(1)}
                  className="flex items-center space-x-1 text-slate-500 hover:text-slate-800"
                >
                  <ArrowLeft size={14} />
                  <span>Change User</span>
                </button>

                {resendCooldown > 0 ? (
                  <span className="text-slate-400 font-medium">
                    Resend in ({resendCooldown}s)
                  </span>
                ) : (
                  <button
                    type="button"
                    onClick={() => handleRequestCode()}
                    className="flex items-center space-x-1 text-[#00695c] hover:text-[#004d40] font-black uppercase text-[11px]"
                  >
                    <RefreshCw size={12} />
                    <span>Resend Code</span>
                  </button>
                )}
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isVerifyingOtp || otpDigits.join('').length !== 6}
                  className="flex-2 h-11 bg-gradient-to-r from-[#00695c] to-[#004d40] hover:from-[#00796b] hover:to-[#00382e] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-teal-900/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50"
                >
                  {isVerifyingOtp ? <Loader2 size={16} className="animate-spin" /> : <ShieldCheck size={16} />}
                  <span>{isVerifyingOtp ? 'Verifying...' : 'Verify Code'}</span>
                </button>
              </div>
            </form>
          )}

          {/* STEP 3: Set New Password & Confirm */}
          {step === 3 && (
            <form onSubmit={handleSaveNewPassword} className="space-y-4 max-h-[70vh] overflow-y-auto pr-1">
              <div>
                <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block mb-1">
                  New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showNewPassword ? 'text' : 'password'}
                    value={newPassword}
                    onChange={e => setNewPassword(e.target.value)}
                    placeholder="Min 8 chars with upper, lower, number & symbol"
                    autoFocus
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 pr-10 text-xs font-bold text-slate-900 outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/15 focus:bg-white transition-all font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowNewPassword(!showNewPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showNewPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>

              {/* Password Requirement Guide Checkers */}
              <PasswordRequirementGuide password={newPassword} />

              <div>
                <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block mb-1">
                  Confirm New Password <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showConfirmPassword ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={e => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password..."
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 pr-10 text-xs font-bold text-slate-900 outline-none focus:border-[#008080] focus:ring-2 focus:ring-[#008080]/15 focus:bg-white transition-all font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showConfirmPassword ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-[10px] font-bold text-rose-600 mt-1">⚠️ Passwords do not match.</p>
                )}
              </div>

              <div className="pt-2 flex items-center space-x-3">
                <button
                  type="button"
                  onClick={onClose}
                  className="flex-1 h-11 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting || !validation.isValid || newPassword !== confirmPassword}
                  className="flex-2 h-11 bg-gradient-to-r from-emerald-600 to-teal-700 hover:from-emerald-700 hover:to-teal-800 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-emerald-700/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 size={16} className="animate-spin" />
                      <span>Submitting...</span>
                    </>
                  ) : (
                    <>
                      <ShieldCheck size={16} />
                      <span>Submit</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          )}

          {/* STEP 4: Success State */}
          {step === 4 && (
            <div className="py-6 text-center space-y-4 animate-in zoom-in-95">
              <div className="w-14 h-14 bg-emerald-100 border-2 border-emerald-400 text-emerald-600 rounded-2xl flex items-center justify-center mx-auto shadow-xs">
                <Check size={28} strokeWidth={3} className="text-emerald-600" />
              </div>
              <div className="space-y-1">
                <h4 className="text-lg font-black text-slate-900 tracking-tight">Password Reset Successfully!</h4>
                <p className="text-xs text-slate-600 font-medium">
                  Your new password is now active. You can now log in with your updated credentials.
                </p>
              </div>
              <div className="pt-2">
                <button
                  type="button"
                  onClick={() => onSuccess(matchedUsername || '')}
                  className="w-full h-11 bg-[#00695c] hover:bg-[#004d40] text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg transition-all flex items-center justify-center space-x-2"
                >
                  <span>Proceed to Login</span>
                  <ArrowRight size={16} />
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
