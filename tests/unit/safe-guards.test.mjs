import { describe, it } from 'node:test';
import assert from 'node:assert/strict';

describe('PlayerContext Safe Guards & Invariant Unit Tests', () => {
  it('Playlist and Queue null-safety fallback to empty arrays', () => {
    const sanitizeQueue = (queue) => (Array.isArray(queue) ? queue : []);
    assert.deepEqual(sanitizeQueue(null), []);
    assert.deepEqual(sanitizeQueue(undefined), []);
    assert.deepEqual(sanitizeQueue([{ id: '1', title: 'Track 1' }]), [{ id: '1', title: 'Track 1' }]);
  });

  it('Next track resolution priority prefers userQueue over playlist', () => {
    function resolveNextTrack(userQueue, playlist, currentTrackId) {
      if (Array.isArray(userQueue) && userQueue.length > 0) {
        return { nextTrack: userQueue[0], newQueue: userQueue.slice(1), source: 'userQueue' };
      }
      const safeList = Array.isArray(playlist) ? playlist : [];
      if (safeList.length === 0) return { nextTrack: null, newQueue: [], source: 'empty' };

      const currIdx = safeList.findIndex((t) => t.id === currentTrackId);
      const nextIdx = (currIdx + 1) % safeList.length;
      return { nextTrack: safeList[nextIdx], newQueue: [], source: 'playlist' };
    }

    const qTrack = { id: 'q1', title: 'Queued Track' };
    const pTrack1 = { id: 'p1', title: 'Playlist Track 1' };
    const pTrack2 = { id: 'p2', title: 'Playlist Track 2' };

    // With item in userQueue
    const result1 = resolveNextTrack([qTrack], [pTrack1, pTrack2], 'p1');
    assert.equal(result1.source, 'userQueue');
    assert.equal(result1.nextTrack.id, 'q1');
    assert.equal(result1.newQueue.length, 0);

    // Empty userQueue -> fallback to playlist next
    const result2 = resolveNextTrack([], [pTrack1, pTrack2], 'p1');
    assert.equal(result2.source, 'playlist');
    assert.equal(result2.nextTrack.id, 'p2');
  });
});
