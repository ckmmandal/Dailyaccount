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

const rawUrl = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_URL) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_URL);

const rawKey = 
  (typeof import.meta !== 'undefined' && import.meta.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.VITE_SUPABASE_ANON_KEY) ||
  (typeof process !== 'undefined' && process.env?.SUPABASE_ANON_KEY);

const supabaseUrl = sanitizeUrl(rawUrl);
const supabaseAnonKey = sanitizeKey(rawKey);

if (!supabaseAnonKey) {
  console.warn('⚠️ Supabase anon key is missing. Please check your VITE_SUPABASE_ANON_KEY environment variable.');
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    persistSession: typeof window !== 'undefined',
    autoRefreshToken: typeof window !== 'undefined',
  },
});

// Diagnostic connection test helper with retries
export async function testSupabaseConnection(retries = 2, delayMs = 1000): Promise<{ success: boolean; data?: any; error?: string }> {
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
    } catch (err: any) {
      if (attempt <= retries) {
        await new Promise((res) => setTimeout(res, delayMs));
        continue;
      }
      console.warn('⚠️ Supabase connection test exception:', err?.message || String(err));
      return { success: false, error: err?.message || String(err) };
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
