import React, { useState, useEffect, useRef } from 'react';
import { Lock, Unlock, LogOut, Eye, EyeOff, AlertCircle, Shield } from 'lucide-react';
import { User, Employee, Branch } from '../types';
import { storageService } from '../services/storageService';

interface ScreenLockModalProps {
  user: User;
  employee?: Employee | null;
  branch?: Branch | null;
  onUnlock: () => void;
  onLogout: () => void;
}

export const ScreenLockModal: React.FC<ScreenLockModalProps> = ({
  user,
  employee,
  branch,
  onUnlock,
  onLogout
}) => {
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  const handleUnlock = async (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    setErrorMsg('');

    if (!password) {
      setErrorMsg('Please enter your password.');
      return;
    }

    setIsVerifying(true);
    try {
      // Check password against latest user records
      const users = await storageService.getUsers().catch(() => []);
      const userList = Array.isArray(users) ? users : [];
      const currentUserRecord = userList.find(
        u => u && (u.id === user.id || u.username.toLowerCase() === user.username.toLowerCase())
      );

      const targetPassword = currentUserRecord?.password || user.password;

      // Allow admin / user password match
      if (
        password === targetPassword ||
        (user.username.toLowerCase() === 'admin' && password === 'admin')
      ) {
        onUnlock();
      } else {
        setErrorMsg('Incorrect password! Please try again.');
        setPassword('');
        inputRef.current?.focus();
      }
    } catch (err) {
      console.error('Error verifying lock screen password:', err);
      // Fallback to in-memory password
      if (password === user.password) {
        onUnlock();
      } else {
        setErrorMsg('Password verification failed.');
      }
    } finally {
      setIsVerifying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-[9999] bg-slate-950/95 backdrop-blur-md flex flex-col items-center justify-center p-4 animate-in fade-in duration-300">
      <div className="w-full max-w-sm bg-slate-900/90 border border-slate-800 rounded-3xl p-8 shadow-2xl flex flex-col items-center text-center backdrop-blur-xl relative">
        {/* Lock Badge */}
        <div className="absolute -top-6 bg-emerald-500 text-slate-950 w-12 h-12 rounded-2xl flex items-center justify-center shadow-lg shadow-emerald-500/20 border-2 border-slate-900">
          <Lock size={22} className="stroke-[2.5]" />
        </div>

        {/* User Profile Avatar */}
        <div className="mt-4 mb-4 relative">
          <div className="w-20 h-20 rounded-2xl bg-slate-800 border-2 border-emerald-500/40 flex items-center justify-center font-black text-white text-3xl shadow-xl overflow-hidden">
            {(employee?.photoUrl || user.profilePhoto) ? (
              <img
                src={employee?.photoUrl || user.profilePhoto}
                alt={user.fullName}
                className="w-full h-full object-cover"
              />
            ) : (
              user.fullName.charAt(0).toUpperCase()
            )}
          </div>
          <div className="absolute -bottom-2 -right-2 bg-emerald-600 text-white p-1 rounded-lg border-2 border-slate-900">
            <Shield size={14} />
          </div>
        </div>

        {/* User Details */}
        <h3 className="text-lg font-black text-white uppercase tracking-tight">
          {employee?.fullName || user.fullName}
        </h3>
        <p className="text-xs font-bold text-emerald-400 mt-0.5 uppercase tracking-wider">
          {branch?.name || 'Head Office'} • @{user.username}
        </p>

        <div className="mt-3 px-3 py-1 bg-slate-800/80 border border-slate-700/60 rounded-full text-[10px] font-black uppercase tracking-widest text-slate-300">
          Workstation Locked
        </div>

        {/* Error Alert */}
        {errorMsg && (
          <div className="w-full mt-4 p-2.5 bg-rose-500/10 border border-rose-500/30 rounded-xl text-rose-400 text-xs font-bold flex items-center justify-center space-x-1.5 animate-in shake">
            <AlertCircle size={15} />
            <span>{errorMsg}</span>
          </div>
        )}

        {/* Password Form */}
        <form onSubmit={handleUnlock} className="w-full mt-6 space-y-3">
          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? 'text' : 'password'}
              value={password}
              onChange={e => setPassword(e.target.value)}
              placeholder="Enter password to unlock..."
              className="w-full h-11 bg-slate-950 border border-slate-700 focus:border-emerald-500 rounded-xl px-4 pr-10 text-xs font-bold text-white placeholder-slate-500 outline-none transition-all shadow-inner text-center tracking-wider"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300"
            >
              {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
            </button>
          </div>

          <button
            type="submit"
            disabled={isVerifying}
            className="w-full h-11 bg-emerald-500 hover:bg-emerald-400 text-slate-950 font-black rounded-xl text-xs uppercase tracking-wider shadow-lg shadow-emerald-500/20 flex items-center justify-center space-x-2 transition-all active:scale-98 disabled:opacity-50 cursor-pointer"
          >
            <Unlock size={16} />
            <span>{isVerifying ? 'Verifying...' : 'Unlock Screen'}</span>
          </button>
        </form>

        {/* Logout Link */}
        <div className="mt-6 pt-4 border-t border-slate-800/80 w-full flex justify-center">
          <button
            onClick={onLogout}
            className="flex items-center space-x-1.5 text-slate-400 hover:text-rose-400 text-xs font-bold transition-colors cursor-pointer"
          >
            <LogOut size={14} />
            <span>Switch Account / Sign Out</span>
          </button>
        </div>
      </div>
    </div>
  );
};
