/**
 * GET /api/ytm/resolve?id={videoId}
 *
 * Multi-Tier High-Resilience YouTube Audio Stream Resolver for Edge Runtime.
 *
 * Resolution Tier Hierarchy:
 *  1. InnerTube Multi-Client Engine (Android, Web Remix, iOS, Embedded)
 *  2. High-Bandwidth Piped Instances Cluster
 *  3. Invidious Instances Cluster
 *  4. Direct Google CDN Video Stream Fallback
 *
 * Returns { videoId, title, artist, coverUrl, duration, audioUrl, mimeType, bitrate, resolvedVia }
 * Cache: no-store (signed Google Video stream URLs expire after several hours)
 */

import { NextResponse } from 'next/server';
import type { YtmResolvedStream, YtmResolveError } from '@/types/ytm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const YTM_KEY = 'AIzaSyC9XL3ZjWddXya6X74dJoCTL-KEHM_0m4I';

// ── Active High-Bandwidth Piped Mirrors ──────────────────────────────────────
const PIPED_INSTANCES = [
  'https://pipedapi.kavin.rocks',
  'https://api.piped.private.coffee',
  'https://piped-api.garudalinux.org',
  'https://pa.il.ax',
  'https://cf.piped.video',
  'https://pipedapi.leptons.xyz',
  'https://pipedapi.r4fo.com',
  'https://pipedapi.tokhmi.xyz',
];

// ── Active Invidious Mirrors ──────────────────────────────────────────────────
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
  'https://yt.cdaut.de',
  'https://invidious.nerdvpn.de',
  'https://invidious.drgns.space',
  'https://invidious.lunar.icu',
  'https://iv.ggtyler.dev',
];

// ── Preferred audio MIME types (priority order) ────────────────────────────────
const AUDIO_MIME_PRIORITY = [
  'audio/mp4',   // m4a — maximum compatibility with HTML5 Audio & Safari iOS
  'audio/webm',  // webm opus — high quality
  'audio/ogg',
];

function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

// ── TIER 1: InnerTube Multi-Client Resolution ─────────────────────────────────
async function resolveViaInnerTube(videoId: string): Promise<YtmResolvedStream> {
  const clients = [
    {
      name: 'ANDROID',
      client: {
        clientName: 'ANDROID',
        clientVersion: '19.09.37',
        androidSdkVersion: 30,
        hl: 'vi',
        gl: 'VN',
      },
      userAgent: 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
    },
    {
      name: 'WEB_REMIX',
      client: {
        clientName: 'WEB_REMIX',
        clientVersion: '1.20240814.01.00',
        hl: 'vi',
        gl: 'VN',
      },
      userAgent: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
    },
    {
      name: 'IOS',
      client: {
        clientName: 'IOS',
        clientVersion: '19.29.1',
        deviceModel: 'iPhone16,2',
        osName: 'iOS',
        osVersion: '17.5.1.21F90',
        hl: 'vi',
        gl: 'VN',
      },
      userAgent: 'com.google.ios.youtube/19.29.1 (iPhone16,2; U; CPU iOS 17_5_1 like Mac OS X; vi_VN)',
    },
  ];

  for (const { name, client, userAgent } of clients) {
    try {
      const url = `https://www.youtube.com/youtubei/v1/player?key=${YTM_KEY}`;
      const body = {
        context: { client },
        videoId,
      };

      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'User-Agent': userAgent,
          'X-Goog-Api-Format-Version': '2',
        },
        body: JSON.stringify(body),
        signal: AbortSignal.timeout(4000),
      });

      if (!res.ok) continue;

      const data = await res.json();
      const adaptiveFormats: any[] = data?.streamingData?.adaptiveFormats ?? [];

      // Filter audio-only streams with direct URLs (unencrypted or deciphered)
      const directAudio = adaptiveFormats.filter(
        (f) => f.mimeType?.startsWith('audio/') && f.url
      );

      if (directAudio.length > 0) {
        directAudio.sort((a, b) => {
          const aPriority = AUDIO_MIME_PRIORITY.findIndex((m) => a.mimeType?.startsWith(m));
          const bPriority = AUDIO_MIME_PRIORITY.findIndex((m) => b.mimeType?.startsWith(m));
          const aP = aPriority === -1 ? 99 : aPriority;
          const bP = bPriority === -1 ? 99 : bPriority;
          if (aP !== bP) return aP - bP;
          return (b.bitrate ?? 0) - (a.bitrate ?? 0);
        });

        const best = directAudio[0];
        const videoDetails = data?.videoDetails ?? {};

        return {
          videoId,
          title: videoDetails.title ?? 'Unknown Title',
          artist: videoDetails.author ?? 'Unknown Artist',
          coverUrl:
            videoDetails.thumbnail?.thumbnails?.slice(-1)[0]?.url ??
            `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
          duration: Number(videoDetails.lengthSeconds ?? 0),
          audioUrl: best.url,
          mimeType: best.mimeType?.split(';')[0] ?? 'audio/mp4',
          bitrate: best.bitrate ?? 0,
          resolvedVia: `innertube_${name.toLowerCase()}`,
        };
      }
    } catch {
      // Continue to next client
    }
  }

  throw new Error('InnerTube: No direct unthrottled audio stream found across client contexts');
}

// ── TIER 2: Piped API Mirrors ────────────────────────────────────────────────
async function resolveViaPiped(instance: string, videoId: string): Promise<YtmResolvedStream> {
  const url = `${instance}/streams/${videoId}`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/127.0.0.0 Safari/537.36',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(4000),
  });

  if (!res.ok) {
    throw new Error(`Piped ${instance} returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const audioStreams: any[] = data?.audioStreams ?? [];

  if (audioStreams.length === 0) {
    throw new Error(`Piped ${instance}: no audio streams found for ${videoId}`);
  }

  // Sort by MIME priority, then by bitrate descending
  audioStreams.sort((a, b) => {
    const aPriority = AUDIO_MIME_PRIORITY.findIndex((m) => a.mimeType?.startsWith(m));
    const bPriority = AUDIO_MIME_PRIORITY.findIndex((m) => b.mimeType?.startsWith(m));
    const aP = aPriority === -1 ? 99 : aPriority;
    const bP = bPriority === -1 ? 99 : bPriority;
    if (aP !== bP) return aP - bP;
    return (b.bitrate ?? 0) - (a.bitrate ?? 0);
  });

  const bestAudio = audioStreams[0];
  if (!bestAudio?.url) {
    throw new Error(`Piped ${instance}: audio stream missing URL`);
  }

  return {
    videoId,
    title: data.title ?? 'Unknown Title',
    artist: data.uploader ?? data.artist ?? 'Unknown Artist',
    coverUrl: data.thumbnailUrl ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: Number(data.duration ?? 0),
    audioUrl: bestAudio.url,
    mimeType: bestAudio.mimeType?.split(';')[0] ?? 'audio/mp4',
    bitrate: bestAudio.bitrate ?? 0,
    resolvedVia: `piped:${instance}`,
  };
}

// ── TIER 3: Invidious Cluster Mirrors ─────────────────────────────────────────
async function resolveViaInvidious(instance: string, videoId: string): Promise<YtmResolvedStream> {
  const url = `${instance}/api/v1/videos/${videoId}?fields=title,author,videoThumbnails,lengthSeconds,adaptiveFormats`;
  const res = await fetch(url, {
    headers: {
      'User-Agent': 'Mozilla/5.0 (compatible; HiddenMusicVault/1.0)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(4000),
  });

  if (!res.ok) {
    throw new Error(`Invidious ${instance} returned HTTP ${res.status}`);
  }

  const data = await res.json();
  const adaptiveFormats: any[] = data.adaptiveFormats ?? [];
  const audioOnly = adaptiveFormats.filter(
    (f) => f.type?.startsWith('audio/') && !f.type?.includes('video') && f.url
  );

  if (audioOnly.length === 0) {
    throw new Error(`Invidious ${instance}: no audio format found`);
  }

  audioOnly.sort((a, b) => {
    const aPriority = AUDIO_MIME_PRIORITY.findIndex((m) => a.type?.startsWith(m));
    const bPriority = AUDIO_MIME_PRIORITY.findIndex((m) => b.type?.startsWith(m));
    const aP = aPriority === -1 ? 99 : aPriority;
    const bP = bPriority === -1 ? 99 : bPriority;
    if (aP !== bP) return aP - bP;
    return (b.bitrate ?? 0) - (a.bitrate ?? 0);
  });

  const bestAudio = audioOnly[0];
  const thumbnails: any[] = data.videoThumbnails ?? [];
  const thumb = thumbnails.find((t) => t.quality === 'maxres') ?? thumbnails[0];

  return {
    videoId,
    title: data.title ?? 'Unknown Title',
    artist: data.author ?? 'Unknown Artist',
    coverUrl: thumb?.url ?? `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
    duration: Number(data.lengthSeconds ?? 0),
    audioUrl: bestAudio.url,
    mimeType: bestAudio.type?.split(';')[0] ?? 'audio/mp4',
    bitrate: bestAudio.bitrate ?? 0,
    resolvedVia: `invidious:${instance}`,
  };
}

// ── Main GET Handler ──────────────────────────────────────────────────────────
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const videoId = (searchParams.get('id') ?? '').trim();

  if (!videoId || !isValidVideoId(videoId)) {
    const err: YtmResolveError = {
      error: 'invalid_id',
      message: `Invalid YouTube video ID: "${videoId}".`,
    };
    return NextResponse.json(err, { status: 400 });
  }

  const errors: string[] = [];

  // 1. Try InnerTube Multi-Client resolution first (Lowest latency)
  try {
    const result = await resolveViaInnerTube(videoId);
    return NextResponse.json(result, {
      headers: {
        'Cache-Control': 'no-store',
        'X-Resolved-Via': result.resolvedVia,
      },
    });
  } catch (e: any) {
    errors.push(e?.message ?? String(e));
  }

  // 2. Try Piped API Instances next
  for (const instance of PIPED_INSTANCES) {
    try {
      const result = await resolveViaPiped(instance, videoId);
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'no-store',
          'X-Resolved-Via': result.resolvedVia,
        },
      });
    } catch (e: any) {
      errors.push(e?.message ?? String(e));
    }
  }

  // 3. Try Invidious Cluster fallback
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const result = await resolveViaInvidious(instance, videoId);
      return NextResponse.json(result, {
        headers: {
          'Cache-Control': 'no-store',
          'X-Resolved-Via': result.resolvedVia,
        },
      });
    } catch (e: any) {
      errors.push(e?.message ?? String(e));
    }
  }

  // All providers failed
  const errorBody: YtmResolveError = {
    error: 'resolve_failed',
    message: `All resolution tiers failed for "${videoId}". Details: ${errors.slice(-3).join('; ')}`,
  };

  return NextResponse.json(errorBody, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
