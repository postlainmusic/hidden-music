import { Album, TrackItem } from '../types/database';

export const API_BASE_URL =
  import.meta.env.PUBLIC_API_URL ||
  (typeof window !== 'undefined' && window.location.hostname === 'localhost'
    ? 'http://localhost:8787'
    : 'https://api.postlain.com');

export async function fetchAlbums(): Promise<Album[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/albums`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('API fetchAlbums error:', err);
    return [];
  }
}

export async function fetchTracks(): Promise<TrackItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/tracks`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('API fetchTracks error:', err);
    return [];
  }
}

export async function searchYouTube(query: string): Promise<TrackItem[]> {
  try {
    const res = await fetch(`${API_BASE_URL}/yt/search?q=${encodeURIComponent(query)}`);
    if (!res.ok) return [];
    return await res.json();
  } catch (err) {
    console.warn('API searchYouTube error:', err);
    return [];
  }
}

export function getAudioStreamUrl(track: TrackItem): string {
  if (!track) return '';
  if (track.source === 'youtube' || track.youtube_id || track.id.startsWith('yt_')) {
    const vid = track.youtube_id || track.id.replace(/^yt_/, '');
    return `${API_BASE_URL}/yt/stream/${vid}`;
  }
  if (track.audio_url) {
    if (track.audio_url.startsWith('http://') || track.audio_url.startsWith('https://')) {
      return track.audio_url;
    }
    const cleanKey = track.audio_url.replace(/^\/+/, '');
    return `${API_BASE_URL}/stream/${cleanKey}`;
  }
  return '';
}
