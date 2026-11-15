-- ==========================================
-- SUPABASE / POSTGRESQL DATABASE SETUP SCRIPT
-- Application: Microinsurance & SACCOS System
-- Language: SQL (run in Supabase SQL Editor)
-- ==========================================

-- 1. CLEANUP EXTING TABLES (CAUTION: RUN ONLY IF RE-INITIALIZING)
-- DROP TABLE IF EXISTS audit_logs CASCADE;
-- DROP TABLE IF EXISTS settings CASCADE;
-- DROP TABLE IF EXISTS documents CASCADE;
-- DROP TABLE IF EXISTS notices CASCADE;
-- DROP TABLE IF EXISTS claims CASCADE;
-- DROP TABLE IF EXISTS insurance_records CASCADE;
-- DROP TABLE IF EXISTS users CASCADE;
-- DROP TABLE IF EXISTS roles CASCADE;

-- 2. CREATE ROLES TABLE
CREATE TABLE IF NOT EXISTS roles (
    id SERIAL PRIMARY KEY,
    role_name TEXT UNIQUE NOT NULL,
    permissions JSONB DEFAULT '{}'::jsonb
);

-- 3. CREATE USERS TABLE
CREATE TABLE IF NOT EXISTS users (
    id SERIAL PRIMARY KEY,
    name TEXT,
    email TEXT UNIQUE NOT NULL,
    password TEXT NOT NULL,
    role_id INTEGER REFERENCES roles(id) ON DELETE SET NULL,
    avatar_url TEXT,
    signature_url TEXT,
    branch TEXT,
    serial_no INTEGER,
    permissions JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 4. CREATE INSURANCE RECORDS TABLE
CREATE TABLE IF NOT EXISTS insurance_records (
    id SERIAL PRIMARY KEY,
    sn SERIAL,
    name TEXT NOT NULL,
    gender TEXT,
    citizenship_no TEXT NOT NULL,
    customer_id TEXT,
    policy_no TEXT,
    dob DATE,
    dob_bs TEXT,
    age INTEGER,
    address TEXT,
    nominee_name TEXT,
    nominee_relation TEXT,
    nominee_dob DATE,
    nominee_dob_bs TEXT,
    nominee_gender TEXT,
    loan_type TEXT,
    loan_amount NUMERIC(15,2) DEFAULT 0,
    policy_amount NUMERIC(15,2) DEFAULT 0,
    premium NUMERIC(15,2) DEFAULT 0,
    premium_amount NUMERIC(15,2) DEFAULT 0,
    start_date DATE,
    maturity_date DATE,
    term_month INTEGER,
    occupation TEXT,
    disability TEXT,
    living_active_life TEXT,
    branch TEXT,
    status TEXT DEFAULT 'Pending', -- 'Pending', 'renewed', 'rejected', 'start_policy'
    remark TEXT,
    confidence NUMERIC(5,2),
    doc_bs TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 5. CREATE CLAIMS TABLE
CREATE TABLE IF NOT EXISTS claims (
    id SERIAL PRIMARY KEY,
    record_id INTEGER REFERENCES insurance_records(id) ON DELETE CASCADE,
    name TEXT,
    citizenship_no TEXT,
    policy_no TEXT,
    premium_amount NUMERIC(15,2) DEFAULT 0,
    claim_amount NUMERIC(15,2) DEFAULT 0,
    approved_amount NUMERIC(15,2) DEFAULT 0,
    incident_date TEXT,
    reason TEXT,
    status TEXT DEFAULT 'Submitted', -- 'Submitted', 'Approved', 'Rejected', 'Settled'
    submitted_by TEXT,
    branch TEXT,
    supporting_docs JSONB DEFAULT '[]'::jsonb,
    evaluation JSONB DEFAULT '{}'::jsonb,
    verification JSONB DEFAULT '{}'::jsonb,
    approval JSONB DEFAULT '{}'::jsonb,
    payout JSONB DEFAULT '{}'::jsonb,
    receipt JSONB DEFAULT '{}'::jsonb,
    settled_at TIMESTAMP WITH TIME ZONE,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 6. CREATE NOTICES TABLE
CREATE TABLE IF NOT EXISTS notices (
    id SERIAL PRIMARY KEY,
    subject TEXT NOT NULL,
    notice_text TEXT,
    attachment_name TEXT,
    attachment_type TEXT,
    attachment_url TEXT,
    branch TEXT,
    category TEXT, -- 'document', 'notice', 'maturity'
    priority TEXT, -- 'low', 'medium', 'high'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 7. CREATE DOCUMENTS TABLE
CREATE TABLE IF NOT EXISTS documents (
    id SERIAL PRIMARY KEY,
    name TEXT NOT NULL,
    file_name TEXT NOT NULL,
    file_type TEXT,
    file_data TEXT, -- Base64-encoded stream or URL
    uploaded_by TEXT,
    uploaded_by_name TEXT,
    branch TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 8. CREATE SETTINGS TABLE
CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value JSONB DEFAULT '{}'::jsonb,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 9. CREATE AUDIT LOGS TABLE
CREATE TABLE IF NOT EXISTS audit_logs (
    id TEXT PRIMARY KEY, -- Stores LOG- timestamp formats
    user_id TEXT,
    user_name TEXT,
    role TEXT,
    action TEXT,
    details TEXT,
    ip_address TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 10. DISABLE ROW LEVEL SECURITY (RLS) FOR DIRECT ACCESS FROM EXPRESS BACKEND
-- This matches the configuration requested previously by the team
ALTER TABLE roles DISABLE ROW LEVEL SECURITY;
ALTER TABLE users DISABLE ROW LEVEL SECURITY;
ALTER TABLE insurance_records DISABLE ROW LEVEL SECURITY;
ALTER TABLE claims DISABLE ROW LEVEL SECURITY;
ALTER TABLE notices DISABLE ROW LEVEL SECURITY;
ALTER TABLE documents DISABLE ROW LEVEL SECURITY;
ALTER TABLE settings DISABLE ROW LEVEL SECURITY;
ALTER TABLE audit_logs DISABLE ROW LEVEL SECURITY;

-- 11. BOOTSTRAP INITIAL SYSTEM ROLES & PERMISSIONS
INSERT INTO roles (id, role_name, permissions) VALUES 
(1, 'admin', '{"view_dashboard": true, "upload_policy": true, "view_records": true, "manage_records": true, "view_claims": true, "manage_claims": true, "view_notices": true, "manage_notices": true, "view_premium_rates": true, "manage_premium_rates": true, "manage_users": true, "manage_settings": true, "export_data": true, "update_premium_status": true}'), 
(2, 'staff', '{"view_dashboard": true, "upload_policy": true, "view_records": true, "manage_records": true, "view_claims": true, "manage_claims": true, "view_notices": true, "manage_notices": false, "view_premium_rates": true, "manage_premium_rates": false, "manage_users": false, "manage_settings": false, "export_data": true, "update_premium_status": true}'), 
(3, 'user', '{"view_dashboard": true, "upload_policy": false, "view_records": true, "manage_records": false, "view_claims": true, "manage_claims": false, "view_notices": true, "manage_notices": false, "view_premium_rates": true, "manage_premium_rates": false, "manage_users": false, "manage_settings": false, "export_data": false, "update_premium_status": false}'), 
(4, 'agent', '{"view_dashboard": true, "upload_policy": true, "view_records": true, "manage_records": false, "view_claims": true, "manage_claims": false, "view_notices": true, "manage_notices": false, "view_premium_rates": true, "manage_premium_rates": false, "manage_users": false, "manage_settings": false, "export_data": true, "update_premium_status": false}')
ON CONFLICT (id) DO UPDATE SET 
    role_name = EXCLUDED.role_name,
    permissions = EXCLUDED.permissions;

-- 12. CREATE OPTIMAL SEARCH INDEXES FOR BETTER PERFORMANCE
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_insurance_records_policy ON insurance_records(policy_no);
CREATE INDEX IF NOT EXISTS idx_insurance_records_citizenship ON insurance_records(citizenship_no);
CREATE INDEX IF NOT EXISTS idx_claims_policy ON claims(policy_no);
CREATE INDEX IF NOT EXISTS idx_claims_record_id ON claims(record_id);
CREATE INDEX IF NOT EXISTS idx_notices_created ON notices(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_created ON audit_logs(created_at DESC);

-- 13. RELOAD SCHEMA CACHE (RE-NOTIFY POSTGREST)
NOTIFY pgrst, 'reload schema';
