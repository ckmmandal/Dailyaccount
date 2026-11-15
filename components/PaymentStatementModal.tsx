import React, { useState, useEffect, useMemo } from 'react';
import { 
  X, Printer, Download, Building2, 
  Home, Sparkles, UserCheck, Calendar,
  RefreshCw
} from 'lucide-react';
import { Branch, OfficeExpenseRecord, BranchFixedExpenseConfig, SavedOfficeExpenseSheet, SystemSettings, User } from '../types';
import { storageService } from '../services/storageService';
import { normalizeMonth, isSameFy, isBranchMatch } from '../utils/expenseHelpers';

const NEPALI_MONTH_ORDER_FY = [
  'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush', 
  'Magh', 'Falgun', 'Chaitra', 'Baishakh', 'Jestha', 'Ashadh'
];

export interface LandlordProfile {
  key: string;
  name: string;
  branchId: string;
  branchName: string;
  pan: string;
  bankName: string;
  accountNo: string;
  paymentMethod: string;
  defaultGross: number;
  defaultTds: number;
  defaultNet: number;
  tdsRate: number;
}

export interface CleanerProfile {
  key: string;
  name: string;
  isMerged: boolean;
  branchIds: string[];
  branchNames: string[];
  workingDays: string;
  bankName: string;
  accountNo: string;
  paymentMethod: string;
  defaultGross: number;
  defaultTds: number;
  defaultNet: number;
  tdsRate: number;
}

export interface HouseRentRow {
  sn: number;
  month: string;
  fiscalYear: string;
  grossAmount: number;
  taxAmount: number;
  netPaid: number;
  electricity: number;
  unit: number;
  addVat: number;
  totalPaid: number;
  date?: string;
  voucherNo?: string;
  remarks?: string;
}

export interface CleanerRow {
  sn: number;
  month: string;
  fiscalYear: string;
  grossAmount: number;
  taxAmount: number;
  paidAmount: number;
  branch: string;
  branchId: string;
  date?: string;
  voucherNo?: string;
  remarks?: string;
}

interface PaymentStatementModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
  currentFiscalYear: string;
  currentMonth: string;
  settings?: SystemSettings | null;
  user?: User | null;
}

// Convert numbers to English Words (Indian / Nepali Numbering System)
function numberToEnglishWords(num: number): string {
  if (!num || num === 0) return 'Zero Rupees Only';
  
  const ones = [
    '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
    'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
  ];
  const tens = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

  const convertLessThanOneThousand = (n: number): string => {
    if (n === 0) return '';
    if (n < 20) return ones[n];
    if (n < 100) return tens[Math.floor(n / 10)] + (n % 10 !== 0 ? ' ' + ones[n % 10] : '');
    return ones[Math.floor(n / 100)] + ' Hundred' + (n % 100 !== 0 ? ' ' + convertLessThanOneThousand(n % 100) : '');
  };

  const convert = (n: number): string => {
    if (n === 0) return '';
    if (n < 1000) return convertLessThanOneThousand(n);
    if (n < 100000) {
      return convertLessThanOneThousand(Math.floor(n / 1000)) + ' Thousand' + 
        (n % 1000 !== 0 ? ' ' + convertLessThanOneThousand(n % 1000) : '');
    }
    if (n < 10000000) {
      return convertLessThanOneThousand(Math.floor(n / 100000)) + ' Lakh' + 
        (n % 100000 !== 0 ? ' ' + convert(n % 100000) : '');
    }
    return convertLessThanOneThousand(Math.floor(n / 10000000)) + ' Crore' + 
      (n % 10000000 !== 0 ? ' ' + convert(n % 10000000) : '');
  };

  const integerPart = Math.floor(Math.abs(num));
  const decimalPart = Math.round((Math.abs(num) - integerPart) * 100);
  let words = convert(integerPart).trim() + ' Rupees';
  if (decimalPart > 0) {
    words += ' and ' + convertLessThanOneThousand(decimalPart).trim() + ' Paisa';
  }
  return words + ' Only';
}

// Convert '2083/2084' into '2083/84'
function formatFyShort(fy: string): string {
  if (!fy) return '2083/84';
  const parts = fy.split('/');
  if (parts.length === 2 && parts[1].length === 4) {
    return `${parts[0]}/${parts[1].slice(-2)}`;
  }
  return fy;
}

export const PaymentStatementModal: React.FC<PaymentStatementModalProps> = ({
  isOpen,
  onClose,
  branches,
  currentFiscalYear
}) => {
  // Category selection: 'house_rent' | 'cleaner_payment'
  const [statementCategory, setStatementCategory] = useState<'house_rent' | 'cleaner_payment'>('house_rent');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(currentFiscalYear || '2083/2084');

  // Selected Landlord Key and Cleaner Key
  const [selectedLandlordKey, setSelectedLandlordKey] = useState<string>('');
  const [selectedCleanerKey, setSelectedCleanerKey] = useState<string>('');

  // Data
  const [expenses, setExpenses] = useState<OfficeExpenseRecord[]>([]);
  const [configs, setConfigs] = useState<Record<string, BranchFixedExpenseConfig>>({});
  const [savedSheets, setSavedSheets] = useState<SavedOfficeExpenseSheet[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(true);

  // Load Data
  const loadData = async () => {
    setIsLoading(true);
    try {
      const [expData, cfgData, sheetData] = await Promise.all([
        storageService.getOfficeExpenses(),
        storageService.getFixedExpenseConfigs(),
        storageService.getSavedExpenseSheets()
      ]);
      setExpenses(expData || []);
      setConfigs(cfgData || {});
      setSavedSheets(sheetData || []);
    } catch (err) {
      console.error('Failed to load statement data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (isOpen) {
      loadData();
    }
  }, [isOpen]);

  // Extract Fiscal Years
  const fiscalYearsList = useMemo(() => {
    const set = new Set<string>();
    if (currentFiscalYear) set.add(currentFiscalYear);
    savedSheets.forEach(s => {
      if (s.fiscalYear) set.add(s.fiscalYear);
    });
    expenses.forEach(e => {
      if (e.fiscalYear) set.add(e.fiscalYear);
    });
    const arr = Array.from(set).filter(Boolean);
    if (arr.length === 0) return ['2083/2084', '2082/2083', '2081/2082'];
    return arr.sort().reverse();
  }, [expenses, savedSheets, currentFiscalYear]);

  // Map of Branch ID to Name
  const branchMap = useMemo(() => {
    const map = new Map<string, string>();
    branches.forEach(b => map.set(b.id, b.name));
    return map;
  }, [branches]);

  // 1. Build Landlord (Ghar Jaggadhani) List
  const landlordsList = useMemo<LandlordProfile[]>(() => {
    const list: LandlordProfile[] = [];

    branches.forEach(b => {
      const cfg = configs[b.id];
      const pName = (cfg && cfg.landlordName) ? cfg.landlordName : `Landlord (${b.name})`;
      const pan = (cfg && cfg.landlordPan) ? cfg.landlordPan : 'N/A';
      const net = (cfg && cfg.rentNetPaid) ? cfg.rentNetPaid : 15000;
      const gross = (cfg && cfg.rentAmount) ? cfg.rentAmount : (net / 0.9);
      const tds = parseFloat((gross - net).toFixed(2));

      list.push({
        key: `ll_${b.id}`,
        name: pName,
        branchId: b.id,
        branchName: b.name,
        pan,
        bankName: (cfg && cfg.rentBankName) ? cfg.rentBankName : 'Cooperative Account',
        accountNo: (cfg && cfg.rentAccountNo) ? cfg.rentAccountNo : 'N/A',
        paymentMethod: (cfg && cfg.rentPaymentMethod) ? cfg.rentPaymentMethod : 'Account Transfer',
        defaultGross: parseFloat(gross.toFixed(2)),
        defaultTds: tds,
        defaultNet: parseFloat(net.toFixed(2)),
        tdsRate: (cfg && cfg.rentTdsRate !== undefined) ? cfg.rentTdsRate : 10
      });
    });

    // Check for custom landlord names in expenses
    expenses.forEach(e => {
      if (e.category === 'house_rent' && e.landlordName) {
        const cleanName = e.landlordName.trim();
        const exists = list.some(l => l.name.toLowerCase() === cleanName.toLowerCase() && l.branchId === e.branchId);
        if (!exists) {
          const gross = e.amount || 0;
          const tds = e.taxDeduction || 0;
          const net = e.netPaidAmount !== undefined ? e.netPaidAmount : (gross - tds);
          list.push({
            key: `ll_exp_${e.branchId}_${cleanName}`,
            name: cleanName,
            branchId: e.branchId,
            branchName: branchMap.get(e.branchId) || e.branchId,
            pan: e.panVatNo || 'N/A',
            bankName: e.bankName || 'Direct Credit',
            accountNo: e.accountNo || 'N/A',
            paymentMethod: e.paymentMethod || 'Account Transfer',
            defaultGross: gross,
            defaultTds: tds,
            defaultNet: net,
            tdsRate: gross > 0 && tds > 0 ? Math.round((tds / gross) * 100) : 10
          });
        }
      }
    });

    return list;
  }, [branches, configs, expenses, branchMap]);

  // Set initial landlord key if not set
  useEffect(() => {
    if (landlordsList.length > 0 && !selectedLandlordKey) {
      setSelectedLandlordKey(landlordsList[0].key);
    }
  }, [landlordsList, selectedLandlordKey]);

  // 2. Build Cleaners List (With Multi-Branch Merged Statement support)
  const cleanersList = useMemo<CleanerProfile[]>(() => {
    // Gather all cleaners by clean person name
    const byName = new Map<string, {
      name: string;
      branchIds: string[];
      branchNames: string[];
      workingDays: string;
      bankName: string;
      accountNo: string;
      paymentMethod: string;
      defaultGross: number;
      defaultTds: number;
      defaultNet: number;
      tdsRate: number;
    }>();

    // From configs
    branches.forEach(b => {
      const cfg = configs[b.id];
      const rawName = (cfg && cfg.cleanerName) ? cfg.cleanerName.trim() : `Cleaner (${b.name})`;
      const cleanKey = rawName.toLowerCase();

      const net = (cfg && cfg.cleanerNetPaid) ? cfg.cleanerNetPaid : ((cfg && cfg.cleanerAmount) ? cfg.cleanerAmount : 8000);
      const gross = (cfg && cfg.cleanerAmount) ? cfg.cleanerAmount : net;
      const tds = parseFloat((gross - net).toFixed(2));
      const days = (cfg && cfg.cleanerWorkingDays) ? `${cfg.cleanerWorkingDays} Days` : '30 Days';

      if (!byName.has(cleanKey)) {
        byName.set(cleanKey, {
          name: rawName,
          branchIds: [b.id],
          branchNames: [b.name],
          workingDays: days,
          bankName: (cfg && cfg.cleanerBankName) ? cfg.cleanerBankName : 'Cooperative Account',
          accountNo: (cfg && cfg.cleanerAccountNo) ? cfg.cleanerAccountNo : 'N/A',
          paymentMethod: (cfg && cfg.cleanerPaymentMethod) ? cfg.cleanerPaymentMethod : 'Account Transfer',
          defaultGross: parseFloat(gross.toFixed(2)),
          defaultTds: tds,
          defaultNet: parseFloat(net.toFixed(2)),
          tdsRate: (cfg && cfg.cleanerTdsRate !== undefined) ? cfg.cleanerTdsRate : 0
        });
      } else {
        const existing = byName.get(cleanKey)!;
        if (!existing.branchIds.includes(b.id)) {
          existing.branchIds.push(b.id);
          existing.branchNames.push(b.name);
          existing.defaultGross += parseFloat(gross.toFixed(2));
          existing.defaultTds += tds;
          existing.defaultNet += parseFloat(net.toFixed(2));
        }
      }
    });

    // Also check expenses for cleaners
    expenses.forEach(e => {
      if (e.category === 'cleaner_payment' && e.cleanerName) {
        const rawName = e.cleanerName.trim();
        const cleanKey = rawName.toLowerCase();
        const bName = branchMap.get(e.branchId) || e.branchId;

        if (!byName.has(cleanKey)) {
          const gross = e.amount || 0;
          const tds = e.taxDeduction || 0;
          const net = e.netPaidAmount !== undefined ? e.netPaidAmount : (gross - tds);
          byName.set(cleanKey, {
            name: rawName,
            branchIds: [e.branchId],
            branchNames: [bName],
            workingDays: e.workingDays ? `${e.workingDays} Days` : 'Full Month',
            bankName: e.bankName || 'Direct Credit',
            accountNo: e.accountNo || 'N/A',
            paymentMethod: e.paymentMethod || 'Account Transfer',
            defaultGross: gross,
            defaultTds: tds,
            defaultNet: net,
            tdsRate: gross > 0 && tds > 0 ? Math.round((tds / gross) * 100) : 0
          });
        } else {
          const existing = byName.get(cleanKey)!;
          if (!existing.branchIds.includes(e.branchId)) {
            existing.branchIds.push(e.branchId);
            existing.branchNames.push(bName);
          }
        }
      }
    });

    const result: CleanerProfile[] = [];
    byName.forEach((val, key) => {
      const isMulti = val.branchIds.length > 1;
      result.push({
        key: `cleaner_${key}`,
        name: val.name,
        isMerged: isMulti,
        branchIds: val.branchIds,
        branchNames: val.branchNames,
        workingDays: val.workingDays,
        bankName: val.bankName,
        accountNo: val.accountNo,
        paymentMethod: val.paymentMethod,
        defaultGross: val.defaultGross,
        defaultTds: val.defaultTds,
        defaultNet: val.defaultNet,
        tdsRate: val.tdsRate
      });
    });

    return result;
  }, [branches, configs, expenses, branchMap]);

  // Set initial cleaner key if not set
  useEffect(() => {
    if (cleanersList.length > 0 && !selectedCleanerKey) {
      setSelectedCleanerKey(cleanersList[0].key);
    }
  }, [cleanersList, selectedCleanerKey]);

  // Active Landlord
  const currentLandlord = useMemo<LandlordProfile | null>(() => {
    if (!selectedLandlordKey) return landlordsList[0] || null;
    return landlordsList.find(l => l.key === selectedLandlordKey) || landlordsList[0] || null;
  }, [landlordsList, selectedLandlordKey]);

  // Active Cleaner
  const currentCleaner = useMemo<CleanerProfile | null>(() => {
    if (!selectedCleanerKey) return cleanersList[0] || null;
    return cleanersList.find(c => c.key === selectedCleanerKey) || cleanersList[0] || null;
  }, [cleanersList, selectedCleanerKey]);

  // 3. Helper: Check if a month has actually been generated for the target FY
  // "sheet generate jun mahina ko hunchh tyo mahina ko matrai statement ma aaune banaunus"
  const getGeneratedMonths = (fy: string, targetBranchIds: string[]): string[] => {
    const generatedMonthsSet = new Set<string>();

    // 1. Check in savedSheets
    savedSheets.forEach(s => {
      if (isSameFy(s.fiscalYear, fy)) {
        const matchBranch = targetBranchIds.length === 0 || 
          s.branchId === 'all' || 
          targetBranchIds.includes(s.branchId) ||
          targetBranchIds.some(bid => isBranchMatch(s.branchId, bid));
        if (matchBranch && s.month) {
          generatedMonthsSet.add(normalizeMonth(s.month));
        }
      }
    });

    // 2. Check in expenses records
    expenses.forEach(e => {
      if (isSameFy(e.fiscalYear, fy)) {
        const matchBranch = targetBranchIds.length === 0 || 
          targetBranchIds.includes(e.branchId) ||
          targetBranchIds.some(bid => isBranchMatch(e.branchId, bid));
        if (matchBranch && e.month) {
          generatedMonthsSet.add(normalizeMonth(e.month));
        }
      }
    });

    // Filter NEPALI_MONTH_ORDER_FY preserving chronological order
    return NEPALI_MONTH_ORDER_FY.filter(m => generatedMonthsSet.has(normalizeMonth(m)));
  };

  // 4. HOUSE RENT STATEMENT ROWS
  // Columns: S.N., Month, Gross Amount, Tax, Net Paid, Electricity, Unit, Add Vat, Total Paid
  const houseRentRows = useMemo<HouseRentRow[]>(() => {
    if (!currentLandlord) return [];

    const targetBranchId = currentLandlord.branchId;
    const generatedMonths = getGeneratedMonths(selectedFiscalYear, [targetBranchId]);
    const cfg = configs[targetBranchId];

    return generatedMonths.map((m, idx) => {
      const normMonth = normalizeMonth(m);

      // Find recorded rent expense
      const rentExp = expenses.find(e => 
        e.category === 'house_rent' &&
        isSameFy(e.fiscalYear, selectedFiscalYear) &&
        normalizeMonth(e.month) === normMonth &&
        isBranchMatch(e.branchId, targetBranchId)
      );

      // Find recorded electricity expense
      const elecExp = expenses.find(e => 
        e.category === 'electricity_bill' &&
        isSameFy(e.fiscalYear, selectedFiscalYear) &&
        normalizeMonth(e.month) === normMonth &&
        isBranchMatch(e.branchId, targetBranchId)
      );

      // Rent Gross, Tax, Net
      let rentGross = 0;
      let rentTax = 0;
      let rentNet = 0;

      if (rentExp && rentExp.amount) {
        rentGross = rentExp.amount;
        rentTax = rentExp.taxDeduction || 0;
        rentNet = rentExp.netPaidAmount !== undefined ? rentExp.netPaidAmount : (rentGross - rentTax);
      } else if (cfg && cfg.rentAmount) {
        rentGross = cfg.rentAmount;
        rentTax = cfg.rentAmount * ((cfg.rentTdsRate !== undefined ? cfg.rentTdsRate : 10) / 100);
        rentNet = cfg.rentNetPaid !== undefined ? cfg.rentNetPaid : (rentGross - rentTax);
      } else {
        rentGross = currentLandlord.defaultGross;
        rentTax = currentLandlord.defaultTds;
        rentNet = currentLandlord.defaultNet;
      }

      // Electricity calculations
      const elecUnit = elecExp?.consumedUnits !== undefined ? elecExp.consumedUnits : 0;
      const elecRate = elecExp?.ratePerUnit !== undefined ? elecExp.ratePerUnit : 12;

      let elecBase = elecUnit > 0 ? parseFloat((elecUnit * elecRate).toFixed(2)) : 0;
      // Tax / Add Vat: only if explicitly ticked/deducted in Unit Khapat
      let elecTax = (elecExp && elecExp.taxDeduction !== undefined && elecExp.taxDeduction > 0)
        ? elecExp.taxDeduction
        : 0;

      let elecCharge = 0;
      if (elecExp) {
        if (elecExp.netPaidAmount !== undefined && elecExp.netPaidAmount > 0) {
          elecCharge = elecExp.netPaidAmount;
        } else if (elecExp.amount !== undefined && elecExp.amount > 0) {
          elecCharge = elecExp.amount;
        } else {
          elecCharge = parseFloat((elecBase + elecTax).toFixed(2));
        }
      } else {
        elecCharge = elecBase;
      }

      if (elecBase === 0 && elecCharge > 0) {
        elecBase = Math.max(0, parseFloat((elecCharge - elecTax).toFixed(2)));
      }

      // Total Paid = Net Paid Rent + Total Electricity Charge
      const totalPaid = parseFloat((rentNet + elecCharge).toFixed(2));

      return {
        sn: idx + 1,
        month: m,
        fiscalYear: selectedFiscalYear,
        grossAmount: parseFloat(rentGross.toFixed(2)),
        taxAmount: parseFloat(rentTax.toFixed(2)),
        netPaid: parseFloat(rentNet.toFixed(2)),
        electricity: parseFloat(elecBase.toFixed(2)),
        unit: elecUnit,
        addVat: parseFloat(elecTax.toFixed(2)),
        totalPaid,
        date: rentExp?.date,
        voucherNo: rentExp?.voucherNo,
        remarks: rentExp?.remarks
      };
    });
  }, [currentLandlord, expenses, configs, savedSheets, selectedFiscalYear]);

  // House Rent Grand Totals
  const rentTotals = useMemo(() => {
    let gross = 0;
    let tax = 0;
    let net = 0;
    let electricity = 0;
    let unit = 0;
    let addVat = 0;
    let total = 0;

    houseRentRows.forEach(r => {
      gross += r.grossAmount;
      tax += r.taxAmount;
      net += r.netPaid;
      electricity += r.electricity;
      unit += r.unit;
      addVat += r.addVat;
      total += r.totalPaid;
    });

    return {
      gross: parseFloat(gross.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      net: parseFloat(net.toFixed(2)),
      electricity: parseFloat(electricity.toFixed(2)),
      unit,
      addVat: parseFloat(addVat.toFixed(2)),
      total: parseFloat(total.toFixed(2))
    };
  }, [houseRentRows]);

  // 5. CLEANER STATEMENT ROWS (With Multi-Branch Merged Statement Support)
  // Columns: S.N., Month, Gross Amount, Tax, Paid Amount, Branch
  const cleanerRows = useMemo<CleanerRow[]>(() => {
    if (!currentCleaner) return [];

    const generatedMonths = getGeneratedMonths(selectedFiscalYear, currentCleaner.branchIds);
    const rows: CleanerRow[] = [];
    let snCounter = 1;

    generatedMonths.forEach(m => {
      const normMonth = normalizeMonth(m);

      // For each branch this cleaner works in
      currentCleaner.branchIds.forEach(branchId => {
        const bName = branchMap.get(branchId) || branchId;
        const cfg = configs[branchId];

        // Find recorded cleaner expense for this branch & month
        const cleanerExp = expenses.find(e =>
          e.category === 'cleaner_payment' &&
          isSameFy(e.fiscalYear, selectedFiscalYear) &&
          normalizeMonth(e.month) === normMonth &&
          isBranchMatch(e.branchId, branchId)
        );

        let gross = 0;
        let tax = 0;
        let paid = 0;

        if (cleanerExp && cleanerExp.amount) {
          gross = cleanerExp.amount;
          tax = cleanerExp.taxDeduction || 0;
          paid = cleanerExp.netPaidAmount !== undefined ? cleanerExp.netPaidAmount : (gross - tax);
        } else if (cfg && (cfg.cleanerAmount || cfg.cleanerNetPaid)) {
          paid = cfg.cleanerNetPaid || cfg.cleanerAmount || 8000;
          gross = cfg.cleanerAmount || paid;
          tax = parseFloat((gross - paid).toFixed(2));
        } else {
          gross = 8000;
          tax = 0;
          paid = 8000;
        }

        rows.push({
          sn: snCounter++,
          month: m,
          fiscalYear: selectedFiscalYear,
          grossAmount: parseFloat(gross.toFixed(2)),
          taxAmount: parseFloat(tax.toFixed(2)),
          paidAmount: parseFloat(paid.toFixed(2)),
          branch: bName,
          branchId,
          date: cleanerExp?.date,
          voucherNo: cleanerExp?.voucherNo,
          remarks: cleanerExp?.remarks
        });
      });
    });

    return rows;
  }, [currentCleaner, expenses, configs, savedSheets, selectedFiscalYear, branchMap]);

  // Cleaner Grand Totals
  const cleanerTotals = useMemo(() => {
    let gross = 0;
    let tax = 0;
    let paid = 0;

    cleanerRows.forEach(r => {
      gross += r.grossAmount;
      tax += r.taxAmount;
      paid += r.paidAmount;
    });

    return {
      gross: parseFloat(gross.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      paid: parseFloat(paid.toFixed(2)),
      count: cleanerRows.length
    };
  }, [cleanerRows]);

  // Format Currency
  const formatCurrency = (val: number): string => {
    return 'Rs. ' + val.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
  };

  // CSV Export for House Rent
  const handleExportHouseRentCSV = () => {
    if (!currentLandlord) return;

    const headers = [
      'S.N.',
      'Month',
      'Gross Amount (NPR)',
      'Tax / TDS (NPR)',
      'Net Paid (NPR)',
      'Electricity (NPR)',
      'Unit',
      'Add Vat (NPR)',
      'Total Paid (NPR)'
    ];

    const rows = houseRentRows.map(r => [
      r.sn,
      `"${r.month}"`,
      r.grossAmount.toFixed(2),
      r.taxAmount.toFixed(2),
      r.netPaid.toFixed(2),
      r.electricity.toFixed(2),
      r.unit,
      r.addVat.toFixed(2),
      r.totalPaid.toFixed(2)
    ]);

    rows.push([
      'TOTAL',
      '',
      rentTotals.gross.toFixed(2),
      rentTotals.tax.toFixed(2),
      rentTotals.net.toFixed(2),
      rentTotals.electricity.toFixed(2),
      rentTotals.unit.toString(),
      rentTotals.addVat.toFixed(2),
      rentTotals.total.toFixed(2)
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      `"HOUSE RENT STATEMENT"\n` +
      `"LANDLORD: ${currentLandlord.name}"\n` +
      `"BRANCH: ${currentLandlord.branchName}"\n` +
      `"FY: ${formatFyShort(selectedFiscalYear)}, Shrawan to Ashadh"\n\n` +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    const safeName = currentLandlord.name.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `House_Rent_Statement_${safeName}_${formatFyShort(selectedFiscalYear).replace('/', '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // CSV Export for Cleaner
  const handleExportCleanerCSV = () => {
    if (!currentCleaner) return;

    const headers = [
      'S.N.',
      'Month',
      'Gross Amount (NPR)',
      'Tax (NPR)',
      'Paid Amount (NPR)',
      'Branch'
    ];

    const rows = cleanerRows.map(r => [
      r.sn,
      `"${r.month}"`,
      r.grossAmount.toFixed(2),
      r.taxAmount.toFixed(2),
      r.paidAmount.toFixed(2),
      `"${r.branch}"`
    ]);

    rows.push([
      'TOTAL',
      '',
      cleanerTotals.gross.toFixed(2),
      cleanerTotals.tax.toFixed(2),
      cleanerTotals.paid.toFixed(2),
      `"${currentCleaner.isMerged ? 'Merged Statement' : currentCleaner.branchNames.join(', ')}"`
    ]);

    const csvContent = 'data:text/csv;charset=utf-8,' +
      `"OFFICE CLEANER STATEMENT"\n` +
      `"CLEANER: ${currentCleaner.name} ${currentCleaner.isMerged ? '(Merged Statement)' : ''}"\n` +
      `"BRANCHES: ${currentCleaner.branchNames.join(', ')}"\n` +
      `"FY: ${formatFyShort(selectedFiscalYear)}, Shrawan to Ashadh"\n\n` +
      [headers.join(','), ...rows.map(e => e.join(','))].join('\n');

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    const safeName = currentCleaner.name.replace(/[^a-zA-Z0-9]/g, '_');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `Cleaner_Statement_${safeName}_${formatFyShort(selectedFiscalYear).replace('/', '-')}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const handlePrint = () => {
    window.print();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/85 backdrop-blur-xs p-2 sm:p-4 overflow-y-auto animate-in fade-in duration-200">
      
      {/* Print Specific CSS */}
      <style>{`
        @media print {
          body * {
            visibility: hidden;
          }
          #printable-statement-container, #printable-statement-container * {
            visibility: visible;
          }
          #printable-statement-container {
            position: absolute;
            left: 0;
            top: 0;
            width: 100%;
            margin: 0;
            padding: 8mm;
            background: #ffffff !important;
            color: #000000 !important;
          }
          .no-print {
            display: none !important;
          }
          table {
            width: 100% !important;
            border-collapse: collapse !important;
          }
          th, td {
            border: 1px solid #333333 !important;
            padding: 5px 8px !important;
            font-size: 10px !important;
          }
          th {
            background-color: #f1f5f9 !important;
            color: #000000 !important;
            font-weight: bold !important;
          }
        }
      `}</style>

      <div 
        id="printable-statement-container"
        className="bg-white w-full max-w-6xl rounded-2xl shadow-2xl border border-slate-300 flex flex-col max-h-[94vh] overflow-hidden my-auto"
      >
        
        {/* Top Header Controls Bar (no-print) */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex flex-wrap items-center justify-between gap-3 border-b border-slate-800 no-print">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-emerald-500/20 text-emerald-400 rounded-xl border border-emerald-500/30">
              <Building2 size={20} />
            </div>
            <div>
              <div className="flex items-center space-x-2">
                <h2 className="text-base font-bold text-white tracking-tight">
                  {statementCategory === 'house_rent' ? 'House Rent Statement' : 'Office Cleaner Statement'}
                </h2>
                <span className="bg-emerald-500/20 text-emerald-300 text-[11px] font-bold px-2 py-0.5 rounded-full border border-emerald-500/40">
                  English Statement
                </span>
              </div>
              <p className="text-xs text-slate-400">
                Official statement generated for recorded expense months
              </p>
            </div>
          </div>

          <div className="flex items-center space-x-2">
            {/* Export CSV */}
            <button
              onClick={statementCategory === 'house_rent' ? handleExportHouseRentCSV : handleExportCleanerCSV}
              className="px-3 py-1.5 bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold rounded-lg border border-slate-700 flex items-center space-x-1.5 transition-all cursor-pointer shadow-xs"
              title="Download Statement in CSV format"
            >
              <Download size={14} className="text-emerald-400" />
              <span>Export CSV</span>
            </button>

            {/* Print Statement */}
            <button
              onClick={handlePrint}
              className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold rounded-lg flex items-center space-x-1.5 transition-all cursor-pointer shadow-md"
              title="Print official payment statement"
            >
              <Printer size={14} />
              <span>Print Statement</span>
            </button>

            {/* Close */}
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white hover:bg-slate-800 rounded-lg transition-colors cursor-pointer ml-1"
              title="Close window"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Dropdowns Toolbar (no-print) */}
        <div className="bg-slate-50 border-b border-slate-200 px-5 py-3 flex flex-wrap items-center justify-between gap-3 no-print">
          
          {/* Category Toggle: House Rent (Landlords) vs Office Cleaner */}
          <div className="flex items-center space-x-2">
            <span className="text-xs font-bold text-slate-500 uppercase tracking-wider">Statement:</span>
            <div className="flex items-center bg-slate-200/80 p-1 rounded-xl border border-slate-300">
              <button
                onClick={() => setStatementCategory('house_rent')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                  statementCategory === 'house_rent'
                    ? 'bg-white text-blue-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Home size={13} className={statementCategory === 'house_rent' ? 'text-blue-600' : ''} />
                <span>House Rent (Landlord)</span>
              </button>
              <button
                onClick={() => setStatementCategory('cleaner_payment')}
                className={`px-3 py-1 text-xs font-bold rounded-lg transition-all flex items-center space-x-1.5 cursor-pointer ${
                  statementCategory === 'cleaner_payment'
                    ? 'bg-white text-emerald-900 shadow-xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Sparkles size={13} className={statementCategory === 'cleaner_payment' ? 'text-emerald-600' : ''} />
                <span>Office Cleaner</span>
              </button>
            </div>
          </div>

          {/* Side-by-side Dropdowns: Landlord / Cleaner Dropdown + FY Dropdown */}
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Landlord Dropdown */}
            {statementCategory === 'house_rent' && (
              <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs shadow-2xs">
                <UserCheck size={14} className="text-slate-600" />
                <span className="font-bold text-slate-700">Landlord:</span>
                <select
                  value={selectedLandlordKey}
                  onChange={(e) => setSelectedLandlordKey(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer max-w-[260px]"
                >
                  {landlordsList.map(ll => (
                    <option key={ll.key} value={ll.key}>
                      {ll.name} — {ll.branchName}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Cleaner Dropdown (With Merged Statement Support) */}
            {statementCategory === 'cleaner_payment' && (
              <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs shadow-2xs">
                <UserCheck size={14} className="text-slate-600" />
                <span className="font-bold text-slate-700">Cleaner:</span>
                <select
                  value={selectedCleanerKey}
                  onChange={(e) => setSelectedCleanerKey(e.target.value)}
                  className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer max-w-[300px]"
                >
                  {cleanersList.map(c => (
                    <option key={c.key} value={c.key}>
                      {c.name} {c.isMerged ? `(${c.branchNames.join(' & ')} - Merged)` : `— ${c.branchNames[0] || 'Office'}`}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {/* Fiscal Year Dropdown (Side-by-side) */}
            <div className="flex items-center space-x-1.5 bg-white border border-slate-300 rounded-lg px-3 py-1.5 text-xs shadow-2xs">
              <Calendar size={14} className="text-slate-600" />
              <span className="font-bold text-slate-700">FY:</span>
              <select
                value={selectedFiscalYear}
                onChange={(e) => setSelectedFiscalYear(e.target.value)}
                className="bg-transparent font-bold text-slate-900 outline-none cursor-pointer"
              >
                {fiscalYearsList.map(fy => (
                  <option key={fy} value={fy}>{fy}</option>
                ))}
              </select>
            </div>

            {/* Refresh */}
            <button
              onClick={loadData}
              className="p-1.5 bg-white border border-slate-300 hover:bg-slate-100 rounded-lg text-slate-600 transition-colors cursor-pointer"
              title="Reload Statement Data"
            >
              <RefreshCw size={14} className={isLoading ? 'animate-spin' : ''} />
            </button>
          </div>
        </div>

        {/* ===================== STATEMENT CONTENT BODY ===================== */}
        <div className="overflow-auto flex-1 p-6 space-y-4">
          
          {/* Formal Letterhead */}
          <div className="text-center space-y-1 pb-2">
            <h1 className="text-lg sm:text-xl font-black tracking-tight text-slate-900 uppercase">
              Ratauli Saving and Credit Cooperative Limited
            </h1>
            <p className="text-xs font-semibold text-slate-600">
              Central Office: Pipra Rural Municipality - 06, Mahottari, Madhesh Province, Nepal
            </p>
            
            {/* Updated Title: HOUSE RENT STATEMENT / OFFICE CLEANER STATEMENT */}
            <div className="inline-block bg-slate-100 border border-slate-300 px-6 py-1 rounded-md mt-1">
              <h2 className="text-xs sm:text-sm font-black text-slate-900 uppercase tracking-wide">
                {statementCategory === 'house_rent' ? 'House Rent Statement' : 'Office Cleaner Statement'}
              </h2>
            </div>

            {/* Updated Period line: FY: 2083/84, Shrawan to Ashadh */}
            <p className="text-xs text-slate-600 font-bold mt-1">
              FY: {formatFyShort(selectedFiscalYear)}, Shrawan to Ashadh
            </p>
          </div>

          {/* Beneficiary Profile Card */}
          {statementCategory === 'house_rent' && currentLandlord && (
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Landlord (Ghar Jaggadhani)</span>
                  <div className="text-sm font-black text-slate-900">{currentLandlord.name}</div>
                  <div className="text-slate-500 font-medium">Property Owner</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Branch & PAN</span>
                  <div className="font-bold text-slate-900">{currentLandlord.branchName}</div>
                  <div className="font-mono text-slate-600">{currentLandlord.pan !== 'N/A' ? `PAN: ${currentLandlord.pan}` : 'PAN: N/A'}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Disbursing Bank & A/C</span>
                  <div className="font-bold text-slate-900">{currentLandlord.bankName}</div>
                  <div className="font-mono text-slate-600">{currentLandlord.accountNo !== 'N/A' ? `A/C: ${currentLandlord.accountNo}` : 'Cooperative Account'}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Agreed Monthly Rent</span>
                  <div className="font-bold text-slate-900">
                    Net: <span className="text-emerald-800 font-black">{formatCurrency(currentLandlord.defaultNet)}</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Gross: {formatCurrency(currentLandlord.defaultGross)} | Tax: {currentLandlord.tdsRate}%
                  </div>
                </div>
              </div>
            </div>
          )}

          {statementCategory === 'cleaner_payment' && currentCleaner && (
            <div className="bg-slate-50 border border-slate-300 rounded-xl p-3.5">
              <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-4 gap-3 text-xs">
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Cleaner Staff</span>
                  <div className="text-sm font-black text-slate-900">{currentCleaner.name}</div>
                  <div className="text-emerald-700 font-bold">
                    {currentCleaner.isMerged ? 'Multi-Branch Merged Statement' : 'Office Cleaning Staff'}
                  </div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Operating Branch(es)</span>
                  <div className="font-bold text-slate-900">{currentCleaner.branchNames.join(', ')}</div>
                  <div className="text-slate-600">{currentCleaner.workingDays}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Disbursement Channel</span>
                  <div className="font-bold text-slate-900">{currentCleaner.bankName}</div>
                  <div className="font-mono text-slate-600">{currentCleaner.accountNo !== 'N/A' ? `A/C: ${currentCleaner.accountNo}` : 'Account Transfer'}</div>
                </div>
                <div>
                  <span className="text-[10px] font-bold text-slate-400 uppercase tracking-wider block">Standard Monthly Remuneration</span>
                  <div className="font-bold text-slate-900">
                    Net: <span className="text-emerald-800 font-black">{formatCurrency(currentCleaner.defaultNet)}</span>
                  </div>
                  <div className="text-slate-500 text-[11px]">
                    Gross: {formatCurrency(currentCleaner.defaultGross)}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* ===================== TABLE 1: HOUSE RENT STATEMENT ===================== */}
          {statementCategory === 'house_rent' && (
            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-[10px] sm:text-[10.5px] tracking-wider border-b-2 border-slate-300">
                    <th className="py-2.5 px-2 text-center w-10 border-r border-slate-300">S.N.</th>
                    <th className="py-2.5 px-3 w-28 border-r border-slate-300">Month</th>
                    <th className="py-2.5 px-3 text-right w-28 border-r border-slate-300">Gross Amount</th>
                    <th className="py-2.5 px-2.5 text-right w-24 border-r border-slate-300">Tax</th>
                    <th className="py-2.5 px-3 text-right w-28 border-r border-slate-300 bg-slate-200/50">Net Paid</th>
                    <th className="py-2.5 px-2.5 text-right w-24 border-r border-slate-300">Electricity</th>
                    <th className="py-2.5 px-2 text-center w-16 border-r border-slate-300">Unit</th>
                    <th className="py-2.5 px-2 text-right w-20 border-r border-slate-300">Add Vat</th>
                    <th className="py-2.5 px-3 text-right w-32 border-r border-slate-300 bg-emerald-50 text-emerald-950 font-black">
                      Total Paid
                    </th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {houseRentRows.length === 0 ? (
                    <tr>
                      <td colSpan={9} className="py-12 text-center text-slate-400 italic">
                        No expense sheets have been generated for {currentLandlord?.name} in FY {selectedFiscalYear} yet.
                        <div className="text-[11px] text-slate-400 mt-1">
                          (Statement only displays months for which monthly expense sheets are generated)
                        </div>
                      </td>
                    </tr>
                  ) : (
                    houseRentRows.map((row) => (
                      <tr key={row.month} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-2 text-center font-bold text-slate-500 border-r border-slate-300">
                          {row.sn}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-300">
                          {row.month}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-900 border-r border-slate-300">
                          {row.grossAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-amber-800 border-r border-slate-300">
                          {row.taxAmount > 0
                            ? row.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '0.00'
                          }
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-bold text-slate-900 bg-slate-50/50 border-r border-slate-300">
                          {row.netPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-2.5 text-right font-mono text-slate-800 border-r border-slate-300">
                          {row.electricity > 0
                            ? row.electricity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '0.00'
                          }
                        </td>
                        <td className="py-2 px-2 text-center font-mono text-slate-700 border-r border-slate-300">
                          {row.unit > 0 ? row.unit : '0'}
                        </td>
                        <td className="py-2 px-2 text-right font-mono text-amber-700 border-r border-slate-300">
                          {row.addVat > 0
                            ? row.addVat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '0.00'
                          }
                        </td>
                        <td className="py-2 px-3 text-right font-mono font-black text-emerald-900 bg-emerald-50/60 border-r border-slate-300">
                          {row.totalPaid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {houseRentRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-200/90 text-slate-900 font-black border-t-2 border-slate-400 text-xs">
                      <td colSpan={2} className="py-2.5 px-3 text-center uppercase tracking-wider border-r border-slate-300">
                        Total ({houseRentRows.length} Mos):
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono border-r border-slate-300">
                        {rentTotals.gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono text-amber-900 border-r border-slate-300">
                        {rentTotals.tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono bg-slate-300/70 border-r border-slate-300">
                        {rentTotals.net.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2.5 text-right font-mono border-r border-slate-300">
                        {rentTotals.electricity.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-2 text-center font-mono border-r border-slate-300">
                        {rentTotals.unit}
                      </td>
                      <td className="py-2.5 px-2 text-right font-mono text-amber-900 border-r border-slate-300">
                        {rentTotals.addVat.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-emerald-950 bg-emerald-100/90 border-r border-slate-300">
                        Rs. {rentTotals.total.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* In Words Callout for House Rent */}
          {statementCategory === 'house_rent' && houseRentRows.length > 0 && (
            <div className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs">
              <span className="font-bold text-slate-500 uppercase tracking-wider mr-2">Total Paid In Words:</span>
              <span className="font-black text-slate-900 italic">
                {numberToEnglishWords(rentTotals.total)}
              </span>
            </div>
          )}

          {/* ===================== TABLE 2: CLEANER STATEMENT ===================== */}
          {/* Columns: S.N., Month, Gross Amount, Tax, Paid Amount, Branch */}
          {statementCategory === 'cleaner_payment' && (
            <div className="border border-slate-300 rounded-xl overflow-hidden shadow-2xs">
              <table className="w-full text-left border-collapse text-xs">
                <thead>
                  <tr className="bg-slate-100 text-slate-900 font-bold uppercase text-[10px] sm:text-[10.5px] tracking-wider border-b-2 border-slate-300">
                    <th className="py-2.5 px-2 text-center w-12 border-r border-slate-300">S.N.</th>
                    <th className="py-2.5 px-3 w-32 border-r border-slate-300">Month</th>
                    <th className="py-2.5 px-3 text-right w-36 border-r border-slate-300">Gross Amount</th>
                    <th className="py-2.5 px-3 text-right w-32 border-r border-slate-300">Tax</th>
                    <th className="py-2.5 px-4 text-right w-36 border-r border-slate-300 bg-emerald-50 text-emerald-950 font-black">
                      Paid Amount
                    </th>
                    <th className="py-2.5 px-4 min-w-[200px]">Branch</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-200 text-slate-800">
                  {cleanerRows.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="py-12 text-center text-slate-400 italic">
                        No expense sheets have been generated for {currentCleaner?.name} in FY {selectedFiscalYear} yet.
                        <div className="text-[11px] text-slate-400 mt-1">
                          (Statement only displays months for which monthly expense sheets are generated)
                        </div>
                      </td>
                    </tr>
                  ) : (
                    cleanerRows.map((row) => (
                      <tr key={`${row.month}_${row.branchId}`} className="hover:bg-slate-50/80 transition-colors">
                        <td className="py-2 px-2 text-center font-bold text-slate-500 border-r border-slate-300">
                          {row.sn}
                        </td>
                        <td className="py-2 px-3 font-bold text-slate-900 border-r border-slate-300">
                          {row.month}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-slate-900 border-r border-slate-300">
                          {row.grossAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-3 text-right font-mono text-amber-800 border-r border-slate-300">
                          {row.taxAmount > 0
                            ? row.taxAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                            : '0.00'
                          }
                        </td>
                        <td className="py-2 px-4 text-right font-mono font-black text-emerald-900 bg-emerald-50/50 border-r border-slate-300">
                          {row.paidAmount.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>
                        <td className="py-2 px-4 font-semibold text-slate-900">
                          {row.branch}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
                {cleanerRows.length > 0 && (
                  <tfoot>
                    <tr className="bg-slate-200/90 text-slate-900 font-black border-t-2 border-slate-400 text-xs">
                      <td colSpan={2} className="py-2.5 px-3 text-center uppercase tracking-wider border-r border-slate-300">
                        Total ({cleanerRows.length} Disbursements):
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono border-r border-slate-300">
                        {cleanerTotals.gross.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-3 text-right font-mono text-amber-900 border-r border-slate-300">
                        {cleanerTotals.tax.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-right font-mono text-emerald-950 bg-emerald-100/90 border-r border-slate-300">
                        Rs. {cleanerTotals.paid.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                      </td>
                      <td className="py-2.5 px-4 text-[11px] text-slate-600 font-bold">
                        {currentCleaner?.isMerged ? 'Combined across all assigned branches' : 'Single branch'}
                      </td>
                    </tr>
                  </tfoot>
                )}
              </table>
            </div>
          )}

          {/* In Words Callout for Cleaner */}
          {statementCategory === 'cleaner_payment' && cleanerRows.length > 0 && (
            <div className="bg-slate-50 border border-slate-300 rounded-xl px-4 py-2.5 text-xs">
              <span className="font-bold text-slate-500 uppercase tracking-wider mr-2">Total Paid In Words:</span>
              <span className="font-black text-slate-900 italic">
                {numberToEnglishWords(cleanerTotals.paid)}
              </span>
            </div>
          )}

          {/* Official Signatures Block */}
          <div className="pt-6 pb-2 border-t-2 border-slate-300 bg-white">
            <div className="grid grid-cols-4 gap-4 text-center text-xs">
              <div className="pt-10 border-t border-slate-400">
                <div className="font-bold text-slate-900">
                  {statementCategory === 'house_rent' ? 'Landlord / Payee' : 'Cleaner Staff'}
                </div>
                <div className="text-[11px] text-slate-500 mt-0.5">Signature & Verification</div>
              </div>
              <div className="pt-10 border-t border-slate-400">
                <div className="font-bold text-slate-900">Prepared By</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Account Assistant</div>
              </div>
              <div className="pt-10 border-t border-slate-400">
                <div className="font-bold text-slate-900">Checked By</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Internal Audit / Senior Accountant</div>
              </div>
              <div className="pt-10 border-t border-slate-400">
                <div className="font-bold text-slate-900">Approved By</div>
                <div className="text-[11px] text-slate-500 mt-0.5">Manager / CEO</div>
              </div>
            </div>
          </div>

        </div>

        {/* Footer (no-print) */}
        <div className="bg-slate-100 border-t border-slate-200 px-6 py-2.5 flex items-center justify-between text-[11px] text-slate-500 no-print">
          <div>
            Statement automatically generated from verified office operating expense sheets.
          </div>
          <button
            onClick={onClose}
            className="px-4 py-1 bg-slate-800 hover:bg-slate-700 text-white font-bold rounded-lg text-xs cursor-pointer"
          >
            Close
          </button>
        </div>

      </div>
    </div>
  );
};
