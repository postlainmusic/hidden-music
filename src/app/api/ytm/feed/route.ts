/**
 * GET /api/ytm/feed
 *
 * Multi-Platform Curated Music Discovery Feed:
 *  1. Curated V-Hop & V-R&B (MCK, Wren Evans, Low G, tlinh, Obito, 24k.Right)
 *  2. Official Music Videos (Trending VN MVs)
 *  3. SoundCloud Underground & Remix (Vinahouse, Phonk, Chillstep, Live Sets)
 *  4. Trending Quick Picks (VN Charts)
 *  5. Global Hits (Travis Scott, The Weeknd, Metro Boomin)
 *  6. Lo-fi & Late Night Chill (Chillwave, Ambient R&B)
 *  7. New Releases (Albums & Singles)
 *  8. Mood Playlists
 *
 * Cache: s-maxage=3600 (1 hour)
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

const YTM_BASE = 'https://music.youtube.com/youtubei/v1';
const YTM_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-KEHM_0m4I';

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

const BROWSE_NEW_RELEASES = 'FEmusic_new_releases';
const BROWSE_CHARTS = 'FEmusic_charts';
const BROWSE_MOODS = 'FEmusic_moods_and_genres';

// Curated query lists
const VHOP_QUERIES = ['MCK', 'Wren Evans', 'Low G', 'tlinh', 'Obito rap', '24k.Right'];
const VIDEO_QUERIES = ['Official Music Video 2024', 'MV Vpop mới nhất', 'MCK MV', 'Wren Evans MV'];
const GLOBAL_QUERIES = ['Travis Scott', 'The Weeknd', 'Metro Boomin', 'Playboi Carti'];
const LOFI_QUERIES = ['lo-fi hip hop', 'late night r&b 2024', 'chillwave beats'];
const SC_QUERIES = ['viet mix 2024', 'vinahouse chill', 'phonk remix viet', 'lofi viet'];

const SONGS_PARAMS = 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D';
const VIDEOS_PARAMS = 'EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D';

function getText(runs: any[]): string {
  if (!Array.isArray(runs)) return '';
  return runs.map((r: any) => r?.text ?? '').join('');
}

function getBestThumbnail(thumbnails: any[]): string {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return '';
  return [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? '';
}

async function ytmBrowse(browseId: string): Promise<any> {
  const res = await fetch(`${YTM_BASE}/browse?key=${YTM_KEY}`, {
    method: 'POST',
    headers: YTM_HEADERS,
    body: JSON.stringify({ context: YTM_CONTEXT, browseId }),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`YTM browse ${browseId} failed`);
  return res.json();
}

async function ytmSearch(query: string, params: string = ''): Promise<any> {
  const body: any = { context: YTM_CONTEXT, query };
  if (params) body.params = params;
  const res = await fetch(`${YTM_BASE}/search?key=${YTM_KEY}`, {
    method: 'POST',
    headers: YTM_HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6000),
  });
  if (!res.ok) throw new Error(`YTM search failed`);
  return res.json();
}

// ── SoundCloud Curated Fetch ──────────────────────────────────────────────────
async function fetchSoundCloudCurated(): Promise<YtmTrack[]> {
  try {
    const q = SC_QUERIES[Math.floor(Math.random() * SC_QUERIES.length)];
    const scUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(
      q
    )}&client_id=iZIs9mchVcX5lhVRyQGGAYlNPV6oSCkg&limit=16`;

    const res = await fetch(scUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
        Accept: 'application/json',
      },
      signal: AbortSignal.timeout(4000),
    });

    if (!res.ok) return [];
    const data = await res.json();
    const collection: any[] = data?.collection ?? [];

    return collection
      .filter((item) => item?.title && item?.id)
      .map((item) => ({
        ytmId: `sc_${item.id}`,
        title: item.title,
        artist: item.user?.username ?? 'SoundCloud Artist',
        coverUrl: item.artwork_url?.replace('-large', '-t500x500') ?? item.user?.avatar_url ?? '',
        duration: Math.round((item.duration ?? 0) / 1000),
        soundcloudUrl: item.permalink_url ?? '',
        platform: 'soundcloud' as const,
        mediaType: 'audio' as const,
        badge: 'REMIX / EDIT',
      }));
  } catch {
    return [];
  }
}

// ── Parsers ───────────────────────────────────────────────────────────────────
function parseTracksFromShelf(data: any, isVideo = false): YtmTrack[] {
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
            ?.musicPlayButtonRenderer?.playNavigationEndpoint?.watchEndpoint?.videoId ??
          row?.flexColumns?.[0]?.musicResponsiveListItemFlexColumnRenderer?.text
            ?.runs?.[0]?.navigationEndpoint?.watchEndpoint?.videoId ??
          '';

        if (title && videoId) {
          tracks.push({
            ytmId: videoId,
            title,
            artist,
            coverUrl,
            duration: 0,
            youtubeUrl: `https://www.youtube.com/watch?v=${videoId}`,
            platform: 'youtube',
            mediaType: isVideo ? 'video' : 'audio',
            badge: isVideo ? 'OFFICIAL MV' : undefined,
          });
        }
      }
    }
  } catch {}
  return tracks;
}

async function fetchCuratedSection(queries: string[], params: string, isVideo = false): Promise<YtmTrack[]> {
  const results = await Promise.allSettled(queries.map((q) => ytmSearch(q, params)));
  const merged: YtmTrack[] = [];
  const seen = new Set<string>();
  for (const res of results) {
    if (res.status !== 'fulfilled') continue;
    for (const track of parseTracksFromShelf(res.value, isVideo)) {
      if (!seen.has(track.ytmId)) {
        seen.add(track.ytmId);
        merged.push(track);
      }
    }
  }
  return merged.slice(0, 18);
}

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
          const releaseType = subtitleText.includes('SINGLE') ? 'SINGLE' : subtitleText.includes('EP') ? 'EP' : 'ALBUM';
          if (title && ytmId) {
            albums.push({ ytmId, title, artist, coverUrl, releaseType, platform: 'youtube', browseUrl: `https://music.youtube.com/browse/${ytmId}` });
          }
        }
      }
    }
  } catch {}
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
            tracks.push({ ytmId: videoId, title, artist, coverUrl, duration: 0, youtubeUrl: `https://music.youtube.com/watch?v=${videoId}`, rank: rank++, platform: 'youtube', mediaType: 'audio' });
          }
        }
      }
    }
  } catch {}
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
            playlists.push({ ytmId: browseId, title, subtitle: 'YouTube Music', coverUrl: '', trackCount: 0, platform: 'youtube', browseUrl: `https://music.youtube.com/browse/${browseId}` });
          }
        }
      }
    }
  } catch {}
  return playlists.slice(0, 12);
}

// ── Main GET Handler ──────────────────────────────────────────────────────────
export async function GET(): Promise<NextResponse> {
  const startTime = Date.now();

  const [newRelData, chartsData, moodsData, vhopData, videosData, scData, globalData, lofiData] =
    await Promise.allSettled([
      ytmBrowse(BROWSE_NEW_RELEASES),
      ytmBrowse(BROWSE_CHARTS),
      ytmBrowse(BROWSE_MOODS),
      fetchCuratedSection(VHOP_QUERIES, SONGS_PARAMS, false),
      fetchCuratedSection(VIDEO_QUERIES, VIDEOS_PARAMS, true),
      fetchSoundCloudCurated(),
      fetchCuratedSection(GLOBAL_QUERIES, SONGS_PARAMS, false),
      fetchCuratedSection(LOFI_QUERIES, SONGS_PARAMS, false),
    ]);

  const newReleases: YtmAlbum[] = newRelData.status === 'fulfilled' ? parseNewReleases(newRelData.value) : [];
  const trending: YtmTrack[] = chartsData.status === 'fulfilled' ? parseTrending(chartsData.value) : [];
  const moodPlaylists: YtmPlaylist[] = moodsData.status === 'fulfilled' ? parseMoodPlaylists(moodsData.value) : [];
  const curatedVhop: YtmTrack[] = vhopData.status === 'fulfilled' ? (vhopData.value as YtmTrack[]) : [];
  const curatedVideos: YtmTrack[] = videosData.status === 'fulfilled' ? (videosData.value as YtmTrack[]) : [];
  const curatedSoundcloud: YtmTrack[] = scData.status === 'fulfilled' ? (scData.value as YtmTrack[]) : [];
  const curatedGlobal: YtmTrack[] = globalData.status === 'fulfilled' ? (globalData.value as YtmTrack[]) : [];
  const curatedLofi: YtmTrack[] = lofiData.status === 'fulfilled' ? (lofiData.value as YtmTrack[]) : [];

  const payload: YtmFeedResponse = {
    newReleases,
    trending,
    moodPlaylists,
    curatedVhop,
    curatedVideos,
    curatedSoundcloud,
    curatedGlobal,
    curatedLofi,
    fetchedAt: startTime,
    source: 'live',
  };

  return NextResponse.json(payload, {
    headers: {
      'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      'X-Feed-Latency-Ms': String(Date.now() - startTime),
    },
  });
}
