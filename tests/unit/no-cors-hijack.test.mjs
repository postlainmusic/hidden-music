import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

/**
 * CI/CD Regression Guard: Permanent Ban on createMediaElementSource in Playback Pipeline
 * Prevents browser CORS audio muting (MediaElementAudioSource outputs zeroes).
 */
test('Regression Guard: Ensure createMediaElementSource is NEVER used in active Player & Visualizer code', () => {
  const criticalDirs = [
    path.resolve(process.cwd(), 'src', 'context'),
    path.resolve(process.cwd(), 'src', 'components', 'ui', 'player'),
    path.resolve(process.cwd(), 'src', 'components', 'visualizer'),
    path.resolve(process.cwd(), 'src', 'hooks'),
  ];

  for (const targetDir of criticalDirs) {
    if (!fs.existsSync(targetDir)) continue;
    const files = fs.readdirSync(targetDir, { recursive: true });
    for (const file of files) {
      if (typeof file === 'string' && (file.endsWith('.tsx') || file.endsWith('.ts'))) {
        const fullPath = path.join(targetDir, file);
        const content = fs.readFileSync(fullPath, 'utf8');
        const match = content.match(/createMediaElementSource\s*\(/g);
        assert.equal(
          match,
          null,
          `FORBIDDEN: createMediaElementSource found in ${fullPath}. This will mute audio due to CORS restrictions! (LL-04 / Invariant 6)`
        );
      }
    }
  }
});
