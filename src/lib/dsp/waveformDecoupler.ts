/**
 * Waveform Decoupler & Amplitude Memory Cache
 * Retrieves instantaneous amplitude at any timecode in O(1)
 */

class WaveformCache {
  private cache = new Map<string, number[]>();

  set(trackId: string, buckets: number[]) {
    this.cache.set(trackId, buckets);
  }

  get(trackId: string): number[] | undefined {
    return this.cache.get(trackId);
  }

  getAmplitude(trackId: string, timeSec: number): number {
    const buckets = this.cache.get(trackId);
    if (!buckets || buckets.length === 0) return 0;
    const idx = Math.max(0, Math.min(buckets.length - 1, Math.floor(timeSec * 20)));
    return buckets[idx] ?? 0;
  }

  clear() {
    this.cache.clear();
  }
}

export const waveformCache = new WaveformCache();
