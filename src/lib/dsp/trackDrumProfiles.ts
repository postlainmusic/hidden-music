/**
 * Track Drum & Acoustic Preset Profiles — PostLain Vault
 * Contains precise BPM, Kick/Snare frequency bands, drum start offsets,
 * and section timing for accurate, isolated visual stage synchronization.
 */

export interface TrackDrumProfile {
  title: string;
  bpm: number;
  drumStartSec: number; // Exact second when drums kick in (0s if from beginning)
  kickBandHz: [number, number]; // Hz range for Sub-bass Kick
  snareBandHz: [number, number]; // Hz range for Snare / Clap / Rimshot
  fluxSensitivity: number; // Onset sensitivity (higher = more selective)
  springTension: number;
  springDampening: number;
  hasKick: boolean;
  hasSnare: boolean;
  sections?: { startSec: number; endSec: number; hasDrums: boolean }[];
}

export const TRACK_DRUM_PROFILES: Record<string, TrackDrumProfile> = {
  // 01. Elegie (Album HVL)
  // Intro: 0s - 45s (Pure Atmospheric Piano/Synth/Vocal - ZERO DRUMS)
  // Drop: 45s - End (Heavy Sub-bass 808 Kick at beat 1, Reverb Rimshot)
  elegie: {
    title: 'Elegie',
    bpm: 75,
    drumStartSec: 45.0,
    kickBandHz: [30, 65],
    snareBandHz: [1400, 3200],
    fluxSensitivity: 1.6,
    springTension: 0.28,
    springDampening: 0.65,
    hasKick: true,
    hasSnare: true,
    sections: [
      { startSec: 0, endSec: 45.0, hasDrums: false },
      { startSec: 45.0, endSec: 160.0, hasDrums: true },
      { startSec: 160.0, endSec: 200.0, hasDrums: false }, // Outro fade
    ],
  },

  // 02. IDK - MCK (Album HVL)
  // Intro: 0s - 13.5s (Guitar & Vocal intro - NO DRUMS)
  // Drop: 13.5s - End (Punchy Trap Kick 60-95Hz & Snare snap on beat 2/4)
  idk: {
    title: 'IDK',
    bpm: 134,
    drumStartSec: 13.5,
    kickBandHz: [50, 95],
    snareBandHz: [1100, 2600],
    fluxSensitivity: 1.35,
    springTension: 0.36,
    springDampening: 0.58,
    hasKick: true,
    hasSnare: true,
    sections: [
      { startSec: 0, endSec: 13.5, hasDrums: false },
      { startSec: 13.5, endSec: 180.0, hasDrums: true },
      { startSec: 180.0, endSec: 200.0, hasDrums: false },
    ],
  },

  // 03. Ai Mới Là Kẻ Xấu Xa (Album HVL)
  // Intro: 0s - 8.0s (Vinyl crackle & piano chords - NO DRUMS)
  // Verse: 8.0s - End (Soulful Boombap Kick on beat 1/3, Layered Clap/Snare on beat 2/4)
  'ai-moi-la-ke-xau-xa': {
    title: 'Ai Mới Là Kẻ Xấu Xa',
    bpm: 88,
    drumStartSec: 8.0,
    kickBandHz: [70, 120],
    snareBandHz: [900, 2200],
    fluxSensitivity: 1.3,
    springTension: 0.30,
    springDampening: 0.62,
    hasKick: true,
    hasSnare: true,
    sections: [
      { startSec: 0, endSec: 8.0, hasDrums: false },
      { startSec: 8.0, endSec: 195.0, hasDrums: true },
      { startSec: 195.0, endSec: 210.0, hasDrums: false },
    ],
  },
};

/**
 * Match track title or ID to a drum profile
 */
export function getTrackDrumProfile(titleOrId?: string): TrackDrumProfile {
  if (!titleOrId) {
    return {
      title: 'Default',
      bpm: 120,
      drumStartSec: 0,
      kickBandHz: [40, 90],
      snareBandHz: [1200, 2800],
      fluxSensitivity: 1.4,
      springTension: 0.32,
      springDampening: 0.60,
      hasKick: true,
      hasSnare: true,
    };
  }

  const normalized = titleOrId.toLowerCase().replace(/[^a-z0-9]/g, '');

  if (normalized.includes('elegie')) return TRACK_DRUM_PROFILES.elegie;
  if (normalized.includes('idk')) return TRACK_DRUM_PROFILES.idk;
  if (normalized.includes('kexauxa') || normalized.includes('aimoi')) return TRACK_DRUM_PROFILES['ai-moi-la-ke-xau-xa'];

  return {
    title: 'Default',
    bpm: 120,
    drumStartSec: 0,
    kickBandHz: [40, 90],
    snareBandHz: [1200, 2800],
    fluxSensitivity: 1.4,
    springTension: 0.32,
    springDampening: 0.60,
    hasKick: true,
    hasSnare: true,
  };
}

/**
 * Check if drums are active at current playback second for a given profile
 */
export function isDrumActiveAtTime(profile: TrackDrumProfile, timeSec: number): boolean {
  if (timeSec < profile.drumStartSec) return false;
  if (profile.sections && profile.sections.length > 0) {
    for (const sec of profile.sections) {
      if (timeSec >= sec.startSec && timeSec < sec.endSec) {
        return sec.hasDrums;
      }
    }
  }
  return true;
}
