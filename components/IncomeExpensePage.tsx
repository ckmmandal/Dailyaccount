import React, { useState, useMemo, useEffect, useCallback } from 'react';
import { storageService } from '../services/storageService';
import { supabase } from '../services/supabase';
import { 
  TrendingUp, Save, Printer, Loader2, CheckCircle2, AlertCircle,
  X, Edit2, Trash2, Check, Eye
} from 'lucide-react';
import { NepaliDatePicker } from './NepaliDatePicker';
import { ConfirmationModal } from './ConfirmationModal';
import { OfficeAccountEntry, DailyData } from '../types';
import { useAuth } from '../AuthContext';
import NepaliDate from 'nepali-date-converter';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

interface GroupRecord {
  dateAd: string;
  dateBs: string;
  income: { photocopy: number; other: number; total: number };
  expense: { kitchen: number; other: number; total: number };
  opening: number;
  netIncome: number;
  closing: number;
}

interface ModalEntry {
  id: string;
  head: string;
  remarks: string;
  type: 'in' | 'out';
  amount: number;
  dateStr: string;
  isReadOnly?: boolean;
}

const r2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

const format2 = (val: number | undefined | null): string => {
  const num = Number(val || 0);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const isIncomeExpenseEntry = (t: OfficeAccountEntry | any): boolean => {
  if (!t) return false;
  // Strictly exclude any payroll or staff salary entries
  if (t.origin === 'payroll' || t.id?.startsWith('payroll_')) return false;
  const rem = (t.remarks || '').toLowerCase();
  if (
    rem.includes('payroll') ||
    rem.includes('salary') ||
    rem.includes('staff') ||
    rem.includes('gratuity') ||
    rem.includes('allowance') ||
    rem.includes('provident') ||
    rem.includes('ssf') ||
    rem.includes('pf') ||
    rem.includes('disbursement')
  ) {
    return false;
  }

  // Strictly exclude office expense entries that belong to Teller Ledger
  if (t.origin === 'office_expense' || (t.id?.startsWith('offexp_') && t.origin !== 'income_expense')) return false;

  // Strictly exclude teller counter transactions and other non-income_expense origins
  if (t.origin === 'teller_counter' || t.origin === 'transaction' || t.origin === 'transferred' || t.origin === 'report' || t.origin === 'back_office') return false;

  // Entries created explicitly for income/expense
  if (t.origin === 'income_expense') return true;
  
  // Fallback for legacy data: only include if head explicitly says Photocopy or Kitchen
  const head = (t.head || '').trim().toLowerCase();
  if (head.includes('photocopy') || head.includes('kitchen')) return true;
  return false;
};

// Helper to extract effective income/expense entries including other balance
// (Payable -> Income Other, Receivable -> Expense Other)
const getEffectiveIncomeExpenseEntries = (dayData: DailyData | undefined, dateStr: string): OfficeAccountEntry[] => {
  if (!dayData) return [];
  const offTx = (dayData.officeTransactions || []).filter(isIncomeExpenseEntry);
  const hasAutoOther = offTx.some(t => t.id === `auto_other_diff_${dateStr}` || t.id.startsWith('auto_other_diff_'));
  
  if (!hasAutoOther) {
    let otherNet = 0;
    let remarks = '';
    if (Array.isArray(dayData.otherEntries) && dayData.otherEntries.length > 0) {
      otherNet = dayData.otherEntries.reduce((s, e) => s + (e.type === 'add' ? e.amount : -e.amount), 0);
      remarks = dayData.otherEntries.map(e => `${e.type === 'add' ? '+' : '-'}${e.amount} (${e.remarks || 'No remarks'})`).join('; ');
    } else if (dayData.otherAmount !== undefined && dayData.otherAmount !== 0) {
      otherNet = dayData.otherType === 'less' ? -Math.abs(dayData.otherAmount) : Math.abs(dayData.otherAmount);
      remarks = dayData.otherRemarks || '';
    }

    if (otherNet !== 0) {
      const isPayable = otherNet > 0;
      const syntheticEntry: OfficeAccountEntry = {
        id: `auto_other_diff_${dateStr}`,
        branchId: dayData.branchId || '',
        head: isPayable ? 'Other (Payable Cash Diff)' : 'Other (Receivable Cash Diff)',
        amount: Math.abs(otherNet),
        type: isPayable ? 'in' : 'out',
        date: dateStr,
        remarks: remarks ? `Daily Cash Other Adjustment: ${remarks}` : (isPayable ? 'Payable cash difference transferred to Income' : 'Receivable cash difference transferred to Expense'),
        origin: 'income_expense',
        createdBy: 'system'
      };
      return [...offTx, syntheticEntry];
    }
  }
  return offTx;
};

const IncomeExpensePage: React.FC = () => {
  const { user, branch, settings } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  const today = new Date().toISOString().split('T')[0];
  
  const [dateRange, setDateRange] = useState({
    start: today,
    end: today
  });

  const applyPreset = (preset: 'today' | '3days' | 'week' | 'month') => {
    const today = new Date();
    const end = today.toISOString().split('T')[0];
    let start = end;
    if (preset === '3days') {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      start = d.toISOString().split('T')[0];
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      start = d.toISOString().split('T')[0];
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      start = d.toISOString().split('T')[0];
    }
    setDateRange({ start, end });
  };

  const [form, setForm] = useState({
    head: 'Photocopy (Income)',
    type: 'in' as 'in' | 'out',
    amount: '',
    remarks: '',
    date: today
  });

  const [allDailyData, setAllDailyData] = useState<Record<string, DailyData>>({});
  const [showSuccess, setShowSuccess] = useState(false);
  const [isPosting, setIsPosting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Detail Modal state
  const [detailModal, setDetailModal] = useState<{
    isOpen: boolean;
    title: string;
    dateStr: string;
    entries: ModalEntry[];
  }>({
    isOpen: false,
    title: '',
    dateStr: '',
    entries: []
  });

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<{
    head: string;
    remarks: string;
    amount: string;
    type: 'in' | 'out';
  }>({
    head: '',
    remarks: '',
    amount: '',
    type: 'in'
  });
  const [entryToDelete, setEntryToDelete] = useState<ModalEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Load data once when branch changes
  const loadData = useCallback(async () => {
    if (!branch) return;
    try {
      const allData = await storageService.getAllData(branch.id);
      setAllDailyData(allData || {});
    } catch (err: any) {
      console.error("Failed to load daily entries:", err);
    }
  }, [branch]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  const handleHeadChange = (head: string) => {
    let type = form.type;
    if (head === 'Photocopy (Income)') {
      type = 'in';
    } else if (head === 'Kitchen (Expense)') {
      type = 'out';
    }
    setForm({ ...form, head, type });
  };

  // Instant optimistic save
  const handleSave = async () => {
    if (!branch) return;
    if (isDayEndedForBranch(branch.id)) {
      setErrorMsg(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(form.date, settings)) {
      setErrorMsg(getBackDateBlockedMessage(form.date));
      return;
    }
    const amt = parseFloat(form.amount);
    if (isNaN(amt) || amt <= 0) return;

    setIsPosting(true);
    setErrorMsg(null);

    const targetDate = form.date;
    const newEntry: OfficeAccountEntry = {
      id: crypto.randomUUID(),
      head: form.head,
      amount: amt,
      type: form.type,
      date: targetDate,
      remarks: form.remarks,
      createdBy: user?.id || 'sys',
      branchId: branch.id,
      origin: 'income_expense'
    };

    // Optimistic state update
    const targetBsDate = toBs(targetDate);
    const targetAdDate = toAd(targetDate);

    const existingDayData = allDailyData[targetDate] || allDailyData[targetBsDate] || allDailyData[targetAdDate] || {
      date: targetBsDate,
      branchId: branch.id,
      officeTransactions: [],
      denominations: [],
      denoAdjustments: [],
      transactions: [],
      remittances: []
    };

    const updatedDayData: DailyData = {
      ...existingDayData,
      officeTransactions: [...(existingDayData.officeTransactions || []), newEntry]
    };

    setAllDailyData(prev => ({
      ...prev,
      [targetDate]: updatedDayData,
      [targetBsDate]: updatedDayData,
      [targetAdDate]: updatedDayData
    }));

    setForm({ ...form, amount: '', remarks: '' });
    setShowSuccess(true);
    setTimeout(() => setShowSuccess(false), 2000);
    setIsPosting(false);

    // Save to database in background
    try {
      await storageService.saveDayData(targetDate, branch.id, updatedDayData);
      await loadData();
    } catch (err: any) {
      console.error("Error saving day data:", err);
      setErrorMsg(err.message || "Failed to post entry to cloud.");
    }
  };

  const toBs = (adOrBs: string) => {
    try {
      const parts = adOrBs.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN) && parts[0] > 2070) {
        return adOrBs;
      }
      return new NepaliDate(new Date(adOrBs)).format('YYYY-MM-DD');
    } catch (e) {
      return adOrBs;
    }
  };

  const toAd = (bsOrAd: string) => {
    try {
      const parts = bsOrAd.split('-').map(Number);
      if (parts.length === 3 && !parts.some(isNaN) && parts[0] > 2070) {
        const np = new NepaliDate(parts[0], parts[1] - 1, parts[2]);
        const d = np.toJsDate();
        return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
      }
      return bsOrAd;
    } catch (e) {
      return bsOrAd;
    }
  };

  // Fast pre-calculated daily net totals for Income & Expense only
  const dayNetMap = useMemo(() => {
    const map: Record<string, number> = {};
    const processedBsKeys = new Set<string>();

    Object.keys(allDailyData).forEach(d => {
      const bsKey = toBs(d);
      if (processedBsKeys.has(bsKey)) return;
      processedBsKeys.add(bsKey);

      const dayData = allDailyData[d] || allDailyData[bsKey];
      const effTx = getEffectiveIncomeExpenseEntries(dayData, d);
      let net = 0;
      effTx.forEach(t => {
        const a = r2(Number(t.amount || 0));
        if (t.type === 'in') net = r2(net + a);
        else net = r2(net - a);
      });
      map[bsKey] = net;
      map[d] = net;
    });
    return map;
  }, [allDailyData]);

  // Compute opening balance for any date
  const getClosingForDate = useCallback((currentDate: string) => {
    let balance = 0;
    const currentBs = toBs(currentDate);
    const countedBsKeys = new Set<string>();

    Object.keys(dayNetMap).forEach(d => {
      const bsKey = toBs(d);
      if (bsKey < currentBs && !countedBsKeys.has(bsKey)) {
        countedBsKeys.add(bsKey);
        balance = r2(balance + (dayNetMap[d] || 0));
      }
    });
    return balance;
  }, [dayNetMap]);

  // Fast memoized row calculation (Sorted ASCENDING: Old date UP, New date DOWN)
  const groupedRows = useMemo(() => {
    const startObj = new Date(dateRange.start);
    const endObj = new Date(dateRange.end);
    if (isNaN(startObj.getTime()) || isNaN(endObj.getTime())) return [];

    let curr = new Date(startObj);
    const dateArray: string[] = [];
    while (curr <= endObj) {
      dateArray.push(curr.toISOString().split('T')[0]);
      curr.setDate(curr.getDate() + 1);
    }

    // Sort dates ASCENDING (Old date first / UP)
    dateArray.sort((a, b) => a.localeCompare(b));

    const rowsList: GroupRecord[] = [];

    dateArray.forEach(dateStr => {
      const opening = r2(getClosingForDate(dateStr));
      const dayData = allDailyData[dateStr] || allDailyData[toBs(dateStr)] || allDailyData[toAd(dateStr)];
      const offTx = getEffectiveIncomeExpenseEntries(dayData, dateStr);

      let photocopy = 0;
      let otherIn = 0;
      let kitchen = 0;
      let otherOut = 0;

      offTx.forEach(log => {
        const head = (log.head || '').toLowerCase();
        const amt = r2(Number(log.amount || 0));
        if (log.type === 'in') {
          if (head.includes('photocopy')) photocopy = r2(photocopy + amt);
          else otherIn = r2(otherIn + amt);
        } else {
          if (head.includes('kitchen')) kitchen = r2(kitchen + amt);
          else otherOut = r2(otherOut + amt);
        }
      });

      const totalIn = r2(photocopy + otherIn);
      const totalOut = r2(kitchen + otherOut);
      const netIncome = r2(totalIn - totalOut);
      const closing = r2(opening + netIncome);

      rowsList.push({
        dateAd: dateStr,
        dateBs: toBs(dateStr),
        income: { photocopy, other: otherIn, total: totalIn },
        expense: { kitchen, other: otherOut, total: totalOut },
        opening: opening,
        netIncome: netIncome,
        closing: closing
      });
    });

    return rowsList;
  }, [allDailyData, dateRange, getClosingForDate]);

  // Open Detail Modal on Amount Click
  const openDetails = (dateStr: string, columnType?: string) => {
    const dayData = allDailyData[dateStr] || allDailyData[toBs(dateStr)] || allDailyData[toAd(dateStr)];
    const offTx = getEffectiveIncomeExpenseEntries(dayData, dateStr);
    const items: ModalEntry[] = [];
    const bsDate = toBs(dateStr);
    let title = `Transaction Breakdown - ${bsDate}`;

    if (columnType === 'opening') {
      title = `Opening Balance Details - ${bsDate}`;
      const opVal = getClosingForDate(dateStr);
      items.push({
        id: 'opening-bal',
        head: 'Opening Balance',
        remarks: 'Previous Day Closing Balance Carryforward',
        type: opVal >= 0 ? 'in' : 'out',
        amount: Math.abs(opVal),
        dateStr: dateStr,
        isReadOnly: true
      });
    } else if (columnType === 'closing') {
      title = `Closing Balance Summary - ${bsDate}`;
      const opVal = getClosingForDate(dateStr);
      let dayIn = 0;
      let dayOut = 0;
      offTx.forEach(t => {
        if (t.type === 'in') dayIn += t.amount;
        else dayOut += t.amount;
      });
      const clVal = opVal + dayIn - dayOut;

      items.push({
        id: 'op-bal-summary',
        head: 'Opening Balance (सुरु मौज्दात)',
        remarks: 'Day Start Balance',
        type: opVal >= 0 ? 'in' : 'out',
        amount: Math.abs(opVal),
        dateStr: dateStr,
        isReadOnly: true
      });

      offTx.forEach(t => {
        items.push({
          id: t.id,
          head: t.head || 'Entry',
          remarks: t.remarks || '',
          type: t.type === 'in' ? 'in' : 'out',
          amount: t.amount,
          dateStr: dateStr,
          isReadOnly: false
        });
      });

      items.push({
        id: 'cl-bal-summary',
        head: 'Closing Balance (अन्तिम मौज्दात)',
        remarks: 'Opening Balance + Net Daily Movement',
        type: clVal >= 0 ? 'in' : 'out',
        amount: Math.abs(clVal),
        dateStr: dateStr,
        isReadOnly: true
      });
    } else {
      let filtered = offTx;
      if (columnType === 'photocopy') {
        title = `Photocopy Income Details - ${bsDate}`;
        filtered = offTx.filter(t => (t.head || '').toLowerCase().includes('photocopy') && t.type === 'in');
      } else if (columnType === 'income_other') {
        title = `Other Income Details - ${bsDate}`;
        filtered = offTx.filter(t => !(t.head || '').toLowerCase().includes('photocopy') && t.type === 'in');
      } else if (columnType === 'total_in') {
        title = `Total Income (Inflow) Details - ${bsDate}`;
        filtered = offTx.filter(t => t.type === 'in');
      } else if (columnType === 'kitchen') {
        title = `Kitchen Expense Details - ${bsDate}`;
        filtered = offTx.filter(t => (t.head || '').toLowerCase().includes('kitchen') && t.type === 'out');
      } else if (columnType === 'expense_other') {
        title = `Other Expense Details - ${bsDate}`;
        filtered = offTx.filter(t => !(t.head || '').toLowerCase().includes('kitchen') && t.type === 'out');
      } else if (columnType === 'total_out') {
        title = `Total Expenses (Outflow) Details - ${bsDate}`;
        filtered = offTx.filter(t => t.type === 'out');
      } else {
        title = `Net Income / All Transactions Details - ${bsDate}`;
      }

      filtered.forEach(t => {
        items.push({
          id: t.id,
          head: t.head || 'Entry',
          remarks: t.remarks || '',
          type: t.type === 'in' ? 'in' : 'out',
          amount: t.amount,
          dateStr: dateStr,
          isReadOnly: false
        });
      });
    }

    setDetailModal({
      isOpen: true,
      title,
      dateStr,
      entries: items
    });
    setEditingEntryId(null);
  };

  // Modal Action: Delete Entry
  const handleDeleteEntry = async (entry: ModalEntry) => {
    if (entry.isReadOnly || !branch) return;
    if (isDayEndedForBranch(branch.id)) {
      setErrorMsg(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(entry.dateStr, settings)) {
      setErrorMsg(getBackDateBlockedMessage(entry.dateStr));
      return;
    }

    const dateStr = entry.dateStr;
    const bsD = toBs(dateStr);
    const adD = toAd(dateStr);
    const currentDayData = allDailyData[dateStr] || allDailyData[bsD] || allDailyData[adD] || {
      date: bsD, branchId: branch.id, officeTransactions: [], denominations: [], denoAdjustments: [], transactions: [], remittances: []
    };

    const updatedTx = (currentDayData.officeTransactions || []).filter(t => {
      if (entry.id && t.id) return t.id !== entry.id;
      return !(Number(t.amount) === Number(entry.amount) && t.head === entry.head && t.type === entry.type);
    });
    const updatedDayData = { ...currentDayData, officeTransactions: updatedTx };

    // Update state instantly
    setAllDailyData(prev => ({
      ...prev,
      [dateStr]: updatedDayData,
      [bsD]: updatedDayData,
      [adD]: updatedDayData
    }));

    const updatedEntries = detailModal.entries.filter(e => e.id !== entry.id);
    if (updatedEntries.length === 0) {
      setDetailModal({ isOpen: false, title: '', entries: [], rawEntries: [] });
    } else {
      setDetailModal(prev => ({
        ...prev,
        entries: updatedEntries
      }));
    }

    try {
      if (entry.id) {
        await supabase.from('back_office_entries').delete().eq('id', entry.id);
        await supabase.from('front_teller_counter_entries').delete().eq('id', entry.id);
      }
      await storageService.saveDayData(dateStr, branch.id, updatedDayData);
      await loadData();
    } catch (err) {
      console.error("Failed to delete entry in DB:", err);
    }
  };

  // Modal Action: Start Editing Entry
  const startEditEntry = (entry: ModalEntry) => {
    if (entry.isReadOnly) return;
    if (isDayEndedForBranch(branch?.id)) {
      setErrorMsg(getDayEndedBlockMessage());
      return;
    }
    setEditingEntryId(entry.id);
    setEditingForm({
      head: entry.head,
      remarks: entry.remarks,
      amount: String(entry.amount),
      type: entry.type
    });
  };

  // Modal Action: Save Edit Entry
  const handleSaveModalEdit = async (entry: ModalEntry) => {
    if (entry.isReadOnly || !branch) return;
    if (isDayEndedForBranch(branch.id)) {
      setErrorMsg(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(entry.dateStr, settings)) {
      setErrorMsg(getBackDateBlockedMessage(entry.dateStr));
      return;
    }
    const numAmt = parseFloat(editingForm.amount);
    if (isNaN(numAmt) || numAmt <= 0) return;

    const dateStr = entry.dateStr;
    const bsD = toBs(dateStr);
    const adD = toAd(dateStr);
    const currentDayData = allDailyData[dateStr] || allDailyData[bsD] || allDailyData[adD] || {
      date: bsD, branchId: branch.id, officeTransactions: [], denominations: [], denoAdjustments: [], transactions: [], remittances: []
    };

    const updatedTx = (currentDayData.officeTransactions || []).map(t => {
      if (t.id === entry.id) {
        return {
          ...t,
          head: editingForm.head,
          remarks: editingForm.remarks,
          amount: numAmt,
          type: editingForm.type
        };
      }
      return t;
    });

    const updatedDayData = { ...currentDayData, officeTransactions: updatedTx };

    // Update state instantly
    setAllDailyData(prev => ({
      ...prev,
      [dateStr]: updatedDayData,
      [bsD]: updatedDayData,
      [adD]: updatedDayData
    }));

    setDetailModal(prev => ({
      ...prev,
      entries: prev.entries.map(e => {
        if (e.id === entry.id) {
          return {
            ...e,
            head: editingForm.head,
            remarks: editingForm.remarks,
            amount: numAmt,
            type: editingForm.type
          };
        }
        return e;
      })
    }));

    setEditingEntryId(null);

    try {
      await storageService.saveDayData(dateStr, branch.id, updatedDayData);
    } catch (err) {
      console.error("Failed to edit entry in DB:", err);
    }
  };

  return (
    <div className="space-y-4 animate-in fade-in duration-500 w-full pb-6">
      {/* Top Header & Date Filter */}
      <div className="bg-white p-4 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-4 relative z-30">
         <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-3">
               <div className="w-10 h-10 bg-slate-900 rounded-xl flex items-center justify-center text-blue-500 shadow-md">
                  <TrendingUp size={20}/>
               </div>
               <div>
                  <h1 className="text-lg font-black text-slate-900 tracking-tight uppercase leading-none">Office <span className="text-blue-600">Daily Audit</span></h1>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-wider mt-1">Income & Expense Monitoring</p>
               </div>
            </div>

            <div className="pl-4 border-l border-slate-200">
               <NepaliDatePicker value={form.date} onChange={v => setForm({...form, date: v})} label="Transaction Date" align="left" disallowBackDateIfDisabled={true} disabled={isDayEnded} />
            </div>
         </div>

         <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-1.5 rounded-xl border border-slate-200">
            {/* Quick Filter Presets */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 self-end mb-0.5">
               <button 
                 onClick={() => applyPreset('today')}
                 className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-all cursor-pointer ${
                   dateRange.start === dateRange.end && dateRange.end === today
                     ? 'bg-emerald-500 text-slate-950 shadow-xs'
                     : 'text-slate-300 hover:text-white'
                 }`}
               >
                 Today
               </button>
               <button 
                 onClick={() => applyPreset('3days')}
                 className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
               >
                 3 Days
               </button>
               <button 
                 onClick={() => applyPreset('week')}
                 className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
               >
                 Week
               </button>
               <button 
                 onClick={() => applyPreset('month')}
                 className="px-2.5 py-1 rounded-md text-[10px] font-black uppercase text-slate-300 hover:text-white hover:bg-slate-800 transition-all cursor-pointer"
               >
                 Month
               </button>
            </div>

            <NepaliDatePicker value={dateRange.start} onChange={v => setDateRange(p => ({...p, start: v}))} label="From Date" />
            <NepaliDatePicker value={dateRange.end} onChange={v => setDateRange(p => ({...p, end: v}))} label="To Date" />
            <button 
              onClick={() => window.print()} 
              className="h-10 px-3 bg-slate-900 text-white rounded-lg flex items-center justify-center space-x-2 hover:bg-blue-600 transition-all shadow-md mt-auto cursor-pointer font-bold text-xs"
              title="Print Page"
            >
               <Printer size={15}/>
               <span className="hidden sm:inline">PRINT</span>
            </button>
         </div>
      </div>

      {/* Input Form Section */}
      <DayEndFieldset branchId={branch?.id} className="bg-white p-4 sm:p-5 rounded-xl border border-slate-200 shadow-sm grid grid-cols-1 md:grid-cols-12 gap-4 items-end relative z-20">
         <div className="md:col-span-3">
            <label className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5 block">Account Head</label>
            <select 
              value={form.head} 
              onChange={e => handleHeadChange(e.target.value)}
              className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 font-bold text-xs sm:text-sm uppercase outline-none focus:border-blue-600 appearance-none shadow-xs cursor-pointer"
            >
               <option value="Photocopy (Income)">Photocopy (Income)</option>
               <option value="Kitchen (Expense)">Kitchen (Expense)</option>
               <option value="Other">Other</option>
            </select>
         </div>
         <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5 block">Voucher Type</label>
            <select 
              value={form.type} 
              onChange={e => setForm({...form, type: e.target.value as 'in' | 'out'})}
              disabled={form.head !== 'Other'}
              className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 font-bold text-xs sm:text-sm uppercase outline-none focus:border-blue-600 shadow-xs disabled:opacity-50 cursor-pointer"
            >
               <option value="in">CREDIT (+) INCOME</option>
               <option value="out">DEBIT (-) EXPENSE</option>
            </select>
         </div>
         <div className="md:col-span-2">
            <label className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5 block">Amount (रू)</label>
            <input 
              type="number" 
              placeholder="0.00" 
              value={form.amount}
              onChange={e => setForm({...form, amount: e.target.value})}
              className="w-full h-11 bg-white border border-slate-300 rounded-xl px-3 font-mono font-bold text-sm sm:text-base outline-none focus:border-blue-600 text-center shadow-inner text-blue-600"
            />
         </div>
         <div className="md:col-span-3">
            <label className="text-xs font-bold uppercase text-slate-700 tracking-wider mb-1.5 block">Narration</label>
            <input 
              type="text" 
              placeholder="Details..." 
              value={form.remarks}
              onChange={e => setForm({...form, remarks: e.target.value})}
              className="w-full h-11 bg-slate-50 border border-slate-300 rounded-xl px-3 font-medium text-xs sm:text-sm outline-none focus:border-blue-600 shadow-xs"
            />
         </div>
         <div className="md:col-span-2 flex items-end">
            <button 
              onClick={handleSave} 
              disabled={isPosting} 
              className="w-full h-11 bg-slate-900 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md active:scale-95 disabled:opacity-50 cursor-pointer font-bold text-xs uppercase tracking-wider"
            >
               {isPosting ? <Loader2 className="animate-spin" size={16}/> : <Save size={16}/>}
               <span>{isPosting ? 'SAVING...' : 'SAVE'}</span>
            </button>
         </div>
      </DayEndFieldset>

      {/* Main Table Section */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden relative">
       {showSuccess && (
         <div className="p-3 my-2 mx-4 bg-emerald-50 border border-emerald-400 text-emerald-800 rounded-xl flex items-center space-x-2 text-xs font-bold uppercase shadow-xs animate-in fade-in duration-200">
           <CheckCircle2 size={16} className="text-emerald-600" />
           <span>Transaction posted successfully!</span>
         </div>
       )}

       {errorMsg && (
         <div className="p-3 my-2 mx-4 bg-rose-50 border border-rose-400 text-rose-800 rounded-xl flex items-center space-x-2 text-xs font-bold uppercase shadow-xs animate-in fade-in duration-200">
           <AlertCircle size={16} className="text-rose-600" />
           <span>{errorMsg}</span>
         </div>
       )}

          <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm font-semibold border-collapse text-center">
               <thead>
                  <tr className="bg-slate-900 text-white uppercase tracking-wider border-b border-slate-800">
                     <th rowSpan={2} className="py-2.5 px-3 border-r border-slate-800 w-12 text-center">S.N.</th>
                     <th rowSpan={2} className="py-2.5 px-3.5 border-r border-slate-800 text-center">DATE (B.S.)</th>
                     <th rowSpan={2} className="py-2.5 px-3.5 border-r border-slate-800 bg-slate-800 text-blue-300 font-bold">OPENING BALANCE</th>
                     <th colSpan={3} className="py-1.5 px-2 border-r border-slate-800 bg-emerald-950 text-emerald-300 font-bold">INCOME (INFLOW)</th>
                     <th colSpan={3} className="py-1.5 px-2 border-r border-slate-800 bg-rose-950 text-rose-300 font-bold">EXPENSES (OUTFLOW)</th>
                     <th rowSpan={2} className="py-2.5 px-3.5 border-r border-slate-800 bg-slate-800 text-emerald-400 font-extrabold text-xs sm:text-sm">NET INCOME</th>
                     <th rowSpan={2} className="py-2.5 px-3.5 bg-[#0d2a1d] text-emerald-300 font-extrabold text-xs sm:text-sm">CLOSING BALANCE</th>
                  </tr>
                  <tr className="bg-slate-800 text-[11px] text-white uppercase tracking-wider border-b border-slate-700">
                     <th className="py-1.5 px-2 border-r border-slate-700">PHOTOCOPY</th>
                     <th className="py-1.5 px-2 border-r border-slate-700">OTHER</th>
                     <th className="py-1.5 px-2 border-r border-slate-700 bg-emerald-900/60 text-emerald-300 font-bold">TOTAL IN.</th>
                     <th className="py-1.5 px-2 border-r border-slate-700">KITCHEN</th>
                     <th className="py-1.5 px-2 border-r border-slate-700">OTHER</th>
                     <th className="py-1.5 px-2 border-r border-slate-700 bg-rose-900/60 text-rose-300 font-bold">TOTAL OUT</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-200 text-slate-800">
                  {groupedRows.length === 0 ? (
                    <tr>
                       <td colSpan={11} className="p-12 text-slate-400 uppercase tracking-widest font-bold text-center italic text-xs">
                          NO DATA AVAILABLE FOR SELECTED DATE RANGE
                       </td>
                    </tr>
                  ) : (
                    groupedRows.map((row, i) => (
                      <tr key={row.dateAd} className="hover:bg-slate-50 transition-colors">
                        <td className="py-2.5 px-3 border-r border-slate-200 text-slate-500 font-bold">{i + 1}</td>
                        <td className="py-2.5 px-3.5 border-r border-slate-200 font-mono font-bold text-slate-900">{row.dateBs}</td>
                        
                        {/* Opening Balance */}
                        <td 
                          onClick={() => openDetails(row.dateAd, 'opening')}
                          className="py-2.5 px-3.5 border-r border-slate-200 bg-blue-50/20 font-mono font-bold text-slate-800 cursor-pointer hover:bg-blue-100/60 hover:text-blue-700 transition-colors"
                          title="Click for Opening Balance details"
                        >
                          रू {format2(row.opening)}
                        </td>
                        
                        {/* Photocopy Income */}
                        <td 
                          onClick={() => openDetails(row.dateAd, 'photocopy')}
                          className="py-2.5 px-3 border-r border-slate-200 font-mono font-medium cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                          title="Click for Photocopy Income details"
                        >
                          {row.income.photocopy > 0 ? format2(row.income.photocopy) : '-'}
                        </td>

                        {/* Other Income */}
                        <td 
                          onClick={() => openDetails(row.dateAd, 'income_other')}
                          className="py-2.5 px-3 border-r border-slate-200 font-mono font-medium cursor-pointer hover:bg-emerald-50 hover:text-emerald-700 transition-colors"
                          title="Click for Other Income details"
                        >
                          {row.income.other > 0 ? format2(row.income.other) : '-'}
                        </td>

                        {/* Total In */}
                        <td 
                          onClick={() => openDetails(row.dateAd, 'total_in')}
                          className="py-2.5 px-3.5 border-r border-slate-200 bg-emerald-50/50 text-emerald-800 font-mono font-bold cursor-pointer hover:bg-emerald-100 transition-colors"
                          title="Click for Total Income details"
                        >
                          रू {format2(row.income.total)}
                        </td>
                        
                        {/* Kitchen Expense */}
                        <td 
                          onClick={() => openDetails(row.dateAd, 'kitchen')}
                          className="py-2.5 px-3 border-r border-slate-200 font-mono font-medium cursor-pointer hover:bg-rose-50 hover:text-rose-700 transition-colors"
                          title="Click for Kitchen Expense details"
                        >
                          {row.expense.kitchen > 0 ? format2(row.expense.kitchen) : '-'}
                        </td>

                        {/* Other Expense */}
                        <td 
                          onClick={() => openDetails(row.dateAd, 'expense_other')}
                          className="py-2.5 px-3 border-r border-slate-200 font-mono font-medium cursor-pointer hover:bg-rose-50 hover:text-rose-700 transition-colors"
                          title="Click for Other Expense details"
                        >
                          {row.expense.other > 0 ? format2(row.expense.other) : '-'}
                        </td>

                        {/* Total Out */}
                        <td 
                          onClick={() => openDetails(row.dateAd, 'total_out')}
                          className="py-2.5 px-3.5 border-r border-slate-200 bg-rose-50/50 text-rose-800 font-mono font-bold cursor-pointer hover:bg-rose-100 transition-colors"
                          title="Click for Total Expense details"
                        >
                          रू {format2(row.expense.total)}
                        </td>
                        
                        {/* Net Income */}
                        <td 
                          onClick={() => openDetails(row.dateAd, 'all')}
                          className={`py-2.5 px-3.5 border-r border-slate-200 font-mono font-bold cursor-pointer hover:bg-slate-100 transition-colors ${row.netIncome >= 0 ? 'text-emerald-700 bg-emerald-50/20' : 'text-rose-700 bg-rose-50/20'}`}
                          title="Click for all transaction details"
                        >
                           रू {format2(row.netIncome)}
                        </td>

                        {/* Closing Balance */}
                        <td 
                          onClick={() => openDetails(row.dateAd, 'closing')}
                          className={`py-2.5 px-3.5 bg-slate-900 font-mono font-black cursor-pointer hover:bg-slate-800 transition-colors ${row.closing >= 0 ? 'text-emerald-400' : 'text-rose-400'}`}
                          title="Click for Closing Balance details"
                        >
                           रू {format2(row.closing)}
                        </td>
                      </tr>
                    ))
                  )}
               </tbody>
               {groupedRows.length > 0 && (
                 <tfoot>
                   <tr className="bg-[#0d2a1d] text-white font-black font-mono text-xs border-t-2 border-[#153e2b]">
                     <td colSpan={2} className="py-3 px-3.5 font-sans font-black uppercase text-left">
                       PERIOD TOTALS
                     </td>
                     <td className="py-3 px-3.5 text-center text-blue-300 font-bold border-r border-emerald-900/60">
                       रू {format2(groupedRows[0].opening)}
                     </td>
                     <td className="py-3 px-2 text-center text-emerald-200 font-bold border-r border-emerald-900/60">
                       {format2(groupedRows.reduce((s, r) => s + r.income.photocopy, 0))}
                     </td>
                     <td className="py-3 px-2 text-center text-emerald-200 font-bold border-r border-emerald-900/60">
                       {format2(groupedRows.reduce((s, r) => s + r.income.other, 0))}
                     </td>
                     <td className="py-3 px-3.5 text-center text-emerald-300 font-black border-r border-emerald-900/60 bg-emerald-900/40">
                       रू {format2(groupedRows.reduce((s, r) => s + r.income.total, 0))}
                     </td>
                     <td className="py-3 px-2 text-center text-rose-200 font-bold border-r border-emerald-900/60">
                       {format2(groupedRows.reduce((s, r) => s + r.expense.kitchen, 0))}
                     </td>
                     <td className="py-3 px-2 text-center text-rose-200 font-bold border-r border-emerald-900/60">
                       {format2(groupedRows.reduce((s, r) => s + r.expense.other, 0))}
                     </td>
                     <td className="py-3 px-3.5 text-center text-rose-300 font-black border-r border-emerald-900/60 bg-rose-900/40">
                       रू {format2(groupedRows.reduce((s, r) => s + r.expense.total, 0))}
                     </td>
                     <td className="py-3 px-3.5 text-center font-black border-r border-emerald-900/60 bg-slate-950 text-emerald-400">
                       रू {format2(groupedRows.reduce((s, r) => s + r.netIncome, 0))}
                     </td>
                     <td className="py-3 px-3.5 text-center font-black bg-[#081d14] text-emerald-300">
                       रू {format2(groupedRows[groupedRows.length - 1].closing)}
                     </td>
                   </tr>
                 </tfoot>
               )}
            </table>
         </div>
      </div>

      {/* DETAIL BREAKDOWN MODAL */}
      {detailModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs flex items-center justify-center p-4 z-[7000] animate-in fade-in duration-200">
          <div className="bg-white rounded-2xl shadow-2xl border border-slate-200 w-full max-w-4xl overflow-hidden flex flex-col max-h-[88vh]">
            
            {/* Modal Header */}
            <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between border-b border-slate-800">
              <div className="flex items-center space-x-3">
                <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center text-white font-bold">
                  <Eye size={18}/>
                </div>
                <div>
                  <h3 className="text-sm sm:text-base font-black uppercase tracking-tight text-white">{detailModal.title}</h3>
                  <p className="text-[11px] text-slate-400 font-medium">Detailed transaction breakdown log</p>
                </div>
              </div>
              <button 
                onClick={() => setDetailModal(prev => ({ ...prev, isOpen: false }))}
                className="w-8 h-8 rounded-lg bg-slate-800 text-slate-300 hover:text-white hover:bg-rose-600 flex items-center justify-center transition-colors cursor-pointer"
              >
                <X size={18}/>
              </button>
            </div>

            {/* Modal Body Table */}
            <div className="p-4 overflow-y-auto flex-1">
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-xs font-black uppercase tracking-wider border-b border-slate-800">
                      <th className="py-3 px-3 text-center w-12">S.N.</th>
                      <th className="py-3 px-3.5 w-1/4">Particulars</th>
                      <th className="py-3 px-3.5 w-1/3">Narration</th>
                      <th className="py-3 px-3 text-center w-28">Voucher</th>
                      <th className="py-3 px-3.5 text-right w-32">Amount</th>
                      <th className="py-3 px-3 text-center w-28">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-semibold text-slate-800">
                    {detailModal.entries.length === 0 ? (
                      <tr>
                        <td colSpan={6} className="py-10 px-4 text-center text-slate-400 uppercase font-bold italic tracking-wider text-xs">
                          No transaction records found for this selection
                        </td>
                      </tr>
                    ) : (
                      detailModal.entries.map((ent, idx) => {
                        const isEditing = editingEntryId === ent.id;
                        return (
                          <tr key={ent.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-3 px-3 text-center font-bold text-slate-500 text-xs align-middle">
                              {idx + 1}
                            </td>
                            
                            {/* Particulars (Head) */}
                            <td className="py-3 px-3.5 align-middle">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  disabled={isDayEnded}
                                  value={editingForm.head} 
                                  onChange={e => setEditingForm({ ...editingForm, head: e.target.value })}
                                  className="w-full px-2.5 py-1 bg-white border border-blue-500 rounded text-xs font-bold uppercase disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              ) : (
                                <div className="text-slate-900 font-bold text-xs sm:text-sm uppercase">{ent.head}</div>
                              )}
                            </td>

                            {/* Narration (Remarks) */}
                            <td className="py-3 px-3.5 align-middle">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  disabled={isDayEnded}
                                  value={editingForm.remarks} 
                                  onChange={e => setEditingForm({ ...editingForm, remarks: e.target.value })}
                                  className="w-full px-2.5 py-1 bg-white border border-blue-500 rounded text-xs font-medium disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              ) : (
                                <div className="text-slate-600 text-xs sm:text-sm font-medium">{ent.remarks || <span className="text-slate-300 italic">-</span>}</div>
                              )}
                            </td>

                            {/* Voucher (Type) */}
                            <td className="py-3 px-3 text-center align-middle">
                              {isEditing ? (
                                <select 
                                  disabled={isDayEnded}
                                  value={editingForm.type} 
                                  onChange={e => setEditingForm({ ...editingForm, type: e.target.value as 'in' | 'out' })}
                                  className="px-2 py-1 bg-white border border-blue-500 rounded text-xs font-bold uppercase cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  <option value="in">CREDIT</option>
                                  <option value="out">DEBIT</option>
                                </select>
                              ) : (
                                <span className={`inline-block px-2.5 py-1 rounded text-[11px] font-black uppercase tracking-wider ${ent.type === 'in' ? 'bg-emerald-100 text-emerald-800 border border-emerald-300' : 'bg-rose-100 text-rose-800 border border-rose-300'}`}>
                                  {ent.type === 'in' ? 'CREDIT' : 'DEBIT'}
                                </span>
                              )}
                            </td>

                            {/* Amount */}
                            <td className="py-3 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap align-middle text-xs sm:text-sm">
                              {isEditing ? (
                                <input 
                                  type="number" 
                                  disabled={isDayEnded}
                                  value={editingForm.amount} 
                                  onChange={e => setEditingForm({ ...editingForm, amount: e.target.value })}
                                  className="w-28 px-2 py-1 bg-white border border-blue-500 rounded text-xs font-mono font-bold text-right disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              ) : (
                                `रू ${format2(ent.amount)}`
                              )}
                            </td>

                            {/* Action (Edit, Delete) */}
                            <td className="py-3 px-3 text-center align-middle">
                              {ent.isReadOnly ? (
                                <span className="text-[10px] text-slate-400 font-bold uppercase italic">System</span>
                              ) : isEditing ? (
                                <div className="flex items-center justify-center space-x-1">
                                  <button 
                                    disabled={isDayEnded}
                                    onClick={() => handleSaveModalEdit(ent)}
                                    className="p-1.5 bg-emerald-600 text-white rounded hover:bg-emerald-700 transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Save Changes"
                                  >
                                    <Check size={14}/>
                                  </button>
                                  <button 
                                    onClick={() => setEditingEntryId(null)}
                                    className="p-1.5 bg-slate-200 text-slate-700 rounded hover:bg-slate-300 transition-colors cursor-pointer"
                                    title="Cancel"
                                  >
                                    <X size={14}/>
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center justify-center space-x-1.5">
                                  <button 
                                    disabled={isDayEnded}
                                    onClick={() => startEditEntry(ent)}
                                    className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Edit Entry"
                                  >
                                    <Edit2 size={14}/>
                                  </button>
                                  <button 
                                    disabled={isDayEnded}
                                    onClick={() => setEntryToDelete(ent)}
                                    className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-rose-50 rounded-lg transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Delete Entry"
                                  >
                                    <Trash2 size={14}/>
                                  </button>
                                </div>
                              )}
                            </td>
                          </tr>
                        );
                      })
                    )}
                  </tbody>

                  {/* Table Footer Total */}
                  {detailModal.entries.length > 0 && (
                    <tfoot>
                      <tr className="bg-slate-900 text-white font-black text-xs sm:text-sm border-t border-slate-800">
                        <td colSpan={4} className="py-3 px-3.5 uppercase tracking-wider italic text-right">Total Amount:</td>
                        <td className="py-3 px-3.5 text-right font-mono text-emerald-400 whitespace-nowrap text-sm sm:text-base">
                          रू {format2(detailModal.entries.reduce((sum, e) => sum + (Number(e.amount) || 0), 0))}
                        </td>
                        <td></td>
                      </tr>
                    </tfoot>
                  )}
                </table>
              </div>
            </div>

            {/* Modal Footer (Print Button on Left side of Close Button) */}
            <div className="bg-slate-100 px-5 py-3.5 border-t border-slate-200 flex items-center justify-end space-x-3">
              <button 
                onClick={() => window.print()}
                className="px-4 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl flex items-center space-x-2 transition-colors font-bold text-xs cursor-pointer shadow-xs"
              >
                <Printer size={15}/>
                <span>PRINT</span>
              </button>
              
              <button 
                onClick={() => setDetailModal(prev => ({ ...prev, isOpen: false }))}
                className="px-4 py-2 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded-xl flex items-center space-x-2 transition-colors font-bold text-xs cursor-pointer shadow-xs"
              >
                <X size={15}/>
                <span>CLOSE</span>
              </button>
            </div>

          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!entryToDelete}
        title="Delete Entry"
        message={`Are you sure you want to delete '${entryToDelete?.head || 'this entry'}'${entryToDelete ? ` (रू ${Number(entryToDelete.amount || 0).toLocaleString()})` : ''}? This will remove the record and update income/expense totals.`}
        confirmLabel={isDeleting ? "Deleting..." : "Yes, Delete"}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (entryToDelete) {
            setIsDeleting(true);
            await handleDeleteEntry(entryToDelete);
            setIsDeleting(false);
            setEntryToDelete(null);
          }
        }}
        onCancel={() => setEntryToDelete(null)}
      />
    </div>
  );
};

export default IncomeExpensePage;
