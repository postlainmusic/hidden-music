/**
 * Real-time Beat & Transient Peak Detector Engine
 * Decomposes audio spectrum into Sub-bass, Snare flux, Hi-hat transients
 * Calculates Dynamic Adaptive Energy Thresholds and Tempo (BPM)
 */

export interface FrequencyBands {
  subBass: number;   // 20Hz - 80Hz (Bass kicks / 808s)
  midSnare: number;  // 1kHz - 4kHz (Snare attack / Claps)
  highHat: number;   // 8kHz - 16kHz (Hi-hats / Cymbals)
  rmsEnergy: number; // Overall acoustic envelope
}

export interface BeatDetectionResult {
  isKick: boolean;
  isSnare: boolean;
  isHiHat: boolean;
  energy: number;
  bands: FrequencyBands;
  estimatedBpm: number;
}

export class BeatDetector {
  private energyHistory: number[] = [];
  private historySize = 43; // ~1 second history at 43fps
  private lastKickTime = 0;
  private lastSnareTime = 0;
  private bpmIntervals: number[] = [];
  private currentBpm = 120;

  // Dual EMA for Transient Flux calculation
  private fastEnergy = 0;
  private slowEnergy = 0;

  constructor(initialBpm = 120) {
    this.currentBpm = initialBpm;
  }

  /**
   * Process frequency data buffer (256 or 512 bins from AnalyserNode or pre-computed buckets)
   */
  processFrame(frequencyData: Uint8Array | Float32Array, sampleRate = 44100): BeatDetectionResult {
    const binCount = frequencyData.length;
    const nyquist = sampleRate / 2;
    const hzPerBin = nyquist / binCount;

    // Helper to calculate average energy within a frequency range
    const getBandEnergy = (startHz: number, endHz: number): number => {
      const startBin = Math.max(0, Math.floor(startHz / hzPerBin));
      const endBin = Math.min(binCount - 1, Math.ceil(endHz / hzPerBin));
      if (startBin >= endBin) return (frequencyData[startBin] || 0) / 255;

      let sum = 0;
      for (let i = startBin; i <= endBin; i++) {
        sum += frequencyData[i] || 0;
      }
      const rawAvg = sum / (endBin - startBin + 1);
      return frequencyData instanceof Uint8Array ? rawAvg / 255 : rawAvg;
    };

    const subBass = Math.min(1.0, getBandEnergy(20, 80) * 1.3);
    const midSnare = Math.min(1.0, getBandEnergy(1000, 4000) * 1.1);
    const highHat = Math.min(1.0, getBandEnergy(8000, 16000) * 1.0);

    const rmsEnergy = Math.sqrt(
      (subBass * subBass * 0.5) + (midSnare * midSnare * 0.3) + (highHat * highHat * 0.2)
    );

    // Update Dual EMA (Fast response vs Slow ambient baseline)
    this.fastEnergy = this.fastEnergy * 0.7 + rmsEnergy * 0.3;
    this.slowEnergy = this.slowEnergy * 0.95 + rmsEnergy * 0.05;

    // Dynamic Variance & Threshold
    this.energyHistory.push(rmsEnergy);
    if (this.energyHistory.length > this.historySize) {
      this.energyHistory.shift();
    }

    const avgEnergy = this.energyHistory.reduce((a, b) => a + b, 0) / this.energyHistory.length;
    const variance = this.energyHistory.reduce((acc, val) => acc + Math.pow(val - avgEnergy, 2), 0) / this.energyHistory.length;
    const dynamicSensitivity = Math.max(1.15, 1.45 - variance * 5.0);

    const now = typeof performance !== 'undefined' ? performance.now() : Date.now();

    // Transient Detection with Debounce
    const isKick = subBass > avgEnergy * dynamicSensitivity && (now - this.lastKickTime > 220) && subBass > 0.45;
    if (isKick) {
      if (this.lastKickTime > 0) {
        const interval = (now - this.lastKickTime) / 1000;
        if (interval > 0.3 && interval < 1.5) {
          this.bpmIntervals.push(60 / interval);
          if (this.bpmIntervals.length > 8) this.bpmIntervals.shift();
          const validBpmList = this.bpmIntervals.filter((bpm) => bpm >= 60 && bpm <= 190);
          if (validBpmList.length > 0) {
            this.currentBpm = Math.round(validBpmList.reduce((a, b) => a + b, 0) / validBpmList.length);
          }
        }
      }
      this.lastKickTime = now;
    }

    const isSnare = midSnare > avgEnergy * 1.35 && (now - this.lastSnareTime > 180) && midSnare > 0.4;
    if (isSnare) {
      this.lastSnareTime = now;
    }

    const isHiHat = highHat > avgEnergy * 1.25 && highHat > 0.35;

    return {
      isKick,
      isSnare,
      isHiHat,
      energy: rmsEnergy,
      bands: {
        subBass,
        midSnare,
        highHat,
        rmsEnergy,
      },
      estimatedBpm: this.currentBpm,
    };
  }

  /**
   * Deterministic Beat Approximation from 50ms Waveform Amplitude Bucket
   */
  processAmplitudeBucket(amplitude: number, timeSec: number, trackId?: string): BeatDetectionResult {
    const safeAmp = Math.max(0, Math.min(1.0, amplitude));
    const subBassMod = 0.5 + 0.5 * Math.sin(timeSec * Math.PI * 4);
    const subBass = Math.min(1.0, safeAmp * 1.25 * subBassMod);
    const midSnare = Math.pow(safeAmp, 1.6);
    const highHat = Math.min(1.0, safeAmp * (0.5 + 0.5 * Math.cos(timeSec * Math.PI * 8)));
    const rmsEnergy = Math.sqrt(safeAmp * 0.8 + 0.2 * Math.pow(safeAmp, 2));

    const isKick = subBass > 0.72;
    const isSnare = midSnare > 0.65;
    const isHiHat = highHat > 0.55;

    return {
      isKick,
      isSnare,
      isHiHat,
      energy: rmsEnergy,
      bands: {
        subBass,
        midSnare,
        highHat,
        rmsEnergy,
      },
      estimatedBpm: this.currentBpm,
    };
  }
}
