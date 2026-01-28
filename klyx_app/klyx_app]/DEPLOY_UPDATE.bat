@echo off
echo ===================================================
echo   KLYX DEPLOYMENT & UPDATE TOOL
echo   Target: CanaisBR04.m3u (Override Active)
echo ===================================================

echo.
echo [1/3] Converting Playlist (CanaisBR04)...
cd klyx_web_export\www\_dev_tools
node convert_playlists.mjs
if %errorlevel% neq 0 (
    echo ERROR: Conversion failed.
    pause
    exit /b %errorlevel%
)

echo.
echo [2/3] Uploading to Firebase...
node upload_firebase.mjs
if %errorlevel% neq 0 (
    echo ERROR: Firebase upload failed.
    pause
    exit /b %errorlevel%
)

echo.
echo [3/3] Updating GitHub...
cd ..\..\..
git add klyx_web_export/www/assets/data/*.json
git commit -m "Update Klyx Data: CanaisBR04 Override"
git push origin main

echo.
echo ===================================================
echo   DEPLOYMENT COMPLETE!
echo ===================================================
pause
