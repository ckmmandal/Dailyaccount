import { OfficeExpenseRecord } from '../types';

export const FY_MONTHS = [
  'Shrawan', 'Bhadra', 'Ashwin', 'Kartik', 'Mangsir', 'Poush',
  'Magh', 'Falgun', 'Chaitra', 'Baishakh', 'Jestha', 'Ashadh'
];

export const NEPALI_MONTH_MAP: Record<string, string> = {
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

/**
 * Normalizes Nepali month names into standard English capitalized keys
 */
export const normalizeMonth = (m?: string): string => {
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
 * Compares two fiscal years ignoring slashes/underscores
 */
export const isSameFy = (fy1?: string, fy2?: string): boolean => {
  const c1 = (fy1 || '').replace(/[^0-9]/g, '');
  const c2 = (fy2 || '').replace(/[^0-9]/g, '');
  return Boolean(c1 && c2 && c1 === c2);
};

/**
 * Calculates electricity bill according to Nepal Government tariff regulations:
 * When consumed units > 50 units, a 5% government tax (विद्युत महसुल कर) is charged on the amount.
 */
export const calculateElectricityBill = (
  consumedUnits: number,
  ratePerUnit: number = 12
): {
  consumedUnits: number;
  ratePerUnit: number;
  baseAmount: number; // Consumed * Rate
  taxRate: number; // 5 if consumedUnits > 50 else 0
  taxAmount: number; // 5% of baseAmount if units > 50 else 0
  totalAmount: number; // baseAmount + taxAmount
} => {
  const units = Math.max(0, consumedUnits || 0);
  const rate = ratePerUnit > 0 ? ratePerUnit : 12;
  const baseAmount = parseFloat((units * rate).toFixed(2));
  
  // Nepal Government rule: 5% tax if consumed units > 50
  const taxRate = units > 50 ? 5 : 0;
  const taxAmount = taxRate > 0 ? parseFloat((baseAmount * 0.05).toFixed(2)) : 0;
  const totalAmount = parseFloat((baseAmount + taxAmount).toFixed(2));

  return {
    consumedUnits: units,
    ratePerUnit: rate,
    baseAmount,
    taxRate,
    taxAmount,
    totalAmount
  };
};

export const normalizeFy = (fy?: string): string => {
  if (!fy) return '2083/2084';
  const nums = fy.match(/\d{4}/g);
  if (nums && nums.length >= 2) {
    return `${nums[0]}/${nums[1]}`;
  }
  return fy.replace(/[_]/g, '/');
};

/**
 * Returns clean sanitized fiscal year and month for ID string generation
 */
export const cleanFyString = (fy?: string): string => {
  return (fy || '2083_2084').replace(/[/\\s]/g, '_');
};

export const cleanMonthString = (month?: string): string => {
  return normalizeMonth(month).replace(/[/\\s]/g, '_');
};

/**
 * Deterministic Expense ID generator to guarantee "ek month ma ekpatak matrai hune"
 */
export const normalizeBranchId = (b?: string): string => {
  if (!b) return 'main';
  const s = String(b).toLowerCase().trim();
  if (
    s === 'main' || 
    s === 'c01' || 
    s === 'b01' || 
    s === 'head_office' || 
    s === 'head-office' || 
    s === 'headoffice' || 
    s === 'head office' || 
    s === 'ratauli' || 
    s.includes('head') || 
    s.includes('ratauli')
  ) {
    return 'main';
  }
  if (s === 'sahodba' || s === 'c02' || s === 'b02' || s.includes('sahodba')) return 'sahodba';
  if (s === 'pipra' || s === 'c03' || s === 'b03' || s.includes('pipra')) return 'pipra';
  if (s === 'parsa' || s === 'c04' || s === 'b04' || s.includes('parsa')) return 'parsa';
  return s;
};

export const isBranchMatch = (b1?: string, b2?: string): boolean => {
  if (!b1 || !b2) return true;
  if (b1 === 'all' || b2 === 'all') return true;
  return normalizeBranchId(b1) === normalizeBranchId(b2);
};

export const getDeterministicExpenseId = (
  category: string,
  branchId: string,
  fiscalYear: string,
  month: string
): string => {
  const cleanFy = cleanFyString(fiscalYear);
  const cleanMo = cleanMonthString(month);
  const bId = normalizeBranchId(branchId);

  let prefix = 'EXP_OTH';
  if (category === 'house_rent') prefix = 'EXP_RENT';
  else if (category === 'electricity_bill') prefix = 'EXP_ELEC';
  else if (category === 'cleaner_payment') prefix = 'EXP_CLN';
  else if (category === 'telephone_bill') prefix = 'EXP_TEL';
  else if (category === 'khaja_kharch') prefix = 'EXP_KHJ';

  return `${prefix}_${bId}_${cleanFy}_${cleanMo}`;
};

/**
 * Checks whether an expense record belongs to the same month/branch/category slot
 */
export const isSameExpenseSlot = (
  e: OfficeExpenseRecord,
  branchId: string,
  fiscalYear: string,
  month: string,
  category: string
): boolean => {
  if (!isBranchMatch(e.branchId, branchId)) return false;
  if (e.category !== category) return false;
  if (!isSameFy(e.fiscalYear, fiscalYear)) return false;
  if (normalizeMonth(e.month) !== normalizeMonth(month)) return false;
  return true;
};

/**
 * Strictly deduplicates office expenses so that for any (branchId, fiscalYear, month, category),
 * there is AT MOST ONE single record. If duplicates exist, keeps the latest or deterministic one.
 */
export const deduplicateExpenses = (expenses: OfficeExpenseRecord[]): OfficeExpenseRecord[] => {
  const map = new Map<string, OfficeExpenseRecord>();

  for (const exp of expenses) {
    if (!exp || !exp.category) continue;
    const bId = normalizeBranchId(exp.branchId);
    const normFy = normalizeFy(exp.fiscalYear);
    const normMo = normalizeMonth(exp.month);
    const cat = exp.category;

    const isFixed = ['house_rent', 'electricity_bill', 'cleaner_payment', 'telephone_bill', 'khaja_kharch'].includes(cat);
    const slotKey = isFixed 
      ? `${cat}__${bId}__${normFy}__${normMo}` 
      : (exp.id || `${cat}_${Date.now()}_${Math.random()}`);

    if (!map.has(slotKey)) {
      map.set(slotKey, exp);
    } else {
      const existing = map.get(slotKey)!;
      const existingIsDet = (existing.id || '').startsWith('EXP_');
      const currentIsDet = (exp.id || '').startsWith('EXP_');

      if (!existingIsDet && currentIsDet) {
        map.set(slotKey, exp);
      } else if (existingIsDet && !currentIsDet) {
        // Keep deterministic record
      } else {
        // Both are deterministic or both are non-deterministic: pick newer timestamp
        const expRecord = exp as unknown as Record<string, unknown>;
        const existingRecord = existing as unknown as Record<string, unknown>;
        const expTime = Number(expRecord.updatedAt) || Number(exp.createdAt) || 0;
        const exTime = Number(existingRecord.updatedAt) || Number(existing.createdAt) || 0;
        if (expTime >= exTime) {
          map.set(slotKey, exp);
        }
      }
    }
  }

  return Array.from(map.values());
};
