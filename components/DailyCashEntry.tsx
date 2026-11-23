import React, { useState, useEffect, useMemo } from 'react';
import { 
  Save, CheckCircle2, ArrowRightLeft, Plus, Trash2, 
  X, Landmark, ChevronDown, 
  Scale, Calculator, Edit2, History, AlertCircle, Lock, Banknote,
  ShieldCheck, Activity, LayoutGrid, Building2, Layers, Check, Receipt,
  ArrowUpRight, ArrowDownRight, TrendingUp, TrendingDown, Mail, Send,
  AlertTriangle, User as UserIcon, Eye, CornerDownLeft
} from 'lucide-react';
import { ConfirmationModal } from './ConfirmationModal';
import { 
  DailyData, 
  RemittanceType, 
  ReceivablePayableEntry, 
  RemittanceEntry,
  DenoAdjustmentEntry,
  OfficeAccountEntry,
  OtherAdjustmentEntry,
  LedgerAccount,
  Branch,
  Employee,
  User,
  SystemSettings
} from '../types';
import { storageService } from '../services/storageService';
import { toBsDateString, normalizeBranchId } from '../services/supabaseService';
import { DENOMINATIONS, DEFAULT_DENOMINATIONS } from '../constants';
import { NepaliDatePicker } from './NepaliDatePicker';
import { useAuth } from '../AuthContext';
import NepaliDate from 'nepali-date-converter';
import { sendLedgerNotificationEmailApi } from '../services/pdfEmailService';
import {
  isBackDateBlockedForEntry,
  getBackDateBlockedMessage,
  getStoredSystemSettings
} from '../utils/backDateControl';
import {
  isDayEndedForBranch,
  getDayEndedBlockMessage,
  useDayEndLock
} from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

// Synchronous Instant Cache Loaders (0ms latency on page navigation)
const getInitialHistoryData = (branchId: string): Record<string, DailyData> => {
  try {
    const raw = localStorage.getItem('saccos_db_daily_data');
    if (raw) {
      const db = JSON.parse(raw);
      const res: Record<string, DailyData> = {};
      const targetNormalized = normalizeBranchId(branchId);

      Object.keys(db).forEach(k => {
        if (k === 'FD_RECORDS_STORE' || k === 'OFFICE_EXPENSES_STORE' || k === 'SAVED_EXPENSE_SHEETS_STORE' || k === 'FIXED_OFFICE_EXPENSE_CONFIGS') return;
        const item = db[k];
        if (!item) return;
        const itemBranch = item.branchId || (k.includes('_') ? k.split('_').slice(1).join('_') : 'main');
        if (normalizeBranchId(itemBranch) === targetNormalized) {
          const bsKey = toBsDateString(item.date || k.split('_')[0] || k);
          res[bsKey] = item;
        }
      });
      return res;
    }
  } catch (e) {}
  return {};
};

const getInitialDayData = (date: string, branchId: string): DailyData => {
  try {
    const raw = localStorage.getItem('saccos_db_daily_data');
    if (raw) {
      const db = JSON.parse(raw);
      const bsDate = toBsDateString(date);
      const targetNormalized = normalizeBranchId(branchId);

      const key1 = `${bsDate}_${branchId}`;
      if (db[key1] && normalizeBranchId(db[key1].branchId || branchId) === targetNormalized) {
        return { ...db[key1], date: bsDate, branchId };
      }

      const direct = db[bsDate];
      if (direct && normalizeBranchId(direct.branchId || 'main') === targetNormalized) {
        return { ...direct, date: bsDate, branchId };
      }

      const match = Object.values(db).find((v: any) => 
        toBsDateString(v?.date) === bsDate && normalizeBranchId(v?.branchId || 'main') === targetNormalized
      );
      if (match) return { ...(match as DailyData), date: bsDate, branchId };
    }
  } catch (e) {}
  return {
    date: toBsDateString(date),
    branchId,
    denominations: JSON.parse(JSON.stringify(DEFAULT_DENOMINATIONS)),
    denoAdjustments: [],
    transactions: [],
    officeTransactions: [],
    remittances: [],
    vaultTransactions: []
  };
};

const isNonCounterMovementTx = (t: any): boolean => {
  if (!t) return false;
  if (t.origin === 'income_expense' || t.origin === 'office_expense' || t.origin === 'report' || t.origin === 'back_office' || t.origin === 'transferred') return true;
  if (t.transferredToBackOffice === true || t.transferredToConsolidated === true) return true;
  if (t.id && (t.id.startsWith('offexp_') || t.id.includes('offexp') || t.id.startsWith('payroll_') || t.id.startsWith('auto_other_diff_') || t.id.includes('other_diff'))) return true;
  const rem = (t.remarks || '').toLowerCase();
  if (
    rem.includes('office operating') ||
    rem.includes('office expenses') ||
    rem.includes('office rent') ||
    rem.includes('office cleaner') ||
    rem.includes('office khaja') ||
    rem.includes('staff payroll') ||
    rem.includes('staff net salary')
  ) {
    return true;
  }
  const head = (t.head || '').trim().toLowerCase();
  if (head.includes('photocopy') || head.includes('kitchen') || head === 'remittance' || head.includes('cash diff') || head.includes('payable cash') || head.includes('receivable cash')) return true;
  return false;
};

const calculateOpeningFromHistory = (date: string, history: Record<string, DailyData>): number => {
  try {
    const targetBs = toBsDateString(date);
    const dates = Array.from(new Set(Object.keys(history).map(toBsDateString))).filter(d => d < targetBs).sort();
    
    // Check if there are denomination notes from previous days
    let lastDenoBalance = 0;
    let hasDenoHistory = false;
    dates.forEach(d => {
      const dayData = history[d] || Object.values(history).find((v: any) => toBsDateString(v?.date) === d);
      if (!dayData) return;
      (dayData.denoAdjustments || []).forEach((a: any) => {
        hasDenoHistory = true;
        const amt = (Number(a.value) || 0) * (Number(a.quantity) || 0);
        if (a.type === 'add') lastDenoBalance += amt;
        else if (a.type === 'less') lastDenoBalance -= amt;
      });
    });

    if (hasDenoHistory && lastDenoBalance > 0) {
      return lastDenoBalance;
    }

    let balance = 0;
    dates.forEach(d => {
      const dayData = history[d] || Object.values(history).find((v: any) => toBsDateString(v?.date) === d);
      if (!dayData) return;
      let dayCredit = 0;
      let dayDebit = 0;
      (dayData.officeTransactions || []).forEach((t: any) => {
        if (isNonCounterMovementTx(t)) return;
        const amt = Number(t.amount) || 0;
        if (t.type === 'in') dayCredit += amt;
        else dayDebit += amt;
      });
      (dayData.transactions || []).forEach((t: any) => {
        if (t.origin === 'income_expense' || t.origin === 'office_expense' || t.origin === 'report' || t.origin === 'back_office' || t.origin === 'transferred' || t.transferredToBackOffice === true || t.transferredToConsolidated === true) return;
        const amt = Number(t.amount) || 0;
        if (t.type === 'in') dayCredit += amt;
        else dayDebit += amt;
      });
      (dayData.remittances || []).forEach((r: any) => {
        if (r.origin === 'report' || r.origin === 'back_office' || r.origin === 'transferred' || r.transferredToBackOffice === true || r.transferredToConsolidated === true) return;
        const amt = Number(r.amount) || 0;
        if (r.type === RemittanceType.SEND) dayCredit += amt;
        else dayDebit += amt;
      });
      (dayData.vaultTransactions || []).forEach((vt: any) => {
        const amt = Number(vt.amount) || 0;
        const isTeller = vt.source === 'Teller' || vt.partyType === 'Teller Desk' || (!vt.source && !vt.partyType);
        if (isTeller) {
          if (vt.type === 'in') dayDebit += amt;
          else if (vt.type === 'out') dayCredit += amt;
        }
      });
      balance = balance + dayCredit - dayDebit;
    });
    return balance;
  } catch (e) {
    return 0;
  }
};

const calculateDayMovement = (dayData: DailyData): number => {
  if (!dayData) return 0;
  let dayCredit = 0;
  let dayDebit = 0;
  (dayData.officeTransactions || []).forEach((t: any) => {
    if (isNonCounterMovementTx(t)) return;
    const amt = Number(t.amount) || 0;
    if (t.type === 'in') dayCredit += amt;
    else dayDebit += amt;
  });
  (dayData.transactions || []).forEach((t: any) => {
    if (t.origin === 'income_expense' || t.origin === 'office_expense' || t.origin === 'report' || t.origin === 'back_office' || t.origin === 'transferred' || t.transferredToBackOffice === true || t.transferredToConsolidated === true) return;
    const amt = Number(t.amount) || 0;
    if (t.type === 'in') dayCredit += amt;
    else dayDebit += amt;
  });
  (dayData.remittances || []).forEach((r: any) => {
    if (r.origin === 'report' || r.origin === 'back_office' || r.origin === 'transferred' || r.transferredToBackOffice === true || r.transferredToConsolidated === true) return;
    const amt = Number(r.amount) || 0;
    if (r.type === RemittanceType.SEND) dayCredit += amt;
    else dayDebit += amt;
  });
  (dayData.vaultTransactions || []).forEach((vt: any) => {
    const isTeller = vt.source === 'Teller' || vt.partyType === 'Teller Desk' || (!vt.source && !vt.partyType);
    if (isTeller) {
      const amt = Number(vt.amount) || 0;
      if (vt.type === 'in') dayDebit += amt;
      else if (vt.type === 'out') dayCredit += amt;
    }
  });
  return dayCredit - dayDebit;
};

const getInitialLedgerAccounts = (branchId: string): LedgerAccount[] => {
  try {
    const raw = localStorage.getItem('saccos_db_ledger_accounts');
    if (raw) {
      const list: LedgerAccount[] = JSON.parse(raw);
      if (Array.isArray(list)) {
        const targetNorm = normalizeBranchId(branchId);
        return list.filter(a => {
          if (!a || !a.id || String(a.id).startsWith('staff_')) return false;
          if (!branchId || branchId === 'all') return true;
          const aBranch = normalizeBranchId(a.branchId);
          const empBranch = a.employeeBranchId ? normalizeBranchId(a.employeeBranchId) : '';
          return aBranch === targetNorm || (empBranch !== '' && empBranch === targetNorm);
        });
      }
    }
  } catch (_e) {
    // ignore cache parse errors
  }
  return [];
};

const getInitialBranches = (): Branch[] => {
  try {
    const raw = localStorage.getItem('saccos_db_branches');
    if (raw) {
      const list: Branch[] = JSON.parse(raw);
      if (Array.isArray(list)) return list;
    }
  } catch (e) {}
  return [];
};

const getInitialSettings = (branchId: string): { isLocked: boolean; remittanceCompanies: string[] } => {
  try {
    const raw = localStorage.getItem('saccos_db_settings');
    if (raw) {
      const s = JSON.parse(raw);
      const branchSpecific = s?.remittanceCompaniesByBranch?.[branchId];
      const base = branchSpecific || s?.remittanceCompanies || [];
      const hidden = s?.hiddenRemittanceCompaniesByBranch?.[branchId] || [];
      return {
        isLocked: s?.masterLock || false,
        remittanceCompanies: base.filter((c: string) => !hidden.includes(c))
      };
    }
  } catch (e) {}
  return { isLocked: false, remittanceCompanies: [] };
};

const DailyCashEntry: React.FC = () => {
  const { user, branch, settings: authSettings } = useAuth();
  const currentBranchId = branch?.id || user?.branchId || 'main';
  
  const [selectedDate, setSelectedDate] = useState(() => {
    try {
      return new NepaliDate().format('YYYY-MM-DD');
    } catch (e) {
      return new Date().toISOString().split('T')[0];
    }
  });

  const [branchHistoryData, setBranchHistoryData] = useState<Record<string, DailyData>>(() => getInitialHistoryData(currentBranchId));
  const [ledgerAccounts, setLedgerAccounts] = useState<LedgerAccount[]>(() => getInitialLedgerAccounts(currentBranchId));
  const [allBranches, setAllBranches] = useState<Branch[]>(() => getInitialBranches());
  const [remittanceCompanies, setRemittanceCompanies] = useState<string[]>(() => getInitialSettings(currentBranchId).remittanceCompanies);
  const [isLocked, setIsLocked] = useState(() => getInitialSettings(currentBranchId).isLocked);
  const [openingBalance, setOpeningBalance] = useState(() => calculateOpeningFromHistory(selectedDate, getInitialHistoryData(currentBranchId)));
  const [data, setData] = useState<DailyData>(() => getInitialDayData(selectedDate, currentBranchId));
  const [, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const [systemSettings, setSystemSettings] = useState<SystemSettings | null>(null);
  const [policyTick, setPolicyTick] = useState(0);
  const isDayEnded = useDayEndLock(currentBranchId);

  useEffect(() => {
    const syncPolicy = () => {
      const latest = getStoredSystemSettings();
      if (latest) setSystemSettings(latest);
      setPolicyTick(t => t + 1);
    };
    window.addEventListener('settingsUpdated', syncPolicy);
    window.addEventListener('storage', syncPolicy);
    window.addEventListener('branchDayStatusChanged', syncPolicy);
    return () => {
      window.removeEventListener('settingsUpdated', syncPolicy);
      window.removeEventListener('storage', syncPolicy);
      window.removeEventListener('branchDayStatusChanged', syncPolicy);
    };
  }, [currentBranchId]);

  const isBackDateBlocked = useMemo(
    () => isBackDateBlockedForEntry(selectedDate, systemSettings || authSettings),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [selectedDate, systemSettings, authSettings, policyTick]
  );
  
  // Modal for immediate ledger transaction notification if employee doesn't have an email on file
  const [pendingEmailPrompt, setPendingEmailPrompt] = useState<{
    isOpen: boolean;
    recipientName: string;
    employeeCode?: string;
    transactionType: 'in' | 'out';
    amount: number;
    particular: string;
    previousBalance: number;
    updatedBalance: number;
    balanceType: 'payable' | 'receivable' | 'balanced';
    enteredEmail: string;
    isSending: boolean;
    matchedAccount?: LedgerAccount;
    matchedEmployee?: Employee;
  } | null>(null);
  
  const [denoGlobalMode, setDenoGlobalMode] = useState<'add' | 'less'>('add');
  const [denoQuantities, setDenoQuantities] = useState<Record<number, string>>({});
  const [remitGlobalMode, setRemitGlobalMode] = useState<RemittanceType>(RemittanceType.RECEIVE);
  const [remitAmounts, setRemitAmounts] = useState<Record<string, string>>({});
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [transferTarget, setTransferTarget] = useState<'main' | 'consolidated' | 'both'>('main');

  const [newOffice, setNewOffice] = useState({ 
    id: '',
    head: 'Saving' as OfficeAccountEntry['head'], 
    amount: '', 
    type: 'in' as 'in' | 'out',
    remarks: '',
    date: selectedDate
  });
  const [newTrans, setNewTrans] = useState({ id: '', name: '', amount: '', particular: '', type: 'out' as 'in' | 'out' });

  // Other adjustment multi-entry state & refs
  const [otherAmountInput, setOtherAmountInput] = useState<string>('');
  const [otherType, setOtherType] = useState<'add' | 'less'>('add');
  const [otherRemarksInput, setOtherRemarksInput] = useState<string>('');
  const [isOtherModalOpen, setIsOtherModalOpen] = useState(false);

  const otherAmountInputRef = React.useRef<HTMLInputElement>(null);
  const otherRemarksInputRef = React.useRef<HTMLInputElement>(null);

  // Sync other balance to officeTransactions for Income & Expense menu
  // (Payable -> Income Other; Receivable -> Expense Other)
  const syncOtherToOfficeTransactions = (
    currentOfficeTx: OfficeAccountEntry[],
    otherTotalSigned: number,
    targetDate: string,
    targetBranchId: string,
    entries: OtherAdjustmentEntry[]
  ): OfficeAccountEntry[] => {
    const base = (currentOfficeTx || []).filter(t => 
      t.id !== `auto_other_diff_${targetDate}` && 
      !t.id.startsWith('auto_other_diff_') &&
      !(t.origin === 'income_expense' && (t.head?.includes('Other Adjustment') || t.head?.includes('Other (Payable') || t.head?.includes('Other (Receivable')))
    );

    if (otherTotalSigned === 0) {
      return base;
    }

    const isPayable = otherTotalSigned > 0;
    const absAmount = Math.abs(otherTotalSigned);
    const narrations = entries
      .map(e => `${e.type === 'add' ? '+' : '-'}${e.amount} (${e.remarks || 'No remarks'})`)
      .join('; ');

    const autoEntry: OfficeAccountEntry = {
      id: `auto_other_diff_${targetDate}`,
      branchId: targetBranchId,
      head: isPayable ? 'Other (Payable Cash Diff)' : 'Other (Receivable Cash Diff)',
      amount: absAmount,
      type: isPayable ? 'in' : 'out',
      date: targetDate,
      remarks: narrations ? `Auto Day-end Other: ${narrations}` : (isPayable ? 'Payable cash difference to Income' : 'Receivable cash difference to Expense'),
      origin: 'income_expense',
      createdBy: 'system'
    };

    return [...base, autoEntry];
  };

  // Synthesize running list of Other adjustments with running balances
  const currentOtherEntries: OtherAdjustmentEntry[] = useMemo(() => {
    if (Array.isArray(data.otherEntries) && data.otherEntries.length > 0) {
      let running = 0;
      return data.otherEntries.map(e => {
        running += (e.type === 'add' ? e.amount : -e.amount);
        return {
          ...e,
          runningBalance: running
        };
      });
    }
    const legacyAmt = Number(data.otherAmount) || 0;
    if (legacyAmt > 0) {
      const isLess = data.otherType === 'less';
      const running = isLess ? -legacyAmt : legacyAmt;
      return [{
        id: 'legacy_other_entry',
        type: (data.otherType || 'add'),
        amount: legacyAmt,
        remarks: data.otherRemarks || 'Previous Other Adjustment',
        userName: 'Front Teller',
        date: selectedDate,
        timestamp: Date.now(),
        runningBalance: running
      }];
    }
    return [];
  }, [data.otherEntries, data.otherAmount, data.otherType, data.otherRemarks, selectedDate]);

  const otherTotalBalance = useMemo(() => {
    if (currentOtherEntries.length === 0) return 0;
    return currentOtherEntries[currentOtherEntries.length - 1].runningBalance || 0;
  }, [currentOtherEntries]);

  // Handle adding a new Other adjustment entry on Enter or submit
  const handleAddOtherEntry = () => {
    if (isLocked) return showToast('Session Locked', 'error');
    if (isDayEndedForBranch(currentBranchId)) return showToast(getDayEndedBlockMessage(), 'error');
    if (isBackDateBlockedForEntry(selectedDate, systemSettings || authSettings)) {
      return showToast(getBackDateBlockedMessage(selectedDate), 'error');
    }
    const amt = parseFloat(otherAmountInput);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      otherAmountInputRef.current?.focus();
      return;
    }

    const narration = otherRemarksInput.trim() || (otherType === 'add' ? 'Other Cash Add' : 'Other Cash Less');
    const authorName = user?.name || user?.email?.split('@')[0] || 'Front Teller';

    const newEntry: OtherAdjustmentEntry = {
      id: crypto.randomUUID(),
      type: otherType,
      amount: amt,
      remarks: narration,
      userName: authorName,
      userId: user?.id,
      timestamp: Date.now(),
      date: selectedDate,
      runningBalance: otherTotalBalance + (otherType === 'add' ? amt : -amt)
    };

    const baseEntries = Array.isArray(data.otherEntries) && data.otherEntries.length > 0
      ? data.otherEntries
      : (currentOtherEntries.length > 0 ? currentOtherEntries : []);

    const updatedEntries = [...baseEntries, newEntry];
    const newTotalSigned = updatedEntries.reduce((s, e) => s + (e.type === 'add' ? e.amount : -e.amount), 0);

    const syncedOffice = syncOtherToOfficeTransactions(
      data.officeTransactions || [],
      newTotalSigned,
      selectedDate,
      currentBranchId,
      updatedEntries
    );

    const updatedData: DailyData = {
      ...data,
      otherEntries: updatedEntries,
      otherAmount: Math.abs(newTotalSigned),
      otherType: newTotalSigned >= 0 ? 'add' : 'less',
      otherRemarks: narration,
      officeTransactions: syncedOffice
    };

    setData(updatedData);
    storageService.saveDayData(selectedDate, currentBranchId, updatedData).catch(err => {
      console.warn("Failed saving other adjustment:", err);
    });

    setOtherAmountInput('');
    setOtherRemarksInput('');
    setOtherType('add'); // default is always ADD
    otherAmountInputRef.current?.focus();
  };

  const handleDeleteOtherEntry = (entryId: string) => {
    if (isLocked) return showToast('Session Locked', 'error');
    if (isDayEndedForBranch(currentBranchId)) return showToast(getDayEndedBlockMessage(), 'error');
    if (isBackDateBlockedForEntry(selectedDate, systemSettings || authSettings)) {
      return showToast(getBackDateBlockedMessage(selectedDate), 'error');
    }
    const baseEntries = Array.isArray(data.otherEntries) && data.otherEntries.length > 0
      ? data.otherEntries
      : (currentOtherEntries.length > 0 ? currentOtherEntries : []);

    const updatedEntries = baseEntries.filter(e => e.id !== entryId);
    const newTotalSigned = updatedEntries.reduce((s, e) => s + (e.type === 'add' ? e.amount : -e.amount), 0);

    const syncedOffice = syncOtherToOfficeTransactions(
      data.officeTransactions || [],
      newTotalSigned,
      selectedDate,
      currentBranchId,
      updatedEntries
    );

    const updatedData: DailyData = {
      ...data,
      otherEntries: updatedEntries,
      otherAmount: Math.abs(newTotalSigned),
      otherType: newTotalSigned >= 0 ? 'add' : 'less',
      otherRemarks: updatedEntries.length > 0 ? updatedEntries[updatedEntries.length - 1].remarks : '',
      officeTransactions: syncedOffice
    };

    setData(updatedData);
    storageService.saveDayData(selectedDate, currentBranchId, updatedData).catch(err => {
      console.warn("Failed saving other adjustment:", err);
    });
    showToast('Entry deleted', 'info');
  };

  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    title: string;
    type: 'cash' | 'remittance' | 'office' | 'ledger';
    entries: (DenoAdjustmentEntry | RemittanceEntry | OfficeAccountEntry | ReceivablePayableEntry)[];
  }>({ isOpen: false, title: '', type: 'cash', entries: [] });

  const [confirmDelete, setConfirmDelete] = useState<{ isOpen: boolean; type: string; id: string } | null>(null);

  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'info' | 'error' }>({ 
    show: false, msg: '', type: 'success' 
  });

  const showToast = (msg: string, type: 'success' | 'info' | 'error' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(p => ({ ...p, show: false })), 2000);
  };

  const currentBSDateLabel = useMemo(() => {
    try {
      const bs = new NepaliDate(new Date(selectedDate));
      return `${bs.getYear()}-${String(bs.getMonth() + 1).padStart(2, '0')}-${String(bs.getDate()).padStart(2, '0')}`;
    } catch (e) {
      return selectedDate;
    }
  }, [selectedDate]);

  const currentBranchName = useMemo(() => {
    const bId = (branch?.id || user?.branchId || currentBranchId || '').trim();
    if (!bId || bId.toLowerCase() === 'main' || bId.toLowerCase() === 'head_office' || bId.toLowerCase() === 'c01') {
      return branch?.name || 'Head Office';
    }
    const lower = bId.toLowerCase();
    const found = allBranches.find(b => 
      b.id.toLowerCase() === lower || 
      b.code?.toLowerCase() === lower || 
      b.name.toLowerCase() === lower ||
      b.name.toLowerCase().includes(lower) ||
      lower.includes(b.id.toLowerCase())
    );
    if (found) return found.name;
    if (lower === 'sahodba' || lower.includes('sahodba') || lower === 'c02') return 'Sahodba Branch';
    if (lower === 'pipra' || lower.includes('pipra') || lower === 'c03') return 'Pipra Branch';
    if (lower === 'parsa' || lower.includes('parsa') || lower === 'c04') return 'Parsa Branch';
    return branch?.name || (bId.toUpperCase() + (bId.toLowerCase().includes('branch') ? '' : ' Branch'));
  }, [branch, user, currentBranchId, allBranches]);

  const handleDateChange = (newDate: string) => {
    const currentBs = toBsDateString(selectedDate);
    const updatedHistory = { ...branchHistoryData, [currentBs]: data };
    setBranchHistoryData(updatedHistory);

    setSelectedDate(newDate);
    const bs = toBsDateString(newDate);
    if (updatedHistory[bs]) {
      setData(updatedHistory[bs]);
    } else {
      setData(getInitialDayData(newDate, currentBranchId));
    }
    setOpeningBalance(calculateOpeningFromHistory(newDate, updatedHistory));
  };

  const loadData = React.useCallback(async (silent = false) => {
    try {
      setError(null);
      
      // Parallel background refresh of all resources simultaneously
      const [settings, accounts, branchEmployees, allEmployeesList, allUsersList, branchesList, allData] = await Promise.all([
        storageService.getSettings().catch(() => null),
        storageService.getLedgerAccounts(currentBranchId).catch(() => []),
        storageService.getEmployees(currentBranchId).catch(() => []),
        storageService.getEmployees().catch(() => []),
        storageService.getUsers().catch(() => []),
        storageService.getBranches().catch(() => []),
        storageService.getAllData(currentBranchId).catch(() => ({}))
      ]);

      if (settings) {
        setSystemSettings(settings);
        setIsLocked(settings?.masterLock || false);
        const branchSpecific = settings?.remittanceCompaniesByBranch?.[currentBranchId];
        const baseCompanies = branchSpecific || settings?.remittanceCompanies || [];
        const hiddenCompanies = settings?.hiddenRemittanceCompaniesByBranch?.[currentBranchId] || [];
        setRemittanceCompanies(baseCompanies.filter(c => !hiddenCompanies.includes(c)));
      }

      if (allEmployeesList && allEmployeesList.length > 0) {
        setEmployees(allEmployeesList);
      } else if (branchEmployees && branchEmployees.length > 0) {
        setEmployees(branchEmployees);
      }

      if (allUsersList && allUsersList.length > 0) {
        setSystemUsers(allUsersList);
      }

      if (branchesList && branchesList.length > 0) {
        setAllBranches(branchesList);
      }

      // Show ONLY accounts genuinely created in Ledger Master (never auto-inject HR employees)
      const accMap = new Map<string, LedgerAccount>();
      (accounts || []).forEach(a => {
        if (a && a.id && a.name && !String(a.id).startsWith('staff_')) {
          accMap.set(a.name.trim().toLowerCase(), a);
        }
      });

      setLedgerAccounts(Array.from(accMap.values()));

      const safeAllData = allData || {};
      setBranchHistoryData(safeAllData);
      const bsDate = toBsDateString(selectedDate);
      const opening = calculateOpeningFromHistory(selectedDate, safeAllData);
      setOpeningBalance(opening);

      if (safeAllData[bsDate]) {
        setData(safeAllData[bsDate]);
      } else {
        setData({
          date: bsDate,
          branchId: currentBranchId,
          denominations: JSON.parse(JSON.stringify(DEFAULT_DENOMINATIONS)),
          denoAdjustments: [],
          transactions: [],
          officeTransactions: [],
          remittances: [],
          vaultTransactions: []
        });
      }
    } catch (err) {
      console.error("Failed to refresh daily cash entry data", err);
    } finally {
      setLoading(false);
    }
  }, [selectedDate, currentBranchId]);

  useEffect(() => { 
    loadData(); 
    const handleStorageChange = () => {
      storageService.getLedgerAccounts(currentBranchId).then(accs => setLedgerAccounts(accs || [])).catch(() => {});
    };
    window.addEventListener('storage', handleStorageChange);
    window.addEventListener('ledgerAccountsUpdated', handleStorageChange);
    window.addEventListener('employeesUpdated', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
      window.removeEventListener('ledgerAccountsUpdated', handleStorageChange);
      window.removeEventListener('employeesUpdated', handleStorageChange);
    };
  }, [loadData, currentBranchId]);

  // Synchronous, zero-lag Deno Stats
  const denoStats = useMemo(() => {
    const targetBsDate = toBsDateString(selectedDate);
    const dStats: Record<number, { opening: number, today: number }> = {};
    const uniquePrevDates = Array.from(new Set(Object.keys(branchHistoryData).map(toBsDateString))).filter(d => d < targetBsDate);

    DENOMINATIONS.forEach((val) => {
      let openingSum = 0;
      let todaySum = 0;
      
      uniquePrevDates.forEach((dateKey) => {
        const day = branchHistoryData[dateKey] || Object.values(branchHistoryData).find((v: any) => toBsDateString(v?.date) === dateKey);
        if (day) {
          (day.denoAdjustments || []).forEach((a) => {
            if (a.value === val) {
              const amount = a.value * a.quantity;
              if (a.type === 'add') openingSum += amount;
              else openingSum -= amount;
            }
          });
        }
      });

      (data.denoAdjustments || []).forEach((a) => {
        if (a.value === val) {
          const amount = a.value * a.quantity;
          if (a.type === 'add') todaySum += amount;
          else todaySum -= amount;
        }
      });
      dStats[val] = { opening: openingSum, today: todaySum };
    });
    return dStats;
  }, [selectedDate, branchHistoryData, data.denoAdjustments]);

  // Synchronous, zero-lag Remittance Stats
  const remitStats = useMemo(() => {
    const targetBsDate = toBsDateString(selectedDate);
    const rStats: Record<string, { opening: number, today: number, count: number }> = {};
    const uniquePrevDates = Array.from(new Set(Object.keys(branchHistoryData).map(toBsDateString))).filter(d => d < targetBsDate);

    remittanceCompanies.forEach(co => {
      let openingSum = 0;
      let todaySum = 0;
      let todayCount = 0;

      uniquePrevDates.forEach(dateKey => {
        const day = branchHistoryData[dateKey] || Object.values(branchHistoryData).find((v: any) => toBsDateString(v?.date) === dateKey);
        if (day) {
          (day.remittances || []).forEach(r => {
            if (r.companyName === co && !r.transferredToBackOffice) {
              openingSum += r.amount;
            }
          });
        }
      });

      (data.remittances || []).forEach(r => {
        if (r.companyName === co && !r.transferredToBackOffice) {
          todaySum += r.amount;
          todayCount++;
        }
      });
      rStats[co] = { opening: openingSum, today: todaySum, count: todayCount };
    });
    return rStats;
  }, [selectedDate, branchHistoryData, data.remittances, remittanceCompanies]);

  const openingCashPhysical = useMemo(() => Object.values(denoStats).reduce((sum: number, s: { opening: number, today: number }) => sum + (s?.opening || 0), 0), [denoStats]);
  const todayCashPhysical = useMemo(() => Object.values(denoStats).reduce((sum: number, s: { opening: number, today: number }) => sum + (s?.today || 0), 0), [denoStats]);
  const cashPhysical = openingCashPhysical + todayCashPhysical;
  
  // Front Teller Cash Movement accounts for active teller counter entries
  const remitNet = useMemo(() => (data.remittances || []).reduce((sum, r: any) => {
    if (r.origin === 'report' || r.origin === 'back_office' || r.origin === 'transferred' || r.transferredToBackOffice === true || r.transferredToConsolidated === true) return sum;
    return r.type === RemittanceType.SEND ? sum + (Number(r.amount) || 0) : sum - (Number(r.amount) || 0);
  }, 0), [data.remittances]);

  const totalRemitBalance = useMemo(() => Object.values(remitStats).reduce((sum: number, s: { opening: number, today: number, count: number }) => sum + (s?.opening || 0) + (s?.today || 0), 0), [remitStats]);
  
  const transNet = useMemo(() => data.transactions.reduce((sum, t: any) => {
    if (t.origin === 'income_expense' || t.origin === 'office_expense' || t.origin === 'report' || t.origin === 'back_office' || t.origin === 'transferred' || t.transferredToBackOffice === true || t.transferredToConsolidated === true) return sum;
    return t.type === 'in' ? sum + (Number(t.amount) || 0) : sum - (Number(t.amount) || 0);
  }, 0), [data.transactions]);
  
  const officeNet = useMemo(() => (data.officeTransactions || []).reduce((sum, t: any) => {
    if (isNonCounterMovementTx(t)) return sum;
    return t.type === 'in' ? sum + (Number(t.amount) || 0) : sum - (Number(t.amount) || 0);
  }, 0), [data.officeTransactions]);
  
  // Vault Transactions Movement:
  // When Vault -> Teller (Vault OUT / Teller IN / Debit): Teller receives cash (positive movement)
  // When Teller -> Vault (Vault IN / Teller OUT / Credit): Teller transfers cash to Vault (negative movement)
  const vaultNet = useMemo(() => {
    let sum = 0;
    (data.vaultTransactions || []).forEach(vt => {
      const isTeller = vt.source === 'Teller' || vt.partyType === 'Teller Desk' || (!vt.source && !vt.partyType);
      if (isTeller) {
        const amt = Number(vt.amount) || 0;
        if (vt.type === 'out') {
          // Vault OUT -> Teller DEBIT (Received by Teller Desk)
          sum += amt;
        } else if (vt.type === 'in') {
          // Vault IN -> Teller CREDIT (Paid from Teller to Vault)
          sum -= amt;
        }
      }
    });
    return sum;
  }, [data.vaultTransactions]);

  const totalMovement = vaultNet + remitNet + transNet + officeNet;

  // Previous Days' Cumulative System Cash Movement (Opening Movement)
  const openingMovement = useMemo(() => {
    const targetBsDate = toBsDateString(selectedDate);
    const uniquePrevDates = Array.from(new Set(Object.keys(branchHistoryData).map(toBsDateString))).filter(d => d < targetBsDate);
    let sum = 0;
    uniquePrevDates.forEach((dateKey) => {
      const day = branchHistoryData[dateKey] || Object.values(branchHistoryData).find((v: any) => toBsDateString(v?.date) === dateKey);
      if (day) {
        sum += calculateDayMovement(day);
      }
    });
    return sum;
  }, [selectedDate, branchHistoryData]);

  // Other net adjustment amount (cumulative balance of all other entries)
  const otherSignedAmount = useMemo(() => {
    return otherTotalBalance;
  }, [otherTotalBalance]);

  // Today's movement diff (Today's note changes vs Today's transaction movement)
  const todayMovementDiff = useMemo(() => {
    if (todayCashPhysical === 0 && totalMovement === 0) {
      return 0;
    }
    return todayCashPhysical - totalMovement;
  }, [todayCashPhysical, totalMovement]);

  // Today's Net Diff before carry forward (today's note changes - movement + other adjustment)
  const todayDiff = useMemo(() => {
    return todayMovementDiff + otherSignedAmount;
  }, [todayMovementDiff, otherSignedAmount]);

  // Cumulative unreconciled difference from all back dates (Carry Forwarded)
  const { carryForwardDiff, carryForwardFromDate, hasCarryForward } = useMemo(() => {
    const targetBsDate = toBsDateString(selectedDate);
    const uniquePrevDates = Array.from(new Set(Object.keys(branchHistoryData).map(toBsDateString)))
      .filter(d => d && d < targetBsDate && !d.includes('STORE') && !d.includes('CONFIGS'))
      .sort();

    let totalPrevDiff = 0;
    let lastDateWithDiff = '';

    uniquePrevDates.forEach((dateKey) => {
      const day = branchHistoryData[dateKey] || Object.values(branchHistoryData).find((v: any) => toBsDateString(v?.date) === dateKey);
      if (day) {
        // 1. Day's physical cash note adjustments
        let dayDenoNet = 0;
        if (Array.isArray(day.denoAdjustments)) {
          day.denoAdjustments.forEach((a: any) => {
            const amt = (Number(a.value) || 0) * (Number(a.quantity) || 0);
            if (a.type === 'add' || a.type === 'in') dayDenoNet += amt;
            else if (a.type === 'less' || a.type === 'out') dayDenoNet -= amt;
          });
        }

        // 2. Day's transaction movement
        const dayMovement = calculateDayMovement(day);

        // 3. Day's other adjustment
        let dayOtherNet = 0;
        if (Array.isArray(day.otherEntries) && day.otherEntries.length > 0) {
          dayOtherNet = day.otherEntries.reduce((s: number, e: any) => s + (e.type === 'add' ? (Number(e.amount) || 0) : -(Number(e.amount) || 0)), 0);
        } else if (Number(day.otherAmount) > 0) {
          dayOtherNet = day.otherType === 'less' ? -(Number(day.otherAmount) || 0) : (Number(day.otherAmount) || 0);
        }

        const baseDayDiff = (dayDenoNet === 0 && dayMovement === 0) ? 0 : (dayDenoNet - dayMovement);
        const dayDiff = baseDayDiff + dayOtherNet;

        totalPrevDiff += dayDiff;
        if (Math.abs(dayDiff) >= 0.01) {
          lastDateWithDiff = dateKey;
        }
      }
    });

    const rounded = Math.round(totalPrevDiff * 100) / 100;
    return {
      carryForwardDiff: rounded,
      carryForwardFromDate: lastDateWithDiff,
      hasCarryForward: Math.abs(rounded) >= 0.01
    };
  }, [selectedDate, branchHistoryData]);

  // Total Balance Diff: today's net diff + carry forwarded back date unreconciled balance
  const diff = useMemo(() => {
    return Math.round((todayDiff + carryForwardDiff) * 100) / 100;
  }, [todayDiff, carryForwardDiff]);

  // Helper to reliably resolve who entered each transaction
  const resolveUserDisplay = (entry: any): { name: string; role: string } => {
    if (entry.createdByName && typeof entry.createdByName === 'string' && entry.createdByName.trim()) {
      return {
        name: entry.createdByName.trim(),
        role: entry.createdByRole || (entry.createdBy === user?.id ? (user?.roleId || 'Front Teller') : 'Staff')
      };
    }

    const uid = (entry.createdBy || '').toString().trim();
    if (!uid || uid === 'sys' || uid === 'system') {
      if (user?.fullName) {
        return { name: user.fullName, role: user.roleId || 'Front Teller' };
      }
      return { name: 'Front Teller Operator', role: 'Counter' };
    }

    const foundUser = (systemUsers || []).find(u => 
      u.id === uid || 
      u.username.toLowerCase() === uid.toLowerCase() || 
      u.fullName.toLowerCase() === uid.toLowerCase()
    );
    if (foundUser) {
      return { 
        name: foundUser.fullName || foundUser.username, 
        role: foundUser.roleId || 'Staff'
      };
    }

    const foundEmp = (employees || []).find(e => 
      e.id === uid || 
      e.fullName.toLowerCase() === uid.toLowerCase() || 
      (e.employeeCode && e.employeeCode.toLowerCase() === uid.toLowerCase())
    );
    if (foundEmp) {
      return { 
        name: foundEmp.fullName, 
        role: foundEmp.designation || 'Staff'
      };
    }

    if (user && (user.id === uid || user.username.toLowerCase() === uid.toLowerCase())) {
      return { name: user.fullName || user.username, role: user.roleId || 'Front Teller' };
    }

    return { name: uid, role: 'Staff' };
  };

  const commitDeno = (val: number) => {
    if (isLocked) return showToast('Session Locked', 'error');
    if (isDayEndedForBranch(currentBranchId)) return showToast(getDayEndedBlockMessage(), 'error');
    if (isBackDateBlockedForEntry(selectedDate, systemSettings || authSettings)) {
      return showToast(getBackDateBlockedMessage(selectedDate), 'error');
    }
    const qty = parseInt(denoQuantities[val] || '');
    if (isNaN(qty) || qty <= 0) return;
    const adj: DenoAdjustmentEntry = { 
      id: crypto.randomUUID(), 
      value: val, 
      quantity: qty, 
      type: denoGlobalMode, 
      date: selectedDate,
      createdBy: user?.id || user?.username || 'sys',
      createdByName: user?.fullName || user?.username || 'Front Teller',
      createdAt: Date.now()
    };
    const newData = { ...data, denoAdjustments: [...data.denoAdjustments, adj] };
    
    // Instant UI reaction: immediately clear input and update React state
    setDenoQuantities(p => ({ ...p, [val]: '' }));
    setData(newData);
    showToast(`Deno ${val} Posted`);
    // Async background persistence
    storageService.saveDayData(selectedDate, currentBranchId, newData).catch(err => {
      console.error("Save Deno Error:", err);
      showToast('Error saving denomination', 'error');
    });
  };

  const commitSingleRemit = async (co: string) => {
    if (isLocked) return showToast('Session Locked', 'error');
    if (isDayEndedForBranch(currentBranchId)) return showToast(getDayEndedBlockMessage(), 'error');
    if (isBackDateBlockedForEntry(selectedDate, systemSettings || authSettings)) {
      return showToast(getBackDateBlockedMessage(selectedDate), 'error');
    }
    const rawVal = (remitAmounts[co] || '').toString().replace(/,/g, '').trim();
    const amt = parseFloat(rawVal);
    if (isNaN(amt) || amt <= 0) {
      setIsTransferModalOpen(true);
      return;
    }

    const newEntry: RemittanceEntry = {
      id: crypto.randomUUID(),
      companyName: co,
      type: remitGlobalMode,
      amount: amt,
      date: selectedDate,
      createdBy: user?.id || user?.username || 'sys',
      createdByName: user?.fullName || user?.username || 'Front Teller',
      branchId: currentBranchId,
      origin: 'teller',
      transferredToBackOffice: false,
      transferredToConsolidated: false,
      remarks: remitGlobalMode === RemittanceType.RECEIVE ? 'Remit Pay' : 'Remit Send'
    };

    // 1. Instant optimistic state update (<1ms)
    const updatedCurrent = {
      ...data,
      remittances: [...(data.remittances || []), newEntry]
    };
    setData(updatedCurrent);
    setRemitAmounts(prev => ({ ...prev, [co]: '' }));
    showToast(`${co} Rs. ${amt.toLocaleString()} recorded in Front Teller`);

    // 2. Persist in background asynchronously
    storageService.saveDayData(selectedDate, currentBranchId, updatedCurrent).catch(err => {
      console.error("Save Remittance Error:", err);
      showToast('Error recording remittance', 'error');
    });
  };

  const transferRemittanceToBackOffice = () => {
    if (isLocked) return showToast('Session Locked', 'error');
    if (isDayEndedForBranch(currentBranchId)) return showToast(getDayEndedBlockMessage(), 'error');
    if (isBackDateBlockedForEntry(selectedDate, systemSettings || authSettings)) {
      return showToast(getBackDateBlockedMessage(selectedDate), 'error');
    }
    setIsTransferModalOpen(true);
  };

  const handleExecuteTransfer = async (target: 'main' | 'consolidated' | 'both') => {
    if (isLocked) return showToast('Session Locked', 'error');
    if (isDayEndedForBranch(currentBranchId)) return showToast(getDayEndedBlockMessage(), 'error');
    if (isBackDateBlockedForEntry(selectedDate, systemSettings || authSettings)) {
      return showToast(getBackDateBlockedMessage(selectedDate), 'error');
    }

    const isMain = target === 'main' || target === 'both';
    const isConsolidated = target === 'consolidated' || target === 'both';

    // 1. Gather newly typed amounts from textboxes
    let newlyTypedEntries: RemittanceEntry[] = [];
    remittanceCompanies.forEach(co => {
      const rawVal = (remitAmounts[co] || '').toString().replace(/,/g, '').trim();
      const amt = parseFloat(rawVal);
      if (!isNaN(amt) && amt > 0) {
        newlyTypedEntries.push({
          id: crypto.randomUUID(),
          companyName: co,
          type: remitGlobalMode,
          amount: amt,
          date: selectedDate,
          createdBy: user?.id || 'sys',
          branchId: currentBranchId,
          origin: 'transferred',
          transferredToBackOffice: isMain,
          transferredToConsolidated: isConsolidated,
          transferredAt: Date.now(),
          remarks: remitGlobalMode === RemittanceType.RECEIVE ? 'Remit Pay' : 'Remit Send'
        });
      }
    });

    // 2. Gather existing entries for today, marking them as transferred
    const existingEntries = (data.remittances || []).map(entry => ({
      ...entry,
      origin: 'transferred' as const,
      transferredToBackOffice: isMain,
      transferredToConsolidated: isConsolidated,
      transferredAt: entry.transferredAt || Date.now()
    }));

    const allEntriesToTransfer = [...existingEntries, ...newlyTypedEntries];

    if (allEntriesToTransfer.length === 0) {
      setIsTransferModalOpen(false);
      return showToast('No remittance amount available to transfer!', 'info');
    }

    // Helper to merge entries uniquely by ID while preserving originating branchId
    const mergeEntries = (baseList: RemittanceEntry[], itemsToAdd: RemittanceEntry[]) => {
      const map = new Map((baseList || []).map(item => [item.id, item]));
      itemsToAdd.forEach(item => {
        map.set(item.id, {
          ...item,
          branchId: item.branchId || currentBranchId,
          originBranchId: item.branchId || currentBranchId,
          transferredToBackOffice: isMain,
          transferredToConsolidated: isConsolidated,
          origin: 'transferred'
        });
      });
      return Array.from(map.values());
    };

    // 3. Update React UI IMMEDIATELY (0ms latency!)
    const updatedCurrent = {
      ...data,
      remittances: mergeEntries(data.remittances || [], allEntriesToTransfer)
    };
    setData(updatedCurrent);
    setRemitAmounts({});
    setIsTransferModalOpen(false);

    const targetLabel = target === 'main' 
      ? `Back Office (${currentBranchName})` 
      : target === 'consolidated' 
        ? 'Consolidated Report' 
        : `${currentBranchName} & Consolidated`;
    showToast(`Remittance successfully transferred to ${targetLabel}!`);

    // 4. Background persistence to avoid any UI freeze
    (async () => {
      try {
        // Save to current branch's day data (Branch Back Office & Teller Ledger)
        await storageService.saveDayData(selectedDate, currentBranchId, updatedCurrent);

        // If consolidated or both, also sync to consolidated day data (Shared report of all branches)
        if (isConsolidated) {
          const consBranchId = 'consolidated';
          const consDayData = (await storageService.getDayData(selectedDate, consBranchId)) || {
            date: selectedDate,
            branchId: consBranchId,
            denominations: JSON.parse(JSON.stringify(DEFAULT_DENOMINATIONS)),
            denoAdjustments: [],
            transactions: [],
            officeTransactions: [],
            remittances: [],
            vaultTransactions: []
          };
          const updatedCons = {
            ...consDayData,
            remittances: mergeEntries(consDayData.remittances || [], allEntriesToTransfer)
          };
          await storageService.saveDayData(selectedDate, consBranchId, updatedCons);
        }

        window.dispatchEvent(new Event('storage'));
      } catch (err) {
        console.error("Background transfer error:", err);
      }
    })();
  };

  const commitOffice = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLocked) return showToast('Session Locked', 'error');
    if (isDayEndedForBranch(currentBranchId)) return showToast(getDayEndedBlockMessage(), 'error');
    if (isBackDateBlockedForEntry(selectedDate, systemSettings || authSettings)) {
      return showToast(getBackDateBlockedMessage(selectedDate), 'error');
    }
    const amt = parseFloat(newOffice.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }
    
    let updatedEntries = [...(data.officeTransactions || [])];
    const isEdit = !!newOffice.id;
    if (newOffice.id) {
       updatedEntries = updatedEntries.map(entryItem => entryItem.id === newOffice.id ? { ...entryItem, head: newOffice.head, amount: amt, type: newOffice.type, remarks: newOffice.remarks } : entryItem);
    } else {
       const entry: OfficeAccountEntry = {
         id: crypto.randomUUID(), head: newOffice.head, amount: amt, type: newOffice.type,
         date: selectedDate, remarks: newOffice.remarks, 
         createdBy: user?.id || user?.username || 'sys',
         createdByName: user?.fullName || user?.username || 'Front Teller',
         branchId: currentBranchId, origin: 'teller_counter'
       };
       updatedEntries.push(entry);
    }
    const newData = { ...data, officeTransactions: updatedEntries };
    
    // Instant UI reaction: clear inputs and update state immediately
    setNewOffice({ id: '', head: 'Saving', amount: '', type: 'in', remarks: '', date: selectedDate });
    setData(newData);
    showToast(isEdit ? 'Entry Updated' : 'Entry Submitted');

    // Async background persistence
    storageService.saveDayData(selectedDate, currentBranchId, newData).catch(err => {
      console.error("Save Office Transaction Error:", err);
      showToast('Error saving transaction', 'error');
    });
  };

  const handleOfficeHeadChange = (head: string) => {
    let type = newOffice.type;
    if (head === 'Share' || head === 'Entry Fee') {
      type = 'in';
    } else if (head === 'Expenses' || head === 'Remittance') {
      type = 'out';
    }
    setNewOffice({ ...newOffice, head, type });
  };

  // Precise balance calculator for ledger accounts (accounting for all history days + current transaction)
  const computeAccountBalanceDetails = (
    accountName: string,
    account: LedgerAccount | undefined,
    currentTx: { type: 'in' | 'out'; amount: number; id?: string }
  ) => {
    let prevBalance = account ? (Number(account.openingBalance ?? (account as any).initialBalance) || 0) : 0;
    const nameUpper = (accountName || '').trim().toUpperCase();
    const accId = account?.id;
    const empId = account?.employeeId;
    const empCodeUpper = (account?.employeeCode || '').trim().toUpperCase();

    const allHistory: Record<string, DailyData> = { ...branchHistoryData };
    if (data && data.date) {
      allHistory[data.date] = data;
    }

    Object.values(allHistory).forEach(dayRecord => {
      (dayRecord.transactions || []).forEach(tx => {
        if (currentTx.id && tx.id === currentTx.id) return; // Skip the entry currently being updated

        const txDescUpper = (tx.description || '').trim().toUpperCase();
        const txRemarksUpper = (tx.remarks || '').trim().toUpperCase();
        const isMatched = (
          (accId && (tx.accountId === accId || (empId && tx.accountId === empId))) ||
          (txDescUpper && (txDescUpper === nameUpper || (empCodeUpper && txDescUpper === empCodeUpper))) ||
          (txRemarksUpper && (txRemarksUpper === nameUpper || (empCodeUpper && txRemarksUpper === empCodeUpper)))
        );

        if (isMatched) {
          if (tx.type === 'in') prevBalance += Number(tx.amount) || 0;
          else prevBalance -= Number(tx.amount) || 0;
        }
      });
    });

    let updatedBalance = prevBalance;
    if (currentTx.type === 'in') {
      updatedBalance += currentTx.amount;
    } else {
      updatedBalance -= currentTx.amount;
    }

    const balanceType: 'payable' | 'receivable' | 'balanced' = 
      updatedBalance > 0 ? 'receivable' : updatedBalance < 0 ? 'payable' : 'balanced';

    return { previousBalance: prevBalance, updatedBalance, balanceType };
  };

  const commitLedger = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (isLocked) return showToast('Session Locked', 'error');
    if (isDayEndedForBranch(currentBranchId)) return showToast(getDayEndedBlockMessage(), 'error');
    if (isBackDateBlockedForEntry(selectedDate, systemSettings || authSettings)) {
      return showToast(getBackDateBlockedMessage(selectedDate), 'error');
    }
    const amt = parseFloat(newTrans.amount);
    if (isNaN(amt) || amt <= 0) {
      showToast('Please enter a valid amount', 'error');
      return;
    }

    const nameTrimmed = (newTrans.name || '').trim().toUpperCase();
    const matchedAccount = ledgerAccounts.find(acc => acc.name.trim().toUpperCase() === nameTrimmed);
    const resolvedName = matchedAccount ? matchedAccount.name : newTrans.name.trim();

    // Match linked employee or staff record
    const matchedEmployee = (employees || []).find(emp => 
      (matchedAccount?.employeeId && emp.id === matchedAccount.employeeId) ||
      (matchedAccount?.id && matchedAccount.id.startsWith('staff_') && emp.id === matchedAccount.id.replace('staff_', '')) ||
      (matchedAccount?.employeeCode && emp.employeeCode && emp.employeeCode.trim().toUpperCase() === matchedAccount.employeeCode.trim().toUpperCase()) ||
      (emp.fullName && emp.fullName.trim().toUpperCase() === nameTrimmed) ||
      (emp.employeeCode && emp.employeeCode.trim().toUpperCase() === nameTrimmed)
    );

    const matchedUser = (systemUsers || []).find(u => 
      (u.fullName && u.fullName.trim().toUpperCase() === nameTrimmed) ||
      (u.username && u.username.trim().toUpperCase() === nameTrimmed)
    );

    const targetEmail = (
      matchedAccount?.email || 
      matchedEmployee?.email || 
      matchedUser?.email || 
      ''
    ).trim();

    // Calculate accurate previous and updated balances
    const { previousBalance, updatedBalance, balanceType } = computeAccountBalanceDetails(
      resolvedName,
      matchedAccount,
      { type: newTrans.type, amount: amt, id: newTrans.id }
    );

    let updated = [...data.transactions];
    const isEdit = !!newTrans.id;
    const existingTx = newTrans.id ? data.transactions.find(t => t.id === newTrans.id) : null;
    const oldAmount = existingTx ? Number(existingTx.amount) : undefined;
    const oldParticular = existingTx ? (existingTx.remarks || existingTx.description) : undefined;

    if (newTrans.id) {
       updated = updated.map(t => t.id === newTrans.id ? { 
         ...t, 
         description: resolvedName, 
         accountId: matchedAccount?.id || t.accountId,
         amount: amt, 
         type: newTrans.type, 
         remarks: newTrans.particular 
       } : t);
    } else {
       const entry: ReceivablePayableEntry = {
         id: crypto.randomUUID(), 
         description: resolvedName,
         accountId: matchedAccount?.id,
         amount: amt, 
         type: newTrans.type, 
         remarks: newTrans.particular, 
         date: selectedDate, 
         createdBy: user?.id || user?.username || 'sys',
         createdByName: user?.fullName || user?.username || 'Front Teller',
         branchId: currentBranchId
       };
       updated.push(entry);
    }
    const newData = { ...data, transactions: updated };
    
    // Instant UI reaction: clear inputs and update state immediately
    const savedType = newTrans.type;
    const savedParticular = newTrans.particular;
    setNewTrans({ id: '', name: '', amount: '', particular: '', type: 'out' });
    setData(newData);
    window.dispatchEvent(new Event('storage'));

    // Async background persistence
    storageService.saveDayData(selectedDate, currentBranchId, newData).catch(err => {
      console.error("Save Ledger Transaction Error:", err);
      showToast('Error saving ledger post', 'error');
    });

    // Automated Email Notification Workflow
    if (targetEmail) {
      showToast(`Post Submitted. Sending email alert to ${targetEmail}...`);
      sendLedgerNotificationEmailApi({
        to: targetEmail,
        recipientName: resolvedName,
        employeeCode: matchedEmployee?.employeeCode || matchedAccount?.employeeCode,
        transactionType: savedType,
        amount: amt,
        particular: savedParticular,
        dateBs: selectedDate,
        dateAd: new Date().toISOString().split('T')[0],
        branchName: currentBranchName,
        tellerName: user?.fullName || 'Front Desk Teller',
        voucherId: `LEDGER-${Date.now().toString().slice(-6)}`,
        previousBalance,
        updatedBalance,
        balanceType,
        actionType: isEdit ? 'edit' : 'create',
        oldAmount,
        oldParticular,
        companyName: systemSettings?.systemName || "Ratauli Saving and Credit Cooperative Ltd",
        companyAddress: systemSettings?.address || "Pipra Rural Municipality -6 (Mahottari)",
        logoUrl: systemSettings?.logoUrl
      }).then(res => {
        if (res.success) {
          showToast(`Post Submitted & Email sent to ${targetEmail}!`, 'success');
        } else {
          console.warn("Ledger email sending error:", res.message);
          showToast(`Post Submitted (Email note: ${res.message})`, 'info');
        }
      }).catch(err => {
        console.error("Ledger email sending error:", err);
      });
    } else {
      showToast(isEdit ? 'Post Updated' : 'Post Submitted');
      // Prompt teller to optionally send email notification or save email for this employee
      setPendingEmailPrompt({
        isOpen: true,
        recipientName: resolvedName,
        employeeCode: matchedEmployee?.employeeCode || matchedAccount?.employeeCode,
        transactionType: savedType,
        amount: amt,
        particular: savedParticular,
        previousBalance,
        updatedBalance,
        balanceType,
        enteredEmail: '',
        isSending: false,
        matchedAccount,
        matchedEmployee
      });
    }
  };

  const deleteEntry = (type: string, id: string) => {
    if (isLocked) return showToast('Session Locked', 'error');
    if (isDayEndedForBranch(currentBranchId)) return showToast(getDayEndedBlockMessage(), 'error');
    if (isBackDateBlockedForEntry(selectedDate, systemSettings || authSettings)) {
      return showToast(getBackDateBlockedMessage(selectedDate), 'error');
    }
    setConfirmDelete({ isOpen: true, type, id });
  };

  const executeDelete = () => {
    if (!confirmDelete) return;
    const { type, id } = confirmDelete;
    
    const newData = { ...data };
    if (type === 'cash') newData.denoAdjustments = data.denoAdjustments.filter(a => a.id !== id);
    else if (type === 'remittance') newData.remittances = data.remittances.filter(r => r.id !== id);
    else if (type === 'office') newData.officeTransactions = data.officeTransactions.filter(o => o.id !== id);
    else if (type === 'ledger') {
      const deletedTx = data.transactions.find(t => t.id === id);
      if (deletedTx) {
        const nameTrimmed = (deletedTx.description || '').trim().toUpperCase();
        const matchedAccount = ledgerAccounts.find(acc => acc.name.trim().toUpperCase() === nameTrimmed);
        const resolvedName = matchedAccount ? matchedAccount.name : (deletedTx.description || '').trim();
        const matchedEmployee = (employees || []).find(emp => 
          (matchedAccount?.employeeId && emp.id === matchedAccount.employeeId) ||
          (matchedAccount?.id && matchedAccount.id.startsWith('staff_') && emp.id === matchedAccount.id.replace('staff_', '')) ||
          (matchedAccount?.employeeCode && emp.employeeCode && emp.employeeCode.trim().toUpperCase() === matchedAccount.employeeCode.trim().toUpperCase()) ||
          (emp.fullName && emp.fullName.trim().toUpperCase() === nameTrimmed) ||
          (emp.employeeCode && emp.employeeCode.trim().toUpperCase() === nameTrimmed)
        );
        const targetEmail = (matchedAccount?.email || matchedEmployee?.email || '').trim();
        if (targetEmail) {
          const { previousBalance, updatedBalance, balanceType } = computeAccountBalanceDetails(
            resolvedName,
            matchedAccount,
            { type: deletedTx.type === 'in' ? 'out' : 'in', amount: Number(deletedTx.amount) || 0, id: '' }
          );
          sendLedgerNotificationEmailApi({
            to: targetEmail,
            recipientName: resolvedName,
            employeeCode: matchedEmployee?.employeeCode || matchedAccount?.employeeCode,
            transactionType: deletedTx.type,
            amount: Number(deletedTx.amount) || 0,
            particular: deletedTx.remarks || deletedTx.description || 'Cancelled Ledger Entry',
            dateBs: selectedDate,
            dateAd: new Date().toISOString().split('T')[0],
            branchName: currentBranchName,
            tellerName: user?.fullName || 'Front Desk Teller',
            voucherId: `LEDGER-DELETE-${Date.now().toString().slice(-6)}`,
            previousBalance,
            updatedBalance,
            balanceType,
            actionType: 'delete',
            companyName: systemSettings?.systemName || "Ratauli Saving and Credit Cooperative Ltd",
            companyAddress: systemSettings?.address || "Pipra Rural Municipality -6 (Mahottari)",
            logoUrl: systemSettings?.logoUrl
          }).catch(e => console.warn("Email alert on delete failed:", e));
        }
      }
      newData.transactions = data.transactions.filter(t => t.id !== id);
    }

    // Instant UI reaction
    setData(newData);
    const updatedEntries = detailModal.entries.filter(e => e.id !== id);
    if (updatedEntries.length === 0) {
      setDetailModal({ isOpen: false, type: 'cash', entries: [] });
    } else {
      setDetailModal(prev => ({ 
        ...prev, 
        entries: updatedEntries 
      }));
    }
    showToast('Entry Deleted', 'error');
    setConfirmDelete(null);

    // Async background persistence
    storageService.saveDayData(selectedDate, currentBranchId, newData).catch(err => {
      console.error("Delete Entry Error:", err);
      showToast('Error deleting entry', 'error');
    });
  };

  const openDetails = (type: 'cash' | 'remittance' | 'office' | 'ledger', filterValue?: number | string) => {
    let entries: (DenoAdjustmentEntry | RemittanceEntry | OfficeAccountEntry | ReceivablePayableEntry)[] = [];
    let title = "";
    if (type === 'cash') {
      entries = data.denoAdjustments.filter(a => a.value === filterValue);
      title = `Deno ${filterValue} Ledger`;
    } else if (type === 'remittance') {
      entries = data.remittances.filter(r => r.companyName === filterValue && !r.transferredToBackOffice);
      title = `${filterValue} Remittance Log`;
    } else if (type === 'office') {
      entries = data.officeTransactions;
      title = "Teller Entry Summary";
    } else if (type === 'ledger') {
      entries = data.transactions;
      title = "Daily Ledger Postings";
    }
    setDetailModal({ isOpen: true, title, type, entries });
  };

  return (
    <div className="space-y-1.5 animate-in fade-in duration-500 w-full pb-2 h-full flex flex-col">
      {/* Compact Header Status */}
      <div className="grid grid-cols-1 md:grid-cols-4 lg:grid-cols-10 gap-1.5 bg-white py-1.5 px-3 rounded-xl shadow-sm border border-slate-200 relative z-10 shrink-0 mx-0.5">
        <div className="lg:col-span-3 flex flex-col justify-center border-r border-slate-100 pr-3">
           <div className="flex items-center space-x-2">
              <h2 className="text-base font-black text-emerald-800 tracking-tighter uppercase italic leading-none">Front Teller</h2>
              {(isLocked || isDayEnded) && <Lock size={11} className="text-rose-600 animate-pulse" />}
              {isDayEnded && (
                <span className="px-1.5 py-0.5 rounded bg-rose-100 text-rose-700 border border-rose-300 text-[8px] font-black uppercase tracking-wider">
                  Day Closed
                </span>
              )}
           </div>
           <p className="text-[6.5px] font-black text-slate-400 uppercase tracking-widest leading-none mt-0.5 mb-1">Session Date</p>
           <NepaliDatePicker value={selectedDate} onChange={handleDateChange} disallowBackDateIfDisabled={true} className="w-full scale-90 origin-left" />
        </div>

        <div className="lg:col-span-2 flex flex-col items-start justify-center px-2 border-r border-slate-100">
           <div className="flex items-center space-x-1.5 text-slate-400 mb-0.5">
              <Banknote size={9} className="text-emerald-700"/>
              <span className="text-[6.5px] font-black uppercase tracking-widest text-emerald-800">Counter Cash</span>
           </div>
           <div className="text-base font-black text-slate-900 italic tracking-tighter leading-none">रू {cashPhysical.toLocaleString()}</div>
        </div>

        <div className="lg:col-span-2 flex flex-col items-start justify-center px-2 border-r border-slate-100">
           <div className="flex items-center space-x-1.5 text-slate-400 mb-0.5">
              <Activity size={9}/>
              <span className="text-[6.5px] font-black uppercase tracking-widest">Movement</span>
           </div>
           <div className={`text-base font-black italic tracking-tighter leading-none ${totalMovement >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
              रू {totalMovement.toLocaleString()}
           </div>
        </div>

        {/* Status Card: Red for Payable, Yellow for Receivable, Green for Balanced */}
        {(() => {
          const isBalanced = Math.abs(diff) < 1;
          const isReceivable = !isBalanced && diff > 0;
          const isPayable = !isBalanced && diff < 0;
          const hasCarryForward = Math.abs(carryForwardDiff) >= 0.01;

          return (
            <div className={`lg:col-span-3 p-1.5 px-2.5 rounded-lg border shadow-inner flex flex-col items-start justify-center transition-all ${
              isBalanced 
                ? 'bg-emerald-50 border-emerald-200' 
                : isReceivable 
                  ? 'bg-amber-50 border-amber-300 ring-1 ring-amber-400/40' 
                  : 'bg-rose-50 border-rose-200 ring-1 ring-rose-400/40'
            }`}>
               <div className="w-full flex justify-between items-center mb-0.5">
                  <div className="flex items-center space-x-1.5 text-slate-600">
                     <Scale size={9} className={isBalanced ? 'text-emerald-700' : isReceivable ? 'text-amber-800' : 'text-rose-700'} />
                     <span className="text-[6.5px] font-black uppercase tracking-widest">Status</span>
                  </div>
                  <div className="flex items-center space-x-1">
                    {/* Carry forwarded signal in small letters until settled */}
                    {hasCarryForward && !isBalanced && (
                      <span 
                        className="text-[6.5px] font-bold lowercase px-1.5 py-0.5 rounded border border-amber-300 bg-amber-100/90 text-amber-900 tracking-tight flex items-center space-x-1 shadow-2xs animate-pulse" 
                        title={`Back date unreconciled balance carried forward (${carryForwardFromDate ? `from ${carryForwardFromDate}` : 'back date'}): ${carryForwardDiff > 0 ? '+' : ''}${carryForwardDiff.toLocaleString()}`}
                      >
                        <span className="w-1.5 h-1.5 rounded-full bg-amber-500 animate-ping shrink-0" />
                        <span>carry forwarded</span>
                      </span>
                    )}
                    {hasCarryForward && isBalanced && (
                      <span className="text-[6.5px] font-bold lowercase px-1.5 py-0.5 rounded border border-emerald-300 bg-emerald-100 text-emerald-800 tracking-tight flex items-center space-x-1">
                        <span>✓ carry forwarded settled</span>
                      </span>
                    )}
                    <span className={`text-[7px] font-black uppercase px-1.5 py-0.5 rounded border tracking-tight flex items-center space-x-1 ${
                      isBalanced 
                        ? 'bg-emerald-100 text-emerald-800 border-emerald-300' 
                        : isReceivable 
                          ? 'bg-amber-100 text-amber-900 border-amber-300 font-extrabold' 
                          : 'bg-rose-100 text-rose-800 border-rose-300 font-extrabold'
                    }`}>
                      <span>{isBalanced ? '🟢' : isReceivable ? '🟡' : '🔴'}</span>
                      <span>{isBalanced ? 'MATCHED' : isReceivable ? 'RECEIVABLE' : 'PAYABLE'}</span>
                    </span>
                    <div className={`p-0.5 rounded ${isBalanced ? 'bg-emerald-600' : isReceivable ? 'bg-amber-500' : 'bg-rose-600'} text-white`}>
                      {isBalanced ? <CheckCircle2 size={7}/> : isReceivable ? <ArrowUpRight size={7}/> : <ArrowDownRight size={7}/>}
                    </div>
                  </div>
               </div>
               <div className="w-full flex items-baseline justify-between">
                  <div>
                    <div className="flex items-center space-x-2 flex-wrap gap-y-0.5">
                      <div className={`text-sm font-black italic tracking-tighter leading-none ${
                        isBalanced ? 'text-emerald-700' : isReceivable ? 'text-amber-800' : 'text-rose-700'
                      }`}>
                         DIFF: {isReceivable ? '+' : isPayable ? '-' : ''}{Math.abs(diff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </div>
                      {hasCarryForward && !isBalanced && (
                        <span 
                          className="inline-flex items-center space-x-1 px-1.5 py-0.5 rounded border border-amber-400 bg-amber-200/90 text-amber-950 font-bold lowercase text-[7.5px] shadow-2xs animate-pulse"
                          title={`Unreconciled back date balance carried forward into today's diff: ${carryForwardDiff > 0 ? '+' : ''}${carryForwardDiff.toLocaleString()}`}
                        >
                          <span className="w-1.5 h-1.5 rounded-full bg-amber-600 animate-ping shrink-0" />
                          <span>carry forwarded</span>
                        </span>
                      )}
                    </div>
                    {hasCarryForward && !isBalanced && (
                      <div className="text-[7px] font-bold lowercase text-amber-900/90 flex items-center space-x-1 mt-0.5">
                        <span className="inline-block w-1.5 h-1.5 rounded-full bg-amber-500 animate-pulse shrink-0"></span>
                        <span>carry forwarded: <b>{carryForwardDiff > 0 ? '+' : '-'}{Math.abs(carryForwardDiff).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b> {carryForwardFromDate ? `(from ${carryForwardFromDate})` : ''} until settled</span>
                      </div>
                    )}
                  </div>
                  <span className={`text-[7.5px] font-extrabold italic ${
                    isBalanced ? 'text-emerald-700' : isReceivable ? 'text-amber-800' : 'text-rose-700'
                  }`}>
                    {isBalanced ? 'Matched & Balanced' : isReceivable ? 'Surplus (Receivable)' : 'Shortage (Payable)'}
                  </span>
               </div>
               {(otherSignedAmount !== 0 || hasCarryForward || todayMovementDiff !== 0) && (
                 <div className="w-full flex items-center justify-between text-[7px] text-slate-500 mt-1 pt-0.5 border-t border-slate-200/70 font-semibold gap-1">
                   {hasCarryForward ? (
                     <span className="truncate" title={`Carry forwarded from back date (${carryForwardFromDate || 'previous'}): ${carryForwardDiff > 0 ? '+' : ''}${carryForwardDiff.toLocaleString()}`}>
                       carry forwarded: <b className={carryForwardDiff > 0 ? 'text-amber-800 font-bold' : 'text-rose-700 font-bold'}>{carryForwardDiff > 0 ? '+' : ''}{carryForwardDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                     </span>
                   ) : (
                     otherSignedAmount !== 0 && (
                       <span>Other: <b className={otherSignedAmount > 0 ? 'text-emerald-700' : 'text-rose-700'}>{otherSignedAmount > 0 ? '+' : ''}{otherSignedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                     )
                   )}
                   <span>Today Net: <b>{todayMovementDiff >= 0 ? '+' : ''}{todayMovementDiff.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                   {hasCarryForward && otherSignedAmount !== 0 && (
                     <span>Other: <b className={otherSignedAmount > 0 ? 'text-emerald-700' : 'text-rose-700'}>{otherSignedAmount > 0 ? '+' : ''}{otherSignedAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b></span>
                   )}
                 </div>
               )}
            </div>
          );
        })()}
      </div>

      {isBackDateBlocked && (
        <div className="mx-0.5 bg-rose-50 border border-rose-300 text-rose-800 px-3 py-2 rounded-xl flex items-center justify-between text-[11px] font-bold shadow-xs">
          <div className="flex items-center space-x-2">
            <Lock size={14} className="text-rose-600 shrink-0" />
            <span>Selected date ({selectedDate}) is Read-Only. Only today&apos;s date is open for entries.</span>
          </div>
          <button
            type="button"
            onClick={() => handleDateChange(new NepaliDate().format('YYYY-MM-DD'))}
            className="px-2.5 py-1 bg-rose-600 hover:bg-rose-700 text-white rounded-lg text-[10px] font-black uppercase tracking-wider shrink-0 cursor-pointer"
          >
            Switch to Today
          </button>
        </div>
      )}

      {/* Optimized Columns Layout - Soft & Elegant Theme */}
      <div className="grid grid-cols-1 lg:grid-cols-4 gap-3 mb-3 mx-0.5 items-start text-slate-900">
        
        {/* Col 1: Counter Notes */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden self-start">
          <div className="py-1.5 px-3 flex items-center justify-between bg-gradient-to-r from-emerald-800 to-teal-800 text-white shrink-0">
             <div className="flex items-center space-x-1.5">
                <div className="w-4.5 h-4.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                  <Banknote size={11}/>
                </div>
                <h3 className="font-bold uppercase tracking-tight text-[10.5px]">Counter Notes</h3>
             </div>
             <div className="text-[11.5px] font-black text-emerald-100 font-mono tracking-tight">रू {cashPhysical.toLocaleString()}</div>
          </div>
          <div className="p-1.5 flex flex-col">
              <div className="grid grid-cols-[1fr_0.75fr_1.15fr_0.8fr_1.6fr] text-[9px] font-extrabold text-slate-600 uppercase px-1 mb-0.5 items-center border-b border-slate-100 pb-1 pt-0 gap-1 shrink-0">
                 <div className="whitespace-nowrap">Note</div>
                 <div className="text-center whitespace-nowrap">O/B</div>
                 <div className="text-center flex justify-center">
                    <div className="flex items-center space-x-0.5 bg-slate-100 rounded p-0.5 border border-slate-200 shadow-2xs">
                      <button
                        type="button"
                        disabled={isDayEnded}
                        onClick={() => setDenoGlobalMode('add')}
                        className="flex items-center space-x-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group text-[7px] font-extrabold tracking-tighter"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full border flex items-center justify-center transition-all shrink-0 ${denoGlobalMode === 'add' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}>
                          {denoGlobalMode === 'add' && <span className="w-0.5 h-0.5 rounded-full bg-white" />}
                        </span>
                        <span className={denoGlobalMode === 'add' ? 'text-emerald-800' : 'text-slate-500'}>ADD</span>
                      </button>
                      <button
                        type="button"
                        disabled={isDayEnded}
                        onClick={() => setDenoGlobalMode('less')}
                        className="flex items-center space-x-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group text-[7px] font-extrabold tracking-tighter"
                      >
                        <span className={`w-1.5 h-1.5 rounded-full border flex items-center justify-center transition-all shrink-0 ${denoGlobalMode === 'less' ? 'border-rose-600 bg-rose-600' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}>
                          {denoGlobalMode === 'less' && <span className="w-0.5 h-0.5 rounded-full bg-white" />}
                        </span>
                        <span className={denoGlobalMode === 'less' ? 'text-rose-800' : 'text-slate-500'}>LESS</span>
                      </button>
                    </div>
                 </div>
                 <div className="text-center whitespace-nowrap">Qty</div>
                 <div className="text-right whitespace-nowrap">Amount</div>
              </div>
              <div className="flex flex-col gap-0.5">
              {DENOMINATIONS.map((val, idx) => {
                const s = denoStats[val] || { opening: 0, today: 0 };
                const totalAmt = s.opening + s.today;
                const noteQty = totalAmt / val;
                return (
                  <div key={val} className="grid grid-cols-[1fr_0.75fr_1.15fr_0.8fr_1.6fr] items-center bg-slate-50/80 py-[2px] px-1 rounded-md border border-slate-100 hover:border-emerald-200 hover:bg-emerald-50/30 transition-all group text-slate-900 gap-1 shadow-2xs">
                     <div className="font-black text-[11px] text-slate-800">{val}</div>
                     <div className="text-center text-[9.5px] font-semibold text-slate-600">{s.opening.toLocaleString()}</div>
                     <div className="relative">
                        <input 
                          id={`deno-input-${val}`}
                          type="number" 
                          disabled={isDayEnded}
                          value={denoQuantities[val] || ''} 
                          onChange={e => setDenoQuantities({...denoQuantities, [val]: e.target.value})}
                          onKeyDown={e => {
                            if (isDayEnded) return;
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              if (idx < DENOMINATIONS.length - 1) {
                                const nextInput = document.getElementById(`deno-input-${DENOMINATIONS[idx + 1]}`) as HTMLInputElement;
                                if (nextInput) {
                                  nextInput.focus();
                                  nextInput.select();
                                }
                              }
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              if (idx > 0) {
                                const prevInput = document.getElementById(`deno-input-${DENOMINATIONS[idx - 1]}`) as HTMLInputElement;
                                if (prevInput) {
                                  prevInput.focus();
                                  prevInput.select();
                                }
                              }
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              commitDeno(val);
                              if (idx < DENOMINATIONS.length - 1) {
                                const nextInput = document.getElementById(`deno-input-${DENOMINATIONS[idx + 1]}`) as HTMLInputElement;
                                if (nextInput) {
                                  nextInput.focus();
                                  nextInput.select();
                                }
                              }
                            }
                          }}
                          className="w-full h-[22px] bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded text-center font-bold text-[11px] text-slate-900 outline-none shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          placeholder="0"
                        />
                     </div>
                     <div className={`text-center font-bold text-[11px] tabular-nums ${noteQty !== 0 ? 'text-slate-800' : 'text-slate-300'}`}>
                       {noteQty.toLocaleString()}
                     </div>
                     <button 
                       onClick={() => openDetails('cash', val)}
                       className={`text-right font-black text-[11px] tracking-tight tabular-nums hover:text-emerald-700 hover:underline cursor-pointer ${totalAmt !== 0 ? 'text-slate-900' : 'text-slate-300'}`}
                     >
                       {totalAmt.toLocaleString()}
                     </button>
                  </div>
                );
              })}
              </div>
          </div>
        </div>

        {/* Col 2: Remittance */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden self-start">
           <div className="py-1.5 px-3 flex items-center justify-between bg-gradient-to-r from-teal-800 to-cyan-900 text-white shrink-0">
             <div className="flex items-center space-x-1.5 text-white">
                <div className="w-4.5 h-4.5 rounded-md bg-teal-500/20 border border-teal-400/30 flex items-center justify-center text-teal-300">
                  <ArrowRightLeft size={11}/>
                </div>
                <h3 className="font-bold uppercase tracking-tight text-[10.5px]">Remittance Hub</h3>
                {/* Circled Transfer Icon Button */}
                <button
                  type="button"
                  disabled={isDayEnded}
                  onClick={transferRemittanceToBackOffice}
                  className="p-0.5 bg-emerald-500 hover:bg-emerald-400 text-white rounded-full flex items-center justify-center transition-all shadow-md group ring-1 ring-emerald-300/40 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                  title="Transfer Remittance"
                >
                  <ArrowRightLeft size={10} className="group-hover:rotate-180 transition-transform duration-300" />
                </button>
             </div>
             <div className="text-[11.5px] font-black text-teal-100 font-mono tracking-tight">
                रू {totalRemitBalance.toLocaleString()}
             </div>
          </div>
          <div className="p-1.5 flex flex-col">
              <div className="grid grid-cols-[1fr_1.3fr_0.9fr_0.5fr] text-[9px] font-extrabold text-slate-600 uppercase px-1 mb-0.5 items-center border-b border-slate-100 pb-1 pt-0 gap-1 shrink-0">
                 <div className="whitespace-nowrap">Partner</div>
                 <div className="text-center flex justify-center">
                     <div className="flex items-center justify-center space-x-0.5 bg-slate-100 rounded p-0.5 border border-slate-200 shadow-2xs">
                       <button
                         type="button"
                         disabled={isDayEnded}
                         onClick={() => setRemitGlobalMode(RemittanceType.RECEIVE)}
                         className="flex items-center space-x-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group text-[7px] font-extrabold tracking-tighter"
                       >
                         <span className={`w-1.5 h-1.5 rounded-full border flex items-center justify-center transition-all shrink-0 ${remitGlobalMode === RemittanceType.RECEIVE ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}>
                           {remitGlobalMode === RemittanceType.RECEIVE && <span className="w-0.5 h-0.5 rounded-full bg-white" />}
                         </span>
                         <span className={remitGlobalMode === RemittanceType.RECEIVE ? 'text-emerald-800' : 'text-slate-500'}>PAID</span>
                       </button>
                       <button
                         type="button"
                         disabled={isDayEnded}
                         onClick={() => setRemitGlobalMode(RemittanceType.SEND)}
                         className="flex items-center space-x-0.5 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed group text-[7px] font-extrabold tracking-tighter"
                       >
                         <span className={`w-1.5 h-1.5 rounded-full border flex items-center justify-center transition-all shrink-0 ${remitGlobalMode === RemittanceType.SEND ? 'border-blue-600 bg-blue-600' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}>
                           {remitGlobalMode === RemittanceType.SEND && <span className="w-0.5 h-0.5 rounded-full bg-white" />}
                         </span>
                         <span className={remitGlobalMode === RemittanceType.SEND ? 'text-blue-800' : 'text-slate-500'}>SEND</span>
                       </button>
                     </div>
                 </div>
                 <div className="text-center whitespace-nowrap">Bal</div>
                 <div className="text-center whitespace-nowrap">Qty</div>
              </div>
              <div className="flex flex-col gap-0.5">
              {remittanceCompanies.map((co, idx) => {
                const s = remitStats[co] || { opening: 0, today: 0, count: 0 };
                const bal = s.opening + s.today;
                return (
                  <div key={co} className="grid grid-cols-[1fr_1.3fr_0.9fr_0.5fr] items-center bg-slate-50/80 py-[2px] px-1 rounded-md border border-slate-100 hover:border-teal-200 hover:bg-teal-50/30 transition-all group text-slate-900 gap-1 shadow-2xs">
                     <div className="uppercase text-slate-800 font-bold text-[9.5px] truncate" title={co}>{co}</div>
                     <div className="relative">
                        <input 
                          id={`remit-input-${idx}`}
                          type="number" 
                          disabled={isDayEnded}
                          value={remitAmounts[co] || ''} 
                          onChange={e => setRemitAmounts({...remitAmounts, [co]: e.target.value})}
                          onKeyDown={e => {
                            if (isDayEnded) return;
                            if (e.key === 'ArrowDown') {
                              e.preventDefault();
                              if (idx < remittanceCompanies.length - 1) {
                                const nextInput = document.getElementById(`remit-input-${idx + 1}`) as HTMLInputElement;
                                if (nextInput) {
                                  nextInput.focus();
                                  nextInput.select();
                                }
                              }
                            } else if (e.key === 'ArrowUp') {
                              e.preventDefault();
                              if (idx > 0) {
                                const prevInput = document.getElementById(`remit-input-${idx - 1}`) as HTMLInputElement;
                                if (prevInput) {
                                  prevInput.focus();
                                  prevInput.select();
                                }
                              }
                            } else if (e.key === 'Enter') {
                              e.preventDefault();
                              commitSingleRemit(co);
                              if (idx < remittanceCompanies.length - 1) {
                                const nextInput = document.getElementById(`remit-input-${idx + 1}`) as HTMLInputElement;
                                if (nextInput) {
                                  nextInput.focus();
                                  nextInput.select();
                                }
                              }
                            }
                          }}
                          className="w-full h-[22px] bg-white border border-slate-200 focus:border-teal-500 focus:ring-1 focus:ring-teal-500/20 rounded px-1 text-center font-bold text-slate-900 outline-none text-[11px] shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
                          placeholder="0"
                        />
                     </div>
                     <div className="text-center">
                        <button 
                            onClick={() => openDetails('remittance', co)}
                            className={`font-black hover:text-teal-700 hover:underline text-[11px] tracking-tight tabular-nums cursor-pointer ${bal !== 0 ? 'text-slate-900' : 'text-slate-300'}`}
                        >
                          {bal !== 0 ? bal.toLocaleString() : '-'}
                        </button>
                     </div>
                     <div className="text-center text-slate-700 font-bold text-[9.5px]">
                        {s.count > 0 ? s.count : '-'}
                     </div>
                  </div>
                );
              })}
              </div>
          </div>
        </div>

        {/* Right Section: Col 3 (Teller Counter) & Col 4 (Ledger Entry) + Other Box below them */}
        <div className="lg:col-span-2 flex flex-col gap-2.5 self-start">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-start">
            {/* Col 3: Teller Counter */}
            <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden text-slate-900 self-start">
           <div className="py-1.5 px-3 flex items-center justify-between bg-gradient-to-r from-slate-900 via-slate-800 to-indigo-950 text-white shrink-0">
             <div className="flex items-center space-x-1.5">
                <div className="w-4.5 h-4.5 rounded-md bg-indigo-500/20 border border-indigo-400/30 flex items-center justify-center text-indigo-300">
                  <Calculator size={11}/>
                </div>
                <h3 className="font-bold uppercase tracking-tight text-[10.5px]">Teller Counter</h3>
             </div>
             <button onClick={() => openDetails('office')} className="text-[11.5px] font-black text-indigo-200 hover:text-white hover:underline font-mono tracking-tight cursor-pointer px-1.5 py-0.5 bg-white/10 rounded-md">
                रू {Math.abs(officeNet).toLocaleString()}
             </button>
          </div>
          <DayEndFieldset branchId={currentBranchId} className="p-2 flex flex-col bg-gradient-to-b from-white to-slate-50/50">
             <div className="space-y-1.5">
                {/* Row 1: Head & Type */}
                <div className="grid grid-cols-2 gap-1.5">
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black uppercase text-slate-600 tracking-wider ml-0.5 block">Account Head</label>
                      <select 
                        value={newOffice.head} 
                        onChange={e => handleOfficeHeadChange(e.target.value)}
                        className="w-full h-7 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-lg px-2 font-bold text-[11px] uppercase outline-none text-slate-800 shadow-2xs cursor-pointer"
                      >
                          <option value="Saving">SAVING</option>
                          <option value="Bank">BANK A/C</option>
                          <option value="Entry Fee">ENTRY FEE</option>
                          <option value="IBT">IBT (BRANCH TRANSFER)</option>
                          <option value="Share">SHARE</option>
                          <option value="Expenses">EXPENSE</option>
                          <option value="Remittance">REMITTANCE</option>
                      </select>
                    </div>
                    <div className="space-y-0.5">
                      <label className="text-[9px] font-black uppercase text-slate-600 tracking-wider ml-0.5 block">Cash Flow</label>
                      <div className="flex items-center justify-around h-7 bg-white border border-slate-200 rounded-lg px-1 shadow-2xs">
                        <button
                          type="button"
                          disabled={newOffice.head === 'Share' || newOffice.head === 'Entry Fee' || newOffice.head === 'Expenses' || newOffice.head === 'Remittance'}
                          onClick={() => setNewOffice({...newOffice, type: 'in'})}
                          className="flex items-center space-x-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group text-[7.5px] font-black tracking-tight"
                        >
                          <span className={`w-2 h-2 rounded-full border flex items-center justify-center transition-all shrink-0 ${newOffice.type === 'in' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}>
                            {newOffice.type === 'in' && <span className="w-0.5 h-0.5 rounded-full bg-white" />}
                          </span>
                          <span className={newOffice.type === 'in' ? 'text-emerald-800 font-black' : 'text-slate-500'}>RECEIVED</span>
                        </button>
                        <button
                          type="button"
                          disabled={newOffice.head === 'Share' || newOffice.head === 'Entry Fee' || newOffice.head === 'Expenses' || newOffice.head === 'Remittance'}
                          onClick={() => setNewOffice({...newOffice, type: 'out'})}
                          className="flex items-center space-x-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed group text-[7.5px] font-black tracking-tight"
                        >
                          <span className={`w-2 h-2 rounded-full border flex items-center justify-center transition-all shrink-0 ${newOffice.type === 'out' ? 'border-rose-600 bg-rose-600' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}>
                            {newOffice.type === 'out' && <span className="w-0.5 h-0.5 rounded-full bg-white" />}
                          </span>
                          <span className={newOffice.type === 'out' ? 'text-rose-800 font-black' : 'text-slate-500'}>PAID</span>
                        </button>
                      </div>
                    </div>
                </div>

                {/* Row 2: Amount */}
                <div className="space-y-0.5">
                   <label className="text-[9px] font-black uppercase text-slate-600 tracking-wider ml-0.5 block">Entry Amount</label>
                   <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-[11px]">रू</span>
                      <input 
                        type="number" 
                        placeholder="0.00"
                        value={newOffice.amount}
                        onChange={e => setNewOffice({...newOffice, amount: e.target.value})}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitOffice();
                          }
                        }}
                        className="w-full h-7 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-lg pl-7 pr-2.5 font-black text-sm text-slate-900 outline-none transition-all tracking-tight shadow-2xs"
                      />
                   </div>
                </div>

                {/* Row 3: Narration */}
                <div className="space-y-0.5">
                   <label className="text-[9px] font-black uppercase text-slate-600 tracking-wider ml-0.5 block">Remarks</label>
                   <input 
                     type="text"
                     placeholder="ENTER REMARKS / DETAILS..."
                     value={newOffice.remarks}
                     onChange={e => setNewOffice({...newOffice, remarks: e.target.value})}
                     onKeyDown={e => {
                       if (e.key === 'Enter') {
                         e.preventDefault();
                         commitOffice();
                       }
                     }}
                     className="w-full h-7 bg-white border border-slate-200 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/20 rounded-lg px-2 font-medium text-[11px] text-slate-800 outline-none uppercase shadow-2xs"
                   />
                </div>
             </div>

             {/* Action Button */}
             <button 
               onClick={commitOffice} 
               className="w-full h-8 bg-slate-900 hover:bg-slate-800 active:scale-[0.99] text-white rounded-lg font-black uppercase text-[11px] tracking-wider flex items-center justify-center space-x-1.5 shadow-md shadow-slate-900/20 transition-all cursor-pointer mt-2"
             >
                {newOffice.id ? <Save size={13}/> : <Plus size={13} strokeWidth={3}/>}
                <span>{newOffice.id ? 'UPDATE' : 'SUBMIT'}</span>
             </button>
          </DayEndFieldset>
        </div>

        {/* Col 4: Ledger Entry */}
        <div className="bg-white rounded-2xl border border-slate-200/90 shadow-sm hover:shadow-md transition-shadow flex flex-col overflow-hidden text-slate-900 self-start">
           <div className="py-1.5 px-3 flex items-center justify-between bg-gradient-to-r from-emerald-900 via-teal-900 to-slate-900 text-white shrink-0">
             <div className="flex items-center space-x-1.5">
                <div className="w-4.5 h-4.5 rounded-md bg-emerald-500/20 border border-emerald-400/30 flex items-center justify-center text-emerald-300">
                  <LayoutGrid size={11}/>
                </div>
                <h3 className="font-bold uppercase tracking-tight text-[10.5px]">Ledger Entry</h3>
             </div>
             <button onClick={() => openDetails('ledger')} className="text-[11.5px] font-black text-emerald-200 hover:text-white hover:underline font-mono tracking-tight cursor-pointer px-1.5 py-0.5 bg-white/10 rounded-md">
                रू {Math.abs(transNet).toLocaleString()}
             </button>
          </div>
          <DayEndFieldset branchId={currentBranchId} className="p-2 flex flex-col bg-gradient-to-b from-white to-emerald-50/20">
             <div className="space-y-1.5">
                {/* Row 1: Account Title & Flow */}
                <div className="grid grid-cols-12 gap-1.5">
                    <div className="col-span-7 space-y-0.5">
                        <label className="text-[9px] font-black uppercase text-slate-600 tracking-wider ml-0.5 block">Account Title</label>
                        <input 
                          type="text" 
                          placeholder="SEARCH A/C..." 
                          value={newTrans.name}
                          onChange={e => setNewTrans({...newTrans, name: e.target.value})}
                          className="w-full h-7 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-lg px-2 font-bold text-[11px] uppercase outline-none text-slate-900 shadow-2xs" 
                          list="ledger-list"
                        />
                        <datalist id="ledger-list">
                          {ledgerAccounts.map(la => (
                            <option key={la.id} value={la.name} />
                          ))}
                        </datalist>
                    </div>

                    <div className="col-span-5 space-y-0.5">
                      <label className="text-[9px] font-black uppercase text-slate-600 tracking-wider ml-0.5 block">Cash Flow</label>
                      <div className="flex items-center justify-around h-7 bg-white border border-slate-200 rounded-lg px-1 shadow-2xs">
                        <button
                          type="button"
                          onClick={() => setNewTrans({...newTrans, type: 'in'})}
                          className="flex items-center space-x-0.5 cursor-pointer group text-[7.5px] font-black tracking-tight"
                        >
                          <span className={`w-2 h-2 rounded-full border flex items-center justify-center transition-all shrink-0 ${newTrans.type === 'in' ? 'border-emerald-600 bg-emerald-600' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}>
                            {newTrans.type === 'in' && <span className="w-0.5 h-0.5 rounded-full bg-white" />}
                          </span>
                          <span className={newTrans.type === 'in' ? 'text-emerald-800 font-black' : 'text-slate-500'}>IN</span>
                        </button>
                        <button
                          type="button"
                          onClick={() => setNewTrans({...newTrans, type: 'out'})}
                          className="flex items-center space-x-0.5 cursor-pointer group text-[7.5px] font-black tracking-tight"
                        >
                          <span className={`w-2 h-2 rounded-full border flex items-center justify-center transition-all shrink-0 ${newTrans.type === 'out' ? 'border-rose-600 bg-rose-600' : 'border-slate-300 bg-white group-hover:border-slate-400'}`}>
                            {newTrans.type === 'out' && <span className="w-0.5 h-0.5 rounded-full bg-white" />}
                          </span>
                          <span className={newTrans.type === 'out' ? 'text-rose-800 font-black' : 'text-slate-500'}>OUT</span>
                        </button>
                      </div>
                    </div>
                </div>

                {/* Row 2: Amount */}
                <div className="space-y-0.5">
                   <label className="text-[9px] font-black uppercase text-slate-600 tracking-wider ml-0.5 block">Ledger Amount</label>
                   <div className="relative">
                      <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-[11px]">रू</span>
                      <input 
                        type="number" 
                        placeholder="0.00" 
                        value={newTrans.amount}
                        onChange={e => setNewTrans({...newTrans, amount: e.target.value})}
                        onKeyDown={e => {
                          if (e.key === 'Enter') {
                            e.preventDefault();
                            commitLedger();
                          }
                        }}
                        className="w-full h-7 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-lg pl-7 pr-2.5 font-black text-sm text-slate-900 outline-none shadow-2xs tracking-tight" 
                      />
                   </div>
                </div>

                {/* Row 3: Particulars/Remarks */}
                <div className="space-y-0.5">
                   <label className="text-[9px] font-black uppercase text-slate-600 tracking-wider ml-0.5 block">Remarks</label>
                   <input 
                     type="text"
                     placeholder="ENTER REMARKS..." 
                     value={newTrans.particular}
                     onChange={e => setNewTrans({...newTrans, particular: e.target.value})}
                     onKeyDown={e => {
                       if (e.key === 'Enter') {
                         e.preventDefault();
                         commitLedger();
                       }
                     }}
                     className="w-full h-7 bg-white border border-slate-200 focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500/20 rounded-lg px-2 font-medium text-[11px] text-slate-800 outline-none uppercase shadow-2xs"
                   />
                </div>
             </div>

             {/* Action Button */}
             <button 
                 onClick={commitLedger} 
                 className="w-full h-8 bg-emerald-800 hover:bg-emerald-900 active:scale-[0.99] text-white rounded-lg font-black uppercase text-[11px] tracking-wider shadow-md shadow-emerald-800/20 transition-all flex items-center justify-center space-x-1.5 cursor-pointer mt-2"
             >
                 {newTrans.id ? <Save size={13}/> : <Send size={13}/>}
                 <span>{newTrans.id ? 'UPDATE' : 'SUBMIT & NOTIFY'}</span>
             </button>
          </DayEndFieldset>
        </div>
      </div>

      {/* 4-Column Other Adjustment Box: Other (with Radio Dots) | Amount | Remark | Total Balance */}
      <div className="bg-white rounded-xl border border-slate-200/90 shadow-xs hover:shadow-sm transition-shadow overflow-hidden text-slate-900">
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-12 divide-y sm:divide-y-0 sm:divide-x divide-slate-200/80 items-center">
          
          {/* Column 1: Other Name & Add/Less Radio Dots (Tight gap, always fully visible) */}
          <div className="col-span-1 xl:col-span-3 p-2 px-3 bg-slate-50/70 flex items-center justify-between gap-1.5 min-w-0 h-11 flex-nowrap">
            <span className="font-black text-xs uppercase tracking-wider text-slate-800 shrink-0">
              Other
            </span>

            {/* Circular Radio Dots (Compact Pill at Right Corner, Very Small Gap) */}
            <div className="flex items-center space-x-1 shrink-0 bg-white px-1.5 py-0.5 rounded-full border border-slate-200 shadow-2xs">
              {/* ADD Radio Dot - Green */}
              <button 
                type="button"
                disabled={isDayEnded}
                onClick={() => setOtherType('add')}
                title="ADD (+)"
                className="p-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none group flex items-center justify-center rounded-full hover:bg-emerald-50 transition-colors"
              >
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                  otherType === 'add' 
                    ? 'border-emerald-600 bg-emerald-500 ring-2 ring-emerald-500/30' 
                    : 'border-slate-300 bg-white group-hover:border-emerald-500'
                }`}>
                  {otherType === 'add' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  )}
                </span>
              </button>

              {/* LESS Radio Dot - Red */}
              <button 
                type="button"
                disabled={isDayEnded}
                onClick={() => setOtherType('less')}
                title="LESS (-)"
                className="p-0.5 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed select-none group flex items-center justify-center rounded-full hover:bg-rose-50 transition-colors"
              >
                <span className={`w-3.5 h-3.5 rounded-full border-2 flex items-center justify-center transition-all shrink-0 ${
                  otherType === 'less' 
                    ? 'border-rose-600 bg-rose-500 ring-2 ring-rose-500/30' 
                    : 'border-slate-300 bg-white group-hover:border-rose-500'
                }`}>
                  {otherType === 'less' && (
                    <span className="w-1.5 h-1.5 rounded-full bg-white"></span>
                  )}
                </span>
              </button>
            </div>
          </div>

          {/* Column 2: Amount Input (Pressing Enter adds directly to balance) */}
          <div className="col-span-1 xl:col-span-3 p-1.5 px-2.5 bg-white flex items-center min-w-0 h-11">
            <div className="relative w-full">
              <span className="absolute left-2.5 top-1/2 -translate-y-1/2 font-bold text-slate-400 text-xs">रू</span>
              <input
                id="other-amount-field"
                ref={otherAmountInputRef}
                type="number"
                step="any"
                disabled={isDayEnded}
                placeholder="0.00"
                value={otherAmountInput}
                onChange={(e) => setOtherAmountInput(e.target.value)}
                onKeyDown={(e) => {
                  if (isDayEnded) return;
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    handleAddOtherEntry();
                  }
                }}
                className="w-full h-8 bg-white border border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 rounded-md pl-6 pr-2 font-black text-xs text-slate-900 outline-none text-right tabular-nums shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
              />
            </div>
          </div>

          {/* Column 3: Remark Input (Compact Column) */}
          <div className="col-span-1 xl:col-span-2 p-1.5 px-2 bg-white flex items-center min-w-0 h-11">
            <input
              id="other-remarks-field"
              ref={otherRemarksInputRef}
              type="text"
              disabled={isDayEnded}
              placeholder="Remarks..."
              value={otherRemarksInput}
              onChange={(e) => setOtherRemarksInput(e.target.value)}
              onKeyDown={(e) => {
                if (isDayEnded) return;
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handleAddOtherEntry();
                }
              }}
              className="w-full min-w-0 h-8 bg-white border border-slate-200 focus:border-emerald-600 focus:ring-1 focus:ring-emerald-500/20 rounded-md px-2.5 font-medium text-[11px] text-slate-800 outline-none placeholder:text-slate-400 shadow-2xs disabled:bg-slate-100 disabled:text-slate-400 disabled:cursor-not-allowed"
            />
          </div>

          {/* Column 4: Total Balance - Click to Open Table */}
          <div className="col-span-1 xl:col-span-4 p-1.5 px-2.5 bg-slate-50/70 flex items-center min-w-0 h-11">
            <button
              type="button"
              onClick={() => setIsOtherModalOpen(true)}
              title="Click to view breakdown table"
              className={`w-full h-8 px-2.5 rounded-md border text-right font-black text-xs tabular-nums flex items-center justify-between transition-all cursor-pointer shadow-2xs ${
                otherTotalBalance > 0
                  ? 'bg-emerald-50/90 text-emerald-800 border-emerald-300 hover:bg-emerald-100 hover:border-emerald-400'
                  : otherTotalBalance < 0
                    ? 'bg-rose-50/90 text-rose-800 border-rose-300 hover:bg-rose-100 hover:border-rose-400'
                    : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-100'
              }`}
            >
              <span className="text-[10px] font-bold text-slate-500">Total:</span>
              <span className="flex items-center space-x-1.5">
                <span className="tracking-tight">
                  {otherTotalBalance > 0 ? '+' : ''}रू {otherTotalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
                <span className="text-[9px] bg-white/90 px-1.5 py-0.2 rounded border border-slate-300/60 text-slate-600 font-bold">
                  {currentOtherEntries.length}
                </span>
              </span>
            </button>
          </div>

        </div>
      </div>
    </div>

  </div>

      {/* Other Adjustments Breakdown Table Modal (S.N., Amount, Narration, User, Balance) */}
      {isOtherModalOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[2000] flex items-center justify-center p-3 sm:p-4 text-slate-900 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 flex flex-col max-h-[90vh]">
            {/* Modal Header */}
            <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-800 via-slate-850 to-emerald-900 text-white shrink-0">
              <div className="flex items-center space-x-2.5">
                <div className="w-7 h-7 bg-emerald-500/20 text-emerald-300 rounded-lg flex items-center justify-center border border-emerald-400/30">
                  <Receipt size={15} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black tracking-tight text-white uppercase">
                    Other Adjustments Breakdown
                  </h3>
                  <p className="text-[10px] text-emerald-200/80 font-medium">
                    Date: {selectedDate} | Total Entries: {currentOtherEntries.length}
                  </p>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setIsOtherModalOpen(false)}
                className="p-1.5 bg-slate-700/60 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-all shadow-xs cursor-pointer"
                title="Close"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body: Table */}
            <div className="p-4 overflow-y-auto flex-1">
              {currentOtherEntries.length === 0 ? (
                <div className="py-12 text-center text-slate-400 font-bold text-xs">
                  No other adjustments recorded yet.
                </div>
              ) : (
                <div className="border border-slate-200 rounded-xl overflow-hidden shadow-2xs">
                  <table className="w-full text-left border-collapse text-xs">
                    <thead>
                      <tr className="bg-slate-100 text-slate-700 text-[10px] font-black uppercase tracking-wider border-b border-slate-200">
                        <th className="py-2.5 px-3 w-12 text-center">S.N.</th>
                        <th className="py-2.5 px-3 w-24 text-center">Type</th>
                        <th className="py-2.5 px-3 text-right">Amount</th>
                        <th className="py-2.5 px-3">Narration</th>
                        <th className="py-2.5 px-3">User</th>
                        <th className="py-2.5 px-3 text-right">Balance</th>
                        <th className="py-2.5 px-3 w-14 text-center">Action</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {currentOtherEntries.map((entry, idx) => (
                        <tr key={entry.id || idx} className="hover:bg-slate-50/80 transition-colors">
                          <td className="py-2 px-3 text-center font-bold text-slate-500 text-[11px]">
                            {idx + 1}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <span className={`inline-flex items-center px-2 py-0.5 rounded text-[9px] font-black ${
                              entry.type === 'add'
                                ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                : 'bg-rose-100 text-rose-800 border border-rose-200'
                            }`}>
                              <span className={`w-1.5 h-1.5 rounded-full mr-1 ${
                                entry.type === 'add' ? 'bg-emerald-600' : 'bg-rose-600'
                              }`}></span>
                              {entry.type === 'add' ? 'ADD (+)' : 'LESS (-)'}
                            </span>
                          </td>
                          <td className={`py-2 px-3 text-right font-black tabular-nums text-xs ${
                            entry.type === 'add' ? 'text-emerald-700' : 'text-rose-700'
                          }`}>
                            {entry.type === 'add' ? '+' : '-'}रू {entry.amount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 font-medium text-slate-800 text-[11px]">
                            {entry.remarks || '-'}
                          </td>
                          <td className="py-2 px-3 text-slate-600 text-[10.5px]">
                            <span className="font-semibold text-slate-700">{entry.userName || 'Front Teller'}</span>
                          </td>
                          <td className={`py-2 px-3 text-right font-black tabular-nums text-xs ${
                            (entry.runningBalance || 0) >= 0 ? 'text-slate-900' : 'text-rose-700'
                          }`}>
                            रू {(entry.runningBalance || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </td>
                          <td className="py-2 px-3 text-center">
                            <button
                              type="button"
                              onClick={() => handleDeleteOtherEntry(entry.id)}
                              disabled={isLocked || isDayEnded}
                              title="Delete entry"
                              className="p-1 rounded text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>

            {/* Modal Footer Summary */}
            <div className="px-4 py-3 bg-slate-50 border-t border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
              <div className="flex items-center space-x-3 text-xs font-bold text-slate-600">
                <span>
                  Total Add: <b className="text-emerald-700">+रू {currentOtherEntries.filter(e => e.type === 'add').reduce((s, e) => s + e.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                </span>
                <span>
                  Total Less: <b className="text-rose-700">-रू {currentOtherEntries.filter(e => e.type === 'less').reduce((s, e) => s + e.amount, 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</b>
                </span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-xs font-bold text-slate-500">Net Total Balance:</span>
                <span className={`px-2.5 py-1 rounded-lg border font-black text-xs tabular-nums ${
                  otherTotalBalance > 0
                    ? 'bg-emerald-100 text-emerald-800 border-emerald-300'
                    : otherTotalBalance < 0
                      ? 'bg-rose-100 text-rose-800 border-rose-300'
                      : 'bg-slate-200 text-slate-800 border-slate-300'
                }`}>
                  {otherTotalBalance > 0 ? '+' : ''}रू {otherTotalBalance.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </span>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail Modal */}
      {detailModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xs z-[2000] flex items-start justify-center pt-6 sm:pt-10 p-3 sm:p-4 overflow-y-auto text-slate-900 animate-in fade-in duration-150">
           <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150 my-auto sm:my-0">
              {/* Compact Header with Minimal Height */}
              <div className="px-4 py-3 sm:px-5 sm:py-3.5 border-b border-slate-200 flex items-center justify-between bg-gradient-to-r from-slate-800 via-slate-850 to-emerald-900 text-white">
                 <div className="flex items-center space-x-2.5">
                   <div className="w-7 h-7 bg-emerald-500/20 text-emerald-300 rounded-lg flex items-center justify-center border border-emerald-400/30">
                     <Receipt size={15} />
                   </div>
                   <h3 className="text-xs sm:text-sm font-black tracking-tight text-white uppercase">{detailModal.title}</h3>
                 </div>
                 <button 
                   onClick={() => setDetailModal(p => ({ ...p, isOpen: false }))} 
                   className="p-1.5 bg-slate-700/60 hover:bg-rose-600 text-slate-300 hover:text-white rounded-lg transition-all shadow-xs cursor-pointer"
                   title="Close"
                 >
                   <X size={16}/>
                 </button>
              </div>

              {/* Compact Table Body */}
              <div className="p-3 sm:p-4 max-h-[75vh] overflow-y-auto">
                 <table className="w-full text-xs font-bold border-collapse text-center">
                    <thead>
                       <tr className="bg-slate-100 text-slate-700 uppercase tracking-wider text-[10px] border-b border-slate-200">
                          <th className="py-2.5 px-3 text-left border-r border-slate-200 font-extrabold">Particulars / Head</th>
                          <th className="py-2.5 px-3 border-r border-slate-200 font-extrabold">Operation Type</th>
                          <th className="py-2.5 px-3 text-left border-r border-slate-200 font-extrabold">Entered By / User</th>
                          <th className="py-2.5 px-3 text-right border-r border-slate-200 font-extrabold">Net Amount</th>
                          <th className="py-2.5 px-3 font-extrabold">Control</th>
                       </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                       {detailModal.entries.length === 0 ? (
                         <tr><td colSpan={5} className="py-12 text-slate-400 uppercase tracking-widest font-bold text-center text-xs">Log is currently empty</td></tr>
                       ) : (
                         detailModal.entries.map((ent) => {
                            const isDeno = 'value' in ent;
                            const isRemit = 'companyName' in ent;
                            const isOffice = 'head' in ent;
                            const isLedger = 'description' in ent;
                            
                            const title = isOffice ? ent.head : 
                                         isLedger ? ent.description : 
                                         isRemit ? ent.companyName : 
                                         `Value: ${ent.value}`;
                            
                            const subtitle = ent.remarks || 
                                             (isDeno ? `Quantity: ${ent.quantity}` : 'Audit Entry');
                            const amount = isDeno ? (ent.value * ent.quantity) : ent.amount;
                            const isVaultTransfer = isDeno && ent.isVaultTransfer;
                            const userMeta = resolveUserDisplay(ent);

                            return (
                              <tr key={ent.id} className="hover:bg-slate-50 transition-colors">
                                <td className="py-2 px-3 text-left border-r border-slate-100">
                                  <div className="text-slate-950 uppercase font-black text-xs">{title}</div>
                                  <div className="text-[10px] text-slate-500 font-semibold uppercase tracking-wider">{subtitle}</div>
                                </td>
                                <td className="py-2 px-3 border-r border-slate-100">
                                  <span className={`px-2.5 py-0.5 rounded-full text-[9px] uppercase font-black tracking-wider ${ent.type === 'in' || ent.type === 'add' || ent.type === RemittanceType.SEND ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                    {ent.type}
                                  </span>
                                </td>
                                <td className="py-2 px-3 border-r border-slate-100 text-left">
                                  <div className="text-slate-900 font-black text-xs uppercase">
                                    {userMeta.name}
                                  </div>
                                </td>
                                <td className="py-2 px-3 text-right text-slate-950 text-xs sm:text-sm font-black border-r border-slate-100">रू {amount.toLocaleString()}</td>
                                <td className="py-2 px-3">
                                  <div className="flex items-center justify-center space-x-1.5">
                                    {isVaultTransfer ? (
                                      <div className="flex items-center text-slate-400 text-[10px] uppercase font-bold">
                                        <Lock size={12} className="mr-1"/> Locked
                                      </div>
                                    ) : (
                                      <>
                                        <button 
                                          type="button"
                                          disabled={isDayEnded}
                                          onClick={() => {
                                            if (isLocked) return showToast('Session Locked', 'error');
                                            if (isDayEndedForBranch(currentBranchId)) return showToast(getDayEndedBlockMessage(), 'error');
                                            if (isOffice) setNewOffice({ ...ent, amount: ent.amount.toString() });
                                            else if (isLedger) setNewTrans({ id: ent.id, name: ent.description, amount: ent.amount.toString(), particular: ent.remarks || '', type: ent.type });
                                            else if (isDeno) {
                                               setDenoQuantities({ ...denoQuantities, [ent.value]: ent.quantity.toString() });
                                               setDenoGlobalMode(ent.type);
                                               const newData = { ...data, denoAdjustments: data.denoAdjustments.filter(a => a.id !== ent.id) };
                                               setData(newData);
                                               storageService.saveDayData(selectedDate, currentBranchId, newData);
                                            }
                                            setDetailModal(p => ({ ...p, isOpen: false }));
                                          }}
                                          className="p-1.5 bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-600 hover:text-white transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                          title="Edit"
                                        >
                                           <Edit2 size={13}/>
                                        </button>
                                        <button 
                                          type="button"
                                          disabled={isDayEnded}
                                          onClick={() => deleteEntry(detailModal.type, ent.id)}
                                          className="p-1.5 bg-rose-50 text-rose-600 rounded-lg hover:bg-rose-600 hover:text-white transition-all shadow-xs cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                          title="Delete"
                                        >
                                           <Trash2 size={13}/>
                                        </button>
                                      </>
                                    )}
                                  </div>
                                </td>
                              </tr>
                            );
                         })
                       )}
                    </tbody>
                 </table>
              </div>
           </div>
        </div>
      )}

      {/* Remittance Transfer Destination Modal */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-sm z-[200] flex items-center justify-center p-2 animate-in fade-in duration-150">
          <div className="bg-white rounded-xl max-w-sm w-full overflow-hidden shadow-2xl border border-slate-200">
            
            {/* Modal Header */}
            <div className="bg-gradient-to-r from-slate-800 to-teal-900 text-white px-3 py-2.5 flex items-center justify-between border-b border-slate-700/60">
              <div className="flex items-center space-x-2">
                <div className="p-1 bg-emerald-500/20 text-emerald-400 rounded-lg">
                  <ArrowRightLeft size={14} />
                </div>
                <div>
                  <h3 className="font-extrabold text-xs uppercase tracking-wide text-white">Remittance Transfer Option</h3>
                  <p className="text-[9.5px] text-slate-300 font-semibold">Select Transfer Destination</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="p-1 rounded text-slate-300 hover:text-white hover:bg-slate-700/60 transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Modal Body */}
            <div className="p-2.5 space-y-2 text-slate-800">
              
              {/* Summary Card */}
              {(() => {
                const partnerSums: Record<string, number> = {};
                (data.remittances || []).filter(r => !r.transferredToBackOffice).forEach(r => {
                  partnerSums[r.companyName] = (partnerSums[r.companyName] || 0) + r.amount;
                });
                remittanceCompanies.forEach(co => {
                  const rawVal = (remitAmounts[co] || '').toString().replace(/,/g, '').trim();
                  const amt = parseFloat(rawVal);
                  if (!isNaN(amt) && amt > 0) {
                    partnerSums[co] = (partnerSums[co] || 0) + amt;
                  }
                });
                const totalSum = Object.values(partnerSums).reduce((acc, v) => acc + v, 0);
                const hasEntries = totalSum > 0;

                return (
                  <div className="bg-slate-50 border border-slate-200 rounded-lg p-2 space-y-1">
                    <div className="flex justify-between items-center text-[9.5px] font-black text-slate-500 uppercase tracking-tight border-b border-slate-200 pb-1">
                      <span>PARTNER</span>
                      <span>TYPE: <span className="text-slate-900 font-black">{remitGlobalMode === RemittanceType.RECEIVE ? 'PAID' : 'SEND'}</span></span>
                      <span>AMOUNT</span>
                    </div>
                    <div className="space-y-0.5 max-h-24 overflow-y-auto pr-1">
                      {hasEntries ? (
                        remittanceCompanies.map(co => {
                          const amt = partnerSums[co] || 0;
                          if (amt <= 0) return null;
                          return (
                            <div key={co} className="flex justify-between items-center text-[11px] font-semibold text-slate-700 py-0.5">
                              <span className="font-bold text-slate-900">{co}</span>
                              <span className="font-black text-slate-900">Rs. {amt.toLocaleString()}</span>
                            </div>
                          );
                        })
                      ) : (
                        <div className="text-center py-1 text-[10px] font-bold text-amber-700 bg-amber-50 rounded">
                          No amount entered. Enter amount in table to transfer.
                        </div>
                      )}
                    </div>
                    <div className="border-t border-slate-200 pt-1 flex justify-between items-center text-[11px] font-black text-slate-900">
                      <span>TOTAL</span>
                      <span className="text-emerald-700 text-xs font-black">
                        Rs. {totalSum.toLocaleString()}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Destination Selection Options */}
              <div className="space-y-1">
                <label className="text-[10px] font-black text-slate-700 uppercase tracking-tight block">
                  SELECT TARGET DESTINATION:
                </label>

                <div className="grid grid-cols-1 gap-1">
                  
                  {/* Main Option */}
                  <button
                    type="button"
                    onClick={() => setTransferTarget('main')}
                    className={`p-1.5 px-2 rounded-lg border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                      transferTarget === 'main'
                        ? 'border-emerald-600 bg-emerald-50/90 ring-1 ring-emerald-500/40'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`p-1 rounded-full shrink-0 ${transferTarget === 'main' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Building2 size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-slate-900">1. Transfer Back Office ({currentBranchName})</span>
                        {transferTarget === 'main' && <Check size={12} className="text-emerald-600 font-bold shrink-0" />}
                      </div>
                      <p className="text-[9px] text-slate-500 font-medium truncate">
                        Transfers data to {currentBranchName} Back Office & Remittance Ledger.
                      </p>
                    </div>
                  </button>

                  {/* Consolidated Option */}
                  <button
                    type="button"
                    onClick={() => setTransferTarget('consolidated')}
                    className={`p-1.5 px-2 rounded-lg border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                      transferTarget === 'consolidated'
                        ? 'border-emerald-600 bg-emerald-50/90 ring-1 ring-emerald-500/40'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`p-1 rounded-full shrink-0 ${transferTarget === 'consolidated' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <Layers size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-slate-900">2. Consolidated Report</span>
                        {transferTarget === 'consolidated' && <Check size={12} className="text-emerald-600 font-bold shrink-0" />}
                      </div>
                      <p className="text-[9px] text-slate-500 font-medium truncate">
                        Transfers data to Consolidated Report (सबै शाखाको साझा रिपोर्ट) only.
                      </p>
                    </div>
                  </button>

                  {/* Both Option */}
                  <button
                    type="button"
                    onClick={() => setTransferTarget('both')}
                    className={`p-1.5 px-2 rounded-lg border text-left flex items-center space-x-2 transition-all cursor-pointer ${
                      transferTarget === 'both'
                        ? 'border-emerald-600 bg-emerald-50/90 ring-1 ring-emerald-500/40'
                        : 'border-slate-200 hover:border-slate-300 bg-white'
                    }`}
                  >
                    <div className={`p-1 rounded-full shrink-0 ${transferTarget === 'both' ? 'bg-emerald-600 text-white' : 'bg-slate-100 text-slate-500'}`}>
                      <CheckCircle2 size={12} />
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center justify-between">
                        <span className="text-[11px] font-extrabold text-slate-900">3. Both ({currentBranchName} & Consolidated)</span>
                        {transferTarget === 'both' && <Check size={12} className="text-emerald-600 font-bold shrink-0" />}
                      </div>
                      <p className="text-[9px] text-slate-500 font-medium truncate">
                        Transfers data to both {currentBranchName} and Consolidated Report.
                      </p>
                    </div>
                  </button>

                </div>
              </div>

            </div>

            {/* Modal Actions */}
            <div className="bg-slate-50 px-3 py-2 flex items-center justify-end space-x-2 border-t border-slate-200">
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(false)}
                className="px-3 py-1 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200 transition-colors cursor-pointer"
              >
                Cancel
              </button>
              <button
                type="button"
                disabled={isDayEnded}
                onClick={() => handleExecuteTransfer(transferTarget)}
                className="px-3.5 py-1 rounded-lg text-xs font-extrabold text-white bg-emerald-600 hover:bg-emerald-700 shadow-sm transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
              >
                <ArrowRightLeft size={12} />
                <span>Transfer Now</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Modal for Prompting Email Notification when no email was on file */}
      {pendingEmailPrompt && pendingEmailPrompt.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[2100] flex items-center justify-center p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl overflow-hidden border border-slate-200 animate-in zoom-in-95 duration-150">
            {/* Header */}
            <div className="bg-[#065f46] text-white px-5 py-4 flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="w-9 h-9 bg-white/10 rounded-xl flex items-center justify-center border border-white/20">
                  <Mail size={18} className="text-emerald-200" />
                </div>
                <div>
                  <h3 className="text-sm font-black uppercase tracking-wide">Send Transaction Alert Email</h3>
                  <p className="text-[10px] text-emerald-100 font-medium">Send transaction and balance details email to employee</p>
                </div>
              </div>
              <button
                onClick={() => setPendingEmailPrompt(null)}
                className="p-1.5 bg-white/10 hover:bg-white/20 rounded-lg text-white transition-all cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-5 space-y-4 text-slate-800 text-xs">
              <div className="p-3 bg-emerald-50 border border-emerald-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between">
                  <span className="font-black text-emerald-950 uppercase text-[11px]">{pendingEmailPrompt.recipientName}</span>
                  <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${pendingEmailPrompt.transactionType === 'in' ? 'bg-emerald-200 text-emerald-900' : 'bg-rose-200 text-rose-900'}`}>
                    {pendingEmailPrompt.transactionType === 'in' ? 'CREDIT' : 'DEBIT'}
                  </span>
                </div>
                <div className="grid grid-cols-2 gap-2 text-[11px] pt-1 border-t border-emerald-200/60">
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px]">Transaction Amount:</span>
                    <span className="font-black font-mono text-sm text-slate-900">Rs. {pendingEmailPrompt.amount.toLocaleString(undefined, { minimumFractionDigits: 2 })}</span>
                  </div>
                  <div>
                    <span className="text-slate-500 font-semibold block text-[10px]">Total Balance:</span>
                    <span className={`font-black font-mono text-sm ${pendingEmailPrompt.updatedBalance >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      Rs. {Math.abs(pendingEmailPrompt.updatedBalance).toLocaleString(undefined, { minimumFractionDigits: 2 })}
                    </span>
                    <span className="text-[9px] font-bold block text-slate-600">
                      ({pendingEmailPrompt.balanceType === 'receivable' ? 'Receivable from SACCOS' : pendingEmailPrompt.balanceType === 'payable' ? 'Payable to SACCOS' : 'Balanced'})
                    </span>
                  </div>
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-slate-700 tracking-wider flex items-center space-x-1">
                  <Mail size={12} className="text-emerald-700" />
                  <span>Employee Email Address:</span>
                </label>
                <input
                  type="email"
                  placeholder="employee@example.com"
                  value={pendingEmailPrompt.enteredEmail}
                  onChange={e => setPendingEmailPrompt({ ...pendingEmailPrompt, enteredEmail: e.target.value })}
                  className="w-full h-9 bg-slate-50 border border-slate-300 focus:border-emerald-600 rounded-xl px-3 font-bold text-xs outline-none shadow-xs"
                />
                <p className="text-[9px] text-slate-500 font-medium">
                  This email address will be saved to the profile for future automated alerts.
                </p>
              </div>
            </div>

            {/* Actions */}
            <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex items-center justify-between">
              <button
                type="button"
                onClick={() => setPendingEmailPrompt(null)}
                className="px-4 py-1.5 text-xs font-bold text-slate-600 hover:bg-slate-200 rounded-xl transition-all cursor-pointer"
              >
                Skip / Close
              </button>

              <button
                type="button"
                disabled={pendingEmailPrompt.isSending || !pendingEmailPrompt.enteredEmail.trim()}
                onClick={async () => {
                  const toEmail = pendingEmailPrompt.enteredEmail.trim();
                  if (!toEmail) return;
                  setPendingEmailPrompt(prev => prev ? ({ ...prev, isSending: true }) : null);
                  try {
                    // Update account / employee email for future automated transactions
                    if (pendingEmailPrompt.matchedAccount) {
                      const updatedAcc = { ...pendingEmailPrompt.matchedAccount, email: toEmail };
                      storageService.saveLedgerAccount(updatedAcc).catch(() => {});
                    }
                    if (pendingEmailPrompt.matchedEmployee) {
                      const updatedEmp = { ...pendingEmailPrompt.matchedEmployee, email: toEmail };
                      storageService.saveEmployee(updatedEmp).catch(() => {});
                    }

                    const res = await sendLedgerNotificationEmailApi({
                      to: toEmail,
                      recipientName: pendingEmailPrompt.recipientName,
                      employeeCode: pendingEmailPrompt.employeeCode,
                      transactionType: pendingEmailPrompt.transactionType,
                      amount: pendingEmailPrompt.amount,
                      particular: pendingEmailPrompt.particular,
                      dateBs: selectedDate,
                      dateAd: new Date().toISOString().split('T')[0],
                      branchName: currentBranchName,
                      tellerName: user?.fullName || 'Front Desk Teller',
                      voucherId: `LEDGER-${Date.now().toString().slice(-6)}`,
                      previousBalance: pendingEmailPrompt.previousBalance,
                      updatedBalance: pendingEmailPrompt.updatedBalance,
                      balanceType: pendingEmailPrompt.balanceType,
                      companyName: systemSettings?.systemName || "Ratauli Saving and Credit Cooperative Ltd",
                      companyAddress: systemSettings?.address || "Pipra Rural Municipality -6 (Mahottari)",
                      logoUrl: systemSettings?.logoUrl
                    });

                    if (res.success) {
                      showToast(`Email notification sent to ${toEmail}!`, 'success');
                      setPendingEmailPrompt(null);
                    } else {
                      showToast(`Email error: ${res.message}`, 'error');
                      setPendingEmailPrompt(prev => prev ? ({ ...prev, isSending: false }) : null);
                    }
                  } catch (err: any) {
                    showToast(`Error: ${err.message || 'Failed to send'}`, 'error');
                    setPendingEmailPrompt(prev => prev ? ({ ...prev, isSending: false }) : null);
                  }
                }}
                className="px-5 py-1.5 bg-[#065f46] hover:bg-[#044e3a] disabled:opacity-50 text-white text-xs font-black uppercase rounded-xl transition-all shadow-md flex items-center space-x-1.5 cursor-pointer"
              >
                <Send size={13} className={pendingEmailPrompt.isSending ? "animate-spin" : ""} />
                <span>{pendingEmailPrompt.isSending ? 'Sending...' : 'Send Notification'}</span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Notifications */}
      {toast.show && (
        <div className={`fixed bottom-10 right-10 px-8 py-5 rounded-xl shadow-[0_20px_50px_rgba(0,0,0,0.3)] flex items-center space-x-4 z-[1000] border-l-8 animate-in slide-in-from-right-10 duration-500 ${toast.type === 'success' ? 'bg-slate-950 border-emerald-500 text-white' : 'bg-rose-600 border-rose-950 text-white'}`}>
           {toast.type === 'success' ? <CheckCircle2 size={24} className="text-emerald-400" /> : <AlertCircle size={24} />}
           <div>
              <div className="text-[10px] font-bold uppercase tracking-[0.2em] opacity-50">Operational Hub</div>
              <div className="font-bold text-sm uppercase">{toast.msg}</div>
           </div>
        </div>
      )}

      <ConfirmationModal 
        isOpen={confirmDelete?.isOpen || false}
        title="Confirm Deletion"
        message="Are you sure you want to delete this entry? This action cannot be undone."
        onConfirm={executeDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
};

export default DailyCashEntry;