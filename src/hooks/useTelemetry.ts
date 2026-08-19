'use client';

import { useCallback, useRef } from 'react';
import { getStoredUserSession } from '@/lib/authSession';

export type TelemetryEventType =
  | 'play'
  | 'progress'
  | 'watch_end'
  | 'skip'
  | 'heart'
  | 'paywall_view'
  | 'recommendation_click';

export interface TelemetryPayload {
  event: TelemetryEventType;
  trackId?: string;
  albumId?: string;
  mediaType?: 'audio' | 'video';
  duration?: number;
  watchedDuration?: number;
  progressPercent?: number;
  isLiked?: boolean;
  sourceSection?: string;
  timestamp?: number;
  userSession?: any;
  metadata?: Record<string, any>;
}

export function useTelemetry() {
  const lastEventTimeRef = useRef<number>(0);

  const sendTelemetry = useCallback((payload: TelemetryPayload) => {
    try {
      const session = getStoredUserSession();
      const enrichedPayload: TelemetryPayload = {
        ...payload,
        timestamp: payload.timestamp || Date.now(),
        userSession: session ? { id: session.id, email: session.email, plan: session.plan } : null,
      };

      const bodyStr = JSON.stringify(enrichedPayload);

      // Prefer navigator.sendBeacon if supported and not too large for guaranteed delivery
      if (typeof navigator !== 'undefined' && navigator.sendBeacon) {
        const blob = new Blob([bodyStr], { type: 'application/json' });
        const success = navigator.sendBeacon('/api/telemetry', blob);
        if (success) return;
      }

      // Fallback to fetch with keepalive
      fetch('/api/telemetry', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: bodyStr,
        keepalive: true,
      }).catch((err) => {
        // Telemetry errors are non-blocking
        console.debug('Telemetry delivery notice:', err);
      });
    } catch (e) {
      console.debug('Telemetry error:', e);
    }
  }, []);

  const trackPlay = useCallback(
    (trackId: string, albumId?: string, mediaType: 'audio' | 'video' = 'audio', sourceSection?: string) => {
      sendTelemetry({
        event: 'play',
        trackId,
        albumId,
        mediaType,
        sourceSection,
      });
    },
    [sendTelemetry]
  );

  const trackProgress = useCallback(
    (trackId: string, watchedDuration: number, duration: number, mediaType: 'audio' | 'video' = 'audio') => {
      const now = Date.now();
      // Throttle progress events to max once every 10 seconds
      if (now - lastEventTimeRef.current < 10000) return;
      lastEventTimeRef.current = now;

      const progressPercent = duration > 0 ? Math.round((watchedDuration / duration) * 100) : 0;
      sendTelemetry({
        event: 'progress',
        trackId,
        duration,
        watchedDuration,
        progressPercent,
        mediaType,
      });
    },
    [sendTelemetry]
  );

  const trackWatchEnd = useCallback(
    (trackId: string, duration: number, mediaType: 'audio' | 'video' = 'video') => {
      sendTelemetry({
        event: 'watch_end',
        trackId,
        duration,
        watchedDuration: duration,
        progressPercent: 100,
        mediaType,
      });
    },
    [sendTelemetry]
  );

  const trackSkip = useCallback(
    (trackId: string, watchedDuration: number, duration: number, mediaType: 'audio' | 'video' = 'audio') => {
      sendTelemetry({
        event: 'skip',
        trackId,
        watchedDuration,
        duration,
        progressPercent: duration > 0 ? Math.round((watchedDuration / duration) * 100) : 0,
        mediaType,
      });
    },
    [sendTelemetry]
  );

  const trackHeart = useCallback(
    (trackId: string, isLiked: boolean, albumId?: string) => {
      sendTelemetry({
        event: 'heart',
        trackId,
        albumId,
        isLiked,
      });
    },
    [sendTelemetry]
  );

  const trackPaywallView = useCallback(
    (trackId?: string, sourceSection?: string) => {
      sendTelemetry({
        event: 'paywall_view',
        trackId,
        sourceSection,
      });
    },
    [sendTelemetry]
  );

  const trackRecommendationClick = useCallback(
    (trackId: string, sourceSection: string, albumId?: string) => {
      sendTelemetry({
        event: 'recommendation_click',
        trackId,
        albumId,
        sourceSection,
      });
    },
    [sendTelemetry]
  );

  return {
    sendTelemetry,
    trackPlay,
    trackProgress,
    trackWatchEnd,
    trackSkip,
    trackHeart,
    trackPaywallView,
    trackRecommendationClick,
  };
}
