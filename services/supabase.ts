import { createClient } from '@supabase/supabase-js';

function sanitizeUrl(url: string | undefined): string {
  if (!url) return 'https://pqxupzgjlegzibtrhcbz.supabase.co';
  let cleaned = url.trim().replace(/^["']|["']$/g, '');
  cleaned = cleaned.replace(/\/rest\/v1\/?$/i, '');
  cleaned = cleaned.replace(/\/+$/, '');
  return cleaned || 'https://pqxupzgjlegzibtrhcbz.supabase.co';
}

function sanitizeKey(key: string | undefined): string {
  if (!key) return 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InBxeHVwemdqbGVnemlidHJoY2J6Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU5MzI0MTAsImV4cCI6MjEwMTUwODQxMH0.wWWW-foBOn6cXtB_F0PGPeM5XXYyOHiEeKL-zygsXtY';
  return key.trim().replace(/^["']|["']$/g, '');
}

const metaEnv =
  typeof import.meta !== 'undefined'
    ? (import.meta as unknown as { env?: Record<string, string | undefined> }).env
    : undefined;

const rawUrl =
  metaEnv?.VITE_SUPABASE_URL ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL) ||
  undefined;

const rawKey =
  metaEnv?.VITE_SUPABASE_ANON_KEY ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY) ||
  undefined;

const supabaseUrl = sanitizeUrl(rawUrl);
const supabaseAnonKey = sanitizeKey(rawKey);

if (!supabaseAnonKey) {
  console.warn('⚠️ Supabase anon key is missing. Please check your VITE_SUPABASE_ANON_KEY environment variable.');
}

// In-process mutex lock to avoid browser Web Locks (navigator.locks) AbortError with 'steal' option
const inProcessLocks = new Map<string, Promise<unknown>>();
const inProcessLock = async <R>(
  name: string,
  _acquireTimeout: number,
  fn: () => Promise<R>
): Promise<R> => {
  const prev = inProcessLocks.get(name) ?? Promise.resolve();
  const run = prev.catch(() => undefined).then(() => fn());
  inProcessLocks.set(name, run);
  try {
    return await run;
  } finally {
    if (inProcessLocks.get(name) === run) {
      inProcessLocks.delete(name);
    }
  }
};

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: false,
    autoRefreshToken: false,
    detectSessionInUrl: false,
    lock: inProcessLock,
  },
});

// Diagnostic connection test helper with retries
export async function testSupabaseConnection(
  retries = 2,
  delayMs = 1000
): Promise<{ success: boolean; data?: unknown; error?: string }> {
  for (let attempt = 1; attempt <= retries + 1; attempt++) {
    try {
      const { data, error } = await supabase.from('settings').select('id').limit(1);
      if (!error) {
        console.log(`✅ Supabase Connected successfully to ${supabaseUrl}`);
        return { success: true, data };
      }
      if (attempt <= retries) {
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      console.warn('⚠️ Supabase table check response:', error.message);
      return { success: false, error: error.message };
    } catch (err: unknown) {
      if (attempt <= retries) {
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      const message = err instanceof Error ? err.message : String(err);
      console.warn('⚠️ Supabase connection test exception:', message);
      return { success: false, error: message };
    }
  }
  return { success: false, error: 'Connection attempts exhausted' };
}

// Run connection test safely after window loads
if (typeof window !== 'undefined') {
  setTimeout(() => {
    testSupabaseConnection();
  }, 500);
}
