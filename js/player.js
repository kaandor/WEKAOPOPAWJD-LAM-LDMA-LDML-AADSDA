
import { api } from "./api.js";

// Helper for URL params
const qs = (key) => new URLSearchParams(window.location.search).get(key);
let currentHls = null; // Global reference for cleanup

// Helper to proxy streams if needed (Mixed Content fix)
const PROXY_LIST = [
    "DIRECT_HTTPS", // Try upgrading HTTP to HTTPS first
    "https://corsproxy.io/?",
    "https://api.codetabs.com/v1/proxy?quest="
];

function getProxiedStreamUrl(url, proxyIndex = 0) {
    if (!url) return '';
    
    const strategy = PROXY_LIST[proxyIndex];

    // Strategy 0: Direct HTTPS Upgrade
    if (strategy === "DIRECT_HTTPS") {
        if (url.startsWith('http://')) {
            // Replace http with https AND remove port 80 if present
            return url.replace('http://', 'https://').replace(':80/', '/');
        }
        return url;
    }
    
    // Strategy 1+: Proxies
    // If running on HTTPS and stream is HTTP, we MUST proxy (or have used Direct HTTPS above)
    // Or if we are forcing a proxy (proxyIndex > 0)
    
    const proxyBase = strategy;
    // Avoid double proxying
    if (url.includes('corsproxy.io') || url.includes('api.codetabs.com')) return url;
    
    return `${proxyBase}${encodeURIComponent(url)}`;
}

// Helper to toggle seek controls
function toggleSeekControls(enable) {
    const progressBar = document.getElementById('progressBar');
    const btnRewind = document.getElementById('btnRewind');
    const btnForward = document.getElementById('btnForward');
    const titleEl = document.getElementById('playerTitle');
    
    if (progressBar) {
        progressBar.disabled = !enable;
        progressBar.style.opacity = enable ? '1' : '0.5';
        progressBar.style.cursor = enable ? 'pointer' : 'not-allowed';
    }
    
    if (btnRewind) btnRewind.style.display = enable ? 'block' : 'none';
    if (btnForward) btnForward.style.display = enable ? 'block' : 'none';
    
    if (!enable && titleEl && !titleEl.textContent.includes('(Modo Compatibilidade)')) {
        titleEl.textContent += " (Modo Compatibilidade - Seek Desativado)";
    }
}

async function loadDetail(type, id) {
    console.log(`[loadDetail] Loading ${type} ${id}`);
    
    if (type === 'movie') {
        const res = await api.movies.get(id);
        if (!res.ok) return { ok: false, error: res.data?.error || "Erro ao carregar filme" };
        
        const m = res.data.item;
        console.log(`[loadDetail] Movie: ${m.title}, Audio2: ${m.stream_url_subtitled_version}`);
        return {
            ok: true,
            title: m.title,
            meta: `${m.rating ? '★ ' + m.rating : ''}`, // Date removed as requested
            streamUrl: m.stream_url,
            streamUrlAudio2: m.stream_url_subtitled_version, // New property for Subtitled version
            streamUrlSub: m.sub_url,
            category: m.category,
            episodes: [],
            currentEpIndex: -1
        };
    } 
    else if (type === 'series') {
        const res = await api.series.get(id);
        if (!res.ok) return { ok: false, error: res.data?.error || "Erro ao carregar série" };
        
        const s = res.data.item;
        const epsRes = await api.series.episodes(id);
        const episodes = epsRes.ok ? epsRes.data.episodes : [];
        
        if (episodes.length === 0) return { ok: false, error: "Nenhum episódio encontrado." };
        
        // Default to first episode
        const firstEp = episodes[0];
        
        return {
            ok: true,
            title: `${s.title} - S${firstEp.season_number}:E${firstEp.episode_number} ${firstEp.title}`,
            meta: s.title,
            streamUrl: firstEp.stream_url,
            streamUrlSub: firstEp.sub_url,
            category: s.category,
            seriesId: id,
            episodes: episodes,
            currentEpIndex: 0
        };
    }
    else if (type === 'episode') {
        const seriesId = qs("seriesId");
        if (!seriesId) return { ok: false, error: "ID da série ausente para reprodução de episódio." };
        
        const sRes = await api.series.get(seriesId);
        const sTitle = sRes.ok ? sRes.data.item.title : "Série";
        
        const epsRes = await api.series.episodes(seriesId);
        const episodes = epsRes.ok ? epsRes.data.episodes : [];
        
        const epIndex = episodes.findIndex(e => e.id === id);
        if (epIndex === -1) return { ok: false, error: "Episódio não encontrado." };
        
        const ep = episodes[epIndex];
        
        return {
            ok: true,
            title: `${sTitle} - S${ep.season_number}:E${ep.episode_number} ${ep.title}`,
            meta: sTitle,
            streamUrl: ep.stream_url,
            streamUrlSub: ep.sub_url,
            category: "Series",
            seriesId: seriesId,
            episodes: episodes,
            currentEpIndex: epIndex
        };
    }
    else if (type === 'live') {
        return { ok: false, error: "TV Ao Vivo não implementado nesta demo." };
    }
    
    return { ok: false, error: "Tipo de conteúdo desconhecido." };
}

// Track proxy attempts to prevent infinite loops
let currentProxyAttempt = 0;

async function attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }, proxyIndex = 0, startTime = 0) {
    console.log(`[attachSource] URL: ${streamUrl}, Type: ${streamType}, ProxyIndex: ${proxyIndex}, StartTime: ${startTime}`);
    
    // Cleanup previous HLS instance if exists
    if (currentHls) {
        currentHls.destroy();
        currentHls = null;
    }

    if (!streamUrl) {
        console.error("No stream URL provided");
        return;
    }

    // Apply proxy if needed
    let finalUrl = getProxiedStreamUrl(streamUrl, proxyIndex);
    
    // Check if we are on a "Bad Seek" proxy (CodeTabs)
    const isCodeTabs = finalUrl.includes('codetabs');
    
    if (isCodeTabs) {
        console.warn("Using CodeTabs proxy - Seeking might be unstable.");
    }

    // Fallback logic for error handling
    const handleVideoError = async (e) => {
        const error = video.error;
        console.error("Video Error:", error ? error.code : 'Unknown', error ? error.message : '');
        
        // Try next proxy if available and error is related to source/network
        if (error && (error.code === 3 || error.code === 4)) {
            if (proxyIndex < PROXY_LIST.length - 1) {
                console.warn(`Proxy ${proxyIndex} failed. Trying Proxy ${proxyIndex + 1}...`);
                // Short delay to prevent rapid loops
                setTimeout(() => {
                    attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }, proxyIndex + 1, startTime);
                }, 1000);
            } else {
                console.error("All proxies failed.");
                showError("Erro: Fonte de vídeo não suportada ou indisponível.");
            }
        }
    };

    // Remove existing error listeners
    video.onerror = handleVideoError;

    // Safe Play Helper to prevent AbortError & Handle Seek
    const safePlay = async () => {
        try {
            // Restore position if startTime is provided
            if (startTime > 0) {
                 console.log(`[safePlay] Restoring time to ${startTime}`);
                 
                 const attemptSeek = () => {
                     if (video.seekable.length > 0) {
                         video.currentTime = startTime;
                         return true;
                     }
                     return false;
                 };

                 if (!attemptSeek()) {
                     // If not seekable yet, wait for 'canplay'
                     const onCanPlay = () => {
                         attemptSeek();
                         video.removeEventListener('canplay', onCanPlay);
                     };
                     video.addEventListener('canplay', onCanPlay);
                     // Fallback: try setting it anyway
                     video.currentTime = startTime;
                 }
            }
            await video.play();
        } catch (err) {
            if (err.name !== 'AbortError') {
                console.warn("Play failed:", err);
            }
        }
    };

    if (finalUrl !== streamUrl) {
        console.log(`[attachSource] Proxied URL: ${finalUrl}`);
    }

    // Handle HLS
    if (streamType === 'hls' || streamUrl.includes('.m3u8')) {
        const loadHls = () => {
            if (Hls.isSupported()) {
                // Add timeouts to fail fast on bad proxies
                const hls = new Hls({
                    manifestLoadingTimeOut: 20000,
                    fragLoadingTimeOut: 20000,
                    levelLoadingTimeOut: 20000
                });
                currentHls = hls; // Save reference
                hls.loadSource(finalUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => safePlay());
                hls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        console.error("HLS Fatal Error", data);
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                // If it's a 403/404 or manifest error, try next proxy immediately
                                if (data.response && (data.response.code === 403 || data.response.code === 404)) {
                                     console.warn("HLS Network Error (403/404) - Switching proxy");
                                     hls.destroy();
                                     if (proxyIndex < PROXY_LIST.length - 1) {
                                         attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }, proxyIndex + 1, startTime);
                                     } else {
                                         showError("Erro: Fonte de vídeo indisponível.");
                                     }
                                     return;
                                }
                                console.log("HLS Network Error - Retrying...");
                                hls.startLoad();
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.log("HLS Media Error - Recovering...");
                                hls.recoverMediaError();
                                break;
                            default:
                                hls.destroy();
                                // Trigger video error to handle proxy switch
                                if (proxyIndex < PROXY_LIST.length - 1) {
                                     attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }, proxyIndex + 1, startTime);
                                }
                                break;
                        }
                    } else if (data.details === Hls.ErrorDetails.MANIFEST_PARSING_ERROR) {
                        // Non-fatal but critical parsing error (often means proxy returned HTML)
                        console.warn("HLS Manifest Parsing Error - Switching proxy");
                        hls.destroy();
                        if (proxyIndex < PROXY_LIST.length - 1) {
                             attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }, proxyIndex + 1, startTime);
                        }
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Safari / Native HLS
                video.src = finalUrl;
                video.addEventListener('loadedmetadata', () => {
                    safePlay();
                }, { once: true });
            } else {
                console.error("HLS not supported");
            }
        };

        if (window.Hls) {
            loadHls();
        } else {
            // Wait for HLS to load
            const checkHls = setInterval(() => {
                if (window.Hls) {
                    clearInterval(checkHls);
                    loadHls();
                }
            }, 100);
            // Timeout after 5s
            setTimeout(() => clearInterval(checkHls), 5000);
        }
    } else {
        // Direct file (MP4/MKV)
        video.src = finalUrl;
        video.addEventListener('loadedmetadata', () => {
            safePlay();
        }, { once: true });
    }
    
    // Subtitles (keep existing logic)
    if (ui && ui.subtitleSelect) {
        // ... (rest of subtitle logic is unused but kept for compatibility)
    }
}

function setupSettingsUI(video, data) {
    const btnSettings = document.getElementById('btnSettings');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const audioOptions = document.getElementById('audioOptions');
    
    if (!btnSettings || !settingsModal) return;
    
    // Toggle Modal
    btnSettings.onclick = (e) => {
        e.stopPropagation();
        const isHidden = settingsModal.style.display === 'none';
        settingsModal.style.display = isHidden ? 'block' : 'none';
    };
    
    closeSettings.onclick = () => settingsModal.style.display = 'none';
    
    // Close when clicking outside
    document.addEventListener('click', (e) => {
        if (!settingsModal.contains(e.target) && !btnSettings.contains(e.target)) {
            settingsModal.style.display = 'none';
        }
    });

    // Populate Audio Options
    audioOptions.innerHTML = '';
    
    const createOption = (label, url, isActive) => {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.style.width = '100%';
        btn.style.textAlign = 'left';
        btn.style.padding = '10px';
        btn.style.background = isActive ? '#9333ea' : 'rgba(255,255,255,0.1)';
        btn.style.border = 'none';
        btn.style.borderRadius = '4px';
        btn.style.color = 'white';
        btn.style.cursor = 'pointer';
        btn.style.marginBottom = '5px';
        btn.style.fontSize = '14px';
        
        if (!isActive) {
            btn.onmouseover = () => btn.style.background = 'rgba(255,255,255,0.2)';
            btn.onmouseout = () => btn.style.background = 'rgba(255,255,255,0.1)';
        }

        btn.onclick = async () => {
            if (isActive) return;
            
            // Switch Audio
            const currentTime = video.currentTime;
            const wasPlaying = !video.paused;
            
            // Update UI
            setupSettingsUI(video, { ...data, currentStreamUrl: url }); // Re-render with new active
            
            await attachSource({
                video,
                streamUrl: url,
                streamUrlSub: data.streamUrlSub, // Keep subtitles
                streamType: url.includes('.m3u8') ? 'hls' : 'mp4',
                ui: { subtitleSelect: null },
                isLegendado: false
            }, 0, currentTime); // Pass currentTime to restore
            
            settingsModal.style.display = 'none';
        };
        
        return btn;
    };

    // Determine current active URL
    const currentUrl = data.currentStreamUrl || data.streamUrl;
    
    // Option 1: Dublado (Default)
    audioOptions.appendChild(createOption(
        "Áudio 1", 
        data.streamUrl, 
        currentUrl === data.streamUrl
    ));
    
    // Option 2: Legendado (if available)
    if (data.streamUrlAudio2) {
        audioOptions.appendChild(createOption(
            "Áudio 2", 
            data.streamUrlAudio2, 
            currentUrl === data.streamUrlAudio2
        ));
    }
}

function setupCustomControls(video) {
    const btnPlay = document.getElementById('btnPlay');
    const iconPlay = document.getElementById('iconPlay');
    const iconPause = document.getElementById('iconPause');
    const btnRewind = document.getElementById('btnRewind');
    const btnForward = document.getElementById('btnForward');
    const progressBar = document.getElementById('progressBar');
    const timeCurrent = document.getElementById('timeCurrent');
    const timeDuration = document.getElementById('timeDuration');

    if (!btnPlay) return;

    // Helper: Format time
    const formatTime = (seconds) => {
        if (!seconds || isNaN(seconds)) return "0:00";
        const h = Math.floor(seconds / 3600);
        const m = Math.floor((seconds % 3600) / 60);
        const s = Math.floor(seconds % 60);
        if (h > 0) return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
        return `${m}:${s.toString().padStart(2, '0')}`;
    };

    // Toggle Play
    const togglePlay = () => {
        if (video.paused) video.play();
        else video.pause();
    };

    btnPlay.onclick = (e) => {
        e.stopPropagation();
        togglePlay();
    };
    
    // Update Icons
    const updatePlayIcon = () => {
        if (video.paused) {
            iconPlay.style.display = 'block';
            iconPause.style.display = 'none';
        } else {
            iconPlay.style.display = 'none';
            iconPause.style.display = 'block';
        }
    };
    
    video.addEventListener('play', updatePlayIcon);
    video.addEventListener('pause', updatePlayIcon);
    
    // Seek Helper
    const performSeek = (delta) => {
        if (!Number.isFinite(video.currentTime)) return;
        
        const current = video.currentTime;
        let target = current + delta;

        // Constraints
        if (target < 0) target = 0;
        if (Number.isFinite(video.duration) && video.duration > 0) {
            if (target > video.duration) target = video.duration;
        }

        console.log(`[Seek] Button seek: ${current} -> ${target}`);
        
        // Ensure we don't seek if the video is not ready
        if (video.readyState < 1) {
             console.warn("Video not ready for seek");
             return;
        }

        // Set dragging true to prevent timeupdate from resetting UI immediately
        isDragging = true;
        
        try {
            if (Number.isFinite(video.duration) && Math.abs(target - current) > 10 && typeof video.fastSeek === 'function') {
                video.fastSeek(target);
            } else {
                video.currentTime = target;
            }
        } catch (e) {
            console.warn("fastSeek failed, falling back to currentTime", e);
            video.currentTime = target;
        }
        
        // Release dragging after a moment
        clearTimeout(seekTimeout);
        seekTimeout = setTimeout(() => {
            isDragging = false;
        }, 1000); // Give it 1s to settle

        if (window.resetControlsTimer) window.resetControlsTimer();
    };

    // Seek Buttons
    btnRewind.onclick = (e) => {
        e.stopPropagation();
        performSeek(-10);
    };
    
    btnForward.onclick = (e) => {
        e.stopPropagation();
        performSeek(10);
    };

    // Progress Bar Logic with Dragging State
    let isDragging = false;
    let seekTimeout;

    const updateSliderVisuals = (pct) => {
        progressBar.style.background = `linear-gradient(to right, #9333ea ${pct}%, rgba(255,255,255,0.3) ${pct}%)`;
    };

    const onInput = (e) => {
        // User is dragging/scrubbing
        isDragging = true;
        const pct = parseFloat(e.target.value);
        updateSliderVisuals(pct);
        
        // Update text time only (Visual feedback)
        if (Number.isFinite(video.duration) && video.duration > 0) {
            const time = (pct / 100) * video.duration;
            timeCurrent.textContent = formatTime(time);
        }
        
        if (window.resetControlsTimer) window.resetControlsTimer();
    };

    const onSeekCommit = (e) => {
        // User released the handle
        const pct = parseFloat(progressBar.value);
        
        if (Number.isFinite(video.duration) && video.duration > 0) {
            const time = (pct / 100) * video.duration;
            if (Number.isFinite(time)) {
                console.log(`[Seek] Committing to ${time}s`);
                
                // Safety check: Don't seek if duration is infinite (Live) or 0
                if (video.duration === Infinity) return;
                
                // Ensure we mark as dragging until seek completes
                isDragging = true;
                video.currentTime = time;
            }
        }
        
        // Clear dragging flag after a short delay
        clearTimeout(seekTimeout);
        seekTimeout = setTimeout(() => {
            isDragging = false;
        }, 1000); // Increased to 1s for stability

        if (window.resetControlsTimer) window.resetControlsTimer();
    };

    // Event Listeners
    progressBar.addEventListener('input', onInput);
    progressBar.addEventListener('change', onSeekCommit);
    
    // Touch/Mouse specific handling for start/end
    const startDrag = () => { isDragging = true; };
    const endDrag = (e) => { 
        // We rely on 'change' for the seek, but ensure isDragging is managed
        // If 'change' doesn't fire for some reason (e.g. strict touch), we might need to force it
        // But usually 'change' is reliable on inputs.
        // We just ensure visuals are kept if user holds without moving.
        if (window.resetControlsTimer) window.resetControlsTimer();
    };

    progressBar.addEventListener('mousedown', startDrag);
    progressBar.addEventListener('touchstart', startDrag, { passive: true });
    
    // We don't strictly need mouseup/touchend if we use 'change', 
    // but they help keep controls visible
    progressBar.addEventListener('mouseup', endDrag);
    progressBar.addEventListener('touchend', endDrag);

    video.addEventListener('timeupdate', () => {
        // Always update text time if NOT dragging (to avoid fighting user)
        if (!isDragging) {
            timeCurrent.textContent = formatTime(video.currentTime);
            
            if (Number.isFinite(video.duration)) {
                timeDuration.textContent = formatTime(video.duration);
                
                // Update slider position
                if (video.duration > 0) {
                    const pct = (video.currentTime / video.duration) * 100;
                    progressBar.value = pct;
                    updateSliderVisuals(pct);
                }
            }
        }
    });
    
    // Click on video to toggle
    video.onclick = (e) => {
        // Only if controls are visible (or maybe always?)
        // Better behavior: single tap shows controls, tap on center toggles play?
        // For now, let's keep it simple: tap toggles play if controls are visible, or shows controls if hidden
        // Actually, setupAutoHide handles showing controls on click.
        // Let's make video click toggle play only if we are not dragging or interacting
        togglePlay();
        if (window.resetControlsTimer) window.resetControlsTimer();
    };
}

function setupAutoHide(video) {
    let timeout;
    const controls = document.querySelector('.controls-top');
    const customControls = document.getElementById('customControls');
    const backBtn = document.getElementById('backBtn');
    
    const show = () => {
        if (controls) controls.style.opacity = '1';
        if (customControls) customControls.style.opacity = '1';
        if (backBtn) backBtn.style.opacity = '1';
        document.body.style.cursor = 'auto';
        
        clearTimeout(timeout);
        timeout = setTimeout(hide, 3000);
    };
    
    const hide = () => {
        if (video.paused) return; 
        if (controls) controls.style.opacity = '0';
        if (customControls) customControls.style.opacity = '0';
        if (backBtn) backBtn.style.opacity = '0';
        document.body.style.cursor = 'none';
    };
    
    window.resetControlsTimer = show;
    window.hideControlsNow = hide;
    
    document.addEventListener('mousemove', show);
    document.addEventListener('click', show);
    document.addEventListener('keydown', show);
    document.addEventListener('touchstart', show);
    
    show();
}

// Add HLS.js script dynamically if not present
if (!window.Hls) {
    const script = document.createElement('script');
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@latest";
    script.onload = () => console.log("HLS.js loaded dynamically");
    document.head.appendChild(script);
}

function showError(msg) {
    const overlay = document.getElementById('errorOverlay');
    const msgEl = document.getElementById('errorMsg');
    if (overlay && msgEl) {
        msgEl.textContent = msg;
        overlay.style.display = 'flex';
    }
}

export async function initPlayer() {
    console.log("Player Initialized v2 - Debug Check");
    if (typeof getProxiedStreamUrl !== 'function') {
        console.error("CRITICAL: getProxiedStreamUrl is NOT defined!");
    } else {
        console.log("getProxiedStreamUrl is defined and ready.");
    }
    
    const type = qs('type');
    const id = qs('id');
    
    if (!type || !id) {
        showError("Parâmetros inválidos.");
        return;
    }
    
    const video = document.getElementById('video');
    const titleEl = document.getElementById('playerTitle');
    const metaEl = document.getElementById('playerMeta');
    
    // Back button logic
    const backBtn = document.getElementById('backBtn');
    if (backBtn) {
        backBtn.onclick = () => window.history.back();
    }
    
    // Save Progress Logic
    let lastSave = 0;
    const saveProgress = () => {
        if (!video || !id || !video.duration) return;
        const now = Date.now();
        // Throttle 5s unless paused/ended
        if (now - lastSave < 5000 && !video.paused && !video.ended) return;
        
        lastSave = now;
        api.playback.saveProgress(id, video.currentTime, video.duration, type);
    };
    
    video.addEventListener('timeupdate', saveProgress);
    video.addEventListener('pause', () => saveProgress());
    window.addEventListener('beforeunload', () => saveProgress());
    
    try {
        const detail = await loadDetail(type, id);
        if (!detail.ok) {
            if (window.finishLoading) window.finishLoading();
            showError(detail.error);
            return;
        }
        
        if (titleEl) titleEl.textContent = detail.title;
        if (metaEl) metaEl.textContent = detail.meta;
        
        await attachSource({
            video,
            streamUrl: detail.streamUrl,
            streamUrlSub: detail.streamUrlSub,
            streamType: detail.streamUrl && detail.streamUrl.includes('.m3u8') ? 'hls' : 'mp4',
            ui: { subtitleSelect: null },
            isLegendado: false
        });
        
        // Initialize Settings UI
        setupSettingsUI(video, detail);
        
        // Initialize Custom Controls
        setupCustomControls(video);
        
        // Restore Progress
        const progressRes = await api.playback.getProgress(id);
        if (progressRes.ok && progressRes.data.progress > 0) {
            const savedTime = progressRes.data.progress;
            const restore = () => {
                // If saved time is valid and not practically finished (leave 2 mins buffer or 95%)
                if (savedTime < video.duration - 60) { 
                    video.currentTime = savedTime;
                    // Show a toast? Optional.
                    console.log(`Restored progress: ${savedTime}`);
                }
            };
            
            if (video.readyState >= 1) restore();
            else video.addEventListener('loadedmetadata', restore, { once: true });
        }
        
        if (window.finishLoading) window.finishLoading();
        setupAutoHide(video);
        
    } catch (e) {
        console.error("Player Error:", e);
        if (window.finishLoading) window.finishLoading();
        showError("Erro interno no player.");
    }
}
