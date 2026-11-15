import React, { useState, useEffect, useMemo, useRef } from 'react';
import { 
  BarChart, Bar, AreaChart, Area, LineChart, Line, ComposedChart, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer 
} from 'recharts';
import { 
  BarChart3,
  SlidersHorizontal,
  Search,
  Download,
  Printer,
  Landmark,
  BookOpen,
  Activity,
  Building2,
  ArrowUpDown,
  Layers,
  CheckCircle2,
  Check,
  ChevronDown,
  RotateCcw
} from 'lucide-react';

import { storageService } from '../services/storageService';
import { toBsDateString } from '../services/supabaseService';
import { useAuth } from '../AuthContext';
import { DailyData, LedgerAccount, RemittanceType, Branch, BranchOperationalStatus } from '../types';
import NepaliDate from 'nepali-date-converter';

type TimeframeMode = 'daily' | 'weekly' | 'monthly' | 'yearly';
type ChartType = 'bar' | 'line' | 'area' | 'combo';

export interface MetricSeriesConfig {
  key: string;
  label: string;
  color: string;
  defaultInCombo: 'bar' | 'line';
}

export const AVAILABLE_CHART_METRICS: MetricSeriesConfig[] = [
  { key: 'totalInflow', label: 'Total Inflow', color: '#059669', defaultInCombo: 'bar' },
  { key: 'totalOutflow', label: 'Total Outflow', color: '#e11d48', defaultInCombo: 'bar' },
  { key: 'netMovement', label: 'Net Movement', color: '#2563eb', defaultInCombo: 'line' },
  { key: 'depositIn', label: 'Teller Deposit', color: '#0d9488', defaultInCombo: 'bar' },
  { key: 'withdrawOut', label: 'Teller Withdraw', color: '#ea580c', defaultInCombo: 'bar' },
  { key: 'remTotal', label: 'Remittance', color: '#6366f1', defaultInCombo: 'bar' },
  { key: 'officeIncome', label: 'Office Income', color: '#0891b2', defaultInCombo: 'bar' },
  { key: 'officeExpense', label: 'Office Expense', color: '#9333ea', defaultInCombo: 'bar' },
];

const NEPALI_MONTH_NAMES_EN: Record<number, string> = {
  1: 'Baishakh',
  2: 'Jestha',
  3: 'Ashadh',
  4: 'Shrawan',
  5: 'Bhadra',
  6: 'Ashwin',
  7: 'Kartik',
  8: 'Mangshir',
  9: 'Poush',
  10: 'Magh',
  11: 'Falgun',
  12: 'Chaitra',
};

interface PeriodAggregatedData {
  key: string;
  periodLabel: string;
  subLabel?: string;
  rawDate?: string;
  depositIn: number;
  withdrawOut: number;
  officeIncome: number;
  officeExpense: number;
  remSend: number;
  remReceive: number;
  remTotal: number;
  totalInflow: number;
  totalOutflow: number;
  netMovement: number;
  txCount: number;
}

const SummaryReport: React.FC = () => {
  const { branch, user, isSuperAdmin, hasPermission } = useAuth();

  // Head Office permission check: Only Head Office users / Super Admin / Admins can toggle Consolidated data
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
  }, [user, branch, isSuperAdmin, hasPermission]);

  // Consolidated (All branches) vs Individual (Current branch) State
  const [isConsolidated, setIsConsolidated] = useState<boolean>(() => {
    try {
      const saved = localStorage.getItem('saccos_dashboard_consolidated');
      return saved === 'true';
    } catch {
      return false;
    }
  });

  const effectiveConsolidated = isHeadOfficeUser && isConsolidated;

  const handleToggleConsolidated = (val: boolean) => {
    setIsConsolidated(val);
    try {
      localStorage.setItem('saccos_dashboard_consolidated', String(val));
    } catch (e) {
      console.warn("Could not save dashboard preference", e);
    }
  };

  const [allDailyData, setAllDailyData] = useState<Record<string, DailyData>>({});
  const [ledgers, setLedgers] = useState<LedgerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [branches, setBranches] = useState<Branch[]>([]);
  const [branchStatuses, setBranchStatuses] = useState<Record<string, BranchOperationalStatus>>({});

  // Load branches and their real-time operational statuses
  useEffect(() => {
    let isMounted = true;
    const fetchBranchStatusData = async () => {
      try {
        const [bList, statuses] = await Promise.all([
          storageService.getBranches(),
          storageService.getBranchOperationalStatuses()
        ]);
        if (isMounted) {
          if (bList && bList.length > 0) {
            setBranches(bList);
          } else {
            setBranches([
              { id: 'main', name: 'Ratauli Head Office', code: 'C01', location: 'Ratauli' },
              { id: 'sahodba', name: 'Sahodba Branch', code: 'C02', location: 'Sahodba' },
              { id: 'pipra', name: 'Pipra Branch', code: 'C03', location: 'Pipra' },
              { id: 'parsa', name: 'Parsa Branch', code: 'C04', location: 'Parsa' }
            ]);
          }
          if (statuses) setBranchStatuses(statuses);
        }
      } catch (e) {
        console.warn("Could not load branch operational statuses in SummaryReport:", e);
      }
    };
    fetchBranchStatusData();
    const interval = setInterval(fetchBranchStatusData, 30000);
    return () => {
      isMounted = false;
      clearInterval(interval);
    };
  }, []);

  // Analytics Controls State
  const [timeframe, setTimeframe] = useState<TimeframeMode>('monthly');
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [selectedSeries, setSelectedSeries] = useState<string[]>(['totalInflow', 'totalOutflow', 'netMovement']);
  const [isMetricsMenuOpen, setIsMetricsMenuOpen] = useState<boolean>(false);
  const [selectedYearFilter, setSelectedYearFilter] = useState<string>('ALL');
  const [searchFilter, setSearchFilter] = useState<string>('');
  const [tableLimit, setTableLimit] = useState<number>(15);

  const metricsMenuRef = useRef<HTMLDivElement>(null);

  // Close dropdown on click outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (metricsMenuRef.current && !metricsMenuRef.current.contains(event.target as Node)) {
        setIsMetricsMenuOpen(false);
      }
    };
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const toggleMetricSeries = (key: string) => {
    setSelectedSeries(prev => {
      if (prev.includes(key)) {
        if (prev.length === 1) return prev; // Keep at least one metric active
        return prev.filter(k => k !== key);
      } else {
        return [...prev, key];
      }
    });
  };

  const selectAllMetrics = () => {
    setSelectedSeries(AVAILABLE_CHART_METRICS.map(m => m.key));
  };

  const resetDefaultMetrics = () => {
    setSelectedSeries(['totalInflow', 'totalOutflow', 'netMovement']);
  };

  const todayBs = useMemo(() => {
    try {
      return new NepaliDate().format('YYYY-MM-DD');
    } catch {
      return new Date().toISOString().split('T')[0];
    }
  }, []);

  const currentYearBs = useMemo(() => {
    try {
      return todayBs.split('-')[0] || '2083';
    } catch {
      return '2083';
    }
  }, [todayBs]);

  useEffect(() => {
    let isMounted = true;
    const fetchData = async () => {
      try {
        setLoading(true);
        if (effectiveConsolidated) {
          // Fetch consolidated data across all branches
          const [dataMap, ledgerAccs] = await Promise.all([
            storageService.getAllData('all'),
            storageService.getLedgerAccounts('all')
          ]);
          if (isMounted) {
            setAllDailyData(dataMap || {});
            setLedgers(ledgerAccs || []);
          }
        } else if (branch) {
          // Fetch individual branch data
          const [dataMap, ledgerAccs] = await Promise.all([
            storageService.getAllData(branch.id),
            storageService.getLedgerAccounts(branch.id)
          ]);
          if (isMounted) {
            setAllDailyData(dataMap || {});
            setLedgers(ledgerAccs || []);
          }
        }
      } catch (err) {
        console.warn("Notice: Dashboard data fetch fallback to local store:", err);
        if (isMounted) {
          try {
            const fallbackData = storageService.getLocalDailyData(effectiveConsolidated ? 'all' : branch?.id);
            setAllDailyData(fallbackData || {});
          } catch {
            // fallback error ignored
          }
        }
      } finally {
        if (isMounted) {
          setLoading(false);
        }
      }
    };
    fetchData();
    return () => {
      isMounted = false;
    };
  }, [branch, effectiveConsolidated]);

  // Comprehensive Calculation of Today's Specific Cash Position, Ledger Accounts, and Balances
  const computedMetrics = useMemo(() => {
    let todayDepositIn = 0;
    let todayWithdrawOut = 0;
    let todayRemSend = 0;
    let todayRemReceive = 0;
    let todayOfficeIncome = 0;
    let todayOfficeExpense = 0;

    let lifetimeDepositIn = 0;
    let lifetimeWithdrawOut = 0;
    let lifetimeOfficeIncome = 0;
    let lifetimeOfficeExpense = 0;
    let lifetimeRemSend = 0;
    let lifetimeRemReceive = 0;
    let lifetimeVaultNet = 0;

    const dailyRecords: Record<string, PeriodAggregatedData> = {};

    Object.entries(allDailyData).forEach(([dateKey, day]) => {
      const bsDate = toBsDateString(day.date || dateKey);
      const isToday = bsDate === todayBs;

      let dDeposit = 0;
      let dWithdraw = 0;
      let dIncome = 0;
      let dExpense = 0;
      let dRemSend = 0;
      let dRemReceive = 0;
      let dTxCount = 0;

      // Front teller transactions
      (day.transactions || []).forEach(tx => {
        const amt = Number(tx.amount) || 0;
        dTxCount++;
        if (tx.type === 'in') {
          dDeposit += amt;
          if (isToday) todayDepositIn += amt;
          lifetimeDepositIn += amt;
        } else {
          dWithdraw += amt;
          if (isToday) todayWithdrawOut += amt;
          lifetimeWithdrawOut += amt;
        }
      });

      // Back office transactions
      (day.officeTransactions || []).forEach(ot => {
        const amt = Number(ot.amount) || 0;
        dTxCount++;
        if (ot.type === 'in') {
          dIncome += amt;
          if (isToday) todayOfficeIncome += amt;
          lifetimeOfficeIncome += amt;
        } else {
          dExpense += amt;
          if (isToday) todayOfficeExpense += amt;
          lifetimeOfficeExpense += amt;
        }
      });

      // Remittances
      (day.remittances || []).forEach(r => {
        const amt = Number(r.amount) || 0;
        dTxCount++;
        const rType = String(r.type || '').toUpperCase();
        if (rType === 'SEND' || rType === RemittanceType.SEND.toUpperCase()) {
          dRemSend += amt;
          if (isToday) todayRemSend += amt;
          lifetimeRemSend += amt;
        } else {
          dRemReceive += amt;
          if (isToday) todayRemReceive += amt;
          lifetimeRemReceive += amt;
        }
      });

      // Vault transactions
      (day.vaultTransactions || []).forEach(vt => {
        const amt = Number(vt.amount) || 0;
        if (vt.type === 'in') lifetimeVaultNet += amt;
        else if (vt.type === 'out') lifetimeVaultNet -= amt;
      });

      const dayInflow = dDeposit + dIncome + dRemSend + dRemReceive;
      const dayOutflow = dWithdraw + dExpense;

      dailyRecords[bsDate] = {
        key: bsDate,
        periodLabel: bsDate,
        rawDate: bsDate,
        depositIn: dDeposit,
        withdrawOut: dWithdraw,
        officeIncome: dIncome,
        officeExpense: dExpense,
        remSend: dRemSend,
        remReceive: dRemReceive,
        remTotal: dRemSend + dRemReceive,
        totalInflow: dayInflow,
        totalOutflow: dayOutflow,
        netMovement: dayInflow - dayOutflow,
        txCount: dTxCount
      };
    });

    // Teller Operational Balance = All Teller Inflows - All Teller Outflows (minus Net Vault Transfers)
    const tellerBalance = (lifetimeDepositIn + lifetimeOfficeIncome + lifetimeRemSend + lifetimeRemReceive) -
                          (lifetimeWithdrawOut + lifetimeOfficeExpense + lifetimeVaultNet);

    // Calculate Day Book / Teller Ledger Closing Balance
    const sortedDates = Object.keys(allDailyData).sort();
    let dayBookRunningBalance = 0;
    sortedDates.forEach(dKey => {
      const day = allDailyData[dKey];
      let dayCredit = 0;
      let dayDebit = 0;
      (day.officeTransactions || []).forEach((tx: any) => {
        if (tx.origin === 'income_expense' || tx.origin === 'report' || tx.origin === 'back_office' || tx.origin === 'transferred') return;
        if (tx.head?.toUpperCase() === 'CASH' || tx.head?.toUpperCase() === 'CASH IN HAND') return;
        const amt = Number(tx.amount) || 0;
        if (tx.type === 'in') dayCredit += amt;
        else dayDebit += amt;
      });
      dayBookRunningBalance = dayBookRunningBalance + dayCredit - dayDebit;
    });

    // If dayBookRunningBalance from office transactions is 0, reflect teller cash position
    const dayBookClosingBalance = dayBookRunningBalance !== 0 ? dayBookRunningBalance : tellerBalance;

    // Calculate Ledger Master Payable & Receivable & Total Amount, plus list of accounts with active due/receivable
    let totalReceivable = 0;
    let totalPayable = 0;
    let totalLedgerMasterAmount = 0;
    const dueReceivableAccounts: {
      id: string;
      name: string;
      type: string;
      closingBalance: number;
      dueAmount: number;
      nature: 'Receivable' | 'Payable';
      mobile?: string;
    }[] = [];

    const allDates = Object.keys(allDailyData);

    ledgers.forEach(acc => {
      let accBalance = Number(acc.openingBalance) || 0;
      const targetNameUpper = (acc.name || '').trim().toUpperCase();
      const targetId = acc.id;
      const targetEmpId = acc.employeeId;
      const targetEmpCodeUpper = (acc.employeeCode || '').trim().toUpperCase();

      allDates.forEach(date => {
        const day = allDailyData[date];
        (day.transactions || []).forEach(tx => {
          const txDescUpper = (tx.description || '').trim().toUpperCase();
          const txRemarksUpper = (tx.remarks || '').trim().toUpperCase();
          const isMatch = (
            (tx.accountId && (tx.accountId === targetId || (targetEmpId && tx.accountId === targetEmpId))) ||
            (txDescUpper && (txDescUpper === targetNameUpper || (targetEmpCodeUpper && txDescUpper === targetEmpCodeUpper))) ||
            (txRemarksUpper && (txRemarksUpper === targetNameUpper || (targetEmpCodeUpper && txRemarksUpper === targetEmpCodeUpper)))
          );
          if (isMatch) {
            const amt = Number(tx.amount) || 0;
            if (tx.type === 'in') accBalance += amt;
            else accBalance -= amt;
          }
        });
      });

      totalLedgerMasterAmount += Math.abs(accBalance);

      let nature: 'Receivable' | 'Payable' = 'Receivable';
      if (acc.type === 'Loan' || acc.type === 'Investment') {
        if (accBalance >= 0) {
          totalReceivable += accBalance;
          nature = 'Receivable';
        } else {
          totalPayable += Math.abs(accBalance);
          nature = 'Payable';
        }
      } else if (acc.type === 'Customer' || acc.type === 'Vendor') {
        if (accBalance >= 0) {
          totalPayable += accBalance;
          nature = 'Payable';
        } else {
          totalReceivable += Math.abs(accBalance);
          nature = 'Receivable';
        }
      } else {
        if (accBalance >= 0) {
          totalPayable += accBalance;
          nature = 'Payable';
        } else {
          totalReceivable += Math.abs(accBalance);
          nature = 'Receivable';
        }
      }

      if (Math.abs(accBalance) > 0.001) {
        dueReceivableAccounts.push({
          id: acc.id,
          name: acc.name,
          type: acc.type || 'Customer',
          closingBalance: accBalance,
          dueAmount: Math.abs(accBalance),
          nature,
          mobile: acc.mobile
        });
      }
    });

    // Sort accounts by due amount descending
    dueReceivableAccounts.sort((a, b) => b.dueAmount - a.dueAmount);

    // 1. Counter Notes (Physical Notes in Front Teller Cash Drawer)
    let counterNotesBalance = 0;
    let hasDenoAdj = false;
    Object.values(allDailyData).forEach((day: any) => {
      (day.denoAdjustments || []).forEach((a: any) => {
        hasDenoAdj = true;
        const val = Number(a.value) || 0;
        const qty = Number(a.quantity) || 0;
        const amt = val * qty;
        if (a.type === 'add') counterNotesBalance += amt;
        else if (a.type === 'less') counterNotesBalance -= amt;
      });
    });

    // Fallback: If no deno adjustments exist yet, check if there are direct denominations entered
    if (!hasDenoAdj) {
      const currentDay = allDailyData[todayBs] || Object.values(allDailyData).find((d: any) => toBsDateString(d?.date) === todayBs);
      if (currentDay?.denominations && Array.isArray(currentDay.denominations)) {
        let directSum = 0;
        currentDay.denominations.forEach((d: any) => {
          directSum += (Number(d.value) || 0) * (Number(d.quantity) || 0);
        });
        counterNotesBalance = directSum;
      }
    }

    // Back Office Helpers
    const isBackOfficeOfficeEntry = (tx: any): boolean => {
      if (!tx) return false;
      if (
        tx.origin === 'income_expense' || 
        tx.origin === 'transaction' || 
        tx.origin === 'transferred' ||
        tx.origin === 'teller_counter' ||
        tx.origin === 'counter' ||
        tx.origin === 'teller'
      ) return false;
      if (tx.origin === 'report' || tx.origin === 'back_office') return true;
      
      const head = (tx.head || '').trim().toLowerCase();
      const tellerHeads = ['saving', 'share', 'loan', 'interest', 'entry fee', 'branch transfer', 'ibt', 'expense', 'expenses', 'remittance', 'bank'];
      if (tellerHeads.some(th => head === th || head.startsWith(th))) return false;
      if (head.includes('photocopy') || head.includes('kitchen')) return false;
      
      return false;
    };

    const isBackOfficeRemit = (r: any) => {
      return r.origin === 'report' || r.origin === 'transferred' || r.transferredToBackOffice === true;
    };

    // Income & Expense Helper
    const isIncomeExpenseEntry = (t: any): boolean => {
      if (!t) return false;
      if (t.origin === 'income_expense') return true;
      if (t.origin === 'transaction' || t.origin === 'transferred') return false;
      
      const head = (t.head || '').trim().toLowerCase();
      const tellerHeads = ['saving', 'share', 'loan', 'interest', 'entry fee'];
      if (tellerHeads.some(th => head === th || head.startsWith(th))) return false;
      
      if (head.includes('photocopy') || head.includes('kitchen')) return true;
      return false;
    };

    // Calculate Back Office Inflows & Outflows for Closing Balance
    let backOfficeReceived = 0;
    let backOfficePayment = 0;

    // Calculate Income & Expense Inflows & Outflows for Closing Balance
    let incomeExpenseTotalIn = 0;
    let incomeExpenseTotalOut = 0;

    Object.values(allDailyData).forEach((day: any) => {
      (day.officeTransactions || []).forEach((t: any) => {
        const amt = Number(t.amount) || 0;
        if (isBackOfficeOfficeEntry(t)) {
          if (t.type === 'in') backOfficeReceived += amt;
          else backOfficePayment += amt;
        }
        if (isIncomeExpenseEntry(t)) {
          if (t.type === 'in') incomeExpenseTotalIn += amt;
          else incomeExpenseTotalOut += amt;
        }
      });
      (day.remittances || []).forEach((r: any) => {
        if (isBackOfficeRemit(r)) {
          const amt = Number(r.amount) || 0;
          const rType = String(r.type || '').toUpperCase();
          if (rType === 'SEND' || rType === RemittanceType.SEND.toUpperCase() || r.type === 'in') {
            backOfficeReceived += amt;
          } else {
            backOfficePayment += amt;
          }
        }
      });
    });

    const backOfficeClosingBalance = backOfficeReceived - backOfficePayment;
    const incomeExpenseClosingBalance = incomeExpenseTotalIn - incomeExpenseTotalOut;

    // Back Office Total Transactions / Operations
    const backOfficeTotal = lifetimeOfficeIncome + lifetimeOfficeExpense;
    const netIncomeExpense = lifetimeOfficeIncome - lifetimeOfficeExpense;

    return {
      today: {
        tellerBalance: tellerBalance,
        counterNotesBalance: counterNotesBalance,
        depositIn: todayDepositIn,
        withdrawOut: todayWithdrawOut,
        remSend: todayRemSend,
        remReceive: todayRemReceive,
        remTotal: todayRemSend + todayRemReceive,
        officeIncome: todayOfficeIncome,
        officeExpense: todayOfficeExpense,
      },
      cumulative: {
        officeIncome: lifetimeOfficeIncome,
        officeExpense: lifetimeOfficeExpense,
        receivable: totalReceivable,
        payable: totalPayable,
        vault: lifetimeVaultNet,
        tellerBalance: tellerBalance
      },
      dayBookClosingBalance,
      counterNotesBalance: counterNotesBalance,
      backOfficeClosingBalance,
      incomeExpenseClosingBalance,
      totalLedgerMasterAmount: totalLedgerMasterAmount || (totalReceivable + totalPayable),
      dueReceivableAccounts,
      backOfficeTotal,
      netIncomeExpense,
      dailyRecords
    };
  }, [allDailyData, ledgers, todayBs]);

  // Available Years for Filtering
  const availableYears = useMemo(() => {
    const years = new Set<string>();
    Object.keys(computedMetrics.dailyRecords).forEach(dateStr => {
      const parts = dateStr.split('-');
      if (parts[0] && parts[0].length === 4) {
        years.add(parts[0]);
      }
    });
    if (years.size === 0) years.add(currentYearBs);
    return Array.from(years).sort().reverse();
  }, [computedMetrics.dailyRecords, currentYearBs]);

  // Aggregated Analysis based on Timeframe Selection (Daily, Weekly, Monthly, Yearly)
  const aggregatedAnalysisData = useMemo(() => {
    const dailyList = Object.values(computedMetrics.dailyRecords).sort((a, b) => (a.rawDate || '').localeCompare(b.rawDate || ''));

    if (timeframe === 'daily') {
      let filtered = dailyList;
      if (selectedYearFilter !== 'ALL') {
        filtered = filtered.filter(d => (d.rawDate || '').startsWith(selectedYearFilter));
      }
      return filtered.map(d => {
        const parts = (d.rawDate || '').split('-');
        const monthNum = parseInt(parts[1] || '1', 10);
        const mInfo = NEPALI_MONTH_NAMES_EN[monthNum] || `M${monthNum}`;
        return {
          ...d,
          periodLabel: d.rawDate || '',
          subLabel: `${parts[2] || ''} ${mInfo}`
        };
      });
    }

    if (timeframe === 'weekly') {
      const weekBuckets: Record<string, PeriodAggregatedData> = {};
      dailyList.forEach(d => {
        const parts = (d.rawDate || '').split('-');
        const y = parts[0] || '2083';
        const m = parseInt(parts[1] || '1', 10);
        const dayNum = parseInt(parts[2] || '1', 10);
        const weekNum = Math.min(5, Math.ceil(dayNum / 7));
        
        if (selectedYearFilter !== 'ALL' && y !== selectedYearFilter) return;

        const mInfo = NEPALI_MONTH_NAMES_EN[m] || `Month ${m}`;
        const weekKey = `${y}-M${String(m).padStart(2, '0')}-W${weekNum}`;
        const weekDisplay = `${mInfo} W${weekNum} (${y})`;

        if (!weekBuckets[weekKey]) {
          weekBuckets[weekKey] = {
            key: weekKey,
            periodLabel: weekDisplay,
            subLabel: `${y} ${mInfo} Week ${weekNum}`,
            rawDate: `${y}-${String(m).padStart(2, '0')}`,
            depositIn: 0,
            withdrawOut: 0,
            officeIncome: 0,
            officeExpense: 0,
            remSend: 0,
            remReceive: 0,
            remTotal: 0,
            totalInflow: 0,
            totalOutflow: 0,
            netMovement: 0,
            txCount: 0
          };
        }

        const bucket = weekBuckets[weekKey];
        bucket.depositIn += d.depositIn;
        bucket.withdrawOut += d.withdrawOut;
        bucket.officeIncome += d.officeIncome;
        bucket.officeExpense += d.officeExpense;
        bucket.remSend += d.remSend;
        bucket.remReceive += d.remReceive;
        bucket.remTotal += d.remTotal;
        bucket.totalInflow += d.totalInflow;
        bucket.totalOutflow += d.totalOutflow;
        bucket.netMovement += d.netMovement;
        bucket.txCount += d.txCount;
      });

      return Object.values(weekBuckets);
    }

    if (timeframe === 'monthly') {
      const monthBuckets: Record<string, PeriodAggregatedData> = {};
      const targetYear = selectedYearFilter !== 'ALL' ? selectedYearFilter : currentYearBs;

      // Initialize all 12 BS months for complete calendar visualization
      for (let m = 1; m <= 12; m++) {
        const mKey = `${targetYear}-${String(m).padStart(2, '0')}`;
        const mInfo = NEPALI_MONTH_NAMES_EN[m] || `Month ${m}`;
        monthBuckets[mKey] = {
          key: mKey,
          periodLabel: mInfo,
          subLabel: `${targetYear} ${mInfo}`,
          rawDate: mKey,
          depositIn: 0,
          withdrawOut: 0,
          officeIncome: 0,
          officeExpense: 0,
          remSend: 0,
          remReceive: 0,
          remTotal: 0,
          totalInflow: 0,
          totalOutflow: 0,
          netMovement: 0,
          txCount: 0
        };
      }

      dailyList.forEach(d => {
        const parts = (d.rawDate || '').split('-');
        const y = parts[0] || '2083';
        const m = parseInt(parts[1] || '1', 10);
        
        if (selectedYearFilter !== 'ALL' && y !== selectedYearFilter) return;

        const mKey = `${y}-${String(m).padStart(2, '0')}`;
        if (!monthBuckets[mKey]) {
          const mInfo = NEPALI_MONTH_NAMES_EN[m] || `Month ${m}`;
          monthBuckets[mKey] = {
            key: mKey,
            periodLabel: mInfo,
            subLabel: `${y} ${mInfo}`,
            rawDate: mKey,
            depositIn: 0,
            withdrawOut: 0,
            officeIncome: 0,
            officeExpense: 0,
            remSend: 0,
            remReceive: 0,
            remTotal: 0,
            totalInflow: 0,
            totalOutflow: 0,
            netMovement: 0,
            txCount: 0
          };
        }

        const bucket = monthBuckets[mKey];
        bucket.depositIn += d.depositIn;
        bucket.withdrawOut += d.withdrawOut;
        bucket.officeIncome += d.officeIncome;
        bucket.officeExpense += d.officeExpense;
        bucket.remSend += d.remSend;
        bucket.remReceive += d.remReceive;
        bucket.remTotal += d.remTotal;
        bucket.totalInflow += d.totalInflow;
        bucket.totalOutflow += d.totalOutflow;
        bucket.netMovement += d.netMovement;
        bucket.txCount += d.txCount;
      });

      return Object.values(monthBuckets);
    }

    if (timeframe === 'yearly') {
      const yearBuckets: Record<string, PeriodAggregatedData> = {};
      dailyList.forEach(d => {
        const parts = (d.rawDate || '').split('-');
        const y = parts[0] || '2083';
        const m = parseInt(parts[1] || '1', 10);
        
        // Nepalese Fiscal Year classification (starts in Shrawan / Month 4)
        const fyLabel = m >= 4 ? `FY ${y}/${String(Number(y) + 1).slice(-2)}` : `FY ${Number(y) - 1}/${String(y).slice(-2)}`;
        const yearKey = fyLabel;

        if (!yearBuckets[yearKey]) {
          yearBuckets[yearKey] = {
            key: yearKey,
            periodLabel: fyLabel,
            subLabel: `Fiscal Year ${fyLabel.replace('FY ', '')}`,
            rawDate: y,
            depositIn: 0,
            withdrawOut: 0,
            officeIncome: 0,
            officeExpense: 0,
            remSend: 0,
            remReceive: 0,
            remTotal: 0,
            totalInflow: 0,
            totalOutflow: 0,
            netMovement: 0,
            txCount: 0
          };
        }

        const bucket = yearBuckets[yearKey];
        bucket.depositIn += d.depositIn;
        bucket.withdrawOut += d.withdrawOut;
        bucket.officeIncome += d.officeIncome;
        bucket.officeExpense += d.officeExpense;
        bucket.remSend += d.remSend;
        bucket.remReceive += d.remReceive;
        bucket.remTotal += d.remTotal;
        bucket.totalInflow += d.totalInflow;
        bucket.totalOutflow += d.totalOutflow;
        bucket.netMovement += d.netMovement;
        bucket.txCount += d.txCount;
      });

      return Object.values(yearBuckets);
    }

    return [];
  }, [computedMetrics.dailyRecords, timeframe, selectedYearFilter, currentYearBs]);

  // Filtered Table Rows with Search
  const filteredTableData = useMemo(() => {
    let result = [...aggregatedAnalysisData];
    if (searchFilter.trim()) {
      const query = searchFilter.toLowerCase();
      result = result.filter(r => 
        r.periodLabel.toLowerCase().includes(query) || 
        (r.subLabel && r.subLabel.toLowerCase().includes(query)) ||
        (r.rawDate && r.rawDate.toLowerCase().includes(query))
      );
    }
    return result;
  }, [aggregatedAnalysisData, searchFilter]);

  // Total summary of current aggregated table
  const tableGrandTotals = useMemo(() => {
    return filteredTableData.reduce((acc, row) => ({
      depositIn: acc.depositIn + row.depositIn,
      withdrawOut: acc.withdrawOut + row.withdrawOut,
      officeIncome: acc.officeIncome + row.officeIncome,
      officeExpense: acc.officeExpense + row.officeExpense,
      remTotal: acc.remTotal + row.remTotal,
      totalInflow: acc.totalInflow + row.totalInflow,
      totalOutflow: acc.totalOutflow + row.totalOutflow,
      netMovement: acc.netMovement + row.netMovement,
      txCount: acc.txCount + row.txCount
    }), {
      depositIn: 0,
      withdrawOut: 0,
      officeIncome: 0,
      officeExpense: 0,
      remTotal: 0,
      totalInflow: 0,
      totalOutflow: 0,
      netMovement: 0,
      txCount: 0
    });
  }, [filteredTableData]);

  // Export CSV
  const handleExportCSV = () => {
    if (filteredTableData.length === 0) return;
    const headers = ["Period", "Deposit In (NPR)", "Withdraw Out (NPR)", "Office Income (NPR)", "Office Expense (NPR)", "Remittance Total (NPR)", "Total Inflow (NPR)", "Total Outflow (NPR)", "Net Movement (NPR)"];
    const rows = filteredTableData.map(r => [
      `"${r.periodLabel}"`,
      r.depositIn,
      r.withdrawOut,
      r.officeIncome,
      r.officeExpense,
      r.remTotal,
      r.totalInflow,
      r.totalOutflow,
      r.netMovement
    ]);
    const csvContent = "data:text/csv;charset=utf-8," + [headers.join(','), ...rows.map(e => e.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement("a");
    link.setAttribute("href", encodedUri);
    link.setAttribute("download", `Financial_Analytics_${timeframe}_${selectedYearFilter}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center p-20 min-h-[400px]">
        <div className="w-10 h-10 border-4 border-emerald-600 border-t-transparent rounded-full animate-spin"></div>
        <p className="mt-3 text-xs font-bold text-slate-500 uppercase tracking-widest">Loading Dashboard...</p>
      </div>
    );
  }

  return (
    <div className="space-y-6 animate-in fade-in duration-300 pb-12 font-sans">
      
      {/* Top Header */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-2 border-b border-slate-200/80">
        <div>
          <h1 className="text-2xl md:text-3xl font-black text-slate-900 tracking-tight">
            Financial <span className="text-[#133824] italic font-serif font-normal">Dashboard</span>
          </h1>
        </div>

        {/* Right side: Multi-branch Live Status Indicators (with symbolic colors) & Consolidated Toggle */}
        <div className="flex items-center gap-2.5 flex-wrap justify-end">
          {/* Branch status chips with symbolic colors (Live / Open / End / Closed / Holiday / Closing) */}
          <div className="flex items-center gap-1.5 bg-slate-50 border border-slate-200/90 p-1.5 rounded-2xl shadow-2xs overflow-x-auto max-w-full">
            {branches.map(b => {
              const status = branchStatuses[b.id] || 'OPEN';
              const cleanName = b.name.replace(/Branch|Office/gi, '').trim() || b.name;

              const isLive = status === 'LIVE';
              const isOpen = status === 'OPEN';
              const isEnd = status === 'END' || status === 'CLOSED';
              const isHoliday = status === 'HOLIDAY';

              return (
                <div 
                  key={b.id}
                  title={`${b.name}: ${status} today`}
                  className={`flex items-center gap-1.5 px-2.5 py-1 rounded-xl text-xs font-bold transition-all border ${
                    isLive 
                      ? 'bg-emerald-500/15 text-emerald-800 border-emerald-400/60 shadow-2xs' 
                      : isOpen
                      ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                      : isEnd
                      ? 'bg-rose-50 text-rose-700 border-rose-200'
                      : isHoliday
                      ? 'bg-indigo-50 text-indigo-700 border-indigo-200'
                      : 'bg-amber-50 text-amber-700 border-amber-200'
                  }`}
                >
                  {/* Status Dot Symbol */}
                  <span className={`w-2 h-2 rounded-full shrink-0 ${
                    isLive 
                      ? 'bg-emerald-500 animate-pulse' 
                      : isOpen 
                      ? 'bg-emerald-500' 
                      : isEnd 
                      ? 'bg-rose-500' 
                      : isHoliday 
                      ? 'bg-indigo-500' 
                      : 'bg-amber-500'
                  }`} />

                  {/* Branch Name */}
                  <span className="text-slate-800 font-extrabold tracking-tight whitespace-nowrap">{cleanName}</span>
                </div>
              );
            })}
          </div>

          {/* Head Office Only: Consolidated vs Individual Data Toggle Switch */}
          {isHeadOfficeUser && (
            <div className="flex items-center shrink-0">
              {/* ON / OFF Toggle Switch */}
              <button
                type="button"
                onClick={() => handleToggleConsolidated(!isConsolidated)}
                className={`relative inline-flex h-7 w-14 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-hidden ${
                  isConsolidated ? 'bg-emerald-600 shadow-sm shadow-emerald-600/30' : 'bg-slate-300'
                }`}
                role="switch"
                aria-checked={isConsolidated}
                title={isConsolidated ? "Consolidated Data (All Branches): Click to switch to Individual Branch Data" : "Individual Branch Data: Click to switch to Consolidated Data"}
              >
                <span className="sr-only">Toggle Consolidated Data</span>
                <span
                  className={`pointer-events-none inline-block h-6 w-6 transform rounded-full bg-white shadow-md ring-0 transition duration-200 ease-in-out flex items-center justify-center text-[9px] font-black ${
                    isConsolidated ? 'translate-x-7 text-emerald-700' : 'translate-x-0 text-slate-500'
                  }`}
                >
                  {isConsolidated ? 'ON' : 'OFF'}
                </span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* 1. Side-by-Side Dual Cards: Today's Cash Position & Receivable & Payable */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        
        {/* Left Table Card: Today's Cash Position */}
        <div className="bg-white rounded-2xl border-2 border-[#133824]/20 shadow-xs overflow-hidden flex flex-col">
          {/* Table Header Banner */}
          <div className="bg-[#0d2a1d] px-5 py-3.5 flex items-center justify-between text-white border-b-2 border-[#133824]">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-emerald-400 inline-block"></span>
              <h2 className="text-sm font-black uppercase tracking-wider text-emerald-100">Today's Cash Position</h2>
            </div>
            <div className="text-[11px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-700/50">
              AMOUNT (NPR)
            </div>
          </div>

          {/* Table Content with Distinct Grid Lines & Zebra Styling */}
          <div className="flex-1 flex flex-col justify-between">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-emerald-50/60 text-slate-700 font-black text-[11px] border-b border-emerald-100">
                  <th className="py-2.5 px-5 border-r border-slate-200/80">Particulars / Account</th>
                  <th className="py-2.5 px-5 text-right">Balance / Flow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-200">
                <tr className="hover:bg-emerald-50/40 transition-colors bg-white">
                  <td className="py-3 px-5 font-bold text-slate-800 text-sm border-r border-slate-200/80">
                    Teller Balance
                  </td>
                  <td className="py-3 px-5 text-right font-black text-slate-900 font-mono text-sm whitespace-nowrap bg-slate-50/40">
                    Rs. {computedMetrics.counterNotesBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="hover:bg-emerald-50/40 transition-colors bg-slate-50/30">
                  <td className="py-3 px-5 font-bold text-slate-800 text-sm border-r border-slate-200/80">
                    Teller Cash Deposit
                  </td>
                  <td className="py-3 px-5 text-right font-black text-emerald-700 font-mono text-sm whitespace-nowrap bg-emerald-50/20">
                    Rs. {computedMetrics.today.depositIn.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="hover:bg-emerald-50/40 transition-colors bg-white">
                  <td className="py-3 px-5 font-bold text-slate-800 text-sm border-r border-slate-200/80">
                    Teller Cash Withdraw
                  </td>
                  <td className="py-3 px-5 text-right font-black text-rose-700 font-mono text-sm whitespace-nowrap bg-rose-50/20">
                    Rs. {computedMetrics.today.withdrawOut.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                </tr>
                <tr className="hover:bg-emerald-50/40 transition-colors bg-slate-50/30">
                  <td className="py-3 px-5 font-bold text-slate-800 text-sm border-r border-slate-200/80">
                    Total Remittance
                  </td>
                  <td className="py-3 px-5 text-right font-black text-blue-700 font-mono text-sm whitespace-nowrap bg-blue-50/20">
                    Rs. {computedMetrics.today.remTotal.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                  </td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Table Card: Receivable & Payable */}
        <div className="bg-white rounded-2xl border-2 border-[#133824]/20 shadow-xs overflow-hidden flex flex-col">
          {/* Table Header Banner */}
          <div className="bg-[#0d2a1d] px-5 py-3.5 flex items-center justify-between text-white border-b-2 border-[#133824]">
            <div className="flex items-center space-x-2">
              <span className="w-2.5 h-2.5 rounded-full bg-rose-400 inline-block"></span>
              <h2 className="text-sm font-black uppercase tracking-wider text-emerald-100">Receivable & Payable</h2>
            </div>
            <div className="text-[11px] font-black uppercase tracking-widest text-emerald-300 bg-emerald-950/80 px-2.5 py-0.5 rounded border border-emerald-700/50">
              AMOUNT (NPR)
            </div>
          </div>

          {/* Table Content (Scrollable if many accounts) */}
          <div className="flex-1 min-h-[190px] max-h-[220px] overflow-y-auto">
            {computedMetrics.dueReceivableAccounts.length === 0 ? (
              <div className="h-full py-12 px-4 flex flex-col items-center justify-center text-center text-slate-400 space-y-1.5">
                <CheckCircle2 size={24} className="text-emerald-600 mb-1" />
                <p className="text-xs font-black text-slate-800 uppercase tracking-wider">No Outstanding Dues or Receivables</p>
                <p className="text-[11px] text-slate-400 font-medium">All accounts are currently cleared (Rs. 0).</p>
              </div>
            ) : (
              <table className="w-full text-left text-xs border-collapse">
                <thead>
                  <tr className="bg-emerald-50/60 text-slate-700 font-black text-[11px] border-b border-emerald-100">
                    <th className="py-2.5 px-5 border-r border-slate-200/80">Account / Customer Name</th>
                    <th className="py-2.5 px-5 text-right">Outstanding Amount</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200">
                  {computedMetrics.dueReceivableAccounts.map((acc, index) => (
                    <tr 
                      key={acc.id} 
                      className={`hover:bg-rose-50/40 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-slate-50/30'}`}
                    >
                      <td className="py-3 px-5 font-bold text-slate-900 text-sm tracking-tight border-r border-slate-200/80">
                        {acc.name}
                      </td>
                      <td className="py-3 px-5 text-right font-black text-rose-700 font-mono text-sm whitespace-nowrap bg-rose-50/20">
                        Rs. {acc.dueAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>

      </div>

      {/* 2. Compact 5-Item Operational Status Row (Day book, Vault, Back Office, Income/Exp, Ledger) */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3.5">
        
        {/* Item 1: Day Book */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-600/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Day Book</span>
            <div className="w-7 h-7 rounded-lg bg-emerald-50 text-emerald-800 flex items-center justify-center">
              <BookOpen size={14} />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 font-mono tracking-tight">
              Rs. {computedMetrics.dayBookClosingBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Item 2: Vault */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-600/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Vault</span>
            <div className="w-7 h-7 rounded-lg bg-blue-50 text-blue-800 flex items-center justify-center">
              <Landmark size={14} />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 font-mono tracking-tight">
              Rs. {computedMetrics.cumulative.vault.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Item 3: Back Office */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-600/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Back Office</span>
            <div className="w-7 h-7 rounded-lg bg-amber-50 text-amber-800 flex items-center justify-center">
              <Building2 size={14} />
            </div>
          </div>
          <div>
            <div className={`text-lg font-black font-mono tracking-tight ${computedMetrics.backOfficeClosingBalance >= 0 ? 'text-slate-900' : 'text-rose-700'}`}>
              Rs. {computedMetrics.backOfficeClosingBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Item 4: Income/Exp */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-600/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Income / Exp</span>
            <div className="w-7 h-7 rounded-lg bg-indigo-50 text-indigo-800 flex items-center justify-center">
              <ArrowUpDown size={14} />
            </div>
          </div>
          <div>
            <div className={`text-lg font-black font-mono tracking-tight ${computedMetrics.incomeExpenseClosingBalance >= 0 ? 'text-emerald-800' : 'text-rose-800'}`}>
              Rs. {computedMetrics.incomeExpenseClosingBalance.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

        {/* Item 5: Ledger */}
        <div className="bg-white p-4 rounded-2xl border border-slate-200/90 shadow-xs hover:border-emerald-600/40 transition-all flex flex-col justify-between">
          <div className="flex items-center justify-between mb-2">
            <span className="text-[10px] font-black uppercase tracking-wider text-slate-500">Ledger</span>
            <div className="w-7 h-7 rounded-lg bg-violet-50 text-violet-800 flex items-center justify-center">
              <Layers size={14} />
            </div>
          </div>
          <div>
            <div className="text-lg font-black text-slate-900 font-mono tracking-tight">
              Rs. {computedMetrics.totalLedgerMasterAmount.toLocaleString(undefined, { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
            </div>
          </div>
        </div>

      </div>

      {/* 3. Multi-Timeframe Financial Intelligence & Interactive Analytics Hub (All English) */}
      <div className="bg-white rounded-2xl border border-slate-200/90 shadow-xs p-6 space-y-6">
        
        {/* Hub Header & Navigation Toolbar */}
        <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4 pb-4 border-b border-slate-100">
          <div>
            <div className="flex items-center space-x-2">
              <div className="w-8 h-8 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center font-black">
                <BarChart3 size={18} />
              </div>
              <div>
                <h3 className="text-base font-black text-slate-900 tracking-tight">
                  Financial Analytics & Trend Analysis
                </h3>
              </div>
            </div>
          </div>

          {/* Timeframe Selector Buttons (Daily, Weekly, Monthly, Yearly) */}
          <div className="flex flex-wrap items-center gap-2">
            <div className="bg-slate-100 p-1 rounded-xl flex items-center space-x-1 border border-slate-200/80">
              <button
                onClick={() => setTimeframe('daily')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  timeframe === 'daily' 
                    ? 'bg-[#133824] text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Daily
              </button>
              <button
                onClick={() => setTimeframe('weekly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  timeframe === 'weekly' 
                    ? 'bg-[#133824] text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Weekly
              </button>
              <button
                onClick={() => setTimeframe('monthly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  timeframe === 'monthly' 
                    ? 'bg-[#133824] text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Monthly
              </button>
              <button
                onClick={() => setTimeframe('yearly')}
                className={`px-3 py-1.5 rounded-lg text-xs font-black transition-all cursor-pointer ${
                  timeframe === 'yearly' 
                    ? 'bg-[#133824] text-white shadow-xs' 
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                Yearly
              </button>
            </div>

            {/* Year Filter dropdown */}
            <div className="flex flex-wrap items-center gap-1.5">
              <select
                value={selectedYearFilter}
                onChange={(e) => setSelectedYearFilter(e.target.value)}
                className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none hover:bg-slate-100 cursor-pointer"
              >
                <option value="ALL">All Years</option>
                {availableYears.map(y => (
                  <option key={y} value={y}>{y} B.S.</option>
                ))}
              </select>

              {/* Chart Type Selector Dropdown */}
              <div className="relative">
                <select
                  value={chartType}
                  onChange={(e) => setChartType(e.target.value as ChartType)}
                  className="px-2.5 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs font-black text-slate-800 outline-none hover:bg-slate-100 cursor-pointer pr-7"
                >
                  <option value="bar">📊 Bar Chart</option>
                  <option value="line">📈 Line Chart</option>
                  <option value="area">🌊 Area Chart</option>
                  <option value="combo">🔀 Combo Chart</option>
                </select>
              </div>

              {/* Multi-Select Metrics Dropdown Popover */}
              <div className="relative" ref={metricsMenuRef}>
                <button
                  onClick={() => setIsMetricsMenuOpen(!isMetricsMenuOpen)}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all border cursor-pointer ${
                    isMetricsMenuOpen 
                      ? 'bg-[#0d2a1d] text-white border-emerald-950 shadow-xs' 
                      : 'bg-slate-50 text-slate-700 hover:bg-slate-100 border-slate-200'
                  }`}
                  title="Multi-select chart metrics to display"
                >
                  <SlidersHorizontal size={12} className={isMetricsMenuOpen ? 'text-emerald-400' : 'text-slate-500'} />
                  <span>Series ({selectedSeries.length})</span>
                  <ChevronDown size={12} className={`transition-transform duration-200 ${isMetricsMenuOpen ? 'rotate-180' : ''}`} />
                </button>

                {/* Dropdown Menu Popup */}
                {isMetricsMenuOpen && (
                  <div className="absolute right-0 top-full mt-2 w-64 bg-white rounded-2xl shadow-xl border border-slate-200/90 z-50 p-3 space-y-2.5 animate-in fade-in zoom-in-95 duration-150">
                    <div className="flex items-center justify-between pb-2 border-b border-slate-100">
                      <span className="text-[11px] font-black uppercase tracking-wider text-slate-700 flex items-center gap-1.5">
                        <SlidersHorizontal size={11} className="text-emerald-700" />
                        Select Metrics ({selectedSeries.length}/8)
                      </span>
                      <button
                        onClick={resetDefaultMetrics}
                        className="text-[10px] font-bold text-emerald-700 hover:text-emerald-800 flex items-center gap-1 cursor-pointer"
                        title="Reset to default metrics"
                      >
                        <RotateCcw size={10} />
                        <span>Default</span>
                      </button>
                    </div>

                    <div className="space-y-1 max-h-56 overflow-y-auto pr-1">
                      {AVAILABLE_CHART_METRICS.map(metric => {
                        const isChecked = selectedSeries.includes(metric.key);
                        return (
                          <button
                            key={metric.key}
                            type="button"
                            onClick={() => toggleMetricSeries(metric.key)}
                            className={`w-full flex items-center justify-between px-2.5 py-1.5 rounded-xl text-xs font-bold transition-all cursor-pointer text-left ${
                              isChecked 
                                ? 'bg-slate-100 text-slate-900 font-extrabold' 
                                : 'text-slate-500 hover:bg-slate-50 hover:text-slate-700'
                            }`}
                          >
                            <div className="flex items-center space-x-2">
                              <span 
                                className="w-2.5 h-2.5 rounded-full inline-block shrink-0" 
                                style={{ backgroundColor: metric.color }}
                              />
                              <span className="truncate">{metric.label}</span>
                            </div>
                            <div className={`w-4 h-4 rounded-md flex items-center justify-center border transition-all ${
                              isChecked 
                                ? 'bg-[#0d2a1d] border-[#0d2a1d] text-white' 
                                : 'border-slate-300 bg-white'
                            }`}>
                              {isChecked && <Check size={11} strokeWidth={3} />}
                            </div>
                          </button>
                        );
                      })}
                    </div>

                    <div className="pt-2 border-t border-slate-100 flex items-center justify-between">
                      <button
                        onClick={selectAllMetrics}
                        className="text-[10px] font-black text-slate-600 hover:text-slate-900 cursor-pointer"
                      >
                        Select All (8)
                      </button>
                      <button
                        onClick={() => setIsMetricsMenuOpen(false)}
                        className="px-2.5 py-1 bg-[#0d2a1d] text-white text-[10px] font-bold rounded-lg hover:bg-emerald-900 cursor-pointer"
                      >
                        Apply
                      </button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Selected Period Summary KPI Ribbon */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Period Inflow</div>
            <div className="text-lg font-black text-emerald-700 font-mono mt-0.5">
              Rs. {tableGrandTotals.totalInflow.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Period Outflow</div>
            <div className="text-lg font-black text-rose-700 font-mono mt-0.5">
              Rs. {tableGrandTotals.totalOutflow.toLocaleString()}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Net Flow Balance</div>
            <div className={`text-lg font-black font-mono mt-0.5 ${tableGrandTotals.netMovement >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
              Rs. {Math.abs(tableGrandTotals.netMovement).toLocaleString()} {tableGrandTotals.netMovement < 0 ? 'Dr' : 'Cr'}
            </div>
          </div>
          <div className="bg-slate-50 border border-slate-200/70 p-3.5 rounded-xl">
            <div className="text-[9px] font-black text-slate-400 uppercase tracking-widest">Recorded Entries</div>
            <div className="text-lg font-black text-slate-800 font-mono mt-0.5">
              {tableGrandTotals.txCount.toLocaleString()} Vouchers
            </div>
          </div>
        </div>

        {/* Visual Chart Area */}
        <div className="space-y-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div className="text-xs font-black uppercase tracking-wider text-slate-700 flex items-center space-x-2">
              <Activity size={14} className="text-emerald-700" />
              <span>
                {chartType === 'combo' && '🔀 Combo Movement: '}
                {chartType === 'line' && '📈 Trend Curves: '}
                {chartType === 'area' && '🌊 Flow Area: '}
                {chartType === 'bar' && '📊 Bar Comparison: '}
                {timeframe === 'daily' && 'Daily Trajectory'}
                {timeframe === 'weekly' && 'Weekly Consolidated'}
                {timeframe === 'monthly' && 'Monthly Fiscal Trajectory'}
                {timeframe === 'yearly' && 'Multi-Year Growth'}
              </span>
            </div>

            {/* Interactive Series Toggle Badges */}
            <div className="flex flex-wrap items-center gap-1.5">
              {AVAILABLE_CHART_METRICS.filter(m => selectedSeries.includes(m.key)).map(metric => (
                <button
                  key={metric.key}
                  onClick={() => toggleMetricSeries(metric.key)}
                  className="flex items-center space-x-1 text-[10px] font-bold px-2 py-0.5 bg-white border border-slate-200 hover:border-slate-400 rounded-full shadow-2xs transition-all cursor-pointer"
                  title={`Click to remove ${metric.label}`}
                >
                  <span className="w-2 h-2 rounded-full inline-block" style={{ backgroundColor: metric.color }} />
                  <span className="text-slate-700">{metric.label}</span>
                </button>
              ))}
            </div>
          </div>

          <div className="h-72 w-full bg-slate-50/50 rounded-2xl p-3 border border-slate-100">
            <ResponsiveContainer width="100%" height="100%">
              {chartType === 'bar' ? (
                <BarChart data={aggregatedAnalysisData} barGap={4} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="periodLabel" 
                    tick={{ fontSize: 9, fontWeight: 'bold' }} 
                    stroke="#64748b" 
                    angle={timeframe === 'daily' || timeframe === 'weekly' ? -25 : 0}
                    textAnchor={timeframe === 'daily' || timeframe === 'weekly' ? 'end' : 'middle'}
                  />
                  <YAxis 
                    tick={{ fontSize: 9, fontWeight: 'bold' }} 
                    stroke="#64748b" 
                    tickFormatter={(val) => val >= 100000 ? `${(val / 100000).toFixed(1)}L` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '0.75rem' }}
                    formatter={(value: any) => [`Rs. ${Number(value || 0).toLocaleString()}`, '']}
                    labelStyle={{ fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}
                  />
                  {selectedSeries.map(key => {
                    const metric = AVAILABLE_CHART_METRICS.find(m => m.key === key);
                    if (!metric) return null;
                    return (
                      <Bar 
                        key={metric.key} 
                        dataKey={metric.key} 
                        name={metric.label} 
                        fill={metric.color} 
                        radius={[4, 4, 0, 0]} 
                        maxBarSize={32} 
                      />
                    );
                  })}
                </BarChart>
              ) : chartType === 'line' ? (
                <LineChart data={aggregatedAnalysisData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="periodLabel" 
                    tick={{ fontSize: 9, fontWeight: 'bold' }} 
                    stroke="#64748b" 
                    angle={timeframe === 'daily' || timeframe === 'weekly' ? -25 : 0}
                    textAnchor={timeframe === 'daily' || timeframe === 'weekly' ? 'end' : 'middle'}
                  />
                  <YAxis 
                    tick={{ fontSize: 9, fontWeight: 'bold' }} 
                    stroke="#64748b" 
                    tickFormatter={(val) => val >= 100000 ? `${(val / 100000).toFixed(1)}L` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '0.75rem' }}
                    formatter={(value: any) => [`Rs. ${Number(value || 0).toLocaleString()}`, '']}
                    labelStyle={{ fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}
                  />
                  {selectedSeries.map(key => {
                    const metric = AVAILABLE_CHART_METRICS.find(m => m.key === key);
                    if (!metric) return null;
                    return (
                      <Line 
                        key={metric.key} 
                        type="monotone" 
                        dataKey={metric.key} 
                        name={metric.label} 
                        stroke={metric.color} 
                        strokeWidth={2.5} 
                        dot={{ r: 3.5, fill: metric.color, strokeWidth: 1 }} 
                        activeDot={{ r: 6 }} 
                      />
                    );
                  })}
                </LineChart>
              ) : chartType === 'area' ? (
                <AreaChart data={aggregatedAnalysisData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <defs>
                    {AVAILABLE_CHART_METRICS.map(metric => (
                      <linearGradient key={metric.key} id={`grad_${metric.key}`} x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor={metric.color} stopOpacity={0.4}/>
                        <stop offset="95%" stopColor={metric.color} stopOpacity={0.0}/>
                      </linearGradient>
                    ))}
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="periodLabel" 
                    tick={{ fontSize: 9, fontWeight: 'bold' }} 
                    stroke="#64748b" 
                    angle={timeframe === 'daily' || timeframe === 'weekly' ? -25 : 0}
                    textAnchor={timeframe === 'daily' || timeframe === 'weekly' ? 'end' : 'middle'}
                  />
                  <YAxis 
                    tick={{ fontSize: 9, fontWeight: 'bold' }} 
                    stroke="#64748b" 
                    tickFormatter={(val) => val >= 100000 ? `${(val / 100000).toFixed(1)}L` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '0.75rem' }}
                    formatter={(value: any) => [`Rs. ${Number(value || 0).toLocaleString()}`, '']}
                  />
                  {selectedSeries.map(key => {
                    const metric = AVAILABLE_CHART_METRICS.find(m => m.key === key);
                    if (!metric) return null;
                    return (
                      <Area 
                        key={metric.key} 
                        type="monotone" 
                        dataKey={metric.key} 
                        name={metric.label} 
                        stroke={metric.color} 
                        strokeWidth={2} 
                        fillOpacity={1} 
                        fill={`url(#grad_${metric.key})`} 
                      />
                    );
                  })}
                </AreaChart>
              ) : (
                /* Combo Chart: Bars for Volumes + Lines for Movement & Balances */
                <ComposedChart data={aggregatedAnalysisData} margin={{ top: 10, right: 10, left: 0, bottom: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#e2e8f0" />
                  <XAxis 
                    dataKey="periodLabel" 
                    tick={{ fontSize: 9, fontWeight: 'bold' }} 
                    stroke="#64748b" 
                    angle={timeframe === 'daily' || timeframe === 'weekly' ? -25 : 0}
                    textAnchor={timeframe === 'daily' || timeframe === 'weekly' ? 'end' : 'middle'}
                  />
                  <YAxis 
                    tick={{ fontSize: 9, fontWeight: 'bold' }} 
                    stroke="#64748b" 
                    tickFormatter={(val) => val >= 100000 ? `${(val / 100000).toFixed(1)}L` : val >= 1000 ? `${(val / 1000).toFixed(0)}k` : val}
                  />
                  <Tooltip 
                    contentStyle={{ borderRadius: '1rem', border: '1px solid #e2e8f0', boxShadow: '0 10px 25px -5px rgb(0 0 0 / 0.1)', padding: '0.75rem' }}
                    formatter={(value: any) => [`Rs. ${Number(value || 0).toLocaleString()}`, '']}
                    labelStyle={{ fontWeight: '900', color: '#0f172a', marginBottom: '4px' }}
                  />
                  {selectedSeries.map(key => {
                    const metric = AVAILABLE_CHART_METRICS.find(m => m.key === key);
                    if (!metric) return null;
                    if (metric.defaultInCombo === 'line') {
                      return (
                        <Line 
                          key={metric.key} 
                          type="monotone" 
                          dataKey={metric.key} 
                          name={metric.label} 
                          stroke={metric.color} 
                          strokeWidth={3} 
                          dot={{ r: 4, fill: metric.color }} 
                          activeDot={{ r: 7 }} 
                        />
                      );
                    } else {
                      return (
                        <Bar 
                          key={metric.key} 
                          dataKey={metric.key} 
                          name={metric.label} 
                          fill={metric.color} 
                          radius={[4, 4, 0, 0]} 
                          maxBarSize={28} 
                        />
                      );
                    }
                  })}
                </ComposedChart>
              )}
            </ResponsiveContainer>
          </div>
        </div>

        {/* Detailed Breakdown Data Table */}
        <div className="space-y-3 pt-2">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
            <div>
              <h4 className="text-sm font-black text-slate-900 tracking-tight">
                Periodic Financial Statement Table
              </h4>
              <p className="text-[11px] text-slate-500">
                Detailed transaction aggregates for the selected timeframe ({filteredTableData.length} records)
              </p>
            </div>

            <div className="flex items-center space-x-2">
              <div className="relative">
                <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400" />
                <input
                  type="text"
                  placeholder="Search period..."
                  value={searchFilter}
                  onChange={(e) => setSearchFilter(e.target.value)}
                  className="pl-8 pr-3 py-1.5 bg-slate-50 border border-slate-200 rounded-xl text-xs outline-none focus:border-emerald-600 w-36 sm:w-48"
                />
              </div>

              <button
                onClick={handleExportCSV}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Export CSV"
              >
                <Download size={13} />
                <span>Export CSV</span>
              </button>

              <button
                onClick={() => window.print()}
                className="flex items-center space-x-1.5 px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
                title="Print Statement"
              >
                <Printer size={13} />
                <span>Print</span>
              </button>
            </div>
          </div>

          <div className="overflow-x-auto rounded-2xl border border-slate-200 shadow-xs">
            <table className="w-full text-left text-xs border-collapse">
              <thead>
                <tr className="bg-[#133824] text-white font-black text-[10px] uppercase tracking-wider">
                  <th className="py-3 px-3.5">Period</th>
                  <th className="py-3 px-3 text-right">Deposit In</th>
                  <th className="py-3 px-3 text-right">Withdraw Out</th>
                  <th className="py-3 px-3 text-right">Office Income</th>
                  <th className="py-3 px-3 text-right">Office Exp</th>
                  <th className="py-3 px-3 text-right">Remittance</th>
                  <th className="py-3 px-3 text-right text-emerald-300">Total Inflow</th>
                  <th className="py-3 px-3 text-right text-rose-300">Total Outflow</th>
                  <th className="py-3 px-3.5 text-right">Net Flow</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white font-mono">
                {filteredTableData.slice(0, tableLimit).map((row, idx) => {
                  const isPositive = row.netMovement >= 0;
                  return (
                    <tr key={row.key || idx} className="hover:bg-slate-50/80 transition-colors">
                      <td className="py-3 px-3.5 font-sans font-black text-slate-900 whitespace-nowrap">
                        <div className="leading-tight">{row.periodLabel}</div>
                        {row.subLabel && (
                          <div className="text-[10px] font-normal text-slate-400">{row.subLabel}</div>
                        )}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-700">
                        {row.depositIn > 0 ? `Rs. ${row.depositIn.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-700">
                        {row.withdrawOut > 0 ? `Rs. ${row.withdrawOut.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-700">
                        {row.officeIncome > 0 ? `Rs. ${row.officeIncome.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-700">
                        {row.officeExpense > 0 ? `Rs. ${row.officeExpense.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-bold text-slate-700">
                        {row.remTotal > 0 ? `Rs. ${row.remTotal.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-emerald-700 bg-emerald-50/30">
                        {row.totalInflow > 0 ? `Rs. ${row.totalInflow.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-3 text-right font-black text-rose-700 bg-rose-50/30">
                        {row.totalOutflow > 0 ? `Rs. ${row.totalOutflow.toLocaleString()}` : '-'}
                      </td>
                      <td className="py-3 px-3.5 text-right whitespace-nowrap">
                        <span className={`px-2.5 py-0.5 rounded-md font-black text-[11px] ${
                          isPositive 
                            ? 'bg-emerald-100 text-emerald-800' 
                            : 'bg-rose-100 text-rose-800'
                        }`}>
                          {isPositive ? '+' : ''}Rs. {Math.abs(row.netMovement).toLocaleString()} {row.netMovement < 0 ? 'Dr' : 'Cr'}
                        </span>
                      </td>
                    </tr>
                  );
                })}

                {filteredTableData.length === 0 && (
                  <tr>
                    <td colSpan={9} className="py-8 text-center text-slate-400 font-sans font-bold">
                      No records found for the selected period criteria.
                    </td>
                  </tr>
                )}
              </tbody>
              {filteredTableData.length > 0 && (
                <tfoot>
                  <tr className="bg-[#0d2a1d] text-white font-black font-mono text-xs border-t-2 border-[#153e2b]">
                    <td className="py-3 px-3.5 font-sans font-black uppercase">GRAND TOTAL</td>
                    <td className="py-3 px-3 text-right">Rs. {tableGrandTotals.depositIn.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right">Rs. {tableGrandTotals.withdrawOut.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right">Rs. {tableGrandTotals.officeIncome.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right">Rs. {tableGrandTotals.officeExpense.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right">Rs. {tableGrandTotals.remTotal.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-emerald-300">Rs. {tableGrandTotals.totalInflow.toLocaleString()}</td>
                    <td className="py-3 px-3 text-right text-rose-300">Rs. {tableGrandTotals.totalOutflow.toLocaleString()}</td>
                    <td className="py-3 px-3.5 text-right text-amber-300">
                      Rs. {Math.abs(tableGrandTotals.netMovement).toLocaleString()} {tableGrandTotals.netMovement < 0 ? 'Dr' : 'Cr'}
                    </td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          {/* Show More Pagination if records exceed limit */}
          {filteredTableData.length > tableLimit && (
            <div className="text-center pt-2">
              <button
                onClick={() => setTableLimit(prev => prev + 25)}
                className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                Load More Records ({filteredTableData.length - tableLimit} remaining)
              </button>
            </div>
          )}
        </div>

      </div>

    </div>
  );
};

export default SummaryReport;

