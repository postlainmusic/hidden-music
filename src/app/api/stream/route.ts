import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, HEAD, OPTIONS',
      'Access-Control-Allow-Headers': 'Range, Content-Type, Accept, Authorization, X-Requested-With',
      'Access-Control-Max-Age': '86400',
    },
  });
}

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return NextResponse.json({ error: 'Missing target url parameter' }, { status: 400 });
    }

    // Validate safe audio streaming protocol
    if (!targetUrl.startsWith('http://') && !targetUrl.startsWith('https://')) {
      return NextResponse.json({ error: 'Invalid URL protocol' }, { status: 400 });
    }

    const rangeHeader = req.headers.get('range');
    const fetchHeaders: Record<string, string> = {
      'User-Agent': 'HiddenMusicVault/2.0 (Audio Streaming Gateway)',
    };

    if (rangeHeader) {
      fetchHeaders['Range'] = rangeHeader;
    }

    const upstreamRes = await fetch(targetUrl, {
      method: 'GET',
      headers: fetchHeaders,
    });

    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
    responseHeaders.set('Accept-Ranges', 'bytes');

    // Forward important media headers
    const contentType = upstreamRes.headers.get('content-type') || 'audio/mpeg';
    responseHeaders.set('Content-Type', contentType);

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) {
      responseHeaders.set('Content-Length', contentLength);
    }

    const contentRange = upstreamRes.headers.get('content-range');
    if (contentRange) {
      responseHeaders.set('Content-Range', contentRange);
    }

    responseHeaders.set('Cache-Control', 'public, max-age=31536000, immutable');

    return new NextResponse(upstreamRes.body, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch (err: any) {
    return NextResponse.json(
      { error: err.message || 'Audio stream proxy error' },
      {
        status: 500,
        headers: { 'Access-Control-Allow-Origin': '*' },
      }
    );
  }
}

export async function HEAD(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const targetUrl = searchParams.get('url');

    if (!targetUrl) {
      return new NextResponse(null, { status: 400 });
    }

    const upstreamRes = await fetch(targetUrl, { method: 'HEAD' });
    const responseHeaders = new Headers();
    responseHeaders.set('Access-Control-Allow-Origin', '*');
    responseHeaders.set('Access-Control-Allow-Methods', 'GET, HEAD, OPTIONS');
    responseHeaders.set('Access-Control-Allow-Headers', 'Range, Content-Type, Accept');
    responseHeaders.set('Access-Control-Expose-Headers', 'Content-Length, Content-Range, Accept-Ranges, Content-Type');
    responseHeaders.set('Accept-Ranges', 'bytes');

    const contentType = upstreamRes.headers.get('content-type') || 'audio/mpeg';
    responseHeaders.set('Content-Type', contentType);

    const contentLength = upstreamRes.headers.get('content-length');
    if (contentLength) responseHeaders.set('Content-Length', contentLength);

    return new NextResponse(null, {
      status: upstreamRes.status,
      headers: responseHeaders,
    });
  } catch {
    return new NextResponse(null, { status: 500 });
  }
}
