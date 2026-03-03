import { api } from "./api.js?v=20260301-033430";
import { applyGlobalTheme } from "./ui.js?v=20260225-v1";

// Apply theme immediately
applyGlobalTheme();

// Helper for URL params
const qs = (key) => new URLSearchParams(window.location.search).get(key);

// Global State
let currentHls = null;

// Simple Proxy Helper - Single Robust Proxy
const PROXY_URL = "https://corsproxy.io/?";

// Helper to determine best proxy
function getBestProxyBase() {
    // If running on Vercel, use local serverless function
    if (window.location.hostname.includes('vercel.app') || window.location.hostname.includes('localhost')) {
        return '/api/proxy?url=';
    }
    // Fallback for GitHub Pages or others
    return PROXY_URL;
}

function getProxiedUrl(url) {
    if (!url) return '';
    const proxyBase = getBestProxyBase();
    
    // If already proxied, return as is
    if (url.startsWith(PROXY_URL) || url.startsWith('/api/proxy')) return url;
    
    return `${proxyBase}${encodeURIComponent(url)}`;
}

// --- UI Helpers ---

function showStatus(msg) {
    let statusEl = document.getElementById('playerStatus');
    if (!statusEl) {
        statusEl = document.createElement('div');
        statusEl.id = 'playerStatus';
        Object.assign(statusEl.style, {
            position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)',
            color: 'white', background: 'rgba(0,0,0,0.8)', padding: '10px 20px',
            zIndex: '21005', fontSize: '14px', borderRadius: '4px', pointerEvents: 'none',
            transition: 'opacity 0.3s ease'
        });
        document.body.appendChild(statusEl);
    }
    statusEl.textContent = msg;
    statusEl.style.opacity = '1';
    
    if (window._statusTimer) clearTimeout(window._statusTimer);
    window._statusTimer = setTimeout(() => { if(statusEl) statusEl.style.opacity = '0'; }, 3000);
}

function showError(msg, showRetry = true) {
    console.error("[Player Error]", msg);
    if (window.finishLoading) window.finishLoading();
    
    const errorOverlay = document.getElementById('errorOverlay');
    const errorMsg = document.getElementById('errorMsg');
    const btnRetry = document.getElementById('btnRetry');
    const spinner = document.getElementById('errorSpinner');
    
    if (errorOverlay && errorMsg) {
        errorMsg.textContent = msg;
        errorOverlay.style.display = 'flex';
        if (spinner) spinner.style.display = 'none';
        if (btnRetry) {
            btnRetry.style.display = showRetry ? 'block' : 'none';
            btnRetry.onclick = () => location.reload();
        }
    } else {
        // Fallback if UI not ready
        console.warn("UI Error Overlay not found, alerting:", msg);
        alert(msg);
    }
}

// --- Data Loading ---

async function loadDetail(type, id) {
    console.log(`[loadDetail] Loading ${type} ${id}`);
    
    try {
        if (type === 'movie') {
            const res = await api.movies.get(id);
            if (!res.ok) throw new Error(res.data?.error || "Erro ao carregar filme");
            const m = res.data.item;
            return {
                ok: true,
                title: m.title,
                meta: m.rating ? `★ ${m.rating}` : '',
                streamUrl: m.stream_url,
                streamUrlAudio2: m.stream_url_subtitled_version,
                episodes: []
            };
        } 
        else if (type === 'series') {
            const res = await api.series.get(id);
            if (!res.ok) throw new Error(res.data?.error || "Erro ao carregar série");
            
            const s = res.data.item;
            const epsRes = await api.series.episodes(id);
            const episodes = epsRes.ok ? epsRes.data.episodes : [];
            
            if (episodes.length === 0) throw new Error("Nenhum episódio encontrado.");

            // Sort episodes
            episodes.sort((a, b) => {
                if (a.season_number !== b.season_number) return (a.season_number || 0) - (b.season_number || 0);
                return (a.episode_number || 0) - (b.episode_number || 0);
            });
            
            // Determine current episode
            const seasonParam = parseInt(qs('season') || qs('s'));
            const episodeParam = parseInt(qs('episode') || qs('e'));
            let epIndex = 0;
            
            if (!isNaN(seasonParam) && !isNaN(episodeParam)) {
                const foundIndex = episodes.findIndex(ep => ep.season_number === seasonParam && ep.episode_number === episodeParam);
                if (foundIndex !== -1) epIndex = foundIndex;
            }
            
            const ep = episodes[epIndex];
            return {
                ok: true,
                title: `${s.title} - S${ep.season_number}:E${ep.episode_number}`,
                meta: s.title,
                streamUrl: ep.stream_url,
                streamUrlSub: ep.sub_url,
                seriesId: id,
                episodes: episodes,
                currentEpIndex: epIndex
            };
        }
        else if (type === 'episode') {
            const seriesId = qs("seriesId");
            if (!seriesId) throw new Error("ID da série ausente.");
            
            const sRes = await api.series.get(seriesId);
            const sTitle = sRes.ok ? sRes.data.item.title : "Série";
            
            const epsRes = await api.series.episodes(seriesId);
            const episodes = epsRes.ok ? epsRes.data.episodes : [];
            
            const epIndex = episodes.findIndex(e => e.id === id);
            if (epIndex === -1) throw new Error("Episódio não encontrado.");
            
            const ep = episodes[epIndex];
            return {
                ok: true,
                title: `${sTitle} - S${ep.season_number}:E${ep.episode_number}`,
                meta: sTitle,
                streamUrl: ep.stream_url,
                streamUrlSub: ep.sub_url,
                seriesId: seriesId,
                episodes: episodes,
                currentEpIndex: epIndex
            };
        }
        else if (type === 'live') {
            const res = await api.live.get(id);
            if (!res.ok) throw new Error(res.data?.error || "Erro ao carregar canal");
            return {
                ok: true,
                title: res.data.title,
                meta: "Ao Vivo",
                streamUrl: res.data.streamUrl,
                episodes: []
            };
        }
        return { ok: false, error: "Tipo de conteúdo desconhecido" };
    } catch (e) {
        return { ok: false, error: e.message };
    }
}

// --- Player Logic ---

async function attachSource(video, url, useProxy = false) {
    if (!url) return showError("URL de vídeo inválida.");
    
    // Cleanup previous HLS
    if (currentHls) {
        currentHls.destroy();
        currentHls = null;
    }

    let finalUrl = url;
    if (useProxy) {
         finalUrl = getProxiedUrl(url);
         showStatus("Tentando via Proxy...");
    } else {
         showStatus("Carregando vídeo...");
    }

    console.log(`[Player] Loading: ${finalUrl} (Proxy: ${useProxy})`);
    
    // Helper to finish loading
    const onReady = () => {
        if (window.finishLoading) window.finishLoading();
    };

    // Check HLS support
    if (Hls.isSupported()) {
        const hls = new Hls({
            debug: false,
            enableWorker: true,
            lowLatencyMode: true
        });
        currentHls = hls;
        
        hls.loadSource(finalUrl);
        hls.attachMedia(video);
        
        hls.on(Hls.Events.MANIFEST_PARSED, () => {
            console.log("[Player] Manifest loaded, playing...");
            video.play().catch(e => console.warn("Auto-play blocked:", e));
            onReady();
        });
        
        hls.on(Hls.Events.ERROR, (event, data) => {
            if (data.fatal) {
                console.error(`[Player] HLS Fatal Error: ${data.type}`);
                switch (data.type) {
                    case Hls.ErrorTypes.NETWORK_ERROR:
                        // If we haven't tried proxy yet, try it now
                        if (!useProxy) {
                            console.warn("[Player] Network error, retrying with Proxy...");
                            hls.destroy();
                            // Small delay to prevent rapid loops
                            setTimeout(() => attachSource(video, url, true), 500);
                        } else {
                            hls.destroy();
                            showError("Erro de conexão com o vídeo. Tente novamente mais tarde.");
                        }
                        break;
                    case Hls.ErrorTypes.MEDIA_ERROR:
                        console.warn("[Player] Media error, recovering...");
                        hls.recoverMediaError();
                        break;
                    default:
                        hls.destroy();
                        showError("Erro fatal no player.");
                        break;
                }
            }
        });
    }
    // Native HLS (Safari/iOS)
    else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = finalUrl;
        
        // One-time listener for success
        const onLoaded = () => {
            video.play().catch(e => console.warn("Auto-play blocked:", e));
            onReady();
            video.removeEventListener('loadedmetadata', onLoaded);
        };
        video.addEventListener('loadedmetadata', onLoaded);
        
        // One-time listener for error
        const onError = (e) => {
             if (!useProxy) {
                console.warn("[Player] Native HLS error, retrying with Proxy...");
                // Remove this listener to prevent loops
                video.removeEventListener('error', onError);
                setTimeout(() => attachSource(video, url, true), 500);
            } else {
                showError("Erro ao carregar vídeo (Nativo).");
            }
        };
        video.addEventListener('error', onError);
    }
    else {
        showError("Seu navegador não suporta reprodução de vídeo.");
    }
}

// --- Series Navigation ---

function renderEpisodesList(episodes, currentIndex, seriesId, container) {
    if (!container) return;
    container.innerHTML = '';
    
    // Group by seasons
    const seasons = {};
    episodes.forEach(ep => {
        const s = ep.season_number || 1;
        if (!seasons[s]) seasons[s] = [];
        seasons[s].push(ep);
    });

    Object.keys(seasons).sort((a,b) => a - b).forEach(seasonNum => {
        const seasonTitle = document.createElement('h4');
        seasonTitle.textContent = `Temporada ${seasonNum}`;
        Object.assign(seasonTitle.style, {
            color: '#aaa', margin: '10px 0 5px 0', borderBottom: '1px solid #333', paddingBottom: '5px'
        });
        container.appendChild(seasonTitle);

        seasons[seasonNum].forEach(ep => {
            const epEl = document.createElement('div');
            Object.assign(epEl.style, {
                padding: '10px', borderBottom: '1px solid #333', cursor: 'pointer',
                display: 'flex', justifyContent: 'space-between', alignItems: 'center'
            });
            
            const isCurrent = (ep.season_number === episodes[currentIndex].season_number && ep.episode_number === episodes[currentIndex].episode_number);
            
            if (isCurrent) {
                epEl.style.background = 'rgba(147, 51, 234, 0.2)';
                epEl.style.borderLeft = '4px solid #9333ea';
            } else {
                epEl.addEventListener('mouseenter', () => epEl.style.background = '#333');
                epEl.addEventListener('mouseleave', () => epEl.style.background = 'transparent');
            }

            epEl.innerHTML = `
                <div style='display: flex; flex-direction: column;'>
                    <span style='color: white; font-weight: bold;'>${ep.episode_number}. ${ep.title}</span>
                    <span style='color: #888; font-size: 12px;'>${ep.duration ? ep.duration + ' min' : ''}</span>
                </div>
                ${isCurrent ? "<span style='color: #9333ea; font-size: 12px; font-weight: bold;'>TOCANDO</span>" : ""}
            `;
            
            epEl.onclick = () => {
                window.location.href = `./player_v2.html?type=episode&id=${ep.id}&seriesId=${seriesId}`;
            };
            
            container.appendChild(epEl);
        });
    });
}

function handleAudioSubtitles(detail, video) {
    const btnSettings = document.getElementById('btnSettings');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettings = document.getElementById('closeSettings');
    const audioOptions = document.getElementById('audioOptions');

    if (btnSettings && settingsModal) {
        btnSettings.onclick = () => {
            settingsModal.style.display = settingsModal.style.display === 'block' ? 'none' : 'block';
        };
        if (closeSettings) closeSettings.onclick = () => settingsModal.style.display = 'none';
    }

    if (audioOptions) {
        audioOptions.innerHTML = '';
        
        // Option 1: Main Stream (Dubbed usually, or whatever is default)
        const opt1 = document.createElement('div');
        opt1.style.cssText = 'padding: 8px; cursor: pointer; border-radius: 4px; background: rgba(255,255,255,0.1);';
        opt1.textContent = "Ãudio Principal";
        opt1.onclick = () => {
            const time = video.currentTime;
            attachSource(video, detail.streamUrl, false);
            video.currentTime = time;
            settingsModal.style.display = 'none';
        };
        audioOptions.appendChild(opt1);

        // Option 2: Secondary Stream (Subtitled usually)
        if (detail.streamUrlSub || detail.streamUrlAudio2) {
            const url2 = detail.streamUrlSub || detail.streamUrlAudio2;
            const opt2 = document.createElement('div');
            opt2.style.cssText = 'padding: 8px; cursor: pointer; border-radius: 4px; margin-top: 5px;';
            opt2.textContent = "Ãudio Alternativo / Legendado";
            opt2.onclick = () => {
                const time = video.currentTime;
                attachSource(video, url2, false);
                video.currentTime = time;
                settingsModal.style.display = 'none';
            };
            audioOptions.appendChild(opt2);
        }
    }
}

function handleNextEpisode(detail) {
    const overlay = document.getElementById('nextEpOverlay');
    const nextTitle = document.getElementById('nextEpTitle');
    const nextProgress = document.getElementById('nextEpProgress');
    const btnPlayNext = document.getElementById('btnPlayNextNow');
    const btnCancel = document.getElementById('btnCancelNext');

    if (!overlay || !detail.episodes) return;

    if (detail.currentEpIndex >= detail.episodes.length - 1) return; // No next ep

    const nextEp = detail.episodes[detail.currentEpIndex + 1];
    
    if (nextTitle) nextTitle.textContent = PrÃ³ximo: x - ;
    
    overlay.style.display = 'block';
    
    // Auto play in 5 seconds
    let timeLeft = 5000;
    const interval = setInterval(() => {
        timeLeft -= 100;
        if (nextProgress) nextProgress.style.width = (timeLeft / 5000 * 100) + '%';
        
        if (timeLeft <= 0) {
            clearInterval(interval);
            window.location.href = './player_v2.html?type=episode&id=' + nextEp.id + '&seriesId=' + detail.seriesId;
        }
    }, 100);

    btnPlayNext.onclick = () => {
        clearInterval(interval);
        window.location.href = './player_v2.html?type=episode&id=' + nextEp.id + '&seriesId=' + detail.seriesId;
    };

    btnCancel.onclick = () => {
        clearInterval(interval);
        overlay.style.display = 'none';
    };
}
function setupUI(detail, video) {
    // Title & Meta
    const titleEl = document.getElementById('playerTitle');
    const metaEl = document.getElementById('playerMeta');
    if (titleEl) titleEl.textContent = detail.title;
    if (metaEl) metaEl.textContent = detail.meta;
    
    // Back Button
    const backBtn = document.getElementById('backBtn');
    if (backBtn) backBtn.onclick = () => history.back();

    // Series Controls
    const btnNextEp = document.getElementById('btnNextEp');
    const btnEpList = document.getElementById('btnEpList');
    const epListModal = document.getElementById('epListModal');
    const closeEpListModal = document.getElementById('closeEpListModal');
    const epListContent = document.getElementById('epListContent');

    if (detail.episodes && detail.episodes.length > 0) {
        if (btnNextEp) {
            if (detail.currentEpIndex < detail.episodes.length - 1) {
                btnNextEp.style.display = 'flex';
                btnNextEp.onclick = () => {
                    const nextEp = detail.episodes[detail.currentEpIndex + 1];
                    window.location.href = `./player_v2.html?type=episode&id=${nextEp.id}&seriesId=${detail.seriesId}`;
                };
            } else {
                btnNextEp.style.display = 'none';
            }
        }

        if (btnEpList) {
            btnEpList.style.display = 'flex';
            btnEpList.onclick = () => {
                renderEpisodesList(detail.episodes, detail.currentEpIndex, detail.seriesId, epListContent);
                if (epListModal) epListModal.style.display = 'flex';
            };
        }

        if (closeEpListModal && epListModal) {
            closeEpListModal.onclick = () => epListModal.style.display = 'none';
            epListModal.onclick = (e) => { if (e.target === epListModal) epListModal.style.display = 'none'; };
        }
    } else {
        if (btnNextEp) btnNextEp.style.display = 'none';
        if (btnEpList) btnEpList.style.display = 'none';
    }
}

// --- Main Init ---

export async function initPlayer() {
    console.log("[Player] Initializing...");
    const video = document.getElementById('video');
    
    if (!video) return console.error("Video element not found");

    const type = qs('type');
    const id = qs('id');
    
    if (!type || !id) {
        showError("Conteúdo não especificado.");
        return;
    }

    // Load Data
    const detail = await loadDetail(type, id);
    if (!detail.ok) {
        showError(detail.error);
        return;
    }

    // Setup UI
    setupUI(detail, video);

        // Setup Progress Saving & Restore
    const savedTime = api.playback.getProgress(id);
    if (savedTime > 0) {
        console.log('[Player] Restoring progress: ' + savedTime + 's');
        video.currentTime = savedTime;
    }

    video.addEventListener('timeupdate', () => {
        if (video.currentTime > 5 && !video.paused) {
            api.playback.saveProgress(id, video.currentTime, video.duration, type);
        }
    });

    video.addEventListener('ended', () => {
        if (type === 'episode' || type === 'series') {
            handleNextEpisode(detail);
        }
    });

    // Start Playback
    // Try direct first, HLS error handler will switch to proxy if needed
    attachSource(video, detail.streamUrl, false);
}




