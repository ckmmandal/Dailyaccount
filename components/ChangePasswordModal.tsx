import React, { useState } from 'react';
import { KeyRound, Eye, EyeOff, CheckCircle2, AlertCircle, X, ShieldCheck } from 'lucide-react';
import { User } from '../types';
import { storageService } from '../services/storageService';
import { validateStrongPassword } from '../utils/passwordPolicy';
import { PasswordRequirementGuide } from './PasswordRequirementGuide';

interface ChangePasswordModalProps {
  user: User;
  onClose: () => void;
}

export const ChangePasswordModal: React.FC<ChangePasswordModalProps> = ({ user, onClose }) => {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const validation = validateStrongPassword(newPassword, user.username);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!newPassword || !confirmPassword) {
      setErrorMsg('कृपया नयाँ पासवर्ड र पुष्टि पासवर्ड दुवै राख्नुहोस् (Please enter new and confirm password).');
      return;
    }

    if (!validation.isValid) {
      setErrorMsg(validation.errors[0] || 'पासवर्ड सुरक्षा मापदण्ड अनुसार कम्तिमा ८ अक्षर, क्यापिटल, सानो अक्षर, अङ्क र विशेष चिन्ह हुनुपर्छ।');
      return;
    }

    if (newPassword !== confirmPassword) {
      setErrorMsg('नयाँ पासवर्ड र पुष्टि पासवर्ड मिलेन (New password and confirm password do not match).');
      return;
    }

    setLoading(true);
    try {
      // Fetch latest users to verify current password if set
      const users = await storageService.getUsers().catch(() => []);
      const userList = Array.isArray(users) ? users : [];
      const currentUserRecord = userList.find(u => u && (u.id === user.id || u.username.toLowerCase() === user.username.toLowerCase()));
      
      const actualCurrentPass = currentUserRecord?.password || user.password;
      if (actualCurrentPass && currentPassword && actualCurrentPass !== currentPassword) {
        setErrorMsg('हालको पासवर्ड गलत छ (Incorrect current password).');
        setLoading(false);
        return;
      }

      const updatedUser: User = {
        ...(currentUserRecord || user),
        password: newPassword,
        passwordUpdatedAt: Date.now(),
        forcePasswordChange: false
      };

      await storageService.saveUser(updatedUser);
      
      // Update active session
      localStorage.setItem('ZEN_AUTH_USER', JSON.stringify(updatedUser));
      await storageService.saveLog(user.id, 'CHANGE_PASSWORD', `User @${user.username} updated security password (3-month policy renewed)`);

      setSuccessMsg('पासवर्ड सफलतापूर्वक परिवर्तन भयो! (Password updated successfully!)');
      setTimeout(() => {
        onClose();
      }, 1200);
    } catch (err: any) {
      console.error('Password change error:', err);
      setErrorMsg(err.message || 'पासवर्ड परिवर्तन गर्दा त्रुटि भयो।');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[1000] bg-slate-950/60 backdrop-blur-xs flex items-center justify-center p-4 animate-in fade-in duration-200">
      <div className="bg-white border-2 border-slate-900 rounded-2xl w-full max-w-md shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200">
        {/* Header */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 rounded-lg bg-emerald-500/20 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
              <KeyRound size={18} />
            </div>
            <div>
              <h3 className="text-sm font-black uppercase tracking-wider">Change Password</h3>
              <p className="text-[10px] text-slate-400 font-bold">Update security credentials (@{user.username})</p>
            </div>
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 rounded-lg bg-slate-800 text-slate-400 hover:text-white flex items-center justify-center hover:bg-slate-700 transition-colors"
          >
            <X size={16} />
          </button>
        </div>

        {/* Form Body */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4 max-h-[85vh] overflow-y-auto">
          {errorMsg && (
            <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl flex items-start space-x-2.5 text-rose-700 text-xs font-bold animate-in fade-in">
              <AlertCircle size={16} className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          )}

          {successMsg && (
            <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl flex items-start space-x-2.5 text-emerald-700 text-xs font-black animate-in fade-in">
              <CheckCircle2 size={16} className="shrink-0 mt-0.5" />
              <span>{successMsg}</span>
            </div>
          )}

          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
              हालको पासवर्ड (Current Password)
            </label>
            <div className="relative">
              <input
                type={showCurrent ? 'text' : 'password'}
                value={currentPassword}
                onChange={e => setCurrentPassword(e.target.value)}
                placeholder="हालको पासवर्ड प्रविष्ट गर्नुहोस्..."
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 pr-10 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition-all"
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

          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
              नयाँ पासवर्ड (New Password) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showNew ? 'text' : 'password'}
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="कम्तिमा ८ अक्षर, क्यापिटल, सानो, अङ्क र चिन्ह"
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 pr-10 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition-all"
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

          {/* Password policy requirements indicator */}
          <PasswordRequirementGuide password={newPassword} />

          <div>
            <label className="text-[10px] font-black uppercase text-slate-500 tracking-wider block mb-1">
              नयाँ पासवर्ड पुष्टि (Confirm Password) <span className="text-rose-500">*</span>
            </label>
            <div className="relative">
              <input
                type={showConfirm ? 'text' : 'password'}
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                placeholder="नयाँ पासवर्ड पुन: टाइप गर्नुहोस्"
                className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 pr-10 text-xs font-bold text-slate-800 outline-none focus:border-emerald-600 focus:bg-white transition-all"
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
              <p className="text-[10px] font-bold text-rose-600 mt-1">⚠️ पासवर्ड मिलेन (Passwords do not match)</p>
            )}
          </div>

          <div className="pt-2 flex items-center space-x-3">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 h-10 bg-slate-100 text-slate-600 hover:bg-slate-200 rounded-xl text-xs font-black uppercase tracking-wider transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading || !validation.isValid || newPassword !== confirmPassword}
              className="flex-1 h-10 bg-emerald-600 hover:bg-emerald-700 active:scale-98 text-white rounded-xl text-xs font-black uppercase tracking-wider shadow-md shadow-emerald-600/20 flex items-center justify-center space-x-1.5 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <ShieldCheck size={16} />
              <span>{loading ? 'Updating...' : 'Update Password'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
