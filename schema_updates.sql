-- ============================================================================
-- RATAULI SAVING AND CREDIT COOPERATIVE LTD - COMPLETE MIGRATION SCRIPT
-- Compatible with: PostgreSQL & Supabase SQL Editor
-- Safely handles existing tables and adds missing columns automatically.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. FRONT TELLER - OTHER ADJUSTMENTS (अन्य समायोजन ब्रेकडाउन)
-- ----------------------------------------------------------------------------
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

-- Ensure all columns exist on teller_other_adjustments
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

CREATE INDEX IF NOT EXISTS idx_other_adj_branch_date ON public.teller_other_adjustments(branch_id, date_bs);
ALTER TABLE public.teller_other_adjustments DISABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 2. OFFICE EXPENSES TABLE & COLUMN MIGRATIONS (कार्यालय खर्च व्यवस्थापन)
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.office_expenses (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    category TEXT NOT NULL,
    category_label TEXT,
    date_bs TEXT,
    month TEXT,
    fiscal_year TEXT,
    amount NUMERIC DEFAULT 0,
    tax_deduction NUMERIC DEFAULT 0,
    net_paid_amount NUMERIC DEFAULT 0,
    meter_no TEXT,
    consumer_no TEXT,
    previous_unit NUMERIC DEFAULT 0,
    current_unit NUMERIC DEFAULT 0,
    consumed_units NUMERIC DEFAULT 0,
    rate_per_unit NUMERIC DEFAULT 0,
    min_demand_charge NUMERIC DEFAULT 0,
    rebate_penalty NUMERIC DEFAULT 0,
    landlord_name TEXT,
    pan_vat_no TEXT,
    rent_period_from TEXT,
    rent_period_to TEXT,
    cleaner_name TEXT,
    working_days INT,
    attendees_count INT,
    items_description TEXT,
    paid_to TEXT,
    payment_method TEXT DEFAULT 'Cash',
    account_no TEXT,
    bank_name TEXT,
    voucher_no TEXT,
    bill_no TEXT,
    recorded_by TEXT,
    approved_by TEXT,
    remarks TEXT,
    attachment_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Migrations for existing office_expenses table:
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS category_label TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS date_bs TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS month TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS fiscal_year TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS tax_deduction NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS net_paid_amount NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS meter_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS consumer_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS previous_unit NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS current_unit NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS previous NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS current NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS consumed_units NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS rate_per_unit NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS min_demand_charge NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS rebate_penalty NUMERIC DEFAULT 0;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS landlord_name TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS pan_vat_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS rent_period_from TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS rent_period_to TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS cleaner_name TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS working_days INT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS attendees_count INT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS items_description TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS paid_to TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS payment_method TEXT DEFAULT 'Cash';
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS account_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS voucher_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS bill_no TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS recorded_by TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS attachment_url TEXT;
ALTER TABLE public.office_expenses ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_office_expenses_branch ON public.office_expenses(branch_id, fiscal_year, month);
ALTER TABLE public.office_expenses DISABLE ROW LEVEL SECURITY;

-- 2.2 Saved Monthly Office Expense Sheets (मासिक खर्च सिट)
CREATE TABLE IF NOT EXISTS public.saved_office_expense_sheets (
    id TEXT PRIMARY KEY,
    branch_id TEXT NOT NULL,
    fiscal_year TEXT NOT NULL,
    month TEXT NOT NULL,
    month_np TEXT,
    total_expenses NUMERIC DEFAULT 0,
    tax_amount NUMERIC DEFAULT 0,
    net_paid_amount NUMERIC DEFAULT 0,
    records_count INT DEFAULT 0,
    prepared_by TEXT,
    approved_by TEXT,
    status TEXT DEFAULT 'Draft',
    saved_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.saved_office_expense_sheets DISABLE ROW LEVEL SECURITY;

-- 2.3 Branch Fixed Expense Settings (शाखा खर्च कन्फिगरेसन)
CREATE TABLE IF NOT EXISTS public.branch_fixed_expense_configs (
    branch_id TEXT PRIMARY KEY,
    rent_enabled BOOLEAN DEFAULT TRUE,
    rent_amount NUMERIC DEFAULT 0,
    rent_tds_rate NUMERIC DEFAULT 10,
    landlord_name TEXT,
    landlord_pan TEXT,
    cleaner_enabled BOOLEAN DEFAULT TRUE,
    cleaner_name TEXT,
    cleaner_amount NUMERIC DEFAULT 0,
    cleaner_tds_rate NUMERIC DEFAULT 1.5,
    electricity_meter_no TEXT,
    electricity_consumer_no TEXT,
    telephone_amount NUMERIC DEFAULT 0,
    khaja_monthly_amount NUMERIC DEFAULT 0,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.branch_fixed_expense_configs DISABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 3. HR MANAGEMENT TABLES (कर्मचारी, हाजिरी, पेरोल तथा बिदा)
-- ----------------------------------------------------------------------------

-- 3.1 Employees Master (कर्मचारी विवरण)
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    employee_code TEXT,
    branch_id TEXT,
    full_name TEXT NOT NULL,
    full_name_nepali TEXT,
    designation TEXT,
    department TEXT,
    gender TEXT,
    marital_status TEXT,
    employment_type TEXT DEFAULT 'Permanent',
    mobile TEXT,
    email TEXT,
    pan_no TEXT,
    citizenship_no TEXT,
    joined_date TEXT,
    basic_salary NUMERIC DEFAULT 0,
    grade_rate_amount NUMERIC DEFAULT 0,
    dearness_allowance NUMERIC DEFAULT 0,
    has_pf BOOLEAN DEFAULT TRUE,
    pf_contribution NUMERIC DEFAULT 0,
    has_ssf BOOLEAN DEFAULT FALSE,
    ssf_contribution NUMERIC DEFAULT 0,
    has_gratuity BOOLEAN DEFAULT TRUE,
    gratuity NUMERIC DEFAULT 0,
    dashain_bonus NUMERIC DEFAULT 0,
    medical_allowance NUMERIC DEFAULT 0,
    dress_allowance NUMERIC DEFAULT 0,
    bank_name TEXT,
    bank_account_no TEXT,
    account_holder_name TEXT,
    bank_branch TEXT,
    status TEXT DEFAULT 'Active',
    photo_url TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist on employees
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employee_code TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS full_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS full_name_nepali TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS designation TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS department TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS marital_status TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS employment_type TEXT DEFAULT 'Permanent';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mobile TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pan_no TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS citizenship_no TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS joined_date TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS basic_salary NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS grade_rate_amount NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dearness_allowance NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_pf BOOLEAN DEFAULT TRUE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS pf_contribution NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_ssf BOOLEAN DEFAULT FALSE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS ssf_contribution NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS has_gratuity BOOLEAN DEFAULT TRUE;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS gratuity NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dashain_bonus NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS medical_allowance NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS dress_allowance NUMERIC DEFAULT 0;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS account_holder_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_branch TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS photo_url TEXT;

CREATE INDEX IF NOT EXISTS idx_employees_branch ON public.employees(branch_id);
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;

-- 3.2 Attendance Records (हाजिरी)
CREATE TABLE IF NOT EXISTS public.attendance_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT,
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

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance_records(employee_id, date_bs);
ALTER TABLE public.attendance_records DISABLE ROW LEVEL SECURITY;

-- 3.3 Payroll Records (पेरोल तथा तलब)
CREATE TABLE IF NOT EXISTS public.payroll_records (
    id TEXT PRIMARY KEY,
    employee_id TEXT,
    branch_id TEXT,
    month TEXT,
    year TEXT,
    basic_salary NUMERIC DEFAULT 0,
    grade_amt NUMERIC DEFAULT 0,
    allowance NUMERIC DEFAULT 0,
    dashain_bonus NUMERIC DEFAULT 0,
    medical_allowance NUMERIC DEFAULT 0,
    dress_allowance NUMERIC DEFAULT 0,
    total_income NUMERIC DEFAULT 0,
    pf_employee NUMERIC DEFAULT 0,
    pf_employer NUMERIC DEFAULT 0,
    ssf_employee NUMERIC DEFAULT 0,
    tax_deduction NUMERIC DEFAULT 0,
    net_salary NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Pending',
    prepared_by TEXT,
    approved_by TEXT,
    generated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payroll_records DISABLE ROW LEVEL SECURITY;

-- 3.4 Leave Types & Requests (बिदा व्यवस्थापन)
CREATE TABLE IF NOT EXISTS public.leave_types (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_np TEXT,
    total_days INT NOT NULL,
    gender_specific TEXT
);

ALTER TABLE public.leave_types DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.leave_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT,
    leave_type_id TEXT,
    start_date DATE,
    end_date DATE,
    total_days INT NOT NULL DEFAULT 1,
    reason TEXT,
    status TEXT DEFAULT 'Pending',
    applied_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.leave_requests DISABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 4. REMITTANCE PARTNERS & LOGIN CREDENTIALS VAULT (रेमिट्यान्स लगइन विवरण भल्ट)
-- ----------------------------------------------------------------------------
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

-- Upgrade existing table columns safely
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

CREATE INDEX IF NOT EXISTS idx_remittance_branch_order ON public.remittance_companies(branch_id, display_order);
ALTER TABLE public.remittance_companies DISABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 5. ADMIN CENTER: SAVING & LOAN PRODUCTS TABLES
-- ----------------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS public.saving_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    interest_rate NUMERIC NOT NULL DEFAULT 0,
    capitalization TEXT NOT NULL DEFAULT 'Quarterly',
    minimum_balance NUMERIC DEFAULT 0,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 0;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS capitalization TEXT DEFAULT 'Quarterly';
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS minimum_balance NUMERIC DEFAULT 0;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_saving_products_status ON public.saving_products(status);
ALTER TABLE public.saving_products DISABLE ROW LEVEL SECURITY;

CREATE TABLE IF NOT EXISTS public.loan_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    interest_rate NUMERIC NOT NULL DEFAULT 0,
    installment TEXT NOT NULL DEFAULT 'Monthly',
    max_tenure_months INT DEFAULT 36,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS interest_rate NUMERIC DEFAULT 0;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS installment TEXT DEFAULT 'Monthly';
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS max_tenure_months INT DEFAULT 36;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS created_by TEXT;
CREATE INDEX IF NOT EXISTS idx_loan_products_status ON public.loan_products(status);
ALTER TABLE public.loan_products DISABLE ROW LEVEL SECURITY;

-- ----------------------------------------------------------------------------
-- 6. GRANT PERMISSIONS TO ANON AND AUTHENTICATED
-- ----------------------------------------------------------------------------
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;
