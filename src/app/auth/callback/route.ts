import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: Request) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get('code');
  const next = searchParams.get('next') ?? '/';
  const errorParam = searchParams.get('error_description') || searchParams.get('error');

  if (errorParam) {
    return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(errorParam)}`);
  }

  if (code) {
    const cookieStore = cookies();
    const response = NextResponse.redirect(`${origin}${next}`);

    const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://yodctlkebsbtivmkskdo.supabase.co';
    const supabaseUrl = rawUrl.replace('yodctlkebsbtivmkskdosb', 'yodctlkebsbtivmkskdo');
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InlvZGN0bGtlYnNidGl2bWtza2RvIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODU3NTY3MDcsImV4cCI6MjEwMTMzMjcwN30.3m5xKIcqU4ZaDeNSrnrk_XzqV7r_BGnshTFrsFJDBqw';

    const supabase = createServerClient(
      supabaseUrl,
      supabaseAnonKey,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll();
          },
          setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
            cookiesToSet.forEach(({ name, value, options }) => {
              try {
                cookieStore.set(name, value, options);
              } catch {
                // Ignore in server component context
              }
              try {
                response.cookies.set(name, value, options);
              } catch {
                // Ignore in response mutation
              }
            });
          },
        },
      }
    );

    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return response;
    } else {
      return NextResponse.redirect(`${origin}/?auth_error=${encodeURIComponent(error.message)}`);
    }
  }

  return NextResponse.redirect(`${origin}/?auth_error=No+authorization+code+received`);
}
