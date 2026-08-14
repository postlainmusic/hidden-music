'use client';

import React, { useState, useEffect } from 'react';
import { Keyboard, X, Sparkles, Command, Music, Film, Mic2, ListMusic, ShieldAlert } from 'lucide-react';

export default function ShortcutsDrawer() {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      if (
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable)
      ) {
        return;
      }

      if (e.key === '?' || (e.shiftKey && e.key === '/') || e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      } else if (e.key === 'Escape' && isOpen) {
        e.preventDefault();
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

  const shortcutsList = [
    {
      category: 'ĐIỀU KHIỂN PHÁT NHẠC',
      icon: <Music className="w-3.5 h-3.5 text-white" />,
      items: [
        { keys: ['Space'], desc: 'Phát / Tạm dừng bản nhạc hoặc MV' },
        { keys: ['←', '→'], desc: 'Chuyển lùi bài trước / Sang bài kế tiếp' },
        { keys: ['S'], desc: 'Bật / Tắt chế độ phát ngẫu nhiên (Shuffle)' },
        { keys: ['R'], desc: 'Chuyển chế độ lặp: Tắt / Lặp 1 bài / Lặp toàn bộ' },
      ],
    },
    {
      category: 'GIAO DIỆN & TÍNH NĂNG MỞ RỘNG',
      icon: <Sparkles className="w-3.5 h-3.5 text-white" />,
      items: [
        { keys: ['L'], desc: 'Mở / Đóng giao diện Lời bài hát (Gothic Lyrics)' },
        { keys: ['Q'], desc: 'Mở / Đóng Hàng chờ danh sách phát (Queue)' },
        { keys: ['Nhấp đúp MV'], desc: 'Phóng to / Thu nhỏ Video toàn màn hình' },
        { keys: ['?', 'H'], desc: 'Ẩn / Hiện bảng phím tắt trợ giúp này' },
      ],
    },
    {
      category: 'HỆ THỐNG & BẢO MẬT SESSION',
      icon: <ShieldAlert className="w-3.5 h-3.5 text-white" />,
      items: [
        { keys: ['F5'], desc: 'Tải lại trang & Giữ nguyên toàn bộ phiên đăng nhập' },
        { keys: ['Ctrl', 'Shift', 'F5'], desc: 'Xóa sạch Session & Đăng xuất tài khoản an toàn' },
      ],
    },
  ];

  return (
    <>
      {/* Floating Toggle Button (Sleek Gothic Pill on Right Edge) */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`fixed top-20 right-3 sm:right-5 z-[55] flex items-center gap-1.5 px-3 py-1.5 rounded-full border transition-all duration-300 backdrop-blur-xl select-none font-mono text-[10px] font-bold shadow-2xl ${
          isOpen
            ? 'bg-white text-black border-white scale-105 shadow-[0_0_25px_rgba(255,255,255,0.4)]'
            : 'bg-black/80 text-zinc-300 border-white/20 hover:border-white/60 hover:text-white hover:bg-black/95'
        }`}
        title="Bảng hướng dẫn phím tắt (Nhấn '?' hoặc 'H')"
      >
        <Keyboard className="w-3.5 h-3.5" />
        <span className="hidden sm:inline tracking-wider uppercase">PHÍM TẮT</span>
      </button>

      {/* Backdrop */}
      {isOpen && (
        <div
          onClick={() => setIsOpen(false)}
          className="fixed inset-0 bg-black/70 backdrop-blur-sm z-[80] transition-opacity duration-300 animate-fadeIn"
        />
      )}

      {/* Slide-out Gothic Command Panel */}
      <div
        className={`fixed top-0 right-0 bottom-0 w-full sm:w-[380px] md:w-[420px] bg-black/95 border-l border-white/20 backdrop-blur-2xl z-[90] shadow-[0_0_60px_rgba(0,0,0,0.95)] transform transition-transform duration-300 ease-out flex flex-col justify-between font-mono select-none ${
          isOpen ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        {/* Analog Scanline Overlay */}
        <div className="crt-scanlines pointer-events-none opacity-20" />

        {/* Panel Header */}
        <div className="p-4 sm:p-5 border-b border-white/10 flex items-center justify-between relative z-10">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-xl bg-white/10 border border-white/20 flex items-center justify-center">
              <Command className="w-4 h-4 text-white" />
            </div>
            <div>
              <h3 className="font-cyber font-extrabold text-sm text-white tracking-wider">
                BẢNG PHÍM TẮT HỆ THỐNG
              </h3>
              <p className="text-[9px] text-zinc-400 uppercase tracking-widest">
                HIDDEN MUSIC VAULT • SHORTCUTS
              </p>
            </div>
          </div>

          <button
            onClick={() => setIsOpen(false)}
            className="p-2 rounded-xl bg-white/5 border border-white/10 hover:bg-white hover:text-black text-zinc-400 transition-colors"
            title="Đóng bảng phím tắt (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Panel Body: Category Groups */}
        <div className="flex-1 overflow-y-auto no-scrollbar p-4 sm:p-5 space-y-6 relative z-10">
          {shortcutsList.map((group, gIdx) => (
            <div key={gIdx} className="space-y-2.5">
              <div className="flex items-center gap-2 text-[10px] font-bold text-zinc-400 uppercase tracking-widest pb-1 border-b border-white/10">
                {group.icon}
                <span>{group.category}</span>
              </div>

              <div className="space-y-2">
                {group.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    className="p-2.5 rounded-xl bg-white/[0.03] border border-white/10 hover:border-white/30 transition-all flex items-center justify-between gap-3"
                  >
                    <span className="text-xs text-zinc-300 font-sans leading-tight">
                      {item.desc}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-2 py-0.5 rounded-lg bg-zinc-900 border border-white/30 text-white font-mono font-bold text-[10px] shadow-[0_2px_4px_rgba(0,0,0,0.8)]"
                        >
                          {k}
                        </kbd>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Panel Footer */}
        <div className="p-4 border-t border-white/10 text-center text-[10px] text-zinc-500 relative z-10 flex items-center justify-between">
          <span>Nhấn <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-white/20 text-zinc-300">ESC</kbd> hoặc <kbd className="px-1.5 py-0.5 rounded bg-zinc-900 border border-white/20 text-zinc-300">?</kbd> để đóng</span>
          <span className="text-zinc-400 font-cyber">VAULT V2</span>
        </div>
      </div>
    </>
  );
}
