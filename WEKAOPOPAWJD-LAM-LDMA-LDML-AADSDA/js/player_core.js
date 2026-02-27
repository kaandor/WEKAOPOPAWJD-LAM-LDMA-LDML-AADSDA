import { api } from "./api.js?v=20260225-v1";
import { applyGlobalTheme } from "./ui.js?v=20260225-v1"; // Import UI for Theme

// Apply theme immediately
applyGlobalTheme();

// Helper for URL params
const qs = (key) => new URLSearchParams(window.location.search).get(key);
let currentHls = null; // Global reference for cleanup
let isSwitchingSource = false; // Lock to prevent race conditions during proxy switch
let retryTimeout = null; // Global retry timer to prevent double-firing
let loadingWatchdog = null; // Watchdog to detect stuck loading

// Helper to proxy streams if needed (Mixed Content fix)
const PROXY_LIST = [
    "https://corsproxy.io/?",
    "https://klyx-api.vercel.app/api/proxy?url=",
    "https://api.codetabs.com/v1/proxy?quest=",
    "https://api.allorigins.win/raw?url="
];

const AD_CLIENT = "ca-pub-5929082469611228";
const MOVIE_AD_SLOTS = ["1234567890"];
const SERIES_AD_SLOTS = ["1234567890"];

function wait(ms) {
    return new Promise((resolve) => setTimeout(resolve, ms));
}

// --- IMA SDK REMOVED / ADSTERRA PREPARATION ---
// Removed complex IMA SDK logic as per user request to switch to Adsterra.
// This function now simply resolves immediately to allow video playback.

async function setupIMAAds(videoElem) {
    console.log("[Adsterra] Player ads disabled. Content will play immediately.");
    if (window.finishLoading) window.finishLoading();
    return Promise.resolve();
}



function showStatus(msg) {
    let statusEl = document.getElementById('playerStatus');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'playerStatus';
        statusEl.style.position = 'fixed';
        statusEl.style.top = '20px';
        statusEl.style.left = '50%';
        statusEl.style.transform = 'translateX(-50%)';
        statusEl.style.color = 'white';
        statusEl.style.background = 'rgba(255, 0, 0, 0.8)'; // Red background for visibility
        statusEl.style.padding = '10px 20px';
        statusEl.style.zIndex = '21005'; // Above everything including ads/loading
        statusEl.style.fontSize = '14px';
        statusEl.style.borderRadius = '4px';
        statusEl.style.fontWeight = 'bold';
        statusEl.style.boxShadow = '0 4px 10px rgba(0,0,0,0.5)';
        statusEl.style.pointerEvents = 'none';
        statusEl.style.transition = 'opacity 0.3s ease';
        document.body.appendChild(statusEl);
    }
    statusEl.textContent = msg;
    statusEl.style.opacity = '1';
    console.log(`[PlayerStatus] ${msg}`);
    
    // Auto-hide after 5 seconds
    if (window._statusTimer) clearTimeout(window._statusTimer);
    window._statusTimer = setTimeout(() => {
        if (statusEl) statusEl.style.opacity = '0';
    }, 5000);
}

function getProxiedStreamUrl(url, index = 0) {
    if (!url) return '';
    const proxyBase = PROXY_LIST[index] || PROXY_LIST[0];
    const proxyName = ["CorsProxy", "Vercel", "CodeTabs", "AllOrigins"][index] || "Proxy";
    
    // Only show "Conectando" status if we are NOT in ad phase
    // But since this is called during attachSource (post-ad), it's fine.
    // However, we want to be more specific.
    showStatus(`Conectando ao filme via ${proxyName}...`);
    
    // Clean URL (remove port 80 if present to avoid proxy issues)
    const cleanUrl = url.replace(':80/', '/');
    
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
        const res = await api.live.get(id);
        if (!res.ok) {
            return { ok: false, error: res.data?.error || "Erro ao carregar canal ao vivo." };
        }

        const ch = res.data;
        return {
            ok: true,
            title: ch.title,
            meta: ch.meta || ch.category || "Canal ao vivo",
            streamUrl: ch.streamUrl,
            streamUrlAudio2: null,
            streamUrlSub: null,
            category: ch.category || "Live",
            episodes: [],
            currentEpIndex: -1
        };
    }
    
    return { ok: false, error: "Tipo de conteúdo desconhecido." };
}

// Track proxy attempts to prevent infinite loops
let currentProxyAttempt = 0;

async function attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }, proxyIndex = 0, startTime = 0) {
    console.log(`[attachSource] URL: ${streamUrl}, Type: ${streamType}, ProxyIndex: ${proxyIndex}, StartTime: ${startTime}`);
    
    // Clear any pending retries
    if (retryTimeout) clearTimeout(retryTimeout);
    
    // Lock to prevent race conditions
    isSwitchingSource = true;
    
    // Cleanup previous HLS instance if exists
    if (currentHls) {
        currentHls.destroy();
        currentHls = null;
    }

    // Unlock after 100ms to allow events to settle but not block fast failures
    setTimeout(() => { isSwitchingSource = false; }, 100);

    // START LOADING WATCHDOG
    if (loadingWatchdog) clearTimeout(loadingWatchdog);
    loadingWatchdog = setTimeout(() => {
        console.warn("[Watchdog] Video load timed out (12s). Forcing proxy switch.");
        // Force unlock for watchdog
        isSwitchingSource = false; 
        handleVideoError({ code: 'TIMEOUT', message: 'Loading timed out' });
    }, 12000); // 12 seconds max for loading (increased from 8s)

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

    let triedAlternateHls = false;
    const getAlternateHlsUrl = (u) => {
        if (!u) return null;
        if (u.includes('.mp4')) {
            const base = u.replace(/\.mp4(\?.*)?$/, '');
            const candidates = [`${base}.m3u8`, `${base}/index.m3u8`, `${base}/playlist.m3u8`];
            return candidates[0];
        }
        return null;
    };

    // Fallback logic for error handling
    const handleVideoError = async (e) => {
        if (isSwitchingSource) {
             console.warn("Ignoring error during source switch.");
             return;
        }

        const code = (e && e.code) ? e.code : (video.error ? video.error.code : 'UNKNOWN');
        const message = (e && e.message) ? e.message : (video.error ? video.error.message : '');
        console.error("Video/HLS Error:", code, message);
        
        // Ignore AbortError (Code 1) as it's usually triggered by us switching sources
        if (code === 1 || code === 'ABORT_ERR') {
            console.warn("Ignoring AbortError (User/Script cancelled).");
            return;
        }

        if (!triedAlternateHls) {
            const alt = getAlternateHlsUrl(streamUrl);
            if (alt) {
                triedAlternateHls = true;
                attachSource({ video, streamUrl: alt, streamUrlSub, streamType: 'hls', ui, isLegendado }, 0, startTime);
                return;
            }
        }

        // Try next proxy on ANY error (unless we exhausted the list)
        if (proxyIndex < PROXY_LIST.length - 1) {
            console.warn(`Proxy ${proxyIndex} failed. Trying Proxy ${proxyIndex + 1}...`);
            showStatus(`Conexão instável. Tentando servidor ${proxyIndex + 2}...`);
            
            // Clear previous timeout and set new one (Debounce retry)
            if (retryTimeout) clearTimeout(retryTimeout);
            retryTimeout = setTimeout(() => {
                attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }, proxyIndex + 1, startTime);
            }, 500); // Reduced from 2000ms to 500ms for faster failover
        } else {
            console.error("All proxies failed.");
            showError(
                "Erro: Não foi possível carregar o vídeo aqui. Você pode tentar abrir no player externo.",
                createExternalAction(streamUrl)
            );
        }
    };

    // Remove existing error listeners (handled by assignment below)
    video.onerror = handleVideoError;
    
    // Clear watchdog on success events
    const clearWatchdog = () => {
        if (loadingWatchdog) {
            console.log("[Watchdog] Video success/progress detected. Watchdog cleared.");
            clearTimeout(loadingWatchdog);
            loadingWatchdog = null;
        }
    };
    video.onplaying = clearWatchdog;
    video.ontimeupdate = clearWatchdog;
    video.onloadedmetadata = clearWatchdog; // Key success indicator
    video.onloadeddata = clearWatchdog;

    // Safe Play Helper to prevent AbortError & Handle Seek
    const safePlay = async () => {
        // Clear Watchdog on successful play attempt (will be re-cleared on playing event)
        // Note: We don't clear it here immediately because play() might hang. 
        // We rely on 'playing' or 'timeupdate' events to clear it.
        
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
                // If switching from MP4 to HLS, we need to create a new Hls instance
                if (!currentHls) {
                    currentHls = new Hls({
                        debug: false,
                        enableWorker: true,
                        lowLatencyMode: true,
                        backBufferLength: 90
                    });
                }
                
                currentHls.loadSource(finalUrl);
                currentHls.attachMedia(video);
                
                currentHls.on(Hls.Events.MANIFEST_PARSED, () => {
                    console.log("HLS Manifest Parsed");
                    safePlay();
                });
                
                currentHls.on(Hls.Events.ERROR, (event, data) => {
                    if (data.fatal) {
                        switch (data.type) {
                            case Hls.ErrorTypes.NETWORK_ERROR:
                                console.error("HLS Network Error - Switching Proxy");
                                currentHls.destroy();
                                handleVideoError({ code: 'HLS_NETWORK_ERROR' }); 
                                break;
                            case Hls.ErrorTypes.MEDIA_ERROR:
                                console.error("HLS Media Error - Recovering");
                                currentHls.recoverMediaError();
                                break;
                            default:
                                currentHls.destroy();
                                handleVideoError({ code: 'HLS_FATAL_ERROR' });
                                break;
                        }
                    } else {
                        // Non-fatal errors that might require attention
                         if (data.type === Hls.ErrorTypes.NETWORK_ERROR) {
                             // Check for fragment load errors (often CORS or 404/403 on segments)
                             if (data.details === Hls.ErrorDetails.FRAG_LOAD_ERROR || 
                                 data.details === Hls.ErrorDetails.FRAG_LOAD_TIMEOUT ||
                                 data.details === Hls.ErrorDetails.KEY_LOAD_ERROR) {
                                 
                                 console.warn(`HLS Frag/Key Error (${data.details}). Attempting Proxy Switch...`);
                                 // Force fatal behavior for these specific errors to trigger fallback
                                 currentHls.destroy();
                                 handleVideoError({ code: 'HLS_FRAG_ERROR', message: data.details });
                             }
                         }
                    }
                });
            } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
                // Native HLS (iOS/Safari)
                video.src = finalUrl;
                video.addEventListener('loadedmetadata', () => {
                    safePlay();
                });
                // Note: Error handling for native HLS is via video.onerror above
            } else {
                showError("Formato de vídeo não suportado neste navegador.");
            }
        };

        // Ensure HLS.js is loaded
        if (typeof Hls === 'undefined') {
            console.warn("HLS.js not loaded yet. Waiting...");
            // Simple retry mechanism for HLS lib
            let checks = 0;
            const checkHls = setInterval(() => {
                checks++;
                if (typeof Hls !== 'undefined') {
                    clearInterval(checkHls);
                    loadHls();
                } else if (checks > 20) {
                    clearInterval(checkHls);
                    showError("Erro ao carregar biblioteca de vídeo.");
                }
            }, 200);
        } else {
            loadHls();
        }
    } 
    // Handle MP4 / Direct File
    else {
        video.src = finalUrl;
        video.load();
        try {
            await safePlay();
        } catch(e) { console.warn("MP4 Play Error:", e); }
    }
}

// Helper: Show Error with optional Action Button
function showError(msg, actionElem) {
    const errorOverlay = document.getElementById('errorOverlay');
    const errorMsg = document.getElementById('errorMsg');
    const btnRetry = document.getElementById('btnRetry');
    const spinner = document.getElementById('errorSpinner');
    
    if (errorOverlay && errorMsg) {
        errorMsg.textContent = msg;
        errorOverlay.style.display = 'flex';
        
        // Hide spinner on error
        if (spinner) spinner.style.display = 'none';

        // Clear previous actions
        const existingAction = document.getElementById('errorAction');
        if (existingAction) existingAction.remove();

        if (actionElem) {
            actionElem.id = 'errorAction';
            errorOverlay.appendChild(actionElem);
        }
        
        if (btnRetry) {
            btnRetry.onclick = () => location.reload();
        }
    }
}

function createExternalAction(url) {
    const btn = document.createElement('button');
    btn.textContent = "Abrir no VLC / Player Externo";
    btn.style.marginTop = "10px";
    btn.style.padding = "10px 20px";
    btn.style.background = "#333";
    btn.style.color = "white";
    btn.style.border = "1px solid #555";
    btn.style.borderRadius = "4px";
    btn.style.cursor = "pointer";
    btn.onclick = () => window.open(url, '_blank');
    return btn;
}

export async function initPlayer() {
    console.log("Initializing Player Core...");
    
    // UI References
    const video = document.getElementById('video');
    const ui = {
        title: document.getElementById('playerTitle'),
        meta: document.getElementById('playerMeta'),
        backBtn: document.getElementById('backBtn'),
        loading: document.getElementById('loading-overlay')
    };
    
    if (!video) {
        console.error("Video element not found!");
        return;
    }

    // 1. SETUP ADS FIRST (Blocking or Async?)
    // We start ad setup immediately but don't block UI initialization completely
    // The setupIMAAds function has a safety timeout to force content if ads fail.
    await setupIMAAds(video);

    // 2. Load Content Details
    const type = qs('type');
    const id = qs('id');
    
    if (!type || !id) {
        showError("Conteúdo não especificado.");
        if (ui.loading) ui.loading.style.display = 'none';
        return;
    }

    const detail = await loadDetail(type, id);
    
    if (!detail.ok) {
        showError(detail.error);
        if (ui.loading) ui.loading.style.display = 'none';
        return;
    }

    // Update UI
    if (ui.title) ui.title.textContent = detail.title;
    if (ui.meta) ui.meta.textContent = detail.meta;
    
    if (ui.backBtn) {
        ui.backBtn.onclick = () => {
            // Smart Back: If series, maybe go back to series modal?
            // For now, simple history back
            if (history.length > 1) history.back();
            else window.location.href = './dashboard.html';
        };
    }

    // --- PLAYBACK STARTUP ---
    // Check for "Audio 2" (Dubbed vs Subtitled)
    // Logic: If Audio2 exists, ask user OR check preference
    // For now, let's default to Audio 1 (usually Dubbed or Primary)
    // But if we want to support switching, we need the modal.

    // SETUP TRACK MODAL
    const btnSettings = document.getElementById('btnSettings');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const audioOptions = document.getElementById('audioOptions');
    
    // Populate Audio Options
    if (audioOptions) {
        audioOptions.innerHTML = '';
        
        // Option 1: Primary (Dubbed/Default)
        const opt1 = document.createElement('div');
        opt1.style.padding = '8px';
        opt1.style.background = 'rgba(255,255,255,0.1)';
        opt1.style.borderRadius = '4px';
        opt1.style.cursor = 'pointer';
        opt1.textContent = "Áudio Principal (Dublado/Original)";
        opt1.onclick = () => {
            location.reload(); // Simple reload for now to reset
        };
        audioOptions.appendChild(opt1);

        // Option 2: Secondary (Legendado)
        if (detail.streamUrlAudio2) {
            const opt2 = document.createElement('div');
            opt2.style.padding = '8px';
            opt2.style.background = 'transparent';
            opt2.style.borderRadius = '4px';
            opt2.style.cursor = 'pointer';
            opt2.textContent = "Áudio Alternativo (Legendado)";
            opt2.onclick = () => {
                 // Switch source logic
                 attachSource({ 
                     video, 
                     streamUrl: detail.streamUrlAudio2, 
                     streamUrlSub: detail.streamUrlSub, 
                     streamType: 'hls', 
                     ui,
                     isLegendado: true 
                 });
                 settingsModal.style.display = 'none';
            };
            audioOptions.appendChild(opt2);
        }
    }

    if (btnSettings) {
        btnSettings.onclick = () => {
            if (settingsModal) settingsModal.style.display = (settingsModal.style.display === 'none' ? 'block' : 'none');
        };
    }
    
    if (closeSettings) {
        closeSettings.onclick = () => {
            if (settingsModal) settingsModal.style.display = 'none';
        };
    }

    // SETUP SERIES CONTROLS (Next / List)
    if (type === 'series' || type === 'episode') {
        setupSeriesControls(detail, video);
    }

    // iOS Audio Selection Prompt
    // If iOS AND we have multiple audio options, ask BEFORE playing
    const isIOS = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOS && detail.streamUrlAudio2) {
        // Show a custom modal or use native confirm? Custom is better.
        // For simplicity, we'll just start with Primary, but show the Settings button prominently.
        // Or we could programmatically open the settings modal?
        // Let's just let it play and user can switch.
    }

    // Start Playback (Primary Source)
    await attachSource({ 
        video, 
        streamUrl: detail.streamUrl, 
        streamUrlSub: detail.streamUrlSub, 
        streamType: 'hls', // Assume HLS for now
        ui,
        isLegendado: false
    });

    const isIOSMobile = /iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isIOSMobile) {
        const onFirstTouch = () => {
            try { video.play(); } catch(_) {}
        };
        document.body.addEventListener('touchstart', onFirstTouch, { once: true, passive: true });
        document.body.addEventListener('click', onFirstTouch, { once: true });
    }

    // Remove loading overlay (Video will handle buffering spinner)
    if (ui.loading) {
        // ui.loading.style.display = 'none'; // Handled by finishLoading global
        if (window.finishLoading) window.finishLoading();
    }
}

function setupSeriesControls(detail, video) {
    const btnNext = document.getElementById('btnNextEp');
    const btnList = document.getElementById('btnEpList');
    const epListModal = document.getElementById('epListModal');
    const epListContent = document.getElementById('epListContent');
    const closeEpList = document.getElementById('closeEpListModal');
    
    if (btnNext) {
        // Check if there is a next episode
        const nextIndex = detail.currentEpIndex + 1;
        if (nextIndex < detail.episodes.length) {
            btnNext.style.display = 'flex';
            btnNext.onclick = () => {
                const nextEp = detail.episodes[nextIndex];
                window.location.href = `./player_v2.html?type=series&id=${detail.seriesId}&s=${nextEp.season_number}&e=${nextEp.episode_number}`;
            };
        }
    }
    
    if (btnList) {
        btnList.style.display = 'flex';
        btnList.onclick = () => {
            epListModal.style.display = 'flex';
            renderEpisodeList(detail.episodes, detail.currentEpIndex, epListContent, detail.seriesId);
        };
    }
    
    if (closeEpList) {
        closeEpList.onclick = () => epListModal.style.display = 'none';
    }
}

function renderEpisodeList(episodes, currentIndex, container, seriesId) {
    container.innerHTML = '';
    
    // Group by Season
    const seasons = {};
    episodes.forEach(ep => {
        const s = ep.season_number || 1;
        if (!seasons[s]) seasons[s] = [];
        seasons[s].push(ep);
    });
    
    Object.keys(seasons).sort((a,b) => a-b).forEach(seasonNum => {
        const title = document.createElement('h4');
        title.textContent = `Temporada ${seasonNum}`;
        title.style.color = '#aaa';
        title.style.margin = '15px 0 10px 0';
        container.appendChild(title);
        
        seasons[seasonNum].forEach(ep => {
            const el = document.createElement('div');
            el.style.padding = '10px';
            el.style.marginBottom = '5px';
            el.style.borderRadius = '4px';
            el.style.background = (ep.episode_number === episodes[currentIndex].episode_number && ep.season_number === episodes[currentIndex].season_number) ? 'rgba(168, 85, 247, 0.2)' : 'rgba(255,255,255,0.05)';
            el.style.cursor = 'pointer';
            el.style.display = 'flex';
            el.style.justifyContent = 'space-between';
            el.style.alignItems = 'center';
            
            el.innerHTML = `
                <span style="color: white; font-size: 14px;">${ep.episode_number}. ${ep.title}</span>
                <span style="color: #666; font-size: 12px;">${ep.duration ? ep.duration : ''}</span>
            `;
            
            el.onclick = () => {
                window.location.href = `./player_v2.html?type=series&id=${seriesId}&s=${ep.season_number}&e=${ep.episode_number}`;
            };
            
            container.appendChild(el);
        });
    });
}
