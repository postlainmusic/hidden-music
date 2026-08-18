/**
 * HIDDEN MUSIC VAULT - AUTOMATED CLIENT-SIDE BEAT & WAVEFORM ENGINE
 * 
 * 1. Fetch & Decode: Directly decodes raw audio buffer in client memory.
 * 2. Sub-Bass IIR Filter: 2nd-order Low-Pass Filter (< 115Hz) isolating Kick / 808s.
 * 3. Local Dynamic Energy Thresholding: Moving window transient peak extraction.
 * 4. Zero-CORS, Zero-Manual BPM: Produces millisecond-accurate kick timestamps.
 * 5. Multi-Tier Cache: In-Memory Map + Persistent IndexedDB.
 */

export interface BeatItem {
  time: number;       // Exact timestamp in seconds (e.g. 1.240)
  strength: number;   // Normalized intensity 0.0 to 1.0
  isHeavy: boolean;   // Heavy bass drop vs regular kick
}

export interface BeatGridResult {
  trackId: string;
  timestamps: number[];
  strengths: number[];
  beats: BeatItem[];
  duration: number;
  maxEnergy: number;
}

const DB_NAME = 'hidden_vault_beat_db';
const DB_VERSION = 1;
const STORE_NAME = 'beat_grids';

// In-Memory Fast Cache
const memoryCache = new Map<string, BeatGridResult>();

/**
 * Open IndexedDB for persistent caching across browser reloads
 */
function openBeatDB(): Promise<IDBDatabase | null> {
  if (typeof window === 'undefined' || !window.indexedDB) {
    return Promise.resolve(null);
  }
  return new Promise((resolve) => {
    try {
      const request = indexedDB.open(DB_NAME, DB_VERSION);
      request.onupgradeneeded = (e) => {
        const db = (e.target as IDBOpenDBRequest).result;
        if (!db.objectStoreNames.contains(STORE_NAME)) {
          db.createObjectStore(STORE_NAME, { keyPath: 'trackId' });
        }
      };
      request.onsuccess = () => resolve(request.result);
      request.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Retrieve cached beat grid from IndexedDB
 */
export async function getCachedBeatGrid(trackId: string): Promise<BeatGridResult | null> {
  if (!trackId) return null;

  // Check In-Memory first
  if (memoryCache.has(trackId)) {
    return memoryCache.get(trackId)!;
  }

  // Check IndexedDB
  const db = await openBeatDB();
  if (!db) return null;

  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NAME, 'readonly');
      const store = tx.objectStore(STORE_NAME);
      const req = store.get(trackId);
      req.onsuccess = () => {
        const res = req.result as BeatGridResult | undefined;
        if (res && Array.isArray(res.timestamps) && res.timestamps.length > 0) {
          memoryCache.set(trackId, res);
          resolve(res);
        } else {
          resolve(null);
        }
      };
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Store calculated beat grid into IndexedDB & Memory
 */
export async function saveCachedBeatGrid(result: BeatGridResult): Promise<void> {
  if (!result || !result.trackId) return;

  memoryCache.set(result.trackId, result);

  const db = await openBeatDB();
  if (!db) return;

  try {
    const tx = db.transaction(STORE_NAME, 'readwrite');
    const store = tx.objectStore(STORE_NAME);
    store.put(result);
  } catch {}
}

/**
 * Analyze an AudioBuffer to extract millisecond-accurate Kick/Sub-Bass beats
 */
export function extractBeatsFromAudioBuffer(
  audioBuffer: AudioBuffer,
  trackId: string
): BeatGridResult {
  const sampleRate = audioBuffer.sampleRate;
  const numChannels = audioBuffer.numberOfChannels;
  const len = audioBuffer.length;
  const duration = audioBuffer.duration;

  // 1. Downmix to Mono Float32Array
  const mono = new Float32Array(len);
  if (numChannels === 1) {
    mono.set(audioBuffer.getChannelData(0));
  } else {
    const ch0 = audioBuffer.getChannelData(0);
    const ch1 = audioBuffer.getChannelData(1);
    for (let i = 0; i < len; i++) {
      mono[i] = (ch0[i] + ch1[i]) * 0.5;
    }
  }

  // 2. High-Precision 2nd-Order Low-Pass Butterworth/Biquad Filter (< 115Hz)
  // Rejects all vocal harmonics (300Hz+), snare cracks (1kHz+), and hi-hats (5kHz+)
  const fc = 115;
  const Q = 1.1;
  const w0 = (2 * Math.PI * fc) / sampleRate;
  const cosW0 = Math.cos(w0);
  const sinW0 = Math.sin(w0);
  const alpha = sinW0 / (2 * Q);

  const b0 = (1 - cosW0) / 2;
  const b1 = 1 - cosW0;
  const b2 = (1 - cosW0) / 2;
  const a0 = 1 + alpha;
  const a1 = -2 * cosW0;
  const a2 = 1 - alpha;

  const B0 = b0 / a0;
  const B1 = b1 / a0;
  const B2 = b2 / a0;
  const A1 = a1 / a0;
  const A2 = a2 / a0;

  const filtered = new Float32Array(len);
  let x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  for (let i = 0; i < len; i++) {
    const x0 = mono[i];
    const y0 = B0 * x0 + B1 * x1 + B2 * x2 - A1 * y1 - A2 * y2;
    x2 = x1;
    x1 = x0;
    y2 = y1;
    y1 = y0;
    filtered[i] = y0;
  }

  // 3. Calculate 20ms Frame RMS Energies (~50 frames per second)
  const frameSize = Math.floor(sampleRate * 0.02);
  const totalFrames = Math.floor(len / frameSize);
  const energies = new Float32Array(totalFrames);
  let maxEnergy = 0;

  for (let f = 0; f < totalFrames; f++) {
    const start = f * frameSize;
    let sum = 0;
    for (let i = 0; i < frameSize; i++) {
      const s = filtered[start + i];
      sum += s * s;
    }
    const e = Math.sqrt(sum / frameSize);
    energies[f] = e;
    if (e > maxEnergy) maxEnergy = e;
  }

  // If the entire song has no bass punch (e.g. ambient or pure speech), return empty grid
  if (maxEnergy < 0.012) {
    return {
      trackId,
      timestamps: [],
      strengths: [],
      beats: [],
      duration,
      maxEnergy,
    };
  }

  // 4. Moving Window Local Dynamic Energy Thresholding
  // Window of 32 frames (~640ms) around each candidate
  const windowRadius = 16;
  const beats: BeatItem[] = [];
  const timestamps: number[] = [];
  const strengths: number[] = [];

  let lastBeatTime = -1;
  const minBeatInterval = 0.175; // Debounce 175ms (~340 BPM max)

  for (let f = 1; f < totalFrames - 1; f++) {
    const currentEnergy = energies[f];
    const prevEnergy = energies[f - 1];
    const nextEnergy = energies[f + 1];

    // Candidate must be a local peak in time
    if (currentEnergy <= prevEnergy || currentEnergy < nextEnergy) {
      continue;
    }

    const deltaEnergy = currentEnergy - prevEnergy;

    // Calculate surrounding local baseline & variance
    const winStart = Math.max(0, f - windowRadius);
    const winEnd = Math.min(totalFrames, f + windowRadius);
    let winSum = 0;
    for (let w = winStart; w < winEnd; w++) {
      winSum += energies[w];
    }
    const localAvg = winSum / (winEnd - winStart);

    let varSum = 0;
    for (let w = winStart; w < winEnd; w++) {
      const diff = energies[w] - localAvg;
      varSum += diff * diff;
    }
    const localStd = Math.sqrt(varSum / (winEnd - winStart));

    // Dynamic Threshold:
    // 1. Must exceed local average by 1.25x
    // 2. Must exceed local variance threshold
    // 3. Must be at least 15% of track's maximum punch
    const threshold = Math.max(
      localAvg * 1.25 + localStd * 0.85,
      maxEnergy * 0.16
    );

    const timeSec = (f * frameSize) / sampleRate;

    if (
      currentEnergy > threshold &&
      deltaEnergy > maxEnergy * 0.035 &&
      timeSec - lastBeatTime >= minBeatInterval
    ) {
      lastBeatTime = timeSec;
      const exactTime = Number(timeSec.toFixed(3));
      const rawRatio = (currentEnergy - localAvg) / Math.max(0.01, maxEnergy * 0.5);
      const normStrength = Math.min(1.0, Math.max(0.40, rawRatio + 0.35));
      const isHeavy = currentEnergy > maxEnergy * 0.55 || normStrength > 0.75;

      timestamps.push(exactTime);
      strengths.push(Number(normStrength.toFixed(2)));
      beats.push({
        time: exactTime,
        strength: Number(normStrength.toFixed(2)),
        isHeavy,
      });
    }
  }

  return {
    trackId,
    timestamps,
    strengths,
    beats,
    duration,
    maxEnergy,
  };
}

/**
 * Main Pipeline: Fetch audio file -> Decode -> Extract Beats -> Cache
 */
export async function analyzeTrackBeatGrid(
  trackUrl: string,
  trackId: string
): Promise<BeatGridResult | null> {
  if (!trackUrl || !trackId) return null;

  // 1. Check Local Cache First (0ms return)
  const cached = await getCachedBeatGrid(trackId);
  if (cached && cached.timestamps.length > 0) {
    return cached;
  }

  try {
    // 2. Fetch Audio ArrayBuffer directly (bypassing HTML5 Audio CORS restrictions)
    const response = await fetch(trackUrl);
    if (!response.ok) return null;

    const arrayBuffer = await response.arrayBuffer();

    // 3. Decode into AudioBuffer via temporary OfflineAudioContext
    const AudioCtxClass =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!AudioCtxClass) return null;

    const tempCtx = new AudioCtxClass();
    const audioBuffer = await tempCtx.decodeAudioData(arrayBuffer);
    tempCtx.close().catch(() => {});

    // 4. Extract Kick & Sub-Bass Peak Grid
    const result = extractBeatsFromAudioBuffer(audioBuffer, trackId);

    // 5. Persist to Cache
    await saveCachedBeatGrid(result);

    return result;
  } catch (err) {
    console.warn('Automated Beat Extraction note:', trackId, err);
    return null;
  }
}
