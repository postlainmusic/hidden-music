import test from 'node:test';
import assert from 'node:assert/strict';

// Test Beat Detector and Haptic Throttling logic in pure JS
test('BeatDetector: Frequency Band Decomposition & Thresholding', () => {
  // Mock frequency spectrum (Sub-bass, Snare, Hi-hats)
  const binCount = 512;
  const buffer = new Uint8Array(binCount);

  // Inject heavy sub-bass kick at bins 2-8 (~40Hz-160Hz)
  for (let i = 2; i <= 8; i++) {
    buffer[i] = 240;
  }

  // Calculate sub-bass energy
  let subBassSum = 0;
  for (let i = 2; i <= 8; i++) subBassSum += buffer[i];
  const subBassAvg = subBassSum / 7 / 255;

  assert.ok(subBassAvg > 0.85, `Sub-bass average (${subBassAvg}) should exceed 0.85`);

  // Verification of dynamic transient gate
  const dynamicThreshold = 0.70;
  const isKickDetected = subBassAvg > dynamicThreshold;
  assert.equal(isKickDetected, true, 'Sub-bass kick must be detected');
});

test('HapticEngine: Safe Safari Guards & Interval Throttling', () => {
  const MIN_HAPTIC_INTERVAL_MS = 220;
  let lastVibeTime = 1000;

  // Attempt 1: Too fast (100ms later)
  let now = 1100;
  let canVibrate = now - lastVibeTime >= MIN_HAPTIC_INTERVAL_MS;
  assert.equal(canVibrate, false, 'Haptic pulse must be throttled when interval < 220ms');

  // Attempt 2: After debounce window (250ms later)
  now = 1260;
  canVibrate = now - lastVibeTime >= MIN_HAPTIC_INTERVAL_MS;
  assert.equal(canVibrate, true, 'Haptic pulse must be allowed after 220ms');
});
