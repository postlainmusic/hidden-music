/**
 * POSTLAIN MUSIC - PocketBase Database Models & Types
 * Backend: PocketBase v0.40+ (https://database.postlain.com)
 * Storage: Cloudflare R2 (hidden-music-vault)
 */

import { TrackItem, Album } from '@/types/database';

export interface BaseRecord {
  id: string;
  created: string;
  updated: string;
  collectionId: string;
  collectionName: string;
}

// ── 1. Tracks Collection ──────────────────────────────────────────────────────
export interface TrackRecord {
  id: string;
  title: string;
  artist: string; // Artist name string or relation ID
  album?: string;
  audio_file: string; // Filename in PocketBase/R2
  cover_image?: string; // Filename in PocketBase/R2
  duration: number; // Duration in seconds
  genre?: string;
  plays_count: number;
  bitrate?: string; // e.g. "320kbps", "FLAC 24-bit", "Lossless"
  lyrics?: string;
  video_url?: string;
  is_published?: boolean;
  expand?: {
    artist?: ArtistRecord;
    [key: string]: any;
  };
  created: string;
  updated: string;
  collectionId?: string;
  collectionName?: string;
}

// ── 2. Artists Collection ─────────────────────────────────────────────────────
export interface ArtistRecord {
  id: string;
  name: string;
  bio?: string;
  avatar?: string;
  cover_photo?: string;
  genres?: string[];
  monthly_listeners?: number;
  verified?: boolean;
  created: string;
  updated: string;
  collectionId?: string;
  collectionName?: string;
}

// ── 3. Playlists Collection ───────────────────────────────────────────────────
export interface PlaylistRecord {
  id: string;
  title: string;
  description?: string;
  cover_image?: string;
  user: string; // Relation -> users
  tracks?: string[]; // Array of track IDs (Relation -> tracks)
  is_public: boolean;
  expand?: {
    user?: UserRecord;
    tracks?: TrackRecord[];
    [key: string]: any;
  };
  created: string;
  updated: string;
  collectionId?: string;
  collectionName?: string;
}

// ── 4. Likes / Favorites Collection ───────────────────────────────────────────
export interface LikeRecord {
  id: string;
  user: string; // Relation -> users
  track: string; // Relation -> tracks
  expand?: {
    track?: TrackRecord;
    user?: UserRecord;
    [key: string]: any;
  };
  created: string;
  updated: string;
  collectionId?: string;
  collectionName?: string;
}

// ── 5. Users Collection ───────────────────────────────────────────────────────
export interface UserRecord {
  id: string;
  email: string;
  name?: string;
  username?: string;
  avatar?: string;
  role?: 'user' | 'admin';
  plan?: 'free' | 'vip' | 'premium';
  has_video_subscription?: boolean;
  created: string;
  updated: string;
  collectionId?: string;
  collectionName?: string;
}

// ── Adapter Utilities: PocketBase ⇄ Global Player Models ───────────────────────

/**
 * Converts a PocketBase TrackRecord to the internal TrackItem interface.
 */
export function trackRecordToTrackItem(
  record: TrackRecord,
  baseUrl: string = 'https://database.postlain.com'
): TrackItem {
  const collection = record.collectionName || record.collectionId || 'tracks';
  
  // Construct direct streaming audio URL
  let audioUrl = '';
  if (record.audio_file) {
    if (record.audio_file.startsWith('http://') || record.audio_file.startsWith('https://')) {
      audioUrl = record.audio_file;
    } else {
      audioUrl = `${baseUrl.replace(/\/$/, '')}/api/files/${collection}/${record.id}/${record.audio_file}`;
    }
  }

  // Construct cover image URL
  let coverUrl = '';
  if (record.cover_image) {
    if (record.cover_image.startsWith('http://') || record.cover_image.startsWith('https://')) {
      coverUrl = record.cover_image;
    } else {
      coverUrl = `${baseUrl.replace(/\/$/, '')}/api/files/${collection}/${record.id}/${record.cover_image}`;
    }
  }

  const artistName =
    typeof record.expand?.artist === 'object' && record.expand.artist?.name
      ? record.expand.artist.name
      : record.artist || 'Unknown Artist';

  return {
    id: record.id,
    album_id: record.album || record.id,
    title: record.title,
    artist: artistName,
    media_type: 'audio',
    audio_url: audioUrl,
    video_url: record.video_url || '',
    cover_url: coverUrl || '/icon.svg',
    original_year: record.created ? new Date(record.created).getFullYear() : new Date().getFullYear(),
    lyrics: record.lyrics || '',
    duration: Math.round(record.duration || 0),
    created_at: record.created || new Date().toISOString(),
  };
}

/**
 * Converts a PocketBase PlaylistRecord with expanded tracks to Album model.
 */
export function playlistRecordToAlbum(
  playlist: PlaylistRecord,
  baseUrl: string = 'https://database.postlain.com'
): Album {
  const collection = playlist.collectionName || playlist.collectionId || 'playlists';
  let coverUrl = '';
  if (playlist.cover_image) {
    if (playlist.cover_image.startsWith('http://') || playlist.cover_image.startsWith('https://')) {
      coverUrl = playlist.cover_image;
    } else {
      coverUrl = `${baseUrl.replace(/\/$/, '')}/api/files/${collection}/${playlist.id}/${playlist.cover_image}`;
    }
  }

  const tracks: TrackItem[] = Array.isArray(playlist.expand?.tracks)
    ? playlist.expand.tracks.map((t) => trackRecordToTrackItem(t, baseUrl))
    : [];

  return {
    id: playlist.id,
    title: playlist.title,
    artist: playlist.expand?.user?.name || playlist.expand?.user?.email || 'POSTLAIN VAULT',
    original_year: playlist.created ? new Date(playlist.created).getFullYear() : new Date().getFullYear(),
    cover_url: coverUrl || '/icon.svg',
    is_published: playlist.is_public !== false,
    created_at: playlist.created || new Date().toISOString(),
    tracks,
  };
}
