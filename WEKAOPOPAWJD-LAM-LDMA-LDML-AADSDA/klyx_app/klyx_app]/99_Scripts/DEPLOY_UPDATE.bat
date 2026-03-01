@echo off
echo ===================================================
echo   KLYX DEPLOYMENT AND UPDATE TOOL
echo   Target: CanaisBR04.m3u (Override Active)
echo ===================================================

echo.
echo [1/3] Converting Playlist (CanaisBR04)...
cd ..\02_Deploy_Web\_dev_tools
call node convert_playlists.mjs
if %errorlevel% neq 0 (
    echo ERROR: Conversion failed.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Uploading to Firebase...
call node upload_firebase.mjs
if %errorlevel% neq 0 (
    echo ERROR: Firebase upload failed.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] Updating GitHub...
cd ..
git add assets/data/*.json
git commit -m "Update Klyx Data: CanaisBR04 Override"
git branch -M main
git push origin main

echo.
echo ===================================================
echo   DEPLOYMENT COMPLETE!
echo ===================================================
pause
