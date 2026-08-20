/**
 * GET /api/ytm/feed
 *
 * Edge-compatible YouTube Music feed proxy.
 * Fetches new releases, trending tracks, and mood playlists from the
 * YouTube Music unofficial browse API, then returns a unified payload.
 *
 * Cache strategy: Cache-Control s-maxage=3600, stale-while-revalidate=86400
 *
 * The YouTube Music "youtubei" internal API is not officially supported.
 * We call browse endpoints that power the YTM web client.
 * On failure, we return empty arrays so the page never breaks.
 */

import { NextResponse } from 'next/server';
import type { YtmAlbum, YtmTrack, YtmPlaylist, YtmFeedResponse } from '@/types/ytm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// ── YTM Internal API constants ────────────────────────────────────────────────
const YTM_BASE = 'https://music.youtube.com/youtubei/v1';
const YTM_CONTEXT = {
  client: {
    clientName: 'WEB_REMIX',
    clientVersion: '1.20240814.01.00',
    hl: 'en',
    gl: 'US',
  },
};

// Browse IDs for YTM sections
const BROWSE_NEW_RELEASES = 'FEmusic_new_releases';
const BROWSE_CHARTS = 'FEmusic_charts';
const BROWSE_MOODS = 'FEmusic_moods_and_genres';

// ── Thumbnail helper ──────────────────────────────────────────────────────────
function getBestThumbnail(thumbnails: any[]): string {
  if (!thumbnails || thumbnails.length === 0) return '';
  // Prefer widest available thumbnail
  const sorted = [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0));
  return sorted[0]?.url ?? '';
}

// ── Text extraction helper ────────────────────────────────────────────────────
function getText(runs: any[]): string {
  if (!runs || !Array.isArray(runs)) return '';
  return runs.map((r: any) => r.text ?? '').join('');
}

// ── Browse API helper ─────────────────────────────────────────────────────────
async function ytmBrowse(browseId: string): Promise<any> {
  const res = await fetch(`${YTM_BASE}/browse?key=AIzaSyC9XL3ZjWddXya6X74dJoCTL-KEHM_0m4I`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'User-Agent':
        'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      Origin: 'https://music.youtube.com',
      Referer: 'https://music.youtube.com/',
      'X-Goog-Visitor-Id': 'CgtZM0hMR1ZHekVZWSiS9ZS2BjIKCgJVUxIEGgAgRg%3D%3D',
    },
    body: JSON.stringify({ context: YTM_CONTEXT, browseId }),
  });
  if (!res.ok) throw new Error(`YTM browse ${browseId} failed: ${res.status}`);
  return res.json();
}

// ── Parse New Releases ────────────────────────────────────────────────────────
function parseNewReleases(data: any): YtmAlbum[] {
  const albums: YtmAlbum[] = [];
  try {
    // Navigate to section contents
    const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs ?? [];
    for (const tab of tabs) {
      const sections =
        tab?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
      for (const section of sections) {
        const items =
          section?.musicImmersiveCarouselShelfRenderer?.contents ??
          section?.musicCarouselShelfRenderer?.contents ??
          [];
        for (const item of items) {
          const card =
            item?.musicTwoRowItemRenderer ??
            item?.musicNavigationButtonRenderer ??
            null;
          if (!card) continue;

          const title = getText(card?.title?.runs);
          const artist = getText(card?.subtitle?.runs);
          const thumbnails = card?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
          const coverUrl = getBestThumbnail(thumbnails);
          const browseEndpoint = card?.navigationEndpoint?.browseEndpoint;
          const ytmId = browseEndpoint?.browseId ?? '';
          const subtitleText = getText(card?.subtitle?.runs ?? []).toUpperCase();
          const releaseType =
            subtitleText.includes('SINGLE')
              ? 'SINGLE'
              : subtitleText.includes('EP')
              ? 'EP'
              : 'ALBUM';

          if (title && ytmId) {
            albums.push({
              ytmId,
              title,
              artist,
              coverUrl,
              releaseType,
              browseUrl: `https://music.youtube.com/browse/${ytmId}`,
            });
          }
        }
      }
    }
  } catch {
    // silently fail — return what we have
  }
  return albums.slice(0, 20);
}

// ── Parse Trending Tracks ─────────────────────────────────────────────────────
function parseTrending(data: any): YtmTrack[] {
  const tracks: YtmTrack[] = [];
  try {
    const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs ?? [];
    let rank = 1;
    for (const tab of tabs) {
      const sections =
        tab?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
      for (const section of sections) {
        const items = section?.musicShelfRenderer?.contents ?? [];
        for (const item of items) {
          const row = item?.musicResponsiveListItemRenderer;
          if (!row) continue;

          // Column 0 = title, column 1 = artist/album
          const cols = row?.flexColumns ?? [];
          const title = getText(
            cols[0]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []
          );
          const artist = getText(
            cols[1]?.musicResponsiveListItemFlexColumnRenderer?.text?.runs ?? []
          );
          const thumbnails = row?.thumbnail?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
          const coverUrl = getBestThumbnail(thumbnails);
          const videoId = row?.overlay?.musicItemThumbnailOverlayRenderer
            ?.content?.musicPlayButtonRenderer?.playNavigationEndpoint
            ?.watchEndpoint?.videoId ?? '';

          if (title && videoId) {
            tracks.push({
              ytmId: videoId,
              title,
              artist,
              coverUrl,
              duration: 0,
              youtubeUrl: `https://music.youtube.com/watch?v=${videoId}`,
              rank: rank++,
            });
          }
        }
      }
    }
  } catch {
    // silently fail
  }
  return tracks.slice(0, 24);
}

// ── Parse Mood Playlists ──────────────────────────────────────────────────────
function parseMoodPlaylists(data: any): YtmPlaylist[] {
  const playlists: YtmPlaylist[] = [];
  try {
    const tabs = data?.contents?.singleColumnBrowseResultsRenderer?.tabs ?? [];
    for (const tab of tabs) {
      const sections =
        tab?.tabRenderer?.content?.sectionListRenderer?.contents ?? [];
      for (const section of sections) {
        const grid = section?.gridRenderer?.items ?? [];
        for (const item of grid) {
          const card = item?.musicNavigationButtonRenderer;
          if (!card) continue;

          const title = getText(card?.buttonText?.runs ?? []);
          const browseId =
            card?.clickCommand?.browseEndpoint?.browseId ??
            card?.navigationEndpoint?.browseEndpoint?.browseId ??
            '';

          if (title && browseId) {
            playlists.push({
              ytmId: browseId,
              title,
              subtitle: 'YouTube Music',
              coverUrl: '',
              trackCount: 0,
              browseUrl: `https://music.youtube.com/browse/${browseId}`,
            });
          }
        }
      }
    }
  } catch {
    // silently fail
  }
  return playlists.slice(0, 12);
}

// ── Main GET Handler ──────────────────────────────────────────────────────────
export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();

  // Run all three fetches concurrently, fail gracefully on any error
  const [newRelData, chartsData, moodsData] = await Promise.allSettled([
    ytmBrowse(BROWSE_NEW_RELEASES),
    ytmBrowse(BROWSE_CHARTS),
    ytmBrowse(BROWSE_MOODS),
  ]);

  const newReleases: YtmAlbum[] =
    newRelData.status === 'fulfilled' ? parseNewReleases(newRelData.value) : [];
  const trending: YtmTrack[] =
    chartsData.status === 'fulfilled' ? parseTrending(chartsData.value) : [];
  const moodPlaylists: YtmPlaylist[] =
    moodsData.status === 'fulfilled' ? parseMoodPlaylists(moodsData.value) : [];

  const allFailed = newReleases.length === 0 && trending.length === 0 && moodPlaylists.length === 0;

  const payload: YtmFeedResponse = {
    newReleases,
    trending,
    moodPlaylists,
    fetchedAt: startTime,
    source: allFailed ? 'fallback' : 'live',
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-YTM-Fetch-Ms': String(Date.now() - startTime),
    },
  });
}
