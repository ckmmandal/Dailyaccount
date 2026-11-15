import React, { useState } from 'react';
import { ShieldAlert, Eye, EyeOff, CheckCircle2, ArrowRight, ShieldCheck, AlertCircle, KeyRound, Lock } from 'lucide-react';
import { User } from '../types';
import { storageService } from '../services/storageService';
import { validateStrongPassword } from '../utils/passwordPolicy';
import { PasswordRequirementGuide } from './PasswordRequirementGuide';

interface ForcedPasswordExpiryModalProps {
  user: User;
  onSuccess: (updatedUser: User) => void;
  onLogout: () => void;
}

export const ForcedPasswordExpiryModal: React.FC<ForcedPasswordExpiryModalProps> = ({
  user,
  onLogout
}) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isSuccess, setIsSuccess] = useState(false);

  const isResetByAdmin = Boolean(user.forcePasswordChange);
  const validation = validateStrongPassword(newPassword, user.username);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');

    // If not reset by admin, require and verify current password
    if (!isResetByAdmin && user.password && currentPassword && user.password !== currentPassword) {
      setErrorMsg('Incorrect current password.');
      return;
    }

    if (!newPassword || !confirmPassword) {
      setErrorMsg('Please enter both new password and confirm password.');
      return;
    }

    if (!validation.isValid) {
      setErrorMsg(validation.errors[0] || 'Password does not meet security requirements.');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('New password and confirmation password do not match.');
      return;
    }

    if (user.password && newPassword === user.password) {
      setErrorMsg('New password must be different from previous or temporary password.');
      return;
    }

    setLoading(true);
    try {
      const updatedUser: User = {
        ...user,
        password: newPassword,
        passwordUpdatedAt: Date.now(),
        forcePasswordChange: false
      };

      await storageService.saveUser(updatedUser);
      localStorage.setItem('ZEN_AUTH_USER', JSON.stringify(updatedUser));
      await storageService.saveLog(user.id, 'PASSWORD_RESET_COMPLETED', `User @${user.username} successfully set new password after ${isResetByAdmin ? 'admin reset' : '3-month expiry'}`);

      setIsSuccess(true);
    } catch (err: any) {
      console.error('Password renewal error:', err);
      setErrorMsg(err.message || 'An error occurred while updating the password.');
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/85 backdrop-blur-md flex items-center justify-center p-4">
      <div className="bg-white border-2 border-rose-500 rounded-3xl w-full max-w-lg shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        
        {/* Header with High-Contrast Alert */}
        <div className="bg-gradient-to-r from-rose-600 via-rose-700 to-slate-900 text-white p-6 relative overflow-hidden">
          <div className="relative z-10 flex items-start space-x-3">
            <div className="w-12 h-12 rounded-2xl bg-white/20 backdrop-blur-sm border border-white/30 flex items-center justify-center shrink-0 shadow-inner">
              {isResetByAdmin ? (
                <KeyRound size={26} className="text-white animate-pulse" />
              ) : (
                <ShieldAlert size={26} className="text-white animate-bounce" />
              )}
            </div>
            <div>
              <div className="inline-block bg-white/20 text-white text-[10px] font-black uppercase px-2.5 py-0.5 rounded-full mb-1 tracking-wider">
                {isResetByAdmin ? 'Admin Password Reset' : '3-Month Password Expiry Policy'}
              </div>
              <h2 className="text-xl font-black tracking-tight leading-snug">
                {isResetByAdmin ? 'Set New Permanent Password' : 'Password Renewal Required'}
              </h2>
              <p className="text-xs text-rose-100 mt-1 font-medium leading-relaxed">
                {isResetByAdmin
                  ? `Your password has been reset by an administrator. Please set a new secure permanent password to continue.`
                  : `Your password has expired (90-day policy). Please update your password with a strong new credential.`}
              </p>
            </div>
          </div>
        </div>

        {/* Success Screen -> Direct to Login */}
        {isSuccess ? (
          <div className="p-8 text-center space-y-5 animate-in zoom-in-95">
            <div className="w-16 h-16 bg-emerald-100 border-2 border-emerald-300 text-emerald-600 rounded-full flex items-center justify-center mx-auto shadow-inner">
              <CheckCircle2 size={38} />
            </div>
            <div className="space-y-1.5">
              <h3 className="text-lg font-black text-slate-900">Password Updated Successfully!</h3>
              <p className="text-xs text-slate-600 font-medium leading-relaxed">
                Your new password is active. Please log in with your updated credentials.
              </p>
            </div>
            <div className="pt-3">
              <button
                type="button"
                onClick={onLogout}
                className="w-full h-12 bg-slate-950 hover:bg-rose-600 active:scale-98 text-white rounded-2xl text-xs font-black uppercase tracking-wider shadow-lg flex items-center justify-center space-x-2 transition-all cursor-pointer"
              >
                <span>Proceed to Login</span>
                <ArrowRight size={18} />
              </button>
            </div>
          </div>
        ) : (
          /* Form Body */
          <form onSubmit={handleSubmit} className="p-6 space-y-4 max-h-[75vh] overflow-y-auto">
            {errorMsg && (
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-rose-700 text-xs font-bold animate-in fade-in">
                <AlertCircle size={16} className="shrink-0 mt-0.5" />
                <span>{errorMsg}</span>
              </div>
            )}

            {/* Current password (Only shown if NOT admin reset) */}
            {!isResetByAdmin && user.password && (
              <div>
                <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block mb-1">
                  Current Password
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    value={currentPassword}
                    onChange={e => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password..."
                    className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 pr-10 text-xs font-bold text-slate-800 outline-none focus:border-rose-500 focus:bg-white transition-all font-mono"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                  >
                    {showCurrent ? <EyeOff size={15} /> : <Eye size={15} />}
                  </button>
                </div>
              </div>
            )}

            {/* New Password */}
            <div>
              <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block mb-1">
                New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showNew ? 'text' : 'password'}
                  value={newPassword}
                  onChange={e => setNewPassword(e.target.value)}
                  placeholder="Min 8 chars with upper, lower, number & symbol"
                  autoFocus
                  className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 pr-10 text-xs font-bold text-slate-800 outline-none focus:border-rose-500 focus:bg-white transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowNew(!showNew)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showNew ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
            </div>

            {/* Dynamic Policy Checklist */}
            <PasswordRequirementGuide password={newPassword} />

            {/* Confirm Password */}
            <div>
              <label className="text-[11px] font-black uppercase text-slate-600 tracking-wider block mb-1">
                Confirm New Password <span className="text-rose-500">*</span>
              </label>
              <div className="relative">
                <input
                  type={showConfirm ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={e => setConfirmPassword(e.target.value)}
                  placeholder="Re-enter new password..."
                  className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3.5 pr-10 text-xs font-bold text-slate-800 outline-none focus:border-rose-500 focus:bg-white transition-all font-mono"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirm(!showConfirm)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                >
                  {showConfirm ? <EyeOff size={15} /> : <Eye size={15} />}
                </button>
              </div>
              {confirmPassword && newPassword !== confirmPassword && (
                <p className="text-[10px] font-bold text-rose-600 mt-1">⚠️ Passwords do not match</p>
              )}
            </div>

            {/* Action Buttons */}
            <div className="pt-3 flex items-center space-x-3 border-t border-slate-200">
              <button
                type="button"
                onClick={onLogout}
                className="flex-1 h-11 bg-slate-100 text-slate-700 hover:bg-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
              >
                Logout
              </button>
              <button
                type="submit"
                disabled={loading || !validation.isValid || newPassword !== confirmPassword}
                className="flex-2 h-11 bg-gradient-to-r from-rose-600 to-slate-900 hover:from-rose-700 hover:to-black active:scale-98 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-lg shadow-rose-600/20 flex items-center justify-center space-x-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <ShieldCheck size={18} />
                <span>{loading ? 'Updating...' : 'Save & Update Password'}</span>
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );
};

