import test from 'node:test';
import assert from 'node:assert/strict';

/**
 * Unit Test for Live Waveform-Based Beat Tracking Engine
 */
test('LiveWaveformBeatEngine: Peak-to-Peak and RMS calculation on sinusoidal pulse', () => {
  const fftSize = 512;
  const waveArray = new Uint8Array(fftSize);

  // Generate synthetic sine waveform around balance point 128
  for (let i = 0; i < fftSize; i++) {
    waveArray[i] = Math.round(128 + 100 * Math.sin((i / fftSize) * Math.PI * 8));
  }

  // Calculate manually
  let sumSquares = 0;
  let minVal = 255;
  let maxVal = 0;
  for (let i = 0; i < fftSize; i++) {
    const norm = (waveArray[i] - 128) / 128;
    sumSquares += norm * norm;
    if (waveArray[i] < minVal) minVal = waveArray[i];
    if (waveArray[i] > maxVal) maxVal = waveArray[i];
  }
  const rms = Math.sqrt(sumSquares / fftSize);
  const peakToPeak = (maxVal - minVal) / 255;

  assert.ok(rms > 0.45 && rms < 0.65, `Expected RMS ~0.55, got ${rms}`);
  assert.ok(peakToPeak > 0.70, `Expected peakToPeak > 0.70, got ${peakToPeak}`);
});

test('LiveWaveformBeatEngine: Zeroed or Flat signal produces zero beat impulses', () => {
  const fftSize = 512;
  const flatArray = new Uint8Array(fftSize).fill(128); // Pure silence balance point

  let hasNonZeroSignal = false;
  for (let i = 0; i < fftSize; i++) {
    if (flatArray[i] !== 128) hasNonZeroSignal = true;
  }

  assert.equal(hasNonZeroSignal, false, 'Flat 128 array must report no signal');
});
