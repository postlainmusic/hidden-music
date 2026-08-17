'use client';

import React, { useState, useEffect } from 'react';
import { MessageSquare, Send, Crown, User, Trash2 } from 'lucide-react';
import { AlbumComment } from '../../types/database';
import { supabase } from '../../lib/supabase';
import { getStoredUserSession, isVipSubscribed } from '../../lib/authSession';

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
  const [comments, setComments] = useState<AlbumComment[]>([]);
  const [newComment, setNewComment] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    // Load cached comments or fetch
    const local = localStorage.getItem(`comments_${albumId}`);
    if (local) {
      try {
        const parsed = JSON.parse(local);
        setComments(parsed);
        if (onCommentsCountChange) onCommentsCountChange(parsed.length);
      } catch {}
    }

    const fetchComments = async () => {
      const { data } = await supabase
        .from('album_comments')
        .select('*')
        .eq('album_id', albumId)
        .order('created_at', { ascending: false });

      if (data) {
        setComments(data);
        if (onCommentsCountChange) onCommentsCountChange(data.length);
        localStorage.setItem(`comments_${albumId}`, JSON.stringify(data));
      }
    };

    fetchComments();
  }, [albumId]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newComment.trim()) return;

    setIsSubmitting(true);
    const session = getStoredUserSession();
    const isVip = isVipSubscribed();

    const commentObj: AlbumComment = {
      id: `local_${Date.now()}`,
      album_id: albumId,
      user_id: session?.id || 'guest',
      author_name: session?.user_metadata?.username || session?.email?.split('@')[0] || 'Khách Ẩn Danh',
      content: newComment.trim(),
      is_vip: isVip,
      created_at: new Date().toISOString(),
    };

    const updated = [commentObj, ...comments];
    setComments(updated);
    setNewComment('');
    localStorage.setItem(`comments_${albumId}`, JSON.stringify(updated));
    if (onCommentsCountChange) onCommentsCountChange(updated.length);

    // Save to DB asynchronously
    try {
      await supabase.from('album_comments').insert([
        {
          album_id: albumId,
          user_id: session?.id || null,
          author_name: commentObj.author_name,
          content: commentObj.content,
          is_vip: commentObj.is_vip,
        },
      ]);
    } catch {}

    setIsSubmitting(false);
  };

  return (
    <div className="flex-1 flex flex-col min-h-0 font-mono text-xs select-none">
      <div className="flex items-center justify-between border-b border-white/10 pb-3 mb-3">
        <span className="font-bold text-white uppercase tracking-wider flex items-center gap-1.5">
          <MessageSquare className="w-3.5 h-3.5" /> THẢO LUẬN // {albumTitle} ({comments.length})
        </span>
      </div>

      <div className="flex-1 overflow-y-auto space-y-3 scrollbar-none pr-1 mb-3">
        {comments.length > 0 ? (
          comments.map((cmt) => (
            <div key={cmt.id} className="p-3 rounded-2xl bg-white/[0.03] border border-white/5 space-y-1">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5">
                  <span className="font-bold text-white text-xs">{cmt.author_name}</span>
                  {cmt.is_vip && (
                    <span className="text-[8px] px-1 py-0.2 rounded font-black uppercase bg-amber-950 text-amber-300 border border-amber-500/40 flex items-center gap-0.5">
                      <Crown className="w-2 h-2" /> VIP
                    </span>
                  )}
                </div>
                <span className="text-[9px] text-slate-500">
                  {new Date(cmt.created_at).toLocaleDateString('vi-VN')}
                </span>
              </div>
              <p className="text-slate-300 text-xs leading-relaxed">{cmt.content}</p>
            </div>
          ))
        ) : (
          <p className="text-slate-500 italic text-center py-8">Chưa có bình luận nào. Hãy là người đầu tiên!</p>
        )}
      </div>

      <form onSubmit={handleSubmit} className="flex items-center gap-2 pt-2 border-t border-white/10">
        <input
          type="text"
          value={newComment}
          onChange={(e) => setNewComment(e.target.value)}
          placeholder="Viết cảm nhận về album này..."
          className="flex-1 bg-white/5 border border-white/10 rounded-2xl px-3 py-2 text-white outline-none focus:border-white/30 text-xs"
        />
        <button
          type="submit"
          disabled={isSubmitting || !newComment.trim()}
          className="p-2.5 rounded-2xl bg-white text-black font-bold hover:bg-slate-200 transition-all disabled:opacity-50"
        >
          <Send className="w-3.5 h-3.5" />
        </button>
      </form>
    </div>
  );
}
