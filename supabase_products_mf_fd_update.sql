-- ============================================================================
-- RATAULI COOPERATIVE SYSTEM - SAVING & LOAN PRODUCTS (SEPARATE MF & FD) SQL
-- ============================================================================
-- Run this idempotent script in Supabase SQL Editor so saving_products stores
-- separate show_in_mf and show_in_fd columns and loan_products stores show_in_mf.

CREATE TABLE IF NOT EXISTS public.saving_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_np TEXT,
    interest_rate NUMERIC NOT NULL DEFAULT 0,
    capitalization TEXT NOT NULL DEFAULT 'Quarterly',
    minimum_balance NUMERIC DEFAULT 0,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    show_in_mf BOOLEAN DEFAULT false,
    show_in_fd BOOLEAN DEFAULT false,
    show_in_mf_fd BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS name_np TEXT;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS show_in_mf BOOLEAN DEFAULT false;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS show_in_fd BOOLEAN DEFAULT false;
ALTER TABLE public.saving_products ADD COLUMN IF NOT EXISTS show_in_mf_fd BOOLEAN DEFAULT false;

-- Migrate any existing combined MF & FD flags into the separate columns
UPDATE public.saving_products
SET
    show_in_mf = COALESCE(show_in_mf, false) OR COALESCE(show_in_mf_fd, false),
    show_in_fd = COALESCE(show_in_fd, false) OR COALESCE(show_in_mf_fd, false)
WHERE COALESCE(show_in_mf_fd, false) = true;

CREATE TABLE IF NOT EXISTS public.loan_products (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    name_np TEXT,
    interest_rate NUMERIC NOT NULL DEFAULT 0,
    installment TEXT NOT NULL DEFAULT 'Monthly',
    max_tenure_months INT DEFAULT 36,
    description TEXT,
    status TEXT NOT NULL DEFAULT 'Active',
    show_in_mf BOOLEAN DEFAULT false,
    show_in_mf_fd BOOLEAN DEFAULT false,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    created_by TEXT
);

ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS name_np TEXT;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS show_in_mf BOOLEAN DEFAULT false;
ALTER TABLE public.loan_products ADD COLUMN IF NOT EXISTS show_in_mf_fd BOOLEAN DEFAULT false;

UPDATE public.loan_products
SET show_in_mf = COALESCE(show_in_mf, false) OR COALESCE(show_in_mf_fd, false)
WHERE COALESCE(show_in_mf_fd, false) = true;

ALTER TABLE public.saving_products DISABLE ROW LEVEL SECURITY;
ALTER TABLE public.loan_products DISABLE ROW LEVEL SECURITY;

GRANT ALL ON TABLE public.saving_products TO anon, authenticated, service_role;
GRANT ALL ON TABLE public.loan_products TO anon, authenticated, service_role;
