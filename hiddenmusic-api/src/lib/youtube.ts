export interface YouTubeSongItem {
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

export function parseDuration(text?: string): { seconds: number; formatted: string } {
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

export async function searchYouTubeMusic(query: string): Promise<YouTubeSongItem[]> {
  try {
    const ytRes = await fetch('https://www.youtube.com/youtubei/v1/search', {
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

    if (!ytRes.ok) return [];

    const data = (await ytRes.json()) as any;
    const contents =
      data?.contents?.twoColumnSearchResultsRenderer?.primaryContents?.sectionListRenderer?.contents || [];

    const results: YouTubeSongItem[] = [];

    for (const section of contents) {
      const items = section?.itemSectionRenderer?.contents || [];
      for (const item of items) {
        const video = item?.videoRenderer;
        if (!video || !video.videoId) continue;

        const videoId = video.videoId;
        const title = video.title?.runs?.[0]?.text || video.title?.simpleText || 'YouTube Track';
        const artist =
          video.ownerText?.runs?.[0]?.text ||
          video.shortBylineText?.runs?.[0]?.text ||
          'YouTube Music Artist';
        const lengthText = video.lengthText?.simpleText || video.lengthText?.runs?.[0]?.text;
        const durationInfo = parseDuration(lengthText);

        const thumbnails = video.thumbnail?.thumbnails || [];
        const bestThumbnail =
          thumbnails[thumbnails.length - 1]?.url || `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`;

        results.push({
          id: `yt_${videoId}`,
          youtube_id: videoId,
          source: 'youtube',
          title: title.replace(/(\(Official.*?\)|\[Official.*?\]|MV|Official Audio|Audio Official)/gi, '').trim(),
          artist: artist.replace(/ - Topic$/i, '').trim(),
          duration: durationInfo.seconds,
          duration_formatted: durationInfo.formatted,
          cover_url: bestThumbnail,
          audio_url: `/api/yt/stream/${videoId}`,
        });

        if (results.length >= 15) break;
      }
      if (results.length >= 15) break;
    }

    return results;
  } catch (err) {
    console.error('YouTube search error:', err);
    return [];
  }
}

export async function resolveYouTubeAudioStream(videoId: string): Promise<string | null> {
  const cleanId = videoId.replace(/^yt_/, '').trim();
  if (!cleanId) return null;

  try {
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
        videoId: cleanId,
      }),
    });

    if (!playerResponse.ok) return null;

    const data = (await playerResponse.json()) as any;
    const adaptiveFormats = data?.streamingData?.adaptiveFormats || [];

    const audioStreams = adaptiveFormats
      .filter((f: any) => f.mimeType && f.mimeType.startsWith('audio/') && f.url)
      .sort((a: any, b: any) => (b.bitrate || 0) - (a.bitrate || 0));

    if (audioStreams.length > 0 && audioStreams[0].url) {
      return audioStreams[0].url;
    }

    return null;
  } catch (err) {
    console.error('YouTube player stream error:', err);
    return null;
  }
}
