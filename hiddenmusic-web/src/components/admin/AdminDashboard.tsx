'use client';

import React, { useState, useEffect } from 'react';
import { Disc3, Plus, Upload, Trash2, CheckCircle, ShieldCheck } from 'lucide-react';
import { Album, TrackItem } from '../../types/database';
import { supabase } from '../../lib/supabase';
import { getStoredUserSession } from '../../lib/authSession';

export default function AdminDashboard() {
  const [albums, setAlbums] = useState<Album[]>([]);
  const [loading, setLoading] = useState(true);
  const [albumTitle, setAlbumTitle] = useState('');
  const [albumArtist, setAlbumArtist] = useState('');
  const [albumCoverUrl, setAlbumCoverUrl] = useState('');
  const [albumYear, setAlbumYear] = useState('2026');

  useEffect(() => {
    fetchData();
  }, []);

  const fetchData = async () => {
    setLoading(true);
    const { data } = await supabase.from('albums').select('*, tracks(*)').order('created_at', { ascending: false });
    if (data) setAlbums(data);
    setLoading(false);
  };

  const handleCreateAlbum = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!albumTitle.trim() || !albumArtist.trim()) return;

    const { data, error } = await supabase
      .from('albums')
      .insert([
        {
          title: albumTitle.trim(),
          artist: albumArtist.trim(),
          cover_url: albumCoverUrl.trim() || 'https://images.unsplash.com/photo-1518709268805-4e9042af9f23?q=80&w=1000',
          original_year: parseInt(albumYear, 10) || 2026,
          is_published: true,
        },
      ])
      .select()
      .single();

    if (data) {
      setAlbums([data, ...albums]);
      setAlbumTitle('');
      setAlbumArtist('');
      setAlbumCoverUrl('');
    }
  };

  const handleDeleteAlbum = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa album này?')) return;
    await supabase.from('albums').delete().eq('id', id);
    setAlbums(albums.filter((a) => a.id !== id));
  };

  return (
    <div className="w-full min-h-screen pt-20 pb-32 px-4 sm:px-8 font-mono max-w-6xl mx-auto select-none">
      <div className="flex items-center justify-between mb-8 pb-4 border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-2xl bg-white/10 border border-white/20 flex items-center justify-center text-white">
            <ShieldCheck className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl font-black font-cyber text-white uppercase tracking-wider">
              ADMIN VAULT TERMINAL
            </h1>
            <p className="text-xs text-slate-400">Quản lý Album, Bài hát & Kho lưu trữ Cloudflare R2</p>
          </div>
        </div>
        <a href="/" className="px-4 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all">
          VỀ TRANG CHỦ
        </a>
      </div>

      {/* Form Thêm Album Mới */}
      <div className="p-6 rounded-3xl bg-black/60 border border-white/15 backdrop-blur-xl mb-8">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-4 flex items-center gap-2">
          <Plus className="w-4 h-4" /> TẠO ALBUM MỚI
        </h2>
        <form onSubmit={handleCreateAlbum} className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Tên Album *"
            value={albumTitle}
            onChange={(e) => setAlbumTitle(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-xs outline-none focus:border-white/30"
            required
          />
          <input
            type="text"
            placeholder="Nghệ sĩ *"
            value={albumArtist}
            onChange={(e) => setAlbumArtist(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-xs outline-none focus:border-white/30"
            required
          />
          <input
            type="text"
            placeholder="URL Ảnh bìa (Cover URL)"
            value={albumCoverUrl}
            onChange={(e) => setAlbumCoverUrl(e.target.value)}
            className="bg-white/5 border border-white/10 rounded-2xl px-4 py-2.5 text-white text-xs outline-none focus:border-white/30"
          />
          <button
            type="submit"
            className="py-2.5 px-4 rounded-2xl bg-white hover:bg-slate-200 text-black font-black text-xs uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg"
          >
            <Plus className="w-3.5 h-3.5" /> TẠO ALBUM
          </button>
        </form>
      </div>

      {/* Danh Sách Albums */}
      <div className="space-y-4">
        <h2 className="text-sm font-bold text-white uppercase tracking-wider mb-2">
          DANH SÁCH ALBUM TRONG KHO ({albums.length})
        </h2>
        {loading ? (
          <div className="text-center py-12 text-slate-500">Đang tải danh sách...</div>
        ) : (
          albums.map((alb) => (
            <div
              key={alb.id}
              className="flex items-center justify-between p-4 rounded-2xl bg-white/[0.02] border border-white/10 hover:border-white/20 transition-all"
            >
              <div className="flex items-center gap-3 min-w-0 flex-1">
                <img src={alb.cover_url} alt="" className="w-12 h-12 rounded-xl object-cover border border-white/10" />
                <div className="min-w-0 flex-1">
                  <h4 className="text-sm font-bold text-white truncate">{alb.title}</h4>
                  <p className="text-xs text-slate-400 truncate">{alb.artist} • {alb.original_year || '2026'}</p>
                </div>
              </div>
              <div className="flex items-center gap-2 flex-shrink-0">
                <a
                  href={`/album/${alb.id}`}
                  className="px-3 py-1.5 rounded-xl bg-white/10 hover:bg-white/20 text-white text-xs font-bold transition-all"
                >
                  XEM CHI TIẾT
                </a>
                <button
                  onClick={() => handleDeleteAlbum(alb.id)}
                  className="p-2 rounded-xl bg-red-950/60 hover:bg-red-900/80 text-red-300 border border-red-500/30 transition-all"
                  title="Xóa Album"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
