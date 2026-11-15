import React, { useState, useEffect, useMemo, useCallback } from 'react';
import NepaliDate from 'nepali-date-converter';
import { 
  Building2, Zap, Home, Sparkles, Coffee, PhoneCall, 
  FileText, Plus, Search, Filter, Trash2, Edit3, 
  Download, CheckCircle2, AlertCircle, ChevronDown,
  TrendingUp, Calendar, Landmark, CreditCard, ArrowUpDown,
  RefreshCw, X, Receipt, Eye, SlidersHorizontal, Settings, FileSpreadsheet,
  FileCheck, Printer
} from 'lucide-react';
import { Branch, OfficeExpenseRecord, OfficeExpenseCategory, SystemSettings, Employee, User, BranchFixedExpenseConfig, SavedOfficeExpenseSheet } from '../types';
import { storageService } from '../services/storageService';
import { supabase } from '../services/supabase';
import { OfficeExpenseFormModal } from './OfficeExpenseFormModal';
import { FixedExpensesSetupModal } from './FixedExpensesSetupModal';
import { ElectricityUnitModal } from './ElectricityUnitModal';
import { OfficeExpensePreviewModal } from './OfficeExpensePreviewModal';
import { PaymentStatementModal } from './PaymentStatementModal';
import { normalizeMonth, isSameFy, getDeterministicExpenseId, deduplicateExpenses, isSameExpenseSlot } from '../utils/expenseHelpers';
import { isDayEndedForBranch, getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';

const NEPALI_MONTHS = [
  'Baishakh', 'Jestha', 'Ashadh', 'Shrawan', 'Bhadra', 'Ashwin', 
  'Kartik', 'Mangsir', 'Poush', 'Magh', 'Falgun', 'Chaitra'
];

export const NEPALI_MONTH_ORDER_FY: string[] = [
  'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 
  'Magh', 'Falgun', 'Chaitra', 'Baishakh', 'Jestha', 'Ashadh'
];

export const getMonthFyIndex = (m: string): number => {
  const norm = normalizeMonth(m);
  const idx = NEPALI_MONTH_ORDER_FY.findIndex(x => normalizeMonth(x) === norm);
  return idx !== -1 ? idx : 99;
};

const NEPALI_MONTH_MAP: Record<string, string> = {
  'Baishakh': 'बैशाख',
  'Jestha': 'जेठ',
  'Ashadh': 'असार',
  'Shrawan': 'साउन',
  'Bhadra': 'भदौ',
  'Ashwin': 'असोज',
  'Kartik': 'कार्तिक',
  'Mangsir': 'मंसिर',
  'Poush': 'पुस',
  'Magh': 'माघ',
  'Falgun': 'फागुन',
  'Chaitra': 'चैत'
};

const toNepaliNumber = (val: string | number | undefined | null): string => {
  if (val === undefined || val === null) return '';
  const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(val).replace(/[0-9]/g, (w) => nepaliDigits[parseInt(w, 10)]);
};

const getCurrentNepaliDate = () => {
  try {
    const nd = new NepaliDate();
    const y = nd.getYear();
    const m = String(nd.getMonth() + 1).padStart(2, '0');
    const d = String(nd.getDate()).padStart(2, '0');
    const monthName = NEPALI_MONTHS[nd.getMonth()] || 'Shrawan';
    const fiscalYear = nd.getMonth() >= 3 ? `${y}/${y + 1}` : `${y - 1}/${y}`;
    return {
      dateStr: `${y}/${m}/${d}`,
      year: y,
      monthIndex: nd.getMonth(),
      monthName,
      fiscalYear
    };
  } catch (e) {
    return {
      dateStr: '2083/04/01',
      year: 2083,
      monthIndex: 3,
      monthName: 'Shrawan',
      fiscalYear: '2083/2084'
    };
  }
};

const getDynamicFiscalYears = () => {
  try {
    const nd = new NepaliDate();
    const curYear = nd.getYear();
    const years: string[] = [];
    for (let y = 2079; y <= curYear + 2; y++) {
      years.push(`${y}/${y + 1}`);
    }
    return years;
  } catch (e) {
    return ['2080/2081', '2081/2082', '2082/2083', '2083/2084', '2084/2085'];
  }
};

interface OfficeExpenseManagerProps {
  branches: Branch[];
  currentBranch?: Branch | null;
  user?: User | null;
  settings?: SystemSettings | null;
  employees?: Employee[];
}

export const OfficeExpenseManager: React.FC<OfficeExpenseManagerProps> = ({
  branches,
  currentBranch,
  user,
  settings,
  employees = []
}) => {
  const currentNd = useMemo(() => getCurrentNepaliDate(), []);
  const fiscalYearsList = useMemo(() => getDynamicFiscalYears(), []);

  // Filter States
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(currentNd.fiscalYear);
  const [selectedMonth, setSelectedMonth] = useState<string>('all'); // Default to all generated months
  const [selectedBranchId, setSelectedBranchId] = useState<string>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');
  const isDayEnded = useDayEndLock(selectedBranchId === 'all' ? currentBranch?.id : selectedBranchId);

  // Data States
  const [expenses, setExpenses] = useState<OfficeExpenseRecord[]>([]);
  const [savedSheets, setSavedSheets] = useState<SavedOfficeExpenseSheet[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [isGeneratingFixed, setIsGeneratingFixed] = useState<boolean>(false);

  // Modals
  const [isFormModalOpen, setIsFormModalOpen] = useState<boolean>(false);
  const [editingExpense, setEditingExpense] = useState<OfficeExpenseRecord | null>(null);
  const [isFixedSetupModalOpen, setIsFixedSetupModalOpen] = useState<boolean>(false);
  const [isElectricityModalOpen, setIsElectricityModalOpen] = useState<boolean>(false);
  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState<boolean>(false);
  const [isPaymentStatementModalOpen, setIsPaymentStatementModalOpen] = useState<boolean>(false);
  const [autoPostToLedger, setAutoPostToLedger] = useState<boolean>(true);

  const formatFyDisplay = (fy: string) => {
    if (!fy) return '';
    const parts = fy.split('/');
    if (parts.length === 2 && parts[0].length === 4) {
      return `${parts[0].slice(1)}/${parts[1].slice(2)}`;
    }
    return fy;
  };
  
  // Custom Modal Target Params for Sheet / View / Edit / Generate
  const [modalTargetParams, setModalTargetParams] = useState<{
    fiscalYear: string;
    month: string;
    branchId: string;
  }>({
    fiscalYear: currentNd.fiscalYear,
    month: currentNd.monthName,
    branchId: 'all'
  });

  // Delete Sheet Confirmation State
  const [sheetToDelete, setSheetToDelete] = useState<SavedOfficeExpenseSheet | null>(null);

  // Load Data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    try {
      const [expData, sheetsData] = await Promise.all([
        storageService.getOfficeExpenses(),
        storageService.getSavedExpenseSheets()
      ]);
      setExpenses(expData || []);
      setSavedSheets(sheetsData || []);
    } catch (e) {
      console.error('Failed to load office expenses & saved sheets:', e);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
    const handleUpdate = () => loadData();
    window.addEventListener('officeExpensesUpdated', handleUpdate);
    window.addEventListener('savedExpenseSheetsUpdated', handleUpdate);
    return () => {
      window.removeEventListener('officeExpensesUpdated', handleUpdate);
      window.removeEventListener('savedExpenseSheetsUpdated', handleUpdate);
    };
  }, [loadData]);

  // Track all months that have generated sheets or recorded expenses in selectedFiscalYear
  const generatedMonthSet = useMemo(() => {
    const set = new Set<string>();
    savedSheets.forEach(s => {
      if (isSameFy(s.fiscalYear, selectedFiscalYear) && s.month) {
        set.add(normalizeMonth(s.month));
      }
    });
    expenses.forEach(e => {
      if (isSameFy(e.fiscalYear, selectedFiscalYear) && e.month) {
        set.add(normalizeMonth(e.month));
      }
    });
    return set;
  }, [savedSheets, expenses, selectedFiscalYear]);

  // Shows all months that have had sheets generated or recorded in the main table
  const allMonthlySheets = useMemo(() => {
    let list: SavedOfficeExpenseSheet[] = [...savedSheets];

    // Filter saved sheets by Fiscal Year
    if (selectedFiscalYear) {
      list = list.filter(s => isSameFy(s.fiscalYear, selectedFiscalYear));
    }

    // Also identify any months from expenses that have records but no explicit entry in savedSheets
    const existingKeys = new Set(
      list.map(s => `${normalizeMonth(s.month)}_${s.branchId || 'all'}`)
    );
    const existingAllKeys = new Set(
      list.filter(s => s.branchId === 'all' || !s.branchId).map(s => normalizeMonth(s.month))
    );

    const expenseMonthMap = new Map<string, {
      fiscalYear: string;
      month: string;
      branchId: string;
      totalExpenses: number;
      taxAmount: number;
      netPaidAmount: number;
      count: number;
      savedAt: number;
    }>();

    expenses.forEach(e => {
      if (!e.fiscalYear || !e.month) return;
      if (!isSameFy(e.fiscalYear, selectedFiscalYear)) return;

      const normM = normalizeMonth(e.month);
      const bId = e.branchId || 'all';
      const key = `${normM}_${bId}`;

      // If already represented in savedSheets, don't duplicate
      if (existingKeys.has(key) || existingAllKeys.has(normM)) return;

      if (!expenseMonthMap.has(key)) {
        expenseMonthMap.set(key, {
          fiscalYear: e.fiscalYear,
          month: e.month,
          branchId: bId,
          totalExpenses: 0,
          taxAmount: 0,
          netPaidAmount: 0,
          count: 0,
          savedAt: e.createdAt ? new Date(e.createdAt).getTime() : Date.now()
        });
      }

      const g = expenseMonthMap.get(key)!;
      const gross = Number(e.amount) || 0;
      const tax = Number(e.taxDeduction) || 0;
      const net = e.netPaidAmount !== undefined ? Number(e.netPaidAmount) : (gross - tax);
      g.totalExpenses += gross;
      g.taxAmount += tax;
      g.netPaidAmount += net;
      g.count += 1;
    });

    expenseMonthMap.forEach((g, key) => {
      const bName = branches.find(b => b.id === g.branchId)?.name || (g.branchId === 'all' ? 'सम्पूर्ण शाखाहरू' : g.branchId);
      list.push({
        id: `GEN_${selectedFiscalYear.replace(/[/\\s]/g, '_')}_${key}`,
        fiscalYear: g.fiscalYear,
        month: g.month,
        monthNp: NEPALI_MONTH_MAP[g.month] || g.month,
        branchId: g.branchId,
        branchName: bName,
        totalExpenses: Number(g.totalExpenses.toFixed(2)),
        taxAmount: Number(g.taxAmount.toFixed(2)),
        netPaidAmount: Number(g.netPaidAmount.toFixed(2)),
        recordsCount: g.count,
        preparedByName: 'Account Dept',
        status: 'Approved',
        savedAt: g.savedAt
      });
    });

    // Filter by branch
    if (selectedBranchId !== 'all') {
      list = list.filter(s => s.branchId === selectedBranchId || s.branchId === 'all');
    }

    // Filter by selected month if not 'all'
    if (selectedMonth !== 'all') {
      const normSelected = normalizeMonth(selectedMonth);
      list = list.filter(s => normalizeMonth(s.month) === normSelected);
    }

    // Search query filter
    if (searchTerm.trim()) {
      const q = searchTerm.toLowerCase();
      list = list.filter(s => {
        const moNp = s.monthNp || NEPALI_MONTH_MAP[s.month] || '';
        return (
          (s.fiscalYear || '').toLowerCase().includes(q) ||
          (s.month || '').toLowerCase().includes(q) ||
          moNp.toLowerCase().includes(q) ||
          (s.branchName && s.branchName.toLowerCase().includes(q)) ||
          (s.preparedByName && s.preparedByName.toLowerCase().includes(q)) ||
          (s.approvedByName && s.approvedByName.toLowerCase().includes(q))
        );
      });
    }

    // Sort chronologically by Nepali Fiscal Year month (Shrawan, Bhadra, Ashwin...)
    return list.sort((a, b) => {
      const idxA = getMonthFyIndex(a.month);
      const idxB = getMonthFyIndex(b.month);
      if (idxA !== idxB) return idxA - idxB;
      return (b.savedAt || 0) - (a.savedAt || 0);
    });
  }, [savedSheets, expenses, selectedFiscalYear, selectedMonth, selectedBranchId, searchTerm, branches]);

  // Grand summary for filtered sheets
  const tableSummary = useMemo(() => {
    let totalGross = 0;
    let totalTax = 0;
    let totalPaid = 0;

    allMonthlySheets.forEach(s => {
      totalGross += Number(s.totalExpenses) || 0;
      totalTax += Number(s.taxAmount) || 0;
      totalPaid += Number(s.netPaidAmount) || 0;
    });

    return {
      totalGross,
      totalTax,
      totalPaid,
      count: allMonthlySheets.length
    };
  }, [allMonthlySheets]);

  // Open Preview Modal with Specific Sheet / Month Config
  const handleOpenSheetModal = (sheet: { fiscalYear: string; month: string; branchId: string }) => {
    setModalTargetParams({
      fiscalYear: sheet.fiscalYear,
      month: sheet.month,
      branchId: sheet.branchId || selectedBranchId || 'all'
    });
    setIsPreviewModalOpen(true);
  };

  // Delete a Saved Sheet & its associated expense records
  const handleDeleteSheet = async (sheet: SavedOfficeExpenseSheet) => {
    if (isDayEndedForBranch(sheet.branchId === 'all' ? currentBranch?.id : sheet.branchId)) {
      alert(getDayEndedBlockMessage());
      setSheetToDelete(null);
      return;
    }
    try {
      const targetFy = sheet.fiscalYear;
      const targetMo = sheet.month;
      const targetBranch = sheet.branchId || 'all';

      // 1. Optimistic state update for instant UI response
      setSavedSheets(prev => prev.filter(s => {
        if (s.id === sheet.id) return false;
        if (isSameFy(s.fiscalYear, targetFy) && normalizeMonth(s.month) === normalizeMonth(targetMo)) {
          if (targetBranch === 'all' || s.branchId === targetBranch) return false;
        }
        return true;
      }));

      setExpenses(prev => prev.filter(e => {
        const matchFy = isSameFy(e.fiscalYear, targetFy);
        const matchMonth = normalizeMonth(e.month) === normalizeMonth(targetMo);
        const matchBranch = targetBranch === 'all' || e.branchId === targetBranch;
        return !(matchFy && matchMonth && matchBranch);
      }));

      // 2. Delete the saved report sheet across all storage tiers
      await storageService.deleteSavedExpenseSheet(sheet.id, sheet.fiscalYear, sheet.month, sheet.branchId);

      // 3. Delete all monthly expense records across all storage tiers
      await storageService.deleteMonthlyOfficeExpenses(sheet.fiscalYear, sheet.month, sheet.branchId);

      // 4. Delete all auto-posted ledger entries from Teller Ledger & Income/Exp
      await storageService.deleteOfficeExpenseLedgerEntries(sheet.fiscalYear, sheet.month, sheet.branchId, sheet.monthNp);

      // 4. Also directly ensure Supabase tables are cleared
      try {
        await supabase.from('saved_office_expense_sheets').delete().eq('id', sheet.id);
        let sQuery = supabase.from('saved_office_expense_sheets').delete()
          .eq('fiscal_year', sheet.fiscalYear)
          .eq('month', sheet.month);
        if (targetBranch !== 'all') {
          sQuery = sQuery.eq('branch_id', targetBranch);
        }
        await sQuery;

        let eQuery = supabase.from('office_expenses').delete()
          .eq('fiscal_year', sheet.fiscalYear)
          .eq('month', sheet.month);
        if (targetBranch !== 'all') {
          eQuery = eQuery.eq('branch_id', targetBranch);
        }
        await eQuery;
      } catch (err) {
        console.warn("Direct Supabase delete notice:", err);
      }
    } catch (err) {
      console.error("Error deleting monthly expense sheet & records:", err);
      alert("मेटाउँदा समस्या आयो। कृपया पुन: प्रयास गर्नुहोस्।");
    } finally {
      setSheetToDelete(null);
      await loadData();
    }
  };

  // 1-Click Auto-Generate Fixed Expenses for Month (House Rent, Cleaner, Telephone, Khaja)
  const handleAutoGenerateFixed = async (targetBranchId: string, targetMonth: string, targetFiscalYear: string) => {
    if (isDayEndedForBranch(targetBranchId)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    setIsGeneratingFixed(true);
    try {
      const configs = await storageService.getFixedExpenseConfigs();
      const cfg = configs[targetBranchId];

      if (!cfg) {
        alert('Please configure fixed expenses for this branch first in the setup window.');
        return;
      }

      const branchName = branches.find(b => b.id === targetBranchId)?.name || targetBranchId;
      const effectiveMonth = targetMonth === 'all' ? currentNd.monthName : targetMonth;

      const recordsToCreate: OfficeExpenseRecord[] = [];
      const timestamp = Date.now();

      // 1. House Rent
      if (cfg.rentEnabled && !expenses.some(e => isSameExpenseSlot(e, targetBranchId, targetFiscalYear, effectiveMonth, 'house_rent'))) {
        const net = cfg.rentNetPaid || 15000;
        const gross = cfg.rentAmount || (net / 0.9);
        const tax = gross - net;
        recordsToCreate.push({
          id: getDeterministicExpenseId('house_rent', targetBranchId, targetFiscalYear, effectiveMonth),
          branchId: targetBranchId,
          category: 'house_rent',
          categoryLabel: 'House Rent',
          date: currentNd.dateStr,
          month: effectiveMonth,
          fiscalYear: targetFiscalYear,
          amount: parseFloat(gross.toFixed(2)),
          taxDeduction: parseFloat(tax.toFixed(2)),
          netPaidAmount: net,
          paymentMethod: cfg.rentPaymentMethod || 'Account Transfer',
          accountNo: cfg.rentAccountNo || '',
          bankName: cfg.rentBankName || '',
          landlordName: cfg.landlordName,
          panVatNo: cfg.landlordPan,
          paidTo: cfg.landlordName || 'Landlord',
          recordedBy: user?.fullName || 'Admin',
          remarks: '',
          createdAt: timestamp
        });
      }

      // 2. Cleaner Payment
      if (cfg.cleanerEnabled && !expenses.some(e => isSameExpenseSlot(e, targetBranchId, targetFiscalYear, effectiveMonth, 'cleaner_payment'))) {
        const net = cfg.cleanerNetPaid || cfg.cleanerAmount || 8000;
        const gross = cfg.cleanerAmount || net;
        const tax = parseFloat((gross - net).toFixed(2));
        recordsToCreate.push({
          id: getDeterministicExpenseId('cleaner_payment', targetBranchId, targetFiscalYear, effectiveMonth),
          branchId: targetBranchId,
          category: 'cleaner_payment',
          categoryLabel: 'Cleaner Payment',
          date: currentNd.dateStr,
          month: effectiveMonth,
          fiscalYear: targetFiscalYear,
          amount: gross,
          taxDeduction: tax > 0 ? tax : 0,
          netPaidAmount: net,
          paymentMethod: cfg.cleanerPaymentMethod || 'Account Transfer',
          accountNo: cfg.cleanerAccountNo || '',
          cleanerName: cfg.cleanerName,
          workingDays: cfg.cleanerWorkingDays || 30,
          paidTo: cfg.cleanerName || 'Cleaner Staff',
          recordedBy: user?.fullName || 'Admin',
          remarks: '',
          createdAt: timestamp + 1
        });
      }

      // 3. Telephone & Internet
      if (cfg.telephoneEnabled && !expenses.some(e => isSameExpenseSlot(e, targetBranchId, targetFiscalYear, effectiveMonth, 'telephone_bill'))) {
        const amt = cfg.telephoneAmount || 1500;
        recordsToCreate.push({
          id: getDeterministicExpenseId('telephone_bill', targetBranchId, targetFiscalYear, effectiveMonth),
          branchId: targetBranchId,
          category: 'telephone_bill',
          categoryLabel: 'Telephone & Internet',
          date: currentNd.dateStr,
          month: effectiveMonth,
          fiscalYear: targetFiscalYear,
          amount: amt,
          taxDeduction: 0,
          netPaidAmount: amt,
          paymentMethod: cfg.telephonePaymentMethod || 'Account Transfer',
          accountNo: cfg.telephoneAccountNo || '',
          serviceProvider: cfg.telephoneProvider || 'Nepal Telecom',
          phoneOrAccountNo: cfg.telephoneAccountNo,
          paidTo: cfg.telephoneProvider || 'Telecom Provider',
          recordedBy: user?.fullName || 'Admin',
          remarks: '',
          createdAt: timestamp + 2
        });
      }

      // 4. Khaja / Refreshment
      if (cfg.khajaEnabled && !expenses.some(e => isSameExpenseSlot(e, targetBranchId, targetFiscalYear, effectiveMonth, 'khaja_kharch'))) {
        const amt = cfg.khajaMonthlyAmount || 5000;
        recordsToCreate.push({
          id: getDeterministicExpenseId('khaja_kharch', targetBranchId, targetFiscalYear, effectiveMonth),
          branchId: targetBranchId,
          category: 'khaja_kharch',
          categoryLabel: 'Refreshment & Snacks',
          date: currentNd.dateStr,
          month: effectiveMonth,
          fiscalYear: targetFiscalYear,
          amount: amt,
          taxDeduction: 0,
          netPaidAmount: amt,
          paymentMethod: cfg.khajaPaymentMethod || 'Cash',
          itemsDescription: cfg.khajaDescription || 'Office refreshments',
          paidTo: 'Office Refreshment',
          recordedBy: user?.fullName || 'Admin',
          remarks: '',
          createdAt: timestamp + 3
        });
      }

      if (recordsToCreate.length === 0) {
        alert(`Fixed expenses for ${branchName} (${effectiveMonth}) are already posted.`);
        return;
      }

      const allUpdated = deduplicateExpenses([...recordsToCreate, ...expenses]);
      await storageService.saveAllOfficeExpenses(allUpdated);
      await loadData();
      alert(`Success! Generated fixed expense records for ${branchName} (${effectiveMonth}).`);
    } catch (e: any) {
      alert('Error generating fixed expenses: ' + e.message);
    } finally {
      setIsGeneratingFixed(false);
    }
  };

  // Save Expense Handler for Modals
  const handleSaveExpense = async (expense: OfficeExpenseRecord) => {
    if (isDayEndedForBranch(expense.branchId || currentBranch?.id)) {
      alert(getDayEndedBlockMessage());
      return;
    }
    await storageService.saveOfficeExpense(expense);
    await loadData();
  };

  // Export CSV of Saved Sheets
  const handleExportCSV = () => {
    if (allMonthlySheets.length === 0) {
      alert('No monthly report sheets to export.');
      return;
    }
    const headers = ['S.N.', 'Fiscal Year', 'Month', 'Month (Nepali)', 'Branch', 'Total Expenses (Gross Rs.)', 'Tax Amount (TDS Rs.)', 'Paid Amount (Net Rs.)', 'Prepared By', 'Approved By'];
    const rows = allMonthlySheets.map((s, idx) => {
      const bName = s.branchName || (s.branchId === 'all' ? 'All Branches' : s.branchId);
      return [
        idx + 1,
        `"${s.fiscalYear}"`,
        `"${s.month}"`,
        `"${s.monthNp || NEPALI_MONTH_MAP[s.month] || s.month}"`,
        `"${bName}"`,
        s.totalExpenses || 0,
        s.taxAmount || 0,
        s.netPaidAmount || 0,
        `"${s.preparedByName || s.preparedBy || ''}"`,
        `"${s.approvedByName || s.approvedBy || ''}"`
      ];
    });

    const csvContent = 'data:text/csv;charset=utf-8,' + [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Office_Expense_Sheets_${selectedFiscalYear.replace('/', '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="space-y-3 animate-in fade-in duration-300 w-full pb-8">
      
      {/* Top Header with FY, Month, Branch Dropdowns & Action Buttons */}
      <div className="bg-white p-3 rounded-xl border border-slate-200 shadow-xs flex flex-wrap items-center justify-between gap-3 no-print">
        
        {/* Title */}
        <div className="flex items-center space-x-2.5">
          <div className="p-2 bg-emerald-50 text-emerald-800 rounded-xl border border-emerald-200">
            <Building2 size={18} />
          </div>
          <div>
            <h1 className="text-sm sm:text-base font-black text-black tracking-tight">
              Office Operating Expenses
            </h1>
            <p className="text-[11px] font-semibold text-slate-600">
              मासिक कार्यालय सञ्चालन खर्च प्रतिवेदन तथा हिसाब सूची
            </p>
          </div>
        </div>

        {/* Dropdowns (FY, Month, Branch) and Action Buttons */}
        <div className="flex flex-wrap items-center gap-2">
          
          {/* Fiscal Year */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
            <span className="text-xs font-bold text-black">FY</span>
            <select
              value={selectedFiscalYear}
              onChange={(e) => setSelectedFiscalYear(e.target.value)}
              className="bg-transparent text-xs font-mono font-black text-black outline-none cursor-pointer"
            >
              {fiscalYearsList.map(fy => (
                <option key={fy} value={fy}>{formatFyDisplay(fy)}</option>
              ))}
            </select>
          </div>

          {/* Month */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
            <span className="text-xs font-bold text-black">Month:</span>
            <select
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="bg-transparent text-xs font-bold text-black outline-none cursor-pointer"
            >
              <option value="all">All Months</option>
              {NEPALI_MONTH_ORDER_FY.map(m => {
                const isGen = generatedMonthSet.has(normalizeMonth(m));
                return (
                  <option key={m} value={m}>
                    {m} {isGen ? ' • [Generated]' : ''}
                  </option>
                );
              })}
            </select>
          </div>

          {/* Branch */}
          <div className="flex items-center space-x-1.5 bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1">
            <span className="text-xs font-bold text-black">Branch:</span>
            <select
              value={selectedBranchId}
              onChange={(e) => setSelectedBranchId(e.target.value)}
              className="bg-transparent text-xs font-bold text-black outline-none cursor-pointer max-w-[170px]"
            >
              <option value="all">Branch</option>
              {branches.map(b => (
                <option key={b.id} value={b.id}>{b.name}</option>
              ))}
            </select>
          </div>

          <div className="h-5 w-[1px] bg-slate-200 mx-0.5 hidden lg:block"></div>

          {/* Fixed Setup Button */}
          <button
            onClick={() => setIsFixedSetupModalOpen(true)}
            className="px-2.5 py-1.5 bg-slate-100 hover:bg-slate-200 text-black rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer border border-slate-300"
            title="Configure monthly fixed House Rent, Cleaner, Telephone, and Khaja"
          >
            <Settings size={13} className="text-black" />
            <span>Fixed Setup</span>
          </button>

          {/* Electricity Exp Button */}
          <button
            onClick={() => setIsElectricityModalOpen(true)}
            className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-black rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer border border-amber-300 shadow-xs"
            title="Fast monthly Electricity meter reading unit entry"
          >
            <Zap size={13} className="text-amber-700" />
            <span>Electricity Exp</span>
          </button>

          {/* Statement Button */}
          <button
            onClick={() => setIsPaymentStatementModalOpen(true)}
            className="px-2.5 py-1.5 bg-emerald-50 hover:bg-emerald-100 text-black rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer border border-emerald-300 shadow-xs"
            title="View Individual English Payment Statements for House Rent Landlords and Office Cleaners"
          >
            <Landmark size={13} className="text-emerald-700" />
            <span>Statement</span>
          </button>

          {/* Preview Button */}
          <button
            onClick={() => handleOpenSheetModal({
              fiscalYear: selectedFiscalYear,
              month: selectedMonth === 'all' ? currentNd.monthName : selectedMonth,
              branchId: selectedBranchId
            })}
            className="px-3 py-1.5 bg-blue-50 hover:bg-blue-100 text-black rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer border border-blue-300 shadow-xs"
            title="Preview standard monthly expense sheet statement"
          >
            <Eye size={13} className="text-blue-700" />
            <span>preview</span>
          </button>

          {/* Generate Button */}
          <button
            onClick={() => handleOpenSheetModal({
              fiscalYear: selectedFiscalYear,
              month: selectedMonth === 'all' ? currentNd.monthName : selectedMonth,
              branchId: selectedBranchId
            })}
            disabled={isDayEnded}
            className="px-3.5 py-1.5 bg-slate-900 hover:bg-slate-800 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-black transition-all flex items-center space-x-1.5 cursor-pointer shadow-sm ring-1 ring-slate-800"
            title={isDayEnded ? getDayEndedBlockMessage() : "Generate multi-table monthly operating expense report sheet"}
          >
            <FileSpreadsheet size={13} className="text-emerald-400" />
            <span>Generate</span>
          </button>

          {/* Auto Checkbox (Circle Position) */}
          <label 
            className={`flex items-center space-x-1.5 select-none bg-slate-50 border border-slate-300 rounded-lg px-2.5 py-1.5 transition-colors shadow-xs ${isDayEnded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer hover:border-slate-400 hover:bg-slate-100'}`}
            title={isDayEnded ? getDayEndedBlockMessage() : "Auto post generated expense amounts to Teller Ledger and Income/Exp ledgers"}
          >
            <input
              type="checkbox"
              checked={autoPostToLedger}
              onChange={(e) => setAutoPostToLedger(e.target.checked)}
              disabled={isDayEnded}
              className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed"
            />
            <span className="text-xs font-black text-slate-800 tracking-wide">Auto</span>
          </label>
        </div>
      </div>

      {/* Main Saved Monthly Reports Table */}
      <div className="bg-white rounded-xl border border-slate-300 shadow-xs overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-xs text-left border-collapse">
            <thead>
              <tr className="bg-slate-100 border-b-2 border-slate-300 text-black font-black uppercase text-[11px] tracking-wide">
                <th className="py-3 px-3 w-12 text-center border-r border-slate-300">S.N.</th>
                <th className="py-3 px-4 border-r border-slate-300">FY</th>
                <th className="py-3 px-4 border-r border-slate-300">Month</th>
                <th className="py-3 px-4 text-right border-r border-slate-300">Total Expenses</th>
                <th className="py-3 px-4 text-right border-r border-slate-300">Tax Amount</th>
                <th className="py-3 px-4 text-right border-r border-slate-300 bg-slate-200/60 font-black text-black">Paid Amount</th>
                <th className="py-3 px-4 border-r border-slate-300">Prepared By</th>
                <th className="py-3 px-4 text-center w-56">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200">
              {isLoading ? (
                <tr>
                  <td colSpan={8} className="py-10 text-center text-black font-bold">
                    <RefreshCw size={20} className="animate-spin inline mr-2 text-slate-600" />
                    विवरण लोड हुँदैछ...
                  </td>
                </tr>
              ) : allMonthlySheets.length === 0 ? (
                <tr>
                  <td colSpan={8} className="py-8 text-center bg-slate-50/50">
                    <div className="text-xs font-bold text-slate-700">
                      {selectedMonth !== 'all'
                        ? `${selectedMonth} (${NEPALI_MONTH_MAP[selectedMonth] || ''}) महिनाको खर्च प्रतिवेदन फेला परेन।`
                        : `आ.व. ${selectedFiscalYear} मा कुनै मासिक खर्च प्रतिवेदन फेला परेन।`}
                    </div>
                    <div className="mt-2 flex items-center justify-center space-x-4">
                      {selectedMonth !== 'all' && (
                        <button
                          onClick={() => setSelectedMonth('all')}
                          className="text-xs text-blue-700 hover:text-blue-900 font-bold underline cursor-pointer"
                        >
                          View All Months
                        </button>
                      )}
                      <button
                        onClick={() => handleOpenSheetModal({
                          fiscalYear: selectedFiscalYear,
                          month: selectedMonth === 'all' ? currentNd.monthName : selectedMonth,
                          branchId: selectedBranchId
                        })}
                        disabled={isDayEnded}
                        title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                        className="text-xs text-emerald-700 hover:text-emerald-900 font-bold underline cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        + Generate
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                allMonthlySheets.map((item, idx) => {
                  const displayMonthNp = item.monthNp || NEPALI_MONTH_MAP[item.month] || item.month;
                  
                  return (
                    <tr key={item.id} className="hover:bg-slate-50 transition-colors border-b border-slate-200">
                      
                      {/* 1. S.N. */}
                      <td className="py-3 px-3 text-center font-mono font-bold text-black border-r border-slate-200">
                        {idx + 1}
                      </td>

                      {/* 2. FY (Fiscal Year) */}
                      <td className="py-3 px-4 font-mono font-black text-black border-r border-slate-200">
                        {item.fiscalYear}
                      </td>

                      {/* 3. Month */}
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="flex items-center space-x-2">
                          <span className="font-black text-black text-sm">
                            {displayMonthNp}
                          </span>
                          <span className="text-[10px] font-bold text-slate-500 font-mono">
                            ({item.month})
                          </span>
                        </div>
                        {item.branchName && item.branchId !== 'all' && (
                          <div className="text-[10px] font-semibold text-slate-600">
                            {item.branchName}
                          </div>
                        )}
                      </td>

                      {/* 4. Total Expenses (Gross Amount) */}
                      <td className="py-3 px-4 text-right font-mono font-black text-black border-r border-slate-200">
                        Rs. {(item.totalExpenses || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>

                      {/* 5. Tax Amount (TDS) */}
                      <td className="py-3 px-4 text-right font-mono font-black text-black border-r border-slate-200">
                        {item.taxAmount > 0 ? (
                          <span>Rs. {item.taxAmount.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</span>
                        ) : (
                          <span className="text-slate-400">-</span>
                        )}
                      </td>

                      {/* 6. Paid Amount (Net Paid) */}
                      <td className="py-3 px-4 text-right font-mono font-black text-black border-r border-slate-200 bg-slate-50">
                        <span className="px-2 py-0.5 rounded font-black text-black">
                          Rs. {(item.netPaidAmount || 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </span>
                      </td>

                      {/* Prepared By */}
                      <td className="py-3 px-4 border-r border-slate-200">
                        <div className="font-bold text-slate-800 text-xs">
                          {item.preparedByName || item.preparedBy || 'Staff'}
                        </div>
                      </td>

                      {/* 7. Action: (sheet, view, edit, delete) */}
                      <td className="py-3 px-3 text-center">
                        <div className="flex items-center justify-center space-x-1.5">
                          
                          {/* Sheet Button (Full printable official sheet) */}
                          <button
                            onClick={() => handleOpenSheetModal({
                              fiscalYear: item.fiscalYear,
                              month: item.month,
                              branchId: item.branchId || 'all'
                            })}
                            className="px-2.5 py-1 bg-slate-900 hover:bg-slate-800 text-white rounded-md text-[11px] font-black transition-all flex items-center space-x-1 shadow-xs cursor-pointer active:scale-95"
                            title="मासिक खर्चको पूर्ण ३-तालिका विवरण सिट हेर्नुहोस् र प्रिन्ट गर्नुहोस्"
                          >
                            <FileSpreadsheet size={12} className="text-emerald-400" />
                            <span>sheet</span>
                          </button>

                          {/* View Button */}
                          <button
                            onClick={() => handleOpenSheetModal({
                              fiscalYear: item.fiscalYear,
                              month: item.month,
                              branchId: item.branchId || 'all'
                            })}
                            className="px-2.5 py-1 bg-blue-50 hover:bg-blue-100 text-black border border-blue-300 rounded-md text-[11px] font-black transition-all flex items-center space-x-1 cursor-pointer active:scale-95"
                            title="प्रतिवेदन पूर्वावलोकन (View Report)"
                          >
                            <Eye size={12} className="text-blue-700" />
                            <span>view</span>
                          </button>

                          {/* Edit Button */}
                          <button
                            onClick={() => handleOpenSheetModal({
                              fiscalYear: item.fiscalYear,
                              month: item.month,
                              branchId: item.branchId || 'all'
                            })}
                            disabled={isDayEnded}
                            className="px-2.5 py-1 bg-amber-50 hover:bg-amber-100 text-black border border-amber-300 rounded-md text-[11px] font-black transition-all flex items-center space-x-1 cursor-pointer active:scale-95 disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : "Edit report sheet"}
                          >
                            <Edit3 size={12} className="text-amber-800" />
                            <span>edit</span>
                          </button>

                          {/* Delete Button */}
                          <button
                            onClick={() => setSheetToDelete(item)}
                            disabled={isDayEnded}
                            className="p-1.5 text-slate-500 hover:text-rose-700 hover:bg-rose-50 rounded-md transition-colors cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                            title={isDayEnded ? getDayEndedBlockMessage() : "Delete report sheet"}
                          >
                            <Trash2 size={14} />
                          </button>

                        </div>
                      </td>

                    </tr>
                  );
                })
              )}
            </tbody>

            {/* Table Footer with Grand Summary */}
            {allMonthlySheets.length > 0 && (
              <tfoot>
                <tr className="bg-slate-200 border-t-2 border-slate-400 text-black font-black text-xs">
                  <td colSpan={3} className="py-3 px-4 text-right uppercase tracking-wider font-black text-black border-r border-slate-300">
                    कुल जम्मा (Grand Total):
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-black border-r border-slate-300">
                    Rs. {tableSummary.totalGross.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-black border-r border-slate-300">
                    Rs. {tableSummary.totalTax.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="py-3 px-4 text-right font-mono font-black text-black border-r border-slate-300 bg-slate-300">
                    Rs. {tableSummary.totalPaid.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td colSpan={2} className="py-3 px-4 text-center font-bold text-black text-[11px]">
                    {tableSummary.count} महिना
                  </td>
                </tr>
              </tfoot>
            )}
          </table>
        </div>
      </div>

      {/* Delete Sheet Confirmation Modal */}
      {sheetToDelete && (
        <div className="fixed inset-0 bg-slate-950/70 backdrop-blur-xs z-[7000] flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl p-5 max-w-sm w-full shadow-2xl space-y-4 border border-slate-300 animate-in zoom-in-95 duration-150">
            <div className="flex items-center space-x-2.5 text-rose-600">
              <AlertCircle size={22} />
              <h3 className="text-sm font-black text-black">प्रतिवेदन सिट मेटाउने निश्चित हुनुहुन्छ?</h3>
            </div>
            
            <p className="text-xs text-black leading-relaxed">
              आर्थिक वर्ष <strong>{sheetToDelete.fiscalYear}</strong> को महिना <strong>{sheetToDelete.monthNp || sheetToDelete.month}</strong> को सुरक्षित प्रतिवेदन सिट हटाइनेछ।
            </p>

            <div className="flex justify-end space-x-2 pt-2 border-t border-slate-200">
              <button
                onClick={() => setSheetToDelete(null)}
                className="px-3.5 py-1.5 text-xs font-black text-black hover:bg-slate-100 rounded-lg cursor-pointer border border-slate-300"
              >
                रद्द गर्नुहोस्
              </button>
              <button
                onClick={() => handleDeleteSheet(sheetToDelete)}
                disabled={isDayEnded}
                title={isDayEnded ? getDayEndedBlockMessage() : undefined}
                className="px-4 py-1.5 text-xs font-black text-white bg-rose-600 hover:bg-rose-700 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg shadow-sm cursor-pointer"
              >
                Delete
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add / Edit Expense Modal (Individual entry if needed) */}
      <OfficeExpenseFormModal
        isOpen={isFormModalOpen}
        onClose={() => setIsFormModalOpen(false)}
        onSave={handleSaveExpense}
        editingExpense={editingExpense}
        branches={branches}
        currentBranchId={selectedBranchId === 'all' ? (currentBranch?.id || branches[0]?.id || 'main') : selectedBranchId}
        currentFiscalYear={selectedFiscalYear}
        currentMonth={selectedMonth === 'all' ? currentNd.monthName : selectedMonth}
        currentDate={currentNd.dateStr}
        fiscalYearsList={fiscalYearsList}
        user={user}
      />

      {/* Fixed Monthly Costs Setup Modal */}
      <FixedExpensesSetupModal
        isOpen={isFixedSetupModalOpen}
        onClose={async () => {
          setIsFixedSetupModalOpen(false);
          await loadData();
        }}
        branches={branches}
        currentFiscalYear={selectedFiscalYear}
        currentMonth={selectedMonth === 'all' ? currentNd.monthName : selectedMonth}
        onAutoGenerateFixed={handleAutoGenerateFixed}
        isGenerating={isGeneratingFixed}
      />

      {/* Electricity Monthly Unit Reading Modal */}
      <ElectricityUnitModal
        isOpen={isElectricityModalOpen}
        onClose={async () => {
          setIsElectricityModalOpen(false);
          await loadData();
        }}
        branches={branches}
        currentBranchId={selectedBranchId === 'all' ? (currentBranch?.id || branches[0]?.id || 'main') : selectedBranchId}
        currentFiscalYear={selectedFiscalYear}
        currentMonth={selectedMonth === 'all' ? currentNd.monthName : selectedMonth}
        currentDate={currentNd.dateStr}
        existingExpenses={expenses}
        onSaveElectricityExpense={handleSaveExpense}
        recordedBy={user?.fullName || 'Admin'}
      />

      {/* Full Statement Report Preview Modal with Print & Save Button */}
      <OfficeExpensePreviewModal
        isOpen={isPreviewModalOpen}
        onClose={() => setIsPreviewModalOpen(false)}
        expenses={expenses.filter(e => 
          (!modalTargetParams.fiscalYear || isSameFy(e.fiscalYear, modalTargetParams.fiscalYear)) &&
          (!modalTargetParams.month || modalTargetParams.month === 'all' || normalizeMonth(e.month) === normalizeMonth(modalTargetParams.month)) &&
          (!modalTargetParams.branchId || modalTargetParams.branchId === 'all' || e.branchId === modalTargetParams.branchId)
        )}
        allExpenses={expenses}
        branches={branches}
        selectedBranchId={modalTargetParams.branchId}
        selectedMonth={modalTargetParams.month}
        selectedFiscalYear={modalTargetParams.fiscalYear}
        settings={settings}
        employees={employees}
        autoPostToLedger={autoPostToLedger}
        onToggleAutoPost={setAutoPostToLedger}
        onExportCSV={handleExportCSV}
        onExpensesSaved={loadData}
        onOpenPaymentStatement={() => setIsPaymentStatementModalOpen(true)}
      />

      {/* English Payment Statement Modal for House Rent and Office Cleaner */}
      <PaymentStatementModal
        isOpen={isPaymentStatementModalOpen}
        onClose={() => setIsPaymentStatementModalOpen(false)}
        branches={branches}
        currentFiscalYear={selectedFiscalYear}
        currentMonth={selectedMonth === 'all' ? currentNd.monthName : selectedMonth}
        settings={settings}
        user={user}
      />

    </div>
  );
};

