import test from 'node:test';
import assert from 'node:assert/strict';

// Raw LRC parser logic test
function parseLrc(rawLrc) {
  if (!rawLrc || typeof rawLrc !== 'string') return [];
  const lines = rawLrc.split('\n');
  const result = [];
  const timecodeRegex = /\[(\d{2}):(\d{2})(?:\.(\d{2,3}))?\]/g;
  let idCounter = 0;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    timecodeRegex.lastIndex = 0;
    const timestamps = [];
    let lastIndex = 0;
    let match;

    while ((match = timecodeRegex.exec(trimmed)) !== null) {
      const minutes = parseInt(match[1], 10);
      const seconds = parseInt(match[2], 10);
      const fraction = match[3] ? (match[3].length === 2 ? parseInt(match[3], 10) / 100 : parseInt(match[3], 10) / 1000) : 0;
      timestamps.push(minutes * 60 + seconds + fraction);
      lastIndex = timecodeRegex.lastIndex;
    }

    if (timestamps.length > 0) {
      const text = trimmed.substring(lastIndex).trim();
      for (const timeSec of timestamps) {
        result.push({ id: idCounter++, timeSec, text });
      }
    }
  }

  return result.sort((a, b) => a.timeSec - b.timeSec);
}

function findActiveIndex(lyrics, currentTimeSec) {
  if (!Array.isArray(lyrics) || lyrics.length === 0) return -1;
  if (currentTimeSec < lyrics[0].timeSec) return -1;

  let low = 0;
  let high = lyrics.length - 1;
  let bestIdx = 0;

  while (low <= high) {
    const mid = Math.floor((low + high) / 2);
    if (lyrics[mid].timeSec <= currentTimeSec) {
      bestIdx = mid;
      low = mid + 1;
    } else {
      high = mid - 1;
    }
  }

  return bestIdx;
}

test('LrcParser: Parses raw [mm:ss.xx] timecodes into sorted objects', () => {
  const sampleLrc = `
    [00:02.50] Dòng lyric đầu tiên
    [00:05.12] Dòng lyric thứ hai
    [00:10.80] Điệp khúc bùng nổ
  `;

  const parsed = parseLrc(sampleLrc);
  assert.equal(parsed.length, 3);
  assert.equal(parsed[0].timeSec, 2.5);
  assert.equal(parsed[0].text, 'Dòng lyric đầu tiên');
  assert.equal(parsed[1].timeSec, 5.12);
  assert.equal(parsed[2].timeSec, 10.8);
});

test('LrcParser: Binary Search O(log N) matches exact timestamp intervals', () => {
  const sampleLrc = `
    [00:02.00] Line 1
    [00:05.00] Line 2
    [00:10.00] Line 3
  `;
  const parsed = parseLrc(sampleLrc);

  // Before any line starts
  assert.equal(findActiveIndex(parsed, 1.0), -1);

  // Exactly at line 1
  assert.equal(findActiveIndex(parsed, 2.0), 0);
  assert.equal(findActiveIndex(parsed, 3.5), 0);

  // At line 2
  assert.equal(findActiveIndex(parsed, 5.0), 1);
  assert.equal(findActiveIndex(parsed, 7.2), 1);

  // At line 3
  assert.equal(findActiveIndex(parsed, 10.0), 2);
  assert.equal(findActiveIndex(parsed, 99.0), 2);
});
