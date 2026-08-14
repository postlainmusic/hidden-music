'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Keyboard, X, Sparkles, Music, ShieldAlert } from 'lucide-react';

export default function ShortcutsDrawer() {
  const [isOpen, setIsOpen] = useState(false);
  const bubbleRef = useRef<HTMLDivElement | null>(null);

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

    const handleClickOutside = (e: MouseEvent | TouchEvent) => {
      if (bubbleRef.current && !bubbleRef.current.contains(e.target as Node)) {
        setIsOpen(false);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('touchstart', handleClickOutside);

    return () => {
      window.removeEventListener('keydown', handleKeyDown);
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('touchstart', handleClickOutside);
    };
  }, [isOpen]);

  const shortcutsList = [
    {
      category: 'PHÁT NHẠC',
      icon: <Music className="w-3 h-3 text-white" />,
      items: [
        { keys: ['Space'], desc: 'Phát / Tạm dừng' },
        { keys: ['←', '→'], desc: 'Bài trước / Kế tiếp' },
        { keys: ['S'], desc: 'Trộn bài (Shuffle)' },
        { keys: ['R'], desc: 'Lặp bài (Repeat)' },
      ],
    },
    {
      category: 'GIAO DIỆN',
      icon: <Sparkles className="w-3 h-3 text-white" />,
      items: [
        { keys: ['L'], desc: 'Bật / Tắt Lời bài hát' },
        { keys: ['Q'], desc: 'Bật / Tắt Hàng chờ' },
        { keys: ['2x Click'], desc: 'Phóng to MV toàn màn hình' },
        { keys: ['?', 'H'], desc: 'Ẩn / Hiện phím tắt' },
      ],
    },
    {
      category: 'BẢO MẬT',
      icon: <ShieldAlert className="w-3 h-3 text-white" />,
      items: [
        { keys: ['F5'], desc: 'Giữ nguyên phiên đăng nhập' },
        { keys: ['Ctrl+Shift+F5'], desc: 'Đăng xuất & Xóa Session' },
      ],
    },
  ];

  return (
    <div ref={bubbleRef} className="fixed top-20 right-3 sm:right-6 z-[85] select-none font-mono">
      {/* Mini Floating Trigger Button */}
      <button
        onClick={() => setIsOpen((prev) => !prev)}
        className={`flex items-center gap-1.5 px-2.5 py-1 rounded-full border transition-all duration-200 backdrop-blur-xl text-[10px] font-bold shadow-xl ${
          isOpen
            ? 'bg-white text-black border-white scale-105 shadow-[0_0_20px_rgba(255,255,255,0.4)]'
            : 'bg-black/80 text-zinc-300 border-white/20 hover:border-white/60 hover:text-white hover:bg-black/95'
        }`}
        title="Bảng phím tắt (Nhấn '?' hoặc 'H')"
      >
        <Keyboard className="w-3 h-3" />
        <span className="hidden xs:inline tracking-wider uppercase text-[9px]">PHÍM TẮT</span>
      </button>

      {/* Floating Compact Rounded Bubble Card */}
      <div
        className={`absolute top-full right-0 mt-2 w-[270px] sm:w-[290px] bg-black/90 border border-white/20 rounded-2xl p-3 shadow-[0_15px_40px_rgba(0,0,0,0.95)] backdrop-blur-2xl transition-all duration-200 origin-top-right transform ${
          isOpen
            ? 'scale-100 opacity-100 translate-y-0 pointer-events-auto'
            : 'scale-90 opacity-0 -translate-y-2 pointer-events-none'
        }`}
        style={{
          boxShadow: '0 20px 50px rgba(0, 0, 0, 0.9), inset 0 0 15px rgba(255, 255, 255, 0.05)',
        }}
      >
        {/* Subtle Scanlines Overlay */}
        <div className="crt-scanlines pointer-events-none opacity-10 rounded-[inherit]" />

        {/* Bubble Header */}
        <div className="flex items-center justify-between border-b border-white/10 pb-2 mb-2 relative z-10">
          <div className="flex items-center gap-1.5">
            <Keyboard className="w-3.5 h-3.5 text-white" />
            <span className="font-cyber font-bold text-xs text-white tracking-wide">PHÍM TẮT NHANH</span>
          </div>
          <button
            onClick={() => setIsOpen(false)}
            className="p-1 rounded-md bg-white/10 hover:bg-white text-zinc-400 hover:text-black transition-colors"
            title="Đóng (Esc)"
          >
            <X className="w-3 h-3" />
          </button>
        </div>

        {/* Compact Shortcuts List */}
        <div className="space-y-3 max-h-[380px] overflow-y-auto no-scrollbar relative z-10 pr-0.5">
          {shortcutsList.map((group, gIdx) => (
            <div key={gIdx} className="space-y-1.5">
              <div className="flex items-center gap-1 text-[8px] font-bold text-zinc-400 uppercase tracking-wider">
                {group.icon}
                <span>{group.category}</span>
              </div>

              <div className="space-y-1">
                {group.items.map((item, iIdx) => (
                  <div
                    key={iIdx}
                    className="py-1 px-2 rounded-lg bg-white/[0.04] border border-white/10 flex items-center justify-between gap-2"
                  >
                    <span className="text-[10px] text-zinc-300 font-sans leading-tight">
                      {item.desc}
                    </span>
                    <div className="flex items-center gap-1 flex-shrink-0">
                      {item.keys.map((k, kIdx) => (
                        <kbd
                          key={kIdx}
                          className="px-1.5 py-0.2 rounded bg-zinc-900 border border-white/25 text-white font-mono font-bold text-[8.5px] shadow-sm"
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

        {/* Bubble Footer */}
        <div className="pt-2 mt-2 border-t border-white/10 text-center text-[8px] text-zinc-500 relative z-10 flex items-center justify-between font-mono">
          <span>Nhấn <kbd className="px-1 py-0.2 rounded bg-zinc-900 border border-white/20 text-zinc-300">ESC</kbd> để đóng</span>
          <span className="text-zinc-400 font-cyber font-bold">VAULT</span>
        </div>
      </div>
    </div>
  );
}
