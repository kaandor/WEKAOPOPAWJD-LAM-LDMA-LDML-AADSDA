# Klyx Web App

Klyx is a modern web-based IPTV player with support for live TV, movies, and series.

## Features
- **Live TV**: Watch live channels with HLS support.
- **VOD**: Movies and Series with metadata and posters.
- **PWA**: Installable as a Progressive Web App.
- **Responsive Design**: Works on mobile, tablet, and desktop.
- **Firebase Sync**: Syncs playback progress across devices (requires Firebase configuration).

## Hosting on GitHub Pages
This project is ready to be hosted on GitHub Pages.
1. Push this repository to GitHub.
2. Go to **Settings** > **Pages**.
3. Select `main` branch and `/ (root)` folder.
4. Your site will be live at `https://yourusername.github.io/repo-name/`.

## Local Development
To run locally with proxy support (for improved CORS and stream compatibility):
```bash
node simple_server.js
```
Then open `http://localhost:8080`.

## Folder Structure
- `assets/`: Images and data files.
- `css/`: Stylesheets.
- `js/`: JavaScript logic.
- `_dev_tools/`: Utility scripts for playlist management.
