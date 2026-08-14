'use client';

import React, { useState, useEffect } from 'react';
import {
  FileVideo,
  FileAudio,
  UploadCloud,
  Download,
  FileText,
  FileSpreadsheet,
  FileCode,
  Edit3,
  CheckCircle,
  RefreshCw,
  Sparkles,
  Zap,
  Clock,
  HardDrive,
  Tv,
  Music,
  Share2
} from 'lucide-react';
import {
  MediaMetadata,
  readMediaFileMetadata,
  exportMetadataToJson,
  exportMetadataToTxt,
  exportMetadataToCsv,
} from '@/lib/mediaMetadata';

interface MediaMetadataScannerProps {
  onApplyToForm?: (metadata: MediaMetadata, file: File) => void;
}

export default function MediaMetadataScanner({ onApplyToForm }: MediaMetadataScannerProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [mediaUrl, setMediaUrl] = useState<string | null>(null);
  const [isReading, setIsReading] = useState(false);
  const [metadata, setMetadata] = useState<MediaMetadata | null>(null);
  const [isEditing, setIsEditing] = useState(false);
  const [copyStatus, setCopyStatus] = useState(false);

  // Clean up object URL when file changes or unmounts
  useEffect(() => {
    if (!selectedFile) {
      setMediaUrl(null);
      return;
    }
    const url = URL.createObjectURL(selectedFile);
    setMediaUrl(url);

    return () => {
      URL.revokeObjectURL(url);
    };
  }, [selectedFile]);

  // Handle File Input Change
  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  // Drag and Drop handlers
  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (!file) return;
    await processFile(file);
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const processFile = async (file: File) => {
    setSelectedFile(file);
    setIsReading(true);
    try {
      const readData = await readMediaFileMetadata(file);
      setMetadata(readData);
    } catch (error) {
      console.error('Lỗi khi đọc metadata:', error);
    } finally {
      setIsReading(false);
    }
  };

  // Handle metadata edit inputs
  const handleFieldChange = (field: keyof MediaMetadata, value: string | number) => {
    if (!metadata) return;
    setMetadata({
      ...metadata,
      [field]: value,
    });
  };

  const handleReset = () => {
    setSelectedFile(null);
    setMetadata(null);
    setMediaUrl(null);
    setIsEditing(false);
  };

  const handleCopyJson = () => {
    if (!metadata) return;
    navigator.clipboard.writeText(JSON.stringify(metadata, null, 2));
    setCopyStatus(true);
    setTimeout(() => setCopyStatus(false), 2000);
  };

  return (
    <div className="w-full bw-panel rounded-3xl p-6 border border-white/20 shadow-2xl space-y-6 text-white font-mono relative overflow-hidden">
      <div className="flex items-center justify-between border-b border-white/10 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-white animate-pulse" />
            <h2 className="text-lg md:text-xl font-extrabold tracking-wider uppercase text-white">
              ĐỌC & CHỈNH SỬA METADATA FILE NHẠC / VIDEO
            </h2>
          </div>
          <p className="text-xs text-slate-400 mt-1">
            Tải tệp (.mp3/.wav/.flac/.mp4) hoặc dán đường link YouTube để đọc metadata & xuất file (.json/.txt/.csv)
          </p>
        </div>

        {metadata && (
          <button
            onClick={handleReset}
            className="px-3 py-1.5 rounded-xl bg-slate-900 border border-slate-700 hover:border-white text-slate-300 hover:text-white text-xs font-bold transition-all flex items-center gap-1.5"
          >
            <RefreshCw className="w-3.5 h-3.5" />
            <span>TẢI TỆP KHÁC</span>
          </button>
        )}
      </div>

      {/* STEP 1: Upload Dropzone & YouTube Link Input */}
      {!metadata && !isReading && (
        <div className="space-y-6">
          {/* File Upload Area */}
          <div
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            className="border-2 border-dashed border-white/30 hover:border-white rounded-3xl p-8 md:p-10 text-center bg-slate-950/60 hover:bg-slate-900/80 transition-all cursor-pointer group space-y-4"
          >
            <input
              type="file"
              id="media-metadata-input"
              accept="audio/*,video/*,.mp3,.wav,.flac,.m4a,.aac,.mp4,.webm,.mkv,.mov"
              onChange={handleFileChange}
              className="hidden"
            />
            <label htmlFor="media-metadata-input" className="cursor-pointer block space-y-3">
              <div className="w-14 h-14 rounded-full bg-white/10 border border-white/20 flex items-center justify-center mx-auto group-hover:scale-110 group-hover:bg-white text-white group-hover:text-black transition-all">
                <UploadCloud className="w-7 h-7" />
              </div>
              <div>
                <p className="text-sm font-extrabold uppercase text-white tracking-widest">
                  1. KÉO THẢ TỆP ÂM THANH / VIDEO VÀO ĐÂY
                </p>
                <p className="text-xs text-slate-400 mt-1">
                  Hoặc nhấp để chọn tệp từ máy tính (.mp3, .wav, .flac, .mp4, .webm,...)
                </p>
              </div>
              <div className="flex flex-wrap items-center justify-center gap-2 pt-2">
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400 flex items-center gap-1">
                  <Music className="w-3 h-3" /> AUDIO (MP3/WAV/FLAC)
                </span>
                <span className="px-2.5 py-1 rounded-lg bg-slate-900 border border-slate-800 text-[10px] text-slate-400 flex items-center gap-1">
                  <Tv className="w-3 h-3" /> VIDEO (MP4/WEBM/MKV)
                </span>
              </div>
            </label>
          </div>        </div>
      )}

      {/* Loading State */}
      {isReading && (
        <div className="py-12 text-center space-y-3">
          <div className="w-12 h-12 border-4 border-white/20 border-t-white rounded-full animate-spin mx-auto" />
          <p className="text-xs font-bold text-slate-300 animate-pulse">
            ⚡ ĐANG PHÂN TÍCH VÀ ĐỌC THÔNG TIN METADATA CỦA FILE / LINK YOUTUBE THẦN TỐC...
          </p>
        </div>
      )}

      {/* STEP 2: Display Metadata & Editor */}
      {metadata && !isReading && (
        <div className="space-y-6">
          {/* Media Preview & Core Info Bar */}
          <div className="grid grid-cols-1 md:grid-cols-12 gap-4 bg-slate-950 p-4 rounded-2xl border border-white/20 items-center">
            <div className="md:col-span-4 flex items-center gap-3">
              <div className="w-12 h-12 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center text-white flex-shrink-0">
                {metadata.mediaCategory === 'video' ? <FileVideo className="w-6 h-6" /> : <FileAudio className="w-6 h-6" />}
              </div>
              <div className="overflow-hidden">
                <h3 className="text-sm font-extrabold text-white truncate" title={metadata.fileName}>
                  {metadata.fileName}
                </h3>
                <div className="flex items-center gap-2 text-[10px] text-slate-400">
                  <span className="px-1.5 py-0.5 rounded bg-white/10 text-white font-mono uppercase flex items-center gap-1">
                    {metadata.format}
                  </span>
                  <span>{metadata.fileSizeFormatted}</span>
                </div>
              </div>
            </div>

            {/* Inline Audio / Video Player */}
            <div className="md:col-span-8 flex flex-col justify-center">
              {mediaUrl && (
                metadata.mediaCategory === 'video' ? (
                  <video src={mediaUrl} controls className="w-full max-h-40 rounded-xl bg-black border border-slate-800" />
                ) : (
                  <audio src={mediaUrl} controls className="w-full rounded-xl bg-slate-900" />
                )
              )}
            </div>
          </div>

          {/* Extracted Technical Badges */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 text-xs">
            <div className="p-3 rounded-2xl bg-black border border-white/20 space-y-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase">
                <HardDrive className="w-3 h-3 text-white" /> Dung lượng
              </span>
              <p className="font-extrabold text-white">{metadata.fileSizeFormatted}</p>
            </div>

            <div className="p-3 rounded-2xl bg-black border border-white/20 space-y-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase">
                <Clock className="w-3 h-3 text-white" /> Thời lượng
              </span>
              <p className="font-extrabold text-white">{metadata.durationFormatted}</p>
            </div>

            <div className="p-3 rounded-2xl bg-black border border-white/20 space-y-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase">
                <Tv className="w-3 h-3 text-white" /> Độ phân giải
              </span>
              <p className="font-extrabold text-white">{metadata.resolution || 'N/A'}</p>
            </div>

            <div className="p-3 rounded-2xl bg-black border border-white/20 space-y-1">
              <span className="text-[10px] text-slate-400 flex items-center gap-1 uppercase">
                <Sparkles className="w-3 h-3 text-white" /> Định dạng
              </span>
              <p className="font-extrabold text-white">
                {metadata.format}
              </p>
            </div>
          </div>

          {/* Form Editing Mode toggle & Editable Fields */}
          <div className="space-y-4 pt-2">
            <div className="flex items-center justify-between border-b border-white/10 pb-2">
              <div className="flex items-center gap-2">
                <Edit3 className="w-4 h-4 text-white" />
                <span className="text-xs font-bold uppercase tracking-wider text-white">
                  {isEditing ? 'SỬA THÔNG TIN METADATA TRỰC TIẾP' : 'METADATA ĐÃ ĐỌC (ID3 TAGS / MEDIA INFO)'}
                </span>
              </div>

              <button
                type="button"
                onClick={() => setIsEditing(!isEditing)}
                className={`px-3 py-1 rounded-xl text-xs font-bold uppercase transition-all border ${
                  isEditing
                    ? 'bg-white text-black border-white'
                    : 'bg-slate-900 text-slate-300 border-slate-700 hover:text-white hover:border-white'
                }`}
              >
                {isEditing ? '✓ HOÀN TẤT CHỈNH SỬA' : '✏️ BẬT CHẾ ĐỘ SỬA'}
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Tiêu đề bài hát / MV *</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={metadata.title}
                  onChange={(e) => handleFieldChange('title', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 disabled:border-slate-800 disabled:opacity-80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Nghệ sĩ / Artist / Kênh</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={metadata.artist}
                  placeholder="Chưa có thông tin"
                  onChange={(e) => handleFieldChange('artist', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 disabled:border-slate-800 disabled:opacity-80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Album</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={metadata.album}
                  placeholder="Chưa có thông tin"
                  onChange={(e) => handleFieldChange('album', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 disabled:border-slate-800 disabled:opacity-80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Năm phát hành</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={metadata.year}
                  onChange={(e) => handleFieldChange('year', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 disabled:border-slate-800 disabled:opacity-80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Thể loại (Genre)</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={metadata.genre}
                  onChange={(e) => handleFieldChange('genre', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 disabled:border-slate-800 disabled:opacity-80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white"
                />
              </div>

              <div>
                <label className="block text-[10px] text-slate-400 uppercase mb-1">Ghi chú (Comment)</label>
                <input
                  type="text"
                  disabled={!isEditing}
                  value={metadata.comment}
                  placeholder="Nhập ghi chú thêm..."
                  onChange={(e) => handleFieldChange('comment', e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 disabled:border-slate-800 disabled:opacity-80 rounded-xl px-3 py-2 text-white focus:outline-none focus:border-white"
                />
              </div>
            </div>
          </div>

          {/* Export & Action Buttons ("ra file") */}
          <div className="p-4 rounded-2xl bg-black border border-white/20 space-y-3 pt-4">
            <span className="text-xs font-bold text-white uppercase flex items-center gap-1.5">
              <Download className="w-4 h-4 text-white" /> XUẤT THÔNG TIN METADATA RA FILE LƯU TRỮ:
            </span>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <button
                type="button"
                onClick={() => exportMetadataToJson(metadata)}
                className="py-3 px-3 rounded-xl bg-slate-900 hover:bg-white hover:text-black border border-slate-700 text-white font-extrabold text-xs uppercase transition-all flex items-center justify-center gap-2"
              >
                <FileCode className="w-4 h-4" />
                <span>TẢI FILE JSON</span>
              </button>

              <button
                type="button"
                onClick={() => exportMetadataToTxt(metadata)}
                className="py-3 px-3 rounded-xl bg-slate-900 hover:bg-white hover:text-black border border-slate-700 text-white font-extrabold text-xs uppercase transition-all flex items-center justify-center gap-2"
              >
                <FileText className="w-4 h-4" />
                <span>TẢI FILE TXT</span>
              </button>

              <button
                type="button"
                onClick={() => exportMetadataToCsv(metadata)}
                className="py-3 px-3 rounded-xl bg-slate-900 hover:bg-white hover:text-black border border-slate-700 text-white font-extrabold text-xs uppercase transition-all flex items-center justify-center gap-2"
              >
                <FileSpreadsheet className="w-4 h-4" />
                <span>TẢI FILE CSV</span>
              </button>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-800">
              <button
                type="button"
                onClick={handleCopyJson}
                className="text-[11px] text-slate-400 hover:text-white flex items-center gap-1 transition-colors"
              >
                {copyStatus ? <CheckCircle className="w-3.5 h-3.5 text-green-400" /> : <Share2 className="w-3.5 h-3.5" />}
                <span>{copyStatus ? 'Đã sao chép JSON vào Clipboard!' : 'Sao chép JSON'}</span>
              </button>

              {onApplyToForm && selectedFile && metadata && (
                <button
                  type="button"
                  onClick={() => onApplyToForm(metadata, selectedFile)}
                  className="py-2.5 px-4 rounded-xl bg-white text-black font-extrabold text-xs uppercase hover:bg-slate-200 transition-all flex items-center gap-2 shadow-lg"
                >
                  <CheckCircle className="w-4 h-4" />
                  <span>ÁP DỤNG VÀO ĐĂNG BÀI ADMIN</span>
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
