import React, { useState, useRef, useEffect } from 'react';
import { storageService } from '../services/storageService';
import { SystemSettings, EmailNotificationSettings } from '../types';
import { 
  Save, Landmark, CheckCircle2, Camera, Image as ImageIcon, Trash2, Globe,
  Mail, Bell, BellOff, Receipt, FileText, KeyRound, CalendarCheck,
  Send, RefreshCw, AlertCircle, Check, X, Sliders, Server, AtSign, UserCheck,
  Clock, ShieldCheck, Timer, CalendarOff, Calendar, Lock, Unlock
} from 'lucide-react';
import { useAuth, DEFAULT_SETTINGS } from '../AuthContext';
import { sendTestEmailApi, getStoredSmtpConfig } from '../services/pdfEmailService';
import { getAuthHeaders } from '../services/authToken';
import { useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

const DEFAULT_EMAIL_SETTINGS: EmailNotificationSettings = {
  enabled: true,
  transactionAlerts: true,
  payrollSalarySlips: true,
  securityPasswordReset: true,
  dayEndSettlementSummary: true,
  leaveAndAttendance: true,
  adminNotificationEmail: "info.rataulisaccos@gmail.com"
};

const SystemSettingsPage: React.FC = () => {
  const { refreshSettings, settings: authSettings, user, isSuperAdmin } = useAuth();
  const isDayEnded = useDayEndLock();
  const [settings, setSettings] = useState<SystemSettings | null>(authSettings);
  const [saved, setSaved] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Test Email State
  const [testEmailAddress, setTestEmailAddress] = useState(user?.email || "info.rataulisaccos@gmail.com");
  const [isTestingEmail, setIsTestingEmail] = useState(false);
  const [testResult, setTestResult] = useState<{ success: boolean; message: string } | null>(null);

  useEffect(() => {
    const fetchSettings = async () => {
      const s = await storageService.getSettings();
      const base = s || DEFAULT_SETTINGS;
      setSettings({
        ...DEFAULT_SETTINGS,
        ...base,
        emailNotifications: {
          ...DEFAULT_EMAIL_SETTINGS,
          ...(base.emailNotifications || {})
        }
      });
      if (base.emailNotifications?.adminNotificationEmail) {
        setTestEmailAddress(base.emailNotifications.adminNotificationEmail);
      }
    };
    fetchSettings();
  }, []);

  const handleSave = async () => {
    if (!settings) return;
    setIsSaving(true);
    try {
      const finalSettings = {
        ...settings,
        logoUrl: settings.logoUrl && !settings.logoUrl.includes('picsum.photos') ? settings.logoUrl : ''
      };
      await storageService.saveSettings(finalSettings);
      try {
        localStorage.setItem('ZEN_AUTH_SETTINGS', JSON.stringify(finalSettings));
        localStorage.setItem('saccos_db_settings', JSON.stringify(finalSettings));
        window.dispatchEvent(new Event('settingsUpdated'));
        window.dispatchEvent(new Event('storage'));
      } catch {
        // ignore localStorage write restrictions
      }
      await refreshSettings();
      setSaved(true);
      await storageService.saveLog('admin', 'UPDATE_SETTINGS', 'Updated global system parameters, branding, back-date policy, and email rules');
      setTimeout(() => setSaved(false), 2500);
    } catch (error) {
      console.error("Failed to save settings", error);
    } finally {
      setIsSaving(false);
    }
  };

  if (!settings) return null;

  const currentAutoLogoutMinutes = settings.autoLogoutMinutes !== undefined ? settings.autoLogoutMinutes : 30;
  const isBackDateAllowed = settings.allowBackDateEntry !== false;
  const isSpecialDayReopenAllowed = settings.allowDayReopenSpecialAccess === true;
  const emailSettings = settings.emailNotifications || DEFAULT_EMAIL_SETTINGS;
  const isMasterEnabled = emailSettings.enabled;

  const handleToggleEmailSetting = (key: keyof EmailNotificationSettings) => {
    setSettings(prev => {
      if (!prev) return prev;
      const current = prev.emailNotifications || DEFAULT_EMAIL_SETTINGS;
      return {
        ...prev,
        emailNotifications: {
          ...current,
          [key]: !current[key]
        }
      };
    });
  };

  const handleSetAllEmail = (enable: boolean) => {
    setSettings(prev => {
      if (!prev) return prev;
      const current = prev.emailNotifications || DEFAULT_EMAIL_SETTINGS;
      return {
        ...prev,
        emailNotifications: {
          ...current,
          enabled: enable,
          transactionAlerts: enable,
          payrollSalarySlips: enable,
          securityPasswordReset: enable,
          dayEndSettlementSummary: enable,
          leaveAndAttendance: enable
        }
      };
    });
  };

  const handleAdminEmailChange = (val: string) => {
    setSettings(prev => {
      if (!prev) return prev;
      return {
        ...prev,
        emailNotifications: {
          ...(prev.emailNotifications || DEFAULT_EMAIL_SETTINGS),
          adminNotificationEmail: val
        }
      };
    });
  };

  const handleSendTestEmail = async () => {
    if (!testEmailAddress || !testEmailAddress.trim()) {
      setTestResult({ success: false, message: "Please enter a valid test email address." });
      return;
    }

    if (!isMasterEnabled) {
      setTestResult({ 
        success: false, 
        message: "Master email notification switch is currently disabled. Please enable the master switch and apply changes before sending a test email." 
      });
      return;
    }

    setIsTestingEmail(true);
    setTestResult(null);

    try {
      const res = await sendTestEmailApi({
        to: testEmailAddress.trim(),
        companyName: settings.systemName,
        companyAddress: settings.address,
        smtpConfig: getStoredSmtpConfig()
      });
      setTestResult(res);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      setTestResult({ success: false, message: `Failed to send test email: ${msg}` });
    } finally {
      setIsTestingEmail(false);
    }
  };

  const handleLogoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onloadend = async () => {
        const base64Data = reader.result as string;
        try {
          const resp = await fetch('/api/upload-logo', {
            method: 'POST',
            credentials: 'same-origin',
            headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
            body: JSON.stringify({ imageBase64: base64Data })
          });
          if (resp.ok) {
            const data = await resp.json();
            if (data && data.logoUrl) {
              setSettings(prev => prev ? ({ ...prev, logoUrl: data.logoUrl }) : prev);
              return;
            }
          }
        } catch (serverErr) {
          console.warn('Server upload notice, using client data URL:', serverErr);
        }
        setSettings(prev => prev ? ({ ...prev, logoUrl: base64Data }) : prev);
      };
      reader.readAsDataURL(file);
    }
    e.target.value = '';
  };

  const removeLogo = async () => {
    if (!settings) return;
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    const nextSettings: SystemSettings = {
      ...settings,
      logoUrl: ''
    };
    setSettings(nextSettings);
    try {
      localStorage.setItem('ZEN_AUTH_SETTINGS', JSON.stringify(nextSettings));
      localStorage.setItem('saccos_db_settings', JSON.stringify(nextSettings));
      window.dispatchEvent(new Event('settingsUpdated'));
      window.dispatchEvent(new Event('storage'));
      await storageService.saveSettings(nextSettings);
      await refreshSettings();
      await storageService.saveLog(user?.username || 'admin', 'REMOVE_LOGO', 'Removed official institution logo');
    } catch (error) {
      console.error('Failed to persist logo removal:', error);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-3.5 animate-in slide-in-from-bottom-2 duration-500 pb-8 font-sans">
      
      {/* Top Action & Navigation Header */}
      <div className="bg-white py-3.5 px-5 rounded-2xl border border-slate-200 shadow-sm flex flex-col md:flex-row items-center justify-between gap-3">
        <div className="flex items-center space-x-3">
          <div className="p-2 bg-slate-950 text-emerald-400 rounded-xl shadow-md">
            <Sliders size={18}/>
          </div>
          <div>
            <h3 className="text-base font-black italic tracking-tight text-slate-800 uppercase leading-none">
              System Settings & Governance
            </h3>
            <p className="text-[9.5px] font-bold text-slate-400 uppercase tracking-widest mt-0.5">
              Branding, Institutional Identity & Email Notification Controls
            </p>
          </div>
        </div>

        <button 
          id="btn-apply-system-settings"
          onClick={handleSave} 
          disabled={isSaving || isDayEnded}
          className="flex items-center space-x-2 bg-emerald-600 text-white px-5 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-[0.16em] shadow-md hover:bg-emerald-700 transition-all active:scale-95 border-b-2 border-emerald-800 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Save size={15} />
          <span>{isDayEnded ? 'Day Ended (Locked)' : isSaving ? 'Applying Changes...' : 'Apply Changes'}</span>
        </button>
      </div>

      {/* SECTION 2C (SUPER ADMIN ACCESS): SPECIAL ACCESS TO RE-OPEN AFTER DAY END */}
      {isSuperAdmin && (
        <div className="bg-white rounded-2xl border border-amber-200 shadow-sm overflow-hidden">
          <div className="py-3 px-5 bg-gradient-to-r from-slate-900 via-amber-950 to-slate-900 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
            <div className="flex items-center space-x-2.5">
              <div className={`p-2 rounded-lg border ${isSpecialDayReopenAllowed ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/30' : 'bg-amber-500/20 text-amber-300 border-amber-400/30'}`}>
                {isSpecialDayReopenAllowed ? <Unlock size={18} /> : <Lock size={18} />}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h4 className="text-sm font-black italic tracking-tight uppercase">
                    Special Access: Same-Day Day Open Override
                  </h4>
                  <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                    isSpecialDayReopenAllowed
                      ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                      : 'bg-amber-500/20 text-amber-200 border-amber-400/30'
                  }`}>
                    {isSpecialDayReopenAllowed ? 'Special Access Active' : 'Standard Governance'}
                  </span>
                </div>
                <p className="text-[10px] font-medium text-slate-300">
                  Super Admin emergency override to permit Day Open on the same day after Day End
                </p>
              </div>
            </div>
          </div>

          <div className="p-4 md:p-5 bg-amber-50/40">
            <div
              className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border-2 transition-all duration-300 bg-white shadow-sm"
              style={{ borderColor: isSpecialDayReopenAllowed ? '#10b981' : '#f59e0b' }}
            >
              <div className="flex items-start space-x-3">
                <div className={`p-2.5 rounded-xl transition-colors duration-300 shrink-0 ${
                  isSpecialDayReopenAllowed ? 'bg-emerald-100 text-emerald-700' : 'bg-amber-100 text-amber-800'
                }`}>
                  {isSpecialDayReopenAllowed ? <Unlock size={20} /> : <Lock size={20} />}
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <h5 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                      Allow Same-Day Day Open After Day End (Special Access)
                    </h5>
                    <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-widest ${
                      isSpecialDayReopenAllowed ? 'bg-emerald-600 text-white' : 'bg-amber-600 text-white'
                    }`}>
                      {isSpecialDayReopenAllowed ? 'ENABLED' : 'DISABLED'}
                    </span>
                  </div>
                  <p className="text-[11px] text-slate-600 mt-1 max-w-2xl leading-relaxed">
                    {isSpecialDayReopenAllowed
                      ? 'ENABLED: Branches and Head Office are authorized to perform Day Open on the same calendar day immediately after Day End using Super Admin Special Access.'
                      : 'DISABLED: After Day End, a branch can only perform Day Open when (1) all branches complete Day End and Head Office opens the day first, (2) the calendar date changes, or (3) Super Admin enables this Special Access switch.'}
                  </p>
                </div>
              </div>

              <div className="flex items-center space-x-3 self-end md:self-center shrink-0">
                <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                  {isSpecialDayReopenAllowed ? 'Authorized' : 'Restricted'}
                </span>
                <button
                  id="toggle-special-day-reopen-switch"
                  type="button"
                  onClick={async () => {
                    if (!settings) return;
                    const nextAllow = !isSpecialDayReopenAllowed;
                    const nextSettings: SystemSettings = {
                      ...settings,
                      allowDayReopenSpecialAccess: nextAllow,
                      logoUrl: settings.logoUrl && !settings.logoUrl.includes('picsum.photos') ? settings.logoUrl : ''
                    };
                    setSettings(nextSettings);
                    try {
                      localStorage.setItem('ZEN_AUTH_SETTINGS', JSON.stringify(nextSettings));
                      localStorage.setItem('saccos_db_settings', JSON.stringify(nextSettings));
                      window.dispatchEvent(new Event('settingsUpdated'));
                      window.dispatchEvent(new Event('storage'));
                      await storageService.saveSettings(nextSettings);
                      await storageService.saveLog(
                        user?.username || 'admin',
                        'TOGGLE_DAY_REOPEN_SPECIAL_ACCESS',
                        `${nextAllow ? 'Enabled' : 'Disabled'} Super Admin Special Access for same-day Day Open`
                      );
                      await refreshSettings();
                      setSaved(true);
                      setTimeout(() => setSaved(false), 2000);
                    } catch {
                      // localStorage & event already updated
                    }
                  }}
                  className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none shadow-inner cursor-pointer ${
                    isSpecialDayReopenAllowed ? 'bg-emerald-600' : 'bg-amber-500'
                  }`}
                  title={isSpecialDayReopenAllowed ? 'Disable Special Access' : 'Enable Special Access'}
                >
                  <span
                    className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                      isSpecialDayReopenAllowed ? 'translate-x-8' : 'translate-x-1'
                    }`}
                  />
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <DayEndFieldset className="space-y-3.5">
      {/* SECTION 1: EMAIL NOTIFICATIONS CONTROL PANEL */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        
        {/* Section Header */}
        <div className="py-3 px-5 bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-blue-500/20 text-blue-400 rounded-lg border border-blue-400/30">
              <Mail size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-black italic tracking-tight uppercase">
                  Email Notifications Management
                </h4>
                <span className="bg-blue-500/20 text-blue-300 text-[8.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-blue-400/30">
                  Automated Alerts
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-300">
                Enable or disable automated system email notifications across all operations
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <button
              onClick={() => handleSetAllEmail(true)}
              className="px-2.5 py-1.5 bg-emerald-500/20 hover:bg-emerald-500/30 text-emerald-300 border border-emerald-500/40 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center space-x-1"
            >
              <Check size={11} />
              <span>Enable All</span>
            </button>
            <button
              onClick={() => handleSetAllEmail(false)}
              className="px-2.5 py-1.5 bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/40 rounded-lg text-[8.5px] font-black uppercase tracking-wider transition-all flex items-center space-x-1"
            >
              <X size={11} />
              <span>Disable All</span>
            </button>
          </div>
        </div>

        {/* Master Switch Card */}
        <div className="p-3.5 px-5 border-b border-slate-100 bg-slate-50/70">
          <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-3 p-3.5 rounded-xl border-2 transition-all duration-300 bg-white shadow-sm"
            style={{
              borderColor: isMasterEnabled ? '#10b981' : '#cbd5e1'
            }}
          >
            <div className="flex items-start space-x-3">
              <div className={`p-2.5 rounded-xl transition-colors duration-300 shrink-0 ${
                isMasterEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-200 text-slate-600'
              }`}>
                {isMasterEnabled ? <Bell size={20} /> : <BellOff size={20} />}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h5 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                    Master Email Notification Switch
                  </h5>
                  <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-widest ${
                    isMasterEnabled ? 'bg-emerald-500 text-white' : 'bg-slate-400 text-white'
                  }`}>
                    {isMasterEnabled ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-0.5 max-w-2xl leading-normal">
                  {isMasterEnabled 
                    ? "Master email notifications are enabled. Automated alerts will be dispatched according to the granular settings configured below." 
                    : "Master email notifications are disabled. All outgoing automated emails are currently suppressed."}
                </p>
              </div>
            </div>

            {/* Master Toggle Switch */}
            <div className="flex items-center space-x-3 self-end md:self-center shrink-0">
              <button
                id="toggle-master-email-switch"
                type="button"
                onClick={() => handleToggleEmailSetting('enabled')}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none shadow-inner ${
                  isMasterEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
                title={isMasterEnabled ? "Click to Disable All Emails" : "Click to Enable All Emails"}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                    isMasterEnabled ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>

        {/* Granular Notification Switches Grid */}
        <div className="p-3.5 px-5 space-y-2.5">
          <div className="flex items-center justify-between pb-1 border-b border-slate-100">
            <div>
              <h5 className="text-[11px] font-black uppercase tracking-wider text-slate-700">
                Granular Notification Controls
              </h5>
            </div>
            {!isMasterEnabled && (
              <span className="text-[9px] font-bold text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-200">
                Master switch disabled; outgoing emails suppressed
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-2.5">
            
            {/* 1. Transaction & Ledger Alerts */}
            <div className={`p-2.5 px-3.5 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
              emailSettings.transactionAlerts && isMasterEnabled
                ? 'bg-emerald-50/40 border-emerald-200 shadow-sm'
                : 'bg-slate-50/70 border-slate-200 opacity-80'
            }`}>
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-emerald-100 text-emerald-700 rounded-lg shrink-0">
                  <Receipt size={16} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      1. Transaction & Ledger Alerts
                    </span>
                    <span className="text-[8px] bg-slate-100 text-slate-600 font-bold px-1.5 py-0.5 rounded border border-slate-200">
                      Ledger & Counter
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Deposit/withdrawal receipts, voucher postings, and voucher edits/deletions
                  </p>
                </div>
              </div>

              <button
                id="toggle-email-transaction-alerts"
                type="button"
                onClick={() => handleToggleEmailSetting('transactionAlerts')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 ${
                  emailSettings.transactionAlerts && isMasterEnabled ? 'bg-emerald-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                    emailSettings.transactionAlerts && isMasterEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 2. Salary Slips / Payroll Slips */}
            <div className={`p-2.5 px-3.5 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
              emailSettings.payrollSalarySlips && isMasterEnabled
                ? 'bg-blue-50/40 border-blue-200 shadow-sm'
                : 'bg-slate-50/70 border-slate-200 opacity-80'
            }`}>
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-blue-100 text-blue-700 rounded-lg shrink-0">
                  <FileText size={16} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      2. Payroll & Salary Slips
                    </span>
                    <span className="text-[8px] bg-blue-100 text-blue-700 font-bold px-1.5 py-0.5 rounded border border-blue-200">
                      HR / PDF
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Monthly employee salary slips with downloadable PDF remuneration breakdowns
                  </p>
                </div>
              </div>

              <button
                id="toggle-email-payroll-slips"
                type="button"
                onClick={() => handleToggleEmailSetting('payrollSalarySlips')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 ${
                  emailSettings.payrollSalarySlips && isMasterEnabled ? 'bg-blue-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                    emailSettings.payrollSalarySlips && isMasterEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 3. Password Reset & Security OTP */}
            <div className={`p-2.5 px-3.5 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
              emailSettings.securityPasswordReset && isMasterEnabled
                ? 'bg-amber-50/40 border-amber-200 shadow-sm'
                : 'bg-slate-50/70 border-slate-200 opacity-80'
            }`}>
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-amber-100 text-amber-800 rounded-lg shrink-0">
                  <KeyRound size={16} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      3. Password Reset & Security OTP
                    </span>
                    <span className="text-[8px] bg-amber-100 text-amber-800 font-bold px-1.5 py-0.5 rounded border border-amber-200">
                      Security & Auth
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Security verification OTP codes, login credentials, and administrator reset links
                  </p>
                </div>
              </div>

              <button
                id="toggle-email-security-reset"
                type="button"
                onClick={() => handleToggleEmailSetting('securityPasswordReset')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 ${
                  emailSettings.securityPasswordReset && isMasterEnabled ? 'bg-amber-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                    emailSettings.securityPasswordReset && isMasterEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 4. Day-End Settlement Summary */}
            <div className={`p-2.5 px-3.5 rounded-xl border transition-all duration-200 flex items-center justify-between gap-3 ${
              emailSettings.dayEndSettlementSummary && isMasterEnabled
                ? 'bg-purple-50/40 border-purple-200 shadow-sm'
                : 'bg-slate-50/70 border-slate-200 opacity-80'
            }`}>
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-purple-100 text-purple-700 rounded-lg shrink-0">
                  <CalendarCheck size={16} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      4. Day-End Settlement Summary
                    </span>
                    <span className="text-[8px] bg-purple-100 text-purple-700 font-bold px-1.5 py-0.5 rounded border border-purple-200">
                      Day Close
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Daily operational close summaries with vault balance and settlement differentials
                  </p>
                </div>
              </div>

              <button
                id="toggle-email-day-end"
                type="button"
                onClick={() => handleToggleEmailSetting('dayEndSettlementSummary')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 ${
                  emailSettings.dayEndSettlementSummary && isMasterEnabled ? 'bg-purple-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                    emailSettings.dayEndSettlementSummary && isMasterEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

            {/* 5. HR Leave & Attendance Alerts */}
            <div className={`p-2.5 px-3.5 rounded-xl border transition-all duration-200 md:col-span-2 flex items-center justify-between gap-3 ${
              emailSettings.leaveAndAttendance && isMasterEnabled
                ? 'bg-teal-50/40 border-teal-200 shadow-sm'
                : 'bg-slate-50/70 border-slate-200 opacity-80'
            }`}>
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-teal-100 text-teal-700 rounded-lg shrink-0">
                  <UserCheck size={16} />
                </div>
                <div>
                  <div className="flex items-center space-x-2">
                    <span className="text-xs font-black text-slate-800 uppercase tracking-tight">
                      5. HR Leave & Attendance Alerts
                    </span>
                    <span className="text-[8px] bg-teal-100 text-teal-700 font-bold px-1.5 py-0.5 rounded border border-teal-200">
                      Leave & Approvals
                    </span>
                  </div>
                  <p className="text-[10px] text-slate-500 leading-snug">
                    Real-time email alerts dispatched to employees and administrators on leave application submission, approval, or rejection
                  </p>
                </div>
              </div>

              <button
                id="toggle-email-leave-attendance"
                type="button"
                onClick={() => handleToggleEmailSetting('leaveAndAttendance')}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors duration-200 shrink-0 ${
                  emailSettings.leaveAndAttendance && isMasterEnabled ? 'bg-teal-600' : 'bg-slate-300'
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform duration-200 shadow-sm ${
                    emailSettings.leaveAndAttendance && isMasterEnabled ? 'translate-x-6' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>

          </div>

          {/* Central Admin Email & Live SMTP Test Card (Compact) */}
          <div className="mt-3 p-3 px-4 rounded-xl bg-slate-900 text-white border border-slate-800 shadow-sm">
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
              
              {/* Admin Email Configuration */}
              <div className="lg:col-span-6 space-y-1">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <AtSign size={14} />
                  <label className="text-[9.5px] font-black uppercase tracking-wider text-slate-200">
                    Central Notification Email
                  </label>
                </div>
                <input
                  type="email"
                  value={emailSettings.adminNotificationEmail || ''}
                  onChange={e => handleAdminEmailChange(e.target.value)}
                  placeholder="info.rataulisaccos@gmail.com"
                  className="w-full h-8 bg-slate-800 border border-slate-700 rounded-lg px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-emerald-500 transition-all font-mono"
                />
              </div>

              {/* SMTP Test Trigger */}
              <div className="lg:col-span-6 space-y-1 lg:border-l lg:border-slate-800 lg:pl-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center space-x-1.5 text-blue-400">
                    <Server size={13} />
                    <span className="text-[9.5px] font-black uppercase tracking-wider text-slate-200">
                      Live SMTP Verification
                    </span>
                  </div>
                  <span className="text-[8px] text-emerald-400 bg-emerald-950 px-1.5 py-0.2 rounded border border-emerald-800 font-mono">
                    Gmail SSL (465)
                  </span>
                </div>

                <div className="flex items-center space-x-2">
                  <input
                    type="email"
                    value={testEmailAddress}
                    onChange={e => setTestEmailAddress(e.target.value)}
                    placeholder="Recipient email for test..."
                    className="flex-1 h-8 bg-slate-800 border border-slate-700 rounded-lg px-3 text-xs text-white placeholder-slate-500 outline-none focus:border-blue-500 transition-all font-mono"
                  />
                  <button
                    id="btn-send-test-email"
                    type="button"
                    onClick={handleSendTestEmail}
                    disabled={isTestingEmail}
                    className="h-8 px-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center space-x-1.5 disabled:opacity-50 shrink-0 shadow-md"
                  >
                    {isTestingEmail ? (
                      <RefreshCw size={12} className="animate-spin" />
                    ) : (
                      <Send size={12} />
                    )}
                    <span>{isTestingEmail ? 'Sending...' : 'Test Send'}</span>
                  </button>
                </div>

                {/* Test Result Message */}
                {testResult && (
                  <div className={`p-1.5 px-2.5 rounded-lg text-[10px] flex items-center space-x-2 border transition-all animate-in fade-in duration-300 mt-1 ${
                    testResult.success 
                      ? 'bg-emerald-950/80 text-emerald-300 border-emerald-800' 
                      : 'bg-rose-950/80 text-rose-300 border-rose-800'
                  }`}>
                    {testResult.success ? <CheckCircle2 size={13} className="shrink-0" /> : <AlertCircle size={13} className="shrink-0" />}
                    <span className="leading-tight text-[9.5px]">{testResult.message}</span>
                  </div>
                )}
              </div>

            </div>
          </div>
        </div>
      </div>

      {/* SECTION 2: SESSION SECURITY & AUTO LOGOUT CONTROLS */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        {/* Section Header */}
        <div className="py-3 px-5 bg-gradient-to-r from-slate-900 via-slate-800 to-emerald-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-lg border border-emerald-400/30">
              <Clock size={18} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-black italic tracking-tight uppercase">
                  Session Security &amp; Auto-Logout Timeout
                </h4>
                <span className="bg-emerald-500/20 text-emerald-300 text-[8.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border border-emerald-400/30">
                  {currentAutoLogoutMinutes > 0 ? `${currentAutoLogoutMinutes} Minutes Timeout` : 'Disabled'}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-300">
                स्वचालित लगआउट समय — प्रयोगकर्ता निष्क्रिय हुँदा सुरक्षाका लागि स्वतः लगआउट हुने समय सेटअप
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            <span className="text-[9px] font-bold text-slate-300 uppercase tracking-widest hidden sm:inline">
              Session Inactivity Policy
            </span>
          </div>
        </div>

        {/* Configuration Body */}
        <div className="p-4 md:p-5 space-y-4">
          <div className="flex flex-col lg:flex-row items-start lg:items-center justify-between gap-4 p-4 rounded-xl border border-slate-200 bg-slate-50/70">
            <div className="space-y-1 max-w-xl">
              <div className="flex items-center space-x-2">
                <ShieldCheck size={16} className="text-emerald-600" />
                <span className="text-xs font-black text-slate-800 uppercase tracking-wider">
                  Inactivity Auto-Logout Duration (स्वतः लगआउट समय)
                </span>
              </div>
              <p className="text-[11px] text-slate-600 leading-relaxed">
                तोकिएको समयावधिभर प्रयोगकर्ताले किबोर्ड वा माउस प्रयोग नगरेमा (Inactive भएमा) सुरक्षाका लागि प्रणालीले स्वतः लगआउट गर्नेछ।
                तपाईं आवश्यकता अनुसार १५, ३०, ४५, ६० वा आफूले चाहेको मिनेट निर्धारण गर्न सक्नुहुन्छ।
              </p>
            </div>

            {/* Quick preset pills */}
            <div className="flex flex-wrap items-center gap-1.5 shrink-0">
              {[15, 30, 45, 60, 120].map((mins) => {
                const isSelected = currentAutoLogoutMinutes === mins;
                return (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => setSettings({ ...settings, autoLogoutMinutes: mins })}
                    className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                      isSelected
                        ? 'bg-emerald-600 text-white border-emerald-600 shadow-md ring-2 ring-emerald-300'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                    }`}
                  >
                    {mins} Min {mins === 30 && '(Standard)'}
                  </button>
                );
              })}
              <button
                type="button"
                onClick={() => setSettings({ ...settings, autoLogoutMinutes: 0 })}
                className={`px-3 py-1.5 rounded-lg text-[10px] font-black uppercase tracking-wider transition-all border ${
                  currentAutoLogoutMinutes === 0
                    ? 'bg-rose-600 text-white border-rose-600 shadow-md ring-2 ring-rose-300'
                    : 'bg-white text-slate-500 border-slate-200 hover:bg-rose-50 hover:text-rose-600'
                }`}
                title="Never auto logout (Not recommended for shared computers)"
              >
                Disable (0 Min)
              </button>
            </div>
          </div>

          {/* Custom Duration Input */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-center bg-white p-3.5 rounded-xl border border-slate-200">
            <div className="md:col-span-2">
              <label className="text-[10px] font-black uppercase tracking-wider text-slate-700 flex items-center space-x-1.5">
                <Timer size={13} className="text-slate-500" />
                <span>Custom Timeout Duration (आफ्नो अनुकुल मिनेट राख्नुहोस्):</span>
              </label>
              <p className="text-[10px] text-slate-500 mt-0.5">
                कति मिनेट निष्क्रिय रहँदा लगआउट गर्ने? (उदाहरण: 30 = आधा घण्टा, 60 = १ घण्टा)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  min="0"
                  max="720"
                  step="1"
                  value={settings.autoLogoutMinutes !== undefined ? settings.autoLogoutMinutes : 30}
                  onChange={(e) => {
                    const val = parseInt(e.target.value, 10);
                    setSettings({
                      ...settings,
                      autoLogoutMinutes: isNaN(val) ? 30 : Math.max(0, val)
                    });
                  }}
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 pr-16 font-mono font-bold text-xs text-slate-900 outline-none focus:border-emerald-500 shadow-inner"
                  placeholder="30"
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-[10px] font-black text-slate-400 uppercase tracking-wider pointer-events-none">
                  Minutes
                </span>
              </div>

              <button
                type="button"
                onClick={() => setSettings({ ...settings, autoLogoutMinutes: 30 })}
                className="h-9 px-3 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-lg text-[9px] font-black uppercase tracking-wider border border-slate-200 transition-all shrink-0"
              >
                Reset 30m
              </button>
            </div>
          </div>

          {currentAutoLogoutMinutes === 0 && (
            <div className="p-2.5 px-3.5 bg-amber-50 border border-amber-200 rounded-xl flex items-start space-x-2.5 text-amber-800 animate-in fade-in">
              <AlertCircle size={15} className="shrink-0 mt-0.5 text-amber-600" />
              <div className="text-[10px] leading-relaxed">
                <strong className="font-black uppercase">सुरक्षा चेतावनी (Security Note):</strong> स्वतः लगआउट बन्द गर्दा वा धेरै लामो समय राख्दा कम्प्युटर खुला छोडेर जाँदा अनाधिकृत व्यक्तिले खाता सञ्चालन गर्न सक्ने जोखिम हुन्छ। सामान्यतया <strong>३० मिनेट (30 Minutes)</strong> राख्नु सुरक्षित मानिन्छ।
              </div>
            </div>
          )}
        </div>
      </div>

      {/* SECTION 2B: BACK DATE ENTRY CONTROL SWITCH */}
      <div className="bg-white rounded-2xl border border-slate-200 shadow-sm overflow-hidden">
        <div className="py-3 px-5 bg-gradient-to-r from-slate-900 via-slate-800 to-teal-950 text-white flex flex-col md:flex-row items-start md:items-center justify-between gap-3">
          <div className="flex items-center space-x-2.5">
            <div className={`p-2 rounded-lg border ${isBackDateAllowed ? 'bg-emerald-500/20 text-emerald-400 border-emerald-400/30' : 'bg-rose-500/20 text-rose-400 border-rose-400/30'}`}>
              {isBackDateAllowed ? <Calendar size={18} /> : <CalendarOff size={18} />}
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h4 className="text-sm font-black italic tracking-tight uppercase">
                  Back &amp; Future Date Entry Control Policy
                </h4>
                <span className={`text-[8.5px] font-black px-2 py-0.5 rounded-full uppercase tracking-wider border ${
                  isBackDateAllowed
                    ? 'bg-emerald-500/20 text-emerald-300 border-emerald-400/30'
                    : 'bg-rose-500/20 text-rose-300 border-rose-400/30'
                }`}>
                  {isBackDateAllowed ? 'Back & Next Date Allowed' : 'Strictly Blocked (Today Only)'}
                </span>
              </div>
              <p className="text-[10px] font-medium text-slate-300">
                ब्याक-डेट र आगामी मिति इन्ट्री अनुमति — आज बाहेकका विगत (Back) वा आगामी (Next) मिति छानी कारोबार वा डाटा प्रविष्टि गर्न दिने वा नदिने नियन्त्रण
              </p>
            </div>
          </div>
        </div>

        <div className="p-4 md:p-5 bg-slate-50/70">
          <div
            className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 p-4 rounded-xl border-2 transition-all duration-300 bg-white shadow-sm"
            style={{
              borderColor: isBackDateAllowed ? '#10b981' : '#f43f5e'
            }}
          >
            <div className="flex items-start space-x-3">
              <div className={`p-2.5 rounded-xl transition-colors duration-300 shrink-0 ${
                isBackDateAllowed ? 'bg-emerald-100 text-emerald-700' : 'bg-rose-100 text-rose-700'
              }`}>
                {isBackDateAllowed ? <Calendar size={20} /> : <CalendarOff size={20} />}
              </div>
              <div>
                <div className="flex items-center space-x-2">
                  <h5 className="text-sm font-black text-slate-800 uppercase tracking-tight">
                    Allow Back-Date &amp; Future-Date Transaction Entry
                  </h5>
                  <span className={`px-2 py-0.5 rounded-full text-[8.5px] font-black uppercase tracking-widest ${
                    isBackDateAllowed ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                  }`}>
                    {isBackDateAllowed ? 'ENABLED' : 'DISABLED'}
                  </span>
                </div>
                <p className="text-[11px] text-slate-600 mt-1 max-w-2xl leading-relaxed">
                  {isBackDateAllowed
                    ? 'ENABLED (सक्रिय): प्रयोगकर्ताहरूले आजको मिति, विगतको मिति (Back Date) तथा आगामी मिति (Next Date) मा कारोबार र रेकर्ड प्रविष्टि गर्न पाउँछन्।'
                    : 'DISABLED (बन्द): सफ्टवेयरको कुनै पनि मेनुमा आज बाहेक विगत (Back Date) वा आगामी (Next Date) मिति छानी नयाँ इन्ट्री वा संशोधन गर्न पूर्ण रूपमा रोक लगाइएको छ। आजको मितिमा मात्र इन्ट्री गर्न सकिन्छ।'}
                </p>
              </div>
            </div>

            <div className="flex items-center space-x-3 self-end md:self-center shrink-0">
              <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">
                {isBackDateAllowed ? 'Permitted' : 'Blocked'}
              </span>
              <button
                id="toggle-back-date-entry-switch"
                type="button"
                onClick={async () => {
                  if (!settings) return;
                  const nextAllow = settings.allowBackDateEntry === false ? true : false;
                  const nextSettings: SystemSettings = {
                    ...settings,
                    allowBackDateEntry: nextAllow,
                    logoUrl: settings.logoUrl && !settings.logoUrl.includes('picsum.photos') ? settings.logoUrl : ''
                  };
                  setSettings(nextSettings);
                  try {
                    localStorage.setItem('ZEN_AUTH_SETTINGS', JSON.stringify(nextSettings));
                    localStorage.setItem('saccos_db_settings', JSON.stringify(nextSettings));
                    window.dispatchEvent(new Event('settingsUpdated'));
                    window.dispatchEvent(new Event('storage'));
                    await storageService.saveSettings(nextSettings);
                    await refreshSettings();
                    setSaved(true);
                    setTimeout(() => setSaved(false), 2000);
                  } catch {
                    // localStorage & event already updated
                  }
                }}
                className={`relative inline-flex h-7 w-14 items-center rounded-full transition-colors duration-300 focus:outline-none shadow-inner cursor-pointer ${
                  isBackDateAllowed ? 'bg-emerald-600' : 'bg-rose-500'
                }`}
                title={isBackDateAllowed ? "Click to Block All Back-Date Entries" : "Click to Allow Back-Date Entries"}
              >
                <span
                  className={`inline-block h-5 w-5 transform rounded-full bg-white transition-transform duration-300 shadow-md ${
                    isBackDateAllowed ? 'translate-x-8' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* SECTION 3: SYSTEM BRANDING & GENERAL SETTINGS */}
      <div className="bg-white p-4 md:p-5 rounded-2xl border border-slate-200 shadow-sm space-y-3">
        <div className="flex items-center space-x-2.5 pb-2 border-b border-slate-100">
          <div className="p-1.5 bg-slate-100 text-slate-800 rounded-lg">
            <Landmark size={17}/>
          </div>
          <div>
            <h4 className="text-sm font-black italic tracking-tight text-slate-800 uppercase leading-none">
              System Branding & Institutional Identity
            </h4>
            <p className="text-[9px] font-black text-slate-400 uppercase tracking-widest mt-0.5">
              Bilingual Institution Title, Address, Registration No., PAN, Email &amp; Branding Logo
            </p>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5 items-start">
          {/* Logo Section */}
          <div className="lg:col-span-3 flex flex-col items-center space-y-2">
            <label className="text-[8.5px] font-black uppercase text-slate-400 tracking-widest self-start ml-0.5">
              Official Institution Logo
            </label>
            <div className="relative group">
              <div className="w-28 h-28 rounded-2xl bg-slate-50 border-2 border-slate-150 overflow-hidden shadow-inner flex items-center justify-center relative">
                {settings.logoUrl ? (
                  <img src={settings.logoUrl} className="w-full h-full object-contain p-2" alt="System Logo" />
                ) : (
                  <div className="flex flex-col items-center text-slate-300 uppercase">
                    <ImageIcon size={36} className="mb-1 opacity-20" />
                    <span className="text-[7.5px] tracking-widest font-black">No Logo Set</span>
                  </div>
                )}
              </div>
              
              <div className="absolute -bottom-2 left-1/2 -translate-x-1/2 flex space-x-1">
                <button 
                  type="button"
                  onClick={() => fileInputRef.current?.click()} 
                  className="bg-slate-950 text-white p-1.5 rounded-lg shadow-md hover:bg-blue-600 transition-all active:scale-90 flex items-center space-x-1 border border-white"
                  title="Upload New Logo"
                >
                  <Camera size={12} />
                </button>
                {settings.logoUrl && (
                  <button 
                    type="button"
                    onClick={removeLogo} 
                    className="bg-white text-rose-500 p-1.5 rounded-lg shadow-md hover:bg-rose-500 hover:text-white transition-all active:scale-90 border border-slate-100"
                    title="Remove Logo"
                  >
                    <Trash2 size={12} />
                  </button>
                )}
              </div>
              <input ref={fileInputRef} type="file" accept="image/*" onChange={handleLogoUpload} className="hidden" />
            </div>
            <p className="text-[7.5px] text-slate-400 text-center uppercase tracking-wider leading-tight px-1">
              Transparent PNG or SVG vector format recommended
            </p>
          </div>

          {/* Form Section */}
          <div className="lg:col-span-9 space-y-3">
            {/* Institution Name (English & Nepali) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9.5px] font-black uppercase text-slate-500 ml-0.5 tracking-wider">
                  Institution Name (English)
                </label>
                <input 
                  type="text" 
                  value={settings.systemName} 
                  onChange={e => setSettings({...settings, systemName: e.target.value})} 
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-xs uppercase outline-none focus:border-emerald-500 transition-all shadow-inner text-slate-900" 
                  placeholder="ENTER INSTITUTION NAME IN ENGLISH..."
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9.5px] font-black uppercase text-slate-500 ml-0.5 tracking-wider">
                  संस्थाको नाम (नेपाली / Institution Name NP)
                </label>
                <input 
                  type="text" 
                  value={settings.systemNameNp || ''} 
                  onChange={e => setSettings({...settings, systemNameNp: e.target.value})} 
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 font-bold text-xs outline-none focus:border-emerald-500 transition-all shadow-inner text-slate-900" 
                  placeholder="संस्थाको नाम नेपालीमा लेख्नुहोस्..."
                />
              </div>
            </div>

            {/* Headquarters Address (English & Nepali) */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9.5px] font-black uppercase text-slate-500 ml-0.5 tracking-wider">
                  Headquarters Address (English)
                </label>
                <input 
                  type="text" 
                  value={settings.address || ''} 
                  onChange={e => setSettings({...settings, address: e.target.value})} 
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 font-bold text-xs outline-none focus:border-emerald-500" 
                  placeholder="MUNICIPALITY, STREET, DISTRICT"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9.5px] font-black uppercase text-slate-500 ml-0.5 tracking-wider">
                  मुख्यालयको ठेगाना (नेपाली / Address NP)
                </label>
                <input 
                  type="text" 
                  value={settings.addressNp || ''} 
                  onChange={e => setSettings({...settings, addressNp: e.target.value})} 
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 font-bold text-xs outline-none focus:border-emerald-500" 
                  placeholder="उदा. पिपरा गाउँपालिका -६, रतौली, महोत्तरी"
                />
              </div>
            </div>

            {/* Registration, PAN, Email */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="space-y-1">
                <label className="text-[9.5px] font-black uppercase text-slate-500 ml-0.5 tracking-wider">
                  Registration No. (दर्ता नं.)
                </label>
                <input 
                  type="text" 
                  value={settings.registrationNo || ''} 
                  onChange={e => setSettings({...settings, registrationNo: e.target.value})} 
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 font-mono font-bold text-xs outline-none focus:border-emerald-500" 
                  placeholder="e.g. 421/054/055"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9.5px] font-black uppercase text-slate-500 ml-0.5 tracking-wider">
                  PAN No. (स्थायी लेखा नं.)
                </label>
                <input 
                  type="text" 
                  value={settings.panNo || ''} 
                  onChange={e => setSettings({...settings, panNo: e.target.value})} 
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 font-mono font-bold text-xs outline-none focus:border-emerald-500" 
                  placeholder="e.g. 302488825"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9.5px] font-black uppercase text-slate-500 ml-0.5 tracking-wider">
                  Official Email (इमेल)
                </label>
                <input 
                  type="email" 
                  value={settings.email || ''} 
                  onChange={e => setSettings({...settings, email: e.target.value})} 
                  className="w-full h-9 bg-slate-50 border border-slate-200 rounded-lg px-3 font-mono font-bold text-xs outline-none focus:border-emerald-500" 
                  placeholder="info@rataulisaccos.com"
                />
              </div>
            </div>

            {/* Currency Code & Support Contact Phone */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9.5px] font-black uppercase text-slate-500 ml-0.5 tracking-wider">
                  Currency Code
                </label>
                <input 
                  type="text" 
                  value={settings.currency} 
                  onChange={e => setSettings({...settings, currency: e.target.value})} 
                  className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-xs outline-none focus:border-emerald-500 uppercase" 
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9.5px] font-black uppercase text-slate-500 ml-0.5 tracking-wider">
                  Support Contact Phone
                </label>
                <input 
                  type="text" 
                  value={settings.phone || ''} 
                  onChange={e => setSettings({...settings, phone: e.target.value})} 
                  className="w-full h-8 bg-slate-50 border border-slate-200 rounded-lg px-3 font-black text-xs outline-none focus:border-emerald-500 font-mono" 
                  placeholder="+977-XXXXXXXXXX"
                />
              </div>
            </div>

            <div className="pt-2 border-t border-slate-100 flex items-center space-x-2 text-slate-400">
              <Globe size={12}/>
              <span className="text-[8px] uppercase tracking-wider font-bold">
                Changes saved here propagate immediately across all branches and user sessions (Global Sync)
              </span>
            </div>
          </div>
        </div>
      </div>
      </DayEndFieldset>

      {/* Floating Save Toast Notification */}
      {saved && (
        <div className="fixed bottom-6 right-6 bg-slate-900 text-white px-6 py-3.5 rounded-2xl shadow-2xl flex items-center space-x-3 animate-in slide-in-from-right-10 duration-500 border-l-4 border-emerald-500 z-[3000]">
          <CheckCircle2 className="text-emerald-400" size={22} />
          <div>
            <div className="text-[8px] font-black uppercase tracking-widest text-emerald-400">Settings Saved &amp; Applied</div>
            <div className="font-black text-xs uppercase tracking-wide">System and notification settings have been updated successfully</div>
          </div>
        </div>
      )}

    </div>
  );
};

export default SystemSettingsPage;
