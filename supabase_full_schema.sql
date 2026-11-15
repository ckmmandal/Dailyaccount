-- ====================================================================
-- RATANPURA / RATAULI SACCOS - SUPABASE COMPLETE DATABASE SCHEMA
-- Copy and run this script in your new Supabase project's SQL Editor
-- (Supabase Dashboard -> SQL Editor -> New Query -> Run)
-- ====================================================================

-- 1. BRANCHES TABLE
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
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS code_np TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS location_np TEXT;
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS branch_type TEXT DEFAULT 'Branch Office';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS branch_type_np TEXT DEFAULT 'शाखा कार्यालय';
ALTER TABLE public.branches ADD COLUMN IF NOT EXISTS email TEXT;

-- 2. ROLES TABLE
CREATE TABLE IF NOT EXISTS public.roles (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    permissions JSONB DEFAULT '[]'::jsonb
);

-- 3. USERS TABLE
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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. SYSTEM SETTINGS TABLE
CREATE TABLE IF NOT EXISTS public.settings (
    id TEXT PRIMARY KEY DEFAULT 'global',
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 5. DAILY DATA (CORE TRANSACTIONS & VAULT/COUNTER ENTRY)
CREATE TABLE IF NOT EXISTS public.daily_data (
    id TEXT PRIMARY KEY, -- format: YYYY-MM-DD_branchId
    date TEXT,
    branch_id TEXT,
    data JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. LEDGER ACCOUNTS TABLE
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

-- Ensure all columns exist even if created with older schema
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS sub_category TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS initial_balance NUMERIC DEFAULT 0;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- 7. AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS public.audit_logs (
    id TEXT PRIMARY KEY,
    user_id TEXT,
    user_name TEXT,
    action TEXT,
    details TEXT,
    timestamp BIGINT,
    branch_id TEXT,
    date_bs TEXT,
    category TEXT
);

-- 8. NOTICES TABLE
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
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.notices ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- 9. DOWNLOADABLE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS public.downloadable_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT,
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
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS date TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS size TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS uploaded_at BIGINT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS branch_id TEXT;

-- 10. FIXED DEPOSIT (FD) RECORDS TABLE
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
    created_at TEXT
);

-- Ensure missing columns exist if table was created with an old schema
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
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS compounding TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS tax TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS amount TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS amount_in_words TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS total_interest TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS tax_deduction TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS maturity_amount TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS maturity_in_words TEXT;
ALTER TABLE public.fd_records ADD COLUMN IF NOT EXISTS created_at TEXT;

-- 11. EMPLOYEES MASTER TABLE
CREATE TABLE IF NOT EXISTS public.employees (
    id TEXT PRIMARY KEY,
    full_name TEXT NOT NULL,
    employee_code TEXT,
    mobile TEXT,
    email TEXT,
    department TEXT,
    branch_id TEXT,
    designation TEXT,
    joined_date TEXT,
    basic_salary NUMERIC DEFAULT 0,
    da_type TEXT,
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
    pan_no TEXT,
    status TEXT DEFAULT 'Active',
    photo_url TEXT,
    gender TEXT,
    marital_status TEXT,
    months_active INT DEFAULT 12,
    festival_bonus NUMERIC DEFAULT 0,
    bonus_yearly NUMERIC DEFAULT 0,
    employment_type TEXT,
    life_insurance NUMERIC DEFAULT 0,
    health_insurance NUMERIC DEFAULT 0,
    building_insurance NUMERIC DEFAULT 0,
    medical_expenses_paid NUMERIC DEFAULT 0,
    remote_area_category TEXT,
    is_incapacitated BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 12. LEAVE TYPES TABLE
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

-- 13. LEAVE REQUESTS TABLE
CREATE TABLE IF NOT EXISTS public.leave_requests (
    id TEXT PRIMARY KEY,
    employee_id TEXT,
    leave_type_id TEXT,
    start_date TEXT,
    end_date TEXT,
    total_days INT,
    reason TEXT,
    status TEXT DEFAULT 'Pending',
    applied_date TEXT,
    approved_by TEXT,
    branch_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14. PAYROLL RECORDS (PAYROLL ARCHIVE) TABLE
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
    net_salary NUMERIC DEFAULT 0,
    generated_date BIGINT,
    status TEXT DEFAULT 'Paid',
    prepared_by TEXT,
    approved_by TEXT,
    branch_id TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 14.1 ATTENDANCE RECORDS (हाजिरी) TABLE
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

CREATE INDEX IF NOT EXISTS idx_attendance_emp_date ON public.attendance_records(employee_id, date_bs);
CREATE INDEX IF NOT EXISTS idx_attendance_branch ON public.attendance_records(branch_id);

-- 15. COMPLAINTS TABLE
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

-- 16. INCOME TAX POLICY TABLE
CREATE TABLE IF NOT EXISTS public.tax_policy (
    id TEXT PRIMARY KEY DEFAULT 'default',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 17. TAX ADJUSTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.tax_adjustments (
    employee_id TEXT PRIMARY KEY,
    is_active BOOLEAN DEFAULT false,
    start_month TEXT,
    adjustments_data JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 18-23. GRANULAR FRONT TELLER & BACK OFFICE TABLES
CREATE TABLE IF NOT EXISTS public.front_teller_ledger_entries (
    id TEXT PRIMARY KEY,
    date TEXT,
    branch_id TEXT,
    account_title TEXT,
    amount NUMERIC DEFAULT 0,
    type TEXT,
    remarks TEXT,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.front_teller_counter_entries (
    id TEXT PRIMARY KEY,
    date TEXT,
    branch_id TEXT,
    head TEXT,
    amount NUMERIC DEFAULT 0,
    type TEXT,
    remarks TEXT,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

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
    created_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.back_office_entries (
    id TEXT PRIMARY KEY,
    date TEXT,
    branch_id TEXT,
    head TEXT,
    amount NUMERIC DEFAULT 0,
    type TEXT,
    remarks TEXT,
    data JSONB,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure all columns exist even if tables were previously created with minimal schema
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS account_title TEXT;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.front_teller_ledger_entries ADD COLUMN IF NOT EXISTS data JSONB;

ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS head TEXT;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.front_teller_counter_entries ADD COLUMN IF NOT EXISTS data JSONB;

ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS partner TEXT;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS quantity INT DEFAULT 1;
ALTER TABLE public.front_teller_remittance_entries ADD COLUMN IF NOT EXISTS data JSONB;

ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS value NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS quantity NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS total_amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS denominations_breakdown JSONB;
ALTER TABLE public.front_teller_deno_adjustments ADD COLUMN IF NOT EXISTS data JSONB;

ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS party_type TEXT;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS party_name TEXT;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS tx_type TEXT;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS denominations_breakdown JSONB;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS vault_snapshot JSONB;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS is_vault_transfer BOOLEAN DEFAULT false;
ALTER TABLE public.front_teller_vault_entries ADD COLUMN IF NOT EXISTS data JSONB;

ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS head TEXT;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS amount NUMERIC DEFAULT 0;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.back_office_entries ADD COLUMN IF NOT EXISTS data JSONB;

-- 24. HOLIDAYS & BRANCH OPERATIONAL STATUS (DAY OPEN / END)
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

-- 25. BOARD OF DIRECTORS & COMMITTEE MANAGEMENT (समिति व्यवस्थापन)
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
    citizenship_issued_date_bs TEXT,
    permanent_province TEXT,
    permanent_district TEXT,
    permanent_municipality TEXT,
    permanent_ward TEXT,
    permanent_tole TEXT,
    branch_id TEXT DEFAULT 'main',
    status TEXT DEFAULT 'Active',
    tenure JSONB DEFAULT '{}'::jsonb,
    allowance_config JSONB DEFAULT '{}'::jsonb,
    documents JSONB DEFAULT '[]'::jsonb,
    photo_url TEXT,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

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

-- 26. EMPLOYEE DOCUMENTS MASTER TABLE & KYC UPGRADE
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

ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS citizenship_no TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS citizenship_district TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS citizenship_issue_date TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS citizenship_front_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS citizenship_back_url TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_citizenship TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_nid TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_pan TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_education TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_experience TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS docs_contract TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS documents JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS kyc_details JSONB DEFAULT '{}'::jsonb;

-- ====================================================================
-- DISABLE RLS & GRANT PUBLIC API ACCESS FOR ANON AND AUTHENTICATED
-- ====================================================================
ALTER TABLE public.branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.users DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.ledger_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.notices DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloadable_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.fd_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_policy DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_adjustments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.front_teller_ledger_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.front_teller_counter_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.front_teller_remittance_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.front_teller_deno_adjustments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.front_teller_vault_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.back_office_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_operational_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_operational_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_designations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_allowance_sheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents DISABLE ROW LEVEL SECURITY;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;

-- ====================================================================
-- SEED INITIAL SEED DATA (DEFAULT BRANCHES, ROLES, ADMIN USER, LEAVES)
-- ====================================================================

-- Default Branches
INSERT INTO public.branches (id, name, code, location, status, created_at) VALUES
('main', 'Ratauli Head Office', 'C01', 'Ratauli', 'Active', 1700000000000),
('sahodba', 'Sahodba Branch', 'C02', 'Sahodba', 'Active', 1700000000001),
('pipra', 'Pipra Branch', 'C03', 'Pipra', 'Active', 1700000000002),
('parsa', 'Parsa Branch', 'C04', 'Parsa', 'Active', 1700000000003)
ON CONFLICT (id) DO NOTHING;

-- Default Roles
INSERT INTO public.roles (id, name, permissions) VALUES
('1', 'Super Admin', '["view_transaction", "add_transaction", "edit_transaction", "delete_transaction", "view_reports", "manage_users", "manage_settings", "view_cash_entry", "view_daily_ledger", "view_income_expense", "view_ledger_names", "view_consolidated_report", "cross_branch_operation", "manage_hr", "manage_notices"]'::jsonb),
('2', 'Manager', '["view_transaction", "add_transaction", "view_reports", "view_cash_entry", "view_daily_ledger", "view_ledger_names", "view_income_expense", "manage_hr", "manage_notices"]'::jsonb),
('3', 'Branch Operator', '["view_transaction", "add_transaction", "view_cash_entry", "view_daily_ledger", "view_income_expense"]'::jsonb)
ON CONFLICT (id) DO NOTHING;

-- Default Admin User (username: admin / password: 123 or your configured pass)
INSERT INTO public.users (id, username, password, full_name, role_id, branch_id, status) VALUES
('usr_admin', 'admin', '123', 'System Administrator', '1', 'main', 'Active')
ON CONFLICT (id) DO NOTHING;

-- Default Leave Types
INSERT INTO public.leave_types (id, name, name_np, total_days, is_one_time, gender_specific) VALUES
('lt1', 'Annual Leave', 'घर बिदा', 30, false, NULL),
('lt2', 'Sick Leave', 'बिरामी बिदा', 12, false, NULL),
('lt3', 'Emergency Leave', 'भैपरी बिदा', 3, false, NULL),
('lt4', 'Bereavement Leave', 'क्रिया बिदा', 13, true, NULL),
('lt5', 'Maternity Leave', 'सुत्केरी बिदा', 98, false, 'Female'),
('lt6', 'Paternity / Care Leave', 'सुत्केरी स्याहार बिदा', 15, false, 'Male')
ON CONFLICT (id) DO NOTHING;

-- Default Tax Policy Configuration
INSERT INTO public.tax_policy (id, config) VALUES
('default', '{
    "singleSlabs": [
        {"label": "FIRST 5,000,000", "limit": 500000, "rate": 1},
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
