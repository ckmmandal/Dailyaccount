-- ====================================================================
-- SUPABASE HR MANAGEMENT & PAYROLL COMPLETE SCHEMA DDL
-- Run this script in your Supabase SQL Editor (SQL Editor -> New Query)
-- ====================================================================

-- 1. INCOME TAX POLICY ENGINE TABLE
CREATE TABLE IF NOT EXISTS public.tax_policy (
    id TEXT PRIMARY KEY DEFAULT 'default',
    config JSONB NOT NULL,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. EMPLOYEE TAX ADJUSTMENTS TABLE
CREATE TABLE IF NOT EXISTS public.tax_adjustments (
    employee_id TEXT PRIMARY KEY,
    is_active BOOLEAN DEFAULT false,
    start_month TEXT,
    adjustments_data JSONB,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. EMPLOYEES MASTER TABLE
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

-- 4. LEAVE TYPES TABLE
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

-- 5. LEAVE REQUESTS TABLE
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

-- 6. PAYROLL RECORDS (PAYROLL ARCHIVE) TABLE
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

-- 7. COMPLAINTS TABLE
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

-- 8. ATTENDANCE RECORDS (हाजिरी) TABLE
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

-- Upgrade columns in case table already exists with minimal schema
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

-- 9. EMPLOYEE DOCUMENTS MASTER TABLE
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

-- Upgrade employees table with document & KYC fields
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

-- 10. BOARD MANAGEMENT TABLES (सञ्चालक समिति तथा उपसमिति)
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

-- 11. HOLIDAYS & BRANCH OPERATIONAL STATUS (DAY OPEN / END)
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

-- RLS & PERMISSIONS
ALTER TABLE public.tax_policy DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.tax_adjustments DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.payroll_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.attendance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_designations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_allowance_sheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.holidays DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_operational_status DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.tax_policy TO anon, authenticated, service_role;
GRANT ALL ON public.tax_adjustments TO anon, authenticated, service_role;
GRANT ALL ON public.employees TO anon, authenticated, service_role;
GRANT ALL ON public.leave_types TO anon, authenticated, service_role;
GRANT ALL ON public.leave_requests TO anon, authenticated, service_role;
GRANT ALL ON public.payroll_records TO anon, authenticated, service_role;
GRANT ALL ON public.complaints TO anon, authenticated, service_role;
GRANT ALL ON public.attendance_records TO anon, authenticated, service_role;
GRANT ALL ON public.employee_documents TO anon, authenticated, service_role;
GRANT ALL ON public.board_categories TO anon, authenticated, service_role;
GRANT ALL ON public.board_designations TO anon, authenticated, service_role;
GRANT ALL ON public.board_members TO anon, authenticated, service_role;
GRANT ALL ON public.board_allowance_sheets TO anon, authenticated, service_role;
GRANT ALL ON public.holidays TO anon, authenticated, service_role;
GRANT ALL ON public.branch_operational_status TO anon, authenticated, service_role;

