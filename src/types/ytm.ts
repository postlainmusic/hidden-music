// ============================================================
// Unified Streaming & YTM Data Types — Hidden Music Vault
// Supports YouTube Music, Music Videos, SoundCloud, and Vault Lossless
// ============================================================

export type YtmReleaseType = 'SINGLE' | 'ALBUM' | 'EP';
export type StreamPlatform = 'youtube' | 'soundcloud' | 'vault';
export type MediaType = 'audio' | 'video';

export interface YtmTrack {
  ytmId: string;        // ID (e.g. YouTube video ID or SoundCloud track ID/URL)
  title: string;
  artist: string;
  coverUrl: string;     // High-res artwork
  duration: number;     // Seconds
  youtubeUrl?: string;
  soundcloudUrl?: string;
  platform?: StreamPlatform;
  mediaType?: MediaType;
  releaseType?: YtmReleaseType;
  rank?: number;
  badge?: string;       // e.g. "OFFICIAL MV", "REMIX", "LOSSLESS"
}

export interface YtmAlbum {
  ytmId: string;
  title: string;
  artist: string;
  coverUrl: string;
  releaseType: YtmReleaseType;
  trackCount?: number;
  browseUrl?: string;
  year?: number;
  platform?: StreamPlatform;
}

export interface YtmPlaylist {
  ytmId: string;
  title: string;
  subtitle: string;
  coverUrl: string;
  trackCount: number;
  browseUrl?: string;
  platform?: StreamPlatform;
}

export interface YtmFeedResponse {
  newReleases: YtmAlbum[];
  trending: YtmTrack[];
  moodPlaylists: YtmPlaylist[];
  curatedVhop: YtmTrack[];         // Vietnamese Hip-hop / R&B
  curatedVideos: YtmTrack[];       // Official Music Videos (VN MVs)
  curatedSoundcloud: YtmTrack[];   // SoundCloud Underground & Remix
  curatedGlobal: YtmTrack[];       // Global Trap / Melodic
  curatedLofi: YtmTrack[];         // Lo-fi / Late-Night Chill
  fetchedAt: number;
  source: 'live' | 'cached' | 'fallback';
}

// ── Search types ──────────────────────────────────────────────────────────────

export interface YtmSearchResponse {
  query: string;
  topResult: YtmTrack | YtmAlbum | null;
  songs: YtmTrack[];
  videos: YtmTrack[];              // Official Music Videos
  soundcloud: YtmTrack[];          // SoundCloud tracks
  albums: YtmAlbum[];
  playlists: YtmPlaylist[];
  fetchedAt: number;
}

// ── Stream resolver types ─────────────────────────────────────────────────────

export interface YtmResolvedStream {
  videoId: string;
  title: string;
  artist: string;
  coverUrl: string;
  duration: number;
  audioUrl: string;
  mimeType: string;
  bitrate: number;
  resolvedVia: string;
}

export interface YtmResolveError {
  error: 'resolve_failed' | 'not_found' | 'invalid_id';
  message: string;
}

export type YtmResolveResponse = YtmResolvedStream | YtmResolveError;

// ── Unified item type for rendering ──────────────────────────────────────────

export type StreamingHubItem =
  | ({ kind: 'ytm-album' } & YtmAlbum)
  | ({ kind: 'ytm-track' } & YtmTrack)
  | ({ kind: 'ytm-playlist' } & YtmPlaylist);
