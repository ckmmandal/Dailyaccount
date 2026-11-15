
import React, { useState, useEffect, useMemo, useCallback } from 'react';
import { 
  Landmark, X, ArrowUpCircle, ArrowDownCircle, History, Building2, 
  Banknote, ShieldCheck, ChevronDown, Printer, Receipt,
  RefreshCw, ChevronRight, ArrowLeft, CheckCircle2, Trash2,
  AlertTriangle, Loader2
} from 'lucide-react';
import { storageService } from '../services/storageService';
import { toBsDateString, normalizeBranchId } from '../services/supabaseService';
import { useAuth } from '../AuthContext';
import { NepaliDatePicker } from './NepaliDatePicker';
import { DENOMINATIONS } from '../constants';
import { VaultTransaction, DenominationEntry, DenoAdjustmentEntry, DailyData, Branch, User } from '../types';
import NepaliDate from 'nepali-date-converter';
import { isBackDateBlockedForEntry, getBackDateBlockedMessage } from '../utils/backDateControl';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

const SettlementPage: React.FC = () => {
  const { branch, user, settings } = useAuth();
  const currentBranchId = branch?.id || user?.branchId || 'main';
  const isDayEnded = useDayEndLock(currentBranchId);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [dateRange, setDateRange] = useState({
    start: new Date().toISOString().split('T')[0],
    end: new Date().toISOString().split('T')[0]
  });
  
  const [partyType, setPartyType] = useState<'Teller Desk' | 'Bank Transaction' | 'Inter Branch' | 'Other'>('Teller Desk');
  const [targetBranchId, setTargetBranchId] = useState('');
  const [txType, setTxType] = useState<'in' | 'out'>('in'); 
  const [narration, setNarration] = useState('');
  const [quantities, setQuantities] = useState<Record<number, string>>({});
  const [isSetupOpen, setIsSetupOpen] = useState(false);
  const [vaultTx, setVaultTx] = useState<VaultTransaction[]>([]);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [allBranchesList, setAllBranchesList] = useState<Branch[]>([]);
  const [toast, setToast] = useState<{ show: boolean; msg: string; type: 'success' | 'error' }>({ show: false, msg: '', type: 'success' });
  const [deletingTxId, setDeletingTxId] = useState<string | null>(null);
  const [confirmDeleteModal, setConfirmDeleteModal] = useState<{
    show: boolean;
    tx: VaultTransaction | null;
  } | null>(null);

  const [systemUsers, setSystemUsers] = useState<User[]>([]);

  useEffect(() => {
    storageService.getUsers().then(users => {
      if (users && users.length > 0) setSystemUsers(users);
    }).catch(err => console.error("Error loading users:", err));
  }, []);

  const resolveUserDisplay = (tx: VaultTransaction): { name: string; role: string } => {
    if (tx.createdByName && typeof tx.createdByName === 'string' && tx.createdByName.trim()) {
      return {
        name: tx.createdByName.trim(),
        role: tx.createdBy === user?.id ? (user?.roleId || 'Vault Manager') : 'Staff'
      };
    }
    const uid = (tx.createdBy || '').toString().trim();
    if (!uid || uid === 'sys' || uid === 'system') {
      if (user?.fullName) {
        return { name: user.fullName, role: user.roleId || 'Vault Manager' };
      }
      return { name: 'Vault Incharge', role: 'Vault Control' };
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
      return { name: user.fullName || user.username, role: user.roleId || 'Vault Manager' };
    }
    return { name: uid, role: 'Staff' };
  };

  // Modal for viewing denominations of the vault at a specific point or a specific category
  const [viewDenos, setViewDenos] = useState<{
    show: boolean;
    denos: DenominationEntry[];
    title: string;
    total: number;
    snapshotDate: string;
    isSnapshot?: boolean;
    txs?: VaultTransaction[];
  }>({ show: false, denos: [], title: '', total: 0, snapshotDate: '', isSnapshot: false, txs: [] });

  // Dedicated Inter-Branch 2-step Drilldown Modal (Step 1: Branch Summary, Step 2: Branch Denominations & Details)
  const [branchModal, setBranchModal] = useState<{
    show: boolean;
    step: 1 | 2;
    direction: 'in' | 'out';
    date: string;
    totalAmount: number;
    txs: VaultTransaction[];
    selectedBranchId: string | null;
    selectedBranchName: string | null;
  }>({
    show: false,
    step: 1,
    direction: 'in',
    date: '',
    totalAmount: 0,
    txs: [],
    selectedBranchId: null,
    selectedBranchName: null
  });

  const showToast = (msg: string, type: 'success' | 'error' = 'success') => {
    setToast({ show: true, msg, type });
    setTimeout(() => setToast(p => ({ ...p, show: false })), 3000);
  };

  const toBs = (ad: string) => {
    return toBsDateString(ad);
  };

  const loadVaultData = useCallback(async () => {
    const bId = currentBranchId;
    const allData = await storageService.getAllData(bId);
    let list: VaultTransaction[] = [];
    Object.keys(allData).forEach((d: string) => {
      const dayData = allData[d] as DailyData;
      if (dayData && dayData.vaultTransactions) {
        list = [...list, ...dayData.vaultTransactions];
      }
    });
    // Sort by date ascending to calculate correct running balances
    setVaultTx(list.sort((a,b) => a.date.localeCompare(b.date))); 
    const allBranches = await storageService.getBranches();
    setAllBranchesList(allBranches);
    setBranches(allBranches.filter(b => b.id !== bId));
  }, [currentBranchId]);

  useEffect(() => { loadVaultData(); }, [loadVaultData]);

  const getTxBranchDetails = (tx: VaultTransaction, currentBId: string) => {
    let bId = tx.counterBranchId || tx.targetBranchId;
    let bName = tx.counterBranchName;

    if (!bName && bId) {
      const found = allBranchesList.find(b => 
        b.id.toLowerCase() === bId?.toLowerCase() || 
        (b.code && b.code.toLowerCase() === bId?.toLowerCase())
      );
      if (found) bName = found.name;
    }

    if (!bName) {
      const rem = (tx.remarks || '').toLowerCase();
      for (const br of allBranchesList) {
        if (
          rem.includes(br.name.toLowerCase()) || 
          (br.code && rem.includes(br.code.toLowerCase())) || 
          rem.includes(br.id.toLowerCase())
        ) {
          bId = br.id;
          bName = br.name;
          break;
        }
      }
    }

    if (!bName) {
      const rem = (tx.remarks || '').toLowerCase();
      if (rem.includes('sahodba') || rem.includes('c02')) { bId = 'sahodba'; bName = 'Sahodba Branch'; }
      else if (rem.includes('pipra') || rem.includes('c03')) { bId = 'pipra'; bName = 'Pipra Branch'; }
      else if (rem.includes('parsa') || rem.includes('c04')) { bId = 'parsa'; bName = 'Parsa Branch'; }
      else if (rem.includes('main') || rem.includes('ratauli') || rem.includes('head office') || rem.includes('c01')) { bId = 'main'; bName = 'Ratauli Head Office'; }
    }

    if (!bName && tx.branchId && tx.branchId !== currentBId) {
      const found = allBranchesList.find(b => b.id.toLowerCase() === tx.branchId.toLowerCase());
      if (found) {
        bId = found.id;
        bName = found.name;
      }
    }

    if (!bName) {
      bId = bId || 'other_branch';
      bName = tx.type === 'in' ? 'Inter Branch (Source)' : 'Inter Branch (Destination)';
    }

    return { bId: bId || 'unknown', bName };
  };

  const aggregateDenos = (txs: VaultTransaction[] = []) => {
    const map: Record<number, number> = {};
    txs.forEach(tx => {
      (tx.denominations || []).forEach(d => {
        map[d.value] = (map[d.value] || 0) + d.quantity;
      });
    });
    return Object.entries(map)
      .filter(([_, q]) => q !== 0)
      .map(([v, q]) => ({ value: Number(v), quantity: q }))
      .sort((a, b) => b.value - a.value);
  };

  const calculateTellerStatsFromData = useCallback((allDataMap: Record<string, DailyData>, targetDateBs: string, bId: string) => {
    const stats: Record<number, number> = {};
    DENOMINATIONS.forEach(v => stats[v] = 0);
    const targetNormalized = normalizeBranchId(bId);

    Object.keys(allDataMap).forEach((d: string) => {
      if (d === 'FD_RECORDS_STORE' || d === 'OFFICE_EXPENSES_STORE' || d === 'SAVED_EXPENSE_SHEETS_STORE' || d === 'FIXED_OFFICE_EXPENSE_CONFIGS') return;
      const dayData = allDataMap[d];
      if (!dayData) return;

      const itemBranch = dayData.branchId || (d.includes('_') ? d.split('_').slice(1).join('_') : 'main');
      if (normalizeBranchId(itemBranch) !== targetNormalized) return;

      const dDate = dayData.date || d.split('_')[0] || d;
      const dBs = toBs(dDate);

      if (dBs <= targetDateBs) {
        if (dayData.denoAdjustments && Array.isArray(dayData.denoAdjustments)) {
          dayData.denoAdjustments.forEach(adj => {
            const val = Number(adj.value);
            const qty = Number(adj.quantity) || 0;
            if (val && qty) {
              const isAdd = adj.type === 'add' || (adj.type as any) === 'in';
              if (isAdd) {
                stats[val] = (stats[val] || 0) + qty;
              } else {
                stats[val] = (stats[val] || 0) - qty;
              }
            }
          });
        }
      }
    });

    const cleanStats: Record<number, number> = {};
    DENOMINATIONS.forEach(v => {
      cleanStats[v] = Math.max(0, Math.round(stats[v] || 0));
    });
    return cleanStats;
  }, []);

  const [tellerDenos, setTellerDenos] = useState<Record<number, number>>({});

  const refreshTellerDenos = useCallback(async () => {
    const bId = currentBranchId;
    const targetDateBs = toBs(date);

    // 1. Instant Synchronous calculation from Local Storage DB
    try {
      const raw = localStorage.getItem('saccos_db_daily_data');
      if (raw) {
        const localData = JSON.parse(raw);
        const localStats = calculateTellerStatsFromData(localData, targetDateBs, bId);
        setTellerDenos(localStats);
      }
    } catch (e) {}

    // 2. Asynchronous merge with full remote / storageService data
    try {
      const allData = await storageService.getAllData(bId);
      if (allData && Object.keys(allData).length > 0) {
        const fullStats = calculateTellerStatsFromData(allData, targetDateBs, bId);
        setTellerDenos(fullStats);
      }
    } catch (e) {
      console.warn("Notice fetching teller denos:", e);
    }
  }, [currentBranchId, date, calculateTellerStatsFromData]);

  useEffect(() => {
    refreshTellerDenos();

    const handleDataUpdate = () => {
      refreshTellerDenos();
      loadVaultData();
    };

    window.addEventListener('storage', handleDataUpdate);
    window.addEventListener('dailyDataUpdated', handleDataUpdate);
    window.addEventListener('vaultTransactionsUpdated', handleDataUpdate);
    return () => {
      window.removeEventListener('storage', handleDataUpdate);
      window.removeEventListener('dailyDataUpdated', handleDataUpdate);
      window.removeEventListener('vaultTransactionsUpdated', handleDataUpdate);
    };
  }, [refreshTellerDenos, loadVaultData, isSetupOpen]);

  // Current Vault Denomination Inventory (C/S Vault counts)
  const vaultDenos = useMemo<Record<number, number>>(() => {
    const stats: Record<number, number> = {};
    DENOMINATIONS.forEach(v => stats[v] = 0);
    const targetDateBs = toBs(date);

    vaultTx.forEach(tx => {
      // Calculate inventory up to selected date for withdrawal logic
      if (toBs(tx.date) <= targetDateBs) {
        tx.denominations.forEach(d => {
          if (tx.type === 'in') stats[d.value] = (stats[d.value] || 0) + d.quantity;
          else stats[d.value] = (stats[d.value] || 0) - d.quantity;
        });
      }
    });

    const cleanStats: Record<number, number> = {};
    DENOMINATIONS.forEach(v => {
      cleanStats[v] = Math.max(0, Math.round(stats[v] || 0));
    });
    return cleanStats;
  }, [date, vaultTx]);

  const vaultTotal = useMemo(() => {
    return Object.entries(vaultDenos).reduce((acc, [val, qty]) => acc + (Number(val as string) * (qty as number)), 0);
  }, [vaultDenos]);

  const setupTotal = useMemo(() => {
    return Object.entries(quantities).reduce((acc, [val, qty]) => {
      const q = parseInt((qty as string) || '0');
      return acc + (Number(val as string) * q);
    }, 0);
  }, [quantities]);

  const tellerTotal = useMemo(() => {
    return Object.entries(tellerDenos).reduce((acc, [val, qty]) => acc + (Number(val as string) * (qty as number)), 0);
  }, [tellerDenos]);

  const handlePost = async () => {
    if (!branch || setupTotal <= 0) return showToast('Please setup amounts first', 'error');
    if (isDayEndedForBranch(branch.id)) {
      return showToast(getDayEndedBlockMessage(), 'error');
    }
    if (isBackDateBlockedForEntry(date, settings)) {
      return showToast(getBackDateBlockedMessage(date), 'error');
    }
    if (partyType === 'Inter Branch' && !targetBranchId) return showToast('Please select target branch', 'error');

    const denos: DenominationEntry[] = Object.entries(quantities)
      .filter(([_, qty]) => parseInt((qty as string)) > 0)
      .map(([val, qty]) => ({ value: Number(val as string), quantity: parseInt((qty as string)) }));

    const selectedBranch = allBranchesList.find(b => b.id === targetBranchId) || branches.find(b => b.id === targetBranchId);
    
    const newTx: VaultTransaction = {
      id: crypto.randomUUID(),
      date,
      type: txType,
      source: partyType === 'Teller Desk' ? 'Teller' : partyType === 'Bank Transaction' ? 'Bank' : partyType === 'Inter Branch' ? 'Branch' : 'Manual',
      amount: setupTotal,
      denominations: denos,
      remarks: narration || `${partyType} ${txType === 'in' ? 'Deposit' : 'Withdrawal'} ${selectedBranch ? '(' + selectedBranch.name + ')' : ''}`,
      createdBy: user?.id || user?.username || 'sys',
      createdByName: user?.fullName || user?.username || 'Vault Manager',
      branchId: branch.id as string,
      targetBranchId: partyType === 'Inter Branch' ? targetBranchId : undefined,
      partyType: partyType,
      counterBranchId: partyType === 'Inter Branch' ? targetBranchId : undefined,
      counterBranchName: partyType === 'Inter Branch' ? selectedBranch?.name : undefined
    };

    const dayData: DailyData = (await storageService.getDayData(date, branch.id as string)) || {
      date, branchId: branch.id as string, denominations: [], denoAdjustments: [], transactions: [], officeTransactions: [], remittances: [], vaultTransactions: []
    };
    
    const updatedVault = [...(dayData.vaultTransactions || []), newTx];
    
    const adjustments: DenoAdjustmentEntry[] = denos.map(d => ({
      id: crypto.randomUUID(),
      value: d.value,
      quantity: d.quantity,
      type: txType === 'in' ? 'less' : 'add', 
      date: date,
      isVaultTransfer: true,
      createdBy: user?.id || user?.username || 'sys',
      createdByName: user?.fullName || user?.username || 'Vault Manager',
      createdAt: Date.now()
    }));

    const updatedDenoAdj = [...(dayData.denoAdjustments || []), ...adjustments];

    await storageService.saveDayData(date, branch.id as string, { 
      ...dayData, 
      vaultTransactions: updatedVault,
      denoAdjustments: updatedDenoAdj
    });

    if (partyType === 'Inter Branch' && targetBranchId) {
      const targetDayData = (await storageService.getDayData(date, targetBranchId)) || {
        date, branchId: targetBranchId, denominations: [], denoAdjustments: [], transactions: [], officeTransactions: [], remittances: [], vaultTransactions: []
      };

      const targetTxType = txType === 'in' ? 'out' : 'in';
      const targetTx: VaultTransaction = {
        id: crypto.randomUUID(),
        date,
        type: targetTxType,
        source: 'Branch',
        amount: setupTotal,
        denominations: denos,
        remarks: `Received ${txType === 'in' ? 'FROM' : 'TO'} ${branch.name}`,
        createdBy: user?.id || user?.username || 'sys',
        createdByName: user?.fullName || user?.username || 'Vault Manager',
        branchId: targetBranchId,
        targetBranchId: branch.id as string,
        partyType: 'Inter Branch',
        counterBranchId: branch.id as string,
        counterBranchName: branch.name
      };

      const targetAdjustments: DenoAdjustmentEntry[] = denos.map(d => ({
        id: crypto.randomUUID(),
        value: d.value,
        quantity: d.quantity,
        type: targetTxType === 'in' ? 'less' : 'add',
        date: date,
        isVaultTransfer: true,
        createdBy: user?.id || user?.username || 'sys',
        createdByName: user?.fullName || user?.username || 'Vault Manager',
        createdAt: Date.now()
      }));

      await storageService.saveDayData(date, targetBranchId, { 
        ...targetDayData, 
        vaultTransactions: [...(targetDayData.vaultTransactions || []), targetTx],
        denoAdjustments: [...(targetDayData.denoAdjustments || []), ...targetAdjustments]
      });
    }

    await storageService.saveLog(user?.id || 'sys', 'VAULT_SETTLEMENT', `${partyType} ${txType.toUpperCase()} - रू ${setupTotal}`, branch.id as string);
    
    setQuantities({});
    setNarration('');
    setTargetBranchId('');
    setIsSetupOpen(false);
    await loadVaultData();
    showToast('Vault Settlement Posted & Synced Successfully');
  };

  const logTableData = useMemo(() => {
    let runningBalance = 0;
    const cumulativeDenos: Record<number, number> = {};
    DENOMINATIONS.forEach(d => cumulativeDenos[d] = 0);

    const groupedByDate: Record<string, { dateBs: string; rawDate: string; txs: VaultTransaction[] }> = {};

    vaultTx.forEach(tx => {
      const bsKey = toBs(tx.date);
      if (!groupedByDate[bsKey]) {
        groupedByDate[bsKey] = {
          dateBs: bsKey,
          rawDate: tx.date,
          txs: []
        };
      }
      groupedByDate[bsKey].txs.push(tx);
    });

    const startBs = toBs(dateRange.start);
    const endBs = toBs(dateRange.end);

    // Collect all transaction dates plus range dates
    const dateSet = new Set<string>(Object.keys(groupedByDate));
    if (startBs) dateSet.add(startBs);
    if (endBs) dateSet.add(endBs);

    try {
      const startParts = startBs.split('-').map(Number);
      const endParts = endBs.split('-').map(Number);
      if (startParts.length === 3 && endParts.length === 3 && !startParts.some(isNaN) && !endParts.some(isNaN)) {
        const startJs = new NepaliDate(startParts[0], startParts[1] - 1, startParts[2]).toJsDate();
        const endJs = new NepaliDate(endParts[0], endParts[1] - 1, endParts[2]).toJsDate();
        let cur = new Date(startJs);
        while (cur <= endJs) {
          dateSet.add(new NepaliDate(cur).format('YYYY-MM-DD'));
          cur.setDate(cur.getDate() + 1);
        }
      }
    } catch (e) {}

    const sortedBsDates = Array.from(dateSet).sort();
    const finalRows: any[] = [];

    sortedBsDates.forEach(bsDateStr => {
      const g = groupedByDate[bsDateStr] || { dateBs: bsDateStr, rawDate: bsDateStr, txs: [] };
      const opening = runningBalance;
      
      // Opening snapshot of denos
      const obDenos = Object.entries(cumulativeDenos)
        .filter(([_, q]) => q !== 0)
        .map(([v, q]) => ({ value: Number(v), quantity: q }));

      const dayTxs = (g.txs || []) as VaultTransaction[];
      
      const tellerInTxs = dayTxs.filter(t => t.type === 'in' && t.source === 'Teller');
      const bankInTxs = dayTxs.filter(t => t.type === 'in' && t.source === 'Bank');
      const branchInTxs = dayTxs.filter(t => t.type === 'in' && t.source === 'Branch');
      const otherInTxs = dayTxs.filter(t => t.type === 'in' && t.source === 'Manual');
      
      const tellerOutTxs = dayTxs.filter(t => t.type === 'out' && t.source === 'Teller');
      const bankOutTxs = dayTxs.filter(t => t.type === 'out' && t.source === 'Bank');
      const branchOutTxs = dayTxs.filter(t => t.type === 'out' && t.source === 'Branch');
      const otherOutTxs = dayTxs.filter(t => t.type === 'out' && t.source === 'Manual');

      const dayCR = dayTxs.filter(t => t.type === 'in').reduce((s, t) => s + t.amount, 0);
      const dayDR = dayTxs.filter(t => t.type === 'out').reduce((s, t) => s + t.amount, 0);
      
      dayTxs.forEach(tx => {
        const isCR = tx.type === 'in';
        tx.denominations.forEach(d => {
          if (isCR) cumulativeDenos[d.value] = (cumulativeDenos[d.value] || 0) + d.quantity;
          else cumulativeDenos[d.value] = (cumulativeDenos[d.value] || 0) - d.quantity;
        });
      });

      runningBalance += (dayCR - dayDR);

      if (bsDateStr >= startBs && bsDateStr <= endBs) {
        finalRows.push({
          date: bsDateStr,
          opening,
          obDenos,
          tellerIn: tellerInTxs.reduce((s, t) => s + t.amount, 0),
          tellerInDenos: aggregateDenos(tellerInTxs),
          tellerInTxs,
          bankIn: bankInTxs.reduce((s, t) => s + t.amount, 0),
          bankInDenos: aggregateDenos(bankInTxs),
          bankInTxs,
          branchIn: branchInTxs.reduce((s, t) => s + t.amount, 0),
          branchInDenos: aggregateDenos(branchInTxs),
          branchInTxs,
          otherIn: otherInTxs.reduce((s, t) => s + t.amount, 0),
          otherInDenos: aggregateDenos(otherInTxs),
          otherInTxs,
          totalCR: dayCR,
          totalCRDenos: aggregateDenos(dayTxs.filter(t => t.type === 'in')),
          totalCRTxs: dayTxs.filter(t => t.type === 'in'),
          
          tellerOut: tellerOutTxs.reduce((s, t) => s + t.amount, 0),
          tellerOutDenos: aggregateDenos(tellerOutTxs),
          tellerOutTxs,
          bankOut: bankOutTxs.reduce((s, t) => s + t.amount, 0),
          bankOutDenos: aggregateDenos(bankOutTxs),
          bankOutTxs,
          branchOut: branchOutTxs.reduce((s, t) => s + t.amount, 0),
          branchOutDenos: aggregateDenos(branchOutTxs),
          branchOutTxs,
          otherOut: otherOutTxs.reduce((s, t) => s + t.amount, 0),
          otherOutDenos: aggregateDenos(otherOutTxs),
          otherOutTxs,
          totalDR: dayDR,
          totalDRDenos: aggregateDenos(dayTxs.filter(t => t.type === 'out')),
          totalDRTxs: dayTxs.filter(t => t.type === 'out'),
          
          closing: runningBalance,
          vaultSnapshot: Object.entries(cumulativeDenos)
            .filter(([_, q]) => q !== 0)
            .map(([v, q]) => ({ value: Number(v), quantity: q }))
        });
      }
    });

    return finalRows;
  }, [vaultTx, dateRange, allBranchesList, branch]);

  const loadAllFromSource = () => {
    const newQtys: Record<number, string> = {};
    let totalLoaded = 0;

    if (txType === 'out') {
      // Source is Vault
      Object.entries(vaultDenos).forEach(([val, qty]) => {
        const numQty = Number(qty);
        if (numQty > 0) {
          newQtys[Number(val)] = numQty.toString();
          totalLoaded += Number(val) * numQty;
        }
      });
      if (totalLoaded > 0) {
        showToast(`Auto-filled Vault notes: रू ${totalLoaded.toLocaleString()}`, 'success');
      } else {
        showToast('No vault notes available to fill', 'error');
      }
    } else {
      // Source is Teller Desk (or incoming counter)
      Object.entries(tellerDenos).forEach(([val, qty]) => {
        const numQty = Number(qty);
        if (numQty > 0) {
          newQtys[Number(val)] = numQty.toString();
          totalLoaded += Number(val) * numQty;
        }
      });
      if (totalLoaded > 0) {
        showToast(`Auto-filled Teller notes: रू ${totalLoaded.toLocaleString()}`, 'success');
      } else {
        showToast('No teller notes available to fill', 'error');
      }
    }
    setQuantities(newQtys);
  };

  const handleDeleteVaultTx = async (txToDelete: VaultTransaction) => {
    if (!txToDelete) return;
    if (isDayEndedForBranch(txToDelete.branchId || currentBranchId)) {
      showToast(getDayEndedBlockMessage(), 'error');
      return;
    }
    setDeletingTxId(txToDelete.id);

    try {
      const txDate = txToDelete.date;
      const txBranchId = txToDelete.branchId || currentBranchId;

      // 1. Fetch current DayData for the transaction's branch and date
      const dayData: DailyData | null = await storageService.getDayData(txDate, txBranchId);

      if (dayData) {
        // Filter out the deleted vault transaction
        const remainingVaultTxs = (dayData.vaultTransactions || []).filter(t => t.id !== txToDelete.id);

        // Revert / remove matching deno adjustments for this transaction
        let remainingDenoAdj = dayData.denoAdjustments || [];
        if (txToDelete.denominations && txToDelete.denominations.length > 0) {
          const denosToRemove = [...txToDelete.denominations];
          const expectedType = txToDelete.type === 'in' ? 'less' : 'add';

          remainingDenoAdj = remainingDenoAdj.filter(adj => {
            if (!adj.isVaultTransfer) return true;
            if (adj.type !== expectedType) return true;
            const matchIdx = denosToRemove.findIndex(d => d.value === adj.value && d.quantity === adj.quantity);
            if (matchIdx !== -1) {
              denosToRemove.splice(matchIdx, 1);
              return false; // remove this adjustment
            }
            return true;
          });
        }

        await storageService.saveDayData(txDate, txBranchId, {
          ...dayData,
          vaultTransactions: remainingVaultTxs,
          denoAdjustments: remainingDenoAdj
        });
      }

      // 2. If it was Inter Branch, also remove from the target branch
      if (txToDelete.source === 'Branch' || txToDelete.partyType === 'Inter Branch') {
        const targetBId = txToDelete.targetBranchId || txToDelete.counterBranchId;
        if (targetBId) {
          const targetDayData: DailyData | null = await storageService.getDayData(txDate, targetBId);
          if (targetDayData) {
            const targetRemainingVault = (targetDayData.vaultTransactions || []).filter(t => {
              const isMatch = t.date === txDate && t.amount === txToDelete.amount && (
                t.counterBranchId === txBranchId || 
                t.targetBranchId === txBranchId || 
                t.branchId === targetBId
              );
              return !isMatch;
            });

            let targetRemainingDenoAdj = targetDayData.denoAdjustments || [];
            if (txToDelete.denominations && txToDelete.denominations.length > 0) {
              const denosToRemove = [...txToDelete.denominations];
              const targetExpectedType = txToDelete.type === 'in' ? 'add' : 'less';
              targetRemainingDenoAdj = targetRemainingDenoAdj.filter(adj => {
                if (!adj.isVaultTransfer) return true;
                if (adj.type !== targetExpectedType) return true;
                const matchIdx = denosToRemove.findIndex(d => d.value === adj.value && d.quantity === adj.quantity);
                if (matchIdx !== -1) {
                  denosToRemove.splice(matchIdx, 1);
                  return false;
                }
                return true;
              });
            }

            await storageService.saveDayData(txDate, targetBId, {
              ...targetDayData,
              vaultTransactions: targetRemainingVault,
              denoAdjustments: targetRemainingDenoAdj
            });
          }
        }
      }

      // 3. Save audit log
      await storageService.saveLog(
        user?.id || 'sys',
        'VAULT_ENTRY_DELETED',
        `Deleted Vault Settlement: ${txToDelete.source || 'Vault'} ${txToDelete.type.toUpperCase()} - रू ${txToDelete.amount.toLocaleString()} on ${txToDelete.date}`,
        txBranchId
      );

      // 4. Trigger system updates
      window.dispatchEvent(new CustomEvent('vaultTransactionsUpdated'));
      window.dispatchEvent(new CustomEvent('dailyDataUpdated'));

      showToast(`कारोबार भौचर रू ${txToDelete.amount.toLocaleString()} सफलतापूर्वक हटाइयो`, 'success');

      // 5. Update local state
      await loadVaultData();
      await refreshTellerDenos();

      // 6. Update view modals
      if (viewDenos.show && viewDenos.txs) {
        const remainingTxs = viewDenos.txs.filter(t => t.id !== txToDelete.id);
        if (remainingTxs.length === 0) {
          setViewDenos(p => ({ ...p, show: false }));
        } else {
          const newTotal = remainingTxs.reduce((s, t) => s + t.amount, 0);
          const newDenos = aggregateDenos(remainingTxs);
          setViewDenos(p => ({
            ...p,
            txs: remainingTxs,
            total: newTotal,
            denos: newDenos
          }));
        }
      }

      if (branchModal.show && branchModal.txs) {
        const remainingBranchTxs = branchModal.txs.filter(t => t.id !== txToDelete.id);
        if (remainingBranchTxs.length === 0) {
          setBranchModal(p => ({ ...p, show: false }));
        } else {
          const newTotal = remainingBranchTxs.reduce((s, t) => s + t.amount, 0);
          setBranchModal(p => ({
            ...p,
            txs: remainingBranchTxs,
            totalAmount: newTotal
          }));
        }
      }

      setConfirmDeleteModal(null);
    } catch (err) {
      console.error("Error deleting vault transaction:", err);
      showToast('कारोबार मेटाउन असफल भयो (Failed to delete)', 'error');
    } finally {
      setDeletingTxId(null);
    }
  };

  const handleEntryClick = (
    denos: any[], 
    total: number, 
    date: string, 
    label: string, 
    txs: VaultTransaction[] = [], 
    isSnapshot = false
  ) => {
    if ((!denos || denos.length === 0) && total === 0 && txs.length === 0) return;
    setViewDenos({
      show: true,
      denos: denos || [],
      title: `${label} Breakdown`,
      total: total,
      snapshotDate: toBs(date),
      isSnapshot: isSnapshot || label.includes('Vault') || label.includes('Snapshot') || label.includes('मौज्दात'),
      txs: txs
    });
  };

  const handleBranchModalOpen = (txs: VaultTransaction[], total: number, dateStr: string, direction: 'in' | 'out') => {
    if (!txs || txs.length === 0 || total === 0) return;
    setBranchModal({
      show: true,
      step: 1,
      direction,
      date: dateStr,
      totalAmount: total,
      txs: txs,
      selectedBranchId: null,
      selectedBranchName: null
    });
  };

  // Branch summaries for Step 1
  const branchSummaries = useMemo(() => {
    if (!branchModal.show || !branchModal.txs) return [];
    const map: Record<string, {
      branchId: string;
      branchName: string;
      direction: 'in' | 'out';
      count: number;
      amount: number;
      txs: VaultTransaction[];
      denominations: DenominationEntry[];
    }> = {};

    branchModal.txs.forEach(tx => {
      const { bId, bName } = getTxBranchDetails(tx, branch?.id || '');
      if (!map[bId]) {
        map[bId] = {
          branchId: bId,
          branchName: bName,
          direction: tx.type,
          count: 0,
          amount: 0,
          txs: [],
          denominations: []
        };
      }
      map[bId].count += 1;
      map[bId].amount += tx.amount;
      map[bId].txs.push(tx);
    });

    return Object.values(map).map(item => ({
      ...item,
      denominations: aggregateDenos(item.txs)
    })).sort((a, b) => b.amount - a.amount);
  }, [branchModal, allBranchesList, branch]);

  // Selected Branch Data for Step 2
  const selectedBranchData = useMemo(() => {
    if (!branchModal.show || !branchModal.selectedBranchId) return null;
    const item = branchSummaries.find(b => b.branchId === branchModal.selectedBranchId);
    if (item) return item;
    
    const filteredTxs = branchModal.txs.filter(tx => {
      const { bId } = getTxBranchDetails(tx, branch?.id || '');
      return bId === branchModal.selectedBranchId;
    });
    return {
      branchId: branchModal.selectedBranchId,
      branchName: branchModal.selectedBranchName || 'Branch Details',
      direction: branchModal.direction,
      count: filteredTxs.length,
      amount: filteredTxs.reduce((s, t) => s + t.amount, 0),
      txs: filteredTxs,
      denominations: aggregateDenos(filteredTxs)
    };
  }, [branchModal, branchSummaries, allBranchesList, branch]);

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

  const handlePrintModal = () => {
    window.print();
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-500 w-full pb-6">
      {/* Header Form */}
      <div className="bg-white py-2.5 px-4 rounded-xl border-2 border-slate-950 shadow-sm relative z-20">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3 items-center">
          <div className="lg:col-span-3 flex items-center space-x-2.5">
            <div className="w-9 h-9 bg-slate-900 rounded-lg flex items-center justify-center text-white shadow-md">
              <Landmark size={18}/>
            </div>
            <div>
              <h1 className="text-base sm:text-lg font-black text-slate-900 tracking-tighter uppercase italic leading-none">Vault <span className="text-emerald-600">Control</span></h1>
              <p className="text-[8px] font-black text-slate-400 uppercase tracking-widest mt-0.5 italic">Settlement Center</p>
            </div>
          </div>

          <DayEndFieldset branchId={currentBranchId} className="lg:col-span-6 bg-slate-50 p-2 rounded-xl border border-slate-200 flex flex-wrap gap-2.5 items-center">
             <div className="flex-1 min-w-[150px] relative">
                <label className="text-[8px] font-black uppercase text-slate-500 block mb-0.5 ml-1">Transfer Mode / Category</label>
                <select 
                  value={`${partyType}::${txType}`} 
                  onChange={e => {
                    const [p, t] = e.target.value.split('::');
                    setPartyType(p as any);
                    setTxType(t as any);
                  }} 
                  className="w-full h-9 bg-white border border-slate-300 rounded-lg px-2.5 font-black text-[10px] sm:text-xs appearance-none outline-none focus:border-emerald-500 uppercase text-slate-900 shadow-xs"
                >
                  <option value="Teller Desk::out">↑ Vault to Teller</option>
                  <option value="Teller Desk::in">↓ Teller to Vault</option>
                  <option value="Bank Transaction::out">↑ Bank Deposit</option>
                  <option value="Bank Transaction::in">↓ Bank Withdrawal</option>
                  <option value="Inter Branch::out">↑ Inter Branch Transfer</option>
                  <option value="Inter Branch::in">↓ Inter Branch Received</option>
                  <option value="Other::in">↓ Other Inflow</option>
                  <option value="Other::out">↑ Other Outflow</option>
                </select>
                <ChevronDown size={13} className="absolute right-2.5 bottom-2.5 text-slate-400 pointer-events-none" />
             </div>
             {partyType === 'Inter Branch' && (
               <div className="flex-1 min-w-[120px] relative">
                  <label className="text-[8px] font-black uppercase text-slate-500 block mb-0.5 ml-1">Select Branch</label>
                  <select value={targetBranchId} onChange={e => setTargetBranchId(e.target.value)} className="w-full h-9 bg-white border border-emerald-400 rounded-lg px-2 font-black text-[10px] sm:text-xs appearance-none outline-none focus:border-emerald-600 uppercase text-emerald-700 shadow-xs">
                    <option value="">Select Branch...</option>
                    {branches.map(b => <option key={b.id} value={b.id}>{b.name}</option>)}
                  </select>
               </div>
             )}
             <div className="w-40">
                <label className="text-[8px] font-black uppercase text-slate-500 block mb-0.5 ml-1">Direction</label>
                <div className="flex bg-white border border-slate-300 rounded-lg p-0.5 h-9 shadow-xs">
                  <button 
                    onClick={() => setTxType('out')} 
                    className={`flex-1 rounded-md font-black text-[8px] uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer ${txType === 'out' ? 'bg-rose-600 text-white shadow-xs ring-1 ring-rose-700' : 'text-slate-500 hover:text-slate-800'}`}
                    title="Transfer Cash OUT from Vault"
                  >
                     <ArrowUpCircle size={12}/> <span>{partyType === 'Teller Desk' ? 'To Teller' : 'Outflow'}</span>
                  </button>
                  <button 
                    onClick={() => setTxType('in')} 
                    className={`flex-1 rounded-md font-black text-[8px] uppercase transition-all flex items-center justify-center space-x-1 cursor-pointer ${txType === 'in' ? 'bg-emerald-600 text-white shadow-xs ring-1 ring-emerald-700' : 'text-slate-500 hover:text-slate-800'}`}
                    title="Receive Cash IN to Vault"
                  >
                     <ArrowDownCircle size={12}/> <span>{partyType === 'Teller Desk' ? 'To Vault' : 'Inflow'}</span>
                  </button>
                </div>
             </div>
             <div className="flex-1 min-w-[110px]">
                <label className="text-[8px] font-black uppercase text-slate-500 block mb-0.5 ml-1">Settlement Date</label>
                <NepaliDatePicker value={date} onChange={setDate} disallowBackDateIfDisabled={true} disabled={isDayEnded} className="w-full" />
             </div>
          </DayEndFieldset>
          <div className="lg:col-span-3">
             <button 
               disabled={isDayEnded}
               onClick={() => setIsSetupOpen(true)} 
               className={`w-full h-11 rounded-xl font-black uppercase text-[10px] tracking-widest flex items-center justify-center space-x-2 transition-all shadow-md active:scale-95 border-b-2 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                 txType === 'out' && partyType === 'Teller Desk'
                   ? 'bg-rose-700 hover:bg-rose-600 text-white border-rose-950 shadow-rose-900/20'
                   : txType === 'in' && partyType === 'Teller Desk'
                   ? 'bg-emerald-700 hover:bg-emerald-600 text-white border-emerald-950 shadow-emerald-900/20'
                   : 'bg-slate-900 hover:bg-slate-800 text-emerald-400 border-slate-950'
               }`}
             >
                {txType === 'out' ? <ArrowUpCircle size={16} className="text-white"/> : <ArrowDownCircle size={16} className="text-white"/>}
                <span>
                  {partyType === 'Teller Desk' 
                    ? (txType === 'out' ? '↑ Vault to Teller (Deno)' : '↓ Teller to Vault (Deno)')
                    : partyType === 'Bank Transaction'
                    ? (txType === 'out' ? '↑ Bank Deposit (Deno)' : '↓ Bank Withdrawal (Deno)')
                    : partyType === 'Inter Branch'
                    ? (txType === 'out' ? '↑ Send to Branch (Deno)' : '↓ Receive Branch (Deno)')
                    : 'Setup Denominations'
                  }
                </span>
             </button>
          </div>
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-white rounded-xl border-2 border-slate-950 shadow-md overflow-hidden relative font-black">
         <div className="py-2.5 px-4 flex flex-col md:flex-row items-center justify-between gap-3 border-b-2 border-slate-950 bg-slate-950 text-white relative z-[110]">
            <div className="flex items-center space-x-2.5">
               <div className="p-1.5 bg-emerald-500 rounded-lg text-slate-950 shadow-xs"><History size={16}/></div>
               <div>
                  <h3 className="text-sm sm:text-base font-black italic tracking-tight uppercase leading-none text-white">Operational Vault <span className="text-emerald-400">Log</span></h3>
                  <p className="text-[8px] text-slate-400 font-bold uppercase tracking-wider mt-0.5">Vault Settlement Audit Ledger</p>
               </div>
            </div>

            {/* Quick Filter Presets & Date Pickers */}
            <div className="flex flex-wrap items-center gap-2">
               <div className="flex items-center bg-slate-900 p-0.5 rounded-lg border border-slate-800">
                  <button 
                    onClick={() => applyPreset('today')}
                    className={`px-2.5 py-1 rounded-md text-[10px] font-black uppercase transition-all cursor-pointer ${
                      dateRange.start === dateRange.end && dateRange.end === new Date().toISOString().split('T')[0]
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

               <div className="flex items-center space-x-1.5 bg-slate-900 p-1 rounded-lg border border-slate-800">
                  <div className="relative z-[120]">
                     <NepaliDatePicker value={dateRange.start} onChange={v => setDateRange(p => ({...p, start: v}))} label="From" />
                  </div>
                  <span className="text-slate-500 font-bold px-0.5 text-[10px] mt-3">to</span>
                  <div className="relative z-[120]">
                     <NepaliDatePicker value={dateRange.end} onChange={v => setDateRange(p => ({...p, end: v}))} label="To" />
                  </div>
               </div>
            </div>
         </div>
         <div className="overflow-x-auto">
            <table className="w-full text-xs sm:text-sm font-black border-collapse text-center italic">
               <thead>
                  <tr className="bg-slate-950 text-white uppercase tracking-wider border-b-2 border-slate-950 text-xs sm:text-sm">
                     <th rowSpan={2} className="py-2.5 px-2.5 text-left border-r border-white/10 min-w-[105px]">Date (B.S.)</th>
                     <th rowSpan={2} className="py-2.5 px-2 border-r border-white/10 bg-slate-900 text-blue-400 font-black italic">O/B Vault</th>
                     <th colSpan={5} className="py-1.5 px-2 border-r border-white/10 bg-emerald-950 text-emerald-400 font-black italic">Inflows (Credit)</th>
                     <th colSpan={5} className="py-1.5 px-2 border-r border-white/10 bg-rose-950 text-rose-400 font-black italic">Outflows (Debit)</th>
                     <th rowSpan={2} className="py-2.5 px-2 bg-slate-950 text-emerald-400 font-black italic">C/S Vault</th>
                  </tr>
                  <tr className="bg-slate-900 text-[10px] sm:text-xs text-white uppercase tracking-wider border-b border-white/10">
                    <th className="py-1 px-1.5 border-r border-white/10">Teller</th>
                    <th className="py-1 px-1.5 border-r border-white/10">Bank</th>
                    <th className="py-1 px-1.5 border-r border-white/10 bg-emerald-900/60 text-amber-300">Branch</th>
                    <th className="py-1 px-1.5 border-r border-white/10">Other</th>
                    <th className="py-1 px-1.5 border-r border-white/10 bg-emerald-950 text-emerald-300">Total In</th>
                    <th className="py-1 px-1.5 border-r border-white/10">Teller</th>
                    <th className="py-1 px-1.5 border-r border-white/10">Bank</th>
                    <th className="py-1 px-1.5 border-r border-white/10 bg-rose-900/60 text-amber-300">Branch</th>
                    <th className="py-1 px-1.5 border-r border-white/10">Other</th>
                    <th className="py-1 px-1.5 border-r border-white/10 bg-rose-950 text-rose-300">Total Out</th>
                  </tr>
               </thead>
               <tbody className="divide-y divide-slate-100 italic text-xs sm:text-sm font-black text-slate-900 bg-white">
                  {logTableData.length === 0 ? (
                    <tr><td colSpan={13} className="p-16 text-slate-300 uppercase tracking-[0.5em] font-black italic text-center text-sm">No operational records found</td></tr>
                  ) : (
                    logTableData.map((row) => (
                      <tr key={row.date} className="hover:bg-slate-50 transition-colors group">
                        <td className="py-2.5 px-2.5 text-left font-mono font-bold border-r border-slate-200 group-hover:text-emerald-600 whitespace-nowrap">{toBs(row.date)}</td>
                        
                        {/* O/B Vault - Clickable */}
                        <td 
                          onClick={() => handleEntryClick(row.obDenos, row.opening, row.date, 'O/B Vault', [], true)} 
                          className="py-2.5 px-2 border-r border-slate-100 bg-slate-50 italic text-slate-600 cursor-pointer hover:bg-slate-100 hover:text-slate-900 whitespace-nowrap"
                          title="Click to view Opening Balance Denominations"
                        >
                           रू {row.opening.toLocaleString()}
                         </td>

                        {/* Credits - Clickable */}
                        <td 
                          onClick={() => handleEntryClick(row.tellerInDenos, row.tellerIn, row.date, 'Teller In (दाखिला)', row.tellerInTxs)} 
                          className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-emerald-50 text-emerald-800 font-bold whitespace-nowrap transition-colors"
                          title="Click to view breakdown, note details & delete vouchers"
                        >
                          {row.tellerIn > 0 ? row.tellerIn.toLocaleString() : '-'}
                        </td>
                        <td 
                          onClick={() => handleEntryClick(row.bankInDenos, row.bankIn, row.date, 'Bank In (बैंक झिकेको)', row.bankInTxs)} 
                          className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-emerald-50 whitespace-nowrap"
                          title="Click to view breakdown & delete vouchers"
                        >
                          {row.bankIn > 0 ? row.bankIn.toLocaleString() : '-'}
                        </td>
                        
                        {/* Branch In - Interactive Branch & Deno Breakdown Drilldown */}
                        <td 
                          onClick={() => handleBranchModalOpen(row.branchInTxs, row.branchIn, row.date, 'in')} 
                          className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-amber-100 text-emerald-700 bg-emerald-50/40 font-bold whitespace-nowrap transition-all"
                          title="Click to view Inter-Branch Received breakdown by Branch & Denominations"
                        >
                          {row.branchIn > 0 ? row.branchIn.toLocaleString() : '-'}
                        </td>
                        
                        <td 
                          onClick={() => handleEntryClick(row.otherInDenos, row.otherIn, row.date, 'Other In (अन्य दाखिला)', row.otherInTxs)} 
                          className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-emerald-50 whitespace-nowrap"
                          title="Click to view breakdown & delete vouchers"
                        >
                          {row.otherIn > 0 ? row.otherIn.toLocaleString() : '-'}
                        </td>
                        <td 
                          onClick={() => handleEntryClick(row.totalCRDenos, row.totalCR, row.date, 'Total Credit (जम्मा दाखिला)', row.totalCRTxs)} 
                          className="py-2.5 px-2 border-r border-slate-100 bg-emerald-950 text-emerald-400 font-black italic cursor-pointer hover:bg-emerald-900 whitespace-nowrap transition-colors"
                          title="Click to view all Inflow vouchers & details"
                        >
                          रू {row.totalCR.toLocaleString()}
                        </td>
                        
                        {/* Debits - Clickable */}
                        <td 
                          onClick={() => handleEntryClick(row.tellerOutDenos, row.tellerOut, row.date, 'Teller Out (निकासा)', row.tellerOutTxs)} 
                          className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-rose-50 text-rose-800 font-bold whitespace-nowrap transition-colors"
                          title="Click to view breakdown, note details & delete vouchers"
                        >
                          {row.tellerOut > 0 ? row.tellerOut.toLocaleString() : '-'}
                        </td>
                        <td 
                          onClick={() => handleEntryClick(row.bankOutDenos, row.bankOut, row.date, 'Bank Out (बैंक दाखिला)', row.bankOutTxs)} 
                          className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-rose-50 whitespace-nowrap"
                          title="Click to view breakdown & delete vouchers"
                        >
                          {row.bankOut > 0 ? row.bankOut.toLocaleString() : '-'}
                        </td>
                        
                        {/* Branch Out - Interactive Branch & Deno Breakdown Drilldown */}
                        <td 
                          onClick={() => handleBranchModalOpen(row.branchOutTxs, row.branchOut, row.date, 'out')} 
                          className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-amber-100 text-rose-700 bg-rose-50/40 font-bold whitespace-nowrap transition-all"
                          title="Click to view Inter-Branch Transferred breakdown by Branch & Denominations"
                        >
                          {row.branchOut > 0 ? row.branchOut.toLocaleString() : '-'}
                        </td>
                        
                        <td 
                          onClick={() => handleEntryClick(row.otherOutDenos, row.otherOut, row.date, 'Other Out (अन्य निकासा)', row.otherOutTxs)} 
                          className="py-2.5 px-2 border-r border-slate-100 cursor-pointer hover:bg-rose-50 whitespace-nowrap"
                          title="Click to view breakdown & delete vouchers"
                        >
                          {row.otherOut > 0 ? row.otherOut.toLocaleString() : '-'}
                        </td>
                        <td 
                          onClick={() => handleEntryClick(row.totalDRDenos, row.totalDR, row.date, 'Total Debit (जम्मा निकासा)', row.totalDRTxs)} 
                          className="py-2.5 px-2 border-r border-slate-100 bg-rose-950 text-rose-400 font-black italic cursor-pointer hover:bg-rose-900 whitespace-nowrap transition-colors"
                          title="Click to view all Outflow vouchers & details"
                        >
                          रू {row.totalDR.toLocaleString()}
                        </td>
                        
                        {/* C/S Vault - Clickable */}
                        <td 
                          onClick={() => handleEntryClick(row.vaultSnapshot, row.closing, row.date, 'C/S Vault (अन्तिम मौज्दात)', [], true)} 
                          className="py-2.5 px-2 bg-slate-950 text-emerald-400 font-black italic cursor-pointer hover:bg-slate-900 whitespace-nowrap transition-all"
                          title="Click to view Closing Vault Denominations Snapshot"
                        >
                           रू {row.closing.toLocaleString()}
                        </td>
                      </tr>
                    ))
                  )}
               </tbody>
            </table>
         </div>
      </div>

      {/* DEDICATED INTER-BRANCH 2-STEP DRILL-DOWN MODAL */}
      {branchModal.show && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[2500] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <div className="bg-white w-full max-w-2xl max-h-[90vh] rounded-2xl shadow-2xl border-2 border-slate-950 overflow-hidden flex flex-col italic font-black animate-in zoom-in-95 duration-200">
            {/* Modal Header */}
            <div className="py-3 px-4 bg-slate-950 text-white flex items-center justify-between shrink-0 border-b border-slate-800">
              <div className="flex items-center space-x-2.5">
                {branchModal.step === 2 && (
                  <button
                    onClick={() => setBranchModal(p => ({ ...p, step: 1, selectedBranchId: null, selectedBranchName: null }))}
                    className="p-1.5 bg-slate-800 hover:bg-slate-700 text-amber-400 rounded-lg transition-colors flex items-center space-x-1 text-xs font-bold mr-1 cursor-pointer shadow-sm"
                    title="Go Back to Branch List"
                  >
                    <ArrowLeft size={16} />
                    <span className="hidden sm:inline">Back</span>
                  </button>
                )}
                <div>
                  <h2 className="text-xs sm:text-sm font-black tracking-tight italic uppercase text-emerald-400 flex items-center space-x-1.5">
                    <Building2 size={16} className="text-amber-400" />
                    <span>
                      {branchModal.direction === 'in' 
                        ? `INTER BRANCH CASH RECEIVED (INFLOW) - ${toBs(branchModal.date)}`
                        : `INTER BRANCH CASH TRANSFERRED (OUTFLOW) - ${toBs(branchModal.date)}`
                      }
                    </span>
                  </h2>
                  <div className="text-[10px] font-semibold text-slate-300 uppercase tracking-wider flex items-center flex-wrap gap-1.5 mt-0.5">
                    <button
                      onClick={() => setBranchModal(p => ({ ...p, step: 1, selectedBranchId: null, selectedBranchName: null }))}
                      className={`hover:underline cursor-pointer font-bold ${branchModal.step === 1 ? 'text-amber-400 underline' : 'text-slate-400'}`}
                    >
                      1. All Branches (शाखागत सारांश)
                    </button>
                    {branchModal.step === 2 && (
                      <>
                        <ChevronRight size={12} className="text-slate-500" />
                        <span className="text-emerald-400 font-bold">
                          2. {selectedBranchData?.branchName} (Dino & Vouchers)
                        </span>
                      </>
                    )}
                  </div>
                </div>
              </div>

              <div className="flex items-center space-x-1.5">
                <button 
                  onClick={handlePrintModal}
                  className="p-1.5 bg-slate-800 hover:bg-slate-700 text-slate-200 rounded-lg transition-colors text-xs flex items-center space-x-1"
                  title="Print Report"
                >
                  <Printer size={15} />
                  <span className="hidden sm:inline text-[10px]">Print</span>
                </button>
                <button 
                  onClick={() => setBranchModal(p => ({ ...p, show: false }))}
                  className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            {/* Modal Body */}
            <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
              {/* STEP 1: Branch Summary List */}
              {branchModal.step === 1 && (
                <div className="space-y-3">
                  <div className="flex items-center justify-between px-1">
                    <span className="text-[11px] font-black text-slate-700 uppercase tracking-wider">
                      Branch Breakdown Summary ({branchSummaries.length} Branches)
                    </span>
                    <span className="text-[10px] font-bold text-slate-500">
                      Click on any branch to view Denomination & Voucher details
                    </span>
                  </div>

                  <div className="border border-slate-200 rounded-xl overflow-hidden shadow-sm bg-white">
                    <table className="w-full text-xs font-black border-collapse text-center italic">
                      <thead>
                        <tr className="bg-slate-900 text-white text-[10px] uppercase tracking-wider border-b border-slate-800">
                          <th className="py-2.5 px-3 text-center w-12">S.N.</th>
                          <th className="py-2.5 px-3.5 text-left">Branch Name (सम्बन्धित शाखा)</th>
                          <th className="py-2.5 px-3 text-center w-28">Transfer Type</th>
                          <th className="py-2.5 px-3 text-center w-20">Trx Count</th>
                          <th className="py-2.5 px-3.5 text-right w-36">Total Amount (रकम)</th>
                          <th className="py-2.5 px-3 text-center w-36">Action</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {branchSummaries.length === 0 ? (
                          <tr>
                            <td colSpan={6} className="py-8 text-slate-400 font-bold uppercase text-center">
                              No Inter-Branch transfer records for this date
                            </td>
                          </tr>
                        ) : (
                          branchSummaries.map((bs, idx) => (
                            <tr
                              key={bs.branchId}
                              onClick={() => {
                                setBranchModal(p => ({
                                  ...p,
                                  step: 2,
                                  selectedBranchId: bs.branchId,
                                  selectedBranchName: bs.branchName
                                }));
                              }}
                              className="hover:bg-amber-50/70 cursor-pointer transition-colors group"
                              title={`Click to view ${bs.branchName} denominations and voucher details`}
                            >
                              <td className="py-3 px-3 text-center font-bold text-slate-500">{idx + 1}</td>
                              <td className="py-3 px-3.5 text-left font-black text-slate-900 uppercase group-hover:text-amber-800 flex items-center space-x-2">
                                <Building2 size={15} className="text-slate-400 group-hover:text-amber-600 shrink-0" />
                                <span>{bs.branchName}</span>
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase tracking-wider ${
                                  branchModal.direction === 'in' 
                                    ? 'bg-emerald-100 text-emerald-800' 
                                    : 'bg-rose-100 text-rose-800'
                                }`}>
                                  {branchModal.direction === 'in' ? 'Received From' : 'Sent To'}
                                </span>
                              </td>
                              <td className="py-3 px-3 text-center font-mono font-bold text-slate-700">{bs.count}</td>
                              <td className={`py-3 px-3.5 text-right font-mono font-black text-sm ${
                                branchModal.direction === 'in' ? 'text-emerald-700' : 'text-rose-700'
                              }`}>
                                रू {bs.amount.toLocaleString()}
                              </td>
                              <td className="py-3 px-3 text-center">
                                <span className="inline-flex items-center space-x-1 px-2.5 py-1 bg-amber-100 group-hover:bg-amber-500 text-amber-900 group-hover:text-white rounded-lg text-[10px] font-black uppercase tracking-wider transition-all shadow-xs">
                                  <span>Dino & Details</span>
                                  <ChevronRight size={12} />
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-950 text-white font-black text-xs uppercase shadow-xl">
                          <td colSpan={3} className="py-3 px-3 text-right border-r border-slate-800">
                            Total Inter-Branch:
                          </td>
                          <td className="py-3 px-3 text-center font-mono text-amber-400 border-r border-slate-800">
                            {branchSummaries.reduce((s, b) => s + b.count, 0)}
                          </td>
                          <td className="py-3 px-3.5 text-right font-mono text-emerald-400 text-sm border-r border-slate-800">
                            रू {branchSummaries.reduce((s, b) => s + b.amount, 0).toLocaleString()}
                          </td>
                          <td className="py-3 px-3"></td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>
                </div>
              )}

              {/* STEP 2: Selected Branch Denominations (Dino) & Voucher Log */}
              {branchModal.step === 2 && selectedBranchData && (
                <div className="space-y-4">
                  {/* Top Branch Banner */}
                  <div className="bg-slate-900 text-white p-3.5 rounded-xl flex items-center justify-between border-2 border-slate-950 shadow-md">
                    <div className="flex items-center space-x-2.5">
                      <div className="p-2 bg-emerald-500 rounded-lg text-slate-950">
                        <Building2 size={18} />
                      </div>
                      <div>
                        <h3 className="text-sm font-black uppercase text-amber-300 tracking-tight">
                          {selectedBranchData.branchName}
                        </h3>
                        <p className="text-[9px] font-bold text-slate-300 uppercase tracking-wider">
                          {branchModal.direction === 'in' ? 'Cash Received (Inflow / Credit)' : 'Cash Transferred (Outflow / Debit)'} • Date: {toBs(branchModal.date)}
                        </p>
                      </div>
                    </div>
                    <div className="text-right">
                      <span className="text-[8px] font-black uppercase text-slate-400 block tracking-widest">Total Amount</span>
                      <span className="text-base sm:text-lg font-black font-mono text-emerald-400 italic">
                        रू {selectedBranchData.amount.toLocaleString()}
                      </span>
                    </div>
                  </div>

                  {/* Section 1: Denomination Breakdown (Dino) */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-100 py-2 px-3 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-slate-900">
                        <Banknote size={14} className="text-emerald-600" />
                        <span className="text-[11px] font-black uppercase tracking-wider">
                          Denomination Breakdown (नोट विवरण - Dino)
                        </span>
                      </div>
                      <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                        Total: रू {selectedBranchData.amount.toLocaleString()}
                      </span>
                    </div>

                    <table className="w-full text-xs font-black border-collapse text-center italic">
                      <thead>
                        <tr className="bg-slate-50 text-[9px] uppercase tracking-widest border-b border-slate-200 text-slate-600">
                          <th className="py-2 px-3 text-left border-r border-slate-200">Note Value (नोट दर)</th>
                          <th className="py-2 px-3 border-r border-slate-200">No. of Notes (थान / Qty)</th>
                          <th className="py-2 px-3 text-right">Amount (रकम रू)</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                        {selectedBranchData.denominations.length === 0 ? (
                          <tr>
                            <td colSpan={3} className="py-4 text-slate-400 font-bold uppercase text-center">
                              No denomination details recorded
                            </td>
                          </tr>
                        ) : (
                          selectedBranchData.denominations.map((d, i) => (
                            <tr key={i} className="hover:bg-slate-50 transition-colors">
                              <td className="py-1.5 px-3 text-left border-r border-slate-100 font-black text-slate-900 text-sm">
                                रू {d.value}
                              </td>
                              <td className="py-1.5 px-3 border-r border-slate-100 text-blue-600 font-mono font-bold">
                                {Math.abs(d.quantity).toLocaleString()}
                              </td>
                              <td className="py-1.5 px-3 text-right font-mono font-black text-slate-950">
                                रू {(d.value * Math.abs(d.quantity)).toLocaleString()}
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                      <tfoot>
                        <tr className="bg-slate-950 text-white italic text-xs font-black uppercase">
                          <td colSpan={2} className="py-2.5 px-3 text-right border-r border-white/10">
                            Total Denominations:
                          </td>
                          <td className="py-2.5 px-3 text-right text-emerald-400 font-mono text-sm">
                            रू {selectedBranchData.amount.toLocaleString()}
                          </td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  {/* Section 2: Transaction Vouchers Log */}
                  <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                    <div className="bg-slate-100 py-2 px-3 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center space-x-2 text-slate-900">
                        <Receipt size={14} className="text-indigo-600" />
                        <span className="text-[11px] font-black uppercase tracking-wider">
                          Transaction Entries & Vouchers ({selectedBranchData.txs.length})
                        </span>
                      </div>
                    </div>

                    <div className="divide-y divide-slate-100">
                      {selectedBranchData.txs.map((tx, idx) => (
                        <div key={tx.id || idx} className="p-3 hover:bg-slate-50/80 transition-colors space-y-2">
                          <div className="flex items-center justify-between">
                            <div className="flex items-center space-x-2">
                              <span className="text-[10px] font-bold text-slate-500">#{idx + 1}</span>
                              <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                tx.type === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                              }`}>
                                {tx.type === 'in' ? 'INFLOW / CREDIT' : 'OUTFLOW / DEBIT'}
                              </span>
                              <span className="text-[10px] font-bold text-slate-600 font-mono">
                                Date: {toBs(tx.date)}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <span className={`font-mono font-black text-sm ${
                                tx.type === 'in' ? 'text-emerald-700' : 'text-rose-700'
                              }`}>
                                रू {tx.amount.toLocaleString()}
                              </span>
                              <button
                                disabled={isDayEnded}
                                onClick={() => setConfirmDeleteModal({ show: true, tx })}
                                className="p-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg transition-all flex items-center space-x-1 text-[10px] font-bold cursor-pointer border border-rose-200 hover:border-rose-600 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                title="Delete this Vault transaction"
                              >
                                <Trash2 size={13} />
                                <span className="hidden sm:inline">Delete</span>
                              </button>
                            </div>
                          </div>

                          <div className="text-[10px] font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                            <div>
                              <span className="text-slate-400 uppercase text-[8px] mr-1.5">Remarks:</span>
                              <span>{tx.remarks || 'Inter Branch Cash Transfer'}</span>
                            </div>
                            {(() => {
                              const userMeta = resolveUserDisplay(tx);
                              return (
                                <div className="flex items-center space-x-1.5 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                                  <span className="text-slate-400 uppercase text-[8px] font-black">Entered By:</span>
                                  <span className="font-extrabold text-slate-900 text-[10px] flex items-center gap-1">
                                    <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[8px] font-black">
                                      {userMeta.name.charAt(0).toUpperCase()}
                                    </span>
                                    {userMeta.name}
                                    <span className="text-[8px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded font-semibold uppercase">
                                      {userMeta.role}
                                    </span>
                                  </span>
                                </div>
                              );
                            })()}
                          </div>

                          {/* Denominations Pill Badges for this specific transaction */}
                          {tx.denominations && tx.denominations.length > 0 && (
                            <div className="flex items-center flex-wrap gap-1 pt-1">
                              <span className="text-[8px] font-bold text-slate-400 uppercase mr-1">Notes:</span>
                              {tx.denominations.filter(d => d.quantity > 0).sort((a,b) => b.value - a.value).map((d, di) => (
                                <span key={di} className="px-1.5 py-0.5 bg-slate-100 text-slate-700 border border-slate-200 rounded text-[9px] font-mono font-bold">
                                  {d.value} × {d.quantity}
                                </span>
                              ))}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>

            {/* Modal Footer */}
            <div className="py-2.5 px-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-t border-slate-800">
              <div className="text-[9px] font-bold text-slate-400">
                Ratauli SACCOS • Vault Settlement & Inter-Branch Management
              </div>
              <div className="flex items-center space-x-2">
                {branchModal.step === 2 ? (
                  <button
                    onClick={() => setBranchModal(p => ({ ...p, step: 1, selectedBranchId: null, selectedBranchName: null }))}
                    className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-[10px] font-black uppercase rounded-lg transition-all"
                  >
                    View All Branches
                  </button>
                ) : null}
                <button
                  onClick={() => setBranchModal(p => ({ ...p, show: false }))}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase rounded-lg shadow-md transition-all"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* DETAIL MODAL (General Denomination Breakdown for Teller / Bank / O/B / C/S with Delete Action) */}
      {viewDenos.show && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-md z-[2000] flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
           <div className="bg-white w-full max-w-xl max-h-[90vh] rounded-2xl shadow-2xl border-2 border-slate-950 overflow-hidden animate-in zoom-in-95 duration-300 italic font-black flex flex-col">
              {/* Header */}
              <div className="py-3 px-4 border-b border-slate-950 bg-slate-950 text-white flex items-center justify-between shrink-0 italic">
                 <div className="flex items-center space-x-2.5">
                    <div className="p-2 bg-emerald-500 rounded-lg text-slate-950 shadow-sm"><Banknote size={16}/></div>
                    <div>
                       <h3 className="text-xs sm:text-sm font-black uppercase tracking-tight text-emerald-400">{viewDenos.title}</h3>
                       <p className="text-[9px] font-bold text-slate-300 uppercase tracking-widest mt-0.5">
                         Date: {viewDenos.snapshotDate} • Total: रू {Math.abs(viewDenos.total).toLocaleString()}
                       </p>
                    </div>
                 </div>
                 <button onClick={() => setViewDenos(p => ({ ...p, show: false }))} className="p-1.5 bg-slate-800 hover:bg-rose-600 text-slate-400 hover:text-white rounded-lg transition-colors">
                   <X size={16}/>
                 </button>
              </div>

              {/* Body */}
              <div className="flex-1 overflow-y-auto p-4 space-y-4 bg-slate-50/50">
                 {/* 1. Denomination Table */}
                 <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                   <div className="bg-slate-100 py-2 px-3 border-b border-slate-200 flex items-center justify-between">
                     <span className="text-[11px] font-black uppercase text-slate-800 tracking-wider">
                       Denomination Breakdown (नोट विवरण - Dino)
                     </span>
                     <span className="text-[10px] font-mono font-bold text-emerald-700">
                       रू {Math.abs(viewDenos.total).toLocaleString()}
                     </span>
                   </div>
                   <table className="w-full text-xs font-black border-collapse text-center italic">
                      <thead>
                         <tr className="bg-slate-50 text-[9px] uppercase tracking-widest border-b border-slate-200 text-slate-600">
                            <th className="py-2 px-3 text-left border-r border-slate-200">Note Value (दर)</th>
                            <th className="py-2 px-3 border-r border-slate-200">No. of Notes (थान / Qty)</th>
                            <th className="py-2 px-3 text-right">Amount (रकम रू)</th>
                         </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100 text-[11px]">
                         {viewDenos.denos.length === 0 ? (
                            <tr><td colSpan={3} className="py-4 text-slate-400 font-bold uppercase text-center">No denomination details recorded</td></tr>
                         ) : (
                            viewDenos.denos.filter(d => d.quantity !== 0).sort((a,b) => b.value - a.value).map((d, i) => (
                              <tr key={i} className="hover:bg-slate-50 transition-colors">
                                 <td className="py-1.5 px-3 text-left border-r border-slate-100 font-black text-slate-900 text-sm">रू {d.value}</td>
                                 <td className="py-1.5 px-3 border-r border-slate-100 text-blue-600 font-mono font-bold">{Math.abs(d.quantity).toLocaleString()}</td>
                                 <td className="py-1.5 px-3 text-right font-mono font-black text-slate-950">रू {(d.value * Math.abs(d.quantity)).toLocaleString()}</td>
                              </tr>
                            ))
                         )}
                      </tbody>
                      <tfoot>
                         <tr className="bg-slate-950 text-white italic text-xs font-black uppercase shadow-xl">
                            <td colSpan={2} className="py-2.5 px-3 text-right border-r border-white/10">Total Amount:</td>
                            <td className="py-2.5 px-3 text-right text-emerald-400 text-sm font-mono font-black">रू {Math.abs(viewDenos.total).toLocaleString()}</td>
                         </tr>
                      </tfoot>
                   </table>
                 </div>

                 {/* 2. Transaction Entries & Vouchers List with Delete Action */}
                 {viewDenos.txs && viewDenos.txs.length > 0 && (
                   <div className="bg-white border border-slate-200 rounded-xl overflow-hidden shadow-sm">
                     <div className="bg-slate-100 py-2 px-3 border-b border-slate-200 flex items-center justify-between">
                       <div className="flex items-center space-x-2 text-slate-900">
                         <Receipt size={14} className="text-indigo-600" />
                         <span className="text-[11px] font-black uppercase tracking-wider">
                           Transaction Vouchers (कारोबार भौचर सूची - {viewDenos.txs.length})
                         </span>
                       </div>
                       <span className="text-[9px] font-bold text-slate-500 uppercase tracking-widest">
                         Manage / Delete Vouchers
                       </span>
                     </div>

                     <div className="divide-y divide-slate-100">
                       {viewDenos.txs.map((tx, idx) => (
                         <div key={tx.id || idx} className="p-3.5 hover:bg-slate-50/80 transition-colors space-y-2">
                           <div className="flex items-center justify-between">
                             <div className="flex items-center space-x-2">
                               <span className="text-[10px] font-bold text-slate-500">#{idx + 1}</span>
                               <span className={`px-2 py-0.5 rounded text-[9px] font-black uppercase ${
                                 tx.type === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                               }`}>
                                 {tx.type === 'in' ? 'INFLOW / CREDIT (दाखिला)' : 'OUTFLOW / DEBIT (निकासा)'}
                               </span>
                               <span className="text-[10px] font-bold text-slate-600 font-mono">
                                 {toBs(tx.date)}
                               </span>
                             </div>
                             <div className="flex items-center space-x-2.5">
                               <span className={`font-mono font-black text-sm sm:text-base ${
                                 tx.type === 'in' ? 'text-emerald-700' : 'text-rose-700'
                               }`}>
                                 रू {tx.amount.toLocaleString()}
                               </span>
                               <button
                                 onClick={() => setConfirmDeleteModal({ show: true, tx })}
                                 disabled={deletingTxId === tx.id || isDayEnded}
                                 className="px-2.5 py-1.5 bg-rose-50 hover:bg-rose-600 text-rose-600 hover:text-white rounded-lg transition-all flex items-center space-x-1 text-[10px] font-black cursor-pointer border border-rose-200 hover:border-rose-600 shadow-xs active:scale-95 shrink-0 disabled:opacity-40 disabled:cursor-not-allowed"
                                 title="Delete this transaction and revert denomination adjustments"
                               >
                                 <Trash2 size={13} />
                                 <span>Delete</span>
                               </button>
                             </div>
                           </div>

                           <div className="text-[10px] font-bold text-slate-700 bg-slate-50 p-2 rounded-lg border border-slate-100 flex items-center justify-between">
                             <div>
                               <span className="text-slate-400 uppercase text-[8px] mr-1.5">Remarks:</span>
                               <span>{tx.remarks || `${tx.source || 'Vault'} Transfer`}</span>
                             </div>
                             {(() => {
                               const userMeta = resolveUserDisplay(tx);
                               return (
                                 <div className="flex items-center space-x-1.5 bg-white px-2 py-0.5 rounded border border-slate-200 shadow-2xs">
                                   <span className="text-slate-400 uppercase text-[8px] font-black">Entered By:</span>
                                   <span className="font-extrabold text-slate-900 text-[10px] flex items-center gap-1">
                                     <span className="w-4 h-4 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center text-[8px] font-black">
                                       {userMeta.name.charAt(0).toUpperCase()}
                                     </span>
                                     {userMeta.name}
                                     <span className="text-[8px] text-slate-500 bg-slate-100 px-1 py-0.2 rounded font-semibold uppercase">
                                       {userMeta.role}
                                     </span>
                                   </span>
                                 </div>
                               );
                             })()}
                           </div>

                           {/* Denomination Notes Badges */}
                           {tx.denominations && tx.denominations.length > 0 && (
                             <div className="flex items-center flex-wrap gap-1.5 pt-1">
                               <span className="text-[8px] font-bold text-slate-400 uppercase mr-1">Notes:</span>
                               {tx.denominations.filter(d => d.quantity > 0).sort((a,b) => b.value - a.value).map((d, di) => (
                                 <span key={di} className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded text-[10px] font-mono font-bold">
                                   रू {d.value} × {d.quantity}
                                 </span>
                               ))}
                             </div>
                           )}
                         </div>
                       ))}
                     </div>
                   </div>
                 )}
              </div>

              {/* Footer */}
              <div className="py-2.5 px-4 bg-slate-900 text-white flex items-center justify-between shrink-0 border-t border-slate-800">
                <div className="text-[9px] font-bold text-slate-400">
                  Ratauli SACCOS • Operational Vault Management
                </div>
                <button
                  onClick={() => setViewDenos(p => ({ ...p, show: false }))}
                  className="px-4 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-black uppercase rounded-lg shadow-md transition-all cursor-pointer"
                >
                  Close
                </button>
              </div>
           </div>
        </div>
      )}

      {/* CONFIRM DELETE MODAL */}
      {confirmDeleteModal?.show && confirmDeleteModal.tx && (
        <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-md z-[3000] flex items-center justify-center p-3 sm:p-4 animate-in fade-in duration-150">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-2xl border-2 border-rose-600 overflow-hidden flex flex-col italic font-black animate-in zoom-in-95 duration-200">
            {/* Header */}
            <div className="py-3 px-4 bg-rose-950 text-white flex items-center justify-between shrink-0 border-b border-rose-900">
              <div className="flex items-center space-x-2">
                <div className="p-1.5 bg-rose-600 rounded-lg text-white">
                  <AlertTriangle size={16} />
                </div>
                <div>
                  <h3 className="text-xs sm:text-sm font-black uppercase text-rose-300 tracking-tight">
                    Confirm Delete Vault Entry
                  </h3>
                  <p className="text-[8.5px] font-bold text-rose-200 uppercase tracking-wider mt-0.5">
                    कारोबार भौचर रद्द / मेटाउने पुष्टि गर्नुहोस्
                  </p>
                </div>
              </div>
              <button
                onClick={() => setConfirmDeleteModal(null)}
                className="p-1.5 text-rose-300 hover:text-white rounded-lg transition-colors cursor-pointer"
              >
                <X size={16} />
              </button>
            </div>

            {/* Content */}
            <div className="p-4 space-y-3.5 bg-white text-slate-900">
              <div className="p-3 bg-rose-50 border border-rose-200 rounded-xl space-y-2">
                <div className="flex items-center justify-between border-b border-rose-100 pb-2">
                  <span className="text-[10px] uppercase font-bold text-slate-500">Transaction Amount</span>
                  <span className="text-base font-black font-mono text-rose-700">
                    रू {confirmDeleteModal.tx.amount.toLocaleString()}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-bold uppercase">Direction & Source</span>
                  <span className={`px-2 py-0.5 rounded font-black uppercase text-[9px] ${
                    confirmDeleteModal.tx.type === 'in' ? 'bg-emerald-100 text-emerald-800' : 'bg-rose-100 text-rose-800'
                  }`}>
                    {confirmDeleteModal.tx.type === 'in' ? 'INFLOW / CREDIT (दाखिला)' : 'OUTFLOW / DEBIT (निकासा)'} • {confirmDeleteModal.tx.source || 'Vault'}
                  </span>
                </div>
                <div className="flex items-center justify-between text-[10px]">
                  <span className="text-slate-500 font-bold uppercase">Date</span>
                  <span className="font-mono font-bold text-slate-700">{toBs(confirmDeleteModal.tx.date)}</span>
                </div>
                {confirmDeleteModal.tx.remarks && (
                  <div className="text-[10px] text-slate-600 bg-white p-2 rounded-lg border border-rose-100">
                    <span className="text-slate-400 uppercase text-[8px] mr-1 block">Remarks:</span>
                    {confirmDeleteModal.tx.remarks}
                  </div>
                )}
              </div>

              {/* Note details */}
              {confirmDeleteModal.tx.denominations && confirmDeleteModal.tx.denominations.length > 0 && (
                <div className="space-y-1">
                  <span className="text-[9px] font-black uppercase text-slate-500 tracking-wider block">
                    Associated Note Denominations (समावेश नोटहरू):
                  </span>
                  <div className="flex items-center flex-wrap gap-1.5">
                    {confirmDeleteModal.tx.denominations.filter(d => d.quantity > 0).sort((a,b) => b.value - a.value).map((d, di) => (
                      <span key={di} className="px-2 py-0.5 bg-slate-100 text-slate-800 border border-slate-200 rounded text-[10px] font-mono font-bold">
                        रू {d.value} × {d.quantity}
                      </span>
                    ))}
                  </div>
                </div>
              )}

              <div className="text-[10px] font-bold text-slate-600 bg-amber-50 p-2.5 rounded-xl border border-amber-200 flex items-start space-x-2">
                <AlertTriangle size={16} className="text-amber-600 shrink-0 mt-0.5" />
                <span>
                  यस कारोबारलाई मेटाउँदा भल्ट र सम्बन्धित काउन्टर/टेलरको नोट स्टक स्वतः पहिलेकै स्थितिमा पूर्ववत (Revert) समायोजन हुनेछ।
                </span>
              </div>
            </div>

            {/* Actions */}
            <div className="py-3 px-4 bg-slate-50 border-t border-slate-200 flex items-center justify-end space-x-2 shrink-0">
              <button
                type="button"
                onClick={() => setConfirmDeleteModal(null)}
                disabled={deletingTxId !== null}
                className="px-3.5 py-1.5 bg-slate-200 hover:bg-slate-300 text-slate-700 text-xs font-black uppercase rounded-lg transition-colors cursor-pointer"
              >
                रद्द (Cancel)
              </button>
              <button
                type="button"
                onClick={() => confirmDeleteModal.tx && handleDeleteVaultTx(confirmDeleteModal.tx)}
                disabled={deletingTxId !== null}
                className="px-4 py-1.5 bg-rose-600 hover:bg-rose-700 text-white text-xs font-black uppercase rounded-lg shadow-md transition-all flex items-center space-x-1.5 cursor-pointer disabled:opacity-50"
              >
                {deletingTxId === confirmDeleteModal.tx.id ? (
                  <>
                    <Loader2 size={14} className="animate-spin" />
                    <span>हटाउँदै...</span>
                  </>
                ) : (
                  <>
                    <Trash2 size={14} />
                    <span>हो, मेटाउनुहोस् (Delete)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* SETUP MODAL */}
      {isSetupOpen && (
        <div className="fixed inset-0 bg-slate-950/60 backdrop-blur-xl z-[2000] flex items-center justify-center p-3">
           <div className="bg-white w-full max-w-4xl max-h-[85vh] rounded-2xl shadow-2xl border border-slate-950 overflow-hidden animate-in zoom-in-95 duration-300 flex flex-col italic font-black">
              <div className={`py-3 px-4 border-b border-slate-950 text-white flex items-center justify-between shrink-0 ${txType === 'out' ? 'bg-rose-950' : 'bg-slate-900'}`}>
                 <div className="flex items-center space-x-3">
                    <div className={`p-2 rounded-lg shadow-md ${txType === 'out' ? 'bg-rose-600' : 'bg-emerald-600'}`}>
                      {txType === 'out' ? <ArrowUpCircle size={18}/> : <ArrowDownCircle size={18}/>}
                    </div>
                    <div>
                       <h3 className="text-sm sm:text-base font-black italic tracking-tighter uppercase flex items-center space-x-2">
                         <span>
                           {partyType === 'Teller Desk'
                             ? (txType === 'out' ? 'VAULT ➔ TELLER DESK (भल्टबाट टेलरमा रकम पठाउने)' : 'TELLER DESK ➔ VAULT (टेलरबाट भल्टमा जम्मा गर्ने)')
                             : partyType === 'Bank Transaction'
                             ? (txType === 'out' ? 'VAULT ➔ BANK (बैंकमा दाखिला / Deposit)' : 'BANK ➔ VAULT (बैंकबाट झिकेको / Withdrawal)')
                             : partyType === 'Inter Branch'
                             ? (txType === 'out' ? 'VAULT ➔ BRANCH (शाखामा पठाएको Transfer)' : 'BRANCH ➔ VAULT (शाखाबाट आएको Received)')
                             : `VAULT SETTLEMENT (${txType.toUpperCase()})`
                           }
                         </span>
                       </h3>
                       <div className="text-emerald-400 text-[8.5px] font-bold uppercase tracking-wider flex items-center space-x-2 mt-0.5">
                         <span>Date: {toBs(date)}</span>
                         <span>•</span>
                         <span className={txType === 'out' ? 'text-rose-400' : 'text-emerald-400'}>
                           Direction: {txType === 'out' ? 'Outflow (निकासा)' : 'Inflow (दाखिला)'}
                         </span>
                       </div>
                    </div>
                 </div>
                 <button onClick={() => setIsSetupOpen(false)} className="p-1.5 bg-slate-800 text-slate-400 hover:text-rose-500 rounded-lg transition-all"><X size={16}/></button>
              </div>
              <DayEndFieldset branchId={currentBranchId} className="flex-1 overflow-hidden grid grid-cols-1 lg:grid-cols-12 gap-0">
                 <div className="lg:col-span-7 p-3.5 overflow-y-auto bg-white">
                    <div className="grid grid-cols-4 px-3 text-[7px] font-black text-slate-400 uppercase tracking-widest mb-1.5 border-b border-slate-100 pb-1">
                       <div>Note (दर)</div>
                       <div className="text-center">{txType === 'out' ? 'Vault Stock' : 'Teller Stock'}</div>
                       <div className="text-center">Transfer Qty</div>
                       <div className="text-right">Total Amount</div>
                    </div>
                    <div className="space-y-1">
                      {DENOMINATIONS.map(val => {
                        const displayStock = (txType === 'out') ? vaultDenos[val] : (partyType === 'Teller Desk' ? tellerDenos[val] : 0);
                        
                        return (
                          <div key={val} className="grid grid-cols-4 items-center bg-slate-50 py-1.5 px-3 rounded-lg border border-slate-100 group shadow-xs hover:bg-slate-100/80 transition-colors">
                             <div className="font-black text-sm text-slate-900 italic tracking-tighter">रू {val}</div>
                             <div className={`text-center text-[11px] font-black italic ${displayStock >= 0 ? 'text-blue-600' : 'text-rose-600'}`}>
                                {displayStock || 0}
                             </div>
                             <div className="mx-2">
                               <input 
                                 type="number" 
                                 value={quantities[val] || ''} 
                                 onChange={e => setQuantities({...quantities, [val]: e.target.value})} 
                                 placeholder="0" 
                                 min="0"
                                 className="w-full h-7 bg-white border border-slate-300 rounded-md text-center font-black text-xs text-emerald-700 outline-none focus:border-emerald-500 focus:ring-1 focus:ring-emerald-500"
                               />
                             </div>
                             <div className="text-right font-black text-xs text-slate-900">
                               रू {(parseInt(quantities[val] || '0') * val).toLocaleString()}
                             </div>
                          </div>
                        );
                      })}
                    </div>
                 </div>
                 <div className="lg:col-span-5 p-3.5 bg-slate-50 flex flex-col space-y-3 justify-between border-l border-slate-200">
                    <div className={`${txType === 'out' ? 'bg-rose-700' : 'bg-blue-700'} text-white p-3.5 rounded-xl shadow-md border-2 border-white/20`}>
                        <div className="text-[8px] font-black uppercase tracking-widest opacity-80 flex items-center justify-between">
                           <span>{txType === 'out' ? 'Available Vault Balance (भल्ट मौज्दात)' : (partyType === 'Teller Desk' ? 'Teller Counter Balance (टेलर मौज्दात)' : 'Source Balance')}</span>
                        </div>
                        <div className="text-2xl font-black italic tracking-tighter my-1">
                           रू {txType === 'out' ? vaultTotal.toLocaleString() : (partyType === 'Teller Desk' ? tellerTotal.toLocaleString() : '0')}
                        </div>
                        <button 
                          onClick={loadAllFromSource} 
                          className="w-full py-1.5 bg-white/15 text-white border border-white/20 rounded-md font-black uppercase text-[8.5px] tracking-widest hover:bg-white/25 transition-all flex items-center justify-center space-x-1"
                        >
                          <RefreshCw size={11}/>
                          <span>Auto Fill All Available Notes</span>
                        </button>
                    </div>

                    <div className="bg-slate-950 text-white p-3.5 rounded-xl shadow-xl flex flex-col justify-between border-b-4 border-emerald-500 space-y-2.5">
                       <div>
                          <div className="text-[7.5px] font-black uppercase tracking-widest text-emerald-400 mb-0.5">
                            {txType === 'out' ? 'Total Transfer Out (निकासा रकम)' : 'Total Deposit In (जम्मा रकम)'}
                          </div>
                          <div className="text-2xl font-black italic tracking-tighter text-amber-400">
                            रू {setupTotal.toLocaleString()}
                          </div>
                          <textarea 
                            value={narration} 
                            onChange={e => setNarration(e.target.value)} 
                            placeholder={txType === 'out' && partyType === 'Teller Desk' ? "REMARKS: Cash transfer from Vault to Teller..." : "REMARKS..."} 
                            className="w-full h-14 bg-white/5 border border-white/10 rounded-lg p-2 text-[9px] font-black uppercase outline-none mt-2 resize-none text-slate-200 placeholder:text-slate-500 focus:border-emerald-500"
                          />
                       </div>
                       <button 
                         onClick={handlePost} 
                         disabled={setupTotal <= 0 || isDayEnded}
                         className={`w-full h-10 rounded-lg font-black uppercase text-[9px] tracking-widest shadow-md transition-all flex items-center justify-center space-x-2 ${
                           setupTotal > 0 && !isDayEnded
                             ? (txType === 'out' ? 'bg-rose-600 hover:bg-rose-500 text-white cursor-pointer' : 'bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer')
                             : 'bg-slate-800 text-slate-500 cursor-not-allowed'
                         }`}
                       >
                         <ShieldCheck size={16}/>
                         <span>
                           {partyType === 'Teller Desk'
                             ? (txType === 'out' ? `Confirm Transfer to Teller (रू ${setupTotal.toLocaleString()})` : `Confirm Deposit to Vault (रू ${setupTotal.toLocaleString()})`)
                             : `Establish Transfer (रू ${setupTotal.toLocaleString()})`
                           }
                         </span>
                       </button>
                    </div>
                 </div>
              </DayEndFieldset>
           </div>
        </div>
      )}

      {/* Toast Notification */}
      {toast.show && (
        <div className={`fixed bottom-10 right-10 px-8 py-5 rounded-[2rem] shadow-2xl flex items-center space-x-4 z-[3000] border-l-8 animate-in slide-in-from-right-10 duration-500 ${toast.type === 'success' ? 'bg-slate-950 border-emerald-500 text-white' : 'bg-rose-600 border-rose-950 text-white'}`}>
           <CheckCircle2 size={24} className={toast.type === 'success' ? "text-emerald-400" : "text-white"} />
           <div className="font-black italic text-sm uppercase">{toast.msg}</div>
        </div>
      )}
    </div>
  );
};

export default SettlementPage;

