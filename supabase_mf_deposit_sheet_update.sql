-- ============================================================================
-- RATAULI SAVING AND CREDIT COOPERATIVE LIMITED
-- MICRO-FINANCE LATEST UPDATES (DEPOSIT SHEET + SAFEGUARDS) - SUPABASE SQL
-- ============================================================================
-- How to Run:
--   1. Open Supabase Dashboard -> SQL Editor -> New Query
--   2. Paste this ENTIRE script and click "Run"
-- 100% Idempotent: Safe to run on both fresh and existing databases.
--
-- Covers recent updates:
--   1. NEW Table: public.mf_deposit_sheets
--      (Reports -> Deposit Sheet with per-row Save, Save All, Year/Month/Day/
--       Center/Group/Employee filters, auto-sum Total, and Employee signature)
--   2. Column & Index safeguards for:
--      - public.mf_members          (Post/role column + duplicate lookup indexes)
--      - public.mf_savings          (date_bs, saving_type, status + active duplicate index)
--      - public.mf_signature_sheets (members JSONB containing member Post/role)
--   3. Role Permissions sync:
--      - Grants `sub_mf_deposit_sheet_view` to existing roles that already
--        have `sub_mf_signature_sheet_view` (safe for jsonb / text[] columns)
-- ============================================================================

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ############################################################################
-- 1. NEW TABLE: MICRO-FINANCE DEPOSIT SHEETS (public.mf_deposit_sheets)
-- ############################################################################

CREATE TABLE IF NOT EXISTS public.mf_deposit_sheets (
    id TEXT PRIMARY KEY,
    sheet_no TEXT NOT NULL,
    year TEXT DEFAULT '',
    month TEXT DEFAULT '',
    day TEXT DEFAULT '',
    date_bs TEXT DEFAULT '',
    date_display TEXT DEFAULT '',
    center_id TEXT NOT NULL,
    center_name TEXT DEFAULT '',
    group_id TEXT NOT NULL,
    group_name TEXT DEFAULT '',
    location TEXT DEFAULT '',
    branch_name TEXT DEFAULT '',
    employee_name TEXT DEFAULT '',
    rows JSONB NOT NULL DEFAULT '[]'::jsonb,
    total_saving NUMERIC NOT NULL DEFAULT 0,
    total_loan NUMERIC NOT NULL DEFAULT 0,
    grand_total NUMERIC NOT NULL DEFAULT 0,
    created_at TEXT,
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Safe idempotent column guards (in case table already exists)
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS sheet_no TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS year TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS month TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS day TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS date_bs TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS date_display TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS center_id TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS center_name TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS group_id TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS group_name TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS location TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS branch_name TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS employee_name TEXT DEFAULT '';
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS rows JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS total_saving NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS total_loan NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS grand_total NUMERIC NOT NULL DEFAULT 0;
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS created_at TEXT;
ALTER TABLE public.mf_deposit_sheets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Performance Indexes for Deposit Sheets
CREATE INDEX IF NOT EXISTS idx_mf_deposit_sheets_group_date
    ON public.mf_deposit_sheets (group_id, date_bs);

CREATE INDEX IF NOT EXISTS idx_mf_deposit_sheets_center_group
    ON public.mf_deposit_sheets (center_id, group_id);

CREATE INDEX IF NOT EXISTS idx_mf_deposit_sheets_year_month
    ON public.mf_deposit_sheets (year, month);

CREATE INDEX IF NOT EXISTS idx_mf_deposit_sheets_date_bs
    ON public.mf_deposit_sheets (date_bs);

-- Disable RLS & Grant Permissions (matches existing mf_* tables)
ALTER TABLE public.mf_deposit_sheets DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.mf_deposit_sheets
    TO anon, authenticated, service_role;


-- ############################################################################
-- 2. SAFEGUARDS & INDEXES FOR RECENT MICRO-FINANCE UPDATES
-- ############################################################################

-- 2A. mf_members: Post/Designation (role) for Signature Sheet & Group Members popup
--     + indexes for fast duplicate member checks (Member ID & Citizenship No)
ALTER TABLE public.mf_members ADD COLUMN IF NOT EXISTS role TEXT DEFAULT 'Member';
ALTER TABLE public.mf_members ADD COLUMN IF NOT EXISTS citizenship_no TEXT DEFAULT '';
ALTER TABLE public.mf_members ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_mf_members_member_id
    ON public.mf_members (member_id);

CREATE INDEX IF NOT EXISTS idx_mf_members_citizenship_no
    ON public.mf_members (citizenship_no);

CREATE INDEX IF NOT EXISTS idx_mf_members_samuh_id
    ON public.mf_members (samuh_id);

-- 2B. mf_savings: date_bs (used for ID Card Issued Date & Valid +6 Years)
--     + index for fast duplicate active product check (member_id + saving_type + status)
ALTER TABLE public.mf_savings ADD COLUMN IF NOT EXISTS date_bs TEXT DEFAULT '';
ALTER TABLE public.mf_savings ADD COLUMN IF NOT EXISTS saving_type TEXT DEFAULT 'Compulsory';
ALTER TABLE public.mf_savings ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ACTIVE';
ALTER TABLE public.mf_savings ADD COLUMN IF NOT EXISTS remarks TEXT DEFAULT '';
ALTER TABLE public.mf_savings ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_mf_savings_member_type_status
    ON public.mf_savings (member_id, saving_type, status);

CREATE INDEX IF NOT EXISTS idx_mf_savings_member_date_bs
    ON public.mf_savings (member_id, date_bs);

-- 2C. mf_signature_sheets: ensure members JSONB (now stores member Post/role)
ALTER TABLE public.mf_signature_sheets ADD COLUMN IF NOT EXISTS members JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE public.mf_signature_sheets ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

CREATE INDEX IF NOT EXISTS idx_mf_sig_sheets_date_bs
    ON public.mf_signature_sheets (date_bs);


-- ############################################################################
-- 3. OPTIONAL RBAC SYNC: GRANT DEPOSIT SHEET PERMISSION TO EXISTING ROLES
--    THAT ALREADY HAVE SIGNATURE SHEET ACCESS
-- ############################################################################

DO $$
DECLARE
    col_type TEXT;
BEGIN
    SELECT data_type INTO col_type
    FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'roles'
      AND column_name = 'permissions';

    IF col_type = 'jsonb' THEN
        UPDATE public.roles
        SET permissions = permissions || '["sub_mf_deposit_sheet_view", "sub_mf_deposit_sheet_edit"]'::jsonb
        WHERE jsonb_typeof(permissions) = 'array'
          AND permissions ? 'sub_mf_signature_sheet_view'
          AND NOT (permissions ? 'sub_mf_deposit_sheet_view');
    ELSIF col_type = 'ARRAY' THEN
        UPDATE public.roles
        SET permissions = array_cat(permissions, ARRAY['sub_mf_deposit_sheet_view', 'sub_mf_deposit_sheet_edit'])
        WHERE 'sub_mf_signature_sheet_view' = ANY(permissions)
          AND NOT ('sub_mf_deposit_sheet_view' = ANY(permissions));
    END IF;
END $$;

-- Reload PostgREST schema cache so mf_deposit_sheets is available immediately
NOTIFY pgrst, 'reload schema';
