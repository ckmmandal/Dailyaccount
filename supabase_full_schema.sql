-- ============================================================================
-- RATAULI SAVING AND CREDIT COOPERATIVE LIMITED
-- COMPLETE SUPABASE POSTGRESQL SCHEMA & MASTER MIGRATION (ALL MENUS & SUB-MENUS)
-- ============================================================================
-- How to Run:
--   1. Open Supabase Dashboard -> SQL Editor -> New Query
--   2. Paste this ENTIRE script and click "Run"
-- Safe to run on BOTH a brand-new database and an existing database (100% Idempotent).
--
-- MENU-TO-TABLE MAPPING:
--   1. Dashboard & Analytics         -> daily_data, branches, ledger_accounts
--   2. Front Teller Operations       -> daily_data, front_teller_ledger_entries,
--                                       front_teller_counter_entries,
--                                       front_teller_remittance_entries, remittance_entries
--   3. Vault Control & Settlement    -> daily_data, daily_cash_data,
--                                       front_teller_deno_adjustments,
--                                       front_teller_vault_entries, teller_other_adjustments
--   4. Teller Daily Ledger           -> daily_data, front_teller_ledger_entries, ledger_accounts
--   5. Back Office & Financial Audit -> daily_data, back_office_entries, ledger_accounts
--   6. Income & Operational Expenses -> daily_data, back_office_entries, front_teller_counter_entries
--   7. Office Expenses Registry      -> office_expenses, branch_fixed_expense_configs,
--                                       saved_office_expense_sheets, daily_data
--   8. Ledger Master (COA)           -> ledger_accounts
--   9. Notice Board & Downloads      -> notices, downloadable_documents, daily_data (POPUP_NOTICES_STORE)
--  10. HR Management & Governance    -> employees, employee_documents, attendance_records,
--                                       leave_types, leave_requests, payroll_records,
--                                       complaints, tax_policy, tax_adjustments,
--                                       board_categories, board_designations, board_members,
--                                       board_allowance_sheets, settings (employee_kyc_*, saccos_board_*)
--  11. Insurance Management (Bima)   -> (Uses localStorage in client; alert badge reads policies)
--  12. Micro-Finance Operations      -> mf_loans, group_meetings, daily_data (MF_* stores),
--                                       saving_products, loan_products
--  13. Fixed Assets & Depreciation   -> daily_data (key = 'depreciation_registry_v1')
--  14. Header Alerts (1-Day Center)  -> notices, mf_loans, holidays
--  15. Header Shortcuts & Tools      -> remittance_companies, chat_messages, fd_records, settings
--  16. Admin Center & Security       -> branches, saving_products, loan_products, holidays,
--                                       branch_operational_status, branch_operational_logs,
--                                       users, roles, settings, audit_logs
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ############################################################################
-- SECTION 1: CORE INSTITUTION, BRANCHES, ROLES, USERS & SETTINGS (ADMIN CENTER)
-- ############################################################################

-- 1.1 BRANCHES TABLE
CREATE TABLE IF NOT EXISTS public.branches (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_np TEXT,
    code TEXT,
    code_np TEXT,
    location TEXT,
    location_np TEXT,
    branch_type TEXT DEFAULT 'Branch Office',
    branch_type_np TEXT DEFAULT 'शाखा कार्यालय',
    email TEXT,
    status TEXT DEFAULT 'Active',
    created_at BIGINT
);

ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS name_np TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code_np TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS location TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS location_np TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS branch_type TEXT DEFAULT 'Branch Office';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS branch_type_np TEXT DEFAULT 'शाखा कार्यालय';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS created_at BIGINT;

-- 1.2 ROLES & GRANULAR SUB-MENU PERMISSIONS TABLE
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb
);

ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS name TEXT;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'roles'
          AND column_name = 'permissions' AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE public.roles ALTER COLUMN permissions DROP DEFAULT;
        ALTER TABLE public.roles ALTER COLUMN permissions TYPE JSONB USING to_jsonb(COALESCE(permissions, ARRAY[]::TEXT[]));
        ALTER TABLE public.roles ALTER COLUMN permissions SET DEFAULT '[]'::jsonb;
    END IF;
END $$;
ALTER TABLE public.roles ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;

-- 1.3 USERS TABLE
CREATE TABLE IF NOT EXISTS public.users (
    id TEXT PRIMARY KEY,
    username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL,
    full_name TEXT,
    role_id TEXT,
    branch_id TEXT,
    permissions JSONB DEFAULT '[]'::jsonb,
    status TEXT DEFAULT 'Active',
    email TEXT,
    mobile TEXT,
    department TEXT,
    designation TEXT,
    profile_photo TEXT,
    account_created BIGINT,
    password_updated_at BIGINT,
    force_password_change BOOLEAN DEFAULT false,
    address TEXT,
    id_number TEXT,
    dob TEXT,
    last_login BIGINT,
    last_activity BIGINT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'users'
          AND column_name = 'permissions' AND data_type = 'ARRAY'
    ) THEN
        ALTER TABLE public.users ALTER COLUMN permissions DROP DEFAULT;
        ALTER TABLE public.users ALTER COLUMN permissions TYPE JSONB USING to_jsonb(COALESCE(permissions, ARRAY[]::TEXT[]));
        ALTER TABLE public.users ALTER COLUMN permissions SET DEFAULT '[]'::jsonb;
    END IF;
END $$;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS role_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS permissions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS profile_photo TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS account_created BIGINT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS password_updated_at BIGINT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS force_password_change BOOLEAN DEFAULT false;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS id_number TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS dob TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_login BIGINT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS last_activity BIGINT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.users ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 1.4 SYSTEM SETTINGS & CONFIG STORE TABLE
-- Holds: global, saccos_weekend_days, saccos_app_holidays, saccos_branch_operational_statuses,
--        saccos_branches_meta, saccos_saving_products, saccos_loan_products,
--        saccos_board_*, saccos_chat_*, employee_kyc_*
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS data JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.settings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 1.5 SECURITY AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    user_id TEXT,
    user_name TEXT,
    action TEXT,
    details TEXT,
    timestamp BIGINT,
    branch_id TEXT,
    date_bs TEXT,
    category TEXT,
    ip TEXT,
    device TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS user_name TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS details TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS timestamp BIGINT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS date_bs TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS ip TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS device TEXT;
ALTER TABLE public.audit_logs ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 1.6 SAVING & LOAN PRODUCTS TABLES (ADMIN CENTER -> PRODUCTS)
CREATE TABLE IF NOT EXISTS public.saving_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_np TEXT,
    interest_rate NUMERIC NOT NULL DEFAULT 0,
    capitalization TEXT NOT NULL DEFAULT 'Quarterly',
    minimum_balance NUMERIC DEFAULT 0,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    show_in_mf_fd BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS name_np TEXT;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 0;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS capitalization TEXT DEFAULT 'Quarterly';
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS minimum_balance NUMERIC DEFAULT 0;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS show_in_mf_fd BOOLEAN DEFAULT false;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS created_by TEXT;

CREATE TABLE IF NOT EXISTS public.loan_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_np TEXT,
    interest_rate NUMERIC NOT NULL DEFAULT 0,
    installment TEXT NOT NULL DEFAULT 'Monthly',
    max_tenure_months INT DEFAULT 36,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    show_in_mf_fd BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS name_np TEXT;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 0;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS installment TEXT DEFAULT 'Monthly';
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS max_tenure_months INT DEFAULT 36;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS show_in_mf_fd BOOLEAN DEFAULT false;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 1.7 HOLIDAYS & BRANCH OPERATIONAL STATUS (DAY OPEN / DAY END)
CREATE TABLE IF NOT EXISTS public.holidays (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date_bs TEXT NOT NULL,
    date_ad DATE,
    type TEXT NOT NULL DEFAULT 'Public Holiday',
    branch_id TEXT DEFAULT 'all',
    description TEXT,
    is_recurring BOOLEAN DEFAULT false,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS date_bs TEXT;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS date_ad DATE;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Public Holiday';
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'all';
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.branch_operational_status (
    branch_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'OPEN',
    date_bs TEXT NOT NULL,
    notes TEXT,
    opened_at TIMESTAMPTZ,
    ended_at TIMESTAMPTZ,
    updated_by TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.branch_operational_status ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'OPEN';
ALTER TABLE public.branch_operational_status ADD COLUMN IF NOT EXISTS date_bs TEXT;
ALTER TABLE public.branch_operational_status ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.branch_operational_status ADD COLUMN IF NOT EXISTS opened_at TIMESTAMPTZ;
ALTER TABLE public.branch_operational_status ADD COLUMN IF NOT EXISTS ended_at TIMESTAMPTZ;
ALTER TABLE public.branch_operational_status ADD COLUMN IF NOT EXISTS updated_by TEXT;
ALTER TABLE public.branch_operational_status ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE TABLE IF NOT EXISTS public.branch_operational_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    branch_id TEXT NOT NULL,
    action TEXT NOT NULL,
    status TEXT NOT NULL,
    date_bs TEXT NOT NULL,
    notes TEXT,
    performed_by TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.branch_operational_logs ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.branch_operational_logs ADD COLUMN IF NOT EXISTS action TEXT;
ALTER TABLE public.branch_operational_logs ADD COLUMN IF NOT EXISTS status TEXT;
ALTER TABLE public.branch_operational_logs ADD COLUMN IF NOT EXISTS date_bs TEXT;
ALTER TABLE public.branch_operational_logs ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.branch_operational_logs ADD COLUMN IF NOT EXISTS performed_by TEXT;
ALTER TABLE public.branch_operational_logs ADD COLUMN IF NOT EXISTS timestamp TIMESTAMPTZ DEFAULT NOW();


-- ############################################################################
-- SECTION 2: DAILY OPERATIONS, FRONT TELLER, VAULT, BACK OFFICE & DEPRECIATION
-- ############################################################################

-- 2.1 DAILY DATA (Core Daily Cash/Ledger + JSON Stores:
--     depreciation_registry_v1, BRANCH_DAY_OPS_*, FD_RECORDS_STORE,
--     OFFICE_EXPENSES_STORE, SAVED_EXPENSE_SHEETS_STORE, FIXED_OFFICE_EXPENSE_CONFIGS,
--     POPUP_NOTICES_STORE, HOLIDAYS_STORE, MF_ACTIVE_LOANS_STORE, MF_CLOSED_LOANS_ARCHIVE)
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
-- Ensure nullable date & branch_id for key-based stores like depreciation_registry_v1 and HOLIDAYS_STORE
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
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_data_key_unique ON public.daily_data(key) WHERE key IS NOT NULL;

-- 2.2 DAILY CASH DATA (Legacy / Branch cleanup support)
CREATE TABLE IF NOT EXISTS public.daily_cash_data (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    date TEXT,
    branch_id TEXT,
    data JSONB DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 GRANULAR FRONT TELLER & BACK OFFICE TABLES
CREATE TABLE IF NOT EXISTS public.front_teller_ledger_entries (
    id TEXT PRIMARY KEY,
    date TEXT,
    branch_id TEXT,
    account_title TEXT,
    amount NUMERIC DEFAULT 0,
    type TEXT,
    remarks TEXT,
    data JSONB,
    created_by TEXT,
    server_timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS account_title TEXT;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS server_timestamp BIGINT;

CREATE TABLE IF NOT EXISTS public.front_teller_counter_entries (
    id TEXT PRIMARY KEY,
    date TEXT,
    branch_id TEXT,
    head TEXT,
    amount NUMERIC DEFAULT 0,
    type TEXT,
    remarks TEXT,
    data JSONB,
    created_by TEXT,
    server_timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS head TEXT;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS server_timestamp BIGINT;

CREATE TABLE IF NOT EXISTS public.front_teller_remittance_entries (
    id TEXT PRIMARY KEY,
    date TEXT,
    branch_id TEXT,
    partner TEXT,
    amount NUMERIC DEFAULT 0,
    type TEXT,
    remarks TEXT,
    quantity INT DEFAULT 1,
    data JSONB,
    created_by TEXT,
    server_timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS partner TEXT;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS server_timestamp BIGINT;

CREATE TABLE IF NOT EXISTS public.remittance_entries (
    id TEXT PRIMARY KEY,
    date TEXT,
    branch_id TEXT,
    partner TEXT,
    amount NUMERIC DEFAULT 0,
    type TEXT,
    remarks TEXT,
    quantity INT DEFAULT 1,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.front_teller_deno_adjustments (
    id TEXT PRIMARY KEY,
    date TEXT,
    branch_id TEXT,
    type TEXT,
    value NUMERIC DEFAULT 0,
    quantity NUMERIC DEFAULT 0,
    amount NUMERIC DEFAULT 0,
    total_amount NUMERIC DEFAULT 0,
    remarks TEXT,
    denominations_breakdown JSONB,
    data JSONB,
    created_by TEXT,
    server_timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS denominations_breakdown JSONB;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS server_timestamp BIGINT;

CREATE TABLE IF NOT EXISTS public.front_teller_vault_entries (
    id TEXT PRIMARY KEY,
    date TEXT,
    branch_id TEXT,
    party_type TEXT,
    party_name TEXT,
    tx_type TEXT,
    amount NUMERIC DEFAULT 0,
    remarks TEXT,
    denominations_breakdown JSONB,
    vault_snapshot JSONB,
    is_vault_transfer BOOLEAN DEFAULT false,
    data JSONB,
    created_by TEXT,
    server_timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS party_type TEXT;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS party_name TEXT;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS tx_type TEXT;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS denominations_breakdown JSONB;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS vault_snapshot JSONB;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS is_vault_transfer BOOLEAN DEFAULT false;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS server_timestamp BIGINT;

CREATE TABLE IF NOT EXISTS public.back_office_entries (
    id TEXT PRIMARY KEY,
    date TEXT,
    branch_id TEXT,
    head TEXT,
    amount NUMERIC DEFAULT 0,
    type TEXT,
    remarks TEXT,
    data JSONB,
    created_by TEXT,
    server_timestamp BIGINT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS head TEXT;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS data JSONB;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS server_timestamp BIGINT;

-- 2.4 TELLER OTHER ADJUSTMENTS BREAKDOWN
CREATE TABLE IF NOT EXISTS public.teller_other_adjustments (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    date_bs TEXT NOT NULL,
    sn INT NOT NULL DEFAULT 1,
    type TEXT NOT NULL,
    amount NUMERIC DEFAULT 0,
    narration TEXT,
    user_id TEXT,
    user_name TEXT DEFAULT 'Front Teller',
    running_balance NUMERIC DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.teller_other_adjustments ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.teller_other_adjustments ADD COLUMN IF NOT EXISTS date_bs TEXT;
ALTER TABLE public.teller_other_adjustments ADD COLUMN IF NOT EXISTS sn INT DEFAULT 1;
ALTER TABLE public.teller_other_adjustments ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.teller_other_adjustments ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.teller_other_adjustments ADD COLUMN IF NOT EXISTS narration TEXT;
ALTER TABLE public.teller_other_adjustments ADD COLUMN IF NOT EXISTS user_id TEXT;
ALTER TABLE public.teller_other_adjustments ADD COLUMN IF NOT EXISTS user_name TEXT DEFAULT 'Front Teller';
ALTER TABLE public.teller_other_adjustments ADD COLUMN IF NOT EXISTS running_balance NUMERIC DEFAULT 0;
ALTER TABLE public.teller_other_adjustments ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

-- 2.5 LEDGER MASTER (CHART OF ACCOUNTS)
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
    id TEXT PRIMARY KEY,
    code TEXT,
    name TEXT NOT NULL,
    category TEXT,
    sub_category TEXT,
    type TEXT,
    initial_balance NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Active',
    is_active BOOLEAN DEFAULT true,
    branch_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS sub_category TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS initial_balance NUMERIC DEFAULT 0;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();


-- ############################################################################
-- SECTION 3: OFFICE EXPENSES REGISTRY & FIXED EXPENSE SETTINGS
-- ############################################################################

-- 3.1 OFFICE EXPENSES TABLE
CREATE TABLE IF NOT EXISTS public.office_expenses (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    date TEXT,
    date_bs TEXT,
    fiscal_year TEXT,
    month TEXT,
    category TEXT NOT NULL,
    category_label TEXT,
    amount NUMERIC DEFAULT 0,
    tax_deduction NUMERIC DEFAULT 0,
    tax_rate NUMERIC DEFAULT 0,
    net_paid_amount NUMERIC DEFAULT 0,
    paid_to TEXT,
    account_no TEXT,
    bank_name TEXT,
    payment_method TEXT DEFAULT 'Account Transfer',
    voucher_no TEXT,
    bill_no TEXT,
    meter_no TEXT,
    consumer_no TEXT,
    customer_no TEXT,
    previous_unit NUMERIC DEFAULT 0,
    current_unit NUMERIC DEFAULT 0,
    previous NUMERIC DEFAULT 0,
    current NUMERIC DEFAULT 0,
    consumed_units NUMERIC DEFAULT 0,
    rate_per_unit NUMERIC DEFAULT 0,
    unit_rate NUMERIC DEFAULT 0,
    min_demand_charge NUMERIC DEFAULT 0,
    rebate_penalty NUMERIC DEFAULT 0,
    landlord_name TEXT,
    pan_vat_no TEXT,
    rent_period_from TEXT,
    rent_period_to TEXT,
    cleaner_name TEXT,
    working_days INT DEFAULT 30,
    attendees_count INT,
    items_description TEXT,
    service_provider TEXT,
    recorded_by TEXT,
    approved_by TEXT,
    remarks TEXT,
    attachment_url TEXT,
    created_at BIGINT,
    updated_at BIGINT
);

ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS date_bs TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS fiscal_year TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS month TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS category_label TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS tax_deduction NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS tax_rate NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS net_paid_amount NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS paid_to TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS account_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Account Transfer';
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS voucher_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS bill_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS meter_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS consumer_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS customer_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS previous_unit NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS current_unit NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS previous NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS current NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS consumed_units NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS rate_per_unit NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS unit_rate NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS min_demand_charge NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS rebate_penalty NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS landlord_name TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS pan_vat_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS rent_period_from TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS rent_period_to TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS cleaner_name TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS working_days INT DEFAULT 30;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS attendees_count INT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS items_description TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS service_provider TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS attachment_url TEXT;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'office_expenses'
          AND column_name = 'created_at' AND data_type LIKE 'timestamp%'
    ) THEN
        ALTER TABLE public.office_expenses ALTER COLUMN created_at DROP DEFAULT;
        ALTER TABLE public.office_expenses ALTER COLUMN created_at TYPE BIGINT USING (EXTRACT(EPOCH FROM created_at) * 1000)::BIGINT;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'office_expenses'
          AND column_name = 'updated_at' AND data_type LIKE 'timestamp%'
    ) THEN
        ALTER TABLE public.office_expenses ALTER COLUMN updated_at DROP DEFAULT;
        ALTER TABLE public.office_expenses ALTER COLUMN updated_at TYPE BIGINT USING (EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT;
    END IF;
END $$;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS created_at BIGINT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS updated_at BIGINT;

-- 3.2 BRANCH FIXED EXPENSE CONFIGS (EXACT CODE COLUMN MAPPING)
CREATE TABLE IF NOT EXISTS public.branch_fixed_expense_configs (
    branch_id TEXT PRIMARY KEY,
    id TEXT,
    rent_enabled BOOLEAN DEFAULT TRUE,
    landlord_name TEXT,
    rent_gross_amount NUMERIC DEFAULT 0,
    rent_tax_rate NUMERIC DEFAULT 10,
    rent_net_amount NUMERIC DEFAULT 0,
    rent_account_no TEXT,
    rent_bank_name TEXT,
    rent_payment_method TEXT DEFAULT 'Account Transfer',
    cleaner_enabled BOOLEAN DEFAULT TRUE,
    cleaner_name TEXT,
    cleaner_gross_amount NUMERIC DEFAULT 0,
    cleaner_tax_rate NUMERIC DEFAULT 1.5,
    cleaner_net_amount NUMERIC DEFAULT 0,
    cleaner_working_days INT DEFAULT 30,
    cleaner_account_no TEXT,
    cleaner_bank_name TEXT,
    cleaner_payment_method TEXT DEFAULT 'Account Transfer',
    telephone_enabled BOOLEAN DEFAULT FALSE,
    telephone_provider TEXT,
    telephone_amount NUMERIC DEFAULT 0,
    khaja_enabled BOOLEAN DEFAULT FALSE,
    khaja_amount NUMERIC DEFAULT 0,
    electricity_meter_no TEXT,
    electricity_customer_no TEXT,
    electricity_unit_rate NUMERIC DEFAULT 10,
    updated_at BIGINT
);

ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS rent_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS landlord_name TEXT;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS rent_gross_amount NUMERIC DEFAULT 0;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS rent_tax_rate NUMERIC DEFAULT 10;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS rent_net_amount NUMERIC DEFAULT 0;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS rent_account_no TEXT;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS rent_bank_name TEXT;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS rent_payment_method TEXT DEFAULT 'Account Transfer';
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS cleaner_enabled BOOLEAN DEFAULT TRUE;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS cleaner_name TEXT;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS cleaner_gross_amount NUMERIC DEFAULT 0;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS cleaner_tax_rate NUMERIC DEFAULT 1.5;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS cleaner_net_amount NUMERIC DEFAULT 0;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS cleaner_working_days INT DEFAULT 30;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS cleaner_account_no TEXT;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS cleaner_bank_name TEXT;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS cleaner_payment_method TEXT DEFAULT 'Account Transfer';
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS telephone_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS telephone_provider TEXT;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS telephone_amount NUMERIC DEFAULT 0;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS khaja_enabled BOOLEAN DEFAULT FALSE;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS khaja_amount NUMERIC DEFAULT 0;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS electricity_meter_no TEXT;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS electricity_customer_no TEXT;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS electricity_unit_rate NUMERIC DEFAULT 10;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'branch_fixed_expense_configs'
          AND column_name = 'updated_at' AND data_type LIKE 'timestamp%'
    ) THEN
        ALTER TABLE public.branch_fixed_expense_configs ALTER COLUMN updated_at DROP DEFAULT;
        ALTER TABLE public.branch_fixed_expense_configs ALTER COLUMN updated_at TYPE BIGINT USING (EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT;
    END IF;
END $$;
ALTER TABLE public.branch_fixed_expense_configs ADD COLUMN IF NOT EXISTS updated_at BIGINT;

-- 3.3 SAVED MONTHLY OFFICE EXPENSE SHEETS
CREATE TABLE IF NOT EXISTS public.saved_office_expense_sheets (
    id TEXT PRIMARY KEY,
    fiscal_year TEXT NOT NULL,
    month TEXT NOT NULL,
    month_np TEXT,
    branch_id TEXT DEFAULT 'all',
    branch_name TEXT DEFAULT 'सम्पूर्ण शाखाहरू',
    total_expenses NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    net_paid_amount NUMERIC DEFAULT 0,
    records_count INT DEFAULT 0,
    prepared_by TEXT,
    prepared_by_name TEXT,
    approved_by TEXT,
    approved_by_name TEXT,
    status TEXT DEFAULT 'Approved',
    remarks TEXT,
    saved_at BIGINT,
    updated_at BIGINT
);

ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS fiscal_year TEXT;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS month TEXT;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS month_np TEXT;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'all';
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS branch_name TEXT DEFAULT 'सम्पूर्ण शाखाहरू';
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS total_expenses NUMERIC DEFAULT 0;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS tax_amount NUMERIC DEFAULT 0;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS net_paid_amount NUMERIC DEFAULT 0;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS records_count INT DEFAULT 0;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS prepared_by TEXT;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS prepared_by_name TEXT;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS approved_by_name TEXT;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Approved';
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS remarks TEXT;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'saved_office_expense_sheets'
          AND column_name = 'saved_at' AND data_type LIKE 'timestamp%'
    ) THEN
        ALTER TABLE public.saved_office_expense_sheets ALTER COLUMN saved_at DROP DEFAULT;
        ALTER TABLE public.saved_office_expense_sheets ALTER COLUMN saved_at TYPE BIGINT USING (EXTRACT(EPOCH FROM saved_at) * 1000)::BIGINT;
    END IF;
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'saved_office_expense_sheets'
          AND column_name = 'updated_at' AND data_type LIKE 'timestamp%'
    ) THEN
        ALTER TABLE public.saved_office_expense_sheets ALTER COLUMN updated_at DROP DEFAULT;
        ALTER TABLE public.saved_office_expense_sheets ALTER COLUMN updated_at TYPE BIGINT USING (EXTRACT(EPOCH FROM updated_at) * 1000)::BIGINT;
    END IF;
END $$;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS saved_at BIGINT;
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS updated_at BIGINT;


-- ############################################################################
-- SECTION 4: NOTICE BOARD, POPUPS & RESOURCE DOWNLOADS
-- ############################################################################

-- 4.1 NOTICES TABLE
CREATE TABLE IF NOT EXISTS public.notices (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    content TEXT,
    description TEXT,
    date TEXT,
    attachment_url TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    priority TEXT DEFAULT 'Normal',
    target_role TEXT DEFAULT 'All',
    target_branch TEXT DEFAULT 'All',
    type TEXT,
    status TEXT DEFAULT 'Active',
    published_date TEXT,
    created_at BIGINT,
    branch_id TEXT,
    created_by TEXT
);

ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS content TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS attachment_name TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS attachment_type TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS priority TEXT DEFAULT 'Normal';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS target_role TEXT DEFAULT 'All';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS target_branch TEXT DEFAULT 'All';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS published_date TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS created_at BIGINT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS created_by TEXT;

-- 4.2 DOWNLOADABLE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.downloadable_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    url TEXT,
    file_url TEXT,
    file_name TEXT,
    file_type TEXT,
    file_size TEXT,
    size TEXT,
    date TEXT,
    type TEXT,
    description TEXT,
    uploaded_at BIGINT,
    branch_id TEXT,
    uploaded_by TEXT
);

ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS category TEXT DEFAULT 'General';
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS file_size TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS uploaded_at BIGINT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS uploaded_by TEXT;


-- ############################################################################
-- SECTION 5: HR MANAGEMENT, PAYROLL, TAX, ATTENDANCE, GRIEVANCES & BOARD (BOD)
-- ############################################################################

-- 5.1 EMPLOYEES MASTER & FULL KYC TABLE
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    full_name_nepali TEXT,
    employee_code TEXT,
    mobile TEXT,
    email TEXT,
    department TEXT,
    department_nepali TEXT,
    branch_id TEXT,
    designation TEXT,
    designation_nepali TEXT,
    joined_date TEXT,
    basic_salary NUMERIC DEFAULT 0,
    da_type TEXT DEFAULT 'None',
    da_value NUMERIC DEFAULT 0,
    dearness_allowance NUMERIC DEFAULT 0,
    grade_rate NUMERIC DEFAULT 0,
    grade_rate_amount NUMERIC DEFAULT 0,
    has_ssf BOOLEAN DEFAULT false,
    ssf_contribution NUMERIC DEFAULT 0,
    has_pf BOOLEAN DEFAULT false,
    pf_contribution NUMERIC DEFAULT 0,
    has_gratuity BOOLEAN DEFAULT false,
    gratuity NUMERIC DEFAULT 0,
    has_dashain BOOLEAN DEFAULT false,
    dashain_bonus NUMERIC DEFAULT 0,
    has_medical BOOLEAN DEFAULT false,
    medical_allowance NUMERIC DEFAULT 0,
    has_bonus BOOLEAN DEFAULT false,
    pan_no TEXT,
    status TEXT DEFAULT 'Active',
    photo_url TEXT,
    gender TEXT,
    marital_status TEXT,
    months_active INT DEFAULT 12,
    festival_bonus NUMERIC DEFAULT 0,
    bonus_yearly NUMERIC DEFAULT 0,
    employment_type TEXT DEFAULT 'Permanent',
    life_insurance NUMERIC DEFAULT 0,
    has_life_insurance BOOLEAN DEFAULT false,
    health_insurance NUMERIC DEFAULT 0,
    has_health_insurance BOOLEAN DEFAULT false,
    building_insurance NUMERIC DEFAULT 0,
    building_allowance NUMERIC DEFAULT 0,
    has_building_allowance BOOLEAN DEFAULT false,
    medical_expenses_paid NUMERIC DEFAULT 0,
    remote_area_category TEXT DEFAULT 'None',
    remote_allowance NUMERIC DEFAULT 0,
    has_remote_allowance BOOLEAN DEFAULT false,
    is_incapacitated BOOLEAN DEFAULT false,
    dress_allowance NUMERIC DEFAULT 0,
    -- Full KYC, Family, Address, Bank, Education & Emergency
    citizenship_no TEXT,
    citizenship_district TEXT,
    citizenship_issue_date TEXT,
    citizenship_front_url TEXT,
    citizenship_back_url TEXT,
    father_name TEXT,
    father_name_nepali TEXT,
    mother_name TEXT,
    mother_name_nepali TEXT,
    grandfather_name TEXT,
    grandfather_name_nepali TEXT,
    spouse_name TEXT,
    spouse_name_nepali TEXT,
    previous_name TEXT,
    previous_name_nepali TEXT,
    dob_bs TEXT,
    nationality TEXT DEFAULT 'Nepali',
    permanent_address TEXT,
    permanent_address_nepali TEXT,
    temporary_address TEXT,
    temporary_address_nepali TEXT,
    bank_name TEXT,
    bank_account_no TEXT,
    account_holder_name TEXT,
    bank_branch TEXT,
    emergency_contact TEXT,
    emergency_relation TEXT,
    emergency_phone TEXT,
    emergency_address TEXT,
    blood_group TEXT,
    qualification TEXT,
    institution TEXT,
    passed_year TEXT,
    previous_employer TEXT,
    previous_designation TEXT,
    total_experience TEXT,
    exp_joining_date TEXT,
    exp_leaving_date TEXT,
    reporting_manager TEXT,
    work_location TEXT,
    docs_citizenship TEXT,
    docs_nid TEXT,
    docs_pan TEXT,
    docs_education TEXT,
    docs_experience TEXT,
    docs_contract TEXT,
    documents JSONB DEFAULT '[]'::jsonb,
    kyc_details JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS full_name_nepali TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_code TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department_nepali TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS designation_nepali TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joined_date TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS basic_salary NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS da_type TEXT DEFAULT 'None';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS da_value NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dearness_allowance NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS grade_rate NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS grade_rate_amount NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_ssf BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS ssf_contribution NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_pf BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pf_contribution NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_gratuity BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gratuity NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_dashain BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dashain_bonus NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_medical BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS medical_allowance NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_bonus BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pan_no TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS months_active INT DEFAULT 12;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS festival_bonus NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bonus_yearly NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Permanent';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS life_insurance NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_life_insurance BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS health_insurance NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_health_insurance BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS building_insurance NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS building_allowance NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_building_allowance BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS medical_expenses_paid NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS remote_area_category TEXT DEFAULT 'None';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS remote_allowance NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_remote_allowance BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS is_incapacitated BOOLEAN DEFAULT false;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dress_allowance NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS citizenship_no TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS citizenship_district TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS citizenship_issue_date TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS citizenship_front_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS citizenship_back_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS father_name_nepali TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mother_name_nepali TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS grandfather_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS grandfather_name_nepali TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS spouse_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS spouse_name_nepali TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS previous_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS previous_name_nepali TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dob_bs TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS nationality TEXT DEFAULT 'Nepali';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address_nepali TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS temporary_address TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS temporary_address_nepali TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS account_holder_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_relation TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_phone TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_address TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS blood_group TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS qualification TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS institution TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS passed_year TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS previous_employer TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS previous_designation TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS total_experience TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS exp_joining_date TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS exp_leaving_date TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS reporting_manager TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS work_location TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_citizenship TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_nid TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_pan TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_education TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_experience TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_contract TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS kyc_details JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5.2 EMPLOYEE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,
    title TEXT NOT NULL,
    file_name TEXT,
    file_url TEXT NOT NULL,
    file_size TEXT,
    mime_type TEXT,
    status TEXT DEFAULT 'Verified',
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

-- 5.3 LEAVE TYPES & LEAVE REQUESTS
CREATE TABLE IF NOT EXISTS public.leave_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_np TEXT,
    total_days INT DEFAULT 0,
    is_one_time BOOLEAN DEFAULT false,
    gender_specific TEXT,
    leave_type TEXT,
    reserve_leave TEXT,
    non_reserve_leave TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS name_np TEXT;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS total_days INT DEFAULT 0;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS is_one_time BOOLEAN DEFAULT false;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS gender_specific TEXT;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS leave_type TEXT;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS reserve_leave TEXT;
ALTER TABLE public.leave_types ADD COLUMN IF NOT EXISTS non_reserve_leave TEXT;

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT,
    leave_type_id TEXT,
    start_date TEXT,
    end_date TEXT,
    total_days INT DEFAULT 1,
    reason TEXT,
    status TEXT DEFAULT 'Pending',
    applied_date TEXT,
    approved_by TEXT,
    branch_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS leave_type_id TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS end_date TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS total_days INT DEFAULT 1;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS reason TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Pending';
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS applied_date TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.leave_requests ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- 5.4 PAYROLL RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    year TEXT NOT NULL,
    month TEXT NOT NULL,
    basic_salary NUMERIC DEFAULT 0,
    grade_amt NUMERIC DEFAULT 0,
    allowance NUMERIC DEFAULT 0,
    ssf_employee NUMERIC DEFAULT 0,
    pf_employee NUMERIC DEFAULT 0,
    gratuity NUMERIC DEFAULT 0,
    total_income NUMERIC DEFAULT 0,
    ssf_employer NUMERIC DEFAULT 0,
    pf_employer NUMERIC DEFAULT 0,
    tax NUMERIC DEFAULT 0,
    tax_deduction NUMERIC DEFAULT 0,
    net_salary NUMERIC DEFAULT 0,
    dashain_bonus NUMERIC DEFAULT 0,
    bonus_amount NUMERIC DEFAULT 0,
    sanchit_leave_amount NUMERIC DEFAULT 0,
    medical_allowance NUMERIC DEFAULT 0,
    dress_allowance NUMERIC DEFAULT 0,
    show_dashain BOOLEAN DEFAULT false,
    show_bonus BOOLEAN DEFAULT false,
    show_sanchit BOOLEAN DEFAULT false,
    show_medical BOOLEAN DEFAULT false,
    show_dress BOOLEAN DEFAULT false,
    generated_date BIGINT,
    status TEXT DEFAULT 'Paid',
    prepared_by TEXT,
    approved_by TEXT,
    branch_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS dashain_bonus NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS bonus_amount NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS sanchit_leave_amount NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS medical_allowance NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS dress_allowance NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS show_dashain BOOLEAN DEFAULT false;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS show_bonus BOOLEAN DEFAULT false;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS show_sanchit BOOLEAN DEFAULT false;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS show_medical BOOLEAN DEFAULT false;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS show_dress BOOLEAN DEFAULT false;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS tax NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS tax_deduction NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS prepared_by TEXT;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS branch_id TEXT;
DO $$
BEGIN
    IF EXISTS (
        SELECT 1 FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'payroll_records'
          AND column_name = 'generated_date' AND data_type LIKE 'timestamp%'
    ) THEN
        ALTER TABLE public.payroll_records ALTER COLUMN generated_date DROP DEFAULT;
        ALTER TABLE public.payroll_records ALTER COLUMN generated_date TYPE BIGINT USING (EXTRACT(EPOCH FROM generated_date) * 1000)::BIGINT;
    END IF;
END $$;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS generated_date BIGINT;

-- 5.5 ATTENDANCE RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL,
    employee_code TEXT,
    employee_name TEXT,
    date TEXT,
    branch_id TEXT,
    date_bs TEXT,
    date_ad DATE,
    in_time TIME,
    out_time TIME,
    work_hours NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Present',
    source TEXT DEFAULT 'biometric',
    remarks TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS employee_code TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS employee_name TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS date_bs TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS date_ad DATE;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS in_time TIME;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS out_time TIME;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS work_hours NUMERIC DEFAULT 0;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Present';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS source TEXT DEFAULT 'biometric';
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.attendance_records ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- 5.6 STAFF GRIEVANCES / COMPLAINTS TABLE
CREATE TABLE IF NOT EXISTS public.complaints (
    id TEXT PRIMARY KEY,
    employee_id TEXT,
    title TEXT,
    description TEXT,
    category TEXT,
    priority TEXT,
    status TEXT DEFAULT 'Pending',
    created_at BIGINT,
    branch_id TEXT,
    resolution_note TEXT
);

ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS resolution_note TEXT;
ALTER TABLE public.complaints ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- 5.7 INCOME TAX POLICY & ADJUSTMENTS TABLES
CREATE TABLE IF NOT EXISTS public.tax_policy (
    id TEXT PRIMARY KEY DEFAULT 'default',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.tax_adjustments (
    employee_id TEXT PRIMARY KEY,
    id TEXT,
    is_active BOOLEAN DEFAULT false,
    start_month TEXT DEFAULT 'पौष',
    adjustments_data JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.tax_adjustments ADD COLUMN IF NOT EXISTS id TEXT;
ALTER TABLE public.tax_adjustments ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT false;
ALTER TABLE public.tax_adjustments ADD COLUMN IF NOT EXISTS start_month TEXT DEFAULT 'पौष';
ALTER TABLE public.tax_adjustments ADD COLUMN IF NOT EXISTS adjustments_data JSONB;

-- 5.8 BOARD OF DIRECTORS & COMMITTEE GOVERNANCE TABLES
CREATE TABLE IF NOT EXISTS public.board_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_np TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.board_designations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_np TEXT,
    rank INT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.board_members (
    id TEXT PRIMARY KEY,
    registration_date_bs TEXT,
    member_id TEXT,
    account_number TEXT,
    full_name TEXT NOT NULL,
    full_name_np TEXT,
    member_code TEXT,
    category_id TEXT,
    category_name TEXT,
    designation TEXT NOT NULL,
    designation_np TEXT,
    gender TEXT,
    dob_bs TEXT,
    dob_ad DATE,
    blood_group TEXT,
    mobile TEXT,
    email TEXT,
    pan_no TEXT,
    citizenship_no TEXT,
    citizenship_issued_district TEXT,
    citizenship_issued_office TEXT,
    citizenship_issued_date_bs TEXT,
    permanent_province TEXT,
    permanent_district TEXT,
    permanent_municipality TEXT,
    permanent_ward TEXT,
    permanent_tole TEXT,
    permanent_house_no TEXT,
    temporary_province TEXT,
    temporary_district TEXT,
    temporary_municipality TEXT,
    temporary_ward TEXT,
    temporary_tole TEXT,
    is_same_address BOOLEAN DEFAULT true,
    father_name TEXT,
    mother_name TEXT,
    grandfather_name TEXT,
    spouse_name TEXT,
    family_type TEXT,
    occupation TEXT,
    bank_name TEXT,
    bank_branch TEXT,
    bank_account_no TEXT,
    bank_account_type TEXT,
    branch_id TEXT DEFAULT 'main',
    status TEXT DEFAULT 'Active',
    tenure JSONB DEFAULT '{}'::jsonb,
    allowance_config JSONB DEFAULT '{}'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    photo_url TEXT,
    profile_photo TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS citizenship_issued_office TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS permanent_house_no TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS temporary_province TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS temporary_district TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS temporary_municipality TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS temporary_ward TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS temporary_tole TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS is_same_address BOOLEAN DEFAULT true;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS grandfather_name TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS spouse_name TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS family_type TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS bank_account_type TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.board_members ADD COLUMN IF NOT EXISTS profile_photo TEXT;

CREATE TABLE IF NOT EXISTS public.board_allowance_sheets (
    id TEXT PRIMARY KEY,
    meeting_no TEXT,
    meeting_date_bs TEXT NOT NULL,
    meeting_date_ad DATE,
    meeting_title TEXT NOT NULL,
    category_id TEXT,
    branch_id TEXT DEFAULT 'main',
    allowances JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_allowance NUMERIC DEFAULT 0,
    tax_deducted NUMERIC DEFAULT 0,
    net_allowance NUMERIC DEFAULT 0,
    prepared_by TEXT,
    approved_by TEXT,
    status TEXT DEFAULT 'Paid',
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ############################################################################
-- SECTION 6: MICRO-FINANCE OPERATIONS & SAMUH MEETINGS
-- ############################################################################

-- 6.1 MICRO-FINANCE LOANS TABLE
CREATE TABLE IF NOT EXISTS public.mf_loans (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    account_no TEXT NOT NULL,
    name TEXT NOT NULL,
    center_name TEXT DEFAULT '',
    group_name TEXT DEFAULT '',
    loan_date TEXT DEFAULT '',
    loan_date_bs TEXT DEFAULT '',
    loan_amount NUMERIC DEFAULT 0,
    remaining_amount NUMERIC DEFAULT 0,
    installment_amount NUMERIC DEFAULT 0,
    total_installments INT DEFAULT 12,
    paid_installments INT DEFAULT 0,
    interest_rate NUMERIC DEFAULT 14,
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    loan_product TEXT DEFAULT '',
    maturity_date TEXT DEFAULT '',
    closed_date TEXT DEFAULT '',
    closed_date_bs TEXT DEFAULT '',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mf_loans ADD COLUMN IF NOT EXISTS closed_date TEXT DEFAULT '';
ALTER TABLE public.mf_loans ADD COLUMN IF NOT EXISTS closed_date_bs TEXT DEFAULT '';
ALTER TABLE public.mf_loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6.2 MICRO-FINANCE GROUP MEETINGS & MINUTES TABLE
CREATE TABLE IF NOT EXISTS public.group_meetings (
    id TEXT PRIMARY KEY,
    meeting_no TEXT,
    group_id TEXT,
    group_name TEXT,
    meeting_date_bs TEXT,
    status TEXT DEFAULT 'Draft',
    payload JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.group_meetings ADD COLUMN IF NOT EXISTS meeting_no TEXT;
ALTER TABLE public.group_meetings ADD COLUMN IF NOT EXISTS group_id TEXT;
ALTER TABLE public.group_meetings ADD COLUMN IF NOT EXISTS group_name TEXT;
ALTER TABLE public.group_meetings ADD COLUMN IF NOT EXISTS meeting_date_bs TEXT;
ALTER TABLE public.group_meetings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Draft';
ALTER TABLE public.group_meetings ADD COLUMN IF NOT EXISTS payload JSONB DEFAULT '{}'::jsonb;
ALTER TABLE public.group_meetings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();


-- ############################################################################
-- SECTION 7: HEADER SHORTCUTS, TOOLS, REMITTANCE VAULT, CHAT & FD CERTIFICATES
-- ############################################################################

-- 7.1 REMITTANCE PARTNERS & CREDENTIALS VAULT (SHORTCUT -> REMIT LOGIN)
CREATE TABLE IF NOT EXISTS public.remittance_companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    logo_url TEXT,
    code TEXT,
    display_order INT DEFAULT 1,
    has_pin BOOLEAN DEFAULT FALSE,
    access_id TEXT,
    username TEXT,
    password TEXT,
    txn_pin TEXT,
    contact_phone TEXT,
    contact_email TEXT,
    portal_url TEXT,
    status TEXT DEFAULT 'Active',
    branch_id TEXT DEFAULT 'main',
    notes TEXT,
    last_password_changed TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS logo_url TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 1;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS has_pin BOOLEAN DEFAULT FALSE;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS access_id TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS username TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS password TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS txn_pin TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS contact_phone TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS contact_email TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS portal_url TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'main';
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS last_password_changed TEXT;
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.remittance_companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 7.2 INTERNAL STAFF CHAT & MESSAGING MODULE (SHORTCUT -> MESSAGES)
CREATE TABLE IF NOT EXISTS public.chat_messages (
    id TEXT PRIMARY KEY,
    channel_id TEXT,
    recipient_id TEXT,
    recipient_name TEXT,
    sender_id TEXT NOT NULL,
    sender_name TEXT NOT NULL,
    sender_username TEXT,
    sender_designation TEXT,
    sender_branch_id TEXT,
    sender_branch_name TEXT,
    sender_photo TEXT,
    content TEXT NOT NULL DEFAULT '',
    attachments JSONB DEFAULT '[]'::jsonb,
    reactions JSONB DEFAULT '[]'::jsonb,
    reply_to JSONB,
    is_important BOOLEAN DEFAULT FALSE,
    read_by TEXT[] DEFAULT '{}',
    created_at BIGINT NOT NULL,
    updated_at BIGINT,
    inserted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS channel_id TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS recipient_id TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS recipient_name TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_username TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_designation TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_branch_id TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_branch_name TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS sender_photo TEXT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS attachments JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reactions JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS reply_to JSONB;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS is_important BOOLEAN DEFAULT FALSE;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS read_by TEXT[] DEFAULT '{}';
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS updated_at BIGINT;
ALTER TABLE public.chat_messages ADD COLUMN IF NOT EXISTS inserted_at TIMESTAMPTZ DEFAULT NOW();

-- 7.3 FIXED DEPOSIT (FD) CERTIFICATE RECORDS (SHORTCUT -> FD CERTIFICATE)
CREATE TABLE IF NOT EXISTS public.fd_records (
    id TEXT PRIMARY KEY,
    account_type TEXT,
    holder_name TEXT,
    holder_name_np TEXT,
    account_no TEXT,
    selected_branch TEXT,
    signatory_name TEXT,
    issue_date TEXT,
    maturity_date TEXT,
    duration TEXT,
    interest_rate TEXT,
    compounding TEXT DEFAULT 'Quarterly',
    tax TEXT DEFAULT '5',
    amount TEXT DEFAULT '0',
    amount_in_words TEXT,
    total_interest TEXT DEFAULT '0',
    tax_deduction TEXT DEFAULT '0',
    maturity_amount TEXT DEFAULT '0',
    maturity_in_words TEXT,
    member_name TEXT,
    duration_months INT,
    start_date TEXT,
    branch_id TEXT,
    status TEXT DEFAULT 'Active',
    created_at TEXT
);

ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS holder_name TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS holder_name_np TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS account_no TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS selected_branch TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS signatory_name TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS issue_date TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS maturity_date TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS interest_rate TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS compounding TEXT DEFAULT 'Quarterly';
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS tax TEXT DEFAULT '5';
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS amount TEXT DEFAULT '0';
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS amount_in_words TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS total_interest TEXT DEFAULT '0';
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS tax_deduction TEXT DEFAULT '0';
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS maturity_amount TEXT DEFAULT '0';
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS maturity_in_words TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS member_name TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS duration_months INT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS start_date TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS created_at TEXT;


-- ############################################################################
-- SECTION 8: PERFORMANCE INDEXES ACROSS ALL MODULES
-- ############################################################################

CREATE INDEX IF NOT EXISTS idx_users_username ON public.users(username);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON public.users(branch_id);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_branch_id ON public.ledger_accounts(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_data_date ON public.daily_data(date);
CREATE INDEX IF NOT EXISTS idx_daily_data_branch_id ON public.daily_data(branch_id);
CREATE INDEX IF NOT EXISTS idx_ft_ledger_date_branch ON public.front_teller_ledger_entries(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_ft_counter_date_branch ON public.front_teller_counter_entries(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_ft_remit_date_branch ON public.front_teller_remittance_entries(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_ft_deno_date_branch ON public.front_teller_deno_adjustments(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_ft_vault_date_branch ON public.front_teller_vault_entries(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_bo_entries_date_branch ON public.back_office_entries(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_other_adj_branch_date ON public.teller_other_adjustments(branch_id, date_bs);
CREATE INDEX IF NOT EXISTS idx_office_expenses_branch ON public.office_expenses(branch_id, fiscal_year, month);
CREATE INDEX IF NOT EXISTS idx_saved_sheets_fy_mo ON public.saved_office_expense_sheets(fiscal_year, month);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON public.audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_logs_branch ON public.audit_logs(branch_id);
CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON public.employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_emp_docs_emp_id ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_docs_type ON public.employee_documents(document_type);
CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance_records(employee_id, date_bs);
CREATE INDEX IF NOT EXISTS idx_attendance_branch ON public.attendance_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_payroll_emp_period ON public.payroll_records(employee_id, year, month);
CREATE INDEX IF NOT EXISTS idx_payroll_branch ON public.payroll_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_holidays_date_bs ON public.holidays(date_bs);
CREATE INDEX IF NOT EXISTS idx_holidays_branch ON public.holidays(branch_id);
CREATE INDEX IF NOT EXISTS idx_branch_op_logs ON public.branch_operational_logs(branch_id, date_bs);
CREATE INDEX IF NOT EXISTS idx_board_members_category ON public.board_members(category_id);
CREATE INDEX IF NOT EXISTS idx_board_members_branch ON public.board_members(branch_id);
CREATE INDEX IF NOT EXISTS idx_board_allowance_date ON public.board_allowance_sheets(meeting_date_bs);
CREATE INDEX IF NOT EXISTS idx_mf_loans_status ON public.mf_loans(status);
CREATE INDEX IF NOT EXISTS idx_mf_loans_closed_date_bs ON public.mf_loans(closed_date_bs);
CREATE INDEX IF NOT EXISTS idx_mf_loans_loan_date_bs ON public.mf_loans(loan_date_bs);
CREATE INDEX IF NOT EXISTS idx_mf_loans_center_group ON public.mf_loans(center_name, group_name);
CREATE INDEX IF NOT EXISTS idx_group_meetings_date ON public.group_meetings(meeting_date_bs);
CREATE INDEX IF NOT EXISTS idx_saving_products_status ON public.saving_products(status);
CREATE INDEX IF NOT EXISTS idx_loan_products_status ON public.loan_products(status);
CREATE INDEX IF NOT EXISTS idx_remittance_branch_order ON public.remittance_companies(branch_id, display_order);
CREATE INDEX IF NOT EXISTS idx_remittance_name ON public.remittance_companies(name);
CREATE INDEX IF NOT EXISTS idx_chat_channel_created ON public.chat_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_recipient_created ON public.chat_messages(recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sender_created ON public.chat_messages(sender_id, created_at);
CREATE INDEX IF NOT EXISTS idx_fd_records_branch ON public.fd_records(selected_branch);


-- ############################################################################
-- SECTION 9: DISABLE RLS & GRANT FULL SUPABASE CLIENT PERMISSIONS (ALL 44 TABLES)
-- ############################################################################

ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.saving_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_operational_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_operational_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_cash_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.front_teller_ledger_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.front_teller_counter_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.front_teller_remittance_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittance_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.front_teller_deno_adjustments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.front_teller_vault_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.back_office_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.teller_other_adjustments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.office_expenses DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_fixed_expense_configs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.saved_office_expense_sheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloadable_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_policy DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_adjustments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_designations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_allowance_sheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.remittance_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.chat_messages DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fd_records DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;


-- ############################################################################
-- SECTION 10: SEED DEFAULT DATA (BRANCHES, ROLES & ALL 56 SUB-MENU PERMISSIONS,
--             ADMIN USER, SETTINGS, PRODUCTS, HOLIDAYS, LEAVES, TAX, BOARD, REMIT)
-- ############################################################################

-- 10.1 Default Branches (Bilingual EN + NP)
INSERT INTO public.branches (id, name, name_np, code, code_np, location, location_np, branch_type, branch_type_np, status, created_at) VALUES
('main', 'Ratauli Head Office', 'रतौली मुख्य कार्यालय', 'C01', 'सि०१', 'Ratauli', 'रतौली', 'Head Office', 'मुख्य कार्यालय', 'Active', 1700000000000),
('sahodba', 'Sahodba Branch', 'सहोडवा शाखा', 'C02', 'सि०२', 'Sahodba', 'सहोडवा', 'Branch Office', 'शाखा कार्यालय', 'Active', 1700000000001),
('pipra', 'Pipra Branch', 'पिपरा शाखा', 'C03', 'सि०३', 'Pipra', 'पिपरा', 'Branch Office', 'शाखा कार्यालय', 'Active', 1700000000002),
('parsa', 'Parsa Branch', 'पर्सा शाखा', 'C04', 'सि०४', 'Parsa', 'पर्सा', 'Branch Office', 'शाखा कार्यालय', 'Active', 1700000000003)
ON CONFLICT (id) DO NOTHING;

-- 10.2 Default Roles with ALL 28 Coarse + ALL 168 Granular Sub-Menu Permissions (16 Menu Groups / 56 Sub-Menus x View/Edit/Delete)
INSERT INTO public.roles (id, name, permissions) VALUES
('1', 'Super Admin', '[
    "view_transaction", "add_transaction", "edit_transaction", "delete_transaction",
    "view_reports", "view_ledger_names", "view_income_expense", "view_office_expenses",
    "view_daily_ledger", "view_capital_entry", "view_cash_entry", "manage_users",
    "manage_settings", "view_consolidated_report", "cross_branch_operation", "manage_hr",
    "manage_notices", "manage_branches", "manage_attendance", "manage_leaves",
    "manage_payroll", "manage_backup", "system_reset", "view_insurance",
    "view_microfinance", "view_depreciation", "view_alerts", "view_shortcuts",
    "sub_dash_overview_view", "sub_dash_overview_edit", "sub_dash_overview_delete",
    "sub_dash_charts_view", "sub_dash_charts_edit", "sub_dash_charts_delete",
    "sub_teller_savings_view", "sub_teller_savings_edit", "sub_teller_savings_delete",
    "sub_teller_withdrawal_view", "sub_teller_withdrawal_edit", "sub_teller_withdrawal_delete",
    "sub_teller_remittance_view", "sub_teller_remittance_edit", "sub_teller_remittance_delete",
    "sub_teller_share_capital_view", "sub_teller_share_capital_edit", "sub_teller_share_capital_delete",
    "sub_vault_monitoring_view", "sub_vault_monitoring_edit", "sub_vault_monitoring_delete",
    "sub_vault_reconciliation_view", "sub_vault_reconciliation_edit", "sub_vault_reconciliation_delete",
    "sub_vault_transfers_view", "sub_vault_transfers_edit", "sub_vault_transfers_delete",
    "sub_daily_books_view", "sub_daily_books_edit", "sub_daily_books_delete",
    "sub_member_passbooks_view", "sub_member_passbooks_edit", "sub_member_passbooks_delete",
    "sub_daily_balancing_view", "sub_daily_balancing_edit", "sub_daily_balancing_delete",
    "sub_trial_balance_view", "sub_trial_balance_edit", "sub_trial_balance_delete",
    "sub_audit_summary_view", "sub_audit_summary_edit", "sub_audit_summary_delete",
    "sub_office_expenses_view", "sub_office_expenses_edit", "sub_office_expenses_delete",
    "sub_misc_income_view", "sub_misc_income_edit", "sub_misc_income_delete",
    "sub_office_exp_registry_view", "sub_office_exp_registry_edit", "sub_office_exp_registry_delete",
    "sub_office_exp_fixed_view", "sub_office_exp_fixed_edit", "sub_office_exp_fixed_delete",
    "sub_member_accounts_view", "sub_member_accounts_edit", "sub_member_accounts_delete",
    "sub_loan_accounts_view", "sub_loan_accounts_edit", "sub_loan_accounts_delete",
    "sub_vendor_accounts_view", "sub_vendor_accounts_edit", "sub_vendor_accounts_delete",
    "sub_internal_notices_view", "sub_internal_notices_edit", "sub_internal_notices_delete",
    "sub_resource_downloads_view", "sub_resource_downloads_edit", "sub_resource_downloads_delete",
    "sub_popup_notices_view", "sub_popup_notices_edit", "sub_popup_notices_delete",
    "sub_hr_dashboard_view", "sub_hr_dashboard_edit", "sub_hr_dashboard_delete",
    "sub_hr_employees_view", "sub_hr_employees_edit", "sub_hr_employees_delete",
    "sub_hr_attendance_view", "sub_hr_attendance_edit", "sub_hr_attendance_delete",
    "sub_hr_leaves_view", "sub_hr_leaves_edit", "sub_hr_leaves_delete",
    "sub_hr_payroll_view", "sub_hr_payroll_edit", "sub_hr_payroll_delete",
    "sub_hr_documents_view", "sub_hr_documents_edit", "sub_hr_documents_delete",
    "sub_hr_grievances_view", "sub_hr_grievances_edit", "sub_hr_grievances_delete",
    "sub_hr_board_view", "sub_hr_board_edit", "sub_hr_board_delete",
    "sub_ins_dashboard_view", "sub_ins_dashboard_edit", "sub_ins_dashboard_delete",
    "sub_ins_upload_view", "sub_ins_upload_edit", "sub_ins_upload_delete",
    "sub_ins_report_view", "sub_ins_report_edit", "sub_ins_report_delete",
    "sub_ins_alerts_view", "sub_ins_alerts_edit", "sub_ins_alerts_delete",
    "sub_mf_dashboard_view", "sub_mf_dashboard_edit", "sub_mf_dashboard_delete",
    "sub_mf_centers_view", "sub_mf_centers_edit", "sub_mf_centers_delete",
    "sub_mf_groups_view", "sub_mf_groups_edit", "sub_mf_groups_delete",
    "sub_mf_members_view", "sub_mf_members_edit", "sub_mf_members_delete",
    "sub_mf_saving_view", "sub_mf_saving_edit", "sub_mf_saving_delete",
    "sub_mf_loan_view", "sub_mf_loan_edit", "sub_mf_loan_delete",
    "sub_mf_reports_view", "sub_mf_reports_edit", "sub_mf_reports_delete",
    "sub_dep_dashboard_view", "sub_dep_dashboard_edit", "sub_dep_dashboard_delete",
    "sub_dep_assets_view", "sub_dep_assets_edit", "sub_dep_assets_delete",
    "sub_dep_calculate_view", "sub_dep_calculate_edit", "sub_dep_calculate_delete",
    "sub_dep_accounting_view", "sub_dep_accounting_edit", "sub_dep_accounting_delete",
    "sub_dep_reports_view", "sub_dep_reports_edit", "sub_dep_reports_delete",
    "sub_dep_settings_view", "sub_dep_settings_edit", "sub_dep_settings_delete",
    "sub_alert_bima_maturity_view", "sub_alert_bima_maturity_edit", "sub_alert_bima_maturity_delete",
    "sub_alert_loan_maturity_view", "sub_alert_loan_maturity_edit", "sub_alert_loan_maturity_delete",
    "sub_alert_notice_view", "sub_alert_notice_edit", "sub_alert_notice_delete",
    "sub_tool_remit_view", "sub_tool_remit_edit", "sub_tool_remit_delete",
    "sub_tool_messages_view", "sub_tool_messages_edit", "sub_tool_messages_delete",
    "sub_tool_calculator_view", "sub_tool_calculator_edit", "sub_tool_calculator_delete",
    "sub_tool_fd_cert_view", "sub_tool_fd_cert_edit", "sub_tool_fd_cert_delete",
    "sub_tool_emi_view", "sub_tool_emi_edit", "sub_tool_emi_delete",
    "sub_tool_date_converter_view", "sub_tool_date_converter_edit", "sub_tool_date_converter_delete",
    "sub_admin_branches_view", "sub_admin_branches_edit", "sub_admin_branches_delete",
    "sub_admin_products_view", "sub_admin_products_edit", "sub_admin_products_delete",
    "sub_admin_holiday_view", "sub_admin_holiday_edit", "sub_admin_holiday_delete",
    "sub_admin_users_view", "sub_admin_users_edit", "sub_admin_users_delete",
    "sub_admin_roles_view", "sub_admin_roles_edit", "sub_admin_roles_delete",
    "sub_admin_intelligence_view", "sub_admin_intelligence_edit", "sub_admin_intelligence_delete",
    "sub_admin_settings_view", "sub_admin_settings_edit", "sub_admin_settings_delete",
    "sub_admin_backup_view", "sub_admin_backup_edit", "sub_admin_backup_delete",
    "sub_admin_reset_view", "sub_admin_reset_edit", "sub_admin_reset_delete",
    "sub_admin_logs_view", "sub_admin_logs_edit", "sub_admin_logs_delete"
]'::jsonb),
('2', 'Manager', '[
    "view_transaction", "add_transaction", "edit_transaction", "view_reports",
    "view_cash_entry", "view_daily_ledger", "view_ledger_names", "view_income_expense",
    "view_office_expenses", "manage_hr", "manage_notices", "view_insurance",
    "view_microfinance", "view_depreciation", "view_alerts", "view_shortcuts",
    "sub_dash_overview_view", "sub_dash_charts_view",
    "sub_teller_savings_view", "sub_teller_withdrawal_view", "sub_teller_remittance_view", "sub_teller_share_capital_view",
    "sub_vault_monitoring_view", "sub_vault_reconciliation_view", "sub_vault_transfers_view",
    "sub_daily_books_view", "sub_member_passbooks_view",
    "sub_daily_balancing_view", "sub_trial_balance_view", "sub_audit_summary_view",
    "sub_office_expenses_view", "sub_misc_income_view",
    "sub_office_exp_registry_view", "sub_office_exp_fixed_view",
    "sub_member_accounts_view", "sub_loan_accounts_view", "sub_vendor_accounts_view",
    "sub_internal_notices_view", "sub_resource_downloads_view", "sub_popup_notices_view",
    "sub_hr_dashboard_view", "sub_hr_employees_view", "sub_hr_attendance_view", "sub_hr_leaves_view",
    "sub_hr_payroll_view", "sub_hr_documents_view", "sub_hr_grievances_view", "sub_hr_board_view",
    "sub_ins_dashboard_view", "sub_ins_upload_view", "sub_ins_report_view", "sub_ins_alerts_view",
    "sub_mf_dashboard_view", "sub_mf_centers_view", "sub_mf_groups_view", "sub_mf_members_view",
    "sub_mf_saving_view", "sub_mf_loan_view", "sub_mf_reports_view",
    "sub_dep_dashboard_view", "sub_dep_assets_view", "sub_dep_calculate_view", "sub_dep_accounting_view",
    "sub_dep_reports_view", "sub_dep_settings_view",
    "sub_alert_bima_maturity_view", "sub_alert_loan_maturity_view", "sub_alert_notice_view",
    "sub_tool_remit_view", "sub_tool_messages_view", "sub_tool_calculator_view",
    "sub_tool_fd_cert_view", "sub_tool_emi_view", "sub_tool_date_converter_view"
]'::jsonb),
('3', 'Branch Operator', '[
    "view_transaction", "add_transaction", "view_cash_entry", "view_daily_ledger",
    "view_income_expense", "view_office_expenses", "view_alerts", "view_shortcuts",
    "sub_dash_overview_view",
    "sub_teller_savings_view", "sub_teller_savings_edit",
    "sub_teller_withdrawal_view", "sub_teller_withdrawal_edit",
    "sub_teller_remittance_view", "sub_teller_remittance_edit",
    "sub_teller_share_capital_view", "sub_teller_share_capital_edit",
    "sub_vault_monitoring_view", "sub_vault_reconciliation_view",
    "sub_daily_books_view", "sub_member_passbooks_view",
    "sub_office_expenses_view", "sub_misc_income_view",
    "sub_office_exp_registry_view",
    "sub_alert_bima_maturity_view", "sub_alert_loan_maturity_view", "sub_alert_notice_view",
    "sub_tool_remit_view", "sub_tool_messages_view", "sub_tool_calculator_view",
    "sub_tool_fd_cert_view", "sub_tool_emi_view", "sub_tool_date_converter_view"
]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 10.3 Default Admin User
INSERT INTO public.users (id, username, password, full_name, role_id, branch_id, status) VALUES
('usr_admin', 'admin', '123', 'System Administrator', '1', 'main', 'Active')
ON CONFLICT (id) DO NOTHING;

-- 10.4 Global Settings & Official Logo Fix
UPDATE public.settings
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{logoUrl}', '"/system_logo.png"')
WHERE id = 'global'
  AND (data->>'logoUrl' LIKE '%picsum.photos%' OR data->>'logoUrl' IS NULL OR data->>'logoUrl' = '');

INSERT INTO public.settings (id, data, updated_at) VALUES
(
    'global',
    '{
        "systemName": "RATAULI SAVING AND CREDIT COOPERATIVE LTD",
        "currency": "NPR",
        "remittanceCompanies": ["City Express", "Esewa", "Himal", "IME", "Muktinath", "Prabhu", "Surya", "Western Union"],
        "officeHeads": ["Salary", "Rent", "Electricity", "Water", "Stationery", "Marketing", "Maintenance", "Interest Paid", "Interest Received", "Commission"],
        "approvalLimit": 50000,
        "enableApprovals": true,
        "logoUrl": "/system_logo.png"
    }'::jsonb,
    NOW()
),
('saccos_weekend_days', '[6]'::jsonb, NOW())
ON CONFLICT (id) DO NOTHING;

-- 10.5 Default Saving & Loan Products
INSERT INTO public.saving_products (id, name, name_np, interest_rate, capitalization, minimum_balance, description, status, show_in_mf_fd) VALUES
('sp-1', 'General Saving', 'साधारण बचत', 6.0, 'Quarterly', 500, 'Standard general savings product with quarterly interest capitalization for all members.', 'Active', true),
('sp-2', 'Regular Saving', 'नियमित बचत', 5.0, 'Quarterly', 1000, 'Regular voluntary savings account designed for steady capital accumulation.', 'Active', true),
('sp-3', 'Daily Saving', 'दैनिक बचत', 5.5, 'Monthly', 100, 'Door-to-door daily collection savings with monthly interest payout.', 'Active', false),
('sp-4', 'Child Welfare Saving', 'बाल कल्याण बचत', 7.0, 'Quarterly', 500, 'High-yield savings scheme specifically for children’s education and future.', 'Active', false),
('sp-5', 'Senior Citizen Saving', 'जेष्ठ नागरिक बचत', 7.5, 'Monthly', 500, 'Priority welfare savings account for senior members with monthly interest.', 'Active', false)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.loan_products (id, name, name_np, interest_rate, installment, max_tenure_months, description, status, show_in_mf_fd) VALUES
('lp-1', 'General Loan', 'साधारण ऋण', 13.0, 'Monthly', 36, 'Standard collateralized personal and household general credit facility.', 'Active', true),
('lp-2', 'Agricultural Loan', 'कृषि ऋण', 13.0, 'Monthly', 24, 'Specialized agro-financing for crops, seeds, irrigation, fertilizer and livestock farming.', 'Active', false),
('lp-3', 'Business & Commercial Loan', 'व्यापार तथा व्यावसायिक ऋण', 14.0, 'Monthly', 60, 'Term credit and working capital financing for retail, wholesale, and enterprises.', 'Active', false),
('lp-4', 'Micro-Finance / Group Loan', 'लघुवित्त / समूह ऋण', 15.0, 'Monthly', 12, 'Group-guaranteed collateral-free loans for grassroots micro-finance entrepreneurs.', 'Active', false),
('lp-5', 'Emergency / Education Loan', 'आकस्मिक / शैक्षिक ऋण', 12.0, 'Monthly', 24, 'Rapid disbursement credit support for medical emergencies or academic tuition fees.', 'Active', false)
ON CONFLICT (id) DO NOTHING;

-- 10.6 Default Branch Operational Statuses & Nepali Calendar Holidays
INSERT INTO public.branch_operational_status (branch_id, status, date_bs, notes, updated_at) VALUES
('main', 'OPEN', '2083-01-01', 'Ratauli Head Office operational', NOW()),
('sahodba', 'OPEN', '2083-01-01', 'Sahodba Branch operational', NOW()),
('pipra', 'OPEN', '2083-01-01', 'Pipra Branch operational', NOW()),
('parsa', 'OPEN', '2083-01-01', 'Parsa Branch operational', NOW())
ON CONFLICT (branch_id) DO NOTHING;

INSERT INTO public.holidays (id, title, date_bs, type, branch_id, description) VALUES
('hol-1', 'Nepali New Year (Baishakh 1)', '2083-01-01', 'Public Holiday', 'all', 'National New Year'),
('hol-2', 'Buddha Jayanti', '2083-01-28', 'Public Holiday', 'all', 'Lord Buddha Birth Anniversary'),
('hol-3', 'Constitution Day', '2083-06-03', 'Public Holiday', 'all', 'National Constitution Day'),
('hol-4', 'Dashain Festival (Ghatasthapana)', '2083-06-25', 'Festival', 'all', 'Commencement of Dashain'),
('hol-5', 'Dashain (Phulpati to Vijaya Dashami)', '2083-07-01', 'Festival', 'all', 'Dashain Festival Holidays'),
('hol-6', 'Deepawali / Tihar (Laxmi Puja)', '2083-07-19', 'Festival', 'all', 'Festival of Lights'),
('hol-7', 'Bhai Tika', '2083-07-22', 'Festival', 'all', 'Tihar Brother Sister Day'),
('hol-8', 'Chhath Puja', '2083-07-28', 'Festival', 'all', 'Major Sun Festival'),
('hol-9', 'Maghe Sankranti', '2083-10-01', 'Public Holiday', 'all', 'Makar Sankranti'),
('hol-10', 'Maha Shivaratri', '2083-11-27', 'Festival', 'all', 'Lord Shiva Festival'),
('hol-11', 'Holi (Fagu Purnima)', '2083-12-14', 'Festival', 'all', 'Festival of Colors')
ON CONFLICT (id) DO NOTHING;

-- 10.7 Default Leave Types & Tax Policy
INSERT INTO public.leave_types (id, name, name_np, total_days, is_one_time, gender_specific) VALUES
('lt1', 'Annual Leave', 'घर बिदा', 30, false, NULL),
('lt2', 'Sick Leave', 'बिरामी बिदा', 12, false, NULL),
('lt3', 'Emergency Leave', 'भैपरी बिदा', 3, false, NULL),
('lt4', 'Bereavement Leave', 'क्रिया बिदा', 13, true, NULL),
('lt5', 'Maternity Leave', 'सुत्केरी बिदा', 98, false, 'Female'),
('lt6', 'Paternity / Care Leave', 'सुत्केरी स्याहार बिदा', 15, false, 'Male')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.tax_policy (id, config) VALUES
('default', '{
    "singleSlabs": [
        {"label": "FIRST 500,000", "limit": 500000, "rate": 1},
        {"label": "NEXT 200,000", "limit": 200000, "rate": 10},
        {"label": "NEXT 300,000", "limit": 300000, "rate": 20},
        {"label": "NEXT 1,000,000", "limit": 1000000, "rate": 30},
        {"label": "ABOVE 2,000,000", "limit": 300000000, "rate": 36}
    ],
    "marriedSlabs": [
        {"label": "FIRST 600,000", "limit": 600000, "rate": 1},
        {"label": "NEXT 200,000", "limit": 200000, "rate": 10},
        {"label": "NEXT 300,000", "limit": 300000, "rate": 20},
        {"label": "NEXT 900,000", "limit": 900000, "rate": 30},
        {"label": "ABOVE 2,000,000", "limit": 300000000, "rate": 36}
    ],
    "retirementCap": 500000
}'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- 10.8 Default Board Categories & Designations
INSERT INTO public.board_categories (id, name, name_np, description, sort_order) VALUES
('cat_bod', 'Board of Directors', 'सञ्चालक समिति', 'Executive governance and policy-making board', 1),
('cat_audit', 'Audit Committee', 'लेखा सुपरीवेक्षण समिति', 'Financial audit, compliance and supervisory board', 2),
('cat_advisory', 'Advisory Committee', 'सल्लाहकार समिति', 'Senior advisory and strategic guidance committee', 3),
('cat_sub_loan', 'Loan Sub-Committee', 'ऋण उपसमिति', 'Credit assessment and loan recommendation committee', 4),
('cat_sub_education', 'Education & Training Sub-Committee', 'शिक्षा तथा तालिम उपसमिति', 'Member education and staff capacity development committee', 5)
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.board_designations (id, name, name_np, rank, description) VALUES
('des_chair', 'Chairperson', 'अध्यक्ष', 1, 'Chief Executive & Board Leader'),
('des_vchair', 'Vice Chairperson', 'उपाध्यक्ष', 2, 'Deputy Board Leader'),
('des_sec', 'General Secretary', 'सचिव', 3, 'Board Executive Secretary'),
('des_treas', 'Treasurer', 'कोषाध्यक्ष', 4, 'Financial Custodian & Treasurer'),
('des_member', 'Director / Member', 'सदस्य', 5, 'Elected Board Director'),
('des_coord', 'Coordinator', 'संयोजक', 6, 'Sub-Committee Coordinator')
ON CONFLICT (id) DO NOTHING;

-- 10.9 Default Remittance Partners (All & Branch Templates)
INSERT INTO public.remittance_companies (id, name, code, display_order, has_pin, txn_pin, access_id, username, password, contact_phone, contact_email, portal_url, branch_id, status, last_password_changed) VALUES
('remit_city', 'City Express Money Transfer', 'CTX-109', 1, true, '8832', 'CTX-ACC-552', 'ratauli_cityexpress', 'CityExp#2026Vault', '01-4431900', 'info@ctxpress.com', 'https://online.ctxpress.com', 'all', 'Active', '2026-07-20'),
('remit_esewa', 'Esewa Money Transfer', 'EMT-881', 2, true, '9045', 'EMT-ACC-410', 'ratauli_esewa_remit', 'EsewaRemit!2026', '1660-01-02121', 'care@esewamoneytransfer.com', 'https://esewamoneytransfer.com', 'all', 'Active', '2026-09-10'),
('remit_himal', 'Himal Remit (HBL)', 'HML-330', 3, true, '7721', 'HML-BRANCH-12', 'ratauli_himal', 'Himal@Remit2026', '01-4227749', 'himalremit@hbl.com.np', 'https://himalremit.hbl.com.np', 'all', 'Active', '2026-08-28'),
('remit_ime', 'IME Remit (IME Pay)', 'IME-702', 4, true, '1190', 'IME-RAT-884', 'ratauli_ime', 'ImePay@Secure26', '01-4430600', 'support@imeremit.com.np', 'https://imeremit.com.np', 'all', 'Active', '2026-08-15'),
('remit_muktinath', 'Muktinath Remit', 'MNR-204', 5, true, '3310', 'MNB-REMIT-055', 'ratauli_muktinath', 'Muktinath#Vault26', '01-4437368', 'remit@muktinathbank.com.np', 'https://remit.muktinathbank.com.np', 'all', 'Active', '2026-08-10'),
('remit_prabhu', 'Prabhu Remit', 'PRB-01', 6, true, '4021', 'PRABHU-HO-101', 'ratauli_prabhu', 'Prabhu@User2026', '01-4788500', 'remit@prabhubank.com', 'https://remit.prabhubank.com', 'all', 'Active', '2026-08-01'),
('remit_surya', 'Surya Remit', 'SRY-99', 7, false, NULL, 'SRY-RAT-201', 'ratauli_surya', 'Surya#Remit2026', '01-4221122', 'support@suryaremit.com', NULL, 'all', 'Active', '2026-07-15'),
('remit_western_union', 'Western Union', 'WU-NP-04', 8, true, '5612', 'WU-TERM-901', 'ratauli_wu_agent', 'WU#SecureGlobal26', '1660-01-44444', 'nepalcare@westernunion.com', 'https://wupos.westernunion.com', 'all', 'Active', '2026-09-01')
ON CONFLICT (id) DO NOTHING;

-- ============================================================================
-- END OF COMPLETE MASTER SCHEMA SCRIPT
-- ============================================================================
