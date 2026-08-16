# One-Click Deploy Script for PowerShell
$OutputEncoding = [Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Write-Host "========================================================" -ForegroundColor Cyan
Write-Host "  🚀 HIDDEN MUSIC VAULT - AUTO DEPLOY SYNC" -ForegroundColor Cyan
Write-Host "========================================================" -ForegroundColor Cyan

$env:Path = "C:\Program Files\Git\cmd;C:\Program Files\Git\bin;" + $env:Path

Write-Host "`n[*] Đang đóng gói các thay đổi mới nhất..." -ForegroundColor Yellow
git add .
git commit -m "feat: sync updates to GitHub and trigger Vercel auto deploy" 2>$null

Write-Host "`n[*] Đang đẩy code lên GitHub (postlainmusic/hidden-music: main)..." -ForegroundColor Yellow
git push origin main

if ($LASTEXITCODE -eq 0) {
    Write-Host "`n========================================================" -ForegroundColor Green
    Write-Host "  ✅ ĐÃ PUSH CODE THÀNH CÔNG LÊN GITHUB!" -ForegroundColor Green
    Write-Host "  ⚡ Vercel CI/CD đang tự động Build & Deploy..." -ForegroundColor Green
    Write-Host "========================================================`n" -ForegroundColor Green
} else {
    Write-Host "`n[!] Lỗi push code. Vui lòng xác thực tài khoản GitHub nếu được yêu cầu.`n" -ForegroundColor Red
}
