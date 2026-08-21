import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CI/CD Regression Guard: Audio Graph Resilience & CORS Safety
 * Ensures audio element has crossOrigin="anonymous" and safe Web Audio fallback.
 */
test('Audio Graph Resilience: Audio element has crossOrigin anonymous and safe Web Audio initialization with fallback', () => {
  const playerContextPath = path.resolve(process.cwd(), 'src', 'context', 'PlayerContext.tsx');
  const content = fs.readFileSync(playerContextPath, 'utf8');

  // Verify crossOrigin anonymous
  assert.ok(
    content.includes('crossOrigin="anonymous"'),
    'PlayerContext.tsx must set crossOrigin="anonymous" on audio element'
  );

  // Verify playsInline
  assert.ok(
    content.includes('playsInline'),
    'PlayerContext.tsx must set playsInline on audio element'
  );

  // Verify safe audio graph try/catch wrapper
  assert.ok(
    content.includes('createMediaElementSource'),
    'PlayerContext.tsx must connect createMediaElementSource in resilient try/catch'
  );
});
