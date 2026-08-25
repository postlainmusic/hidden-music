import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

// Pure algorithmic unit tests for PocketBase data transformations and streaming resolvers
function trackRecordToTrackItem(record, baseUrl = 'https://database.postlain.com') {
  const collection = record.collectionName || record.collectionId || 'tracks';
  let audioUrl = '';
  if (record.audio_file) {
    if (record.audio_file.startsWith('http://') || record.audio_file.startsWith('https://')) {
      audioUrl = record.audio_file;
    } else {
      audioUrl = `${baseUrl.replace(/\/$/, '')}/api/files/${collection}/${record.id}/${record.audio_file}`;
    }
  }

  let coverUrl = '';
  if (record.cover_image) {
    if (record.cover_image.startsWith('http://') || record.cover_image.startsWith('https://')) {
      coverUrl = record.cover_image;
    } else {
      coverUrl = `${baseUrl.replace(/\/$/, '')}/api/files/${collection}/${record.id}/${record.cover_image}`;
    }
  }

  const artistName =
    typeof record.expand?.artist === 'object' && record.expand.artist?.name
      ? record.expand.artist.name
      : record.artist || 'Unknown Artist';

  return {
    id: record.id,
    album_id: record.album || record.id,
    title: record.title,
    artist: artistName,
    media_type: 'audio',
    audio_url: audioUrl,
    video_url: record.video_url || '',
    cover_url: coverUrl || '/icon.svg',
    original_year: record.created ? new Date(record.created).getFullYear() : new Date().getFullYear(),
    lyrics: record.lyrics || '',
    duration: Math.round(record.duration || 0),
    created_at: record.created || new Date().toISOString(),
  };
}

function playlistRecordToAlbum(playlist, baseUrl = 'https://database.postlain.com') {
  const collection = playlist.collectionName || playlist.collectionId || 'playlists';
  let coverUrl = '';
  if (playlist.cover_image) {
    if (playlist.cover_image.startsWith('http://') || playlist.cover_image.startsWith('https://')) {
      coverUrl = playlist.cover_image;
    } else {
      coverUrl = `${baseUrl.replace(/\/$/, '')}/api/files/${collection}/${playlist.id}/${playlist.cover_image}`;
    }
  }

  const tracks = Array.isArray(playlist.expand?.tracks)
    ? playlist.expand.tracks.map((t) => trackRecordToTrackItem(t, baseUrl))
    : [];

  return {
    id: playlist.id,
    title: playlist.title,
    artist: playlist.expand?.user?.name || playlist.expand?.user?.email || 'POSTLAIN VAULT',
    original_year: playlist.created ? new Date(playlist.created).getFullYear() : new Date().getFullYear(),
    cover_url: coverUrl || '/icon.svg',
    is_published: playlist.is_public !== false,
    created_at: playlist.created || new Date().toISOString(),
    tracks,
  };
}

function getAudioStreamUrl(track) {
  if (!track) return '';
  if (track.audio_file) {
    return `https://database.postlain.com/api/files/tracks/${track.id}/${track.audio_file}`;
  }
  if (track.audio_url) {
    return track.audio_url;
  }
  return '';
}

function getCoverImageUrl(item) {
  if (!item) return '/icon.svg';
  if (item.cover_image) {
    return `https://database.postlain.com/api/files/tracks/${item.id}/${item.cover_image}`;
  }
  if (item.cover_url) {
    return item.cover_url;
  }
  return '/icon.svg';
}

describe('PocketBase Data Adapters & Streaming URL Resolution', () => {
  it('Converts TrackRecord with PocketBase file to standard TrackItem with direct file URL', () => {
    const mockTrack = {
      id: 'trk_1234567890',
      title: 'Midnight Echoes',
      artist: 'POSTLAIN',
      album: 'Cyber Vault 2026',
      audio_file: 'audio_track_01.flac',
      cover_image: 'cover_art_01.webp',
      duration: 215.8,
      genre: 'Synthwave',
      plays_count: 1420,
      bitrate: 'FLAC 24-bit',
      created: '2026-08-25T10:00:00Z',
      updated: '2026-08-25T10:00:00Z',
      collectionName: 'tracks',
    };

    const trackItem = trackRecordToTrackItem(mockTrack, 'https://database.postlain.com');

    assert.equal(trackItem.id, 'trk_1234567890');
    assert.equal(trackItem.title, 'Midnight Echoes');
    assert.equal(trackItem.artist, 'POSTLAIN');
    assert.equal(
      trackItem.audio_url,
      'https://database.postlain.com/api/files/tracks/trk_1234567890/audio_track_01.flac'
    );
    assert.equal(
      trackItem.cover_url,
      'https://database.postlain.com/api/files/tracks/trk_1234567890/cover_art_01.webp'
    );
    assert.equal(trackItem.duration, 216);
    assert.equal(trackItem.media_type, 'audio');
  });

  it('Converts TrackRecord with expanded artist relation correctly', () => {
    const mockTrack = {
      id: 'trk_rel_001',
      title: 'Neon Horizon',
      artist: 'art_id_999',
      audio_file: 'track.mp3',
      duration: 180,
      plays_count: 50,
      created: '2026-08-25T10:00:00Z',
      updated: '2026-08-25T10:00:00Z',
      expand: {
        artist: {
          id: 'art_id_999',
          name: 'The Cyber Architect',
          created: '2026-01-01T00:00:00Z',
          updated: '2026-01-01T00:00:00Z',
        },
      },
    };

    const trackItem = trackRecordToTrackItem(mockTrack, 'https://database.postlain.com');
    assert.equal(trackItem.artist, 'The Cyber Architect');
  });

  it('Converts PlaylistRecord with expanded tracks to Album model', () => {
    const mockPlaylist = {
      id: 'pl_9999',
      title: 'Audiophile Master Studio',
      description: 'Hi-Res Lossless Audio Collection',
      cover_image: 'playlist_art.png',
      user: 'usr_admin',
      is_public: true,
      created: '2026-08-25T10:00:00Z',
      updated: '2026-08-25T10:00:00Z',
      expand: {
        user: { id: 'usr_admin', name: 'POSTLAIN Admin', email: 'admin@postlain.com' },
        tracks: [
          {
            id: 'trk_1',
            title: 'Track One',
            artist: 'Artist A',
            audio_file: 'one.flac',
            duration: 200,
            plays_count: 10,
            created: '2026-08-25T10:00:00Z',
            updated: '2026-08-25T10:00:00Z',
          },
        ],
      },
    };

    const album = playlistRecordToAlbum(mockPlaylist, 'https://database.postlain.com');
    assert.equal(album.id, 'pl_9999');
    assert.equal(album.title, 'Audiophile Master Studio');
    assert.equal(album.artist, 'POSTLAIN Admin');
    assert.equal(album.tracks.length, 1);
    assert.equal(album.tracks[0].title, 'Track One');
  });

  it('Resolves audio stream URLs directly from PocketBase and external CDN targets', () => {
    const directTrack = {
      id: 'trk_ext',
      album_id: 'alb_1',
      title: 'Direct R2',
      media_type: 'audio',
      audio_url: 'https://media.postlain.com/master-tracks/song.flac',
      duration: 300,
      created_at: '2026-08-25T10:00:00Z',
    };

    const resolvedUrl = getAudioStreamUrl(directTrack);
    assert.equal(resolvedUrl, 'https://media.postlain.com/master-tracks/song.flac');

    const emptyTrack = null;
    assert.equal(getAudioStreamUrl(emptyTrack), '');
  });

  it('Resolves fallback icon for empty cover images', () => {
    assert.equal(getCoverImageUrl(null), '/icon.svg');
    assert.equal(getCoverImageUrl({ title: 'No Cover' }), '/icon.svg');
  });
});
