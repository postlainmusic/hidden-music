/**
 * Synchronized LRC Lyrics Parser & Time Synchronizer
 * Converts .lrc timestamped text format [mm:ss.xx] into structured timeline objects
 */

export interface LyricLine {
  time: number;
  text: string;
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
