import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  Smartphone,
  ShieldCheck,
  QrCode,
  CheckCircle2,
  AlertCircle,
  Copy,
  Check,
  Trash2,
  RefreshCw,
} from 'lucide-react';
import { getAuthHeaders } from '../services/authToken';

interface AuthenticatorSetupCardProps {
  compact?: boolean;
  onStatusChange?: (enabled: boolean) => void;
}

export const AuthenticatorSetupCard: React.FC<AuthenticatorSetupCardProps> = ({
  compact = false,
  onStatusChange,
}) => {
  const [loading, setLoading] = useState(true);
  const [enabled, setEnabled] = useState(false);
  const [enabledAt, setEnabledAt] = useState<number | null>(null);
  const [setupData, setSetupData] = useState<{
    qrDataUrl: string;
    manualKey: string;
    setupToken: string;
  } | null>(null);
  const [verifyCode, setVerifyCode] = useState('');
  const [disableCode, setDisableCode] = useState('');
  const [showDisableForm, setShowDisableForm] = useState(false);
  const [busy, setBusy] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const onStatusChangeRef = useRef(onStatusChange);
  useEffect(() => {
    onStatusChangeRef.current = onStatusChange;
  }, [onStatusChange]);

  const loadStatus = useCallback(async () => {
    try {
      setLoading(true);
      const res = await fetch('/api/auth/totp-status', {
        method: 'GET',
        credentials: 'same-origin',
        headers: getAuthHeaders(),
      });
      const data = await res.json().catch(() => ({}));
      if (res.ok && data.success) {
        const isOn = Boolean(data.enabled);
        setEnabled(isOn);
        setEnabledAt(typeof data.enabledAt === 'number' ? data.enabledAt : null);
        onStatusChangeRef.current?.(isOn);
      }
    } catch {
      // ignore initial fetch error
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void loadStatus();
  }, [loadStatus]);

  const handleStartSetup = async () => {
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/auth/totp-setup', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({}),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success || !data.qrDataUrl || !data.setupToken) {
        setFeedback({
          type: 'error',
          text: data.message || 'Could not generate Google Authenticator QR code.',
        });
        return;
      }
      setSetupData({
        qrDataUrl: String(data.qrDataUrl),
        manualKey: String(data.manualKey || ''),
        setupToken: String(data.setupToken),
      });
      setVerifyCode('');
    } catch {
      setFeedback({ type: 'error', text: 'Connection error while starting setup.' });
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmEnable = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!setupData) return;
    const clean = verifyCode.replace(/\D/g, '').trim();
    if (clean.length !== 6) {
      setFeedback({ type: 'error', text: 'Please enter the 6-digit code shown in Google Authenticator.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/auth/totp-enable', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ setupToken: setupData.setupToken, code: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', text: data.message || 'Invalid 6-digit code. Please try again.' });
        return;
      }
      setEnabled(true);
      setEnabledAt(typeof data.enabledAt === 'number' ? data.enabledAt : Date.now());
      setSetupData(null);
      setVerifyCode('');
      setFeedback({ type: 'success', text: 'Google Authenticator linked successfully!' });
      onStatusChange?.(true);
    } catch {
      setFeedback({ type: 'error', text: 'Could not verify code. Please try again.' });
    } finally {
      setBusy(false);
    }
  };

  const handleDisable = async (e: React.FormEvent) => {
    e.preventDefault();
    const clean = disableCode.trim();
    if (!clean) {
      setFeedback({ type: 'error', text: 'Enter your current 6-digit Authenticator code or password to remove.' });
      return;
    }
    setBusy(true);
    setFeedback(null);
    try {
      const res = await fetch('/api/auth/totp-disable', {
        method: 'POST',
        credentials: 'same-origin',
        headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
        body: JSON.stringify({ verification: clean }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok || !data.success) {
        setFeedback({ type: 'error', text: data.message || 'Verification failed. Could not remove Authenticator.' });
        return;
      }
      setEnabled(false);
      setEnabledAt(null);
      setShowDisableForm(false);
      setDisableCode('');
      setFeedback({ type: 'success', text: 'Google Authenticator has been unlinked from your account.' });
      onStatusChange?.(false);
    } catch {
      setFeedback({ type: 'error', text: 'Connection error while unlinking Authenticator.' });
    } finally {
      setBusy(false);
    }
  };

  const handleCopyManualKey = () => {
    if (!setupData?.manualKey) return;
    navigator.clipboard?.writeText(setupData.manualKey).then(() => {
      setCopiedKey(true);
      setTimeout(() => setCopiedKey(false), 2000);
    }).catch(() => {});
  };

  return (
    <div className={`bg-white rounded-2xl border border-slate-200/90 shadow-2xs ${compact ? 'p-3.5' : 'p-4'} space-y-3`}>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 pb-2 border-b border-slate-100">
        <div className="flex items-center space-x-2.5">
          <div className={`p-2 rounded-lg ${enabled ? 'bg-emerald-50 text-emerald-600' : 'bg-indigo-50 text-indigo-600'}`}>
            <Smartphone size={16} />
          </div>
          <div>
            <div className="flex items-center space-x-2">
              <h4 className="text-xs font-black uppercase text-slate-900">
                Google Authenticator App (2FA)
              </h4>
              {!loading && (
                <span
                  className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-wider ${
                    enabled
                      ? 'bg-emerald-100 text-emerald-700 border border-emerald-200'
                      : 'bg-slate-100 text-slate-500 border border-slate-200'
                  }`}
                >
                  {enabled ? 'Linked & Active' : 'Not Linked'}
                </span>
              )}
            </div>
            <p className="text-[10px] text-slate-500 font-semibold">
              Scan QR code once with Google Authenticator for instant offline 6-digit login codes.
            </p>
          </div>
        </div>

        {!loading && !enabled && !setupData && (
          <button
            type="button"
            disabled={busy}
            onClick={handleStartSetup}
            className="px-3.5 h-9 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm transition-all cursor-pointer disabled:opacity-50 shrink-0"
          >
            <QrCode size={13} />
            <span>{busy ? 'Generating QR...' : 'Setup Authenticator'}</span>
          </button>
        )}

        {!loading && enabled && !showDisableForm && (
          <button
            type="button"
            onClick={() => {
              setShowDisableForm(true);
              setFeedback(null);
            }}
            className="px-3 h-8 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center space-x-1 transition-all cursor-pointer shrink-0"
          >
            <Trash2 size={12} />
            <span>Unlink App</span>
          </button>
        )}
      </div>

      {feedback && (
        <div
          className={`p-2.5 rounded-xl text-[11px] font-bold flex items-center space-x-2 ${
            feedback.type === 'success'
              ? 'bg-emerald-50 text-emerald-700 border border-emerald-200'
              : 'bg-rose-50 text-rose-700 border border-rose-200'
          }`}
        >
          {feedback.type === 'success' ? <CheckCircle2 size={14} className="shrink-0" /> : <AlertCircle size={14} className="shrink-0" />}
          <span>{feedback.text}</span>
        </div>
      )}

      {loading && (
        <div className="flex items-center space-x-2 text-xs text-slate-400 font-semibold py-1">
          <RefreshCw size={13} className="animate-spin" />
          <span>Checking Google Authenticator status...</span>
        </div>
      )}

      {!loading && enabled && !showDisableForm && (
        <div className="flex items-center justify-between bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-[11px] text-emerald-800 font-semibold">
          <div className="flex items-center space-x-2">
            <ShieldCheck size={16} className="text-emerald-600 shrink-0" />
            <span>
              Your account is paired with Google Authenticator
              {enabledAt ? ` (linked ${new Date(enabledAt).toLocaleDateString()})` : ''}.
            </span>
          </div>
        </div>
      )}

      {!loading && enabled && showDisableForm && (
        <form onSubmit={handleDisable} className="bg-rose-50/60 border border-rose-200 rounded-xl p-3 space-y-2.5">
          <p className="text-[11px] font-bold text-rose-900">
            Confirm unlinking Google Authenticator by entering your current 6-digit app code or your account password:
          </p>
          <div className="flex flex-col sm:flex-row gap-2">
            <input
              type="password"
              value={disableCode}
              onChange={(e) => setDisableCode(e.target.value)}
              placeholder="6-digit code or current password"
              className="flex-1 h-9 bg-white border border-rose-200 rounded-lg px-3 text-xs font-bold outline-none focus:border-rose-500"
              required
            />
            <div className="flex items-center space-x-2">
              <button
                type="submit"
                disabled={busy}
                className="px-3.5 h-9 bg-rose-600 hover:bg-rose-700 text-white rounded-lg font-black text-[10px] uppercase tracking-wider cursor-pointer disabled:opacity-50"
              >
                {busy ? 'Removing...' : 'Confirm Unlink'}
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowDisableForm(false);
                  setDisableCode('');
                }}
                className="px-3 h-9 bg-white border border-slate-200 text-slate-600 hover:bg-slate-50 rounded-lg font-bold text-[10px] uppercase cursor-pointer"
              >
                Cancel
              </button>
            </div>
          </div>
        </form>
      )}

      {!loading && !enabled && setupData && (
        <form onSubmit={handleConfirmEnable} className="bg-slate-50 border border-indigo-200 rounded-xl p-3.5 space-y-3">
          <div className="grid grid-cols-1 md:grid-cols-[180px_1fr] gap-4 items-center">
            <div className="flex flex-col items-center bg-white p-2.5 rounded-xl border border-slate-200 shadow-2xs mx-auto">
              <img
                src={setupData.qrDataUrl}
                alt="Google Authenticator QR Code"
                className="w-40 h-40 object-contain"
              />
              <span className="text-[9px] font-black uppercase text-slate-400 mt-1">Scan in Google Auth</span>
            </div>

            <div className="space-y-2.5">
              <div className="text-[11px] text-slate-700 font-semibold space-y-1">
                <p><strong className="text-slate-900">Step 1:</strong> Open <strong>Google Authenticator</strong> on your phone and tap <strong>+ → Scan a QR code</strong>.</p>
                <p><strong className="text-slate-900">Step 2:</strong> Enter the 6-digit code shown on your phone below to finish setup.</p>
              </div>

              <div className="bg-white border border-slate-200 rounded-lg p-2 flex items-center justify-between gap-2">
                <div className="min-w-0">
                  <div className="text-[8.5px] font-black uppercase text-slate-400">Manual Setup Key</div>
                  <div className="text-[11px] font-mono font-black text-slate-800 tracking-wider truncate">
                    {setupData.manualKey}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={handleCopyManualKey}
                  className="px-2 py-1 bg-slate-100 hover:bg-indigo-50 text-slate-600 hover:text-indigo-700 rounded-md text-[9px] font-black uppercase flex items-center space-x-1 shrink-0 cursor-pointer"
                >
                  {copiedKey ? <Check size={11} /> : <Copy size={11} />}
                  <span>{copiedKey ? 'Copied' : 'Copy'}</span>
                </button>
              </div>

              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <input
                  type="text"
                  inputMode="numeric"
                  maxLength={6}
                  value={verifyCode}
                  onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  placeholder="Enter 6-digit code"
                  className="flex-1 h-10 bg-white border border-indigo-300 rounded-xl px-3 text-center font-mono font-black text-base tracking-[0.35em] text-slate-900 outline-none focus:border-indigo-600"
                  required
                />
                <button
                  type="submit"
                  disabled={busy || verifyCode.length !== 6}
                  className="px-4 h-10 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-black text-[10px] uppercase tracking-wider flex items-center justify-center space-x-1.5 shadow-sm cursor-pointer disabled:opacity-50"
                >
                  <ShieldCheck size={14} />
                  <span>{busy ? 'Verifying...' : 'Verify & Activate'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSetupData(null);
                    setVerifyCode('');
                    setFeedback(null);
                  }}
                  className="px-3 h-10 bg-white border border-slate-200 text-slate-500 hover:bg-slate-100 rounded-xl font-bold text-[10px] uppercase cursor-pointer"
                >
                  Cancel
                </button>
              </div>
            </div>
          </div>
        </form>
      )}
    </div>
  );
};
