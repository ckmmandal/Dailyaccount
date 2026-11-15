-- ============================================================================
-- RATAULI SAVING AND CREDIT COOPERATIVE LTD
-- SUPABASE MIGRATION SCRIPT: REMITTANCE VAULT & LATEST APP UPDATES
-- Compatible with: Supabase SQL Editor & PostgreSQL
-- Safely creates tables, handles existing columns, disables RLS, and grants roles.
-- ============================================================================

-- ############################################################################
-- 1. REMITTANCE PARTNERS & LOGIN CREDENTIALS VAULT (रेमिट्यान्स लगइन विवरण भल्ट)
-- ############################################################################

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

-- Upgrade existing table columns safely if table already existed
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

-- Create performant indexes
CREATE INDEX IF NOT EXISTS idx_remittance_branch_order ON public.remittance_companies(branch_id, display_order);
CREATE INDEX IF NOT EXISTS idx_remittance_name ON public.remittance_companies(name);

-- Disable Row Level Security (RLS) to prevent Supabase permission errors
ALTER TABLE public.remittance_companies DISABLE ROW LEVEL SECURITY;

-- Grant permissions to Supabase clients
GRANT ALL ON TABLE public.remittance_companies TO anon, authenticated, service_role;

-- ############################################################################
-- 2. SEED INITIAL REMITTANCE PARTNERS (HEAD OFFICE & ALL BRANCHES)
-- ############################################################################

-- 2.1 Universal / All Branches Default Records (Common IDs)
INSERT INTO public.remittance_companies (id, name, code, display_order, has_pin, txn_pin, access_id, username, password, contact_phone, contact_email, portal_url, branch_id, status, last_password_changed)
VALUES 
    ('remit_city', 'City Express Money Transfer', 'CTX-109', 1, true, '8832', 'CTX-ACC-552', 'ratauli_cityexpress', 'CityExp#2026Vault', '01-4431900', 'info@ctxpress.com', 'https://online.ctxpress.com', 'all', 'Active', '2026-07-20'),
    ('remit_esewa', 'Esewa Money Transfer', 'EMT-881', 2, true, '9045', 'EMT-ACC-410', 'ratauli_esewa_remit', 'EsewaRemit!2026', '1660-01-02121', 'care@esewamoneytransfer.com', 'https://esewamoneytransfer.com', 'all', 'Active', '2026-09-10'),
    ('remit_himal', 'Himal Remit (HBL)', 'HML-330', 3, true, '7721', 'HML-BRANCH-12', 'ratauli_himal', 'Himal@Remit2026', '01-4227749', 'himalremit@hbl.com.np', 'https://himalremit.hbl.com.np', 'all', 'Active', '2026-08-28'),
    ('remit_ime', 'IME Remit (IME Pay)', 'IME-702', 4, true, '1190', 'IME-RAT-884', 'ratauli_ime', 'ImePay@Secure26', '01-4430600', 'support@imeremit.com.np', 'https://imeremit.com.np', 'all', 'Active', '2026-08-15'),
    ('remit_muktinath', 'Muktinath Remit', 'MNR-204', 5, true, '3310', 'MNB-REMIT-055', 'ratauli_muktinath', 'Muktinath#Vault26', '01-4437368', 'remit@muktinathbank.com.np', 'https://remit.muktinathbank.com.np', 'all', 'Active', '2026-08-10'),
    ('remit_prabhu', 'Prabhu Remit', 'PRB-01', 6, true, '4021', 'PRABHU-HO-101', 'ratauli_prabhu', 'Prabhu@User2026', '01-4788500', 'remit@prabhubank.com', 'https://remit.prabhubank.com', 'all', 'Active', '2026-08-01'),
    ('remit_surya', 'Surya Remit', 'SRY-99', 7, false, NULL, 'SRY-RAT-201', 'ratauli_surya', 'Surya#Remit2026', '01-4221122', 'support@suryaremit.com', NULL, 'all', 'Active', '2026-07-15'),
    ('remit_western_union', 'Western Union', 'WU-NP-04', 8, true, '5612', 'WU-TERM-901', 'ratauli_wu_agent', 'WU#SecureGlobal26', '1660-01-44444', 'nepalcare@westernunion.com', 'https://wupos.westernunion.com', 'all', 'Active', '2026-09-01')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    display_order = EXCLUDED.display_order,
    has_pin = EXCLUDED.has_pin,
    txn_pin = EXCLUDED.txn_pin,
    access_id = EXCLUDED.access_id,
    contact_phone = EXCLUDED.contact_phone,
    contact_email = EXCLUDED.contact_email,
    portal_url = EXCLUDED.portal_url,
    status = EXCLUDED.status;

-- 2.2 Head Office (Main Branch) Specific Records
INSERT INTO public.remittance_companies (id, name, code, display_order, has_pin, txn_pin, access_id, username, password, contact_phone, branch_id, status, last_password_changed)
VALUES 
    ('remit_main_city', 'City Express Money Transfer', 'CTX-109', 1, true, '8832', 'CTX-ACC-552', 'ratauli_cityexpress', 'CityExp#2026Vault', '01-4431900', 'main', 'Active', '2026-07-20'),
    ('remit_main_esewa', 'Esewa Money Transfer', 'EMT-881', 2, true, '9045', 'EMT-ACC-410', 'ratauli_esewa_remit', 'EsewaRemit!2026', '1660-01-02121', 'main', 'Active', '2026-09-10'),
    ('remit_main_himal', 'Himal Remit (HBL)', 'HML-330', 3, true, '7721', 'HML-BRANCH-12', 'ratauli_himal', 'Himal@Remit2026', '01-4227749', 'main', 'Active', '2026-08-28'),
    ('remit_main_ime', 'IME Remit (IME Pay)', 'IME-702', 4, true, '1190', 'IME-RAT-884', 'ratauli_ime', 'ImePay@Secure26', '01-4430600', 'main', 'Active', '2026-08-15'),
    ('remit_main_muktinath', 'Muktinath Remit', 'MNR-204', 5, true, '3310', 'MNB-REMIT-055', 'ratauli_muktinath', 'Muktinath#Vault26', '01-4437368', 'main', 'Active', '2026-08-10'),
    ('remit_main_prabhu', 'Prabhu Remit', 'PRB-01', 6, true, '4021', 'PRABHU-HO-101', 'ratauli_prabhu', 'Prabhu@User2026', '01-4788500', 'main', 'Active', '2026-08-01'),
    ('remit_main_surya', 'Surya Remit', 'SRY-99', 7, false, NULL, 'SRY-RAT-201', 'ratauli_surya', 'Surya#Remit2026', '01-4221122', 'main', 'Active', '2026-07-15'),
    ('remit_main_western', 'Western Union', 'WU-NP-04', 8, true, '5612', 'WU-TERM-901', 'ratauli_wu_agent', 'WU#SecureGlobal26', '1660-01-44444', 'main', 'Active', '2026-09-01')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    display_order = EXCLUDED.display_order,
    has_pin = EXCLUDED.has_pin,
    txn_pin = EXCLUDED.txn_pin,
    access_id = EXCLUDED.access_id,
    contact_phone = EXCLUDED.contact_phone,
    status = EXCLUDED.status;

-- 2.3 Sahodba Branch
INSERT INTO public.remittance_companies (id, name, code, display_order, has_pin, access_id, username, password, contact_phone, branch_id, status, last_password_changed)
VALUES 
    ('remit_sahodba_city', 'City Express Money Transfer', 'CTX-109', 1, true, '', '', '', '01-4431900', 'sahodba', 'Active', '2026-07-20'),
    ('remit_sahodba_esewa', 'Esewa Money Transfer', 'EMT-881', 2, true, '', '', '', '1660-01-02121', 'sahodba', 'Active', '2026-09-10'),
    ('remit_sahodba_himal', 'Himal Remit (HBL)', 'HML-330', 3, true, '', '', '', '01-4227749', 'sahodba', 'Active', '2026-08-28'),
    ('remit_sahodba_ime', 'IME Remit (IME Pay)', 'IME-702', 4, true, '', '', '', '01-4430600', 'sahodba', 'Active', '2026-08-15'),
    ('remit_sahodba_muktinath', 'Muktinath Remit', 'MNR-204', 5, true, '', '', '', '01-4437368', 'sahodba', 'Active', '2026-08-10'),
    ('remit_sahodba_prabhu', 'Prabhu Remit', 'PRB-01', 6, true, '', '', '', '01-4788500', 'sahodba', 'Active', '2026-08-01'),
    ('remit_sahodba_surya', 'Surya Remit', 'SRY-99', 7, false, '', '', '', '01-4221122', 'sahodba', 'Active', '2026-07-15'),
    ('remit_sahodba_western', 'Western Union', 'WU-NP-04', 8, true, '', '', '', '1660-01-44444', 'sahodba', 'Active', '2026-09-01')
ON CONFLICT (id) DO NOTHING;

-- 2.4 Pipra Branch
INSERT INTO public.remittance_companies (id, name, code, display_order, has_pin, access_id, username, password, contact_phone, branch_id, status, last_password_changed)
VALUES 
    ('remit_pipra_city', 'City Express Money Transfer', 'CTX-109', 1, true, '', '', '', '01-4431900', 'pipra', 'Active', '2026-07-20'),
    ('remit_pipra_esewa', 'Esewa Money Transfer', 'EMT-881', 2, true, '', '', '', '1660-01-02121', 'pipra', 'Active', '2026-09-10'),
    ('remit_pipra_himal', 'Himal Remit (HBL)', 'HML-330', 3, true, '', '', '', '01-4227749', 'pipra', 'Active', '2026-08-28'),
    ('remit_pipra_ime', 'IME Remit (IME Pay)', 'IME-702', 4, true, '', '', '', '01-4430600', 'pipra', 'Active', '2026-08-15'),
    ('remit_pipra_muktinath', 'Muktinath Remit', 'MNR-204', 5, true, '', '', '', '01-4437368', 'pipra', 'Active', '2026-08-10'),
    ('remit_pipra_prabhu', 'Prabhu Remit', 'PRB-01', 6, true, '', '', '', '01-4788500', 'pipra', 'Active', '2026-08-01'),
    ('remit_pipra_surya', 'Surya Remit', 'SRY-99', 7, false, '', '', '', '01-4221122', 'pipra', 'Active', '2026-07-15'),
    ('remit_pipra_western', 'Western Union', 'WU-NP-04', 8, true, '', '', '', '1660-01-44444', 'pipra', 'Active', '2026-09-01')
ON CONFLICT (id) DO NOTHING;

-- 2.5 Parsa Branch
INSERT INTO public.remittance_companies (id, name, code, display_order, has_pin, access_id, username, password, contact_phone, branch_id, status, last_password_changed)
VALUES 
    ('remit_parsa_city', 'City Express Money Transfer', 'CTX-109', 1, true, '', '', '', '01-4431900', 'parsa', 'Active', '2026-07-20'),
    ('remit_parsa_esewa', 'Esewa Money Transfer', 'EMT-881', 2, true, '', '', '', '1660-01-02121', 'parsa', 'Active', '2026-09-10'),
    ('remit_parsa_himal', 'Himal Remit (HBL)', 'HML-330', 3, true, '', '', '', '01-4227749', 'parsa', 'Active', '2026-08-28'),
    ('remit_parsa_ime', 'IME Remit (IME Pay)', 'IME-702', 4, true, '', '', '', '01-4430600', 'parsa', 'Active', '2026-08-15'),
    ('remit_parsa_muktinath', 'Muktinath Remit', 'MNR-204', 5, true, '', '', '', '01-4437368', 'parsa', 'Active', '2026-08-10'),
    ('remit_parsa_prabhu', 'Prabhu Remit', 'PRB-01', 6, true, '', '', '', '01-4788500', 'parsa', 'Active', '2026-08-01'),
    ('remit_parsa_surya', 'Surya Remit', 'SRY-99', 7, false, '', '', '', '01-4221122', 'parsa', 'Active', '2026-07-15'),
    ('remit_parsa_western', 'Western Union', 'WU-NP-04', 8, true, '', '', '', '1660-01-44444', 'parsa', 'Active', '2026-09-01')
ON CONFLICT (id) DO NOTHING;

-- ############################################################################
-- 3. SAVED OFFICE EXPENSE SHEETS & MONTHLY ARCHIVE INTEGRITY
-- ############################################################################

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
    saved_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
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
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS saved_at TIMESTAMPTZ DEFAULT NOW();
ALTER TABLE public.saved_office_expense_sheets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_saved_sheets_fy_mo ON public.saved_office_expense_sheets(fiscal_year, month);
ALTER TABLE public.saved_office_expense_sheets DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.saved_office_expense_sheets TO anon, authenticated, service_role;

-- ############################################################################
-- 4. PAYROLL RECORDS & ARCHIVED DISBURSEMENTS
-- ############################################################################

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
    ssf_employer NUMERIC DEFAULT 0,
    gratuity NUMERIC DEFAULT 0,
    tax_deduction NUMERIC DEFAULT 0,
    net_salary NUMERIC DEFAULT 0,
    status TEXT DEFAULT 'Approved',
    prepared_by TEXT,
    approved_by TEXT,
    generated_date TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS employee_id TEXT;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS month TEXT;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS year TEXT;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS basic_salary NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS grade_amt NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS allowance NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS ssf_employer NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS gratuity NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS tax_deduction NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS net_salary NUMERIC DEFAULT 0;
ALTER TABLE public.payroll_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Approved';

CREATE INDEX IF NOT EXISTS idx_payroll_emp_period ON public.payroll_records(employee_id, year, month);
CREATE INDEX IF NOT EXISTS idx_payroll_branch ON public.payroll_records(branch_id);
ALTER TABLE public.payroll_records DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.payroll_records TO anon, authenticated, service_role;

-- ############################################################################
-- 5. SYSTEM SETTINGS & OFFICIAL LOGO FIX
-- ############################################################################

UPDATE public.settings 
SET data = jsonb_set(COALESCE(data, '{}'::jsonb), '{logoUrl}', '"/system_logo.png"')
WHERE id = 'global' 
  AND (data->>'logoUrl' LIKE '%picsum.photos%' OR data->>'logoUrl' IS NULL OR data->>'logoUrl' = '');

INSERT INTO public.settings (id, data) VALUES (
    'global',
    '{
        "systemName": "RATAULI SAVING AND CREDIT COOPERATIVE LTD",
        "currency": "NPR",
        "remittanceCompanies": ["City Express", "Esewa", "Himal", "IME", "Muktinath", "Prabhu", "Surya", "Western Union"],
        "officeHeads": ["Salary", "Rent", "Electricity", "Water", "Stationery", "Marketing", "Maintenance", "Interest Paid", "Interest Received", "Commission"],
        "approvalLimit": 50000,
        "enableApprovals": true,
        "logoUrl": "/system_logo.png"
    }'::jsonb
) ON CONFLICT (id) DO NOTHING;

GRANT ALL ON ALL TABLES IN SCHEMA public TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

-- ============================================================================
-- End of Migration Script
-- ============================================================================
