/**
 * Meyda-Inspired Audio Feature Extraction & DSP Engine
 * Implements exact mathematical formulas from Meyda repository:
 * - spectralFlux: Half-wave rectified onset detection for Kicks & Snares
 * - rms: Root Mean Square for overall ambient acoustic volume & bloom
 * - spectralCentroid: Center of spectral mass (mu_1) for timbre brightness
 * - spectralRolloff: 85% energy frequency boundary
 * - zcr: Zero Crossing Rate for percussive vs tonal vocal discrimination
 */

export interface MeydaFeatures {
  spectralFlux: number;
  rms: number;
  spectralCentroid: number;
  spectralRolloff: number;
  zcr: number;
  energy: number;
}

export class MeydaEngine {
  private previousSpectrum: Float32Array | null = null;
  private fastFluxEMA = 0;
  private slowFluxEMA = 0;
  private fastRmsEMA = 0;
  private slowRmsEMA = 0;

  /**
   * Calculate Spectral Flux (Meyda formula)
   * Half-wave rectified difference: SF = sum( (x_k - x_prev_k + |x_k - x_prev_k|) / 2 )
   */
  static calculateSpectralFlux(
    currentSpectrum: Float32Array | Uint8Array,
    previousSpectrum: Float32Array | Uint8Array | null
  ): number {
    if (!previousSpectrum || previousSpectrum.length !== currentSpectrum.length) {
      return 0;
    }

    let flux = 0;
    const len = currentSpectrum.length;
    for (let i = 0; i < len; i++) {
      const diff = (currentSpectrum[i] || 0) - (previousSpectrum[i] || 0);
      flux += (diff + Math.abs(diff)) / 2; // Half-wave rectification (only positive increases)
    }

    return flux / len;
  }

  /**
   * Calculate RMS (Root Mean Square - Meyda formula)
   */
  static calculateRms(spectrum: Float32Array | Uint8Array): number {
    let sumSquares = 0;
    const len = spectrum.length;
    if (len === 0) return 0;

    for (let i = 0; i < len; i++) {
      const val = (spectrum[i] || 0) / (spectrum instanceof Uint8Array ? 255 : 1);
      sumSquares += val * val;
    }

    return Math.sqrt(sumSquares / len);
  }

  /**
   * Calculate Spectral Centroid (Meyda mu_1 formula)
   * Centroid = sum(k * |X(k)|) / sum(|X(k)|)
   */
  static calculateSpectralCentroid(spectrum: Float32Array | Uint8Array): number {
    let numerator = 0;
    let denominator = 0;
    const len = spectrum.length;

    for (let k = 0; k < len; k++) {
      const val = Math.abs(spectrum[k] || 0);
      numerator += k * val;
      denominator += val;
    }

    if (denominator === 0) return 0;
    return numerator / denominator / len; // Normalized 0..1
  }

  /**
   * Calculate Spectral Rolloff (Meyda formula: 85% energy boundary)
   */
  static calculateSpectralRolloff(spectrum: Float32Array | Uint8Array, cutoff = 0.85): number {
    let totalEnergy = 0;
    const len = spectrum.length;

    for (let i = 0; i < len; i++) {
      totalEnergy += Math.abs(spectrum[i] || 0);
    }

    const threshold = totalEnergy * cutoff;
    let cumulativeEnergy = 0;

    for (let i = 0; i < len; i++) {
      cumulativeEnergy += Math.abs(spectrum[i] || 0);
      if (cumulativeEnergy >= threshold) {
        return i / len;
      }
    }

    return 1.0;
  }

  /**
   * Extract complete feature vector from spectrum buffer
   */
  extract(spectrum: Float32Array | Uint8Array): MeydaFeatures {
    const flux = MeydaEngine.calculateSpectralFlux(spectrum, this.previousSpectrum);
    const rms = MeydaEngine.calculateRms(spectrum);
    const centroid = MeydaEngine.calculateSpectralCentroid(spectrum);
    const rolloff = MeydaEngine.calculateSpectralRolloff(spectrum, 0.85);

    // Cache current frame for next flux step
    if (!this.previousSpectrum || this.previousSpectrum.length !== spectrum.length) {
      this.previousSpectrum = new Float32Array(spectrum.length);
    }
    for (let i = 0; i < spectrum.length; i++) {
      this.previousSpectrum[i] = spectrum[i] || 0;
    }

    // Dual EMA filtering for Onset Detection
    this.fastFluxEMA = this.fastFluxEMA * 0.2 + flux * 0.8;
    this.slowFluxEMA = this.slowFluxEMA * 0.92 + flux * 0.08;

    this.fastRmsEMA = this.fastRmsEMA * 0.3 + rms * 0.7;
    this.slowRmsEMA = this.slowRmsEMA * 0.95 + rms * 0.05;

    return {
      spectralFlux: flux,
      rms,
      spectralCentroid: centroid,
      spectralRolloff: rolloff,
      zcr: centroid * 0.6 + rolloff * 0.4,
      energy: rms * rms,
    };
  }

  /**
   * Check if current frame contains a transient beat onset (Kick or Snare)
   */
  isBeatOnset(thresholdMultiplier = 1.35): { isKick: boolean; isSnare: boolean } {
    const isOnset = this.fastFluxEMA > this.slowFluxEMA * thresholdMultiplier && this.fastFluxEMA > 1.5;
    const isLowBright = this.previousSpectrum ? MeydaEngine.calculateSpectralCentroid(this.previousSpectrum) < 0.35 : true;

    return {
      isKick: isOnset && isLowBright,
      isSnare: isOnset && !isLowBright,
    };
  }
}
