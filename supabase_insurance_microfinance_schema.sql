-- ============================================================================
-- RATAULI SAVING AND CREDIT COOPERATIVE LIMITED
-- INSURANCE MANAGEMENT (BIMA) & FULL MICRO-FINANCE OPERATIONS - SUPABASE SQL
-- ============================================================================
-- How to Run:
--   1. Open Supabase Dashboard -> SQL Editor -> New Query
--   2. Paste this ENTIRE script and click "Run"
-- Safe to run on BOTH a new database and an existing database (100% Idempotent).
--
-- Covers:
--   A. INSURANCE MANAGEMENT (BIMA):
--      1. insurance_companies     (Partner insurance companies & premium rates)
--      2. loan_insurance_records  (Loan policies, nominees, BS/AD dates, premiums)
--      3. insurance_claims        (Claims, lifecycle stages, payouts & settlements)
--
--   B. MICRO-FINANCE OPERATIONS (FULL TABLES):
--      4. mf_centers              (Kendra / Centers)
--      5. mf_groups               (Samuh / Groups)
--      6. mf_members              (Micro-Finance Members)
--      7. mf_savings              (Compulsory, Optional, Recurring Savings)
--      8. mf_loans                (Active, Matured & Closed MF Loans)
--      9. mf_collection_sheets    (Monthly/Daily Collection Sheets)
--     10. mf_signature_sheets     (Permanent Signature Sheets)
--     11. group_meetings          (Samuh Meetings, Attendance & Decisions)
--     12. mf_settings             (MF Rates, Loan Schemes, Officers & Templates)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ############################################################################
-- PART A: INSURANCE MANAGEMENT (BIMA)
-- ############################################################################

-- 1. INSURANCE PARTNER COMPANIES TABLE
CREATE TABLE IF NOT EXISTS public.insurance_companies (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL,
    contact_person TEXT,
    phone TEXT,
    email TEXT,
    portal_url TEXT,
    default_premium_rate NUMERIC DEFAULT 0.35,
    status TEXT NOT NULL DEFAULT 'Active',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS contact_person TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS portal_url TEXT;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS default_premium_rate NUMERIC DEFAULT 0.35;
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active';
ALTER TABLE public.insurance_companies ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 2. LOAN INSURANCE POLICY RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.loan_insurance_records (
    id TEXT PRIMARY KEY,
    sn INT,
    policy_no TEXT NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    gender TEXT,
    citizenship_no TEXT,
    contact_number TEXT,
    branch_id TEXT DEFAULT 'main',
    branch TEXT,
    loan_account_no TEXT,
    loan_type TEXT,
    loan_disbursed_date TEXT,
    loan_disbursed_date_bs TEXT,
    loan_expiry_date TEXT,
    loan_expiry_date_bs TEXT,
    loan_amount NUMERIC DEFAULT 0,
    outstanding_balance NUMERIC DEFAULT 0,
    insurance_company TEXT,
    insurance_type TEXT,
    sum_assured NUMERIC DEFAULT 0,
    premium_rate_percent NUMERIC DEFAULT 0,
    premium_amount NUMERIC DEFAULT 0,
    policy_start_date TEXT,
    policy_start_date_bs TEXT,
    policy_expiry_date TEXT,
    policy_expiry_date_bs TEXT,
    status TEXT NOT NULL DEFAULT 'Active (Start Policy)',
    term_months INT DEFAULT 12,
    age INT,
    date_of_birth TEXT,
    date_of_birth_bs TEXT,
    address TEXT,
    occupation TEXT,
    disability TEXT DEFAULT 'None',
    living_active_life TEXT DEFAULT 'Yes',
    living_status TEXT DEFAULT 'Active / Normal Life',
    nominee_name TEXT,
    nominee_relation TEXT,
    nominee_contact TEXT,
    nominee_citizenship TEXT,
    nominee_dob TEXT,
    nominee_dob_bs TEXT,
    nominee_gender TEXT,
    document_url TEXT,
    document_name TEXT,
    ocr_extracted_text TEXT,
    confidence NUMERIC,
    premium_payment_status TEXT DEFAULT 'Paid',
    premium_payment_remark TEXT,
    loan_duration_years NUMERIC,
    paid_years NUMERIC,
    due_years NUMERIC,
    insurance_till_date TEXT,
    insurance_till_date_bs TEXT,
    is_premium_saved BOOLEAN DEFAULT false,
    is_first_policy BOOLEAN DEFAULT true,
    member_photo TEXT,
    signature_member TEXT,
    signature_manager TEXT,
    signature_officer TEXT,
    notes TEXT,
    created_at BIGINT,
    updated_at BIGINT,
    inserted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS sn INT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS citizenship_no TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS contact_number TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS branch_id TEXT DEFAULT 'main';
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS branch TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS loan_account_no TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS loan_type TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS loan_disbursed_date TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS loan_disbursed_date_bs TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS loan_expiry_date TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS loan_expiry_date_bs TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS outstanding_balance NUMERIC DEFAULT 0;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS premium_rate_percent NUMERIC DEFAULT 0;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS policy_start_date_bs TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS policy_expiry_date_bs TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS term_months INT DEFAULT 12;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS age INT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS date_of_birth TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS date_of_birth_bs TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS disability TEXT DEFAULT 'None';
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS living_active_life TEXT DEFAULT 'Yes';
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS living_status TEXT DEFAULT 'Active / Normal Life';
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS nominee_contact TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS nominee_citizenship TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS nominee_dob TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS nominee_dob_bs TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS nominee_gender TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS document_url TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS document_name TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS ocr_extracted_text TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS confidence NUMERIC;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS premium_payment_status TEXT DEFAULT 'Paid';
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS premium_payment_remark TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS loan_duration_years NUMERIC;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS paid_years NUMERIC;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS due_years NUMERIC;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS insurance_till_date TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS insurance_till_date_bs TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS is_premium_saved BOOLEAN DEFAULT false;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS is_first_policy BOOLEAN DEFAULT true;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS member_photo TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS signature_member TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS signature_manager TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS signature_officer TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS created_at BIGINT;
ALTER TABLE public.loan_insurance_records ADD COLUMN IF NOT EXISTS updated_at BIGINT;

-- 3. INSURANCE CLAIMS & SETTLEMENT LIFECYCLE TABLE
CREATE TABLE IF NOT EXISTS public.insurance_claims (
    id TEXT PRIMARY KEY,
    claim_no TEXT NOT NULL,
    insurance_record_id TEXT,
    policy_no TEXT NOT NULL,
    member_id TEXT NOT NULL,
    member_name TEXT NOT NULL,
    citizenship_no TEXT,
    loan_account_no TEXT,
    branch_id TEXT DEFAULT 'main',
    claim_date TEXT NOT NULL,
    claim_date_bs TEXT,
    incident_date TEXT,
    incident_date_bs TEXT,
    claim_cause TEXT NOT NULL,
    outstanding_loan_at_claim NUMERIC DEFAULT 0,
    claim_amount_requested NUMERIC DEFAULT 0,
    claim_amount_approved NUMERIC DEFAULT 0,
    disbursed_amount NUMERIC DEFAULT 0,
    disbursement_date TEXT,
    disbursement_date_bs TEXT,
    payout_method TEXT,
    lifecycle_stage TEXT DEFAULT 'Claim Submission',
    status TEXT NOT NULL DEFAULT 'Submitted',
    insurer_reference_no TEXT,
    settlement_date TEXT,
    settlement_date_bs TEXT,
    settlement_voucher_no TEXT,
    death_certificate_no TEXT,
    hospital_report_summary TEXT,
    verified_by TEXT,
    approved_by TEXT,
    remarks TEXT,
    supporting_documents JSONB DEFAULT '[]'::jsonb,
    document_url TEXT,
    created_at BIGINT,
    updated_at BIGINT,
    inserted_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS claim_date_bs TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS incident_date_bs TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS disbursed_amount NUMERIC DEFAULT 0;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS disbursement_date TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS disbursement_date_bs TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS payout_method TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS lifecycle_stage TEXT DEFAULT 'Claim Submission';
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS insurer_reference_no TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS settlement_date TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS settlement_date_bs TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS settlement_voucher_no TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS death_certificate_no TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS hospital_report_summary TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS verified_by TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS approved_by TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS remarks TEXT;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS supporting_documents JSONB DEFAULT '[]'::jsonb;
ALTER TABLE public.insurance_claims ADD COLUMN IF NOT EXISTS document_url TEXT;


-- ############################################################################
-- PART B: FULL MICRO-FINANCE OPERATIONS (ALL TABLES)
-- ############################################################################

-- 4. MICRO-FINANCE CENTERS (KENDRA) TABLE
CREATE TABLE IF NOT EXISTS public.mf_centers (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    location TEXT DEFAULT '',
    branch TEXT DEFAULT '',
    meeting_day TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    field_officer TEXT DEFAULT '',
    contact_no TEXT DEFAULT '',
    created_at TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mf_centers ADD COLUMN IF NOT EXISTS field_officer TEXT DEFAULT '';
ALTER TABLE public.mf_centers ADD COLUMN IF NOT EXISTS contact_no TEXT DEFAULT '';
ALTER TABLE public.mf_centers ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 5. MICRO-FINANCE GROUPS (SAMUH) TABLE
CREATE TABLE IF NOT EXISTS public.mf_groups (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    center_id TEXT NOT NULL,
    center_name TEXT DEFAULT '',
    place TEXT DEFAULT '',
    members_count INT DEFAULT 0,
    meeting_day TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    leader_name TEXT DEFAULT '',
    leader_mobile TEXT DEFAULT '',
    created_at TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mf_groups ADD COLUMN IF NOT EXISTS leader_name TEXT DEFAULT '';
ALTER TABLE public.mf_groups ADD COLUMN IF NOT EXISTS leader_mobile TEXT DEFAULT '';
ALTER TABLE public.mf_groups ADD COLUMN IF NOT EXISTS members_count INT DEFAULT 0;
ALTER TABLE public.mf_groups ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 6. MICRO-FINANCE MEMBERS TABLE
CREATE TABLE IF NOT EXISTS public.mf_members (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    name TEXT NOT NULL,
    citizenship_no TEXT DEFAULT '',
    mobile TEXT DEFAULT '',
    gender TEXT DEFAULT 'Female',
    branch TEXT DEFAULT '',
    center_id TEXT DEFAULT '',
    center_name TEXT DEFAULT '',
    samuh_id TEXT DEFAULT '',
    samuh_name TEXT DEFAULT '',
    role TEXT DEFAULT 'Member',
    savings_account_no TEXT DEFAULT '',
    address TEXT DEFAULT '',
    joined_date TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'ACTIVE',
    total_savings NUMERIC DEFAULT 0,
    active_loan_amount NUMERIC DEFAULT 0,
    photo_url TEXT,
    created_at TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mf_members ADD COLUMN IF NOT EXISTS photo_url TEXT;
ALTER TABLE public.mf_members ADD COLUMN IF NOT EXISTS total_savings NUMERIC DEFAULT 0;
ALTER TABLE public.mf_members ADD COLUMN IF NOT EXISTS active_loan_amount NUMERIC DEFAULT 0;
ALTER TABLE public.mf_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 7. MICRO-FINANCE SAVINGS RECORDS TABLE
CREATE TABLE IF NOT EXISTS public.mf_savings (
    id TEXT PRIMARY KEY,
    member_id TEXT NOT NULL,
    account_no TEXT NOT NULL,
    name TEXT NOT NULL,
    group_name TEXT DEFAULT '',
    center_name TEXT DEFAULT '',
    date TEXT DEFAULT '',
    date_bs TEXT DEFAULT '',
    amount NUMERIC NOT NULL DEFAULT 0,
    saving_type TEXT DEFAULT 'Compulsory',
    status TEXT NOT NULL DEFAULT 'PAID',
    collected_by TEXT DEFAULT '',
    created_by TEXT,
    created_by_name TEXT,
    receipt_no TEXT DEFAULT '',
    remarks TEXT DEFAULT '',
    created_at TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mf_savings ADD COLUMN IF NOT EXISTS date_bs TEXT DEFAULT '';
ALTER TABLE public.mf_savings ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.mf_savings ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.mf_savings ADD COLUMN IF NOT EXISTS receipt_no TEXT DEFAULT '';
ALTER TABLE public.mf_savings ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT '';
ALTER TABLE public.mf_savings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 8. MICRO-FINANCE LOANS TABLE (ACTIVE, MATURED & CLOSED)
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
    created_by TEXT,
    created_by_name TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.mf_loans ADD COLUMN IF NOT EXISTS closed_date TEXT DEFAULT '';
ALTER TABLE public.mf_loans ADD COLUMN IF NOT EXISTS closed_date_bs TEXT DEFAULT '';
ALTER TABLE public.mf_loans ADD COLUMN IF NOT EXISTS created_by TEXT;
ALTER TABLE public.mf_loans ADD COLUMN IF NOT EXISTS created_by_name TEXT;
ALTER TABLE public.mf_loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- 9. MICRO-FINANCE COLLECTION SHEETS TABLE
CREATE TABLE IF NOT EXISTS public.mf_collection_sheets (
    id TEXT PRIMARY KEY,
    center_id TEXT NOT NULL,
    center_name TEXT DEFAULT '',
    group_id TEXT NOT NULL,
    group_name TEXT DEFAULT '',
    year TEXT DEFAULT '',
    month TEXT DEFAULT '',
    day TEXT DEFAULT '',
    date_display TEXT DEFAULT '',
    status TEXT NOT NULL DEFAULT 'GENERATED',
    total_compulsory_saving NUMERIC DEFAULT 0,
    total_optional_saving NUMERIC DEFAULT 0,
    total_loan_principal NUMERIC DEFAULT 0,
    total_loan_interest NUMERIC DEFAULT 0,
    total_expected NUMERIC DEFAULT 0,
    total_collected NUMERIC DEFAULT 0,
    member_count INT DEFAULT 0,
    collected_by TEXT DEFAULT '',
    created_at TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 10. MICRO-FINANCE PERMANENT SIGNATURE SHEETS TABLE
CREATE TABLE IF NOT EXISTS public.mf_signature_sheets (
    id TEXT PRIMARY KEY,
    sheet_no TEXT NOT NULL,
    center_id TEXT NOT NULL,
    center_name TEXT DEFAULT '',
    group_id TEXT NOT NULL,
    group_name TEXT DEFAULT '',
    date_bs TEXT DEFAULT '',
    location TEXT DEFAULT '',
    branch_name TEXT DEFAULT '',
    branch_address TEXT DEFAULT '',
    members JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_members INT DEFAULT 0,
    total_savings NUMERIC DEFAULT 0,
    total_loans NUMERIC DEFAULT 0,
    total_due NUMERIC DEFAULT 0,
    officer_name TEXT DEFAULT '',
    created_at TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 11. MICRO-FINANCE GROUP MEETINGS & MINUTES TABLE
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

-- 12. MICRO-FINANCE SETTINGS & MEETING PROPOSAL TEMPLATES STORE
-- Holds keys: 'mf_general_settings', 'mf_meeting_settings', 'mf_proposal_templates'
CREATE TABLE IF NOT EXISTS public.mf_settings (
    id TEXT PRIMARY KEY,
    data JSONB NOT NULL DEFAULT '{}'::jsonb,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);


-- ############################################################################
-- PART C: PERFORMANCE INDEXES
-- ############################################################################

CREATE INDEX IF NOT EXISTS idx_ins_rec_policy_no ON public.loan_insurance_records(policy_no);
CREATE INDEX IF NOT EXISTS idx_ins_rec_member_id ON public.loan_insurance_records(member_id);
CREATE INDEX IF NOT EXISTS idx_ins_rec_branch ON public.loan_insurance_records(branch_id);
CREATE INDEX IF NOT EXISTS idx_ins_rec_status ON public.loan_insurance_records(status);
CREATE INDEX IF NOT EXISTS idx_ins_rec_expiry ON public.loan_insurance_records(policy_expiry_date);

CREATE INDEX IF NOT EXISTS idx_ins_claims_policy ON public.insurance_claims(policy_no);
CREATE INDEX IF NOT EXISTS idx_ins_claims_rec_id ON public.insurance_claims(insurance_record_id);
CREATE INDEX IF NOT EXISTS idx_ins_claims_branch ON public.insurance_claims(branch_id);
CREATE INDEX IF NOT EXISTS idx_ins_claims_status ON public.insurance_claims(status);

CREATE INDEX IF NOT EXISTS idx_mf_centers_branch ON public.mf_centers(branch);
CREATE INDEX IF NOT EXISTS idx_mf_groups_center ON public.mf_groups(center_id);
CREATE INDEX IF NOT EXISTS idx_mf_members_center_samuh ON public.mf_members(center_id, samuh_id);
CREATE INDEX IF NOT EXISTS idx_mf_members_member_id ON public.mf_members(member_id);
CREATE INDEX IF NOT EXISTS idx_mf_savings_member_date ON public.mf_savings(member_id, date_bs);
CREATE INDEX IF NOT EXISTS idx_mf_loans_status ON public.mf_loans(status);
CREATE INDEX IF NOT EXISTS idx_mf_loans_closed_date_bs ON public.mf_loans(closed_date_bs);
CREATE INDEX IF NOT EXISTS idx_mf_loans_loan_date_bs ON public.mf_loans(loan_date_bs);
CREATE INDEX IF NOT EXISTS idx_mf_loans_center_group ON public.mf_loans(center_name, group_name);
CREATE INDEX IF NOT EXISTS idx_mf_sheets_center_group ON public.mf_collection_sheets(center_id, group_id);
CREATE INDEX IF NOT EXISTS idx_mf_sig_sheets_date ON public.mf_signature_sheets(date_bs);
CREATE INDEX IF NOT EXISTS idx_group_meetings_date ON public.group_meetings(meeting_date_bs);


-- ############################################################################
-- PART D: DISABLE RLS & GRANT SUPABASE CLIENT PERMISSIONS
-- ############################################################################

ALTER TABLE public.insurance_companies DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_insurance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.insurance_claims DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_centers DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_groups DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_members DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_savings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_loans DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_collection_sheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_signature_sheets DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.group_meetings DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.mf_settings DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE
    public.insurance_companies,
    public.loan_insurance_records,
    public.insurance_claims,
    public.mf_centers,
    public.mf_groups,
    public.mf_members,
    public.mf_savings,
    public.mf_loans,
    public.mf_collection_sheets,
    public.mf_signature_sheets,
    public.group_meetings,
    public.mf_settings
TO anon, authenticated, service_role;


-- ############################################################################
-- PART E: DEFAULT SEED DATA (INSURANCE COMPANIES & MF SETTINGS)
-- ############################################################################

INSERT INTO public.insurance_companies (id, name, code, contact_person, phone, email, portal_url, default_premium_rate, status) VALUES
('comp_nli', 'National Life Insurance Co. Ltd.', 'NLI', 'Sushil Kumar Sharma (Chief Underwriter)', '01-4445870 / 9851088770', 'info@nationallife.com.np', 'https://nationallife.com.np', 0.35, 'Active'),
('comp_nmi', 'Nepal Micro Insurance Co. Ltd.', 'NMI', 'Surendra Prasad Yadav (Branch Incharge, Janakpur)', '01-5912440 / 9801239840', 'micro@nepalmicro.com.np', 'https://nepalmicro.com.np', 0.35, 'Active'),
('comp_sic', 'Shikhar Insurance Co. Ltd.', 'SIC', 'Rajesh Kumar Karna (Sr. Claims Officer)', '01-4246101 / 9841203344', 'claim@shikharinsurance.com', 'https://shikharinsurance.com', 0.40, 'Active'),
('comp_sgic', 'Sanima GIC Insurance Ltd.', 'SGIC', 'Amit Kumar Singh', '01-4541200', 'care@sanimagic.com', 'https://sanimagic.com', 0.35, 'Active'),
('comp_icpf', 'Internal Cooperative Credit Protection Fund', 'RAT-ICPF', 'Chandra Shekhar Mandal (Manager / Admin)', '044-520123 / 9854020123', 'info.rataulisaccos@gmail.com', '', 0.30, 'Active')
ON CONFLICT (id) DO NOTHING;

INSERT INTO public.mf_settings (id, data) VALUES
(
    'mf_general_settings',
    '{
        "interestRateDefault": 14,
        "compulsorySavingDefault": 500,
        "meetingFrequency": "Monthly",
        "penaltyPerDayLate": 10,
        "loanSchemes": [
            {"id": "sch-1", "name": "General Group Loan", "rate": 14, "maxLimit": 300000, "maxMonths": 24},
            {"id": "sch-2", "name": "Agriculture & Livestock Loan", "rate": 13, "maxLimit": 500000, "maxMonths": 36},
            {"id": "sch-3", "name": "Emergency Loan", "rate": 12, "maxLimit": 50000, "maxMonths": 12}
        ],
        "fieldOfficers": ["Ramesh Sharma", "Sita Ram Yadav", "Prakash Mandal"]
    }'::jsonb
)
ON CONFLICT (id) DO NOTHING;
