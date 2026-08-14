export interface MediaMetadata {
  fileName: string;
  fileSize: number;
  fileSizeFormatted: string;
  fileType: string;
  format: string;
  mediaCategory: 'audio' | 'video' | 'unknown';
  duration: number;
  durationFormatted: string;
  width?: number;
  height?: number;
  resolution?: string;
  aspectRatio?: string;
  sampleRate?: number;
  channels?: number;
  bitrateKbps?: number;
  title: string;
  artist: string;
  album: string;
  year: string;
  genre: string;
  comment: string;
  lastModified: string;
}

/**
 * Format bytes to human readable string (KB, MB, GB)
 */
export function formatBytes(bytes: number, decimals = 2): string {
  if (bytes === 0) return '0 Bytes';
  const k = 1024;
  const dm = decimals < 0 ? 0 : decimals;
  const sizes = ['Bytes', 'KB', 'MB', 'GB', 'TB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(dm))} ${sizes[i]}`;
}

/**
 * Format seconds into mm:ss or hh:mm:ss string
 */
export function formatDuration(seconds: number): string {
  if (!seconds || isNaN(seconds) || seconds <= 0) return '00:00';
  const sec = Math.floor(seconds);
  const hrs = Math.floor(sec / 3600);
  const mins = Math.floor((sec % 3600) / 60);
  const secs = sec % 60;

  const pad = (num: number) => String(num).padStart(2, '0');

  if (hrs > 0) {
    return `${pad(hrs)}:${pad(mins)}:${pad(secs)}`;
  }
  return `${pad(mins)}:${pad(secs)}`;
}

/**
 * Helper to clean up audio/video raw titles from file names
 */
export function cleanTitleFromFileName(fileName: string): string {
  // Remove extension
  let clean = fileName.replace(/\.[^/.]+$/, '');
  // Replace underscores and multiple spaces
  clean = clean.replace(/_/g, ' ').replace(/\s+/g, ' ').trim();
  return clean;
}

/**
 * Extract normalized core title for smart auto-matching
 * Removes track numbers (e.g. "01.", "02 -"), file extensions, noise tags, artist tags, and MV suffixes.
 * Example: "02.IDK" and "IDK - MCK (0FFICIAL MUSIK VIDEO)" -> Both return "idk"
 */
export function extractCoreTitle(rawTitle: string): string {
  if (!rawTitle) return '';
  let clean = rawTitle.toLowerCase();

  // Remove file extensions if present
  clean = clean.replace(/\.[a-z0-9]+$/i, '');
  // Remove leading track numbers (e.g. "01.", "02 -", "03 ", "1. ")
  clean = clean.replace(/^\d+[\.\s-]*/, '');
  // Remove parenthetical noise or brackets (e.g. "(Official Video)", "[MV]")
  clean = clean.replace(/\[.*?\]|\(.*?\)/g, '');

  // Remove common MV/Video/Audio keywords and typos
  clean = clean.replace(/0fficial\s+musik\s+video/gi, '');
  clean = clean.replace(/official\s+(music\s+)?(video|mv|audio|musik\s+video|visualizer|lyric\s+video)/gi, '');
  clean = clean.replace(/\b(mv|official|music|video|audio|lyric|lyrics|visualizer|audio\s+official|full\s+mv)\b/gi, '');

  // Replace punctuation, dashes, underscores with space
  clean = clean.replace(/[-_~,.:;!?'"()\[\]/\\|]/g, ' ');
  // Compress multiple spaces
  clean = clean.replace(/\s+/g, ' ').trim();

  return clean;
}

/**
 * Check if two title strings refer to the same song based on core title matching
 */
export function isTitleMatching(titleA: string, titleB: string): boolean {
  const coreA = extractCoreTitle(titleA);
  const coreB = extractCoreTitle(titleB);

  if (!coreA || !coreB) return false;
  if (coreA === coreB) return true;

  // Check if one contains another as a standalone word or primary phrase
  const wordsA = coreA.split(' ').filter((w) => w.length >= 2);
  const wordsB = coreB.split(' ').filter((w) => w.length >= 2);

  if (wordsA.length === 0 || wordsB.length === 0) return false;

  // Exact phrase inclusion check
  if (coreA.includes(coreB) || coreB.includes(coreA)) return true;

  // Overlap ratio check
  const commonWords = wordsA.filter((w) => wordsB.includes(w));
  const minWordCount = Math.min(wordsA.length, wordsB.length);
  if (commonWords.length > 0 && commonWords.length >= minWordCount) {
    return true;
  }

  return false;
}

/**
 * Parse ID3v2 Tags from ArrayBuffer (MP3 files)
 */
function parseID3v2(buffer: ArrayBuffer): Partial<MediaMetadata> {
  const view = new DataView(buffer);
  const tags: Partial<MediaMetadata> = {};

  // Check header "ID3" (0x49, 0x44, 0x33)
  if (buffer.byteLength < 10) return tags;
  if (view.getUint8(0) !== 0x49 || view.getUint8(1) !== 0x44 || view.getUint8(2) !== 0x33) {
    return tags;
  }

  const version = view.getUint8(3); // e.g., 3 for ID3v2.3, 4 for ID3v2.4
  // Size is stored as 4 synchsafe bytes (7 bits per byte)
  const tagSize =
    ((view.getUint8(6) & 0x7f) << 21) |
    ((view.getUint8(7) & 0x7f) << 14) |
    ((view.getUint8(8) & 0x7f) << 7) |
    (view.getUint8(9) & 0x7f);

  let offset = 10;
  const decoder = new TextDecoder(version === 4 ? 'utf-8' : 'iso-8859-1');

  while (offset < tagSize + 10 && offset + 10 < buffer.byteLength) {
    // Read 4-byte Frame ID
    const frameId = String.fromCharCode(
      view.getUint8(offset),
      view.getUint8(offset + 1),
      view.getUint8(offset + 2),
      view.getUint8(offset + 3)
    );

    if (!/^[A-Z0-9]{4}$/.test(frameId)) break; // End of valid frames

    let frameSize = 0;
    if (version === 4) {
      frameSize =
        ((view.getUint8(offset + 4) & 0x7f) << 21) |
        ((view.getUint8(offset + 5) & 0x7f) << 14) |
        ((view.getUint8(offset + 6) & 0x7f) << 7) |
        (view.getUint8(offset + 7) & 0x7f);
    } else {
      frameSize = view.getUint32(offset + 4, false);
    }

    if (frameSize <= 0 || offset + 10 + frameSize > buffer.byteLength) break;

    const frameDataOffset = offset + 10;

    try {
      if (frameSize > 1) {
        const encodingByte = view.getUint8(frameDataOffset);
        let frameTextDecoder = decoder;
        let startIdx = frameDataOffset + 1;

        if (encodingByte === 1 || encodingByte === 2) {
          frameTextDecoder = new TextDecoder('utf-16');
        } else if (encodingByte === 3) {
          frameTextDecoder = new TextDecoder('utf-8');
        }

        const bytes = new Uint8Array(buffer, startIdx, frameSize - 1);
        const text = frameTextDecoder.decode(bytes).replace(/\0/g, '').trim();

        if (text) {
          if (frameId === 'TIT2') tags.title = text;
          else if (frameId === 'TPE1') tags.artist = text;
          else if (frameId === 'TALB') tags.album = text;
          else if (frameId === 'TYER' || frameId === 'TDRC') tags.year = text.substring(0, 4);
          else if (frameId === 'TCON') tags.genre = text;
          else if (frameId === 'COMM') tags.comment = text;
        }
      }
    } catch {
      // Ignore decoding errors for corrupted frames
    }

    offset += 10 + frameSize;
  }

  return tags;
}

/**
 * Fast client-side metadata reader for audio and video files.
 * Extracts duration, resolution, sample rate, channels, bitrate, ID3 tags, and format details.
 */
export async function readMediaFileMetadata(file: File): Promise<MediaMetadata> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  const isVideo = file.type.startsWith('video/') || ['mp4', 'mkv', 'webm', 'mov', 'avi', 'flv'].includes(ext);
  const isAudio = file.type.startsWith('audio/') || ['mp3', 'wav', 'flac', 'm4a', 'aac', 'ogg', 'wma'].includes(ext);

  const category: 'audio' | 'video' | 'unknown' = isVideo ? 'video' : isAudio ? 'audio' : 'unknown';

  const baseMetadata: MediaMetadata = {
    fileName: file.name,
    fileSize: file.size,
    fileSizeFormatted: formatBytes(file.size),
    fileType: file.type || `media/${ext}`,
    format: ext.toUpperCase(),
    mediaCategory: category,
    duration: 0,
    durationFormatted: '00:00',
    title: cleanTitleFromFileName(file.name),
    artist: '',
    album: '',
    year: String(new Date(file.lastModified).getFullYear()),
    genre: isVideo ? 'Video MV' : 'Audio Track',
    comment: '',
    lastModified: new Date(file.lastModified).toISOString().split('T')[0],
  };

  // Try parsing ID3 tags if buffer available
  try {
    const slice = file.slice(0, 256 * 1024); // read first 256KB
    const arrayBuffer = await slice.arrayBuffer();
    const id3Tags = parseID3v2(arrayBuffer);

    const fileNameTitle = cleanTitleFromFileName(file.name);
    const hasLeadingNumber = /^\d+[\.\s-]/.test(fileNameTitle);

    if (id3Tags.title && !hasLeadingNumber) {
      baseMetadata.title = id3Tags.title;
    }
    if (id3Tags.artist) baseMetadata.artist = id3Tags.artist;
    if (id3Tags.album) baseMetadata.album = id3Tags.album;
    if (id3Tags.year) baseMetadata.year = id3Tags.year;
    if (id3Tags.genre) baseMetadata.genre = id3Tags.genre;
    if (id3Tags.comment) baseMetadata.comment = id3Tags.comment;
  } catch {
    // Ignore buffer read errors
  }

  // Load via HTML5 Media element to get exact duration & resolution
  const objectUrl = URL.createObjectURL(file);

  return new Promise((resolve) => {
    if (category === 'video') {
      const video = document.createElement('video');
      video.preload = 'metadata';

      video.onloadedmetadata = () => {
        const duration = video.duration || 0;
        const width = video.videoWidth || 0;
        const height = video.videoHeight || 0;

        let resName = `${width}x${height}`;
        if (height >= 2160) resName += ' (4K Ultra HD)';
        else if (height >= 1440) resName += ' (2K QHD)';
        else if (height >= 1080) resName += ' (1080p Full HD)';
        else if (height >= 720) resName += ' (720p HD)';
        else if (height > 0) resName += ' (SD)';

        // Calculate aspect ratio
        let gcdVal = 1;
        if (width > 0 && height > 0) {
          const calcGcd = (a: number, b: number): number => (b === 0 ? a : calcGcd(b, a % b));
          gcdVal = calcGcd(width, height);
        }
        const aspect = width > 0 && height > 0 ? `${width / gcdVal}:${height / gcdVal}` : undefined;

        // Estimated bitrate
        const bitrateKbps = duration > 0 ? Math.round((file.size * 8) / (duration * 1024)) : undefined;

        URL.revokeObjectURL(objectUrl);
        resolve({
          ...baseMetadata,
          duration,
          durationFormatted: formatDuration(duration),
          width,
          height,
          resolution: resName,
          aspectRatio: aspect,
          bitrateKbps,
        });
      };

      video.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(baseMetadata);
      };

      video.src = objectUrl;
    } else {
      const audio = new Audio();
      audio.preload = 'metadata';

      audio.onloadedmetadata = () => {
        const duration = audio.duration || 0;
        const bitrateKbps = duration > 0 ? Math.round((file.size * 8) / (duration * 1024)) : undefined;

        URL.revokeObjectURL(objectUrl);
        resolve({
          ...baseMetadata,
          duration,
          durationFormatted: formatDuration(duration),
          bitrateKbps,
        });
      };

      audio.onerror = () => {
        URL.revokeObjectURL(objectUrl);
        resolve(baseMetadata);
      };

      audio.src = objectUrl;
    }
  });
}

/**
 * Trigger file download in browser
 */
export function downloadFile(content: string, fileName: string, mimeType: string) {
  const blob = new Blob([content], { type: mimeType });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * Export metadata object to nicely formatted JSON file
 */
export function exportMetadataToJson(metadata: MediaMetadata) {
  const jsonStr = JSON.stringify(metadata, null, 2);
  const safeName = metadata.fileName.replace(/\.[^/.]+$/, '');
  downloadFile(jsonStr, `${safeName}_metadata.json`, 'application/json');
}

/**
 * Export metadata object to plain text report (.txt)
 */
export function exportMetadataToTxt(metadata: MediaMetadata) {
  const lines = [
    `==================================================`,
    `       BÁO CÁO METADATA TỆP MEDIA - HIDDEN VAULT   `,
    `==================================================`,
    `Tên tệp:           ${metadata.fileName}`,
    `Dung lượng:        ${metadata.fileSizeFormatted} (${metadata.fileSize} bytes)`,
    `Định dạng / MIME:  ${metadata.format} (${metadata.fileType})`,
    `Loại Media:        ${metadata.mediaCategory.toUpperCase()}`,
    `Thời lượng:        ${metadata.durationFormatted} (${Math.round(metadata.duration)} giây)`,
    metadata.resolution ? `Độ phân giải:      ${metadata.resolution}` : null,
    metadata.aspectRatio ? `Tỷ lệ khung hình:  ${metadata.aspectRatio}` : null,
    metadata.bitrateKbps ? `Bitrate xấp xỉ:    ~${metadata.bitrateKbps} kbps` : null,
    `--------------------------------------------------`,
    `THÔNG TIN CHI TIẾT (EDITABLE METADATA):`,
    `--------------------------------------------------`,
    `Tiêu đề (Title):   ${metadata.title || 'N/A'}`,
    `Nghệ sĩ (Artist):  ${metadata.artist || 'N/A'}`,
    `Album:             ${metadata.album || 'N/A'}`,
    `Năm phát hành:     ${metadata.year || 'N/A'}`,
    `Thể loại (Genre):  ${metadata.genre || 'N/A'}`,
    `Ghi chú (Comment): ${metadata.comment || 'N/A'}`,
    `Ngày sửa đổi cuối: ${metadata.lastModified}`,
    `==================================================`,
  ].filter(Boolean);

  const safeName = metadata.fileName.replace(/\.[^/.]+$/, '');
  downloadFile(lines.join('\n'), `${safeName}_metadata.txt`, 'text/plain;charset=utf-8');
}

/**
 * Export metadata object to CSV file (.csv)
 */
export function exportMetadataToCsv(metadata: MediaMetadata) {
  const headers = [
    'FileName',
    'FileSize',
    'Format',
    'Category',
    'Duration',
    'Title',
    'Artist',
    'Album',
    'Year',
    'Genre',
    'Resolution',
    'BitrateKbps',
  ];

  const escapeCsv = (val: unknown) => `"${String(val ?? '').replace(/"/g, '""')}"`;

  const values = [
    metadata.fileName,
    metadata.fileSizeFormatted,
    metadata.format,
    metadata.mediaCategory,
    metadata.durationFormatted,
    metadata.title,
    metadata.artist,
    metadata.album,
    metadata.year,
    metadata.genre,
    metadata.resolution || '',
    metadata.bitrateKbps ? `${metadata.bitrateKbps} kbps` : '',
  ];

  const csvContent = `${headers.map(escapeCsv).join(',')}\n${values.map(escapeCsv).join(',')}`;
  const safeName = metadata.fileName.replace(/\.[^/.]+$/, '');
  downloadFile(csvContent, `${safeName}_metadata.csv`, 'text/csv;charset=utf-8');
}
