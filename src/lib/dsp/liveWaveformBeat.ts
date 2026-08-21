/**
 * Live Waveform-Based Beat Tracking Engine (Zero-Fail Audio Graph)
 * Analyzes live time-domain audio waveforms to extract peak-to-peak amplitude,
 * RMS energy, and instantaneous transient beat impulses.
 */

export interface LiveBeatResult {
  isBeat: boolean;
  rms: number;
  peakToPeak: number;
  energyFlux: number;
  kickForce: number;
  fastEnergy: number;
  slowEnergy: number;
}

export class LiveWaveformBeatEngine {
  private fastEnergy: number = 0;
  private slowEnergy: number = 0;
  private lastBeatTime: number = 0;
  private threshold: number = 0.016;
  private minIntervalMs: number = 60;
  private waveArray: Uint8Array;

  constructor(fftSize: number = 1024, threshold: number = 0.015, minIntervalMs: number = 55) {
    this.threshold = threshold;
    this.minIntervalMs = minIntervalMs;
    this.waveArray = new Uint8Array(fftSize);
  }

  /**
   * Process a live AnalyserNode time-domain buffer
   */
  public processLiveAnalyser(analyser?: AnalyserNode | null, now: number = performance.now()): LiveBeatResult {
    if (!analyser) {
      return this.getEmptyResult();
    }

    try {
      analyser.getByteTimeDomainData(this.waveArray as any);
    } catch {
      return this.getEmptyResult();
    }

    return this.processWaveformArray(this.waveArray, now);
  }

  /**
   * Process an existing raw Uint8Array waveform buffer
   */
  public processWaveformArray(waveArray: Uint8Array, now: number = performance.now()): LiveBeatResult {
    if (!waveArray || waveArray.length === 0) {
      return this.getEmptyResult();
    }

    let sumSquares = 0;
    let minVal = 255;
    let maxVal = 0;
    let hasNonZeroSignal = false;

    for (let i = 0; i < waveArray.length; i++) {
      const val = waveArray[i];
      if (val !== 128) {
        hasNonZeroSignal = true;
      }
      const norm = (val - 128) / 128; // Normalize to [-1.0, 1.0]
      sumSquares += norm * norm;
      if (val < minVal) minVal = val;
      if (val > maxVal) maxVal = val;
    }

    // If signal is flat (all 128 or zeroes from CORS silence)
    if (!hasNonZeroSignal || (minVal === 0 && maxVal === 0)) {
      return this.getEmptyResult();
    }

    const rms = Math.sqrt(sumSquares / waveArray.length);
    const peakToPeak = (maxVal - minVal) / 255; // Spread of waveform amplitude

    // Dynamic Adaptive Threshold via Dual EMA
    this.fastEnergy = this.fastEnergy * 0.18 + rms * 0.82;
    this.slowEnergy = this.slowEnergy * 0.88 + rms * 0.12;
    const energyFlux = Math.max(0, this.fastEnergy - this.slowEnergy);

    // Multi-tier Beat Trigger: Catches both large heavy drops and small/rapid successive kicks
    const isConsecutiveKick = (now - this.lastBeatTime >= this.minIntervalMs) && (now - this.lastBeatTime < 240);
    const requiredFlux = isConsecutiveKick ? this.threshold * 0.60 : this.threshold;
    const requiredPeak = isConsecutiveKick ? 0.08 : 0.10;

    const isBeat = energyFlux > requiredFlux && peakToPeak > requiredPeak && (now - this.lastBeatTime >= this.minIntervalMs);

    let kickForce = 0;
    if (isBeat) {
      this.lastBeatTime = now;
      // Proportional kick force: regular kicks give punchy bounce (0.025-0.040), heavy 808s give explosive punch (0.065)
      kickForce = Math.min(0.065, Math.max(0.025, energyFlux * 0.28 + peakToPeak * 0.045));
    }

    return {
      isBeat,
      rms,
      peakToPeak,
      energyFlux,
      kickForce,
      fastEnergy: this.fastEnergy,
      slowEnergy: this.slowEnergy,
    };
  }

  /**
   * Fallback synthesis when hardware audio stream is unavailable
   */
  public processSyntheticAmplitude(amplitude: number, isDrumming: boolean, bpm: number = 120, now: number = performance.now()): LiveBeatResult {
    const rms = Math.max(0, Math.min(1, amplitude));
    const peakToPeak = rms * 0.85;

    this.fastEnergy = this.fastEnergy * 0.20 + rms * 0.80;
    this.slowEnergy = this.slowEnergy * 0.90 + rms * 0.10;
    const energyFlux = Math.max(0, this.fastEnergy - this.slowEnergy);

    const minBeatInterval = Math.max(160, (60 / bpm) * 750);
    const isBeat = isDrumming && energyFlux > 0.035 && (now - this.lastBeatTime > minBeatInterval);

    let kickForce = 0;
    if (isBeat) {
      this.lastBeatTime = now;
      kickForce = Math.min(0.04, energyFlux * 0.15);
    }

    return {
      isBeat,
      rms,
      peakToPeak,
      energyFlux,
      kickForce,
      fastEnergy: this.fastEnergy,
      slowEnergy: this.slowEnergy,
    };
  }

  private getEmptyResult(): LiveBeatResult {
    this.fastEnergy *= 0.90;
    this.slowEnergy *= 0.95;
    return {
      isBeat: false,
      rms: 0,
      peakToPeak: 0,
      energyFlux: 0,
      kickForce: 0,
      fastEnergy: this.fastEnergy,
      slowEnergy: this.slowEnergy,
    };
  }

  public setThreshold(val: number) {
    this.threshold = val;
  }

  public setMinInterval(ms: number) {
    this.minIntervalMs = ms;
  }
}
