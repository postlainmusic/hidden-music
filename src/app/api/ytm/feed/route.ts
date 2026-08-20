/**
 * GET /api/ytm/feed
 *
 * YouTube Music curated feed proxy — Vietnamese locale + curated taste.
 * Fetches:
 *  1. New Releases (browse FEmusic_new_releases, gl=VN)
 *  2. Charts / Trending (browse FEmusic_charts, gl=VN)
 *  3. Mood Playlists (browse FEmusic_moods_and_genres)
 *  4. Curated V-Hop / V-R&B section (search: "MCK", "Wren Evans", etc.)
 *  5. Curated Global Trap / Melodic section (search: "Travis Scott", "The Weeknd", etc.)
 *  6. Curated Lo-fi / Chill section (search: "lo-fi hip hop", "late night r&b")
 *
 * Cache: s-maxage=3600, stale-while-revalidate=86400 (1-hour TTL)
 */

import { NextResponse } from 'next/server';
import type {
  YtmAlbum,
  YtmTrack,
  YtmPlaylist,
  YtmFeedResponse,
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

// Browse IDs for YTM sections
const BROWSE_NEW_RELEASES = 'FEmusic_new_releases';
const BROWSE_CHARTS = 'FEmusic_charts';
const BROWSE_MOODS = 'FEmusic_moods_and_genres';

// ── Curated query lists (targeted taste curation) ─────────────────────────────
// V-Hop / V-R&B — underground Vietnamese artists
const VHOP_QUERIES = ['MCK', 'Wren Evans', 'Low G', 'tlinh', 'Obito rap', '24k.Right', 'Andree Right Hand'];
// Global Trap / Melodic / Trapsoul
const GLOBAL_QUERIES = ['Travis Scott', 'The Weeknd new', 'Metro Boomin', 'Playboi Carti'];
// Lo-fi / Late-night / Chillwave
const LOFI_QUERIES = ['lo-fi hip hop', 'late night r&b 2024', 'chillwave beats'];

// Song search params for YTM
const SONGS_PARAMS = 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D';

// ── Helpers ───────────────────────────────────────────────────────────────────
function getText(runs: any[]): string {
  if (!Array.isArray(runs)) return '';
  return runs.map((r: any) => r?.text ?? '').join('');
}

function getBestThumbnail(thumbnails: any[]): string {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return '';
  return [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? '';
}

// ── API call helpers ──────────────────────────────────────────────────────────
async function ytmBrowse(browseId: string): Promise<any> {
  const res = await fetch(`${YTM_BASE}/browse?key=${YTM_KEY}`, {
    method: 'POST',
    headers: YTM_HEADERS,
    body: JSON.stringify({ context: YTM_CONTEXT, browseId }),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`YTM browse ${browseId} failed: ${res.status}`);
  return res.json();
}

async function ytmSearch(query: string, params: string = ''): Promise<any> {
  const body: any = { context: YTM_CONTEXT, query };
  if (params) body.params = params;
  const res = await fetch(`${YTM_BASE}/search?key=${YTM_KEY}`, {
    method: 'POST',
    headers: YTM_HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(10000),
  });
  if (!res.ok) throw new Error(`YTM search "${query}" failed: ${res.status}`);
  return res.json();
}

// ── Parsers ───────────────────────────────────────────────────────────────────
function parseNewReleases(data: any): YtmAlbum[] {
  const albums: YtmAlbum[] = [];
  try {
    const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs ?? [];
    for (const tab of tabs) {
      const sections = tab?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
      for (const section of sections) {
        const items =
          section?.musicImmersiveCarouselShelfRenderer?.contents ??
          section?.musicCarouselShelfRenderer?.contents ??
          [];
        for (const item of items) {
          const card = item?.musicTwoRowItemRenderer ?? item?.musicNavigationButtonRenderer ?? null;
          if (!card) continue;
          const title = getText(card?.title?.runs);
          const artist = getText(card?.subtitle?.runs);
          const thumbnails = card?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
          const coverUrl = getBestThumbnail(thumbnails);
          const ytmId = card?.navigationEndpoint?.browseEndpoint?.browseId ?? '';
          const subtitleText = getText(card?.subtitle?.runs ?? []).toUpperCase();
          const releaseType =
            subtitleText.includes('SINGLE') ? 'SINGLE' : subtitleText.includes('EP') ? 'EP' : 'ALBUM';
          if (title && ytmId) {
            albums.push({ ytmId, title, artist, coverUrl, releaseType, browseUrl: `https://music.youtube.com/browse/${ytmId}` });
          }
        }
      }
    }
  } catch { /* silent */ }
  return albums.slice(0, 20);
}

function parseTrending(data: any): YtmTrack[] {
  const tracks: YtmTrack[] = [];
  try {
    const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs ?? [];
    let rank = 1;
    for (const tab of tabs) {
      const sections = tab?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
      for (const section of sections) {
        for (const item of section?.musicShelfRenderer?.contents ?? []) {
          const row = item?.musicResponsiveListItemRenderer;
          if (!row) continue;
          const cols = row?.flexColumns ?? [];
          const title = getText(cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []);
          const artist = getText(cols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []);
          const thumbnails = row?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
          const coverUrl = getBestThumbnail(thumbnails);
          const videoId =
            row?.overlay?.musicItemThumbnailOverlayRenderer?.content
              ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ?? '';
          if (title && videoId) {
            tracks.push({ ytmId: videoId, title, artist, coverUrl, duration: 0, youtubeUrl: `https://music.youtube.com/watch?v=${videoId}`, rank: rank++ });
          }
        }
      }
    }
  } catch { /* silent */ }
  return tracks.slice(0, 24);
}

function parseMoodPlaylists(data: any): YtmPlaylist[] {
  const playlists: YtmPlaylist[] = [];
  try {
    const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs ?? [];
    for (const tab of tabs) {
      const sections = tab?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
      for (const section of sections) {
        for (const item of section?.gridRenderer?.items ?? []) {
          const card = item?.musicNavigationButtonRenderer;
          if (!card) continue;
          const title = getText(card?.buttonText?.runs ?? []);
          const browseId =
            card?.clickCommand?.browseEndpoint?.browseId ??
            card?.navigationEndpoint?.browseEndpoint?.browseId ?? '';
          if (title && browseId) {
            playlists.push({ ytmId: browseId, title, subtitle: 'YouTube Music', coverUrl: '', trackCount: 0, browseUrl: `https://music.youtube.com/browse/${browseId}` });
          }
        }
      }
    }
  } catch { /* silent */ }
  return playlists.slice(0, 12);
}

// ── Parse curated search results into YtmTrack[] ──────────────────────────────
function parseCuratedTracks(data: any): YtmTrack[] {
  const tracks: YtmTrack[] = [];
  try {
    const shelves =
      data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents ??
      data?.contents?.sectionListRenderer?.contents ??
      [];

    for (const shelf of shelves) {
      const items =
        shelf?.musicShelfRenderer?.contents ??
        shelf?.musicImmersiveCarouselShelfRenderer?.contents ??
        [];
      for (const item of items) {
        const row = item?.musicResponsiveListItemRenderer;
        if (!row) continue;
        const cols = row?.flexColumns ?? [];
        const title = getText(cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []);
        const artist = getText(cols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []);
        const thumbnails = row?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
        const coverUrl = getBestThumbnail(thumbnails);
        const videoId =
          row?.overlay?.musicItemThumbnailOverlayRenderer?.content
            ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ?? '';
        if (title && videoId) {
          tracks.push({ ytmId: videoId, title, artist, coverUrl, duration: 0, youtubeUrl: `https://music.youtube.com/watch?v=${videoId}` });
        }
      }
    }
  } catch { /* silent */ }
  return tracks;
}

// ── Fetch multiple queries and merge results ──────────────────────────────────
async function fetchCuratedSection(queries: string[]): Promise<YtmTrack[]> {
  const results = await Promise.allSettled(
    queries.map((q) => ytmSearch(q, SONGS_PARAMS))
  );
  const merged: YtmTrack[] = [];
  const seen = new Set<string>();
  for (const result of results) {
    if (result.status !== 'fulfilled') continue;
    for (const track of parseCuratedTracks(result.value)) {
      if (!seen.has(track.ytmId)) {
        seen.add(track.ytmId);
        merged.push(track);
      }
    }
  }
  return merged.slice(0, 20);
}

// ── Main GET handler ──────────────────────────────────────────────────────────
export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();

  // Fire all fetches concurrently
  const [newRelData, chartsData, moodsData, vhopData, globalData, lofiData] =
    await Promise.allSettled([
      ytmBrowse(BROWSE_NEW_RELEASES),
      ytmBrowse(BROWSE_CHARTS),
      ytmBrowse(BROWSE_MOODS),
      fetchCuratedSection(VHOP_QUERIES),
      fetchCuratedSection(GLOBAL_QUERIES),
      fetchCuratedSection(LOFI_QUERIES),
    ]);

  const newReleases: YtmAlbum[] =
    newRelData.status === 'fulfilled' ? parseNewReleases(newRelData.value) : [];
  const trending: YtmTrack[] =
    chartsData.status === 'fulfilled' ? parseTrending(chartsData.value) : [];
  const moodPlaylists: YtmPlaylist[] =
    moodsData.status === 'fulfilled' ? parseMoodPlaylists(moodsData.value) : [];
  const curatedVhop: YtmTrack[] =
    vhopData.status === 'fulfilled' ? (vhopData.value as YtmTrack[]) : [];
  const curatedGlobal: YtmTrack[] =
    globalData.status === 'fulfilled' ? (globalData.value as YtmTrack[]) : [];
  const curatedLofi: YtmTrack[] =
    lofiData.status === 'fulfilled' ? (lofiData.value as YtmTrack[]) : [];

  const allEmpty =
    newReleases.length === 0 &&
    trending.length === 0 &&
    moodPlaylists.length === 0 &&
    curatedVhop.length === 0 &&
    curatedGlobal.length === 0;

  const payload: YtmFeedResponse = {
    newReleases,
    trending,
    moodPlaylists,
    curatedVhop,
    curatedGlobal,
    curatedLofi,
    fetchedAt: startTime,
    source: allEmpty ? 'fallback' : 'live',
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-YTM-Fetch-Ms': String(Date.now() - startTime),
    },
  });
}
