/**
 * Synchronized LRC Lyrics Parser & Time Synchronizer
 * Converts .lrc timestamped text format [mm:ss.xx] into structured timeline objects
 */

export interface LyricLine {
  time: number;
  text: string;
}

/**
 * Extract video music start offset from LRC headers: [video_offset:mm:ss] or [video_offset:ss]
 */
export function extractVideoOffset(lrcText: string): number {
  if (!lrcText) return 0;
  const match = lrcText.match(/\[(?:video_offset|music_start):(\d{1,2}):(\d{2})(?:\.(\d+))?\]/i);
  if (match) {
    const mins = parseInt(match[1], 10);
    const secs = parseInt(match[2], 10);
    const ms = match[3] ? parseInt(match[3], 10) / 1000 : 0;
    return mins * 60 + secs + ms;
  }
  const secMatch = lrcText.match(/\[(?:video_offset|music_start):(\d+(?:\.\d+)?)\]/i);
  if (secMatch) {
    return parseFloat(secMatch[1]);
  }
  return 0;
}

/**
 * Helper to format seconds into mm:ss string
 */
export function formatOffsetString(seconds: number): string {
  if (!seconds || seconds <= 0) return '';
  const mins = Math.floor(seconds / 60);
  const secs = Math.floor(seconds % 60);
  return `${mins < 10 ? '0' : ''}${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

/**
 * Parse raw .lrc string into sorted array of timestamped LyricLines
 */
export function parseLrc(lrcText: string): LyricLine[] {
  if (!lrcText) return [];

  const lines = lrcText.split(/\r?\n/);
  const result: LyricLine[] = [];
  const timestampRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

  for (const line of lines) {
    // Ignore header tags like [video_offset:...], [ar:...], [ti:...]
    if (/^\[(video_offset|music_start|ar|ti|al|by|offset):/i.test(line.trim())) {
      continue;
    }
    const matches = Array.from(line.matchAll(timestampRegex));
    if (matches.length > 0) {
      const text = line.replace(timestampRegex, '').trim();
      for (const match of matches) {
        const mins = parseInt(match[1], 10);
        const secs = parseInt(match[2], 10);
        let ms = 0;
        if (match[3]) {
          const rawMs = match[3];
          ms = parseInt(rawMs.length === 2 ? `${rawMs}0` : rawMs, 10);
        }
        const time = mins * 60 + secs + ms / 1000;
        result.push({ time, text: text || '♪' });
      }
    }
  }

  return result.sort((a, b) => a.time - b.time);
}

export function getActiveLyricIndex(lyrics: LyricLine[], currentTime: number): number {
  if (!lyrics || lyrics.length === 0) return -1;
  // If we are still in the song intro before the first line is sung, return -1 (no active line)
  if (currentTime < lyrics[0].time) return -1;

  let activeIdx = -1;
  for (let i = 0; i < lyrics.length; i++) {
    if (currentTime >= lyrics[i].time) {
      activeIdx = i;
    } else {
      break;
    }
  }
  return activeIdx;
}

