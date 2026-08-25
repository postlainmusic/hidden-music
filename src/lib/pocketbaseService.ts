/**
 * POSTLAIN MUSIC - PocketBase API Service Layer
 * Backend: PocketBase v0.40+ (https://database.postlain.com)
 * Storage: Cloudflare R2 (hidden-music-vault)
 */

import { pb, getFileUrl, POCKETBASE_BASE_URL, getCurrentPbUser } from '@/lib/pocketbase';
import {
  TrackRecord,
  ArtistRecord,
  PlaylistRecord,
  LikeRecord,
  trackRecordToTrackItem,
  playlistRecordToAlbum,
} from '@/types/pocketbase';
import { TrackItem, Album } from '@/types/database';

export interface PaginatedResult<T> {
  items: T[];
  page: number;
  perPage: number;
  totalItems: number;
  totalPages: number;
}

// ── 1. Tracks Service ─────────────────────────────────────────────────────────

/**
 * Fetch paginated tracks with optional filter, sort and expand relations
 */
export async function getTracks(options?: {
  page?: number;
  perPage?: number;
  filter?: string;
  sort?: string;
  expand?: string;
}): Promise<PaginatedResult<TrackRecord>> {
  const page = options?.page || 1;
  const perPage = options?.perPage || 50;
  const sort = options?.sort || '-created';
  const expand = options?.expand || 'artist';
  const filter = options?.filter || '';

  try {
    const res = await pb.collection('tracks').getList<TrackRecord>(page, perPage, {
      sort,
      expand,
      filter: filter || undefined,
      requestKey: null,
    });

    return {
      items: res.items,
      page: res.page,
      perPage: res.perPage,
      totalItems: res.totalItems,
      totalPages: res.totalPages,
    };
  } catch (err) {
    console.debug('[pocketbaseService] getTracks notice:', err);
    return {
      items: [],
      page,
      perPage,
      totalItems: 0,
      totalPages: 0,
    };
  }
}

/**
 * Fetch tracks converted to standard TrackItem format for direct use in PlayerContext / UI
 */
export async function getTrackItems(options?: {
  page?: number;
  perPage?: number;
  filter?: string;
  sort?: string;
}): Promise<TrackItem[]> {
  const { items } = await getTracks(options);
  return items.map((rec) => trackRecordToTrackItem(rec, POCKETBASE_BASE_URL));
}

/**
 * Fetch a single track by its ID
 */
export async function getTrackById(id: string, expand: string = 'artist'): Promise<TrackRecord | null> {
  if (!id) return null;
  try {
    return await pb.collection('tracks').getOne<TrackRecord>(id, {
      expand,
      requestKey: null,
    });
  } catch (err) {
    console.debug(`[pocketbaseService] getTrackById(${id}) notice:`, err);
    return null;
  }
}

/**
 * Search tracks by keyword in title, artist, album, or genre
 */
export async function searchTracks(
  query: string,
  options?: { page?: number; perPage?: number }
): Promise<PaginatedResult<TrackRecord>> {
  if (!query || !query.trim()) {
    return getTracks(options);
  }

  const cleanQuery = query.trim().replace(/['"\\]/g, '');
  const filter = `title ~ "${cleanQuery}" || artist ~ "${cleanQuery}" || album ~ "${cleanQuery}" || genre ~ "${cleanQuery}"`;

  return getTracks({
    page: options?.page || 1,
    perPage: options?.perPage || 30,
    filter,
    sort: '-plays_count,-created',
  });
}

/**
 * Increment plays count for a track when listened to
 */
export async function incrementPlaysCount(trackId: string): Promise<boolean> {
  if (!trackId || trackId.startsWith('yt:') || trackId.startsWith('yt_')) return false;

  try {
    // PocketBase v0.20+ supports atomic modifier '+1' or fetch-and-update
    await pb.collection('tracks').update(trackId, {
      'plays_count+': 1,
    });
    return true;
  } catch {
    try {
      const current = await getTrackById(trackId);
      if (current) {
        await pb.collection('tracks').update(trackId, {
          plays_count: (current.plays_count || 0) + 1,
        });
        return true;
      }
    } catch (e) {
      console.debug('[pocketbaseService] incrementPlaysCount notice:', e);
    }
    return false;
  }
}

// ── 2. Artists Service ────────────────────────────────────────────────────────

/**
 * Fetch paginated artists
 */
export async function getArtists(options?: {
  page?: number;
  perPage?: number;
  filter?: string;
  sort?: string;
}): Promise<PaginatedResult<ArtistRecord>> {
  const page = options?.page || 1;
  const perPage = options?.perPage || 30;
  const sort = options?.sort || 'name';

  try {
    const res = await pb.collection('artists').getList<ArtistRecord>(page, perPage, {
      sort,
      filter: options?.filter || undefined,
      requestKey: null,
    });

    return {
      items: res.items,
      page: res.page,
      perPage: res.perPage,
      totalItems: res.totalItems,
      totalPages: res.totalPages,
    };
  } catch (err) {
    console.debug('[pocketbaseService] getArtists notice:', err);
    return { items: [], page, perPage, totalItems: 0, totalPages: 0 };
  }
}

/**
 * Fetch a single artist by ID
 */
export async function getArtistById(id: string): Promise<ArtistRecord | null> {
  if (!id) return null;
  try {
    return await pb.collection('artists').getOne<ArtistRecord>(id, { requestKey: null });
  } catch (err) {
    console.debug(`[pocketbaseService] getArtistById(${id}) notice:`, err);
    return null;
  }
}

// ── 3. Playlists Service ──────────────────────────────────────────────────────

/**
 * Fetch playlists
 */
export async function getPlaylists(options?: {
  page?: number;
  perPage?: number;
  userId?: string;
  isPublic?: boolean;
}): Promise<PaginatedResult<PlaylistRecord>> {
  const page = options?.page || 1;
  const perPage = options?.perPage || 20;
  const filterParts: string[] = [];

  if (options?.userId) {
    filterParts.push(`user = "${options.userId}"`);
  }
  if (options?.isPublic !== undefined) {
    filterParts.push(`is_public = ${options.isPublic}`);
  }

  const filter = filterParts.join(' && ');

  try {
    const res = await pb.collection('playlists').getList<PlaylistRecord>(page, perPage, {
      sort: '-created',
      filter: filter || undefined,
      expand: 'user,tracks',
      requestKey: null,
    });

    return {
      items: res.items,
      page: res.page,
      perPage: res.perPage,
      totalItems: res.totalItems,
      totalPages: res.totalPages,
    };
  } catch (err) {
    console.debug('[pocketbaseService] getPlaylists notice:', err);
    return { items: [], page, perPage, totalItems: 0, totalPages: 0 };
  }
}

/**
 * Fetch playlist as an Album model with expanded tracks
 */
export async function getPlaylistAlbum(playlistId: string): Promise<Album | null> {
  if (!playlistId) return null;
  try {
    const playlist = await pb.collection('playlists').getOne<PlaylistRecord>(playlistId, {
      expand: 'user,tracks',
      requestKey: null,
    });
    return playlistRecordToAlbum(playlist, POCKETBASE_BASE_URL);
  } catch (err) {
    console.debug(`[pocketbaseService] getPlaylistAlbum(${playlistId}) notice:`, err);
    return null;
  }
}

// ── 4. Likes & Favorites Service ──────────────────────────────────────────────

/**
 * Toggle like/favorite status for a track
 */
export async function toggleLike(
  trackId: string,
  userId?: string
): Promise<{ liked: boolean; likeRecordId?: string }> {
  const effectiveUserId = userId || getCurrentPbUser()?.id;
  if (!effectiveUserId || !trackId) {
    return { liked: false };
  }

  try {
    // Check if like record already exists
    const existing = await pb.collection('likes').getFirstListItem<LikeRecord>(
      `user = "${effectiveUserId}" && track = "${trackId}"`,
      { requestKey: null }
    );

    if (existing) {
      await pb.collection('likes').delete(existing.id);
      return { liked: false };
    }
  } catch {
    // Record does not exist, create new like
    try {
      const created = await pb.collection('likes').create<LikeRecord>(
        {
          user: effectiveUserId,
          track: trackId,
        },
        { requestKey: null }
      );
      return { liked: true, likeRecordId: created.id };
    } catch (createErr) {
      console.debug('[pocketbaseService] toggleLike create error:', createErr);
    }
  }

  return { liked: false };
}

/**
 * Get all track IDs liked by a user
 */
export async function getUserLikes(userId?: string): Promise<string[]> {
  const effectiveUserId = userId || getCurrentPbUser()?.id;
  if (!effectiveUserId) return [];

  try {
    const records = await pb.collection('likes').getFullList<LikeRecord>({
      filter: `user = "${effectiveUserId}"`,
      fields: 'track',
      requestKey: null,
    });
    return records.map((r) => r.track).filter(Boolean);
  } catch (err) {
    console.debug('[pocketbaseService] getUserLikes notice:', err);
    return [];
  }
}

// ── 5. Universal Streaming Helpers ────────────────────────────────────────────

/**
 * Resolves the direct audio streaming URL for any track (PocketBase, Cloudflare R2, or YouTube)
 */
export function getAudioStreamUrl(track: TrackRecord | TrackItem | null | undefined): string {
  if (!track) return '';

  // Case 1: TrackRecord with audio_file
  if ('audio_file' in track && track.audio_file) {
    return getFileUrl(track as any, track.audio_file);
  }

  // Case 2: TrackItem with audio_url
  if ('audio_url' in track && track.audio_url) {
    const url = track.audio_url;
    if (url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    return getFileUrl({ id: track.id, collectionName: 'tracks' }, url);
  }

  return '';
}

/**
 * Resolves the cover image URL for any track or album
 */
export function getCoverImageUrl(item: TrackRecord | TrackItem | Album | null | undefined): string {
  if (!item) return '/icon.svg';

  // Case 1: TrackRecord with cover_image
  if ('cover_image' in item && item.cover_image) {
    return getFileUrl(item as any, item.cover_image);
  }

  // Case 2: TrackItem or Album with cover_url
  if ('cover_url' in item && item.cover_url) {
    return item.cover_url;
  }

  return '/icon.svg';
}
