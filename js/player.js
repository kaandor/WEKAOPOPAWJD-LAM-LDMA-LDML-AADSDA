
import { api } from "./api.js";

// Helper for URL params
const qs = (key) => new URLSearchParams(window.location.search).get(key);

// Helper to proxy streams if needed (Mixed Content fix)
const PROXY_BASE_URL = "https://api.codetabs.com/v1/proxy?quest="; // Fallback público. Se tiver seu proxy Vercel, use: "https://seu-projeto.vercel.app/api?url="

function getProxiedStreamUrl(url) {
    if (!url) return '';
    // If already proxied, return as is
    if (url.includes(PROXY_BASE_URL) || url.includes('corsproxy.io')) return url;

    // If running on HTTPS and stream is HTTP, we MUST proxy to avoid Mixed Content block
    if (window.location.protocol === 'https:' && url.startsWith('http://')) {
        return `${PROXY_BASE_URL}${encodeURIComponent(url)}`;
    }
    return url;
}

async function loadDetail(type, id) {
    console.log(`[loadDetail] Loading ${type} ${id}`);
    
    if (type === 'movie') {
        const res = await api.movies.get(id);
        if (!res.ok) return { ok: false, error: res.data?.error || "Erro ao carregar filme" };
        
        const m = res.data.item;
        return {
            ok: true,
            title: m.title,
            meta: `${m.year || ''} | ${m.rating ? '★ ' + m.rating : ''}`,
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

async function attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }) {
    console.log(`[attachSource] URL: ${streamUrl}, Type: ${streamType}`);
    
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
    const finalUrl = getProxiedStreamUrl(streamUrl);
    if (finalUrl !== streamUrl) {
        console.log(`[attachSource] Proxied URL: ${finalUrl}`);
    }

    // Handle HLS
    if (streamType === 'hls' || streamUrl.includes('.m3u8')) {
        if (window.Hls && Hls.isSupported()) {
            const hls = new Hls();
            currentHls = hls; // Save reference
            hls.loadSource(finalUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log("HLS Manifest Parsed");
                video.play().catch(e => console.warn("Auto-play blocked", e));
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.error("HLS Fatal Error", data);
                    // Try to recover
                    switch (data.type) {
                        case Hls.ErrorTypes.NETWORK_ERROR:
                            console.log("fatal network error encountered, try to recover");
                            hls.startLoad();
                            break;
                        case Hls.ErrorTypes.MEDIA_ERROR:
                            console.log("fatal media error encountered, try to recover");
                            hls.recoverMediaError();
                            break;
                        default:
                            // cannot recover
                            hls.destroy();
                            break;
                    }
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari / Native HLS
            video.src = finalUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e => console.warn("Auto-play blocked", e));
            });
        } else {
            console.error("HLS not supported");
        }
    } else {
        // Direct file (MP4/MKV)
        video.src = finalUrl;
        video.play().catch(e => console.warn("Auto-play blocked", e));
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
        btn.style.background = isActive ? 'rgba(229, 9, 20, 0.8)' : 'rgba(255,255,255,0.1)';
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
            });
            
            // Restore position
            video.currentTime = currentTime;
            if (wasPlaying) video.play().catch(() => {});
            
            settingsModal.style.display = 'none';
        };
        
        return btn;
    };

    // Determine current active URL
    const currentUrl = data.currentStreamUrl || data.streamUrl;
    
    // Option 1: Dublado (Default)
    audioOptions.appendChild(createOption(
        "Português (Dublado)", 
        data.streamUrl, 
        currentUrl === data.streamUrl
    ));
    
    // Option 2: Legendado (if available)
    if (data.streamUrlAudio2) {
        audioOptions.appendChild(createOption(
            "Português (Legendado)", 
            data.streamUrlAudio2, 
            currentUrl === data.streamUrlAudio2
        ));
    }
}

function setupAutoHide(video) {
    let timeout;
    const controls = document.querySelector('.controls-top');
    const backBtn = document.getElementById('backBtn');
    
    const show = () => {
        if (controls) controls.style.opacity = '1';
        if (backBtn) backBtn.style.opacity = '1';
        document.body.style.cursor = 'auto';
        
        clearTimeout(timeout);
        timeout = setTimeout(hide, 3000);
    };
    
    const hide = () => {
        if (video.paused) return; 
        if (controls) controls.style.opacity = '0';
        if (backBtn) backBtn.style.opacity = '0';
        document.body.style.cursor = 'none';
    };
    
    window.resetControlsTimer = show;
    window.hideControlsNow = hide;
    
    document.addEventListener('mousemove', show);
    document.addEventListener('click', show);
    document.addEventListener('keydown', show);
    
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
        
        if (window.finishLoading) window.finishLoading();
        setupAutoHide(video);
        
    } catch (e) {
        console.error("Player Error:", e);
        if (window.finishLoading) window.finishLoading();
        showError("Erro interno no player.");
    }
}
