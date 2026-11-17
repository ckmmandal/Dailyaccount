-- ============================================================================
-- RATAULI SAVING AND CREDIT COOPERATIVE LIMITED
-- FIXED ASSETS & DEPRECIATION MANAGEMENT MODULE - COMPLETE SUPABASE SQL
-- ============================================================================
-- How to Run:
--   1. Open Supabase Dashboard -> SQL Editor -> New Query
--   2. Paste this ENTIRE script and click "Run"
-- Safe to run on BOTH a new database and an existing database (100% Idempotent).
--
-- Covers ALL 6 Depreciation Sub-Menus:
--   1. Asset Management (Categories, Fixed Assets, Documents, Disposal, Transfers)
--   2. Depreciation Calculation (SLM / WDV / Income Tax Block Entries)
--   3. Depreciation Accounting (Auto & Manual Journal Vouchers + Multi-lines)
--   4. Depreciation Reports (Branch/Category/Tax Schedule Queries & Indexes)
--   5. Depreciation Settings & Financial Years
--   6. Cloud Registry Compatibility (daily_data key='depreciation_registry_v1')
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ############################################################################
-- 1. ENSURE CLOUD SYNC KEY COMPATIBILITY IN daily_data
--    (Required by current depreciationService.ts cloud sync)
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.daily_data (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    key TEXT UNIQUE,
    date TEXT,
    branch_id TEXT,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.daily_data ALTER COLUMN id SET DEFAULT gen_random_uuid()::text;
ALTER TABLE public.daily_data ADD COLUMN IF NOT EXISTS key TEXT;
ALTER TABLE public.daily_data ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.daily_data ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.daily_data ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.daily_data ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

DO $$
BEGIN
    ALTER TABLE public.daily_data ALTER COLUMN date DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;
DO $$
BEGIN
    ALTER TABLE public.daily_data ALTER COLUMN branch_id DROP NOT NULL;
EXCEPTION WHEN others THEN NULL;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_data_key_unique
    ON public.daily_data(key) WHERE key IS NOT NULL;


-- ############################################################################
-- 2. ASSET CATEGORIES TABLE (Block A-E Tax & Book Depreciation Rates)
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.asset_categories (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    default_method TEXT NOT NULL DEFAULT 'WDV',
    rate NUMERIC NOT NULL DEFAULT 15,
    tax_block TEXT NOT NULL DEFAULT 'Block B',
    tax_rate NUMERIC NOT NULL DEFAULT 25,
    useful_life_years INT NOT NULL DEFAULT 5,
    salvage_percent NUMERIC NOT NULL DEFAULT 5,
    gl_asset_account TEXT,
    gl_expense_account TEXT,
    gl_accumulated_account TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.asset_categories ADD COLUMN IF NOT EXISTS gl_asset_account TEXT;
ALTER TABLE public.asset_categories ADD COLUMN IF NOT EXISTS gl_expense_account TEXT;
ALTER TABLE public.asset_categories ADD COLUMN IF NOT EXISTS gl_accumulated_account TEXT;
ALTER TABLE public.asset_categories ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.asset_categories ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- ############################################################################
-- 3. FIXED ASSETS REGISTRY TABLE
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.fixed_assets (
    id TEXT PRIMARY KEY,
    asset_code TEXT NOT NULL,
    name TEXT NOT NULL,
    category_id TEXT NOT NULL,
    category_name TEXT DEFAULT '',
    branch_id TEXT NOT NULL DEFAULT 'main',
    branch_name TEXT DEFAULT '',
    purchase_date TEXT NOT NULL,
    purchase_date_bs TEXT NOT NULL,
    put_to_use_date TEXT,
    put_to_use_date_bs TEXT,
    purchase_value NUMERIC NOT NULL DEFAULT 0,
    salvage_value NUMERIC NOT NULL DEFAULT 0,
    useful_life_years INT NOT NULL DEFAULT 5,
    method TEXT NOT NULL DEFAULT 'WDV',
    depreciation_rate NUMERIC NOT NULL DEFAULT 15,
    tax_block TEXT NOT NULL DEFAULT 'Block B',
    tax_rate NUMERIC NOT NULL DEFAULT 25,
    vendor_name TEXT,
    invoice_no TEXT,
    serial_no TEXT,
    location TEXT,
    custodian TEXT,
    remarks TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    accumulated_depreciation NUMERIC NOT NULL DEFAULT 0,
    net_book_value NUMERIC NOT NULL DEFAULT 0,
    disposal_date TEXT,
    disposal_date_bs TEXT,
    disposal_type TEXT,
    sale_proceeds NUMERIC DEFAULT 0,
    disposal_gain_loss NUMERIC DEFAULT 0,
    disposal_remarks TEXT,
    documents JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by TEXT,
    created_at TEXT,
    updated_at TEXT
);

ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS put_to_use_date TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS put_to_use_date_bs TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS vendor_name TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS invoice_no TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS serial_no TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS custodian TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS disposal_date TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS disposal_date_bs TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS disposal_type TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS sale_proceeds NUMERIC DEFAULT 0;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS disposal_gain_loss NUMERIC DEFAULT 0;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS disposal_remarks TEXT;
ALTER TABLE public.fixed_assets ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;


-- ############################################################################
-- 4. ASSET BRANCH TRANSFERS HISTORY TABLE
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.asset_transfers (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    asset_code TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    from_branch_id TEXT NOT NULL,
    from_branch_name TEXT DEFAULT '',
    to_branch_id TEXT NOT NULL,
    to_branch_name TEXT DEFAULT '',
    transfer_date TEXT NOT NULL,
    transfer_date_bs TEXT NOT NULL,
    transferred_by TEXT NOT NULL,
    remarks TEXT,
    created_at TEXT
);


-- ############################################################################
-- 5. DEPRECIATION CALCULATION ENTRIES TABLE (Monthly / Yearly Runs)
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.depreciation_entries (
    id TEXT PRIMARY KEY,
    asset_id TEXT NOT NULL,
    asset_code TEXT NOT NULL,
    asset_name TEXT NOT NULL,
    category_id TEXT NOT NULL,
    category_name TEXT DEFAULT '',
    branch_id TEXT NOT NULL DEFAULT 'main',
    branch_name TEXT DEFAULT '',
    financial_year TEXT NOT NULL,
    period_type TEXT NOT NULL DEFAULT 'Yearly',
    period_label TEXT NOT NULL,
    method TEXT NOT NULL DEFAULT 'WDV',
    rate NUMERIC NOT NULL DEFAULT 0,
    opening_value NUMERIC NOT NULL DEFAULT 0,
    depreciation_amount NUMERIC NOT NULL DEFAULT 0,
    tax_depreciation_amount NUMERIC NOT NULL DEFAULT 0,
    accumulated_depreciation NUMERIC NOT NULL DEFAULT 0,
    closing_net_book_value NUMERIC NOT NULL DEFAULT 0,
    voucher_id TEXT,
    calculated_at TEXT,
    calculated_by TEXT
);


-- ############################################################################
-- 6. DEPRECIATION ACCOUNTING JOURNAL VOUCHERS TABLE
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.depreciation_vouchers (
    id TEXT PRIMARY KEY,
    voucher_no TEXT NOT NULL,
    voucher_date TEXT NOT NULL,
    voucher_date_bs TEXT NOT NULL,
    financial_year TEXT NOT NULL,
    branch_id TEXT NOT NULL DEFAULT 'main',
    branch_name TEXT DEFAULT '',
    period_label TEXT NOT NULL,
    voucher_type TEXT NOT NULL DEFAULT 'Depreciation',
    debit_account TEXT NOT NULL,
    debit_amount NUMERIC NOT NULL DEFAULT 0,
    credit_account TEXT NOT NULL,
    credit_amount NUMERIC NOT NULL DEFAULT 0,
    narration TEXT,
    asset_count INT DEFAULT 1,
    status TEXT NOT NULL DEFAULT 'Posted',
    lines JSONB NOT NULL DEFAULT '[]'::jsonb,
    created_by TEXT,
    created_at TEXT
);


-- ############################################################################
-- 7. DEPRECIATION FINANCIAL YEARS & SETTINGS TABLES
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.depreciation_financial_years (
    id TEXT PRIMARY KEY,
    label TEXT NOT NULL,
    start_date_bs TEXT NOT NULL,
    end_date_bs TEXT NOT NULL,
    is_current BOOLEAN DEFAULT false,
    status TEXT NOT NULL DEFAULT 'Open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.depreciation_settings (
    id TEXT PRIMARY KEY DEFAULT 'default',
    default_method TEXT NOT NULL DEFAULT 'WDV',
    default_useful_life_years INT NOT NULL DEFAULT 5,
    default_salvage_percent NUMERIC NOT NULL DEFAULT 5,
    rounding_rule TEXT NOT NULL DEFAULT 'Nearest',
    auto_post_journal_voucher BOOLEAN DEFAULT true,
    tax_comparison_enabled BOOLEAN DEFAULT true,
    default_gl_asset_account TEXT DEFAULT '1500 - Fixed Assets Control',
    default_gl_expense_account TEXT DEFAULT '5201 - Depreciation Expense',
    default_gl_accumulated_account TEXT DEFAULT '1590 - Accumulated Depreciation',
    current_financial_year TEXT DEFAULT '2083/84',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ############################################################################
-- 8. PERFORMANCE INDEXES, RLS DISABLE & CLIENT PERMISSIONS
-- ############################################################################

CREATE INDEX IF NOT EXISTS idx_fa_branch ON public.fixed_assets(branch_id);
CREATE INDEX IF NOT EXISTS idx_fa_category ON public.fixed_assets(category_id);
CREATE INDEX IF NOT EXISTS idx_fa_status ON public.fixed_assets(status);
CREATE INDEX IF NOT EXISTS idx_fa_code ON public.fixed_assets(asset_code);

CREATE INDEX IF NOT EXISTS idx_fa_transfers_asset ON public.asset_transfers(asset_id);
CREATE INDEX IF NOT EXISTS idx_dep_entries_asset ON public.depreciation_entries(asset_id);
CREATE INDEX IF NOT EXISTS idx_dep_entries_fy_branch ON public.depreciation_entries(financial_year, branch_id);
CREATE INDEX IF NOT EXISTS idx_dep_vouchers_fy_branch ON public.depreciation_vouchers(financial_year, branch_id);
CREATE INDEX IF NOT EXISTS idx_dep_vouchers_type ON public.depreciation_vouchers(voucher_type);

ALTER TABLE public.daily_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fixed_assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.asset_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.depreciation_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.depreciation_vouchers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.depreciation_financial_years DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.depreciation_settings DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE
    public.daily_data,
    public.asset_categories,
    public.fixed_assets,
    public.asset_transfers,
    public.depreciation_entries,
    public.depreciation_vouchers,
    public.depreciation_financial_years,
    public.depreciation_settings
TO anon, authenticated, service_role;


-- ############################################################################
-- 9. DEFAULT SEED DATA (NEPAL INCOME TAX BLOCKS, FISCAL YEARS & SETTINGS)
-- ############################################################################

INSERT INTO public.asset_categories (
    id, code, name, default_method, rate, tax_block, tax_rate,
    useful_life_years, salvage_percent, gl_asset_account, gl_expense_account, gl_accumulated_account, status
) VALUES
('cat_building', 'FA-BLD', 'Buildings & Premises', 'WDV', 5, 'Block A', 5, 30, 10, '1501 - Land & Buildings', '5201 - Depreciation Expense', '1591 - Accumulated Depreciation (Buildings)', 'Active'),
('cat_it', 'FA-CMP', 'Computers & IT Equipment', 'WDV', 25, 'Block B', 25, 5, 5, '1502 - Computers & Peripherals', '5201 - Depreciation Expense', '1592 - Accumulated Depreciation (IT Equipment)', 'Active'),
('cat_furniture', 'FA-FRN', 'Office Furniture & Fixtures', 'SLM', 15, 'Block B', 25, 7, 5, '1503 - Furniture & Fixtures', '5201 - Depreciation Expense', '1593 - Accumulated Depreciation (Furniture)', 'Active'),
('cat_vehicle', 'FA-VEH', 'Vehicles & Transport', 'WDV', 20, 'Block C', 20, 8, 10, '1504 - Vehicles & Motorcycles', '5201 - Depreciation Expense', '1594 - Accumulated Depreciation (Vehicles)', 'Active'),
('cat_machinery', 'FA-MCH', 'Machinery & Office Equipment', 'SLM', 15, 'Block D', 15, 10, 5, '1505 - Machinery & Vault Equipment', '5201 - Depreciation Expense', '1595 - Accumulated Depreciation (Machinery)', 'Active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.depreciation_financial_years (id, label, start_date_bs, end_date_bs, is_current, status) VALUES
('fy_2082_83', '2082/83', '2082-04-01', '2083-03-31', false, 'Closed'),
('fy_2083_84', '2083/84', '2083-04-01', '2084-03-31', true, 'Open')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.depreciation_settings (
    id, default_method, default_useful_life_years, default_salvage_percent,
    rounding_rule, auto_post_journal_voucher, tax_comparison_enabled,
    default_gl_asset_account, default_gl_expense_account, default_gl_accumulated_account,
    current_financial_year
) VALUES (
    'default', 'WDV', 5, 5, 'Nearest', true, true,
    '1500 - Fixed Assets Control', '5201 - Depreciation Expense', '1590 - Accumulated Depreciation',
    '2083/84'
)
ON CONFLICT (id) DO NOTHING;
