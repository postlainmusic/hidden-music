@echo off
chcp 65001 > nul
echo ========================================================
echo   🚀 HIDDEN MUSIC VAULT - ONE-CLICK GIT & VERCEL DEPLOY
echo ========================================================
echo.
echo [*] Đang kiểm tra trạng thái Git...
git status
echo.
echo [*] Đang đóng gói toàn bộ thay đổi...
git add .
git commit -m "feat: sync updates to GitHub and trigger Vercel auto deploy" 2>nul
echo.
echo [*] Đang đẩy code lên GitHub (postlainmusic/hidden-music: main)...
echo [*] Nếu có cửa sổ đăng nhập GitHub hiện lên, vui lòng chọn "Sign in with your browser".
echo.
git push origin main
echo.
if %errorlevel% equ 0 (
    echo ========================================================
    echo   ✅ ĐÃ PUSH CODE THÀNH CÔNG LÊN GITHUB!
    echo   ⚡ Vercel đang tự động nhận diện và Deploy phiên bản mới...
    echo ========================================================
) else (
    echo ========================================================
    echo   ❌ Có lỗi xảy ra khi push. Vui lòng kiểm tra quyền tài khoản.
    echo ========================================================
)
echo.
pause
