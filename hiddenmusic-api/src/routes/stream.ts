import { Hono } from 'hono';
import { Env } from '../types/env';
import { handleR2Stream } from '../lib/r2';

const streamRoute = new Hono<{ Bindings: Env }>();

streamRoute.get('/*', async (c) => {
  const rawKey = c.req.path.replace(/^\/(?:api\/)?stream\/?/, '');
  if (!rawKey) {
    return c.json({ error: 'Missing object key' }, 400);
  }

  const corsHeaders = new Headers({
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
    'Access-Control-Allow-Headers': 'Range, Content-Type',
    'Access-Control-Expose-Headers': 'Content-Range, Content-Length, Accept-Ranges, ETag',
  });

  return await handleR2Stream(rawKey, c.req.raw, c.env, corsHeaders);
});

export default streamRoute;
