// Centralized persistent auth session & state manager across F5, tabs, and browser reloads
import { createClient } from '@/lib/supabase/client';

export interface VaultUserSession {
  id: string;
  email?: string;
  display_name?: string;
  user_metadata?: Record<string, any>;
  role?: string;
}

const USER_SESSION_KEY = 'hidden_vault_user_session';
const ADMIN_SESSION_KEY = 'hidden_vault_admin_session';

export function getStoredUserSession(): VaultUserSession | null {
  if (typeof window === 'undefined') return null;

  try {
    // 1. Try localStorage
    const local = localStorage.getItem(USER_SESSION_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && (parsed.id || parsed.email)) return parsed;
    }

    // 2. Try sessionStorage
    const session = sessionStorage.getItem(USER_SESSION_KEY);
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed && (parsed.id || parsed.email)) {
        localStorage.setItem(USER_SESSION_KEY, session);
        return parsed;
      }
    }

    // 3. Try admin session fallback
    if (getStoredAdminSession()) {
      return {
        id: 'admin-master-id',
        email: 'admin@hiddenvault.com',
        display_name: 'LUCIINGO1108',
        role: 'admin',
      };
    }

    // 4. Try Supabase auth token in localStorage or cookie
    const hasSbToken = Object.keys(localStorage).some(
      (k) => (k.startsWith('sb-') || k.includes('auth-token')) && localStorage.getItem(k)
    );
    if (hasSbToken || document.cookie.includes('hidden_vault_session=true')) {
      return {
        id: 'vault-active-user',
        email: 'member@hiddenvault.com',
        display_name: 'VAULT MEMBER',
        role: 'user',
      };
    }
  } catch (err) {
    console.warn('Error reading stored user session:', err);
  }

  return null;
}

export function setStoredUserSession(user: any) {
  if (typeof window === 'undefined' || !user) return;
  try {
    const sessionData: VaultUserSession = {
      id: user.id || 'vault-user-' + Date.now(),
      email: user.email,
      display_name:
        user.user_metadata?.full_name ||
        user.user_metadata?.display_name ||
        user.user_metadata?.name ||
        user.display_name ||
        user.email?.split('@')[0] ||
        'VAULT MEMBER',
      user_metadata: user.user_metadata,
      role: user.role || (user.email === 'admin@hiddenvault.com' ? 'admin' : 'user'),
    };

    const str = JSON.stringify(sessionData);
    localStorage.setItem(USER_SESSION_KEY, str);
    sessionStorage.setItem(USER_SESSION_KEY, str);
    document.cookie = `hidden_vault_session=true; path=/; max-age=2592000; SameSite=Lax`;
    window.dispatchEvent(new Event('vault_auth_change'));
  } catch (err) {
    console.warn('Error saving user session:', err);
  }
}

export function getStoredAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return (
      localStorage.getItem(ADMIN_SESSION_KEY) === 'true' ||
      sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true' ||
      document.cookie.includes('hidden_vault_admin=true')
    );
  } catch {
    return false;
  }
}

export function setStoredAdminSession(isAdmin: boolean) {
  if (typeof window === 'undefined') return;
  try {
    if (isAdmin) {
      localStorage.setItem(ADMIN_SESSION_KEY, 'true');
      sessionStorage.setItem(ADMIN_SESSION_KEY, 'true');
      document.cookie = `hidden_vault_admin=true; path=/; max-age=2592000; SameSite=Lax`;
      setStoredUserSession({
        id: 'admin-master-id',
        email: 'admin@hiddenvault.com',
        display_name: 'LUCIINGO1108',
        role: 'admin',
      });
    } else {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      document.cookie = 'hidden_vault_admin=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    }
    window.dispatchEvent(new Event('vault_auth_change'));
  } catch (err) {
    console.warn('Error saving admin session:', err);
  }
}

export function hasActiveSession(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(getStoredUserSession() || getStoredAdminSession());
}

export function clearAllStoredSessions() {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(USER_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem('hidden_vault_player_state');
    localStorage.removeItem('hidden_vault_cached_albums');
    sessionStorage.clear();

    // Clear all cookies
    document.cookie.split(';').forEach((c) => {
      document.cookie = c.trim().split('=')[0] + '=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax';
    });
    window.dispatchEvent(new Event('vault_auth_change'));
  } catch (err) {
    console.warn('Error clearing sessions:', err);
  }
}

// Global Clean Unified Logout
export async function performLogout() {
  try {
    const supabase = createClient();
    await supabase.auth.signOut();
  } catch (err) {
    console.warn('Supabase signOut notice:', err);
  } finally {
    clearAllStoredSessions();
    if (typeof window !== 'undefined') {
      window.location.href = '/';
    }
  }
}

// Global Hotkey Listener: Ctrl + Shift + F5 or Ctrl + Shift + R -> Hard Session Purge
if (typeof window !== 'undefined') {
  window.addEventListener('keydown', (e) => {
    const isHardReload =
      (e.ctrlKey && e.shiftKey && (e.key === 'F5' || e.code === 'F5' || e.key === 'r' || e.key === 'R')) ||
      (e.ctrlKey && (e.key === 'F5' || e.code === 'F5'));

    if (isHardReload) {
      console.warn('🔒 HARD RESET TRIGGERED: Purging all sessions and state...');
      e.preventDefault();
      clearAllStoredSessions();
      localStorage.clear();
      sessionStorage.clear();
      window.location.href = '/';
    }
  });
}
