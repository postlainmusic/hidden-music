/**
 * Track Drum & Acoustic Preset Profiles
 * Tailored parameters for core tracks (e.g. Elegie, IDK, Ai Mới Là Kẻ Xấu Xa)
 */

export interface TrackDrumProfile {
  bpm: number;
  kickBandHz: [number, number];
  snareBandHz: [number, number];
  fluxSensitivity: number;
  springTension: number;
  springDampening: number;
}

export const TRACK_DRUM_PROFILES: Record<string, TrackDrumProfile> = {
  // 01. Elegie (Deep Atmospheric Sub-bass, ~75/150 BPM)
  elegie: {
    bpm: 75,
    kickBandHz: [30, 70],
    snareBandHz: [1200, 3500],
    fluxSensitivity: 1.45,
    springTension: 0.28,
    springDampening: 0.65,
  },
  // 02. IDK - MCK (Punchy Trap / Drill 808s, ~134 BPM)
  idk: {
    bpm: 134,
    kickBandHz: [50, 110],
    snareBandHz: [1000, 3000],
    fluxSensitivity: 1.25,
    springTension: 0.35,
    springDampening: 0.58,
  },
  // 03. Ai Mới Là Kẻ Xấu Xa (Soulful Hip-Hop Warmth, ~88 BPM)
  'ai-moi-la-ke-xau-xa': {
    bpm: 88,
    kickBandHz: [70, 130],
    snareBandHz: [800, 2400],
    fluxSensitivity: 1.30,
    springTension: 0.30,
    springDampening: 0.62,
  },
};

/**
 * Match track title or ID to a drum profile
 */
export function getTrackDrumProfile(titleOrId?: string): TrackDrumProfile {
  if (!titleOrId) {
    return {
      bpm: 120,
      kickBandHz: [40, 100],
      snareBandHz: [1000, 3000],
      fluxSensitivity: 1.35,
      springTension: 0.32,
      springDampening: 0.60,
    };
  }

  const normalized = titleOrId.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normalized.includes('elegie')) return TRACK_DRUM_PROFILES.elegie;
  if (normalized.includes('idk')) return TRACK_DRUM_PROFILES.idk;
  if (normalized.includes('kexauxa') || normalized.includes('aimoi')) return TRACK_DRUM_PROFILES['ai-moi-la-ke-xau-xa'];

  return {
    bpm: 120,
    kickBandHz: [40, 100],
    snareBandHz: [1000, 3000],
    fluxSensitivity: 1.35,
    springTension: 0.32,
    springDampening: 0.60,
  };
}
