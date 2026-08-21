import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Cache-Control': 'public, s-maxage=86400, stale-while-revalidate=604800',
};

export async function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS_HEADERS });
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const trackTitle = searchParams.get('title');
  const artistName = searchParams.get('artist');
  const duration = searchParams.get('duration');

  if (!trackTitle) {
    return NextResponse.json({ error: 'Missing track title' }, { status: 400, headers: CORS_HEADERS });
  }

  try {
    // ── TIER 1: LRCLIB Open-Source Synced Lyrics API ───────────────────────────
    const cleanTitle = trackTitle.replace(/\(.*?\)|\[.*?\]/g, '').trim();
    const cleanArtist = (artistName || '').replace(/ft\..*|feat\..*/i, '').trim();

    let lrcUrl = `https://lrclib.net/api/get?track_name=${encodeURIComponent(cleanTitle)}`;
    if (cleanArtist) lrcUrl += `&artist_name=${encodeURIComponent(cleanArtist)}`;
    if (duration) lrcUrl += `&duration=${encodeURIComponent(duration)}`;

    const lrcRes = await fetch(lrcUrl, {
      headers: {
        'User-Agent': 'HiddenMusicVault/1.0 (https://github.com/postlainmusic/hidden-music)',
      },
    });

    if (lrcRes.ok) {
      const data = await lrcRes.json();
      if (data?.syncedLyrics) {
        return NextResponse.json(
          {
            title: trackTitle,
            artist: artistName,
            syncedLyrics: data.syncedLyrics,
            plainLyrics: data.plainLyrics || '',
            source: 'lrclib_synced',
          },
          { headers: CORS_HEADERS }
        );
      } else if (data?.plainLyrics) {
        return NextResponse.json(
          {
            title: trackTitle,
            artist: artistName,
            syncedLyrics: null,
            plainLyrics: data.plainLyrics,
            source: 'lrclib_plain',
          },
          { headers: CORS_HEADERS }
        );
      }
    }

    // ── TIER 2: Search Fallback on LRCLIB ──────────────────────────────────────
    const searchUrl = `https://lrclib.net/api/search?q=${encodeURIComponent(`${cleanTitle} ${cleanArtist}`)}`;
    const searchRes = await fetch(searchUrl, {
      headers: {
        'User-Agent': 'HiddenMusicVault/1.0 (https://github.com/postlainmusic/hidden-music)',
      },
    });

    if (searchRes.ok) {
      const searchItems = await searchRes.json();
      if (Array.isArray(searchItems) && searchItems.length > 0) {
        const bestMatch = searchItems.find((item) => item.syncedLyrics) || searchItems[0];
        if (bestMatch) {
          return NextResponse.json(
            {
              title: trackTitle,
              artist: artistName,
              syncedLyrics: bestMatch.syncedLyrics || null,
              plainLyrics: bestMatch.plainLyrics || '',
              source: 'lrclib_search',
            },
            { headers: CORS_HEADERS }
          );
        }
      }
    }

    return NextResponse.json(
      {
        title: trackTitle,
        artist: artistName,
        syncedLyrics: null,
        plainLyrics: null,
        message: 'No synced lyrics found',
      },
      { headers: CORS_HEADERS }
    );
  } catch (err: any) {
    return NextResponse.json(
      { error: 'Lyrics fetch failed', details: err.message },
      { status: 500, headers: CORS_HEADERS }
    );
  }
}
