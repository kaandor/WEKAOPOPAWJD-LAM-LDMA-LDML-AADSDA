
import { api } from "./api.js?v=20260213-final-fix";
import { applyGlobalTheme } from "./ui.js?v=20260213-final-fix"; // Import UI for Theme

// Apply theme immediately
applyGlobalTheme();

// Helper for URL params
const qs = (key) => new URLSearchParams(window.location.search).get(key);
let currentHls = null; // Global reference for cleanup

// Helper to proxy streams if needed (Mixed Content fix)
const PROXY_LIST = [
    "https://corsproxy.io/?", // Best public proxy (Restored)
    "https://api.codetabs.com/v1/proxy?quest=", // Good for redirects
    "https://cors.eu.org/", // Reliable alternative
    "https://proxy.cors.sh/", // New robust proxy
    "https://api.allorigins.win/raw?url=", // Backup
    "https://thingproxy.freeboard.io/fetch/", // Fallback
    "https://api.cors.lol/?url=", // Another backup
    "DIRECT_HTTPS" // Try upgrading to HTTPS last
];

function showStatus(msg) {
    let statusEl = document.getElementById('playerStatus');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'playerStatus';
        statusEl.style.position = 'absolute';
        statusEl.style.top = '10px';
        statusEl.style.left = '10px';
        statusEl.style.color = 'yellow';
        statusEl.style.background = 'rgba(0,0,0,0.5)';
        statusEl.style.padding = '5px';
        statusEl.style.zIndex = '1000';
        statusEl.style.fontSize = '12px';
        document.body.appendChild(statusEl);
    }
    statusEl.textContent = msg;
    console.log(`[PlayerStatus] ${msg}`);
}

function getProxiedStreamUrl(url, proxyIndex = 0) {
    if (!url) return '';
    
    const strategy = PROXY_LIST[proxyIndex];
    showStatus(`Tentando conectar (Método ${proxyIndex + 1}/${PROXY_LIST.length})...`);

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
    
    // Cleanup URL for proxies: remove port 80 if explicit, as some proxies choke on it
    let cleanUrl = url.replace(':80/', '/');
    
    const proxyBase = strategy;
    // Avoid double proxying
    if (url.includes('corsproxy.io') || url.includes('api.codetabs.com') || url.includes('api.allorigins.win') || url.includes('thingproxy.freeboard.io')) return url;
    
    // Special handling for corsproxy.io (should NOT be encoded usually)
    if (proxyBase.includes('corsproxy.io')) {
        return `${proxyBase}${cleanUrl}`;
    }
    
    // Default encoding for others (CodeTabs, CorsLoL, etc)
    return `${proxyBase}${encodeURIComponent(cleanUrl)}`;
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

        // Ensure episodes are sorted by Season then Episode
        episodes.sort((a, b) => {
            if (a.season_number !== b.season_number) return (a.season_number || 0) - (b.season_number || 0);
            return (a.episode_number || 0) - (b.episode_number || 0);
        });
        
        // Determine episode to play
        let epIndex = 0;
        const seasonParam = parseInt(qs('s'));
        const episodeParam = parseInt(qs('e'));
        
        if (!isNaN(seasonParam) && !isNaN(episodeParam)) {
            const foundIndex = episodes.findIndex(ep => ep.season_number === seasonParam && ep.episode_number === episodeParam);
            if (foundIndex !== -1) epIndex = foundIndex;
        }
        
        const ep = episodes[epIndex];
        
        return {
            ok: true,
            title: `${s.title} - S${ep.season_number}:E${ep.episode_number} ${ep.title}`,
            meta: s.title,
            streamUrl: ep.stream_url,
            streamUrlSub: ep.sub_url,
            category: s.category,
            seriesId: id,
            episodes: episodes,
            currentEpIndex: epIndex
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
                showStatus(`Erro na conexão. Tentando método alternativo (${proxyIndex + 2})...`);
                // Short delay to prevent rapid loops
                setTimeout(() => {
                    attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }, proxyIndex + 1, startTime);
                }, 1000);
            } else {
                console.error("All proxies failed.");
                showError("Erro: Não foi possível reproduzir no navegador. Tente abrir no App Externo.", {
                    text: "🎬 Abrir no VLC / Player Externo",
                    callback: () => window.open(streamUrl, '_blank')
                });
                showStatus("Falha: Todas as tentativas falharam.");
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

            // AUTO-LANDSCAPE & FULLSCREEN LOGIC
            // Attempt to force landscape or enter fullscreen on mobile
            const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
            if (isMobile) {
                try {
                    // iOS specific
                    if (video.webkitEnterFullscreen) {
                        video.webkitEnterFullscreen();
                    } 
                    // Android / Generic
                    else if (document.documentElement.requestFullscreen) {
                        await document.documentElement.requestFullscreen();
                        if (screen.orientation && screen.orientation.lock) {
                            screen.orientation.lock('landscape').catch(err => console.warn("Orientation lock failed:", err));
                        }
                    }
                } catch (e) {
                    console.warn("Fullscreen/Orientation failed:", e);
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
                    manifestLoadingTimeOut: 3000, // Reduced to 3s for faster failover
                    fragLoadingTimeOut: 3000,
                    levelLoadingTimeOut: 3000,
                    xhrSetup: function(xhr, url) {
                        // Hack to force some proxies to work better
                        if (url.includes('corsproxy.io')) {
                            // xhr.setRequestHeader('X-Requested-With', 'XMLHttpRequest');
                        }
                    }
                });
                currentHls = hls; // Save reference
                hls.loadSource(finalUrl);
                hls.attachMedia(video);
                hls.on(Hls.Events.MANIFEST_PARSED, () => {
                    showStatus(""); // Clear status on success
                    safePlay();
                });
                hls.on(Hls.Events.ERROR, (event, data) => {
                    console.warn("HLS Error Detail:", data.type, data.details, data.fatal);
                    
                    // Critical errors that require proxy switch
                    // We treat NETWORK_ERROR and Parsing Errors as fatal for the current proxy
                    const isCritical = data.fatal || 
                                       data.type === Hls.ErrorTypes.NETWORK_ERROR || 
                                       data.details === 'manifestParsingError' ||
                                       data.details === 'manifestLoadError' ||
                                       data.details === 'manifestParsersError';

                    if (isCritical) {
                        console.error("HLS Critical Error - Switching Proxy", data);
                        hls.destroy();
                        
                        if (proxyIndex < PROXY_LIST.length - 1) {
                            console.warn(`Proxy ${proxyIndex} failed (${data.details}). Switching to Proxy ${proxyIndex + 1}...`);
                            showStatus(`Erro HLS (${data.details}). Tentando método alternativo (${proxyIndex + 2})...`);
                            attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }, proxyIndex + 1, startTime);
                        } else {
                            showError("Erro: Fonte indisponível. Tente abrir no App Externo.", {
                                text: "🎬 Abrir no VLC / Player Externo",
                                callback: () => window.open(streamUrl, '_blank')
                            });
                            showStatus("Falha: Erro crítico HLS em todos os métodos.");
                        }
                        return;
                    }

                    // Non-critical errors: try to recover
                    if (data.type === Hls.ErrorTypes.MEDIA_ERROR) {
                        console.log("HLS Media Error - Recovering...");
                        hls.recoverMediaError();
                    } else {
                        // Other errors
                        console.log("HLS Minor Error - Ignoring", data);
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS Support (iOS / Safari)
                console.log("Using Native HLS Support");
                video.src = finalUrl;
                video.addEventListener('loadedmetadata', () => {
                showStatus(""); // Clear status
                safePlay();
            });
            video.addEventListener('error', (e) => {
                 console.error("Native HLS Error", video.error);
                 if (proxyIndex < PROXY_LIST.length - 1) {
                    showStatus(`Erro Nativo. Tentando método alternativo (${proxyIndex + 2})...`);
                    attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }, proxyIndex + 1, startTime);
                 } else {
                    showError("Erro: Formato não suportado. Tente abrir no App Externo.", {
                        text: "🎬 Abrir no VLC / Player Externo",
                        callback: () => window.open(streamUrl, '_blank')
                    });
                    showStatus("Falha: Erro Nativo em todos os métodos.");
                 }
            });
            } else {
                showError("Seu navegador não suporta HLS.");
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
        console.log(`[attachSource] Setting video.src to ${finalUrl}`);
        video.src = finalUrl;
        
        // MP4 Timeout Logic
        const mp4Timeout = setTimeout(() => {
            console.warn(`MP4 Load Timeout (${proxyIndex}). Switching...`);
            if (proxyIndex < PROXY_LIST.length - 1) {
                showStatus(`Tempo esgotado. Tentando método alternativo (${proxyIndex + 2})...`);
                attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }, proxyIndex + 1, startTime);
            } else {
                showError("Erro: Tempo limite excedido. Tente abrir no App Externo.", {
                    text: "🎬 Abrir no VLC / Player Externo",
                    callback: () => window.open(streamUrl, '_blank')
                });
            }
        }, 8000); // 8 seconds timeout

        video.addEventListener('loadedmetadata', () => {
            clearTimeout(mp4Timeout); // Clear timeout on success
            showStatus("");
            safePlay();
        }, { once: true });
        
        // Also clear on error (handled by onerror)
        video.addEventListener('error', () => clearTimeout(mp4Timeout), { once: true });
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
        
        // Strict check for duration
        if (Number.isFinite(video.duration) && video.duration > 1) {
            const time = (pct / 100) * video.duration;
            if (Number.isFinite(time)) {
                console.log(`[Seek] Committing to ${time}s`);
                
                // Safety check: Don't seek if duration is infinite (Live)
                if (video.duration === Infinity) return;
                
                // Ensure we mark as dragging until seek completes
                isDragging = true;
                video.currentTime = time;
            }
        } else {
             console.warn("Seek ignored: Invalid duration", video.duration);
             // Revert slider to 0 or current valid time if possible
             if (video.currentTime) {
                 const pct = (video.currentTime / video.duration) * 100;
                 if (Number.isFinite(pct)) progressBar.value = pct;
             } else {
                 progressBar.value = 0;
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

function showError(msg, action = null) {
    const overlay = document.getElementById('errorOverlay');
    const msgEl = document.getElementById('errorMsg');
    
    // Remove existing action button if any
    const existingBtn = document.getElementById('errorActionBtn');
    if (existingBtn) existingBtn.remove();

    if (overlay && msgEl) {
        msgEl.textContent = msg;
        overlay.style.display = 'flex';
        
        if (action) {
            const btn = document.createElement('button');
            btn.id = 'errorActionBtn';
            btn.textContent = action.text;
            btn.style.marginTop = '20px';
            btn.style.padding = '10px 20px';
            btn.style.background = '#e50914';
            btn.style.color = 'white';
            btn.style.border = 'none';
            btn.style.borderRadius = '4px';
            btn.style.cursor = 'pointer';
            btn.style.fontSize = '16px';
            btn.onclick = action.callback;
            
            // Append after message
            msgEl.parentNode.appendChild(btn);
        }
    }
}

// Series Navigation Logic
function setupSeriesControls(detail, video) {
    const btnNextEp = document.getElementById('btnNextEp');
    const btnEpList = document.getElementById('btnEpList');
    const epListModal = document.getElementById('epListModal');
    const epListContent = document.getElementById('epListContent');
    const closeEpListModal = document.getElementById('closeEpListModal');
    const nextEpOverlay = document.getElementById('nextEpOverlay');
    const nextEpTitle = document.getElementById('nextEpTitle');
    const nextEpProgress = document.getElementById('nextEpProgress');
    const btnPlayNextNow = document.getElementById('btnPlayNextNow');
    const btnCancelNext = document.getElementById('btnCancelNext');
    
    let { episodes, currentEpIndex, seriesId } = detail;
    let nextEpTimer = null;
    let isNextOverlayShown = false;

    // Helper to find next episode
    const hasNext = () => currentEpIndex < episodes.length - 1;
    const getNextEp = () => hasNext() ? episodes[currentEpIndex + 1] : null;

    // UI Updates
    const updateButtons = () => {
        if (btnNextEp) btnNextEp.style.display = hasNext() ? 'flex' : 'none';
        if (btnEpList) btnEpList.style.display = 'flex';
    };

    // Play Next Episode Logic
    const playNext = async () => {
        if (!hasNext()) return;
        
        const nextEp = getNextEp();
        
        // Update URL and Reload
        const newUrl = `./player.html?type=series&id=${seriesId}&s=${nextEp.season_number}&e=${nextEp.episode_number}`;
        window.location.href = newUrl;
    };

    // Wire up buttons
    if (btnNextEp) btnNextEp.onclick = (e) => {
        e.stopPropagation();
        playNext();
    };
    
    if (btnEpList) {
        btnEpList.onclick = (e) => {
            e.stopPropagation();
            // Populate list
            epListContent.innerHTML = '';
            
            // Group by season
            const seasons = {};
            episodes.forEach(ep => {
                const s = ep.season_number || 1;
                if (!seasons[s]) seasons[s] = [];
                seasons[s].push(ep);
            });
            
            const seasonKeys = Object.keys(seasons).sort((a,b) => a-b);
            
            seasonKeys.forEach(s => {
                const sTitle = document.createElement('div');
                sTitle.textContent = `Temporada ${s}`;
                sTitle.style.color = '#fff';
                sTitle.style.fontWeight = 'bold';
                sTitle.style.padding = '10px 5px';
                sTitle.style.marginTop = '10px';
                sTitle.style.borderBottom = '1px solid #333';
                epListContent.appendChild(sTitle);
                
                seasons[s].forEach(ep => {
                    const el = document.createElement('div');
                    const isCurrent = (ep.season_number === episodes[currentEpIndex].season_number && ep.episode_number === episodes[currentEpIndex].episode_number);
                    
                    el.style.padding = '10px';
                    el.style.cursor = 'pointer';
                    el.style.color = isCurrent ? '#9333ea' : '#aaa';
                    el.style.background = isCurrent ? 'rgba(147, 51, 234, 0.1)' : 'transparent';
                    el.style.borderBottom = '1px solid #333';
                    el.innerHTML = `<span style="font-weight:bold">${ep.episode_number}.</span> ${ep.title}`;
                    
                    el.onmouseover = () => { if(!isCurrent) el.style.background = 'rgba(255,255,255,0.05)'; };
                    el.onmouseout = () => { if(!isCurrent) el.style.background = 'transparent'; };
                    
                    el.onclick = () => {
                        window.location.href = `./player.html?type=series&id=${seriesId}&s=${ep.season_number}&e=${ep.episode_number}`;
                    };
                    
                    epListContent.appendChild(el);
                });
            });
            
            epListModal.style.display = 'flex';
        };
    }
    
    if (closeEpListModal) closeEpListModal.onclick = () => epListModal.style.display = 'none';
    if (epListModal) epListModal.onclick = (e) => { if (e.target === epListModal) epListModal.style.display = 'none'; };

    // Next Episode Overlay Logic
    if (btnPlayNextNow) btnPlayNextNow.onclick = playNext;
    if (btnCancelNext) btnCancelNext.onclick = () => {
        nextEpOverlay.style.display = 'none';
        isNextOverlayShown = true; // Prevent showing again for this playback
    };

    // Auto-play listener
    video.addEventListener('timeupdate', () => {
        if (!hasNext() || isNextOverlayShown) return;
        
        if (video.duration > 0 && (video.duration - video.currentTime <= 10)) {
            // Show overlay
            isNextOverlayShown = true;
            nextEpOverlay.style.display = 'block';
            
            const nextEp = getNextEp();
            nextEpTitle.textContent = `S${nextEp.season_number}:E${nextEp.episode_number} - ${nextEp.title}`;
            
            nextEpProgress.style.transition = 'none';
            nextEpProgress.style.width = '100%';
            
            // Force reflow
            void nextEpProgress.offsetWidth;
            
            const remaining = video.duration - video.currentTime;
            nextEpProgress.style.transition = `width ${remaining}s linear`;
            nextEpProgress.style.width = '0%';
        }
    });
    
    video.addEventListener('ended', () => {
        if (hasNext()) {
            playNext();
        }
    });
    
    updateButtons();
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
    
    let detail = null;

    try {
        detail = await loadDetail(type, id);
        if (!detail.ok) {
            if (window.finishLoading) window.finishLoading();
            showError(detail.error);
            return;
        }
        
        if (titleEl) titleEl.textContent = detail.title;
        if (metaEl) metaEl.textContent = detail.meta;

        // Add Persistent External Player Button
        const settingsBtn = document.getElementById('btnSettings');
        if (settingsBtn && settingsBtn.parentNode) {
            // Remove existing if any
            const existingExt = document.getElementById('btnExternalPlayer');
            if (existingExt) existingExt.remove();

            const extBtn = document.createElement('button');
            extBtn.id = 'btnExternalPlayer';
            extBtn.innerHTML = '<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"></path><polyline points="15 3 21 3 21 9"></polyline><line x1="10" y1="14" x2="21" y2="3"></line></svg>';
            extBtn.style.background = 'transparent';
            extBtn.style.border = 'none';
            extBtn.style.color = 'white';
            extBtn.style.cursor = 'pointer';
            extBtn.style.padding = '10px';
            extBtn.style.marginRight = '5px';
            extBtn.title = "Abrir em Player Externo (VLC)";
            extBtn.onclick = () => window.open(detail.streamUrl, '_blank');
            
            // Insert before settings button in its actual container
            settingsBtn.parentNode.insertBefore(extBtn, settingsBtn);
        }
        
        // iOS Audio Selection Prompt (User Request)
        // If on iOS and multiple audio tracks exist, ask user BEFORE playing (native player takes over)
        const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
        
        if (isIOS && detail.streamUrlAudio2) {
            // Force show settings modal or a custom one
            // We'll reuse settings UI but with a specific flow
            console.log("iOS detected with multiple audio tracks - showing prompt");
            
            if (window.finishLoading) window.finishLoading(); // Hide loading spinner so user can see prompt
            
            // Create a dedicated overlay for clarity
            const overlay = document.createElement('div');
            overlay.style.position = 'fixed';
            overlay.style.top = '0';
            overlay.style.left = '0';
            overlay.style.width = '100%';
            overlay.style.height = '100%';
            overlay.style.background = 'rgba(0,0,0,0.9)';
            overlay.style.zIndex = '9999';
            overlay.style.display = 'flex';
            overlay.style.flexDirection = 'column';
            overlay.style.justifyContent = 'center';
            overlay.style.alignItems = 'center';
            overlay.innerHTML = `
                <div style="background: #1f1f1f; padding: 20px; border-radius: 12px; width: 80%; max-width: 300px; text-align: center; border: 1px solid #333;">
                    <h3 style="color: white; margin-bottom: 20px;">Selecione o Áudio</h3>
                    <div id="iosAudioOptions" style="display: flex; flex-direction: column; gap: 10px;"></div>
                </div>
            `;
            document.body.appendChild(overlay);
            
            const optsContainer = overlay.querySelector('#iosAudioOptions');
            
            const startWith = async (url) => {
                overlay.remove();
                // Proceed with playback
                await attachSource({
                    video,
                    streamUrl: url,
                    streamUrlSub: detail.streamUrlSub,
                    streamType: url.includes('.m3u8') ? 'hls' : 'mp4',
                    ui: { subtitleSelect: null },
                    isLegendado: false
                });
                // Initialize other controls
                setupSettingsUI(video, { ...detail, currentStreamUrl: url });
                if (detail.episodes && detail.episodes.length > 0) setupSeriesControls(detail, video);
                setupCustomControls(video);
                setupAutoHide(video);
            };
            
            // Option 1
            const btn1 = document.createElement('button');
            btn1.textContent = "Áudio 1 (Dublado)";
            btn1.className = "btn-primary"; // Assuming global css has this, or style manually
            btn1.style.padding = "12px";
            btn1.style.background = "#9333ea";
            btn1.style.border = "none";
            btn1.style.borderRadius = "8px";
            btn1.style.color = "white";
            btn1.style.fontWeight = "bold";
            btn1.onclick = () => startWith(detail.streamUrl);
            optsContainer.appendChild(btn1);
            
            // Option 2
            const btn2 = document.createElement('button');
            btn2.textContent = "Áudio 2 (Legendado/Original)";
            btn2.style.padding = "12px";
            btn2.style.background = "rgba(255,255,255,0.1)";
            btn2.style.border = "1px solid rgba(255,255,255,0.2)";
            btn2.style.borderRadius = "8px";
            btn2.style.color = "white";
            btn2.style.fontWeight = "bold";
            btn2.onclick = () => startWith(detail.streamUrlAudio2);
            optsContainer.appendChild(btn2);
            
            return; // Stop execution here, wait for callback
        }
        
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

        // Initialize Series Controls
        if (detail.episodes && detail.episodes.length > 0) {
            setupSeriesControls(detail, video);
        }
        
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
        
        const errorMsg = e.message || "Erro interno no player.";
        const errorAction = (detail && detail.streamUrl) ? {
            text: "🎬 Abrir no VLC / Player Externo",
            callback: () => window.open(detail.streamUrl, '_blank')
        } : null;
        
        showError(errorMsg, errorAction);
    }
}
