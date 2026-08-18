// Centralized persistent auth session & state manager across F5, tabs, and browser reloads
import { createClient } from '@/lib/supabase/client';

export interface VaultUserSession {
  id: string;
  email?: string;
  display_name?: string;
  user_metadata?: Record<string, any>;
  role?: string;
  plan?: 'free' | 'vip' | 'premium';
  hasVideoSubscription?: boolean;
}

const USER_SESSION_KEY = 'hidden_vault_user_session';
const ADMIN_SESSION_KEY = 'hidden_vault_admin_session';
const VIDEO_PASS_KEY = 'hidden_vault_video_pass';

export function getStoredUserSession(): VaultUserSession | null {
  if (typeof window === 'undefined') return null;

  try {
    const customName = localStorage.getItem('hidden_vault_custom_name');
    const hasVideoPass = localStorage.getItem(VIDEO_PASS_KEY) === 'true';

    // 1. Check direct user session in localStorage
    const local = localStorage.getItem(USER_SESSION_KEY);
    if (local) {
      const parsed = JSON.parse(local);
      if (parsed && (parsed.id || parsed.email)) {
        if (customName) parsed.display_name = customName;
        if (hasVideoPass) parsed.hasVideoSubscription = true;
        return parsed;
      }
    }

    // 2. Check direct admin session in localStorage ONLY
    if (localStorage.getItem(ADMIN_SESSION_KEY) === 'true') {
      return {
        id: 'admin-master-id',
        email: 'admin@hiddenvault.com',
        display_name: customName || 'LUCIINGO1108',
        role: 'admin',
        plan: 'premium',
        hasVideoSubscription: true,
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
    const hasVideoPass = localStorage.getItem(VIDEO_PASS_KEY) === 'true';

    const resolvedName =
      user.display_name ||
      customStoredName ||
      user.user_metadata?.display_name ||
      user.user_metadata?.full_name ||
      user.user_metadata?.name ||
      user.email?.split('@')[0] ||
      'VAULT MEMBER';

    const isAdmin = user.role === 'admin' || user.email === 'admin@hiddenvault.com' || localStorage.getItem(ADMIN_SESSION_KEY) === 'true';

    const sessionData: VaultUserSession = {
      id: user.id || 'vault-user-' + Date.now(),
      email: user.email,
      display_name: resolvedName,
      user_metadata: {
        ...(user.user_metadata || {}),
        display_name: resolvedName,
        full_name: resolvedName,
      },
      role: isAdmin ? 'admin' : (user.role || 'user'),
      plan: isAdmin ? 'premium' : (user.plan || (hasVideoPass ? 'vip' : 'free')),
      hasVideoSubscription: isAdmin || hasVideoPass || user.hasVideoSubscription || user.user_metadata?.hasVideoSubscription === true,
    };

    const str = JSON.stringify(sessionData);
    localStorage.setItem(USER_SESSION_KEY, str);
    sessionStorage.setItem(USER_SESSION_KEY, str);
    window.dispatchEvent(new CustomEvent('vault_auth_change', { detail: sessionData }));
    window.dispatchEvent(new CustomEvent('vault_profile_updated', { detail: sessionData }));
  } catch (err) {
    console.warn('Error saving user session:', err);
  }
}

export function getStoredAdminSession(): boolean {
  if (typeof window === 'undefined') return false;
  try {
    return localStorage.getItem(ADMIN_SESSION_KEY) === 'true';
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
      localStorage.setItem(VIDEO_PASS_KEY, 'true');
      setStoredUserSession({
        id: 'admin-master-id',
        email: 'admin@hiddenvault.com',
        display_name: 'LUCIINGO1108',
        role: 'admin',
        plan: 'premium',
        hasVideoSubscription: true,
      });
    } else {
      localStorage.removeItem(ADMIN_SESSION_KEY);
      sessionStorage.removeItem(ADMIN_SESSION_KEY);
      localStorage.removeItem(USER_SESSION_KEY);
      sessionStorage.removeItem(USER_SESSION_KEY);
    }
    window.dispatchEvent(new CustomEvent('vault_auth_change', { detail: null }));
  } catch (err) {
    console.warn('Error saving admin session:', err);
  }
}

export function hasActiveSession(): boolean {
  if (typeof window === 'undefined') return false;
  return Boolean(getStoredUserSession());
}

/**
 * Check if the user has access to Video Zone (Admin, VIP Plan, or Active Video Pass)
 */
export function hasVideoSubscription(session?: VaultUserSession | null): boolean {
  if (typeof window === 'undefined') return false;

  const current = session || getStoredUserSession();
  if (!current) return false;

  // 1. Admins have unconditional full access
  if (current.role === 'admin' || current.email === 'admin@hiddenvault.com' || getStoredAdminSession()) {
    return true;
  }

  // 2. Check local video pass flag
  if (localStorage.getItem(VIDEO_PASS_KEY) === 'true') {
    return true;
  }

  // 3. Check session subscription flags
  if (current.hasVideoSubscription || current.plan === 'vip' || current.plan === 'premium' || current.user_metadata?.hasVideoSubscription) {
    return true;
  }

  return false;
}

/**
 * Activate Video Subscription Pass (Instant client/localStorage activation)
 */
export function activateVideoSubscription(): VaultUserSession | null {
  if (typeof window === 'undefined') return null;

  try {
    localStorage.setItem(VIDEO_PASS_KEY, 'true');
    sessionStorage.setItem(VIDEO_PASS_KEY, 'true');

    const cur = getStoredUserSession();
    if (cur) {
      const updated: VaultUserSession = {
        ...cur,
        plan: cur.role === 'admin' ? 'premium' : 'vip',
        hasVideoSubscription: true,
      };
      setStoredUserSession(updated);
      return updated;
    }
  } catch (e) {
    console.warn('Video subscription activation note:', e);
  }
  return null;
}

/**
 * Revoke Video Subscription Pass (For testing or cancellation)
 */
export function revokeVideoSubscription(): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.removeItem(VIDEO_PASS_KEY);
    sessionStorage.removeItem(VIDEO_PASS_KEY);
    const cur = getStoredUserSession();
    if (cur && cur.role !== 'admin') {
      const updated: VaultUserSession = {
        ...cur,
        plan: 'free',
        hasVideoSubscription: false,
      };
      setStoredUserSession(updated);
    }
  } catch (e) {
    console.warn('Video subscription revoke note:', e);
  }
}

export function clearAllStoredSessions() {
  if (typeof window === 'undefined') return;
  try {
    // 1. Wipe all localStorage completely
    localStorage.clear();

    // 2. Clear sessionStorage completely
    sessionStorage.clear();

    // 3. Force kill all cookies with max-age=0
    document.cookie.split(';').forEach((c) => {
      const name = c.trim().split('=')[0];
      if (name) {
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax`;
        document.cookie = `${name}=; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0; SameSite=Lax`;
        document.cookie = `${name}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; max-age=0`;
      }
    });

    // 4. Fire events to instantly re-render UI to VaultGate
    window.dispatchEvent(new CustomEvent('vault_auth_change', { detail: null }));
    window.dispatchEvent(new CustomEvent('vault_profile_updated', { detail: null }));
  } catch (err) {
    console.warn('Error clearing sessions:', err);
  }
}

// Global Clean Unified Logout
export async function performLogout() {
  try {
    // 1. Wipe all local client state synchronously first
    clearAllStoredSessions();

    // 2. Call server endpoint in background
    fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});

    // 3. Supabase global signOut
    const supabase = createClient();
    await supabase.auth.signOut({ scope: 'global' }).catch(() => {});
    await supabase.auth.signOut({ scope: 'local' }).catch(() => {});
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
