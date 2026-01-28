
// --- Helper Functions ---

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
            // For series/episode logic compatibility (movies are standalone)
            episodes: [],
            currentEpIndex: -1
        };
    } 
    else if (type === 'series') {
        // If loading series directly, we usually want to play the first episode or resume
        // For now, let's fetch series info and assume we play S1E1 if not specified
        const res = await api.series.get(id);
        if (!res.ok) return { ok: false, error: res.data?.error || "Erro ao carregar série" };
        
        const s = res.data.item;
        
        // Fetch episodes
        const epsRes = await api.series.episodes(id);
        const episodes = epsRes.ok ? epsRes.data.episodes : [];
        
        if (episodes.length === 0) return { ok: false, error: "Nenhum episódio encontrado." };
        
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
        // We need the series ID to fetch the list, usually passed in query param?
        // But here we only have 'id' which is episode ID.
        // Wait, the URL has &seriesId=...
        const seriesId = qs("seriesId");
        if (!seriesId) return { ok: false, error: "ID da série ausente para reprodução de episódio." };
        
        // Fetch series info for title
        const sRes = await api.series.get(seriesId);
        const sTitle = sRes.ok ? sRes.data.item.title : "Série";
        
        // Fetch episodes
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
    
    // Subtitles (simple implementation)
    // In a real app, we'd parse .srt/.vtt or use HLS subtitles
    if (ui && ui.subtitleSelect) {
        // Clear options
        ui.subtitleSelect.innerHTML = '<option value="-1">Desativado</option>';
        if (streamUrlSub) {
             const opt = document.createElement('option');
             opt.value = streamUrlSub;
             opt.text = "Português";
             ui.subtitleSelect.appendChild(opt);
             
             // Auto-select if legendado
             if (isLegendado) {
                 ui.subtitleSelect.value = streamUrlSub;
                 // Add track
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
    const controls = document.querySelector('.controls-top'); // Or other overlay elements
    const backBtn = document.getElementById('backBtn');
    
    const show = () => {
        if (controls) controls.style.opacity = '1';
        if (backBtn) backBtn.style.opacity = '1';
        document.body.style.cursor = 'auto';
        
        clearTimeout(timeout);
        timeout = setTimeout(hide, 3000);
    };
    
    const hide = () => {
        if (video.paused) return; // Don't hide if paused
        if (controls) controls.style.opacity = '0';
        if (backBtn) backBtn.style.opacity = '0';
        document.body.style.cursor = 'none';
    };
    
    // Global exposure for player key handler
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
