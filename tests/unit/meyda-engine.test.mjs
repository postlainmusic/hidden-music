import test from 'node:test';
import assert from 'node:assert/strict';

function calculateSpectralFlux(currentSpectrum, previousSpectrum) {
  if (!previousSpectrum || previousSpectrum.length !== currentSpectrum.length) return 0;
  let flux = 0;
  for (let i = 0; i < currentSpectrum.length; i++) {
    const diff = (currentSpectrum[i] || 0) - (previousSpectrum[i] || 0);
    flux += (diff + Math.abs(diff)) / 2;
  }
  return flux / currentSpectrum.length;
}

function calculateRms(spectrum) {
  let sumSquares = 0;
  for (let i = 0; i < spectrum.length; i++) {
    const val = (spectrum[i] || 0) / 255;
    sumSquares += val * val;
  }
  return Math.sqrt(sumSquares / spectrum.length);
}

function calculateSpectralCentroid(spectrum) {
  let num = 0;
  let den = 0;
  for (let k = 0; k < spectrum.length; k++) {
    const val = Math.abs(spectrum[k] || 0);
    num += k * val;
    den += val;
  }
  if (den === 0) return 0;
  return num / den / spectrum.length;
}

function calculateSpectralRolloff(spectrum, cutoff = 0.85) {
  let totalEnergy = 0;
  for (let i = 0; i < spectrum.length; i++) totalEnergy += Math.abs(spectrum[i] || 0);
  const threshold = totalEnergy * cutoff;
  let cumulative = 0;
  for (let i = 0; i < spectrum.length; i++) {
    cumulative += Math.abs(spectrum[i] || 0);
    if (cumulative >= threshold) return i / spectrum.length;
  }
  return 1.0;
}

test('Meyda: Spectral Flux calculates half-wave rectified onset difference', () => {
  const prev = new Float32Array([10, 20, 30, 40]);
  const curr = new Float32Array([15, 20, 25, 60]); // +5, 0, -5 (rectified to 0), +20 -> total = 25 / 4 = 6.25
  const flux = calculateSpectralFlux(curr, prev);
  assert.equal(flux, 6.25);
});

test('Meyda: RMS calculates root mean square of acoustic envelope', () => {
  const spectrum = new Uint8Array([255, 255, 255, 255]);
  const rms = calculateRms(spectrum);
  assert.ok(Math.abs(rms - 1.0) < 0.001);
});

test('Meyda: Spectral Centroid distinguishes low 808s from high transients', () => {
  const lowSpectrum = new Float32Array([100, 10, 0, 0]);
  const highSpectrum = new Float32Array([0, 0, 10, 100]);

  const lowCentroid = calculateSpectralCentroid(lowSpectrum);
  const highCentroid = calculateSpectralCentroid(highSpectrum);

  assert.ok(lowCentroid < highCentroid, 'High frequency must produce higher centroid');
});

test('Meyda: Spectral Rolloff detects 85% energy frequency boundary', () => {
  const spectrum = new Float32Array([100, 0, 0, 0]);
  const rolloff = calculateSpectralRolloff(spectrum, 0.85);
  assert.equal(rolloff, 0);
});
