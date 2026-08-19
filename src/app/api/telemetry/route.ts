import { NextResponse } from 'next/server';

export const runtime = 'edge';
export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  try {
    const data = await req.json();

    // Telemetry event ingestion (can be expanded to save to Supabase / Clickhouse / Kafka)
    // Structured format ready for AI Recommender ingestion
    const eventRecord = {
      event: data.event,
      track_id: data.trackId || null,
      album_id: data.albumId || null,
      media_type: data.mediaType || 'audio',
      watched_duration: data.watchedDuration || 0,
      duration: data.duration || 0,
      progress_percent: data.progressPercent || 0,
      is_liked: data.isLiked ?? null,
      source_section: data.sourceSection || 'direct',
      user_id: data.userSession?.id || 'anonymous',
      user_plan: data.userSession?.plan || 'free',
      timestamp: data.timestamp || Date.now(),
      created_at: new Date().toISOString(),
    };

    // Fast acknowledge response
    return NextResponse.json({
      success: true,
      received_event: data.event,
      model_pipeline: 'postlain-recommendation-engine-v1',
    });
  } catch (error) {
    return NextResponse.json(
      { success: false, error: 'Failed to process telemetry' },
      { status: 400 }
    );
  }
}
