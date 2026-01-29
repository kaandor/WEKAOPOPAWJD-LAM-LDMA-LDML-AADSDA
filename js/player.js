
import { api } from "./api.js";

// Helper for URL params
const qs = (key) => new URLSearchParams(window.location.search).get(key);

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
    
    if (!streamUrl) {
        console.error("No stream URL provided");
        return;
    }

    // Handle HLS
    if (streamType === 'hls' || streamUrl.includes('.m3u8')) {
        if (window.Hls && Hls.isSupported()) {
            const hls = new Hls();
            hls.loadSource(streamUrl);
            hls.attachMedia(video);
            hls.on(Hls.Events.MANIFEST_PARSED, () => {
                console.log("HLS Manifest Parsed");
                video.play().catch(e => console.warn("Auto-play blocked", e));
            });
            hls.on(Hls.Events.ERROR, (event, data) => {
                if (data.fatal) {
                    console.error("HLS Fatal Error", data);
                }
            });
        } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
            // Safari / Native HLS
            video.src = streamUrl;
            video.addEventListener('loadedmetadata', () => {
                video.play().catch(e => console.warn("Auto-play blocked", e));
            });
        } else {
            console.error("HLS not supported");
        }
    } else {
        // Direct file (MP4/MKV)
        video.src = streamUrl;
        video.play().catch(e => console.warn("Auto-play blocked", e));
    }
    
    // Subtitles
    if (ui && ui.subtitleSelect) {
        ui.subtitleSelect.innerHTML = '<option value="-1">Desativado</option>';
        if (streamUrlSub) {
             const opt = document.createElement('option');
             opt.value = streamUrlSub;
             opt.text = "Português";
             ui.subtitleSelect.appendChild(opt);
             
             if (isLegendado) {
                 ui.subtitleSelect.value = streamUrlSub;
                 const track = document.createElement('track');
                 track.kind = 'subtitles';
                 track.label = 'Português';
                 track.srclang = 'pt';
                 track.src = streamUrlSub;
                 track.default = true;
                 video.appendChild(track);
             }
        }
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
    console.log("Player Initialized");
    
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
        
        setupAutoHide(video);
        
    } catch (e) {
        console.error("Player Error:", e);
        showError("Erro interno no player.");
    }
}
