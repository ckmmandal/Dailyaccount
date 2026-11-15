
import React, { useState, useEffect, useMemo } from 'react';
import { 
  Printer, X, BookOpen, Lock, Edit2, Trash2, Check
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { toBsDateString } from '../services/supabaseService';
import { supabase } from '../services/supabase';
import { NepaliDatePicker } from './NepaliDatePicker';
import { ConfirmationModal } from './ConfirmationModal';
import { useAuth } from '../AuthContext';
import { RemittanceType, User } from '../types';
import NepaliDate from 'nepali-date-converter';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';

interface LedgerRow {
  dateAd: string;
  dateBs: string;
  opening: number;
  stats: {
    bankIn: number;
    savingIn: number;
    shareIn: number;
    feeIn: number;
    branchIn: number;
    bankOut: number;
    savingOut: number;
    remitOut: number;
    otherOut: number;
    branchOut: number;
    expenseOut: number;
  };
  totalCredit: number;
  totalDebit: number;
  cashInHand: number;
}

interface TransactionEntry {
  type: 'in' | 'out';
  amount: number;
  head?: string;
  description?: string;
  remarks?: string;
  particular?: string;
}

interface VaultTransaction {
  source: string;
  type: 'in' | 'out';
  amount: number;
}

interface DetailEntry {
  id?: string;
  originalId?: string;
  head: string;
  originalHead?: string;
  remarks: string;
  originalRemarks?: string;
  type: 'in' | 'out';
  amount: number;
  originalAmount?: number;
  dateBs?: string;
  entryCategory?: 'office' | 'counter' | 'remittance';
  isReadOnly?: boolean;
  rawIndex?: number;
  createdBy?: string;
  createdByName?: string;
}

// Memory cache for instantaneous page switching
let dailyLedgerMemCache: { [branchId: string]: Record<string, DailyData> } = {};

const r2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

const format2 = (val: number | undefined | null): string => {
  const num = Number(val || 0);
  return num.toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
};

const calculateLedgerRows = (
  allData: Record<string, DailyData>,
  startBs: string,
  endBs: string
): LedgerRow[] => {
  // Extract all unique dates prior to startBs to compute opening balance synchronously
  const priorDates = Array.from(new Set(
    Object.keys(allData).map(toBsDateString).filter(d => d < startBs)
  )).sort();

  let runningBalance = 0;
  priorDates.forEach(d => {
    const dayData = allData[d] || Object.values(allData).find((v: any) => toBsDateString(v?.date) === d);
    if (!dayData) return;

    let dayCredit = 0;
    let dayDebit = 0;

    (dayData.officeTransactions || []).forEach((t: any) => {
      if (t.origin === 'income_expense' || t.origin === 'report' || t.origin === 'back_office' || t.origin === 'transferred') return;
      if (t.remarks?.includes('Office Khaja & Telecom') || t.id?.includes('khajatelecom')) return;
      if (t.head?.toUpperCase() === 'CASH' || t.head?.toUpperCase() === 'CASH IN HAND') return;
      const amt = r2(Number(t.amount) || 0);
      if (t.type === 'in') dayCredit = r2(dayCredit + amt);
      else dayDebit = r2(dayDebit + amt);
    });

    runningBalance = r2(runningBalance + dayCredit - dayDebit);
  });

  const list: LedgerRow[] = [];
  try {
    const startParts = startBs.split('-').map(Number);
    const endParts = endBs.split('-').map(Number);
    const startJs = new NepaliDate(startParts[0], startParts[1] - 1, startParts[2]).toJsDate();
    const endJs = new NepaliDate(endParts[0], endParts[1] - 1, endParts[2]).toJsDate();

    const currentDate = new Date(startJs);
    while (currentDate <= endJs) {
      const currBs = new NepaliDate(currentDate).format('YYYY-MM-DD');
      const dStrAd = currentDate.toISOString().split('T')[0];
      const day = allData[currBs] || Object.values(allData).find((v: any) => toBsDateString(v?.date) === currBs);

      const stats = {
        bankIn: 0, savingIn: 0, shareIn: 0, feeIn: 0, branchIn: 0,
        bankOut: 0, savingOut: 0, remitOut: 0, otherOut: 0, branchOut: 0, expenseOut: 0
      };

      if (day) {
        // 1. Office Transactions from Front Teller Counter
        (day.officeTransactions || []).forEach((tx: any) => {
          if (tx.origin === 'income_expense' || tx.origin === 'report' || tx.origin === 'back_office' || tx.origin === 'transferred') return;
          if (tx.remarks?.includes('Office Khaja & Telecom') || tx.id?.includes('khajatelecom')) return;
          if (tx.head?.toUpperCase() === 'CASH' || tx.head?.toUpperCase() === 'CASH IN HAND') return;
          const amt = r2(Number(tx.amount) || 0);
          const headUpper = (tx.head || '').trim().toUpperCase();
          
          if (tx.type === 'in') {
            if (headUpper === 'BANK' || headUpper === 'BANK A/C') stats.bankIn = r2(stats.bankIn + amt);
            else if (headUpper === 'SAVING') stats.savingIn = r2(stats.savingIn + amt);
            else if (headUpper === 'SHARE') stats.shareIn = r2(stats.shareIn + amt);
            else if (headUpper === 'BRANCH TRANSFER' || headUpper === 'IBT') stats.branchIn = r2(stats.branchIn + amt);
            else stats.feeIn = r2(stats.feeIn + amt);
          } else {
            if (headUpper === 'BANK' || headUpper === 'BANK A/C') stats.bankOut = r2(stats.bankOut + amt);
            else if (headUpper === 'SAVING') stats.savingOut = r2(stats.savingOut + amt);
            else if (headUpper === 'BRANCH TRANSFER' || headUpper === 'IBT') stats.branchOut = r2(stats.branchOut + amt);
            else if (headUpper === 'REMITTANCE') stats.remitOut = r2(stats.remitOut + amt);
            else {
              stats.otherOut = r2(stats.otherOut + amt);
              if (headUpper === 'EXPENSES' || headUpper === 'EXPENSE') stats.expenseOut = r2(stats.expenseOut + amt);
            }
          }
        });
      }

      const dayCreditTotal = r2(stats.bankIn + stats.savingIn + stats.shareIn + stats.feeIn + stats.branchIn);
      const dayDebitTotal = r2(stats.bankOut + stats.savingOut + stats.remitOut + stats.otherOut + stats.branchOut);
      const openingForDay = r2(runningBalance);
      const closingBalance = r2((openingForDay + dayCreditTotal) - dayDebitTotal);

      list.push({ 
        dateAd: dStrAd,
        dateBs: currBs,
        opening: openingForDay, 
        stats,
        totalCredit: dayCreditTotal,
        totalDebit: dayDebitTotal,
        cashInHand: closingBalance
      });
      
      runningBalance = closingBalance;
      currentDate.setDate(currentDate.getDate() + 1);
    }
  } catch (e) {
    console.warn("Date loop error", e);
  }

  return list;
};

const DailyLedgerPage: React.FC = () => {
  const { branch, user, settings: authSettings } = useAuth();
  const todayBs = new NepaliDate().format('YYYY-MM-DD');
  const [dateRange, setDateRange] = useState({
    start: todayBs,
    end: todayBs
  });
  
  // Instant synchronous initialization from cache
  const initialRows = useMemo(() => {
    if (!branch?.id || !dailyLedgerMemCache[branch.id]) return [];
    const startBs = toBsDateString(todayBs);
    const endBs = toBsDateString(todayBs);
    return calculateLedgerRows(dailyLedgerMemCache[branch.id], startBs, endBs);
  }, [branch?.id, todayBs]);

  const [rows, setRows] = useState<LedgerRow[]>(initialRows);
  const [loading, setLoading] = useState(false);
  const [refreshKey, setRefreshKey] = useState(0);
  const [detailModal, setDetailModal] = useState<{isOpen: boolean, title: string, entries: DetailEntry[], dateBs?: string}>({
    isOpen: false, title: '', entries: []
  });
  const [modalError, setModalError] = useState<string | null>(null);

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<{ head: string; remarks: string; amount: string; type: 'in' | 'out' }>({
    head: '', remarks: '', amount: '', type: 'in'
  });
  const [entryToDelete, setEntryToDelete] = useState<DetailEntry | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [systemUsers, setSystemUsers] = useState<User[]>([]);
  const isDayEnded = useDayEndLock(branch?.id);

  useEffect(() => {
    storageService.getUsers().then(users => {
      if (users && users.length > 0) setSystemUsers(users);
    }).catch(err => console.error("Error loading users in DailyLedgerPage:", err));
  }, []);

  const resolveUserDisplay = (entry: DetailEntry): { name: string; role: string } => {
    if (entry.createdByName && typeof entry.createdByName === 'string' && entry.createdByName.trim()) {
      return {
        name: entry.createdByName.trim(),
        role: entry.createdBy === user?.id ? (user?.roleId || 'Teller') : 'Staff'
      };
    }
    const uid = (entry.createdBy || '').toString().trim();
    if (!uid || uid === 'sys' || uid === 'system') {
      if (user?.fullName) {
        return { name: user.fullName, role: user.roleId || 'Teller' };
      }
      return { name: 'Teller Staff', role: 'Staff' };
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
    if (user && (user.id === uid || user.username.toLowerCase() === uid.toLowerCase())) {
      return { name: user.fullName || user.username, role: user.roleId || 'Teller' };
    }
    return { name: uid, role: 'Staff' };
  };

  const toBs = (ad: string) => {
    try {
      return new NepaliDate(new Date(ad)).format('YYYY-MM-DD');
    } catch (e) {
      return ad;
    }
  };

  const toAd = (dateStr: string) => {
    try {
      const parts = dateStr.split('-').map(Number);
      if (parts[0] > 2070) {
        return new NepaliDate(parts[0], parts[1] - 1, parts[2]).toJsDate().toISOString().split('T')[0];
      }
      return dateStr;
    } catch (e) {
      return dateStr;
    }
  };

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        if (!branch) {
          setRows([]);
          return;
        }

        const startBs = toBsDateString(dateRange.start);
        const endBs = toBsDateString(dateRange.end);

        // Immediate synchronous render if cache is available
        if (dailyLedgerMemCache[branch.id]) {
          const fastList = calculateLedgerRows(dailyLedgerMemCache[branch.id], startBs, endBs);
          if (isMounted) setRows(fastList);
        } else {
          setLoading(true);
        }

        const allData = await storageService.getAllData(branch.id);
        dailyLedgerMemCache[branch.id] = allData;
        
        const list = calculateLedgerRows(allData, startBs, endBs);
        if (isMounted) {
          setRows(list);
        }
      } catch (error) {
        console.error("Failed to fetch daily ledger data", error);
      } finally {
        if (isMounted) setLoading(false);
      }
    };

    fetchData();
    return () => { isMounted = false; };
  }, [dateRange, branch, todayBs, refreshKey]);

  const openDetails = async (dateBs: string, dateAd: string, head?: string, type?: 'in' | 'out' | 'all') => {
    if (!branch) return;
    const dayData = await storageService.getDayData(dateBs, branch.id);
    const bsDateStr = dateBs || toBs(dateAd);

    let items: DetailEntry[] = [];
    let title = `${head || 'Audit'} Details - ${bsDateStr}`;

    if (head === 'Opening') {
      const openingBal = await storageService.getPreviousDayClosing(bsDateStr, branch.id);
      items.push({
        id: 'opening-bal',
        head: 'Opening Balance',
        remarks: 'Previous Day Closing Balance Carryforward',
        type: openingBal >= 0 ? 'in' : 'out',
        amount: Math.abs(openingBal),
        isReadOnly: true,
        dateBs: bsDateStr
      });
      title = `Opening Balance Details - ${bsDateStr}`;
    } else if (head === 'CashInHand' || head === 'ClosingBalance') {
      const row = rows.find(r => r.dateBs === bsDateStr);
      if (row) {
        items.push({ id: 'cih-1', head: 'Opening Balance', remarks: 'Starting Day Balance', type: row.opening >= 0 ? 'in' : 'out', amount: Math.abs(row.opening), isReadOnly: true, dateBs: bsDateStr });
        items.push({ id: 'cih-2', head: 'Total Credits (+)', remarks: 'All Receipts / Credits for the Day', type: 'in', amount: row.totalCredit, isReadOnly: true, dateBs: bsDateStr });
        items.push({ id: 'cih-3', head: 'Total Debits (-)', remarks: 'All Payments / Debits for the Day', type: 'out', amount: row.totalDebit, isReadOnly: true, dateBs: bsDateStr });
        items.push({ id: 'cih-4', head: 'Closing Balance', remarks: 'Net Remaining Closing Balance', type: row.cashInHand >= 0 ? 'in' : 'out', amount: row.cashInHand, isReadOnly: true, dateBs: bsDateStr });
      }
      title = `Closing Balance Breakdown - ${bsDateStr}`;
    } else if (dayData) {
      const offTx = (dayData.officeTransactions || []).filter((t: any) => {
        if (t.origin === 'income_expense' || t.origin === 'report' || t.origin === 'back_office' || t.origin === 'transferred') return false;
        if (t.remarks?.includes('Office Khaja & Telecom') || t.id?.includes('khajatelecom')) return false;
        if (t.head?.toUpperCase() === 'CASH' || t.head?.toUpperCase() === 'CASH IN HAND') return false;
        return true;
      });
      const vaultTx: any[] = dayData.vaultTransactions || [];

      if (head === 'Bank') {
        const targetType = type || 'in';
        offTx.filter((t: any) => t.head === 'Bank' && t.type === targetType).forEach((t: any, idx: number) => {
          const entryId = t.id || `bank_${targetType}_${t.amount}_${idx}`;
          items.push({
            id: entryId,
            originalId: t.id,
            head: 'Bank',
            originalHead: t.head || 'Bank',
            remarks: t.remarks || t.particular || 'Bank Transaction',
            originalRemarks: t.remarks || t.particular || '',
            type: t.type,
            amount: t.amount,
            originalAmount: Number(t.amount),
            entryCategory: 'office',
            dateBs: bsDateStr,
            rawIndex: idx
          });
        });
        title = `Bank (${targetType === 'in' ? 'Credit' : 'Debit'}) Details - ${bsDateStr}`;
      } else if (head === 'Saving') {
        const targetType = type || 'in';
        offTx.filter((t: any) => t.head === 'Saving' && t.type === targetType).forEach((t: any, idx: number) => {
          const entryId = t.id || `saving_${targetType}_${t.amount}_${idx}`;
          items.push({
            id: entryId,
            originalId: t.id,
            head: 'Saving',
            originalHead: t.head || 'Saving',
            remarks: t.remarks || t.particular || 'Saving Transaction',
            originalRemarks: t.remarks || t.particular || '',
            type: t.type,
            amount: t.amount,
            originalAmount: Number(t.amount),
            entryCategory: 'office',
            dateBs: bsDateStr,
            rawIndex: idx
          });
        });
        title = `Saving (${targetType === 'in' ? 'Credit' : 'Debit'}) Details - ${bsDateStr}`;
      } else if (head === 'Share') {
        const targetType = type || 'in';
        offTx.filter((t: any) => t.head === 'Share' && t.type === targetType).forEach((t: any, idx: number) => {
          const entryId = t.id || `share_${targetType}_${t.amount}_${idx}`;
          items.push({
            id: entryId,
            originalId: t.id,
            head: 'Share',
            originalHead: t.head || 'Share',
            remarks: t.remarks || t.particular || 'Share Transaction',
            originalRemarks: t.remarks || t.particular || '',
            type: t.type,
            amount: t.amount,
            originalAmount: Number(t.amount),
            entryCategory: 'office',
            dateBs: bsDateStr,
            rawIndex: idx
          });
        });
        title = `Share (${targetType === 'in' ? 'Credit' : 'Debit'}) Details - ${bsDateStr}`;
      } else if (head === 'Branch Transfer' || head === 'IBT') {
        const targetType = type || 'in';
        offTx.filter((t: any) => {
          const h = (t.head || '').trim().toUpperCase();
          return (h === 'BRANCH TRANSFER' || h === 'IBT') && t.type === targetType;
        }).forEach((t: any, idx: number) => {
          const entryId = t.id || `ibt_${targetType}_${t.amount}_${idx}`;
          items.push({
            id: entryId,
            originalId: t.id,
            head: 'IBT',
            originalHead: t.head || 'IBT',
            remarks: t.remarks || t.particular || 'Inter Branch Transfer (IBT)',
            originalRemarks: t.remarks || t.particular || '',
            type: t.type,
            amount: t.amount,
            originalAmount: Number(t.amount),
            entryCategory: 'office',
            dateBs: bsDateStr,
            rawIndex: idx
          });
        });
        title = `IBT (${targetType === 'in' ? 'Credit' : 'Debit'}) Details - ${bsDateStr}`;
      } else if (head === 'Remittance') {
        offTx.filter((t: any) => t.head === 'Remittance').forEach((t: any, idx: number) => {
          const entryId = t.id || `remit_off_${t.type}_${t.amount}_${idx}`;
          items.push({
            id: entryId,
            originalId: t.id,
            head: 'Remittance',
            originalHead: t.head || 'Remittance',
            remarks: t.remarks || 'Office Remittance',
            originalRemarks: t.remarks || '',
            type: t.type,
            amount: t.amount,
            originalAmount: Number(t.amount),
            entryCategory: 'office',
            dateBs: bsDateStr,
            rawIndex: idx
          });
        });
        title = `Remittance Details - ${bsDateStr}`;
      } else if (head === 'Other') {
        const targetType = type || 'in';
        if (targetType === 'in') {
          offTx.filter((t: any) => {
            const h = (t.head || '').trim().toUpperCase();
            return h !== 'BANK' && h !== 'BANK A/C' && h !== 'SAVING' && h !== 'SHARE' && h !== 'BRANCH TRANSFER' && h !== 'IBT' && t.type === 'in';
          }).forEach((t: any, idx: number) => {
            const entryId = t.id || `other_off_in_${t.amount}_${idx}`;
            items.push({
              id: entryId,
              originalId: t.id,
              head: t.head || 'Other',
              originalHead: t.head || 'Other',
              remarks: t.remarks || 'Office Income',
              originalRemarks: t.remarks || '',
              type: 'in',
              amount: t.amount,
              originalAmount: Number(t.amount),
              entryCategory: 'office',
              dateBs: bsDateStr,
              rawIndex: idx
            });
          });
        } else {
          offTx.filter((t: any) => {
            const h = (t.head || '').trim().toUpperCase();
            return h !== 'BANK' && h !== 'BANK A/C' && h !== 'SAVING' && h !== 'REMITTANCE' && h !== 'BRANCH TRANSFER' && h !== 'IBT' && t.type === 'out';
          }).forEach((t: any, idx: number) => {
            const entryId = t.id || `other_off_out_${t.amount}_${idx}`;
            items.push({
              id: entryId,
              originalId: t.id,
              head: t.head || 'Other Expense',
              originalHead: t.head || 'Other Expense',
              remarks: t.remarks || 'Office Expense',
              originalRemarks: t.remarks || '',
              type: 'out',
              amount: t.amount,
              originalAmount: Number(t.amount),
              entryCategory: 'office',
              dateBs: bsDateStr,
              rawIndex: idx
            });
          });
        }
        title = `Other (${targetType === 'in' ? 'Credit' : 'Debit'}) Details - ${bsDateStr}`;
      } else if (head === 'all') {
        const targetType = type || 'in';
        if (targetType === 'in') {
          offTx.filter((t: any) => t.type === 'in').forEach((t: any, idx: number) => {
            const entryId = t.id || `all_off_in_${t.amount}_${idx}`;
            items.push({
              id: entryId,
              originalId: t.id,
              head: t.head || 'Office Credit',
              originalHead: t.head || '',
              remarks: t.remarks || '',
              originalRemarks: t.remarks || '',
              type: 'in',
              amount: t.amount,
              originalAmount: Number(t.amount),
              entryCategory: 'office',
              dateBs: bsDateStr,
              rawIndex: idx
            });
          });
          title = `Total Credit Details - ${bsDateStr}`;
        } else {
          offTx.filter((t: any) => t.type === 'out').forEach((t: any, idx: number) => {
            const entryId = t.id || `all_off_out_${t.amount}_${idx}`;
            items.push({
              id: entryId,
              originalId: t.id,
              head: t.head || 'Office Debit',
              originalHead: t.head || '',
              remarks: t.remarks || '',
              originalRemarks: t.remarks || '',
              type: 'out',
              amount: t.amount,
              originalAmount: Number(t.amount),
              entryCategory: 'office',
              dateBs: bsDateStr,
              rawIndex: idx
            });
          });
          title = `Total Debit Details - ${bsDateStr}`;
        }
      }
    }

    const enrichedItems = items.map(item => {
      if (item.createdBy || item.createdByName) return item;
      if (item.originalId && dayData) {
        const match = (dayData.officeTransactions || []).find((t: any) => t.id === item.originalId) ||
                      (dayData.remittances || []).find((t: any) => t.id === item.originalId) ||
                      (dayData.vaultTransactions || []).find((t: any) => t.id === item.originalId) ||
                      (dayData.denoAdjustments || []).find((t: any) => t.id === item.originalId);
        if (match) {
          return {
            ...item,
            createdBy: match.createdBy,
            createdByName: match.createdByName
          };
        }
      }
      return item;
    });

    setDetailModal({ isOpen: true, title, entries: enrichedItems, dateBs: bsDateStr });
    setEditingEntryId(null);
    setModalError(null);
  };

  const handleDeleteModalEntry = async (entry: DetailEntry) => {
    if (!branch || entry.isReadOnly) return;

    try {
      if (isDayEndedForBranch(branch.id)) {
        setModalError(getDayEndedBlockMessage());
        return;
      }
      const entryDate = entry.dateBs || detailModal.dateBs;
      if (!entryDate) return;
      if (isBackDateBlockedForEntry(entryDate, authSettings)) {
        setModalError(getBackDateBlockedMessage(entryDate));
        return;
      }
      setModalError(null);

      const dayData = await storageService.getDayData(entryDate, branch.id);
      if (dayData) {
        if (entry.entryCategory === 'remittance') {
          const remits = [...(dayData.remittances || [])];
          let foundIndex = -1;
          if (entry.originalId || entry.id) {
            foundIndex = remits.findIndex(r => r.id && r.id === (entry.originalId || entry.id));
          }
          if (foundIndex === -1) {
            const targetAmt = Number(entry.originalAmount ?? entry.amount);
            foundIndex = remits.findIndex(r => Number(r.amount) === targetAmt);
          }
          if (foundIndex !== -1) {
            remits.splice(foundIndex, 1);
          }
          await storageService.saveDayData(entryDate, branch.id, { ...dayData, remittances: remits });
        } else if (entry.entryCategory === 'counter') {
          const counters = [...(dayData.transactions || [])];
          let foundIndex = -1;
          if (entry.originalId || entry.id) {
            foundIndex = counters.findIndex(t => t.id && t.id === (entry.originalId || entry.id));
          }
          if (foundIndex === -1) {
            const targetAmt = Number(entry.originalAmount ?? entry.amount);
            const targetType = entry.type;
            foundIndex = counters.findIndex(t => Number(t.amount) === targetAmt && t.type === targetType);
          }
          if (foundIndex !== -1) {
            counters.splice(foundIndex, 1);
          }
          await storageService.saveDayData(entryDate, branch.id, { ...dayData, transactions: counters });
        } else {
          const offices = [...(dayData.officeTransactions || [])];
          let foundIndex = -1;
          if (entry.originalId || entry.id) {
            foundIndex = offices.findIndex(t => t.id && t.id === (entry.originalId || entry.id));
          }
          if (foundIndex === -1) {
            const targetAmt = Number(entry.originalAmount ?? entry.amount);
            const targetType = entry.type;
            const targetHead = entry.originalHead || entry.head;
            foundIndex = offices.findIndex(t => Number(t.amount) === targetAmt && t.type === targetType && (t.head === targetHead || !targetHead));
          }
          if (foundIndex === -1) {
            const targetAmt = Number(entry.originalAmount ?? entry.amount);
            const targetType = entry.type;
            foundIndex = offices.findIndex(t => Number(t.amount) === targetAmt && t.type === targetType);
          }
          if (foundIndex !== -1) {
            offices.splice(foundIndex, 1);
          }
          await storageService.saveDayData(entryDate, branch.id, { ...dayData, officeTransactions: offices });
        }
      }

      const deleteId = entry.originalId || entry.id;
      if (deleteId) {
        try {
          await supabase.from('back_office_entries').delete().eq('id', deleteId);
          await supabase.from('front_teller_counter_entries').delete().eq('id', deleteId);
          await supabase.from('front_teller_ledger_entries').delete().eq('id', deleteId);
          await supabase.from('front_teller_remittance_entries').delete().eq('id', deleteId);
        } catch (errSup) {
          console.warn("Direct Supabase deletion notice:", errSup);
        }
      }

      const updatedEntries = detailModal.entries.filter(e => e.id !== entry.id);
      if (updatedEntries.length === 0) {
        setDetailModal({ isOpen: false, title: '', entries: [] });
      } else {
        setDetailModal(prev => ({ ...prev, entries: updatedEntries }));
      }
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error("Failed to delete entry", e);
    }
  };

  const startEditModalEntry = (entry: DetailEntry) => {
    if (entry.isReadOnly) return;
    if (isDayEndedForBranch(branch?.id)) {
      setModalError(getDayEndedBlockMessage());
      return;
    }
    const entryDate = entry.dateBs || detailModal.dateBs;
    if (entryDate && isBackDateBlockedForEntry(entryDate, authSettings)) {
      setModalError(getBackDateBlockedMessage(entryDate));
      return;
    }
    setModalError(null);
    setEditingEntryId(entry.id || null);
    setEditingForm({
      head: entry.head || '',
      remarks: entry.remarks || '',
      amount: String(entry.amount || ''),
      type: entry.type === 'in' ? 'in' : 'out'
    });
  };

  const handleSaveModalEdit = async (entry: DetailEntry) => {
    if (!branch || entry.isReadOnly) return;
    if (isDayEndedForBranch(branch.id)) {
      setModalError(getDayEndedBlockMessage());
      return;
    }
    const entryDate = entry.dateBs || detailModal.dateBs;
    if (!entryDate) return;
    if (isBackDateBlockedForEntry(entryDate, authSettings)) {
      setModalError(getBackDateBlockedMessage(entryDate));
      return;
    }
    setModalError(null);
    const numAmt = parseFloat(editingForm.amount);
    if (isNaN(numAmt) || numAmt <= 0) return;

    try {

      const dayData = await storageService.getDayData(entryDate, branch.id);
      if (dayData) {
        if (entry.entryCategory === 'remittance') {
          const updatedRemit = (dayData.remittances || []).map((r: any) => {
            const matches = (entry.originalId && r.id === entry.originalId) || (entry.id && r.id === entry.id) || (Number(r.amount) === Number(entry.originalAmount ?? entry.amount));
            if (matches) {
              return {
                ...r,
                companyName: editingForm.head,
                referenceNo: editingForm.remarks,
                amount: numAmt,
                type: editingForm.type === 'in' ? RemittanceType.PAY : RemittanceType.SEND
              };
            }
            return r;
          });
          await storageService.saveDayData(entryDate, branch.id, { ...dayData, remittances: updatedRemit });
        } else if (entry.entryCategory === 'counter') {
          const updatedCounter = (dayData.transactions || []).map((t: any) => {
            const matches = (entry.originalId && t.id === entry.originalId) || (entry.id && t.id === entry.id) || (Number(t.amount) === Number(entry.originalAmount ?? entry.amount) && t.type === entry.type);
            if (matches) {
              return {
                ...t,
                head: editingForm.head,
                particular: editingForm.remarks,
                description: editingForm.head,
                amount: numAmt,
                type: editingForm.type
              };
            }
            return t;
          });
          await storageService.saveDayData(entryDate, branch.id, { ...dayData, transactions: updatedCounter });
        } else {
          const updatedOffice = (dayData.officeTransactions || []).map((t: any) => {
            const matches = (entry.originalId && t.id === entry.originalId) || (entry.id && t.id === entry.id) || (Number(t.amount) === Number(entry.originalAmount ?? entry.amount) && t.type === entry.type);
            if (matches) {
              return {
                ...t,
                head: editingForm.head,
                remarks: editingForm.remarks,
                particular: editingForm.remarks,
                amount: numAmt,
                type: editingForm.type
              };
            }
            return t;
          });
          await storageService.saveDayData(entryDate, branch.id, { ...dayData, officeTransactions: updatedOffice });
        }
      }

      const updatedEntries = detailModal.entries.map(e => {
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
      });

      setDetailModal(prev => ({ ...prev, entries: updatedEntries }));
      setEditingEntryId(null);
      setRefreshKey(k => k + 1);
    } catch (e) {
      console.error("Failed to edit entry", e);
    }
  };

  const applyPreset = (preset: 'today' | '3days' | 'week' | 'month') => {
    const today = new Date();
    const todayBs = new NepaliDate(today).format('YYYY-MM-DD');
    let startBs = todayBs;
    if (preset === '3days') {
      const d = new Date();
      d.setDate(d.getDate() - 2);
      startBs = new NepaliDate(d).format('YYYY-MM-DD');
    } else if (preset === 'week') {
      const d = new Date();
      d.setDate(d.getDate() - 6);
      startBs = new NepaliDate(d).format('YYYY-MM-DD');
    } else if (preset === 'month') {
      const d = new Date();
      d.setDate(d.getDate() - 29);
      startBs = new NepaliDate(d).format('YYYY-MM-DD');
    }
    setDateRange({ start: startBs, end: todayBs });
  };

  const handlePrintModal = () => {
    if (!detailModal.entries || detailModal.entries.length === 0) return;
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const contentHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${detailModal.title}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 25px; color: #0f172a; margin: 0; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
            .header h2 { margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #0f172a; }
            .header h3 { margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #059669; text-transform: uppercase; }
            .header p { margin: 4px 0 0 0; font-size: 11px; color: #64748b; text-transform: uppercase; font-weight: 600; letter-spacing: 0.05em; }
            table { width: 100%; border-collapse: collapse; margin-top: 15px; font-size: 12px; }
            th, td { border: 1px solid #cbd5e1; padding: 7px 10px; text-align: left; }
            th { background-color: #0f172a; color: #ffffff; text-transform: uppercase; font-size: 11px; letter-spacing: 0.05em; }
            .type-in { color: #047857; font-weight: 800; text-align: center; }
            .type-out { color: #be123c; font-weight: 800; text-align: center; }
            .amount { text-align: right; font-family: monospace; font-weight: 800; }
            .total-row { font-weight: 800; background-color: #f1f5f9; }
            .footer { margin-top: 60px; display: flex; justify-content: space-between; font-size: 11px; font-weight: bold; }
          </style>
        </head>
        <body>
          <div class="header">
            <h2>RATAULI SACCOS - ${branch?.name || 'Head Office'}</h2>
            <h3>${detailModal.title}</h3>
            <p>Operational Audit Log Breakdown</p>
          </div>
          <table>
            <thead>
              <tr>
                <th style="width: 20%;">Particulars</th>
                <th style="width: 32%;">Narration</th>
                <th style="width: 18%; text-align: left;">Entered By</th>
                <th style="width: 12%; text-align: center;">Type</th>
                <th style="width: 18%; text-align: right;">Amount (रू)</th>
              </tr>
            </thead>
            <tbody>
              ${detailModal.entries.map(ent => {
                const u = resolveUserDisplay(ent);
                return `
                <tr>
                  <td style="font-weight: 800; text-transform: uppercase; font-style: italic;">${ent.head}</td>
                  <td style="color: #334155;">${ent.remarks || '-'}</td>
                  <td style="font-size: 10px; font-weight: 700; color: #0f172a;">${u.name}</td>
                  <td class="${ent.type === 'in' ? 'type-in' : 'type-out'}">${ent.type === 'in' ? 'CREDIT' : 'DEBIT'}</td>
                  <td class="amount">रू ${format2(ent.amount)}</td>
                </tr>
              `;}).join('')}
            </tbody>
            <tfoot>
              <tr class="total-row">
                <td colspan="4" style="text-align: right; text-transform: uppercase;">Total Amount:</td>
                <td class="amount" style="color: #047857; font-size: 13px;">रू ${format2(detailModal.entries.reduce((sum, e) => sum + e.amount, 0))}</td>
              </tr>
            </tfoot>
          </table>
          <div class="footer">
            <div>Prepared By: ___________________</div>
            <div>Verified By: ___________________</div>
            <div>Approved By: ___________________</div>
          </div>
          <script>
            window.onload = function() { window.print(); window.close(); };
          </script>
        </body>
      </html>
    `;

    printWindow.document.write(contentHtml);
    printWindow.document.close();
  };

  return (
    <div className="space-y-3 animate-in slide-in-from-bottom-2 duration-500 w-full pb-4">
      <div className="bg-white px-4 py-3 rounded-xl border border-slate-200 shadow-sm relative z-20">
         <div className="flex flex-col lg:flex-row justify-between items-center gap-3">
            <div className="flex items-center space-x-3">
               <div className="w-10 h-10 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-md">
                  <BookOpen size={20}/>
               </div>
               <div>
                  <h1 className="text-lg font-black text-slate-900 tracking-tighter uppercase italic leading-none">Teller <span className="text-emerald-600">Ledger</span></h1>
                  <p className="text-xs font-bold text-slate-500 uppercase tracking-widest mt-1 italic flex items-center">
                    <Lock size={10} className="mr-1"/> Live Operational Audit • Branch Consolidated
                  </p>
               </div>
            </div>

            <div className="flex flex-wrap items-center gap-2 bg-slate-50 p-2 rounded-xl z-10 border border-slate-200">
               {/* Quick Presets */}
               <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800 self-end mb-0.5">
                  <button 
                    onClick={() => applyPreset('today')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-all cursor-pointer ${
                      dateRange.start === dateRange.end && dateRange.end === todayBs
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

               <div className="relative">
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-1 ml-1">Audit From</span>
                  <NepaliDatePicker value={dateRange.start} onChange={v => setDateRange(p => ({...p, start: v}))} />
               </div>
               <div className="relative">
                  <span className="text-[10px] font-black uppercase text-slate-500 block mb-1 ml-1">Audit To</span>
                  <NepaliDatePicker value={dateRange.end} onChange={v => setDateRange(p => ({...p, end: v}))} />
               </div>
               <button onClick={() => window.print()} className="h-9 w-9 bg-slate-900 text-white rounded-lg flex items-center justify-center hover:bg-emerald-600 transition-all shadow-md mt-auto mb-0.5 cursor-pointer" title="Print Ledger">
                  <Printer size={16}/>
               </button>
            </div>
         </div>
      </div>

      <div className="bg-white rounded-xl border-2 border-slate-950 shadow-md overflow-hidden relative">
         <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm font-black border-collapse text-center italic">
               <thead>
                  <tr className="bg-slate-950 text-white uppercase tracking-wider border-b-2 border-slate-950 text-xs sm:text-sm">
                     <th rowSpan={2} className="py-2.5 px-2 border-r border-white/10 w-10 text-slate-400 italic">S.N.</th>
                     <th rowSpan={2} className="py-2.5 px-2.5 text-left border-r border-white/10 min-w-[105px]">Date (B.S.)</th>
                     <th colSpan={6} className="py-1.5 px-2 border-r border-white/10">Credits (+)</th>
                     <th rowSpan={2} className="py-2.5 px-2 border-r border-white/10 bg-emerald-950 text-emerald-400 font-black italic">Total Credit</th>
                     <th colSpan={5} className="py-1.5 px-2 border-r border-white/10">Debits (-)</th>
                     <th rowSpan={2} className="py-2.5 px-2 border-r border-white/10 bg-rose-950 text-rose-500 font-black italic">Total Debit</th>
                     <th rowSpan={2} className="py-2.5 px-2 bg-slate-950 text-emerald-400 font-black italic">Closing Balance</th>
                  </tr>
                  <tr className="bg-slate-900 text-[10px] sm:text-xs text-white uppercase tracking-wider border-b border-white/10">
                     <th className="py-1 px-1.5 border-r border-white/10 bg-amber-950 text-amber-300 font-black">Opening</th>
                     <th className="py-1 px-1.5 border-r border-white/10">Bank</th>
                     <th className="py-1 px-1.5 border-r border-white/10">Savings</th>
                     <th className="py-1 px-1.5 border-r border-white/10">Share</th>
                     <th className="py-1 px-1.5 border-r border-white/10">Other</th>
                     <th className="py-1 px-1.5 border-r border-white/10 text-emerald-400 bg-emerald-900/40">IBT</th>
                     
                     <th className="py-1 px-1.5 border-r border-white/10">Bank</th>
                     <th className="py-1 px-1.5 border-r border-white/10">Savings</th>
                     <th className="py-1 px-1.5 border-r border-white/10">Remit</th>
                     <th className="py-1 px-1.5 border-r border-white/10">Other</th>
                     <th className="py-1 px-1.5 border-r border-white/10 text-rose-400 bg-rose-900/40">IBT</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 italic text-xs sm:text-sm font-black text-slate-900">
                  {rows.length === 0 ? (
                    <tr>
                       <td colSpan={16} className="p-16 text-slate-300 uppercase tracking-[0.5em] font-black italic text-sm">No operational history found</td>
                    </tr>
                  ) : (
                    rows.map((row, idx) => (
                      <tr key={row.dateAd || `row-${idx}`} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-2.5 px-2 text-slate-400 border-r border-slate-200 font-bold">{idx + 1}</td>
                        <td className="py-2.5 px-2.5 text-left font-mono font-bold border-r border-slate-200 group-hover:text-emerald-600 whitespace-nowrap">{row.dateBs}</td>
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'Opening', 'in')} className="py-2.5 px-2 bg-amber-50 text-amber-950 border-r border-slate-200 font-black italic cursor-pointer hover:bg-amber-100 whitespace-nowrap shadow-inner">रू {format2(row.opening)}</td>
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'Bank', 'in')} className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-emerald-50 whitespace-nowrap">{format2(row.stats.bankIn)}</td>
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'Saving', 'in')} className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-emerald-50 whitespace-nowrap">{format2(row.stats.savingIn)}</td>
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'Share', 'in')} className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-emerald-50 whitespace-nowrap">{format2(row.stats.shareIn)}</td>
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'Other', 'in')} className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-emerald-50 whitespace-nowrap">{format2(row.stats.feeIn)}</td>
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'IBT', 'in')} className="py-2.5 px-2 border-r border-slate-100 text-emerald-600 bg-emerald-50/20 cursor-pointer hover:bg-emerald-100 whitespace-nowrap">{format2(row.stats.branchIn)}</td>
                        
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'all', 'in')} className="py-2.5 px-2 border-r border-slate-100 bg-emerald-950 text-emerald-400 font-black italic cursor-pointer whitespace-nowrap">रू {format2(row.totalCredit)}</td>
                        
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'Bank', 'out')} className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-rose-50 whitespace-nowrap">{format2(row.stats.bankOut)}</td>
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'Saving', 'out')} className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-rose-50 whitespace-nowrap">{format2(row.stats.savingOut)}</td>
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'Remittance', 'out')} className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-rose-50 whitespace-nowrap">{format2(row.stats.remitOut)}</td>
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'Other', 'out')} className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-rose-50 whitespace-nowrap">{format2(row.stats.otherOut)}</td>
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'IBT', 'out')} className="py-2.5 px-2 border-r border-slate-100 text-rose-600 bg-rose-50/20 cursor-pointer hover:bg-rose-100 whitespace-nowrap">{format2(row.stats.branchOut)}</td>
                        
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'all', 'out')} className="py-2.5 px-2 border-r border-slate-100 bg-rose-950 text-rose-400 font-black italic cursor-pointer whitespace-nowrap">रू {format2(row.totalDebit)}</td>
                        <td onClick={() => openDetails(row.dateBs, row.dateAd, 'CashInHand', 'all')} className="py-2.5 px-2 bg-slate-950 text-emerald-400 font-black italic cursor-pointer hover:bg-slate-900 whitespace-nowrap">रू {format2(row.cashInHand)}</td>
                      </tr>
                    ))
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {detailModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[7000] flex items-start justify-center pt-6 sm:pt-10 p-3 sm:p-4 overflow-y-auto animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-3xl rounded-2xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-150 my-auto sm:my-0 border border-slate-200">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <div>
                <h2 className="text-sm sm:text-base font-black tracking-tight italic uppercase text-emerald-400">{detailModal.title}</h2>
                <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">Transaction Breakdown Log</p>
              </div>
              <div className="flex items-center space-x-2">
                <button 
                  onClick={handlePrintModal} 
                  className="p-1.5 bg-slate-800 rounded-lg hover:bg-emerald-600 text-slate-300 hover:text-white transition-all flex items-center space-x-1.5 text-xs font-bold"
                  title="Print Breakdown Details"
                >
                  <Printer size={15}/>
                  <span className="text-xs">Print</span>
                </button>
                <button 
                  onClick={() => { setDetailModal(p => ({...p, isOpen: false})); setModalError(null); }} 
                  className="p-1.5 bg-slate-800 rounded-lg hover:bg-rose-600 text-slate-300 hover:text-white transition-all"
                  title="Close"
                >
                  <X size={16}/>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-3.5 max-h-[65vh] overflow-y-auto">
              {modalError && (
                <div className="mb-3 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold">
                  <span>{modalError}</span>
                  <button type="button" onClick={() => setModalError(null)} className="text-rose-500 hover:text-rose-700">
                    <X size={13} />
                  </button>
                </div>
              )}
              <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                <table className="w-full text-left border-collapse">
                  <thead>
                    <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                      <th className="py-2.5 px-3 text-center w-12">S.N.</th>
                      <th className="py-2.5 px-3.5 w-1/4">Particulars</th>
                      <th className="py-2.5 px-3.5 w-1/4">Narration</th>
                      <th className="py-2.5 px-3 text-left w-36">Entered By</th>
                      <th className="py-2.5 px-3 text-center w-24">Type</th>
                      <th className="py-2.5 px-3.5 text-right w-32">Amount</th>
                      <th className="py-2.5 px-3 text-center w-24">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-semibold text-slate-800">
                    {detailModal.entries.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-8 px-4 text-center text-slate-400 uppercase font-bold italic tracking-wider text-xs">
                          No transactions found for this category
                        </td>
                      </tr>
                    ) : (
                      detailModal.entries.map((ent, idx) => {
                        const isEditing = editingEntryId === ent.id;
                        const userMeta = resolveUserDisplay(ent);
                        return (
                          <tr key={ent.id || idx} className="hover:bg-slate-50 transition-colors">
                            <td className="py-2.5 px-3 text-center font-bold text-slate-500 text-xs align-middle">
                              {idx + 1}
                            </td>
                            <td className="py-2.5 px-3.5 align-middle">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  disabled={isDayEnded}
                                  value={editingForm.head} 
                                  onChange={e => setEditingForm({ ...editingForm, head: e.target.value })}
                                  className="w-full px-2 py-1 bg-white border border-blue-500 rounded text-xs font-bold uppercase disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              ) : (
                                <div className="text-slate-900 font-bold text-xs sm:text-sm italic uppercase">{ent.head}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 align-middle">
                              {isEditing ? (
                                <input 
                                  type="text" 
                                  disabled={isDayEnded}
                                  value={editingForm.remarks} 
                                  onChange={e => setEditingForm({ ...editingForm, remarks: e.target.value })}
                                  className="w-full px-2 py-1 bg-white border border-blue-500 rounded text-xs font-medium disabled:bg-slate-100 disabled:text-slate-400"
                                />
                              ) : (
                                <div className="text-slate-600 text-xs sm:text-sm font-medium">{ent.remarks || <span className="text-slate-300 italic">-</span>}</div>
                              )}
                            </td>
                            <td className="py-2.5 px-3 align-middle text-left">
                              <div className="text-slate-900 font-bold text-xs truncate uppercase">{userMeta.name}</div>
                            </td>
                            <td className="py-2.5 px-3 text-center align-middle">
                              {isEditing ? (
                                <select 
                                  disabled={isDayEnded}
                                  value={editingForm.type} 
                                  onChange={e => setEditingForm({ ...editingForm, type: e.target.value as 'in' | 'out' })}
                                  className="px-1.5 py-1 bg-white border border-blue-500 rounded text-xs font-bold uppercase cursor-pointer disabled:bg-slate-100 disabled:text-slate-400"
                                >
                                  <option value="in">CREDIT</option>
                                  <option value="out">DEBIT</option>
                                </select>
                              ) : (
                                <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${ent.type === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                  {ent.type === 'in' ? 'CREDIT' : 'DEBIT'}
                                </span>
                              )}
                            </td>
                            <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap align-middle">
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
                            <td className="py-2.5 px-3 text-center align-middle">
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
                                    onClick={() => startEditModalEntry(ent)}
                                    className="p-1.5 text-slate-500 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                    title="Edit Entry"
                                  >
                                    <Edit2 size={14}/>
                                  </button>
                                  <button 
                                    disabled={isDayEnded}
                                    onClick={() => {
                                      if (isDayEndedForBranch(branch?.id)) {
                                        setModalError(getDayEndedBlockMessage());
                                        return;
                                      }
                                      const entryDate = ent.dateBs || detailModal.dateBs;
                                      if (entryDate && isBackDateBlockedForEntry(entryDate, authSettings)) {
                                        setModalError(getBackDateBlockedMessage(entryDate));
                                        return;
                                      }
                                      setModalError(null);
                                      setEntryToDelete(ent);
                                    }}
                                    className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
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
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={!!entryToDelete}
        title="Delete Entry"
        message={`Are you sure you want to delete '${entryToDelete?.head || 'this entry'}'${entryToDelete ? ` (रू ${format2(entryToDelete.amount)})` : ''}? This action will permanently remove the record and recalculate the daily ledger balances.`}
        confirmLabel={isDeleting ? "Deleting..." : "Yes, Delete"}
        cancelLabel="Cancel"
        variant="danger"
        onConfirm={async () => {
          if (entryToDelete) {
            setIsDeleting(true);
            await handleDeleteModalEntry(entryToDelete);
            setIsDeleting(false);
            setEntryToDelete(null);
          }
        }}
        onCancel={() => setEntryToDelete(null)}
      />
    </div>
  );
};

export default DailyLedgerPage;
