/**
 * GET /api/ytm/search?q={query}&type=all|songs|videos|soundcloud|albums|playlists
 *
 * Multi-Platform Search Proxy:
 *  - YouTube Music Songs
 *  - YouTube Music Videos (Official MVs)
 *  - SoundCloud (Remixes, Underground, Vinahouse, Phonk)
 *  - Albums & Playlists
 *
 * Locale: gl=VN, hl=vi
 * Cache: 5 minutes (public, s-maxage=300)
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

// Search params for YTM filters
const PARAMS_SONGS = 'EgWKAQIIAWoKEAkQBRAKEAMQBA%3D%3D';
const PARAMS_VIDEOS = 'EgWKAQIQAWoKEAkQChAFEAMQBA%3D%3D';
const PARAMS_ALBUMS = 'EgWKAQIYAWoKEAkQChAFEAMQBA%3D%3D';
const PARAMS_PLAYLISTS = 'Eg-KAQwIABAAGAAgACgBMABqChAEEAMQCRAFEAo%3D';

function getText(runs: any[]): string {
  if (!Array.isArray(runs)) return '';
  return runs.map((r: any) => r?.text ?? '').join('');
}

function getBestThumbnail(thumbnails: any[]): string {
  if (!Array.isArray(thumbnails) || thumbnails.length === 0) return '';
  return [...thumbnails].sort((a, b) => (b.width ?? 0) - (a.width ?? 0))[0]?.url ?? '';
}

async function ytmSearch(query: string, params: string = ''): Promise<any> {
  const body: any = {
    context: YTM_CONTEXT,
    query,
  };
  if (params) body.params = params;

  const res = await fetch(`${YTM_BASE}/search?key=${YTM_KEY}`, {
    method: 'POST',
    headers: YTM_HEADERS,
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(6000),
  });

  if (!res.ok) throw new Error(`YTM search failed: ${res.status}`);
  return res.json();
}

// ── SoundCloud Public Search ──────────────────────────────────────────────────
async function searchSoundcloud(query: string): Promise<YtmTrack[]> {
  try {
    // Search SoundCloud via public search proxy / API
    const scUrl = `https://api-v2.soundcloud.com/search/tracks?q=${encodeURIComponent(
      query
    )}&client_id=iZIs9mchVcX5lhVRyQGGAYlNPV6oSCkg&limit=15`;

    const res = await fetch(scUrl, {
      headers: {
        'User-Agent':
          'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
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
        coverUrl:
          item.artwork_url?.replace('-large', '-t500x500') ??
          item.user?.avatar_url ??
          '',
        duration: Math.round((item.duration ?? 0) / 1000),
        soundcloudUrl: item.permalink_url ?? '',
        platform: 'soundcloud' as const,
        mediaType: 'audio' as const,
        badge: 'SOUNDCLOUD',
      }));
  } catch {
    return [];
  }
}

// ── Parsers for YTM shelves ───────────────────────────────────────────────────
function parseSongRows(data: any, isVideo = false): YtmTrack[] {
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
        shelf?.musicCardShelfRenderer?.contents ??
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

function parseAlbumCards(data: any): YtmAlbum[] {
  const albums: YtmAlbum[] = [];
  try {
    const shelves =
      data?.contents?.tabbedSearchResultsRenderer?.tabs?.[0]?.tabRenderer
        ?.content?.sectionListRenderer?.contents ??
      data?.contents?.sectionListRenderer?.contents ??
      [];

    for (const shelf of shelves) {
      const items =
        shelf?.musicShelfRenderer?.contents ??
        shelf?.musicCardShelfRenderer?.contents ??
        [];
      for (const item of items) {
        const card = item?.musicTwoRowItemRenderer;
        if (!card) continue;
        const title = getText(card?.title?.runs ?? []);
        const artist = getText(card?.subtitle?.runs ?? []);
        const thumbnails = card?.thumbnailRenderer?.musicThumbnailRenderer?.thumbnail?.thumbnails ?? [];
        const coverUrl = getBestThumbnail(thumbnails);
        const browseId = card?.navigationEndpoint?.browseEndpoint?.browseId ?? '';
        const subtitleText = getText(card?.subtitle?.runs ?? []).toUpperCase();
        const releaseType = subtitleText.includes('SINGLE') ? 'SINGLE' : subtitleText.includes('EP') ? 'EP' : 'ALBUM';

        if (title && browseId) {
          albums.push({
            ytmId: browseId,
            title,
            artist,
            coverUrl,
            releaseType,
            platform: 'youtube',
            browseUrl: `https://music.youtube.com/browse/${browseId}`,
          });
        }
      }
    }
  } catch {}
  return albums;
}

// ── Main GET Handler ──────────────────────────────────────────────────────────
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const query = (searchParams.get('q') ?? '').trim();

  if (!query || query.length < 2) {
    return NextResponse.json(
      {
        query,
        topResult: null,
        songs: [],
        videos: [],
        soundcloud: [],
        albums: [],
        playlists: [],
        fetchedAt: Date.now(),
      } as YtmSearchResponse,
      { status: 200 }
    );
  }

  try {
    // Concurrent multi-source search
    const [songsData, videosData, scData, albumsData] = await Promise.allSettled([
      ytmSearch(query, PARAMS_SONGS),
      ytmSearch(query, PARAMS_VIDEOS),
      searchSoundcloud(query),
      ytmSearch(query, PARAMS_ALBUMS),
    ]);

    const songs = songsData.status === 'fulfilled' ? parseSongRows(songsData.value, false) : [];
    const videos = videosData.status === 'fulfilled' ? parseSongRows(videosData.value, true) : [];
    const soundcloud = scData.status === 'fulfilled' ? (scData.value as YtmTrack[]) : [];
    const albums = albumsData.status === 'fulfilled' ? parseAlbumCards(albumsData.value) : [];

    const topResult: YtmTrack | YtmAlbum | null = songs[0] || videos[0] || soundcloud[0] || albums[0] || null;

    const result: YtmSearchResponse = {
      query,
      topResult,
      songs: songs.slice(0, 15),
      videos: videos.slice(0, 10),
      soundcloud: soundcloud.slice(0, 10),
      albums: albums.slice(0, 8),
      playlists: [],
      fetchedAt: Date.now(),
    };

    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'public, s-maxage=300, stale-while-revalidate=600',
      },
    });
  } catch {
    return NextResponse.json(
      {
        query,
        topResult: null,
        songs: [],
        videos: [],
        soundcloud: [],
        albums: [],
        playlists: [],
        fetchedAt: Date.now(),
      } as YtmSearchResponse,
      { status: 200 }
    );
  }
}
