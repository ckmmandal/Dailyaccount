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
  show_in_mf_fd?: boolean;
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
  show_in_mf_fd?: boolean;
  showInMicrofinanceAndFD?: boolean;
  created_at?: string;
  createdAt?: number;
  updated_at?: string;
  updatedAt?: number;
  created_by?: string;
  createdBy?: string;
}

export const productService = {
  // ==========================================================================
  // SAVING PRODUCTS
  // ==========================================================================
  async getSavingProducts(): Promise<SavingProduct[]> {
    // Load settings backup container too so Nepali names/MF flags always merge cleanly
    const settingsMap = new Map<string, Partial<SavingProduct>>();
    try {
      const { data: settingsRow } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'saccos_saving_products')
        .maybeSingle();
      if (Array.isArray(settingsRow?.data)) {
        (settingsRow.data as SavingProduct[]).forEach(sp => {
          if (sp?.id) settingsMap.set(sp.id, sp);
        });
      }
    } catch {
      // ignore
    }

    const localSaved = getLocal<SavingProduct[]>(SAVING_STORAGE_KEY, []);
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
          const fallbackMeta = settingsMap.get(item.id) || localMap.get(item.id) || {};
          return {
            id: item.id,
            name: item.name,
            nameNp: item.name_np || item.nameNp || fallbackMeta.nameNp || '',
            interestRate: Number(item.interest_rate ?? item.interestRate ?? 0),
            capitalization: item.capitalization || 'Quarterly',
            minimumBalance: item.minimum_balance !== undefined ? Number(item.minimum_balance) : item.minimumBalance,
            description: item.description || '',
            status: item.status || 'Active',
            showInMicrofinanceAndFD: Boolean(item.showInMicrofinanceAndFD ?? item.show_in_mf_fd ?? fallbackMeta.showInMicrofinanceAndFD),
            createdAt: item.created_at || item.createdAt || Date.now(),
            updatedAt: item.updated_at || item.updatedAt || Date.now(),
            createdBy: item.created_by || item.createdBy
          };
        });
        setLocal(SAVING_STORAGE_KEY, mapped);
        return mapped;
      }
    } catch (e) {
      console.debug('Direct saving_products table not available, falling back:', e);
    }

    // 2. Try settings table container
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'saccos_saving_products')
        .maybeSingle();

      if (!error && data?.data && Array.isArray(data.data) && data.data.length > 0) {
        setLocal(SAVING_STORAGE_KEY, data.data);
        return data.data as SavingProduct[];
      }
    } catch {
      // Proceed to local
    }

    // 3. Fallback to localStorage or seed defaults
    const local = getLocal<SavingProduct[]>(SAVING_STORAGE_KEY, []);
    if (local && local.length > 0) {
      return local;
    }

    // Seed defaults
    setLocal(SAVING_STORAGE_KEY, DEFAULT_SAVING_PRODUCTS);
    // Background sync to settings
    supabase
      .from('settings')
      .upsert({
        id: 'saccos_saving_products',
        data: DEFAULT_SAVING_PRODUCTS,
        updated_at: new Date().toISOString()
      })
      .then(() => {}, () => {});

    return DEFAULT_SAVING_PRODUCTS;
  },

  async saveSavingProduct(product: SavingProduct): Promise<SavingProduct[]> {
    const existing = await this.getSavingProducts();
    const index = existing.findIndex(p => p.id === product.id);
    let updated: SavingProduct[];

    const now = Date.now();
    const payload: SavingProduct = {
      ...product,
      updatedAt: now,
      createdAt: product.createdAt || now
    };

    if (index >= 0) {
      updated = existing.map(p => (p.id === product.id ? payload : p));
    } else {
      updated = [payload, ...existing];
    }

    // 1. Instant local persistence
    setLocal(SAVING_STORAGE_KEY, updated);

    // 2. Save to dedicated Supabase table if available
    try {
      const { error: saveErr } = await supabase.from('saving_products').upsert({
        id: payload.id,
        name: payload.name,
        name_np: payload.nameNp || '',
        interest_rate: payload.interestRate,
        capitalization: payload.capitalization,
        minimum_balance: payload.minimumBalance ?? 0,
        description: payload.description || '',
        status: payload.status,
        created_at: typeof payload.createdAt === 'number' ? new Date(payload.createdAt).toISOString() : payload.createdAt,
        updated_at: new Date(now).toISOString(),
        created_by: payload.createdBy || ''
      });
      if (saveErr) {
        await supabase.from('saving_products').upsert({
          id: payload.id,
          name: payload.name,
          interest_rate: payload.interestRate,
          capitalization: payload.capitalization,
          minimum_balance: payload.minimumBalance ?? 0,
          description: payload.description || '',
          status: payload.status,
          created_at: typeof payload.createdAt === 'number' ? new Date(payload.createdAt).toISOString() : payload.createdAt,
          updated_at: new Date(now).toISOString(),
          created_by: payload.createdBy || ''
        });
      }
    } catch (e) {
      console.warn('Dedicated saving_products table upsert notice:', e);
    }

    // 3. Dual-save to settings container in Supabase for cloud resilience
    try {
      await supabase.from('settings').upsert({
        id: 'saccos_saving_products',
        data: updated,
        updated_at: new Date(now).toISOString()
      });
    } catch (e) {
      console.warn('Settings saving products sync notice:', e);
    }

    // Notify other components
    try {
      window.dispatchEvent(new Event('savingProductsUpdated'));
      window.dispatchEvent(new Event('storage'));
    } catch (e) {
      console.debug('Event dispatch notice:', e);
    }

    return updated;
  },

  async deleteSavingProduct(id: string): Promise<SavingProduct[]> {
    const existing = await this.getSavingProducts();
    const updated = existing.filter(p => p.id !== id);

    // 1. Instant local persistence
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
  },

  // ==========================================================================
  // LOAN PRODUCTS
  // ==========================================================================
  async getLoanProducts(): Promise<LoanProduct[]> {
    const settingsMap = new Map<string, Partial<LoanProduct>>();
    try {
      const { data: settingsRow } = await supabase
        .from('settings')
        .select('data')
        .eq('id', 'saccos_loan_products')
        .maybeSingle();
      if (Array.isArray(settingsRow?.data)) {
        (settingsRow.data as LoanProduct[]).forEach(lp => {
          if (lp?.id) settingsMap.set(lp.id, lp);
        });
      }
    } catch {
      // ignore
    }

    const localSaved = getLocal<LoanProduct[]>(LOAN_STORAGE_KEY, []);
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
          const fallbackMeta = settingsMap.get(item.id) || localMap.get(item.id) || {};
          return {
            id: item.id,
            name: item.name,
            nameNp: item.name_np || item.nameNp || fallbackMeta.nameNp || '',
            interestRate: Number(item.interest_rate ?? item.interestRate ?? 0),
            installment: item.installment || 'Monthly',
            maxTenureMonths: item.max_tenure_months !== undefined ? Number(item.max_tenure_months) : item.maxTenureMonths,
            description: item.description || '',
            status: item.status || 'Active',
            showInMicrofinanceAndFD: Boolean(item.showInMicrofinanceAndFD ?? item.show_in_mf_fd ?? fallbackMeta.showInMicrofinanceAndFD),
            createdAt: item.created_at || item.createdAt || Date.now(),
            updatedAt: item.updated_at || item.updatedAt || Date.now(),
            createdBy: item.created_by || item.createdBy
          };
        });
        setLocal(LOAN_STORAGE_KEY, mapped);
        return mapped;
      }
    } catch (e) {
      console.debug('Direct loan_products table not available, falling back:', e);
    }

    // 2. Try settings table container
    try {
      const { data, error } = await supabase
        .from('settings')
        .select('*')
        .eq('id', 'saccos_loan_products')
        .maybeSingle();

      if (!error && data?.data && Array.isArray(data.data) && data.data.length > 0) {
        setLocal(LOAN_STORAGE_KEY, data.data);
        return data.data as LoanProduct[];
      }
    } catch {
      // Proceed to local
    }

    // 3. Fallback to localStorage or seed defaults
    const local = getLocal<LoanProduct[]>(LOAN_STORAGE_KEY, []);
    if (local && local.length > 0) {
      return local;
    }

    // Seed defaults
    setLocal(LOAN_STORAGE_KEY, DEFAULT_LOAN_PRODUCTS);
    // Background sync to settings
    supabase
      .from('settings')
      .upsert({
        id: 'saccos_loan_products',
        data: DEFAULT_LOAN_PRODUCTS,
        updated_at: new Date().toISOString()
      })
      .then(() => {}, () => {});

    return DEFAULT_LOAN_PRODUCTS;
  },

  async saveLoanProduct(product: LoanProduct): Promise<LoanProduct[]> {
    const existing = await this.getLoanProducts();
    const index = existing.findIndex(p => p.id === product.id);
    let updated: LoanProduct[];

    const now = Date.now();
    const payload: LoanProduct = {
      ...product,
      updatedAt: now,
      createdAt: product.createdAt || now
    };

    if (index >= 0) {
      updated = existing.map(p => (p.id === product.id ? payload : p));
    } else {
      updated = [payload, ...existing];
    }

    // 1. Instant local persistence
    setLocal(LOAN_STORAGE_KEY, updated);

    // 2. Save to dedicated Supabase table if available
    try {
      const { error: saveErr } = await supabase.from('loan_products').upsert({
        id: payload.id,
        name: payload.name,
        name_np: payload.nameNp || '',
        interest_rate: payload.interestRate,
        installment: payload.installment,
        max_tenure_months: payload.maxTenureMonths ?? 36,
        description: payload.description || '',
        status: payload.status,
        created_at: typeof payload.createdAt === 'number' ? new Date(payload.createdAt).toISOString() : payload.createdAt,
        updated_at: new Date(now).toISOString(),
        created_by: payload.createdBy || ''
      });
      if (saveErr) {
        await supabase.from('loan_products').upsert({
          id: payload.id,
          name: payload.name,
          interest_rate: payload.interestRate,
          installment: payload.installment,
          max_tenure_months: payload.maxTenureMonths ?? 36,
          description: payload.description || '',
          status: payload.status,
          created_at: typeof payload.createdAt === 'number' ? new Date(payload.createdAt).toISOString() : payload.createdAt,
          updated_at: new Date(now).toISOString(),
          created_by: payload.createdBy || ''
        });
      }
    } catch (e) {
      console.warn('Dedicated loan_products table upsert notice:', e);
    }

    // 3. Dual-save to settings container in Supabase
    try {
      await supabase.from('settings').upsert({
        id: 'saccos_loan_products',
        data: updated,
        updated_at: new Date(now).toISOString()
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
  },

  async deleteLoanProduct(id: string): Promise<LoanProduct[]> {
    const existing = await this.getLoanProducts();
    const updated = existing.filter(p => p.id !== id);

    // 1. Instant local persistence
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
  }
};
