/**
 * GET /api/ytm/search?q={query}&type=all|songs|albums|playlists
 *
 * YouTube Music search proxy with Vietnamese locale targeting.
 * Uses YTM's internal search API to return categorized results:
 *  - Top Result
 *  - Songs
 *  - Albums
 *  - Playlists
 *
 * Cache: 5 minutes (search results are relatively stable short-term)
 */

import { NextResponse } from 'next/server';
import type {
  YtmSearchResponse,
  YtmTrack,
  YtmAlbum,
  YtmPlaylist,
} from '@/types/ytm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// ── YTM Internal API ──────────────────────────────────────────────────────────
const YTM_BASE = 'https://music.youtube.com/youtubei/v1';
const YTM_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-KEHM_0m4I';

// Vietnamese locale for relevance
const YTM_CONTEXT = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20240814.01.00',
    hl: 'vi',
    gl: 'VN',
  },
};

const YTM_HEADERS = {
  'Content-Type': 'application/json',
  'User-Agent':
    'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
  Origin: 'https://music.youtube.com',
  Referer: 'https://music.youtube.com/',
  'X-Goog-Visitor-Id': 'CgtZM0hMR1ZHekVZWSiS9ZS2BjIKCgJWThIEGgAgRg%3D%3D',
};

// ── Search params for each type ───────────────────────────────────────────────
const SEARCH_PARAMS: Record<string, string> = {
  songs: 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D',
  albums: 'EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D',
  playlists: 'Eg-KAQwIABAAGAAgACgBMABqChAEEAMQCRAFEAo%3D',
  all: '',
};

// ── Helpers ───────────────────────────────────────────────────────────────────
function getText(runs: any[]): string {
  if (!Array.isArray(runs)) return '';
  return runs.map((r: any) => r?.text ?? '').join('');
}

function getBestThumbnail(thumbnails: any[]): string {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return '';
  return [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? '';
}

// ── YTM search call ───────────────────────────────────────────────────────────
async function ytmSearch(query: string, params: string = ''): Promise<any> {
  const body: any = {
    context: YTM_CONTEXT,
    query,
  };
  if (params) {
    body.params = params;
  }

  const res = await fetch(`${YTM_BASE}/search?key=${YTM_KEY}`, {
    method: 'POST',
    headers: YTM_HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });

  if (!res.ok) throw new Error(`YTM search failed: ${res.status}`);
  return res.json();
}

// ── Parse helpers per type ────────────────────────────────────────────────────
function parseSongItem(row: any): YtmTrack | null {
  const cols = row?.flexColumns ?? [];
  const title = getText(cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []);
  const artist = getText(cols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []);
  const thumbnails = row?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
  const coverUrl = getBestThumbnail(thumbnails);

  // Extract video ID from overlay or navigation endpoint
  const videoId =
    row?.overlay?.musicItemThumbnailOverlayRenderer?.content
      ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ??
    row?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text
      ?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ??
    '';

  // Extract duration from fixed columns
  const fixedCols = row?.fixedColumns ?? [];
  const durationText = getText(
    fixedCols[0]?.musicResponsiveListItemFixedColumnRenderer?.text?.runs ?? []
  );
  const durationParts = durationText.split(':').map(Number);
  const duration =
    durationParts.length === 2
      ? durationParts[0] * 60 + durationParts[1]
      : durationParts.length === 3
      ? durationParts[0] * 3600 + durationParts[1] * 60 + durationParts[2]
      : 0;

  if (!title || !videoId) return null;
  return {
    ytmId: videoId,
    title,
    artist,
    coverUrl,
    duration,
    youtubeUrl: `https://music.youtube.com/watch?v=${videoId}`,
  };
}

function parseAlbumItem(card: any): YtmAlbum | null {
  const title = getText(card?.title?.runs ?? []);
  const artist = getText(card?.subtitle?.runs ?? []);
  const thumbnails =
    card?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
  const coverUrl = getBestThumbnail(thumbnails);
  const browseId =
    card?.navigationEndpoint?.browseEndpoint?.browseId ?? '';
  const subtitleText = getText(card?.subtitle?.runs ?? []).toUpperCase();
  const releaseType =
    subtitleText.includes('SINGLE') ? 'SINGLE' : subtitleText.includes('EP') ? 'EP' : 'ALBUM';

  if (!title || !browseId) return null;
  return {
    ytmId: browseId,
    title,
    artist,
    coverUrl,
    releaseType,
    browseUrl: `https://music.youtube.com/browse/${browseId}`,
  };
}

function parsePlaylistItem(card: any): YtmPlaylist | null {
  const title = getText(card?.title?.runs ?? []);
  const subtitle = getText(card?.subtitle?.runs ?? []);
  const thumbnails =
    card?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
  const coverUrl = getBestThumbnail(thumbnails);
  const browseId =
    card?.navigationEndpoint?.browseEndpoint?.browseId ?? '';

  if (!title || !browseId) return null;
  return {
    ytmId: browseId,
    title,
    subtitle,
    coverUrl,
    trackCount: 0,
    browseUrl: `https://music.youtube.com/browse/${browseId}`,
  };
}

// ── Parse full search result data ─────────────────────────────────────────────
function parseSearchResults(data: any, query: string): YtmSearchResponse {
  const songs: YtmTrack[] = [];
  const albums: YtmAlbum[] = [];
  const playlists: YtmPlaylist[] = [];
  let topResult: YtmTrack | YtmAlbum | null = null;

  try {
    const shelves =
      data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents ??
      data?.contents?.sectionListRenderer?.contents ??
      [];

    for (const shelf of shelves) {
      const shelfRenderer =
        shelf?.musicShelfRenderer ??
        shelf?.musicCardShelfRenderer ??
        null;
      if (!shelfRenderer) continue;

      const shelfTitle = getText(shelfRenderer?.title?.runs ?? '').toLowerCase();
      const items: any[] = shelfRenderer?.contents ?? [];

      for (const item of items) {
        const row = item?.musicResponsiveListItemRenderer;
        const card = item?.musicTwoRowItemRenderer;

        // Detect content type by shelf title or item structure
        if (shelfTitle.includes('top result') || shelfTitle.includes('kết quả hàng đầu')) {
          if (card) {
            const album = parseAlbumItem(card);
            if (album && !topResult) topResult = album;
          } else if (row) {
            const song = parseSongItem(row);
            if (song && !topResult) topResult = song;
          }
        } else if (
          shelfTitle.includes('bài hát') ||
          shelfTitle.includes('song') ||
          shelfTitle.includes('track')
        ) {
          if (row) {
            const song = parseSongItem(row);
            if (song) songs.push(song);
          }
        } else if (
          shelfTitle.includes('album') ||
          shelfTitle.includes('đĩa') ||
          shelfTitle.includes('single')
        ) {
          if (card) {
            const album = parseAlbumItem(card);
            if (album) albums.push(album);
          }
        } else if (
          shelfTitle.includes('playlist') ||
          shelfTitle.includes('danh sách')
        ) {
          if (card) {
            const pl = parsePlaylistItem(card);
            if (pl) playlists.push(pl);
          }
        } else {
          // Unknown shelf — try to parse as songs (most common)
          if (row) {
            const song = parseSongItem(row);
            if (song) songs.push(song);
          }
          if (card) {
            const album = parseAlbumItem(card);
            if (album) albums.push(album);
          }
        }
      }
    }
  } catch {
    // Return partial results on parse error
  }

  return {
    query,
    topResult,
    songs: songs.slice(0, 20),
    albums: albums.slice(0, 10),
    playlists: playlists.slice(0, 10),
    fetchedAt: Date.now(),
  };
}

// ── Main GET handler ──────────────────────────────────────────────────────────
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim();
  const type = (searchParams.get('type') ?? 'all').toLowerCase();

  if (!query || query.length < 2) {
    return NextResponse.json(
      {
        query,
        topResult: null,
        songs: [],
        albums: [],
        playlists: [],
        fetchedAt: Date.now(),
      } as YtmSearchResponse,
      { status: 200 }
    );
  }

  try {
    const params = SEARCH_PARAMS[type] ?? '';
    const data = await ytmSearch(query, params);
    const result = parseSearchResults(data, query);

    return NextResponse.json(result, {
      headers: {
        // 5-minute cache — search results are stable short-term
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch (err: any) {
    return NextResponse.json(
      {
        query,
        topResult: null,
        songs: [],
        albums: [],
        playlists: [],
        fetchedAt: Date.now(),
      } as YtmSearchResponse,
      {
        status: 200, // Return empty results (not error) so UI degrades gracefully
        headers: { 'Cache-Control': 'no-store' },
      }
    );
  }
}
