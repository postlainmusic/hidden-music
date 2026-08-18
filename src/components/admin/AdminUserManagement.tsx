'use client';

import React, { useState, useEffect, useCallback } from 'react';
import {
  Users,
  Search,
  RefreshCw,
  ShieldCheck,
  CheckCircle2,
  XCircle,
  Sparkles,
  Crown,
  KeyRound,
  FileText,
  Copy,
  Check,
  AlertCircle,
  Loader2,
  ChevronRight,
  UserCheck,
  UserX,
  CreditCard,
  Building,
  Calendar,
  Filter,
} from 'lucide-react';
import { Profile } from '@/types/database';

interface AdminUserManagementProps {
  onNotify?: (msg: { type: 'success' | 'error'; text: string }) => void;
}

export default function AdminUserManagement({ onNotify }: AdminUserManagementProps) {
  const [users, setUsers] = useState<Profile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchQuery, setSearchQuery] = useState('');
  const [filterType, setFilterType] = useState<'all' | 'vip' | 'free'>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Modal State
  const [selectedUser, setSelectedUser] = useState<Profile | null>(null);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [targetAccess, setTargetAccess] = useState(true);
  const [targetPlan, setTargetPlan] = useState<'vip' | 'premium'>('vip');
  const [adminNote, setAdminNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const fetchUsers = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (searchQuery.trim()) params.set('q', searchQuery.trim());
      if (filterType !== 'all') params.set('filter', filterType);

      const res = await fetch(`/api/admin/users?${params.toString()}`, { cache: 'no-store' });
      const data = await res.json();

      if (data.success && Array.isArray(data.users)) {
        setUsers(data.users);
      } else {
        throw new Error(data.error || 'Không thể tải danh sách người dùng');
      }
    } catch (err: any) {
      console.error('Error fetching admin users:', err);
      if (onNotify) onNotify({ type: 'error', text: err.message || 'Lỗi khi tải danh sách người dùng' });
    } finally {
      setLoading(false);
    }
  }, [searchQuery, filterType, onNotify]);

  useEffect(() => {
    const timer = setTimeout(() => {
      fetchUsers();
    }, 250);
    return () => clearTimeout(timer);
  }, [fetchUsers]);

  const handleCopyId = (id: string) => {
    navigator.clipboard.writeText(id);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  const handleOpenPermissionModal = (user: Profile, grantAccess: boolean) => {
    setSelectedUser(user);
    setTargetAccess(grantAccess);
    setTargetPlan(user.plan === 'premium' ? 'premium' : 'vip');
    setAdminNote(user.admin_note || (grantAccess ? 'Đã nhận chuyển khoản MB Bank' : 'Thu hồi quyền VIP'));
    setIsModalOpen(true);
  };

  const handleConfirmToggleAccess = async () => {
    if (!selectedUser) return;
    setSubmitting(true);

    try {
      const res = await fetch('/api/admin/users/toggle-video-access', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          targetUserId: selectedUser.id,
          hasAccess: targetAccess,
          plan: targetPlan,
          note: adminNote.trim(),
        }),
      });

      const data = await res.json();
      if (data.success) {
        if (onNotify) onNotify({ type: 'success', text: data.message || 'Đã cập nhật quyền thành công!' });
        setIsModalOpen(false);
        await fetchUsers();
      } else {
        throw new Error(data.error || 'Không thể cập nhật quyền');
      }
    } catch (err: any) {
      console.error('Error toggling video access:', err);
      if (onNotify) onNotify({ type: 'error', text: err.message || 'Lỗi khi cập nhật quyền người dùng' });
    } finally {
      setSubmitting(false);
    }
  };

  const isUserVip = (u: Profile) => {
    return (
      u.role === 'admin' ||
      u.is_video_paid === true ||
      u.has_video_subscription === true ||
      u.plan === 'vip' ||
      u.plan === 'premium'
    );
  };

  const totalCount = users.length;
  const vipCount = users.filter(isUserVip).length;
  const freeCount = totalCount - vipCount;

  return (
    <div className="space-y-6 font-mono select-none">
      {/* 1. Header & Summary Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <div className="p-4 rounded-2xl bg-zinc-950 border border-white/15 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">TỔNG NGƯỜI DÙNG</span>
            <div className="text-2xl font-black font-cyber text-white mt-0.5">{totalCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-300">
            <Users className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950 border border-emerald-500/30 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-[10px] text-emerald-400 font-bold uppercase tracking-wider">VIP ACTIVE (ĐÃ MỞ)</span>
            <div className="text-2xl font-black font-cyber text-emerald-400 mt-0.5">{vipCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-950/40 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <Crown className="w-5 h-5" />
          </div>
        </div>

        <div className="p-4 rounded-2xl bg-zinc-950 border border-white/15 flex items-center justify-between shadow-xl">
          <div>
            <span className="text-[10px] text-slate-400 font-bold uppercase tracking-wider">GÓI MIỄN PHÍ (FREE)</span>
            <div className="text-2xl font-black font-cyber text-slate-300 mt-0.5">{freeCount}</div>
          </div>
          <div className="w-10 h-10 rounded-xl bg-white/5 border border-white/10 flex items-center justify-center text-slate-400">
            <ShieldCheck className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* 2. Control Bar: Search & Filter Tabs */}
      <div className="p-3 sm:p-4 rounded-2xl bg-zinc-950 border border-white/15 shadow-xl flex flex-col md:flex-row items-center justify-between gap-3">
        {/* Search Input */}
        <div className="relative w-full md:w-96">
          <Search className="w-4 h-4 text-slate-500 absolute left-3.5 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Tìm theo Email, Tên hoặc User ID..."
            className="w-full pl-10 pr-4 py-2 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs placeholder-slate-500 focus:outline-none focus:border-white transition-all font-mono"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-500 hover:text-white text-xs"
            >
              ×
            </button>
          )}
        </div>

        {/* Filter Pills & Refresh Button */}
        <div className="flex items-center gap-2 w-full md:w-auto justify-between md:justify-end">
          <div className="flex items-center gap-1 p-1 rounded-xl bg-zinc-900 border border-white/10 text-xs">
            <button
              onClick={() => setFilterType('all')}
              className={`px-3 py-1 rounded-lg font-bold uppercase tracking-wider transition-all ${
                filterType === 'all' ? 'bg-white text-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              TẤT CẢ ({totalCount})
            </button>
            <button
              onClick={() => setFilterType('vip')}
              className={`px-3 py-1 rounded-lg font-bold uppercase tracking-wider transition-all ${
                filterType === 'vip' ? 'bg-emerald-500 text-black shadow-md' : 'text-slate-400 hover:text-emerald-400'
              }`}
            >
              VIP ACTIVE ({vipCount})
            </button>
            <button
              onClick={() => setFilterType('free')}
              className={`px-3 py-1 rounded-lg font-bold uppercase tracking-wider transition-all ${
                filterType === 'free' ? 'bg-white text-black shadow-md' : 'text-slate-400 hover:text-white'
              }`}
            >
              FREE ({freeCount})
            </button>
          </div>

          <button
            onClick={fetchUsers}
            disabled={loading}
            title="Làm mới danh sách"
            className="p-2 rounded-xl bg-white/10 hover:bg-white text-white hover:text-black border border-white/20 transition-all active:scale-95 disabled:opacity-50 flex-shrink-0"
          >
            <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {/* 3. User Table */}
      <div className="rounded-2xl bg-zinc-950 border border-white/15 overflow-hidden shadow-2xl">
        <div className="overflow-x-auto no-scrollbar">
          <table className="w-full text-left text-xs border-collapse">
            <thead>
              <tr className="border-b border-white/10 bg-zinc-900/80 text-slate-400 uppercase font-cyber text-[10px] tracking-wider">
                <th className="py-3 px-4">NGƯỜI DÙNG (USER INFO)</th>
                <th className="py-3 px-4">NGÀY THAM GIA</th>
                <th className="py-3 px-4">TRẠNG THÁI VIP</th>
                <th className="py-3 px-4">HÌNH THỨC CẤP</th>
                <th className="py-3 px-4">GHI CHÚ ADMIN</th>
                <th className="py-3 px-4 text-right">HÀNH ĐỘNG</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 font-mono">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-400">
                    <Loader2 className="w-6 h-6 animate-spin mx-auto mb-2 text-white" />
                    <span>Đang tải danh sách người dùng...</span>
                  </td>
                </tr>
              ) : users.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <Users className="w-8 h-8 mx-auto mb-2 text-slate-600" />
                    <span>Không tìm thấy người dùng nào phù hợp.</span>
                  </td>
                </tr>
              ) : (
                users.map((u) => {
                  const isVip = isUserVip(u);
                  const isAdmin = u.role === 'admin';
                  const joinedDate = u.created_at ? new Date(u.created_at).toLocaleDateString('vi-VN') : 'Mới';

                  return (
                    <tr key={u.id} className="hover:bg-white/[0.03] transition-colors group">
                      {/* Column 1: User Profile & ID */}
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 rounded-xl bg-zinc-900 border border-white/20 flex items-center justify-center text-white font-extrabold text-xs flex-shrink-0">
                            {u.avatar_url ? (
                              <img src={u.avatar_url} alt="" className="w-full h-full object-cover rounded-xl" />
                            ) : (
                              (u.display_name || u.email || 'U').charAt(0).toUpperCase()
                            )}
                          </div>
                          <div className="flex flex-col min-w-0 max-w-[200px] sm:max-w-[260px]">
                            <div className="flex items-center gap-1.5 truncate">
                              <span className="font-cyber font-bold text-white truncate text-xs">
                                {u.display_name || u.email?.split('@')[0] || 'Vault Member'}
                              </span>
                              {isAdmin && (
                                <span className="px-1.5 py-0.2 rounded text-[8px] bg-red-500/20 text-red-400 border border-red-500/30 font-bold">
                                  ADMIN
                                </span>
                              )}
                            </div>
                            <span className="text-[10px] text-slate-400 truncate">{u.email}</span>
                            <div className="flex items-center gap-1 mt-0.5">
                              <span className="text-[9px] text-slate-500 truncate font-mono">ID: {u.id}</span>
                              <button
                                onClick={() => handleCopyId(u.id)}
                                title="Copy User ID"
                                className="text-slate-500 hover:text-white transition-colors"
                              >
                                {copiedId === u.id ? (
                                  <Check className="w-2.5 h-2.5 text-emerald-400" />
                                ) : (
                                  <Copy className="w-2.5 h-2.5" />
                                )}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Column 2: Joined Date */}
                      <td className="py-3 px-4 text-slate-400 text-[11px] tabular-nums whitespace-nowrap">
                        {joinedDate}
                      </td>

                      {/* Column 3: VIP Status Badge */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isVip ? (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-emerald-950/60 border border-emerald-500/40 text-emerald-300 font-extrabold text-[10px] shadow-sm">
                            <Crown className="w-3 h-3 text-emerald-400" />
                            <span>VIP ACTIVE</span>
                          </div>
                        ) : (
                          <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-zinc-900 border border-white/15 text-slate-400 font-bold text-[10px]">
                            <span className="w-1.5 h-1.5 rounded-full bg-slate-600" />
                            <span>CHƯA MỞ</span>
                          </div>
                        )}
                      </td>

                      {/* Column 4: Grant Method */}
                      <td className="py-3 px-4 whitespace-nowrap">
                        {isVip ? (
                          u.granted_by === 'PAYOS_GATEWAY' ? (
                            <span className="px-2 py-0.5 rounded-lg bg-blue-950/60 border border-blue-500/40 text-blue-300 text-[10px] font-bold">
                              payOS Auto
                            </span>
                          ) : u.granted_by === 'ADMIN_MANUAL' ? (
                            <span className="px-2 py-0.5 rounded-lg bg-amber-950/60 border border-amber-500/40 text-amber-300 text-[10px] font-bold">
                              Manual Admin
                            </span>
                          ) : (
                            <span className="px-2 py-0.5 rounded-lg bg-white/10 text-white text-[10px] font-bold">
                              {isAdmin ? 'Root Admin' : 'Active Pass'}
                            </span>
                          )
                        ) : (
                          <span className="text-slate-600 text-[11px]">-</span>
                        )}
                      </td>

                      {/* Column 5: Admin Note */}
                      <td className="py-3 px-4 text-slate-400 text-[11px] max-w-[180px] truncate">
                        {u.admin_note ? (
                          <span className="italic text-slate-300 truncate block" title={u.admin_note}>
                            {u.admin_note}
                          </span>
                        ) : (
                          <span className="text-slate-600">-</span>
                        )}
                      </td>

                      {/* Column 6: Action Button */}
                      <td className="py-3 px-4 text-right whitespace-nowrap">
                        {isAdmin ? (
                          <span className="text-[10px] text-slate-500 font-bold uppercase">Toàn quyền</span>
                        ) : isVip ? (
                          <button
                            onClick={() => handleOpenPermissionModal(u, false)}
                            className="px-3 py-1.5 rounded-xl bg-red-950/40 hover:bg-red-600 text-red-300 hover:text-white border border-red-500/40 text-[11px] font-extrabold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-md flex items-center gap-1.5 ml-auto"
                          >
                            <UserX className="w-3.5 h-3.5" />
                            <span>THU HỒI</span>
                          </button>
                        ) : (
                          <button
                            onClick={() => handleOpenPermissionModal(u, true)}
                            className="px-3 py-1.5 rounded-xl bg-emerald-950/40 hover:bg-emerald-500 text-emerald-300 hover:text-black border border-emerald-500/40 text-[11px] font-extrabold uppercase tracking-wider transition-all hover:scale-105 active:scale-95 shadow-md flex items-center gap-1.5 ml-auto"
                          >
                            <Crown className="w-3.5 h-3.5" />
                            <span>CẤP QUYỀN VIP</span>
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* 4. Interactive Permission Confirmation Modal */}
      {isModalOpen && selectedUser && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md animate-fadeIn">
          <div className="w-full max-w-md rounded-3xl bg-zinc-950 border border-white/20 shadow-2xl p-5 sm:p-6 space-y-4 font-mono">
            {/* Modal Header */}
            <div className="flex items-center justify-between pb-3 border-b border-white/10">
              <div className="flex items-center gap-2">
                <div className={`p-2 rounded-xl border ${
                  targetAccess ? 'bg-emerald-950/60 border-emerald-500/40 text-emerald-400' : 'bg-red-950/60 border-red-500/40 text-red-400'
                }`}>
                  {targetAccess ? <Crown className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                </div>
                <div>
                  <h3 className="font-cyber font-extrabold text-sm text-white uppercase tracking-wider">
                    {targetAccess ? 'XÁC NHẬN CẤP QUYỀN VIP' : 'XÁC NHẬN THU HỒI QUYỀN VIP'}
                  </h3>
                  <p className="text-[10px] text-slate-400 font-mono">
                    User: {selectedUser.email || selectedUser.display_name}
                  </p>
                </div>
              </div>
              <button
                onClick={() => setIsModalOpen(false)}
                className="p-1 rounded-full text-slate-400 hover:text-white"
              >
                ✕
              </button>
            </div>

            {/* Target User Info Summary */}
            <div className="p-3 rounded-xl bg-zinc-900 border border-white/10 space-y-1 text-xs">
              <div className="flex justify-between text-slate-400">
                <span>Tài khoản:</span>
                <span className="font-bold text-white">{selectedUser.display_name || 'Vault Member'}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>Email:</span>
                <span className="font-bold text-white">{selectedUser.email}</span>
              </div>
              <div className="flex justify-between text-slate-400">
                <span>User ID:</span>
                <span className="text-[10px] font-mono text-slate-500">{selectedUser.id}</span>
              </div>
            </div>

            {/* If Granting Access: Choose Plan & Presets */}
            {targetAccess && (
              <div className="space-y-3">
                <label className="block text-[11px] font-bold text-slate-300 uppercase">
                  Gói Quyền Hạn (Access Plan)
                </label>
                <div className="grid grid-cols-2 gap-2">
                  <button
                    type="button"
                    onClick={() => setTargetPlan('vip')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      targetPlan === 'vip'
                        ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-md'
                        : 'bg-zinc-900 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-xs">VIP 1 THÁNG</div>
                    <div className="text-[10px] opacity-70">Gói 49.000đ</div>
                  </button>

                  <button
                    type="button"
                    onClick={() => setTargetPlan('premium')}
                    className={`p-2.5 rounded-xl border text-left transition-all ${
                      targetPlan === 'premium'
                        ? 'bg-emerald-950/60 border-emerald-400 text-emerald-300 shadow-md'
                        : 'bg-zinc-900 border-white/10 text-slate-400 hover:text-white'
                    }`}
                  >
                    <div className="font-bold text-xs">VIP TRỌN ĐỜI</div>
                    <div className="text-[10px] opacity-70">Gói 199.000đ</div>
                  </button>
                </div>

                {/* Quick Presets for Admin Note */}
                <label className="block text-[11px] font-bold text-slate-300 uppercase mt-2">
                  Ghi chú giao dịch nhanh
                </label>
                <div className="flex flex-wrap gap-1.5">
                  {[
                    'Đã nhận 49k MB Bank',
                    'Đã nhận 199k Chuyển khoản',
                    'Đã nhận qua MoMo',
                    'Tặng VIP Trải nghiệm',
                  ].map((preset) => (
                    <button
                      key={preset}
                      type="button"
                      onClick={() => setAdminNote(preset)}
                      className={`px-2 py-1 rounded-lg text-[10px] font-bold border transition-all ${
                        adminNote === preset
                          ? 'bg-white text-black border-white'
                          : 'bg-zinc-900 border-white/15 text-slate-400 hover:text-white'
                      }`}
                    >
                      {preset}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Admin Note Custom Input */}
            <div className="space-y-1">
              <label className="block text-[11px] font-bold text-slate-300 uppercase">
                Ghi chú nội bộ Admin
              </label>
              <textarea
                value={adminNote}
                onChange={(e) => setAdminNote(e.target.value)}
                placeholder="Nhập ghi chú giao dịch hoặc lý do cấp/thu hồi..."
                rows={2}
                className="w-full p-2.5 rounded-xl bg-zinc-900 border border-white/15 text-white text-xs placeholder-slate-600 focus:outline-none focus:border-white transition-all font-mono"
              />
            </div>

            {/* Modal Actions */}
            <div className="flex items-center gap-2 pt-2">
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                className="flex-1 py-2.5 rounded-xl bg-zinc-900 hover:bg-zinc-800 text-slate-300 border border-white/15 text-xs font-bold uppercase transition-all"
              >
                HỦY BỎ
              </button>

              <button
                type="button"
                onClick={handleConfirmToggleAccess}
                disabled={submitting}
                className={`flex-1 py-2.5 rounded-xl text-xs font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 shadow-lg disabled:opacity-50 ${
                  targetAccess
                    ? 'bg-emerald-500 hover:bg-emerald-400 text-black shadow-emerald-500/20'
                    : 'bg-red-600 hover:bg-red-500 text-white shadow-red-600/20'
                }`}
              >
                {submitting ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : targetAccess ? (
                  <>
                    <Crown className="w-3.5 h-3.5" />
                    <span>CẤP VIP NGAY</span>
                  </>
                ) : (
                  <>
                    <UserX className="w-3.5 h-3.5" />
                    <span>THU HỒI NGAY</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
