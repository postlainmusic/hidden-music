'use client';

import React, { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  Plus,
  Trash2,
  Edit,
  ShieldCheck,
  FileAudio,
  Image as ImageIcon,
  CheckCircle,
  AlertCircle,
  ArrowLeft,
  Music,
  Film,
  FolderPlus,
  Disc3,
  Save,
  X,
  Zap,
  FolderOpen,
  ListPlus,
  UploadCloud,
  Loader2,
  Check,
  ChevronUp,
  ChevronDown,
  GripVertical,
  MessageSquare,
  RefreshCw,
  Clock,
  Bug,
  Flame,
  Music2,
  HelpCircle
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { MediaType, Album, TrackItem, FeedbackItem } from '@/types/database';
import { readMediaFileMetadata, MediaMetadata, isTitleMatching } from '@/lib/mediaMetadata';
import { extractVideoOffset, formatOffsetString } from '@/lib/lrcParser';

export interface BatchTrackItem {
  id: string;
  file: File;
  title: string;
  duration: number;
  metadata: MediaMetadata | null;
  status: 'pending' | 'converting' | 'uploading' | 'completed' | 'error';
  errorMsg?: string;
  mediaType: MediaType;
  lyrics?: string;
}

export default function AdminPage() {
  const [adminTab, setAdminTab] = useState<'albums' | 'feedbacks'>('albums');
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [statusMsg, setStatusMsg] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Feedbacks State
  const [feedbacks, setFeedbacks] = useState<FeedbackItem[]>([]);
  const [feedbacksLoading, setFeedbacksLoading] = useState(false);
  const [feedbackFilter, setFeedbackFilter] = useState<'all' | 'unread' | 'read'>('all');

  // Current Opened Album ID (null = Album List view, string = inside Album view)
  const [openedAlbumId, setOpenedAlbumId] = useState<string | null>(null);

  // Modal state for Create / Edit Album
  const [isAlbumModalOpen, setIsAlbumModalOpen] = useState(false);

  // Metadata & Auto-fill State for Track
  const [trackDuration, setTrackDuration] = useState<number>(200);
  const [autoMetadata, setAutoMetadata] = useState<MediaMetadata | null>(null);

  // Batch Multi-file Upload State
  const [batchTracks, setBatchTracks] = useState<BatchTrackItem[]>([]);
  const [readingMetadata, setReadingMetadata] = useState(false);

  // Batch Video / Audio URLs Import & Mapping State
  const [isBatchVideoModalOpen, setIsBatchVideoModalOpen] = useState(false);
  const [batchLinkTargetType, setBatchLinkTargetType] = useState<'video' | 'audio'>('video');
  const [batchVideoUrlsInput, setBatchVideoUrlsInput] = useState('');
  const [batchTrackMappings, setBatchTrackMappings] = useState<{ id: string; title: string; url: string; isNew?: boolean }[]>([]);
  const [savingBatchVideos, setSavingBatchVideos] = useState(false);

  // Edit Mode state for Album
  const [editingAlbumId, setEditingAlbumId] = useState<string | null>(null);

  // Drag and drop state for tracks
  const [draggedTrackIdx, setDraggedTrackIdx] = useState<number | null>(null);

  // Form 1: Create / Edit Album
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [albumYear, setAlbumYear] = useState<number>(new Date().getFullYear());
  const [coverFile, setCoverFile] = useState<File | null>(null);
  const [coverUrlInput, setCoverUrlInput] = useState('');

  // Form 2: Add / Edit Track inside Album
  const [editingTrackId, setEditingTrackId] = useState<string | null>(null);
  const [trackTitle, setTrackTitle] = useState('');
  const [mediaType, setMediaType] = useState<MediaType>('video');
  const [mediaFile, setMediaFile] = useState<File | null>(null);
  const [mediaUrlInput, setMediaUrlInput] = useState('');
  const [audioUrlInput, setAudioUrlInput] = useState('');
  const [videoUrlInput, setVideoUrlInput] = useState('');
  const [lyrics, setLyrics] = useState('');
  const [videoOffsetInput, setVideoOffsetInput] = useState('');

  // UUID Validator Regex
  const isUUID = (str: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);

  // Helper to convert File to Base64 Data URL
  const fileToBase64 = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = (error) => reject(error);
    });
  };

  // 100% STRICT SUPABASE FETCH
  const fetchSupabaseData = async () => {
    setLoading(true);
    try {
      const supabase = createClient();
      const { data: albumsData, error: albumsError } = await supabase
        .from('albums')
        .select('*')
        .order('created_at', { ascending: false });

      if (albumsError) throw albumsError;

      const { data: tracksData, error: tracksError } = await supabase
        .from('tracks')
        .select('*')
        .order('created_at', { ascending: true });

      if (tracksError) throw tracksError;

      const fullAlbums: Album[] = (albumsData || []).map((album) => ({
        ...album,
        tracks: (tracksData || []).filter((track) => track.album_id === album.id),
      }));

      setAlbums(fullAlbums);
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Lỗi kết nối Supabase.';
      console.error('Error fetching Supabase data:', err);
      setStatusMsg({ type: 'error', text: msg });
    } finally {
      setLoading(false);
    }
  };

  const fetchFeedbacks = async () => {
    setFeedbacksLoading(true);
    let remoteList: FeedbackItem[] = [];
    let localList: FeedbackItem[] = [];

    // 1. Fetch from Supabase
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('feedbacks')
        .select('*')
        .order('created_at', { ascending: false });
      if (!error && data) {
        remoteList = data as FeedbackItem[];
      }
    } catch (err) {
      console.warn('Error loading remote feedbacks:', err);
    }

    // 2. Fetch from LocalStorage fallback
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('hidden_vault_local_feedbacks');
        if (stored) {
          localList = JSON.parse(stored);
        }
      }
    } catch (e) {
      console.warn('LocalStorage load notice:', e);
    }

    // 3. Deduplicate and merge
    const combinedMap = new Map<string, FeedbackItem>();
    remoteList.forEach((fb) => combinedMap.set(fb.id, fb));
    localList.forEach((fb) => {
      if (!combinedMap.has(fb.id)) {
        combinedMap.set(fb.id, fb);
      }
    });

    const merged = Array.from(combinedMap.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setFeedbacks(merged);
    setFeedbacksLoading(false);
  };

  useEffect(() => {
    fetchSupabaseData();
    fetchFeedbacks();
  }, []);

  const handleToggleFeedbackStatus = async (id: string, currentStatus: string | undefined) => {
    const newStatus = currentStatus === 'unread' || !currentStatus ? 'read' : 'unread';
    
    // Update State
    setFeedbacks((prev) =>
      prev.map((f) => (f.id === id ? { ...f, status: newStatus as any } : f))
    );

    // Update LocalStorage
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('hidden_vault_local_feedbacks');
        if (stored) {
          const list: FeedbackItem[] = JSON.parse(stored);
          const updated = list.map((f) => (f.id === id ? { ...f, status: newStatus as any } : f));
          localStorage.setItem('hidden_vault_local_feedbacks', JSON.stringify(updated));
        }
      }
    } catch (e) {}

    // Update Supabase
    try {
      const supabase = createClient();
      await supabase.from('feedbacks').update({ status: newStatus }).eq('id', id);
    } catch (e) {}

    setStatusMsg({ type: 'success', text: `Đã đổi trạng thái góp ý thành: ${newStatus === 'read' ? 'ĐÃ XEM' : 'CHƯA ĐỌC'}` });
  };

  const handleDeleteFeedback = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa góp ý này khỏi hệ thống không?')) return;
    
    // Update State
    setFeedbacks((prev) => prev.filter((f) => f.id !== id));

    // Update LocalStorage
    try {
      if (typeof window !== 'undefined') {
        const stored = localStorage.getItem('hidden_vault_local_feedbacks');
        if (stored) {
          const list: FeedbackItem[] = JSON.parse(stored);
          const updated = list.filter((f) => f.id !== id);
          localStorage.setItem('hidden_vault_local_feedbacks', JSON.stringify(updated));
        }
      }
    } catch (e) {}

    // Update Supabase
    try {
      const supabase = createClient();
      await supabase.from('feedbacks').delete().eq('id', id);
    } catch (e) {}

    setStatusMsg({ type: 'success', text: 'Đã xóa góp ý thành công.' });
  };

  const openCreateAlbumModal = () => {
    cancelEditAlbum();
    setIsAlbumModalOpen(true);
  };

  const startEditAlbum = (album: Album) => {
    setEditingAlbumId(album.id);
    setAlbumTitle(album.title);
    setAlbumArtist(album.artist);
    setAlbumYear(album.original_year);
    setCoverUrlInput(album.cover_url);
    setIsAlbumModalOpen(true);
  };

  const cancelEditAlbum = () => {
    setEditingAlbumId(null);
    setAlbumTitle('');
    setAlbumArtist('');
    setAlbumYear(new Date().getFullYear());
    setCoverFile(null);
    setCoverUrlInput('');
    setIsAlbumModalOpen(false);
  };

  // Create or Update Album Folder (100% SUPABASE ONLY)
  const handleSaveAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumTitle.trim() || !albumArtist.trim()) {
      setStatusMsg({ type: 'error', text: 'Vui lòng điền đầy đủ Tên Album và Nghệ sĩ.' });
      return;
    }

    setUploading(true);
    setStatusMsg(null);

    try {
      const supabase = createClient();
      let finalCoverUrl = coverUrlInput.trim();

      if (coverFile) {
        try {
          const fileExt = coverFile.name.split('.').pop();
          const fileName = `cover_${Date.now()}_${Math.random().toString(36).substring(7)}.${fileExt}`;
          const { data: storageData, error: storageErr } = await supabase.storage
            .from('cover-arts')
            .upload(fileName, coverFile, { upsert: true });

          if (!storageErr && storageData) {
            const { data: publicUrlData } = supabase.storage
              .from('cover-arts')
              .getPublicUrl(fileName);
            finalCoverUrl = publicUrlData.publicUrl;
          } else {
            finalCoverUrl = await fileToBase64(coverFile);
          }
        } catch {
          finalCoverUrl = await fileToBase64(coverFile);
        }
      }

      const albumData = {
        title: albumTitle.trim(),
        artist: albumArtist.trim(),
        original_year: Number(albumYear) || new Date().getFullYear(),
        ban_reason: '',
        cover_url: finalCoverUrl,
        is_published: true,
      };

      if (editingAlbumId && isUUID(editingAlbumId)) {
        const { error } = await supabase
          .from('albums')
          .update(albumData)
          .eq('id', editingAlbumId);

        if (error) throw new Error(`Lỗi cập nhật Album: ${error.message}`);
        setStatusMsg({ type: 'success', text: `Đã cập nhật Album "${albumTitle}" trên Supabase!` });
      } else {
        const { data, error } = await supabase.from('albums').insert([albumData]).select();
        if (error) throw new Error(`Lỗi tạo Album: ${error.message}`);
        if (data && data[0]) {
          setOpenedAlbumId(data[0].id);
        }
        setStatusMsg({ type: 'success', text: `Đã tạo Album "${albumTitle}" mới thành công! Hãy thêm nhạc hoặc MV vào album bên dưới.` });
      }

      cancelEditAlbum();
      await fetchSupabaseData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đã xảy ra lỗi khi lưu Album lên Supabase.';
      setStatusMsg({ type: 'error', text: msg });
    } finally {
      setUploading(false);
    }
  };

  const startEditTrack = (track: TrackItem) => {
    setEditingTrackId(track.id);
    setTrackTitle(track.title);
    setMediaType(track.media_type);
    setAudioUrlInput(track.audio_url || '');
    setVideoUrlInput(track.video_url || '');
    setMediaUrlInput(track.audio_url || track.video_url || '');
    setLyrics(track.lyrics || '');
    const offsetSecs = extractVideoOffset(track.lyrics || '');
    setVideoOffsetInput(offsetSecs > 0 ? formatOffsetString(offsetSecs) : '');
  };

  const cancelEditTrack = () => {
    setEditingTrackId(null);
    setTrackTitle('');
    setLyrics('');
    setVideoOffsetInput('');
    setAudioUrlInput('');
    setVideoUrlInput('');
    setMediaFile(null);
    setMediaUrlInput('');
    setAutoMetadata(null);
    setTrackDuration(200);
    setBatchTracks([]);
  };

  const handleSelectMediaFile = async (file: File | null) => {
    setMediaFile(file);
    if (!file) {
      setAutoMetadata(null);
      return;
    }

    try {
      const meta = await readMediaFileMetadata(file);
      setAutoMetadata(meta);
      if (!trackTitle.trim()) {
        setTrackTitle(meta.title);
      }
      if (meta.mediaCategory === 'video') {
        setMediaType('video');
      } else if (meta.mediaCategory === 'audio') {
        setMediaType('audio');
      }
      if (meta.duration > 0) {
        setTrackDuration(Math.round(meta.duration));
      }
    } catch (err) {
      console.error('Error auto reading metadata:', err);
    }
  };

  const handleMediaUrlInputChange = async (val: string) => {
    setMediaUrlInput(val);
  };

  // Helper to upload media file directly to Supabase Storage with automatic bucket resolution & creation
  const uploadTrackFileToStorage = async (
    supabase: ReturnType<typeof createClient>,
    file: File,
    type: MediaType,
    onStatus?: (msg: string) => void
  ): Promise<{ audioUrl: string; videoUrl: string }> => {
    const uploadFile = file;
    if (onStatus) onStatus(`⚡ Đang tải "${file.name}" (${(file.size / 1024 / 1024).toFixed(1)}MB) trực tiếp lên Supabase...`);

    const candidateBuckets = ['audio-files', 'audio'];
    let lastStorageErr: any = null;

    const rawExt = uploadFile.name.split('.').pop() || 'mp3';
    const fileName = `audio_${Date.now()}_${Math.random().toString(36).substring(7)}.${rawExt}`;

    let contentType = uploadFile.type;
    const cleanExt = rawExt.toLowerCase();
    if (!contentType || contentType === 'application/octet-stream') {
      if (cleanExt === 'flac') contentType = 'audio/flac';
      else if (cleanExt === 'wav') contentType = 'audio/wav';
      else if (cleanExt === 'm4a') contentType = 'audio/mp4';
      else contentType = 'audio/mpeg';
    }

    for (const bName of candidateBuckets) {
      try {
        // Attempt 1: Direct Upload
        let { data: storageData, error: storageErr } = await supabase.storage
          .from(bName)
          .upload(fileName, uploadFile, {
            upsert: true,
            contentType,
          });

        // If bucket not found, attempt auto-creating the bucket as public
        if (storageErr && (storageErr.message?.toLowerCase().includes('not found') || (storageErr as any).statusCode === '404')) {
          console.warn(`Bucket "${bName}" missing. Attempting auto creation...`);
          try {
            await supabase.storage.createBucket(bName, { public: true });
            const retryRes = await supabase.storage
              .from(bName)
              .upload(fileName, uploadFile, {
                upsert: true,
                contentType,
              });
            storageData = retryRes.data;
            storageErr = retryRes.error;
          } catch (createErr) {
            console.warn(`Failed to auto create bucket ${bName}:`, createErr);
          }
        }

        if (!storageErr && storageData) {
          const { data: publicUrlData } = supabase.storage
            .from(bName)
            .getPublicUrl(fileName);

          if (publicUrlData?.publicUrl) {
            return {
              audioUrl: type === 'audio' ? publicUrlData.publicUrl : '',
              videoUrl: type === 'video' ? publicUrlData.publicUrl : '',
            };
          }
        } else {
          lastStorageErr = storageErr;
        }
      } catch (err) {
        lastStorageErr = err;
      }
    }

    // If candidate buckets failed, throw clear actionable message
    console.error(`Supabase storage error [buckets: ${candidateBuckets.join('/')}]:`, lastStorageErr);
    const errMessage = lastStorageErr?.message || 'Bucket not found';
    throw new Error(
      `Lỗi Supabase Storage: Bucket "${candidateBuckets[0]}" chưa tồn tại trên Supabase. ` +
      `Vui lòng vào Supabase Dashboard > Storage > New Bucket > Tạo bucket tên "${candidateBuckets[0]}" (chế độ Public). ` +
      `(Mã lỗi gốc: ${errMessage})`
    );
  };

  // Resilient helpers to handle both 'audio_url' and 'url' column schemas in Supabase tracks table
  const safeInsertTrack = async (supabase: ReturnType<typeof createClient>, payload: Record<string, any>) => {
    let { error } = await supabase.from('tracks').insert([payload]);

    if (error && (error.message?.includes('audio_url') || (error as any).details?.includes('audio_url') || error.message?.includes('schema cache'))) {
      console.warn("audio_url column missing on tracks table, falling back to 'url' column...");
      const fallbackPayload = { ...payload };
      if ('audio_url' in fallbackPayload) {
        fallbackPayload.url = fallbackPayload.audio_url || fallbackPayload.video_url || '';
        delete fallbackPayload.audio_url;
      }
      const retry = await supabase.from('tracks').insert([fallbackPayload]);
      error = retry.error;
    }

    if (error) throw new Error(`Lỗi CSDL: ${error.message}`);
  };

  const safeUpdateTrack = async (supabase: ReturnType<typeof createClient>, trackId: string, payload: Record<string, any>) => {
    let { error } = await supabase.from('tracks').update(payload).eq('id', trackId);

    if (error && (error.message?.includes('audio_url') || (error as any).details?.includes('audio_url') || error.message?.includes('schema cache'))) {
      console.warn("audio_url column missing on tracks table, falling back to 'url' column...");
      const fallbackPayload = { ...payload };
      if ('audio_url' in fallbackPayload) {
        fallbackPayload.url = fallbackPayload.audio_url || fallbackPayload.video_url || '';
        delete fallbackPayload.audio_url;
      }
      const retry = await supabase.from('tracks').update(fallbackPayload).eq('id', trackId);
      error = retry.error;
    }

    if (error) throw new Error(`Lỗi CSDL: ${error.message}`);
  };

  // Batch upload multiple MP3/MP4 files directly to Supabase Storage & DB
  const handleBatchFileUpload = async (files: FileList | null, type: 'audio' | 'video') => {
    if (!files || files.length === 0 || !openedAlbumId || !isUUID(openedAlbumId)) {
      setStatusMsg({ type: 'error', text: 'Vui lòng chọn Album hợp lệ trước khi tải tệp lên!' });
      return;
    }

    setUploading(true);
    const fileList = Array.from(files).sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    setStatusMsg({ type: 'success', text: `⚡ Đang chuẩn bị tải lên ${fileList.length} tệp ${type.toUpperCase()}...` });

    try {
      const supabase = createClient();
      let successCount = 0;
      const currentAlbObj = albums.find((a) => a.id === openedAlbumId);

      for (let i = 0; i < fileList.length; i++) {
        const file = fileList[i];
        const cleanTitle = file.name.replace(/\.(mp3|wav|flac|m4a|mp4|webm|mkv)$/i, '').trim();

        setStatusMsg({
          type: 'success',
          text: `⚡ [${i + 1}/${fileList.length}] Đang tải tệp "${file.name}" lên Supabase Storage...`,
        });

        const urls = await uploadTrackFileToStorage(
          supabase,
          file,
          type,
          (msg) => setStatusMsg({ type: 'success', text: msg })
        );

        const finalAudioUrl = urls.audioUrl;
        const finalVideoUrl = urls.videoUrl;

        // Check if track with matching title already exists in album
        const matchingTrack = currentAlbObj?.tracks?.find((t) => isTitleMatching(t.title, cleanTitle));

        if (matchingTrack && (type === 'video' || finalVideoUrl)) {
          // Attach video_url to matching track
          await safeUpdateTrack(supabase, matchingTrack.id, { video_url: finalVideoUrl || finalAudioUrl });
          successCount++;
        } else if (matchingTrack && type === 'audio' && finalAudioUrl) {
          // Update audio_url of matching track
          await safeUpdateTrack(supabase, matchingTrack.id, { audio_url: finalAudioUrl });
          successCount++;
        } else {
          // Insert new track
          await safeInsertTrack(supabase, {
            album_id: openedAlbumId,
            title: cleanTitle,
            media_type: type,
            audio_url: type === 'audio' ? finalAudioUrl : '',
            video_url: type === 'video' ? finalVideoUrl : '',
            duration: 200,
          });
          successCount++;
        }
      }

      await fetchSupabaseData();
      setStatusMsg({
        type: 'success',
        text: `🎉 ĐÃ TẢI LÊN VÀ TẠO THÀNH CÔNG ${successCount} BÀI HÁT TỆP ${type.toUpperCase()} TRÊN SUPABASE!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Batch file upload error:', err);
      setStatusMsg({ type: 'error', text: `Lỗi tải lên tệp: ${msg}` });
    } finally {
      setUploading(false);
    }
  };

  // Add or Update Track / MV inside Currently Opened Album
  const handleSaveTrack = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!openedAlbumId) {
      setStatusMsg({ type: 'error', text: 'Vui lòng chọn một Album trước khi lưu bài hát!' });
      return;
    }

    if (!isUUID(openedAlbumId)) {
      setStatusMsg({
        type: 'error',
        text: 'Album hiện tại chưa có mã UUID hợp lệ trên Supabase.',
      });
      return;
    }

    setUploading(true);
    setStatusMsg(null);

    try {
      const supabase = createClient();
      const currentAlbumObj = albums.find((a) => a.id === openedAlbumId);
      const existingTrack = currentAlbumObj?.tracks?.find((t) => t.id === editingTrackId);

      let finalAudioUrl = audioUrlInput.trim() || existingTrack?.audio_url || '';
      let finalVideoUrl = videoUrlInput.trim() || existingTrack?.video_url || '';

      if (mediaFile) {
        const urls = await uploadTrackFileToStorage(
          supabase,
          mediaFile,
          mediaType,
          (msg) => setStatusMsg({ type: 'success', text: msg })
        );
        if (mediaType === 'video' || urls.videoUrl) finalVideoUrl = urls.videoUrl || urls.audioUrl;
        if (mediaType === 'audio' || urls.audioUrl) finalAudioUrl = urls.audioUrl;
      } else if (mediaUrlInput.trim()) {
        if (mediaType === 'video') finalVideoUrl = mediaUrlInput.trim();
        else finalAudioUrl = mediaUrlInput.trim();
      }

      let finalLyrics = lyrics.trim();
      if (videoOffsetInput.trim()) {
        finalLyrics = finalLyrics.replace(/^\[(video_offset|music_start):.*?\]\r?\n?/gim, '').trim();
        finalLyrics = `[video_offset:${videoOffsetInput.trim()}]\n` + finalLyrics;
      }

      const trackPayload: Record<string, any> = {
        album_id: openedAlbumId,
        title: trackTitle,
        media_type: finalVideoUrl ? 'video' : mediaType,
        audio_url: finalAudioUrl,
        video_url: finalVideoUrl,
        lyrics: finalLyrics || undefined,
        duration: trackDuration > 0 ? trackDuration : 200,
      };

      // Smart Auto-Matching: Check if an existing track in this album matches the core title
      const matchingTrack = currentAlbumObj?.tracks?.find((t) => isTitleMatching(t.title, trackTitle));

      if (!editingTrackId && matchingTrack && (mediaType === 'video' || finalVideoUrl)) {
        const updatePayload: Record<string, any> = {
          video_url: finalVideoUrl || mediaUrlInput || '',
        };
        if (lyrics) updatePayload.lyrics = lyrics;

        await safeUpdateTrack(supabase, matchingTrack.id, updatePayload);
        setStatusMsg({
          type: 'success',
          text: `⚡ Đã tự động nhận diện bài hát trùng tên "${matchingTrack.title}" -> Tích hợp MV Video vào bài hát thành công!`,
        });
      } else if (editingTrackId && isUUID(editingTrackId)) {
        await safeUpdateTrack(supabase, editingTrackId, trackPayload);
        setStatusMsg({ type: 'success', text: `Đã cập nhật bài hát "${trackTitle}" trên Supabase!` });
      } else {
        await safeInsertTrack(supabase, trackPayload);
        setStatusMsg({ type: 'success', text: `Đã thêm bài hát "${trackTitle}" vào Album thành công trên Supabase!` });
      }

      cancelEditTrack();
      await fetchSupabaseData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Đã xảy ra lỗi khi lưu bài hát lên Supabase.';
      setStatusMsg({ type: 'error', text: msg });
    } finally {
      setUploading(false);
    }
  };

  // Open Interactive Batch Link Modal for Video or Audio (Allows empty album)
  const openBatchLinkModal = (type: 'video' | 'audio') => {
    const currentAlb = albums.find((a) => a.id === openedAlbumId);
    if (!openedAlbumId || !currentAlb) {
      setStatusMsg({ type: 'error', text: 'Vui lòng chọn một Album!' });
      return;
    }

    const sortedTracks = currentAlb.tracks ? [...currentAlb.tracks].sort((a, b) =>
      a.title.localeCompare(b.title, undefined, { numeric: true, sensitivity: 'base' })
    ) : [];

    const initialMappings = sortedTracks.map((t) => ({
      id: t.id,
      title: t.title,
      url: type === 'video' ? (t.video_url || '') : (t.audio_url || ''),
      isNew: false,
    }));

    setBatchLinkTargetType(type);
    setBatchTrackMappings(initialMappings);
    setBatchVideoUrlsInput('');
    setIsBatchVideoModalOpen(true);
  };

  // Auto-distribute pasted links into track mappings (Fetches real file titles from Drive & creates tracks)
  const handleDistributePastedLinks = async () => {
    if (!batchVideoUrlsInput.trim()) return;

    const rawLinks = batchVideoUrlsInput
      .split(/[\n,\s]+/)
      .map((l) => l.trim())
      .filter((l) => l.startsWith('http://') || l.startsWith('https://'));

    if (rawLinks.length === 0) {
      setStatusMsg({ type: 'error', text: 'Không tìm thấy URL hợp lệ nào!' });
      return;
    }

    setSavingBatchVideos(true);
    setStatusMsg({ type: 'success', text: `⚡ Đang trích xuất tên tệp thực tế từ Google Drive cho ${rawLinks.length} đường dẫn...` });

    try {
      let fetchedTitleMap = new Map<string, string>();
      try {
        const res = await fetch('/api/gdrive-title', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ urls: rawLinks }),
        });
        if (res.ok) {
          const data = await res.json();
          if (Array.isArray(data.titles)) {
            data.titles.forEach((t: { url: string; title: string | null }) => {
              if (t.url && t.title) fetchedTitleMap.set(t.url, t.title);
            });
          }
        }
      } catch (e) {
        console.warn('GDrive title API fetch warning:', e);
      }

      setBatchTrackMappings((prev) => {
        const updated = [...prev];

        for (let i = 0; i < rawLinks.length; i++) {
          const link = rawLinks[i];
          const fetchedTitle = fetchedTitleMap.get(link);
          const numStr = i + 1 < 10 ? `0${i + 1}` : `${i + 1}`;
          const defaultTitle = `${numStr}. Track ${numStr}`;
          const finalTitle = fetchedTitle || defaultTitle;

          if (i < updated.length) {
            updated[i] = {
              ...updated[i],
              url: link,
              title: (updated[i].title && !updated[i].title.startsWith(`${numStr}. Track`)) ? updated[i].title : finalTitle,
            };
          } else {
            updated.push({
              id: `new_track_${Date.now()}_${i}`,
              title: finalTitle,
              url: link,
              isNew: true,
            });
          }
        }

        return updated;
      });

      setStatusMsg({
        type: 'success',
        text: `⚡ Đã trích xuất và phân bổ thành công ${rawLinks.length} bài hát với Tên từ Google Drive! Kiểm tra lại trước khi bấm "LƯU VÀO DATABASE".`,
      });
    } catch (err: unknown) {
      console.error('Error distributing links:', err);
    } finally {
      setSavingBatchVideos(false);
    }
  };

  // Save Interactive Track Mappings to Supabase (Handles both UPDATE existing & INSERT new tracks)
  const handleSaveBatchTrackMappings = async () => {
    if (batchTrackMappings.length === 0) return;

    setSavingBatchVideos(true);
    setStatusMsg({ type: 'success', text: `⚡ Đang lưu ${batchTrackMappings.length} bài hát vào Supabase...` });

    try {
      const supabase = createClient();
      let updatedCount = 0;

      for (let idx = 0; idx < batchTrackMappings.length; idx++) {
        const item = batchTrackMappings[idx];
        if (!item.url.trim() && !item.title.trim()) continue;

        if (item.isNew || !isUUID(item.id)) {
          // INSERT new track record into Supabase
          try {
            await safeInsertTrack(supabase, {
              album_id: openedAlbumId,
              title: item.title.trim() || `Track ${idx + 1}`,
              audio_url: batchLinkTargetType === 'audio' ? item.url.trim() : null,
              video_url: batchLinkTargetType === 'video' ? item.url.trim() : null,
              duration: 200,
              media_type: batchLinkTargetType === 'video' ? 'video' : 'audio',
            });
            updatedCount++;
          } catch (err) {
            console.error('Error inserting new track:', err);
          }
        } else {
          // UPDATE existing track record in Supabase
          const updateData = batchLinkTargetType === 'video'
            ? { title: item.title.trim(), video_url: item.url.trim() }
            : { title: item.title.trim(), audio_url: item.url.trim() };

          try {
            await safeUpdateTrack(supabase, item.id, updateData);
            updatedCount++;
          } catch (err) {
            console.error('Error updating track:', err);
          }
        }
      }

      await fetchSupabaseData();
      setIsBatchVideoModalOpen(false);
      setStatusMsg({
        type: 'success',
        text: `⚡ ĐÃ TẠO VÀ LƯU THÀNH CÔNG ${updatedCount} BÀI HÁT TRONG ALBUM TRÊN SUPABASE!`,
      });
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error('Batch link save error:', err);
      setStatusMsg({ type: 'error', text: `Lỗi lưu bài hát: ${msg}` });
    } finally {
      setSavingBatchVideos(false);
    }
  };

  // Select Single or Multiple Media Files (Batch Multi-file metadata reading)
  const handleSelectMediaFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0) return;

    const filesArray = Array.from(fileList);
    const lrcMap = new Map<string, string>();

    // Extract any .lrc or .txt lyrics files from batch
    const mediaFiles: File[] = [];
    for (const f of filesArray) {
      const ext = f.name.split('.').pop()?.toLowerCase() || '';
      if (ext === 'lrc' || ext === 'txt') {
        const baseName = f.name.replace(/\.[^/.]+$/, '').toLowerCase().trim();
        try {
          const content = await f.text();
          lrcMap.set(baseName, content);
        } catch (e) {
          console.warn('LRC read error:', e);
        }
      } else {
        mediaFiles.push(f);
      }
    }

    if (mediaFiles.length === 0 && lrcMap.size > 0) {
      const firstLrc = Array.from(lrcMap.values())[0];
      setLyrics(firstLrc);
      setStatusMsg({ type: 'success', text: '⚡ Đã đọc tệp lời bài hát .LRC thành công!' });
      return;
    }

    // Natural numerical sort: 01. Elegie, 02. IDK ... 30. Thịt Lợn
    mediaFiles.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' })
    );

    if (mediaFiles.length === 1) {
      setBatchTracks([]);
      await handleSelectMediaFile(mediaFiles[0]);
      const baseName = mediaFiles[0].name.replace(/\.[^/.]+$/, '').toLowerCase().trim();
      if (lrcMap.has(baseName)) {
        setLyrics(lrcMap.get(baseName)!);
      }
      return;
    }

    setReadingMetadata(true);
    setStatusMsg({ type: 'success', text: `⚡ Đang đọc metadata đồng thời cho ${mediaFiles.length} tệp...` });

    try {
      const items: BatchTrackItem[] = await Promise.all(
        mediaFiles.map(async (file, idx) => {
          let meta: MediaMetadata | null = null;
          let title = file.name.replace(/\.[^/.]+$/, '').replace(/_/g, ' ');
          let duration = 200;
          let category: MediaType = mediaType;
          let itemLyrics = '';

          const baseName = file.name.replace(/\.[^/.]+$/, '').toLowerCase().trim();
          if (lrcMap.has(baseName)) {
            itemLyrics = lrcMap.get(baseName)!;
          }

          try {
            meta = await readMediaFileMetadata(file);
            if (meta.title) title = meta.title;
            if (meta.duration > 0) duration = Math.round(meta.duration);
            if (meta.mediaCategory === 'video') category = 'video';
            else if (meta.mediaCategory === 'audio') category = 'audio';
          } catch (e) {
            console.warn('Metadata read error for file:', file.name, e);
          }

          return {
            id: `batch_${Date.now()}_${idx}_${Math.random().toString(36).substring(5)}`,
            file,
            title,
            duration,
            metadata: meta,
            status: 'pending',
            mediaType: category,
            lyrics: itemLyrics,
          };
        })
      );

      setBatchTracks(items);
      setStatusMsg({
        type: 'success',
        text: `⚡ Đã đọc metadata thành công cho ${items.length} tệp cùng lúc! Bạn có thể xem danh sách và bấm "ĐĂNG TẤT CẢ".`,
      });
    } catch (err) {
      console.error('Error batch reading metadata:', err);
    } finally {
      setReadingMetadata(false);
    }
  };

  const handleUpdateBatchTitle = (id: string, newTitle: string) => {
    setBatchTracks((prev) =>
      prev.map((item) => (item.id === id ? { ...item, title: newTitle } : item))
    );
  };

  const handleToggleBatchMediaType = (id: string) => {
    setBatchTracks((prev) =>
      prev.map((item) =>
        item.id === id
          ? { ...item, mediaType: item.mediaType === 'video' ? 'audio' : 'video' }
          : item
      )
    );
  };

  const handleRemoveBatchItem = (id: string) => {
    setBatchTracks((prev) => prev.filter((item) => item.id !== id));
  };

  const handleBatchSaveTracks = async () => {
    if (!openedAlbumId || batchTracks.length === 0) return;

    setUploading(true);
    setStatusMsg(null);
    let successCount = 0;
    let failCount = 0;

    const supabase = createClient();
    const updatedBatch = [...batchTracks];

    for (let i = 0; i < updatedBatch.length; i++) {
      const item = updatedBatch[i];
      item.status = 'uploading';
      setBatchTracks([...updatedBatch]);

      try {
        const uploadTask = uploadTrackFileToStorage(
          supabase,
          item.file,
          item.mediaType,
          (msg) => {
            setStatusMsg({
              type: 'success',
              text: `⚡ [Tệp ${i + 1}/${updatedBatch.length}] "${item.title}": ${msg}`,
            });
          }
        );

        // 60-second safety timeout per batch item so queue never gets stuck
        const timeoutPromise = new Promise((_, reject) =>
          setTimeout(() => reject(new Error('Chờ tải quá 60s. Tự động chuyển tệp kế tiếp.')), 60000)
        );

        const urls = (await Promise.race([uploadTask, timeoutPromise])) as { audioUrl: string; videoUrl: string };

        const trackPayload = {
          album_id: openedAlbumId,
          title: item.title,
          media_type: item.mediaType,
          audio_url: urls.audioUrl,
          video_url: urls.videoUrl,
          duration: item.duration > 0 ? item.duration : 200,
          lyrics: item.lyrics || '',
        };

        // Smart Title Auto-Matching for batch items
        const currentAlbumObj = albums.find((a) => a.id === openedAlbumId);
        const matchingTrack = currentAlbumObj?.tracks?.find((t) => isTitleMatching(t.title, item.title));

        if (matchingTrack && (item.mediaType === 'video' || urls.videoUrl)) {
          const updatePayload: Record<string, any> = {
            video_url: urls.videoUrl || urls.audioUrl,
          };
          if (item.lyrics) updatePayload.lyrics = item.lyrics;
          await safeUpdateTrack(supabase, matchingTrack.id, updatePayload);
        } else {
          await safeInsertTrack(supabase, trackPayload);
        }

        item.status = 'completed';
        successCount++;
      } catch (err: unknown) {
        const msg = err instanceof Error ? err.message : 'Lỗi tải tệp lên Supabase';
        console.error(`Batch upload error for ${item.title}:`, err);
        item.status = 'error';
        item.errorMsg = msg;
        failCount++;
      }
      setBatchTracks([...updatedBatch]);
    }

    setUploading(false);
    await fetchSupabaseData();

    if (failCount === 0) {
      setStatusMsg({
        type: 'success',
        text: `✅ Đã tải lên và thêm thành công toàn bộ ${successCount} bài hát vào Album!`,
      });
      setBatchTracks([]);
    } else {
      setStatusMsg({
        type: 'error',
        text: `Hoàn tất tải lên: ${successCount} bài thành công, ${failCount} bài bị lỗi.`,
      });
    }
  };

  const handleBatchUploadLrcFiles = async (fileList: FileList | null) => {
    if (!fileList || fileList.length === 0 || !activeAlbum || !activeAlbum.tracks) return;

    const lrcFiles = Array.from(fileList);
    setStatusMsg({ type: 'success', text: `⚡ Đang đọc và tự động ghép ${lrcFiles.length} file .LRC vào Album...` });

    try {
      const supabase = createClient();
      let matchedCount = 0;
      const updatedTracks = [...activeAlbum.tracks];

      for (const file of lrcFiles) {
        const content = await file.text();
        const cleanFileName = file.name
          .replace(/\.[^/.]+$/, '')
          .toLowerCase()
          .replace(/\(.*?\)/g, '')
          .replace(/\[.*?\]/g, '')
          .replace(/_/g, ' ')
          .trim();

        const matchedTrack = updatedTracks.find((t) => {
          const cleanTrackTitle = t.title
            .toLowerCase()
            .replace(/\(.*?\)/g, '')
            .replace(/\[.*?\]/g, '')
            .replace(/_/g, ' ')
            .trim();

          const bareTitle = cleanTrackTitle.replace(/^\d+[\.\s-]*/, '').trim();
          const bareFileName = cleanFileName.replace(/^\d+[\.\s-]*/, '').trim();

          return (
            cleanTrackTitle === cleanFileName ||
            bareTitle === bareFileName ||
            cleanTrackTitle.includes(cleanFileName) ||
            cleanFileName.includes(cleanTrackTitle)
          );
        });

        if (matchedTrack) {
          matchedTrack.lyrics = content;
          matchedCount++;
          await supabase
            .from('tracks')
            .update({ lyrics: content })
            .eq('id', matchedTrack.id);
        }
      }

      setAlbums((prev) =>
        prev.map((a) => (a.id === activeAlbum.id ? { ...a, tracks: updatedTracks } : a))
      );

      if (matchedCount > 0) {
        setStatusMsg({
          type: 'success',
          text: `✅ Đã ghép và lưu thành công Lời bài hát (.LRC) cho ${matchedCount}/${lrcFiles.length} tệp vào Album!`,
        });
      } else {
        setStatusMsg({
          type: 'error',
          text: `⚠️ Không tìm thấy tên bài hát nào trùng khớp với ${lrcFiles.length} tệp .LRC đã chọn. Hãy kiểm tra tên tệp .LRC.`,
        });
      }
    } catch (err) {
      console.error('Error batch uploading LRC files:', err);
      setStatusMsg({ type: 'error', text: 'Lỗi khi lưu tệp .LRC vào Supabase.' });
    }
  };

  const handleDragStart = (e: React.DragEvent, index: number) => {
    setDraggedTrackIdx(index);
    e.dataTransfer.effectAllowed = 'move';
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = 'move';
  };

  const handleDropTrack = async (e: React.DragEvent, targetIndex: number) => {
    e.preventDefault();
    if (draggedTrackIdx === null || draggedTrackIdx === targetIndex || !activeAlbum || !activeAlbum.tracks) return;

    const tracks = [...activeAlbum.tracks];
    const [draggedTrack] = tracks.splice(draggedTrackIdx, 1);
    tracks.splice(targetIndex, 0, draggedTrack);
    setDraggedTrackIdx(null);

    setAlbums((prev) =>
      prev.map((a) => (a.id === activeAlbum.id ? { ...a, tracks } : a))
    );

    try {
      const supabase = createClient();
      const baseTime = new Date('2026-01-01T00:00:00Z').getTime();
      for (let i = 0; i < tracks.length; i++) {
        const newCreatedAt = new Date(baseTime + i * 60000).toISOString();
        await supabase.from('tracks').update({ created_at: newCreatedAt }).eq('id', tracks[i].id);
      }
    } catch (err) {
      console.error('Error persisting drag and drop track order:', err);
    }
  };

  const handleDeleteAlbum = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa Album này và tất cả bài hát bên trong khỏi Supabase không?')) return;
    try {
      const supabase = createClient();
      if (isUUID(id)) {
        const { error } = await supabase.from('albums').delete().eq('id', id);
        if (error) throw error;
      }
      setStatusMsg({ type: 'success', text: 'Đã xóa Album khỏi Supabase.' });
      if (openedAlbumId === id) {
        setOpenedAlbumId(null);
      }
      await fetchSupabaseData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể xóa Album.';
      setStatusMsg({ type: 'error', text: msg });
    }
  };

  const handleDeleteTrack = async (trackId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bài hát/MV này khỏi Supabase không?')) return;
    try {
      const supabase = createClient();
      if (isUUID(trackId)) {
        const { error } = await supabase.from('tracks').delete().eq('id', trackId);
        if (error) throw error;
      }
      setStatusMsg({ type: 'success', text: 'Đã xóa bài hát khỏi Supabase.' });
      await fetchSupabaseData();
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'Không thể xóa bài hát.';
      setStatusMsg({ type: 'error', text: msg });
    }
  };

  const activeAlbum = albums.find((a) => a.id === openedAlbumId);
  const unreadFeedbacksCount = feedbacks.filter((f) => f.status === 'unread' || !f.status).length;
  const filteredFeedbacks = feedbacks.filter((fb) => {
    if (feedbackFilter === 'unread') return fb.status === 'unread' || !fb.status;
    if (feedbackFilter === 'read') return fb.status === 'read' || fb.status === 'resolved';
    return true;
  });

  return (
    <main className="min-h-screen bg-black text-white p-4 md:p-8 pb-36 sm:pb-40 font-cyber relative">
      <div className="tv-grain-overlay" />

      {/* Top Header Navigation */}
      <div className="max-w-6xl mx-auto flex flex-col md:flex-row md:items-center justify-between gap-4 mb-8 pb-4 border-b border-white/20 relative z-10">
        <div className="flex items-center gap-3">
          <Link
            href="/"
            className="p-2 rounded-xl bg-slate-900 border border-slate-700 hover:border-white text-slate-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="w-5 h-5" />
          </Link>
          <div>
            <h1 className="text-xl md:text-2xl font-extrabold text-white uppercase tracking-widest font-mono flex items-center gap-2">
              SECURE ADMIN PORTAL
              <span className="px-2 py-0.5 rounded-full text-[9px] font-extrabold bg-white text-black">MASTER</span>
            </h1>
            <p className="text-xs text-slate-400 font-mono">
              {adminTab === 'feedbacks'
                ? `Hộp thư góp ý & Báo lỗi từ thành viên Vault`
                : openedAlbumId && activeAlbum
                ? `Browsing Album Archive: ${activeAlbum.title}`
                : `Supabase Encrypted Albums List`}
            </p>
          </div>
        </div>

        {/* Top Header Mode Tabs & Actions */}
        <div className="flex items-center gap-2 flex-wrap">
          <div className="flex items-center gap-1 p-1 rounded-2xl bg-slate-900 border border-white/20">
            <button
              onClick={() => {
                setAdminTab('albums');
                setStatusMsg(null);
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                adminTab === 'albums'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <Disc3 className="w-3.5 h-3.5" />
              <span>KHO ALBUM ({albums.length})</span>
            </button>

            <button
              onClick={() => {
                setAdminTab('feedbacks');
                setStatusMsg(null);
                fetchFeedbacks();
              }}
              className={`px-3 py-1.5 rounded-xl text-xs font-bold font-mono uppercase tracking-wider flex items-center gap-1.5 transition-all relative ${
                adminTab === 'feedbacks'
                  ? 'bg-white text-black shadow-md'
                  : 'text-slate-400 hover:text-white'
              }`}
            >
              <MessageSquare className="w-3.5 h-3.5" />
              <span>HỘP THƯ GÓP Ý</span>
              {unreadFeedbacksCount > 0 && (
                <span className="px-1.5 py-0.2 rounded-full text-[9px] font-extrabold bg-red-600 text-white animate-pulse">
                  {unreadFeedbacksCount}
                </span>
              )}
            </button>
          </div>

          {/* Global Action: Create New Album (Only in albums tab) */}
          {adminTab === 'albums' && !openedAlbumId && (
            <button
              onClick={openCreateAlbumModal}
              className="px-3.5 py-2 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider shadow-lg hover:bg-slate-200 transition-all flex items-center gap-1.5 font-mono"
            >
              <FolderPlus className="w-4 h-4" />
              <span>+ NEW ALBUM</span>
            </button>
          )}

          {adminTab === 'feedbacks' && (
            <button
              onClick={fetchFeedbacks}
              className="p-2 rounded-xl bg-white/10 hover:bg-white text-slate-300 hover:text-black border border-white/20 transition-all"
              title="Làm mới hộp thư"
            >
              <RefreshCw className={`w-4 h-4 ${feedbacksLoading ? 'animate-spin' : ''}`} />
            </button>
          )}
        </div>
      </div>

      {statusMsg && (
        <div className="max-w-6xl mx-auto mb-6 relative z-10">
          <div
            className={`p-4 rounded-xl text-xs flex items-center gap-2 font-mono ${
              statusMsg.type === 'success'
                ? 'bg-white/15 border border-white/40 text-white'
                : 'bg-red-950/50 border border-red-500/40 text-red-300'
            }`}
          >
            {statusMsg.type === 'success' ? <CheckCircle className="w-4 h-4 flex-shrink-0" /> : <AlertCircle className="w-4 h-4 flex-shrink-0" />}
            <span>{statusMsg.text}</span>
          </div>
        </div>
      )}

      {/* ========================================================================= */}
      {/* VIEW 1 & 2: ALBUMS MANAGEMENT TAB                                         */}
      {/* ========================================================================= */}
      {adminTab === 'albums' && (
        <>
          {/* VIEW 1: ALBUM LIST (OUTSIDE VIEW) */}
          {!openedAlbumId && (
          <div className="max-w-6xl mx-auto relative z-10 space-y-6 font-mono">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2">
                <Disc3 className="w-4 h-4 text-white" />
                VAULT ALBUM ARCHIVE ({albums.length})
              </h3>
            </div>

            {loading ? (
              <div className="text-center py-16 text-xs text-slate-500">Loading albums from Supabase...</div>
            ) : albums.length === 0 ? (
              <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-white/10 p-8 space-y-4">
                <p className="text-xs text-slate-400">No albums in vault. Click "CREATE NEW ALBUM" to get started!</p>
                <button
                  onClick={openCreateAlbumModal}
                  className="px-5 py-3 rounded-xl bg-white text-black font-extrabold text-xs uppercase shadow-xl hover:bg-slate-200 transition-all inline-flex items-center gap-2"
                >
                  <FolderPlus className="w-4 h-4" />
                  <span>+ CREATE FIRST ALBUM</span>
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {albums.map((alb) => (
                  <div
                    key={alb.id}
                    className="bw-panel rounded-3xl p-5 border border-white/20 shadow-xl flex flex-col justify-between group hover:border-white transition-all relative overflow-hidden"
                  >
                    <div className="space-y-4">
                      <div className="relative aspect-square rounded-2xl overflow-hidden border border-white/20 bg-black">
                        <img
                          src={alb.cover_url || '/placeholder.jpg'}
                          alt={alb.title}
                          className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
                        />
                        <div className="absolute top-2 right-2 px-2 py-0.5 rounded bg-black/80 border border-white/20 text-[9px] text-white uppercase font-bold">
                          {alb.tracks?.length || 0} tracks
                        </div>
                      </div>

                      <div>
                        <h4 className="font-extrabold text-white text-lg uppercase truncate">{alb.title}</h4>
                        <p className="text-xs text-slate-400 truncate">{alb.artist} ({alb.original_year})</p>
                      </div>
                    </div>

                    <div className="pt-4 mt-4 border-t border-white/10 flex items-center justify-between gap-2">
                      <button
                        onClick={() => setOpenedAlbumId(alb.id)}
                        className="flex-1 py-2 px-3 rounded-xl bg-white text-black font-extrabold text-xs uppercase hover:bg-slate-200 transition-all flex items-center justify-center gap-1.5 shadow-md"
                      >
                        <FolderOpen className="w-4 h-4" />
                        <span>OPEN & EDIT TRACKS</span>
                      </button>

                      <button
                        onClick={() => startEditAlbum(alb)}
                        className="p-2 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 transition-colors"
                        title="Edit Album"
                      >
                        <Edit className="w-4 h-4" />
                      </button>

                      <button
                        onClick={() => handleDeleteAlbum(alb.id)}
                        className="p-2 rounded-xl bg-red-950/60 hover:bg-red-900 text-red-400 transition-colors"
                        title="Delete Album"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}

        {/* VIEW 2: INSIDE SPECIFIC ALBUM (ADD & MANAGE TRACKS) */}
        {openedAlbumId && activeAlbum && (
          <div className="max-w-6xl mx-auto relative z-10 space-y-6 font-mono">
            {/* Back to Albums Bar & Album Summary */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-4 rounded-2xl bg-slate-900/90 border border-white/20">
              <div className="flex items-center gap-4">
                <button
                  onClick={() => {
                    setOpenedAlbumId(null);
                    cancelEditTrack();
                  }}
                  className="px-3 py-2 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 text-xs font-bold transition-all flex items-center gap-1.5 uppercase"
                >
                  <ArrowLeft className="w-4 h-4" />
                  <span>BACK TO ALBUMS</span>
                </button>

                <div className="flex items-center gap-3">
                  <img
                    src={activeAlbum.cover_url || '/placeholder.jpg'}
                    alt={activeAlbum.title}
                    className="w-10 h-10 rounded-lg object-cover border border-slate-700"
                  />
                  <div>
                    <h2 className="text-base font-extrabold text-white uppercase">{activeAlbum.title}</h2>
                    <p className="text-[11px] text-slate-400">{activeAlbum.artist} ({activeAlbum.original_year}) • {activeAlbum.tracks?.length || 0} tracks</p>
                  </div>
                </div>
              </div>

              <button
                onClick={() => startEditAlbum(activeAlbum)}
                className="px-3 py-1.5 rounded-lg bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 text-xs font-bold transition-all flex items-center gap-1 self-start md:self-auto uppercase"
              >
                <Edit className="w-3.5 h-3.5" />
                <span>EDIT ALBUM INFO</span>
              </button>
            </div>

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Left 5 Cols: Form Add / Edit Track or Batch Queue */}
            <div className="lg:col-span-5 bw-panel rounded-3xl p-6 border border-white/20 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-2">
                <span className="text-[11px] uppercase tracking-widest text-slate-300 font-extrabold block">
                  {batchTracks.length > 0
                    ? `⚡ BẠN ĐÃ CHỌN ${batchTracks.length} BÀI HÁT HÀNG LOẠT`
                    : editingTrackId
                    ? '✏️ CHỈNH SỬA BÀI HÁT'
                    : '🎵 THÊM BÀI HÁT HOẶC VIDEO MV'}
                </span>
                {(editingTrackId || batchTracks.length > 0) && (
                  <button
                    type="button"
                    onClick={cancelEditTrack}
                    className="text-[10px] text-red-400 hover:underline flex items-center gap-1"
                  >
                    <X className="w-3 h-3" /> Hủy sửa
                  </button>
                )}
              </div>

              {batchTracks.length > 0 ? (
                <div className="space-y-4 text-xs font-mono">
                  <div className="flex items-center justify-between p-3 rounded-2xl bg-white/10 border border-white/30">
                    <span className="font-extrabold text-white text-xs uppercase flex items-center gap-1.5">
                      <ListPlus className="w-4 h-4 text-white" />
                      TỰ ĐỘNG ĐỌC METADATA ({batchTracks.length} BÀI)
                    </span>
                    <button
                      type="button"
                      onClick={() => setBatchTracks([])}
                      className="text-[10px] text-red-400 hover:underline flex items-center gap-1"
                    >
                      <X className="w-3.5 h-3.5" /> Hủy danh sách
                    </button>
                  </div>

                  <div className="space-y-2 max-h-[360px] overflow-y-auto pr-1">
                    {batchTracks.map((item, index) => (
                      <div
                        key={item.id}
                        className="p-3 bg-black rounded-xl border border-white/20 space-y-2 relative"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="text-[10px] text-slate-400 font-bold">#{index + 1}</span>
                          <input
                            type="text"
                            value={item.title}
                            onChange={(e) => handleUpdateBatchTitle(item.id, e.target.value)}
                            className="flex-1 bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-1 text-white text-xs focus:outline-none focus:border-white"
                            placeholder="Tên bài hát..."
                          />
                          <button
                            type="button"
                            onClick={() => handleRemoveBatchItem(item.id)}
                            className="p-1 text-slate-500 hover:text-red-400"
                            title="Xóa tệp này"
                          >
                            <X className="w-4 h-4" />
                          </button>
                        </div>

                        <div className="flex items-center justify-between text-[10px] text-slate-400 font-mono">
                          <span>
                            {item.file.name} ({(item.file.size / 1024 / 1024).toFixed(1)}MB)
                          </span>
                          <span className="flex items-center gap-1 uppercase">
                            {item.status === 'pending' && <span className="text-slate-400">Sẵn sàng</span>}
                            {item.status === 'uploading' && (
                              <span className="text-yellow-400 flex items-center gap-1 animate-pulse">
                                <Loader2 className="w-3 h-3 animate-spin" /> Đang tải...
                              </span>
                            )}
                            {item.status === 'completed' && (
                              <span className="text-emerald-400 flex items-center gap-1 font-bold">
                                <Check className="w-3 h-3 text-emerald-400" /> Đã xong
                              </span>
                            )}
                            {item.status === 'error' && (
                              <span className="text-red-400 font-bold" title={item.errorMsg}>
                                ❌ Lỗi tải tệp
                              </span>
                            )}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>

                  <button
                    type="button"
                    onClick={handleBatchSaveTracks}
                    disabled={uploading || readingMetadata}
                    className="w-full py-4 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider shadow-xl hover:bg-slate-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <span className="animate-pulse flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> ĐANG TẢI {batchTracks.length} BÀI HÁT LÊN...
                      </span>
                    ) : (
                      <>
                        <UploadCloud className="w-4 h-4" />
                        <span>THÊM TẤT CẢ {batchTracks.length} BÀI HÁT VÀO ALBUM</span>
                      </>
                    )}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveTrack} className="space-y-4 text-xs font-mono">
                  <div>
                    <label className="block text-slate-400 uppercase mb-1">Tên bài hát *</label>
                    <input
                      type="text"
                      required
                      placeholder="vd: 01. Elegie (Unreleased)"
                      value={trackTitle}
                      onChange={(e) => setTrackTitle(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-white"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-black border border-white/20 space-y-3">
                    <label className="block text-white font-bold flex items-center gap-1.5 uppercase text-xs">
                      <FileAudio className="w-4 h-4 text-emerald-400" /> TỆP ÂM THANH / URL AUDIO (.MP3 / .FLAC)
                    </label>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.flac,.m4a,.aac,.ogg,.wma,.opus"
                      multiple
                      onChange={(e) => handleSelectMediaFiles(e.target.files)}
                      className="w-full text-slate-400 text-xs file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white file:text-black cursor-pointer"
                    />
                    <input
                      type="url"
                      placeholder="URL Audio MP3 từ Supabase..."
                      value={audioUrlInput || mediaUrlInput}
                      onChange={(e) => {
                        setAudioUrlInput(e.target.value);
                        setMediaUrlInput(e.target.value);
                      }}
                      className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-white font-mono"
                    />
                  </div>

                  <div className="p-4 rounded-2xl bg-black border border-cyan-500/30 space-y-2 font-mono">
                    <label className="block text-cyan-300 font-bold flex items-center gap-1.5 uppercase text-xs">
                      <Film className="w-4 h-4 text-cyan-400" /> TỆP VIDEO / URL MV (.MP4 TỪ SUPABASE)
                    </label>
                    <input
                      type="url"
                      placeholder="URL Video MP4 (Supabase Storage)..."
                      value={videoUrlInput}
                      onChange={(e) => setVideoUrlInput(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-lg px-2.5 py-2 text-cyan-200 text-xs placeholder-slate-600 focus:outline-none focus:border-cyan-400 font-mono"
                    />
                  </div>

                  {autoMetadata && (
                    <div className="p-3 bg-slate-900/90 border border-slate-700 rounded-xl space-y-1 text-[11px]">
                      <div className="flex items-center justify-between text-white font-bold">
                        <span className="flex items-center gap-1"><Zap className="w-3.5 h-3.5 text-white" /> Metadata Đã Đọc:</span>
                        <span className="text-[10px] text-slate-400">{autoMetadata.format} ({autoMetadata.fileSizeFormatted})</span>
                      </div>
                      <div className="text-slate-300">
                        Thời lượng: <strong className="text-white">{autoMetadata.durationFormatted}</strong>
                        {autoMetadata.resolution && <> | Độ phân giải: <strong className="text-white">{autoMetadata.resolution}</strong></>}
                        {autoMetadata.bitrateKbps && <> | Bitrate: <strong className="text-white">~{autoMetadata.bitrateKbps} kbps</strong></>}
                      </div>
                    </div>
                  )}

                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <label className="block text-slate-400 uppercase">Lời bài hát (Lyrics / Tệp .LRC)</label>
                      <label className="text-[10px] text-emerald-400 hover:underline cursor-pointer flex items-center gap-1 font-bold">
                        <UploadCloud className="w-3 h-3" /> TẢI FILE .LRC
                        <input
                          type="file"
                          accept=".lrc,.txt"
                          className="hidden"
                          onChange={async (e) => {
                            const lrcFile = e.target.files?.[0];
                            if (lrcFile) {
                              const text = await lrcFile.text();
                              setLyrics(text);
                            }
                          }}
                        />
                      </label>
                    </div>
                    <textarea
                      rows={4}
                      placeholder="Dán hoặc tải file .LRC (vd: [00:16.63]Ah-ah-ah-ah...)..."
                      value={lyrics}
                      onChange={(e) => setLyrics(e.target.value)}
                      className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2 text-white placeholder-slate-500 focus:outline-none focus:border-white font-mono text-[11px]"
                    />
                  </div>

                  {/* Video Intro / Music Start Time Offset Input */}
                  <div className="p-3 bg-amber-950/30 border border-amber-500/30 rounded-xl space-y-1.5 font-mono">
                    <label className="block text-amber-300 font-bold uppercase text-[11px] flex items-center justify-between">
                      <span className="flex items-center gap-1.5">
                        <Film className="w-3.5 h-3.5 text-amber-400" /> MỐC BẮT ĐẦU NHẠC TRONG MV (OFFSET)
                      </span>
                    </label>
                    <input
                      type="text"
                      placeholder="vd: 01:30 hoặc 90 (để trống nếu bài nhạc bắt đầu từ 0:00)"
                      value={videoOffsetInput}
                      onChange={(e) => setVideoOffsetInput(e.target.value)}
                      className="w-full bg-slate-950 border border-amber-500/40 rounded-lg px-3 py-2 text-amber-200 placeholder-slate-600 focus:outline-none focus:border-amber-400 text-xs"
                    />
                    <p className="text-[10px] text-slate-400 leading-tight">
                      💡 <em>Nếu video MV có đoạn hội thoại / Intro dài trước khi vào nhạc, nhập mốc thời gian nhạc cất lên (vd: <code>01:30</code>) để Lời bài hát tự động đồng bộ chính xác 100%.</em>
                    </p>
                  </div>

                  <button
                    type="submit"
                    disabled={uploading || readingMetadata}
                    className="w-full py-4 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider shadow-xl hover:bg-slate-200 transition-all disabled:opacity-50 flex items-center justify-center gap-2"
                  >
                    {uploading ? (
                      <span className="animate-pulse flex items-center gap-2">
                        <Loader2 className="w-4 h-4 animate-spin" /> ĐANG LƯU LÊN SUPABASE...
                      </span>
                    ) : (
                      <>
                        <Save className="w-4 h-4" />
                        <span>{editingTrackId ? 'LƯU CHỈNH SỬA BÀI HÁT' : 'THÊM BÀI HÁT VÀO ALBUM NÀY'}</span>
                      </>
                    )}
                  </button>
                </form>
              )}
            </div>

            {/* Right 7 Cols: Tracks inside this Album */}
            <div className="lg:col-span-7 bw-panel rounded-3xl p-6 border border-white/20 space-y-4">
              <div className="flex items-center justify-between border-b border-white/10 pb-3 gap-2 flex-wrap">
                <h3 className="text-sm font-bold text-white uppercase flex items-center gap-2 font-mono">
                  <Disc3 className="w-4 h-4 text-white" />
                  BÀI HÁT TRONG ALBUM ({activeAlbum.tracks?.length || 0})
                </h3>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="px-3 py-1.5 rounded-xl bg-emerald-950/90 hover:bg-emerald-900 text-emerald-300 font-extrabold text-[10px] uppercase border border-emerald-400/50 cursor-pointer flex items-center gap-1.5 transition-all shadow-lg">
                    <UploadCloud className="w-3.5 h-3.5 text-emerald-400" />
                    <span>📤 TẢI NHẠC .MP3 HÀNG LOẠT</span>
                    <input
                      type="file"
                      accept="audio/*,.mp3,.wav,.flac,.m4a"
                      multiple
                      className="hidden"
                      onChange={(e) => handleBatchFileUpload(e.target.files, 'audio')}
                    />
                  </label>

                  <label className="px-3 py-1.5 rounded-xl bg-cyan-950/90 hover:bg-cyan-900 text-cyan-300 font-extrabold text-[10px] uppercase border border-cyan-400/50 cursor-pointer flex items-center gap-1.5 transition-all shadow-lg">
                    <Film className="w-3.5 h-3.5 text-cyan-400" />
                    <span>🎬 TẢI VIDEO .MP4 HÀNG LOẠT</span>
                    <input
                      type="file"
                      accept="video/*,.mp4,.webm"
                      multiple
                      className="hidden"
                      onChange={(e) => handleBatchFileUpload(e.target.files, 'video')}
                    />
                  </label>

                  <label className="px-3 py-1.5 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-300 font-extrabold text-[10px] uppercase border border-white/20 cursor-pointer flex items-center gap-1.5 transition-all shadow-lg">
                    <UploadCloud className="w-3.5 h-3.5" />
                    <span>FILE .LRC</span>
                    <input
                      type="file"
                      accept=".lrc,.txt"
                      multiple
                      className="hidden"
                      onChange={(e) => handleBatchUploadLrcFiles(e.target.files)}
                    />
                  </label>
                </div>
              </div>

              {(!activeAlbum.tracks || activeAlbum.tracks.length === 0) ? (
                <div className="text-center py-16 text-xs text-slate-500">
                  Album này chưa có bài hát/MV nào. Hãy điền form bên trái để thêm bài hát đầu tiên!
                </div>
              ) : (
                <div className="space-y-3 font-mono text-xs">
                  {activeAlbum.tracks.map((t, idx) => (
                    <div
                      key={t.id}
                      draggable
                      onDragStart={(e) => handleDragStart(e, idx)}
                      onDragOver={handleDragOver}
                      onDrop={(e) => handleDropTrack(e, idx)}
                      className={`p-3.5 rounded-2xl bg-black border flex items-center justify-between gap-3 transition-all cursor-grab active:cursor-grabbing ${
                        draggedTrackIdx === idx ? 'opacity-30 border-dashed border-emerald-400 scale-95' : 'border-white/20 hover:border-white'
                      }`}
                    >
                      <div className="flex items-center gap-3">
                        <span title="Nắm kéo để sắp xếp vị trí" className="flex-shrink-0 cursor-grab active:cursor-grabbing">
                          <GripVertical className="w-4 h-4 text-slate-500 hover:text-white" />
                        </span>
                        <div className="p-2.5 rounded-xl border bg-emerald-950/80 text-emerald-400 border-emerald-500/40">
                          <Music className="w-4 h-4" />
                        </div>
                        <div>
                          <h4 className="font-extrabold text-white text-sm">{t.title}</h4>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <span className="text-[9px] uppercase px-2 py-0.2 rounded font-bold bg-emerald-950/80 text-emerald-400 border border-emerald-500/40 flex items-center gap-1">
                              <Music className="w-2.5 h-2.5" /> AUDIO
                            </span>
                            {t.video_url && (
                              <span className="text-[9px] uppercase px-2 py-0.2 rounded font-bold bg-cyan-950/80 text-cyan-300 border border-cyan-400/50 flex items-center gap-1">
                                <Film className="w-2.5 h-2.5" /> MV VIDEO
                              </span>
                            )}
                            {t.lyrics ? (
                              <span className="text-[9px] uppercase px-2 py-0.2 rounded font-bold bg-white/10 text-white border border-white/20">
                                📜 CÓ LRC
                              </span>
                            ) : (
                              <span className="text-[9px] uppercase px-2 py-0.2 rounded font-bold bg-slate-900 text-slate-500 border border-slate-800">
                                📜 CHƯA CÓ LRC
                              </span>
                            )}
                            {t.lyrics && extractVideoOffset(t.lyrics) > 0 && (
                              <span className="text-[9px] uppercase px-2 py-0.2 rounded font-bold bg-amber-950/80 text-amber-300 border border-amber-500/40">
                                🎬 MV BẮT ĐẦU: {formatOffsetString(extractVideoOffset(t.lyrics))}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => startEditTrack(t)}
                          className="px-2.5 py-1.5 rounded-lg bg-white/10 hover:bg-white text-white hover:text-black font-extrabold text-[10px] uppercase transition-all flex items-center gap-1 border border-white/20"
                          title="Sửa bài hát"
                        >
                          <Edit className="w-3 h-3" /> Sửa
                        </button>
                        <button
                          onClick={() => handleDeleteTrack(t.id)}
                          className="p-1.5 rounded-lg bg-red-950/60 hover:bg-red-900 text-red-400 transition-colors"
                          title="Xóa bài hát"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </>
  )}

      {/* ========================================================================= */}
      {/* VIEW 3: USER FEEDBACKS & SUGGESTIONS INBOX                                */}
      {/* ========================================================================= */}
      {adminTab === 'feedbacks' && (
        <div className="max-w-6xl mx-auto relative z-10 space-y-6 font-mono">
          {/* Header & Filter Controls */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-white/10 pb-4">
            <div className="flex items-center gap-2">
              <MessageSquare className="w-5 h-5 text-white" />
              <h3 className="text-sm font-bold text-white uppercase">
                DANH SÁCH Ý KIẾN ĐÓNG GÓP ({feedbacks.length})
              </h3>
            </div>

            {/* Filter Buttons */}
            <div className="flex items-center gap-1.5">
              {(['all', 'unread', 'read'] as const).map((filterType) => (
                <button
                  key={filterType}
                  onClick={() => setFeedbackFilter(filterType)}
                  className={`px-3 py-1 rounded-xl text-xs font-bold uppercase transition-all ${
                    feedbackFilter === filterType
                      ? 'bg-white text-black shadow-md'
                      : 'bg-white/10 text-slate-400 hover:text-white'
                  }`}
                >
                  {filterType === 'all'
                    ? `Tất cả (${feedbacks.length})`
                    : filterType === 'unread'
                    ? `Chưa đọc (${unreadFeedbacksCount})`
                    : `Đã xem (${feedbacks.length - unreadFeedbacksCount})`}
                </button>
              ))}
            </div>
          </div>

          {/* Feedback List Items */}
          {feedbacksLoading ? (
            <div className="text-center py-16 text-xs text-slate-500 flex items-center justify-center gap-2">
              <Loader2 className="w-5 h-5 animate-spin" />
              <span>Đang tải thư góp ý từ Supabase...</span>
            </div>
          ) : filteredFeedbacks.length === 0 ? (
            <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-white/10 p-8 space-y-3">
              <MessageSquare className="w-8 h-8 text-slate-600 mx-auto" />
              <p className="text-xs text-slate-400">
                {feedbackFilter === 'unread'
                  ? 'Tuyệt vời! Không còn góp ý nào chưa đọc.'
                  : 'Chưa có ý kiến đóng góp nào từ người dùng.'}
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFeedbacks.map((fb) => {
                const isUnread = fb.status === 'unread' || !fb.status;
                const categoryLabels: Record<string, { label: string; icon: any; color: string }> = {
                  feature: { label: 'Tính năng mới', icon: Flame, color: 'text-amber-400 border-amber-500/30 bg-amber-950/20' },
                  music_request: { label: 'Yêu cầu nhạc/MV', icon: Music2, color: 'text-sky-400 border-sky-500/30 bg-sky-950/20' },
                  bug: { label: 'Báo lỗi / Bug', icon: Bug, color: 'text-rose-400 border-rose-500/30 bg-rose-950/20' },
                  other: { label: 'Ý kiến khác', icon: HelpCircle, color: 'text-slate-300 border-white/20 bg-white/5' },
                };
                const catInfo = categoryLabels[fb.category || 'other'] || categoryLabels.other;
                const CatIcon = catInfo.icon;

                return (
                  <div
                    key={fb.id}
                    className={`bw-panel rounded-3xl p-5 border shadow-xl flex flex-col justify-between space-y-4 transition-all ${
                      isUnread
                        ? 'border-white/40 bg-slate-900/90 shadow-[0_0_30px_rgba(255,255,255,0.06)]'
                        : 'border-white/15 bg-black/70 opacity-75 hover:opacity-100'
                    }`}
                  >
                    <div className="space-y-3">
                      {/* Top Header of Card */}
                      <div className="flex items-start justify-between gap-2">
                        <div className="space-y-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <span className="font-extrabold text-sm text-white truncate font-cyber">
                              {fb.user_name || 'Vault Member'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold border flex items-center gap-1 ${catInfo.color}`}>
                              <CatIcon className="w-2.5 h-2.5" />
                              <span>{catInfo.label}</span>
                            </span>
                          </div>
                          <p className="text-[11px] text-slate-400 truncate">{fb.user_email}</p>
                        </div>

                        {/* Status Badge */}
                        <span
                          className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider flex-shrink-0 ${
                            isUnread
                              ? 'bg-red-500 text-white shadow-sm'
                              : 'bg-white/20 text-slate-300'
                          }`}
                        >
                          {isUnread ? 'CHƯA ĐỌC' : 'ĐÃ XEM'}
                        </span>
                      </div>

                      {/* Content Box */}
                      <div className="p-3.5 rounded-2xl bg-black/60 border border-white/10 text-xs text-slate-200 whitespace-pre-wrap leading-relaxed">
                        {fb.content}
                      </div>
                    </div>

                    {/* Footer Actions */}
                    <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2 text-xs">
                      <div className="flex items-center gap-1.5 text-[10px] text-slate-400">
                        <Clock className="w-3 h-3" />
                        <span>{new Date(fb.created_at).toLocaleString('vi-VN')}</span>
                      </div>

                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => handleToggleFeedbackStatus(fb.id, fb.status)}
                          className={`px-2.5 py-1 rounded-xl text-[10px] font-bold uppercase transition-all flex items-center gap-1 ${
                            isUnread
                              ? 'bg-white text-black hover:bg-slate-200'
                              : 'bg-white/10 text-slate-300 hover:bg-white/20'
                          }`}
                        >
                          <Check className="w-3 h-3" />
                          <span>{isUnread ? 'ĐÁNH DẤU ĐÃ XEM' : 'CHƯA ĐỌC'}</span>
                        </button>

                        <button
                          onClick={() => handleDeleteFeedback(fb.id)}
                          className="p-1.5 rounded-xl bg-red-950/50 hover:bg-red-900 text-red-400 hover:text-white border border-red-500/30 transition-colors"
                          title="Xóa góp ý"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* CREATE OR EDIT ALBUM MODAL */}
      {isAlbumModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bw-panel w-full max-w-lg rounded-3xl p-6 border border-white/30 shadow-2xl relative space-y-4 font-mono text-xs max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <h3 className="text-sm font-extrabold text-white uppercase flex items-center gap-2">
                <FolderPlus className="w-4 h-4 text-white" />
                {editingAlbumId ? 'CHỈNH SỬA ALBUM' : 'TẠO ALBUM THƯ MỤC MỚI'}
              </h3>
              <button
                onClick={cancelEditAlbum}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleSaveAlbum} className="space-y-4">
              <div>
                <label className="block text-slate-400 uppercase mb-1">Tên Album / Thư Mục *</label>
                <input
                  type="text"
                  required
                  placeholder="vd: HVL"
                  value={albumTitle}
                  onChange={(e) => setAlbumTitle(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-500 focus:outline-none focus:border-white"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-slate-400 uppercase mb-1">Nghệ sĩ / Artist *</label>
                  <input
                    type="text"
                    required
                    placeholder="vd: HVL Official"
                    value={albumArtist}
                    onChange={(e) => setAlbumArtist(e.target.value)}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-white"
                  />
                </div>
                <div>
                  <label className="block text-slate-400 uppercase mb-1">Năm phát hành</label>
                  <input
                    type="number"
                    value={albumYear}
                    onChange={(e) => setAlbumYear(Number(e.target.value))}
                    className="w-full bg-slate-900 border border-slate-700 rounded-xl px-3 py-2.5 text-white focus:outline-none focus:border-white"
                  />
                </div>
              </div>





              <div className="p-4 rounded-2xl bg-black border border-white/20 space-y-3">
                <label className="block text-white font-bold flex items-center gap-1.5 uppercase">
                  <ImageIcon className="w-4 h-4 text-white" /> BÌA ĐĨA ALBUM (COVER ART)
                </label>
                {coverUrlInput && (
                  <div className="flex items-center gap-3 p-2 bg-slate-900 rounded-xl border border-slate-800">
                    <img src={coverUrlInput} alt="Preview" className="w-12 h-12 rounded object-cover" />
                    <span className="text-[10px] text-slate-400 truncate">Ảnh bìa hiện tại</span>
                  </div>
                )}
                <input
                  type="file"
                  accept="image/*"
                  onChange={(e) => setCoverFile(e.target.files?.[0] || null)}
                  className="w-full text-slate-400 text-xs file:mr-3 file:py-2 file:px-3 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-white file:text-black cursor-pointer"
                />
                <input
                  type="url"
                  placeholder="Hoặc dán URL ảnh bìa thực tế"
                  value={coverUrlInput}
                  onChange={(e) => setCoverUrlInput(e.target.value)}
                  className="w-full bg-slate-900 border border-slate-800 rounded-lg px-2.5 py-2 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-white"
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={cancelEditAlbum}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase transition-colors"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  disabled={uploading}
                  className="px-5 py-2.5 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider shadow-xl hover:bg-slate-200 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {uploading ? (
                    <span className="animate-pulse">ĐANG LƯU...</span>
                  ) : (
                    <>
                      <Save className="w-4 h-4" />
                      <span>{editingAlbumId ? 'LƯU SỬA ALBUM' : 'TẠO ALBUM MỚI'}</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: INTERACTIVE BATCH LINK ASSIGNER (DRIVE / YOUTUBE) */}
      {isBatchVideoModalOpen && openedAlbumId && activeAlbum && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bg-slate-950 border border-cyan-500/40 rounded-3xl p-6 max-w-3xl w-full max-h-[90vh] flex flex-col justify-between shadow-2xl space-y-4 font-mono text-white relative overflow-hidden">
            <div className="flex items-center justify-between border-b border-white/10 pb-3 flex-shrink-0">
              <h3 className={`font-extrabold text-sm uppercase tracking-wider flex items-center gap-2 font-cyber ${
                batchLinkTargetType === 'video' ? 'text-cyan-300' : 'text-emerald-300'
              }`}>
                {batchLinkTargetType === 'video' ? <Film className="w-4 h-4 text-cyan-400" /> : <Music className="w-4 h-4 text-emerald-400" />}
                DÁN HÀNG LOẠT LINK {batchLinkTargetType.toUpperCase()} (GOOGLE DRIVE / YOUTUBE)
              </h3>
              <button
                type="button"
                onClick={() => setIsBatchVideoModalOpen(false)}
                className="p-1.5 rounded-lg bg-white/10 text-slate-300 hover:bg-white hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <div className="space-y-4 overflow-y-auto pr-1 flex-1">
              <div className="p-3 bg-cyan-950/40 border border-cyan-500/30 rounded-2xl text-[11px] text-cyan-200 leading-relaxed font-mono">
                ℹ️ <strong>BẢO MẬT VỀ DUNG LƯỢNG:</strong> Hệ thống <strong>KHÔNG</strong> tải tệp FLAC/MP4 nặng lên Supabase Storage (tránh vượt 50MB). Việc "Lưu vào Supabase Database" chỉ là lưu các dòng <strong>URL Link (chỉ vài Bytes)</strong> trỏ tới Google Drive của bạn. Khi nghe/xem, web sẽ stream trực tiếp từ Drive của bạn!
              </div>

              <p className="text-xs text-slate-300 leading-relaxed font-mono">
                1️⃣ Dán danh sách các link Google Drive hoặc YouTube vào khung dưới (mỗi link 1 dòng).<br />
                2️⃣ Bấm <strong>"⚡ LẤY TÊN TỆP TỪ DRIVE & PHÂN BỔ BÀI HÁT"</strong> để tự động trích xuất Tên bài hát thực tế.<br />
                3️⃣ Kiểm tra Tên bài hát & Link trước khi bấm <strong>"LƯU DANH SÁCH BÀI HÁT VÀO DATABASE"</strong>.
              </p>

              <div className="space-y-2">
                <textarea
                  rows={5}
                  value={batchVideoUrlsInput}
                  onChange={(e) => setBatchVideoUrlsInput(e.target.value)}
                  placeholder={`Dán 30 link Google Drive vào đây...\nhttps://drive.google.com/file/d/1-2Kgv316Kn3u_nA9uimMufQT5GUQDAPX/view?usp=sharing\nhttps://drive.google.com/file/d/1071TB5yKf0jCTJKRjTazmPHXVqk7Pxmc/view?usp=sharing...`}
                  className="w-full bg-black border border-slate-700 rounded-2xl p-3 text-cyan-200 placeholder-slate-600 font-mono text-xs focus:outline-none focus:border-cyan-400"
                />
                <button
                  type="button"
                  onClick={handleDistributePastedLinks}
                  disabled={savingBatchVideos}
                  className="px-4 py-2.5 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black font-extrabold text-xs uppercase border border-white/20 transition-all flex items-center gap-1.5 shadow-md disabled:opacity-50"
                >
                  {savingBatchVideos ? (
                    <span className="animate-pulse flex items-center gap-1.5 text-yellow-400">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> ĐANG TRÍCH XUẤT TÊN FILE TỪ GOOGLE DRIVE...
                    </span>
                  ) : (
                    <>
                      <Zap className="w-3.5 h-3.5 text-yellow-400" />
                      <span>⚡ LẤY TÊN TỆP TỪ DRIVE & PHÂN BỔ BÀI HÁT</span>
                    </>
                  )}
                </button>
              </div>

              {/* Live Track Mapping Preview List */}
              <div className="space-y-2 pt-2 border-t border-white/10">
                <h4 className="text-xs font-extrabold uppercase text-slate-300 tracking-wider">
                  DANH SÁCH BÀI HÁT TẠO MỚI / ĐƯỢC GÁN ({batchTrackMappings.length} BÀI)
                </h4>
                <div className="space-y-2.5 max-h-[300px] overflow-y-auto pr-1">
                  {batchTrackMappings.map((item, idx) => (
                    <div key={item.id} className="p-2.5 bg-slate-900/90 rounded-xl border border-white/15 space-y-2">
                      <div className="flex items-center gap-2">
                        <span className="text-slate-400 font-bold font-mono text-xs flex-shrink-0">
                          #{idx + 1 < 10 ? `0${idx + 1}` : idx + 1}
                        </span>
                        <input
                          type="text"
                          value={item.title}
                          onChange={(e) => {
                            const val = e.target.value;
                            setBatchTrackMappings((prev) =>
                              prev.map((m) => (m.id === item.id ? { ...m, title: val } : m))
                            );
                          }}
                          placeholder="Tên bài hát (vd: 01. Elegie)..."
                          className="flex-1 bg-black border border-slate-800 rounded-lg px-2.5 py-1 text-white text-xs font-cyber focus:outline-none focus:border-white"
                        />
                      </div>
                      <input
                        type="url"
                        value={item.url}
                        onChange={(e) => {
                          const val = e.target.value;
                          setBatchTrackMappings((prev) =>
                            prev.map((m) => (m.id === item.id ? { ...m, url: val } : m))
                          );
                        }}
                        placeholder="Link Google Drive hoặc YouTube..."
                        className="w-full bg-black border border-slate-800 rounded-lg px-2.5 py-1.5 text-cyan-200 text-xs focus:outline-none focus:border-cyan-400 font-mono"
                      />
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 pt-3 border-t border-white/10 flex-shrink-0">
              <button
                type="button"
                onClick={() => setIsBatchVideoModalOpen(false)}
                className="px-4 py-2.5 rounded-xl bg-white/10 text-slate-300 text-xs font-bold hover:bg-white hover:text-black transition-colors uppercase"
              >
                HỦY BỎ
              </button>
              <button
                type="button"
                onClick={handleSaveBatchTrackMappings}
                disabled={savingBatchVideos || batchTrackMappings.length === 0}
                className={`px-5 py-2.5 rounded-xl text-black font-extrabold text-xs uppercase disabled:opacity-50 transition-all flex items-center gap-2 shadow-lg ${
                  batchLinkTargetType === 'video' ? 'bg-cyan-400 hover:bg-cyan-300' : 'bg-emerald-400 hover:bg-emerald-300'
                }`}
              >
                {savingBatchVideos ? (
                  <span className="animate-pulse flex items-center gap-1.5">
                    <Loader2 className="w-4 h-4 animate-spin" /> ĐANG LƯU VÀO DATABASE...
                  </span>
                ) : (
                  <>
                    <CheckCircle className="w-4 h-4" />
                    <span>LƯU DANH SÁCH BÀI HÁT VÀO DATABASE (CHỈ LƯU LINK DRIVE)</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
