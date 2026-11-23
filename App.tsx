import React, { useState, useEffect, useRef, useMemo } from 'react';
import { BrowserRouter, Routes, Route, NavLink, Navigate, useLocation, useNavigate } from 'react-router-dom';
import NepaliDate from 'nepali-date-converter';
import { 
  LayoutDashboard, Wallet, BookOpen, 
  X, History, ShieldCheck, TrendingUp, List, 
  Landmark as VaultIcon, Bell, PlusSquare, MessageSquare,
  ChevronRight, ChevronLeft, User as UserIcon,
  Users as HRLogo, Megaphone, Calculator as CalcIcon,
  Printer, Award, Building2, KeyRound, Lock, LogOut,
  Crown, ArrowRightLeft, Check, CheckCircle2, ChevronDown,
  Calendar, Clock, Sun, Moon, Globe, Coins, Receipt, TrendingDown, PiggyBank
} from 'lucide-react';

import { AuthProvider, useAuth } from './AuthContext';
import DailyCashEntry from './components/DailyCashEntry';
import DailyLedgerPage from './components/DailyLedgerPage';
import SummaryReport from './components/SummaryReport';
import ReportsPage from './components/ReportsPage';
import AdminCenter from './components/AdminCenter';
import { LoginPage } from './components/LoginPage';
import LedgerManagement from './components/LedgerManagement';
import IncomeExpensePage from './components/IncomeExpensePage';
import { OfficeExpenseManager } from './components/OfficeExpenseManager';
import SettlementPage from './components/SettlementPage';
import HRManagement from './components/HRManagement';
import { LoanInsuranceManagement } from './components/LoanInsuranceManagement';
import { MicroFinanceManagement } from './components/MicroFinanceManagement';
import { DepreciationManagement } from './components/DepreciationManagement';
import NoticeDownload from './components/NoticeDownload';
import { CalculatorPage } from './components/CalculatorPage';
import { RemitPage } from './components/RemitPage';
import { EMICalculator } from './components/EMICalculator';
import { FDCertificateModal } from './components/FDCertificateModal';
import { UserProfilePortal } from './components/UserProfilePortal';
import { ChangePasswordModal } from './components/ChangePasswordModal';
import { ForcedPasswordExpiryModal } from './components/ForcedPasswordExpiryModal';
import { ScreenLockModal } from './components/ScreenLockModal';
import { SwitchBranchModal } from './components/SwitchBranchModal';
import { DateConverterModal } from './components/DateConverterModal';
import { StaffChatDrawer } from './components/StaffChatDrawer';
import { TeamsNotificationToast, TeamsToastData } from './components/TeamsNotificationToast';
import { LoginPopupNoticeModal } from './components/LoginPopupNoticeModal';
import { PWAInstallButton } from './components/PWAInstallButton';
import { OfflineIndicator } from './components/OfflineIndicator';
import { Permission, PayrollRecord, Employee, Branch, PopupNotice, ChatMessage } from './types';
import { storageService } from './services/storageService';
import { loanInsuranceService } from './services/loanInsuranceService';
import { microFinanceService, getEffectiveSavingStatus } from './services/microFinanceService';
import { isBranchMatch } from './services/supabaseService';
import { isPasswordExpired } from './utils/passwordPolicy';
import { getUserChatProfile, isMessageFromMe, isMessageForMe, playChatNotificationSound, triggerBrowserNotification } from './utils/chatHelpers';
import { isDayEndedForBranch, canPerformDayOpen, normalizeLockBranchId } from './utils/dayEndLock';
import { getTodayBsDateStr, toNormalizedBsDateStr } from './utils/backDateControl';
import { resolveCanonicalBranchKey, scopeMicroFinanceData } from './utils/mfBranchFilter';

// Individual Slip Print View for Profile Link
const InternalSalarySlipPrintView = ({ slip, employee, onClose }: { slip: PayrollRecord, employee: any, onClose: () => void }) => {
  const { settings } = useAuth();
  const f2 = (n: number) => (n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  const totalContrib = (slip.ssfEmployer || 0) + (slip.pfEmployer || 0) + (slip.gratuity || 0);

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xl z-[7000] flex items-center justify-center p-4 overflow-y-auto print:static print:bg-white print:p-0">
      <div className="bg-white w-full max-w-3xl rounded-[2rem] shadow-2xl relative animate-in zoom-in-95 duration-200 my-auto print:shadow-none print:border-none print:rounded-none">
        <div className="p-4 border-b flex justify-between items-center no-print sticky top-0 bg-white z-20 rounded-t-[2rem]">
          <div className="flex items-center space-x-3">
             <button onClick={() => window.print()} className="flex items-center space-x-2 bg-emerald-800 text-white px-5 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest hover:bg-emerald-700 transition-all italic"><Printer size={14}/><span>Print Slip</span></button>
          </div>
          <button onClick={onClose} className="p-2 bg-slate-100 rounded-full hover:bg-rose-50 text-slate-500 hover:text-rose-600 transition-all"><X size={20}/></button>
        </div>
        
        <div className="p-8 text-black font-sans text-xs leading-relaxed">
           {/* Header with Non-overlapping Flex Layout */}
           <div className="mb-6 border-b-2 border-black pb-4">
            <div className="flex items-center justify-between gap-4">
              <div className="w-20 h-20 shrink-0 flex items-center justify-center">
                 {settings?.logoUrl ? (
                   <img src={settings.logoUrl} className="w-full h-full object-contain" alt="Institution Logo" />
                 ) : (
                   <div className="w-16 h-16 bg-emerald-100 rounded-full border-2 border-black flex items-center justify-center text-black font-extrabold text-[10px] text-center p-1">Logo</div>
                 )}
              </div>
              <div className="flex-1 text-center flex flex-col items-center justify-center">
                <h1 className="text-2xl font-black text-black tracking-tight leading-snug mb-0.5">रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड</h1>
                <p className="text-sm font-black text-black leading-normal">पिपरा गाउँपालिका-६, महोत्तरी</p>
                <div className="mt-2 text-center">
                  <p className="text-sm font-black text-black leading-snug">
                    आ.व. {slip.year} {slip.month ? `(${slip.month} महिना) ` : ''}तलव भुक्तानी विवरण
                  </p>
                </div>
              </div>
              <div className="w-20 shrink-0" />
            </div>
          </div>

          {/* Employee Info Section (Without Border Box) */}
          <div className="mb-5 grid grid-cols-2 gap-x-6 gap-y-2 py-2.5 border-b-2 border-black text-xs font-black text-black">
            <div><span className="text-black font-bold">कर्मचारीको नाम:</span> <span className="uppercase text-black font-black">{employee?.fullName || '-'}</span></div>
            <div><span className="text-black font-bold">पद:</span> <span className="uppercase text-black font-black">{employee?.designation || '-'}</span></div>
            <div><span className="text-black font-bold">PAN नं:</span> <span className="font-mono text-black font-black">{employee?.panNo || '-'}</span></div>
            <div><span className="text-black font-bold">ईमेल:</span> <span className="text-black font-black">{employee?.email || '-'}</span></div>
          </div>

          {/* Salary Table */}
          <table className="w-full border-collapse border-2 border-black text-left mb-6 font-bold text-xs text-black">
            <thead>
              <tr className="bg-emerald-900 text-white border-b-2 border-black">
                <th className="border-r-2 border-black p-2.5 w-14 text-center font-bold">क.स.</th>
                <th className="border-r-2 border-black p-2.5 pl-4 font-bold">विवरण</th>
                <th className="p-2.5 pr-4 text-right w-40 font-bold">रकम रु.</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-black">
                <td className="border-r border-black p-2 text-center text-black font-bold">१</td>
                <td className="border-r border-black p-2 pl-4 text-black font-bold">तलव स्केल (Basic Scale)</td>
                <td className="p-2 pr-4 text-right font-black text-black">{f2(slip.basicSalary)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="border-r border-black p-2 text-center text-black font-bold">२</td>
                <td className="border-r border-black p-2 pl-4 text-black font-bold">महंगी भत्ता</td>
                <td className="p-2 pr-4 text-right font-black text-black">{f2(slip.allowance)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="border-r border-black p-2 text-center text-black font-bold">३</td>
                <td className="border-r border-black p-2 pl-4 text-black font-bold">ग्रेड खर्च</td>
                <td className="p-2 pr-4 text-right font-black text-black">{f2(slip.gradeAmt)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="border-r border-black p-2 text-center text-black font-bold">४</td>
                <td className="border-r border-black p-2 pl-4 text-black font-bold">सामाजिक सुरक्षा कोष (SSF 20%)</td>
                <td className="p-2 pr-4 text-right font-black text-black">{f2(slip.ssfEmployee)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="border-r border-black p-2 text-center text-black font-bold">५</td>
                <td className="border-r border-black p-2 pl-4 text-black font-bold">संचय कोष (PF 10%)</td>
                <td className="p-2 pr-4 text-right font-black text-black">{f2(slip.pfEmployee)}</td>
              </tr>
              <tr className="border-b border-black">
                <td className="border-r border-black p-2 text-center text-black font-bold">६</td>
                <td className="border-r border-black p-2 pl-4 text-black font-bold">उपदान कोष (Gratuity)</td>
                <td className="p-2 pr-4 text-right font-black text-black">{f2(slip.gratuity)}</td>
              </tr>
              <tr className="border-b-2 border-black bg-slate-100 font-black text-black">
                <td colSpan={2} className="border-r-2 border-black p-2.5 pl-4 text-left">जम्मा भुक्तानी/आम्दानी (Gross Income)</td>
                <td className="p-2.5 pr-4 text-right text-sm font-black">{f2(slip.totalIncome)}</td>
              </tr>
              
              <tr className="bg-slate-200 border-b-2 border-black font-black text-black">
                <td colSpan={3} className="p-2 pl-4 text-left text-[11px] uppercase tracking-wide">सबै कोषमा योगदान रकम (Employer Contributions)</td>
              </tr>
              <tr className="border-b border-black text-black">
                <td className="border-r border-black p-2 text-center text-black font-bold">१.१</td>
                <td className="border-r border-black p-2 pl-4 font-bold">सामाजिक सुरक्षा कोष (३१%)</td>
                <td className="p-2 pr-4 text-right font-black text-black">{f2(slip.ssfEmployer)}</td>
              </tr>
              <tr className="border-b border-black text-black">
                <td className="border-r border-black p-2 text-center text-black font-bold">१.२</td>
                <td className="border-r border-black p-2 pl-4 font-bold">संचय कोष (२०%)</td>
                <td className="p-2 pr-4 text-right font-black text-black">{f2(slip.pfEmployer)}</td>
              </tr>
              <tr className="border-b border-black text-black">
                <td className="border-r border-black p-2 text-center text-black font-bold">१.३</td>
                <td className="border-r border-black p-2 pl-4 font-bold">उपदान कोष (८.३३%)</td>
                <td className="p-2 pr-4 text-right font-black text-black">{f2(slip.gratuity)}</td>
              </tr>
              
              <tr className="border-b-2 border-black font-black bg-slate-50">
                <td colSpan={2} className="border-r-2 border-black p-2 pl-4 text-black">जम्मा योगदान रकम</td>
                <td className="p-2 pr-4 text-right text-black font-black">{f2(totalContrib)}</td>
              </tr>
              <tr className="border-b-2 border-black font-black text-black bg-rose-50/60">
                <td colSpan={2} className="border-r-2 border-black p-2 pl-4">घटाएको : पारिश्रमिक कर (TDS Tax)</td>
                <td className="p-2 pr-4 text-right font-black">{f2(slip.tax)}</td>
              </tr>
              <tr className="font-black bg-emerald-50 text-black border-2 border-black">
                <td colSpan={2} className="border-r-2 border-black p-2.5 pl-4 text-sm uppercase tracking-tight">शुद्ध भुक्तानी तलव (NET PAYABLE SALARY)</td>
                <td className="p-2.5 pr-4 text-right text-base font-black text-black">{f2(slip.netSalary)}</td>
              </tr>
            </tbody>
          </table>

          {/* Signatures & System Generated Notice */}
          <div className="mt-10 space-y-5 italic font-bold">
            <div className="flex justify-center">
              <div className="flex flex-col items-center">
                <div className="border-b-2 border-black w-56 mb-2 flex flex-col items-center pb-1">
                  <span className="text-black font-normal text-xs not-italic">...................................................</span>
                </div>
                <p className="text-xs uppercase font-black text-black">तयार पार्ने</p>
              </div>
            </div>

            <div className="pt-3 border-t-2 border-black text-center not-italic">
              <p className="text-[11px] font-black text-black bg-emerald-50/90 border-2 border-emerald-800 rounded-xl px-4 py-2 inline-block shadow-sm">
                द्रष्टव्य: यो कम्प्युटर प्रणालीबाट स्वतः तयार पारिएको (System Generated) तलब भुक्तानी विवरण (E-Pay Slip) हो।
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

const ProtectedRoute: React.FC<{ permission?: Permission; children: React.ReactNode }> = ({ permission, children }) => {
  const { hasPermission, user } = useAuth();
  const location = useLocation();

  // Special allowance: All authenticated branch staff can view Admin Center product schemes
  const isProductRoute = 
    location.pathname.startsWith('/admin/products') || 
    location.pathname.startsWith('/admin/saving-products') || 
    location.pathname.startsWith('/admin/loan-products');

  if (permission && !hasPermission(permission) && !(isProductRoute && user)) {
    const getTargetRoute = () => {
      if (hasPermission('view_reports')) return { path: '/dashboard', name: 'Dashboard' };
      if (hasPermission('view_cash_entry')) return { path: '/entry', name: 'Front Teller' };
      if (hasPermission('view_daily_ledger')) return { path: '/transaction', name: 'Teller Ledger' };
      if (hasPermission('view_income_expense')) return { path: '/income-expense', name: 'Income/Exp' };
      if (hasPermission('view_office_expenses')) return { path: '/office-expense', name: 'Office Expenses' };
      if (hasPermission('view_ledger_names')) return { path: '/ledger', name: 'Ledger Master' };
      if (hasPermission('manage_notices')) return { path: '/notice-download', name: 'Notice/Download' };
      if (hasPermission('manage_hr')) return { path: '/hr', name: 'HR Management' };
      if (hasPermission('view_insurance')) return { path: '/insurance', name: 'Insurance' };
      if (hasPermission('view_microfinance')) return { path: '/micro-finance', name: 'Micro-Finance' };
      if (hasPermission('view_depreciation')) return { path: '/depreciation', name: 'Depreciation' };
      if (hasPermission('sub_tool_calculator_view')) return { path: '/calculator', name: 'Calculator' };
      if (hasPermission('sub_tool_remit_view')) return { path: '/remit', name: 'Remit' };
      return { path: '/dashboard', name: 'Dashboard' };
    };

    const target = getTargetRoute();

    return (
      <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-3xl border border-rose-100 shadow-xl m-4 animate-in fade-in zoom-in-95 duration-200">
        <div className="w-16 h-16 bg-rose-50 text-rose-500 rounded-full flex items-center justify-center mb-4 shadow-inner">
          <ShieldCheck size={32} />
        </div>
        <h2 className="text-xl font-black text-slate-800 uppercase italic">अनुमति अस्वीकृत (Access Denied)</h2>
        <p className="text-sm font-bold text-slate-500 mt-2 max-w-md">
          तपाईंको खातामा यो मेनु/पेज प्रयोग गर्ने अनुमति छैन। अनुमति प्राप्त गर्न कृपया मुख्य एडमिनसँग सम्पर्क गर्नुहोस्।
        </p>
        <p className="text-xs text-slate-400 mt-1 font-mono">Permission Required: {permission}</p>
        
        <NavLink
          to={target.path}
          className="mt-6 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-black text-xs uppercase tracking-wider rounded-xl shadow-lg shadow-emerald-600/20 transition-all flex items-center space-x-2"
        >
          <span>Go to {target.name}</span>
        </NavLink>
      </div>
    );
  }
  return <>{children}</>;
};

const DefaultRedirect: React.FC = () => {
  const { hasPermission } = useAuth();
  if (hasPermission('view_reports')) return <Navigate to="/dashboard" replace />;
  if (hasPermission('view_cash_entry')) return <Navigate to="/entry" replace />;
  if (hasPermission('view_daily_ledger')) return <Navigate to="/transaction" replace />;
  if (hasPermission('view_income_expense')) return <Navigate to="/income-expense" replace />;
  if (hasPermission('view_office_expenses')) return <Navigate to="/office-expense" replace />;
  if (hasPermission('view_ledger_names')) return <Navigate to="/ledger" replace />;
  if (hasPermission('manage_notices')) return <Navigate to="/notice-download" replace />;
  if (hasPermission('manage_hr')) return <Navigate to="/hr" replace />;
  if (hasPermission('view_insurance')) return <Navigate to="/insurance" replace />;
  if (hasPermission('view_microfinance')) return <Navigate to="/micro-finance" replace />;
  if (hasPermission('view_depreciation')) return <Navigate to="/depreciation" replace />;
  if (hasPermission('sub_tool_calculator_view')) return <Navigate to="/calculator" replace />;
  if (hasPermission('sub_tool_remit_view')) return <Navigate to="/remit" replace />;
  return (
    <div className="flex flex-col items-center justify-center min-h-[60vh] p-8 text-center bg-white rounded-3xl border border-slate-200 shadow-sm m-4">
      <ShieldCheck size={32} className="text-slate-400 mb-3" />
      <h2 className="text-lg font-black text-slate-800">No Active Menu Permissions</h2>
      <p className="text-xs font-semibold text-slate-500 mt-1 max-w-md">
        Your role does not currently have any enabled modules. Please contact the administrator to assign permissions.
      </p>
    </div>
  );
};

const SidebarLink: React.FC<SidebarLinkProps> = ({ to, icon, label, permission, collapsed }) => {
  const { hasPermission } = useAuth();
  const location = useLocation();
  if (permission && !hasPermission(permission)) return null;

  const isCustomActive = location.pathname === to || (to !== '/' && location.pathname.startsWith(`${to}/`));

  return (
    <NavLink
      to={to}
      className={({ isActive }) => `
        flex items-center ${collapsed ? 'justify-center px-2 py-2' : 'space-x-3 px-3.5 py-2.5'} rounded-xl transition-all duration-150 group cursor-pointer
        ${(isActive || isCustomActive)
          ? 'bg-gradient-to-r from-emerald-600 to-teal-600 text-white font-bold shadow-md shadow-emerald-950/60' 
          : 'text-emerald-100/75 hover:text-white hover:bg-emerald-900/50 font-medium'}
      `}
      title={collapsed ? label : undefined}
    >
      <div className="shrink-0 transition-transform group-hover:scale-105 text-[17px]">{icon}</div>
      {!collapsed && <span className="text-[12.5px] tracking-tight whitespace-nowrap leading-tight">{label}</span>}
    </NavLink>
  );
};

const AppLayout: React.FC = () => {
  const navigate = useNavigate();
  const { user, branch, branches: authBranches, isSuperAdmin, switchBranch, settings, logout, login, refreshUser, hasPermission } = useAuth();
  const [isSidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const [isAlertsMenuOpen, setIsAlertsMenuOpen] = useState(false);
  const [isShortcutMenuOpen, setIsShortcutMenuOpen] = useState(false);
  const [isEmiOpen, setIsEmiOpen] = useState(false);
  const [isFDCertOpen, setIsFDCertOpen] = useState(false);
  const [isDateConverterOpen, setIsDateConverterOpen] = useState(false);
  const [isProfilePortalOpen, setIsProfilePortalOpen] = useState(false);
  const [profilePortalInitialTab, setProfilePortalInitialTab] = useState<'overview' | 'transactions' | 'attendance' | 'ledger' | 'payroll' | 'security'>('overview');
  const [isChangePasswordOpen, setIsChangePasswordOpen] = useState(false);
  const [isScreenLocked, setIsScreenLocked] = useState(false);
  const [isSwitchBranchModalOpen, setIsSwitchBranchModalOpen] = useState(false);
  const [isBranchDropdownOpen, setIsBranchDropdownOpen] = useState(false);
  const [switchSuccessToast, setSwitchSuccessToast] = useState<string | null>(null);
  const [dayEndBlockedToast, setDayEndBlockedToast] = useState<{ title: string; message: string } | null>(null);
  const [selectedSlip, setSelectedSlip] = useState<PayrollRecord | null>(null);
  const [bimaMaturityCount, setBimaMaturityCount] = useState(0);
  const [loanMaturityCount, setLoanMaturityCount] = useState(0);
  const [savingMaturityCount, setSavingMaturityCount] = useState(0);
  const [noticeCount, setNoticeCount] = useState(0);
  const [activeLoginPopup, setActiveLoginPopup] = useState<PopupNotice | null>(null);
  const dismissedPopupIdsRef = useRef<Set<string>>(new Set());
  const [isChatOpen, setIsChatOpen] = useState(false);
  const [unreadChatCount, setUnreadChatCount] = useState(0);
  const [branchStatuses, setBranchStatuses] = useState<Record<string, string>>({});

  // Fetch live branch operational statuses (LIVE, OPEN, END, HOLIDAY, CLOSING)
  useEffect(() => {
    let isMounted = true;
    let blockToastTimer: ReturnType<typeof setTimeout> | null = null;
    const fetchStatuses = async () => {
      try {
        const statuses = await storageService.getBranchOperationalStatuses();
        if (isMounted && statuses) {
          setBranchStatuses(statuses);
        }
      } catch (e) {
        console.warn("Could not load branch operational statuses in App:", e);
      }
    };

    const handleDayStatusChanged = () => {
      fetchStatuses();
    };

    const handleDayEndBlocked = (e: Event) => {
      const customEvt = e as CustomEvent<{ message?: string }>;
      const msg = customEvt?.detail?.message || 'Day Closed: End Day has been completed. No entries can be made until Day Open is activated.';
      setDayEndBlockedToast({ title: 'Entry Blocked', message: msg });
      if (blockToastTimer) clearTimeout(blockToastTimer);
      blockToastTimer = setTimeout(() => {
        if (isMounted) setDayEndBlockedToast(null);
      }, 4500);
    };

    let lastBsDate = getTodayBsDateStr();
    fetchStatuses();
    const interval = setInterval(() => {
      const currentBs = getTodayBsDateStr();
      if (currentBs !== lastBsDate) {
        lastBsDate = currentBs;
        try {
          const nepaliMonths = [
            'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
            'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
          ];
          const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
          const today = new NepaliDate();
          setNepaliToday(`${today.getYear()} - ${nepaliMonths[today.getMonth()] || 'Shrawan'} - ${today.getDate()}, ${dayNames[today.getDay()] || 'Sunday'}`);
        } catch {
          // ignore calendar label refresh error
        }
        window.dispatchEvent(new CustomEvent('branchDayStatusChanged', { detail: { dateBs: currentBs } }));
      }
      fetchStatuses();
    }, 30000); // 30s auto-refresh + calendar rollover check
    window.addEventListener('branchDayStatusChanged', handleDayStatusChanged);
    window.addEventListener('dayEndEntryBlocked', handleDayEndBlocked);
    window.addEventListener('storage', handleDayStatusChanged);
    return () => {
      isMounted = false;
      clearInterval(interval);
      if (blockToastTimer) clearTimeout(blockToastTimer);
      window.removeEventListener('branchDayStatusChanged', handleDayStatusChanged);
      window.removeEventListener('dayEndEntryBlocked', handleDayEndBlocked);
      window.removeEventListener('storage', handleDayStatusChanged);
    };
  }, []);

  // Check for active login popup announcements upon login / session start / page refresh
  useEffect(() => {
    if (!user?.id) return;

    // Clear legacy sessionStorage keys that prevented popups from showing on page refresh
    try {
      Object.keys(sessionStorage).forEach(k => {
        if (k.startsWith('saccos_login_popup_dismissed_')) {
          sessionStorage.removeItem(k);
        }
      });
    } catch {
      // Ignore sessionStorage access errors in restricted iframe
    }

    let isMounted = true;
    const checkActivePopup = async () => {
      try {
        // Fetch all popup notices and filter using robust branch matcher
        const popups = await storageService.getPopupNotices();
        if (!Array.isArray(popups) || !isMounted) return;

        let todayBs = '';
        try {
          todayBs = new NepaliDate().format('YYYY-MM-DD');
        } catch {
          todayBs = new Date().toISOString().slice(0, 10);
        }

        // Sort newest first by creation or update date
        const sorted = [...popups].sort((a, b) => {
          const timeA = Math.max(a.createdAt || 0, a.updatedAt || 0);
          const timeB = Math.max(b.createdAt || 0, b.updatedAt || 0);
          return timeB - timeA;
        });

        // Find active popup matching user's branch & not expired
        const active = sorted.find(p => {
          if (!p.isActive) return false;
          if (p.showOnLogin === false) return false;
          
          // Expiry check: if validUntil is configured and today is past expiry date, skip
          if (p.validUntil && p.validUntil.trim()) {
            const normValidUntil = p.validUntil.trim().replace(/\//g, '-');
            const normToday = todayBs.replace(/\//g, '-');
            if (normToday > normValidUntil) {
              return false;
            }
          }

          if (!p.targetBranchId || p.targetBranchId === 'all') return true;
          return isBranchMatch(p.targetBranchId, branch?.id || user?.branchId);
        });

        if (active && !dismissedPopupIdsRef.current.has(active.id)) {
          setActiveLoginPopup(active);
        }
      } catch (err) {
        console.warn("Failed to check login popup announcements:", err);
      }
    };

    checkActivePopup();

    const handlePopupUpdate = (e: any) => {
      // If a popup was updated or newly created, remove it from dismissed set so it displays immediately
      if (e?.detail?.id) {
        dismissedPopupIdsRef.current.delete(e.detail.id);
      } else {
        dismissedPopupIdsRef.current.clear();
      }
      checkActivePopup();
    };

    window.addEventListener('saccos_popup_notice_updated', handlePopupUpdate);
    return () => {
      isMounted = false;
      window.removeEventListener('saccos_popup_notice_updated', handlePopupUpdate);
    };
  }, [user?.id, branch?.id, user?.branchId]);

  const handleDismissLoginPopup = () => {
    if (activeLoginPopup) {
      dismissedPopupIdsRef.current.add(activeLoginPopup.id);
    }
    setActiveLoginPopup(null);
  };
  
  const userMenuRef = useRef<HTMLDivElement>(null);
  const alertsRef = useRef<HTMLDivElement>(null);
  const shortcutRef = useRef<HTMLDivElement>(null);
  const [nepaliToday, setNepaliToday] = useState('');
  const [linkedEmployee, setLinkedEmployee] = useState<Employee | null>(null);
  const [allBranches, setAllBranches] = useState<Branch[]>([]);
  const [employeesList, setEmployeesList] = useState<Employee[]>([]);
  const [usersList, setUsersList] = useState<User[]>([]);
  const [chatTargetToOpen, setChatTargetToOpen] = useState<any>(null);
  const [appIncomingToast, setAppIncomingToast] = useState<TeamsToastData | null>(null);

  // Keep employees and users in sync for chat profile resolution
  useEffect(() => {
    storageService.getEmployees().then(list => {
      if (list) setEmployeesList(list);
    }).catch(() => {});

    storageService.getUsers().then(list => {
      if (list) setUsersList(list);
    }).catch(() => {});
  }, []);

  const appUserProfile = useMemo(() => {
    return getUserChatProfile(user, employeesList, usersList);
  }, [user, employeesList, usersList]);

  // Track known message IDs and toasted IDs to accurately notify incoming messages
  const knownChatMsgIdsRef = useRef<Set<string>>(new Set());
  const toastedChatMsgIdsRef = useRef<Set<string>>(new Set());
  const prevUserIdRef = useRef<string | null>(null);
  const isChatInitializedRef = useRef<boolean>(false);

  // Helper to trigger Teams-style toast notification in bottom right
  const triggerTeamsToastForMessage = (msg: ChatMessage) => {
    let targetToOpen: Record<string, unknown> | null = null;
    if (msg.channelId) {
      targetToOpen = {
        id: msg.channelId,
        name: msg.channelId === 'general' ? 'All Staff Notice' : 'Staff Channel',
        type: 'channel'
      };
    } else {
      const foundEmp = employeesList.find(e => String(e.id) === msg.senderId || (e.fullName && e.fullName.toLowerCase() === (msg.senderName || '').toLowerCase()));
      const foundUser = usersList.find(u => String(u.id) === msg.senderId || (u.username && u.username.toLowerCase() === (msg.senderUsername || '').toLowerCase()) || (u.fullName && u.fullName.toLowerCase() === (msg.senderName || '').toLowerCase()));
      targetToOpen = {
        id: msg.senderId,
        name: msg.senderName,
        type: 'direct',
        subtitle: msg.senderDesignation || foundEmp?.designation || foundUser?.designation || 'Staff Member',
        photo: msg.senderPhoto || foundUser?.profilePhoto,
        branchName: msg.senderBranchName
      };
    }

    setAppIncomingToast({
      id: msg.id,
      senderId: msg.senderId,
      senderName: msg.senderName,
      senderPhoto: msg.senderPhoto,
      senderDesignation: msg.senderDesignation,
      senderBranchName: msg.senderBranchName,
      content: msg.content || (msg.attachments?.length ? '📷 Sent an attachment' : 'New message'),
      channelId: msg.channelId,
      channelName: msg.channelId ? (msg.channelId === 'general' ? 'All Staff Notice' : 'Staff Channel') : undefined,
      createdAt: msg.createdAt || Date.now(),
      target: targetToOpen
    });
  };

  // Check for unread chat messages and trigger notification on login or newly arrived messages
  const checkUnreadChat = async () => {
    if (!user?.id) {
      setUnreadChatCount(0);
      return;
    }
    try {
      const msgs = await storageService.getChatMessages();
      if (!msgs || !Array.isArray(msgs)) return;

      // Filter unread messages specifically addressed to this logged-in user
      const unreadForMe = msgs.filter(m => {
        if (isMessageFromMe(m, appUserProfile.identifiers, appUserProfile.names)) return false;
        if (!isMessageForMe(m, appUserProfile.identifiers, appUserProfile.names, user.branchId, appUserProfile.isSuperAdmin)) return false;
        const readBy = Array.isArray(m.readBy) ? m.readBy : [];
        return !Array.from(appUserProfile.identifiers).some(id => readBy.includes(id));
      });

      setUnreadChatCount(unreadForMe.length);

      if (!isChatInitializedRef.current) {
        // Initial check right after login
        msgs.forEach(m => knownChatMsgIdsRef.current.add(m.id));
        isChatInitializedRef.current = true;

        // If the logged in user has unread messages, show notification immediately after login!
        if (unreadForMe.length > 0 && !isChatOpen) {
          const latest = unreadForMe[unreadForMe.length - 1];
          toastedChatMsgIdsRef.current.add(latest.id);
          playChatNotificationSound();
          triggerBrowserNotification(
            latest.channelId ? `New message in Channel` : `Message from ${latest.senderName}`,
            {
              body: latest.content || (latest.attachments?.length ? 'Shared an attachment' : 'Sent you a message'),
              icon: latest.senderPhoto,
              tag: `saccos_msg_${latest.id}`
            }
          );
          triggerTeamsToastForMessage(latest);
        }
      } else {
        // Subsequent checks while user is already logged in
        const newlyArrived = msgs.filter(m => !knownChatMsgIdsRef.current.has(m.id));
        newlyArrived.forEach(m => knownChatMsgIdsRef.current.add(m.id));

        const incomingForMe = newlyArrived.filter(m =>
          !isMessageFromMe(m, appUserProfile.identifiers, appUserProfile.names) &&
          isMessageForMe(m, appUserProfile.identifiers, appUserProfile.names, user.branchId, appUserProfile.isSuperAdmin)
        );

        if (incomingForMe.length > 0 && !isChatOpen) {
          const latest = incomingForMe[incomingForMe.length - 1];
          if (!toastedChatMsgIdsRef.current.has(latest.id)) {
            toastedChatMsgIdsRef.current.add(latest.id);
            playChatNotificationSound();
            triggerBrowserNotification(
              latest.channelId ? `New message in Channel` : `Message from ${latest.senderName}`,
              {
                body: latest.content || (latest.attachments?.length ? 'Shared an attachment' : 'Sent you a message'),
                icon: latest.senderPhoto,
                tag: `saccos_msg_${latest.id}`
              }
            );
            triggerTeamsToastForMessage(latest);
          }
        }
      }
    } catch (error) {
      console.warn("Failed to check chat messages", error);
    }
  };

  // Reset notification tracking when user switches or signs in/out
  useEffect(() => {
    if (user?.id) {
      const currentUid = String(user.id);
      if (prevUserIdRef.current !== currentUid) {
        prevUserIdRef.current = currentUid;
        knownChatMsgIdsRef.current.clear();
        toastedChatMsgIdsRef.current.clear();
        isChatInitializedRef.current = false;
        // Check unread shortly after login transition to trigger notification toast
        const timer = setTimeout(() => {
          checkUnreadChat();
        }, 500);
        return () => clearTimeout(timer);
      }
    } else {
      prevUserIdRef.current = null;
      knownChatMsgIdsRef.current.clear();
      toastedChatMsgIdsRef.current.clear();
      isChatInitializedRef.current = false;
      setAppIncomingToast(null);
      setUnreadChatCount(0);
    }
  }, [user?.id]);

  useEffect(() => {
    checkUnreadChat();
    const interval = setInterval(checkUnreadChat, 2500);
    
    const handleMsgEvt = (e: { detail?: ChatMessage } | Event) => {
      checkUnreadChat();
      const newMsg = (e as { detail?: ChatMessage })?.detail;
      if (newMsg && newMsg.id) {
        if (!knownChatMsgIdsRef.current.has(newMsg.id)) {
          knownChatMsgIdsRef.current.add(newMsg.id);
          // If chat drawer is not currently open, notify user if message is for them
          if (!isChatOpen && !isMessageFromMe(newMsg, appUserProfile.identifiers, appUserProfile.names)) {
            if (isMessageForMe(newMsg, appUserProfile.identifiers, appUserProfile.names, user?.branchId, appUserProfile.isSuperAdmin)) {
              if (!toastedChatMsgIdsRef.current.has(newMsg.id)) {
                toastedChatMsgIdsRef.current.add(newMsg.id);
                playChatNotificationSound();
                triggerBrowserNotification(
                  newMsg.channelId ? `New message in Channel` : `Message from ${newMsg.senderName}`,
                  {
                    body: newMsg.content || (newMsg.attachments?.length ? 'Shared an attachment' : 'Sent you a message'),
                    icon: newMsg.senderPhoto,
                    tag: `saccos_msg_${newMsg.id}`
                  }
                );
                triggerTeamsToastForMessage(newMsg);
              }
            }
          }
        }
      }
    };

    const handleReadEvt = () => checkUnreadChat();

    let bc: BroadcastChannel | null = null;
    try {
      if (typeof window !== 'undefined' && 'BroadcastChannel' in window) {
        bc = new BroadcastChannel('saccos_chat_broadcast');
        bc.onmessage = (event) => {
          if (event.data?.type === 'saccos_chat_message') {
            handleMsgEvt({ detail: event.data.detail });
          } else if (event.data?.type === 'saccos_chat_read' || event.data?.type === 'saccos_chat_delete') {
            checkUnreadChat();
          }
        };
      }
    } catch (e) {
      // Ignore broadcast errors
    }

    window.addEventListener('saccos_chat_message', handleMsgEvt);
    window.addEventListener('saccos_chat_delete', handleMsgEvt);
    window.addEventListener('saccos_chat_read', handleReadEvt);
    window.addEventListener('storage', handleMsgEvt);

    return () => {
      clearInterval(interval);
      window.removeEventListener('saccos_chat_message', handleMsgEvt);
      window.removeEventListener('saccos_chat_delete', handleMsgEvt);
      window.removeEventListener('saccos_chat_read', handleReadEvt);
      window.removeEventListener('storage', handleMsgEvt);
      if (bc) bc.close();
    };
  }, [user?.id, appUserProfile, isChatOpen]);

  const handleSendToastInlineReply = async (text: string) => {
    if (!appIncomingToast || !user) return;
    const toast = appIncomingToast;
    const branchName = branch?.name || (user.branchId === 'main' ? 'Head Office' : user.branchId);
    const replyMsg: ChatMessage = {
      id: `msg_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`,
      channelId: toast.channelId,
      recipientId: toast.channelId ? undefined : toast.senderId,
      recipientName: toast.channelId ? undefined : toast.senderName,
      senderId: String(user.id),
      senderName: user.fullName || user.username,
      senderUsername: user.username,
      senderDesignation: linkedEmployee?.designation || user.designation || 'Staff Member',
      senderBranchId: user.branchId,
      senderBranchName: branchName,
      content: text.trim(),
      createdAt: Date.now(),
      readBy: [String(user.id)]
    };

    try {
      await storageService.sendChatMessage(replyMsg);
      if (toast.id) {
        await storageService.markChatRead([toast.id], String(user.id));
      }
    } catch (e) {
      console.warn('Failed to send inline reply from toast:', e);
    }
    setAppIncomingToast(null);
    checkUnreadChat();
  };

  const handleOpenToastChat = () => {
    if (appIncomingToast?.target) {
      setChatTargetToOpen(appIncomingToast.target);
    }
    setIsChatOpen(true);
    setAppIncomingToast(null);
  };

  useEffect(() => {
    const fetchBranches = async () => {
      try {
        const list = await storageService.getBranches();
        setAllBranches(list || []);
      } catch (err) {
        console.error("Failed to fetch branches", err);
      }
    };
    fetchBranches();
  }, []);

  const combinedBranches = useMemo(() => {
    const defaultBranches: Branch[] = [
      { id: 'main', name: 'Ratauli Head Office', code: 'C01', location: 'Ratauli', status: 'Active', createdAt: 1700000000000 },
      { id: 'sahodba', name: 'Sahodba Branch', code: 'C02', location: 'Sahodba', status: 'Active', createdAt: 1700000000001 },
      { id: 'pipra', name: 'Pipra Branch', code: 'C03', location: 'Pipra', status: 'Active', createdAt: 1700000000002 },
      { id: 'parsa', name: 'Parsa Branch', code: 'C04', location: 'Parsa', status: 'Active', createdAt: 1700000000003 },
    ];
    const map = new Map<string, Branch>();
    defaultBranches.forEach(b => map.set(b.id.toLowerCase(), b));
    (allBranches || []).forEach(b => map.set(b.id.toLowerCase(), b));
    (authBranches || []).forEach(b => map.set(b.id.toLowerCase(), b));
    return Array.from(map.values());
  }, [allBranches, authBranches]);

  useEffect(() => {
    const nepaliMonths = [
      'Baisakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin',
      'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
    ];
    const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

    try {
      const today = new NepaliDate();
      const year = today.getYear();
      const monthName = nepaliMonths[today.getMonth()] || 'Shrawan';
      const day = today.getDate();
      const dayName = dayNames[today.getDay()] || 'Sunday';
      setNepaliToday(`${year} - ${monthName} - ${day}, ${dayName}`);
    } catch (e) {
      setNepaliToday('2083 - Shrawan - 31, Sunday');
    }
    
    // Check 1-day alerts: Bima Maturity, Loan Maturity, and Active Notices matching today
    const checkDailyAlerts = async () => {
      const todayBs = getTodayBsDateStr();
      const now = new Date();
      const todayLocalStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
      const todayLocalEnd = todayLocalStart + 24 * 60 * 60 * 1000;

      const isDateToday = (dateStr?: string | null): boolean => {
        if (!dateStr || !String(dateStr).trim()) return false;
        const raw = String(dateStr).trim().split('T')[0];
        if (!raw) return false;
        return toNormalizedBsDateStr(raw) === todayBs;
      };

      const isCreatedToday = (ts?: number): boolean => {
        if (!ts || !Number.isFinite(ts)) return false;
        return ts >= todayLocalStart && ts < todayLocalEnd;
      };

      try {
        const insRecords = loanInsuranceService.getRecords();
        const bimaToday = insRecords.filter(r => {
          const st = (r.status || '').toLowerCase();
          if (['closed', 'rejected', 'settled', 'deactivated', 'claimed'].includes(st)) return false;
          return (
            isDateToday(r.policyExpiryDate || r.maturity_date) ||
            isDateToday(r.policyExpiryDateBs) ||
            isDateToday(r.insuranceTillDate) ||
            isDateToday(r.insuranceTillDateBs)
          );
        });
        setBimaMaturityCount(bimaToday.length);
      } catch (error) {
        console.error("Failed to check Bima maturity alerts", error);
      }

      try {
        const targetBranchKey = isSuperAdmin
          ? ''
          : resolveCanonicalBranchKey(branch?.id || branch?.name || user?.branchId, combinedBranches);

        let centersRaw = microFinanceService.getCenters();
        let groupsRaw = microFinanceService.getGroups();
        let membersRaw = microFinanceService.getMembers();
        let loansRaw: Awaited<ReturnType<typeof microFinanceService.fetchActiveLoansFromSupabase>>;
        let savingsRaw: Awaited<ReturnType<typeof microFinanceService.fetchSavingsFromSupabase>>;

        if (targetBranchKey && (centersRaw.length === 0 || membersRaw.length === 0)) {
          const allMf = await microFinanceService.fetchAllFromSupabase().catch(() => null);
          if (allMf) {
            centersRaw = allMf.centers;
            groupsRaw = allMf.groups;
            membersRaw = allMf.members;
            loansRaw = allMf.loans;
            savingsRaw = allMf.savings;
          } else {
            [loansRaw, savingsRaw] = await Promise.all([
              microFinanceService.fetchActiveLoansFromSupabase().catch(() => microFinanceService.getLoans()),
              microFinanceService.fetchSavingsFromSupabase().catch(() => microFinanceService.getSavings())
            ]);
          }
        } else {
          [loansRaw, savingsRaw] = await Promise.all([
            microFinanceService.fetchActiveLoansFromSupabase().catch(() => microFinanceService.getLoans()),
            microFinanceService.fetchSavingsFromSupabase().catch(() => microFinanceService.getSavings())
          ]);
        }

        const scopedMf = scopeMicroFinanceData({
          centers: centersRaw,
          groups: groupsRaw,
          members: membersRaw,
          savings: Array.isArray(savingsRaw) ? savingsRaw : [],
          loans: Array.isArray(loansRaw) ? loansRaw : [],
          targetBranchKey,
          branches: combinedBranches
        });

        const loanToday = scopedMf.loans.filter(l => {
          if (l.status === 'CLOSED') return false;
          return isDateToday(l.maturityDate);
        });
        setLoanMaturityCount(loanToday.length);

        const maturedSavings = scopedMf.savings.filter(
          s => getEffectiveSavingStatus(s) === 'MATURED'
        );
        setSavingMaturityCount(maturedSavings.length);
      } catch (error) {
        console.error("Failed to check Loan/Saving maturity alerts", error);
      }

      try {
        const notices = await storageService.getNotices(branch?.id);
        const todayNotices = Array.isArray(notices)
          ? notices.filter(n => n.status === 'Active' && (isDateToday(n.date) || isCreatedToday(n.createdAt)))
          : [];
        setNoticeCount(todayNotices.length);
      } catch (error) {
        console.error("Failed to check notices", error);
      }
    };

    checkDailyAlerts();
    const interval = setInterval(checkDailyAlerts, 30000);
    window.addEventListener('storage', checkDailyAlerts);
    window.addEventListener('focus', checkDailyAlerts);
    window.addEventListener('saccos_popup_notice_updated', checkDailyAlerts);
    window.addEventListener('mf_savings_updated', checkDailyAlerts);
    return () => {
      clearInterval(interval);
      window.removeEventListener('storage', checkDailyAlerts);
      window.removeEventListener('focus', checkDailyAlerts);
      window.removeEventListener('saccos_popup_notice_updated', checkDailyAlerts);
      window.removeEventListener('mf_savings_updated', checkDailyAlerts);
    };
  }, [branch, isSuperAdmin, user?.branchId, combinedBranches]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(event.target as Node)) {
        setIsUserMenuOpen(false);
      }
      if (alertsRef.current && !alertsRef.current.contains(event.target as Node)) {
        setIsAlertsMenuOpen(false);
      }
      if (shortcutRef.current && !shortcutRef.current.contains(event.target as Node)) {
        setIsShortcutMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  // Fetch actual HR employee linked to user for profile image/name & branch sync
  useEffect(() => {
    const fetchLinkedEmployee = async () => {
      if (!user) {
        setLinkedEmployee(null);
        return;
      }
      try {
        const employees = await storageService.getEmployees();
        const linked = employees.find(e => {
          const empName = (e.fullName || '').toLowerCase().trim();
          const userName = (user.fullName || '').toLowerCase().trim();
          const sameName = empName !== '' && empName === userName;
          
          const empEmail = (e.email || '').toLowerCase().trim();
          const userEmail = (user.email || '').toLowerCase().trim();
          const sameEmail = empEmail !== '' && userEmail !== '' && empEmail === userEmail;

          const empCode = (e.employeeCode || '').toLowerCase().trim();
          const username = (user.username || '').toLowerCase().trim();
          const sameCode = empCode !== '' && empCode === username;
          
          return sameName || sameEmail || sameCode;
        });
        setLinkedEmployee(linked || null);

        // If user branch is missing or default, but linked employee has a specific branch, auto-sync (ONLY for non-superadmin)
        if (!isSuperAdmin && linked && linked.branchId && (!user.branchId || user.branchId === 'main' || user.branchId !== linked.branchId)) {
          const updatedUser = { 
            ...user, 
            branchId: linked.branchId, 
            designation: linked.designation || user.designation,
            department: linked.department || user.department,
            profilePhoto: linked.photoUrl || user.profilePhoto 
          };
          login(updatedUser);
        }
      } catch (error) {
        console.error("Failed to fetch linked employee", error);
      }
    };
    fetchLinkedEmployee();
  }, [user?.id, user?.username, isSuperAdmin]);

  const currentBranchName = useMemo(() => {
    if (branch?.name) return branch.name.toUpperCase();
    const targetBranchId = (user?.branchId || '').trim();
    if (!targetBranchId || targetBranchId.toLowerCase() === 'main' || targetBranchId.toLowerCase() === 'head_office' || targetBranchId.toLowerCase() === 'c01') {
      return 'RATAULI HEAD OFFICE';
    }
    const lower = targetBranchId.toLowerCase();
    const found = combinedBranches.find(b => 
      b.id.toLowerCase() === lower ||
      b.code?.toLowerCase() === lower ||
      b.name.toLowerCase() === lower ||
      b.name.toLowerCase().includes(lower) ||
      lower.includes(b.id.toLowerCase())
    );
    if (found) return found.name.toUpperCase();
    if (lower === 'sahodba' || lower.includes('sahodba') || lower === 'c02') return 'SAHODBA BRANCH';
    if (lower === 'pipra' || lower.includes('pipra') || lower === 'c03') return 'PIPRA BRANCH';
    if (lower === 'parsa' || lower.includes('parsa') || lower === 'c04') return 'PARSA BRANCH';
    return targetBranchId.toUpperCase() + (targetBranchId.toLowerCase().includes('branch') ? '' : ' BRANCH');
  }, [branch, user?.branchId, combinedBranches]);

  const currentBranchId = useMemo(() => {
    if (branch?.id) return branch.id.toLowerCase();
    const uB = (user?.branchId || '').toLowerCase().trim();
    if (!uB || uB === 'main' || uB === 'c01' || uB === 'headoffice' || uB === 'head_office') return 'main';
    if (uB.includes('sahodba') || uB === 'c02') return 'sahodba';
    if (uB.includes('pipra') || uB === 'c03') return 'pipra';
    if (uB.includes('parsa') || uB === 'c04') return 'parsa';
    return uB;
  }, [branch?.id, user?.branchId]);

  useEffect(() => {
    try {
      localStorage.setItem('ZEN_ACTIVE_BRANCH_ID', currentBranchId);
    } catch {
      // Ignore storage write errors
    }
  }, [currentBranchId]);

  const currentStatus = branchStatuses[currentBranchId] || 'OPEN';
  const isCurrentBranchDayEnded = currentStatus === 'END' || currentStatus === 'CLOSED' || isDayEndedForBranch(currentBranchId);
  const [isDayStatusUpdating, setIsDayStatusUpdating] = useState(false);

  const dayOpenCheck = useMemo(() => {
    if (!isCurrentBranchDayEnded) {
      return { allowed: true as const };
    }
    return canPerformDayOpen({
      targetBranchId: currentBranchId,
      branches: combinedBranches,
      branchStatuses,
      settings
    });
  }, [isCurrentBranchDayEnded, currentBranchId, combinedBranches, branchStatuses, settings]);

  const handleToggleDayStatus = async () => {
    const isDayEnded = isCurrentBranchDayEnded;
    const newStatus = isDayEnded ? 'OPEN' : 'END';
    try {
      setIsDayStatusUpdating(true);

      let recordHeadOfficeCycle = false;
      if (isDayEnded) {
        const latestStatuses = await storageService.getBranchOperationalStatuses();
        setBranchStatuses(latestStatuses);
        const latestCheck = canPerformDayOpen({
          targetBranchId: currentBranchId,
          branches: combinedBranches,
          branchStatuses: latestStatuses,
          settings
        });
        if (!latestCheck.allowed) {
          setDayEndBlockedToast({
            title: 'Day Open Locked',
            message: latestCheck.reason || 'Head Office Open Day Pending'
          });
          setTimeout(() => setDayEndBlockedToast(null), 5000);
          setIsUserMenuOpen(false);
          return;
        }
        recordHeadOfficeCycle =
          normalizeLockBranchId(currentBranchId) === 'main' &&
          latestCheck.unlockedBy === 'head_office_cycle';
      }

      await storageService.setBranchOperationalStatus(
        currentBranchId,
        newStatus,
        `Day ${newStatus === 'END' ? 'Ended' : 'Opened'} via User Profile Menu by ${user?.fullName || 'User'}`,
        recordHeadOfficeCycle ? { recordHeadOfficeCycle: true } : undefined
      );
      setBranchStatuses(prev => ({ ...prev, [currentBranchId]: newStatus }));
      setSwitchSuccessToast(`Day marked as ${newStatus === 'END' ? 'END (Day Closed)' : 'OPEN (Day Active)'} for ${currentBranchName}!`);
      setTimeout(() => setSwitchSuccessToast(null), 3500);
      setIsUserMenuOpen(false);
    } catch (err) {
      console.error('Failed to update day status:', err);
    } finally {
      setIsDayStatusUpdating(false);
    }
  };

  const handleLogout = () => {
    navigate('/');
    logout();
  };

  if (!user) {
    return (
      <>
        <LoginPage />
        <div className="fixed top-4 right-4 z-[9990] print:hidden">
          <PWAInstallButton variant="login" />
        </div>
      </>
    );
  }

  return (
    <div className="flex h-screen bg-slate-50 overflow-hidden text-slate-900">
      <aside className={`
        ${isSidebarCollapsed ? 'w-16' : 'w-56'} 
        bg-[#0d2a1d] border-r border-[#153e2b] transition-all duration-300 flex flex-col 
        relative z-[50] print:hidden shadow-lg
      `}>
        {/* Bracket 1: Clean White Logo Area matching Header & Larger Logo */}
        <div className="flex items-center justify-center border-b border-emerald-900/30 h-20 shrink-0 bg-white px-3 py-2">
          <NavLink
            to="/dashboard"
            title="Go to Dashboard"
            aria-label="Go to Dashboard"
            className="w-full h-full flex items-center justify-center cursor-pointer focus:outline-hidden focus-visible:ring-2 focus-visible:ring-emerald-600 rounded-lg"
          >
            <img 
              src={(settings?.logoUrl && !settings.logoUrl.includes('picsum.photos')) ? settings.logoUrl : '/system_logo.png'} 
              alt="Logo" 
              onError={(e) => {
                const target = e.currentTarget;
                if (!target.src.includes('system_logo.png')) {
                  target.src = '/system_logo.png';
                }
              }}
              className="h-16 max-h-[4.25rem] max-w-full object-contain filter drop-shadow-2xs transition-transform hover:scale-105" 
            />
          </NavLink>
        </div>

        {/* Bracket 3: Sidebar Navigation Menu */}
        <nav className="flex-1 px-2.5 overflow-y-auto scrollbar-hide space-y-1.5 mt-2.5">
          <SidebarLink to="/dashboard" icon={<LayoutDashboard size={16} />} label="Dashboard" permission="view_reports" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/entry" icon={<Wallet size={16} />} label="Front Teller" permission="view_cash_entry" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/settlement" icon={<VaultIcon size={16} />} label="Vault Control" permission="view_cash_entry" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/transaction" icon={<BookOpen size={16} />} label="Teller Ledger" permission="view_daily_ledger" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/report" icon={<History size={16} />} label="Back Office" permission="view_reports" collapsed={isSidebarCollapsed} />
          
          <div className="h-px bg-emerald-900/60 my-2 mx-1.5" />
          
          <SidebarLink to="/income-expense" icon={<TrendingUp size={16} />} label="Income/Exp" permission="view_income_expense" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/office-expense" icon={<Building2 size={16} />} label="Office Expenses" permission="view_office_expenses" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/ledger" icon={<List size={16} />} label="Ledger Master" permission="view_ledger_names" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/notice-download" icon={<Megaphone size={16} />} label="Notice/Download" permission="manage_notices" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/hr" icon={<HRLogo size={16} />} label="HR Management" permission="manage_hr" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/insurance" icon={<ShieldCheck size={16} />} label="Insurance" permission="view_insurance" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/micro-finance" icon={<Coins size={16} />} label="Micro-Finance" permission="view_microfinance" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/depreciation" icon={<TrendingDown size={16} />} label="Depreciation" permission="view_depreciation" collapsed={isSidebarCollapsed} />
          <SidebarLink to="/admin" icon={<ShieldCheck size={16} />} label="Admin Center" permission="manage_users" collapsed={isSidebarCollapsed} />
        </nav>

        {/* Bracket 4: Below Menu Bar - Single Unified Date & Branch Card */}
        <div className="p-2 border-t border-emerald-900/60 bg-[#081d14] shrink-0">
          {!isSidebarCollapsed ? (
            <div className="space-y-1.5">
              {/* Single Unified Card for Date & Branch */}
              <div className="p-2 bg-[#0e2d1f] border border-emerald-800/50 rounded-xl space-y-1.5 shadow-2xs">
                <div className="flex items-center space-x-2 text-emerald-400">
                  <div className="w-5 h-5 rounded-md bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-400 shrink-0">
                    <Building2 size={11} />
                  </div>
                  <div className="min-w-0 flex-1 flex items-center justify-between gap-1">
                    <span className="text-[11px] font-bold text-emerald-200 uppercase tracking-tight truncate">
                      {currentBranchName}
                    </span>
                    {/* Office Status Pill on right side */}
                    <span 
                      title={`Office Status: ${currentStatus}`}
                      className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded-md text-[9px] font-black uppercase tracking-wider shrink-0 border ${
                        currentStatus === 'LIVE'
                          ? 'bg-emerald-500/25 text-emerald-300 border-emerald-500/50 shadow-xs'
                          : currentStatus === 'OPEN'
                          ? 'bg-emerald-500/20 text-emerald-300 border-emerald-500/35'
                          : currentStatus === 'END' || currentStatus === 'CLOSED'
                          ? 'bg-rose-500/25 text-rose-300 border-rose-500/50'
                          : currentStatus === 'HOLIDAY'
                          ? 'bg-indigo-500/25 text-indigo-300 border-indigo-500/50'
                          : 'bg-amber-500/25 text-amber-300 border-amber-500/50'
                      }`}
                    >
                      <span className={`w-1.5 h-1.5 rounded-full ${
                        currentStatus === 'LIVE'
                          ? 'bg-emerald-400 animate-pulse'
                          : currentStatus === 'OPEN'
                          ? 'bg-emerald-400'
                          : currentStatus === 'END' || currentStatus === 'CLOSED'
                          ? 'bg-rose-400'
                          : currentStatus === 'HOLIDAY'
                          ? 'bg-indigo-400'
                          : 'bg-amber-400'
                      }`}></span>
                      <span>{currentStatus}</span>
                    </span>
                  </div>
                </div>

                <div className="h-px bg-emerald-900/60" />

                <div className="flex items-center space-x-2 text-emerald-100/80">
                  <div className="w-5 h-5 rounded-md bg-emerald-950 border border-emerald-700/60 flex items-center justify-center text-emerald-300 shrink-0">
                    <Calendar size={11} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <span className="text-[10px] font-medium text-emerald-100/90 tracking-tight leading-tight block truncate">
                      {nepaliToday}
                    </span>
                  </div>
                </div>
              </div>

              {/* Sidebar Collapse Toggle Button */}
              <button 
                onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
                className="w-full flex items-center justify-center p-1 text-emerald-300/70 hover:text-white hover:bg-emerald-900/50 rounded-lg transition-all border border-emerald-900/60 cursor-pointer text-[10px] font-bold"
                title="Collapse Sidebar"
              >
                <ChevronLeft size={14} />
              </button>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-1.5">
              <div 
                className="p-1.5 bg-[#0e2d1f] text-emerald-200 rounded-xl border border-emerald-800/50 shadow-2xs cursor-pointer flex flex-col items-center gap-1"
                title={`${currentBranchName} (${currentStatus}) | ${nepaliToday}`}
              >
                <div className="relative">
                  <Building2 size={13} className="text-emerald-400" />
                  <span className={`absolute -top-1 -right-1 w-2 h-2 rounded-full ring-1 ring-emerald-950 ${
                    currentStatus === 'LIVE'
                      ? 'bg-emerald-400 animate-pulse'
                      : currentStatus === 'OPEN'
                      ? 'bg-emerald-400'
                      : currentStatus === 'END' || currentStatus === 'CLOSED'
                      ? 'bg-rose-400'
                      : currentStatus === 'HOLIDAY'
                      ? 'bg-indigo-400'
                      : 'bg-amber-400'
                  }`} />
                </div>
                <div className="w-2.5 h-px bg-emerald-900/60" />
                <Calendar size={11} className="text-emerald-300" />
              </div>
              <button 
                onClick={() => setSidebarCollapsed(!isSidebarCollapsed)}
                className="w-full flex items-center justify-center p-1 text-emerald-300/70 hover:text-white hover:bg-emerald-900/50 rounded-lg transition-all border border-emerald-900/60 cursor-pointer"
                title="Expand Sidebar"
              >
                <ChevronRight size={14} />
              </button>
            </div>
          )}
        </div>
      </aside>

      <main className="flex-1 flex flex-col overflow-hidden">
        {/* Bracket 2: Top Header Bar with Vibrant & Elegant Red Theme */}
        <header className="h-20 bg-gradient-to-r from-[#881337] via-[#9f1239] to-[#881337] border-b border-rose-950/20 px-6 md:px-8 flex items-center justify-between shrink-0 shadow-md relative z-[150] text-white select-none">
          
          {/* Left Area: Clean minimal spacer */}
          <div className="flex items-center space-x-3">
            {/* Clean spacious left layout */}
          </div>

          {/* Center Area: Elegant Cooperative Brand Title in Pure White */}
          <div className="flex flex-col items-center justify-center text-center">
            <h2 className="text-xl md:text-2xl font-black text-white italic uppercase tracking-wider drop-shadow-sm">
              {settings?.systemName || "RATAULI COOPERATIVE"}
            </h2>
          </div>

          {/* Right Area: Shortcuts & User Profile */}
          <div className="flex items-center space-x-3 md:space-x-4">
            {/* Quick Action Navigation Buttons */}
            <div className="flex items-center space-x-2 border-r border-white/20 pr-3 md:pr-4">
              {/* In-App PWA Install Button (auto-hides when installed) */}
              <PWAInstallButton variant="header" />
              {/* Alerts Dropdown Button (1-Day Period) */}
              {hasPermission('view_alerts') && (() => {
                const canSeeBima = hasPermission('sub_alert_bima_maturity_view');
                const canSeeLoan = hasPermission('sub_alert_loan_maturity_view');
                const canSeeSaving = hasPermission('sub_alert_saving_maturity_view') || hasPermission('sub_alert_loan_maturity_view');
                const canSeeNotice = hasPermission('sub_alert_notice_view');
                const totalDailyAlerts =
                  (canSeeBima ? bimaMaturityCount : 0) +
                  (canSeeLoan ? loanMaturityCount : 0) +
                  (canSeeSaving ? savingMaturityCount : 0) +
                  (canSeeNotice ? noticeCount : 0);
                return (
                  <div className="relative" ref={alertsRef}>
                    <button
                      type="button"
                      onClick={() => {
                        setIsAlertsMenuOpen(prev => !prev);
                        setIsShortcutMenuOpen(false);
                      }}
                      className={`px-3.5 py-1.5 border rounded-xl transition-all flex flex-col items-center relative cursor-pointer shadow-2xs backdrop-blur-xs ${
                        isAlertsMenuOpen
                          ? 'bg-white text-rose-900 border-white shadow-md font-bold'
                          : totalDailyAlerts > 0
                            ? 'bg-amber-500/25 hover:bg-amber-500/35 text-white border-2 border-amber-300/80 shadow-xs'
                            : 'bg-white/10 hover:bg-white/20 text-white border-white/25 hover:border-white/50'
                      }`}
                      title="Alerts & Maturity Notifications"
                    >
                      <div className="relative">
                        <Bell size={17} className={isAlertsMenuOpen ? 'text-rose-900' : 'text-amber-200'} />
                        {totalDailyAlerts > 0 && (
                          <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] bg-amber-500 text-slate-950 rounded-full border-2 border-white text-[8px] font-black flex items-center justify-center px-0.5 shadow-md tabular-nums">
                            {totalDailyAlerts > 99 ? '99+' : totalDailyAlerts}
                          </span>
                        )}
                      </div>
                      <span className={`text-[7.5px] font-bold uppercase mt-1 tracking-wider ${isAlertsMenuOpen ? 'text-rose-900' : 'text-rose-100'}`}>Alerts</span>
                    </button>

                    {isAlertsMenuOpen && (
                      <div className="absolute right-0 mt-1.5 w-48 bg-white border border-rose-200 rounded-xl shadow-2xl z-[300] animate-in zoom-in-95 duration-150 p-1 font-bold space-y-0.5 overflow-hidden text-slate-900">
                        {canSeeBima && (
                          <button
                            type="button"
                            onClick={() => {
                              navigate('/insurance?tab=alerts&period=today');
                              setIsAlertsMenuOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-2 py-1 text-slate-800 hover:bg-amber-50 hover:text-amber-900 rounded-lg transition-all text-[11px] font-bold border border-transparent hover:border-amber-100 cursor-pointer"
                          >
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-md bg-amber-100 border border-amber-200 text-amber-700 flex items-center justify-center shrink-0">
                                <ShieldCheck size={11} />
                              </div>
                              <span className="truncate">Bima Maturity</span>
                            </div>
                            <span className={`min-w-[18px] h-4 px-1 rounded font-mono text-[10px] font-black flex items-center justify-center tabular-nums shrink-0 ${
                              bimaMaturityCount > 0 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {bimaMaturityCount}
                            </span>
                          </button>
                        )}

                        {canSeeLoan && (
                          <button
                            type="button"
                            onClick={() => {
                              navigate('/micro-finance?tab=loan');
                              setIsAlertsMenuOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-2 py-1 text-slate-800 hover:bg-emerald-50 hover:text-emerald-900 rounded-lg transition-all text-[11px] font-bold border border-transparent hover:border-emerald-100 cursor-pointer"
                          >
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-md bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                                <Coins size={11} />
                              </div>
                              <span className="truncate">Loan Maturity</span>
                            </div>
                            <span className={`min-w-[18px] h-4 px-1 rounded font-mono text-[10px] font-black flex items-center justify-center tabular-nums shrink-0 ${
                              loanMaturityCount > 0 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {loanMaturityCount}
                            </span>
                          </button>
                        )}

                        {canSeeSaving && (
                          <button
                            type="button"
                            onClick={() => {
                              navigate('/micro-finance?tab=saving&status=MATURED');
                              setIsAlertsMenuOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-2 py-1 text-slate-800 hover:bg-teal-50 hover:text-teal-900 rounded-lg transition-all text-[11px] font-bold border border-transparent hover:border-teal-100 cursor-pointer"
                          >
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-md bg-teal-100 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                                <PiggyBank size={11} />
                              </div>
                              <span className="truncate">Saving Maturity</span>
                            </div>
                            <span className={`min-w-[18px] h-4 px-1 rounded font-mono text-[10px] font-black flex items-center justify-center tabular-nums shrink-0 ${
                              savingMaturityCount > 0 ? 'bg-rose-600 text-white' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {savingMaturityCount}
                            </span>
                          </button>
                        )}

                        {canSeeNotice && (
                          <button
                            type="button"
                            onClick={() => {
                              navigate('/notice-download');
                              setIsAlertsMenuOpen(false);
                            }}
                            className="w-full flex items-center justify-between px-2 py-1 text-slate-800 hover:bg-sky-50 hover:text-sky-900 rounded-lg transition-all text-[11px] font-bold border border-transparent hover:border-sky-100 cursor-pointer"
                          >
                            <div className="flex items-center space-x-1.5 min-w-0">
                              <div className="w-5 h-5 rounded-md bg-sky-100 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
                                <Megaphone size={11} />
                              </div>
                              <span className="truncate">Notice</span>
                            </div>
                            <span className={`min-w-[18px] h-4 px-1 rounded font-mono text-[10px] font-black flex items-center justify-center tabular-nums shrink-0 ${
                              noticeCount > 0 ? 'bg-amber-500 text-slate-950' : 'bg-slate-100 text-slate-500'
                            }`}>
                              {noticeCount}
                            </span>
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                );
              })()}

              {/* Shortcuts Dropdown Button */}
              {hasPermission('view_shortcuts') && (
                <div className="relative" ref={shortcutRef}>
                  <button 
                    onClick={() => {
                      setIsShortcutMenuOpen(!isShortcutMenuOpen);
                      setIsAlertsMenuOpen(false);
                    }}
                    className={`px-3.5 py-1.5 border rounded-xl transition-all flex flex-col items-center relative cursor-pointer shadow-2xs backdrop-blur-xs ${
                      isShortcutMenuOpen 
                        ? 'bg-white text-rose-900 border-white shadow-md font-bold' 
                        : (hasPermission('sub_tool_messages_view') && unreadChatCount > 0)
                          ? 'bg-rose-500/30 hover:bg-rose-500/40 text-white border-2 border-rose-300 ring-2 ring-rose-400/40 shadow-[0_0_16px_rgba(244,63,94,0.45)]'
                          : 'bg-white/10 hover:bg-white/20 text-white border-white/25 hover:border-white/50'
                    }`}
                    title="Shortcuts & Quick Tools"
                  >
                    <div className="relative">
                      <PlusSquare size={17} className={isShortcutMenuOpen ? 'text-rose-900' : 'text-rose-100'} />
                      {hasPermission('sub_tool_messages_view') && unreadChatCount > 0 && (
                        <span className="absolute -top-1.5 -right-2.5 min-w-[17px] h-[17px] bg-rose-600 text-white rounded-full border-2 border-white text-[8px] font-black flex items-center justify-center px-0.5 shadow-md animate-pulse">
                          {unreadChatCount > 9 ? '9+' : unreadChatCount}
                        </span>
                      )}
                    </div>
                    <span className={`text-[7.5px] font-bold uppercase mt-1 tracking-wider ${isShortcutMenuOpen ? 'text-rose-900' : 'text-rose-100 group-hover:text-white'}`}>Shortcuts</span>
                  </button>

                  {isShortcutMenuOpen && (
                    <div className="absolute right-0 mt-1.5 w-max min-w-[144px] bg-white border border-rose-200 rounded-xl shadow-2xl z-[300] animate-in zoom-in-95 duration-150 p-1 font-bold space-y-0.5 overflow-hidden text-slate-900">
                       {/* 1. Remittance Detail Vault */}
                       {hasPermission('sub_tool_remit_view') && (
                         <button 
                           onClick={() => { navigate('/remit'); setIsShortcutMenuOpen(false); }}
                           className="w-full flex items-center space-x-2 px-2 py-1 text-slate-800 hover:bg-rose-50 hover:text-rose-800 rounded-lg transition-all uppercase text-[10px] font-black tracking-wider border border-transparent hover:border-rose-100 cursor-pointer whitespace-nowrap"
                         >
                           <div className="w-5 h-5 rounded-md bg-rose-100 border border-rose-200 text-rose-700 flex items-center justify-center shrink-0">
                             <Globe size={12} />
                           </div>
                           <span>Remit</span>
                         </button>
                       )}

                       {/* 2. Messages (Staff Communicator) */}
                       {hasPermission('sub_tool_messages_view') && (
                         <button 
                           onClick={() => { setIsChatOpen(true); setIsShortcutMenuOpen(false); }}
                           className="w-full flex items-center justify-between space-x-2 px-2 py-1 text-slate-800 hover:bg-sky-50 hover:text-sky-800 rounded-lg transition-all uppercase text-[10px] font-black tracking-wider border border-transparent hover:border-sky-100 cursor-pointer whitespace-nowrap"
                         >
                           <div className="flex items-center space-x-2">
                             <div className="w-5 h-5 rounded-md bg-sky-100 border border-sky-200 text-sky-700 flex items-center justify-center shrink-0">
                               <MessageSquare size={12} />
                             </div>
                             <span>Messages</span>
                           </div>
                           {unreadChatCount > 0 && (
                             <span className="text-[8px] bg-rose-600 text-white px-1.5 py-0.2 rounded-full font-black animate-pulse">
                               {unreadChatCount > 9 ? '9+' : unreadChatCount}
                             </span>
                           )}
                         </button>
                       )}

                       {(hasPermission('sub_tool_remit_view') || hasPermission('sub_tool_messages_view')) &&
                         (hasPermission('sub_tool_calculator_view') || hasPermission('sub_tool_fd_cert_view') || hasPermission('sub_tool_emi_view') || hasPermission('sub_tool_date_converter_view')) && (
                         <div className="h-px bg-slate-100 my-0.5" />
                       )}

                       {/* 3. Calculator */}
                       {hasPermission('sub_tool_calculator_view') && (
                         <button 
                           onClick={() => { navigate('/calculator'); setIsShortcutMenuOpen(false); }}
                           className="w-full flex items-center space-x-2 px-2 py-1 text-slate-800 hover:bg-emerald-50 hover:text-emerald-800 rounded-lg transition-all uppercase text-[10px] font-black tracking-wider border border-transparent hover:border-emerald-100 cursor-pointer whitespace-nowrap"
                         >
                           <div className="w-5 h-5 rounded-md bg-emerald-100 border border-emerald-200 text-emerald-700 flex items-center justify-center shrink-0">
                             <CalcIcon size={12} />
                           </div>
                           <span>Calculator</span>
                         </button>
                       )}

                       {/* 4. FD Certificate */}
                       {hasPermission('sub_tool_fd_cert_view') && (
                         <button 
                           onClick={() => { setIsFDCertOpen(true); setIsShortcutMenuOpen(false); }}
                           className="w-full flex items-center space-x-2 px-2 py-1 text-slate-800 hover:bg-indigo-50 hover:text-indigo-800 rounded-lg transition-all uppercase text-[10px] font-black tracking-wider border border-transparent hover:border-indigo-100 cursor-pointer whitespace-nowrap"
                         >
                           <div className="w-5 h-5 rounded-md bg-indigo-100 border border-indigo-200 text-indigo-700 flex items-center justify-center shrink-0">
                             <Award size={12} />
                           </div>
                           <span>FD Certificate</span>
                         </button>
                       )}

                       {/* 5. EMI Calculator */}
                       {hasPermission('sub_tool_emi_view') && (
                         <button 
                           onClick={() => { setIsEmiOpen(true); setIsShortcutMenuOpen(false); }}
                           className="w-full flex items-center space-x-2 px-2 py-1 text-slate-800 hover:bg-purple-50 hover:text-purple-800 rounded-lg transition-all uppercase text-[10px] font-black tracking-wider border border-transparent hover:border-purple-100 cursor-pointer whitespace-nowrap"
                         >
                           <div className="w-5 h-5 rounded-md bg-purple-100 border border-purple-200 text-purple-700 flex items-center justify-center shrink-0">
                             <TrendingUp size={12} />
                           </div>
                           <span>EMI Calculator</span>
                         </button>
                       )}

                       {/* 6. BS / AD Date Converter */}
                       {hasPermission('sub_tool_date_converter_view') && (
                         <button 
                           onClick={() => { setIsDateConverterOpen(true); setIsShortcutMenuOpen(false); }}
                           className="w-full flex items-center space-x-2 px-2 py-1 text-slate-800 hover:bg-teal-50 hover:text-teal-800 rounded-lg transition-all uppercase text-[10px] font-black tracking-wider border border-transparent hover:border-teal-100 cursor-pointer whitespace-nowrap"
                         >
                           <div className="w-5 h-5 rounded-md bg-teal-100 border border-teal-200 text-teal-700 flex items-center justify-center shrink-0">
                             <Calendar size={12} />
                           </div>
                           <span>Date Converter</span>
                         </button>
                       )}
                    </div>
                  )}
                </div>
              )}
            </div>

            {/* User Profile Card */}
            <div className="relative" ref={userMenuRef}>
              <button 
                onClick={() => setIsUserMenuOpen(!isUserMenuOpen)}
                className="flex items-center space-x-3 px-3 py-1.5 rounded-2xl bg-white/10 hover:bg-white/20 border border-white/25 hover:border-white/50 shadow-2xs backdrop-blur-xs transition-all cursor-pointer group"
              >
                <div className="text-right hidden sm:block">
                  <div className="text-[11.5px] font-black text-white leading-none">
                    {linkedEmployee?.fullName || user.fullName}
                  </div>
                  <div className="mt-1 flex items-center justify-end">
                    {isSuperAdmin ? (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-amber-400 text-slate-950 font-black text-[7.5px] uppercase tracking-wider shadow-2xs">
                        <Crown size={9} className="text-slate-950 fill-slate-950" />
                        <span>Super Admin</span>
                      </span>
                    ) : (
                      <span className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded-md bg-white/20 text-white border border-white/30 text-[7.5px] font-black uppercase tracking-wider">
                        <span>{linkedEmployee?.designation || 'Operator'}</span>
                      </span>
                    )}
                  </div>
                </div>
                
                {/* User Avatar with Status Indicator */}
                <div className="relative">
                  <div className="w-9 h-9 rounded-xl bg-white text-rose-900 border-2 border-white/80 shadow-md flex items-center justify-center font-black text-base overflow-hidden group-hover:scale-105 transition-transform">
                    {(linkedEmployee?.photoUrl || user.profilePhoto) ? (
                      <img src={linkedEmployee?.photoUrl || user.profilePhoto} className="w-full h-full object-cover" alt="User Avatar" />
                    ) : (
                      <span className="text-rose-900">{user.fullName.charAt(0)}</span>
                    )}
                  </div>
                  {isSuperAdmin ? (
                    <div className="absolute -bottom-1 -right-1 w-3.5 h-3.5 bg-amber-400 rounded-full border-2 border-rose-900 flex items-center justify-center text-[7px] text-slate-950 font-black shadow-2xs">
                      ★
                    </div>
                  ) : (
                    <div className="absolute -bottom-0.5 -right-0.5 w-2.5 h-2.5 bg-emerald-400 rounded-full border-2 border-rose-900 shadow-2xs"></div>
                  )}
                </div>

                <ChevronDown size={13} className={`text-rose-200 transition-transform duration-200 ${isUserMenuOpen ? 'rotate-180 text-white' : 'group-hover:text-white'}`} />
              </button>

              {isUserMenuOpen && (
                <div className="absolute right-0 mt-2.5 w-64 bg-white border border-slate-200 rounded-2xl shadow-2xl z-[1000] animate-in zoom-in-95 duration-150 p-2 font-bold space-y-1 max-h-[calc(100vh-6rem)] overflow-y-auto">
                   {/* User info banner */}
                   <div className="px-2.5 py-2 bg-slate-50 rounded-xl border border-slate-100 mb-1">
                     <div className="text-xs font-black text-slate-900 truncate">{linkedEmployee?.fullName || user.fullName}</div>
                     <div className="text-[10px] text-slate-500 flex items-center justify-between mt-0.5">
                       <span>@{user.username}</span>
                       <span className="text-emerald-700 font-bold truncate max-w-[120px]">{branch?.name || 'Head Office'}</span>
                     </div>
                   </div>

                   {/* Super Admin Switch Branch - Clean Light Theme Dropdown matching the menu */}
                   {isSuperAdmin && (
                     <div className="py-0.5">
                       <button 
                         onClick={() => setIsBranchDropdownOpen(!isBranchDropdownOpen)}
                         className="w-full flex items-center justify-between px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-800 rounded-xl transition-all text-xs font-bold cursor-pointer group"
                       >
                         <div className="flex items-center space-x-2.5">
                           <ArrowRightLeft size={16} className="text-emerald-600 group-hover:scale-110 transition-transform" />
                           <span>Switch Branch</span>
                         </div>
                         <div className="flex items-center space-x-1.5">
                           <span className="text-[9px] font-black px-1.5 py-0.5 bg-slate-100 group-hover:bg-emerald-100 text-slate-700 group-hover:text-emerald-800 rounded font-mono">
                             {branch?.code || 'C01'}
                           </span>
                           <ChevronDown size={14} className={`text-slate-400 transition-transform duration-200 ${isBranchDropdownOpen ? 'rotate-180 text-emerald-600' : ''}`} />
                         </div>
                       </button>

                       {/* Dropdown list of branches */}
                       {isBranchDropdownOpen && (
                         <div className="mt-1 p-1 bg-slate-50 border border-slate-200 rounded-xl space-y-0.5 animate-in fade-in zoom-in-95 duration-150 max-h-48 overflow-y-auto">
                           {combinedBranches.map(b => {
                             const isCurrent = (branch?.id || 'main').toLowerCase() === b.id.toLowerCase() || (branch?.code || '').toLowerCase() === b.code.toLowerCase();
                             return (
                               <button
                                 key={b.id}
                                 onClick={() => {
                                   switchBranch(b.id);
                                   setIsUserMenuOpen(false);
                                   setIsBranchDropdownOpen(false);
                                   setSwitchSuccessToast(`Switched to ${b.name} (${b.code})`);
                                   setTimeout(() => setSwitchSuccessToast(null), 3500);
                                 }}
                                 className={`w-full px-2.5 py-2 rounded-lg text-[11px] font-bold text-left truncate flex items-center justify-between transition-all cursor-pointer ${
                                   isCurrent 
                                     ? 'bg-emerald-600 text-white font-black shadow-xs' 
                                     : 'text-slate-700 hover:bg-white hover:text-emerald-700 hover:shadow-xs'
                                 }`}
                                 title={b.name}
                               >
                                 <div className="flex items-center space-x-2 truncate">
                                   <Building2 size={13} className={isCurrent ? "text-white" : "text-slate-400"} />
                                   <span className="truncate">{b.name}</span>
                                 </div>
                                 <div className="flex items-center space-x-1.5 shrink-0 ml-2">
                                   <span className={`text-[8.5px] px-1.5 py-0.5 rounded font-mono ${isCurrent ? 'bg-emerald-700 text-emerald-100' : 'bg-slate-200 text-slate-600'}`}>
                                     {b.code}
                                   </span>
                                   {isCurrent && <Check size={13} className="text-white" />}
                                 </div>
                               </button>
                             );
                           })}
                         </div>
                       )}
                     </div>
                   )}

                   <div className="h-px bg-slate-100 my-1 mx-1" />

                   <button 
                     onClick={() => { setProfilePortalInitialTab('overview'); setIsProfilePortalOpen(true); setIsUserMenuOpen(false); }}
                     className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-blue-600 rounded-xl transition-all text-xs cursor-pointer"
                   >
                     <UserIcon size={16} className="text-blue-500 shrink-0" />
                     <span>My Profile</span>
                   </button>
                   <button 
                     onClick={() => { setProfilePortalInitialTab('attendance'); setIsProfilePortalOpen(true); setIsUserMenuOpen(false); }}
                     className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all text-xs cursor-pointer font-bold"
                   >
                     <Clock size={16} className="text-emerald-600 shrink-0" />
                     <span>My Attendance</span>
                   </button>
                   <button 
                     onClick={() => { setIsChangePasswordOpen(true); setIsUserMenuOpen(false); }}
                     className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-amber-600 rounded-xl transition-all text-xs cursor-pointer"
                   >
                     <KeyRound size={16} className="text-amber-500 shrink-0" />
                     <span>Change Password</span>
                   </button>
                   <button 
                     onClick={() => { setIsScreenLocked(true); setIsUserMenuOpen(false); }}
                     className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-700 hover:bg-slate-50 hover:text-purple-600 rounded-xl transition-all text-xs cursor-pointer"
                   >
                     <Lock size={16} className="text-purple-500 shrink-0" />
                     <span>Screen Lock</span>
                   </button>
                   <button 
                     onClick={() => { setProfilePortalInitialTab('transactions'); setIsProfilePortalOpen(true); setIsUserMenuOpen(false); }}
                     className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all text-xs cursor-pointer font-bold"
                   >
                     <Receipt size={16} className="text-emerald-600 shrink-0" />
                     <span>Transaction</span>
                   </button>
                   <button 
                     onClick={() => { setIsDateConverterOpen(true); setIsUserMenuOpen(false); }}
                     className="w-full flex items-center space-x-2.5 px-3 py-2 text-slate-700 hover:bg-emerald-50 hover:text-emerald-700 rounded-xl transition-all text-xs cursor-pointer"
                   >
                     <Calendar size={16} className="text-emerald-500 shrink-0" />
                     <span>Date Converter</span>
                   </button>
                   
                   <div className="h-px bg-slate-100 my-1 mx-1" />
                   
                   {/* Day End / Day Open Action Button (Right above Logout) */}
                   {(() => {
                     const isDayEnded = isCurrentBranchDayEnded;
                     const canOpenNow = !isDayEnded || dayOpenCheck.allowed;
                     return (
                       <div className="px-1 py-1">
                         <button
                           onClick={handleToggleDayStatus}
                           disabled={isDayStatusUpdating}
                           title={isDayEnded 
                             ? (canOpenNow
                               ? `Click to mark Day Open for ${currentBranchName}`
                               : (dayOpenCheck.reason || `Day Open locked for ${currentBranchName}`))
                             : `Day is active (${currentStatus}). Click to mark Day End for ${currentBranchName}`}
                           className={`w-full flex items-center justify-between p-2.5 rounded-xl border transition-all text-xs font-bold cursor-pointer shadow-2xs ${
                             isDayEnded
                               ? canOpenNow
                                 ? 'bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border-emerald-300'
                                 : 'bg-amber-50 hover:bg-amber-100 text-amber-900 border-amber-300'
                               : 'bg-rose-50 hover:bg-rose-100 text-rose-800 border-rose-300'
                           } ${isDayStatusUpdating ? 'opacity-60 cursor-wait' : ''}`}
                         >
                           <div className="flex items-center space-x-2 text-left min-w-0">
                             <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${
                               isDayEnded
                                 ? canOpenNow
                                   ? 'bg-emerald-600 text-white'
                                   : 'bg-amber-600 text-white'
                                 : 'bg-rose-600 text-white'
                             }`}>
                               {isDayEnded ? (canOpenNow ? <Sun size={15} /> : <Lock size={14} />) : <Moon size={15} />}
                             </div>
                             <div className="min-w-0">
                               <div className="font-black text-xs leading-tight">
                                 {isDayEnded ? 'Day Open' : 'Day End'}
                               </div>
                               <div className={`text-[10px] font-semibold leading-tight mt-0.5 truncate ${
                                 isDayEnded
                                   ? canOpenNow ? 'text-emerald-700' : 'text-amber-800'
                                   : 'text-rose-700'
                               }`}>
                                 {isDayEnded
                                   ? (canOpenNow ? 'Start Daily Work' : 'Waiting HO / Next Day')
                                   : 'Close Day Work'}
                               </div>
                             </div>
                           </div>

                           <span className={`text-[9px] font-black uppercase px-2 py-0.5 rounded-md text-white shrink-0 shadow-2xs ml-1 ${
                             isDayEnded ? (canOpenNow ? 'bg-emerald-700' : 'bg-amber-700') : 'bg-rose-700'
                           }`}>
                             {isDayStatusUpdating ? 'Saving...' : isDayEnded ? (canOpenNow ? 'Open' : 'Locked') : 'End'}
                           </span>
                         </button>
                       </div>
                     );
                   })()}

                   <div className="h-px bg-slate-100 my-1 mx-1" />
                   
                   <button 
                     onClick={handleLogout}
                     className="w-full flex items-center space-x-2.5 px-3 py-2 text-rose-600 hover:bg-rose-50 rounded-xl transition-all text-xs cursor-pointer font-bold"
                   >
                     <LogOut size={16} className="shrink-0" />
                     <span>Logout</span>
                   </button>
                </div>
              )}
            </div>
          </div>
        </header>

        {/* Global Toast Notification for Branch Switch */}
        {switchSuccessToast && (
          <div className="fixed top-4 right-4 z-[9999] bg-emerald-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-emerald-500/40 flex items-center space-x-3 animate-in slide-in-from-top-4 duration-300">
            <div className="w-8 h-8 rounded-xl bg-emerald-500 flex items-center justify-center text-slate-950 font-black shadow-sm shrink-0">
              <CheckCircle2 size={18} />
            </div>
            <div>
              <div className="text-xs font-black text-white">Branch Context Updated!</div>
              <div className="text-[11px] font-semibold text-emerald-300">{switchSuccessToast}</div>
            </div>
          </div>
        )}

        {/* Global Toast Notification for Day End Lock */}
        {dayEndBlockedToast && (
          <div className="fixed top-4 right-4 z-[9999] bg-rose-950 text-white px-4 py-3 rounded-2xl shadow-2xl border border-rose-500/50 flex items-center space-x-3 max-w-sm animate-in slide-in-from-top-4 duration-300 print:hidden">
            <div className="w-8 h-8 rounded-xl bg-rose-500 flex items-center justify-center text-white font-black shadow-sm shrink-0">
              <Lock size={16} />
            </div>
            <div className="min-w-0">
              <div className="text-xs font-black text-white uppercase tracking-wide">{dayEndBlockedToast.title}</div>
              <div className="text-[11px] font-semibold text-rose-200 leading-snug">{dayEndBlockedToast.message}</div>
            </div>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-3 md:p-4">
          <div className="w-full h-full">
            <Routes>
              <Route path="/" element={<DefaultRedirect />} />
              <Route path="/dashboard" element={<ProtectedRoute permission="view_reports"><SummaryReport /></ProtectedRoute>} />
              <Route path="/entry" element={<ProtectedRoute permission="view_cash_entry"><DailyCashEntry /></ProtectedRoute>} />
              <Route path="/settlement" element={<ProtectedRoute permission="view_cash_entry"><SettlementPage /></ProtectedRoute>} />
              <Route path="/transaction" element={<ProtectedRoute permission="view_daily_ledger"><DailyLedgerPage /></ProtectedRoute>} />
              <Route path="/report" element={<ProtectedRoute permission="view_reports"><ReportsPage /></ProtectedRoute>} />
              <Route path="/ledger" element={<ProtectedRoute permission="view_ledger_names"><LedgerManagement /></ProtectedRoute>} />
              <Route path="/income-expense" element={<ProtectedRoute permission="view_income_expense"><IncomeExpensePage /></ProtectedRoute>} />
              <Route path="/office-expense" element={<ProtectedRoute permission="view_office_expenses"><OfficeExpenseManager branches={allBranches} currentBranch={branch} user={user} settings={settings} /></ProtectedRoute>} />
              <Route path="/notice-download/*" element={<ProtectedRoute permission="manage_notices"><NoticeDownload /></ProtectedRoute>} />
              <Route path="/calculator" element={<ProtectedRoute permission="sub_tool_calculator_view"><CalculatorPage /></ProtectedRoute>} />
              <Route path="/remit" element={<ProtectedRoute permission="sub_tool_remit_view"><RemitPage /></ProtectedRoute>} />
              <Route path="/hr/*" element={<ProtectedRoute permission="manage_hr"><HRManagement /></ProtectedRoute>} />
              <Route path="/insurance/*" element={<ProtectedRoute permission="view_insurance"><LoanInsuranceManagement /></ProtectedRoute>} />
              <Route path="/micro-finance/*" element={<ProtectedRoute permission="view_microfinance"><MicroFinanceManagement /></ProtectedRoute>} />
              <Route path="/depreciation/*" element={<ProtectedRoute permission="view_depreciation"><DepreciationManagement /></ProtectedRoute>} />
              <Route path="/admin/*" element={<ProtectedRoute permission="manage_users"><AdminCenter /></ProtectedRoute>} />
              <Route path="*" element={<DefaultRedirect />} />
            </Routes>
          </div>
        </div>
      </main>

      {/* Super Admin Switch Branch Modal */}
      {isSwitchBranchModalOpen && (
        <SwitchBranchModal
          branches={combinedBranches}
          currentBranchId={branch?.id || user.branchId || 'main'}
          onSelectBranch={(selected) => {
            switchBranch(selected.id);
            setSwitchSuccessToast(`Switched to ${selected.name} (${selected.code})`);
            setTimeout(() => setSwitchSuccessToast(null), 3500);
          }}
          onClose={() => setIsSwitchBranchModalOpen(false)}
        />
      )}

      {isDateConverterOpen && <DateConverterModal onClose={() => setIsDateConverterOpen(false)} />}
      {isEmiOpen && <EMICalculator onClose={() => setIsEmiOpen(false)} />}
      {isFDCertOpen && <FDCertificateModal onClose={() => setIsFDCertOpen(false)} />}
      
      {isProfilePortalOpen && (
        <UserProfilePortal 
          user={user} 
          onClose={() => setIsProfilePortalOpen(false)} 
          onViewSlip={(slip) => setSelectedSlip(slip)}
          initialTab={profilePortalInitialTab}
        />
      )}

      {isChangePasswordOpen && (
        <ChangePasswordModal
          user={user}
          onClose={() => setIsChangePasswordOpen(false)}
        />
      )}

      {/* 3-Month Forced Password Expiry / Mandatory Policy Reset Modal */}
      {user && isPasswordExpired(user) && (
        <ForcedPasswordExpiryModal
          user={user}
          onSuccess={(updatedUser) => {
            login(updatedUser);
            refreshUser();
          }}
          onLogout={handleLogout}
        />
      )}

      {isScreenLocked && (
        <ScreenLockModal
          user={user}
          employee={linkedEmployee}
          branch={branch}
          onUnlock={() => setIsScreenLocked(false)}
          onLogout={logout}
        />
      )}

      {selectedSlip && (
        <InternalSalarySlipPrintView 
          slip={selectedSlip} 
          employee={linkedEmployee || { fullName: user.fullName, designation: 'Staff' }} 
          onClose={() => setSelectedSlip(null)} 
        />
      )}

      {/* Staff Internal Communicator Drawer */}
      <StaffChatDrawer 
        isOpen={isChatOpen} 
        initialTarget={chatTargetToOpen}
        onClose={() => { 
          setIsChatOpen(false); 
          setChatTargetToOpen(null);
          checkUnreadChat(); 
        }} 
        onOpen={() => {
          setIsChatOpen(true);
        }}
      />

      {/* Real-time Teams Notification Toast (Bottom-Right) */}
      {appIncomingToast && !isChatOpen && (
        <TeamsNotificationToast
          toast={appIncomingToast}
          onClose={() => setAppIncomingToast(null)}
          onOpenChat={handleOpenToastChat}
          onSendInlineReply={handleSendToastInlineReply}
        />
      )}

      {/* Immediate Login Broadcast Popup Notice */}
      {activeLoginPopup && (
        <LoginPopupNoticeModal
          popup={activeLoginPopup}
          onClose={handleDismissLoginPopup}
        />
      )}
    </div>
  );
};

// Immediately clean up legacy hash URL if present before router mounts
if (typeof window !== 'undefined' && window.location.hash && window.location.hash.startsWith('#/')) {
  const cleanPath = window.location.hash.slice(1);
  window.history.replaceState(null, '', cleanPath);
}

const Root: React.FC = () => {
  useEffect(() => {
    if (window.location.hash && window.location.hash.startsWith('#/')) {
      const cleanPath = window.location.hash.slice(1);
      window.history.replaceState(null, '', cleanPath);
      window.dispatchEvent(new PopStateEvent('popstate'));
    }
  }, []);

  return (
    <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
      <AuthProvider>
        <AppLayout />
        <OfflineIndicator />
      </AuthProvider>
    </BrowserRouter>
  );
};

export default Root;