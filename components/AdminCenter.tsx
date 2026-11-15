import React, { useState, useEffect, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { 
  ShieldCheck, Users, Settings as SettingsIcon, Combine, 
  Activity, Building2,
  Plus, Edit2, Trash2, Key, X, Eye,
  RotateCcw,
  Download, Upload, CheckCircle2,
  Home, Database, RefreshCw, Calendar,
  Layers
} from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import { ConfirmationModal } from './ConfirmationModal';
import { useAuth } from '../AuthContext';
import UserManagement from './UserManagement';
import SystemSettingsPage from './SystemSettingsPage';
import ConsolidatedReport from './ConsolidatedReport';
import AuditLogPage from './AuditLogPage';
import AdminDashboard from './AdminDashboard';
import RolePermissionManagement from './RolePermissionManagement';
import { HolidayManagement } from './HolidayManagement';
import ProductManagement from './ProductManagement';
import { storageService } from '../services/storageService';
import { Branch, Role } from '../types';
import { NepaliDatePicker } from './NepaliDatePicker';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';
import { getTodayBsDateStr, toNormalizedBsDateStr } from '../utils/backDateControl';

type AdminTab = 'home' | 'branches' | 'products' | 'saving-products' | 'loan-products' | 'holiday' | 'users' | 'roles' | 'intelligence' | 'settings' | 'backup' | 'reset' | 'logs';

const AdminCenter: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();

  // Extract tab from URL: /admin/:tab (e.g., /admin/branches, /admin/holiday, /admin/users)
  const currentTabFromUrl = useMemo<AdminTab>(() => {
    const parts = location.pathname.split('/').filter(Boolean);
    if (parts.length >= 2 && parts[0] === 'admin') {
      const sub = parts[1].toLowerCase() as AdminTab;
      const validTabs: AdminTab[] = [
        'home', 'branches', 'products', 'saving-products', 'loan-products',
        'holiday', 'users', 'roles', 'intelligence', 'settings', 'backup', 'reset', 'logs'
      ];
      if (validTabs.includes(sub)) {
        return sub;
      }
    }
    return 'home';
  }, [location.pathname]);

  const activeTab = currentTabFromUrl;

  const handleTabChange = (tabId: AdminTab) => {
    if (tabId === 'home') {
      navigate('/admin');
    } else {
      navigate(`/admin/${tabId}`);
    }
  };
  const { user, refreshRoles } = useAuth();
  const isDayEnded = useDayEndLock();
  const [branches, setBranches] = useState<Branch[]>([]);
  const [roles, setRoles] = useState<Role[]>([]);
  const [resetDate, setResetDate] = useState(() => getTodayBsDateStr());
  const [loading, setLoading] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; type: 'branch' | 'role' | 'reset'; id?: string; date?: string } | null>(null);
  const [resetConfirmModal, setResetConfirmModal] = useState<{
    isOpen: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel?: () => void;
  } | null>(null);
  const [actionFeedback, setActionFeedback] = useState<{ type: 'success' | 'error'; message: string } | null>(null);

  // Detailed Reset Procedure States
  const [resetBranchId, setResetBranchId] = useState<string>('ALL');
  const [resetFromDate, setResetFromDate] = useState(() => getTodayBsDateStr());
  const [resetToDate, setResetToDate] = useState(() => getTodayBsDateStr());
  const [isBackupTaken, setIsBackupTaken] = useState(false);
  const [isBackupSaved, setIsBackupSaved] = useState(false);
  const [resetLogsInProgress, setResetLogsInProgress] = useState(false);
  const [resetLogMessages, setResetLogMessages] = useState<string[]>([]);
  const [resetComplete, setResetComplete] = useState(false);
  const [verifiedPostReset, setVerifiedPostReset] = useState(false);
  
  // Branch Modal States
  const [showBranchModal, setShowBranchModal] = useState(false);
  const [editingBranch, setEditingBranch] = useState<Partial<Branch> | null>(null);
  const [viewingBranch, setViewingBranch] = useState<Branch | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      const [b, r] = await Promise.all([
        storageService.getBranches(),
        storageService.getRoles()
      ]);
      setBranches(b);
      setRoles(r);
    } catch (error) {
      console.error("Failed to fetch admin data", error);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const navItems: { 
    id: AdminTab; 
    label: string; 
    icon: React.ReactNode;
    hasSubMenu?: boolean;
  }[] = [
    { id: 'home', label: 'Home', icon: <Home size={14} /> },
    { id: 'branches', label: 'Branches', icon: <Building2 size={14} /> },
    { id: 'products', label: 'Product', icon: <Layers size={14} />, hasSubMenu: true },
    { id: 'holiday', label: 'Holiday', icon: <Calendar size={14} /> },
    { id: 'users', label: 'Users', icon: <Users size={14} /> },
    { id: 'roles', label: 'Roles', icon: <Key size={14} /> },
    { id: 'intelligence', label: 'Intelligence', icon: <Combine size={14} /> },
    { id: 'settings', label: 'Settings', icon: <SettingsIcon size={14} /> },
    { id: 'backup', label: 'Backup', icon: <Download size={14} /> },
    { id: 'reset', label: 'Reset', icon: <RotateCcw size={14} /> },
    { id: 'logs', label: 'Logs', icon: <Activity size={14} /> },
  ];

  const [backupLoading, setBackupLoading] = useState(false);
  const [restoring, setRestoring] = useState(false);
  const [restoreStatus, setRestoreStatus] = useState('');
  const [resetModuleLoading, setResetModuleLoading] = useState<string | null>(null);

  const showFeedback = (type: 'success' | 'error', message: string) => {
    setActionFeedback({ type, message });
    setTimeout(() => setActionFeedback(prev => (prev?.message === message ? null : prev)), 5000);
  };

  const handleBackup = async () => {
    try {
      setBackupLoading(true);
      const allData = await storageService.getFullBackupData();
      const blob = new Blob([JSON.stringify(allData, null, 2)], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `ratauli_saccos_master_backup_${new Date().toISOString().split('T')[0]}.json`;
      a.click();
      URL.revokeObjectURL(url);
      showFeedback('success', 'Master backup downloaded successfully.');
    } catch (e) {
      console.error("Backup failed:", e);
      showFeedback('error', 'Backup generation failed. Please try again.');
    } finally {
      setBackupLoading(false);
    }
  };

  const handleRestore = async (e: React.ChangeEvent<HTMLInputElement>) => {
    if (isDayEndedForBranch()) {
      showFeedback('error', getDayEndedBlockMessage());
      if (e.target) e.target.value = '';
      return;
    }
    const file = e.target.files?.[0];
    if (!file) return;

    const inputEl = e.target;
    setResetConfirmModal({
      isOpen: true,
      title: 'Restore Backup Data',
      message: 'Are you sure you want to restore data from this backup file? This will restore and synchronize all data into Supabase and local storage.',
      onCancel: () => {
        if (inputEl) inputEl.value = '';
        setResetConfirmModal(null);
      },
      onConfirm: async () => {
        setResetConfirmModal(null);
        try {
          setRestoring(true);
          setRestoreStatus("Processing backup JSON file...");
          const text = await file.text();
          const backupObj = JSON.parse(text);

          setRestoreStatus("Restoring and syncing data to Supabase...");
          const result = await storageService.restoreBackupData(backupObj);

          setRestoreStatus("Data restored successfully!");
          showFeedback('success', `Restore Completed Successfully! ${result.message}`);
          window.location.reload();
        } catch (err) {
          console.error("Restore error:", err);
          showFeedback('error', `Restore Failed: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setRestoring(false);
          setRestoreStatus('');
          if (inputEl) inputEl.value = '';
        }
      }
    });
  };

  const handleModuleReset = async (moduleType: 'daily' | 'ledgers' | 'hr' | 'notices' | 'logs' | 'full', label: string) => {
    if (isDayEndedForBranch()) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    const confirmMessage = moduleType === 'full' 
      ? 'Are you sure you want to completely erase all system data (daily transactions, ledger accounts, payroll, notices, etc.)? This will permanently delete records from both Supabase and Local Storage.'
      : `Are you sure you want to completely reset [${label}]? All records for this module will be permanently deleted from both Supabase and Local Storage.`;

    setResetConfirmModal({
      isOpen: true,
      title: moduleType === 'full' ? 'Full Factory Reset' : `Reset ${label}`,
      message: confirmMessage,
      onConfirm: async () => {
        setResetConfirmModal(null);
        try {
          setResetModuleLoading(moduleType);
          const res = await storageService.resetModuleData(moduleType);
          showFeedback('success', `Reset Completed! ${res.message}`);
          window.location.reload();
        } catch (err) {
          console.error("Reset module error:", err);
          showFeedback('error', `Error during reset process: ${err instanceof Error ? err.message : String(err)}`);
        } finally {
          setResetModuleLoading(null);
        }
      }
    });
  };

  const getDatesInRange = (startDate: string, endDate: string) => {
    const dates: string[] = [];
    try {
      const getJsDate = (dStr: string) => {
        const parts = dStr.split('-').map(Number);
        if (parts.length === 3 && !parts.some(isNaN)) {
          const [y, m, d] = parts;
          if (y > 2070) {
            return new NepaliDate(y, m - 1, d).toJsDate();
          } else if (y > 1900) {
            return new Date(y, m - 1, d);
          }
        }
        return new Date(dStr);
      };

      let curr = getJsDate(startDate);
      const last = getJsDate(endDate);

      let limit = 0;
      while (curr <= last && limit < 366) {
        const bsStr = new NepaliDate(curr).format('YYYY-MM-DD');
        if (!dates.includes(bsStr)) {
          dates.push(bsStr);
        }
        curr.setDate(curr.getDate() + 1);
        limit++;
      }
    } catch (e) {
      console.warn("Error calculating date range:", e);
    }
    return dates.length > 0 ? dates : [startDate];
  };

  const getSelectedResetBranchLabel = (branchIdVal: string) => {
    if (!branchIdVal || branchIdVal === 'ALL') return 'All Branches';
    const found = branches.find(b => b.id === branchIdVal);
    return found ? `${found.name} (${found.code})` : branchIdVal;
  };

  const executeDetailedSoftwareReset = async (fromBs: string, toBs: string, targetBranchId: string) => {
    if (!isBackupTaken || !isBackupSaved) {
      setIsBackupTaken(true);
      setIsBackupSaved(true);
    }

    const isAllBranches = !targetBranchId || targetBranchId === 'ALL';
    const scopeLabel = getSelectedResetBranchLabel(targetBranchId);

    try {
      setResetLogsInProgress(true);
      setResetLogMessages([]);
      setResetComplete(false);

      const addMessage = (msg: string) => {
        setResetLogMessages(prev => [...prev, `[${new Date().toLocaleTimeString()}] ${msg}`]);
      };

      addMessage("Software reset procedure initiated...");
      await new Promise(resolve => setTimeout(resolve, 400));

      addMessage(`Step 1: Preparing target scope (${scopeLabel}) and date range...`);
      const currentBranches = isAllBranches
        ? await storageService.getBranches()
        : (await storageService.getBranches()).filter(b => b.id === targetBranchId);
      const targetDates = getDatesInRange(fromBs, toBs);
      await new Promise(resolve => setTimeout(resolve, 300));

      addMessage(`Step 2: Processing date range from ${fromBs} to ${toBs} (${targetDates.length} days) for ${scopeLabel}...`);
      
      addMessage("Step 3: Executing range wipe from Supabase and Local Storage...");
      await storageService.deleteDayDataRange(
        fromBs,
        toBs,
        isAllBranches ? undefined : targetBranchId,
        { skipBranchDayEndCheck: true }
      );
      await new Promise(resolve => setTimeout(resolve, 400));

      addMessage("Step 4: Verifying and clearing date-specific branch keys...");
      let deletedCount = 0;
      for (const d of targetDates) {
        addMessage(`Processing date ${d}...`);
        if (isAllBranches) {
          for (const b of currentBranches) {
            await storageService.deleteDayData(d, b.id, { skipBranchDayEndCheck: true });
            deletedCount++;
          }
          await storageService.deleteDayData(d, undefined, { skipBranchDayEndCheck: true });
        } else {
          await storageService.deleteDayData(d, targetBranchId, { skipBranchDayEndCheck: true });
          deletedCount++;
        }
        await new Promise(resolve => setTimeout(resolve, 50));
      }

      addMessage(`Step 5: Successfully cleared all records for ${targetDates.length} days and ${deletedCount} branch datasets (${scopeLabel}).`);
      
      addMessage("Step 6: Writing system audit log...");
      await storageService.saveLog(
        user?.id || 'admin', 
        'DETAILED_RESET', 
        `System data reset executed for ${scopeLabel} (${fromBs} to ${toBs}). Cleared ${targetDates.length} days.`,
        isAllBranches ? undefined : targetBranchId
      );
      await new Promise(resolve => setTimeout(resolve, 300));

      addMessage("Step 7: Reset procedure complete! Please restart software.");
      setResetComplete(true);
      showFeedback('success', `Successfully wiped daily registry data for ${scopeLabel} from ${fromBs} to ${toBs}.`);

      // Trigger storage event so open tabs reload state
      window.dispatchEvent(new Event('storage'));
    } catch (err) {
      console.error("Detailed reset failed", err);
      setResetLogMessages(p => [...p, `❌ [Error] Reset procedure failed: ${err instanceof Error ? err.message : String(err)}`]);
      showFeedback('error', `Reset failed: ${err instanceof Error ? err.message : String(err)}`);
    } finally {
      setResetLogsInProgress(false);
    }
  };

  const runDetailedSoftwareReset = () => {
    if (isDayEndedForBranch()) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    if (!resetFromDate || !resetToDate) {
      showFeedback('error', 'Please select both From and To dates.');
      return;
    }

    const fromBs = toNormalizedBsDateStr(resetFromDate);
    const toBs = toNormalizedBsDateStr(resetToDate);

    if (fromBs > toBs) {
      showFeedback('error', `From Date (${fromBs}) cannot be after To Date (${toBs}).`);
      return;
    }

    const scopeLabel = getSelectedResetBranchLabel(resetBranchId);
    const backupNote = (!isBackupTaken || !isBackupSaved)
      ? ' Note: Backup checkboxes in Step 2 are not checked yet.'
      : '';

    setResetConfirmModal({
      isOpen: true,
      title: 'Confirm Permanent Data Wipe',
      message: `Are you sure you want to permanently wipe Daily Registry & Ledger Entries for [${scopeLabel}] from ${fromBs} to ${toBs} (BS)? This action cannot be undone.${backupNote}`,
      onConfirm: () => {
        setResetConfirmModal(null);
        void executeDetailedSoftwareReset(fromBs, toBs, resetBranchId);
      }
    });
  };

  const handleDailyReset = async () => {
    if (isDayEndedForBranch()) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    if (!resetDate) return;
    setConfirmDelete({ isOpen: true, type: 'reset', date: resetDate });
  };

  const BRANCH_TYPE_NP_MAP: Record<string, string> = {
    'Head Office': 'मुख्य कार्यालय',
    'Branch Office': 'शाखा कार्यालय',
    'Sub-Branch': 'उप-शाखा कार्यालय',
    'Extension Counter': 'विस्तारित काउन्टर'
  };

  const saveBranch = async () => {
    if (isDayEndedForBranch()) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    if (!editingBranch?.name?.trim() || !editingBranch?.code?.trim()) {
      showFeedback('error', 'Please fill in both Branch Name (English) and Branch Code.');
      return;
    }

    try {
      const selectedType = editingBranch.branchType || 'Branch Office';
      const b: Branch = {
        ...editingBranch,
        id: editingBranch.id || (Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15)),
        name: editingBranch.name.trim(),
        nameNp: (editingBranch.nameNp || '').trim(),
        code: editingBranch.code.trim().toUpperCase(),
        codeNp: (editingBranch.codeNp || '').trim(),
        location: (editingBranch.location || 'Not Specified').trim(),
        locationNp: (editingBranch.locationNp || '').trim(),
        branchType: selectedType,
        branchTypeNp: (editingBranch.branchTypeNp || BRANCH_TYPE_NP_MAP[selectedType] || 'शाखा कार्यालय').trim(),
        email: (editingBranch.email || '').trim(),
        createdAt: editingBranch.createdAt || Date.now(),
        status: editingBranch.status || 'Active',
      };

      await storageService.saveBranch(b);
      const updated = await storageService.getBranches();
      setBranches(updated);
      setShowBranchModal(false);
      setEditingBranch(null);
    } catch (error) {
      console.error("Failed to save branch:", error);
      showFeedback('error', 'Failed to save branch. Please check your connection.');
    }
  };

  const deleteBranch = (id: string) => {
    if (id === 'main') return;
    if (isDayEndedForBranch()) {
      showFeedback('error', getDayEndedBlockMessage());
      return;
    }
    setConfirmDelete({ isOpen: true, type: 'branch', id });
  };

  const executeDelete = async () => {
    if (!confirmDelete) return;
    if (isDayEndedForBranch()) {
      showFeedback('error', getDayEndedBlockMessage());
      setConfirmDelete(null);
      return;
    }
    const { type, id, date } = confirmDelete;

    try {
      if (type === 'reset' && date) {
        const currentBranches = await storageService.getBranches();
        for (const b of currentBranches) {
           await storageService.deleteDayData(date, b.id, { skipBranchDayEndCheck: true });
        }
        await storageService.deleteDayData(date, undefined, { skipBranchDayEndCheck: true });
        await storageService.saveLog(user?.id || 'admin', 'DAILY_RESET', `Reset all transactions for date: ${date}`);
      } else if (type === 'branch' && id) {
        await storageService.deleteBranch(id);
        const updated = await storageService.getBranches();
        setBranches(updated);
      }
    } catch (error) {
      console.error("Operation failed", error);
    }

    setConfirmDelete(null);
  };

  if (loading && activeTab !== 'home') {
     return (
        <div className="flex items-center justify-center p-20">
           <div className="w-8 h-8 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        </div>
     );
  }

  return (
    <div className="space-y-4 animate-in fade-in duration-500 pb-10">
      {/* Header & Advanced Nav Bar */}
      <div className="bg-white p-2.5 rounded-[1.5rem] border border-slate-100 shadow-sm relative z-[100]">
        <div className="flex flex-col lg:flex-row justify-between items-center gap-3">
          <div className="flex items-center space-x-2.5">
            <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-md">
              <ShieldCheck size={16} />
            </div>
            <div>
              <h2 className="text-base font-black text-slate-900 tracking-tighter uppercase italic leading-none">
                Admin <span className="text-blue-600">Center</span>
              </h2>
              <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic">
                Governance & Global Visibility
              </p>
            </div>
          </div>

          {/* Nav Bar */}
          <nav className="bg-slate-50 p-0.5 rounded-xl border border-slate-100 flex flex-wrap items-center justify-center gap-[2px] shadow-inner">
            {navItems.map((item) => {
              const isProductTab = item.id === 'products';
              const isProductActive = isProductTab && (activeTab === 'products' || activeTab === 'saving-products' || activeTab === 'loan-products');
              const isCurrentActive = activeTab === item.id || isProductActive;

              return (
                <button
                  key={item.id}
                  onClick={() => handleTabChange(item.id)}
                  className={`
                    flex items-center space-x-1 px-2 py-1 rounded-[0.5rem] font-black text-[8px] uppercase tracking-wider transition-all duration-300 cursor-pointer
                    ${isCurrentActive 
                      ? (isProductTab ? 'bg-[#006400] text-white shadow-sm ring-1 ring-[#006400]' : 'bg-white text-blue-600 shadow-sm ring-1 ring-blue-50/50') 
                      : 'text-slate-400 hover:text-slate-600 hover:bg-white/50'}
                  `}
                >
                  <span className={isCurrentActive ? (isProductTab ? 'text-white' : 'text-blue-600') : 'text-slate-300'}>
                    {item.icon}
                  </span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>
        </div>
      </div>

      {/* Dynamic Content View */}
      <div className="min-h-[60vh] animate-in slide-in-from-bottom-4 duration-500">
        {activeTab === 'home' && <AdminDashboard />}
        
        {activeTab === 'branches' && (
          <div className="space-y-3 animate-in fade-in duration-300">
            {/* Clean, space-saving header block without border or outer wrapper box */}
            <div className="flex justify-between items-center py-2 border-b border-slate-100">
              <div className="flex items-center space-x-2.5">
                <div className="p-1.5 bg-orange-50 text-orange-600 rounded-lg"><Building2 size={16}/></div>
                <div>
                  <h3 className="text-sm font-black italic tracking-tighter text-slate-800 uppercase leading-none">Branch Network</h3>
                  <p className="text-[7px] font-black text-slate-400 uppercase tracking-widest mt-0.5">Manage operational units</p>
                </div>
              </div>
              <button 
                type="button"
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : 'Create Branch'}
                onClick={() => {
                  setEditingBranch({
                    name: '',
                    nameNp: '',
                    code: '',
                    codeNp: '',
                    location: '',
                    locationNp: '',
                    branchType: 'Branch Office',
                    branchTypeNp: 'शाखा कार्यालय',
                    email: '',
                    status: 'Active'
                  });
                  setShowBranchModal(true);
                }} 
                className="bg-slate-900 text-white px-4 py-1.5 rounded-lg font-black uppercase text-[8px] tracking-widest shadow-sm hover:bg-blue-600 transition-all flex items-center space-x-1 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                <Plus size={12} />
                <span>Create Branch</span>
              </button>
            </div>

            {/* Branches Table */}
            <div className="bg-white rounded-xl border border-slate-100 overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-50/75 border-b border-slate-100 italic">
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest w-12 text-center">S.N.</th>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Branch Name (EN / NP)</th>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest w-28">Code (EN / NP)</th>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Branch Type (EN / NP)</th>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Address (EN / NP)</th>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest">Email</th>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest w-28 text-center">Status</th>
                      <th className="px-4 py-2 text-[8px] font-black text-slate-400 uppercase tracking-widest w-28 text-center">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-50">
                    {branches.map((b, idx) => (
                      <tr key={b.id} className="hover:bg-slate-50/50 transition-colors group">
                        <td className="px-4 py-2.5 text-center text-[10px] text-slate-400 font-mono font-black">{idx + 1}</td>
                        <td className="px-4 py-2.5">
                          <div className="text-[10px] text-slate-900 font-black uppercase tracking-tight">{b.name}</div>
                          {b.nameNp && <div className="text-[10px] text-emerald-700 font-bold">{b.nameNp}</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="inline-block px-1.5 py-0.5 bg-slate-100 text-slate-700 rounded text-[8.5px] font-mono font-black uppercase tracking-widest">{b.code}</span>
                          {b.codeNp && <div className="text-[9px] text-slate-500 font-bold mt-0.5">{b.codeNp}</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-[9.5px] text-slate-800 font-bold">{b.branchType || (b.id === 'main' ? 'Head Office' : 'Branch Office')}</div>
                          <div className="text-[9px] text-slate-500 font-medium">{b.branchTypeNp || (b.id === 'main' ? 'मुख्य कार्यालय' : 'शाखा कार्यालय')}</div>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="text-[10px] text-slate-700 font-semibold">{b.location || 'Not Specified'}</div>
                          {b.locationNp && <div className="text-[9.5px] text-slate-500 font-medium">{b.locationNp}</div>}
                        </td>
                        <td className="px-4 py-2.5">
                          <span className="text-[9.5px] font-mono text-slate-600">{b.email || '-'}</span>
                        </td>
                        <td className="px-4 py-2.5 text-center">
                          <span className={`inline-block px-2 py-0.5 rounded-full text-[7.5px] uppercase tracking-wider font-black ${b.status === 'Active' ? 'bg-emerald-50 text-emerald-700 border border-emerald-200' : 'bg-rose-50 text-rose-700 border border-rose-200'}`}>
                            {b.status === 'Active' ? 'Active (सक्रिय)' : 'Inactive (निष्क्रिय)'}
                          </span>
                        </td>
                        <td className="px-4 py-2.5">
                          <div className="flex items-center justify-center space-x-1.5">
                            <button 
                              onClick={() => setViewingBranch(b)} 
                              className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded transition-colors"
                              title="View Detail"
                            >
                              <Eye size={10} />
                            </button>
                            <button 
                              type="button"
                              disabled={isDayEnded}
                              onClick={() => {
                                setEditingBranch({
                                  ...b,
                                  branchType: b.branchType || (b.id === 'main' ? 'Head Office' : 'Branch Office'),
                                  branchTypeNp: b.branchTypeNp || (b.id === 'main' ? 'मुख्य कार्यालय' : 'शाखा कार्यालय')
                                });
                                setShowBranchModal(true);
                              }} 
                              className="p-1.5 bg-slate-50 hover:bg-blue-50 text-slate-400 hover:text-blue-600 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                              title={isDayEnded ? getDayEndedBlockMessage() : 'Edit Branch'}
                            >
                              <Edit2 size={10} />
                            </button>
                            {b.id !== 'main' ? (
                              <button 
                                type="button"
                                disabled={isDayEnded}
                                onClick={() => deleteBranch(b.id)} 
                                className="p-1.5 bg-slate-50 hover:bg-rose-50 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                title={isDayEnded ? getDayEndedBlockMessage() : 'Delete Branch'}
                              >
                                <Trash2 size={10} />
                              </button>
                            ) : (
                              <div className="w-5" />
                            )}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        )}

        {(activeTab === 'products' || activeTab === 'saving-products' || activeTab === 'loan-products') && (
          <ProductManagement 
            initialTab={activeTab === 'loan-products' ? 'loan' : 'saving'}
            onTabChange={(tab) => {
              handleTabChange(tab === 'loan' ? 'loan-products' : 'saving-products');
            }}
          />
        )}

        {activeTab === 'holiday' && <HolidayManagement />}

        {activeTab === 'users' && <UserManagement />}
        
        {activeTab === 'roles' && <RolePermissionManagement />}

        {activeTab === 'intelligence' && <ConsolidatedReport />}
        {activeTab === 'settings' && <SystemSettingsPage />}
        
        {activeTab === 'backup' && (
          <div className="bg-white p-10 rounded-[3rem] border border-slate-200 shadow-sm flex flex-col items-center text-center max-w-4xl mx-auto italic font-black">
             <div className="w-20 h-20 bg-blue-50 rounded-[2rem] flex items-center justify-center text-blue-600 mb-6 shadow-xl">
                <Database size={40} />
             </div>
             <h3 className="text-2xl font-black uppercase tracking-tighter text-slate-900 mb-2 italic">Master Backup & Recovery</h3>
             <p className="text-xs font-bold text-slate-400 uppercase tracking-widest max-w-lg mb-8">
                Download a complete system backup (daily registers, ledger accounts, branches, users, payroll, and settings) from Supabase and local storage, or restore data from an existing backup file.
             </p>
             
             <div className="flex flex-col md:flex-row items-center gap-6 w-full">
                <button 
                  onClick={handleBackup} 
                  disabled={backupLoading}
                  className="flex-1 w-full h-16 bg-slate-900 text-white rounded-2xl flex items-center justify-center space-x-3 font-black uppercase text-[11px] tracking-[0.2em] shadow-2xl hover:bg-blue-600 transition-all disabled:opacity-50 active:scale-95 border-b-4 border-slate-950"
                >
                   <Download size={20} className={backupLoading ? 'animate-bounce' : ''} />
                   <span>{backupLoading ? 'Generating Master File...' : 'Generate Master Export (Backup File)'}</span>
                </button>

                <label
                   title={isDayEnded ? getDayEndedBlockMessage() : 'Restore data from backup JSON file'}
                   className={`flex-1 w-full h-16 bg-emerald-50 border-2 border-dashed border-emerald-300 text-emerald-700 rounded-2xl flex items-center justify-center space-x-3 font-black uppercase text-[11px] tracking-[0.2em] transition-all shadow-sm ${restoring || isDayEnded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:bg-emerald-100 hover:border-emerald-500 active:scale-95'}`}
                >
                   <Upload size={20} className={restoring ? 'animate-spin' : ''} />
                   <span>{restoring ? 'Restoring Data...' : 'Restore from File'}</span>
                   <input type="file" accept=".json" onChange={handleRestore} disabled={restoring || isDayEnded} className="hidden" />
                </label>
             </div>

             {restoring && (
                <div className="mt-6 w-full bg-slate-950 text-emerald-400 p-4 rounded-2xl font-mono text-xs flex items-center justify-center space-x-3 shadow-inner border border-slate-800">
                   <RefreshCw size={16} className="animate-spin text-emerald-400" />
                   <span>{restoreStatus}</span>
                </div>
             )}
          </div>
        )}

        {activeTab === 'reset' && (
          <div className="max-w-6xl mx-auto space-y-6">
             <div className="bg-slate-900 text-white p-6 rounded-2xl border border-slate-800 shadow-xl text-left">
                <div className="flex items-center space-x-3 mb-2">
                   <RotateCcw className="text-rose-500 animate-spin-slow" size={24} />
                   <h2 className="text-base font-black uppercase tracking-tight italic">
                      Software Reset Control Board
                   </h2>
                </div>
                <p className="text-[10px] text-slate-300 font-medium uppercase tracking-wider">
                   Please use the 10-step detailed software reset procedure below or select a modular quick action.
                </p>
             </div>

             {/* Modular Reset Shortcuts */}
             <div className="bg-white p-6 rounded-2xl border border-slate-200 shadow-sm space-y-4 text-left">
                <div className="flex items-center justify-between border-b border-slate-100 pb-3">
                   <div className="flex items-center space-x-2">
                      <Trash2 className="text-rose-600" size={18} />
                      <h3 className="text-xs font-black uppercase tracking-wider text-slate-900">
                         Modular Reset Quick Actions
                      </h3>
                   </div>
                   <span className="text-[9px] font-black uppercase tracking-widest text-slate-400">Direct Supabase Sync</span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-5 gap-3">
                   <button
                      type="button"
                      onClick={() => handleModuleReset('daily', 'Daily Transactions')}
                      disabled={resetModuleLoading !== null || isDayEnded}
                      title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                      className="p-3.5 bg-rose-50 hover:bg-rose-100 text-rose-800 border border-rose-200 rounded-xl font-black text-[9px] uppercase tracking-wider flex flex-col items-center text-center space-y-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                      <RotateCcw size={16} className={resetModuleLoading === 'daily' ? 'animate-spin' : ''} />
                      <span>1. Reset Daily Entries</span>
                      <span className="text-[7px] text-rose-600 font-medium">Clear Cash & Ledger Logs</span>
                   </button>

                   <button
                      type="button"
                      onClick={() => handleModuleReset('ledgers', 'Ledger Accounts')}
                      disabled={resetModuleLoading !== null || isDayEnded}
                      title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                      className="p-3.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 rounded-xl font-black text-[9px] uppercase tracking-wider flex flex-col items-center text-center space-y-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                      <RotateCcw size={16} className={resetModuleLoading === 'ledgers' ? 'animate-spin' : ''} />
                      <span>2. Reset Ledger Masters</span>
                      <span className="text-[7px] text-amber-600 font-medium">Clear Master Account Groups</span>
                   </button>

                   <button
                      type="button"
                      onClick={() => handleModuleReset('hr', 'Payroll & HR Data')}
                      disabled={resetModuleLoading !== null || isDayEnded}
                      title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                      className="p-3.5 bg-blue-50 hover:bg-blue-100 text-blue-800 border border-blue-200 rounded-xl font-black text-[9px] uppercase tracking-wider flex flex-col items-center text-center space-y-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                      <RotateCcw size={16} className={resetModuleLoading === 'hr' ? 'animate-spin' : ''} />
                      <span>3. Reset Payroll & HR</span>
                      <span className="text-[7px] text-blue-600 font-medium">Clear Leaves & Slips</span>
                   </button>

                   <button
                      type="button"
                      onClick={() => handleModuleReset('notices', 'Notices & Documents')}
                      disabled={resetModuleLoading !== null || isDayEnded}
                      title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                      className="p-3.5 bg-purple-50 hover:bg-purple-100 text-purple-800 border border-purple-200 rounded-xl font-black text-[9px] uppercase tracking-wider flex flex-col items-center text-center space-y-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed"
                   >
                      <RotateCcw size={16} className={resetModuleLoading === 'notices' ? 'animate-spin' : ''} />
                      <span>4. Reset Docs & Notices</span>
                      <span className="text-[7px] text-purple-600 font-medium">Clear Uploads & Announcements</span>
                   </button>

                   <button
                      type="button"
                      onClick={() => handleModuleReset('full', 'Full Master Database')}
                      disabled={resetModuleLoading !== null || isDayEnded}
                      title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                      className="p-3.5 bg-slate-900 hover:bg-rose-700 text-white border border-slate-950 rounded-xl font-black text-[9px] uppercase tracking-wider flex flex-col items-center text-center space-y-1.5 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed shadow-md"
                   >
                      <Trash2 size={16} className={resetModuleLoading === 'full' ? 'animate-spin text-rose-400' : 'text-rose-400'} />
                      <span>5. Full Factory Reset</span>
                      <span className="text-[7px] text-rose-300 font-medium">Full Master Database Wipe</span>
                   </button>
                </div>
             </div>

             <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 text-slate-800 font-sans text-left">
                {/* Left Column: Steps 1 to 5 (Setup, Backup & Verification) */}
                <div className="space-y-6">
                   {/* Step 1: Date Range */}
                   <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center space-x-2 border-b border-slate-50 pb-2">
                         <span className="w-5 h-5 bg-slate-950 text-white rounded-full flex items-center justify-center font-black text-xs">1</span>
                         <h4 className="text-xs font-black uppercase tracking-tight text-slate-950">
                            Determine Reset Dates
                         </h4>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest">
                         Select the target branch and date range for the data you want to permanently clear.
                      </p>
                      <DayEndFieldset>
                      <div className="space-y-3">
                         <div>
                            <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">Target Branch</span>
                            <select
                               value={resetBranchId}
                               onChange={e => setResetBranchId(e.target.value)}
                               className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3 font-bold text-xs text-slate-800 outline-none focus:border-rose-500 focus:bg-white cursor-pointer"
                            >
                               <option value="ALL">All Branches (System-Wide Wipe)</option>
                               {branches.map(b => (
                                  <option key={b.id} value={b.id}>{b.name} ({b.code})</option>
                               ))}
                            </select>
                         </div>
                         <div className="grid grid-cols-2 gap-4">
                            <div>
                               <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">From Date</span>
                               <NepaliDatePicker value={resetFromDate} onChange={setResetFromDate} className="w-full" />
                            </div>
                            <div>
                               <span className="text-[8px] font-black text-slate-500 uppercase tracking-widest block mb-1">To Date</span>
                               <NepaliDatePicker value={resetToDate} onChange={setResetToDate} className="w-full" />
                            </div>
                         </div>
                      </div>
                      </DayEndFieldset>
                   </div>

                   {/* Step 2 & 3: Backup Operations */}
                   <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center space-x-2 border-b border-slate-50 pb-2">
                         <span className="w-5 h-5 bg-slate-950 text-white rounded-full flex items-center justify-center font-black text-xs">2</span>
                         <h4 className="text-xs font-black uppercase tracking-tight text-slate-950">
                            Backup & Save Safely
                         </h4>
                      </div>
                      <p className="text-[10px] text-slate-500 font-bold uppercase tracking-widest leading-relaxed">
                         Ensure you have created a backup before proceeding with reset.
                      </p>

                      <button 
                         onClick={handleBackup}
                         disabled={backupLoading}
                         className="w-full h-11 bg-slate-900 text-white rounded-xl flex items-center justify-center space-x-2 font-black uppercase text-[9px] tracking-[0.15em] shadow-md hover:bg-blue-600 transition-all active:scale-95 disabled:opacity-50"
                      >
                         <Download size={14} className={backupLoading ? 'animate-bounce' : ''} />
                         <span>{backupLoading ? 'Generating Backup...' : 'Download Master Backup'}</span>
                      </button>

                      <div className="space-y-2 pt-2 border-t border-slate-50">
                         <label className={`flex items-start space-x-2.5 p-1.5 rounded hover:bg-slate-50 transition-all ${isDayEnded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input 
                               type="checkbox" 
                               disabled={isDayEnded}
                               checked={isBackupTaken} 
                               onChange={e => setIsBackupTaken(e.target.checked)} 
                               className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5"
                            />
                            <span className="text-[9px] font-bold uppercase text-slate-700 leading-none">
                               1. I have downloaded the required backup file
                            </span>
                         </label>

                         <label className={`flex items-start space-x-2.5 p-1.5 rounded hover:bg-slate-50 transition-all ${isDayEnded || !isBackupTaken ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                            <input 
                               type="checkbox" 
                               disabled={!isBackupTaken || isDayEnded}
                               checked={isBackupSaved} 
                               onChange={e => setIsBackupSaved(e.target.checked)} 
                               className="mt-0.5 rounded border-slate-300 text-rose-600 focus:ring-rose-500 h-3.5 w-3.5 disabled:opacity-40"
                            />
                            <span className={`text-[9px] font-bold uppercase leading-none ${!isBackupTaken ? 'text-slate-400' : 'text-slate-700'}`}>
                               2. Backup file is safely verified and saved on my device
                            </span>
                         </label>
                      </div>
                   </div>

                   {/* Step 4 & 5: Verification & Open Menu info */}
                   <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-3">
                      <div className="flex items-center space-x-2 border-b border-slate-50 pb-2">
                         <span className="w-5 h-5 bg-slate-950 text-white rounded-full flex items-center justify-center font-black text-xs">4</span>
                         <h4 className="text-xs font-black uppercase tracking-tight text-slate-950">
                            Menu & Date Audit
                         </h4>
                      </div>
                      <div className="bg-slate-50 p-3.5 rounded-xl space-y-1.5 text-left">
                         <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-500">
                            <span>Target Branch:</span>
                            <span className={`px-2 py-0.5 rounded border font-bold ${
                               resetBranchId === 'ALL'
                                 ? 'text-rose-700 bg-rose-50 border-rose-200'
                                 : 'text-indigo-700 bg-indigo-50 border-indigo-200'
                            }`}>
                               {getSelectedResetBranchLabel(resetBranchId)}
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-500">
                            <span>Target Range:</span>
                            <span className="text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-100 font-mono">
                               {resetFromDate} to {resetToDate}
                            </span>
                         </div>
                         <div className="flex justify-between items-center text-[9px] font-black uppercase text-slate-500 pt-0.5">
                            <span>Status:</span>
                            {isBackupTaken && isBackupSaved ? (
                               <span className="text-emerald-600 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-100">
                                  Ready for Reset
                               </span>
                            ) : (
                               <span className="text-amber-600 bg-amber-50 px-2 py-0.5 rounded border border-amber-100">
                                  Backup Required
                               </span>
                            )}
                         </div>
                      </div>
                   </div>
                </div>

                {/* Right Column: Steps 6 to 10 (Execution, Progress log, restart, verification) */}
                <div className="space-y-6">
                   {/* Step 6 & 7: Action & Progress Terminal */}
                   <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center space-x-2 border-b border-slate-50 pb-2">
                         <span className="w-5 h-5 bg-slate-950 text-white rounded-full flex items-center justify-center font-black text-xs">6</span>
                         <h4 className="text-xs font-black uppercase tracking-tight text-slate-950">
                            Execute Reset & Monitor Progress
                         </h4>
                      </div>
                      
                      <div className="bg-rose-50 border border-rose-100 rounded-xl p-3.5 text-rose-800 text-[10px] font-medium leading-relaxed uppercase">
                         <span className="font-black block text-[11px] mb-1">⚠️ CRITICAL WARNING:</span>
                         Executing reset will permanently wipe all balances, daily registry entries, and ledger transactions for the selected range ({getSelectedResetBranchLabel(resetBranchId)}) from Supabase and Local Storage.
                      </div>

                      <button
                         type="button"
                         onClick={runDetailedSoftwareReset}
                         disabled={resetLogsInProgress || isDayEnded}
                         title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                         className={`w-full h-14 rounded-xl flex items-center justify-center space-x-2 font-black uppercase text-[10px] tracking-[0.2em] shadow-md transition-all active:scale-95 border-b-4 ${
                            resetLogsInProgress || isDayEnded
                               ? 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed border-b-slate-200'
                               : 'bg-rose-600 text-white border-rose-800 hover:bg-rose-700'
                         }`}
                      >
                         <RefreshCw className={resetLogsInProgress ? 'animate-spin' : ''} size={16}/>
                         <span>Permanently Wipe Daily Registry Data</span>
                      </button>

                      {/* Live Logger Console */}
                      {(resetLogsInProgress || resetLogMessages.length > 0) && (
                         <div className="space-y-1.5">
                            <div className="flex justify-between items-center text-[8px] font-black uppercase text-slate-400">
                               <span>System Telemetry Log</span>
                               {resetLogsInProgress && <span className="animate-pulse text-blue-500">Processing...</span>}
                            </div>
                            <div className="bg-slate-950 text-emerald-400 font-mono text-[9px] p-4 rounded-xl max-h-48 overflow-y-auto text-left shadow-inner border border-slate-800 space-y-1">
                               {resetLogMessages.map((msg, idx) => (
                                  <div key={idx} className="leading-relaxed border-b border-slate-900/40 pb-0.5 last:border-0">{msg}</div>
                               ))}
                            </div>
                         </div>
                      )}
                   </div>

                   {/* Step 8 & 9: Restart and Verification */}
                   <div className="bg-white p-6 rounded-2xl border border-slate-100 shadow-sm space-y-4">
                      <div className="flex items-center space-x-2 border-b border-slate-50 pb-2">
                         <span className="w-5 h-5 bg-slate-950 text-white rounded-full flex items-center justify-center font-black text-xs">8</span>
                         <h4 className="text-xs font-black uppercase tracking-tight text-slate-950">
                            Restart & Verification
                         </h4>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                         <button
                            disabled={!resetComplete}
                            onClick={() => window.location.reload()}
                            className={`h-12 rounded-xl flex items-center justify-center space-x-2 font-black uppercase text-[9px] tracking-[0.1em] shadow-sm transition-all ${
                               !resetComplete
                                 ? 'bg-slate-50 text-slate-300 border border-slate-100 cursor-not-allowed'
                                 : 'bg-slate-950 text-white hover:bg-slate-800 active:scale-95'
                            }`}
                         >
                            <RefreshCw size={14}/>
                            <span>Restart Application</span>
                         </button>

                         <label className={`h-12 border rounded-xl flex items-center px-4 space-x-2.5 cursor-pointer hover:bg-slate-50 transition-all ${
                            !resetComplete || isDayEnded ? 'opacity-50 cursor-not-allowed' : ''
                         }`}>
                            <input 
                               type="checkbox" 
                               disabled={!resetComplete || isDayEnded}
                               checked={verifiedPostReset}
                               onChange={e => setVerifiedPostReset(e.target.checked)}
                               className="rounded border-slate-300 text-emerald-600 focus:ring-emerald-500 h-3.5 w-3.5"
                            />
                            <span className="text-[9px] font-black uppercase text-slate-700 leading-none">
                               9. I have verified balances and transactions post-reset
                            </span>
                         </label>
                      </div>
                   </div>

                   {/* Step 10: Disaster Recovery / Restore Info */}
                   <div className="bg-emerald-50/50 border border-dashed border-emerald-200 p-5 rounded-2xl space-y-2">
                      <div className="flex items-center space-x-2 text-emerald-800">
                         <CheckCircle2 size={16} />
                         <span className="text-[10px] font-black uppercase tracking-wider">10. Emergency Data Recovery</span>
                      </div>
                      <p className="text-[9px] text-slate-600 font-medium leading-relaxed uppercase">
                         If any discrepancy or issue occurs after the reset, you can restore the complete system data using the backup file downloaded in Step 2 via the **'Backup'** menu.
                      </p>
                   </div>
                </div>
             </div>
          </div>
        )}

        {activeTab === 'logs' && <AuditLogPage />}
      </div>

      {/* View Branch Modal */}
      {viewingBranch && (
         <div className="fixed inset-0 bg-slate-950/40 backdrop-blur-md z-[2000] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-lg rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-100">
               <div className="p-6">
                  <div className="flex justify-between items-center mb-5 pb-3 border-b border-slate-100">
                     <div className="flex items-center space-x-2.5">
                        <div className="p-2 bg-orange-50 text-orange-600 rounded-xl"><Building2 size={18}/></div>
                        <div>
                           <h3 className="text-base font-black italic tracking-tighter text-slate-900 uppercase">Branch Details</h3>
                           <p className="text-[10px] font-bold text-slate-400">शाखाको विस्तृत विवरण (Bilingual Record)</p>
                        </div>
                     </div>
                     <button onClick={() => setViewingBranch(null)} className="p-1.5 bg-slate-50 hover:bg-slate-100 text-slate-400 hover:text-slate-600 rounded-lg transition-colors">
                        <X size={16} />
                     </button>
                  </div>

                  <div className="space-y-3.5 text-xs">
                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                           <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Branch Name (English)</span>
                           <span className="text-sm font-black text-slate-900 uppercase">{viewingBranch.name}</span>
                        </div>
                        <div>
                           <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">शाखाको नाम (नेपाली)</span>
                           <span className="text-sm font-bold text-emerald-700">{viewingBranch.nameNp || '-'}</span>
                        </div>
                     </div>

                     <div className="grid grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                           <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Branch Code (EN / NP)</span>
                           <span className="text-xs font-mono font-black text-slate-800 bg-white px-2 py-0.5 rounded border border-slate-200 uppercase">{viewingBranch.code}</span>
                           {viewingBranch.codeNp && <span className="ml-2 text-xs font-bold text-slate-600">{viewingBranch.codeNp}</span>}
                        </div>
                        <div>
                           <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Status (अवस्था)</span>
                           <span className={`inline-block px-2.5 py-0.5 rounded-full text-[9px] uppercase tracking-wider font-black ${viewingBranch.status === 'Active' ? 'bg-emerald-100 text-emerald-700 border border-emerald-200' : 'bg-rose-100 text-rose-700 border border-rose-200'}`}>
                              {viewingBranch.status === 'Active' ? 'Active (सक्रिय)' : 'Inactive (निष्क्रिय)'}
                           </span>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                           <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Branch Type (English)</span>
                           <span className="text-xs font-bold text-slate-800">{viewingBranch.branchType || 'Branch Office'}</span>
                        </div>
                        <div>
                           <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">शाखाको प्रकार (नेपाली)</span>
                           <span className="text-xs font-bold text-slate-800">{viewingBranch.branchTypeNp || 'शाखा कार्यालय'}</span>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                           <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Address (English)</span>
                           <span className="text-xs font-semibold text-slate-700">{viewingBranch.location || 'Not Specified'}</span>
                        </div>
                        <div>
                           <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">ठेगाना (नेपाली)</span>
                           <span className="text-xs font-semibold text-slate-700">{viewingBranch.locationNp || '-'}</span>
                        </div>
                     </div>

                     <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 p-3 bg-slate-50 rounded-2xl border border-slate-100">
                        <div>
                           <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Official Email</span>
                           <span className="text-xs font-mono text-slate-700">{viewingBranch.email || '-'}</span>
                        </div>
                        {viewingBranch.createdAt && (
                           <div>
                              <span className="block text-[9px] font-black uppercase text-slate-400 tracking-wider mb-0.5">Established At</span>
                              <span className="text-[11px] text-slate-500 font-mono">{new Date(viewingBranch.createdAt).toLocaleString()}</span>
                           </div>
                        )}
                     </div>
                  </div>

                  <div className="flex justify-end pt-5">
                     <button onClick={() => setViewingBranch(null)} className="bg-slate-900 text-white px-7 py-2 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md hover:bg-blue-600 transition-all">Close</button>
                  </div>
               </div>
            </div>
         </div>
      )}

      {/* Branch Modal */}
      {showBranchModal && (
         <div className="fixed inset-0 bg-slate-950/50 backdrop-blur-md z-[2000] flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white w-full max-w-2xl rounded-3xl shadow-2xl overflow-hidden animate-in zoom-in-95 duration-200 border border-slate-200 my-auto">
               <div className="bg-slate-900 text-white px-6 py-4 flex items-center justify-between">
                  <div className="flex items-center space-x-2.5">
                     <Building2 size={18} className="text-emerald-400" />
                     <div>
                        <h3 className="text-base font-black italic tracking-tight uppercase leading-none">
                           {editingBranch?.id ? 'Update Branch Record' : 'Branch Registration'}
                        </h3>
                        <p className="text-[10px] text-slate-300 font-semibold mt-0.5">
                           नेपाली र अंग्रेजी दुवै भाषामा शाखा विवरण राख्नुहोस् (Bilingual Branch Setup)
                        </p>
                     </div>
                  </div>
                  <button onClick={() => setShowBranchModal(false)} className="p-1.5 rounded-lg bg-white/10 hover:bg-white/20 text-white transition-colors">
                     <X size={16} />
                  </button>
               </div>

               <div className="p-6 space-y-4 text-xs">
                  <DayEndFieldset className="space-y-4">
                  {/* Branch Name (EN + NP) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Branch Name (English) <span className="text-rose-500">*</span></label>
                        <input
                           type="text"
                           placeholder="e.g. Ratauli Head Office"
                           value={editingBranch?.name || ''}
                           onChange={e => setEditingBranch({...editingBranch, name: e.target.value})}
                           className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all"
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">शाखाको नाम (नेपाली)</label>
                        <input
                           type="text"
                           placeholder="उदा. रतौली मुख्य कार्यालय"
                           value={editingBranch?.nameNp || ''}
                           onChange={e => setEditingBranch({...editingBranch, nameNp: e.target.value})}
                           className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-bold text-xs outline-none focus:border-emerald-500 focus:bg-white transition-all"
                        />
                     </div>
                  </div>

                  {/* Branch Code (EN + NP) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Branch Code (English) <span className="text-rose-500">*</span></label>
                        <input
                           type="text"
                           placeholder="e.g. C01"
                           value={editingBranch?.code || ''}
                           onChange={e => setEditingBranch({...editingBranch, code: e.target.value})}
                           className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-mono font-bold text-xs uppercase outline-none focus:border-blue-500 focus:bg-white transition-all"
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">शाखा कोड (नेपाली)</label>
                        <input
                           type="text"
                           placeholder="उदा. सी-०१"
                           value={editingBranch?.codeNp || ''}
                           onChange={e => setEditingBranch({...editingBranch, codeNp: e.target.value})}
                           className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-bold text-xs outline-none focus:border-emerald-500 focus:bg-white transition-all"
                        />
                     </div>
                  </div>

                  {/* Branch Type (EN + NP) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Branch Type (English)</label>
                        <select
                           value={editingBranch?.branchType || 'Branch Office'}
                           onChange={e => {
                              const val = e.target.value;
                              setEditingBranch({
                                 ...editingBranch,
                                 branchType: val,
                                 branchTypeNp: BRANCH_TYPE_NP_MAP[val] || editingBranch?.branchTypeNp || ''
                              });
                           }}
                           className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-bold text-xs outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                        >
                           <option value="Head Office">Head Office</option>
                           <option value="Branch Office">Branch Office</option>
                           <option value="Sub-Branch">Sub-Branch</option>
                           <option value="Extension Counter">Extension Counter</option>
                        </select>
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">शाखाको प्रकार (नेपाली)</label>
                        <input
                           type="text"
                           placeholder="उदा. मुख्य कार्यालय / शाखा कार्यालय"
                           value={editingBranch?.branchTypeNp || ''}
                           onChange={e => setEditingBranch({...editingBranch, branchTypeNp: e.target.value})}
                           className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-bold text-xs outline-none focus:border-emerald-500 focus:bg-white transition-all"
                        />
                     </div>
                  </div>

                  {/* Address (EN + NP) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Address (English)</label>
                        <input
                           type="text"
                           placeholder="e.g. Pipra-6, Ratauli, Mahottari"
                           value={editingBranch?.location || ''}
                           onChange={e => setEditingBranch({...editingBranch, location: e.target.value})}
                           className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all"
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">ठेगाना (नेपाली)</label>
                        <input
                           type="text"
                           placeholder="उदा. पिपरा-६, रतौली, महोत्तरी"
                           value={editingBranch?.locationNp || ''}
                           onChange={e => setEditingBranch({...editingBranch, locationNp: e.target.value})}
                           className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-bold text-xs outline-none focus:border-emerald-500 focus:bg-white transition-all"
                        />
                     </div>
                  </div>

                  {/* Email & Status (EN + NP) */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3.5">
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Official Email (इमेल)</label>
                        <input
                           type="email"
                           placeholder="e.g. branch@rataulisaccos.com"
                           value={editingBranch?.email || ''}
                           onChange={e => setEditingBranch({...editingBranch, email: e.target.value})}
                           className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-mono font-bold text-xs outline-none focus:border-blue-500 focus:bg-white transition-all"
                        />
                     </div>
                     <div className="space-y-1">
                        <label className="text-[10px] font-black uppercase text-slate-500 ml-1">Status (अवस्था - EN / NP)</label>
                        <select
                           value={editingBranch?.status || 'Active'}
                           onChange={e => setEditingBranch({...editingBranch, status: e.target.value as 'Active' | 'Inactive'})}
                           className="w-full h-10 bg-slate-50 border border-slate-200 rounded-xl px-3.5 font-bold text-xs outline-none focus:border-blue-500 focus:bg-white cursor-pointer"
                        >
                           <option value="Active">Active (सक्रिय)</option>
                           <option value="Inactive">Inactive (निष्क्रिय)</option>
                        </select>
                     </div>
                  </div>
                  </DayEndFieldset>

                  <div className="flex justify-end space-x-3 pt-4 border-t border-slate-100">
                     <button type="button" onClick={() => setShowBranchModal(false)} className="px-6 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest text-slate-500 border border-slate-200 hover:bg-slate-50">Cancel</button>
                     <button type="button" disabled={isDayEnded} title={isDayEnded ? getDayEndedBlockMessage() : undefined} onClick={saveBranch} className="bg-slate-900 text-white px-7 py-2.5 rounded-xl font-black uppercase text-[10px] tracking-widest shadow-md hover:bg-emerald-600 transition-all active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer">Save Branch</button>
                  </div>
               </div>
            </div>
         </div>
      )}

      <ConfirmationModal 
        isOpen={confirmDelete?.isOpen || false}
        title={confirmDelete?.type === 'reset' ? 'System Reset' : confirmDelete?.type === 'branch' ? 'Delete Branch' : 'Delete Role'}
        message={confirmDelete?.type === 'reset' ? `Are you sure you want to reset all transactions for ${confirmDelete?.date}? This action cannot be undone.` : `Are you sure you want to delete this ${confirmDelete?.type}?`}
        confirmLabel="Yes"
        cancelLabel="No"
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmationModal
        isOpen={resetConfirmModal?.isOpen || false}
        title={resetConfirmModal?.title || 'Confirm Action'}
        message={resetConfirmModal?.message || 'Are you sure you want to proceed?'}
        confirmLabel="Yes"
        cancelLabel="No"
        variant="danger"
        onConfirm={() => {
          if (resetConfirmModal?.onConfirm) {
            resetConfirmModal.onConfirm();
          } else {
            setResetConfirmModal(null);
          }
        }}
        onCancel={() => {
          if (resetConfirmModal?.onCancel) {
            resetConfirmModal.onCancel();
          } else {
            setResetConfirmModal(null);
          }
        }}
      />

      {actionFeedback && (
        <div className="fixed bottom-5 right-5 z-[10000] max-w-md animate-in slide-in-from-bottom-3 fade-in duration-200">
          <div className={`px-4 py-3 rounded-xl shadow-2xl border flex items-center gap-3 text-xs font-bold ${
            actionFeedback.type === 'error'
              ? 'bg-rose-950 text-white border-rose-700'
              : 'bg-emerald-900 text-white border-emerald-700'
          }`}>
            <span className="flex-1">{actionFeedback.message}</span>
            <button
              type="button"
              onClick={() => setActionFeedback(null)}
              className="p-1 rounded hover:bg-white/10 text-white/80 hover:text-white cursor-pointer"
            >
              <X size={14} />
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdminCenter;