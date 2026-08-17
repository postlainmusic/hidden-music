export const runtime = 'edge';

interface YouTubeSearchResult {
  id: string;
  youtube_id: string;
  source: 'youtube';
  title: string;
  artist: string;
  duration: number;
  duration_formatted: string;
  cover_url: string;
  audio_url: string;
}

function parseDurationText(text?: string): { seconds: number; formatted: string } {
  if (!text) return { seconds: 200, formatted: '03:20' };
  const clean = text.trim();
  const parts = clean.split(':').map((p) => parseInt(p, 10));
  if (parts.length === 2 && !isNaN(parts[0]) && !isNaN(parts[1])) {
    return { seconds: parts[0] * 60 + parts[1], formatted: clean };
  }
  if (parts.length === 3 && !isNaN(parts[0]) && !isNaN(parts[1]) && !isNaN(parts[2])) {
    return { seconds: parts[0] * 3600 + parts[1] * 60 + parts[2], formatted: clean };
  }
  return { seconds: 200, formatted: clean || '03:20' };
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const query = searchParams.get('q')?.trim();

  if (!query) {
    return new Response(JSON.stringify([]), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    // 1. Query YouTube Music / YouTube Innertube API
    const ytResponse = await fetch('https://www.youtube.com/youtubei/v1/search', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'WEB',
            clientVersion: '2.20240401.01.00',
            hl: 'vi',
            gl: 'VN',
          },
        },
        query: `${query} official audio`,
      }),
    });

    const results: YouTubeSearchResult[] = [];

    if (ytResponse.ok) {
      const data = await ytResponse.json();
      const sections =
        data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

      for (const section of sections) {
        const items = section?.itemSectionRenderer?.contents || [];
        for (const item of items) {
          const video = item?.videoRenderer;
          if (video && video.videoId) {
            const videoId = video.videoId;
            const title = video.title?.runs?.[0]?.text || 'Untitled Track';
            const artist = video.ownerText?.runs?.[0]?.text || video.longBylineText?.runs?.[0]?.text || 'YouTube Artist';
            const durationText = video.lengthText?.simpleText || '';
            const { seconds, formatted } = parseDurationText(durationText);
            const coverUrl =
              video.thumbnail?.thumbnails?.[video.thumbnail.thumbnails.length - 1]?.url ||
              `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

            results.push({
              id: `yt_${videoId}`,
              youtube_id: videoId,
              source: 'youtube',
              title,
              artist,
              duration: seconds,
              duration_formatted: formatted,
              cover_url: coverUrl,
              audio_url: `/api/yt/stream/${videoId}`,
            });

            if (results.length >= 25) break;
          }
        }
        if (results.length >= 25) break;
      }
    }

    // Fallback: If Innertube returned fewer results, try alternative Piped / Invidious API fallback
    if (results.length === 0) {
      try {
        const fallbackRes = await fetch(`https://pipedapi.kavin.rocks/search?q=${encodeURIComponent(query)}&filter=music_songs`);
        if (fallbackRes.ok) {
          const fallbackData = await fallbackRes.json();
          const items = fallbackData?.items || [];
          for (const item of items) {
            if (item.url && item.url.includes('/watch?v=')) {
              const videoId = item.url.split('/watch?v=')[1];
              const { seconds, formatted } = parseDurationText(item.duration ? `${Math.floor(item.duration / 60)}:${item.duration % 60}` : '');
              results.push({
                id: `yt_${videoId}`,
                youtube_id: videoId,
                source: 'youtube',
                title: item.title || 'Untitled Track',
                artist: item.uploaderName || 'YouTube Music',
                duration: item.duration || seconds,
                duration_formatted: formatted,
                cover_url: item.thumbnail || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
                audio_url: `/api/yt/stream/${videoId}`,
              });
              if (results.length >= 20) break;
            }
          }
        }
      } catch (err) {
        console.warn('Fallback search note:', err);
      }
    }

    return new Response(JSON.stringify(results), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
        'Cache-Control': 'public, s-maxage=3600, stale-while-revalidate=86400',
      },
    });
  } catch (error: any) {
    console.error('YouTube Search API Error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Failed to search YouTube Music' }), {
      status: 500,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }
}

export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Range',
      'Access-Control-Max-Age': '86400',
    },
  });
}
