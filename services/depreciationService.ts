import NepaliDate from 'nepali-date-converter';
import { supabase } from './supabase';
import { storageService } from './storageService';
import { assertDayNotEnded } from '../utils/dayEndLock';

export type DepreciationMethod = 'SLM' | 'WDV';
export type AssetStatus = 'Active' | 'Disposed' | 'Sold' | 'Transferred';
export type DisposalType = 'Sale' | 'Scrap' | 'Write-Off';
export type DepreciationPeriodType = 'Monthly' | 'Yearly';

export interface AssetDocument {
  id: string;
  name: string;
  type: string;
  size: number;
  uploadedAt: string;
  dataUrl: string;
}

export interface AssetCategory {
  id: string;
  code: string;
  name: string;
  defaultMethod: DepreciationMethod;
  rate: number; // Book depreciation annual %
  taxBlock: 'Block A' | 'Block B' | 'Block C' | 'Block D' | 'Block E';
  taxRate: number; // Income Tax WDV block rate %
  usefulLifeYears: number;
  salvagePercent: number;
  glAssetAccount: string;
  glExpenseAccount: string;
  glAccumulatedAccount: string;
  status: 'Active' | 'Inactive';
}

export interface FixedAsset {
  id: string;
  assetCode: string;
  name: string;
  categoryId: string;
  categoryName: string;
  branchId: string;
  branchName: string;
  purchaseDate: string; // AD YYYY-MM-DD
  purchaseDateBs: string; // BS YYYY-MM-DD
  putToUseDate?: string;
  putToUseDateBs?: string;
  purchaseValue: number;
  salvageValue: number;
  usefulLifeYears: number;
  method: DepreciationMethod;
  depreciationRate: number;
  taxBlock: 'Block A' | 'Block B' | 'Block C' | 'Block D' | 'Block E';
  taxRate: number;
  vendorName?: string;
  invoiceNo?: string;
  serialNo?: string;
  location?: string;
  custodian?: string;
  remarks?: string;
  status: AssetStatus;
  accumulatedDepreciation: number;
  netBookValue: number;
  disposalDate?: string;
  disposalDateBs?: string;
  disposalType?: DisposalType;
  saleProceeds?: number;
  disposalGainLoss?: number;
  disposalRemarks?: string;
  documents: AssetDocument[];
  createdBy?: string;
  createdAt: string;
  updatedAt: string;
}

export interface AssetTransfer {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  fromBranchId: string;
  fromBranchName: string;
  toBranchId: string;
  toBranchName: string;
  transferDate: string;
  transferDateBs: string;
  transferredBy: string;
  remarks?: string;
  createdAt: string;
}

export interface DepreciationEntry {
  id: string;
  assetId: string;
  assetCode: string;
  assetName: string;
  categoryId: string;
  categoryName: string;
  branchId: string;
  branchName: string;
  financialYear: string;
  periodType: DepreciationPeriodType;
  periodLabel: string;
  method: DepreciationMethod;
  rate: number;
  openingValue: number;
  depreciationAmount: number;
  taxDepreciationAmount: number;
  accumulatedDepreciation: number;
  closingNetBookValue: number;
  voucherId?: string;
  calculatedAt: string;
  calculatedBy: string;
}

export interface JournalVoucherLine {
  accountCode: string;
  accountName: string;
  type: 'Debit' | 'Credit';
  amount: number;
  description: string;
}

export interface DepreciationJournalVoucher {
  id: string;
  voucherNo: string;
  voucherDate: string;
  voucherDateBs: string;
  financialYear: string;
  branchId: string;
  branchName: string;
  periodLabel: string;
  voucherType: 'Depreciation' | 'Purchase' | 'Disposal';
  debitAccount: string;
  debitAmount: number;
  creditAccount: string;
  creditAmount: number;
  narration: string;
  assetCount: number;
  status: 'Posted' | 'Draft';
  lines: JournalVoucherLine[];
  createdBy: string;
  createdAt: string;
}

export interface DepreciationFinancialYear {
  id: string;
  label: string; // e.g. 2083/84
  startDateBs: string;
  endDateBs: string;
  isCurrent: boolean;
  status: 'Open' | 'Closed';
}

export interface DepreciationSettings {
  defaultMethod: DepreciationMethod;
  defaultUsefulLifeYears: number;
  defaultSalvagePercent: number;
  roundingRule: 'Nearest' | 'Exact' | 'Floor';
  autoPostJournalVoucher: boolean;
  taxComparisonEnabled: boolean;
  defaultGlAssetAccount: string;
  defaultGlExpenseAccount: string;
  defaultGlAccumulatedAccount: string;
  currentFinancialYear: string;
}

export interface DepreciationStoreData {
  categories: AssetCategory[];
  assets: FixedAsset[];
  transfers: AssetTransfer[];
  entries: DepreciationEntry[];
  vouchers: DepreciationJournalVoucher[];
  financialYears: DepreciationFinancialYear[];
  settings: DepreciationSettings;
}

export interface DepreciationScheduleRow {
  yearIndex: number;
  financialYearLabel: string;
  openingBookValue: number;
  slmDepreciation: number;
  wdvDepreciation: number;
  activeDepreciation: number;
  taxDepreciation: number;
  accumulatedDepreciation: number;
  closingBookValue: number;
}

const STORAGE_KEY = 'saccos_db_depreciation_registry_v1';
const CLOUD_KEY = 'depreciation_registry_v1';

const getTodayBs = (): string => {
  try {
    return new NepaliDate(new Date()).format('YYYY-MM-DD');
  } catch {
    return new Date().toISOString().split('T')[0];
  }
};

const getTodayAd = (): string => new Date().toISOString().split('T')[0];

const getCurrentFinancialYearLabel = (): string => {
  try {
    const nep = new NepaliDate(new Date());
    const y = nep.getYear();
    const m = nep.getMonth(); // 0 = Baisakh, 3 = Shrawan
    const startY = m >= 3 ? y : y - 1;
    const endShort = String((startY + 1) % 100).padStart(2, '0');
    return `${startY}/${endShort}`;
  } catch {
    return '2083/84';
  }
};

export const DEFAULT_CATEGORIES: AssetCategory[] = [
  {
    id: 'cat_building',
    code: 'FA-BLD',
    name: 'Buildings & Premises',
    defaultMethod: 'WDV',
    rate: 5,
    taxBlock: 'Block A',
    taxRate: 5,
    usefulLifeYears: 30,
    salvagePercent: 10,
    glAssetAccount: '1501 - Land & Buildings',
    glExpenseAccount: '5201 - Depreciation Expense',
    glAccumulatedAccount: '1591 - Accumulated Depreciation (Buildings)',
    status: 'Active'
  },
  {
    id: 'cat_it',
    code: 'FA-CMP',
    name: 'Computers & IT Equipment',
    defaultMethod: 'WDV',
    rate: 25,
    taxBlock: 'Block B',
    taxRate: 25,
    usefulLifeYears: 5,
    salvagePercent: 5,
    glAssetAccount: '1502 - Computers & Peripherals',
    glExpenseAccount: '5201 - Depreciation Expense',
    glAccumulatedAccount: '1592 - Accumulated Depreciation (IT Equipment)',
    status: 'Active'
  },
  {
    id: 'cat_furniture',
    code: 'FA-FRN',
    name: 'Office Furniture & Fixtures',
    defaultMethod: 'SLM',
    rate: 15,
    taxBlock: 'Block B',
    taxRate: 25,
    usefulLifeYears: 7,
    salvagePercent: 5,
    glAssetAccount: '1503 - Furniture & Fixtures',
    glExpenseAccount: '5201 - Depreciation Expense',
    glAccumulatedAccount: '1593 - Accumulated Depreciation (Furniture)',
    status: 'Active'
  },
  {
    id: 'cat_vehicle',
    code: 'FA-VEH',
    name: 'Vehicles & Transport',
    defaultMethod: 'WDV',
    rate: 20,
    taxBlock: 'Block C',
    taxRate: 20,
    usefulLifeYears: 8,
    salvagePercent: 10,
    glAssetAccount: '1504 - Vehicles & Motorcycles',
    glExpenseAccount: '5201 - Depreciation Expense',
    glAccumulatedAccount: '1594 - Accumulated Depreciation (Vehicles)',
    status: 'Active'
  },
  {
    id: 'cat_machinery',
    code: 'FA-MCH',
    name: 'Machinery & Office Equipment',
    defaultMethod: 'SLM',
    rate: 15,
    taxBlock: 'Block D',
    taxRate: 15,
    usefulLifeYears: 10,
    salvagePercent: 5,
    glAssetAccount: '1505 - Machinery & Vault Equipment',
    glExpenseAccount: '5201 - Depreciation Expense',
    glAccumulatedAccount: '1595 - Accumulated Depreciation (Machinery)',
    status: 'Active'
  }
];

export const DEFAULT_FINANCIAL_YEARS: DepreciationFinancialYear[] = [
  {
    id: 'fy_2082_83',
    label: '2082/83',
    startDateBs: '2082-04-01',
    endDateBs: '2083-03-31',
    isCurrent: false,
    status: 'Closed'
  },
  {
    id: 'fy_2083_84',
    label: '2083/84',
    startDateBs: '2083-04-01',
    endDateBs: '2084-03-31',
    isCurrent: true,
    status: 'Open'
  }
];

export const DEFAULT_SETTINGS: DepreciationSettings = {
  defaultMethod: 'WDV',
  defaultUsefulLifeYears: 5,
  defaultSalvagePercent: 5,
  roundingRule: 'Nearest',
  autoPostJournalVoucher: true,
  taxComparisonEnabled: true,
  defaultGlAssetAccount: '1500 - Fixed Assets Control',
  defaultGlExpenseAccount: '5201 - Depreciation Expense',
  defaultGlAccumulatedAccount: '1590 - Accumulated Depreciation',
  currentFinancialYear: getCurrentFinancialYearLabel()
};

const getEmptyStore = (): DepreciationStoreData => ({
  categories: [...DEFAULT_CATEGORIES],
  assets: [],
  transfers: [],
  entries: [],
  vouchers: [],
  financialYears: [...DEFAULT_FINANCIAL_YEARS],
  settings: { ...DEFAULT_SETTINGS }
});

export const roundByRule = (value: number, rule: DepreciationSettings['roundingRule'] = 'Nearest'): number => {
  if (!Number.isFinite(value)) return 0;
  if (rule === 'Floor') return Math.floor(value);
  if (rule === 'Exact') return Math.round(value * 100) / 100;
  return Math.round(value);
};

export const calculatePeriodDepreciation = (params: {
  asset: FixedAsset;
  methodOverride?: DepreciationMethod;
  periodType: DepreciationPeriodType;
  roundingRule?: DepreciationSettings['roundingRule'];
}): {
  openingValue: number;
  depreciationAmount: number;
  taxDepreciationAmount: number;
  accumulatedDepreciation: number;
  closingNetBookValue: number;
} => {
  const { asset, methodOverride, periodType, roundingRule = 'Nearest' } = params;
  const method = methodOverride || asset.method;
  const openingValue = Math.max(0, Number(asset.netBookValue ?? (asset.purchaseValue - asset.accumulatedDepreciation)));
  const salvageFloor = Math.max(0, Number(asset.salvageValue || 0));
  const depreciableRemaining = Math.max(0, openingValue - salvageFloor);

  if (depreciableRemaining <= 0 || asset.status === 'Disposed' || asset.status === 'Sold') {
    return {
      openingValue,
      depreciationAmount: 0,
      taxDepreciationAmount: 0,
      accumulatedDepreciation: Number(asset.accumulatedDepreciation || 0),
      closingNetBookValue: openingValue
    };
  }

  let annualAmount = 0;
  if (method === 'SLM') {
    const life = Math.max(1, Number(asset.usefulLifeYears || 5));
    const straightBase = Math.max(0, Number(asset.purchaseValue) - salvageFloor);
    annualAmount = straightBase / life;
    if (asset.depreciationRate > 0 && straightBase === 0) {
      annualAmount = Number(asset.purchaseValue) * (asset.depreciationRate / 100);
    }
  } else {
    const rate = Math.max(0, Number(asset.depreciationRate || 15));
    annualAmount = openingValue * (rate / 100);
  }

  const rawPeriodAmount = periodType === 'Monthly' ? annualAmount / 12 : annualAmount;
  const cappedAmount = Math.min(depreciableRemaining, Math.max(0, roundByRule(rawPeriodAmount, roundingRule)));

  const taxAnnual = openingValue * (Math.max(0, Number(asset.taxRate || asset.depreciationRate || 15)) / 100);
  const rawTaxPeriod = periodType === 'Monthly' ? taxAnnual / 12 : taxAnnual;
  const taxDepreciationAmount = Math.min(openingValue, Math.max(0, roundByRule(rawTaxPeriod, roundingRule)));

  const newAccumulated = Number(asset.accumulatedDepreciation || 0) + cappedAmount;
  const closingNetBookValue = Math.max(salvageFloor, openingValue - cappedAmount);

  return {
    openingValue,
    depreciationAmount: cappedAmount,
    taxDepreciationAmount,
    accumulatedDepreciation: newAccumulated,
    closingNetBookValue
  };
};

export const generateAssetSchedule = (asset: FixedAsset): DepreciationScheduleRow[] => {
  const rows: DepreciationScheduleRow[] = [];
  const life = Math.max(1, Math.min(50, Number(asset.usefulLifeYears || 5)));
  const salvage = Math.max(0, Number(asset.salvageValue || 0));
  const purchase = Math.max(0, Number(asset.purchaseValue || 0));
  const slmAnnualBase = Math.max(0, (purchase - salvage) / life);
  const wdvRate = Math.max(0, Number(asset.depreciationRate || 15)) / 100;
  const taxRate = Math.max(0, Number(asset.taxRate || asset.depreciationRate || 15)) / 100;

  let startYear = 2083;
  const match = /^(\d{4})/.exec(asset.purchaseDateBs || '');
  if (match) startYear = Number(match[1]);

  let openingActive = purchase;
  let openingSlm = purchase;
  let openingWdv = purchase;
  let openingTax = purchase;
  let accActive = 0;

  for (let i = 1; i <= life; i++) {
    const fyStart = startYear + i - 1;
    const fyEndShort = String((fyStart + 1) % 100).padStart(2, '0');
    const fyLabel = `${fyStart}/${fyEndShort}`;

    const slmDep = Math.min(Math.max(0, openingSlm - salvage), Math.round(slmAnnualBase));
    openingSlm = Math.max(salvage, openingSlm - slmDep);

    const wdvDep = i === life
      ? Math.max(0, Math.round(openingWdv - salvage))
      : Math.min(Math.max(0, openingWdv - salvage), Math.round(openingWdv * wdvRate));
    openingWdv = Math.max(salvage, openingWdv - wdvDep);

    const taxDep = Math.min(openingTax, Math.round(openingTax * taxRate));
    openingTax = Math.max(0, openingTax - taxDep);

    const activeDep = asset.method === 'SLM'
      ? Math.min(Math.max(0, openingActive - salvage), slmDep)
      : Math.min(Math.max(0, openingActive - salvage), wdvDep);

    accActive += activeDep;
    const closingBook = Math.max(salvage, openingActive - activeDep);

    rows.push({
      yearIndex: i,
      financialYearLabel: fyLabel,
      openingBookValue: openingActive,
      slmDepreciation: slmDep,
      wdvDepreciation: wdvDep,
      activeDepreciation: activeDep,
      taxDepreciation: taxDep,
      accumulatedDepreciation: accActive,
      closingBookValue: closingBook
    });

    openingActive = closingBook;
  }

  return rows;
};

const readLocalStore = (): DepreciationStoreData | null => {
  try {
    if (typeof localStorage === 'undefined') return null;
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<DepreciationStoreData>;
    return {
      categories: Array.isArray(parsed.categories) && parsed.categories.length > 0 ? parsed.categories : [...DEFAULT_CATEGORIES],
      assets: Array.isArray(parsed.assets) ? parsed.assets : [],
      transfers: Array.isArray(parsed.transfers) ? parsed.transfers : [],
      entries: Array.isArray(parsed.entries) ? parsed.entries : [],
      vouchers: Array.isArray(parsed.vouchers) ? parsed.vouchers : [],
      financialYears: Array.isArray(parsed.financialYears) && parsed.financialYears.length > 0 ? parsed.financialYears : [...DEFAULT_FINANCIAL_YEARS],
      settings: { ...DEFAULT_SETTINGS, ...(parsed.settings || {}) }
    };
  } catch {
    return null;
  }
};

const writeLocalStore = (data: DepreciationStoreData): void => {
  try {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    }
  } catch {
    // Ignore storage quota warnings
  }
};

const mapCategoryToRow = (c: AssetCategory) => ({
  id: c.id,
  code: c.code,
  name: c.name,
  default_method: c.defaultMethod,
  rate: Number(c.rate) || 0,
  tax_block: c.taxBlock,
  tax_rate: Number(c.taxRate) || 0,
  useful_life_years: Math.max(1, Math.round(Number(c.usefulLifeYears) || 5)),
  salvage_percent: Number(c.salvagePercent) || 0,
  gl_asset_account: c.glAssetAccount || '',
  gl_expense_account: c.glExpenseAccount || '',
  gl_accumulated_account: c.glAccumulatedAccount || '',
  status: c.status || 'Active',
  updated_at: new Date().toISOString()
});

const mapRowToCategory = (r: Record<string, unknown>): AssetCategory => ({
  id: String(r.id),
  code: String(r.code || ''),
  name: String(r.name || ''),
  defaultMethod: (r.default_method === 'SLM' ? 'SLM' : 'WDV'),
  rate: Number(r.rate) || 0,
  taxBlock: (r.tax_block as AssetCategory['taxBlock']) || 'Block B',
  taxRate: Number(r.tax_rate) || 0,
  usefulLifeYears: Number(r.useful_life_years) || 5,
  salvagePercent: Number(r.salvage_percent) || 0,
  glAssetAccount: String(r.gl_asset_account || ''),
  glExpenseAccount: String(r.gl_expense_account || ''),
  glAccumulatedAccount: String(r.gl_accumulated_account || ''),
  status: (r.status === 'Inactive' ? 'Inactive' : 'Active')
});

const mapAssetToRow = (a: FixedAsset) => ({
  id: a.id,
  asset_code: a.assetCode,
  name: a.name,
  category_id: a.categoryId,
  category_name: a.categoryName || '',
  branch_id: a.branchId || 'main',
  branch_name: a.branchName || '',
  purchase_date: a.purchaseDate || '',
  purchase_date_bs: a.purchaseDateBs || '',
  put_to_use_date: a.putToUseDate || null,
  put_to_use_date_bs: a.putToUseDateBs || null,
  purchase_value: Number(a.purchaseValue) || 0,
  salvage_value: Number(a.salvageValue) || 0,
  useful_life_years: Math.max(1, Math.round(Number(a.usefulLifeYears) || 5)),
  method: a.method || 'WDV',
  depreciation_rate: Number(a.depreciationRate) || 0,
  tax_block: a.taxBlock || 'Block B',
  tax_rate: Number(a.taxRate) || 0,
  vendor_name: a.vendorName || null,
  invoice_no: a.invoiceNo || null,
  serial_no: a.serialNo || null,
  location: a.location || null,
  custodian: a.custodian || null,
  remarks: a.remarks || null,
  status: a.status || 'Active',
  accumulated_depreciation: Number(a.accumulatedDepreciation) || 0,
  net_book_value: Number(a.netBookValue) || 0,
  disposal_date: a.disposalDate || null,
  disposal_date_bs: a.disposalDateBs || null,
  disposal_type: a.disposalType || null,
  sale_proceeds: Number(a.saleProceeds) || 0,
  disposal_gain_loss: Number(a.disposalGainLoss) || 0,
  disposal_remarks: a.disposalRemarks || null,
  documents: Array.isArray(a.documents) ? a.documents : [],
  created_by: a.createdBy || null,
  created_at: a.createdAt || new Date().toISOString(),
  updated_at: a.updatedAt || new Date().toISOString()
});

const mapRowToAsset = (r: Record<string, unknown>): FixedAsset => ({
  id: String(r.id),
  assetCode: String(r.asset_code || ''),
  name: String(r.name || ''),
  categoryId: String(r.category_id || ''),
  categoryName: String(r.category_name || ''),
  branchId: String(r.branch_id || 'main'),
  branchName: String(r.branch_name || ''),
  purchaseDate: String(r.purchase_date || ''),
  purchaseDateBs: String(r.purchase_date_bs || ''),
  putToUseDate: r.put_to_use_date ? String(r.put_to_use_date) : undefined,
  putToUseDateBs: r.put_to_use_date_bs ? String(r.put_to_use_date_bs) : undefined,
  purchaseValue: Number(r.purchase_value) || 0,
  salvageValue: Number(r.salvage_value) || 0,
  usefulLifeYears: Number(r.useful_life_years) || 5,
  method: (r.method === 'SLM' ? 'SLM' : 'WDV'),
  depreciationRate: Number(r.depreciation_rate) || 0,
  taxBlock: (r.tax_block as FixedAsset['taxBlock']) || 'Block B',
  taxRate: Number(r.tax_rate) || 0,
  vendorName: r.vendor_name ? String(r.vendor_name) : undefined,
  invoiceNo: r.invoice_no ? String(r.invoice_no) : undefined,
  serialNo: r.serial_no ? String(r.serial_no) : undefined,
  location: r.location ? String(r.location) : undefined,
  custodian: r.custodian ? String(r.custodian) : undefined,
  remarks: r.remarks ? String(r.remarks) : undefined,
  status: (r.status as AssetStatus) || 'Active',
  accumulatedDepreciation: Number(r.accumulated_depreciation) || 0,
  netBookValue: Number(r.net_book_value) || 0,
  disposalDate: r.disposal_date ? String(r.disposal_date) : undefined,
  disposalDateBs: r.disposal_date_bs ? String(r.disposal_date_bs) : undefined,
  disposalType: r.disposal_type ? (r.disposal_type as DisposalType) : undefined,
  saleProceeds: r.sale_proceeds !== undefined && r.sale_proceeds !== null ? Number(r.sale_proceeds) : undefined,
  disposalGainLoss: r.disposal_gain_loss !== undefined && r.disposal_gain_loss !== null ? Number(r.disposal_gain_loss) : undefined,
  disposalRemarks: r.disposal_remarks ? String(r.disposal_remarks) : undefined,
  documents: Array.isArray(r.documents) ? (r.documents as AssetDocument[]) : [],
  createdBy: r.created_by ? String(r.created_by) : undefined,
  createdAt: String(r.created_at || ''),
  updatedAt: String(r.updated_at || '')
});

const mapTransferToRow = (t: AssetTransfer) => ({
  id: t.id,
  asset_id: t.assetId,
  asset_code: t.assetCode,
  asset_name: t.assetName,
  from_branch_id: t.fromBranchId,
  from_branch_name: t.fromBranchName || '',
  to_branch_id: t.toBranchId,
  to_branch_name: t.toBranchName || '',
  transfer_date: t.transferDate,
  transfer_date_bs: t.transferDateBs,
  transferred_by: t.transferredBy,
  remarks: t.remarks || null,
  created_at: t.createdAt
});

const mapRowToTransfer = (r: Record<string, unknown>): AssetTransfer => ({
  id: String(r.id),
  assetId: String(r.asset_id || ''),
  assetCode: String(r.asset_code || ''),
  assetName: String(r.asset_name || ''),
  fromBranchId: String(r.from_branch_id || ''),
  fromBranchName: String(r.from_branch_name || ''),
  toBranchId: String(r.to_branch_id || ''),
  toBranchName: String(r.to_branch_name || ''),
  transferDate: String(r.transfer_date || ''),
  transferDateBs: String(r.transfer_date_bs || ''),
  transferredBy: String(r.transferred_by || ''),
  remarks: r.remarks ? String(r.remarks) : undefined,
  createdAt: String(r.created_at || '')
});

const mapEntryToRow = (e: DepreciationEntry) => ({
  id: e.id,
  asset_id: e.assetId,
  asset_code: e.assetCode,
  asset_name: e.assetName,
  category_id: e.categoryId,
  category_name: e.categoryName || '',
  branch_id: e.branchId || 'main',
  branch_name: e.branchName || '',
  financial_year: e.financialYear,
  period_type: e.periodType,
  period_label: e.periodLabel,
  method: e.method,
  rate: Number(e.rate) || 0,
  opening_value: Number(e.openingValue) || 0,
  depreciation_amount: Number(e.depreciationAmount) || 0,
  tax_depreciation_amount: Number(e.taxDepreciationAmount) || 0,
  accumulated_depreciation: Number(e.accumulatedDepreciation) || 0,
  closing_net_book_value: Number(e.closingNetBookValue) || 0,
  voucher_id: e.voucherId || null,
  calculated_at: e.calculatedAt,
  calculated_by: e.calculatedBy
});

const mapRowToEntry = (r: Record<string, unknown>): DepreciationEntry => ({
  id: String(r.id),
  assetId: String(r.asset_id || ''),
  assetCode: String(r.asset_code || ''),
  assetName: String(r.asset_name || ''),
  categoryId: String(r.category_id || ''),
  categoryName: String(r.category_name || ''),
  branchId: String(r.branch_id || 'main'),
  branchName: String(r.branch_name || ''),
  financialYear: String(r.financial_year || ''),
  periodType: (r.period_type === 'Monthly' ? 'Monthly' : 'Yearly'),
  periodLabel: String(r.period_label || ''),
  method: (r.method === 'SLM' ? 'SLM' : 'WDV'),
  rate: Number(r.rate) || 0,
  openingValue: Number(r.opening_value) || 0,
  depreciationAmount: Number(r.depreciation_amount) || 0,
  taxDepreciationAmount: Number(r.tax_depreciation_amount) || 0,
  accumulatedDepreciation: Number(r.accumulated_depreciation) || 0,
  closingNetBookValue: Number(r.closing_net_book_value) || 0,
  voucherId: r.voucher_id ? String(r.voucher_id) : undefined,
  calculatedAt: String(r.calculated_at || ''),
  calculatedBy: String(r.calculated_by || '')
});

const mapVoucherToRow = (v: DepreciationJournalVoucher) => ({
  id: v.id,
  voucher_no: v.voucherNo,
  voucher_date: v.voucherDate,
  voucher_date_bs: v.voucherDateBs,
  financial_year: v.financialYear,
  branch_id: v.branchId || 'main',
  branch_name: v.branchName || '',
  period_label: v.periodLabel,
  voucher_type: v.voucherType,
  debit_account: v.debitAccount,
  debit_amount: Number(v.debitAmount) || 0,
  credit_account: v.creditAccount,
  credit_amount: Number(v.creditAmount) || 0,
  narration: v.narration || '',
  asset_count: Math.max(1, Math.round(Number(v.assetCount) || 1)),
  status: v.status || 'Posted',
  lines: Array.isArray(v.lines) ? v.lines : [],
  created_by: v.createdBy || '',
  created_at: v.createdAt || new Date().toISOString()
});

const mapRowToVoucher = (r: Record<string, unknown>): DepreciationJournalVoucher => ({
  id: String(r.id),
  voucherNo: String(r.voucher_no || ''),
  voucherDate: String(r.voucher_date || ''),
  voucherDateBs: String(r.voucher_date_bs || ''),
  financialYear: String(r.financial_year || ''),
  branchId: String(r.branch_id || 'main'),
  branchName: String(r.branch_name || ''),
  periodLabel: String(r.period_label || ''),
  voucherType: (r.voucher_type as DepreciationJournalVoucher['voucherType']) || 'Depreciation',
  debitAccount: String(r.debit_account || ''),
  debitAmount: Number(r.debit_amount) || 0,
  creditAccount: String(r.credit_account || ''),
  creditAmount: Number(r.credit_amount) || 0,
  narration: String(r.narration || ''),
  assetCount: Number(r.asset_count) || 1,
  status: (r.status === 'Draft' ? 'Draft' : 'Posted'),
  lines: Array.isArray(r.lines) ? (r.lines as JournalVoucherLine[]) : [],
  createdBy: String(r.created_by || ''),
  createdAt: String(r.created_at || '')
});

const mapFyToRow = (f: DepreciationFinancialYear) => ({
  id: f.id,
  label: f.label,
  start_date_bs: f.startDateBs,
  end_date_bs: f.endDateBs,
  is_current: Boolean(f.isCurrent),
  status: f.status || 'Open'
});

const mapRowToFy = (r: Record<string, unknown>): DepreciationFinancialYear => ({
  id: String(r.id),
  label: String(r.label || ''),
  startDateBs: String(r.start_date_bs || ''),
  endDateBs: String(r.end_date_bs || ''),
  isCurrent: Boolean(r.is_current),
  status: (r.status === 'Closed' ? 'Closed' : 'Open')
});

const mapSettingsToRow = (s: DepreciationSettings) => ({
  id: 'default',
  default_method: s.defaultMethod,
  default_useful_life_years: Math.max(1, Math.round(Number(s.defaultUsefulLifeYears) || 5)),
  default_salvage_percent: Number(s.defaultSalvagePercent) || 5,
  rounding_rule: s.roundingRule,
  auto_post_journal_voucher: Boolean(s.autoPostJournalVoucher),
  tax_comparison_enabled: Boolean(s.taxComparisonEnabled),
  default_gl_asset_account: s.defaultGlAssetAccount,
  default_gl_expense_account: s.defaultGlExpenseAccount,
  default_gl_accumulated_account: s.defaultGlAccumulatedAccount,
  current_financial_year: s.currentFinancialYear,
  updated_at: new Date().toISOString()
});

const mapRowToSettings = (r: Record<string, unknown>): Partial<DepreciationSettings> => ({
  defaultMethod: (r.default_method === 'SLM' ? 'SLM' : 'WDV'),
  defaultUsefulLifeYears: Number(r.default_useful_life_years) || 5,
  defaultSalvagePercent: Number(r.default_salvage_percent) || 5,
  roundingRule: (r.rounding_rule as DepreciationSettings['roundingRule']) || 'Nearest',
  autoPostJournalVoucher: r.auto_post_journal_voucher !== undefined ? Boolean(r.auto_post_journal_voucher) : true,
  taxComparisonEnabled: r.tax_comparison_enabled !== undefined ? Boolean(r.tax_comparison_enabled) : true,
  defaultGlAssetAccount: String(r.default_gl_asset_account || DEFAULT_SETTINGS.defaultGlAssetAccount),
  defaultGlExpenseAccount: String(r.default_gl_expense_account || DEFAULT_SETTINGS.defaultGlExpenseAccount),
  defaultGlAccumulatedAccount: String(r.default_gl_accumulated_account || DEFAULT_SETTINGS.defaultGlAccumulatedAccount),
  currentFinancialYear: String(r.current_financial_year || DEFAULT_SETTINGS.currentFinancialYear)
});

const syncCloudStore = async (
  data: DepreciationStoreData,
  deletions?: { deletedAssetId?: string; deletedCategoryId?: string }
): Promise<void> => {
  writeLocalStore(data);
  if (!supabase) return;

  try {
    const ops: Array<{ label: string; promise: PromiseLike<{ error: { message: string } | null }> }> = [
      {
        label: 'daily_data',
        promise: supabase.from('daily_data').upsert(
          {
            id: CLOUD_KEY,
            key: CLOUD_KEY,
            data,
            updated_at: new Date().toISOString()
          },
          { onConflict: 'id' }
        )
      }
    ];

    if (data.categories.length > 0) {
      ops.push({ label: 'asset_categories', promise: supabase.from('asset_categories').upsert(data.categories.map(mapCategoryToRow), { onConflict: 'id' }) });
    }
    if (data.assets.length > 0) {
      ops.push({ label: 'fixed_assets', promise: supabase.from('fixed_assets').upsert(data.assets.map(mapAssetToRow), { onConflict: 'id' }) });
    }
    if (data.transfers.length > 0) {
      ops.push({ label: 'asset_transfers', promise: supabase.from('asset_transfers').upsert(data.transfers.map(mapTransferToRow), { onConflict: 'id' }) });
    }
    if (data.entries.length > 0) {
      ops.push({ label: 'depreciation_entries', promise: supabase.from('depreciation_entries').upsert(data.entries.map(mapEntryToRow), { onConflict: 'id' }) });
    }
    if (data.vouchers.length > 0) {
      ops.push({ label: 'depreciation_vouchers', promise: supabase.from('depreciation_vouchers').upsert(data.vouchers.map(mapVoucherToRow), { onConflict: 'id' }) });
    }
    if (data.financialYears.length > 0) {
      ops.push({ label: 'depreciation_financial_years', promise: supabase.from('depreciation_financial_years').upsert(data.financialYears.map(mapFyToRow), { onConflict: 'id' }) });
    }
    ops.push({ label: 'depreciation_settings', promise: supabase.from('depreciation_settings').upsert(mapSettingsToRow(data.settings), { onConflict: 'id' }) });

    if (deletions?.deletedAssetId) {
      ops.push({ label: 'delete_entries', promise: supabase.from('depreciation_entries').delete().eq('asset_id', deletions.deletedAssetId) });
      ops.push({ label: 'delete_transfers', promise: supabase.from('asset_transfers').delete().eq('asset_id', deletions.deletedAssetId) });
      ops.push({ label: 'delete_asset', promise: supabase.from('fixed_assets').delete().eq('id', deletions.deletedAssetId) });
    }
    if (deletions?.deletedCategoryId) {
      ops.push({ label: 'delete_category', promise: supabase.from('asset_categories').delete().eq('id', deletions.deletedCategoryId) });
    }

    const results = await Promise.allSettled(ops.map(o => o.promise));
    results.forEach((res, idx) => {
      if (res.status === 'fulfilled' && res.value?.error) {
        console.warn(`Supabase depreciation sync warning [${ops[idx].label}]:`, res.value.error.message);
      } else if (res.status === 'rejected') {
        console.warn(`Supabase depreciation sync rejected [${ops[idx].label}]:`, res.reason);
      }
    });
  } catch (err) {
    console.warn('Depreciation cloud sync failed (using local persistence):', err);
  }
};

export const depreciationService = {
  getAll: async (): Promise<DepreciationStoreData> => {
    const local = readLocalStore();
    if (supabase) {
      try {
        const [
          catRes,
          assetRes,
          trRes,
          entryRes,
          vouchRes,
          fyRes,
          setRes,
          dailyRes
        ] = await Promise.all([
          supabase.from('asset_categories').select('*'),
          supabase.from('fixed_assets').select('*').order('created_at', { ascending: false }),
          supabase.from('asset_transfers').select('*').order('created_at', { ascending: false }),
          supabase.from('depreciation_entries').select('*').order('calculated_at', { ascending: false }),
          supabase.from('depreciation_vouchers').select('*').order('created_at', { ascending: false }),
          supabase.from('depreciation_financial_years').select('*'),
          supabase.from('depreciation_settings').select('*').eq('id', 'default').maybeSingle(),
          supabase.from('daily_data').select('data').or(`id.eq.${CLOUD_KEY},key.eq.${CLOUD_KEY}`).limit(1).maybeSingle()
        ]);

        const remoteDaily = (!dailyRes.error && dailyRes.data?.data) ? (dailyRes.data.data as Partial<DepreciationStoreData>) : undefined;

        const hasNormCats = !catRes.error && Array.isArray(catRes.data) && catRes.data.length > 0;
        const hasNormAssets = !assetRes.error && Array.isArray(assetRes.data) && assetRes.data.length > 0;
        const hasNormTransfers = !trRes.error && Array.isArray(trRes.data) && trRes.data.length > 0;
        const hasNormEntries = !entryRes.error && Array.isArray(entryRes.data) && entryRes.data.length > 0;
        const hasNormVouchers = !vouchRes.error && Array.isArray(vouchRes.data) && vouchRes.data.length > 0;
        const hasNormFys = !fyRes.error && Array.isArray(fyRes.data) && fyRes.data.length > 0;
        const hasNormSettings = !setRes.error && Boolean(setRes.data);

        const merged: DepreciationStoreData = {
          categories: hasNormCats
            ? (catRes.data as Record<string, unknown>[]).map(mapRowToCategory)
            : (Array.isArray(remoteDaily?.categories) && remoteDaily.categories.length > 0
                ? remoteDaily.categories
                : (local?.categories || [...DEFAULT_CATEGORIES])),
          assets: hasNormAssets
            ? (assetRes.data as Record<string, unknown>[]).map(mapRowToAsset)
            : (Array.isArray(remoteDaily?.assets) ? remoteDaily.assets : (local?.assets || [])),
          transfers: hasNormTransfers
            ? (trRes.data as Record<string, unknown>[]).map(mapRowToTransfer)
            : (Array.isArray(remoteDaily?.transfers) ? remoteDaily.transfers : (local?.transfers || [])),
          entries: hasNormEntries
            ? (entryRes.data as Record<string, unknown>[]).map(mapRowToEntry)
            : (Array.isArray(remoteDaily?.entries) ? remoteDaily.entries : (local?.entries || [])),
          vouchers: hasNormVouchers
            ? (vouchRes.data as Record<string, unknown>[]).map(mapRowToVoucher)
            : (Array.isArray(remoteDaily?.vouchers) ? remoteDaily.vouchers : (local?.vouchers || [])),
          financialYears: hasNormFys
            ? (fyRes.data as Record<string, unknown>[]).map(mapRowToFy)
            : (Array.isArray(remoteDaily?.financialYears) && remoteDaily.financialYears.length > 0
                ? remoteDaily.financialYears
                : (local?.financialYears || [...DEFAULT_FINANCIAL_YEARS])),
          settings: {
            ...DEFAULT_SETTINGS,
            ...(local?.settings || {}),
            ...(remoteDaily?.settings || {}),
            ...(hasNormSettings ? mapRowToSettings(setRes.data as Record<string, unknown>) : {})
          }
        };

        // If local/daily_data had assets that haven't been pushed to normalized tables yet, backfill silently
        if (!hasNormAssets && merged.assets.length > 0) {
          void syncCloudStore(merged);
        }

        writeLocalStore(merged);
        return merged;
      } catch {
        // Fallback to local store
      }
    }
    if (local) return local;
    const initial = getEmptyStore();
    writeLocalStore(initial);
    return initial;
  },

  saveAsset: async (assetInput: Omit<FixedAsset, 'id' | 'createdAt' | 'updatedAt'> & { id?: string }, actorName = 'System'): Promise<DepreciationStoreData> => {
    assertDayNotEnded(assetInput.branchId);
    const store = await depreciationService.getAll();
    const nowIso = new Date().toISOString();
    const existingIdx = assetInput.id ? store.assets.findIndex(a => a.id === assetInput.id) : -1;

    if (existingIdx >= 0) {
      const updated: FixedAsset = {
        ...store.assets[existingIdx],
        ...assetInput,
        id: store.assets[existingIdx].id,
        updatedAt: nowIso
      };
      store.assets[existingIdx] = updated;
      await syncCloudStore(store);
      await storageService.saveLog(actorName, 'ASSET_UPDATED', `Updated fixed asset ${updated.assetCode} (${updated.name})`, updated.branchId);
      return store;
    }

    const newAsset: FixedAsset = {
      ...assetInput,
      id: `fa_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
      accumulatedDepreciation: Number(assetInput.accumulatedDepreciation || 0),
      netBookValue: Number(
        assetInput.netBookValue !== undefined
          ? assetInput.netBookValue
          : Math.max(0, Number(assetInput.purchaseValue) - Number(assetInput.accumulatedDepreciation || 0))
      ),
      documents: assetInput.documents || [],
      createdBy: actorName,
      createdAt: nowIso,
      updatedAt: nowIso
    };
    store.assets.unshift(newAsset);

    if (store.settings.autoPostJournalVoucher && newAsset.purchaseValue > 0) {
      const cat = store.categories.find(c => c.id === newAsset.categoryId);
      const glAsset = cat?.glAssetAccount || store.settings.defaultGlAssetAccount;
      const voucher: DepreciationJournalVoucher = {
        id: `djv_${Date.now()}`,
        voucherNo: `FA-JV-${String(store.vouchers.length + 1).padStart(4, '0')}`,
        voucherDate: newAsset.purchaseDate || getTodayAd(),
        voucherDateBs: newAsset.purchaseDateBs || getTodayBs(),
        financialYear: store.settings.currentFinancialYear,
        branchId: newAsset.branchId,
        branchName: newAsset.branchName,
        periodLabel: `Purchase: ${newAsset.assetCode}`,
        voucherType: 'Purchase',
        debitAccount: glAsset,
        debitAmount: newAsset.purchaseValue,
        creditAccount: '1001 - Cash / Bank Account',
        creditAmount: newAsset.purchaseValue,
        narration: `Capitalization of ${newAsset.name} (${newAsset.assetCode})`,
        assetCount: 1,
        status: 'Posted',
        lines: [
          {
            accountCode: glAsset.split(' - ')[0] || '1500',
            accountName: glAsset,
            type: 'Debit',
            amount: newAsset.purchaseValue,
            description: `Asset capitalization: ${newAsset.name}`
          },
          {
            accountCode: '1001',
            accountName: '1001 - Cash / Bank Account',
            type: 'Credit',
            amount: newAsset.purchaseValue,
            description: `Invoice ${newAsset.invoiceNo || newAsset.assetCode} settlement`
          }
        ],
        createdBy: actorName,
        createdAt: nowIso
      };
      store.vouchers.unshift(voucher);
    }

    await syncCloudStore(store);
    await storageService.saveLog(actorName, 'ASSET_REGISTERED', `Registered fixed asset ${newAsset.assetCode} (${newAsset.name}) - NPR ${newAsset.purchaseValue}`, newAsset.branchId);
    return store;
  },

  deleteAsset: async (assetId: string, actorName = 'System'): Promise<DepreciationStoreData> => {
    const store = await depreciationService.getAll();
    const target = store.assets.find(a => a.id === assetId);
    assertDayNotEnded(target?.branchId);
    store.assets = store.assets.filter(a => a.id !== assetId);
    store.entries = store.entries.filter(e => e.assetId !== assetId);
    store.transfers = store.transfers.filter(t => t.assetId !== assetId);
    await syncCloudStore(store, { deletedAssetId: assetId });
    if (target) {
      await storageService.saveLog(actorName, 'ASSET_DELETED', `Deleted fixed asset ${target.assetCode} (${target.name})`, target.branchId);
    }
    return store;
  },

  transferAsset: async (params: {
    assetId: string;
    toBranchId: string;
    toBranchName: string;
    transferDate: string;
    transferDateBs: string;
    remarks?: string;
    actorName?: string;
  }): Promise<DepreciationStoreData> => {
    const { assetId, toBranchId, toBranchName, transferDate, transferDateBs, remarks, actorName = 'System' } = params;
    const store = await depreciationService.getAll();
    const idx = store.assets.findIndex(a => a.id === assetId);
    if (idx < 0) throw new Error('Asset not found.');
    const asset = store.assets[idx];
    assertDayNotEnded(asset.branchId);

    const transfer: AssetTransfer = {
      id: `tr_${Date.now()}`,
      assetId: asset.id,
      assetCode: asset.assetCode,
      assetName: asset.name,
      fromBranchId: asset.branchId,
      fromBranchName: asset.branchName,
      toBranchId,
      toBranchName,
      transferDate,
      transferDateBs,
      transferredBy: actorName,
      remarks,
      createdAt: new Date().toISOString()
    };

    store.transfers.unshift(transfer);
    store.assets[idx] = {
      ...asset,
      branchId: toBranchId,
      branchName: toBranchName,
      updatedAt: new Date().toISOString()
    };

    await syncCloudStore(store);
    await storageService.saveLog(actorName, 'ASSET_TRANSFERRED', `Transferred ${asset.assetCode} from ${asset.branchName} to ${toBranchName}`, toBranchId);
    return store;
  },

  disposeAsset: async (params: {
    assetId: string;
    disposalType: DisposalType;
    disposalDate: string;
    disposalDateBs: string;
    saleProceeds: number;
    remarks?: string;
    actorName?: string;
  }): Promise<DepreciationStoreData> => {
    const { assetId, disposalType, disposalDate, disposalDateBs, saleProceeds, remarks, actorName = 'System' } = params;
    const store = await depreciationService.getAll();
    const idx = store.assets.findIndex(a => a.id === assetId);
    if (idx < 0) throw new Error('Asset not found.');
    const asset = store.assets[idx];
    assertDayNotEnded(asset.branchId);

    const netBook = Number(asset.netBookValue || 0);
    const proceeds = disposalType === 'Sale' ? Math.max(0, Number(saleProceeds || 0)) : 0;
    const gainLoss = proceeds - netBook;
    const nowIso = new Date().toISOString();

    store.assets[idx] = {
      ...asset,
      status: disposalType === 'Sale' ? 'Sold' : 'Disposed',
      disposalDate,
      disposalDateBs,
      disposalType,
      saleProceeds: proceeds,
      disposalGainLoss: gainLoss,
      disposalRemarks: remarks,
      updatedAt: nowIso
    };

    if (store.settings.autoPostJournalVoucher) {
      const cat = store.categories.find(c => c.id === asset.categoryId);
      const glAsset = cat?.glAssetAccount || store.settings.defaultGlAssetAccount;
      const glAccum = cat?.glAccumulatedAccount || store.settings.defaultGlAccumulatedAccount;

      const lines: JournalVoucherLine[] = [];
      if (proceeds > 0) {
        lines.push({
          accountCode: '1001',
          accountName: '1001 - Cash / Bank Account',
          type: 'Debit',
          amount: proceeds,
          description: `Sale proceeds for ${asset.assetCode}`
        });
      }
      if (asset.accumulatedDepreciation > 0) {
        lines.push({
          accountCode: glAccum.split(' - ')[0] || '1590',
          accountName: glAccum,
          type: 'Debit',
          amount: asset.accumulatedDepreciation,
          description: `Reversal of accumulated depreciation for ${asset.assetCode}`
        });
      }
      if (gainLoss < 0) {
        lines.push({
          accountCode: '5299',
          accountName: '5299 - Loss on Disposal of Assets',
          type: 'Debit',
          amount: Math.abs(gainLoss),
          description: `Loss on ${disposalType.toLowerCase()} of ${asset.name}`
        });
      }
      lines.push({
        accountCode: glAsset.split(' - ')[0] || '1500',
        accountName: glAsset,
        type: 'Credit',
        amount: asset.purchaseValue,
        description: `Derecognition of cost for ${asset.assetCode}`
      });
      if (gainLoss > 0) {
        lines.push({
          accountCode: '4299',
          accountName: '4299 - Gain on Disposal of Assets',
          type: 'Credit',
          amount: gainLoss,
          description: `Gain on sale of ${asset.name}`
        });
      }

      const debitTotal = lines.filter(l => l.type === 'Debit').reduce((s, l) => s + l.amount, 0);
      const creditTotal = lines.filter(l => l.type === 'Credit').reduce((s, l) => s + l.amount, 0);

      const voucher: DepreciationJournalVoucher = {
        id: `djv_${Date.now()}`,
        voucherNo: `DSP-JV-${String(store.vouchers.length + 1).padStart(4, '0')}`,
        voucherDate: disposalDate,
        voucherDateBs: disposalDateBs,
        financialYear: store.settings.currentFinancialYear,
        branchId: asset.branchId,
        branchName: asset.branchName,
        periodLabel: `Disposal: ${asset.assetCode}`,
        voucherType: 'Disposal',
        debitAccount: proceeds > 0 ? '1001 - Cash / Bank & Accum. Dep.' : glAccum,
        debitAmount: debitTotal,
        creditAccount: glAsset,
        creditAmount: creditTotal,
        narration: `${disposalType} of fixed asset ${asset.name} (${asset.assetCode})`,
        assetCount: 1,
        status: 'Posted',
        lines,
        createdBy: actorName,
        createdAt: nowIso
      };
      store.vouchers.unshift(voucher);
    }

    await syncCloudStore(store);
    await storageService.saveLog(actorName, 'ASSET_DISPOSED', `${disposalType} recorded for ${asset.assetCode} (${asset.name})`, asset.branchId);
    return store;
  },

  runDepreciationBatch: async (params: {
    assetIds: string[];
    financialYear: string;
    periodType: DepreciationPeriodType;
    periodLabel: string;
    methodOverride?: DepreciationMethod | 'AssetDefault';
    postVoucher: boolean;
    actorName?: string;
    branchFilterId?: string;
    branchFilterName?: string;
  }): Promise<{ store: DepreciationStoreData; createdCount: number; totalDepreciation: number }> => {
    const {
      assetIds,
      financialYear,
      periodType,
      periodLabel,
      methodOverride = 'AssetDefault',
      postVoucher,
      actorName = 'System',
      branchFilterId = 'all',
      branchFilterName = 'All Branches'
    } = params;

    assertDayNotEnded(branchFilterId !== 'all' ? branchFilterId : undefined);
    const store = await depreciationService.getAll();
    const nowIso = new Date().toISOString();
    const newEntries: DepreciationEntry[] = [];
    let totalDep = 0;

    store.assets = store.assets.map(asset => {
      if (!assetIds.includes(asset.id)) return asset;
      if (asset.status !== 'Active') return asset;

      const calc = calculatePeriodDepreciation({
        asset,
        methodOverride: methodOverride === 'AssetDefault' ? undefined : methodOverride,
        periodType,
        roundingRule: store.settings.roundingRule
      });

      if (calc.depreciationAmount <= 0 && calc.taxDepreciationAmount <= 0) {
        return asset;
      }

      const entry: DepreciationEntry = {
        id: `dep_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
        assetId: asset.id,
        assetCode: asset.assetCode,
        assetName: asset.name,
        categoryId: asset.categoryId,
        categoryName: asset.categoryName,
        branchId: asset.branchId,
        branchName: asset.branchName,
        financialYear,
        periodType,
        periodLabel,
        method: methodOverride === 'AssetDefault' ? asset.method : methodOverride,
        rate: asset.depreciationRate,
        openingValue: calc.openingValue,
        depreciationAmount: calc.depreciationAmount,
        taxDepreciationAmount: calc.taxDepreciationAmount,
        accumulatedDepreciation: calc.accumulatedDepreciation,
        closingNetBookValue: calc.closingNetBookValue,
        calculatedAt: nowIso,
        calculatedBy: actorName
      };

      newEntries.push(entry);
      totalDep += calc.depreciationAmount;

      return {
        ...asset,
        accumulatedDepreciation: calc.accumulatedDepreciation,
        netBookValue: calc.closingNetBookValue,
        updatedAt: nowIso
      };
    });

    if (newEntries.length > 0) {
      if (postVoucher && totalDep > 0) {
        const voucherId = `djv_${Date.now()}`;
        newEntries.forEach(e => {
          e.voucherId = voucherId;
        });

        const voucher: DepreciationJournalVoucher = {
          id: voucherId,
          voucherNo: `DEP-JV-${String(store.vouchers.length + 1).padStart(4, '0')}`,
          voucherDate: getTodayAd(),
          voucherDateBs: getTodayBs(),
          financialYear,
          branchId: branchFilterId,
          branchName: branchFilterName,
          periodLabel: `${periodType} - ${periodLabel}`,
          voucherType: 'Depreciation',
          debitAccount: store.settings.defaultGlExpenseAccount,
          debitAmount: totalDep,
          creditAccount: store.settings.defaultGlAccumulatedAccount,
          creditAmount: totalDep,
          narration: `${periodType} depreciation run for ${periodLabel} (FY ${financialYear}) across ${newEntries.length} asset(s)`,
          assetCount: newEntries.length,
          status: 'Posted',
          lines: [
            {
              accountCode: store.settings.defaultGlExpenseAccount.split(' - ')[0] || '5201',
              accountName: store.settings.defaultGlExpenseAccount,
              type: 'Debit',
              amount: totalDep,
              description: `Depreciation expense (${periodLabel}, FY ${financialYear})`
            },
            {
              accountCode: store.settings.defaultGlAccumulatedAccount.split(' - ')[0] || '1590',
              accountName: store.settings.defaultGlAccumulatedAccount,
              type: 'Credit',
              amount: totalDep,
              description: `Accumulated depreciation provision (${periodLabel}, FY ${financialYear})`
            }
          ],
          createdBy: actorName,
          createdAt: nowIso
        };
        store.vouchers.unshift(voucher);
      }

      store.entries = [...newEntries, ...store.entries];
      await syncCloudStore(store);
      await storageService.saveLog(
        actorName,
        'DEPRECIATION_POSTED',
        `Calculated ${periodType} depreciation (${periodLabel}, FY ${financialYear}) for ${newEntries.length} asset(s) totaling NPR ${totalDep}`,
        branchFilterId !== 'all' ? branchFilterId : 'main'
      );
    }

    return {
      store,
      createdCount: newEntries.length,
      totalDepreciation: totalDep
    };
  },

  postManualVoucherForEntry: async (entryId: string, actorName = 'System'): Promise<DepreciationStoreData> => {
    const store = await depreciationService.getAll();
    const entry = store.entries.find(e => e.id === entryId);
    if (!entry) throw new Error('Depreciation entry not found.');
    assertDayNotEnded(entry.branchId);
    if (entry.voucherId) return store;

    const nowIso = new Date().toISOString();
    const voucherId = `djv_${Date.now()}`;
    const cat = store.categories.find(c => c.id === entry.categoryId);
    const glExp = cat?.glExpenseAccount || store.settings.defaultGlExpenseAccount;
    const glAcc = cat?.glAccumulatedAccount || store.settings.defaultGlAccumulatedAccount;

    const voucher: DepreciationJournalVoucher = {
      id: voucherId,
      voucherNo: `DEP-JV-${String(store.vouchers.length + 1).padStart(4, '0')}`,
      voucherDate: getTodayAd(),
      voucherDateBs: getTodayBs(),
      financialYear: entry.financialYear,
      branchId: entry.branchId,
      branchName: entry.branchName,
      periodLabel: `${entry.periodType} - ${entry.periodLabel}`,
      voucherType: 'Depreciation',
      debitAccount: glExp,
      debitAmount: entry.depreciationAmount,
      creditAccount: glAcc,
      creditAmount: entry.depreciationAmount,
      narration: `Depreciation voucher for ${entry.assetName} (${entry.assetCode}) - ${entry.periodLabel}`,
      assetCount: 1,
      status: 'Posted',
      lines: [
        {
          accountCode: glExp.split(' - ')[0] || '5201',
          accountName: glExp,
          type: 'Debit',
          amount: entry.depreciationAmount,
          description: `Depreciation expense: ${entry.assetCode}`
        },
        {
          accountCode: glAcc.split(' - ')[0] || '1590',
          accountName: glAcc,
          type: 'Credit',
          amount: entry.depreciationAmount,
          description: `Accumulated depreciation: ${entry.assetCode}`
        }
      ],
      createdBy: actorName,
      createdAt: nowIso
    };

    entry.voucherId = voucherId;
    store.vouchers.unshift(voucher);
    await syncCloudStore(store);
    await storageService.saveLog(actorName, 'DEPRECIATION_VOUCHER_POSTED', `Posted voucher ${voucher.voucherNo} for ${entry.assetCode}`, entry.branchId);
    return store;
  },

  saveCategory: async (catInput: Omit<AssetCategory, 'id'> & { id?: string }, actorName = 'System'): Promise<DepreciationStoreData> => {
    assertDayNotEnded();
    const store = await depreciationService.getAll();
    const idx = catInput.id ? store.categories.findIndex(c => c.id === catInput.id) : -1;
    if (idx >= 0) {
      store.categories[idx] = { ...store.categories[idx], ...catInput, id: store.categories[idx].id };
    } else {
      store.categories.push({
        ...catInput,
        id: `cat_${Date.now()}`
      });
    }
    await syncCloudStore(store);
    await storageService.saveLog(actorName, 'ASSET_CATEGORY_SAVED', `Saved asset category ${catInput.name} (${catInput.rate}%)`);
    return store;
  },

  deleteCategory: async (categoryId: string, actorName = 'System'): Promise<DepreciationStoreData> => {
    assertDayNotEnded();
    const store = await depreciationService.getAll();
    const inUse = store.assets.some(a => a.categoryId === categoryId);
    if (inUse) {
      throw new Error('Cannot delete a category that has registered fixed assets.');
    }
    store.categories = store.categories.filter(c => c.id !== categoryId);
    await syncCloudStore(store, { deletedCategoryId: categoryId });
    await storageService.saveLog(actorName, 'ASSET_CATEGORY_DELETED', `Deleted asset category ${categoryId}`);
    return store;
  },

  saveFinancialYear: async (fyInput: Omit<DepreciationFinancialYear, 'id'> & { id?: string }, actorName = 'System'): Promise<DepreciationStoreData> => {
    assertDayNotEnded();
    const store = await depreciationService.getAll();
    if (fyInput.isCurrent) {
      store.financialYears = store.financialYears.map(f => ({ ...f, isCurrent: false }));
      store.settings.currentFinancialYear = fyInput.label;
    }
    const idx = fyInput.id ? store.financialYears.findIndex(f => f.id === fyInput.id) : -1;
    if (idx >= 0) {
      store.financialYears[idx] = { ...store.financialYears[idx], ...fyInput, id: store.financialYears[idx].id };
    } else {
      store.financialYears.unshift({
        ...fyInput,
        id: `fy_${Date.now()}`
      });
    }
    await syncCloudStore(store);
    await storageService.saveLog(actorName, 'DEPRECIATION_FY_SAVED', `Saved financial year ${fyInput.label}`);
    return store;
  },

  saveSettings: async (settings: DepreciationSettings, actorName = 'System'): Promise<DepreciationStoreData> => {
    assertDayNotEnded();
    const store = await depreciationService.getAll();
    store.settings = { ...store.settings, ...settings };
    await syncCloudStore(store);
    await storageService.saveLog(actorName, 'DEPRECIATION_SETTINGS_SAVED', 'Updated depreciation module settings');
    return store;
  }
};
