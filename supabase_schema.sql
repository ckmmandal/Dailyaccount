-- ==========================================
-- SUPABASE SCHEMA FOR DAILY ACCOUNT APP
-- ==========================================
-- This SQL file defines the full schema for the Ratauli SACCOS Daily Account system.
-- It maps directly to all Admin Center menus, submenus, and modules:
-- 
-- 1. [Home / Dashboard] -> Stored dynamically via daily_data, branches, and ledger_accounts
-- 2. [Branches]         -> Stored in the 'branches' table
-- 3. [Users]            -> Stored in the 'users' table
-- 4. [Roles]            -> Stored in the 'roles' table
-- 5. [Intelligence]     -> Consists of:
--      - Financials      -> Mapped via 'ledger_accounts', office_account_entries, and 'daily_data'
--      - Denomination    -> Mapped via 'daily_data' (denominations, denoAdjustments, vaultTransactions)
--      - Remittance      -> Mapped via 'daily_data' (remittances)
--      - Ledger          -> Mapped via 'ledger_accounts'
--      - Manage Remit    -> Mapped via global configurations in 'settings' (e.g. remittanceCompaniesByBranch)
-- 6. [Settings]         -> Stored in the 'settings' table
-- 7. [Backup]           -> Client-side master dump fetching all tables, restoring dynamically
-- 8. [Reset]            -> Clearances tracked via 'audit_logs', executing delete queries on daily_data
-- 9. [Logs]             -> Stored in the 'audit_logs' table
--
-- Note: Row Level Security (RLS) is disabled for all tables to allow the client-side
-- application to execute seamless fallback operations when network connectivity fluctuates.
-- ==========================================

-- ==========================================
-- 1. ROLES & PERMISSIONS
-- ==========================================
CREATE TABLE IF NOT EXISTS roles (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  permissions TEXT[] DEFAULT '{}'
);

-- ==========================================
-- 2. BRANCHES MODULE
-- ==========================================
CREATE TABLE IF NOT EXISTS branches (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  code TEXT NOT NULL UNIQUE,
  location TEXT NOT NULL,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  created_at BIGINT
);

-- ==========================================
-- 3. USERS MODULE
-- ==========================================
CREATE TABLE IF NOT EXISTS users (
  id TEXT PRIMARY KEY,
  username TEXT UNIQUE NOT NULL,
  password TEXT NOT NULL,
  full_name TEXT NOT NULL,
  role_id TEXT NOT NULL REFERENCES roles(id) ON DELETE RESTRICT,
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  permissions TEXT[] DEFAULT '{}',
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Inactive')),
  email TEXT,
  mobile TEXT,
  department TEXT,
  designation TEXT,
  profile_photo TEXT, -- Stores base64 or URL
  account_created BIGINT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  address TEXT,
  id_number TEXT,
  dob TEXT,
  last_login BIGINT,
  last_activity BIGINT,
  notes TEXT
);

-- ==========================================
-- 4. SETTINGS MODULE
-- ==========================================
CREATE TABLE IF NOT EXISTS settings (
  id TEXT PRIMARY KEY DEFAULT 'global',
  data JSONB NOT NULL
);

-- ==========================================
-- 5. INTELLIGENCE -> LEDGER MANAGEMENT
-- ==========================================
CREATE TABLE IF NOT EXISTS public.ledger_accounts (
  id TEXT PRIMARY KEY,
  code TEXT,
  name TEXT NOT NULL,
  category TEXT, -- Serialized JSON containing 'type', 'interestRate', 'mobile', 'address', 'photoUrl', 'capitalizationFrequency', 'capitalizeToPrincipal'
  sub_category TEXT,
  type TEXT,
  branch_id TEXT,
  initial_balance NUMERIC DEFAULT 0,
  status TEXT DEFAULT 'Active',
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Ensure missing columns exist on pre-existing ledger_accounts table
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS code TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS category TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS sub_category TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS branch_id TEXT;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS initial_balance NUMERIC DEFAULT 0;
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.ledger_accounts ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;

-- ==========================================
-- 6. INTELLIGENCE -> DAILY DATA ENTRY & STATES
--    (Financials, Denomination, Remittance, Manage Remit)
-- ==========================================
CREATE TABLE IF NOT EXISTS daily_data (
  id TEXT PRIMARY KEY, -- Formatted as "date_branchId"
  date TEXT NOT NULL,  -- Nepali BS date / AD date depending on layout preference
  branch_id TEXT NOT NULL REFERENCES branches(id) ON DELETE CASCADE,
  data JSONB NOT NULL  -- Serialized DailyData payload containing denominations, denoAdjustments, transactions, officeTransactions, remittances, vaultTransactions
);

-- GRANULAR FRONT TELLER & BACK OFFICE TABLES
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

-- Ensure missing columns exist on pre-existing tables
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

-- ==========================================
-- 7. AUDIT LOGS MODULE
-- ==========================================
CREATE TABLE IF NOT EXISTS audit_logs (
  id TEXT PRIMARY KEY,
  timestamp BIGINT NOT NULL,
  user_id TEXT REFERENCES users(id) ON DELETE SET NULL,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  action TEXT NOT NULL,
  details TEXT,
  ip TEXT,
  device TEXT
);

-- ==========================================
-- 8. HUMAN RESOURCE MANAGEMENT (HR) EXTRA MODULES
-- ==========================================
-- Employees Table
CREATE TABLE IF NOT EXISTS employees (
  id TEXT PRIMARY KEY,
  full_name TEXT NOT NULL,
  employee_code TEXT UNIQUE,
  mobile TEXT,
  email TEXT,
  department TEXT,
  branch_id TEXT REFERENCES branches(id) ON DELETE SET NULL,
  designation TEXT,
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
  pan_no TEXT,
  status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'On Leave', 'Terminated')),
  photo_url TEXT,
  gender TEXT CHECK (gender IN ('Male', 'Female')),
  marital_status TEXT CHECK (marital_status IN ('Single', 'Couple')),
  months_active INTEGER DEFAULT 12,
  festival_bonus NUMERIC DEFAULT 0,
  bonus_yearly NUMERIC DEFAULT 0,
  employment_type TEXT CHECK (employment_type IN ('Permanent', 'Temporary')),
  life_insurance NUMERIC DEFAULT 0,
  health_insurance NUMERIC DEFAULT 0,
  building_insurance NUMERIC DEFAULT 0,
  medical_expenses_paid NUMERIC DEFAULT 0,
  remote_area_category TEXT DEFAULT 'None',
  is_incapacitated BOOLEAN DEFAULT FALSE
);

-- Leave Types Table
CREATE TABLE IF NOT EXISTS leave_types (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  name_np TEXT,
  total_days INTEGER,
  is_one_time BOOLEAN DEFAULT FALSE,
  gender_specific TEXT CHECK (gender_specific IN ('Male', 'Female', NULL))
);

-- Leave Requests Table
CREATE TABLE IF NOT EXISTS leave_requests (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  leave_type_id TEXT REFERENCES leave_types(id) ON DELETE SET NULL,
  start_date TEXT,
  end_date TEXT,
  total_days INTEGER,
  reason TEXT,
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Pending', 'Approved', 'Rejected')),
  applied_date TEXT,
  approved_by TEXT,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE
);

-- Payroll Records Table
CREATE TABLE IF NOT EXISTS payroll_records (
  id TEXT PRIMARY KEY,
  employee_id TEXT REFERENCES employees(id) ON DELETE CASCADE,
  year TEXT,
  month TEXT,
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
  status TEXT DEFAULT 'Pending' CHECK (status IN ('Paid', 'Pending')),
  prepared_by TEXT,
  approved_by TEXT,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE
);

-- Complaints Table
CREATE TABLE IF NOT EXISTS complaints (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  description TEXT,
  category TEXT,
  priority TEXT CHECK (priority IN ('Low', 'Medium', 'High')),
  status TEXT DEFAULT 'Open' CHECK (status IN ('Open', 'In Progress', 'Resolved')),
  created_at BIGINT,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
  resolution_note TEXT
);

-- Tax Policy Table
CREATE TABLE IF NOT EXISTS tax_policy (
  id TEXT PRIMARY KEY DEFAULT 'default',
  config JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Tax Adjustments Table
CREATE TABLE IF NOT EXISTS tax_adjustments (
  employee_id TEXT PRIMARY KEY,
  id TEXT,
  is_active BOOLEAN DEFAULT false,
  start_month TEXT DEFAULT 'पौष',
  adjustments_data JSONB NOT NULL,
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- ==========================================
-- 9. CORPORATE COMMUNICATIONS & DOCUMENTS
-- ==========================================
-- Notices Table
CREATE TABLE IF NOT EXISTS notices (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  content TEXT, -- Serialized JSON containing description, date, attachmentUrl, attachmentName, attachmentType
  description TEXT,
  date TEXT,
  attachment_url TEXT,
  attachment_name TEXT,
  attachment_type TEXT,
  type TEXT,
  status TEXT DEFAULT 'Active',
  created_at BIGINT,
  branch_id TEXT
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

-- Downloadable Documents Table
CREATE TABLE IF NOT EXISTS downloadable_documents (
  id TEXT PRIMARY KEY,
  title TEXT NOT NULL,
  category TEXT,
  url TEXT,
  file_url TEXT,
  file_name TEXT,
  file_type TEXT,
  date TEXT,
  size TEXT, -- Mapped file metadata
  type TEXT,
  uploaded_at BIGINT,
  branch_id TEXT
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

-- ==========================================
-- 10. SYSTEM INDEXES (PERFORMANCE OPTIMIZATION)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_users_username ON users(username);
CREATE INDEX IF NOT EXISTS idx_users_branch_id ON users(branch_id);
CREATE INDEX IF NOT EXISTS idx_ledger_accounts_branch_id ON ledger_accounts(branch_id);
CREATE INDEX IF NOT EXISTS idx_daily_data_date ON daily_data(date);
CREATE INDEX IF NOT EXISTS idx_daily_data_branch_id ON daily_data(branch_id);
CREATE INDEX IF NOT EXISTS idx_audit_logs_timestamp ON audit_logs(timestamp);
CREATE INDEX IF NOT EXISTS idx_employees_branch_id ON employees(branch_id);
CREATE INDEX IF NOT EXISTS idx_payroll_records_branch_year_month ON payroll_records(branch_id, year, month);

-- ==========================================
-- 11. INITIAL SEEDING DATA
-- ==========================================

-- Seed Roles
INSERT INTO roles (id, name, permissions) VALUES 
('1', 'Super Admin', ARRAY['view_transaction', 'add_transaction', 'edit_transaction', 'delete_transaction', 'view_reports', 'manage_users', 'manage_settings', 'view_cash_entry', 'view_daily_ledger', 'view_income_expense', 'view_ledger_names', 'view_consolidated_report', 'cross_branch_operation', 'manage_hr', 'manage_notices']),
('2', 'Manager', ARRAY['view_transaction', 'add_transaction', 'view_reports', 'view_cash_entry', 'view_daily_ledger', 'view_ledger_names', 'view_income_expense', 'manage_hr', 'manage_notices']),
('3', 'Branch Operator', ARRAY['view_transaction', 'add_transaction', 'view_cash_entry', 'view_daily_ledger', 'view_income_expense'])
ON CONFLICT (id) DO UPDATE SET permissions = EXCLUDED.permissions;

-- Seed Default Branches
INSERT INTO branches (id, name, code, location, status, created_at) VALUES 
('main', 'Ratauli Head Office', 'C01', 'Ratauli', 'Active', 1700000000000),
('sahodba', 'Sahodba Branch', 'C02', 'Sahodba', 'Active', 1700000000001),
('pipra', 'Pipra Branch', 'C03', 'Pipra', 'Active', 1700000000002),
('parsa', 'Parsa Branch', 'C04', 'Parsa', 'Active', 1700000000003)
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, code = EXCLUDED.code, location = EXCLUDED.location;

-- Seed Leave Types
INSERT INTO leave_types (id, name, name_np, total_days, is_one_time, gender_specific) VALUES
('lt1', 'Annual Leave', 'घर बिदा', 30, false, NULL),
('lt2', 'Sick Leave', 'बिरामी बिदा', 12, false, NULL),
('lt3', 'Emergency Leave', 'भैपरी बिदा', 3, false, NULL),
('lt4', 'Bereavement Leave', 'क्रिया बिदा', 13, true, NULL),
('lt5', 'Maternity Leave', 'सुत्केरी बिदा', 98, false, 'Female'),
('lt6', 'Paternity / Care Leave', 'सुत्केरी स्याहार बिदा', 15, false, 'Male')
ON CONFLICT (id) DO UPDATE SET name = EXCLUDED.name, name_np = EXCLUDED.name_np, total_days = EXCLUDED.total_days;

-- Seed Global Default System Settings
INSERT INTO settings (id, data) VALUES (
  'global', 
  '{
    "systemName": "RATAULI SACCOS DAILY ACCOUNT",
    "currency": "NPR",
    "remittanceCompanies": ["IME", "Prabhu", "City Express", "Sewa", "E-Sewa", "Khalti", "I-Pay"],
    "officeHeads": ["Salary", "Rent", "Electricity", "Water", "Stationery", "Marketing", "Maintenance", "Interest Paid", "Interest Received", "Commission"],
    "approvalLimit": 50000,
    "enableApprovals": true,
    "logoUrl": "/system_logo.png"
  }'::jsonb
) ON CONFLICT (id) DO NOTHING;

-- ==========================================
-- 12. ROW LEVEL SECURITY (RLS) CONTROL
-- ==========================================
-- Disabling row-level security so that dynamic client side reads and fallback storage are always synchronized seamlessly
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE branches DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE employees DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_types DISABLE ROW LEVEL SECURITY;
ALTER TABLE leave_requests DISABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE complaints DISABLE ROW LEVEL SECURITY;
ALTER TABLE notices DISABLE ROW LEVEL SECURITY;
ALTER TABLE downloadable_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE daily_data DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE tax_policy DISABLE ROW LEVEL SECURITY;
ALTER TABLE tax_adjustments DISABLE ROW LEVEL SECURITY;

-- ==========================================
-- 13. FRONT TELLER GRANULAR TRANSACTION RECORDING (SUPABASE)
-- ==========================================
-- These tables store a granular, historical record of every single transaction
-- performed in the Front Teller modules (Ledger Entry, Teller Counter, Remittance Hub, Counter Notes)
-- to allow robust, audit-ready multi-transaction logging.

-- 13a. Front Teller Ledger Entries Table
CREATE TABLE IF NOT EXISTS front_teller_ledger_entries (
  id TEXT PRIMARY KEY, -- Unique transaction ID
  date TEXT NOT NULL, -- Nepali/BS date of the session
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
  account_title TEXT NOT NULL,
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')), -- 'in' (IN) or 'out' (OUT)
  remarks TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  server_timestamp BIGINT
);

-- 13b. Front Teller Counter/Office Entries Table
CREATE TABLE IF NOT EXISTS front_teller_counter_entries (
  id TEXT PRIMARY KEY, -- Unique transaction ID
  date TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
  head TEXT NOT NULL, -- e.g., 'Saving', 'Share', 'Entry Fee', 'Expenses', 'Remittance', etc.
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')), -- 'in' (RECEIVED) or 'out' (PAID)
  remarks TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  server_timestamp BIGINT
);

-- 13c. Front Teller Remittance Entries Table
CREATE TABLE IF NOT EXISTS front_teller_remittance_entries (
  id TEXT PRIMARY KEY, -- Unique transaction ID
  date TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
  partner TEXT NOT NULL, -- e.g., 'IME', 'Prabhu', 'City Express', etc.
  amount NUMERIC NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')), -- 'in' (PAID) or 'out' (SEND)
  remarks TEXT,
  quantity INTEGER DEFAULT 1,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  server_timestamp BIGINT
);

-- 13d. Front Teller Denomination Adjustments Table
CREATE TABLE IF NOT EXISTS front_teller_deno_adjustments (
  id TEXT PRIMARY KEY, -- Unique adjustment ID
  date TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('add', 'less')), -- 'add' (ADD) or 'less' (LESS)
  remarks TEXT,
  denominations_breakdown JSONB NOT NULL, -- Detailed JSON containing qty for each note (1000, 500, etc.)
  total_amount NUMERIC NOT NULL,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  server_timestamp BIGINT
);

-- 13e. Front Teller Vault Control Entries Table
CREATE TABLE IF NOT EXISTS front_teller_vault_entries (
  id TEXT PRIMARY KEY, -- Unique transaction ID
  date TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
  party_type TEXT NOT NULL DEFAULT 'Teller Desk', -- 'Teller Desk', 'Bank', 'Inter-Branch', 'Head Office', 'Other'
  party_name TEXT,
  tx_type TEXT NOT NULL CHECK (tx_type IN ('in', 'out')), -- 'in' (IN / Deposit) or 'out' (OUT / Withdraw)
  amount NUMERIC NOT NULL DEFAULT 0,
  remarks TEXT,
  denominations_breakdown JSONB DEFAULT '{}'::jsonb,
  vault_snapshot JSONB DEFAULT '{}'::jsonb,
  is_vault_transfer BOOLEAN DEFAULT FALSE,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  server_timestamp BIGINT
);

-- 13f. Fixed Deposit (FD) Records Table
CREATE TABLE IF NOT EXISTS fd_records (
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

-- Column migrations for existing tables
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS account_type TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS holder_name TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS holder_name_np TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS account_no TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS selected_branch TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS signatory_name TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS issue_date TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS maturity_date TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS duration TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS interest_rate TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS compounding TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS tax TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS amount TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS amount_in_words TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS total_interest TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS tax_deduction TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS maturity_amount TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS maturity_in_words TEXT;
ALTER TABLE fd_records ADD COLUMN IF NOT EXISTS created_at TEXT;

-- 13g. Indexes for Transaction & FD Tables
CREATE INDEX IF NOT EXISTS idx_ft_ledger_date_branch ON front_teller_ledger_entries(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_ft_counter_date_branch ON front_teller_counter_entries(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_ft_remit_date_branch ON front_teller_remittance_entries(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_ft_deno_date_branch ON front_teller_deno_adjustments(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_ft_vault_date_branch ON front_teller_vault_entries(date, branch_id);
CREATE INDEX IF NOT EXISTS idx_fd_records_branch ON fd_records(selected_branch);

-- 13h. Back Office Entries Table
CREATE TABLE IF NOT EXISTS back_office_entries (
  id TEXT PRIMARY KEY,
  date TEXT NOT NULL,
  branch_id TEXT REFERENCES branches(id) ON DELETE CASCADE,
  head TEXT NOT NULL,
  type TEXT NOT NULL CHECK (type IN ('in', 'out')),
  amount NUMERIC NOT NULL DEFAULT 0,
  remarks TEXT,
  created_by TEXT REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  server_timestamp BIGINT
);

CREATE INDEX IF NOT EXISTS idx_bo_entries_date_branch ON back_office_entries(date, branch_id);

-- ==========================================
-- 14. INTERNAL STAFF CHAT & MESSAGING MODULE
-- ==========================================
CREATE TABLE IF NOT EXISTS chat_messages (
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

CREATE INDEX IF NOT EXISTS idx_chat_channel_created ON chat_messages(channel_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_recipient_created ON chat_messages(recipient_id, created_at);
CREATE INDEX IF NOT EXISTS idx_chat_sender_created ON chat_messages(sender_id, created_at);

-- Disable Row-Level Security for seamlessly synchronized operations
ALTER TABLE notices DISABLE ROW LEVEL SECURITY;
ALTER TABLE downloadable_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE ledger_accounts DISABLE ROW LEVEL SECURITY;
ALTER TABLE front_teller_ledger_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE front_teller_counter_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE front_teller_remittance_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE front_teller_deno_adjustments DISABLE ROW LEVEL SECURITY;
ALTER TABLE front_teller_vault_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE fd_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE back_office_entries DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_messages DISABLE ROW LEVEL SECURITY;



-- ############################################################################
-- REMITTANCE PARTNERS & LOGIN CREDENTIALS VAULT (रेमिट्यान्स लगइन विवरण भल्ट)
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

ALTER TABLE public.remittance_companies DISABLE ROW LEVEL SECURITY;
GRANT ALL ON TABLE public.remittance_companies TO anon, authenticated, service_role;
