/**
 * GET /api/ytm/resolve?id={videoId}
 *
 * Resolves a YouTube video ID into a directly playable audio stream URL
 * via public Invidious instances (open-source YouTube frontend).
 *
 * Strategy:
 *  1. Try Invidious instance A — /api/v1/videos/{id}
 *  2. On failure, try instance B, then C
 *  3. Parse adaptiveFormats → find best audio-only stream (prefer m4a/mp4)
 *  4. Return { audioUrl, title, artist, coverUrl, duration, ... }
 *
 * Cache: no-store (Invidious stream URLs are signed & expire in ~6 hours)
 *
 * Failure: returns { error, message } with HTTP 503
 */

import { NextResponse } from 'next/server';
import type { YtmResolvedStream, YtmResolveError } from '@/types/ytm';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

// ── Invidious instance pool (tried in order) ──────────────────────────────────
// Public instances with open APIs — fallback chain for resilience
const INVIDIOUS_INSTANCES = [
  'https://inv.nadeko.net',
  'https://invidious.privacyredirect.com',
  'https://yt.cdaut.de',
  'https://invidious.lunar.icu',
  'https://vid.puffyan.us',
];

// ── Preferred audio MIME types (priority order) ────────────────────────────────
const AUDIO_MIME_PRIORITY = [
  'audio/mp4',   // m4a — best compatibility with HTML5 <audio>
  'audio/webm',  // webm opus — high quality
  'audio/ogg',   // ogg — fallback
];

// ── ID validation ──────────────────────────────────────────────────────────────
function isValidVideoId(id: string): boolean {
  return /^[a-zA-Z0-9_-]{11}$/.test(id);
}

// ── Pick best audio format from Invidious adaptiveFormats ─────────────────────
function pickBestAudio(adaptiveFormats: any[]): any | null {
  if (!Array.isArray(adaptiveFormats)) return null;

  // Filter to audio-only streams (no video track)
  const audioOnly = adaptiveFormats.filter(
    (f) =>
      f.type?.startsWith('audio/') &&
      !f.type?.includes('video') &&
      f.url
  );

  if (audioOnly.length === 0) return null;

  // Sort by MIME priority, then by bitrate (highest first)
  audioOnly.sort((a, b) => {
    const aPriority = AUDIO_MIME_PRIORITY.findIndex((m) =>
      a.type?.startsWith(m)
    );
    const bPriority = AUDIO_MIME_PRIORITY.findIndex((m) =>
      b.type?.startsWith(m)
    );
    const aP = aPriority === -1 ? 99 : aPriority;
    const bP = bPriority === -1 ? 99 : bPriority;
    if (aP !== bP) return aP - bP;
    return (b.bitrate ?? 0) - (a.bitrate ?? 0);
  });

  return audioOnly[0];
}

// ── Fetch video info from one Invidious instance ──────────────────────────────
async function fetchFromInstance(
  instance: string,
  videoId: string
): Promise<YtmResolvedStream> {
  const url = `${instance}/api/v1/videos/${videoId}?fields=title,author,videoThumbnails,lengthSeconds,adaptiveFormats`;

  const res = await fetch(url, {
    headers: {
      'User-Agent':
        'Mozilla/5.0 (compatible; HiddenMusicVault/1.0)',
      Accept: 'application/json',
    },
    signal: AbortSignal.timeout(8000), // 8s timeout per instance
  });

  if (!res.ok) {
    throw new Error(`${instance} returned ${res.status}`);
  }

  const data = await res.json();

  // Pick best audio stream
  const bestAudio = pickBestAudio(data.adaptiveFormats ?? []);
  if (!bestAudio) {
    throw new Error(`${instance}: no audio stream found for ${videoId}`);
  }

  // Pick best thumbnail (maxres → high → medium)
  const thumbnails: any[] = data.videoThumbnails ?? [];
  const thumb =
    thumbnails.find((t) => t.quality === 'maxres') ??
    thumbnails.find((t) => t.quality === 'high') ??
    thumbnails.find((t) => t.quality === 'medium') ??
    thumbnails[0];

  const title: string = data.title ?? 'Unknown Title';
  const artist: string = data.author ?? 'Unknown Artist';
  const coverUrl: string = thumb?.url ?? '';
  const duration: number = Number(data.lengthSeconds ?? 0);

  return {
    videoId,
    title,
    artist,
    coverUrl,
    duration,
    audioUrl: bestAudio.url,
    mimeType: bestAudio.type?.split(';')[0] ?? 'audio/mp4',
    bitrate: bestAudio.bitrate ?? 0,
    resolvedVia: instance,
  };
}

// ── Main GET handler ──────────────────────────────────────────────────────────
export async function GET(request: Request): Promise<NextResponse> {
  const { searchParams } = new URL(request.url);
  const videoId = (searchParams.get('id') ?? '').trim();

  // Validate ID format
  if (!videoId || !isValidVideoId(videoId)) {
    const err: YtmResolveError = {
      error: 'invalid_id',
      message: `Invalid YouTube video ID: "${videoId}". Must be 11 alphanumeric characters.`,
    };
    return NextResponse.json(err, { status: 400 });
  }

  // Try each Invidious instance in sequence
  let lastError: string = 'unknown';
  for (const instance of INVIDIOUS_INSTANCES) {
    try {
      const result = await fetchFromInstance(instance, videoId);
      return NextResponse.json(result, {
        headers: {
          // Stream URLs expire — never cache
          'Cache-Control': 'no-store',
          'X-Resolved-Via': instance,
        },
      });
    } catch (err: any) {
      lastError = err?.message ?? String(err);
      // Continue to next instance
      continue;
    }
  }

  // All instances failed
  const errorBody: YtmResolveError = {
    error: 'resolve_failed',
    message: `All Invidious instances failed for "${videoId}". Last error: ${lastError}`,
  };
  return NextResponse.json(errorBody, {
    status: 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
