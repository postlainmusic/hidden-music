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
    const customName = localStorage.getItem('hidden_vault_custom_name');

    // 1. Try localStorage
    const local = localStorage.getItem(USER_SESSION_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && (parsed.id || parsed.email)) {
        if (customName) parsed.display_name = customName;
        return parsed;
      }
    }

    // 2. Try sessionStorage
    const session = sessionStorage.getItem(USER_SESSION_KEY);
    if (session) {
      const parsed = JSON.parse(session);
      if (parsed && (parsed.id || parsed.email)) {
        if (customName) parsed.display_name = customName;
        localStorage.setItem(USER_SESSION_KEY, session);
        return parsed;
      }
    }

    // 3. Try admin session fallback
    if (getStoredAdminSession()) {
      return {
        id: 'admin-master-id',
        email: 'admin@hiddenvault.com',
        display_name: customName || 'LUCIINGO1108',
        role: 'admin',
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
    const customStoredName = localStorage.getItem('hidden_vault_custom_name');
    const resolvedName =
      user.display_name ||
      customStoredName ||
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'VAULT MEMBER';

    const sessionData: VaultUserSession = {
      id: user.id || 'vault-user-' + Date.now(),
      email: user.email,
      display_name: resolvedName,
      user_metadata: {
        ...(user.user_metadata || {}),
        display_name: resolvedName,
        full_name: resolvedName,
      },
      role: user.role || (user.email === 'admin@hiddenvault.com' ? 'admin' : 'user'),
    };

    const str = JSON.stringify(sessionData);
    localStorage.setItem(USER_SESSION_KEY, str);
    sessionStorage.setItem(USER_SESSION_KEY, str);
    document.cookie = `hidden_vault_session=true; path=/; max-age=2592000; SameSite=Lax`;
    window.dispatchEvent(new CustomEvent('vault_auth_change', { detail: sessionData }));
    window.dispatchEvent(new CustomEvent('vault_profile_updated', { detail: sessionData }));
  } catch (err) {
    console.warn('Error saving user session:', err);
  }
}

export function getStoredAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    const hasLocal = localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
    const hasSession = sessionStorage.getItem(ADMIN_SESSION_KEY) === 'true';
    const hasCookie = document.cookie.split(';').some((c) => c.trim().startsWith('hidden_vault_admin=true'));
    return hasLocal || hasSession || hasCookie;
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
    // 1. Remove all keys from localStorage
    localStorage.removeItem(USER_SESSION_KEY);
    localStorage.removeItem(ADMIN_SESSION_KEY);
    localStorage.removeItem('hidden_vault_player_state');
    localStorage.removeItem('hidden_vault_cached_albums');
    localStorage.removeItem('hidden_vault_custom_name');
    localStorage.removeItem('hidden_music_player_state');

    // Remove all sb-* and hidden_vault keys
    Object.keys(localStorage).forEach((key) => {
      if (
        key.startsWith('sb-') ||
        key.startsWith('supabase.') ||
        key.includes('auth-token') ||
        key.includes('hidden_vault')
      ) {
        localStorage.removeItem(key);
      }
    });

    // 2. Clear sessionStorage completely
    sessionStorage.clear();

    // 3. Clear all cookies with every combination of path and domain
    const host = window.location.hostname;
    const domains = ['', host, '.' + host];
    const paths = ['/', ''];

    const cookieNames = [
      'hidden_vault_session',
      'hidden_vault_admin',
      'sb-access-token',
      'sb-refresh-token',
      'hidden_vault_custom_name',
    ];

    document.cookie.split(';').forEach((c) => {
      const name = c.trim().split('=')[0];
      if (name && !cookieNames.includes(name)) {
        cookieNames.push(name);
      }
    });

    cookieNames.forEach((name) => {
      domains.forEach((dom) => {
        paths.forEach((p) => {
          const domStr = dom ? ` domain=${dom};` : '';
          const pathStr = p ? ` path=${p};` : '';
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;${pathStr}${domStr} SameSite=Lax`;
          document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0;${pathStr}${domStr}`;
        });
      });
    });

    // 4. Fire event
    window.dispatchEvent(new CustomEvent('vault_auth_change', { detail: null }));
    window.dispatchEvent(new CustomEvent('vault_profile_updated', { detail: null }));
  } catch (err) {
    console.warn('Error clearing sessions:', err);
  }
}

// Global Clean Unified Logout
export async function performLogout() {
  try {
    // 1. Call server-side cookie cleanup
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});

    // 2. Supabase signOut
    const supabase = createClient();
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
    await supabase.auth.signOut().catch(() => {});
  } catch (err) {
    console.warn('Supabase signOut notice:', err);
  } finally {
    clearAllStoredSessions();
    if (typeof window !== 'undefined') {
      window.location.replace('/');
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
      window.location.replace('/');
    }
  });
}
