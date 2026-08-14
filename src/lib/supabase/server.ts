import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export function createClient() {
  const cookieStore = cookies();

  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yodctlkebsbtivmkskdo.supabase.co';
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGN0bGtlYnNidGl2bWtza2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NTY3MDcsImV4cCI6MjEwMTMzMjcwN30.3m5xKIcqU4ZaDeNSrnrk_XzqV7r_BGnshTFrsFJDBqw';

  const supabaseUrl = rawUrl.replace('yodctlkebsbtivmkskdosb', 'yodctlkebsbtivmkskdo');

  return createServerClient(
    supabaseUrl,
    supabaseAnonKey,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet: Array<{ name: string; value: string; options?: any }>) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            );
          } catch {
            // Server Component cookie set
          }
        },
      },
    }
  );
}
