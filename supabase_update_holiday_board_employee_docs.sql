-- ====================================================================
-- SUPABASE MIGRATION SCRIPT:
-- 1. HOLIDAY MANAGEMENT & BRANCH DAY END / DAY OPEN STATUS
-- 2. HR MANAGEMENT - BOARD OF DIRECTORS & COMMITTEE (समिति) MANAGEMENT
-- 3. EMPLOYEE DOCUMENTS, CERTIFICATES & RICH KYC ATTACHMENTS
-- 
-- How to apply:
-- 1. Go to your Supabase Project Dashboard (https://supabase.com/dashboard)
-- 2. Click "SQL Editor" on the left navigation bar
-- 3. Click "New Query", paste the entire contents of this file, and click "Run" (▶)
-- ====================================================================

-- ####################################################################
-- PART 1: HOLIDAY MANAGEMENT & BRANCH OPERATIONAL STATUS (DAY OPEN / END)
-- ####################################################################

-- 1.1 ANNUAL HOLIDAYS TABLE
CREATE TABLE IF NOT EXISTS public.holidays (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    date_bs TEXT NOT NULL,
    date_ad DATE,
    type TEXT NOT NULL DEFAULT 'Public Holiday', -- 'Public Holiday', 'Weekly Off', 'Festival', 'Local Holiday', 'Emergency Holiday'
    branch_id TEXT DEFAULT 'all',              -- 'all' for global, or branchId: 'main', 'sahodba', 'pipra', 'parsa'
    description TEXT,
    is_recurring BOOLEAN DEFAULT false,
    created_by TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Upgrade columns in case holidays table exists with older schema
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS title TEXT;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS date_bs TEXT;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS date_ad DATE;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS type TEXT DEFAULT 'Public Holiday';
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'all';
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS is_recurring BOOLEAN DEFAULT false;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.holidays ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_holidays_date_bs ON public.holidays(date_bs);
CREATE INDEX IF NOT EXISTS idx_holidays_branch ON public.holidays(branch_id);

-- 1.2 BRANCH OPERATIONAL STATUS TABLE (Real-time Day Open / Day End status)
CREATE TABLE IF NOT EXISTS public.branch_operational_status (
    branch_id TEXT PRIMARY KEY,
    status TEXT NOT NULL DEFAULT 'OPEN', -- 'OPEN', 'LIVE', 'END', 'CLOSED', 'HOLIDAY'
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

-- 1.3 BRANCH OPERATIONAL AUDIT LOGS (Historical track of Day Start & Day End actions)
CREATE TABLE IF NOT EXISTS public.branch_operational_logs (
    id TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
    branch_id TEXT NOT NULL,
    action TEXT NOT NULL,                -- 'DAY_OPEN', 'DAY_END', 'FORCE_OVERRIDE'
    status TEXT NOT NULL,
    date_bs TEXT NOT NULL,
    notes TEXT,
    performed_by TEXT,
    timestamp TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_branch_op_logs ON public.branch_operational_logs(branch_id, date_bs);


-- ####################################################################
-- PART 2: HR MANAGEMENT - BOARD OF DIRECTORS & COMMITTEE MANAGEMENT
-- ####################################################################

-- 2.1 BOARD CATEGORIES TABLE (सञ्चालक समिति, लेखा सुपरीवेक्षण, सल्लाहकार, उपसमिति)
CREATE TABLE IF NOT EXISTS public.board_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_np TEXT,
    description TEXT,
    is_active BOOLEAN DEFAULT true,
    sort_order INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.2 BOARD DESIGNATIONS TABLE (अध्यक्ष, उपाध्यक्ष, सचिव, कोषाध्यक्ष, सदस्य)
CREATE TABLE IF NOT EXISTS public.board_designations (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_np TEXT,
    rank INT DEFAULT 0,
    description TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2.3 BOARD MEMBERS TABLE (Complete member profile, KYC, tenure, allowance config, documents)
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
    profile_photo TEXT,
    documents JSONB DEFAULT '[]'::jsonb,         -- Attached certificate/oath files: [{ id, title, fileUrl, uploadedAt }]
    tenure JSONB DEFAULT '{}'::jsonb,            -- { termLabel, startDateBs, oathDateBs, endDateBs, status, notes }
    allowance_config JSONB DEFAULT '{}'::jsonb,  -- { meetingAllowance, communicationAllowance, travelAllowance, customTdsRate }
    branch_id TEXT DEFAULT 'main',
    status TEXT DEFAULT 'Active',                -- 'Active', 'Tenure Completed', 'Resigned', 'Suspended'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_members_category ON public.board_members(category_id);
CREATE INDEX IF NOT EXISTS idx_board_members_branch ON public.board_members(branch_id);

-- 2.4 BOARD ALLOWANCE SHEETS / MEETING SHEETS (बैठक भत्ता तथा निर्णय अभिलेख)
CREATE TABLE IF NOT EXISTS public.board_allowance_sheets (
    id TEXT PRIMARY KEY,
    meeting_no TEXT,
    meeting_date_bs TEXT NOT NULL,
    meeting_date_ad DATE,
    meeting_title TEXT NOT NULL,
    category_id TEXT,
    branch_id TEXT DEFAULT 'main',
    allowances JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of attendance & allowance amounts per member
    total_allowance NUMERIC DEFAULT 0,
    tax_deducted NUMERIC DEFAULT 0,
    net_allowance NUMERIC DEFAULT 0,
    prepared_by TEXT,
    approved_by TEXT,
    status TEXT DEFAULT 'Paid',                   -- 'Draft', 'Approved', 'Paid'
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_board_allowance_date ON public.board_allowance_sheets(meeting_date_bs);


-- ####################################################################
-- PART 3: EMPLOYEE DOCUMENTS & KYC ATTACHMENTS SCHEMA
-- ####################################################################

-- 3.1 ENHANCE EMPLOYEES TABLE WITH FULL DOCUMENT & KYC COLUMNS
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
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS father_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS mother_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS grandfather_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS spouse_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS permanent_address TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS temporary_address TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_name TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS bank_account_no TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS emergency_contact TEXT;
ALTER TABLE public.employees ADD COLUMN IF NOT EXISTS blood_group TEXT;

-- 3.2 DEDICATED EMPLOYEE DOCUMENTS MASTER TABLE (Granular files, multi-file uploads)
CREATE TABLE IF NOT EXISTS public.employee_documents (
    id TEXT PRIMARY KEY,
    employee_id TEXT NOT NULL REFERENCES public.employees(id) ON DELETE CASCADE,
    document_type TEXT NOT NULL,         -- 'citizenship', 'pan', 'academic', 'experience', 'appointment_letter', 'contract', 'other'
    title TEXT NOT NULL,
    file_name TEXT,
    file_url TEXT NOT NULL,
    file_size TEXT,
    mime_type TEXT,
    status TEXT DEFAULT 'Verified',      -- 'Pending', 'Verified', 'Rejected'
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW(),
    notes TEXT,
    metadata JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_emp_docs_emp_id ON public.employee_documents(employee_id);
CREATE INDEX IF NOT EXISTS idx_emp_docs_type ON public.employee_documents(document_type);

-- 3.3 DOWNLOADABLE DOCUMENTS TABLE (General cooperative circulars, guidelines, forms)
CREATE TABLE IF NOT EXISTS public.downloadable_documents (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    category TEXT DEFAULT 'General',
    file_url TEXT,
    url TEXT,
    file_name TEXT,
    file_size TEXT,
    file_type TEXT,
    branch_id TEXT DEFAULT 'all',
    uploaded_by TEXT,
    uploaded_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS file_url TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS url TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS file_name TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS file_size TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS file_type TEXT;
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'all';
ALTER TABLE public.downloadable_documents ADD COLUMN IF NOT EXISTS uploaded_by TEXT;


-- ####################################################################
-- PART 4: SECURITY, ROW LEVEL SECURITY (RLS) & PUBLIC API PERMISSIONS
-- ####################################################################

ALTER TABLE public.holidays DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_operational_status DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.branch_operational_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_designations DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.board_allowance_sheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.employee_documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.downloadable_documents DISABLE ROW LEVEL SECURITY;

GRANT ALL ON public.holidays TO anon, authenticated, service_role;
GRANT ALL ON public.branch_operational_status TO anon, authenticated, service_role;
GRANT ALL ON public.branch_operational_logs TO anon, authenticated, service_role;
GRANT ALL ON public.board_categories TO anon, authenticated, service_role;
GRANT ALL ON public.board_designations TO anon, authenticated, service_role;
GRANT ALL ON public.board_members TO anon, authenticated, service_role;
GRANT ALL ON public.board_allowance_sheets TO anon, authenticated, service_role;
GRANT ALL ON public.employee_documents TO anon, authenticated, service_role;
GRANT ALL ON public.downloadable_documents TO anon, authenticated, service_role;


-- ####################################################################
-- PART 5: SEED DEFAULT DATA
-- ####################################################################

-- 5.1 Default Weekend Days & Settings in settings table (Saturday = 6)
INSERT INTO public.settings (id, data, updated_at) VALUES
('saccos_weekend_days', '[6]'::jsonb, NOW())
ON CONFLICT (id) DO NOTHING;

-- 5.2 Default Branches Operational Status
INSERT INTO public.branch_operational_status (branch_id, status, date_bs, notes, updated_at) VALUES
('main', 'OPEN', '2083-01-01', 'Ratauli Head Office operational', NOW()),
('sahodba', 'OPEN', '2083-01-01', 'Sahodba Branch operational', NOW()),
('pipra', 'OPEN', '2083-01-01', 'Pipra Branch operational', NOW()),
('parsa', 'OPEN', '2083-01-01', 'Parsa Branch operational', NOW())
ON CONFLICT (branch_id) DO NOTHING;

-- 5.3 Default Official Nepali 2083 BS Holidays
INSERT INTO public.holidays (id, title, date_bs, type, branch_id, description) VALUES
('hol-1', 'Nepali New Year (Baishakh 1)', '2083-01-01', 'Public Holiday', 'all', 'National New Year 2083 BS'),
('hol-2', 'Buddha Jayanti', '2083-01-28', 'Public Holiday', 'all', 'Lord Buddha 2570th Birth Anniversary'),
('hol-3', 'Constitution Day (Sambidhan Diwas)', '2083-06-03', 'Public Holiday', 'all', 'National Constitution Day'),
('hol-4', 'Dashain (Ghatasthapana)', '2083-06-25', 'Festival', 'all', 'Commencement of Navaratri'),
('hol-5', 'Dashain (Phulpati to Vijaya Dashami)', '2083-07-01', 'Festival', 'all', 'Grand Dashain Festival Public Holidays'),
('hol-6', 'Deepawali / Tihar (Laxmi Puja)', '2083-07-19', 'Festival', 'all', 'Tihar Festival of Lights'),
('hol-7', 'Bhai Tika', '2083-07-22', 'Festival', 'all', 'Tihar Brother-Sister Celebration'),
('hol-8', 'Chhath Puja', '2083-07-28', 'Festival', 'all', 'Major Sun Devotion Festival in Madhesh'),
('hol-9', 'Maghe Sankranti', '2083-10-01', 'Public Holiday', 'all', 'Makar Sankranti Festival'),
('hol-10', 'Maha Shivaratri', '2083-11-27', 'Festival', 'all', 'Lord Shiva Devotion Festival'),
('hol-11', 'Holi (Fagu Purnima)', '2083-12-14', 'Festival', 'all', 'Festival of Colors in Terai/Madhesh')
ON CONFLICT (id) DO NOTHING;

-- 5.4 Default Board Categories
INSERT INTO public.board_categories (id, name, name_np, description, sort_order) VALUES
('cat_bod', 'Board of Directors', 'सञ्चालक समिति', 'Executive governance and policy-making board', 1),
('cat_audit', 'Audit Committee', 'लेखा सुपरीवेक्षण समिति', 'Financial audit, compliance and supervisory board', 2),
('cat_advisory', 'Advisory Committee', 'सल्लाहकार समिति', 'Senior advisory and strategic guidance committee', 3),
('cat_sub_loan', 'Loan Sub-Committee', 'ऋण उपसमिति', 'Credit assessment and loan recommendation committee', 4),
('cat_sub_education', 'Education & Training Sub-Committee', 'शिक्षा तथा तालिम उपसमिति', 'Member education and staff capacity development committee', 5)
ON CONFLICT (id) DO NOTHING;

-- 5.5 Default Board Designations
INSERT INTO public.board_designations (id, name, name_np, rank, description) VALUES
('des_chair', 'Chairperson', 'अध्यक्ष', 1, 'Chief Executive & Board Leader'),
('des_vchair', 'Vice Chairperson', 'उपाध्यक्ष', 2, 'Deputy Board Leader'),
('des_sec', 'General Secretary', 'सचिव', 3, 'Board Executive Secretary'),
('des_treas', 'Treasurer', 'कोषाध्यक्ष', 4, 'Financial Custodian & Treasurer'),
('des_member', 'Director / Member', 'सदस्य', 5, 'Elected Board Director'),
('des_coord', 'Coordinator', 'संयोजक', 6, 'Sub-Committee Coordinator')
ON CONFLICT (id) DO NOTHING;

-- 5.6 Sample Board Members (Chairperson & Secretary)
INSERT INTO public.board_members (
    id, full_name, full_name_np, category_id, category_name, designation, designation_np,
    mobile, email, citizenship_no, branch_id, status,
    tenure, allowance_config, documents
) VALUES
(
    'bm_1', 'RAM CHANDRA SHRESTHA', 'रामचन्द्र श्रेष्ठ', 'cat_bod', 'Board of Directors', 'Chairperson', 'अध्यक्ष',
    '9851023456', 'chairperson@cooperative.org.np', '१७-०१-६९-०४३२१', 'main', 'Active',
    '{"termLabel": "2080 - 2084 (4-Year Term)", "startDateBs": "2080-06-15", "endDateBs": "2084-06-14", "status": "Active"}'::jsonb,
    '{"meetingAllowance": 5000, "communicationAllowance": 2500, "travelAllowance": 3000, "customTdsRate": 15}'::jsonb,
    '[]'::jsonb
),
(
    'bm_2', 'SUNITA DEVI THAPA', 'सुनिता देवी थापा', 'cat_bod', 'Board of Directors', 'General Secretary', 'सचिव',
    '9841876543', 'secretary@cooperative.org.np', '१७-०१-७२-९८२३१', 'main', 'Active',
    '{"termLabel": "2080 - 2084 (4-Year Term)", "startDateBs": "2080-06-15", "endDateBs": "2084-06-14", "status": "Active"}'::jsonb,
    '{"meetingAllowance": 4000, "communicationAllowance": 2000, "travelAllowance": 2500, "customTdsRate": 15}'::jsonb,
    '[]'::jsonb
)
ON CONFLICT (id) DO NOTHING;

-- ====================================================================
-- END OF MIGRATION SCRIPT
-- ====================================================================
