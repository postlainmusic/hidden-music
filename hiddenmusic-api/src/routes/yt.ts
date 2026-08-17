import { Hono } from 'hono';
import { Env } from '../types/env';
import { searchYouTubeMusic, resolveYouTubeAudioStream } from '../lib/youtube';

const ytRoute = new Hono<{ Bindings: Env }>();

// GET /yt/search?q=...
ytRoute.get('/search', async (c) => {
  const query = c.req.query('q')?.trim();
  if (!query) {
    return c.json([]);
  }

  const results = await searchYouTubeMusic(query);
  c.header('Cache-Control', 'public, max-age=1800, stale-while-revalidate=86400');
  return c.json(results);
});

// GET /yt/stream/:videoId
ytRoute.get('/stream/:videoId', async (c) => {
  const videoId = c.req.param('videoId');
  if (!videoId) {
    return c.json({ error: 'Missing videoId' }, 400);
  }

  const audioStreamUrl = await resolveYouTubeAudioStream(videoId);

  if (!audioStreamUrl) {
    return c.json({ error: 'Audio stream format not found or restricted' }, 404);
  }

  // HTTP 302 Redirect directly to Google Video CDN with range stream support
  return c.redirect(audioStreamUrl, 302);
});

export default ytRoute;
