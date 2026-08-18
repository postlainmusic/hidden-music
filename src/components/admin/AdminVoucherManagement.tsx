'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Ticket,
  Plus,
  RefreshCw,
  Copy,
  Check,
  Trash2,
  Power,
  Calendar,
  Sparkles,
  Search,
  Filter,
  Crown,
  Zap,
  CheckCircle2,
  AlertCircle,
  Clock,
  ShieldCheck,
  Layers,
  Infinity as InfinityIcon,
  Loader2,
  X,
} from 'lucide-react';
import { VoucherItem, VoucherPlanType } from '@/types/database';

interface AdminVoucherManagementProps {
  onNotify?: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export default function AdminVoucherManagement({ onNotify }: AdminVoucherManagementProps) {
  const [vouchers, setVouchers] = useState<VoucherItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterStatus, setFilterStatus] = useState<'all' | 'active' | 'inactive'>('all');
  const [filterPlan, setFilterPlan] = useState<'all' | 'monthly' | 'lifetime'>('all');
  const [copiedCode, setCopiedCode] = useState<string | null>(null);

  // Form State
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false);
  const [formCode, setFormCode] = useState('');
  const [formPlan, setFormPlan] = useState<VoucherPlanType>('lifetime');
  const [formMaxUses, setFormMaxUses] = useState<number>(1);
  const [isUnlimitedUses, setIsUnlimitedUses] = useState(false);
  const [formExpiresAt, setFormExpiresAt] = useState('');
  const [isPermanent, setIsPermanent] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Fetch Vouchers
  const fetchVouchers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/admin/vouchers', { cache: 'no-store' });
      const data = await res.json();
      if (data.success && Array.isArray(data.vouchers)) {
        setVouchers(data.vouchers);
      } else {
        throw new Error(data.error || 'Không thể tải danh sách mã voucher');
      }
    } catch (err: any) {
      console.error('Error fetching vouchers:', err);
      if (onNotify) onNotify({ type: 'error', text: err.message || 'Lỗi khi tải danh sách voucher' });
    } finally {
      setLoading(false);
    }
  }, [onNotify]);

  useEffect(() => {
    fetchVouchers();
  }, [fetchVouchers]);

  // Generate Random Code
  const handleGenerateRandomCode = () => {
    const prefix = formPlan === 'lifetime' ? 'VIP-LIFE' : 'VIP-MO';
    const rand = Math.random().toString(36).substring(2, 7).toUpperCase();
    const code = `${prefix}-${rand}`;
    setFormCode(code);
  };

  // Copy Code to Clipboard
  const handleCopy = (code: string) => {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  };

  // Create Voucher Submit
  const handleCreateVoucher = async (e: React.FormEvent) => {
    e.preventDefault();
    const cleanCode = formCode.trim().toUpperCase();
    if (!cleanCode) {
      if (onNotify) onNotify({ type: 'error', text: 'Vui lòng nhập mã Voucher / Passcode.' });
      return;
    }

    setIsSubmitting(true);
    try {
      const res = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'create',
          code: cleanCode,
          plan_type: formPlan,
          max_uses: isUnlimitedUses ? 0 : Math.max(1, Number(formMaxUses) || 1),
          expires_at: isPermanent ? null : formExpiresAt || null,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (onNotify) onNotify({ type: 'success', text: data.message || 'Đã tạo voucher mới thành công!' });
        setIsCreateModalOpen(false);
        setFormCode('');
        setFormPlan('lifetime');
        setFormMaxUses(1);
        setIsUnlimitedUses(false);
        setIsPermanent(true);
        setFormExpiresAt('');
        await fetchVouchers();
      } else {
        throw new Error(data.error || 'Lỗi tạo voucher');
      }
    } catch (err: any) {
      console.error('Error creating voucher:', err);
      if (onNotify) onNotify({ type: 'error', text: err.message || 'Lỗi khi tạo mã voucher' });
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle Active Status
  const handleToggleActive = async (voucher: VoucherItem) => {
    try {
      const nextState = !voucher.is_active;
      const res = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'toggle_active',
          voucherId: voucher.id,
          is_active: nextState,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (onNotify) onNotify({ type: 'success', text: data.message });
        setVouchers((prev) =>
          prev.map((v) => (v.id === voucher.id ? { ...v, is_active: nextState } : v))
        );
      } else {
        throw new Error(data.error || 'Không thể đổi trạng thái');
      }
    } catch (err: any) {
      console.error('Toggle voucher error:', err);
      if (onNotify) onNotify({ type: 'error', text: err.message || 'Lỗi đổi trạng thái voucher' });
    }
  };

  // Delete Voucher
  const handleDeleteVoucher = async (voucher: VoucherItem) => {
    if (!confirm(`Bạn có chắc chắn muốn xóa mã "${voucher.code}" không?`)) return;

    try {
      const res = await fetch('/api/admin/vouchers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action: 'delete',
          voucherId: voucher.id,
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (onNotify) onNotify({ type: 'success', text: data.message || 'Đã xóa mã voucher thành công.' });
        setVouchers((prev) => prev.filter((v) => v.id !== voucher.id));
      } else {
        throw new Error(data.error || 'Không thể xóa voucher');
      }
    } catch (err: any) {
      console.error('Delete voucher error:', err);
      if (onNotify) onNotify({ type: 'error', text: err.message || 'Lỗi xóa voucher' });
    }
  };

  // Filtered list
  const filteredVouchers = vouchers.filter((v) => {
    const matchesSearch = !searchQuery.trim() || v.code.toLowerCase().includes(searchQuery.trim().toLowerCase());
    
    // Status filter
    let matchesStatus = true;
    const isExpired = v.expires_at ? new Date(v.expires_at).getTime() < Date.now() : false;
    const isExhausted = v.max_uses > 0 && v.used_count >= v.max_uses;
    const isCurrentlyActive = v.is_active && !isExpired && !isExhausted;

    if (filterStatus === 'active') matchesStatus = isCurrentlyActive;
    if (filterStatus === 'inactive') matchesStatus = !isCurrentlyActive;

    // Plan filter
    let matchesPlan = true;
    if (filterPlan !== 'all') matchesPlan = v.plan_type === filterPlan;

    return matchesSearch && matchesStatus && matchesPlan;
  });

  // Summary Metrics
  const totalCount = vouchers.length;
  const activeCount = vouchers.filter((v) => {
    const isExpired = v.expires_at ? new Date(v.expires_at).getTime() < Date.now() : false;
    const isExhausted = v.max_uses > 0 && v.used_count >= v.max_uses;
    return v.is_active && !isExpired && !isExhausted;
  }).length;
  const totalRedeemed = vouchers.reduce((acc, v) => acc + (v.used_count || 0), 0);

  return (
    <div className="space-y-6 font-mono text-white select-none">
      
      {/* Top Header Summary & Action Bar */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="bw-panel rounded-2xl p-4 border border-white/20 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Tổng số mã</p>
            <p className="text-2xl font-black font-cyber text-white mt-0.5">{totalCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
            <Ticket className="w-5 h-5 text-white" />
          </div>
        </div>

        <div className="bw-panel rounded-2xl p-4 border border-white/20 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Đang hoạt động</p>
            <p className="text-2xl font-black font-cyber text-emerald-400 mt-0.5">{activeCount}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/50 flex items-center justify-center border border-emerald-500/30">
            <CheckCircle2 className="w-5 h-5 text-emerald-400" />
          </div>
        </div>

        <div className="bw-panel rounded-2xl p-4 border border-white/20 shadow-lg flex items-center justify-between">
          <div>
            <p className="text-[10px] text-slate-400 uppercase font-bold tracking-wider">Lượt đã kích hoạt</p>
            <p className="text-2xl font-black font-cyber text-sky-400 mt-0.5">{totalRedeemed}</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-sky-950/50 flex items-center justify-center border border-sky-500/30">
            <Crown className="w-5 h-5 text-sky-400" />
          </div>
        </div>
      </div>

      {/* Control Bar: Search, Filters & Create Button */}
      <div className="bw-panel rounded-2xl p-3.5 border border-white/20 flex flex-col md:flex-row items-center justify-between gap-3 shadow-lg">
        {/* Search */}
        <div className="relative w-full md:w-72">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo mã voucher..."
            className="w-full pl-9 pr-3 py-2 rounded-xl bg-black border border-white/20 text-xs text-white placeholder-slate-500 focus:outline-none focus:border-white transition-all font-mono"
          />
        </div>

        {/* Filter Pills */}
        <div className="flex items-center gap-2 flex-wrap w-full md:w-auto justify-between md:justify-end">
          {/* Status Filter */}
          <div className="flex items-center gap-1 p-1 bg-black rounded-xl border border-white/15 text-xs">
            <button
              onClick={() => setFilterStatus('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterStatus === 'all' ? 'bg-white text-black font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất cả
            </button>
            <button
              onClick={() => setFilterStatus('active')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterStatus === 'active' ? 'bg-white text-black font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Khả dụng
            </button>
            <button
              onClick={() => setFilterStatus('inactive')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterStatus === 'inactive' ? 'bg-white text-black font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Hết hạn/Khóa
            </button>
          </div>

          {/* Plan Filter */}
          <div className="flex items-center gap-1 p-1 bg-black rounded-xl border border-white/15 text-xs">
            <button
              onClick={() => setFilterPlan('all')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterPlan === 'all' ? 'bg-white text-black font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Tất cả gói
            </button>
            <button
              onClick={() => setFilterPlan('lifetime')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterPlan === 'lifetime' ? 'bg-white text-black font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Trọn đời
            </button>
            <button
              onClick={() => setFilterPlan('monthly')}
              className={`px-2.5 py-1 rounded-lg transition-all ${
                filterPlan === 'monthly' ? 'bg-white text-black font-bold' : 'text-slate-400 hover:text-white'
              }`}
            >
              Gói tháng
            </button>
          </div>

          <button
            onClick={fetchVouchers}
            className="p-2 rounded-xl bg-white/10 hover:bg-white text-slate-300 hover:text-black border border-white/20 transition-all"
            title="Làm mới danh sách"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>

          {/* CREATE VOUCHER BUTTON */}
          <button
            onClick={() => {
              handleGenerateRandomCode();
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider shadow-lg hover:bg-slate-200 transition-all flex items-center gap-1.5 font-mono"
          >
            <Plus className="w-4 h-4" />
            <span>TẠO MÃ MỚI</span>
          </button>
        </div>
      </div>

      {/* Vouchers Table / List */}
      {loading ? (
        <div className="text-center py-16 text-xs text-slate-500 flex items-center justify-center gap-2">
          <Loader2 className="w-5 h-5 animate-spin text-white" />
          <span>Đang tải danh sách mã Voucher từ Supabase...</span>
        </div>
      ) : filteredVouchers.length === 0 ? (
        <div className="text-center py-16 bg-slate-900/40 rounded-3xl border border-white/10 p-8 space-y-3">
          <Ticket className="w-8 h-8 text-slate-600 mx-auto" />
          <p className="text-xs text-slate-400">
            {searchQuery ? 'Không tìm thấy mã voucher nào khớp với từ khóa.' : 'Chưa có mã voucher nào được tạo.'}
          </p>
          <button
            onClick={() => {
              handleGenerateRandomCode();
              setIsCreateModalOpen(true);
            }}
            className="px-4 py-2 rounded-xl bg-white text-black font-extrabold text-xs uppercase inline-flex items-center gap-1.5 shadow-md hover:bg-slate-200 transition-all"
          >
            <Plus className="w-4 h-4" />
            <span>TẠO MÃ ĐẦU TIÊN</span>
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filteredVouchers.map((item) => {
            const isExpired = item.expires_at ? new Date(item.expires_at).getTime() < Date.now() : false;
            const isExhausted = item.max_uses > 0 && item.used_count >= item.max_uses;
            const isLive = item.is_active && !isExpired && !isExhausted;

            return (
              <div
                key={item.id}
                className={`bw-panel rounded-3xl p-5 border shadow-xl flex flex-col justify-between space-y-4 transition-all ${
                  isLive
                    ? 'border-white/30 bg-slate-900/80 shadow-[0_0_25px_rgba(255,255,255,0.04)]'
                    : 'border-white/10 bg-black/60 opacity-70 hover:opacity-100'
                }`}
              >
                {/* Header: Code & Copy Button */}
                <div className="space-y-3">
                  <div className="flex items-start justify-between gap-2">
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-extrabold text-sm sm:text-base text-white tracking-wider font-mono select-all">
                          {item.code}
                        </span>
                        <button
                          onClick={() => handleCopy(item.code)}
                          title="Sao chép mã"
                          className="p-1 rounded-lg bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-all flex-shrink-0"
                        >
                          {copiedCode === item.code ? <Check className="w-3.5 h-3.5 text-emerald-400" /> : <Copy className="w-3.5 h-3.5" />}
                        </button>
                      </div>
                      <p className="text-[10px] text-slate-400">
                        Tạo lúc: {new Date(item.created_at).toLocaleDateString('vi-VN')}
                      </p>
                    </div>

                    {/* Status Badge */}
                    <span
                      className={`px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-wider flex-shrink-0 ${
                        !item.is_active
                          ? 'bg-zinc-800 text-slate-400 border border-white/10'
                          : isExpired
                          ? 'bg-rose-950/80 text-rose-300 border border-rose-500/30'
                          : isExhausted
                          ? 'bg-amber-950/80 text-amber-300 border border-amber-500/30'
                          : 'bg-emerald-950/80 text-emerald-300 border border-emerald-500/40'
                      }`}
                    >
                      {!item.is_active ? 'ĐÃ KHÓA' : isExpired ? 'HẾT HẠN' : isExhausted ? 'HẾT LƯỢT' : 'KHẢ DỤNG'}
                    </span>
                  </div>

                  {/* Plan & Usage Details Box */}
                  <div className="p-3 rounded-2xl bg-black/70 border border-white/10 space-y-2 text-xs">
                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Loại gói kích hoạt:</span>
                      <span className={`px-2 py-0.5 rounded-lg text-[10px] font-extrabold uppercase border ${
                        item.plan_type === 'monthly'
                          ? 'bg-purple-950/50 text-purple-300 border-purple-500/30'
                          : 'bg-amber-950/50 text-amber-300 border-amber-500/30'
                      }`}>
                        {item.plan_type === 'monthly' ? 'GÓI THÁNG (VIP)' : 'TRỌN ĐỜI (VIP LIFETIME)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Số lượt đã dùng:</span>
                      <span className="font-bold text-white font-mono">
                        {item.used_count || 0} / {item.max_uses > 0 ? item.max_uses : '∞ (Không giới hạn)'}
                      </span>
                    </div>

                    <div className="flex items-center justify-between">
                      <span className="text-slate-400 text-[11px]">Hạn sử dụng:</span>
                      <span className="font-mono text-slate-300 text-[11px]">
                        {item.expires_at
                          ? new Date(item.expires_at).toLocaleDateString('vi-VN')
                          : 'Vô thời hạn'}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Footer Action Buttons */}
                <div className="pt-3 border-t border-white/10 flex items-center justify-between gap-2">
                  <button
                    onClick={() => handleToggleActive(item)}
                    className={`px-3 py-1.5 rounded-xl text-[10px] font-extrabold uppercase tracking-wider flex items-center gap-1.5 transition-all ${
                      item.is_active
                        ? 'bg-white/10 hover:bg-white text-white hover:text-black border border-white/20'
                        : 'bg-emerald-500 text-black hover:bg-emerald-400'
                    }`}
                  >
                    <Power className="w-3 h-3" />
                    <span>{item.is_active ? 'VÔ HIỆU HÓA' : 'BẬT KÍCH HOẠT'}</span>
                  </button>

                  <button
                    onClick={() => handleDeleteVoucher(item)}
                    className="p-1.5 rounded-xl bg-red-950/50 hover:bg-red-900 text-red-400 hover:text-white border border-red-500/30 transition-colors"
                    title="Xóa mã voucher này"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* CREATE VOUCHER MODAL */}
      {isCreateModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/85 backdrop-blur-md flex items-center justify-center p-4">
          <div className="bw-panel w-full max-w-md rounded-3xl p-6 border border-white/30 shadow-2xl relative space-y-5 font-mono text-xs max-h-[90vh] overflow-y-auto">
            {/* Modal Header */}
            <div className="flex items-center justify-between border-b border-white/10 pb-3">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 rounded-xl bg-white/10 flex items-center justify-center border border-white/20">
                  <Ticket className="w-4 h-4 text-white" />
                </div>
                <div>
                  <h3 className="text-sm font-extrabold text-white uppercase font-cyber">TẠO MÃ VOUCHER MỚI</h3>
                  <p className="text-[10px] text-slate-400">Tạo mã kích hoạt Video VIP cho người dùng</p>
                </div>
              </div>
              <button
                onClick={() => setIsCreateModalOpen(false)}
                className="p-1.5 rounded-xl bg-white/10 hover:bg-white text-slate-300 hover:text-black transition-colors"
              >
                <X className="w-4 h-4" />
              </button>
            </div>

            <form onSubmit={handleCreateVoucher} className="space-y-4">
              {/* Mã Code */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold uppercase text-[11px]">Mã Voucher / Passcode *</label>
                  <button
                    type="button"
                    onClick={handleGenerateRandomCode}
                    className="text-[10px] text-yellow-400 hover:underline flex items-center gap-1 font-bold"
                  >
                    <Zap className="w-3 h-3" />
                    <span>Sinh mã ngẫu nhiên</span>
                  </button>
                </div>
                <input
                  type="text"
                  required
                  value={formCode}
                  onChange={(e) => setFormCode(e.target.value.toUpperCase())}
                  placeholder="VD: VIP2026, VAULT-LIFETIME-XYZ..."
                  className="w-full bg-black border border-slate-700 rounded-xl px-3 py-2.5 text-white placeholder-slate-600 focus:outline-none focus:border-white font-mono text-sm tracking-wider uppercase font-bold"
                />
              </div>

              {/* Loại gói kích hoạt */}
              <div className="space-y-1.5">
                <label className="text-slate-300 font-bold uppercase text-[11px]">Loại gói kích hoạt *</label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setFormPlan('lifetime')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      formPlan === 'lifetime'
                        ? 'bg-white text-black border-white shadow-lg'
                        : 'bg-black/50 text-slate-300 border-white/15 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Crown className="w-3.5 h-3.5" />
                      <span>Trọn Đời VIP</span>
                    </div>
                    <p className={`text-[10px] mt-1 ${formPlan === 'lifetime' ? 'text-zinc-700' : 'text-slate-500'}`}>
                      Kích hoạt vĩnh viễn
                    </p>
                  </button>

                  <button
                    type="button"
                    onClick={() => setFormPlan('monthly')}
                    className={`p-3 rounded-2xl border text-left transition-all ${
                      formPlan === 'monthly'
                        ? 'bg-white text-black border-white shadow-lg'
                        : 'bg-black/50 text-slate-300 border-white/15 hover:border-white/30'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 font-bold text-xs">
                      <Clock className="w-3.5 h-3.5" />
                      <span>Gói Tháng VIP</span>
                    </div>
                    <p className={`text-[10px] mt-1 ${formPlan === 'monthly' ? 'text-zinc-700' : 'text-slate-500'}`}>
                      Kích hoạt 30 ngày
                    </p>
                  </button>
                </div>
              </div>

              {/* Giới hạn số lượt sử dụng */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold uppercase text-[11px]">Số lượt dùng tối đa</label>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isUnlimitedUses}
                      onChange={(e) => setIsUnlimitedUses(e.target.checked)}
                      className="rounded accent-white"
                    />
                    <span>Không giới hạn (∞)</span>
                  </label>
                </div>
                {!isUnlimitedUses && (
                  <input
                    type="number"
                    min={1}
                    value={formMaxUses}
                    onChange={(e) => setFormMaxUses(parseInt(e.target.value) || 1)}
                    className="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-white"
                  />
                )}
              </div>

              {/* Hạn sử dụng */}
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-slate-300 font-bold uppercase text-[11px]">Hạn sử dụng</label>
                  <label className="flex items-center gap-1.5 text-[10px] text-slate-400 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={isPermanent}
                      onChange={(e) => setIsPermanent(e.target.checked)}
                      className="rounded accent-white"
                    />
                    <span>Vô thời hạn</span>
                  </label>
                </div>
                {!isPermanent && (
                  <input
                    type="date"
                    value={formExpiresAt}
                    onChange={(e) => setFormExpiresAt(e.target.value)}
                    className="w-full bg-black border border-slate-700 rounded-xl px-3 py-2 text-white font-mono text-xs focus:outline-none focus:border-white"
                  />
                )}
              </div>

              {/* Modal Actions */}
              <div className="flex items-center justify-end gap-2 pt-3 border-t border-white/10">
                <button
                  type="button"
                  onClick={() => setIsCreateModalOpen(false)}
                  className="px-4 py-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-white font-bold text-xs uppercase transition-colors"
                >
                  HỦY BỎ
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  className="px-5 py-2.5 rounded-xl bg-white text-black font-extrabold text-xs uppercase tracking-wider shadow-xl hover:bg-slate-200 transition-all disabled:opacity-50 flex items-center gap-2"
                >
                  {isSubmitting ? (
                    <span className="animate-pulse flex items-center gap-1.5">
                      <Loader2 className="w-3.5 h-3.5 animate-spin" /> ĐANG TẠO...
                    </span>
                  ) : (
                    <>
                      <Ticket className="w-3.5 h-3.5" />
                      <span>XÁC NHẬN TẠO MÃ</span>
                    </>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

    </div>
  );
}
