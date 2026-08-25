import PocketBase from 'pocketbase';
import type { UserRecord } from '@/types/pocketbase';

export const POCKETBASE_BASE_URL =
  (process.env.NEXT_PUBLIC_POCKETBASE_URL || 'https://database.postlain.com').replace(/\/$/, '');

/**
 * Singleton PocketBase client instance for POSTLAIN MUSIC
 */
export const pb = new PocketBase(POCKETBASE_BASE_URL);

/**
 * Disables auto-cancellation for parallel requests to ensure smooth audio streaming & metadata loading
 */
pb.autoCancellation(false);

/**
 * Helper to get direct stream URL for audio / cover files from PocketBase / Cloudflare R2
 *
 * @param record PocketBase record containing the file
 * @param filename File name string stored in record
 * @param options Optional PocketBase file URL options (e.g. { thumb: '100x100' })
 * @returns Fully qualified URL string
 */
export const getFileUrl = (
  record: { id: string; collectionId?: string; collectionName?: string } | null | undefined,
  filename: string | null | undefined,
  options?: { thumb?: string; token?: string; download?: boolean }
): string => {
  if (!record || !filename) return '';

  // If already a fully qualified absolute URL (e.g., direct R2 or CDN)
  if (filename.startsWith('http://') || filename.startsWith('https://')) {
    return filename;
  }

  try {
    return pb.files.getURL(record as any, filename, options);
  } catch {
    const collection = record.collectionName || record.collectionId || 'tracks';
    return `${POCKETBASE_BASE_URL}/api/files/${collection}/${record.id}/${filename}`;
  }
};

/**
 * Get current authenticated user from PocketBase authStore
 */
export const getCurrentPbUser = (): UserRecord | null => {
  if (typeof window === 'undefined') return null;
  if (pb.authStore.isValid && pb.authStore.record) {
    return pb.authStore.record as unknown as UserRecord;
  }
  return null;
};

/**
 * Check if user is currently authenticated with PocketBase
 */
export const isPbUserLoggedIn = (): boolean => {
  if (typeof window === 'undefined') return false;
  return pb.authStore.isValid;
};

/**
 * Subscribe to PocketBase auth state changes
 */
export const subscribePbAuth = (callback: (token: string, model: any) => void): (() => void) => {
  return pb.authStore.onChange(callback);
};
