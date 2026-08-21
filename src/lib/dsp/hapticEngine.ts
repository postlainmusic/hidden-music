/**
 * Mobile Haptic Engine — Beat-Synced Vibration Subsystem
 * Triggered on Sub-bass kicks and major beat drops on mobile devices
 * Includes iOS Safari fallback guards, throttle timers, and user preference persistence
 */

const HAPTIC_STORAGE_KEY = 'hidden_vault_haptic_enabled';
const MIN_HAPTIC_INTERVAL_MS = 220; // Prevent motor fatigue and battery drain

export class HapticEngine {
  private static isEnabled = true;
  private static lastVibrationTime = 0;
  private static isInitialized = false;

  private static init() {
    if (this.isInitialized || typeof window === 'undefined') return;
    try {
      const saved = localStorage.getItem(HAPTIC_STORAGE_KEY);
      this.isEnabled = saved !== null ? saved === 'true' : true;
    } catch {
      this.isEnabled = true;
    }
    this.isInitialized = true;
  }

  static isSupported(): boolean {
    return typeof window !== 'undefined' && 'navigator' in window && 'vibrate' in navigator;
  }

  static getEnabled(): boolean {
    this.init();
    return this.isEnabled && this.isSupported();
  }

  static setEnabled(enabled: boolean) {
    this.isEnabled = enabled;
    if (typeof window !== 'undefined') {
      try {
        localStorage.setItem(HAPTIC_STORAGE_KEY, String(enabled));
      } catch {}
    }
  }

  /**
   * Trigger beat pulse vibration
   */
  static triggerKick(force = false) {
    if (!this.getEnabled()) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (!force && now - this.lastVibrationTime < MIN_HAPTIC_INTERVAL_MS) {
      return;
    }

    try {
      if (this.isSupported()) {
        navigator.vibrate(25); // Subtle 25ms punch
        this.lastVibrationTime = now;
      }
    } catch (err) {
      console.warn('[HapticEngine] Vibration error:', err);
    }
  }

  /**
   * Trigger snappy double transient for snare or drop
   */
  static triggerDrop() {
    if (!this.getEnabled()) return;

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();
    if (now - this.lastVibrationTime < MIN_HAPTIC_INTERVAL_MS * 1.5) {
      return;
    }

    try {
      if (this.isSupported()) {
        navigator.vibrate([15, 30, 20]);
        this.lastVibrationTime = now;
      }
    } catch (err) {
      console.warn('[HapticEngine] Vibration error:', err);
    }
  }

  /**
   * UI touch confirmation tap
   */
  static triggerTap() {
    if (!this.getEnabled()) return;
    try {
      if (this.isSupported()) {
        navigator.vibrate(10);
      }
    } catch {}
  }
}
