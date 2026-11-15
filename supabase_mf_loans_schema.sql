-- ============================================================================
-- RATAULI SAVING AND CREDIT COOPERATIVE LTD - MICROFINANCE LOANS TABLE
-- Stores all Microfinance loans (ACTIVE, MATURED, CLOSED) in Supabase.
-- Only ACTIVE & MATURED loans are loaded in the main UI for minimal load;
-- CLOSED loans remain archived and are queried on-demand for past-date
-- Collection Sheets where closed_date_bs > selected_report_date_bs.
-- ============================================================================

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

-- Safely ensure new columns exist if table already existed
ALTER TABLE public.mf_loans ADD COLUMN IF NOT EXISTS closed_date TEXT DEFAULT '';
ALTER TABLE public.mf_loans ADD COLUMN IF NOT EXISTS closed_date_bs TEXT DEFAULT '';
ALTER TABLE public.mf_loans ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT NOW();

-- Indexes for fast active-only fetch & date-range historical report queries
CREATE INDEX IF NOT EXISTS idx_mf_loans_status ON public.mf_loans(status);
CREATE INDEX IF NOT EXISTS idx_mf_loans_closed_date_bs ON public.mf_loans(closed_date_bs);
CREATE INDEX IF NOT EXISTS idx_mf_loans_loan_date_bs ON public.mf_loans(loan_date_bs);
CREATE INDEX IF NOT EXISTS idx_mf_loans_center_group ON public.mf_loans(center_name, group_name);

ALTER TABLE public.mf_loans DISABLE ROW LEVEL SECURITY;
