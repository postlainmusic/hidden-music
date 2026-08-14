import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

export function createClient() {
  if (clientInstance) return clientInstance;

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yodctlkebsbtivmkskdo.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGN0bGtlYnNidGl2bWtza2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NTY3MDcsImV4cCI6MjEwMTMzMjcwN30.3m5xKIcqU4ZaDeNSrnrk_XzqV7r_BGnshTFrsFJDBqw';

  // Sanitize URL to ensure exact host endpoint
  const supabaseUrl = rawUrl.replace('yodctlkebsbtivmkskdosb', 'yodctlkebsbtivmkskdo');

  clientInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return clientInstance;
}
