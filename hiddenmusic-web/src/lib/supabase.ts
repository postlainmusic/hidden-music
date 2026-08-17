import { createClient as createSupabaseClient } from '@supabase/supabase-js';

const supabaseUrl =
  import.meta.env.PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
const supabaseKey =
  import.meta.env.PUBLIC_SUPABASE_ANON_KEY ||
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZW13ZnF5bmZsanBtdnhtcGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3MTgzODcxNDEsImV4cCI6MjAzMzk2MzE0MX0.l6QjM6WbYg7K87XWl9a_0zT3L8W7p0n1x2y3z4';

export const supabase = createSupabaseClient(supabaseUrl, supabaseKey);

export function createClient() {
  return createSupabaseClient(supabaseUrl, supabaseKey);
}
