-- Insurance Records Table with Simplified Fields
CREATE TABLE IF NOT EXISTS insurance_records (
    id SERIAL PRIMARY KEY,
    sn SERIAL,
    name TEXT NOT NULL,
    citizenship_no TEXT NOT NULL,
    dob DATE NOT NULL,
    policy_amount NUMERIC NOT NULL,
    premium NUMERIC NOT NULL,
    start_date DATE NOT NULL,
    maturity_date DATE NOT NULL,
    status TEXT NOT NULL, -- 'start_policy', 'renewed', 'rejected'
    remark TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Ensure RLS is disabled for simplicity as requested before
ALTER TABLE insurance_records DISABLE ROW LEVEL SECURITY;
