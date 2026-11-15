import React, { useState, useEffect, useMemo } from 'react';
import { X, Zap, Plus, Trash2, CheckCircle2, RefreshCw, AlertCircle } from 'lucide-react';
import NepaliDate from 'nepali-date-converter';
import { Branch, OfficeExpenseRecord } from '../types';
import { storageService } from '../services/storageService';
import { calculateElectricityBill, isBranchMatch } from '../utils/expenseHelpers';
import { getDayEndedBlockMessage, useDayEndLock } from '../utils/dayEndLock';
import { DayEndFieldset } from './DayEndFieldset';

interface ElectricityRow {
  id: string;
  branchId: string;
  previousUnit: number;
  currentUnit: number;
  consumedUnits: number;
  ratePerUnit: number;
  baseAmount: number;
  applyTax: boolean;
  taxRate: number;
  taxAmount: number;
  totalPaid: number;
  meterNo?: string;
  consumerNo?: string;
  sourceMonth?: string;
  isAutoCarried?: boolean;
}

interface ElectricityUnitModalProps {
  isOpen: boolean;
  onClose: () => void;
  branches: Branch[];
  currentBranchId: string;
  currentFiscalYear: string;
  currentMonth: string;
  currentDate: string;
  existingExpenses: OfficeExpenseRecord[];
  onSaveElectricityExpense: (record: OfficeExpenseRecord) => Promise<void>;
  recordedBy: string;
}

// 12 Nepali Fiscal Year Months in standard sequence (Shrawan to Ashadh)
const FY_MONTHS = [
  'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush',
  'Magh', 'Falgun', 'Chaitra', 'Baishakh', 'Jestha', 'Ashadh'
];

const NEPALI_MONTH_OPTIONS = [
  { value: 'Shrawan', label: 'Shrawan (साउन)', bsMonthNum: 4 },
  { value: 'Bhadra', label: 'Bhadra (भदौ)', bsMonthNum: 5 },
  { value: 'Ashwin', label: 'Ashwin / Asoj (असोज)', bsMonthNum: 6 },
  { value: 'Kartik', label: 'Kartik (कार्तिक)', bsMonthNum: 7 },
  { value: 'Mangsir', label: 'Mangsir (मंसिर)', bsMonthNum: 8 },
  { value: 'Poush', label: 'Poush (पुस)', bsMonthNum: 9 },
  { value: 'Magh', label: 'Magh (माघ)', bsMonthNum: 10 },
  { value: 'Falgun', label: 'Falgun (फागुन)', bsMonthNum: 11 },
  { value: 'Chaitra', label: 'Chaitra (चैत)', bsMonthNum: 12 },
  { value: 'Baishakh', label: 'Baishakh (बैशाख)', bsMonthNum: 1 },
  { value: 'Jestha', label: 'Jestha (जेठ)', bsMonthNum: 2 },
  { value: 'Ashadh', label: 'Ashadh (असार)', bsMonthNum: 3 },
];

/**
 * Normalizes variations in Nepali month naming
 */
const normalizeMonth = (m?: string): string => {
  if (!m) return 'Shrawan';
  const clean = m.trim().toLowerCase();
  if (clean.includes('bais') || clean.includes('baish') || clean.includes('बैशाख') || clean.includes('वैशाख')) return 'Baishakh';
  if (clean.includes('jes') || clean.includes('jeth') || clean.includes('जेठ')) return 'Jestha';
  if (clean.includes('ashad') || clean.includes('asar') || clean.includes('असार')) return 'Ashadh';
  if (clean.includes('shraw') || clean.includes('saun') || clean.includes('sawan') || clean.includes('साउन')) return 'Shrawan';
  if (clean.includes('bhad') || clean.includes('bhadau') || clean.includes('bharda') || clean.includes('bhado') || clean.includes('भदौ') || clean.includes('भाद्र')) return 'Bhadra';
  if (clean.includes('ashw') || clean.includes('asoj') || clean.includes('ashoj') || clean.includes('असोज') || clean.includes('आश्विन')) return 'Ashwin';
  if (clean.includes('kart') || clean.includes('कार्तिक') || clean.includes('कात्तिक')) return 'Kartik';
  if (clean.includes('mang') || clean.includes('मंसिर')) return 'Mangsir';
  if (clean.includes('pou') || clean.includes('paush') || clean.includes('pus') || clean.includes('पुस')) return 'Poush';
  if (clean.includes('mag') || clean.includes('माघ')) return 'Magh';
  if (clean.includes('falg') || clean.includes('phag') || clean.includes('फागुन')) return 'Falgun';
  if (clean.includes('chai') || clean.includes('चैत')) return 'Chaitra';
  return m;
};

/**
 * Robust fiscal year comparison (matches e.g. 2083/2084 with 2083/84 and 2083_2084)
 */
const isSameFy = (fy1?: string, fy2?: string): boolean => {
  if (!fy1 || !fy2) return true;
  const n1 = fy1.match(/\d{4}/);
  const n2 = fy2.match(/\d{4}/);
  if (n1 && n2 && n1[0] === n2[0]) return true;
  const c1 = fy1.replace(/[^0-9]/g, '');
  const c2 = fy2.replace(/[^0-9]/g, '');
  return Boolean(c1 && c2 && c1 === c2);
};

const getPreviousFiscalYear = (fy: string): string => {
  const nums = fy.match(/\d{4}/g);
  if (nums && nums.length >= 2) {
    return `${parseInt(nums[0], 10) - 1}/${parseInt(nums[1], 10) - 1}`;
  }
  return fy;
};

const getNextFiscalYear = (fy: string): string => {
  const nums = fy.match(/\d{4}/g);
  if (nums && nums.length >= 2) {
    return `${parseInt(nums[0], 10) + 1}/${parseInt(nums[1], 10) + 1}`;
  }
  return fy;
};

/**
 * Chronologically immediate preceding month
 */
const getPrecedingMonth = (fy: string, month: string): { fiscalYear: string; month: string } => {
  const norm = normalizeMonth(month);
  const idx = FY_MONTHS.indexOf(norm);
  if (idx > 0) {
    return { fiscalYear: fy, month: FY_MONTHS[idx - 1] };
  } else {
    // Shrawan (Month 1 of FY) -> Ashadh of prior FY
    return { fiscalYear: getPreviousFiscalYear(fy), month: 'Ashadh' };
  }
};

/**
 * Chronologically immediate succeeding month
 */
const getSucceedingMonth = (fy: string, month: string): { fiscalYear: string; month: string } => {
  const norm = normalizeMonth(month);
  const idx = FY_MONTHS.indexOf(norm);
  if (idx !== -1 && idx < FY_MONTHS.length - 1) {
    return { fiscalYear: fy, month: FY_MONTHS[idx + 1] };
  } else {
    // Ashadh (Month 12 of FY) -> Shrawan of next FY
    return { fiscalYear: getNextFiscalYear(fy), month: 'Shrawan' };
  }
};

/**
 * Auto-computes standard BS end-of-month date string (e.g. 2083/05/31)
 */
const computeDefaultDateForMonth = (fy: string, month: string): string => {
  const norm = normalizeMonth(month);
  const nums = fy.match(/\d{4}/g) || ['2083', '2084'];
  const startY = parseInt(nums[0], 10) || 2083;
  const endY = parseInt(nums[1], 10) || (startY + 1);

  // Month mapping: BS calendar months 1-12
  // Shrawan(4) - Chaitra(12) use startY (e.g. 2083)
  // Baishakh(1) - Ashadh(3) use endY (e.g. 2084)
  const map: Record<string, { m: number; y: number; d: number }> = {
    'Shrawan': { m: 4, y: startY, d: 31 },
    'Bhadra': { m: 5, y: startY, d: 31 },
    'Ashwin': { m: 6, y: startY, d: 30 },
    'Kartik': { m: 7, y: startY, d: 30 },
    'Mangsir': { m: 8, y: startY, d: 29 },
    'Poush': { m: 9, y: startY, d: 29 },
    'Magh': { m: 10, y: startY, d: 29 },
    'Falgun': { m: 11, y: startY, d: 30 },
    'Chaitra': { m: 12, y: startY, d: 30 },
    'Baishakh': { m: 1, y: endY, d: 31 },
    'Jestha': { m: 2, y: endY, d: 31 },
    'Ashadh': { m: 3, y: endY, d: 31 }
  };

  const info = map[norm] || { m: 5, y: startY, d: 31 };
  const padM = String(info.m).padStart(2, '0');
  const padD = String(info.d).padStart(2, '0');
  return `${info.y}/${padM}/${padD}`;
};

export const ElectricityUnitModal: React.FC<ElectricityUnitModalProps> = ({
  isOpen,
  onClose,
  branches,
  currentBranchId,
  currentFiscalYear,
  currentMonth,
  currentDate,
  existingExpenses,
  onSaveElectricityExpense,
  recordedBy
}) => {
  const isDayEnded = useDayEndLock(currentBranchId);
  // Modal Local State
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth || 'Bhadra');
  const [selectedFiscalYear, setSelectedFiscalYear] = useState<string>(currentFiscalYear || '2083/2084');
  const [selectedDate, setSelectedDate] = useState<string>(currentDate || '2083/05/31');
  const [localExpenses, setLocalExpenses] = useState<OfficeExpenseRecord[]>(existingExpenses);

  const [rows, setRows] = useState<ElectricityRow[]>([]);
  const [paymentMethod, setPaymentMethod] = useState<'Bank Transfer' | 'ConnectIPS' | 'Esewa' | 'Cash'>('Bank Transfer');
  const [isSaving, setIsSaving] = useState<boolean>(false);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  // Dynamic fiscal years
  const fiscalYearsList = useMemo(() => {
    try {
      const nd = new NepaliDate();
      const curYear = nd.getYear();
      const years: string[] = [];
      for (let y = 2079; y <= curYear + 2; y++) {
        years.push(`${y}/${y + 1}`);
      }
      if (!years.includes(selectedFiscalYear)) {
        years.push(selectedFiscalYear);
      }
      return years;
    } catch (e) {
      return ['2080/2081', '2081/2082', '2082/2083', '2083/2084', '2084/2085'];
    }
  }, [selectedFiscalYear]);

  // Keep localExpenses in sync when existingExpenses updates from parent
  useEffect(() => {
    setLocalExpenses(existingExpenses);
  }, [existingExpenses]);

  // Session-level memory for rows edited in different months during the modal session
  const [sessionMonthRows, setSessionMonthRows] = useState<Map<string, ElectricityRow[]>>(new Map());

  // Robust branch matching helper
  const matchBranch = (b1?: string, b2?: string): boolean => {
    if (!b1 || !b2) return true;
    if (b1 === 'all' || b2 === 'all') return true;
    if (branches.length === 1) return true;
    return isBranchMatch(b1, b2);
  };

  // Helper: Identify electricity expenses
  const isElecExpense = (e: OfficeExpenseRecord): boolean => {
    if (!e) return false;
    const cat = (e.category || '').toLowerCase();
    const lbl = (e.categoryLabel || '').toLowerCase();
    const eid = (e.id || '').toUpperCase();
    return (
      cat === 'electricity_bill' ||
      cat === 'electricity' ||
      lbl.includes('electricity') ||
      lbl.includes('विद्युत') ||
      eid.includes('ELEC')
    );
  };

  // Helper: Find the last recorded current reading (closing number) for a given branch to use as previous unit
  const getPreviousUnitForBranch = (
    bId: string,
    targetFy: string,
    targetMonth: string,
    allExpensesList: OfficeExpenseRecord[] = localExpenses
  ): { prevUnit: number; rate: number; meterNo: string; consumerNo: string; sourceMonth?: string; isImmediate: boolean } => {
    const immediatePrec = getPrecedingMonth(targetFy, targetMonth);

    // 0. Priority Zero: Check if user already typed readings for the preceding month in this modal session
    const sessionKey = `${immediatePrec.fiscalYear}_${immediatePrec.month}`;
    const sessionRows = sessionMonthRows.get(sessionKey) ||
      sessionMonthRows.get(`${immediatePrec.fiscalYear}_${normalizeMonth(immediatePrec.month)}`) ||
      Array.from(sessionMonthRows.entries()).find(([k]) => {
        const [kFy, kMo] = k.split('_');
        return isSameFy(kFy, immediatePrec.fiscalYear) && normalizeMonth(kMo) === normalizeMonth(immediatePrec.month);
      })?.[1];

    if (sessionRows && sessionRows.length > 0) {
      const matchRow = sessionRows.find(r => matchBranch(r.branchId, bId));
      if (matchRow) {
        let reading = 0;
        if (matchRow.currentUnit > 0) {
          reading = matchRow.currentUnit;
        } else if (matchRow.consumedUnits > 0 && matchRow.previousUnit > 0) {
          reading = matchRow.previousUnit + matchRow.consumedUnits;
        } else if (matchRow.previousUnit > 0) {
          reading = matchRow.previousUnit;
        }

        if (reading > 0) {
          return {
            prevUnit: reading,
            rate: matchRow.ratePerUnit || 12,
            meterNo: matchRow.meterNo || '',
            consumerNo: matchRow.consumerNo || '',
            sourceMonth: immediatePrec.month,
            isImmediate: true
          };
        }
      }
    }

    // 1. Highest priority: Check the immediately preceding month in allExpensesList (e.g. Bhadra when target is Ashwin/Asoj)
    const precRecs = allExpensesList.filter(e => 
      isElecExpense(e) &&
      matchBranch(e.branchId, bId) &&
      normalizeMonth(e.month) === immediatePrec.month &&
      isSameFy(e.fiscalYear, immediatePrec.fiscalYear)
    );

    // Sort to prioritize records that have valid non-zero currentUnit / current / previousUnit
    precRecs.sort((a, b) => {
      const aCurr = (a.currentUnit && a.currentUnit > 0) ? a.currentUnit : (a.current && a.current > 0 ? a.current : 0);
      const bCurr = (b.currentUnit && b.currentUnit > 0) ? b.currentUnit : (b.current && b.current > 0 ? b.current : 0);
      if (bCurr !== aCurr) return bCurr - aCurr;
      const aPrev = (a.previousUnit && a.previousUnit > 0) ? a.previousUnit : (a.previous && a.previous > 0 ? a.previous : 0);
      const bPrev = (b.previousUnit && b.previousUnit > 0) ? b.previousUnit : (b.previous && b.previous > 0 ? b.previous : 0);
      if (bPrev !== aPrev) return bPrev - aPrev;
      return (b.createdAt || 0) - (a.createdAt || 0);
    });

    if (precRecs.length > 0) {
      for (const precRec of precRecs) {
        let reading = 0;
        if (precRec.currentUnit !== undefined && precRec.currentUnit !== null && precRec.currentUnit > 0) {
          reading = precRec.currentUnit; // Closing number of previous month
        } else if (precRec.current !== undefined && precRec.current !== null && precRec.current > 0) {
          reading = precRec.current;
        } else if (precRec.consumedUnits !== undefined && precRec.consumedUnits > 0 && precRec.previousUnit !== undefined && precRec.previousUnit > 0) {
          reading = precRec.previousUnit + precRec.consumedUnits; // Reconstruct closing number
        } else if (precRec.consumedUnits !== undefined && precRec.consumedUnits > 0 && precRec.previous !== undefined && precRec.previous > 0) {
          reading = precRec.previous + precRec.consumedUnits;
        } else if (precRec.previousUnit !== undefined && precRec.previousUnit > 0) {
          reading = precRec.previousUnit;
        } else if (precRec.previous !== undefined && precRec.previous > 0) {
          reading = precRec.previous;
        }

        if (reading > 0) {
          return {
            prevUnit: reading,
            rate: precRec.ratePerUnit || 12,
            meterNo: precRec.meterNo || '',
            consumerNo: precRec.consumerNo || '',
            sourceMonth: immediatePrec.month,
            isImmediate: true
          };
        }
      }
    }

    // 2. Second priority: Walk back through past months in reverse chronological order (up to 12 months)
    let curM = targetMonth;
    let curFy = targetFy;
    for (let i = 0; i < 12; i++) {
      const step = getPrecedingMonth(curFy, curM);
      curM = step.month;
      curFy = step.fiscalYear;

      const matches = allExpensesList.filter(e => 
        isElecExpense(e) &&
        matchBranch(e.branchId, bId) &&
        normalizeMonth(e.month) === curM &&
        isSameFy(e.fiscalYear, curFy)
      );

      for (const match of matches) {
        let reading = 0;
        if (match.currentUnit !== undefined && match.currentUnit !== null && match.currentUnit > 0) {
          reading = match.currentUnit;
        } else if (match.consumedUnits !== undefined && match.consumedUnits > 0 && match.previousUnit !== undefined && match.previousUnit > 0) {
          reading = match.previousUnit + match.consumedUnits;
        } else if (match.previousUnit !== undefined && match.previousUnit > 0) {
          reading = match.previousUnit;
        }

        if (reading > 0) {
          return {
            prevUnit: reading,
            rate: match.ratePerUnit || 12,
            meterNo: match.meterNo || '',
            consumerNo: match.consumerNo || '',
            sourceMonth: curM,
            isImmediate: false
          };
        }
      }
    }

    // 3. Fallback: Any record in existing history
    const anyRecs = allExpensesList
      .filter(e => isElecExpense(e) && matchBranch(e.branchId, bId))
      .sort((a, b) => (b.createdAt || 0) - (a.createdAt || 0));

    for (const anyRec of anyRecs) {
      const reading = (anyRec.currentUnit && anyRec.currentUnit > 0)
        ? anyRec.currentUnit
        : ((anyRec.consumedUnits && anyRec.previousUnit) ? (anyRec.previousUnit + anyRec.consumedUnits) : (anyRec.previousUnit || 0));
      if (reading > 0) {
        return {
          prevUnit: reading,
          rate: anyRec.ratePerUnit || 12,
          meterNo: anyRec.meterNo || '',
          consumerNo: anyRec.consumerNo || '',
          sourceMonth: anyRec.month,
          isImmediate: false
        };
      }
    }

    return { prevUnit: 0, rate: 12, meterNo: '', consumerNo: '', isImmediate: false };
  };

  /**
   * Builds rows for a target month and fiscal year
   */
  const buildRowsForMonth = (
    monthToLoad: string,
    fyToLoad: string,
    expensesList: OfficeExpenseRecord[] = localExpenses
  ): ElectricityRow[] => {
    const targetMonthNorm = normalizeMonth(monthToLoad);

    // 1. Find all electricity records matching this month and fiscal year
    const currentMonthElectricity = expensesList.filter(e => {
      const isElec = isElecExpense(e);
      const matchMo = normalizeMonth(e.month) === targetMonthNorm;
      const matchFy = isSameFy(e.fiscalYear, fyToLoad);
      return isElec && matchMo && matchFy;
    });

    // 2. Group by branchId
    const existingByBranch = new Map<string, OfficeExpenseRecord>();
    currentMonthElectricity.forEach(rec => {
      const bId = rec.branchId || 'main';
      const existing = existingByBranch.get(bId);
      if (!existing) {
        existingByBranch.set(bId, rec);
      } else {
        const recHasData = (rec.currentUnit && rec.currentUnit > 0) || (rec.consumedUnits && rec.consumedUnits > 0);
        const existingHasData = (existing.currentUnit && existing.currentUnit > 0) || (existing.consumedUnits && existing.consumedUnits > 0);
        if (recHasData && !existingHasData) {
          existingByBranch.set(bId, rec);
        } else if ((rec.createdAt || 0) > (existing.createdAt || 0) && (!existingHasData || recHasData)) {
          existingByBranch.set(bId, rec);
        }
      }
    });

    // 3. Ensure each cooperative branch appears
    const targetBranches = branches && branches.length > 0
      ? branches
      : [{ id: 'main', name: 'Main Branch', code: 'C01' } as Branch];

    const loadedRows: ElectricityRow[] = targetBranches.map((b) => {
      // Find matching record using matchBranch
      let rec: OfficeExpenseRecord | undefined = undefined;
      for (const [key, r] of existingByBranch.entries()) {
        if (matchBranch(key, b.id) || matchBranch(r.branchId, b.id)) {
          rec = r;
          break;
        }
      }

      const history = getPreviousUnitForBranch(b.id, fyToLoad, monthToLoad, expensesList);

      // Auto-carry forward logic:
      // If the preceding month has a recorded closing reading (history.prevUnit > 0),
      // that closing reading becomes THIS month's opening/previous reading!
      let prev = 0;
      let isCarried = false;

      if (history.prevUnit > 0) {
        prev = history.prevUnit;
        isCarried = true;
      } else if (rec && rec.previousUnit !== undefined && rec.previousUnit !== null && rec.previousUnit > 0) {
        prev = rec.previousUnit;
      } else if (rec && rec.previous !== undefined && rec.previous !== null && rec.previous > 0) {
        prev = rec.previous;
      } else {
        prev = 0;
      }

      let curr = (rec?.currentUnit && rec.currentUnit > 0)
        ? rec.currentUnit
        : ((rec?.current && rec.current > 0) ? rec.current : 0);

      if (curr === 0 && rec?.consumedUnits && rec.consumedUnits > 0 && prev > 0) {
        curr = prev + rec.consumedUnits;
      }
      const consumed = curr > prev ? Math.max(0, curr - prev) : (rec?.consumedUnits || 0);
      const rate = rec?.ratePerUnit || history.rate || 12;
      const baseAmount = parseFloat((consumed * rate).toFixed(2));
      const applyTax = rec?.taxDeduction !== undefined ? rec.taxDeduction > 0 : false;
      const taxRate = applyTax ? 5 : 0;
      const taxAmount = applyTax ? parseFloat((baseAmount * 0.05).toFixed(2)) : 0;
      const totalPaid = parseFloat((baseAmount + taxAmount).toFixed(2));

      return {
        id: `row_${b.id}`,
        branchId: b.id,
        previousUnit: prev,
        currentUnit: curr,
        consumedUnits: consumed,
        ratePerUnit: rate,
        baseAmount,
        applyTax,
        taxRate,
        taxAmount,
        totalPaid,
        meterNo: rec?.meterNo || history.meterNo || '',
        consumerNo: rec?.consumerNo || history.consumerNo || '',
        sourceMonth: isCarried ? (history.sourceMonth || (targetMonthNorm === 'Ashwin' ? 'Bhadra' : undefined)) : undefined,
        isAutoCarried: isCarried
      };
    });

    // Also append any branch found in existingByBranch that is not in targetBranches
    existingByBranch.forEach((rec, bId) => {
      if (!targetBranches.some(b => matchBranch(b.id, bId))) {
        const history = getPreviousUnitForBranch(bId, fyToLoad, monthToLoad, expensesList);
        const prev = history.prevUnit > 0 ? history.prevUnit : (rec.previousUnit || 0);
        const curr = rec.currentUnit || 0;
        const consumed = curr > prev ? Math.max(0, curr - prev) : (rec.consumedUnits || 0);
        const rate = rec.ratePerUnit || 12;
        const baseAmount = parseFloat((consumed * rate).toFixed(2));
        const applyTax = rec.taxDeduction !== undefined ? rec.taxDeduction > 0 : false;
        const taxRate = applyTax ? 5 : 0;
        const taxAmount = applyTax ? parseFloat((baseAmount * 0.05).toFixed(2)) : 0;
        const totalPaid = parseFloat((baseAmount + taxAmount).toFixed(2));

        loadedRows.push({
          id: `row_${bId}`,
          branchId: bId,
          previousUnit: prev,
          currentUnit: curr,
          consumedUnits: consumed,
          ratePerUnit: rate,
          baseAmount,
          applyTax,
          taxRate,
          taxAmount,
          totalPaid,
          meterNo: rec.meterNo || '',
          consumerNo: rec.consumerNo || '',
          sourceMonth: history.sourceMonth || (targetMonthNorm === 'Ashwin' ? 'Bhadra' : undefined),
          isAutoCarried: history.prevUnit > 0
        });
      }
    });

    // Set payment method from saved record if available
    const sampleRec = Array.from(existingByBranch.values())[0];
    if (sampleRec?.paymentMethod) {
      setPaymentMethod(sampleRec.paymentMethod as any);
    }

    return loadedRows;
  };

  // Sync initial state when modal opens
  useEffect(() => {
    if (isOpen) {
      const initMo = currentMonth || 'Bhadra';
      const initFy = currentFiscalYear || '2083/2084';
      const initDt = currentDate || computeDefaultDateForMonth(initFy, initMo);

      setSelectedMonth(initMo);
      setSelectedFiscalYear(initFy);
      setSelectedDate(initDt);
      setSaveMessage(null);

      const initialRows = buildRowsForMonth(initMo, initFy, existingExpenses);
      setRows(initialRows);
    }
  }, [isOpen, currentMonth, currentFiscalYear, currentDate]);

  if (!isOpen) return null;

  // Month dropdown change handler
  const handleMonthChange = (newMonth: string) => {
    // 1. Snapshot current month's typed rows into session state
    if (rows.length > 0) {
      const curKey = `${selectedFiscalYear}_${selectedMonth}`;
      sessionMonthRows.set(curKey, [...rows]);
      const normCurMo = normalizeMonth(selectedMonth);
      sessionMonthRows.set(`${selectedFiscalYear}_${normCurMo}`, [...rows]);
    }

    // 2. Also update localExpenses with any valid units typed for the current month
    const updatedLocal = [...localExpenses];
    let hasEdits = false;
    rows.forEach(r => {
      if (r.currentUnit > 0 || r.consumedUnits > 0 || r.previousUnit > 0) {
        hasEdits = true;
        const normMo = normalizeMonth(selectedMonth);
        const idx = updatedLocal.findIndex(e => 
          isElecExpense(e) &&
          matchBranch(e.branchId, r.branchId) &&
          normalizeMonth(e.month) === normMo &&
          isSameFy(e.fiscalYear, selectedFiscalYear)
        );

        const taxAmount = r.applyTax ? parseFloat((r.baseAmount * 0.05).toFixed(2)) : 0;
        const totalPaid = parseFloat((r.baseAmount + taxAmount).toFixed(2));
        const rec: OfficeExpenseRecord = {
          id: idx !== -1 ? updatedLocal[idx].id : `EXP_ELEC_${r.branchId}_${selectedFiscalYear.replace(/[/\\s]/g, '_')}_${selectedMonth.replace(/[/\\s]/g, '_')}`,
          branchId: r.branchId,
          category: 'electricity_bill',
          categoryLabel: 'Electricity Bill',
          date: selectedDate,
          month: selectedMonth,
          fiscalYear: selectedFiscalYear,
          amount: totalPaid,
          taxDeduction: taxAmount,
          netPaidAmount: totalPaid,
          previousUnit: r.previousUnit,
          currentUnit: r.currentUnit,
          previous: r.previousUnit,
          current: r.currentUnit,
          consumedUnits: r.consumedUnits,
          ratePerUnit: r.ratePerUnit,
          paidTo: 'Nepal Electricity Authority (NEA)',
          paymentMethod: paymentMethod || 'Bank Transfer',
          meterNo: r.meterNo || '',
          consumerNo: r.consumerNo || '',
          recordedBy: recordedBy || 'Admin',
          createdAt: Date.now()
        };

        if (idx !== -1) {
          updatedLocal[idx] = rec;
        } else {
          updatedLocal.unshift(rec);
        }
      }
    });

    if (hasEdits) {
      setLocalExpenses(updatedLocal);
      storageService.saveAllOfficeExpenses(updatedLocal).catch(console.warn);
    }

    setSelectedMonth(newMonth);
    const newDate = computeDefaultDateForMonth(selectedFiscalYear, newMonth);
    setSelectedDate(newDate);
    setSaveMessage(null);

    const newRows = buildRowsForMonth(newMonth, selectedFiscalYear, updatedLocal);
    setRows(newRows);
  };

  // Fiscal Year dropdown change handler
  const handleFiscalYearChange = (newFy: string) => {
    setSelectedFiscalYear(newFy);
    const newDate = computeDefaultDateForMonth(newFy, selectedMonth);
    setSelectedDate(newDate);
    setSaveMessage(null);

    const newRows = buildRowsForMonth(selectedMonth, newFy, localExpenses);
    setRows(newRows);
  };

  // Quick Action: Auto-fetch & sync all previous units from preceding month
  const handleSyncFromPreviousMonth = () => {
    const precedingInfo = getPrecedingMonth(selectedFiscalYear, selectedMonth);
    let updatedCount = 0;

    setRows(prevRows => prevRows.map(row => {
      const history = getPreviousUnitForBranch(row.branchId, selectedFiscalYear, selectedMonth, localExpenses);
      if (history.prevUnit > 0) {
        updatedCount++;
        const prev = history.prevUnit;
        const consumed = row.currentUnit > 0 ? Math.max(0, row.currentUnit - prev) : 0;
        const rate = row.ratePerUnit || history.rate || 12;
        const baseAmount = parseFloat((consumed * rate).toFixed(2));
        const isTax = row.applyTax !== undefined ? row.applyTax : (consumed > 50);
        const taxRate = isTax ? 5 : 0;
        const taxAmount = isTax ? parseFloat((baseAmount * 0.05).toFixed(2)) : 0;
        const totalPaid = parseFloat((baseAmount + taxAmount).toFixed(2));
        return {
          ...row,
          previousUnit: prev,
          consumedUnits: consumed,
          ratePerUnit: rate,
          baseAmount,
          applyTax: isTax,
          taxRate,
          taxAmount,
          totalPaid,
          sourceMonth: history.sourceMonth,
          isAutoCarried: true
        };
      }
      return row;
    }));

    setSaveMessage(`Synced ${updatedCount} branch readings from ${precedingInfo.month}!`);
    setTimeout(() => setSaveMessage(null), 3500);
  };

  // Add new branch row manually
  const handleAddRow = () => {
    const existingBranchIds = new Set(rows.map(r => r.branchId));
    const availableBranch = branches.find(b => !existingBranchIds.has(b.id)) || branches[0];
    const bId = availableBranch ? availableBranch.id : 'main';

    const history = getPreviousUnitForBranch(bId, selectedFiscalYear, selectedMonth, localExpenses);

    const newRow: ElectricityRow = {
      id: `row_${bId}_${Date.now()}`,
      branchId: bId,
      previousUnit: history.prevUnit,
      currentUnit: 0,
      consumedUnits: 0,
      ratePerUnit: history.rate || 12,
      baseAmount: 0,
      applyTax: false,
      taxRate: 0,
      taxAmount: 0,
      totalPaid: 0,
      meterNo: history.meterNo,
      consumerNo: history.consumerNo,
      sourceMonth: history.sourceMonth,
      isAutoCarried: history.prevUnit > 0
    };
    setRows(prev => [...prev, newRow]);
  };

  // Remove row
  const handleRemoveRow = (id: string) => {
    setRows(prev => prev.filter(r => r.id !== id));
  };

  // Handle branch change in a row
  const handleRowBranchChange = (rowId: string, newBranchId: string) => {
    const history = getPreviousUnitForBranch(newBranchId, selectedFiscalYear, selectedMonth, localExpenses);
    setRows(prev => prev.map(row => {
      if (row.id === rowId) {
        const prevUnit = history.prevUnit;
        const currentUnit = row.currentUnit;
        const consumed = currentUnit > 0 ? Math.max(0, currentUnit - prevUnit) : 0;
        const rate = history.rate || row.ratePerUnit || 12;
        const baseAmount = parseFloat((consumed * rate).toFixed(2));
        const isTax = Boolean(row.applyTax);
        const taxRate = isTax ? 5 : 0;
        const taxAmount = isTax ? parseFloat((baseAmount * 0.05).toFixed(2)) : 0;
        const totalPaid = parseFloat((baseAmount + taxAmount).toFixed(2));
        return {
          ...row,
          branchId: newBranchId,
          previousUnit: prevUnit,
          consumedUnits: consumed,
          ratePerUnit: rate,
          baseAmount,
          applyTax: isTax,
          taxRate,
          taxAmount,
          totalPaid,
          meterNo: history.meterNo,
          consumerNo: history.consumerNo,
          sourceMonth: history.sourceMonth,
          isAutoCarried: prevUnit > 0
        };
      }
      return row;
    }));
  };

  // Handle previous unit change (allows direct entry/manual override)
  const handleRowPreviousChange = (rowId: string, prevVal: number) => {
    setRows(prev => prev.map(row => {
      if (row.id === rowId) {
        const currVal = row.currentUnit;
        const consumed = currVal > 0 ? Math.max(0, currVal - prevVal) : 0;
        const rate = row.ratePerUnit || 12;
        const baseAmount = parseFloat((consumed * rate).toFixed(2));
        const isTax = Boolean(row.applyTax);
        const taxRate = isTax ? 5 : 0;
        const taxAmount = isTax ? parseFloat((baseAmount * 0.05).toFixed(2)) : 0;
        const totalPaid = parseFloat((baseAmount + taxAmount).toFixed(2));
        return {
          ...row,
          previousUnit: prevVal,
          consumedUnits: consumed,
          baseAmount,
          applyTax: isTax,
          taxRate,
          taxAmount,
          totalPaid,
          isAutoCarried: false
        };
      }
      return row;
    }));
  };

  // Handle current unit change
  const handleRowCurrentChange = (rowId: string, currVal: number) => {
    setRows(prev => prev.map(row => {
      if (row.id === rowId) {
        const prevVal = row.previousUnit;
        const consumed = currVal >= prevVal ? Math.max(0, currVal - prevVal) : 0;
        const rate = row.ratePerUnit || 12;
        const baseAmount = parseFloat((consumed * rate).toFixed(2));
        // Only apply tax if user explicitly checked the tax box
        const isTax = Boolean(row.applyTax);
        const taxRate = isTax ? 5 : 0;
        const taxAmount = isTax ? parseFloat((baseAmount * 0.05).toFixed(2)) : 0;
        const totalPaid = parseFloat((baseAmount + taxAmount).toFixed(2));
        return {
          ...row,
          currentUnit: currVal,
          consumedUnits: consumed,
          baseAmount,
          applyTax: isTax,
          taxRate,
          taxAmount,
          totalPaid
        };
      }
      return row;
    }));
  };

  // Handle rate change
  const handleRowRateChange = (rowId: string, rateVal: number) => {
    setRows(prev => prev.map(row => {
      if (row.id === rowId) {
        const rate = rateVal > 0 ? rateVal : 12;
        const baseAmount = parseFloat((row.consumedUnits * rate).toFixed(2));
        const isTax = row.applyTax;
        const taxRate = isTax ? 5 : 0;
        const taxAmount = isTax ? parseFloat((baseAmount * 0.05).toFixed(2)) : 0;
        const totalPaid = parseFloat((baseAmount + taxAmount).toFixed(2));
        return {
          ...row,
          ratePerUnit: rateVal,
          baseAmount,
          taxRate,
          taxAmount,
          totalPaid
        };
      }
      return row;
    }));
  };

  // Toggle 5% Tax Apply checkbox for a row
  const handleRowTaxToggle = (rowId: string, checked: boolean) => {
    setRows(prev => prev.map(row => {
      if (row.id === rowId) {
        const taxRate = checked ? 5 : 0;
        const taxAmount = checked ? parseFloat((row.baseAmount * 0.05).toFixed(2)) : 0;
        const totalPaid = parseFloat((row.baseAmount + taxAmount).toFixed(2));
        return {
          ...row,
          applyTax: checked,
          taxRate,
          taxAmount,
          totalPaid
        };
      }
      return row;
    }));
  };

  // Totals
  const totalConsumedUnits = rows.reduce((sum, r) => sum + (r.consumedUnits || 0), 0);
  const totalBaseBill = rows.reduce((sum, r) => sum + (r.baseAmount || 0), 0);
  const totalTaxAmount = rows.reduce((sum, r) => sum + (r.taxAmount || 0), 0);
  const totalElectricityBill = rows.reduce((sum, r) => sum + (r.totalPaid || 0), 0);

  // Save all rows to storage and cascade to next month
  const handleSaveAll = async () => {
    if (rows.length === 0) {
      alert('Please add at least one branch electricity row.');
      return;
    }

    setIsSaving(true);
    setSaveMessage(null);
    try {
      const allExpenses = await storageService.getOfficeExpenses();
      const timestamp = Date.now();
      const cleanFy = (selectedFiscalYear || '2083_2084').replace(/[/\\s]/g, '_');
      const cleanMonth = (selectedMonth || 'Bhadra').replace(/[/\\s]/g, '_');

      const targetMonthNorm = normalizeMonth(selectedMonth);

      // 1. Filter out existing electricity records for this month and fiscal year so we replace with clean updated rows
      let updatedExpenses = allExpenses.filter(e => {
        const isElec = e.category === 'electricity_bill';
        const matchMo = normalizeMonth(e.month) === targetMonthNorm;
        const matchFy = isSameFy(e.fiscalYear, selectedFiscalYear);
        return !(isElec && matchMo && matchFy);
      });

      // 2. Deduplicate rows if same branch was accidentally added multiple times
      const uniqueBranchRows = new Map<string, ElectricityRow>();
      rows.forEach(r => {
        const existing = uniqueBranchRows.get(r.branchId);
        if (!existing) {
          uniqueBranchRows.set(r.branchId, r);
        } else {
          if ((r.currentUnit > 0 || r.consumedUnits > 0) && (existing.currentUnit === 0 && existing.consumedUnits === 0)) {
            uniqueBranchRows.set(r.branchId, r);
          }
        }
      });

      const finalRows = Array.from(uniqueBranchRows.values());
      const savedRecordsForCallback: OfficeExpenseRecord[] = [];

      // 3. Create clean, updated records with deterministic IDs
      for (let i = 0; i < finalRows.length; i++) {
        const r = finalRows[i];
        const branchObj = branches.find(b => b.id === r.branchId);
        const branchName = branchObj ? branchObj.name : r.branchId;
        const deterministicId = `EXP_ELEC_${r.branchId}_${cleanFy}_${cleanMonth}`;

        const taxAmount = r.applyTax ? parseFloat((r.baseAmount * 0.05).toFixed(2)) : 0;
        const totalPaid = parseFloat((r.baseAmount + taxAmount).toFixed(2));

        const remarksText = taxAmount > 0
          ? `Electricity Bill for ${selectedMonth} (${r.consumedUnits} Units @ Rs. ${r.ratePerUnit} = Base Rs. ${r.baseAmount.toFixed(2)} + 5% Govt Tax Rs. ${taxAmount.toFixed(2)}) - ${branchName}`
          : `Electricity Bill for ${selectedMonth} (${r.consumedUnits} Units @ Rs. ${r.ratePerUnit} = Rs. ${r.baseAmount.toFixed(2)}) - ${branchName}`;

        const record: OfficeExpenseRecord = {
          id: deterministicId,
          branchId: r.branchId,
          category: 'electricity_bill',
          categoryLabel: 'Electricity Bill',
          date: selectedDate,
          month: selectedMonth,
          fiscalYear: selectedFiscalYear,
          amount: totalPaid,
          taxDeduction: taxAmount,
          netPaidAmount: totalPaid,
          previousUnit: r.previousUnit,
          currentUnit: r.currentUnit,
          previous: r.previousUnit,
          current: r.currentUnit,
          consumedUnits: r.consumedUnits,
          ratePerUnit: r.ratePerUnit,
          paidTo: 'Nepal Electricity Authority (NEA)',
          paymentMethod: paymentMethod || 'Bank Transfer',
          meterNo: r.meterNo || '',
          consumerNo: r.consumerNo || '',
          recordedBy: recordedBy || 'Admin',
          remarks: remarksText,
          createdAt: timestamp + i
        };

        updatedExpenses.unshift(record);
        savedRecordsForCallback.push(record);
      }

      // 4. CASCADE FORWARD: Carry closing readings (currentUnit) forward as next month's previousUnit (e.g. Bhadra -> Asoj)
      const succ = getSucceedingMonth(selectedFiscalYear, selectedMonth);
      let cascadedBranches: string[] = [];

      finalRows.forEach(r => {
        if (r.currentUnit > 0) {
          const succElec = updatedExpenses.find(e => 
            isElecExpense(e) &&
            matchBranch(e.branchId, r.branchId) &&
            normalizeMonth(e.month) === succ.month &&
            isSameFy(e.fiscalYear, succ.fiscalYear)
          );

          if (succElec) {
            succElec.previousUnit = r.currentUnit;
            succElec.previous = r.currentUnit;
            if (succElec.currentUnit && succElec.currentUnit > 0) {
              const succConsumed = Math.max(0, succElec.currentUnit - r.currentUnit);
              const succRate = succElec.ratePerUnit || 12;
              const succBill = calculateElectricityBill(succConsumed, succRate);
              succElec.consumedUnits = succBill.consumedUnits;
              succElec.ratePerUnit = succBill.ratePerUnit;
              succElec.amount = succBill.totalAmount;
              succElec.taxDeduction = succBill.taxAmount;
              succElec.netPaidAmount = succBill.totalAmount;
              succElec.current = succElec.currentUnit;
              succElec.remarks = succBill.consumedUnits > 50
                ? `Electricity Bill for ${succ.month} (${succBill.consumedUnits} Units @ Rs. ${succRate} = Rs. ${succBill.baseAmount.toFixed(2)} + 5% Govt Tax Rs. ${succBill.taxAmount.toFixed(2)})`
                : `Electricity Bill for ${succ.month} (${succBill.consumedUnits} Units @ Rs. ${succRate})`;
            } else if (succElec.consumedUnits && succElec.consumedUnits > 0) {
              succElec.currentUnit = r.currentUnit + succElec.consumedUnits;
              succElec.current = succElec.currentUnit;
            }
            cascadedBranches.push(succElec.branchId || r.branchId);
          } else {
            // Seed the succeeding month (Asoj) record with Bhadra's closing reading as its previousUnit!
            const succCleanFy = succ.fiscalYear.replace(/[/\\s]/g, '_');
            const succCleanMonth = succ.month.replace(/[/\\s]/g, '_');
            const succRecord: OfficeExpenseRecord = {
              id: `EXP_ELEC_${r.branchId}_${succCleanFy}_${succCleanMonth}`,
              branchId: r.branchId,
              category: 'electricity_bill',
              categoryLabel: 'Electricity Bill',
              date: computeDefaultDateForMonth(succ.fiscalYear, succ.month),
              month: succ.month,
              fiscalYear: succ.fiscalYear,
              amount: 0,
              taxDeduction: 0,
              netPaidAmount: 0,
              previousUnit: r.currentUnit,
              currentUnit: 0,
              previous: r.currentUnit,
              current: 0,
              consumedUnits: 0,
              ratePerUnit: r.ratePerUnit || 12,
              paidTo: 'Nepal Electricity Authority (NEA)',
              paymentMethod: paymentMethod || 'Bank Transfer',
              meterNo: r.meterNo || '',
              consumerNo: r.consumerNo || '',
              recordedBy: recordedBy || 'Admin',
              remarks: `Auto-carried from ${selectedMonth} closing reading (${r.currentUnit} U)`,
              createdAt: timestamp + 500
            };
            updatedExpenses.unshift(succRecord);
            cascadedBranches.push(r.branchId);
          }
        }
      });

      // Update sessionMonthRows for current month
      const curKey = `${selectedFiscalYear}_${selectedMonth}`;
      sessionMonthRows.set(curKey, [...finalRows]);
      sessionMonthRows.set(`${selectedFiscalYear}_${normalizeMonth(selectedMonth)}`, [...finalRows]);

      // 5. Purge old duplicate records from database table for this month & fiscal year
      try {
        await storageService.deleteElectricityExpensesForMonth(selectedFiscalYear, selectedMonth);
      } catch (purgeErr) {
        console.warn("Electricity DB purge warning:", purgeErr);
      }

      // 6. Persist clean updated expenses
      await storageService.saveAllOfficeExpenses(updatedExpenses);
      setLocalExpenses(updatedExpenses);

      // 7. Notify parent and broadcast event
      if (onSaveElectricityExpense && savedRecordsForCallback.length > 0) {
        await onSaveElectricityExpense(savedRecordsForCallback[0]);
      }
      window.dispatchEvent(new CustomEvent('officeExpensesUpdated'));

      // 8. User feedback message
      const succMsg = cascadedBranches.length > 0
        ? `Saved! Successfully carried forward ${finalRows.length} readings into ${succ.month}.`
        : `Saved ${selectedMonth} electricity readings successfully!`;

      setSaveMessage(succMsg);
      setTimeout(() => setSaveMessage(null), 4000);

    } catch (err: any) {
      alert('Error saving electricity entries: ' + (err?.message || 'Unknown error'));
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-slate-950/80 backdrop-blur-xs z-[7000] flex items-center justify-center p-2 sm:p-4 overflow-y-auto">
      <div className="bg-white rounded-2xl border border-slate-300 shadow-2xl w-full max-w-6xl overflow-hidden animate-in zoom-in-95 duration-150 flex flex-col max-h-[92vh]">
        
        {/* Header */}
        <div className="bg-slate-900 text-white px-4 py-3 flex justify-between items-center shrink-0">
          <div className="flex items-center space-x-2">
            <Zap size={17} className="text-amber-400 fill-amber-400" />
            <h3 className="font-black text-xs sm:text-sm uppercase tracking-wide">
              Monthly Electricity Meter Reading Entry
            </h3>
          </div>
          <button
            onClick={onClose}
            className="p-1 text-slate-400 hover:text-white rounded-lg transition-colors cursor-pointer"
          >
            <X size={18} />
          </button>
        </div>

        {/* Top Interactive Control Bar: Month, FY, Date (BS), Payment Mode, Auto-Sync & Add Button */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2.5 flex flex-wrap items-center justify-between gap-2.5 shrink-0">
          <div className="flex flex-wrap items-center gap-2.5">
            
            {/* Month Dropdown */}
            <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              <span className="text-[11px] font-bold text-amber-900">Month:</span>
              <select
                value={selectedMonth}
                onChange={(e) => handleMonthChange(e.target.value)}
                className="h-7 bg-white border border-amber-300 rounded px-2 text-xs font-black text-amber-950 outline-none focus:border-amber-600 cursor-pointer"
              >
                {NEPALI_MONTH_OPTIONS.map(opt => (
                  <option key={opt.value} value={opt.value}>
                    {opt.label}
                  </option>
                ))}
              </select>
            </div>

            {/* Fiscal Year Dropdown */}
            <div className="flex items-center space-x-1.5 bg-amber-50 border border-amber-200 px-2.5 py-1 rounded-lg">
              <span className="text-[11px] font-bold text-amber-900">FY:</span>
              <select
                value={selectedFiscalYear}
                onChange={(e) => handleFiscalYearChange(e.target.value)}
                className="h-7 bg-white border border-amber-300 rounded px-2 text-xs font-black text-amber-950 font-mono outline-none focus:border-amber-600 cursor-pointer"
              >
                {fiscalYearsList.map(fy => (
                  <option key={fy} value={fy}>
                    {fy}
                  </option>
                ))}
              </select>
            </div>

            {/* Date (BS) Editable Input */}
            <div className="flex items-center space-x-1.5 bg-white border border-slate-200 px-2.5 py-1 rounded-lg">
              <span className="text-[11px] font-bold text-slate-600">Date (BS):</span>
              <input
                type="text"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                disabled={isDayEnded}
                placeholder="YYYY/MM/DD"
                className="w-24 h-7 text-xs font-mono font-bold text-slate-900 bg-slate-50 border border-slate-300 rounded px-2 outline-none focus:bg-white focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                title={isDayEnded ? getDayEndedBlockMessage() : "Nepali Date (BS) for this bill entry - click to edit"}
              />
            </div>

            {/* Payment Method */}
            <div className="flex items-center space-x-1.5">
              <span className="text-[11px] font-bold text-slate-700">Payment:</span>
              <select
                value={paymentMethod}
                onChange={(e) => setPaymentMethod(e.target.value as any)}
                disabled={isDayEnded}
                className="h-7 bg-white border border-slate-300 rounded-md px-2 text-xs font-bold text-slate-800 outline-none focus:border-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <option value="Bank Transfer">Bank Transfer</option>
                <option value="ConnectIPS">ConnectIPS</option>
                <option value="Esewa">eSewa</option>
                <option value="Cash">Cash</option>
              </select>
            </div>

            {/* Auto-Sync Prev Button */}
            <button
              type="button"
              onClick={handleSyncFromPreviousMonth}
              disabled={isDayEnded}
              className="h-7 px-2.5 bg-emerald-50 hover:bg-emerald-100 text-emerald-800 border border-emerald-300 rounded-lg text-[11px] font-bold transition-all flex items-center space-x-1 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              title={isDayEnded ? getDayEndedBlockMessage() : "Auto-sync previous readings from previous month"}
            >
              <RefreshCw size={12} className="text-emerald-700 shrink-0" />
              <span>Auto-Sync Prev</span>
            </button>

          </div>

          {/* Add Row Button */}
          <button
            type="button"
            onClick={handleAddRow}
            disabled={isDayEnded}
            title={isDayEnded ? getDayEndedBlockMessage() : undefined}
            className="h-7.5 px-3 bg-blue-600 hover:bg-blue-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-black transition-all shadow-xs cursor-pointer flex items-center space-x-1.5"
          >
            <Plus size={14} className="stroke-[3]" />
            <span>Add Branch</span>
          </button>
        </div>

        {saveMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 px-4 py-1.5 flex items-center space-x-2 text-xs font-bold text-emerald-800 animate-in fade-in duration-200">
            <CheckCircle2 size={14} className="text-emerald-600 shrink-0" />
            <span>{saveMessage}</span>
          </div>
        )}

        {normalizeMonth(selectedMonth) === 'Ashwin' && (
          <div className="bg-emerald-50/90 border-b border-emerald-200 px-4 py-1.5 flex items-center justify-between text-[11px] font-bold text-emerald-900 shrink-0">
            <div className="flex items-center space-x-2">
              <span className="inline-block w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              <span>
                असोज (Ashwin) महिना: भदौको अन्तिम मिटर नम्बर (Closing Unit) स्वतः सुरुको नम्बर (Previous Unit) मा समावेश गरिएको छ।
              </span>
            </div>
            <button
              type="button"
              onClick={handleSyncFromPreviousMonth}
              disabled={isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
              className="text-emerald-700 hover:text-emerald-950 underline cursor-pointer text-[10.5px] disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Re-Sync Bhadra
            </button>
          </div>
        )}

        {/* Meter Reading Table */}
        <div className="p-4 overflow-y-auto flex-1">
          <DayEndFieldset branchId={currentBranchId}>
          <div className="border border-slate-200 rounded-xl overflow-hidden shadow-xs">
            <table className="w-full text-left border-collapse text-xs">
              <thead>
                <tr className="bg-slate-100/90 text-slate-700 font-bold border-b border-slate-200 uppercase text-[11px] tracking-wider whitespace-nowrap">
                  <th className="py-2.5 px-2 text-center w-8">S.N.</th>
                  <th className="py-2.5 px-3 w-44">Branch Name</th>
                  <th className="py-2.5 px-2 w-32">सुरुको एकाइ (Previous)</th>
                  <th className="py-2.5 px-2 w-32">अन्तिम एकाइ (Current / Closing)</th>
                  <th className="py-2.5 px-2 text-center w-20">Consumed</th>
                  <th className="py-2.5 px-2 w-16">Rate</th>
                  <th className="py-2.5 px-2.5 text-right w-24">Base Bill</th>
                  <th className="py-2.5 px-1.5 text-center w-14" title="Tick to apply 5% Govt Tax">५% कर?</th>
                  <th className="py-2.5 px-1.5 text-center w-16">Tax %</th>
                  <th className="py-2.5 px-2 text-right w-24">Tax Amount</th>
                  <th className="py-2.5 px-3 text-right w-28">Total Paid</th>
                  <th className="py-2.5 px-2 text-center w-8"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 bg-white">
                {rows.length === 0 ? (
                  <tr>
                    <td colSpan={12} className="text-center py-8 text-slate-400 italic">
                      No electricity rows added yet. Click "+ Add Branch" above to insert a branch reading.
                    </td>
                  </tr>
                ) : (
                  rows.map((row, idx) => {
                    const isInvalidReading = row.currentUnit > 0 && row.currentUnit < row.previousUnit;

                    return (
                      <tr key={row.id} className="hover:bg-slate-50/70 transition-colors">
                        {/* S.N. */}
                        <td className="py-2 px-2 text-center font-mono font-bold text-slate-500">
                          {idx + 1}
                        </td>

                        {/* Branch Selector */}
                        <td className="py-2 px-3">
                          <select
                            value={row.branchId}
                            onChange={(e) => handleRowBranchChange(row.id, e.target.value)}
                            className="w-full h-8 bg-slate-50 border border-slate-300 rounded-md px-2 text-xs font-bold text-slate-900 outline-none focus:bg-white focus:border-blue-500"
                          >
                            {branches.map(b => (
                              <option key={b.id} value={b.id}>
                                {b.name} ({b.code})
                              </option>
                            ))}
                          </select>
                        </td>

                        {/* Previous Unit Input (Editable) */}
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="any"
                            value={row.previousUnit === 0 ? '' : row.previousUnit}
                            onChange={(e) => handleRowPreviousChange(row.id, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                            placeholder="0"
                            className="w-full h-8 bg-slate-50/80 border border-slate-300 rounded-md px-2 text-xs font-mono font-bold text-slate-800 outline-none focus:bg-white focus:border-amber-500"
                          />
                          {row.previousUnit > 0 ? (
                            <div className="text-[10px] text-emerald-700 font-bold flex items-center space-x-1 pt-0.5 whitespace-nowrap">
                              <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0 inline-block"></span>
                              <span>
                                {row.sourceMonth === 'Bhadra' || (!row.sourceMonth && normalizeMonth(selectedMonth) === 'Ashwin')
                                  ? `भदौ अन्तिम: ${row.previousUnit} (स्वतः लोड)`
                                  : `${row.sourceMonth || 'अघिल्लो'} अन्तिम: ${row.previousUnit}`}
                              </span>
                            </div>
                          ) : (
                            (() => {
                              const hist = getPreviousUnitForBranch(row.branchId, selectedFiscalYear, selectedMonth, localExpenses);
                              if (hist.prevUnit > 0) {
                                return (
                                  <button
                                    type="button"
                                    onClick={() => handleRowPreviousChange(row.id, hist.prevUnit)}
                                    className="text-[9.5px] text-blue-700 hover:text-blue-900 font-bold underline flex items-center space-x-1 pt-0.5 cursor-pointer"
                                    title="अघिल्लो महिनाको अन्तिम नम्बर तान्नुहोस्"
                                  >
                                    <span>भदौ अन्तिम {hist.prevUnit} लोड</span>
                                  </button>
                                );
                              }
                              return null;
                            })()
                          )}
                        </td>

                        {/* Current Unit Input */}
                        <td className="py-2 px-2">
                          <input
                            type="number"
                            step="any"
                            value={row.currentUnit || ''}
                            onChange={(e) => handleRowCurrentChange(row.id, e.target.value === '' ? 0 : parseFloat(e.target.value) || 0)}
                            placeholder="e.g. 250 (अन्तिम)"
                            className={`w-full h-8 bg-white border rounded-md px-2 text-xs font-mono font-black outline-none ${
                              isInvalidReading
                                ? 'border-rose-500 text-rose-700 bg-rose-50/50'
                                : 'border-amber-400 text-slate-900 focus:ring-1 focus:ring-amber-500'
                            }`}
                          />
                          {isInvalidReading && (
                            <span className="text-[10px] text-rose-600 font-bold block pt-0.5">
                              Current &lt; Previous
                            </span>
                          )}
                        </td>

                        {/* Consumed Units (Calculated) */}
                        <td className="py-2 px-2 text-center">
                          <span className={`inline-flex items-center px-2 py-0.5 rounded-md text-xs font-mono font-black border ${
                            row.consumedUnits > 50
                              ? 'bg-amber-100 text-amber-950 border-amber-300 ring-1 ring-amber-400'
                              : 'bg-slate-100 text-slate-800 border-slate-200'
                          }`}>
                            {row.consumedUnits} U
                          </span>
                        </td>

                        {/* Rate / Unit Input */}
                        <td className="py-2 px-1.5">
                          <input
                            type="number"
                            step="any"
                            value={row.ratePerUnit || 12}
                            onChange={(e) => handleRowRateChange(row.id, parseFloat(e.target.value) || 0)}
                            placeholder="12"
                            className="w-full h-8 bg-white border border-slate-300 rounded-md px-1.5 text-xs font-mono font-bold text-slate-800 outline-none focus:border-blue-500"
                          />
                        </td>

                        {/* Base Bill (Calculated) */}
                        <td className="py-2 px-2.5 text-right font-mono text-slate-700 font-semibold">
                          Rs. {row.baseAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                        </td>

                        {/* Tick / Checkbox Column */}
                        <td className="py-2 px-1.5 text-center">
                          <label className="inline-flex items-center justify-center cursor-pointer p-1 rounded hover:bg-amber-50">
                            <input
                              type="checkbox"
                              checked={Boolean(row.applyTax)}
                              onChange={(e) => handleRowTaxToggle(row.id, e.target.checked)}
                              className="w-4 h-4 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer accent-amber-600"
                              title={row.applyTax ? "5% कर लागु छ (Tick हटाउन थिच्नुहोस्)" : "५% कर लगाउन Tick गर्नुहोस्"}
                            />
                          </label>
                        </td>

                        {/* 5% Tax Rate Display Column */}
                        <td className="py-2 px-1.5 text-center">
                          {row.applyTax ? (
                            <span className="inline-block px-1.5 py-0.5 rounded text-[11px] font-mono font-bold bg-amber-100 text-amber-900 border border-amber-300">
                              5%
                            </span>
                          ) : (
                            <span className="text-slate-400 font-mono text-[11px]">0%</span>
                          )}
                        </td>

                        {/* Tax Amount Display Column */}
                        <td className="py-2 px-2 text-right">
                          {row.applyTax && row.taxAmount > 0 ? (
                            <span className="font-mono font-bold text-rose-600 text-xs">
                              +Rs. {row.taxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                            </span>
                          ) : (
                            <span className="text-[11px] font-mono text-slate-400">
                              Rs. 0.00
                            </span>
                          )}
                        </td>

                        {/* Total Paid (Calculated: Base Bill + Tax Amount) */}
                        <td className="py-2 px-3 text-right">
                          <div className="font-mono font-black text-emerald-700 text-xs sm:text-sm">
                            Rs. {row.totalPaid.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                          </div>
                        </td>

                        {/* Remove Action */}
                        <td className="py-2 px-2 text-center">
                          <button
                            type="button"
                            onClick={() => handleRemoveRow(row.id)}
                            className="p-1.5 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded-md transition-colors cursor-pointer"
                            title="Remove row"
                          >
                            <Trash2 size={14} />
                          </button>
                        </td>
                      </tr>
                    );
                  })
                )}
              </tbody>
            </table>
          </div>
          </DayEndFieldset>
        </div>

        {/* Modal Footer with Grand Totals, Cancel & Save Button */}
        <div className="bg-slate-50 border-t border-slate-200 px-4 py-3 flex flex-wrap items-center justify-between gap-3 shrink-0">
          
          {/* Aggregated Totals Display */}
          <div className="flex flex-wrap items-center gap-3 sm:gap-4 text-xs">
            <div className="text-slate-600">
              Units:{' '}
              <span className="font-mono font-black text-amber-900 bg-amber-100 px-2 py-0.5 rounded border border-amber-200">
                {totalConsumedUnits.toLocaleString()}
              </span>
            </div>
            <div className="text-slate-600">
              Base:{' '}
              <span className="font-mono font-bold text-slate-800">
                Rs. {totalBaseBill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-slate-600">
              Govt Tax (5%):{' '}
              <span className="font-mono font-black text-rose-600 bg-rose-50 px-2 py-0.5 rounded border border-rose-200">
                +Rs. {totalTaxAmount.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
            <div className="text-slate-600">
              Total Electricity Bill:{' '}
              <span className="font-mono font-black text-emerald-700 text-sm">
                Rs. {totalElectricityBill.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </div>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center space-x-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 rounded-lg text-xs font-bold text-slate-600 hover:bg-slate-200/80 transition-colors cursor-pointer"
            >
              Done / Close
            </button>
            <button
              type="button"
              onClick={handleSaveAll}
              disabled={isSaving || rows.length === 0 || isDayEnded}
              title={isDayEnded ? getDayEndedBlockMessage() : undefined}
              className="px-5 py-2 bg-emerald-600 hover:bg-emerald-700 active:scale-95 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-xs font-black shadow-sm transition-all flex items-center space-x-1.5 cursor-pointer"
            >
              <CheckCircle2 size={15} />
              <span>{isSaving ? 'Saving...' : `Save ${selectedMonth} Bill`}</span>
            </button>
          </div>

        </div>

      </div>
    </div>
  );
};
