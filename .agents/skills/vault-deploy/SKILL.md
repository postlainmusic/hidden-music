---
name: vault-deploy
description: >-
  Kỹ năng quản lý kiểm thử, đóng gói commit và đồng bộ deploy tự động lên GitHub và Vercel cho Hidden Music Vault.
---

# 🚀 Vault Deploy & Verification Workflow

Kỹ năng này chịu trách nhiệm cho chu trình kiểm thử và tự động đẩy code lên repository.

## 1. Các bước thực thi
1. **Kiểm tra cú pháp & tính tương thích**:
   - Rà soát các import và export không bị thiếu.
   - Kiểm tra các biến môi trường trong `.env.local` (`NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`).
2. **Kiểm tra trạng thái Git**:
   ```bash
   git status
   ```
3. **Commit theo chuẩn Conventional Commits**:
   ```bash
   git add .
   git commit -m "feat: <mô tả tính năng ngắn gọn>"
   ```
4. **Push lên GitHub**:
   ```bash
   git push origin main
   ```
   *Lưu ý: Ngay sau khi push hoàn tất, Vercel CI/CD sẽ tự động bắt sự kiện và deploy bản cập nhật mới.*
