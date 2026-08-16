import { NextResponse } from 'next/server';
import { cookies } from 'next/headers';

export async function POST() {
  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();

  const response = NextResponse.json({ success: true, message: 'Logged out successfully' });

  allCookies.forEach((cookie) => {
    response.cookies.set({
      name: cookie.name,
      value: '',
      expires: new Date(0),
      path: '/',
    });
  });

  response.cookies.set({
    name: 'hidden_vault_session',
    value: '',
    expires: new Date(0),
    path: '/',
  });

  response.cookies.set({
    name: 'hidden_vault_admin',
    value: '',
    expires: new Date(0),
    path: '/',
  });

  return response;
}

export async function GET(request: Request) {
  const { origin } = new URL(request.url);
  const response = NextResponse.redirect(`${origin}/`);

  const cookieStore = cookies();
  const allCookies = cookieStore.getAll();

  allCookies.forEach((cookie) => {
    response.cookies.set({
      name: cookie.name,
      value: '',
      expires: new Date(0),
      path: '/',
    });
  });

  response.cookies.set({
    name: 'hidden_vault_session',
    value: '',
    expires: new Date(0),
    path: '/',
  });

  response.cookies.set({
    name: 'hidden_vault_admin',
    value: '',
    expires: new Date(0),
    path: '/',
  });

  return response;
}
