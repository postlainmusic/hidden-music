import { Hono } from 'hono';
import { cors } from 'hono/cors';
import { Env } from './types/env';
import streamRoute from './routes/stream';
import ytRoute from './routes/yt';
import tracksRoute from './routes/tracks';
import uploadRoute from './routes/upload';

const app = new Hono<{ Bindings: Env }>();

// Global CORS Middleware
app.use(
  '*',
  cors({
    origin: (origin) => {
      // Allow development and production origins
      const allowed = [
        'https://postlain.com',
        'http://localhost:4321',
        'http://localhost:3000',
        'http://localhost:8787',
      ];
      if (!origin || allowed.includes(origin) || origin.endsWith('.pages.dev')) {
        return origin || '*';
      }
      return '*';
    },
    allowMethods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS', 'HEAD'],
    allowHeaders: ['Content-Type', 'Authorization', 'Range', 'X-Requested-With'],
    exposeHeaders: ['Content-Range', 'Content-Length', 'Accept-Ranges', 'ETag'],
    maxAge: 86400,
  })
);

// Health Check & System Status
app.get('/', (c) => {
  return c.json({
    name: 'Hidden Music Vault API Gateway',
    version: '1.0.0',
    status: 'ONLINE',
    runtime: 'Cloudflare Workers (Edge)',
    endpoints: {
      stream: '/stream/:key+',
      yt_search: '/yt/search?q=...',
      yt_stream: '/yt/stream/:videoId',
      albums: '/albums',
      tracks: '/tracks',
      upload: '/upload/presign',
    },
  });
});

app.get('/health', (c) => {
  return c.json({ status: 'healthy', timestamp: new Date().toISOString() });
});

// Mount Routes (supporting both with and without `/api` prefix)
app.route('/stream', streamRoute);
app.route('/api/stream', streamRoute);

app.route('/yt', ytRoute);
app.route('/api/yt', ytRoute);

app.route('', tracksRoute);
app.route('/api', tracksRoute);

app.route('/upload', uploadRoute);
app.route('/api/upload', uploadRoute);

export default app;
