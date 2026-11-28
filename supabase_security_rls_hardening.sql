-- ==============================================================================
-- RATAULI SACCOS — FULL SUPABASE ROW LEVEL SECURITY (RLS) LOCKDOWN SCRIPT
-- ==============================================================================
-- Idempotent SQL script — safe to copy, paste, and run in Supabase SQL Editor.
--
-- HOW THIS WORKS WITH YOUR APP:
--   Your application routes all database operations through the authenticated
--   backend server proxy (/api/supabase-proxy/rest/v1/*) using the server-side
--   SUPABASE_SERVICE_ROLE_KEY (which bypasses RLS safely after verifying the
--   logged-in user's signed session and role permissions).
--
-- PREREQUISITE BEFORE RUNNING THIS SQL:
--   Make sure SUPABASE_SERVICE_ROLE_KEY is saved in your hosting / AI Studio
--   Environment Variables (Secrets) so the server can read/write Supabase after
--   anonymous access is locked down.
-- ==============================================================================

-- 1. Enable Row Level Security (RLS) on EVERY table in public schema,
--    drop any overly permissive anonymous policies, and revoke ALL direct
--    anonymous (browser/public key) table access.
DO $$
DECLARE
  r RECORD;
  p RECORD;
BEGIN
  FOR r IN (
    SELECT tablename
    FROM pg_tables
    WHERE schemaname = 'public'
  ) LOOP
    -- Enable & force RLS
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY;', r.tablename);

    -- Drop any existing permissive anon/public policies on this table
    FOR p IN (
      SELECT policyname
      FROM pg_policies
      WHERE schemaname = 'public' AND tablename = r.tablename
    ) LOOP
      EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I;', p.policyname, r.tablename);
    END LOOP;

    -- Revoke all direct anonymous & authenticated client table privileges
    -- (Backend server uses service_role which retains full controlled access)
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM anon;', r.tablename);
    EXECUTE format('REVOKE ALL ON TABLE public.%I FROM authenticated;', r.tablename);
  END LOOP;
END $$;

-- 2. Also revoke direct anonymous execution on sequences/functions in public
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM anon;
REVOKE ALL ON ALL SEQUENCES IN SCHEMA public FROM authenticated;

-- 3. Verification query: confirms RLS is ON for every table in public schema
SELECT
  tablename AS table_name,
  rowsecurity AS rls_enabled
FROM pg_tables
WHERE schemaname = 'public'
ORDER BY tablename;
