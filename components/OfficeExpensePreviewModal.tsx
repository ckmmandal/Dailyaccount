import React, { useState, useEffect, useMemo } from 'react';
import { X, Printer, Download, Building2, CheckCircle2, Save, AlertCircle, FileText } from 'lucide-react';
import { OfficeExpenseRecord, Branch, SystemSettings, BranchFixedExpenseConfig, Employee, SavedOfficeExpenseSheet, OfficeAccountEntry, DailyData } from '../types';
import { storageService } from '../services/storageService';
import NepaliDate from 'nepali-date-converter';
import { getDeterministicExpenseId, isSameExpenseSlot, deduplicateExpenses, normalizeMonth, normalizeFy, isSameFy, normalizeBranchId, isBranchMatch, calculateElectricityBill } from '../utils/expenseHelpers';
import { getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';

interface OfficeExpensePreviewModalProps {
  isOpen: boolean;
  onClose: () => void;
  expenses: OfficeExpenseRecord[];
  allExpenses?: OfficeExpenseRecord[];
  branches: Branch[];
  selectedBranchId: string;
  selectedMonth: string;
  selectedFiscalYear: string;
  settings?: SystemSettings | null;
  employees?: Employee[];
  autoPostToLedger?: boolean;
  onToggleAutoPost?: (val: boolean) => void;
  onExportCSV: () => void;
  onExpensesSaved?: () => Promise<void> | void;
  onOpenPaymentStatement?: () => void;
}

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
  'Chaitra': 'चैत',
  'all': 'सम्पूर्ण महिनाहरू'
};

const r2 = (v: number): number => Math.round((v + Number.EPSILON) * 100) / 100;

// Helper: Convert English numbers (0-9) to Nepali Devanagari numerals (०-९)
export const toNepaliNumber = (val: number | string | undefined | null): string => {
  if (val === undefined || val === null || val === '') return '';
  const nepaliDigits = ['०', '१', '२', '३', '४', '५', '६', '७', '८', '९'];
  return String(val).replace(/[0-9]/g, (digit) => nepaliDigits[parseInt(digit, 10)]);
};

// Helper: Format currency with Nepali numerals
export const formatNepaliCurrency = (amount: number | undefined | null): string => {
  if (amount === undefined || amount === null || isNaN(amount)) return 'रु. ०.००';
  const formatted = amount.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2
  });
  return `रु. ${toNepaliNumber(formatted)}`;
};

export const OfficeExpensePreviewModal: React.FC<OfficeExpensePreviewModalProps> = ({
  isOpen,
  onClose,
  expenses,
  allExpenses = [],
  branches,
  selectedBranchId,
  selectedMonth,
  selectedFiscalYear,
  settings,
  employees: propEmployees,
  autoPostToLedger = true,
  onToggleAutoPost,
  onExportCSV,
  onExpensesSaved,
  onOpenPaymentStatement
}) => {
  const [fixedConfigs, setFixedConfigs] = useState<Record<string, BranchFixedExpenseConfig>>({});
  const [employees, setEmployees] = useState<Employee[]>([]);
  const [preparedById, setPreparedById] = useState<string>('');
  const [approvedById, setApprovedById] = useState<string>('');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveSuccessMsg, setSaveSuccessMsg] = useState<string | null>(null);
  const [popupBlocked, setPopupBlocked] = useState<boolean>(false);
  const [autoPost, setAutoPost] = useState<boolean>(autoPostToLedger);
  const isDayEnded = useDayEndLock(selectedBranchId === 'all' ? undefined : selectedBranchId);

  useEffect(() => {
    setAutoPost(autoPostToLedger);
  }, [autoPostToLedger]);

  useEffect(() => {
    if (isOpen) {
      if (propEmployees && propEmployees.length > 0) {
        setEmployees(propEmployees);
      }
      setAutoPost(autoPostToLedger);
      // Fetch fixed configurations and HR employee list
      Promise.all([
        storageService.getFixedExpenseConfigs().catch(() => ({})),
        storageService.getEmployees().catch(() => [])
      ]).then(([cfgs, emps]) => {
        setFixedConfigs(cfgs || {});
        setEmployees(emps || []);
      }).catch(err => {
        console.error('Error fetching data for report modal:', err);
      });
      setSaveSuccessMsg(null);
    }
  }, [isOpen]);

  // Determine effective branches to include
  const relevantBranches = useMemo(() => {
    if (selectedBranchId === 'all') {
      return branches;
    }
    const found = branches.filter(b => b.id === selectedBranchId);
    return found.length > 0 ? found : branches;
  }, [branches, selectedBranchId]);

  // Active dataset for the month and FY (strictly deduplicated to prevent ghost duplicate rows)
  const poolExpenses = useMemo(() => {
    const list = allExpenses && allExpenses.length > 0 ? allExpenses : expenses;
    return deduplicateExpenses(list);
  }, [allExpenses, expenses]);

  const monthExpenses = useMemo(() => {
    return poolExpenses.filter(e => {
      if (selectedFiscalYear && !isSameFy(e.fiscalYear, selectedFiscalYear)) return false;
      if (selectedMonth !== 'all' && normalizeMonth(e.month) !== normalizeMonth(selectedMonth)) return false;
      if (selectedBranchId !== 'all' && !isBranchMatch(e.branchId, selectedBranchId)) return false;
      return true;
    });
  }, [poolExpenses, selectedFiscalYear, selectedMonth, selectedBranchId]);

  // 1. DATA FOR TABLE 1: House Rent & Electricity (घरभाडा तथा विद्युत महसुल)
  const rentElectricityData = useMemo(() => {
    return relevantBranches.map((branch, idx) => {
      const cfg = fixedConfigs[branch.id]
        || fixedConfigs[branch.id?.toLowerCase()]
        || Object.values(fixedConfigs).find(c => isBranchMatch(c.branchId, branch.id));

      // Find posted Rent expense
      const rentExp = monthExpenses.find(e => isBranchMatch(e.branchId, branch.id) && e.category === 'house_rent');
      // Find posted Electricity expense
      const elecExp = monthExpenses.find(e => isBranchMatch(e.branchId, branch.id) && e.category === 'electricity_bill');

      // Landlord & Rent calculations
      const landlordName = (cfg?.rentEnabled !== false && cfg?.landlordName) || rentExp?.landlordName || rentExp?.paidTo || '-';
      
      // Real Khata / Account Number: check rentAccountNo on cfg, or on rentExp
      const landlordAccountNo = (cfg?.rentAccountNo && cfg.rentAccountNo !== '-')
        ? cfg.rentAccountNo
        : (rentExp?.accountNo && rentExp.accountNo !== '-')
          ? rentExp.accountNo
          : ((cfg as any)?.landlordAccountNo && (cfg as any).landlordAccountNo !== '-')
            ? (cfg as any).landlordAccountNo
            : (rentExp?.landlordAccountNo && rentExp.landlordAccountNo !== '-')
              ? rentExp.landlordAccountNo
              : '-';
      
      const rentGross = r2((cfg?.rentEnabled !== false && cfg?.rentAmount) ? cfg.rentAmount : (rentExp ? (rentExp.amount || 0) : (cfg?.rentAmount || 0)));
      const rawRentTax = (cfg?.rentEnabled !== false && cfg?.rentAmount)
        ? ((cfg.rentAmount * (cfg.rentTdsRate !== undefined ? cfg.rentTdsRate : 10)) / 100)
        : (rentExp ? (rentExp.taxDeduction || 0) : (cfg ? ((cfg.rentAmount || 0) * (cfg.rentTdsRate !== undefined ? cfg.rentTdsRate : 10) / 100) : 0));
      const rentTax = r2(rawRentTax);
      const rentNet = (cfg?.rentEnabled !== false && cfg?.rentNetPaid !== undefined)
        ? r2(cfg.rentNetPaid)
        : (rentExp ? (rentExp.netPaidAmount !== undefined ? r2(rentExp.netPaidAmount) : r2(rentGross - rentTax)) : r2(rentGross - rentTax));

      // Electricity calculations: only apply tax if explicitly recorded/ticked by user
      const elecUnit = elecExp?.consumedUnits !== undefined ? elecExp.consumedUnits : 0;
      const elecRate = elecExp?.ratePerUnit !== undefined ? elecExp.ratePerUnit : 12;

      let elecBase = elecUnit > 0 ? r2(elecUnit * elecRate) : 0;
      // Tax only appears in preview IF user explicitly clicked tick in Unit Khapat
      let elecTax = (elecExp && elecExp.taxDeduction !== undefined && elecExp.taxDeduction > 0)
        ? r2(elecExp.taxDeduction)
        : 0;

      let elecCharge = 0;
      if (elecExp) {
        if (elecExp.netPaidAmount !== undefined && elecExp.netPaidAmount > 0) {
          elecCharge = r2(elecExp.netPaidAmount);
        } else if (elecExp.amount !== undefined && elecExp.amount > 0) {
          elecCharge = r2(elecExp.amount);
        } else {
          elecCharge = r2(elecBase + elecTax);
        }
      } else {
        elecCharge = elecBase;
      }

      if (elecBase === 0 && elecCharge > 0) {
        elecBase = Math.max(0, r2(elecCharge - elecTax));
      }

      // Total Paid = Net Rent + Electricity Total Charge
      const totalPaid = r2(rentNet + elecCharge);

      return {
        sn: idx + 1,
        branchId: branch.id,
        branchName: branch.name,
        name: landlordName,
        accountNo: landlordAccountNo,
        rentGross,
        rentTax,
        rentNet,
        elecUnit,
        elecRate,
        elecBase,
        elecTax,
        elecCharge,
        totalPaid,
        rentExpId: rentExp?.id,
        elecExpId: elecExp?.id,
        elecPreviousUnit: elecExp?.previousUnit,
        elecCurrentUnit: elecExp?.currentUnit,
        elecMeterNo: elecExp?.meterNo,
        elecConsumerNo: elecExp?.consumerNo
      };
    });
  }, [relevantBranches, fixedConfigs, monthExpenses]);

  // 2. DATA FOR TABLE 2: Cleaner Payment (सफाई कर्मचारी पारिश्रमिक)
  const cleanerData = useMemo(() => {
    return relevantBranches.map((branch, idx) => {
      const cfg = fixedConfigs[branch.id]
        || fixedConfigs[branch.id?.toLowerCase()]
        || Object.values(fixedConfigs).find(c => isBranchMatch(c.branchId, branch.id));
      const cleanerExp = monthExpenses.find(e => isBranchMatch(e.branchId, branch.id) && e.category === 'cleaner_payment');

      const cleanerName = (cfg?.cleanerEnabled !== false && cfg?.cleanerName) || cleanerExp?.cleanerName || cleanerExp?.paidTo || '-';
      
      // Real Khata / Account Number for cleaner
      const cleanerAccountNo = (cfg?.cleanerAccountNo && cfg.cleanerAccountNo !== '-')
        ? cfg.cleanerAccountNo
        : (cleanerExp?.accountNo && cleanerExp.accountNo !== '-')
          ? cleanerExp.accountNo
          : ((cfg as any)?.accountNo && (cfg as any).accountNo !== '-')
            ? (cfg as any).accountNo
            : (cleanerExp?.cleanerAccountNo && cleanerExp.cleanerAccountNo !== '-')
              ? cleanerExp.cleanerAccountNo
              : '-';

      const grossAmount = r2((cfg?.cleanerEnabled !== false && cfg?.cleanerAmount) ? cfg.cleanerAmount : (cleanerExp ? (cleanerExp.amount || 0) : (cfg?.cleanerAmount || 0)));
      const taxRate = cfg?.cleanerTdsRate || 0;
      const rawCleanerTax = (cfg?.cleanerEnabled !== false && cfg?.cleanerAmount)
        ? (taxRate > 0 ? (grossAmount * taxRate) / 100 : 0)
        : (cleanerExp ? (cleanerExp.taxDeduction || 0) : (grossAmount > 0 && taxRate > 0 ? (grossAmount * taxRate) / 100 : 0));
      const taxAmount = r2(rawCleanerTax);
      const netPaidAmount = (cfg?.cleanerEnabled !== false && cfg?.cleanerNetPaid !== undefined)
        ? r2(cfg.cleanerNetPaid)
        : (cleanerExp ? (cleanerExp.netPaidAmount !== undefined ? r2(cleanerExp.netPaidAmount) : r2(grossAmount - taxAmount)) : r2(grossAmount - taxAmount));

      return {
        sn: idx + 1,
        branchId: branch.id,
        branchName: branch.name,
        name: cleanerName,
        grossAmount,
        taxAmount,
        netPaidAmount,
        accountNo: cleanerAccountNo,
        cleanerExpId: cleanerExp?.id
      };
    });
  }, [relevantBranches, fixedConfigs, monthExpenses]);

  // 3. DATA FOR TABLE 3: Khaja & Telephone / Internet (खाजा खर्च तथा टेलिफोन / इन्टरनेट)
  const khajaTelecomData = useMemo(() => {
    return relevantBranches.map((branch, idx) => {
      const cfg = fixedConfigs[branch.id]
        || fixedConfigs[branch.id?.toLowerCase()]
        || Object.values(fixedConfigs).find(c => isBranchMatch(c.branchId, branch.id));

      // Find khaja expense for this branch (single deduplicated slot)
      const khajaExp = monthExpenses.find(e => isBranchMatch(e.branchId, branch.id) && e.category === 'khaja_kharch');
      const cfgKhaja = (cfg?.khajaMonthlyAmount !== undefined ? cfg.khajaMonthlyAmount : (cfg as any)?.khajaAmount) || 0;
      // Fixed expense preview prioritizes the configured setup amount from Fixed Exp Setup
      const khajaAmount = (cfg?.khajaEnabled !== false && cfgKhaja > 0)
        ? r2(cfgKhaja)
        : (khajaExp ? r2(khajaExp.netPaidAmount || khajaExp.amount || 0) : r2(cfgKhaja));

      // Find telecom expense for this branch (single deduplicated slot)
      const telecomExp = monthExpenses.find(e => isBranchMatch(e.branchId, branch.id) && e.category === 'telephone_bill');
      const cfgTelecom = cfg?.telephoneAmount || 0;
      const telecomAmount = (cfg?.telephoneEnabled !== false && cfgTelecom > 0)
        ? r2(cfgTelecom)
        : (telecomExp ? r2(telecomExp.netPaidAmount || telecomExp.amount || 0) : r2(cfgTelecom));

      const totalAmount = r2(khajaAmount + telecomAmount);

      return {
        sn: idx + 1,
        branchId: branch.id,
        branchName: branch.name,
        khajaAmount,
        telecomAmount,
        totalAmount,
        khajaExpIds: khajaExp ? [khajaExp.id] : [],
        telecomExpIds: telecomExp ? [telecomExp.id] : []
      };
    });
  }, [relevantBranches, fixedConfigs, monthExpenses]);

  // Grand Totals for Summary
  const table1Totals = useMemo(() => {
    return rentElectricityData.reduce((acc, row) => ({
      rentGross: r2(acc.rentGross + row.rentGross),
      rentTax: r2(acc.rentTax + row.rentTax),
      rentNet: r2(acc.rentNet + row.rentNet),
      elecUnit: acc.elecUnit + row.elecUnit,
      elecBase: r2(acc.elecBase + (row.elecBase || 0)),
      elecTax: r2(acc.elecTax + (row.elecTax || 0)),
      elecCharge: r2(acc.elecCharge + row.elecCharge),
      totalPaid: r2(acc.totalPaid + row.totalPaid)
    }), { rentGross: 0, rentTax: 0, rentNet: 0, elecUnit: 0, elecBase: 0, elecTax: 0, elecCharge: 0, totalPaid: 0 });
  }, [rentElectricityData]);

  const table2Totals = useMemo(() => {
    return cleanerData.reduce((acc, row) => ({
      grossAmount: r2(acc.grossAmount + row.grossAmount),
      taxAmount: r2(acc.taxAmount + row.taxAmount),
      netPaidAmount: r2(acc.netPaidAmount + row.netPaidAmount)
    }), { grossAmount: 0, taxAmount: 0, netPaidAmount: 0 });
  }, [cleanerData]);

  const table3Totals = useMemo(() => {
    return khajaTelecomData.reduce((acc, row) => ({
      khajaAmount: r2(acc.khajaAmount + row.khajaAmount),
      telecomAmount: r2(acc.telecomAmount + row.telecomAmount),
      totalAmount: r2(acc.totalAmount + row.totalAmount)
    }), { khajaAmount: 0, telecomAmount: 0, totalAmount: 0 });
  }, [khajaTelecomData]);

  const grandTotalNetExpense = r2(table1Totals.totalPaid + table2Totals.netPaidAmount + table3Totals.totalAmount);

  // Signatory details
  const preparedEmployee = useMemo(() => {
    return employees.find(e => e.id === preparedById);
  }, [employees, preparedById]);

  const approvedEmployee = useMemo(() => {
    return employees.find(e => e.id === approvedById);
  }, [employees, approvedById]);

  const canSave = Boolean(preparedById && approvedById);

  // Save statement records to Office Operating Expenses database
  const handleSaveToExpensesPage = async () => {
    if (!canSave) return;
    setIsSaving(true);
    setSaveSuccessMsg(null);

    try {
      const existingAll = await storageService.getOfficeExpenses();
      const currentList = existingAll || [];
      const updatedMap = new Map<string, OfficeExpenseRecord>();

      // Put all existing expenses in map
      currentList.forEach(item => {
        updatedMap.set(item.id, item);
      });

      const effectiveMonth = selectedMonth === 'all' ? 'Shrawan' : selectedMonth;
      const effectiveFy = selectedFiscalYear || '2081/2082';
      const yearPart = effectiveFy.split('/')[0] || '2081';
      const dateStr = `${yearPart}/04/01`;

      const preparedByName = preparedEmployee?.fullName || 'Prepared Signatory';
      const approvedByName = approvedEmployee?.fullName || 'Approved Signatory';

      // Remove any prior records for the branches and categories being saved in this month/FY slot
      // to ensure strictly "ek month ma ekpatak matrai hune ho"
      let newExpensesList = currentList.filter(e => {
        // If this record matches effectiveFy and effectiveMonth and belongs to one of the relevant branches
        const isTargetFy = isSameFy(e.fiscalYear, effectiveFy);
        const isTargetMo = normalizeMonth(e.month) === normalizeMonth(effectiveMonth);
        if (!isTargetFy || !isTargetMo) return true;
        const isTargetBranch = selectedBranchId === 'all' || isBranchMatch(e.branchId, selectedBranchId);
        if (!isTargetBranch) return true;
        // If it's one of the 5 managed categories, we will replace it with the clean deterministic record
        return !['house_rent', 'electricity_bill', 'cleaner_payment', 'khaja_kharch', 'telephone_bill'].includes(e.category);
      });

      // 1. Process Rent & Electricity
      rentElectricityData.forEach(row => {
        if (row.rentGross > 0) {
          const rentId = getDeterministicExpenseId('house_rent', row.branchId, effectiveFy, effectiveMonth);
          newExpensesList.push({
            id: rentId,
            branchId: row.branchId,
            category: 'house_rent',
            categoryLabel: 'घरभाडा खर्च (House Rent)',
            date: dateStr,
            month: effectiveMonth,
            fiscalYear: effectiveFy,
            amount: row.rentGross,
            taxDeduction: row.rentTax,
            netPaidAmount: row.rentNet,
            landlordName: row.name,
            accountNo: row.accountNo,
            paidTo: row.name,
            paymentMethod: 'Bank Transfer',
            recordedBy: preparedByName,
            approvedBy: approvedByName,
            remarks: 'मासिक घरभाडा खर्च विवरण',
            createdAt: Date.now()
          });
        }

        if (row.elecCharge > 0 || row.elecUnit > 0) {
          const elecId = getDeterministicExpenseId('electricity_bill', row.branchId, effectiveFy, effectiveMonth);
          newExpensesList.push({
            id: elecId,
            branchId: row.branchId,
            category: 'electricity_bill',
            categoryLabel: 'विद्युत महसुल (Electricity)',
            date: dateStr,
            month: effectiveMonth,
            fiscalYear: effectiveFy,
            amount: row.elecCharge,
            taxDeduction: row.elecTax || 0,
            netPaidAmount: row.elecCharge,
            previousUnit: row.elecPreviousUnit !== undefined ? row.elecPreviousUnit : undefined,
            currentUnit: row.elecCurrentUnit !== undefined ? row.elecCurrentUnit : (row.elecPreviousUnit !== undefined && row.elecUnit > 0 ? (row.elecPreviousUnit + row.elecUnit) : undefined),
            previous: row.elecPreviousUnit !== undefined ? row.elecPreviousUnit : undefined,
            current: row.elecCurrentUnit !== undefined ? row.elecCurrentUnit : (row.elecPreviousUnit !== undefined && row.elecUnit > 0 ? (row.elecPreviousUnit + row.elecUnit) : undefined),
            consumedUnits: row.elecUnit,
            ratePerUnit: row.elecRate,
            meterNo: row.elecMeterNo || '',
            consumerNo: row.elecConsumerNo || '',
            accountNo: row.accountNo,
            paidTo: 'नेपाल विद्युत प्राधिकरण',
            paymentMethod: 'Bank Transfer',
            recordedBy: preparedByName,
            approvedBy: approvedByName,
            remarks: 'मासिक विद्युत महसुल खर्च विवरण',
            createdAt: Date.now()
          });
        }
      });

      // 2. Process Cleaner Payments
      cleanerData.forEach(row => {
        if (row.grossAmount > 0) {
          const cleanerId = getDeterministicExpenseId('cleaner_payment', row.branchId, effectiveFy, effectiveMonth);
          newExpensesList.push({
            id: cleanerId,
            branchId: row.branchId,
            category: 'cleaner_payment',
            categoryLabel: 'सफाई कर्मचारी पारिश्रमिक (Cleaner Payment)',
            date: dateStr,
            month: effectiveMonth,
            fiscalYear: effectiveFy,
            amount: row.grossAmount,
            taxDeduction: row.taxAmount,
            netPaidAmount: row.netPaidAmount,
            cleanerName: row.name,
            accountNo: row.accountNo,
            paidTo: row.name,
            paymentMethod: 'Bank Transfer',
            recordedBy: preparedByName,
            approvedBy: approvedByName,
            remarks: 'मासिक कार्यालय सफाई पारिश्रमिक',
            createdAt: Date.now()
          });
        }
      });

      // 3. Process Khaja & Telecom
      khajaTelecomData.forEach(row => {
        if (row.khajaAmount > 0) {
          const khajaId = getDeterministicExpenseId('khaja_kharch', row.branchId, effectiveFy, effectiveMonth);
          newExpensesList.push({
            id: khajaId,
            branchId: row.branchId,
            category: 'khaja_kharch',
            categoryLabel: 'खाजा खर्च (Refreshment / Khaja)',
            date: dateStr,
            month: effectiveMonth,
            fiscalYear: effectiveFy,
            amount: row.khajaAmount,
            netPaidAmount: row.khajaAmount,
            paidTo: 'शाखा कर्मचारी / क्यान्टिन',
            paymentMethod: 'Bank Transfer',
            recordedBy: preparedByName,
            approvedBy: approvedByName,
            remarks: 'मासिक कार्यालय खाजा खर्च',
            createdAt: Date.now()
          });
        }

        if (row.telecomAmount > 0) {
          const telecomId = getDeterministicExpenseId('telephone_bill', row.branchId, effectiveFy, effectiveMonth);
          newExpensesList.push({
            id: telecomId,
            branchId: row.branchId,
            category: 'telephone_bill',
            categoryLabel: 'टेलिफोन तथा इन्टरनेट (Telephone / Internet)',
            date: dateStr,
            month: effectiveMonth,
            fiscalYear: effectiveFy,
            amount: row.telecomAmount,
            netPaidAmount: row.telecomAmount,
            paidTo: 'नेपाल टेलिकम / इन्टरनेट प्रदायक',
            paymentMethod: 'Bank Transfer',
            recordedBy: preparedByName,
            approvedBy: approvedByName,
            remarks: 'मासिक टेलिफोन तथा इन्टरनेट महसुल',
            createdAt: Date.now()
          });
        }
      });

      // Deduplicate strictly
      const finalRecordsList = deduplicateExpenses(newExpensesList);
      await storageService.saveAllOfficeExpenses(finalRecordsList);

      // Calculate totals for sheet
      const branchLabel = selectedBranchId === 'all'
        ? 'सम्पूर्ण शाखाहरू'
        : (branches.find(b => b.id === selectedBranchId)?.name || selectedBranchId);
      const nepMonth = NEPALI_MONTH_MAP[selectedMonth] || (NEPALI_MONTH_MAP[effectiveMonth] || effectiveMonth);

      const calculatedGross = Number((table1Totals.rentGross + table1Totals.elecCharge + table2Totals.grossAmount + table3Totals.totalAmount).toFixed(2));
      const calculatedTds = Number((table1Totals.rentTax + table2Totals.taxAmount).toFixed(2));
      const calculatedNet = Number((grandTotalNetExpense).toFixed(2));

      // Save the Monthly Statement Sheet
      const sheetId = `EXP_SHEET_${effectiveFy.replace(/[/\\s]/g, '_')}_${effectiveMonth}_${selectedBranchId}`.replace(/[/\\s]/g, '_');
      const sheetObj: SavedOfficeExpenseSheet = {
        id: sheetId,
        fiscalYear: effectiveFy,
        month: effectiveMonth,
        monthNp: nepMonth,
        branchId: selectedBranchId,
        branchName: branchLabel,
        totalExpenses: calculatedGross,
        taxAmount: calculatedTds,
        netPaidAmount: calculatedNet,
        recordsCount: finalRecordsList.filter(r => r.fiscalYear === effectiveFy && r.month === effectiveMonth).length,
        preparedBy: preparedById,
        preparedByName: preparedEmployee?.fullName || preparedByName,
        approvedBy: approvedById,
        approvedByName: approvedEmployee?.fullName || approvedByName,
        savedAt: Date.now(),
        status: 'Approved'
      };
      await storageService.saveSavedExpenseSheet(sheetObj);

      // Auto post to Teller Ledger and Income/Exp ledgers according to autoPost checkbox
      const todayBs = new NepaliDate().format('YYYY-MM-DD');
      const targetBranchId = selectedBranchId === 'all' ? (branches[0]?.id || 'main') : selectedBranchId;
      const prefix = `offexp_${effectiveFy.replace(/[/\\s]/g, '_')}_${effectiveMonth}_`;

      try {
        const existingDay = await storageService.getDayData(todayBs, targetBranchId);
        const currentOfficeTx = (existingDay?.officeTransactions || []).filter(
          (t: any) => !t.id?.startsWith(prefix) &&
            !(t.remarks && (
              t.remarks.includes(`(${effectiveMonth} ${effectiveFy})`) ||
              t.remarks.includes(`(${selectedMonth} ${effectiveFy})`)
            ) && (
              t.remarks.includes('Office Operating') ||
              t.remarks.includes('Office Expenses') ||
              t.remarks.includes('Office Rent') ||
              t.remarks.includes('Office Cleaner') ||
              t.remarks.includes('Office Khaja')
            ))
        );

        if (autoPost) {
          // 1. Teller ledger -> Debit side -> Other column: Total Gross Expense (मासिक सम्पूर्ण कुल खर्च)
          const grossEntry: OfficeAccountEntry = {
            id: `${prefix}gross_${Date.now()}`,
            head: 'Other',
            amount: Number(calculatedGross.toFixed(2)),
            type: 'out',
            date: todayBs,
            remarks: `Office Operating Expenses Gross Total (${effectiveMonth} ${effectiveFy})`,
            createdBy: preparedEmployee?.fullName || preparedByName || 'Office Expenses',
            createdByName: preparedEmployee?.fullName || preparedByName || 'Office Expenses',
            branchId: targetBranchId,
            origin: 'office_expense'
          };

          // 2. Teller ledger -> Credit side -> Other column: Total TDS Deductions (कुल कर कट्टी रकम)
          const tdsEntry: OfficeAccountEntry = {
            id: `${prefix}tds_${Date.now()}`,
            head: 'Other',
            amount: Number(calculatedTds.toFixed(2)),
            type: 'in',
            date: todayBs,
            remarks: `Office Expenses Total TDS Deduction (${effectiveMonth} ${effectiveFy})`,
            createdBy: preparedEmployee?.fullName || preparedByName || 'Office Expenses',
            createdByName: preparedEmployee?.fullName || preparedByName || 'Office Expenses',
            branchId: targetBranchId,
            origin: 'office_expense'
          };

          // 3. Teller ledger -> Credit side -> Saving column: Rent & Electricity Total Paid (घरभाडा तथा विद्युत महसुल विवरण table ko कुल भुक्तानी)
          const rentElecPaid = Number(table1Totals.totalPaid.toFixed(2));
          const rentElecEntry: OfficeAccountEntry = {
            id: `${prefix}rentelec_${Date.now()}`,
            head: 'Saving',
            amount: rentElecPaid,
            type: 'in',
            date: todayBs,
            remarks: `Office Rent & Electricity Net Disbursement (${effectiveMonth} ${effectiveFy})`,
            createdBy: preparedEmployee?.fullName || preparedByName || 'Office Expenses',
            createdByName: preparedEmployee?.fullName || preparedByName || 'Office Expenses',
            branchId: targetBranchId,
            origin: 'office_expense'
          };

          // 4. Teller ledger -> Credit side -> Saving column: Cleaner Net Paid (२. कार्यालय सफाई कर्मचारी पारिश्रमिक विवरण ko खुद भुक्तानी रकम)
          const cleanerPaid = Number(table2Totals.netPaidAmount.toFixed(2));
          const cleanerEntry: OfficeAccountEntry = {
            id: `${prefix}cleaner_${Date.now()}`,
            head: 'Saving',
            amount: cleanerPaid,
            type: 'in',
            date: todayBs,
            remarks: `Office Cleaner Remuneration Net Disbursement (${effectiveMonth} ${effectiveFy})`,
            createdBy: preparedEmployee?.fullName || preparedByName || 'Office Expenses',
            createdByName: preparedEmployee?.fullName || preparedByName || 'Office Expenses',
            branchId: targetBranchId,
            origin: 'office_expense'
          };

          // 5. Income/Exp menu -> Credit side -> Other column: Khaja & Telecom Total (३. खाजा खर्च तथा टेलिफोन / इन्टरनेट महसुल विवरण ko जम्मा रकम)
          const khajaTelecomTotal = Number(table3Totals.totalAmount.toFixed(2));
          const khajaTelecomEntry: OfficeAccountEntry = {
            id: `${prefix}khajatelecom_${Date.now()}`,
            head: 'Other',
            amount: khajaTelecomTotal,
            type: 'in',
            date: todayBs,
            remarks: `Office Khaja & Telecom (${effectiveMonth} ${effectiveFy})`,
            createdBy: preparedEmployee?.fullName || preparedByName || 'Office Expenses',
            createdByName: preparedEmployee?.fullName || preparedByName || 'Office Expenses',
            branchId: targetBranchId,
            origin: 'income_expense'
          };

          currentOfficeTx.push(grossEntry, tdsEntry, rentElecEntry, cleanerEntry, khajaTelecomEntry);
        }

        const updatedDayData: DailyData = {
          ...(existingDay || {
            date: todayBs,
            branchId: targetBranchId,
            denominations: [],
            denoAdjustments: [],
            transactions: [],
            officeTransactions: [],
            remittances: [],
            vaultTransactions: []
          }),
          officeTransactions: currentOfficeTx
        };

        await storageService.saveDayData(todayBs, targetBranchId, updatedDayData);
        window.dispatchEvent(new Event('storage'));
      } catch (postErr) {
        console.error('Failed to post office expense entries to ledgers:', postErr);
      }

      if (onExpensesSaved) {
        await onExpensesSaved();
      }

      setSaveSuccessMsg(autoPost ? 'मासिक कार्यालय सञ्चालन खर्चको विवरण तथा लेजर प्रविष्टिहरू सफलतापूर्वक सुरक्षित भयो!' : 'मासिक कार्यालय सञ्चालन खर्चको विवरण सफलतापूर्वक सुरक्षित भयो!');
      setTimeout(() => {
        setSaveSuccessMsg(null);
      }, 4000);
    } catch (err) {
      console.error('Error saving office expense records from report:', err);
      alert('सुरक्षित गर्दा समस्या आयो। कृपया पुन: प्रयास गर्नुहोस्।');
    } finally {
      setIsSaving(false);
    }
  };

  if (!isOpen) return null;

  const currentBranchName = selectedBranchId === 'all'
    ? 'सम्पूर्ण शाखाहरू'
    : (branches.find(b => b.id === selectedBranchId)?.name || selectedBranchId);

  const displayNepaliMonth = NEPALI_MONTH_MAP[selectedMonth] || selectedMonth;

  const handlePrint = () => {
    const printElement = document.getElementById('printable-expense-statement');
    if (!printElement) {
      window.print();
      return;
    }

    const printContent = printElement.innerHTML;
    const documentTitle = `मासिक कार्यालय सञ्चालन खर्च - ${currentBranchName} (${displayNepaliMonth} ${selectedFiscalYear})`;

    const fullHtml = `<!DOCTYPE html>
<html lang="ne">
<head>
  <meta charset="UTF-8">
  <title>${documentTitle}</title>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <script src="https://cdn.tailwindcss.com"></script>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Mukta:wght@400;500;600;700;800&family=Inter:wght@400;500;600;700;800;900&display=swap" rel="stylesheet">
  <style>
    @page {
      size: A4 portrait;
      margin: 5mm 5mm !important;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    html, body {
      font-family: 'Mukta', 'Inter', -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif;
      margin: 0;
      padding: 0;
      background-color: #f1f5f9;
      color: #000000;
      -webkit-font-smoothing: antialiased;
    }
    .print-preview-bar {
      position: sticky;
      top: 0;
      z-index: 99999;
      background: #0f172a;
      color: #ffffff;
      padding: 10px 20px;
      display: flex;
      justify-content: space-between;
      align-items: center;
      box-shadow: 0 4px 12px rgba(0,0,0,0.25);
    }
    .print-paper-page {
      max-width: 210mm;
      min-height: 297mm;
      margin: 12px auto 24px auto;
      background: #ffffff;
      padding: 6mm 7mm;
      box-shadow: 0 4px 25px rgba(0,0,0,0.12);
      border: 1px solid #e2e8f0;
      border-radius: 4px;
    }
    table {
      width: 100% !important;
      border-collapse: collapse !important;
      table-layout: auto !important;
    }
    th, td {
      border: 1px solid #000000 !important;
      color: #000000 !important;
      white-space: nowrap !important;
      padding: 2.5px 3.5px !important;
      font-size: 10px !important;
      line-height: 1.25 !important;
    }
    th {
      font-weight: 800 !important;
      font-size: 10px !important;
      background-color: #f1f5f9 !important;
    }
    tfoot td {
      font-weight: 800 !important;
      font-size: 10px !important;
      background-color: #f1f5f9 !important;
    }
    thead {
      display: table-header-group !important;
    }
    tfoot {
      display: table-footer-group !important;
    }
    tr {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
    }
    .print-section {
      page-break-inside: avoid !important;
      break-inside: avoid !important;
      margin-bottom: 8px !important;
    }
    .no-print {
      display: none !important;
    }
    @media print {
      .print-preview-bar {
        display: none !important;
      }
      body {
        background-color: #ffffff !important;
        padding: 0 !important;
        margin: 0 !important;
      }
      .print-paper-page {
        margin: 0 !important;
        padding: 0 !important;
        box-shadow: none !important;
        border: none !important;
        border-radius: 0 !important;
        max-width: 100% !important;
        width: 100% !important;
      }
    }
  </style>
</head>
<body>
  <div class="print-preview-bar no-print">
    <div style="display: flex; align-items: center; gap: 12px;">
      <div style="font-size: 20px;">🖶</div>
      <div>
        <div style="font-weight: 900; font-size: 13px; text-transform: uppercase; letter-spacing: 0.5px;">
          मासिक कार्यालय सञ्चालन खर्च - प्रिन्ट पूर्वावलोकन (Print Preview)
        </div>
        <div style="font-size: 11px; color: #94a3b8;">
          ${currentBranchName} &bull; महिना: ${displayNepaliMonth} &bull; आ.व.: ${toNepaliNumber(selectedFiscalYear)}
        </div>
      </div>
    </div>
    <div style="display: flex; align-items: center; gap: 10px;">
      <button onclick="window.focus(); window.print();" style="background: #059669; color: white; border: none; padding: 7px 18px; border-radius: 8px; font-weight: 800; font-size: 13px; cursor: pointer; display: flex; align-items: center; gap: 6px; box-shadow: 0 2px 5px rgba(0,0,0,0.2);">
        🖶 प्रिन्ट गर्नुहोस् (Print / Save as PDF)
      </button>
      <button onclick="window.close();" style="background: #334155; color: white; border: none; padding: 7px 14px; border-radius: 8px; font-weight: 700; font-size: 12px; cursor: pointer;">
        ✕ बन्द (Close)
      </button>
    </div>
  </div>

  <div class="print-paper-page">
    ${printContent}
  </div>

  <script>
    window.addEventListener('load', function() {
      setTimeout(function() {
        try {
          window.focus();
          window.print();
        } catch (e) {
          console.error("Auto print error:", e);
        }
      }, 500);
    });
  </script>
</body>
</html>`;

    let opened = false;
    try {
      const printWindow = window.open('', '_blank');
      if (printWindow) {
        printWindow.document.open();
        printWindow.document.write(fullHtml);
        printWindow.document.close();
        opened = true;
        setPopupBlocked(false);
      }
    } catch (e) {
      console.warn("window.open blocked or failed:", e);
    }

    if (!opened) {
      try {
        const blob = new Blob([fullHtml], { type: 'text/html;charset=utf-8' });
        const blobUrl = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = blobUrl;
        link.target = '_blank';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        setTimeout(() => URL.revokeObjectURL(blobUrl), 30000);
        opened = true;
        setPopupBlocked(false);
      } catch (err) {
        console.error("Blob print fallback failed:", err);
      }
    }

    if (!opened) {
      setPopupBlocked(true);
      // Fallback in same page
      window.print();
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/75 backdrop-blur-xs z-[7000] flex items-center justify-center p-2 sm:p-4 overflow-y-auto print:static print:inset-auto print:bg-white print:p-0 print:m-0 print:overflow-visible print:z-auto print:block">
      <style>{`
        @media print {
          @page {
            size: A4 portrait;
            margin: 5mm 5mm !important;
          }
          html, body {
            width: 100% !important;
            height: auto !important;
            overflow: visible !important;
            background: #ffffff !important;
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .printable-expense-statement {
            width: 100% !important;
            max-width: 100% !important;
            padding: 0 !important;
            margin: 0 !important;
            overflow: visible !important;
            display: block !important;
          }
          .printable-expense-statement table {
            width: 100% !important;
            max-width: 100% !important;
            border-collapse: collapse !important;
            table-layout: auto !important;
          }
          .printable-expense-statement th,
          .printable-expense-statement td {
            border: 1px solid #000000 !important;
            color: #000000 !important;
            white-space: nowrap !important;
            padding: 2.5px 3.5px !important;
            font-size: 10px !important;
            line-height: 1.25 !important;
          }
          .printable-expense-statement th {
            font-weight: 800 !important;
            font-size: 10px !important;
            background-color: #f1f5f9 !important;
          }
          .printable-expense-statement tfoot td {
            font-weight: 800 !important;
            font-size: 10px !important;
            background-color: #f1f5f9 !important;
          }
          .printable-expense-statement thead {
            display: table-header-group !important;
          }
          .printable-expense-statement tfoot {
            display: table-footer-group !important;
          }
          .printable-expense-statement tr {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
          }
          .print-section {
            page-break-inside: avoid !important;
            break-inside: avoid !important;
            margin-bottom: 8px !important;
          }
        }
      `}</style>
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-6xl max-h-[96vh] flex flex-col overflow-hidden animate-in zoom-in-95 duration-200 print:border-none print:shadow-none print:rounded-none print:max-w-none print:max-h-none print:h-auto print:overflow-visible print:p-0 print:m-0 print:w-full print:block">
        
        {/* Modal Top Control Bar (Non-Printable) */}
        <div className="bg-slate-900 text-white px-4 py-2.5 flex flex-wrap justify-between items-center gap-2 shrink-0 no-print">
          <div className="flex items-center space-x-2">
            <Building2 size={18} className="text-emerald-400" />
            <h3 className="font-black text-xs sm:text-sm uppercase tracking-wide">
              मासिक कार्यालय सञ्चालन खर्च विवरण
            </h3>
          </div>
          
          <div className="flex items-center space-x-2">
            {onOpenPaymentStatement && (
              <button
                onClick={() => {
                  onClose();
                  onOpenPaymentStatement();
                }}
                className="bg-emerald-700 hover:bg-emerald-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer border border-emerald-500/60 shadow-xs"
                title="Open Individual English Payment Statement for House Rent Landlords & Cleaners"
              >
                <FileText size={13} />
                <span>Individual Statement</span>
              </button>
            )}

            <button
              id="btn-print-office-expense"
              onClick={handlePrint}
              className="bg-slate-800 hover:bg-emerald-600 text-white px-3.5 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 shadow-sm active:scale-95 cursor-pointer border border-slate-700 hover:border-emerald-500"
              title="प्रिन्ट पूर्वावलोकन खोल्नुहोस् (Ctrl+P / Save as PDF)"
            >
              <Printer size={14} />
              <span>प्रिन्ट (Print)</span>
            </button>
            
            <button
              onClick={onExportCSV}
              className="bg-white/10 hover:bg-white/20 text-white px-3 py-1.5 rounded-lg text-xs font-bold transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <Download size={13} />
              <span>CSV</span>
            </button>
            
            <button
              onClick={onClose}
              className="p-1.5 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
            >
              <X size={18} />
            </button>
          </div>
        </div>

        {/* Popup Blocked Warning Alert if popup was prevented */}
        {popupBlocked && (
          <div className="bg-amber-50 border-b border-amber-300 px-4 py-2 text-xs font-bold text-amber-900 flex items-center justify-between no-print animate-in fade-in">
            <div className="flex items-center space-x-2">
              <AlertCircle size={16} className="text-amber-600 shrink-0" />
              <span>ब्राउजरले पप-अप रोकेको देखिन्छ। कृपया प्रिन्ट पूर्वावलोकन हेर्न तलको बटन थिच्नुहोस्:</span>
              <button
                onClick={handlePrint}
                className="ml-2 bg-amber-600 hover:bg-amber-700 text-white px-2.5 py-1 rounded text-[11px] font-black cursor-pointer shadow-xs"
              >
                पूर्वावलोकन खोल्नुहोस्
              </button>
            </div>
            <button onClick={() => setPopupBlocked(false)} className="text-amber-700 hover:text-amber-900">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Feedback Alert if Saved */}
        {saveSuccessMsg && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-2 text-xs font-bold text-emerald-800 flex items-center justify-between no-print animate-in fade-in">
            <div className="flex items-center space-x-2">
              <CheckCircle2 size={16} className="text-emerald-600" />
              <span>{saveSuccessMsg}</span>
            </div>
            <button onClick={() => setSaveSuccessMsg(null)} className="text-emerald-700 hover:text-emerald-900">
              <X size={14} />
            </button>
          </div>
        )}

        {/* Printable Document Paper View */}
        <div
          id="printable-expense-statement"
          className="flex-1 overflow-y-auto p-4 sm:p-6 bg-white text-slate-900 font-sans printable-expense-statement print:p-0 print:m-0 print:overflow-visible print:w-full print:block"
        >
          
          {/* Header with Left Side Logo */}
          <div className="border-b-2 border-slate-900 pb-3 mb-4 print:pb-2 print:mb-3">
            <div className="flex items-center justify-between gap-3 sm:gap-4 print:gap-2">
              {/* Left Side Logo */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 print:w-16 print:h-16 flex items-center justify-center shrink-0">
                {settings?.logoUrl ? (
                  <img
                    src={settings.logoUrl}
                    alt="Logo"
                    className="max-h-full max-w-full object-contain"
                    referrerPolicy="no-referrer"
                  />
                ) : (
                  <div className="w-14 h-14 sm:w-16 sm:h-16 rounded-full border-2 border-emerald-700 bg-emerald-50 text-emerald-800 flex flex-col items-center justify-center text-center p-1 shadow-xs">
                    <Building2 size={22} className="text-emerald-700" />
                    <span className="text-[7.5px] font-black leading-tight uppercase mt-0.5">रटौली साकोस</span>
                  </div>
                )}
              </div>

              {/* Center Organization & Document Titles (Zero text-wrapping) */}
              <div className="flex-1 text-center space-y-0.5 print:space-y-0.5 min-w-0">
                <h1 className="text-base sm:text-2xl md:text-3xl print:text-xl font-black uppercase tracking-tight text-black leading-tight whitespace-nowrap">
                  रतौली बचत तथा ऋण सहकारी संस्था लिमिटेड
                </h1>
                <p className="text-xs sm:text-sm print:text-xs font-bold text-black whitespace-nowrap">
                  पिपरा गाँउपालिका ६, महाेत्तरी{settings?.phone ? ` | फोन: ${toNepaliNumber(settings.phone)}` : ''}
                </p>
                <div className="pt-1 print:pt-0.5">
                  <h2 className="inline-block text-xs sm:text-base print:text-sm font-black text-black border-b-2 border-black pb-0.5 px-3 uppercase tracking-wide whitespace-nowrap">
                    मासिक कार्यालय सञ्चालन खर्च
                  </h2>
                </div>
              </div>

              {/* Right Placeholder to keep center alignment balanced */}
              <div className="w-16 h-16 sm:w-20 sm:h-20 print:w-16 print:h-16 shrink-0 flex items-center justify-center"></div>
            </div>

            {/* Fiscal Year, Month, Branch Meta Row */}
            <div className="grid grid-cols-3 text-xs sm:text-sm print:text-xs font-bold pt-2.5 pb-0.5 border-t-2 border-black mt-2.5 text-black">
              <div className="text-left whitespace-nowrap">
                <span className="text-black font-bold">शाखा: </span>
                <span className="text-black font-black">{currentBranchName}</span>
              </div>
              <div className="text-center whitespace-nowrap">
                <span className="text-black font-bold">महिना: </span>
                <span className="text-black font-black bg-slate-100 print:bg-transparent px-2.5 py-0.5 rounded border border-black text-xs sm:text-sm print:text-xs">
                  {displayNepaliMonth}
                </span>
              </div>
              <div className="text-right whitespace-nowrap">
                <span className="text-black font-bold">आर्थिक वर्ष: </span>
                <span className="text-black font-black">{toNepaliNumber(selectedFiscalYear)}</span>
              </div>
            </div>
          </div>

          <div className="space-y-5 print:space-y-3">

            {/* ========================================================================= */}
            {/* TABLE 1: HOUSE RENT & ELECTRICITY (घरभाडा तथा विद्युत महसुल विवरण) */}
            {/* ========================================================================= */}
            <div className="space-y-1.5 print:space-y-1 print-section">
              <div className="flex items-center space-x-2 border-l-4 border-black pl-2">
                <h3 className="font-black text-xs sm:text-sm print:text-xs text-black tracking-wide whitespace-nowrap">
                  १. घरभाडा तथा विद्युत महसुल विवरण
                </h3>
              </div>

              <div className="overflow-x-auto print:overflow-visible border border-slate-400 print:border-black rounded-lg print:rounded-none shadow-2xs print:shadow-none w-full">
                <table className="w-full text-xs print:text-[10px] text-left border-collapse print:table-auto">
                  <thead>
                    <tr className="bg-slate-100 print:bg-slate-200 text-black font-black text-xs print:text-[10px] border-b border-slate-400 print:border-black whitespace-nowrap">
                      <th className="py-2 px-1 print:py-1 print:px-1 text-center w-7 border-r border-slate-300 print:border-black">क्र.सं.</th>
                      <th className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-slate-300 print:border-black">घरधनीको नाम</th>
                      <th className="py-2 px-2 print:py-1 print:px-1 border-r border-slate-300 print:border-black">शाखा</th>
                      <th className="py-2 px-2 print:py-1 print:px-1.5 text-right border-r border-slate-300 print:border-black">कुल घरभाडा</th>
                      <th className="py-2 px-2 print:py-1 print:px-1.5 text-right border-r border-slate-300 print:border-black bg-slate-200/70 print:bg-slate-100">कर कट्टी (TDS)</th>
                      <th className="py-2 px-2 print:py-1 print:px-1.5 text-right border-r border-slate-300 print:border-black bg-slate-200 print:bg-slate-200">खुद भाडा</th>
                      <th className="py-2 px-1.5 print:py-1 print:px-1 text-center border-r border-slate-300 print:border-black">वि. युनिट</th>
                      <th className="py-2 px-1.5 print:py-1 print:px-1 text-center border-r border-slate-300 print:border-black">दर</th>
                      <th className="py-2 px-2 print:py-1 print:px-1.5 text-right border-r border-slate-300 print:border-black" title="विद्युत महसुल">विद्युत महसुल</th>
                      <th className="py-2 px-2 print:py-1 print:px-1.5 text-right border-r border-slate-300 print:border-black bg-slate-300 print:bg-slate-200 text-black font-black">कुल भुक्तानी</th>
                      <th className="py-2 px-2.5 print:py-1 print:px-1.5 text-center">खाता नम्बर</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 print:divide-black bg-white">
                    {rentElectricityData.length === 0 ? (
                      <tr>
                        <td colSpan={11} className="py-3 text-center text-slate-500 italic">
                          कुनै घरभाडा तथा विद्युत विवरण उपलब्ध छैन।
                        </td>
                      </tr>
                    ) : (
                      rentElectricityData.map((row, idx) => (
                        <tr key={row.branchId} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50 print:bg-white'} whitespace-nowrap`}>
                          <td className="py-2 px-1 print:py-1 print:px-1 text-center font-bold text-black border-r border-slate-300 print:border-black text-xs print:text-[10px]">
                            {toNepaliNumber(row.sn)}
                          </td>
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 font-bold text-black border-r border-slate-300 print:border-black text-xs print:text-[10px]">
                            {row.name}
                          </td>
                          <td className="py-2 px-2 print:py-1 print:px-1 text-black border-r border-slate-300 print:border-black font-semibold text-xs print:text-[10px]">
                            {row.branchName}
                          </td>
                          <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-black border-r border-slate-300 print:border-black font-bold text-xs print:text-[10px]">
                            {formatNepaliCurrency(row.rentGross)}
                          </td>
                          <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-black font-bold border-r border-slate-300 print:border-black bg-slate-50 print:bg-transparent text-xs print:text-[10px]">
                            {row.rentTax > 0 ? formatNepaliCurrency(row.rentTax) : '-'}
                          </td>
                          <td className="py-2 px-2 print:py-1 print:px-1.5 text-right font-black text-black bg-slate-100/70 print:bg-slate-100 border-r border-slate-300 print:border-black text-xs print:text-[10px]">
                            {formatNepaliCurrency(row.rentNet)}
                          </td>
                          <td className="py-2 px-1.5 print:py-1 print:px-1 text-center font-bold text-black border-r border-slate-300 print:border-black text-xs print:text-[10px]">
                            {row.elecUnit > 0 ? toNepaliNumber(row.elecUnit) : '-'}
                          </td>
                          <td className="py-2 px-1.5 print:py-1 print:px-1 text-center text-black border-r border-slate-300 print:border-black font-bold text-xs print:text-[10px]">
                            {row.elecUnit > 0 ? toNepaliNumber(row.elecRate) : '-'}
                          </td>
                          <td className="py-2 px-2 print:py-1 print:px-1.5 text-right font-bold text-black border-r border-slate-300 print:border-black text-xs print:text-[10px]">
                            {row.elecCharge > 0 ? (
                              <div>
                                <div className="font-bold">{formatNepaliCurrency(row.elecCharge)}</div>
                                {row.elecTax > 0 ? (
                                  <div className="text-[10px] print:text-[8px] text-slate-700 print:text-black font-normal">
                                    ({formatNepaliCurrency(row.elecBase)} + कर {formatNepaliCurrency(row.elecTax)})
                                  </div>
                                ) : null}
                              </div>
                            ) : 'रु. ०.००'}
                          </td>
                          <td className="py-2 px-2 print:py-1 print:px-1.5 text-right font-black text-black bg-slate-100 print:bg-slate-100 border-r border-slate-300 print:border-black text-xs print:text-[10px]">
                            {formatNepaliCurrency(row.totalPaid)}
                          </td>
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 text-center text-xs print:text-[10px] text-black font-bold font-mono tracking-tight">
                            {row.accountNo && row.accountNo !== '-' ? (
                              <span className="font-mono font-bold tracking-tight text-black">{row.accountNo}</span>
                            ) : (
                              <span className="text-slate-400 print:text-black">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 print:bg-slate-200 font-black border-t-2 border-black text-black whitespace-nowrap">
                      <td colSpan={3} className="py-2 px-2 print:py-1 print:px-1 text-right text-xs print:text-[10px] text-black border-r border-slate-300 print:border-black">
                        कुल जम्मा:
                      </td>
                      <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-xs print:text-[10.5px] text-black font-black border-r border-slate-300 print:border-black">
                        {formatNepaliCurrency(table1Totals.rentGross)}
                      </td>
                      <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-xs print:text-[10.5px] text-black font-black bg-slate-200/80 print:bg-slate-100 border-r border-slate-300 print:border-black">
                        {formatNepaliCurrency(table1Totals.rentTax)}
                      </td>
                      <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-xs print:text-[10.5px] bg-slate-200 print:bg-slate-200 text-black font-black border-r border-slate-300 print:border-black">
                        {formatNepaliCurrency(table1Totals.rentNet)}
                      </td>
                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-center text-xs print:text-[10.5px] text-black font-bold border-r border-slate-300 print:border-black">
                        {toNepaliNumber(table1Totals.elecUnit)}
                      </td>
                      <td className="py-2 px-1.5 print:py-1 print:px-1 text-center text-slate-500 border-r border-slate-300 print:border-black">-</td>
                      <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-xs print:text-[10.5px] text-black font-black border-r border-slate-300 print:border-black">
                        <div>{formatNepaliCurrency(table1Totals.elecCharge)}</div>
                        {table1Totals.elecTax > 0 ? (
                          <div className="text-[10px] print:text-[8px] text-slate-700 print:text-black font-normal">
                            ({formatNepaliCurrency(table1Totals.elecBase)} + कर {formatNepaliCurrency(table1Totals.elecTax)})
                          </div>
                        ) : null}
                      </td>
                      <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-xs print:text-[10.5px] text-black bg-slate-200 print:bg-slate-200 font-black border-r border-slate-300 print:border-black">
                        {formatNepaliCurrency(table1Totals.totalPaid)}
                      </td>
                      <td className="py-2 px-2.5 print:py-1 print:px-1.5 text-center"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* TABLE 2: CLEANER PAYMENT (सफाई कर्मचारी पारिश्रमिक विवरण) */}
            {/* ========================================================================= */}
            <div className="space-y-1.5 print:space-y-1 print-section">
              <div className="flex items-center space-x-2 border-l-4 border-black pl-2">
                <h3 className="font-black text-xs sm:text-sm print:text-xs text-black tracking-wide whitespace-nowrap">
                  २. कार्यालय सफाई कर्मचारी पारिश्रमिक विवरण
                </h3>
              </div>

              <div className="overflow-x-auto print:overflow-visible border border-slate-400 print:border-black rounded-lg print:rounded-none shadow-2xs print:shadow-none w-full">
                <table className="w-full text-xs print:text-[10px] text-left border-collapse print:table-auto">
                  <thead>
                    <tr className="bg-slate-100 print:bg-slate-200 text-black font-black text-xs print:text-[10px] border-b border-slate-400 print:border-black whitespace-nowrap">
                      <th className="py-2 px-1 print:py-1 print:px-1 text-center w-7 border-r border-slate-300 print:border-black">क्र.सं.</th>
                      <th className="py-2 px-2.5 print:py-1 print:px-1.5 border-r border-slate-300 print:border-black">सफाई कर्मचारीको नाम</th>
                      <th className="py-2 px-2 print:py-1 print:px-1 border-r border-slate-300 print:border-black">शाखा</th>
                      <th className="py-2 px-2 print:py-1 print:px-1.5 text-right border-r border-slate-300 print:border-black">कुल पारिश्रमिक</th>
                      <th className="py-2 px-2 print:py-1 print:px-1.5 text-right border-r border-slate-300 print:border-black bg-slate-200/70 print:bg-slate-100">कर कट्टी (TDS)</th>
                      <th className="py-2 px-2 print:py-1 print:px-1.5 text-right border-r border-slate-300 print:border-black bg-slate-200 print:bg-slate-200 text-black font-black">खुद भुक्तानी रकम</th>
                      <th className="py-2 px-2.5 print:py-1 print:px-1.5 text-center">खाता नम्बर</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 print:divide-black bg-white">
                    {cleanerData.length === 0 ? (
                      <tr>
                        <td colSpan={7} className="py-3 text-center text-slate-500 italic">
                          कुनै सफाई कर्मचारी विवरण उपलब्ध छैन।
                        </td>
                      </tr>
                    ) : (
                      cleanerData.map((row, idx) => (
                        <tr key={row.branchId} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50 print:bg-white'} whitespace-nowrap`}>
                          <td className="py-2 px-1 print:py-1 print:px-1 text-center font-bold text-black border-r border-slate-300 print:border-black text-xs print:text-[10px]">
                            {toNepaliNumber(row.sn)}
                          </td>
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 font-bold text-black border-r border-slate-300 print:border-black text-xs print:text-[10px]">
                            {row.name}
                          </td>
                          <td className="py-2 px-2 print:py-1 print:px-1 text-black border-r border-slate-300 print:border-black font-semibold text-xs print:text-[10px]">
                            {row.branchName}
                          </td>
                          <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-black border-r border-slate-300 print:border-black font-bold text-xs print:text-[10px]">
                            {formatNepaliCurrency(row.grossAmount)}
                          </td>
                          <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-black font-bold border-r border-slate-300 print:border-black bg-slate-50 print:bg-transparent text-xs print:text-[10px]">
                            {row.taxAmount > 0 ? formatNepaliCurrency(row.taxAmount) : 'रु. ०.००'}
                          </td>
                          <td className="py-2 px-2 print:py-1 print:px-1.5 text-right font-black text-black bg-slate-100 print:bg-slate-100 border-r border-slate-300 print:border-black text-xs print:text-[10px]">
                            {formatNepaliCurrency(row.netPaidAmount)}
                          </td>
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 text-center text-xs print:text-[10px] text-black font-bold font-mono tracking-tight">
                            {row.accountNo && row.accountNo !== '-' ? (
                              <span className="font-mono font-bold tracking-tight text-black">{row.accountNo}</span>
                            ) : (
                              <span className="text-slate-400 print:text-black">-</span>
                            )}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 print:bg-slate-200 font-black border-t-2 border-black text-black whitespace-nowrap">
                      <td colSpan={3} className="py-2 px-2 print:py-1 print:px-1 text-right text-xs print:text-[10px] text-black border-r border-slate-300 print:border-black">
                        कुल जम्मा:
                      </td>
                      <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-xs print:text-[10.5px] text-black font-black border-r border-slate-300 print:border-black">
                        {formatNepaliCurrency(table2Totals.grossAmount)}
                      </td>
                      <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-xs print:text-[10.5px] text-black font-black bg-slate-200/80 print:bg-slate-100 border-r border-slate-300 print:border-black">
                        {formatNepaliCurrency(table2Totals.taxAmount)}
                      </td>
                      <td className="py-2 px-2 print:py-1 print:px-1.5 text-right text-xs print:text-[10.5px] text-black bg-slate-200 print:bg-slate-200 font-black border-r border-slate-300 print:border-black">
                        {formatNepaliCurrency(table2Totals.netPaidAmount)}
                      </td>
                      <td className="py-2 px-2.5 print:py-1 print:px-1.5 text-center"></td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* ========================================================================= */}
            {/* TABLE 3: KHAJA & TELEPHONE (खाजा खर्च तथा टेलिफोन / इन्टरनेट महसुल) */}
            {/* ========================================================================= */}
            <div className="space-y-1.5 print:space-y-1 print-section">
              <div className="flex items-center space-x-2 border-l-4 border-black pl-2">
                <h3 className="font-black text-xs sm:text-sm print:text-xs text-black tracking-wide whitespace-nowrap">
                  ३. खाजा खर्च तथा टेलिफोन / इन्टरनेट महसुल विवरण
                </h3>
              </div>

              <div className="overflow-x-auto print:overflow-visible border border-slate-400 print:border-black rounded-lg print:rounded-none shadow-2xs print:shadow-none w-full">
                <table className="w-full text-xs print:text-[10px] text-left border-collapse print:table-auto">
                  <thead>
                    <tr className="bg-slate-100 print:bg-slate-200 text-black font-black text-xs print:text-[10px] border-b border-slate-400 print:border-black whitespace-nowrap">
                      <th className="py-2 px-1 print:py-1 print:px-1 text-center w-7 border-r border-slate-300 print:border-black">क्र.सं.</th>
                      <th className="py-2 px-3 print:py-1 print:px-2 border-r border-slate-300 print:border-black">शाखा</th>
                      <th className="py-2 px-2.5 print:py-1 print:px-1.5 text-right border-r border-slate-300 print:border-black">खाजा खर्च</th>
                      <th className="py-2 px-2.5 print:py-1 print:px-1.5 text-right border-r border-slate-300 print:border-black">टेलिफोन / इन्टरनेट</th>
                      <th className="py-2 px-2.5 print:py-1 print:px-1.5 text-right bg-slate-200 print:bg-slate-200 text-black font-black">जम्मा रकम</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-300 print:divide-black bg-white">
                    {khajaTelecomData.length === 0 ? (
                      <tr>
                        <td colSpan={5} className="py-3 text-center text-slate-500 italic">
                          कुनै खाजा तथा टेलिफोन विवरण उपलब्ध छैन।
                        </td>
                      </tr>
                    ) : (
                      khajaTelecomData.map((row, idx) => (
                        <tr key={row.branchId} className={`${idx % 2 === 0 ? 'bg-white' : 'bg-slate-50 print:bg-white'} whitespace-nowrap`}>
                          <td className="py-2 px-1 print:py-1 print:px-1 text-center font-bold text-black border-r border-slate-300 print:border-black text-xs print:text-[10px]">
                            {toNepaliNumber(row.sn)}
                          </td>
                          <td className="py-2 px-3 print:py-1 print:px-2 text-black border-r border-slate-300 print:border-black font-bold text-xs print:text-[10px]">
                            {row.branchName}
                          </td>
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 text-right text-black border-r border-slate-300 print:border-black font-bold text-xs print:text-[10px]">
                            {formatNepaliCurrency(row.khajaAmount)}
                          </td>
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 text-right text-black border-r border-slate-300 print:border-black font-bold text-xs print:text-[10px]">
                            {formatNepaliCurrency(row.telecomAmount)}
                          </td>
                          <td className="py-2 px-2.5 print:py-1 print:px-1.5 text-right font-black text-black bg-slate-100 print:bg-slate-100 text-xs print:text-[10px]">
                            {formatNepaliCurrency(row.totalAmount)}
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                  <tfoot>
                    <tr className="bg-slate-100 print:bg-slate-200 font-black border-t-2 border-black text-black whitespace-nowrap">
                      <td colSpan={2} className="py-2 px-3 print:py-1 print:px-2 text-right text-xs print:text-[10px] text-black border-r border-slate-300 print:border-black">
                        कुल जम्मा:
                      </td>
                      <td className="py-2 px-2.5 print:py-1 print:px-1.5 text-right text-xs print:text-[10.5px] text-black font-black border-r border-slate-300 print:border-black">
                        {formatNepaliCurrency(table3Totals.khajaAmount)}
                      </td>
                      <td className="py-2 px-2.5 print:py-1 print:px-1.5 text-right text-xs print:text-[10.5px] text-black font-black border-r border-slate-300 print:border-black">
                        {formatNepaliCurrency(table3Totals.telecomAmount)}
                      </td>
                      <td className="py-2 px-2.5 print:py-1 print:px-1.5 text-right text-xs print:text-[10.5px] text-black bg-slate-200 print:bg-slate-200 font-black">
                        {formatNepaliCurrency(table3Totals.totalAmount)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            </div>

            {/* Bottom Grand Totals Row with Total TDS explicitly stated */}
            <div className="grid grid-cols-1 sm:grid-cols-3 print:grid-cols-3 gap-2.5 items-center print-section">
              <div className="bg-slate-100 print:bg-transparent p-2 rounded print:rounded-none border border-slate-400 print:border-black text-center sm:text-left whitespace-nowrap">
                <div className="text-[11px] print:text-[9px] font-bold text-black">मासिक सम्पूर्ण कुल खर्च (Gross Total):</div>
                <div className="text-xs sm:text-sm print:text-xs font-black text-black">
                  {formatNepaliCurrency(table1Totals.rentGross + table1Totals.elecCharge + table2Totals.grossAmount + table3Totals.totalAmount)}
                </div>
              </div>

              <div className="bg-slate-100 print:bg-transparent p-2 rounded print:rounded-none border border-slate-400 print:border-black text-center sm:text-left whitespace-nowrap">
                <div className="text-[11px] print:text-[9px] font-bold text-black">कुल कर कट्टी रकम (Total TDS):</div>
                <div className="text-xs sm:text-sm print:text-xs font-black text-black">
                  {formatNepaliCurrency(table1Totals.rentTax + table2Totals.taxAmount)}
                </div>
              </div>

              <div className="bg-slate-200 print:bg-transparent p-2 rounded-lg print:rounded-none border-2 border-black text-center sm:text-right whitespace-nowrap">
                <div className="text-[11px] print:text-[9px] font-extrabold text-black uppercase">मासिक सम्पूर्ण खुद भुक्तानी खर्च:</div>
                <div className="text-sm sm:text-base print:text-sm font-black text-black">
                  {formatNepaliCurrency(grandTotalNetExpense)}
                </div>
              </div>
            </div>

          </div>

          {/* Signatures Section: Two Columns (तयार गर्ने and स्वीकृत गर्ने) with proper physical stamp/sign height */}
          <div className="mt-6 pt-5 print:mt-4 print:pt-3 border-t border-slate-400 print:border-black print-section">
            <div className="grid grid-cols-1 sm:grid-cols-2 print:grid-cols-2 gap-8 sm:gap-16 print:gap-16 text-center text-xs font-bold text-black">
              
              {/* 1. तयार गर्ने (HR Employee Select) */}
              <div className="flex flex-col items-center">
                <div className="w-full max-w-xs">
                  <div className="h-8 print:h-10 flex items-end justify-center"></div>
                  <div className="border-t border-black pt-1.5 text-center">
                    <div className="font-black text-black text-sm print:text-xs mb-1">तयार गर्ने</div>
                    
                    {/* Non-print HR selector dropdown */}
                    <div className="no-print w-full mt-1.5">
                      <select
                        value={preparedById}
                        onChange={(e) => setPreparedById(e.target.value)}
                        disabled={isDayEnded}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-slate-50 hover:bg-white text-black font-semibold focus:ring-2 focus:ring-slate-900 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">-- तयार गर्ने कर्मचारी छान्नुहोस् --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.fullName} ({emp.designation || 'कर्मचारी'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Selected / Print View */}
                    <div className="mt-1 text-xs text-black">
                      {preparedEmployee ? (
                        <div className="bg-slate-50 print:bg-transparent p-1.5 rounded border border-slate-300 print:border-none">
                          <div className="font-black text-black text-sm print:text-xs">{preparedEmployee.fullName}</div>
                          <div className="text-[11px] print:text-[9px] text-slate-700 print:text-black font-semibold">{preparedEmployee.designation || 'कर्मचारी'}</div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 font-mono py-1">........................................</div>
                      )}
                    </div>
                  </div>
                </div>
              </div>

              {/* 2. स्वीकृत गर्ने (HR Employee Select + Save Button Below) */}
              <div className="flex flex-col items-center">
                <div className="w-full max-w-xs">
                  <div className="h-8 print:h-10 flex items-end justify-center"></div>
                  <div className="border-t border-black pt-1.5 text-center">
                    <div className="font-black text-black text-sm print:text-xs mb-1">स्वीकृत गर्ने</div>
                    
                    {/* Non-print HR selector dropdown */}
                    <div className="no-print w-full mt-1.5">
                      <select
                        value={approvedById}
                        onChange={(e) => setApprovedById(e.target.value)}
                        disabled={isDayEnded}
                        className="w-full text-xs p-2 border border-slate-300 rounded-lg bg-slate-50 hover:bg-white text-black font-semibold focus:ring-2 focus:ring-slate-900 outline-none transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <option value="">-- स्वीकृत गर्ने कर्मचारी छान्नुहोस् --</option>
                        {employees.map(emp => (
                          <option key={emp.id} value={emp.id}>
                            {emp.fullName} ({emp.designation || 'प्रबन्धक / प्रमुख'})
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Selected / Print View */}
                    <div className="mt-1 text-xs text-black">
                      {approvedEmployee ? (
                        <div className="bg-slate-50 print:bg-transparent p-1.5 rounded border border-slate-300 print:border-none">
                          <div className="font-black text-black text-sm print:text-xs">{approvedEmployee.fullName}</div>
                          <div className="text-[11px] print:text-[9px] text-slate-700 print:text-black font-semibold">{approvedEmployee.designation || 'प्रमुख कार्यकारी अधिकृत / प्रबन्धक'}</div>
                        </div>
                      ) : (
                        <div className="text-xs text-slate-400 font-mono py-1">........................................</div>
                      )}
                    </div>

                    {/* Auto Post Toggle */}
                    <div className="no-print mt-3 flex items-center justify-between bg-slate-100 border border-slate-300 rounded-xl px-3 py-2">
                      <label className={`flex items-center space-x-2 select-none ${isDayEnded ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}>
                        <input
                          type="checkbox"
                          checked={autoPost}
                          disabled={isDayEnded}
                          onChange={(e) => {
                            setAutoPost(e.target.checked);
                            if (onToggleAutoPost) onToggleAutoPost(e.target.checked);
                          }}
                          className="w-4 h-4 rounded text-emerald-600 focus:ring-emerald-500 cursor-pointer accent-emerald-600 disabled:cursor-not-allowed"
                        />
                        <span className="text-xs font-black text-slate-900">Auto Post to Ledger</span>
                      </label>
                      <span className={`text-[10px] font-black uppercase px-1.5 py-0.5 rounded ${autoPost ? 'bg-emerald-100 text-emerald-800' : 'bg-slate-200 text-slate-600'}`}>
                        {autoPost ? 'Active' : 'Off'}
                      </span>
                    </div>

                    {/* Save Button Below स्वीकृत गर्ने (Non-Printable) */}
                    <div className="no-print mt-2 w-full">
                      <button
                        onClick={handleSaveToExpensesPage}
                        disabled={!canSave || isSaving || isDayEnded}
                        title={isDayEnded ? getDayEndedBlockMessage() : (!canSave ? 'Select prepared by and approved by staff' : 'Save expense report')}
                        className={`w-full py-2.5 px-4 rounded-xl text-xs font-black transition-all flex items-center justify-center space-x-2 shadow-md cursor-pointer ${
                          canSave && !isSaving && !isDayEnded
                            ? 'bg-slate-900 hover:bg-slate-800 text-white active:scale-98 ring-2 ring-slate-700 shadow-slate-900/20'
                            : 'bg-slate-200 text-slate-400 cursor-not-allowed border border-slate-300'
                        }`}
                      >
                        <Save size={16} className={isSaving ? 'animate-spin' : ''} />
                        <span>{isSaving ? 'Saving...' : (autoPost ? 'Save Expense Sheet & Post to Ledger' : 'Save Expense Sheet')}</span>
                      </button>
                    </div>

                  </div>
                </div>
              </div>

            </div>

            {/* Bottom notification helper if signatories not selected */}
            {!canSave && (
              <div className="mt-6 p-2.5 rounded-xl bg-amber-50 border border-amber-200 text-amber-800 text-xs flex items-center justify-center space-x-2 no-print">
                <AlertCircle size={16} className="text-amber-600 shrink-0" />
                <span>Office Operating Expenses मा विवरण सुरक्षित गर्न कृपया <strong>तयार गर्ने</strong> र <strong>स्वीकृत गर्ने</strong> कर्मचारी छान्नुहोस्।</span>
              </div>
            )}
          </div>

        </div>

      </div>
    </div>
  );
};

