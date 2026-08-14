import { createClient as createSupabaseClient, SupabaseClient } from '@supabase/supabase-js';

let clientInstance: SupabaseClient | null = null;

export function createClient() {
  if (clientInstance) return clientInstance;

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZW13ZnF5bmZsanBtdnhtcGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTIwMDYsImV4cCI6MjEwMjIyODAwNn0.btnyUiVm-KqKlGQ-PlhVdPBy-VP005ltDMzABIHfYro';

  // Sanitize URL to ensure exact host endpoint
  const supabaseUrl = rawUrl.replace('muemwfqynfljpmvxmpepsb', 'muemwfqynfljpmvxmpep');

  clientInstance = createSupabaseClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      persistSession: true,
      autoRefreshToken: true,
      detectSessionInUrl: true,
    },
  });

  return clientInstance;
}
