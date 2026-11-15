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

const syncCloudStore = async (data: DepreciationStoreData): Promise<void> => {
  writeLocalStore(data);
  if (!supabase) return;
  try {
    await supabase.from('daily_data').upsert({
      key: CLOUD_KEY,
      data,
      updated_at: new Date().toISOString()
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
        const { data, error } = await supabase
          .from('daily_data')
          .select('data')
          .eq('key', CLOUD_KEY)
          .maybeSingle();
        if (!error && data?.data) {
          const remote = data.data as Partial<DepreciationStoreData>;
          const merged: DepreciationStoreData = {
            categories: Array.isArray(remote.categories) && remote.categories.length > 0 ? remote.categories : (local?.categories || [...DEFAULT_CATEGORIES]),
            assets: Array.isArray(remote.assets) ? remote.assets : (local?.assets || []),
            transfers: Array.isArray(remote.transfers) ? remote.transfers : (local?.transfers || []),
            entries: Array.isArray(remote.entries) ? remote.entries : (local?.entries || []),
            vouchers: Array.isArray(remote.vouchers) ? remote.vouchers : (local?.vouchers || []),
            financialYears: Array.isArray(remote.financialYears) && remote.financialYears.length > 0 ? remote.financialYears : (local?.financialYears || [...DEFAULT_FINANCIAL_YEARS]),
            settings: { ...DEFAULT_SETTINGS, ...(local?.settings || {}), ...(remote.settings || {}) }
          };
          writeLocalStore(merged);
          return merged;
        }
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
    await syncCloudStore(store);
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
    await syncCloudStore(store);
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
