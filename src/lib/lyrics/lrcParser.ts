/**
 * Synced Lyric (.lrc) Parser & Binary Search Engine
 * Parses raw LRC timecode formats [mm:ss.xx] and [mm:ss.xxx]
 * Provides O(log N) instantaneous binary search for the active lyric line
 */

export interface LyricLine {
  id: number;
  timeSec: number;
  text: string;
}

export class LrcParser {
  /**
   * Parse raw LRC string into a sorted array of LyricLine objects
   */
  static parse(rawLrc: string): LyricLine[] {
    if (!rawLrc || typeof rawLrc !== 'string') return [];

    const lines = rawLrc.split('\n');
    const result: LyricLine[] = [];
    const timecodeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;

    let idCounter = 0;

    for (const line of lines) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      // Extract all timecodes in the line
      let match: RegExpExecArray | null;
      timecodeRegex.lastIndex = 0;

      const timestamps: number[] = [];
      let lastIndex = 0;

      while ((match = timecodeRegex.exec(trimmed)) !== null) {
        const minutes = parseInt(match[1], 10);
        const seconds = parseInt(match[2], 10);
        const fraction = match[3] ? (match[3].length === 2 ? parseInt(match[3], 10) / 100 : parseInt(match[3], 10) / 1000) : 0;
        const totalSec = minutes * 60 + seconds + fraction;
        timestamps.push(totalSec);
        lastIndex = timecodeRegex.lastIndex;
      }

      if (timestamps.length > 0) {
        const text = trimmed.substring(lastIndex).trim();
        for (const timeSec of timestamps) {
          result.push({
            id: idCounter++,
            timeSec,
            text,
          });
        }
      }
    }

    // Sort by timestamp
    return result.sort((a, b) => a.timeSec - b.timeSec);
  }

  /**
   * Binary Search O(log N) to find the active lyric index for the current playback time
   */
  static findActiveIndex(lyrics: LyricLine[], currentTimeSec: number): number {
    if (!Array.isArray(lyrics) || lyrics.length === 0) return -1;
    if (currentTimeSec < lyrics[0].timeSec) return -1;

    let low = 0;
    let high = lyrics.length - 1;
    let bestIdx = 0;

    while (low <= high) {
      const mid = Math.floor((low + high) / 2);
      if (lyrics[mid].timeSec <= currentTimeSec) {
        bestIdx = mid;
        low = mid + 1; // Look further right for the closest past timestamp
      } else {
        high = mid - 1;
      }
    }

    return bestIdx;
  }
}
