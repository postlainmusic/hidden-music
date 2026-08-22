import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';

describe('Streaming Engine & Closed-Loop Integration Tests', () => {
  it('Verify Closed-Loop Invariant: DiscoveryFeed has zero external window.open redirects', () => {
    const filePath = path.resolve(process.cwd(), 'src/components/discovery/DiscoveryFeed.tsx');
    assert.ok(fs.existsSync(filePath), 'DiscoveryFeed.tsx must exist');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(!content.includes('window.open'), 'Forbidden window.open found in DiscoveryFeed.tsx');
    assert.ok(!content.includes('target="_blank"'), 'Forbidden target="_blank" found in DiscoveryFeed.tsx');
  });

  it('Verify /api/ytm/resolve exports edge runtime and force-dynamic', () => {
    const filePath = path.resolve(process.cwd(), 'src/app/api/ytm/resolve/route.ts');
    assert.ok(fs.existsSync(filePath), 'resolve/route.ts must exist');

    const content = fs.readFileSync(filePath, 'utf-8');
    assert.ok(content.includes("export const runtime = 'edge'"), 'Resolve route must declare edge runtime');
    assert.ok(content.includes("export const dynamic = 'force-dynamic'"), 'Resolve route must declare force-dynamic');
  });

  it('Verify /api/ytm/feed and /api/ytm/search localization gl=VN and hl=vi', () => {
    const feedPath = path.resolve(process.cwd(), 'src/app/api/ytm/feed/route.ts');
    const searchPath = path.resolve(process.cwd(), 'src/app/api/ytm/search/route.ts');

    assert.ok(fs.existsSync(feedPath), 'feed/route.ts must exist');
    assert.ok(fs.existsSync(searchPath), 'search/route.ts must exist');

    const feedContent = fs.readFileSync(feedPath, 'utf-8');
    const searchContent = fs.readFileSync(searchPath, 'utf-8');

    assert.ok(feedContent.includes("gl: 'VN'") || feedContent.includes('gl=VN'), 'Feed must specify gl=VN');
    assert.ok(feedContent.includes("hl: 'vi'") || feedContent.includes('hl=vi'), 'Feed must specify hl=vi');
    assert.ok(searchContent.includes("gl: 'VN'") || searchContent.includes('gl=VN'), 'Search must specify gl=VN');
    assert.ok(searchContent.includes("hl: 'vi'") || searchContent.includes('hl=vi'), 'Search must specify hl=vi');
  });

  it('Verify /api/ytm/resolve multi-tier fallback architecture (InnerTube, Piped, Invidious)', () => {
    const resolvePath = path.resolve(process.cwd(), 'src/app/api/ytm/resolve/route.ts');
    const content = fs.readFileSync(resolvePath, 'utf-8');

    assert.ok(content.includes('resolveViaInnerTube'), 'Must implement InnerTube multi-client resolver');
    assert.ok(content.includes('resolveViaPiped'), 'Must implement Piped cluster resolver');
    assert.ok(content.includes('resolveViaInvidious'), 'Must implement Invidious cluster resolver');
    assert.ok(content.includes('isValidVideoId'), 'Must validate YouTube 11-char video ID');
  });

  it('Verify Audio MIME priority (audio/mp4 over audio/webm for Safari / iOS compatibility)', () => {
    const resolvePath = path.resolve(process.cwd(), 'src/app/api/ytm/resolve/route.ts');
    const content = fs.readFileSync(resolvePath, 'utf-8');

    assert.ok(content.includes('AUDIO_MIME_PRIORITY'), 'Must define AUDIO_MIME_PRIORITY');
    assert.ok(
      content.indexOf("'audio/mp4'") < content.indexOf("'audio/webm'"),
      'audio/mp4 must have higher priority than audio/webm for Safari compatibility'
    );
  });
});
