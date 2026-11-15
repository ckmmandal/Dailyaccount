-- =========================================================================
-- COMPLETE SUPABASE SQL SCHEMA UPDATE SCRIPT FOR INSURANCE RECORDS SYSTEM
-- Run this in your Supabase Project SQL Editor to ensure all tables,
-- new columns, and indexes are up-to-date and ready for data storage.
-- =========================================================================

-- 1. Ensure the insurance_records table exists
CREATE TABLE IF NOT EXISTS insurance_records (
    id BIGSERIAL PRIMARY KEY,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Add all core fields (if not already present)
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS sn SERIAL;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS name TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS gender TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS citizenship_no TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS customer_id TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS policy_no TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS dob DATE;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS dob_bs TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS age INTEGER;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS address TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS occupation TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS disability TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS living_active_life TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS branch TEXT DEFAULT '1';
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS loan_type TEXT DEFAULT 'General';
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS policy_amount NUMERIC DEFAULT 0;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS premium NUMERIC DEFAULT 0;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS start_date DATE;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS doc_bs TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS maturity_date DATE;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'start_policy';
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS remark TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS confidence NUMERIC;

-- 3. Add Nominee details
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS nominee_name TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS nominee_relation TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS nominee_dob DATE;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS nominee_dob_bs TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS nominee_gender TEXT;

-- 4. Add NEW Fields for Top-up, Durations, Multi-year terms, and Extended Dates
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS term_month INTEGER DEFAULT 12;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS maturity_date_bs TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS insurance_start_date DATE;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS insurance_start_date_bs TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS insurance_paid_to_date DATE;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS insurance_paid_to_date_bs TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS insurance_term_month INTEGER DEFAULT 12;

-- 5. Add Premium Payment Tracking fields
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS premium_payment_status TEXT DEFAULT 'Paid';
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS premium_payment_remark TEXT;

-- 6. Add Digital Photos, Signatures & Linkages
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS member_photo TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS signature_member TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS signature_manager TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS signature_officer TEXT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS parent_record_id BIGINT;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS is_topup BOOLEAN DEFAULT FALSE;
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS renewed_from_id BIGINT;

-- 7. Performance Indexes for Fast Searching & Filtering
CREATE INDEX IF NOT EXISTS idx_insurance_records_citizenship ON insurance_records(citizenship_no);
CREATE INDEX IF NOT EXISTS idx_insurance_records_name ON insurance_records(name);
CREATE INDEX IF NOT EXISTS idx_insurance_records_branch ON insurance_records(branch);
CREATE INDEX IF NOT EXISTS idx_insurance_records_status ON insurance_records(status);
CREATE INDEX IF NOT EXISTS idx_insurance_records_start_date ON insurance_records(start_date);
CREATE INDEX IF NOT EXISTS idx_insurance_records_maturity_date ON insurance_records(maturity_date);
CREATE INDEX IF NOT EXISTS idx_insurance_records_premium_status ON insurance_records(premium_payment_status);

-- 8. Reload PostgREST Schema Cache (Instant synchronization without restarting database)
NOTIFY pgrst, 'reload schema';
