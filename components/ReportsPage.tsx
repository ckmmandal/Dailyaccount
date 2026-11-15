
import React, { useState, useMemo, useEffect } from 'react';
import { 
  History, Plus, Save, Edit2, Trash2, X, Eye, 
  ArrowUpRight, ArrowDownRight, Calculator, CheckCircle2, AlertCircle,
  ArrowRightLeft, Receipt, Building2, Banknote, Landmark, Smartphone,
  Search, Printer, Check, Loader2, ArrowLeft, ChevronRight,
  Lock, ArrowRight, ShieldAlert
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { supabase } from '../services/supabase';
import { supabaseService, invalidateMemoryCache, toBsDateString } from '../services/supabaseService';
import { NepaliDatePicker } from './NepaliDatePicker';
import { ConfirmationModal } from './ConfirmationModal';
import { useAuth } from '../AuthContext';
import { OfficeAccountEntry, RemittanceEntry, RemittanceType, VaultTransaction, DailyData, Branch, User } from '../types';
import NepaliDate from 'nepali-date-converter';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

const getTodayBs = () => {
  try {
    return new NepaliDate().format('YYYY-MM-DD');
  } catch (e) {
    return new Date().toISOString().split('T')[0];
  }
};

const isRemitSend = (type?: string) => {
  if (!type) return false;
  const t = String(type).trim().toUpperCase();
  return t === 'SEND' || t === 'IN';
};

const isBackOfficeOfficeEntry = (tx: any, isConsolidated: boolean = false): boolean => {
  if (!tx) return false;
  if (isConsolidated) {
    if (tx.origin === 'report' || tx.origin === 'back_office') return true;
    if (tx.transferredToBackOffice === true || tx.transferredToConsolidated === true || tx.origin === 'transferred') return true;
    const head = (tx.head || '').trim().toLowerCase();
    const memberLedgerHeads = ['saving', 'share', 'loan', 'interest', 'entry fee'];
    if (memberLedgerHeads.some(th => head === th || head.startsWith(th))) return false;
    return true;
  }
  if (tx.transferredToBackOffice === true || tx.transferredToConsolidated === true || tx.origin === 'transferred') return true;
  if (tx.origin === 'report' || tx.origin === 'back_office') return true;
  if (
    tx.origin === 'income_expense' || 
    tx.origin === 'transaction' || 
    tx.origin === 'teller_counter' ||
    tx.origin === 'counter' ||
    tx.origin === 'teller'
  ) return false;
  
  // Untagged entries check: exclude teller member ledger heads
  const head = (tx.head || '').trim().toLowerCase();
  const tellerHeads = ['saving', 'share', 'loan', 'interest', 'entry fee'];
  if (tellerHeads.some(th => head === th || head.startsWith(th))) return false;
  if (head.includes('photocopy') || head.includes('kitchen')) return false;
  
  return true;
};

const get3DaysRange = () => {
  const today = new Date();
  const todayBs = new NepaliDate(today).format('YYYY-MM-DD');
  const d = new Date();
  d.setDate(d.getDate() - 2);
  const startBs = new NepaliDate(d).format('YYYY-MM-DD');
  return { start: startBs, end: todayBs };
};

const ReportsPage: React.FC = () => {
  const { branch, user, isSuperAdmin, hasPermission, settings: authSettings } = useAuth();
  const isDayEnded = useDayEndLock(branch?.id);
  const [dateRange, setDateRange] = useState(get3DaysRange);
  const [activePreset, setActivePreset] = useState<'today' | '3days' | 'week' | 'month' | 'all' | 'custom'>('3days');

  const [allDataMap, setAllDataMap] = useState<Record<string, DailyData>>({});
  const [logs, setLogs] = useState<OfficeAccountEntry[]>([]);
  const [remitLogs, setRemitLogs] = useState<RemittanceEntry[]>([]);
  const [vaultLogs, setVaultLogs] = useState<VaultTransaction[]>([]);
  const [isPosting, setIsPosting] = useState(false);
  const [entryErrorMsg, setEntryErrorMsg] = useState<string | null>(null);
  const [modalErrorMsg, setModalErrorMsg] = useState<string | null>(null);
  const [subMode, setSubMode] = useState<'log' | 'consolidated'>('log');
  const [systemUsers, setSystemUsers] = useState<User[]>([]);

  useEffect(() => {
    storageService.getUsers().then(users => {
      if (users && users.length > 0) setSystemUsers(users);
    }).catch(err => console.error("Error loading users in ReportsPage:", err));
  }, []);

  const resolveUserDisplay = (entry: any): { name: string; role: string } => {
    if (entry.createdByName && typeof entry.createdByName === 'string' && entry.createdByName.trim()) {
      return {
        name: entry.createdByName.trim(),
        role: entry.createdByRole || (entry.createdBy === user?.id ? (user?.roleId || 'Back Office') : 'Staff')
      };
    }
    const uid = (entry.createdBy || '').toString().trim();
    if (!uid || uid === 'sys' || uid === 'system') {
      if (user?.fullName) {
        return { name: user.fullName, role: user.roleId || 'Back Office' };
      }
      return { name: 'Back Office User', role: 'Staff' };
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
      return { name: user.fullName || user.username, role: user.roleId || 'Back Office' };
    }
    return { name: uid, role: 'Staff' };
  };

  const applyPreset = (preset: 'today' | '3days' | 'week' | 'month' | 'all') => {
    setActivePreset(preset);
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
    } else if (preset === 'all') {
      startBs = '2080-01-01';
    }
    setDateRange({ start: startBs, end: todayBs });
  };

  const handleToggleSubMode = (mode: 'log' | 'consolidated') => {
    setSubMode(mode);
    applyPreset('3days');
  };

  const [detailModal, setDetailModal] = useState<{ 
    isOpen: boolean; 
    date: string; 
    entries: any[];
    title: string;
    type: 'audit' | 'remittance' | 'qr';
    column: string;
    group: any;
  }>({
    isOpen: false,
    date: '',
    entries: [],
    title: '',
    type: 'audit',
    column: '',
    group: null
  });

  const [modalDrillStep, setModalDrillStep] = useState<1 | 2>(1);
  const [selectedBranchId, setSelectedBranchId] = useState<string | null>(null);

  const [quickEntry, setQuickEntry] = useState({
    id: '',
    head: 'CASH',
    type: 'in' as 'in' | 'out',
    remitType: RemittanceType.RECEIVE,
    company: '',
    refNo: '',
    narration: '',
    amount: '',
    date: getTodayBs(),
    isRemittance: false
  });

  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingForm, setEditingForm] = useState<{ head: string; remarks: string; amount: string; type: 'in' | 'out' }>({
    head: '', remarks: '', amount: '', type: 'in'
  });
  const [deleteConfirmEntry, setDeleteConfirmEntry] = useState<any | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);

  // Remittance Drilldown States
  const [branches, setBranches] = useState<Branch[]>([]);
  const [remitDrillStep, setRemitDrillStep] = useState<1 | 2 | 3>(1);
  const [selectedRemitBranchId, setSelectedRemitBranchId] = useState<string | null>(null);
  const [selectedRemitCompany, setSelectedRemitCompany] = useState<string | null>(null);
  const [rawRemitList, setRawRemitList] = useState<any[]>([]);

  useEffect(() => {
    storageService.getBranches().then(bList => setBranches(bList || [])).catch(() => {});
  }, []);

  const getBranchName = (bId?: string) => {
    if (!bId) return 'Ratauli Head Office';
    const clean = bId.trim();
    const lower = clean.toLowerCase();
    
    // Check in loaded branches array
    const b = branches.find(br => 
      br.id.toLowerCase() === lower || 
      (br.code && br.code.toLowerCase() === lower) || 
      br.name.toLowerCase() === lower ||
      br.name.toLowerCase().includes(lower)
    );
    if (b) return b.name;

    if (lower === 'main' || lower === 'c01' || lower === 'head_office' || lower === 'consolidated') {
      const mainB = branches.find(br => br.id.toLowerCase() === 'main' || br.code?.toLowerCase() === 'c01');
      return mainB ? mainB.name : 'Ratauli Head Office';
    }
    if (lower === 'sahodba' || lower === 'c02') return 'Sahodba Branch';
    if (lower === 'pipra' || lower === 'c03') return 'Pipra Branch';
    if (lower === 'parsa' || lower === 'c04') return 'Parsa Branch';
    
    return clean.charAt(0).toUpperCase() + clean.slice(1);
  };

  const normalizeBranchId = (bId?: string) => {
    if (!bId) return 'main';
    const lower = bId.toLowerCase().trim();
    if (lower === 'c01' || lower === 'head_office' || lower === 'consolidated' || lower === 'main') return 'main';
    if (lower === 'c02' || lower === 'sahodba') return 'sahodba';
    if (lower === 'c03' || lower === 'pipra') return 'pipra';
    if (lower === 'c04' || lower === 'parsa') return 'parsa';
    return lower;
  };

  const getBranchCode = (bId?: string) => {
    const norm = normalizeBranchId(bId);
    if (norm === 'main') return 'C01';
    if (norm === 'sahodba') return 'C02';
    if (norm === 'pipra') return 'C03';
    if (norm === 'parsa') return 'C04';
    const b = branches.find(br => normalizeBranchId(br.id) === norm);
    return b?.code || norm.toUpperCase();
  };

  const isHeadOfficeUser = useMemo(() => {
    if (isSuperAdmin) return true;
    if (user?.role === 'Admin') return true;
    const bId = (branch?.id || '').toLowerCase();
    const bCode = (branch?.code || '').toLowerCase();
    const uBranchId = (user?.branchId || '').toLowerCase();
    if (bId === 'main' || bId === 'c01' || bId === 'headoffice' || bId === 'head_office' || bId === '') return true;
    if (bCode === 'c01') return true;
    if (uBranchId === 'main' || uBranchId === 'c01' || uBranchId === 'headoffice' || uBranchId === 'head_office' || uBranchId === '') return true;
    if (hasPermission && (hasPermission('view_consolidated_report') || hasPermission('cross_branch_operation'))) return true;
    return false;
  }, [isSuperAdmin, user, branch, hasPermission]);

  const userBranchNorm = useMemo(() => {
    return normalizeBranchId(branch?.id || user?.branchId || 'main');
  }, [branch, user]);

  const getColumnLabel = (col: string) => {
    switch (col) {
      case 'opening': return 'Opening Balance';
      case 'recv_cash': return 'Cash In';
      case 'recv_bank': return 'Bank In';
      case 'recv_branch': return 'Branch In';
      case 'recv_other': return 'Other In';
      case 'total_received': return 'Total Received';
      case 'pay_cash': return 'Cash Out';
      case 'pay_bank': return 'Bank Out';
      case 'pay_branch': return 'Branch Out';
      case 'pay_qr': return 'QR Paid';
      case 'pay_remit':
      case 'remit': return 'Remittance';
      case 'pay_other': return 'Other Expense';
      case 'total_payment': return 'Total Payment';
      case 'balance': return 'Closing Balance';
      case 'all': return 'All Transactions';
      default: return (col || 'DETAILS').toUpperCase();
    }
  };

  // Branch Summaries for Consolidated Step 1
  const branchSummaries = useMemo(() => {
    const map: Record<string, { branchId: string; branchName: string; branchCode: string; count: number; sendAmt: number; payAmt: number; totalAmt: number }> = {};
    rawRemitList.forEach(r => {
      const rawBId = r.branchId || (r.raw && r.raw.branchId) || 'main';
      const bId = normalizeBranchId(rawBId);
      const bName = getBranchName(bId);
      const bCode = getBranchCode(bId);
      if (!map[bId]) {
        map[bId] = { branchId: bId, branchName: bName, branchCode: bCode, count: 0, sendAmt: 0, payAmt: 0, totalAmt: 0 };
      }
      map[bId].count += 1;
      const isSend = r.type === RemittanceType.SEND || r.type === 'SEND' || r.type === 'in';
      const amt = Number(r.amount || 0);
      if (isSend) map[bId].sendAmt += amt;
      else map[bId].payAmt += amt;
      map[bId].totalAmt += amt;
    });

    const list = Object.values(map);
    list.sort((a, b) => {
      if (a.branchId === 'main') return -1;
      if (b.branchId === 'main') return 1;
      return a.branchName.localeCompare(b.branchName);
    });

    if (isHeadOfficeUser) {
      return list;
    }
    // Branch user can only see their own branch
    return list.filter(b => b.branchId === userBranchNorm);
  }, [rawRemitList, branches, isHeadOfficeUser, userBranchNorm]);

  // Company Summaries for Selected Branch (or Single Branch)
  const currentCompanySummaries = useMemo(() => {
    const isConsolidated = subMode === 'consolidated';
    const list = isConsolidated && selectedRemitBranchId
      ? rawRemitList.filter(r => {
          const rawBId = r.branchId || (r.raw && r.raw.branchId) || 'main';
          return normalizeBranchId(rawBId) === normalizeBranchId(selectedRemitBranchId);
        })
      : rawRemitList;

    const map: Record<string, { companyName: string; count: number; sendAmt: number; payAmt: number; totalAmt: number }> = {};
    list.forEach(r => {
      const co = r.companyName || r.company || r.head || 'OTHER';
      if (!map[co]) {
        map[co] = { companyName: co, count: 0, sendAmt: 0, payAmt: 0, totalAmt: 0 };
      }
      map[co].count += 1;
      const isSend = r.type === RemittanceType.SEND || r.type === 'SEND' || r.type === 'in';
      const amt = Number(r.amount || 0);
      if (isSend) map[co].sendAmt += amt;
      else map[co].payAmt += amt;
      map[co].totalAmt += amt;
    });
    return Object.values(map);
  }, [rawRemitList, subMode, selectedRemitBranchId]);

  // Individual Transactions for Selected Company
  const currentCompanyTransactions = useMemo(() => {
    const isConsolidated = subMode === 'consolidated';
    return rawRemitList.filter(r => {
      const rawBId = r.branchId || (r.raw && r.raw.branchId) || 'main';
      const matchBranch = isConsolidated && selectedRemitBranchId
        ? normalizeBranchId(rawBId) === normalizeBranchId(selectedRemitBranchId)
        : true;
      const matchCompany = (r.companyName || r.company || r.head || 'OTHER') === selectedRemitCompany;
      return matchBranch && matchCompany;
    });
  }, [rawRemitList, subMode, selectedRemitBranchId, selectedRemitCompany]);

  const toBs = (adOrBs: string) => {
    return toBsDateString(adOrBs);
  };

  useEffect(() => {
    if (quickEntry.head === 'QR PAID') {
      setQuickEntry(prev => ({ ...prev, type: 'out', isRemittance: false }));
    } else if (quickEntry.head === 'REMITTANCE') {
      setQuickEntry(prev => ({ ...prev, isRemittance: true }));
    } else {
      setQuickEntry(prev => ({ ...prev, isRemittance: false }));
    }
  }, [quickEntry.head]);

  const loadData = async () => {
    try {
      if (subMode === 'consolidated') {
        invalidateMemoryCache('daily_data');
      }
      const allData = subMode === 'consolidated' 
        ? await storageService.getAllData('all') 
        : (branch ? await storageService.getAllData(branch.id) : {});
        
      setAllDataMap(allData || {});
      let oList: OfficeAccountEntry[] = [];
      let rList: RemittanceEntry[] = [];
      let vList: VaultTransaction[] = [];
      
      if (allData && typeof allData === 'object') {
        const start = dateRange.start;
        const end = dateRange.end;

        Object.entries(allData).forEach(([key, dayObj]) => {
          if (!dayObj || typeof dayObj !== 'object') return;
          const bsDate = toBs(dayObj.date || key);
          const inRange = (!start || bsDate >= start) && (!end || bsDate <= end);
          if (inRange) {
            const dayBranch = normalizeBranchId(dayObj.branchId || (key.includes('_') ? key.split('_').slice(1).join('_') : (branch?.id || 'main')));
            const filteredOffice = (dayObj.officeTransactions || [])
              .filter((o: any) => isBackOfficeOfficeEntry(o, subMode === 'consolidated'))
              .map((o: any) => ({
                ...o,
                branchId: normalizeBranchId(o.branchId || dayBranch),
                date: o.date || bsDate
              }));
            oList = [...oList, ...filteredOffice];
            const filteredRemit = (dayObj.remittances || [])
              .filter((r: any) => {
                if (subMode === 'consolidated') {
                  return true;
                }
                return r.origin === 'report' || r.origin === 'transferred' || r.transferredToBackOffice === true || r.origin === 'teller' || !r.origin;
              })
              .map((r: any) => ({
                ...r,
                branchId: normalizeBranchId(r.branchId || dayBranch),
                date: r.date || bsDate
              }));
            rList = [...rList, ...filteredRemit];
            vList = [...vList, ...(dayObj.vaultTransactions || [])];
          }
        });
      }
      setLogs(oList);
      setRemitLogs(rList);
      setVaultLogs(vList);
    } catch (e) {
      console.error("Failed to load report data", e);
    }
  };

  useEffect(() => { loadData(); }, [dateRange, branch, subMode]);

  const computeOpening = (dateStr: string, filterBranchId?: string) => {
    let balance = 0;
    if (!allDataMap || typeof allDataMap !== 'object') return 0;
    const normalizedTargetBs = toBs(dateStr);
    const targetNormBId = filterBranchId ? normalizeBranchId(filterBranchId) : null;
    
    // Group all records by BS date
    Object.entries(allDataMap).forEach(([key, dayData]) => {
      if (!dayData || typeof dayData !== 'object') return;
      const bsDate = toBs(dayData.date || key);
      if (bsDate >= normalizedTargetBs) return;

      const dayBId = normalizeBranchId(dayData.branchId || (key.includes('_') ? key.split('_').slice(1).join('_') : 'main'));
      if (targetNormBId && dayBId !== targetNormBId) return;

      (dayData.officeTransactions || []).forEach((t: any) => {
        if (isBackOfficeOfficeEntry(t, subMode === 'consolidated')) {
          const itemBId = normalizeBranchId(t.branchId || dayBId);
          if (targetNormBId && itemBId !== targetNormBId) return;
          if (t.type === 'in') balance += Number(t.amount) || 0;
          else balance -= Number(t.amount) || 0;
        }
      });
      (dayData.remittances || []).forEach((t: any) => {
        const isEligible = subMode === 'consolidated'
          ? true
          : (t.origin === 'report' || t.origin === 'transferred' || t.transferredToBackOffice === true || t.origin === 'teller' || !t.origin);
        if (isEligible) {
          const itemBId = normalizeBranchId(t.branchId || dayBId);
          if (targetNormBId && itemBId !== targetNormBId) return;
          if (isRemitSend(t.type)) balance += Number(t.amount) || 0;
          else balance -= Number(t.amount) || 0;
        }
      });
    });
    return balance;
  };

  const groupedLogs = useMemo(() => {
    const groups: Record<string, any> = {};

    const getOrCreateGroup = (dStr: string) => {
      const bsDate = toBs(dStr);
      if (!groups[bsDate]) {
        groups[bsDate] = {
          date: bsDate,
          // Received (IN / +)
          recvCash: 0,
          recvBank: 0,
          recvBranch: 0,
          recvOther: 0,
          totalReceived: 0,
          // Payment (OUT / -)
          payCash: 0,
          payBank: 0,
          payBranch: 0,
          payQr: 0,
          payRemit: 0,
          payOther: 0,
          totalPayment: 0,
          // Balance
          openingBalance: 0,
          closingBalance: 0,
          entries: [],
          remittances: []
        };
      }
      return groups[bsDate];
    };

    logs.forEach(log => {
      if (!log.date) return;
      const group = getOrCreateGroup(log.date);
      group.entries.push(log);
      const headUpper = (log.head || '').trim().toUpperCase();
      const amt = Number(log.amount) || 0;
      
      if (log.type === 'in') {
        if (headUpper === 'CASH' || headUpper === 'CASH IN HAND') {
          group.recvCash += amt;
        } else if (headUpper === 'BANK') {
          group.recvBank += amt;
        } else if (headUpper === 'BRANCH' || headUpper === 'BRANCH TRANSFER') {
          group.recvBranch += amt;
        } else {
          group.recvOther += amt;
        }
        group.totalReceived += amt;
      } else {
        if (headUpper === 'CASH' || headUpper === 'CASH IN HAND') {
          group.payCash += amt;
        } else if (headUpper === 'BANK') {
          group.payBank += amt;
        } else if (headUpper === 'BRANCH' || headUpper === 'BRANCH TRANSFER') {
          group.payBranch += amt;
        } else if (headUpper === 'QR PAID' || headUpper === 'QR') {
          group.payQr += amt;
        } else if (headUpper === 'REMITTANCE') {
          group.payRemit += amt;
        } else {
          group.payOther += amt;
        }
        group.totalPayment += amt;
      }
    });

    remitLogs.forEach(remit => {
      if (!remit.date) return;
      const group = getOrCreateGroup(remit.date);
      group.remittances.push(remit);
      const amt = Number(remit.amount) || 0;
      if (isRemitSend(remit.type)) {
        group.recvOther += amt;
        group.totalReceived += amt;
      } else {
        group.payRemit += amt;
        group.totalPayment += amt;
      }
    });

    if (Object.keys(groups).length === 0) {
      const defaultDate = toBs(quickEntry.date || dateRange.start || getTodayBs());
      getOrCreateGroup(defaultDate);
    }

    return Object.values(groups)
      .map((g: any) => {
        const opening = computeOpening(g.date);
        return {
          ...g,
          openingBalance: opening,
          closingBalance: opening + g.totalReceived - g.totalPayment
        };
      })
      .sort((a, b) => a.date.localeCompare(b.date)); // Oldest first at top, newest at bottom
  }, [logs, remitLogs, vaultLogs, dateRange, allDataMap, quickEntry.date, subMode]);

  const handlePost = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (!branch) return;
    const entryDate = quickEntry.date;
    if (isDayEndedForBranch(branch.id)) {
      setEntryErrorMsg(getDayEndedBlockMessage());
      return;
    }
    if (isBackDateBlockedForEntry(entryDate, authSettings)) {
      setEntryErrorMsg(getBackDateBlockedMessage(entryDate));
      return;
    }
    setEntryErrorMsg(null);
    const amt = parseFloat(quickEntry.amount);
    if (isNaN(amt) || amt <= 0) return;

    const isRemit = quickEntry.isRemittance;
    const entryHead = quickEntry.head;
    const entryType = quickEntry.type;
    const entryNarration = quickEntry.narration;
    const entryCompany = quickEntry.company || quickEntry.head;
    const entryRefNo = quickEntry.refNo || quickEntry.narration;
    const entryRemitType = quickEntry.remitType;

    // 1. Instant optimistic state update
    if (isRemit) {
      const newRemit: RemittanceEntry = {
        id: crypto.randomUUID(),
        companyName: entryCompany,
        amount: amt,
        type: entryRemitType,
        referenceNo: entryRefNo,
        date: entryDate,
        createdBy: user?.id || user?.username || 'sys',
        createdByName: user?.fullName || user?.username || 'Back Office',
        branchId: branch.id,
        origin: 'report',
        transferredToBackOffice: true
      };
      setRemitLogs(prev => [newRemit, ...prev]);
    } else {
      const newOffice: OfficeAccountEntry = {
        id: crypto.randomUUID(),
        head: entryHead,
        type: entryType,
        remarks: entryNarration,
        amount: amt,
        date: entryDate,
        createdBy: user?.id || user?.username || 'sys',
        createdByName: user?.fullName || user?.username || 'Back Office',
        branchId: branch.id,
        origin: 'report'
      };
      setLogs(prev => [newOffice, ...prev]);
    }

    if (entryDate < dateRange.start || entryDate > dateRange.end) {
      setDateRange({ start: entryDate, end: entryDate });
    }

    setQuickEntry(prev => ({
      ...prev,
      id: '',
      narration: '',
      amount: '',
      company: '',
      refNo: ''
    }));

    // 2. Non-blocking async persistence in background
    (async () => {
      try {
        const dayData = (await storageService.getDayData(entryDate, branch.id)) || {
          date: entryDate, branchId: branch.id, denominations: [], denoAdjustments: [], transactions: [], remittances: [], officeTransactions: []
        };

        if (isRemit) {
          const updatedRemit = [...(dayData.remittances || [])];
          updatedRemit.push({
            id: crypto.randomUUID(),
            companyName: entryCompany,
            amount: amt,
            type: entryRemitType,
            referenceNo: entryRefNo,
            date: entryDate,
            createdBy: user?.id || user?.username || 'sys',
            createdByName: user?.fullName || user?.username || 'Back Office',
            branchId: branch.id,
            origin: 'report',
            transferredToBackOffice: true
          });
          await storageService.saveDayData(entryDate, branch.id, { ...dayData, remittances: updatedRemit });
        } else {
          const updatedTx = [...(dayData.officeTransactions || [])];
          updatedTx.push({
            id: crypto.randomUUID(),
            head: entryHead,
            type: entryType,
            remarks: entryNarration,
            amount: amt,
            date: entryDate,
            createdBy: user?.id || user?.username || 'sys',
            createdByName: user?.fullName || user?.username || 'Back Office',
            branchId: branch.id,
            origin: 'report'
          });
          await storageService.saveDayData(entryDate, branch.id, { ...dayData, officeTransactions: updatedTx });
        }
        await loadData();
      } catch (e) {
        console.error("Failed to post entry in background", e);
      }
    })();
  };

  const getFilteredEntriesForColumn = (group: any, column: string, filterBranchId?: string | null) => {
    if (!group) return [];
    const normFilter = filterBranchId ? normalizeBranchId(filterBranchId) : null;
    let filtered: any[] = [];

    const isMatchBranch = (itemBranchId?: string) => {
      if (!normFilter) return true;
      return normalizeBranchId(itemBranchId) === normFilter;
    };

    if (column === 'opening') {
      const openBal = computeOpening(group.date, normFilter || undefined);
      filtered = [{
        id: `open-${normFilter || 'all'}-${group.date}`,
        head: 'Opening Balance',
        remarks: normFilter ? `${getBranchName(normFilter)} - Previous Closing Balance Carryforward` : 'Consolidated Previous Balance',
        type: openBal >= 0 ? 'in' : 'out',
        amount: Math.abs(openBal),
        isReadOnly: true,
        date: group.date,
        branchId: normFilter || 'main'
      }];
    } else if (column === 'recv_cash') {
      filtered = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId) && e.type === 'in' && ['CASH', 'CASH IN HAND'].includes((e.head || '').trim().toUpperCase()))
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'CASH',
          remarks: e.remarks || e.particular || 'Cash Received',
          type: 'in',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
    } else if (column === 'recv_bank') {
      filtered = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId) && e.type === 'in' && (e.head || '').trim().toUpperCase() === 'BANK')
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'BANK',
          remarks: e.remarks || e.particular || 'Bank Received',
          type: 'in',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
    } else if (column === 'recv_branch') {
      filtered = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId) && e.type === 'in' && ['BRANCH', 'BRANCH TRANSFER'].includes((e.head || '').trim().toUpperCase()))
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'BRANCH',
          remarks: e.remarks || e.particular || 'Branch Received',
          type: 'in',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
    } else if (column === 'recv_other') {
      const officeList = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId) && e.type === 'in' && !['CASH', 'CASH IN HAND', 'BANK', 'BRANCH', 'BRANCH TRANSFER', 'QR PAID', 'QR'].includes((e.head || '').trim().toUpperCase()))
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'OTHER INCOME',
          remarks: e.remarks || e.particular || 'Other Received',
          type: 'in',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
      const remitList = (group.remittances || [])
        .filter((r: any) => isMatchBranch(r.branchId || r.raw?.branchId) && isRemitSend(r.type))
        .map((r: any) => ({
          id: r.id,
          head: `Remittance Send (${r.companyName || r.company || 'Remit'})`,
          remarks: r.referenceNo || 'Remittance Received',
          type: 'in',
          amount: r.amount,
          entryCategory: 'remittance',
          date: r.date || group.date,
          branchId: r.branchId || r.raw?.branchId || group.branchId,
          raw: r
        }));
      filtered = [...officeList, ...remitList];
    } else if (column === 'total_received') {
      const officeList = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId) && e.type === 'in')
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'RECEIVED ENTRY',
          remarks: e.remarks || e.particular || 'Office Inflow',
          type: 'in',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
      const remitList = (group.remittances || [])
        .filter((r: any) => isMatchBranch(r.branchId || r.raw?.branchId) && isRemitSend(r.type))
        .map((r: any) => ({
          id: r.id,
          head: `Remittance (${r.companyName || r.company || 'Remit'})`,
          remarks: r.referenceNo || 'Remittance Send',
          type: 'in',
          amount: r.amount,
          entryCategory: 'remittance',
          date: r.date || group.date,
          branchId: r.branchId || r.raw?.branchId || group.branchId,
          raw: r
        }));
      filtered = [...officeList, ...remitList];
    } else if (column === 'pay_cash') {
      filtered = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId) && e.type === 'out' && ['CASH', 'CASH IN HAND'].includes((e.head || '').trim().toUpperCase()))
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'CASH',
          remarks: e.remarks || e.particular || 'Cash Payment',
          type: 'out',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
    } else if (column === 'pay_bank') {
      filtered = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId) && e.type === 'out' && (e.head || '').trim().toUpperCase() === 'BANK')
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'BANK',
          remarks: e.remarks || e.particular || 'Bank Payment',
          type: 'out',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
    } else if (column === 'pay_branch') {
      filtered = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId) && e.type === 'out' && ['BRANCH', 'BRANCH TRANSFER'].includes((e.head || '').trim().toUpperCase()))
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'BRANCH',
          remarks: e.remarks || e.particular || 'Branch Payment',
          type: 'out',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
    } else if (column === 'pay_qr') {
      filtered = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId) && ['QR PAID', 'QR'].includes((e.head || '').trim().toUpperCase()))
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'QR PAID',
          remarks: e.remarks || e.particular || 'QR Payment',
          type: 'out',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
    } else if (column === 'pay_remit' || column === 'remit') {
      filtered = (group.remittances || [])
        .filter((r: any) => isMatchBranch(r.branchId || r.raw?.branchId) && !isRemitSend(r.type))
        .map((r: any) => ({
          id: r.id,
          head: `Remittance (${r.companyName || r.company || 'Remit'})`,
          remarks: r.referenceNo || 'Remittance Transaction',
          type: 'out',
          amount: r.amount,
          entryCategory: 'remittance',
          date: r.date || group.date,
          branchId: r.branchId || r.raw?.branchId || group.branchId,
          raw: r
        }));
    } else if (column === 'pay_other') {
      filtered = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId) && e.type === 'out' && !['CASH', 'CASH IN HAND', 'BANK', 'BRANCH', 'BRANCH TRANSFER', 'QR PAID', 'QR', 'REMITTANCE'].includes((e.head || '').trim().toUpperCase()))
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'OTHER EXPENSE',
          remarks: e.remarks || e.particular || 'Other Expense',
          type: 'out',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
    } else if (column === 'total_payment') {
      const officeList = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId) && e.type === 'out')
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'EXPENSE ENTRY',
          remarks: e.remarks || e.particular || 'Office Outflow',
          type: 'out',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
      const remitList = (group.remittances || [])
        .filter((r: any) => isMatchBranch(r.branchId || r.raw?.branchId) && !isRemitSend(r.type))
        .map((r: any) => ({
          id: r.id,
          head: `Remittance (${r.companyName || r.company || 'Remit'})`,
          remarks: r.referenceNo || 'Remittance Payment',
          type: 'out',
          amount: r.amount,
          entryCategory: 'remittance',
          date: r.date || group.date,
          branchId: r.branchId || r.raw?.branchId || group.branchId,
          raw: r
        }));
      filtered = [...officeList, ...remitList];
    } else if (column === 'balance') {
      const openBal = computeOpening(group.date, normFilter || undefined);
      const openingRow = {
        id: `open-${normFilter || 'all'}-${group.date}`,
        head: 'OPENING BALANCE',
        remarks: normFilter ? `${getBranchName(normFilter)} - Previous Closing Balance Carryforward` : 'Consolidated Previous Balance',
        type: openBal >= 0 ? 'in' : 'out',
        amount: Math.abs(openBal),
        isReadOnly: true,
        date: group.date,
        branchId: normFilter || 'main'
      };

      const officeList = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId))
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'OFFICE ENTRY',
          remarks: e.remarks || e.particular || 'Office Transaction',
          type: e.type || 'in',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));

      const remitList = (group.remittances || [])
        .filter((r: any) => isMatchBranch(r.branchId || r.raw?.branchId))
        .map((r: any) => ({
          id: r.id,
          head: `Remittance (${r.companyName || r.company || 'Remit'})`,
          remarks: r.referenceNo || 'Remittance Transaction',
          type: isRemitSend(r.type) ? 'in' : 'out',
          amount: r.amount,
          entryCategory: 'remittance',
          date: r.date || group.date,
          branchId: r.branchId || r.raw?.branchId || group.branchId,
          raw: r
        }));

      const txList = [...officeList, ...remitList];
      const totIn = txList.filter(t => t.type === 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const totOut = txList.filter(t => t.type === 'out').reduce((s, t) => s + (Number(t.amount) || 0), 0);
      const closingBal = openBal + totIn - totOut;

      const closingRow = {
        id: `close-${normFilter || 'all'}-${group.date}`,
        head: 'CLOSING BALANCE',
        remarks: normFilter ? `${getBranchName(normFilter)} - Day End Balance` : 'Consolidated Day End Balance',
        type: closingBal >= 0 ? 'in' : 'out',
        amount: Math.abs(closingBal),
        isReadOnly: true,
        date: group.date,
        branchId: normFilter || 'main'
      };

      filtered = [openingRow, ...txList, closingRow];
    } else {
      const officeList = (group.entries || [])
        .filter((e: any) => isMatchBranch(e.branchId || e.raw?.branchId))
        .map((e: any) => ({
          id: e.id,
          head: e.head || 'OFFICE ENTRY',
          remarks: e.remarks || e.particular || 'Office Transaction',
          type: e.type || 'in',
          amount: e.amount,
          entryCategory: 'office',
          date: e.date || group.date,
          branchId: e.branchId || e.raw?.branchId || group.branchId,
          raw: e
        }));
      const remitList = (group.remittances || [])
        .filter((r: any) => isMatchBranch(r.branchId || r.raw?.branchId))
        .map((r: any) => ({
          id: r.id,
          head: `Remittance (${r.companyName || r.company || 'Remit'})`,
          remarks: r.referenceNo || 'Remittance Transaction',
          type: isRemitSend(r.type) ? 'in' : 'out',
          amount: r.amount,
          entryCategory: 'remittance',
          date: r.date || group.date,
          branchId: r.branchId || r.raw?.branchId || group.branchId,
          raw: r
        }));
      filtered = [...officeList, ...remitList];
    }

    return filtered;
  };

  const getBranchBreakdownForColumn = (group: any, column: string) => {
    if (!group) return [];

    const branchMap: Record<string, {
      branchId: string;
      branchName: string;
      branchCode: string;
      count: number;
      amount: number;
      openingBal?: number;
      totalIn?: number;
      totalOut?: number;
      closingBal?: number;
    }> = {};

    const seedBranchList = branches.length > 0 ? branches : [
      { id: 'main', code: 'C01', name: 'Ratauli Head Office' },
      { id: 'sahodba', code: 'C02', name: 'Sahodba Branch' },
      { id: 'pipra', code: 'C03', name: 'Pipra Branch' },
      { id: 'parsa', code: 'C04', name: 'Parsa Branch' }
    ];

    seedBranchList.forEach(b => {
      const normId = normalizeBranchId(b.id);
      if (!branchMap[normId]) {
        branchMap[normId] = {
          branchId: normId,
          branchName: b.name || getBranchName(normId),
          branchCode: b.code || getBranchCode(normId),
          count: 0,
          amount: 0,
          openingBal: 0,
          totalIn: 0,
          totalOut: 0,
          closingBal: 0
        };
      }
    });

    (group.entries || []).forEach((e: any) => {
      const rawBId = e.branchId || e.raw?.branchId || 'main';
      const normId = normalizeBranchId(rawBId);
      if (!branchMap[normId]) {
        branchMap[normId] = {
          branchId: normId,
          branchName: getBranchName(normId),
          branchCode: getBranchCode(normId),
          count: 0,
          amount: 0,
          openingBal: 0,
          totalIn: 0,
          totalOut: 0,
          closingBal: 0
        };
      }
    });

    (group.remittances || []).forEach((r: any) => {
      const rawBId = r.branchId || r.raw?.branchId || 'main';
      const normId = normalizeBranchId(rawBId);
      if (!branchMap[normId]) {
        branchMap[normId] = {
          branchId: normId,
          branchName: getBranchName(normId),
          branchCode: getBranchCode(normId),
          count: 0,
          amount: 0,
          openingBal: 0,
          totalIn: 0,
          totalOut: 0,
          closingBal: 0
        };
      }
    });

    Object.keys(branchMap).forEach(bId => {
      const branchEntries = getFilteredEntriesForColumn(group, column, bId);
      if (column === 'opening') {
        const open = computeOpening(group.date, bId);
        branchMap[bId].amount = open;
        branchMap[bId].count = 1;
      } else if (column === 'balance') {
        const open = computeOpening(group.date, bId);
        const bTx = branchEntries.filter(t => !t.isReadOnly);
        const tin = bTx.filter(t => t.type === 'in').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const tout = bTx.filter(t => t.type === 'out').reduce((s, t) => s + (Number(t.amount) || 0), 0);
        const close = open + tin - tout;
        branchMap[bId].openingBal = open;
        branchMap[bId].totalIn = tin;
        branchMap[bId].totalOut = tout;
        branchMap[bId].closingBal = close;
        branchMap[bId].amount = close;
        branchMap[bId].count = bTx.length;
      } else {
        const amt = branchEntries.reduce((s, e) => s + (Number(e.amount) || 0), 0);
        branchMap[bId].amount = amt;
        branchMap[bId].count = branchEntries.length;
      }
    });

    const list = Object.values(branchMap);
    list.sort((a, b) => {
      if (a.branchId === 'main') return -1;
      if (b.branchId === 'main') return 1;
      return a.branchName.localeCompare(b.branchName);
    });

    return list;
  };

  const authorizedBranchBreakdown = useMemo(() => {
    if (!detailModal.isOpen || !detailModal.group) return [];
    const list = getBranchBreakdownForColumn(detailModal.group, detailModal.column);
    if (isHeadOfficeUser) {
      return list;
    }
    // Branch user can only see their own branch row
    return list.filter(b => b.branchId === userBranchNorm);
  }, [detailModal, isHeadOfficeUser, userBranchNorm, branches, allDataMap]);

  const currentStep2Entries = useMemo(() => {
    if (!detailModal.isOpen || !detailModal.group) return [];
    const activeBranchId = subMode === 'consolidated' ? selectedBranchId : userBranchNorm;
    return getFilteredEntriesForColumn(detailModal.group, detailModal.column, activeBranchId);
  }, [detailModal, selectedBranchId, subMode, userBranchNorm, allDataMap]);

  const handleDrillToBranch = (branchId: string) => {
    const normId = normalizeBranchId(branchId);
    if (!isHeadOfficeUser && normId !== userBranchNorm) {
      return;
    }
    if (detailModal.type === 'remittance') {
      setSelectedRemitBranchId(normId);
      setRemitDrillStep(2);
      setSelectedRemitCompany(null);
    } else {
      setSelectedBranchId(normId);
      setModalDrillStep(2);
      if (detailModal.group && detailModal.column) {
        const branchEntries = getFilteredEntriesForColumn(detailModal.group, detailModal.column, normId);
        setDetailModal(prev => ({ ...prev, entries: branchEntries }));
      }
    }
  };

  const openDetail = (group: any, column: string) => {
    const dateBs = toBs(group.date);
    let type: 'audit' | 'remittance' | 'qr' = 'audit';
    if (column === 'pay_remit' || column === 'remit') {
      type = 'remittance';
    } else if (column === 'pay_qr') {
      type = 'qr';
    }

    const columnLabel = getColumnLabel(column);

    if (column === 'pay_remit' || column === 'remit') {
      const raw = group.remittances || [];
      setRawRemitList(raw);
      setSelectedRemitCompany(null);
      if (subMode === 'consolidated') {
        setRemitDrillStep(1);
        setSelectedRemitBranchId(isHeadOfficeUser ? null : userBranchNorm);
      } else {
        setRemitDrillStep(1);
        setSelectedRemitBranchId(userBranchNorm);
      }
    }

    if (subMode === 'consolidated') {
      setModalDrillStep(1);
      setSelectedBranchId(null);
    } else {
      setModalDrillStep(2);
      setSelectedBranchId(userBranchNorm);
    }

    setEditingEntryId(null);
    const initialEntries = getFilteredEntriesForColumn(group, column, subMode === 'consolidated' ? null : userBranchNorm);
    setDetailModal({
      isOpen: true,
      date: group.date,
      entries: initialEntries,
      title: `${columnLabel.toUpperCase()} - ${dateBs}`,
      type,
      column,
      group
    });
  };

  const handlePrintModal = () => {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const isStep1 = subMode === 'consolidated' && modalDrillStep === 1 && detailModal.type !== 'remittance';
    const entriesToPrint = isStep1 ? authorizedBranchBreakdown : (modalDrillStep === 2 ? currentStep2Entries : detailModal.entries);
    
    if (!entriesToPrint || entriesToPrint.length === 0) return;

    let tableHtml = '';
    if (isStep1) {
      const totalAmt = authorizedBranchBreakdown.reduce((sum, b) => sum + (Number(b.amount) || 0), 0);
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 10%; text-align: center;">S.N.</th>
              <th style="width: 20%;">Branch Code</th>
              <th style="width: 40%;">Branch Name</th>
              <th style="width: 30%; text-align: right;">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${authorizedBranchBreakdown.map((b, idx) => `
              <tr>
                <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
                <td style="font-weight: 700; text-transform: uppercase;">${b.branchCode}</td>
                <td style="font-weight: 800;">${b.branchName}</td>
                <td class="amount">रू ${Number(b.amount || 0).toLocaleString()}</td>
              </tr>
            `).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="3" style="text-align: right; text-transform: uppercase;">Total Consolidated Amount:</td>
              <td class="amount" style="color: #2563eb; font-size: 13px;">रू ${totalAmt.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      `;
    } else {
      const list = (modalDrillStep === 2 ? currentStep2Entries : detailModal.entries) || [];
      const totalAmt = list.reduce((sum, e) => sum + (Number(e.amount) || 0), 0);
      tableHtml = `
        <table>
          <thead>
            <tr>
              <th style="width: 7%; text-align: center;">S.N.</th>
              <th style="width: 23%;">Particulars</th>
              <th style="width: 30%;">Narration</th>
              <th style="width: 15%; text-align: left;">Entered By</th>
              <th style="width: 10%; text-align: center;">Voucher</th>
              <th style="width: 15%; text-align: right;">Amount (Rs.)</th>
            </tr>
          </thead>
          <tbody>
            ${list.map((ent, idx) => {
              const u = resolveUserDisplay(ent);
              return `
              <tr>
                <td style="text-align: center; font-weight: 700;">${idx + 1}</td>
                <td style="font-weight: 800; text-transform: uppercase; font-style: italic;">${ent.head}</td>
                <td style="color: #334155;">${ent.remarks || '-'}</td>
                <td style="font-size: 10px; font-weight: 700; color: #0f172a;">${u.name}</td>
                <td class="${ent.type === 'in' ? 'type-in' : 'type-out'}">${ent.type === 'in' ? 'CREDIT' : 'DEBIT'}</td>
                <td class="amount">रू ${Number(ent.amount || 0).toLocaleString()}</td>
              </tr>
            `;}).join('')}
          </tbody>
          <tfoot>
            <tr class="total-row">
              <td colspan="5" style="text-align: right; text-transform: uppercase;">Total Amount:</td>
              <td class="amount" style="color: #2563eb; font-size: 13px;">रू ${totalAmt.toLocaleString()}</td>
            </tr>
          </tfoot>
        </table>
      `;
    }

    const branchTitle = subMode === 'consolidated' && selectedBranchId ? getBranchName(selectedBranchId) : (branch?.name || 'Head Office');
    const contentHtml = `
      <!DOCTYPE html>
      <html>
        <head>
          <title>${detailModal.title}</title>
          <style>
            body { font-family: system-ui, -apple-system, sans-serif; padding: 25px; color: #0f172a; margin: 0; }
            .header { text-align: center; margin-bottom: 20px; border-bottom: 2px solid #0f172a; padding-bottom: 12px; }
            .header h2 { margin: 0; font-size: 20px; font-weight: 800; text-transform: uppercase; color: #0f172a; }
            .header h3 { margin: 4px 0 0 0; font-size: 14px; font-weight: 700; color: #2563eb; text-transform: uppercase; }
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
            <h2>RATAULI SACCOS - ${branchTitle}</h2>
            <h3>${detailModal.title}</h3>
            <p>Back Office Audit Breakdown Log</p>
          </div>
          ${tableHtml}
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

  const handleDeleteModalEntry = (entry: any) => {
    if (entry.isReadOnly) return;
    if (isDayEndedForBranch(entry.branchId || branch?.id)) {
      setModalErrorMsg(getDayEndedBlockMessage());
      return;
    }
    const entryDate = entry.date || detailModal.date;
    if (isBackDateBlockedForEntry(entryDate, authSettings)) {
      setModalErrorMsg(getBackDateBlockedMessage(entryDate));
      return;
    }
    setModalErrorMsg(null);
    setDeleteConfirmEntry(entry);
  };

  const executeDeleteModalEntry = async () => {
    if (!deleteConfirmEntry) return;
    const entry = deleteConfirmEntry;
    setIsDeleting(true);

    try {
      const entryDate = entry.date || detailModal.date;
      const targetBranchId = entry.branchId || branch?.id || 'main';

      // 1. Delete from specific dayData
      const dayData = await storageService.getDayData(entryDate, targetBranchId);
      if (dayData) {
        if (entry.entryCategory === 'remittance') {
          const updatedRemit = (dayData.remittances || []).filter(r => 
            r.id !== entry.id && !(entry.remarks && r.referenceNo === entry.remarks && Number(r.amount) === Number(entry.amount))
          );
          await storageService.saveDayData(entryDate, targetBranchId, { ...dayData, remittances: updatedRemit });
          setRawRemitList(prev => prev.filter(r => r.id !== entry.id));
        } else {
          const updatedOffice = (dayData.officeTransactions || []).filter(t => 
            t.id !== entry.id && !(t.head === entry.head && Number(t.amount) === Number(entry.amount) && t.type === entry.type)
          );
          await storageService.saveDayData(entryDate, targetBranchId, { ...dayData, officeTransactions: updatedOffice });
        }
      }

      // 2. Also search allDataMap in case it was saved under another branch or date key
      const freshAll = await storageService.getAllData().catch(() => ({}));
      if (freshAll && typeof freshAll === 'object') {
        for (const [key, dayObj] of Object.entries(freshAll)) {
          if (!dayObj || typeof dayObj !== 'object') continue;
          let changed = false;
          let newOffice = dayObj.officeTransactions || [];
          let newRemit = dayObj.remittances || [];

          if (entry.entryCategory === 'remittance') {
            const matchRemit = newRemit.some(r => r.id === entry.id || (entry.remarks && r.referenceNo === entry.remarks && Number(r.amount) === Number(entry.amount)));
            if (matchRemit) {
              newRemit = newRemit.filter(r => r.id !== entry.id && !(entry.remarks && r.referenceNo === entry.remarks && Number(r.amount) === Number(entry.amount)));
              changed = true;
            }
          } else {
            const matchOffice = newOffice.some(t => t.id === entry.id || ((t.head === entry.head || t.remarks === entry.remarks) && Number(t.amount) === Number(entry.amount) && t.type === entry.type));
            if (matchOffice) {
              newOffice = newOffice.filter(t => t.id !== entry.id && !((t.head === entry.head || t.remarks === entry.remarks) && Number(t.amount) === Number(entry.amount) && t.type === entry.type));
              changed = true;
            }
          }

          if (changed) {
            const bId = (dayObj as any).branchId || targetBranchId;
            const dKey = dayObj.date || key;
            await storageService.saveDayData(dKey, bId, {
              ...dayObj,
              officeTransactions: newOffice,
              remittances: newRemit
            });
          }
        }
      }

      // 3. Direct Supabase deletion
      if (entry.id && supabase) {
        try {
          if (entry.entryCategory === 'remittance') {
            await supabase.from('remittance_entries').delete().eq('id', entry.id);
          } else {
            await supabase.from('back_office_entries').delete().eq('id', entry.id);
          }
        } catch (supErr) {
          console.warn("Direct Supabase delete notice:", supErr);
        }
      }

      const updatedEntries = detailModal.entries.filter(e => e.id !== entry.id);
      const remainingRemit = rawRemitList.filter(r => r.id !== entry.id);
      setRawRemitList(remainingRemit);

      if (updatedEntries.length === 0 || (detailModal.type === 'remittance' && remainingRemit.length === 0)) {
        setDetailModal({ isOpen: false, date: '', entries: [], title: '', type: 'all' });
      } else {
        setDetailModal(prev => ({ ...prev, entries: updatedEntries }));
      }
      setDeleteConfirmEntry(null);
      await loadData();
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.error("Failed to delete entry", e);
    } finally {
      setIsDeleting(false);
    }
  };

  const startEditModalEntry = (entry: any) => {
    if (entry.isReadOnly) return;
    if (isDayEndedForBranch(entry.branchId || branch?.id)) {
      setModalErrorMsg(getDayEndedBlockMessage());
      return;
    }
    const entryDate = entry.date || detailModal.date;
    if (isBackDateBlockedForEntry(entryDate, authSettings)) {
      setModalErrorMsg(getBackDateBlockedMessage(entryDate));
      return;
    }
    setModalErrorMsg(null);
    setEditingEntryId(entry.id);
    setEditingForm({
      head: entry.head || '',
      remarks: entry.remarks || '',
      amount: String(entry.amount || ''),
      type: entry.type === 'in' ? 'in' : 'out'
    });
  };

  const handleSaveModalEdit = async (entry: any) => {
    if (entry.isReadOnly) return;
    if (isDayEndedForBranch(entry.branchId || branch?.id)) {
      setModalErrorMsg(getDayEndedBlockMessage());
      return;
    }
    const entryDate = entry.date || detailModal.date;
    if (isBackDateBlockedForEntry(entryDate, authSettings)) {
      setModalErrorMsg(getBackDateBlockedMessage(entryDate));
      return;
    }
    setModalErrorMsg(null);
    const numAmt = parseFloat(editingForm.amount);
    if (isNaN(numAmt) || numAmt <= 0) return;

    try {
      const targetBranchId = entry.branchId || branch?.id || 'main';
      const dayData = await storageService.getDayData(entryDate, targetBranchId);
      if (dayData) {
        if (entry.entryCategory === 'remittance') {
          const updatedRemit = (dayData.remittances || []).map(r => {
            if (r.id === entry.id) {
              return {
                ...r,
                companyName: editingForm.head,
                referenceNo: editingForm.remarks,
                amount: numAmt,
                type: editingForm.type === 'in' ? RemittanceType.SEND : RemittanceType.PAY
              };
            }
            return r;
          });
          await storageService.saveDayData(entryDate, targetBranchId, { ...dayData, remittances: updatedRemit });
        } else {
          const updatedOffice = (dayData.officeTransactions || []).map(t => {
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
          await storageService.saveDayData(entryDate, targetBranchId, { ...dayData, officeTransactions: updatedOffice });
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
      await loadData();
    } catch (e) {
      console.error("Failed to edit entry", e);
    }
  };

  return (
    <div className="space-y-2.5 animate-in fade-in duration-300 w-full pb-6">
      {/* Header Banner */}
      <div className="bg-white py-2 px-3.5 rounded-xl border border-slate-200 shadow-sm flex flex-col lg:flex-row justify-between items-center gap-2 relative z-20">
         <div className="flex flex-wrap items-center gap-4">
            <div className="flex items-center space-x-2.5">
               <div className="w-8 h-8 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-md">
                  <History size={16}/>
               </div>
               <div>
                  <h1 className="text-base font-black text-slate-900 tracking-tighter uppercase italic leading-none">Back <span className="text-blue-600">Office</span></h1>
                  <p className="text-[7.5px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic">Permanent Record Log</p>
               </div>
            </div>

            {/* Transaction Date moved right next to BACK OFFICE */}
            <div className="pl-3 border-l border-slate-200 scale-90 origin-left flex items-center space-x-3">
               <NepaliDatePicker 
                  value={quickEntry.date} 
                  onChange={v => { setQuickEntry({...quickEntry, date: v}); setEntryErrorMsg(null); }} 
                  label="Transaction Date" 
                  align="left" 
                  disallowBackDateIfDisabled={true}
                  disabled={isDayEnded}
               />

               {/* Sub Menu Option: Back Office Log vs Consolidated */}
               <div className="flex items-center bg-slate-100 p-0.5 rounded-xl border border-slate-200 shadow-inner italic font-black ml-2">
                  <button
                     type="button"
                     onClick={() => handleToggleSubMode('log')}
                     className={`px-2.5 py-1 rounded-lg text-[10px] transition-all uppercase italic font-black flex items-center space-x-1 cursor-pointer ${
                        subMode === 'log' 
                           ? 'bg-slate-900 text-white shadow-xs' 
                           : 'text-slate-600 hover:text-slate-900'
                     }`}
                  >
                     <span>Main Log</span>
                  </button>
                  <button
                     type="button"
                     onClick={() => handleToggleSubMode('consolidated')}
                     className={`px-2.5 py-1 rounded-lg text-[10px] transition-all uppercase italic font-black flex items-center space-x-1 cursor-pointer ${
                        subMode === 'consolidated' 
                           ? 'bg-emerald-600 text-white shadow-xs'
                           : 'text-slate-600 hover:text-emerald-700'
                     }`}
                  >
                     <span>Consolidated</span>
                  </button>
               </div>
            </div>
         </div>

         <div className="flex flex-wrap items-center gap-2">
            {/* Quick Filter Presets */}
            <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
               <button 
                 onClick={() => applyPreset('today')}
                 className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all cursor-pointer ${
                   activePreset === 'today'
                     ? 'bg-emerald-500 text-slate-950 shadow-xs'
                     : 'text-slate-300 hover:text-white hover:bg-slate-800'
                 }`}
               >
                 Today
               </button>
               <button 
                 onClick={() => applyPreset('3days')}
                 className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all cursor-pointer ${
                   activePreset === '3days'
                     ? 'bg-emerald-500 text-slate-950 shadow-xs'
                     : 'text-slate-300 hover:text-white hover:bg-slate-800'
                 }`}
               >
                 3 Days
               </button>
               <button 
                 onClick={() => applyPreset('week')}
                 className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all cursor-pointer ${
                   activePreset === 'week'
                     ? 'bg-emerald-500 text-slate-950 shadow-xs'
                     : 'text-slate-300 hover:text-white hover:bg-slate-800'
                 }`}
               >
                 Week
               </button>
               <button 
                 onClick={() => applyPreset('month')}
                 className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all cursor-pointer ${
                   activePreset === 'month'
                     ? 'bg-emerald-500 text-slate-950 shadow-xs'
                     : 'text-slate-300 hover:text-white hover:bg-slate-800'
                 }`}
               >
                 Month
               </button>
               <button 
                 onClick={() => applyPreset('all')}
                 className={`px-2 py-0.5 rounded-md text-[9px] font-black uppercase transition-all cursor-pointer ${
                   activePreset === 'all'
                     ? 'bg-emerald-500 text-slate-950 shadow-xs'
                     : 'text-slate-300 hover:text-white hover:bg-slate-800'
                 }`}
               >
                 All
               </button>
            </div>

            <div className="flex items-center space-x-1.5 bg-slate-50 p-1 rounded-lg border border-slate-200">
               <NepaliDatePicker value={dateRange.start} onChange={v => { setActivePreset('custom'); setDateRange(p => ({...p, start: v})); }} label="From" />
               <span className="text-slate-400 font-bold px-0.5 text-[10px] mt-3">to</span>
               <NepaliDatePicker value={dateRange.end} onChange={v => { setActivePreset('custom'); setDateRange(p => ({...p, end: v})); }} label="To" />
            </div>
         </div>
      </div>

      {entryErrorMsg && (
        <div className="bg-rose-50 border border-rose-200 text-rose-700 px-3.5 py-2 rounded-xl flex items-center justify-between text-xs font-bold shadow-xs">
          <div className="flex items-center space-x-2">
            <AlertCircle size={15} className="text-rose-600 shrink-0" />
            <span>{entryErrorMsg}</span>
          </div>
          <button type="button" onClick={() => setEntryErrorMsg(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
            <X size={14} />
          </button>
        </div>
      )}

      {/* Entry Form (Shown ONLY in Main Log mode, hidden in Consolidated mode) */}
      {subMode === 'log' ? (
      <DayEndFieldset branchId={branch?.id} className="bg-white p-4 rounded-xl border-2 border-slate-950 shadow-md grid grid-cols-1 md:grid-cols-12 gap-3.5 items-end italic font-black relative z-10">
         {/* 1. Account Head */}
         <div className="md:col-span-3">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider ml-0.5 mb-1 block">Account Head</label>
            <select 
              value={quickEntry.head} 
              onChange={e => setQuickEntry({...quickEntry, head: e.target.value})} 
              className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 font-black text-xs uppercase outline-none focus:border-blue-600 appearance-none shadow-sm cursor-pointer"
            >
               <option value="CASH">CASH</option>
               <option value="BANK">BANK</option>
               <option value="BRANCH">BRANCH</option>
               <option value="QR PAID">QR PAID</option>
               <option value="REMITTANCE">REMITTANCE</option>
               <option value="OTHER">OTHER</option>
            </select>
         </div>

         {/* 2. Type */}
         <div className="md:col-span-3">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider ml-0.5 mb-1 block">Type</label>
            <div className="flex items-center space-x-1 h-10 bg-slate-50 border border-slate-300 rounded-xl p-1">
               <button
                  type="button"
                  onClick={() => setQuickEntry({ ...quickEntry, type: 'in' })}
                  disabled={quickEntry.head === 'QR PAID'}
                  className={`flex-1 h-full flex items-center justify-center space-x-1.5 px-2 rounded-lg transition-all text-[10px] font-black uppercase italic cursor-pointer ${
                     quickEntry.type === 'in'
                        ? 'bg-emerald-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                  }`}
               >
                  <div className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center shrink-0">
                     {quickEntry.type === 'in' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span>IN (+)</span>
               </button>

               <button
                  type="button"
                  onClick={() => setQuickEntry({ ...quickEntry, type: 'out' })}
                  disabled={quickEntry.head === 'QR PAID'}
                  className={`flex-1 h-full flex items-center justify-center space-x-1.5 px-2 rounded-lg transition-all text-[10px] font-black uppercase italic cursor-pointer ${
                     quickEntry.type === 'out'
                        ? 'bg-rose-600 text-white shadow-xs'
                        : 'text-slate-500 hover:text-slate-800'
                  }`}
               >
                  <div className="w-3.5 h-3.5 rounded-full border border-current flex items-center justify-center shrink-0">
                     {quickEntry.type === 'out' && <div className="w-2 h-2 rounded-full bg-white" />}
                  </div>
                  <span>OUT (-)</span>
               </button>
            </div>
         </div>

         {/* 3. Amount */}
         <div className="md:col-span-2">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider ml-0.5 mb-1 block">Amount</label>
            <input 
              type="number" 
              placeholder="0.00" 
              value={quickEntry.amount} 
              onChange={e => setQuickEntry({...quickEntry, amount: e.target.value})} 
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlePost();
                }
              }}
              className="w-full h-10 bg-white border border-slate-300 rounded-xl px-3 font-black text-sm outline-none focus:border-blue-600 text-center text-blue-600 shadow-inner" 
            />
         </div>

         {/* 4. Narration */}
         <div className="md:col-span-2">
            <label className="text-[9px] font-black uppercase text-slate-500 tracking-wider ml-0.5 mb-1 block">Narration</label>
            <input 
              type="text" 
              placeholder="..." 
              value={quickEntry.narration} 
              onChange={e => setQuickEntry({...quickEntry, narration: e.target.value})} 
              onKeyDown={e => {
                if (e.key === 'Enter') {
                  e.preventDefault();
                  handlePost();
                }
              }}
              className="w-full h-10 bg-slate-50 border border-slate-300 rounded-xl px-3 font-black text-xs outline-none focus:border-blue-600 uppercase" 
            />
         </div>

         {/* 5. Save Button */}
         <div className="md:col-span-2 flex items-end">
            <button 
              onClick={handlePost} 
              disabled={isPosting} 
              className="w-full h-10 bg-slate-950 hover:bg-emerald-600 text-white rounded-xl flex items-center justify-center space-x-2 transition-all shadow-md active:scale-95 group shrink-0 disabled:opacity-50 cursor-pointer"
            >
               {isPosting ? <Loader2 className="animate-spin" size={15}/> : <Save size={15}/>}
               <span className="text-[10px] uppercase tracking-widest font-black">{isPosting ? 'SAVING...' : 'SAVE'}</span>
            </button>
         </div>
      </DayEndFieldset>
      ) : null}

      {/* Main Table */}
      <div className="bg-white rounded-xl shadow-md overflow-hidden border border-slate-950 font-black relative z-10">
         <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm font-black border-collapse text-center italic">
               <thead>
                  {/* Top Level Grouping Headers */}
                  <tr className="bg-slate-950 text-white uppercase tracking-wider border-b border-slate-800 text-xs">
                     <th rowSpan={2} className="py-2.5 px-2 border-r border-white/10 w-10 text-slate-400 italic">S.N.</th>
                     <th rowSpan={2} className="py-2.5 px-3 text-left border-r border-white/10 whitespace-nowrap">DATE (B.S.)</th>
                     <th rowSpan={2} className="py-2.5 px-3 border-r border-white/10 bg-amber-950 text-amber-300 whitespace-nowrap">OPENING</th>
                     <th colSpan={5} className="py-1.5 px-3 border-r border-white/10 bg-emerald-950 text-emerald-300 text-center tracking-widest font-black">
                        RECEIVED SIDE (IN / +)
                     </th>
                     <th colSpan={7} className="py-1.5 px-3 border-r border-white/10 bg-rose-950 text-rose-300 text-center tracking-widest font-black">
                        PAYMENT SIDE (OUT / -)
                     </th>
                     <th rowSpan={2} className="py-2.5 px-3 bg-teal-950 text-teal-300 font-black text-xs sm:text-sm whitespace-nowrap">CLOSING BALANCE</th>
                  </tr>

                  {/* Sub-column Headers */}
                  <tr className="bg-slate-900 text-slate-300 uppercase tracking-wider text-[10px] sm:text-[11px] border-b border-slate-950">
                     {/* Received Subheaders */}
                     <th className="py-1.5 px-2.5 border-r border-white/10 bg-emerald-950/70 text-emerald-200">CASH</th>
                     <th className="py-1.5 px-2.5 border-r border-white/10 bg-emerald-950/70 text-emerald-200">BANK</th>
                     <th className="py-1.5 px-2.5 border-r border-white/10 bg-emerald-950/70 text-emerald-200">BRANCH</th>
                     <th className="py-1.5 px-2.5 border-r border-white/10 bg-emerald-950/70 text-emerald-200">OTHER</th>
                     <th className="py-1.5 px-3 border-r border-white/10 bg-emerald-800 text-white font-black">TOTAL AMOUNT</th>

                     {/* Payment Subheaders */}
                     <th className="py-1.5 px-2.5 border-r border-white/10 bg-rose-950/70 text-rose-200">CASH</th>
                     <th className="py-1.5 px-2.5 border-r border-white/10 bg-rose-950/70 text-rose-200">BANK</th>
                     <th className="py-1.5 px-2.5 border-r border-white/10 bg-rose-950/70 text-rose-200">BRANCH</th>
                     <th className="py-1.5 px-2.5 border-r border-white/10 bg-rose-950/70 text-cyan-300">QR</th>
                     <th className="py-1.5 px-2.5 border-r border-white/10 bg-rose-950/70 text-amber-300">REMITTANCE</th>
                     <th className="py-1.5 px-2.5 border-r border-white/10 bg-rose-950/70 text-rose-200">OTHER</th>
                     <th className="py-1.5 px-3 border-r border-white/10 bg-rose-800 text-white font-black">TOTAL AMOUNT</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 text-slate-900">
                  {groupedLogs.map((group, idx) => {
                    return (
                      <tr key={group.date ? `${group.date}-${idx}` : `group-${idx}`} className="hover:bg-blue-50/40 transition-colors group">
                        {/* 1. S.N. */}
                        <td className="py-2.5 px-2 text-slate-400 border-r border-slate-100 font-bold">{idx + 1}</td>

                        {/* 2. Date */}
                        <td onClick={() => openDetail(group, 'all')} className="py-2.5 px-3 text-left border-r border-slate-100 cursor-pointer hover:bg-slate-100 whitespace-nowrap">
                           <div className="text-slate-950 font-black text-xs sm:text-sm">{toBs(group.date)}</div>
                        </td>

                        {/* 3. Opening Balance (Distinct Highlight) */}
                        <td onClick={() => openDetail(group, 'opening')} className="py-2.5 px-3 bg-amber-50 text-amber-950 border-r border-slate-200 font-black italic cursor-pointer hover:bg-amber-100 whitespace-nowrap shadow-inner">
                           रू {group.openingBalance.toLocaleString()}
                        </td>

                        {/* 4. Received: Cash */}
                        <td onClick={() => openDetail(group, 'recv_cash')} className="py-2.5 px-2.5 text-emerald-700 border-r border-slate-100 cursor-pointer hover:bg-emerald-50 italic font-black whitespace-nowrap">
                           {group.recvCash > 0 ? group.recvCash.toLocaleString() : '-'}
                        </td>

                        {/* 5. Received: Bank */}
                        <td onClick={() => openDetail(group, 'recv_bank')} className="py-2.5 px-2.5 text-emerald-700 border-r border-slate-100 cursor-pointer hover:bg-emerald-50 italic font-black whitespace-nowrap">
                           {group.recvBank > 0 ? group.recvBank.toLocaleString() : '-'}
                        </td>

                        {/* 6. Received: Branch */}
                        <td onClick={() => openDetail(group, 'recv_branch')} className="py-2.5 px-2.5 text-emerald-700 border-r border-slate-100 cursor-pointer hover:bg-emerald-50 italic font-black whitespace-nowrap">
                           {group.recvBranch > 0 ? group.recvBranch.toLocaleString() : '-'}
                        </td>

                        {/* 7. Received: Other */}
                        <td onClick={() => openDetail(group, 'recv_other')} className="py-2.5 px-2.5 text-emerald-700 border-r border-slate-100 cursor-pointer hover:bg-emerald-50 italic font-black whitespace-nowrap">
                           {group.recvOther > 0 ? group.recvOther.toLocaleString() : '-'}
                        </td>

                        {/* 8. Received: Total Amount (Distinct Highlight) */}
                        <td onClick={() => openDetail(group, 'total_received')} className="py-2.5 px-3 bg-emerald-100 text-emerald-950 border-r border-slate-200 font-black italic cursor-pointer hover:bg-emerald-200 whitespace-nowrap shadow-inner">
                           {group.totalReceived > 0 ? group.totalReceived.toLocaleString() : '-'}
                        </td>

                        {/* 9. Payment: Cash */}
                        <td onClick={() => openDetail(group, 'pay_cash')} className="py-2.5 px-2.5 text-rose-700 border-r border-slate-100 cursor-pointer hover:bg-rose-50 italic font-black whitespace-nowrap">
                           {group.payCash > 0 ? group.payCash.toLocaleString() : '-'}
                        </td>

                        {/* 10. Payment: Bank */}
                        <td onClick={() => openDetail(group, 'pay_bank')} className="py-2.5 px-2.5 text-rose-700 border-r border-slate-100 cursor-pointer hover:bg-rose-50 italic font-black whitespace-nowrap">
                           {group.payBank > 0 ? group.payBank.toLocaleString() : '-'}
                        </td>

                        {/* 11. Payment: Branch */}
                        <td onClick={() => openDetail(group, 'pay_branch')} className="py-2.5 px-2.5 text-rose-700 border-r border-slate-100 cursor-pointer hover:bg-rose-50 italic font-black whitespace-nowrap">
                           {group.payBranch > 0 ? group.payBranch.toLocaleString() : '-'}
                        </td>

                        {/* 12. Payment: QR */}
                        <td onClick={() => openDetail(group, 'pay_qr')} className="py-2.5 px-2.5 text-cyan-600 bg-cyan-50/20 border-r border-slate-100 cursor-pointer hover:bg-cyan-50/50 italic font-black whitespace-nowrap">
                           {group.payQr > 0 ? group.payQr.toLocaleString() : '-'}
                        </td>

                        {/* 13. Payment: Remittance */}
                        <td onClick={() => openDetail(group, 'pay_remit')} className="py-2.5 px-2.5 text-amber-700 bg-amber-50/20 border-r border-slate-100 cursor-pointer hover:bg-amber-50/50 italic font-black whitespace-nowrap">
                           {group.payRemit > 0 ? group.payRemit.toLocaleString() : '-'}
                        </td>

                        {/* 14. Payment: Other */}
                        <td onClick={() => openDetail(group, 'pay_other')} className="py-2.5 px-2.5 text-rose-700 border-r border-slate-100 cursor-pointer hover:bg-rose-50 italic font-black whitespace-nowrap">
                           {group.payOther > 0 ? group.payOther.toLocaleString() : '-'}
                        </td>

                        {/* 15. Payment: Total Amount (Distinct Highlight) */}
                        <td onClick={() => openDetail(group, 'total_payment')} className="py-2.5 px-3 bg-rose-100 text-rose-950 border-r border-slate-200 font-black italic cursor-pointer hover:bg-rose-200 whitespace-nowrap shadow-inner">
                           {group.totalPayment > 0 ? group.totalPayment.toLocaleString() : '-'}
                        </td>

                        {/* 16. Closing Balance (Distinct Highlight) */}
                        <td onClick={() => openDetail(group, 'balance')} className="py-2.5 px-3 bg-teal-100 text-teal-950 font-black italic text-xs sm:text-sm cursor-pointer hover:bg-teal-200 shadow-inner whitespace-nowrap">
                           रू {group.closingBalance.toLocaleString()}
                        </td>
                      </tr>
                    );
                  })}
               </tbody>
            </table>
         </div>
      </div>

      {/* Detail Modal */}
      {detailModal.isOpen && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[7000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-4xl rounded-2xl shadow-2xl overflow-hidden relative animate-in zoom-in-95 duration-150 my-auto border border-slate-200">
            {/* Header */}
            <div className="px-4 py-3 bg-slate-900 text-white flex justify-between items-center border-b border-slate-800">
              <div className="flex items-center space-x-2">
                {detailModal.type === 'remittance' && ((subMode === 'consolidated' && remitDrillStep > 1) || (subMode !== 'consolidated' && remitDrillStep > 1)) && (
                  <button
                    onClick={() => {
                      if (remitDrillStep === 3) setRemitDrillStep(2);
                      else if (remitDrillStep === 2) setRemitDrillStep(1);
                    }}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold mr-2 cursor-pointer shadow-sm"
                    title="Go Back to Previous Step"
                  >
                    <ArrowLeft size={16} />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                )}
                <div>
                  <h2 className="text-sm sm:text-base font-black tracking-tight italic uppercase text-emerald-400 flex items-center space-x-2">
                    {detailModal.type === 'remittance' ? (
                      subMode === 'consolidated' ? (
                        remitDrillStep === 1 
                          ? `CONSOLIDATED REMITTANCE SUMMARY - ${toBs(detailModal.date)}`
                          : remitDrillStep === 2
                            ? `${getBranchName(selectedRemitBranchId || '')} - COMPANY BREAKDOWN`
                            : `${selectedRemitCompany} TRANSACTIONS (${getBranchName(selectedRemitBranchId || '')})`
                      ) : (
                        remitDrillStep === 1
                          ? `REMITTANCE SUMMARY BY COMPANY - ${toBs(detailModal.date)}`
                          : `${selectedRemitCompany} TRANSACTIONS - ${toBs(detailModal.date)}`
                      )
                    ) : detailModal.title}
                  </h2>
                  <div className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider flex items-center flex-wrap gap-1.5 mt-0.5">
                    {detailModal.type === 'remittance' ? (
                      subMode === 'consolidated' ? (
                        <div className="flex items-center space-x-1.5 text-[11px]">
                          <button
                            onClick={() => { setRemitDrillStep(1); setSelectedRemitBranchId(null); setSelectedRemitCompany(null); }}
                            className={`hover:underline cursor-pointer font-bold ${remitDrillStep === 1 ? 'text-amber-400 underline' : 'text-slate-400'}`}
                          >
                            1. All Branches
                          </button>
                          {remitDrillStep >= 2 && (
                            <>
                              <ChevronRight size={12} className="text-slate-500" />
                              <button
                                onClick={() => { setRemitDrillStep(2); setSelectedRemitCompany(null); }}
                                className={`hover:underline cursor-pointer font-bold ${remitDrillStep === 2 ? 'text-amber-400 underline' : 'text-slate-400'}`}
                              >
                                2. {getBranchName(selectedRemitBranchId || '')}
                              </button>
                            </>
                          )}
                          {remitDrillStep === 3 && (
                            <>
                              <ChevronRight size={12} className="text-slate-500" />
                              <span className="text-emerald-400 font-bold">
                                3. {selectedRemitCompany} Details
                              </span>
                            </>
                          )}
                        </div>
                      ) : (
                        <div className="flex items-center space-x-1.5 text-[11px]">
                          <button
                            onClick={() => { setRemitDrillStep(1); setSelectedRemitCompany(null); }}
                            className={`hover:underline cursor-pointer font-bold ${remitDrillStep === 1 ? 'text-amber-400 underline' : 'text-slate-400'}`}
                          >
                            1. Companies
                          </button>
                          {remitDrillStep === 2 && (
                            <>
                              <ChevronRight size={12} className="text-slate-500" />
                              <span className="text-emerald-400 font-bold">
                                2. {selectedRemitCompany} Details
                              </span>
                            </>
                          )}
                        </div>
                      )
                    ) : subMode === 'consolidated' && modalDrillStep === 2 ? (
                      <div className="flex items-center space-x-1.5 text-[11px]">
                        <span className="text-emerald-400 font-bold">
                          {selectedBranchId ? getBranchName(selectedBranchId) : 'Branch Details'}
                        </span>
                      </div>
                    ) : (
                      <span>Transaction Breakdown Log</span>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-2">
                <button 
                  onClick={handlePrintModal} 
                  className="p-1.5 bg-slate-800 rounded-lg hover:bg-emerald-600 text-slate-300 hover:text-white transition-all flex items-center space-x-1.5 text-xs font-bold cursor-pointer"
                  title="Print Breakdown Details"
                >
                  <Printer size={15}/>
                  <span className="text-xs">Print</span>
                </button>
                <button 
                  onClick={() => { setDetailModal(p => ({...p, isOpen: false})); setEditingEntryId(null); setModalErrorMsg(null); }} 
                  className="p-1.5 bg-slate-800 rounded-lg hover:bg-rose-600 text-slate-300 hover:text-white transition-all cursor-pointer"
                  title="Close"
                >
                  <X size={16}/>
                </button>
              </div>
            </div>

            {/* Body */}
            <div className="p-3.5 max-h-[70vh] overflow-y-auto">
              {modalErrorMsg && (
                <div className="mb-3 bg-rose-50 border border-rose-200 text-rose-700 px-3 py-2 rounded-xl flex items-center justify-between text-xs font-bold">
                  <div className="flex items-center space-x-2">
                    <AlertCircle size={14} className="text-rose-600 shrink-0" />
                    <span>{modalErrorMsg}</span>
                  </div>
                  <button type="button" onClick={() => setModalErrorMsg(null)} className="text-rose-500 hover:text-rose-700 cursor-pointer">
                    <X size={13} />
                  </button>
                </div>
              )}
              {detailModal.type === 'remittance' ? (
                <>
                  {/* CONSOLIDATED STEP 1: BRANCH SUMMARY */}
                  {subMode === 'consolidated' && remitDrillStep === 1 && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                            <th className="py-2.5 px-3 text-center w-12">S.N.</th>
                            <th className="py-2.5 px-3.5">Branch Name</th>
                            <th className="py-2.5 px-3 text-center w-24">Total Trx</th>
                            <th className="py-2.5 px-3.5 text-right w-32">Send Amount</th>
                            <th className="py-2.5 px-3.5 text-right w-32">Pay Amount</th>
                            <th className="py-2.5 px-3.5 text-right w-36">Total Amount</th>
                            <th className="py-2.5 px-3 text-center w-28">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-semibold text-slate-800">
                          {branchSummaries.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 px-4 text-center text-slate-400 uppercase font-bold italic tracking-wider text-xs">
                                No remittance entries found for this date
                              </td>
                            </tr>
                          ) : (
                            branchSummaries.map((bs, idx) => (
                              <tr 
                                key={bs.branchId} 
                                onClick={() => { setSelectedRemitBranchId(bs.branchId); setRemitDrillStep(2); }}
                                className="hover:bg-amber-50/70 cursor-pointer transition-colors group"
                                title={`Click to view ${bs.branchName} remittance companies`}
                              >
                                <td className="py-3 px-3 text-center font-bold text-slate-500 text-xs">{idx + 1}</td>
                                <td className="py-3 px-3.5 font-black text-slate-900 uppercase italic group-hover:text-amber-700 flex items-center space-x-1.5">
                                  <Building2 size={15} className="text-slate-400 group-hover:text-amber-600 shrink-0" />
                                  <span>{bs.branchName}</span>
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">{bs.count}</td>
                                <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700">रू {bs.sendAmt.toLocaleString()}</td>
                                <td className="py-3 px-3.5 text-right font-mono font-bold text-rose-700">रू {bs.payAmt.toLocaleString()}</td>
                                <td className="py-3 px-3.5 text-right font-mono font-black text-amber-700">रू {bs.totalAmt.toLocaleString()}</td>
                                <td className="py-3 px-3 text-center">
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-100 group-hover:bg-amber-500 text-amber-900 group-hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-xs">
                                    <span>Companies</span>
                                    <ChevronRight size={12} />
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {branchSummaries.length > 0 && (
                          <tfoot>
                            <tr className="bg-slate-900 text-white font-black text-xs sm:text-sm border-t border-slate-800">
                              <td colSpan={2} className="py-3 px-3.5 uppercase tracking-wider italic text-right">Consolidated Total:</td>
                              <td className="py-3 px-3 text-center font-mono text-amber-400">{branchSummaries.reduce((a, b) => a + b.count, 0)}</td>
                              <td className="py-3 px-3.5 text-right font-mono text-emerald-400">रू {branchSummaries.reduce((a, b) => a + b.sendAmt, 0).toLocaleString()}</td>
                              <td className="py-3 px-3.5 text-right font-mono text-rose-400">रू {branchSummaries.reduce((a, b) => a + b.payAmt, 0).toLocaleString()}</td>
                              <td className="py-3 px-3.5 text-right font-mono text-amber-400 text-sm sm:text-base">रू {branchSummaries.reduce((a, b) => a + b.totalAmt, 0).toLocaleString()}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}

                  {/* STEP 2 (CONSOLIDATED) OR STEP 1 (SINGLE BRANCH): COMPANY SUMMARY */}
                  {((subMode === 'consolidated' && remitDrillStep === 2) || (subMode !== 'consolidated' && remitDrillStep === 1)) && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                            <th className="py-2.5 px-3 text-center w-12">S.N.</th>
                            <th className="py-2.5 px-3.5">Remittance Company</th>
                            <th className="py-2.5 px-3 text-center w-24">Total Trx</th>
                            <th className="py-2.5 px-3.5 text-right w-32">Send Amount</th>
                            <th className="py-2.5 px-3.5 text-right w-32">Pay Amount</th>
                            <th className="py-2.5 px-3.5 text-right w-36">Total Amount</th>
                            <th className="py-2.5 px-3 text-center w-28">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-semibold text-slate-800">
                          {currentCompanySummaries.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 px-4 text-center text-slate-400 uppercase font-bold italic tracking-wider text-xs">
                                No remittance entries found
                              </td>
                            </tr>
                          ) : (
                            currentCompanySummaries.map((cs, idx) => (
                              <tr 
                                key={cs.companyName} 
                                onClick={() => { setSelectedRemitCompany(cs.companyName); setRemitDrillStep(subMode === 'consolidated' ? 3 : 2); }}
                                className="hover:bg-amber-50/60 cursor-pointer transition-colors group"
                              >
                                <td className="py-3 px-3 text-center font-bold text-slate-500 text-xs">{idx + 1}</td>
                                <td className="py-3 px-3.5 font-black text-slate-900 uppercase italic group-hover:text-amber-700">
                                  {cs.companyName}
                                </td>
                                <td className="py-3 px-3 text-center font-mono font-bold text-slate-600">{cs.count}</td>
                                <td className="py-3 px-3.5 text-right font-mono font-bold text-emerald-700">रू {cs.sendAmt.toLocaleString()}</td>
                                <td className="py-3 px-3.5 text-right font-mono font-bold text-rose-700">रू {cs.payAmt.toLocaleString()}</td>
                                <td className="py-3 px-3.5 text-right font-mono font-black text-amber-700">रू {cs.totalAmt.toLocaleString()}</td>
                                <td className="py-3 px-3 text-center">
                                  <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-100 group-hover:bg-amber-500 text-amber-900 group-hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all">
                                    <span>Details</span>
                                    <ChevronRight size={12} />
                                  </span>
                                </td>
                              </tr>
                            ))
                          )}
                        </tbody>
                        {currentCompanySummaries.length > 0 && (
                          <tfoot>
                            <tr className="bg-slate-900 text-white font-black text-xs sm:text-sm border-t border-slate-800">
                              <td colSpan={2} className="py-3 px-3.5 uppercase tracking-wider italic text-right">Total:</td>
                              <td className="py-3 px-3 text-center font-mono text-amber-400">{currentCompanySummaries.reduce((a, b) => a + b.count, 0)}</td>
                              <td className="py-3 px-3.5 text-right font-mono text-emerald-400">रू {currentCompanySummaries.reduce((a, b) => a + b.sendAmt, 0).toLocaleString()}</td>
                              <td className="py-3 px-3.5 text-right font-mono text-rose-400">रू {currentCompanySummaries.reduce((a, b) => a + b.payAmt, 0).toLocaleString()}</td>
                              <td className="py-3 px-3.5 text-right font-mono text-amber-400 text-sm sm:text-base">रू {currentCompanySummaries.reduce((a, b) => a + b.totalAmt, 0).toLocaleString()}</td>
                              <td></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}

                  {/* STEP 3 (CONSOLIDATED) OR STEP 2 (SINGLE BRANCH): INDIVIDUAL TRANSACTIONS LIST */}
                  {((subMode === 'consolidated' && remitDrillStep === 3) || (subMode !== 'consolidated' && remitDrillStep === 2)) && (
                    <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                      <table className="w-full text-left border-collapse">
                        <thead>
                          <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                            <th className="py-2.5 px-3 text-center w-12">S.N.</th>
                            <th className="py-2.5 px-3.5 w-1/4">Company</th>
                            <th className="py-2.5 px-3.5 w-1/4">Reference / Remarks</th>
                            <th className="py-2.5 px-3 text-left w-36">Entered By</th>
                            <th className="py-2.5 px-3 text-center w-24">Voucher</th>
                            <th className="py-2.5 px-3.5 text-right w-32">Amount</th>
                            <th className="py-2.5 px-3 text-center w-24">Action</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-semibold text-slate-800">
                          {currentCompanyTransactions.length === 0 ? (
                            <tr>
                              <td colSpan={7} className="py-8 px-4 text-center text-slate-400 uppercase font-bold italic tracking-wider text-xs">
                                No transactions found for {selectedRemitCompany}
                              </td>
                            </tr>
                          ) : (
                            currentCompanyTransactions.map((ent, idx) => {
                              const isSend = ent.type === RemittanceType.SEND || ent.type === 'SEND' || ent.type === 'in';
                              const userMeta = resolveUserDisplay(ent);
                              return (
                                <tr key={ent.id || `remit-${idx}`} className="hover:bg-slate-50 transition-colors">
                                  <td className="py-2.5 px-3 text-center font-bold text-slate-500 text-xs align-middle">
                                    {idx + 1}
                                  </td>
                                  <td className="py-2.5 px-3.5 align-middle font-bold text-slate-900 italic uppercase">
                                    {ent.companyName || ent.company || ent.head || selectedRemitCompany}
                                  </td>
                                  <td className="py-2.5 px-3.5 align-middle">
                                    <div className="text-slate-600 text-xs sm:text-sm font-medium">{ent.referenceNo || ent.remarks || <span className="text-slate-300 italic">-</span>}</div>
                                  </td>
                                  <td className="py-2.5 px-3 align-middle text-left">
                                    <div className="text-slate-900 font-bold text-xs truncate uppercase">{userMeta.name}</div>
                                  </td>
                                  <td className="py-2.5 px-3 text-center align-middle">
                                    <span className={`inline-block px-2.5 py-0.5 rounded text-[10px] font-black uppercase tracking-wider ${isSend ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'}`}>
                                      {isSend ? 'SEND' : 'PAY / REC'}
                                    </span>
                                  </td>
                                  <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap align-middle">
                                    रू {Number(ent.amount || 0).toLocaleString()}
                                  </td>
                                  <td className="py-2.5 px-3 text-center align-middle">
                                    <div className="flex items-center justify-center space-x-1.5">
                                      <button 
                                        disabled={isDayEnded}
                                        onClick={() => handleDeleteModalEntry({ ...ent, entryCategory: 'remittance' })}
                                        className="p-1.5 text-slate-500 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                                        title="Delete Entry"
                                      >
                                        <Trash2 size={14}/>
                                      </button>
                                    </div>
                                  </td>
                                </tr>
                              );
                            })
                          )}
                        </tbody>
                        {currentCompanyTransactions.length > 0 && (
                          <tfoot>
                            <tr className="bg-slate-900 text-white font-black text-xs sm:text-sm border-t border-slate-800">
                              <td colSpan={4} className="py-3 px-3.5 uppercase tracking-wider italic text-right">Total Amount:</td>
                              <td className="py-3 px-3.5 text-right font-mono text-amber-400 whitespace-nowrap text-sm sm:text-base">
                                रू {currentCompanyTransactions.reduce((sum, e) => sum + (Number(e.amount) || 0), 0).toLocaleString()}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
                  )}
                </>
              ) : subMode === 'consolidated' && modalDrillStep === 1 ? (
                /* Step 1: Consolidated Branch List Table */
                <div className="space-y-3">
                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                          <th className="py-2.5 px-3 text-center w-12">S.N.</th>
                          <th className="py-2.5 px-3.5 w-24">Branch Code</th>
                          <th className="py-2.5 px-3.5">Branch Name</th>
                          <th className="py-2.5 px-3 text-center w-24">Entries</th>
                          <th className="py-2.5 px-3.5 text-right w-36">Amount</th>
                          <th className="py-2.5 px-3 text-center w-36">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-semibold text-slate-800">
                        {authorizedBranchBreakdown.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 px-4 text-center text-slate-400 uppercase font-bold italic tracking-wider text-xs">
                              No branch records found for this category
                            </td>
                          </tr>
                        ) : (
                          authorizedBranchBreakdown.map((b, idx) => {
                            const canAccess = isHeadOfficeUser || b.branchId === userBranchNorm;
                            return (
                              <tr 
                                key={b.branchId}
                                onClick={() => canAccess && handleDrillToBranch(b.branchId)}
                                className={`transition-colors ${
                                  canAccess 
                                    ? 'hover:bg-blue-50/70 cursor-pointer' 
                                    : 'opacity-60 bg-slate-50/50 cursor-not-allowed'
                                }`}
                              >
                                <td className="py-2.5 px-3 text-center font-bold text-slate-500 text-xs align-middle">
                                  {idx + 1}
                                </td>
                                <td className="py-2.5 px-3.5 align-middle font-mono font-bold text-slate-700 uppercase">
                                  {b.branchCode}
                                </td>
                                <td className="py-2.5 px-3.5 align-middle">
                                  <div className="font-bold text-slate-900 flex items-center space-x-2">
                                    <span>{b.branchName}</span>
                                    {b.branchId === userBranchNorm && (
                                      <span className="px-1.5 py-0.5 bg-blue-100 text-blue-700 text-[10px] rounded font-extrabold uppercase">Your Branch</span>
                                    )}
                                  </div>
                                </td>
                                <td className="py-2.5 px-3 text-center align-middle font-bold text-slate-600">
                                  {b.count}
                                </td>
                                <td className="py-2.5 px-3.5 text-right font-mono font-bold text-slate-900 whitespace-nowrap align-middle">
                                  <button
                                    type="button"
                                    disabled={!canAccess}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      if (canAccess) handleDrillToBranch(b.branchId);
                                    }}
                                    className={`font-mono font-bold ${canAccess ? 'text-blue-600 hover:underline cursor-pointer' : 'text-slate-500 cursor-not-allowed'}`}
                                  >
                                    रू {Number(b.amount || 0).toLocaleString()}
                                  </button>
                                </td>
                                <td className="py-2.5 px-3 text-center align-middle">
                                  {canAccess ? (
                                    <button
                                      type="button"
                                      onClick={(e) => {
                                        e.stopPropagation();
                                        handleDrillToBranch(b.branchId);
                                      }}
                                      className="inline-flex items-center space-x-1 px-2.5 py-1 bg-blue-600 hover:bg-blue-700 text-white rounded text-[11px] font-bold shadow-xs cursor-pointer transition-colors"
                                    >
                                      <span>View Details</span>
                                      <ChevronRight size={12} />
                                    </button>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1 text-[10px] text-slate-400 font-bold uppercase">
                                      <Lock size={12} />
                                      <span>Restricted</span>
                                    </span>
                                  )}
                                </td>
                              </tr>
                            );
                          })
                        )}
                      </tbody>
                      {authorizedBranchBreakdown.length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-900 text-white font-black text-xs sm:text-sm border-t border-slate-800">
                            <td colSpan={4} className="py-3 px-3.5 uppercase tracking-wider italic text-right">Consolidated Total:</td>
                            <td className="py-3 px-3.5 text-right font-mono text-emerald-400 whitespace-nowrap text-sm sm:text-base">
                              रू {authorizedBranchBreakdown.reduce((sum, b) => sum + (Number(b.amount) || 0), 0).toLocaleString()}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              ) : (
                /* Step 2: Selected Branch Transactions Table (or Single Branch mode) */
                <div className="space-y-3">
                  {subMode === 'consolidated' && (
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                      <div className="flex items-center space-x-2">
                        {isHeadOfficeUser && (
                          <button
                            type="button"
                            onClick={() => {
                              setModalDrillStep(1);
                              setSelectedBranchId(null);
                            }}
                            className="inline-flex items-center space-x-1 px-2.5 py-1 bg-slate-200 hover:bg-slate-300 text-slate-800 rounded text-xs font-bold transition-colors cursor-pointer"
                          >
                            <ArrowLeft size={13} />
                            <span>← Back to Branches</span>
                          </button>
                        )}
                        <span className="text-xs font-bold text-slate-700 ml-1">
                          Branch: <span className="text-blue-600 uppercase font-black">{getBranchName(selectedBranchId || userBranchNorm)}</span>
                        </span>
                      </div>
                      <span className="text-[11px] font-semibold text-slate-500">
                        Step 2 of 2: Detailed Entries ({(modalDrillStep === 2 && currentStep2Entries.length > 0 ? currentStep2Entries : detailModal.entries).length} items)
                      </span>
                    </div>
                  )}

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
                    <table className="w-full text-left border-collapse">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[11px] font-black uppercase tracking-wider border-b border-slate-800">
                          <th className="py-2.5 px-3 text-center w-12">S.N.</th>
                          <th className="py-2.5 px-3.5 w-1/4">Particular</th>
                          <th className="py-2.5 px-3.5 w-1/4">Narration</th>
                          <th className="py-2.5 px-3 text-left w-36">Entered By</th>
                          <th className="py-2.5 px-3 text-center w-24">Voucher</th>
                          <th className="py-2.5 px-3.5 text-right w-32">Amount</th>
                          <th className="py-2.5 px-3 text-center w-24">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-xs sm:text-sm font-semibold text-slate-800">
                        {(modalDrillStep === 2 && currentStep2Entries.length > 0 ? currentStep2Entries : detailModal.entries).length === 0 ? (
                          <tr>
                            <td colSpan={7} className="py-8 px-4 text-center text-slate-400 uppercase font-bold italic tracking-wider text-xs">
                              No entries found for this category
                            </td>
                          </tr>
                        ) : (
                          (modalDrillStep === 2 && currentStep2Entries.length > 0 ? currentStep2Entries : detailModal.entries).map((ent, idx) => {
                            const isEditing = editingEntryId === ent.id;
                            const userMeta = resolveUserDisplay(ent);
                            return (
                              <tr key={ent.id ? `${ent.id}-${idx}` : `entry-${idx}`} className="hover:bg-slate-50 transition-colors">
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
                                    `रू ${Number(ent.amount || 0).toLocaleString()}`
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
                                        onClick={() => handleDeleteModalEntry(ent)}
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
                      {(modalDrillStep === 2 && currentStep2Entries.length > 0 ? currentStep2Entries : detailModal.entries).length > 0 && (
                        <tfoot>
                          <tr className="bg-slate-900 text-white font-black text-xs sm:text-sm border-t border-slate-800">
                            <td colSpan={4} className="py-3 px-3.5 uppercase tracking-wider italic text-right">Total Amount:</td>
                            <td className="py-3 px-3.5 text-right font-mono text-emerald-400 whitespace-nowrap text-sm sm:text-base">
                              रू {(modalDrillStep === 2 && currentStep2Entries.length > 0 ? currentStep2Entries : detailModal.entries).reduce((sum, e) => sum + (Number(e.amount) || 0), 0).toLocaleString()}
                            </td>
                            <td></td>
                          </tr>
                        </tfoot>
                      )}
                    </table>
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Delete Confirmation Modal for Back Office Modal Breakdown */}
      {deleteConfirmEntry && (
        <ConfirmationModal
          isOpen={!!deleteConfirmEntry}
          title="Delete Entry"
          message={`Are you sure you want to delete '${deleteConfirmEntry.head || deleteConfirmEntry.companyName || 'this transaction'}' (${deleteConfirmEntry.type === 'in' || deleteConfirmEntry.type === RemittanceType.SEND ? 'Credit' : 'Debit'} NPR ${Number(deleteConfirmEntry.amount || 0).toLocaleString()})? This record will be permanently removed.`}
          confirmLabel={isDeleting ? "Deleting..." : "Yes, Delete"}
          cancelLabel="Cancel"
          variant="danger"
          onConfirm={executeDeleteModalEntry}
          onCancel={() => setDeleteConfirmEntry(null)}
        />
      )}
    </div>
  );
};

export default ReportsPage;

