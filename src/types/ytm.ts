// ============================================================
// YTM (YouTube Music) Data Types — Hidden Music Vault
// Used by /api/ytm/feed and StreamingHub component
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
  fetchedAt: number;    // Epoch ms — used for cache freshness display
  source: 'live' | 'cached' | 'fallback';
}

// Unified item type for rendering in the hub grid
export type StreamingHubItem =
  | ({ kind: 'ytm-album' } & YtmAlbum)
  | ({ kind: 'ytm-track' } & YtmTrack)
  | ({ kind: 'ytm-playlist' } & YtmPlaylist);
