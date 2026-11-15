-- =========================================================================
-- SUPABASE / POSTGRESQL SCHEMA SETUP FOR ASSET DEPRECIATION & PREMIUM UPDATES
-- Application: Microinsurance, SACCOS & Asset Management System
-- Version: 1.1
-- Run this script in your Supabase SQL Editor to enable durable cloud database
-- storage and performance optimizations for both Premium Payment Status updates
-- and the complete Asset Depreciation & Management subsystem.
-- =========================================================================

-- ==========================================
-- SECTION 1: INSURANCE RECORDS UPDATE
-- ==========================================

-- 1.1 Add premium payment status and remark columns to insurance_records
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS premium_payment_status TEXT DEFAULT 'Due';
ALTER TABLE insurance_records ADD COLUMN IF NOT EXISTS premium_payment_remark TEXT;

-- 1.2 Create optimal indexes for faster insurance list filtering & status searches
CREATE INDEX IF NOT EXISTS idx_insurance_records_premium_status ON insurance_records(premium_payment_status);


-- ==========================================
-- SECTION 2: ASSET MANAGEMENT & DEPRECIATION
-- ==========================================

-- 2.1 Create Asset Categories Table
CREATE TABLE IF NOT EXISTS asset_categories (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    code TEXT NOT NULL UNIQUE,
    rate NUMERIC(5, 2) NOT NULL DEFAULT 0.00,
    method TEXT NOT NULL, -- 'Straight Line', 'Written Down Value'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.2 Create Assets Table
CREATE TABLE IF NOT EXISTS assets (
    id SERIAL PRIMARY KEY,
    asset_name TEXT NOT NULL,
    asset_code TEXT UNIQUE NOT NULL,
    category TEXT NOT NULL,
    purchase_cost NUMERIC(15, 2) NOT NULL,
    salvage_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    useful_life INTEGER NOT NULL, -- in years
    depreciation_rate NUMERIC(5, 2) DEFAULT 0.00, -- rate in percentage
    purchase_date DATE NOT NULL,
    depreciation_method TEXT NOT NULL, -- 'Straight Line', 'Written Down Value', 'Double Declining', 'Units of Production'
    total_capacity_units NUMERIC(15, 2) DEFAULT 0.00,
    units_produced_yearly TEXT, -- Stored as JSON string or array
    branch TEXT DEFAULT 'Central Office',
    department TEXT DEFAULT 'Operations',
    created_by TEXT DEFAULT 'anonymous',
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.3 Create Asset Transfers Table
CREATE TABLE IF NOT EXISTS asset_transfers (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    from_branch TEXT NOT NULL,
    to_branch TEXT NOT NULL,
    from_dept TEXT,
    to_dept TEXT,
    transfer_date DATE NOT NULL,
    authorized_by TEXT NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.4 Create Asset Disposals Table
CREATE TABLE IF NOT EXISTS asset_disposals (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    disposal_type TEXT NOT NULL, -- 'Sale', 'Scrap', 'Write-off'
    disposal_date DATE NOT NULL,
    sale_value NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    book_value_at_disposal NUMERIC(15, 2) NOT NULL,
    profit_or_loss NUMERIC(15, 2) NOT NULL,
    reason TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.5 Create Asset Maintenance Log Table
CREATE TABLE IF NOT EXISTS asset_maintenances (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    maintenance_type TEXT NOT NULL,
    maintenance_date DATE NOT NULL,
    cost NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    provider TEXT,
    details TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.6 Create Asset Policy Rules / General Configurations Table
CREATE TABLE IF NOT EXISTS asset_policy_rules (
    id TEXT PRIMARY KEY,
    name TEXT NOT NULL,
    value TEXT NOT NULL,
    description TEXT,
    type TEXT NOT NULL, -- 'Fiscal Year', 'Rounding', 'Constraint', 'Other'
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.7 Create Depreciation Run Logs Table
CREATE TABLE IF NOT EXISTS depreciation_run_logs (
    id TEXT PRIMARY KEY, -- uuid or customized run code
    date DATE NOT NULL,
    fiscal_year TEXT NOT NULL,
    processed_count INTEGER NOT NULL DEFAULT 0,
    total_depr_amount NUMERIC(15, 2) NOT NULL DEFAULT 0.00,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
);

-- 2.8 Create Completed Asset Depreciation Ledger Table (For permanent ledger lock-in)
CREATE TABLE IF NOT EXISTS completed_depreciations (
    id SERIAL PRIMARY KEY,
    asset_id INTEGER NOT NULL REFERENCES assets(id) ON DELETE CASCADE,
    asset_code TEXT NOT NULL,
    fiscal_year TEXT NOT NULL,
    depreciation_expense NUMERIC(15, 2) NOT NULL,
    net_book_value NUMERIC(15, 2) NOT NULL,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT unique_asset_fiscal_year UNIQUE (asset_code, fiscal_year)
);


-- ==========================================
-- SECTION 3: ROW LEVEL SECURITY (RLS) SETTINGS
-- ==========================================
-- Match with existing system config: Disable RLS for secure direct express API access
ALTER TABLE asset_categories DISABLE ROW LEVEL SECURITY;
ALTER TABLE assets DISABLE ROW LEVEL SECURITY;
ALTER TABLE asset_transfers DISABLE ROW LEVEL SECURITY;
ALTER TABLE asset_disposals DISABLE ROW LEVEL SECURITY;
ALTER TABLE asset_maintenances DISABLE ROW LEVEL SECURITY;
ALTER TABLE asset_policy_rules DISABLE ROW LEVEL SECURITY;
ALTER TABLE depreciation_run_logs DISABLE ROW LEVEL SECURITY;
ALTER TABLE completed_depreciations DISABLE ROW LEVEL SECURITY;


-- ==========================================
-- SECTION 4: SEARCH PERFORMANCE OPTIMIZATION (INDEXES)
-- ==========================================
CREATE INDEX IF NOT EXISTS idx_assets_code ON assets(asset_code);
CREATE INDEX IF NOT EXISTS idx_assets_category ON assets(category);
CREATE INDEX IF NOT EXISTS idx_transfers_asset_id ON asset_transfers(asset_id);
CREATE INDEX IF NOT EXISTS idx_disposals_asset_id ON asset_disposals(asset_id);
CREATE INDEX IF NOT EXISTS idx_maintenances_asset_id ON asset_maintenances(asset_id);
CREATE INDEX IF NOT EXISTS idx_completed_depr_code ON completed_depreciations(asset_code);
CREATE INDEX IF NOT EXISTS idx_completed_depr_fy ON completed_depreciations(fiscal_year);


-- ==========================================
-- SECTION 5: SEED INITIAL SYSTEM DEFAULTS
-- ==========================================

-- 5.1 Seed Initial Standard Asset Categories
INSERT INTO asset_categories (id, name, code, rate, method) VALUES
('1', 'Land', 'LND', 0.00, 'Straight Line'),
('2', 'Building Improvement', 'BLD', 5.00, 'Straight Line'),
('3', 'Computer & IT', 'IT', 25.00, 'Written Down Value'),
('4', 'Office Equipment', 'OEQ', 20.00, 'Written Down Value'),
('5', 'Furniture & Fixture', 'FUR', 20.00, 'Straight Line'),
('6', 'Vehicle', 'VEH', 20.00, 'Written Down Value'),
('7', 'Electrical Equipment', 'ELE', 20.00, 'Written Down Value'),
('8', 'Others', 'OTH', 10.00, 'Straight Line')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    code = EXCLUDED.code,
    rate = EXCLUDED.rate,
    method = EXCLUDED.method;

-- 5.2 Seed Default Accounting Policy & System Rules
INSERT INTO asset_policy_rules (id, name, value, description, type) VALUES
('1', 'Standard Fiscal Year', '2082/2083', 'Default accounting cycle for cooperative property valuation', 'Fiscal Year'),
('2', 'Rounding Rule', 'Round to nearest Integer rupee', 'Eliminate fraction paise values from asset registers', 'Rounding'),
('3', 'Month-pro-rata Rule', 'Depreciate from the exact purchase date', 'Proportional calculation based on ownership days', 'Constraint'),
('4', 'Strict Minimum Useful Life', 'Active (1 Year Limit)', 'Prevent asset lifespan from being defined below 12 months', 'Constraint'),
('5', 'Prevent Negative Net Book Value', 'Active (Capped at salvage value)', 'Ensure final asset value is never below its scrap limit', 'Constraint')
ON CONFLICT (id) DO UPDATE SET
    name = EXCLUDED.name,
    value = EXCLUDED.value,
    description = EXCLUDED.description,
    type = EXCLUDED.type;


-- ==========================================
-- SECTION 6: REFRESH SCHEMA CACHE
-- ==========================================
NOTIFY pgrst, 'reload schema';
