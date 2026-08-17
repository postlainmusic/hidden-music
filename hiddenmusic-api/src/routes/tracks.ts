import { Hono } from 'hono';
import { Env } from '../types/env';

const tracksRoute = new Hono<{ Bindings: Env }>();

// GET /albums
tracksRoute.get('/albums', async (c) => {
  const supabaseUrl = c.env.SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
  const supabaseKey = c.env.SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    return c.json({ error: 'Supabase credentials not configured' }, 500);
  }

  try {
    const res = await fetch(
      `${supabaseUrl}/rest/v1/albums?select=*,tracks(*)&order=created_at.desc`,
      {
        headers: {
          apikey: supabaseKey,
          Authorization: `Bearer ${supabaseKey}`,
          'Content-Type': 'application/json',
        },
      }
    );

    if (!res.ok) {
      return c.json({ error: 'Failed to fetch albums from database' }, res.status as any);
    }

    const data = await res.json();
    c.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

// GET /tracks
tracksRoute.get('/tracks', async (c) => {
  const supabaseUrl = c.env.SUPABASE_URL || 'https://muemwfqynfljpmvxmpep.supabase.co';
  const supabaseKey = c.env.SUPABASE_ANON_KEY;

  if (!supabaseKey) {
    return c.json({ error: 'Supabase credentials not configured' }, 500);
  }

  try {
    const res = await fetch(`${supabaseUrl}/rest/v1/tracks?select=*&order=title.asc`, {
      headers: {
        apikey: supabaseKey,
        Authorization: `Bearer ${supabaseKey}`,
        'Content-Type': 'application/json',
      },
    });

    if (!res.ok) {
      return c.json({ error: 'Failed to fetch tracks from database' }, res.status as any);
    }

    const data = await res.json();
    c.header('Cache-Control', 'public, s-maxage=60, stale-while-revalidate=600');
    return c.json(data);
  } catch (err: any) {
    return c.json({ error: err.message }, 500);
  }
});

export default tracksRoute;
