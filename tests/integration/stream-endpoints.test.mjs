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
});
