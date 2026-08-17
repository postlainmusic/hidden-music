export const runtime = 'edge';

interface PlayerFormat {
  itag?: number;
  mimeType?: string;
  bitrate?: number;
  contentLength?: string;
  url?: string;
  signatureCipher?: string;
  cipher?: string;
}

export async function GET(
  request: Request,
  { params }: { params: { videoId: string } }
) {
  const rawId = params?.videoId || '';
  const videoId = rawId.replace(/^yt_/, '').trim();

  if (!videoId) {
    return new Response(JSON.stringify({ error: 'Missing videoId' }), {
      status: 400,
      headers: {
        'Content-Type': 'application/json',
        'Access-Control-Allow-Origin': '*',
      },
    });
  }

  try {
    // 1. Primary Strategy: YouTube Android InnerTube Player API (Unsigned direct Audio URLs)
    const playerResponse = await fetch('https://www.youtube.com/youtubei/v1/player', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11) gzip',
      },
      body: JSON.stringify({
        context: {
          client: {
            clientName: 'ANDROID',
            clientVersion: '19.09.37',
            androidSdkVersion: 30,
            hl: 'en',
            gl: 'US',
          },
        },
        videoId: videoId,
      }),
    });

    let bestAudioUrl: string | null = null;
    let contentType = 'audio/mp4';

    if (playerResponse.ok) {
      const playerData = await playerResponse.json();
      const adaptiveFormats: PlayerFormat[] = playerData?.streamingData?.adaptiveFormats || [];

      // Filter for audio streams with direct 'url' property
      const audioStreams = adaptiveFormats
        .filter((f) => f.mimeType?.startsWith('audio/') && f.url)
        .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

      if (audioStreams.length > 0 && audioStreams[0].url) {
        bestAudioUrl = audioStreams[0].url;
        contentType = audioStreams[0].mimeType?.split(';')[0] || 'audio/mp4';
      }
    }

    // 2. Secondary Fallback: Web Embedded / iOS Client
    if (!bestAudioUrl) {
      try {
        const iosResponse = await fetch('https://www.youtube.com/youtubei/v1/player', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'User-Agent': 'com.google.ios.youtube/19.09.3 (iPhone14,3; U; CPU iOS 15_6 like Mac OS X)',
          },
          body: JSON.stringify({
            context: {
              client: {
                clientName: 'IOS',
                clientVersion: '19.09.3',
                deviceMake: 'Apple',
                deviceModel: 'iPhone14,3',
                hl: 'en',
                gl: 'US',
              },
            },
            videoId: videoId,
          }),
        });

        if (iosResponse.ok) {
          const iosData = await iosResponse.json();
          const formats: PlayerFormat[] = iosData?.streamingData?.adaptiveFormats || [];
          const audio = formats
            .filter((f) => f.mimeType?.startsWith('audio/') && f.url)
            .sort((a, b) => (b.bitrate || 0) - (a.bitrate || 0));

          if (audio.length > 0 && audio[0].url) {
            bestAudioUrl = audio[0].url;
            contentType = audio[0].mimeType?.split(';')[0] || 'audio/mp4';
          }
        }
      } catch (err) {
        console.warn('iOS fallback note:', err);
      }
    }

    // 3. Tertiary Fallback: Piped Public API Instances
    if (!bestAudioUrl) {
      const pipedInstances = [
        'https://pipedapi.kavin.rocks',
        'https://api.piped.privacydev.net',
        'https://pipedapi.leptons.xyz',
      ];

      for (const instance of pipedInstances) {
        try {
          const res = await fetch(`${instance}/streams/${videoId}`);
          if (res.ok) {
            const data = await res.json();
            const audioStreams = data?.audioStreams || [];
            if (audioStreams.length > 0 && audioStreams[0].url) {
              bestAudioUrl = audioStreams[0].url;
              contentType = audioStreams[0].mimeType || 'audio/webm';
              break;
            }
          }
        } catch (e) {
          // continue to next instance
        }
      }
    }

    if (!bestAudioUrl) {
      return new Response(JSON.stringify({ error: 'Audio stream unavailable for this track', videoId }), {
        status: 404,
        headers: {
          'Content-Type': 'application/json',
          'Access-Control-Allow-Origin': '*',
        },
      });
    }

    // Check if client requests JSON info or direct stream redirection
    const acceptHeader = request.headers.get('Accept') || '';
    if (acceptHeader.includes('application/json')) {
      return new Response(
        JSON.stringify({
          videoId,
          streamUrl: bestAudioUrl,
          contentType,
        }),
        {
          status: 200,
          headers: {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Cache-Control': 'public, max-age=1800',
          },
        }
      );
    }

    // Direct High-Speed 302 Redirect to Google Video CDN (Full seek support, zero latency)
    return new Response(null, {
      status: 302,
      headers: {
        Location: bestAudioUrl,
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
        'Access-Control-Allow-Headers': 'Range, Content-Type',
        'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges, Location',
        'Cache-Control': 'public, max-age=1800',
      },
    });
  } catch (error: any) {
    console.error('YouTube Stream Extractor Error:', error);
    return new Response(JSON.stringify({ error: error?.message || 'Stream extraction failed' }), {
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
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type',
      'Access-Control-Max-Age': '86400',
    },
  });
}
