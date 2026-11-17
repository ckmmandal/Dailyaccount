import { SavingProduct, LoanProduct } from '../types';
import { supabase } from './supabase';

const SAVING_STORAGE_KEY = 'saccos_db_saving_products';
const LOAN_STORAGE_KEY = 'saccos_db_loan_products';

const DEFAULT_SAVING_PRODUCTS: SavingProduct[] = [
  {
    id: 'sp-1',
    name: 'General Saving',
    nameNp: 'साधारण बचत',
    interestRate: 6.0,
    capitalization: 'Quarterly',
    minimumBalance: 500,
    description: 'Standard general savings product with quarterly interest capitalization for all members.',
    status: 'Active',
    showInMicrofinance: true,
    showInFD: true,
    showInMicrofinanceAndFD: true,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30
  },
  {
    id: 'sp-2',
    name: 'Regular Saving',
    nameNp: 'नियमित बचत',
    interestRate: 5.0,
    capitalization: 'Quarterly',
    minimumBalance: 1000,
    description: 'Regular voluntary savings account designed for steady capital accumulation.',
    status: 'Active',
    showInMicrofinance: true,
    showInFD: true,
    showInMicrofinanceAndFD: true,
    createdAt: Date.now() - 86400000 * 25,
    updatedAt: Date.now() - 86400000 * 25
  },
  {
    id: 'sp-3',
    name: 'Daily Saving',
    nameNp: 'दैनिक बचत',
    interestRate: 5.5,
    capitalization: 'Monthly',
    minimumBalance: 100,
    description: 'Door-to-door daily collection savings with monthly interest payout.',
    status: 'Active',
    showInMicrofinance: false,
    showInFD: false,
    showInMicrofinanceAndFD: false,
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now() - 86400000 * 20
  },
  {
    id: 'sp-4',
    name: 'Child Welfare Saving',
    nameNp: 'बाल कल्याण बचत',
    interestRate: 7.0,
    capitalization: 'Quarterly',
    minimumBalance: 500,
    description: 'High-yield savings scheme specifically for children’s education and future.',
    status: 'Active',
    showInMicrofinance: false,
    showInFD: false,
    showInMicrofinanceAndFD: false,
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now() - 86400000 * 15
  },
  {
    id: 'sp-5',
    name: 'Senior Citizen Saving',
    nameNp: 'जेष्ठ नागरिक बचत',
    interestRate: 7.5,
    capitalization: 'Monthly',
    minimumBalance: 500,
    description: 'Priority welfare savings account for senior members with monthly interest.',
    status: 'Active',
    showInMicrofinance: false,
    showInFD: false,
    showInMicrofinanceAndFD: false,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 10
  }
];

const DEFAULT_LOAN_PRODUCTS: LoanProduct[] = [
  {
    id: 'lp-1',
    name: 'General Loan',
    nameNp: 'साधारण ऋण',
    interestRate: 13.0,
    installment: 'Monthly',
    maxTenureMonths: 36,
    description: 'Standard collateralized personal and household general credit facility.',
    status: 'Active',
    showInMicrofinance: true,
    showInMicrofinanceAndFD: true,
    createdAt: Date.now() - 86400000 * 30,
    updatedAt: Date.now() - 86400000 * 30
  },
  {
    id: 'lp-2',
    name: 'Agricultural Loan',
    nameNp: 'कृषि ऋण',
    interestRate: 13.0,
    installment: 'Monthly',
    maxTenureMonths: 24,
    description: 'Specialized agro-financing for crops, seeds, irrigation, fertilizer and livestock farming.',
    status: 'Active',
    showInMicrofinance: false,
    showInMicrofinanceAndFD: false,
    createdAt: Date.now() - 86400000 * 25,
    updatedAt: Date.now() - 86400000 * 25
  },
  {
    id: 'lp-3',
    name: 'Business & Commercial Loan',
    nameNp: 'व्यापार तथा व्यावसायिक ऋण',
    interestRate: 14.0,
    installment: 'Monthly',
    maxTenureMonths: 60,
    description: 'Term credit and working capital financing for retail, wholesale, and enterprises.',
    status: 'Active',
    showInMicrofinance: false,
    showInMicrofinanceAndFD: false,
    createdAt: Date.now() - 86400000 * 20,
    updatedAt: Date.now() - 86400000 * 20
  },
  {
    id: 'lp-4',
    name: 'Micro-Finance / Group Loan',
    nameNp: 'लघुवित्त / समूह ऋण',
    interestRate: 15.0,
    installment: 'Monthly',
    maxTenureMonths: 12,
    description: 'Group-guaranteed collateral-free loans for grassroots micro-finance entrepreneurs.',
    status: 'Active',
    showInMicrofinance: false,
    showInMicrofinanceAndFD: false,
    createdAt: Date.now() - 86400000 * 15,
    updatedAt: Date.now() - 86400000 * 15
  },
  {
    id: 'lp-5',
    name: 'Emergency Loan',
    nameNp: 'आकस्मिक ऋण',
    interestRate: 12.0,
    installment: 'Monthly',
    maxTenureMonths: 6,
    description: 'Immediate soft loan designed to cover medical, hospital and unforeseen emergencies.',
    status: 'Active',
    showInMicrofinance: false,
    showInMicrofinanceAndFD: false,
    createdAt: Date.now() - 86400000 * 10,
    updatedAt: Date.now() - 86400000 * 10
  }
];

function getLocal<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) && parsed.length > 0 ? (parsed as unknown as T) : fallback;
  } catch {
    return fallback;
  }
}

function setLocal<T>(key: string, val: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(val));
  } catch (e) {
    console.warn(`Local storage save error for ${key}:`, e);
  }
}

function toMillis(val?: number | string): number {
  if (typeof val === 'number' && !Number.isNaN(val)) return val;
  if (typeof val === 'string' && val.trim()) {
    const parsed = Date.parse(val);
    return Number.isNaN(parsed) ? 0 : parsed;
  }
  return 0;
}

function normalizeSavingProduct(p: SavingProduct): SavingProduct {
  const showInMicrofinance = Boolean(p.showInMicrofinance ?? p.showInMicrofinanceAndFD);
  const showInFD = Boolean(p.showInFD ?? p.showInMicrofinanceAndFD);
  return {
    ...p,
    showInMicrofinance,
    showInFD,
    showInMicrofinanceAndFD: showInMicrofinance || showInFD
  };
}

function normalizeLoanProduct(p: LoanProduct): LoanProduct {
  const showInMicrofinance = Boolean(p.showInMicrofinance ?? p.showInMicrofinanceAndFD);
  return {
    ...p,
    showInMicrofinance,
    showInMicrofinanceAndFD: showInMicrofinance
  };
}

interface SupabaseSavingRecord {
  id: string;
  name: string;
  name_np?: string;
  nameNp?: string;
  interest_rate?: number;
  interestRate?: number;
  capitalization?: SavingProduct['capitalization'];
  minimum_balance?: number;
  minimumBalance?: number;
  description?: string;
  status?: 'Active' | 'Inactive';
  show_in_mf?: boolean | null;
  show_in_fd?: boolean | null;
  show_in_mf_fd?: boolean | null;
  showInMicrofinance?: boolean;
  showInFD?: boolean;
  showInMicrofinanceAndFD?: boolean;
  created_at?: string;
  createdAt?: number;
  updated_at?: string;
  updatedAt?: number;
  created_by?: string;
  createdBy?: string;
}

interface SupabaseLoanRecord {
  id: string;
  name: string;
  name_np?: string;
  nameNp?: string;
  interest_rate?: number;
  interestRate?: number;
  installment?: LoanProduct['installment'];
  max_tenure_months?: number;
  maxTenureMonths?: number;
  description?: string;
  status?: 'Active' | 'Inactive';
  show_in_mf?: boolean | null;
  show_in_mf_fd?: boolean | null;
  showInMicrofinance?: boolean;
  showInMicrofinanceAndFD?: boolean;
  created_at?: string;
  createdAt?: number;
  updated_at?: string;
  updatedAt?: number;
  created_by?: string;
  createdBy?: string;
}

// Serialized in-memory queues and caches to prevent rapid-toggle race conditions
let cachedSavingProducts: SavingProduct[] | null = null;
let cachedLoanProducts: LoanProduct[] | null = null;
let savingMutationQueue: Promise<unknown> = Promise.resolve();
let loanMutationQueue: Promise<unknown> = Promise.resolve();
let savingMutationInFlight = 0;
let loanMutationInFlight = 0;

function enqueueSavingMutation<T>(fn: () => Promise<T>): Promise<T> {
  savingMutationInFlight += 1;
  const run = savingMutationQueue.then(fn, fn);
  savingMutationQueue = run.then(
    () => { savingMutationInFlight = Math.max(0, savingMutationInFlight - 1); },
    () => { savingMutationInFlight = Math.max(0, savingMutationInFlight - 1); }
  );
  return run;
}

function enqueueLoanMutation<T>(fn: () => Promise<T>): Promise<T> {
  loanMutationInFlight += 1;
  const run = loanMutationQueue.then(fn, fn);
  loanMutationQueue = run.then(
    () => { loanMutationInFlight = Math.max(0, loanMutationInFlight - 1); },
    () => { loanMutationInFlight = Math.max(0, loanMutationInFlight - 1); }
  );
  return run;
}

async function fetchSavingProductsInternal(): Promise<SavingProduct[]> {
  // Load settings backup container too so Nepali names/MF/FD flags always merge cleanly
  const settingsMap = new Map<string, Partial<SavingProduct>>();
  let settingsArray: SavingProduct[] = [];
  try {
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'saccos_saving_products')
      .maybeSingle();
    if (Array.isArray(settingsRow?.data)) {
      settingsArray = (settingsRow.data as SavingProduct[]).map(normalizeSavingProduct);
      settingsArray.forEach(sp => {
        if (sp?.id) settingsMap.set(sp.id, sp);
      });
    }
  } catch {
    // ignore
  }

  const localSaved = getLocal<SavingProduct[]>(SAVING_STORAGE_KEY, []).map(normalizeSavingProduct);
  const localMap = new Map<string, Partial<SavingProduct>>();
  localSaved.forEach(lp => {
    if (lp?.id) localMap.set(lp.id, lp);
  });

  // 1. Try dedicated table first
  try {
    const { data, error } = await supabase
      .from('saving_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped: SavingProduct[] = (data as SupabaseSavingRecord[]).map(item => {
        const settingsMeta = settingsMap.get(item.id);
        const localMeta = localMap.get(item.id);
        const itemUpdatedMs = toMillis(item.updated_at ?? item.updatedAt);
        const settingsUpdatedMs = toMillis(settingsMeta?.updatedAt);
        const localUpdatedMs = toMillis(localMeta?.updatedAt);

        const bestMeta = settingsUpdatedMs >= localUpdatedMs ? (settingsMeta || localMeta || {}) : (localMeta || settingsMeta || {});
        const metaIsStrictlyNewer = Math.max(settingsUpdatedMs, localUpdatedMs) > itemUpdatedMs + 1000;

        const hasDedicatedMf = item.show_in_mf !== undefined && item.show_in_mf !== null;
        const hasDedicatedFd = item.show_in_fd !== undefined && item.show_in_fd !== null;

        const showInMicrofinance = hasDedicatedMf && !metaIsStrictlyNewer
          ? Boolean(item.show_in_mf)
          : Boolean(
              item.showInMicrofinance ??
              bestMeta.showInMicrofinance ??
              (hasDedicatedMf ? item.show_in_mf : undefined) ??
              item.show_in_mf_fd ??
              bestMeta.showInMicrofinanceAndFD
            );

        const showInFD = hasDedicatedFd && !metaIsStrictlyNewer
          ? Boolean(item.show_in_fd)
          : Boolean(
              item.showInFD ??
              bestMeta.showInFD ??
              (hasDedicatedFd ? item.show_in_fd : undefined) ??
              item.show_in_mf_fd ??
              bestMeta.showInMicrofinanceAndFD
            );

        return normalizeSavingProduct({
          id: item.id,
          name: item.name,
          nameNp: item.name_np || item.nameNp || bestMeta.nameNp || '',
          interestRate: Number(item.interest_rate ?? item.interestRate ?? 0),
          capitalization: item.capitalization || 'Quarterly',
          minimumBalance: item.minimum_balance !== undefined ? Number(item.minimum_balance) : item.minimumBalance,
          description: item.description || '',
          status: item.status || 'Active',
          showInMicrofinance,
          showInFD,
          showInMicrofinanceAndFD: showInMicrofinance || showInFD,
          createdAt: item.created_at || item.createdAt || Date.now(),
          updatedAt: item.updated_at || item.updatedAt || Date.now(),
          createdBy: item.created_by || item.createdBy
        });
      });
      cachedSavingProducts = mapped;
      setLocal(SAVING_STORAGE_KEY, mapped);
      return mapped;
    }
  } catch (e) {
    console.debug('Direct saving_products table not available, falling back:', e);
  }

  // 2. Try settings table container
  if (settingsArray.length > 0) {
    cachedSavingProducts = settingsArray;
    setLocal(SAVING_STORAGE_KEY, settingsArray);
    return settingsArray;
  }

  // 3. Fallback to localStorage or seed defaults
  if (localSaved && localSaved.length > 0) {
    cachedSavingProducts = localSaved;
    return localSaved;
  }

  // Seed defaults
  const seeded = DEFAULT_SAVING_PRODUCTS.map(normalizeSavingProduct);
  cachedSavingProducts = seeded;
  setLocal(SAVING_STORAGE_KEY, seeded);
  supabase
    .from('settings')
    .upsert({
      id: 'saccos_saving_products',
      data: seeded,
      updated_at: new Date().toISOString()
    })
    .then(() => {}, () => {});

  return seeded;
}

async function fetchLoanProductsInternal(): Promise<LoanProduct[]> {
  const settingsMap = new Map<string, Partial<LoanProduct>>();
  let settingsArray: LoanProduct[] = [];
  try {
    const { data: settingsRow } = await supabase
      .from('settings')
      .select('data')
      .eq('id', 'saccos_loan_products')
      .maybeSingle();
    if (Array.isArray(settingsRow?.data)) {
      settingsArray = (settingsRow.data as LoanProduct[]).map(normalizeLoanProduct);
      settingsArray.forEach(lp => {
        if (lp?.id) settingsMap.set(lp.id, lp);
      });
    }
  } catch {
    // ignore
  }

  const localSaved = getLocal<LoanProduct[]>(LOAN_STORAGE_KEY, []).map(normalizeLoanProduct);
  const localMap = new Map<string, Partial<LoanProduct>>();
  localSaved.forEach(lp => {
    if (lp?.id) localMap.set(lp.id, lp);
  });

  // 1. Try dedicated table first
  try {
    const { data, error } = await supabase
      .from('loan_products')
      .select('*')
      .order('created_at', { ascending: false });

    if (!error && Array.isArray(data) && data.length > 0) {
      const mapped: LoanProduct[] = (data as SupabaseLoanRecord[]).map(item => {
        const settingsMeta = settingsMap.get(item.id);
        const localMeta = localMap.get(item.id);
        const itemUpdatedMs = toMillis(item.updated_at ?? item.updatedAt);
        const settingsUpdatedMs = toMillis(settingsMeta?.updatedAt);
        const localUpdatedMs = toMillis(localMeta?.updatedAt);

        const bestMeta = settingsUpdatedMs >= localUpdatedMs ? (settingsMeta || localMeta || {}) : (localMeta || settingsMeta || {});
        const metaIsStrictlyNewer = Math.max(settingsUpdatedMs, localUpdatedMs) > itemUpdatedMs + 1000;
        const hasDedicatedMf = item.show_in_mf !== undefined && item.show_in_mf !== null;

        const showInMicrofinance = hasDedicatedMf && !metaIsStrictlyNewer
          ? Boolean(item.show_in_mf)
          : Boolean(
              item.showInMicrofinance ??
              bestMeta.showInMicrofinance ??
              (hasDedicatedMf ? item.show_in_mf : undefined) ??
              item.show_in_mf_fd ??
              bestMeta.showInMicrofinanceAndFD
            );

        return normalizeLoanProduct({
          id: item.id,
          name: item.name,
          nameNp: item.name_np || item.nameNp || bestMeta.nameNp || '',
          interestRate: Number(item.interest_rate ?? item.interestRate ?? 0),
          installment: item.installment || 'Monthly',
          maxTenureMonths: item.max_tenure_months !== undefined ? Number(item.max_tenure_months) : item.maxTenureMonths,
          description: item.description || '',
          status: item.status || 'Active',
          showInMicrofinance,
          showInMicrofinanceAndFD: showInMicrofinance,
          createdAt: item.created_at || item.createdAt || Date.now(),
          updatedAt: item.updated_at || item.updatedAt || Date.now(),
          createdBy: item.created_by || item.createdBy
        });
      });
      cachedLoanProducts = mapped;
      setLocal(LOAN_STORAGE_KEY, mapped);
      return mapped;
    }
  } catch (e) {
    console.debug('Direct loan_products table not available, falling back:', e);
  }

  // 2. Try settings table container
  if (settingsArray.length > 0) {
    cachedLoanProducts = settingsArray;
    setLocal(LOAN_STORAGE_KEY, settingsArray);
    return settingsArray;
  }

  // 3. Fallback to localStorage or seed defaults
  if (localSaved && localSaved.length > 0) {
    cachedLoanProducts = localSaved;
    return localSaved;
  }

  // Seed defaults
  const seeded = DEFAULT_LOAN_PRODUCTS.map(normalizeLoanProduct);
  cachedLoanProducts = seeded;
  setLocal(LOAN_STORAGE_KEY, seeded);
  supabase
    .from('settings')
    .upsert({
      id: 'saccos_loan_products',
      data: seeded,
      updated_at: new Date().toISOString()
    })
    .then(() => {}, () => {});

  return seeded;
}

async function upsertSavingProductRow(payload: SavingProduct, nowIso: string): Promise<void> {
  const showMf = Boolean(payload.showInMicrofinance);
  const showFd = Boolean(payload.showInFD);
  const combinedMfFd = showMf || showFd;
  const createdAtIso = typeof payload.createdAt === 'number' ? new Date(payload.createdAt).toISOString() : payload.createdAt;

  // Attempt 1: Full modern schema with separate show_in_mf & show_in_fd columns + legacy show_in_mf_fd + name_np
  const { error: err1 } = await supabase.from('saving_products').upsert({
    id: payload.id,
    name: payload.name,
    name_np: payload.nameNp || '',
    interest_rate: payload.interestRate,
    capitalization: payload.capitalization,
    minimum_balance: payload.minimumBalance ?? 0,
    description: payload.description || '',
    status: payload.status,
    show_in_mf: showMf,
    show_in_fd: showFd,
    show_in_mf_fd: combinedMfFd,
    created_at: createdAtIso,
    updated_at: nowIso,
    created_by: payload.createdBy || ''
  });
  if (!err1) return;

  // Attempt 2: Pre-migration schema with show_in_mf_fd + name_np (before show_in_mf / show_in_fd SQL is run)
  const { error: err2 } = await supabase.from('saving_products').upsert({
    id: payload.id,
    name: payload.name,
    name_np: payload.nameNp || '',
    interest_rate: payload.interestRate,
    capitalization: payload.capitalization,
    minimum_balance: payload.minimumBalance ?? 0,
    description: payload.description || '',
    status: payload.status,
    show_in_mf_fd: combinedMfFd,
    created_at: createdAtIso,
    updated_at: nowIso,
    created_by: payload.createdBy || ''
  });
  if (!err2) return;

  // Attempt 3: Minimal legacy schema without name_np or show_in_mf_fd
  await supabase.from('saving_products').upsert({
    id: payload.id,
    name: payload.name,
    interest_rate: payload.interestRate,
    capitalization: payload.capitalization,
    minimum_balance: payload.minimumBalance ?? 0,
    description: payload.description || '',
    status: payload.status,
    created_at: createdAtIso,
    updated_at: nowIso,
    created_by: payload.createdBy || ''
  });
}

async function upsertLoanProductRow(payload: LoanProduct, nowIso: string): Promise<void> {
  const showMf = Boolean(payload.showInMicrofinance ?? payload.showInMicrofinanceAndFD);
  const createdAtIso = typeof payload.createdAt === 'number' ? new Date(payload.createdAt).toISOString() : payload.createdAt;

  // Attempt 1: Full modern schema with show_in_mf + show_in_mf_fd + name_np
  const { error: err1 } = await supabase.from('loan_products').upsert({
    id: payload.id,
    name: payload.name,
    name_np: payload.nameNp || '',
    interest_rate: payload.interestRate,
    installment: payload.installment,
    max_tenure_months: payload.maxTenureMonths ?? 36,
    description: payload.description || '',
    status: payload.status,
    show_in_mf: showMf,
    show_in_mf_fd: showMf,
    created_at: createdAtIso,
    updated_at: nowIso,
    created_by: payload.createdBy || ''
  });
  if (!err1) return;

  // Attempt 2: Pre-migration schema with show_in_mf_fd + name_np
  const { error: err2 } = await supabase.from('loan_products').upsert({
    id: payload.id,
    name: payload.name,
    name_np: payload.nameNp || '',
    interest_rate: payload.interestRate,
    installment: payload.installment,
    max_tenure_months: payload.maxTenureMonths ?? 36,
    description: payload.description || '',
    status: payload.status,
    show_in_mf_fd: showMf,
    created_at: createdAtIso,
    updated_at: nowIso,
    created_by: payload.createdBy || ''
  });
  if (!err2) return;

  // Attempt 3: Minimal legacy schema
  await supabase.from('loan_products').upsert({
    id: payload.id,
    name: payload.name,
    interest_rate: payload.interestRate,
    installment: payload.installment,
    max_tenure_months: payload.maxTenureMonths ?? 36,
    description: payload.description || '',
    status: payload.status,
    created_at: createdAtIso,
    updated_at: nowIso,
    created_by: payload.createdBy || ''
  });
}

export const productService = {
  // ==========================================================================
  // SAVING PRODUCTS
  // ==========================================================================
  async getSavingProducts(): Promise<SavingProduct[]> {
    // If a save/delete mutation is actively syncing to Supabase, return the latest
    // in-memory/local snapshot so concurrent listeners never read stale remote rows.
    if (savingMutationInFlight > 0) {
      if (cachedSavingProducts && cachedSavingProducts.length > 0) {
        return cachedSavingProducts;
      }
      const local = getLocal<SavingProduct[]>(SAVING_STORAGE_KEY, []);
      if (local.length > 0) return local.map(normalizeSavingProduct);
    }
    return fetchSavingProductsInternal();
  },

  async saveSavingProduct(product: SavingProduct): Promise<SavingProduct[]> {
    return enqueueSavingMutation(async () => {
      const existing = cachedSavingProducts ?? (await fetchSavingProductsInternal());
      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      const showInMicrofinance = Boolean(product.showInMicrofinance ?? (product.showInFD === undefined ? product.showInMicrofinanceAndFD : false));
      const showInFD = Boolean(product.showInFD ?? (product.showInMicrofinance === undefined ? product.showInMicrofinanceAndFD : false));

      const payload: SavingProduct = {
        ...product,
        showInMicrofinance,
        showInFD,
        showInMicrofinanceAndFD: showInMicrofinance || showInFD,
        updatedAt: now,
        createdAt: product.createdAt || now
      };

      const index = existing.findIndex(p => p.id === product.id);
      const updated = index >= 0
        ? existing.map(p => (p.id === product.id ? payload : p))
        : [payload, ...existing];

      // 1. Instant in-memory & local persistence
      cachedSavingProducts = updated;
      setLocal(SAVING_STORAGE_KEY, updated);

      // 2. Save to dedicated Supabase table if available
      try {
        await upsertSavingProductRow(payload, nowIso);
      } catch (e) {
        console.warn('Dedicated saving_products table upsert notice:', e);
      }

      // 3. Dual-save to settings container in Supabase for cloud resilience
      try {
        await supabase.from('settings').upsert({
          id: 'saccos_saving_products',
          data: updated,
          updated_at: nowIso
        });
      } catch (e) {
        console.warn('Settings saving products sync notice:', e);
      }

      // Notify other components after persistence finishes
      try {
        window.dispatchEvent(new Event('savingProductsUpdated'));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.debug('Event dispatch notice:', e);
      }

      return updated;
    });
  },

  async deleteSavingProduct(id: string): Promise<SavingProduct[]> {
    return enqueueSavingMutation(async () => {
      const existing = cachedSavingProducts ?? (await fetchSavingProductsInternal());
      const updated = existing.filter(p => p.id !== id);

      // 1. Instant in-memory & local persistence
      cachedSavingProducts = updated;
      setLocal(SAVING_STORAGE_KEY, updated);

      // 2. Delete from Supabase dedicated table
      try {
        await supabase.from('saving_products').delete().eq('id', id);
      } catch (e) {
        console.warn('Dedicated saving_products table delete notice:', e);
      }

      // 3. Update Supabase settings container
      try {
        await supabase.from('settings').upsert({
          id: 'saccos_saving_products',
          data: updated,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Settings saving products delete sync notice:', e);
      }

      // Notify other components
      try {
        window.dispatchEvent(new Event('savingProductsUpdated'));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.debug('Event dispatch notice:', e);
      }

      return updated;
    });
  },

  // ==========================================================================
  // LOAN PRODUCTS
  // ==========================================================================
  async getLoanProducts(): Promise<LoanProduct[]> {
    if (loanMutationInFlight > 0) {
      if (cachedLoanProducts && cachedLoanProducts.length > 0) {
        return cachedLoanProducts;
      }
      const local = getLocal<LoanProduct[]>(LOAN_STORAGE_KEY, []);
      if (local.length > 0) return local.map(normalizeLoanProduct);
    }
    return fetchLoanProductsInternal();
  },

  async saveLoanProduct(product: LoanProduct): Promise<LoanProduct[]> {
    return enqueueLoanMutation(async () => {
      const existing = cachedLoanProducts ?? (await fetchLoanProductsInternal());
      const now = Date.now();
      const nowIso = new Date(now).toISOString();

      const showInMicrofinance = Boolean(product.showInMicrofinance ?? product.showInMicrofinanceAndFD);
      const payload: LoanProduct = {
        ...product,
        showInMicrofinance,
        showInMicrofinanceAndFD: showInMicrofinance,
        updatedAt: now,
        createdAt: product.createdAt || now
      };

      const index = existing.findIndex(p => p.id === product.id);
      const updated = index >= 0
        ? existing.map(p => (p.id === product.id ? payload : p))
        : [payload, ...existing];

      // 1. Instant in-memory & local persistence
      cachedLoanProducts = updated;
      setLocal(LOAN_STORAGE_KEY, updated);

      // 2. Save to dedicated Supabase table if available
      try {
        await upsertLoanProductRow(payload, nowIso);
      } catch (e) {
        console.warn('Dedicated loan_products table upsert notice:', e);
      }

      // 3. Dual-save to settings container in Supabase
      try {
        await supabase.from('settings').upsert({
          id: 'saccos_loan_products',
          data: updated,
          updated_at: nowIso
        });
      } catch (e) {
        console.warn('Settings loan products sync notice:', e);
      }

      // Notify other components
      try {
        window.dispatchEvent(new Event('loanProductsUpdated'));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.debug('Event dispatch notice:', e);
      }

      return updated;
    });
  },

  async deleteLoanProduct(id: string): Promise<LoanProduct[]> {
    return enqueueLoanMutation(async () => {
      const existing = cachedLoanProducts ?? (await fetchLoanProductsInternal());
      const updated = existing.filter(p => p.id !== id);

      // 1. Instant in-memory & local persistence
      cachedLoanProducts = updated;
      setLocal(LOAN_STORAGE_KEY, updated);

      // 2. Delete from Supabase dedicated table
      try {
        await supabase.from('loan_products').delete().eq('id', id);
      } catch (e) {
        console.warn('Dedicated loan_products table delete notice:', e);
      }

      // 3. Update Supabase settings container
      try {
        await supabase.from('settings').upsert({
          id: 'saccos_loan_products',
          data: updated,
          updated_at: new Date().toISOString()
        });
      } catch (e) {
        console.warn('Settings loan products delete sync notice:', e);
      }

      // Notify other components
      try {
        window.dispatchEvent(new Event('loanProductsUpdated'));
        window.dispatchEvent(new Event('storage'));
      } catch (e) {
        console.debug('Event dispatch notice:', e);
      }

      return updated;
    });
  }
};
