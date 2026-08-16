export const runtime = 'edge';
import { NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

function getSupabaseServerClient(cookieStore: any, response: NextResponse) {
  const rawUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
  const supabaseUrl = rawUrl.replace('muemwfqynfljpmvxmpepsb', 'muemwfqynfljpmvxmpep');
  const supabaseAnonKey =
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ||
    'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im11ZW13ZnF5bmZsanBtdnhtcGVwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODY2NTIwMDYsImV4cCI6MjEwMjIyODAwNn0.btnyUiVm-KqKlGQ-PlhVdPBy-VP005ltDMzABIHfYro';

  return createServerClient(supabaseUrl, supabaseAnonKey, {
    cookies: {
      getAll() {
        return cookieStore.getAll();
      },
      setAll(cookiesToSet: { name: string; value: string; options: any }[]) {
        cookiesToSet.forEach(({ name, value, options }) => {
          try {
            cookieStore.set(name, value, options);
          } catch {}
          try {
            response.cookies.set(name, value, options);
          } catch {}
        });
      },
    },
  });
}

function clearAllCookiesOnResponse(response: NextResponse, cookieStore: any) {
  const allCookies = cookieStore.getAll();
  allCookies.forEach((cookie: any) => {
    response.cookies.set({
      name: cookie.name,
      value: '',
      expires: new Date(0),
      maxAge: 0,
      path: '/',
    });
  });

  const knownCookies = [
    'hidden_vault_session',
    'hidden_vault_admin',
    'sb-access-token',
    'sb-refresh-token',
    'sb-muemwfqynfljpmvxmpep-auth-token',
  ];

  knownCookies.forEach((name) => {
    response.cookies.set({
      name,
      value: '',
      expires: new Date(0),
      maxAge: 0,
      path: '/',
    });
  });
}

export async function POST() {
  const cookieStore = cookies();
  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

  try {
    const supabase = getSupabaseServerClient(cookieStore, response);
    await supabase.auth.signOut({ scope: 'global' });
  } catch {}

  clearAllCookiesOnResponse(response, cookieStore);
  return response;
}

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/`);
  const cookieStore = cookies();

  try {
    const supabase = getSupabaseServerClient(cookieStore, response);
    await supabase.auth.signOut({ scope: 'global' });
  } catch {}

  clearAllCookiesOnResponse(response, cookieStore);
  return response;
}
