// ============================================================
// YTM (YouTube Music) Data Types — Hidden Music Vault
// Used by /api/ytm/feed, /api/ytm/search, /api/ytm/resolve
// and the StreamingHub component
// ============================================================

export type YtmReleaseType = 'SINGLE' | 'ALBUM' | 'EP';

export interface YtmTrack {
  ytmId: string;        // YouTube video ID (e.g. "dQw4w9WgXcQ")
  title: string;
  artist: string;
  coverUrl: string;     // High-res thumbnail URL from i.ytimg.com
  duration: number;     // Duration in seconds (0 if unknown)
  youtubeUrl: string;   // https://music.youtube.com/watch?v=...
  releaseType?: YtmReleaseType;
  rank?: number;        // Chart position (1-based)
}

export interface YtmAlbum {
  ytmId: string;        // YouTube Music browse ID
  title: string;
  artist: string;
  coverUrl: string;
  releaseType: YtmReleaseType;
  trackCount?: number;
  browseUrl: string;    // https://music.youtube.com/browse/...
  year?: number;
}

export interface YtmPlaylist {
  ytmId: string;        // YouTube Music playlist browse ID
  title: string;
  subtitle: string;
  coverUrl: string;
  trackCount: number;
  browseUrl: string;    // https://music.youtube.com/playlist?list=...
}

export interface YtmFeedResponse {
  newReleases: YtmAlbum[];
  trending: YtmTrack[];
  moodPlaylists: YtmPlaylist[];
  curatedVhop: YtmTrack[];       // Vietnamese Hip-hop / R&B
  curatedGlobal: YtmTrack[];     // Global Trap / Melodic / Trapsoul
  curatedLofi: YtmTrack[];       // Lo-fi / Late-Night / Chillwave
  fetchedAt: number;             // Epoch ms — cache freshness
  source: 'live' | 'cached' | 'fallback';
}

// ── Search types ──────────────────────────────────────────────────────────────

export interface YtmSearchResponse {
  query: string;
  topResult: YtmTrack | YtmAlbum | null;
  songs: YtmTrack[];
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
  duration: number;     // seconds
  audioUrl: string;     // Direct playable m4a/webm URL (time-limited ~6h)
  mimeType: string;     // e.g. "audio/mp4" or "audio/webm"
  bitrate: number;      // bits per second
  resolvedVia: string;  // which Invidious instance resolved this
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
