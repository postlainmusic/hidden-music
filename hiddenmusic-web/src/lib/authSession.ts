import { UserSession } from '../types/database';

const SESSION_KEY = 'hidden_vault_auth_session';

export function getStoredUserSession(): UserSession | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function setStoredUserSession(session: UserSession | null) {
  if (typeof window === 'undefined') return;
  if (!session) {
    localStorage.removeItem(SESSION_KEY);
    localStorage.removeItem('hidden_vault_vip_active');
  } else {
    localStorage.setItem(SESSION_KEY, JSON.stringify(session));
    if (session.is_subscribed) {
      localStorage.setItem('hidden_vault_vip_active', 'true');
    }
  }
  window.dispatchEvent(new Event('vault_auth_change'));
}

export function hasActiveSession(): boolean {
  return Boolean(getStoredUserSession());
}

export function isVipSubscribed(): boolean {
  if (typeof window === 'undefined') return false;
  if (localStorage.getItem('hidden_vault_vip_active') === 'true') return true;
  const session = getStoredUserSession();
  return Boolean(session?.is_subscribed);
}
