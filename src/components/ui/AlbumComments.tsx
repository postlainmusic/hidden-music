'use client';

import React, { useState, useEffect } from 'react';
import {
  MessageSquare,
  Send,
  Heart,
  Trash2,
  Loader2,
  Clock,
  Pin
} from 'lucide-react';
import { createClient } from '@/lib/supabase/client';
import { AlbumCommentItem } from '@/types/database';
import { getStoredUserSession, getStoredAdminSession } from '@/lib/authSession';

interface AlbumCommentsProps {
  albumId: string;
  albumTitle: string;
  onCommentsCountChange?: (count: number) => void;
}

export default function AlbumComments({
  albumId,
  albumTitle,
  onCommentsCountChange,
}: AlbumCommentsProps) {
  const [comments, setComments] = useState<AlbumCommentItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [posting, setPosting] = useState(false);
  const [content, setContent] = useState('');
  const [userSession, setUserSession] = useState<any>(null);
  const [likedCommentIds, setLikedCommentIds] = useState<Set<string>>(new Set());

  // Check Current Session
  useEffect(() => {
    const session = getStoredUserSession();
    if (session) {
      setUserSession(session);
    }

    const isAdmin = getStoredAdminSession();
    if (isAdmin && !session) {
      setUserSession({
        id: 'admin-master-id',
        email: 'admin@hiddenvault.com',
        display_name: 'LUCIINGO1108',
        role: 'admin',
      });
    }

    // Load liked comments from localStorage
    try {
      if (typeof window !== 'undefined') {
        const storedLikes = localStorage.getItem('hidden_vault_liked_comments');
        if (storedLikes) {
          setLikedCommentIds(new Set(JSON.parse(storedLikes)));
        }
      }
    } catch {}
  }, []);

  // Fetch comments for this album with resilient local fallback
  const fetchComments = async () => {
    if (!albumId) return;
    setLoading(true);

    let remoteList: AlbumCommentItem[] = [];
    let localList: AlbumCommentItem[] = [];

    // 1. Fetch from Supabase
    try {
      const supabase = createClient();
      const { data, error } = await supabase
        .from('album_comments')
        .select('*')
        .eq('album_id', albumId)
        .order('created_at', { ascending: false });

      if (!error && data) {
        remoteList = data as AlbumCommentItem[];
      }
    } catch (err) {
      console.warn('Supabase comments fetch notice:', err);
    }

    // 2. Fetch from LocalStorage fallback
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(`hidden_vault_album_comments_${albumId}`);
        if (cached) {
          localList = JSON.parse(cached);
        }
      }
    } catch {}

    // 3. Deduplicate and merge
    const map = new Map<string, AlbumCommentItem>();
    remoteList.forEach((c) => map.set(c.id, c));
    localList.forEach((c) => {
      if (!map.has(c.id)) map.set(c.id, c);
    });

    const merged = Array.from(map.values()).sort(
      (a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
    );

    setComments(merged);
    setLoading(false);
    if (onCommentsCountChange) {
      onCommentsCountChange(merged.length);
    }
  };

  useEffect(() => {
    fetchComments();
  }, [albumId]);

  // Format relative time in Vietnamese
  const formatTimeAgo = (dateStr: string) => {
    try {
      const d = new Date(dateStr);
      const now = new Date();
      const diffMs = now.getTime() - d.getTime();
      const diffSec = Math.floor(diffMs / 1000);
      const diffMin = Math.floor(diffSec / 60);
      const diffHours = Math.floor(diffMin / 60);
      const diffDays = Math.floor(diffHours / 24);

      if (diffSec < 45) return 'vừa xong';
      if (diffMin < 60) return `${diffMin} phút trước`;
      if (diffHours < 24) return `${diffHours} giờ trước`;
      if (diffDays === 1) return 'Hôm qua';
      if (diffDays < 7) return `${diffDays} ngày trước`;
      return d.toLocaleDateString('vi-VN');
    } catch {
      return 'mới đây';
    }
  };

  // Post New Comment
  const handlePostComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!content.trim() || posting) return;

    setPosting(true);

    const userName =
      userSession?.display_name ||
      userSession?.user_metadata?.full_name ||
      userSession?.email?.split('@')[0] ||
      'Vault Member';

    const userRole =
      getStoredAdminSession() ||
      userSession?.role === 'admin' ||
      userSession?.email === 'admin@hiddenvault.com'
        ? 'admin'
        : 'user';

    const newComment: AlbumCommentItem = {
      id: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : 'cm_' + Date.now(),
      album_id: albumId,
      user_id: userSession?.id && !userSession.id.startsWith('vault-') ? userSession.id : null,
      user_email: userSession?.email || 'member@hiddenvault.com',
      user_name: userName,
      user_avatar: userSession?.user_metadata?.avatar_url || null,
      content: content.trim(),
      likes_count: 0,
      is_pinned: false,
      role: userRole,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };

    // Optimistic UI update
    setComments((prev) => [newComment, ...prev]);
    setContent('');

    if (onCommentsCountChange) {
      onCommentsCountChange(comments.length + 1);
    }

    // 1. Try remote Supabase insert
    try {
      const supabase = createClient();
      await supabase.from('album_comments').insert(newComment);
    } catch (err) {
      console.warn('Supabase comment insert notice:', err);
    }

    // 2. Persist to local storage
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(`hidden_vault_album_comments_${albumId}`);
        const list: AlbumCommentItem[] = cached ? JSON.parse(cached) : [];
        list.unshift(newComment);
        localStorage.setItem(`hidden_vault_album_comments_${albumId}`, JSON.stringify(list.slice(0, 100)));
      }
    } catch {}

    setPosting(false);
  };

  // Toggle Like on Comment
  const handleToggleLike = async (commentId: string) => {
    const isLiked = likedCommentIds.has(commentId);
    const newLikedSet = new Set(likedCommentIds);

    if (isLiked) {
      newLikedSet.delete(commentId);
    } else {
      newLikedSet.add(commentId);
    }

    setLikedCommentIds(newLikedSet);

    // Save liked list locally
    try {
      if (typeof window !== 'undefined') {
        localStorage.setItem('hidden_vault_liked_comments', JSON.stringify(Array.from(newLikedSet)));
      }
    } catch {}

    // Update state
    setComments((prev) =>
      prev.map((c) => {
        if (c.id === commentId) {
          const delta = isLiked ? -1 : 1;
          const updatedLikes = Math.max(0, (c.likes_count || 0) + delta);
          return { ...c, likes_count: updatedLikes };
        }
        return c;
      })
    );

    // Update remote Supabase
    try {
      const target = comments.find((c) => c.id === commentId);
      if (target) {
        const delta = isLiked ? -1 : 1;
        const newCount = Math.max(0, (target.likes_count || 0) + delta);
        const supabase = createClient();
        await supabase.from('album_comments').update({ likes_count: newCount }).eq('id', commentId);
      }
    } catch {}
  };

  // Delete Comment
  const handleDeleteComment = async (commentId: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa bình luận này không?')) return;

    // Update UI state
    setComments((prev) => prev.filter((c) => c.id !== commentId));
    if (onCommentsCountChange) {
      onCommentsCountChange(Math.max(0, comments.length - 1));
    }

    // Remove from local cache
    try {
      if (typeof window !== 'undefined') {
        const cached = localStorage.getItem(`hidden_vault_album_comments_${albumId}`);
        if (cached) {
          const list: AlbumCommentItem[] = JSON.parse(cached);
          const updated = list.filter((c) => c.id !== commentId);
          localStorage.setItem(`hidden_vault_album_comments_${albumId}`, JSON.stringify(updated));
        }
      }
    } catch {}

    // Delete from Supabase
    try {
      const supabase = createClient();
      await supabase.from('album_comments').delete().eq('id', commentId);
    } catch (err) {
      console.warn('Delete comment error:', err);
    }
  };

  const isCurrentAdmin =
    getStoredAdminSession() ||
    userSession?.role === 'admin' ||
    userSession?.email === 'admin@hiddenvault.com';

  return (
    <div className="flex flex-col h-full font-mono text-white select-none">
      {/* 1. Comment Input Box */}
      <form onSubmit={handlePostComment} className="p-3 sm:p-3.5 border-b border-white/10 bg-black/40 space-y-2 flex-shrink-0">
        <div className="flex items-center justify-between text-[11px] text-slate-400">
          <div className="flex items-center gap-1.5 min-w-0">
            <div className="w-5 h-5 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-bold text-white uppercase flex-shrink-0">
              {userSession?.display_name ? userSession.display_name.charAt(0) : 'U'}
            </div>
            <span className="font-bold text-white truncate text-xs font-cyber">
              {userSession?.display_name || userSession?.email?.split('@')[0] || 'Vault Member'}
            </span>
            {isCurrentAdmin && (
              <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-white text-black uppercase">
                ADMIN
              </span>
            )}
          </div>
          <span className="text-[10px] text-slate-500 font-mono">
            {content.length}/500
          </span>
        </div>

        <div className="relative">
          <textarea
            rows={2}
            value={content}
            maxLength={500}
            onChange={(e) => setContent(e.target.value)}
            placeholder={`Chia sẻ cảm nghĩ về Album "${albumTitle}"...`}
            className="w-full bg-black/70 border border-white/15 focus:border-white/40 rounded-xl p-2.5 text-xs text-white placeholder-slate-500 focus:outline-none transition-all resize-none leading-relaxed"
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handlePostComment(e);
              }
            }}
          />

          <button
            type="submit"
            disabled={posting || !content.trim()}
            className="absolute right-2 bottom-2 px-3 py-1 rounded-lg bg-white text-black font-extrabold text-[11px] uppercase tracking-wider hover:bg-slate-200 transition-all flex items-center gap-1 shadow-md disabled:opacity-30 disabled:pointer-events-none"
          >
            {posting ? (
              <Loader2 className="w-3 h-3 animate-spin" />
            ) : (
              <>
                <span>GỬI</span>
                <Send className="w-2.5 h-2.5" />
              </>
            )}
          </button>
        </div>
      </form>

      {/* 2. Comments List */}
      <div
        className="flex-1 min-h-0 overflow-y-auto space-y-2 p-3 no-scrollbar"
        style={{ WebkitOverflowScrolling: 'touch' }}
      >
        {loading ? (
          <div className="h-full flex flex-col items-center justify-center p-8 text-slate-500 gap-2">
            <Loader2 className="w-6 h-6 animate-spin text-white" />
            <span className="text-[11px] uppercase tracking-widest font-mono">
              ĐANG TẢI THẢO LUẬN...
            </span>
          </div>
        ) : comments.length === 0 ? (
          <div className="h-full flex flex-col items-center justify-center text-slate-500 p-8 text-center space-y-2">
            <div className="w-10 h-10 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center mx-auto text-slate-400">
              <MessageSquare className="w-5 h-5" />
            </div>
            <p className="text-xs font-bold text-slate-300 font-cyber uppercase">
              CHƯA CÓ BÌNH LUẬN NÀO
            </p>
            <p className="text-[10px] text-slate-500 max-w-xs leading-relaxed">
              Hãy là người đầu tiên để lại cảm nhận về Album này nhé!
            </p>
          </div>
        ) : (
          comments.map((comment) => {
            const isLiked = likedCommentIds.has(comment.id);
            const isAuthor =
              (userSession?.id && comment.user_id && userSession.id === comment.user_id) ||
              (userSession?.email && comment.user_email && userSession.email === comment.user_email);
            const canDelete = isAuthor || isCurrentAdmin;
            const isAdminComment = comment.role === 'admin' || comment.user_email === 'admin@hiddenvault.com';

            return (
              <div
                key={comment.id}
                className={`p-3 rounded-2xl border transition-all text-xs space-y-2 ${
                  isAdminComment
                    ? 'bg-slate-900/90 border-white/30 shadow-[0_0_20px_rgba(255,255,255,0.05)]'
                    : 'bg-black/60 border-white/10 hover:border-white/20'
                }`}
              >
                {/* Comment Header */}
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <div className="w-6 h-6 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-[10px] font-bold text-white uppercase flex-shrink-0">
                      {comment.user_name ? comment.user_name.charAt(0) : 'U'}
                    </div>

                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="font-extrabold text-white truncate text-xs font-cyber">
                          {comment.user_name}
                        </span>
                        {isAdminComment ? (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-extrabold bg-white text-black uppercase">
                            ADMIN
                          </span>
                        ) : (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-white/10 text-slate-400 uppercase">
                            MEMBER
                          </span>
                        )}
                        {comment.is_pinned && (
                          <span className="px-1.5 py-0.2 rounded text-[8px] font-bold bg-yellow-500/20 text-yellow-300 border border-yellow-500/30 flex items-center gap-0.5">
                            <Pin className="w-2.5 h-2.5" />
                            <span>Ghim</span>
                          </span>
                        )}
                      </div>
                      <span className="text-[9px] text-slate-500 flex items-center gap-1 mt-0.5">
                        <Clock className="w-2.5 h-2.5" />
                        <span>{formatTimeAgo(comment.created_at)}</span>
                      </span>
                    </div>
                  </div>

                  {/* Actions: Delete button */}
                  {canDelete && (
                    <button
                      onClick={() => handleDeleteComment(comment.id)}
                      className="p-1 rounded-lg text-slate-500 hover:text-red-400 hover:bg-red-950/40 transition-colors"
                      title="Xóa bình luận"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>

                {/* Comment Content */}
                <p className="text-xs text-slate-200 whitespace-pre-wrap leading-relaxed pl-8">
                  {comment.content}
                </p>

                {/* Comment Footer: Like button */}
                <div className="flex items-center justify-end gap-2 pt-1 border-t border-white/5 pl-8">
                  <button
                    onClick={() => handleToggleLike(comment.id)}
                    className={`flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-all ${
                      isLiked
                        ? 'bg-red-500/20 text-red-400 border border-red-500/40'
                        : 'bg-white/5 text-slate-400 hover:text-white border border-white/10'
                    }`}
                  >
                    <Heart className={`w-3 h-3 ${isLiked ? 'fill-red-400 text-red-400' : ''}`} />
                    <span>{comment.likes_count || 0}</span>
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
