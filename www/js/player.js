import { api } from "./api.js";

function qs(name) {
  return new URLSearchParams(window.location.search).get(name);
}

function secondsToTime(s) {
  const n = Math.max(0, Math.floor(s));
  const h = Math.floor(n / 3600);
  const m = Math.floor((n % 3600) / 60);
  const sec = n % 60;
  if (h > 0) return `${h}:${String(m).padStart(2, "0")}:${String(sec).padStart(2, "0")}`;
  return `${m}:${String(sec).padStart(2, "0")}`;
}

function getStreamType(url) {
  const u = String(url || "");
  if (u.includes(".m3u8")) return "hls";
  return "file";
}

export async function initPlayer() {
  const log = null;
  console.log("initPlayer starting...");

  // --- CONFIGURAÇÃO DO PROXY VERCEL ---
  // Substitua a URL abaixo pela URL do seu projeto na Vercel após o deploy
  // Exemplo: "https://meu-proxy-iptv.vercel.app/api?url="
  const VERCEL_PROXY_URL = "https://klyx-web-app2.vercel.app/api?url="; 
  // ------------------------------------

  // Safety timeout to hide spinner after 10 seconds if something hangs
  setTimeout(() => {
     const l = document.getElementById("loading-overlay");
     if (l && l.style.display !== "none") {
         if (window.finishLoading) window.finishLoading();
         else l.style.display = "none";
         if (log) log.innerHTML += "<div>TIMEOUT: Spinner hidden forced</div>";
         console.warn("Forced spinner hide due to timeout");
     }
  }, 10000);

  const type = qs("type");
  const id = qs("id");
  const metaEl = document.getElementById("playerMeta");
  const loader = document.getElementById("loading-overlay");

  if (!type || !id) {
    if (log) log.innerHTML += `<div>MISSING PARAMS: type=${type} id=${id}</div>`;
    if (metaEl) metaEl.textContent = "Missing playback parameters.";
    if (loader) {
        if (window.finishLoading) window.finishLoading();
        else loader.style.display = "none";
    }
    return;
  }
  
  if (log) log.innerHTML += `<div>Params: ${type} / ${id}</div>`;

  // UI UPDATE: If Live, force the timeline to show "LIVE" instead of numbers if possible
  if (type === "live") {
      const durEl = document.querySelector(".duration-time");
      if (durEl) durEl.style.display = "none";
      const liveBadge = document.createElement("span");
      liveBadge.textContent = " AO VIVO ";
      liveBadge.style.cssText = "color: red; font-weight: bold; margin-left: 10px; animation: pulse 2s infinite;";
      
      const controls = document.querySelector(".controls-left");
      if (controls) controls.appendChild(liveBadge);
  }

  const video = document.getElementById("video");
  // const controls = document.getElementById("controls"); // REMOVED
  // const playBtn = document.getElementById("btnPlay"); // REMOVED
  // const fsBtn = document.getElementById("btnFullscreen"); // REMOVED
  // const seek = document.getElementById("seek"); // REMOVED
  // const time = document.getElementById("time"); // REMOVED
  const titleEl = document.getElementById("playerTitle");
  // metaEl already defined above
  const back = document.getElementById("backBtn");
  
  // --- IMMEDIATE UI UPDATE (OPTIMIZATION) ---
  // If we have metadata in URL params, render it immediately to reduce perceived latency
  const pTitle = qs("title");
  const pPoster = qs("poster");
  const pCategory = qs("category");
  const pSeason = qs("season");
  const pEpisode = qs("episode");
  
  if (pTitle && titleEl) {
      titleEl.textContent = pTitle;
  }
  
  if (metaEl) {
      let metaText = "";
      if (type === "episode" && pSeason && pEpisode) {
          metaText = `Season ${pSeason} • Episode ${pEpisode}`;
      } else if (pCategory) {
          metaText = pCategory;
      }
      // Only set if we have something, otherwise leave default (loading...)
      if (metaText) metaEl.textContent = metaText;
  }
  
  // Set poster immediately if available
  if (pPoster && video) {
      video.poster = pPoster;
  }
  // ------------------------------------------
  
  const btnSettings = document.getElementById("btnSettings");
  const trackModal = document.getElementById("trackModal");
  const audioSelect = document.getElementById("audioSelect");
  const subtitleSelect = document.getElementById("subtitleSelect");
  const closeTrackModal = document.getElementById("closeTrackModal");

  // Mobile Controls - REMOVED
  // const mobileBackBtn = document.getElementById("mobileBackBtn");
  // const mobileTitle = document.getElementById("playerTitle"); 
  // const btnSeekBack = document.getElementById("btnSeekBack");
  // const btnSeekFwd = document.getElementById("btnSeekFwd");
  // const btnPlayBig = document.getElementById("btnPlayBig");

  if (!video) {
      if (log) log.innerHTML += "<div>MISSING DOM: video</div>";
      if (loader) {
          if (window.finishLoading) window.finishLoading();
          else loader.style.display = "none";
      }
      console.error("Critical elements missing: video");
      return;
  }
  if (log) log.innerHTML += "<div>DOM Elements Found</div>";
  
  // Track Modal Logic
  if (btnSettings && trackModal && closeTrackModal) {
      console.log("[UI] Settings button and modal found");
      btnSettings.addEventListener("click", () => {
          console.log("[UI] Opening settings modal");
          trackModal.style.display = "flex";
          if (video.paused === false) video.pause(); // Optional: pause when opening settings
      });
      closeTrackModal.addEventListener("click", () => {
          trackModal.style.display = "none";
          if (video.paused) video.play().catch(() => {});
      });
  } else {
      console.warn("[UI] Settings button or modal MISSING", { btnSettings, trackModal, closeTrackModal });
  }

  if (back) {
    back.addEventListener("click", () => {
      // If inside iframe (overlay mode), close it
      if (window.self !== window.top) {
          try {
              window.parent.postMessage("klyx-close-player", "*");
          } catch(e) {
              console.error("Failed to post message to parent", e);
          }
          return;
      }

      // If opened in a popup/new window (opener exists), close it
      if (window.opener) {
          window.close();
          return;
      }

      if (type === "live") window.location.href = "./live-tv.html";
      else if (type === "movie") window.location.href = "./movies.html";
      else window.location.href = "./series.html";
    });
  }

  // OPTIMIZATION: Start fetching progress in parallel with detail loading
  const progressPromise = api.playback.getProgress({ contentType: type, contentId: id });

  const detail = await loadDetail(type, id);
  if (!detail.ok) {
    if (log) log.innerHTML += `<div>DETAIL ERROR: ${detail.error}</div>`;
    metaEl.textContent = detail.error;
    if (loader) {
        if (window.finishLoading) window.finishLoading();
        else loader.style.display = "none";
    }
    
    // Auto-retry if subscription error
    if (detail.error && detail.error.includes("Assinatura")) {
       const mac = localStorage.getItem('klyx_device_mac');
       const key = localStorage.getItem('klyx_device_key');
       
       if (mac && key) {
           const poller = setInterval(async () => {
               try {
                   const res = await api.auth.checkDevice(mac, key);
                   if (res.ok && res.data && res.data.active) {
                       clearInterval(poller);
                       metaEl.textContent = "Assinatura detectada! Recarregando...";
                       setTimeout(() => window.location.reload(), 1000);
                   }
               } catch (e) {
                    console.error("Poll error", e);
                }
            }, 1000); // Check every 1 second
        }
     }
     return;
   }

  if (log) log.innerHTML += `<div>Detail Loaded: ${detail.title}</div>`;

  titleEl.textContent = detail.title;
  metaEl.textContent = detail.meta;

  // Poster Overlay REMOVED to prevent blocking controls
  // We rely on native controls entirely now.
  
  const streamUrl = detail.streamUrl;
  const streamUrlSub = detail.streamUrlSub;
  const streamType = getStreamType(streamUrl);

  const isLegendado = (detail.category && detail.category.toLowerCase().includes('legendado')) || 
                      (detail.title && (detail.title.toLowerCase().includes('[leg]') || detail.title.toLowerCase().includes('(legendado)') || detail.title.toLowerCase().includes('(leg)')));

  // --- SERIES UI LOGIC ---
  if (type === "episode") {
      setupSeriesUI(detail, video);

      // HYDRATION: If we used fast path, we need to fetch episodes list for "Next Episode" feature
      if (!detail.episodes && detail.seriesId) {
          console.log("[Player] Hydrating series episodes in background...");
          api.series.episodes(detail.seriesId).then(res => {
              if (res.ok && res.data.episodes) {
                  detail.episodes = res.data.episodes;
                  detail.currentEpIndex = detail.episodes.findIndex(e => String(e.id) === String(id));
                  console.log("[Player] Series hydrated. Re-running UI setup.", detail.currentEpIndex);
                  setupSeriesUI(detail, video);
              }
          }).catch(e => console.error("[Player] Hydration failed", e));
      }
  }

  const progressRes = await progressPromise;
  // FIX: api.js returns the object directly in data, not nested in data.progress
  // Also check if data is not empty object
  let progress = (progressRes.ok && progressRes.data && (progressRes.data.position_seconds || progressRes.data.positionSeconds)) ? progressRes.data : null;

  if (progress) {
    console.log(`[Resume] Fetched progress:`, progress);
  } else {
    console.log(`[Resume] No progress found for ${type} ${id}`);
  }

  await attachSource({ 
      video, 
      streamUrl, 
      streamUrlSub,
      streamType,
      ui: { btnSettings, audioSelect, subtitleSelect },
      isLegendado,
      startTime: (progress && progress.position_seconds > 10) ? progress.position_seconds : 0,
      saveProgress // Pass function reference
  });
  
  // --- REAL-TIME SUBSCRIPTION CHECK ---
  // Check status every 10 seconds. If expired, block playback.
  let subCheckInterval = setInterval(async () => {
       try {
           // PRIORITIZE DEVICE CHECK (Source of Truth)
           const mac = localStorage.getItem('klyx_device_mac');
           const key = localStorage.getItem('klyx_device_key');

           if (mac) {
               const dRes = await api.auth.checkDevice(mac, key);
               if (dRes.ok && dRes.data) {
                   const d = dRes.data;
                   const now = new Date();
                   let isActive = (d.active === true || d.status === 'active');
                   
                   if (d.expires_at && new Date(d.expires_at) < now) {
                       isActive = false;
                   }

                   if (!isActive) {
                       clearInterval(subCheckInterval);
                       video.pause();
                       showExpiredModal();
                   }
                   return;
               }
           }

           // Fallback to User Session (Legacy)
           const me = await api.auth.me();
           if (me.ok && me.data?.user) {
               const u = me.data.user;
               // Check both field names for compatibility
               const expires = (u.expires_at || u.subscription_expires_at) ? new Date(u.expires_at || u.subscription_expires_at) : null;
               const now = new Date();
               
               // Check if status is explicitly active OR (if status is missing/active) check expiration date
               // Some active users might not have status field set, so default to active if not 'blocked'/'expired'
               const status = u.status || u.subscription_status || 'active';
               let isActive = (status === 'active');
               
               if (isActive && expires && expires < now) {
                   isActive = false;
               }
               
               if (!isActive) {
                       clearInterval(subCheckInterval);
                       video.pause();
                       showExpiredModal(status === 'expired' ? 'expired' : 'blocked');
                   }
               }
           } catch (e) {
               console.error("Sub check failed", e);
           }
      }, 10000); // Check every 10s
    
      // Initial Check (Run once immediately)
      (async () => {
           try {
               const mac = localStorage.getItem('klyx_device_mac');
               if (mac) {
                   const dRes = await api.auth.checkDevice(mac, localStorage.getItem('klyx_device_key'));
                   if (dRes.ok && dRes.data) {
                        const d = dRes.data;
                        const now = new Date();
                        const exp = d.expires_at || d.subscription_expires_at;
                        if (exp && new Date(exp) < now) {
                            showExpiredModal('expired');
                            if(video) video.pause();
                            return; // Stop here
                        }
                   }
               } else {
                   const me = await api.auth.me();
                   if (me.ok && me.data?.user) {
                       const u = me.data.user;
                       const exp = u.expires_at || u.subscription_expires_at;
                       const status = u.status || u.subscription_status || 'active';
                       if (status !== 'active' || (exp && new Date(exp) < new Date())) {
                           showExpiredModal(status === 'pending_activation' ? 'pending' : 'expired');
                           if(video) video.pause();
                           return;
                       }
                   }
               }
           } catch(e) {}
      })();
    
      function showExpiredModal(type = 'expired') {
           // Show blocking modal
           let title = "Assinatura Expirada";
           let msg = "Renove para continuar assistindo"; // Default for expired
           
           if (type === 'pending' || type === 'pending_activation') {
               title = "Bem-vindo ao Klyx";
               msg = "Ative pela primeira vez sua conta";
           }
           
           const modal = document.createElement('div');
           modal.style.position = 'fixed';
           modal.style.top = '0';
           modal.style.left = '0';
           modal.style.width = '100%';
           modal.style.height = '100%';
           modal.style.background = 'rgba(0,0,0,0.95)';
           modal.style.display = 'flex';
           modal.style.flexDirection = 'column';
           modal.style.alignItems = 'center';
           modal.style.justifyContent = 'center';
           modal.style.zIndex = '9999';
           modal.innerHTML = `
               <h2 style="color: #e50914; margin-bottom: 20px;">${title}</h2>
               <p style="color: white; margin-bottom: 30px; text-align: center; text-transform: uppercase;">${msg}</p>
               <button onclick="window.location.href='./settings.html'" style="padding: 12px 24px; background: #e50914; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Renovar Agora</button>
           `;
           document.body.appendChild(modal);
      }
  
  // Clear interval on unload
  window.addEventListener('beforeunload', () => clearInterval(subCheckInterval));
  // ------------------------------------

  // --- Resume Logic ---
  let resumeApplied = false;
  let resumeAttempts = 0;
  
  const applyResume = () => {
      // Don't interfere if we are manually switching sources (dub/sub)
      if (window.isSwitchingSource) {
          console.log("[Resume] Skipped due to active source switch.");
          return;
      }

      // If we have progress, try to resume
      const savedPos = progress ? (progress.position_seconds || progress.positionSeconds) : 0;
      if (savedPos > 10 && type !== "live") {
          const target = savedPos;
          
          // If we are already close (within 5s), consider resume successful and stop
          if (Math.abs(video.currentTime - target) < 5) {
              if (window.finishLoading) window.finishLoading();
              return;
          }
          
          // Limit attempts to avoid fighting user or browser
          if (resumeAttempts > 5) {
             console.warn("[Resume] Too many failed seek attempts. Stopping.");
             if (window.finishLoading) window.finishLoading();
             return;
          }
          
          resumeAttempts++;
          console.log(`[Resume] Attempt ${resumeAttempts}: Target ${target}s, Current ${video.currentTime}s`);

          const performSeek = () => {
             try {
                 if (target > 0) {
                     video.currentTime = target;
                     console.log("[Resume] Seek command sent to " + target);
                 }
             } catch (e) {
                 console.warn("[Resume] Seek failed", e);
             }
          };

          if (video.readyState === 0) {
              video.addEventListener('loadedmetadata', performSeek, { once: true });
          } else {
              performSeek();
          }

          // Ensure play happens after seek
          const onSeeked = () => {
              console.log("[Resume] Seek completed. Playing...");
              const p = video.play();
              if (p && p.catch) p.catch(e => { if (e.name !== 'AbortError') console.warn("[Resume] Play deferred", e); });
              if (window.finishLoading) window.finishLoading();
          };
          
          video.addEventListener('seeked', onSeeked, { once: true });
          
          // Fallback: If seeked doesn't fire (e.g. already at target or seek failed), ensure we play
          setTimeout(() => {
              if (video.paused) {
                  console.log("[Resume] Fallback play trigger");
                  video.play().catch(() => {});
              }
              // Check if seek worked, if not, try again next time applyResume is called (via events)
          }, 1000);

      } else {
          // No resume needed, just ensure it plays
          if (window.finishLoading) window.finishLoading();
          
          if (video.paused && video.readyState > 2) {
              video.play().catch(() => {});
          }
      }
  };

  // Try immediately if ready
  if (video.readyState >= 1) {
      applyResume();
  }

  // Also try on metadata load (standard HTML5)
  video.addEventListener('loadedmetadata', applyResume);
  
  // Also try on HLS manifest parsed (if HLS is used, this event bubbles or we can hook into HLS instance if we had access)
  // Since we don't have direct access to HLS instance here easily (it's in attachSource), 
  // we rely on loadedmetadata which HLS.js also triggers.
  // We can also listen for 'playing' just in case.
  video.addEventListener('canplay', applyResume);

  // ------------------------------------


  // --- Playback Progress Saving (Resume Feature) ---
  let lastSaveAt = 0;
  async function saveProgress(force = false) {
    if (type === "live") return;
    const now = Date.now();
    
    // If not forced, check debounce
    if (!force && (now - lastSaveAt < 5000)) return; 
    
    lastSaveAt = now;
    
    const pos = Number.isFinite(video.currentTime) ? video.currentTime : 0;
    const dur = Number.isFinite(video.duration) ? video.duration : 0;
    
    if (pos < 5) return; // Don't save if just started (less than 5s)

    // FIX: Prevent overwriting progress if resume failed (started at 0 instead of saved position)
    const originalStart = progress ? (progress.position_seconds || progress.positionSeconds || 0) : 0;
    if (originalStart > 120 && pos < 45) {
        console.warn(`[Playback] Safety skip: Pos (${pos}s) << Original (${originalStart}s). Resume likely failed.`);
        return;
    }

    const payload = {
      contentType: type,
      contentId: id,
      position_seconds: pos, // Backend standard
      duration_seconds: dur, // Backend standard
      positionSeconds: pos,  // Legacy/Client compat
      durationSeconds: dur,  // Legacy/Client compat
      title: detail.title || "",
      posterUrl: detail.posterUrl || "",
      category: detail.category || "",
      seriesId: detail.seriesId || null,
    };
    
    // Update local progress reference immediately so applyResume works correctly 
    // if reload/switch happens (e.g. changing audio)
    progress = payload;

    console.log(`[Playback] Saving ${Math.floor(pos)}/${Math.floor(dur)}s`);
    
    try {
        const res = await api.playback.saveProgress(payload);
        if (!res.ok && res.status === 401) {
           console.warn("Save progress failed (401). Ignoring.");
        }
    } catch (e) {
        console.error("Save progress error", e);
    }
  }

  video.addEventListener("timeupdate", () => saveProgress(false));
  video.addEventListener("pause", () => saveProgress(true)); // Force save on pause
  window.addEventListener("beforeunload", () => saveProgress(true)); // Force save on exit
  document.addEventListener("visibilitychange", () => {
      if (document.visibilityState === "hidden") saveProgress(true);
  });

  video.addEventListener("ended", async () => {
      if (type === "live") return;
      console.log("[Playback] Video ended. Removing from Quick Resume...");
      try {
          await api.playback.removeProgress({ contentType: type, contentId: id });
      } catch (e) {
          console.error("[Playback] Failed to remove progress", e);
      }
  });

  // Ensure loader is dismissed as soon as data is loaded
  const dismissLoader = () => {
      if (window.finishLoading) window.finishLoading();
  };
  video.addEventListener("loadeddata", dismissLoader);
  video.addEventListener("canplay", dismissLoader);
  video.addEventListener("playing", dismissLoader);
  
  // Remove explicit hide here, rely on events and timeout
  // const loader = document.getElementById("loading-overlay");
  // if (loader) loader.style.display = "none";
}

async function loadDetail(type, id) {
  // OPTIMIZATION: Check if details are passed in URL to skip API call
   const stream = qs("stream");
   
   if (stream && type === "movie") {
       console.log("[Player] Fast path: Loading movie from URL params");
       return {
           ok: true,
           title: qs("title") || "Sem Título",
           category: qs("category") || "",
           meta: qs("category") || "",
           streamUrl: stream,
           streamUrlSub: qs("streamSub"),
           posterUrl: qs("poster"),
       };
   }

   if (stream && type === "live") {
      console.log("[Player] Fast path: Loading live channel from URL params");
      return { 
          ok: true, 
          title: qs("title") || "AO VIVO", 
          category: qs("category") || "", 
          meta: `${qs("category") || ""} • LIVE`, 
          streamUrl: stream, 
          posterUrl: qs("poster") 
      };
  }

  if (stream && type === "episode") {
      console.log("[Player] Fast path: Loading episode from URL params");
      return {
          ok: true,
          title: qs("title") || "Episódio",
          category: qs("category") || "",
          meta: `Season ${qs("season") || "?"} • Episode ${qs("episode") || "?"}`,
          streamUrl: stream,
          streamUrlSub: qs("streamSub"),
          posterUrl: qs("poster"),
          seriesId: qs("seriesId"),
          // Missing episodes list will be hydrated later
      };
  }

   if (type === "movie") {
    const res = await api.movies.get(id);
    if (!res.ok) return { ok: false, error: res.data?.error || "Movie not found" };
    const m = res.data.item;
    if (!m) return { ok: false, error: "Movie data missing" };
    if (m.blocked) return { ok: false, error: m.message || "Assinatura necessária para assistir." };
    return {
      ok: true,
      title: m.title,
      category: m.category,
      meta: `${m.category} • ${m.year} • ★ ${Number(m.rating).toFixed(1)}`,
      streamUrl: m.stream_url,
      streamUrlSub: m.stream_url_sub,
      posterUrl: m.poster_url,
    };
  }

  if (type === "series") {
    const res = await api.series.get(id);
    if (!res.ok) return { ok: false, error: res.data?.error || "Series not found" };
    const s = res.data.item;
    if (!s) return { ok: false, error: "Series data missing" };
    const eps = await api.series.episodes(id);
    const first = (eps.ok && eps.data && eps.data.episodes) ? eps.data.episodes[0] : null;
    if (!first) return { ok: false, error: "No episodes found" };
    if (first.blocked) return { ok: false, error: first.message || "Assinatura necessária para assistir." };
    return {
      ok: true,
      title: s.title,
      category: s.category,
      meta: `${s.category} • ${s.year} • ★ ${Number(s.rating).toFixed(1)}`,
      streamUrl: first.stream_url,
      streamUrlSub: first.stream_url_sub,
      posterUrl: s.poster_url,
    };
  }

  if (type === "episode") {
    const seriesId = qs("seriesId");
    if (!seriesId) {
      return { ok: false, error: "Missing seriesId for episode playback" };
    }
    const eps = await api.series.episodes(seriesId);
    if (!eps.ok) {
      return { ok: false, error: "Episode lookup failed" };
    }
    const epIndex = eps.data.episodes.findIndex((e) => e.id === id);
    const ep = eps.data.episodes[epIndex];

    if (!ep) return { ok: false, error: "Episode not found" };
    if (ep.blocked) return { ok: false, error: ep.message || "Assinatura necessária para assistir." };
    
    let posterUrl = "";
    let category = "";
    try {
        const sRes = await api.series.get(seriesId);
        if (sRes.ok && sRes.data && sRes.data.item) {
            posterUrl = sRes.data.item.poster_url;
            category = sRes.data.item.category;
        }
    } catch (e) {}

    return {
      ok: true,
      title: ep.title,
      category: category,
      meta: `Season ${ep.season_number} • Episode ${ep.episode_number}`,
      streamUrl: ep.stream_url,
      streamUrlSub: ep.stream_url_sub,
      posterUrl: posterUrl,
      episodes: eps.data.episodes,
      currentEpIndex: epIndex,
      seriesId: seriesId
    };
  }

  if (type === "live") {
    const res = await api.live.get(id);
    if (!res.ok) return { ok: false, error: res.data?.error || "Channel not found" };
    const c = res.data.item;
    if (!c) return { ok: false, error: "Channel data missing" };
    if (c.blocked) return { ok: false, error: c.message || "Assinatura necessária para assistir." };
    return { ok: true, title: c.title, category: c.category, meta: `${c.category} • LIVE`, streamUrl: c.stream_url, posterUrl: c.thumbnail_url };
  }

  return { ok: false, error: "Unsupported type" };
}

async function attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado, startTime = 0, saveProgress }) {
  const log = null;
  let hls = null;
  // Track the current playing URL to determine selection state
  let currentPlayingUrl = streamUrl;

  // Helper to detect if we are running in a static environment (GitHub Pages, etc) where proxy is unavailable
  // We assume static if:
  // 1. Known static hosts (github.io, vercel, etc)
  // 2. File protocol
  // 3. URL path contains ".html" (PHP backend typically uses clean routes)
  const isStaticHost = window.location.hostname.includes("github.io") || 
                       window.location.hostname.includes("vercel.app") || 
                       window.location.hostname.includes("netlify.app") ||
                       window.location.protocol === "file:" ||
                       window.location.pathname.includes(".html") ||
                       (window.Capacitor !== undefined);

  // Ensure HLS lib is loaded if needed
  // Always load HLS.js for 'live' type or if .m3u8 is detected
  if (!window.Hls && (streamType === "hls" || (streamUrlSub && getStreamType(streamUrlSub) === "hls") || qs("type") === "live")) {
    const script = document.createElement("script");
    script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
    script.async = true;
    await new Promise((resolve, reject) => {
      script.onload = resolve;
      script.onerror = reject;
      document.head.appendChild(script);
    });
  }

  // --- MULTI-PROXY FALLBACK SYSTEM ---
  // List of proxies to try in order.
  // 1. corsproxy.io (Best, fast, HTTPS-compliant)
  // 2. allorigins (Good backup)
  // 3. thingproxy (Another option)
  const PROXY_LIST = [
       (u) => `https://corsproxy.io/?url=${encodeURIComponent(u)}`,
       (u) => `https://api.allorigins.win/raw?url=${encodeURIComponent(u)}`,
       //(u) => `https://thingproxy.freeboard.io/fetch/${u}` // Often unstable, kept as last resort
  ];

  let currentProxyIndex = 0;
  let hasTriedAllProxies = false;

  // --- DEBUG OVERLAY ---
  let debugEl = document.getElementById("debug-overlay");
  if (!debugEl) {
      debugEl = document.createElement("div");
      debugEl.id = "debug-overlay";
      debugEl.style.cssText = "position:fixed; top:0; left:0; width:100%; height:auto; max-height:200px; overflow-y:auto; background:rgba(0,0,0,0.7); color:#0f0; font-family:monospace; font-size:12px; z-index:99999; padding:10px; pointer-events:none; display:none;"; // Hidden by default, toggle with key
      document.body.appendChild(debugEl);
      
      // Toggle with 'D' key
      document.addEventListener("keydown", (e) => {
          if (e.key === "d" || e.key === "D") {
              debugEl.style.display = debugEl.style.display === "none" ? "block" : "none";
          }
      });
  }

  const logToOverlay = (msg) => {
              console.log("[PlayerDebug]", msg);
              if (debugEl) {
                  const line = document.createElement("div");
                  line.textContent = `[${new Date().toLocaleTimeString()}] ${msg}`;
                  line.style.borderBottom = "1px solid #333";
                  debugEl.appendChild(line);
                  debugEl.scrollTop = debugEl.scrollHeight;
              }
          };

          // Initial instructions
          logToOverlay("Debug Mode ON. Press 'D' to toggle.");
          logToOverlay("Se filmes falham (404), tente um Canal ao Vivo e compare a URL.");

  const loadStream = async (url, startTime = 0) => {
      const log = null;
      // Save original URL for external fallback
      const originalUrl = url; 

      // --- CLEANUP UI ---
      const errOverlay = document.getElementById("errorOverlay");
      if (errOverlay) errOverlay.style.display = "none";
      const errorMsg = document.getElementById("errorMsg");
      if (errorMsg) errorMsg.innerHTML = "Carregando...";
      
      // Remove any existing action buttons from previous errors
      const btnIds = ["direct-play-btn-native", "direct-play-btn-hls", "direct-play-btn-fallback"];
      btnIds.forEach(id => {
          const btn = document.getElementById(id);
          if (btn) btn.remove();
      });

      logToOverlay(`LoadStream called: ${url}`);

      // --- URL TRANSFORMATION & CORRECTION ---
      // Fix broken relative paths reported by user (e.g. /movie/123/stream)
      // Convert to NGINX format: /streams/movie_123/index.m3u8
      const brokenPattern = /\/movie\/(\w+)\/stream/;
      if (url.match(brokenPattern)) {
          const movieId = url.match(brokenPattern)[1];
          // Construct absolute URL for safety
          url = `${window.location.origin}/streams/movie_${movieId}/index.m3u8`;
          logToOverlay(`Fixed Broken URL -> ${url}`);
      } else if (!url.startsWith("http") && !url.startsWith("/")) {
           // Fix generic relative path
           url = "/" + url;
      }
      
      // Fix double slash issues (except http://)
      if (url.startsWith("http")) {
          // ensure no double slashes after protocol
          // but allow double slashes in protocol (http://)
      } else {
          url = url.replace(/\/\//g, "/");
      }


      // IF USER HAS SESSION CREDENTIALS, REPLACE THEM IN URL
      let finalUrl = url;
      const mac = localStorage.getItem('klyx_device_mac');
      const key = localStorage.getItem('klyx_device_key');
      
      if (mac && key && finalUrl.includes("camelo.vip")) {
          // Detect URL pattern: http://camelo.vip:80/movie/USER/PASS/ID.mp4
          // Or: http://camelo.vip:80/USER/PASS/ID.ts
          
          // Sanitize MAC: Remove colons for URL compatibility
          const cleanMac = mac.replace(/:/g, '');

          const parts = finalUrl.split('/');
          // Example parts: ["http:", "", "camelo.vip:80", "movie", "Jonas1854", "Q57Bmz", "363191.mp4"]
          
          if (finalUrl.includes("/movie/")) {
              if (parts.length >= 6) {
                  parts[4] = cleanMac;
                  parts[5] = key;
                  finalUrl = parts.join('/');
                  logToOverlay(`Credential Replaced (Movie) [Sanitized MAC]: ${finalUrl}`);
              }
          } else if (finalUrl.includes("/series/")) {
               // http://host/series/user/pass/id.mp4
               if (parts.length >= 6) {
                  parts[4] = cleanMac;
                  parts[5] = key;
                  finalUrl = parts.join('/');
                  logToOverlay(`Credential Replaced (Series) [Sanitized MAC]: ${finalUrl}`);
               }
          } else if (parts.length >= 5) {
              // Live or other without /movie/ or /series/
              // Ensure we don't accidentally break URLs with other prefixes
              if (parts[3] !== 'movie' && parts[3] !== 'series') {
                  parts[3] = cleanMac;
                  parts[4] = key;
                  finalUrl = parts.join('/');
                  logToOverlay(`Credential Replaced (Live) [Sanitized MAC]: ${finalUrl}`);
              }
          }
      } else {
          logToOverlay(`No credential replacement. MAC/Key present? ${!!mac}/${!!key}`);
      }

      url = finalUrl; // Use updated URL with user credentials

      if (log) log.innerHTML += `<div>Attempting load: ${url} (Start: ${startTime}s)</div>`;

      // MIXED CONTENT CHECK & AUTO-FIX
      // GitHub Pages (HTTPS) cannot play HTTP streams directly.
      if (window.location.protocol === 'https:' && url.startsWith('http:') && !url.includes('localhost') && !url.includes('127.0.0.1')) {
          logToOverlay("Mixed Content detected (HTTP on HTTPS).");
          console.warn("Mixed Content detected (HTTP on HTTPS).");
          
          // Check if already proxied by one of our known proxies
          const isProxied = url.includes("corsproxy.io") || url.includes("api.allorigins.win") || url.includes("thingproxy");

          if (!isProxied) {
               logToOverlay(`Forcing Proxy (Attempt ${currentProxyIndex + 1})...`);
               console.warn(`Forcing Proxy (Attempt ${currentProxyIndex + 1})...`);
               
               // Use the current proxy in the rotation
               const proxyFn = PROXY_LIST[currentProxyIndex];
               if (proxyFn) {
                   url = proxyFn(url);
               } else {
                   // Should not happen if index is managed correctly, but fallback to first
                   url = PROXY_LIST[0](url);
               }
               logToOverlay(`Proxied URL: ${url}`);
          }
      }


      // FORCE PROXY logic for simple_server with proxy support
      // Only apply if we are running on a server (http/https), not file://
      if (!isStaticHost && window.location.protocol.startsWith('http') && url.startsWith("http") && !url.includes("/stream-proxy") && !url.includes("localhost") && !url.includes("127.0.0.1")) {
          // Skip force proxy if we already validated or transformed?
          // No, keep it but ensure we don't loop if proxy is dead.
          if (window.hasProxy !== false) {
              console.warn("Forcing proxy for external URL...");
              if (log) log.innerHTML += "<div>Forcing Proxy...</div>";
              
              let proxyUrl = `/stream-proxy?url=${encodeURIComponent(url)}`;
              
              // Recursively call with proxy url
              loadStream(proxyUrl, startTime);
              return;
          }
      }

      // --- SOURCE VALIDATION (Requested by User) ---
      // Validate video source before playing.
      if (qs("type") !== "live" && !isStaticHost) {
          // Check if proxy is available first (one-time check)
          if (window.hasProxy === undefined && !url.includes("/stream-proxy")) {
               try {
                   const res = await fetch('/stream-proxy?ping=1');
                   window.hasProxy = res.ok;
                   if (window.hasProxy) logToOverlay("Local Proxy Detected.");
               } catch(e) {
                   window.hasProxy = false;
                   logToOverlay("Local Proxy Unavailable.");
               }
          }

          logToOverlay(`Validating Source: ${url}`);
          try {
              const res = await fetch(url, { method: 'HEAD' });
              if (res.status === 404) {
                  console.error("Source validation failed: 404 Not Found");
                  logToOverlay("Validation Failed: 404 Not Found");
                  
                  // Show Error Immediately
                  const errMsgEl = document.getElementById("errorMsg");
                  if (errMsgEl) {
                      errMsgEl.innerHTML = "Erro: Arquivo de vídeo não encontrado (404).<br>Verifique a URL ou a conexão com o servidor.";
                  }
                  const errOverlay = document.getElementById("errorOverlay");
                  if (errOverlay) errOverlay.style.display = "flex";
                  
                  // Hide spinner
                  if (window.finishLoading) window.finishLoading();
                  const loader = document.getElementById("loading-overlay");
                  if (loader) loader.style.display = "none";
                  return; // STOP PLAYBACK
              }
              logToOverlay("Validation OK (200/2xx)");
          } catch (e) {
              // Network error (CORS, Offline, etc)
              console.warn("Validation request failed (CORS?), attempting playback anyway...", e);
              logToOverlay("Validation skipped (CORS/Network Error)");
          }
      }

      // Define initHlsFallback outside so we can call it immediately if needed
      const initHlsFallback = () => {
          if (window.Hls && window.Hls.isSupported()) {
               if (hls) hls.destroy();
               
               // Use Vercel Proxy if configured
               let finalUrl = url;
               if (VERCEL_PROXY_URL && url.startsWith("http")) {
                   console.log("Using Vercel Proxy for:", url);
                   finalUrl = VERCEL_PROXY_URL + url; // No encodeURIComponent based on user example, but usually safer. User example: .../api?url=https://...
                   // Actually, query params should be encoded if the target url has params.
                   // But user example shows direct concatenation. I'll stick to direct if they didn't specify, 
                   // but usually browsers handle one level. Let's trust the user's "100% functional" guide 
                   // which implies direct usage or maybe they just didn't mention encoding.
                   // Safer: encodeURIComponent if it's a query param.
                   // The user code: const url = req.query.url; -> standard express/vercel parsing.
                   // If I send ?url=http://a.com?b=1, it might break.
                   // I will use encodeURIComponent just to be safe, it shouldn't break the backend.
                   // Wait, user example: "https://iptv-proxy.vercel.app/api?url=https://SEU_IPTV.m3u8"
                   // It doesn't look encoded there.
                   // I will try without encoding first to match their guide exactly, but maybe add a comment.
                   finalUrl = VERCEL_PROXY_URL + url; 
               }

               // OPTIMIZED HLS CONFIG FOR INSTANT PLAYBACK & HUGE TS FILES
               const hlsConfig = {
                   enableWorker: true,
                   lowLatencyMode: true,
                   backBufferLength: 30,
                   // Aggressively start playback
                   startLevel: -1, 
                   startPosition: startTime > 0 ? startTime : -1,
                   startFragPrefetch: true,
                   // Tuning for speed
                   maxBufferLength: 30,
                   maxMaxBufferLength: 60,
                   // Retry Logic
                   manifestLoadingTimeOut: 20000,
                   manifestLoadingMaxRetry: 4,
                   levelLoadingTimeOut: 20000,
                   levelLoadingMaxRetry: 4,
                    // Use a very long timeout (1 hour) instead of 0 to avoid immediate timeout bug in some HLS versions
                    fragLoadingTimeOut: 3600000, 
                    fragLoadingMaxRetry: 10,
                    // Live sync
                   liveSyncDurationCount: 3, 
                   liveMaxLatencyDurationCount: 10,
                   liveDurationInfinity: true,
               };

               hls = new window.Hls(hlsConfig);
               video.hls = hls;
               hls.loadSource(finalUrl); 
               hls.attachMedia(video);
               
               hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
                   // FORCE RESUME IF HLS CONFIG FAILED
                   if (startTime > 0) {
                       console.log(`[HLS] Manifest parsed. Checking resume. Target: ${startTime}, Current: ${video.currentTime}`);
                       if (Math.abs(video.currentTime - startTime) > 5) {
                           console.log(`[HLS] Forcing seek to ${startTime}s`);
                           video.currentTime = startTime;
                       }
                   }

                   const errOverlay = document.getElementById("errorOverlay");
                   const loader = document.getElementById("loading-overlay");
                   if (errOverlay) errOverlay.style.display = "none";
                   // Don't hide loader yet, wait for canplay/playing to avoid black flash
                   
                   // Try to play when ready
                   const playPromise = video.play();
                   if (playPromise !== undefined) {
                       playPromise.catch(e => {
                           console.warn("HLS Auto-play deferred:", e);
                           // User interaction might be needed, but for IPTV we hope for the best
                       });
                   }
               });
               
               hls.on(window.Hls.Events.ERROR, (event, data) => {
                   console.error("HLS Error:", data);
                   
                   // If non-fatal, keep trying but ensure spinner isn't stuck forever if it plays
                   if (!data.fatal) {
                       return;
                   }

                   if (data.fatal) {
                       switch(data.type) {
                           case window.Hls.ErrorTypes.NETWORK_ERROR:
                               console.log("fatal network error encountered, try to recover");
                               hls.startLoad();
                               break;
                           case window.Hls.ErrorTypes.MEDIA_ERROR:
                               console.log("fatal media error encountered, try to recover");
                               hls.recoverMediaError();
                               break;
                           default:
                               // cannot recover
                               if (hls) {
                                   hls.destroy();
                                   hls = null;
                               }
                               
                               // NATIVE FALLBACK: If HLS fails (e.g. Manifest Error on TS), try native
              if (!isStaticHost && !url.includes("/stream-proxy") && url.startsWith("http")) {
                  console.warn("HLS Fatal Error. Retrying with proxy...");
                  const proxyUrl = `/stream-proxy?url=${encodeURIComponent(url)}`;
                  loadStream(proxyUrl, startTime); // Recursively call loadStream with proxy and SAME startTime
              } else {
                  console.warn("HLS Fatal Error. Falling back to native playback...");
                  video.src = url;
                  video.load();
                  // Apply resume manually for native fallback
                  if (startTime > 0) {
                      video.currentTime = startTime;
                  }
                  const p = video.play();
                  if (p) p.catch(e => { 
                      if (e.name !== 'AbortError') console.error("Native fallback play error:", e);
                          if (isStaticHost) {
                              const errMsgEl = document.getElementById("errorMsg");
                              if (errMsgEl) {
                                  // Keep error message minimal if we are auto-retrying or just failed proxy
                                   errMsgEl.innerHTML = "Falha na reprodução. Tente abrir externamente.";
                                   
                                   // Create Action Button
                                   const btnId = "direct-play-btn-fallback";
                                   let btn = document.getElementById(btnId);
                                   if (!btn) {
                                       btn = document.createElement("a");
                                       btn.id = btnId;
                                       btn.target = "_blank";
                                       btn.style.cssText = "display: block; width: fit-content; margin: 15px auto; padding: 10px 20px; background: #e50914; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; cursor: pointer;";
                                       btn.innerText = "▶ Abrir Vídeo em Nova Aba";
                                       errMsgEl.parentNode.appendChild(btn);
                                   }
                                   btn.href = originalUrl;
                                   
                                   // REMOVED: Auto-switch to Iframe Emulation (causes 404s)
                                   /*
                                   setTimeout(() => {
                                       if (video.paused || video.error) {
                                            console.warn("Proxy/Direct play failed. Switching to Iframe Emulation Mode.");
                                            // ...
                                       }
                                   }, 2500);
                                   */
                              }
                          }
              });
          }

                               break;
                       }
                   }
               });
               
               setupUI(hls);
          } else {
              const errMsgEl = document.getElementById("errorMsg");
              if (errMsgEl) errMsgEl.textContent = "HLS.js não suportado neste navegador.";
          }
      };

      // PROACTIVE HLS STRATEGY FOR LIVE TV
      // If it's a live channel, assume it needs HLS.js immediately (MPEG-TS or HLS)
      // Do not try native player first, as it often fails poorly with TS.
      if (qs("type") === "live") {
          console.log("Live TV detected. Forcing HLS.js...");
          if (window.Hls) {
              initHlsFallback();
              return; // Stop here, we are using HLS engine
          }
      }

      // Diagnostic listeners for video element
      const events = ["loadstart", "loadedmetadata", "canplay", "playing", "waiting", "stalled", "error"];
      events.forEach(evt => {
          video.addEventListener(evt, (e) => {
              if (log) log.innerHTML += `<div>Video Event: ${evt}</div>`;
              
              // Force hide spinner on playback start or canplay OR loadedmetadata (earlier)
              if (evt === "playing" || evt === "canplay" || evt === "loadedmetadata") {
                  if (window.finishLoading) window.finishLoading();
                  const loader = document.getElementById("loading-overlay");
                  if (loader && !window.finishLoading) loader.style.display = "none";
                  const errOverlay = document.getElementById("errorOverlay");
                  if (errOverlay) errOverlay.style.display = "none";
              }

              if (evt === "error") {
                  const err = video.error;
                  const errCode = err ? err.code : 'unknown';
                  const errMsg = err ? err.message : '';
                  if (log) log.innerHTML += `<div>VIDEO ERROR CODE: ${errCode} - ${errMsg}</div>`;
                  
                  // Show Error Overlay
                  const errOverlay = document.getElementById("errorOverlay");
                  const errMsgEl = document.getElementById("errorMsg");
                  if (errOverlay && errMsgEl && !hls) { // Don't show immediately if we are going to try HLS
                       errMsgEl.textContent = `Código: ${errCode}. Tentando recuperar...`;
                       errOverlay.style.display = "flex";
                  }

                  const loader = document.getElementById("loading-overlay");
                  if (loader) {
                      if (window.finishLoading) window.finishLoading();
                      else loader.style.display = "none";
                  }

                  // --- IPTV FIX: Handle FORMAT ERROR (4) by forcing HLS ---
                  // Many IPTV streams are MPEG-TS or HLS without .m3u8 extension.
                  // If native player fails with code 4, we try HLS.js
                  if (err && err.code === 4 && !hls) {
                      
                      // --- MULTI-PROXY ROTATION FOR MP4/STATIC FILES ---
                      // If it's a Mixed Content situation (HTTPS) and we are using proxies,
                      // Error 4 might mean the proxy failed or returned an error page.
                      // Try the next proxy BEFORE giving up or trying HLS (which won't work for MP4).
                      
                      const isMP4 = originalUrl.includes(".mp4") || originalUrl.includes(".mkv") || originalUrl.includes(".avi");
                      const isMixedContent = window.location.protocol === 'https:' && originalUrl.startsWith('http:');
                      
                      if (isMixedContent && isMP4 && currentProxyIndex < PROXY_LIST.length - 1) {
                           console.warn(`Proxy ${currentProxyIndex} failed for MP4. Trying next proxy...`);
                           currentProxyIndex++;
                           
                           if (errMsgEl) errMsgEl.innerHTML = `Tentando servidor alternativo (${currentProxyIndex+1}/${PROXY_LIST.length})...`;
                           
                           // Clean up and retry
                           video.removeAttribute('src'); // Detach current broken stream
                           video.load();
                           
                           // Use original URL, loadStream will apply the new proxy based on currentProxyIndex
                           setTimeout(() => loadStream(originalUrl, startTime), 1000);
                           return;
                      }
                      
                      // If we exhausted proxies OR it's not a proxy issue, proceed to HLS check
                      // ---------------------------------------------------------------------

                      console.warn("Media Format Error (4). Assuming IPTV Stream or Unsupported Format. Trying HLS.js...");
                      if (log) log.innerHTML += "<div>ERR 4: TRYING HLS.JS...</div>";
                      if (errMsgEl) {
                          errMsgEl.innerHTML = "Formato não suportado nativamente. Tentando modo compatibilidade (HLS)...<br>";
                          
                          // Remove duplicate buttons if they exist
                          const existingBtn = document.getElementById("direct-play-btn-native");
                          if (existingBtn) existingBtn.remove();
                          
                          // REMOVED: Action Button ("Open in new tab") as requested by user
                      }
                  
                  // Check if HLS lib is loaded, if not load it
                      if (!window.Hls) {
                           console.warn("HLS.js not loaded. Loading dynamically...");
                           const script = document.createElement("script");
                           script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
                           script.async = true;
                           script.onload = () => {
                               console.log("HLS.js loaded dynamically.");
                               initHlsFallback();
                           };
                           script.onerror = () => {
                               if (errMsgEl) errMsgEl.textContent = "Falha ao carregar biblioteca de reprodução.";
                           };
                           document.head.appendChild(script);
                           return; // Stop here, wait for script load
                      }
                      
                      // If already loaded
                      initHlsFallback();
                      return; // Stop further native error handling
                  }
                  // -------------------------------------------------------

                  // Proxy Fallback Logic
                  if (!isStaticHost && !url.includes("/stream-proxy") && url.startsWith("http")) {
                      console.warn("Video failed, trying proxy...");
                      if (log) log.innerHTML += "<div>RETRYING WITH PROXY...</div>";
                      const proxyUrl = `/stream-proxy?url=${encodeURIComponent(url)}`;
                      
                      if (hls) { hls.destroy(); hls = null; }
                      setTimeout(() => loadStream(proxyUrl, startTime), 500); // Pass startTime
                  }
              }
              
              if (evt === "canplay" || evt === "playing") {
                  if (window.finishLoading) window.finishLoading();
                  const loader = document.getElementById("loading-overlay");
                  if (loader) {
                      if (!window.finishLoading) loader.style.display = "none";
                      if (log) log.innerHTML += `<div>HID SPINNER (Event: ${evt})</div>`;
                  }
              }
          });
      });

      // Force hide spinner after 5 seconds of load start attempt, just in case events are missed
      setTimeout(() => {
          const loader = document.getElementById("loading-overlay");
          if (loader && loader.style.display !== "none") {
              // Only hide if video has buffered something or readyState is good
              if (video.readyState >= 2 || video.currentTime > 0) {
                 if (window.finishLoading) window.finishLoading();
                 else loader.style.display = "none";
                 if (log) log.innerHTML += "<div>TIMEOUT: Spinner hidden (readyState OK)</div>";
              }
          }
      }, 5000);

      // PROACTIVE TS FIX:
  // If the URL is a TS file OR a Live stream without .m3u8 extension, force it through the proxy
  // so the backend can wrap it in a synthetic M3U8 for HLS.js.
  // SKIP THIS if we are on a static host (no backend)
  const isLive = qs("type") === "live";
  const isM3u8 = url.includes(".m3u8");
  
  if (!isStaticHost && (url.match(/\.ts($|\?)/i) || (isLive && !isM3u8)) && !url.includes("/stream-proxy")) {
      console.log("Detecting potential raw stream (TS or Live without m3u8). Routing through proxy for HLS wrapping...");
      // Pass the playback type (live vs movie) to the proxy so it generates the correct playlist
      const playMode = qs("type") || "movie";
      url = `/stream-proxy?url=${encodeURIComponent(url)}&mode=${playMode}`;
  }

  currentPlayingUrl = url;
  let hasRetried = false; // Fix: Define hasRetried scope

  let isHls = url.includes(".m3u8");
      if (url.includes("/stream-proxy")) {
          try {
              const urlParams = new URLSearchParams(url.split('?')[1]);
              const targetUrl = decodeURIComponent(urlParams.get('url') || '');
              // Only treat as HLS if the underlying target is m3u8 or ts
              // If it's mp4/mkv, treat as native (false)
              if (targetUrl.includes(".m3u8") || targetUrl.includes(".ts")) {
                  isHls = true;
              } else {
                  isHls = false;
              }
          } catch (e) {
              console.warn("Error parsing proxy URL for HLS check", e);
              // Fallback to previous behavior if parsing fails
              isHls = true; 
          }
      }

      if (isHls && window.Hls) {
          // OPTIMIZATION: Reuse HLS instance if it exists to avoid full tear-down/rebuild overhead
          if (hls) {
              console.log(`[HLS] Reusing instance for fast switch to: ${url} at ${startTime}s`);
              
              // Stop loading previous stream immediately
              hls.stopLoad();
              
              // Update start position in config if possible (depends on HLS version, but safe to set)
              hls.config.startPosition = startTime > 0 ? startTime : -1;
              
              // Load new source
              hls.loadSource(url);
              
              // Ensure media is attached
              if (video.src !== url && !video.src.startsWith("blob:")) {
                  hls.attachMedia(video);
              }
              
              // Optimistic play
              video.play().catch(() => {});
              
              return;
          }
      }

      if (hls) {
          hls.destroy();
          hls = null;
      }
      
      // Native HLS (Safari)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          if (startTime > 0) {
             video.currentTime = startTime;
          }
          setupUI(null); 
          
          const loader = document.getElementById("loading-overlay");
          if (loader) {
              if (window.finishLoading) window.finishLoading();
              else loader.style.display = "none";
          }
          return;
      }

      // HLS.js Logic
      if (isHls) {
          if (!window.Hls) {
              console.warn("HLS.js not loaded. Loading dynamically...");
              if (log) log.innerHTML += "<div>Loading HLS.js...</div>";
              
              const script = document.createElement("script");
              script.src = "https://cdn.jsdelivr.net/npm/hls.js@1.5.17/dist/hls.min.js";
              script.async = true;
              script.onload = () => {
                  console.log("HLS.js loaded dynamically.");
                  initHlsFallback();
              };
              script.onerror = () => {
                   if (document.getElementById("errorMsg")) document.getElementById("errorMsg").textContent = "Falha ao carregar biblioteca de reprodução.";
              };
              document.head.appendChild(script);
              return; 
          }
          
          initHlsFallback();
          return;
      }
      
      // Direct File Playback (MP4/MKV)
      if (log) log.innerHTML += "<div>Direct File Playback Mode</div>";
      video.src = url;
      if (startTime > 0) {
         video.currentTime = startTime;
      }
      setupUI(null);
      
      const loader = document.getElementById("loading-overlay");
      
      const p = video.play();
      if (p && typeof p.catch === 'function') {
        p.catch(e => {
         if (e.name !== "AbortError") console.error("Auto-play failed:", e);
         if (log) {
             log.style.display = 'block';
             log.innerHTML += `<div>AUTOPLAY ERROR: ${e.message}</div>`;
         }
         if (loader) {
             if (window.finishLoading) window.finishLoading();
             else loader.style.display = "none";
         }

         // Proxy Fallback Logic for Native/Direct Playback Error
         if (!url.includes("/stream-proxy") && url.startsWith("http")) {
              if (log) log.innerHTML += "<div>PLAY CATCH: RETRYING WITH PROXY...</div>";
              const proxyUrl = `/stream-proxy?url=${encodeURIComponent(url)}`;
              setTimeout(() => loadStream(proxyUrl, startTime), 500);
         }
        });
      }
  };

  // Add global error handler for video element to catch native errors before HLS fallback
      video.onerror = function(e) {
          console.error("Video Error:", video.error);
          if (log) log.innerHTML += `<div>VIDEO ERROR: ${video.error ? video.error.message : 'Unknown'}</div>`;

          // GENERIC RETRY LOGIC (Run once)
          // If not HLS (HLS has its own retry), and not a specific known error we handle below
          // We try to reload the source once.
          if (!hasRetried && !hls) {
               const errCode = video.error ? video.error.code : 0;
               // Don't retry immediately on 4 (Source Not Supported) as we want to fall through to HLS check
               // Don't retry on mixed content (handled below)
               const isMixed = window.location.protocol === 'https:' && video.src.startsWith('http:');
               
               if (errCode !== 4 && !isMixed) {
                   console.log("[VideoError] Generic error. Retrying once...");
                   hasRetried = true;
                   if (log) log.innerHTML += "<div>Generic Error -> Retrying Once...</div>";
                   setTimeout(() => {
                       video.load();
                       video.play().catch(() => {});
                   }, 1000);
                   return;
               }
          }

          // PREVENT PREMATURE FAILURE DURING PROXY ROTATION
      // If we are rotating proxies for MP4/Mixed Content, ignore this error (let the rotation logic handle it)
      const isMP4 = streamUrl.includes(".mp4") || streamUrl.includes(".mkv") || streamUrl.includes(".avi");
      const isMixedContent = window.location.protocol === 'https:' && streamUrl.startsWith('http:');
      
      if (isMixedContent && isMP4 && currentProxyIndex < PROXY_LIST.length - 1) {
           console.warn(`[VideoError] Ignoring error during proxy rotation (Attempt ${currentProxyIndex + 1}/${PROXY_LIST.length})`);
           return;
      }
      
      const currentSrc = video.src;
      
      // MIXED CONTENT CHECK (HTTPS page, HTTP stream)
      if (window.location.protocol === 'https:' && currentSrc.startsWith('http:')) {
           const msg = "Erro: Navegador bloqueou conteúdo misto (HTTPS carregando HTTP). Use a versão local ou streams HTTPS.";
           console.error(msg);
           if (log) log.innerHTML += `<div style="color:red; font-weight:bold">${msg}</div>`;
           // Show user friendly error
           const loader = document.getElementById("loading-overlay");
           if (loader) {
               loader.innerHTML = `<div style="color:white; text-align:center; padding:20px; font-family:sans-serif">
                   <h3 style="color:#e50914">Erro de Reprodução (GitHub/HTTPS)</h3>
                   <p>O navegador bloqueou este canal porque ele usa <b>HTTP</b> (inseguro) em um site <b>HTTPS</b>.</p>
                   <p>Isso é uma restrição de segurança do navegador, não um erro do app.</p>
                   <p style="margin-top:10px; color:#aaa">Solução: Use a versão instalada no PC (Local) ou canais HTTPS.</p>
               </div>`;
               // Ensure it's visible
               loader.style.display = "flex";
           }
           return;
      }
      
      // Use outer isStaticHost from attachSource scope

      // If native playback failed and we haven't tried proxy yet, TRY PROXY FIRST
      if (!isStaticHost && currentSrc.startsWith("http") && !currentSrc.includes("/stream-proxy") && !hls) {
          console.warn("Native playback failed. Retrying with proxy...");
          if (log) log.innerHTML += "<div>Native Fail -> Retrying with Proxy...</div>";
          const proxyUrl = `/stream-proxy?url=${encodeURIComponent(currentSrc)}`;
          loadStream(proxyUrl, startTime);
          return;
      } else if (isStaticHost && !hls) {
          if (log) log.innerHTML += "<div>Static Host: Cannot use local proxy. Trying HLS fallback directly...</div>";
      }

      // If already proxied (or proxy failed), then try HLS fallback
      // Only if we haven't already tried HLS
      if (!hls) {
           // If it's an MP4/MKV file (not HLS), HLS.js won't help.
           const isLikelyHls = currentSrc.includes(".m3u8") || currentSrc.includes(".ts") || qs("type") === "live";
           
           // If it's definitely not HLS (e.g. MP4), do NOT try HLS fallback.
           if (!isLikelyHls) {
               console.warn("Native playback failed and source is not HLS. Skipping HLS fallback.");
               // Show "Open External" directly
               const errMsgEl = document.getElementById("errorMsg");
               const errOverlay = document.getElementById("errorOverlay");
               if (errOverlay && errMsgEl) {
                    errOverlay.style.display = "flex";
                    errMsgEl.innerHTML = "Falha na reprodução do arquivo de vídeo.<br>Este navegador não suporta reproduzir este formato via Proxy.<br>Tente abrir externamente:";
                    
                    const btnId = "direct-play-btn-final";
                    let btn = document.getElementById(btnId);
                    if (!btn) {
                         btn = document.createElement("a");
                         btn.id = btnId;
                         btn.target = "_blank";
                         btn.style.cssText = "display: block; width: fit-content; margin: 15px auto; padding: 10px 20px; background: #e50914; color: white; text-decoration: none; border-radius: 4px; font-weight: bold; cursor: pointer;";
                         btn.innerText = "▶ Abrir Vídeo em Nova Aba";
                         errMsgEl.parentNode.appendChild(btn);
                    }
                    // Extract original URL if proxied
                    let original = currentSrc;
                    if (currentSrc.includes("url=")) {
                        try {
                            const p = new URLSearchParams(currentSrc.split('?')[1]);
                            original = decodeURIComponent(p.get('url'));
                        } catch(e){}
                    }
                    btn.href = original;
               }
               
               // Also hide loader
               const loader = document.getElementById("loading-overlay");
               if (loader) loader.style.display = "none";
               return;
           }

           console.warn("Native playback failed. Trying HLS fallback...");
           initHlsFallback();
      }
  };

  const setupUI = (hlsInstance) => {
      console.log("[SetupUI] Initializing UI controls...");
      if (!ui || !ui.btnSettings) {
          console.error("[SetupUI] UI elements missing");
          return;
      }
      const { btnSettings, audioSelect, subtitleSelect } = ui;

      const updateTracks = () => {
          console.log("[SetupUI] Updating tracks...");
          // Audio Selector
          audioSelect.innerHTML = "";
          
          // 1. Source Switching (Dub vs Sub)
          let hasOptions = false;

          // Helper to match URLs even if one is proxied
          const matchUrl = (current, target) => {
              if (!current || !target) return false;
              if (current === target) return true;
              if (current.includes("/stream-proxy")) {
                  try {
                      const params = new URLSearchParams(current.split('?')[1]);
                      const decoded = decodeURIComponent(params.get('url') || '');
                      return decoded === target;
                  } catch (e) { return false; }
              }
              return false;
          };

          if (streamUrlSub) {
              console.log("[SetupUI] Dual audio sources detected (Dub/Sub)");
              const optDub = document.createElement("option");
              optDub.value = "source_dub";
              optDub.text = "Áudio 1";
              optDub.selected = matchUrl(currentPlayingUrl, streamUrl);
              audioSelect.appendChild(optDub);

              const optSub = document.createElement("option");
              optSub.value = "source_sub";
              optSub.text = "Áudio 2 (Legendado)";
              optSub.selected = matchUrl(currentPlayingUrl, streamUrlSub);
              audioSelect.appendChild(optSub);
              
              hasOptions = true;
          }

          // 2. HLS Internal Audio Tracks
          if (hlsInstance && hlsInstance.audioTracks.length > 0) {
              // Separator if we already have source options
              if (hasOptions) {
                 const sep = document.createElement("option");
                 sep.text = "──────────";
                 sep.disabled = true;
                 audioSelect.appendChild(sep);
              }

              hlsInstance.audioTracks.forEach((track, index) => {
                  const opt = document.createElement("option");
                  opt.value = index;
                  opt.text = track.name || `Faixa ${index + 1} (${track.lang || 'unk'})`;
                  // Only select if it matches the current HLS track
                  opt.selected = index === hlsInstance.audioTrack;
                  audioSelect.appendChild(opt);
              });
              hasOptions = true;
          }

          // 3. Native Audio Tracks (Safari / Native Player)
          if (!hlsInstance && video.audioTracks && video.audioTracks.length > 0) {
              if (hasOptions) {
                 const sep = document.createElement("option");
                 sep.text = "──────────";
                 sep.disabled = true;
                 audioSelect.appendChild(sep);
              }

              for (let i = 0; i < video.audioTracks.length; i++) {
                  const track = video.audioTracks[i];
                  const opt = document.createElement("option");
                  opt.value = `native_${i}`;
                  opt.text = track.label || track.language || `Faixa ${i + 1}`;
                  opt.selected = track.enabled;
                  audioSelect.appendChild(opt);
              }
              hasOptions = true;
          }

          // 4. Default Option (Only if no other options exist)
          if (!hasOptions) {
              const optDefault = document.createElement("option");
              optDefault.value = "source_dub";
              if (isLegendado) {
                  optDefault.text = "Áudio 1 (Legendado)";
              } else {
                  optDefault.text = "Áudio 1";
              }
              optDefault.selected = true;
              audioSelect.appendChild(optDefault);
          }

          // Always enable, even if just "Default"
          audioSelect.disabled = false;


          // Audio Change Handler
          audioSelect.onchange = async (e) => {
              if (saveProgress) {
                  try {
                      // Prevent saving if just switched
                      await saveProgress(true); 
                  } catch (e) {
                      console.warn("Save progress failed during switch", e);
                  }
              }

              const val = e.target.value;
              if (val === "source_dub") {
                  if (!matchUrl(currentPlayingUrl, streamUrl)) {
                      const currentTime = video.currentTime;
                      console.log("[AudioSwitch] Switching to Dub. Time:", currentTime);
                      
                      // Set flag to prevent applyResume from overriding seek
                      window.isSwitchingSource = true;
                      
                      loadStream(streamUrl, currentTime);
                      
                      // Reset flag after a safe delay or rely on loadStream events
                      setTimeout(() => { window.isSwitchingSource = false; }, 2000);
                  }
              } else if (val === "source_sub") {
                  if (!matchUrl(currentPlayingUrl, streamUrlSub)) {
                      const currentTime = video.currentTime;
                      console.log("[AudioSwitch] Switching to Sub. Time:", currentTime);
                      
                      // Set flag to prevent applyResume from overriding seek
                      window.isSwitchingSource = true;
                      
                      loadStream(streamUrlSub, currentTime);
                      
                      // Reset flag after a safe delay
                      setTimeout(() => { window.isSwitchingSource = false; }, 2000);
                  }
              } else if (hlsInstance) {
                  hlsInstance.audioTrack = parseInt(val);
              } else if (String(val).startsWith("native_")) {
                  const index = parseInt(val.split("_")[1]);
                  if (video.audioTracks) {
                      for (let i = 0; i < video.audioTracks.length; i++) {
                          video.audioTracks[i].enabled = (i === index);
                      }
                  }
              }
          };

          // Subtitles (HLS Only for now)
          subtitleSelect.innerHTML = "";
          
          // Option 1: Sem Legenda
          const offOpt = document.createElement("option");
          offOpt.value = -1;
          offOpt.text = "Sem Legenda";
          offOpt.selected = hlsInstance ? hlsInstance.subtitleTrack === -1 : true;
          subtitleSelect.appendChild(offOpt);

          if (hlsInstance && hlsInstance.subtitleTracks.length > 0) {
              hlsInstance.subtitleTracks.forEach((track, index) => {
                  const opt = document.createElement("option");
                  opt.value = index;
                  opt.text = track.name || `Legenda ${index + 1} (${track.lang || 'unk'})`;
                  opt.selected = index === hlsInstance.subtitleTrack;
                  subtitleSelect.appendChild(opt);
              });
          }

          subtitleSelect.disabled = false;
          subtitleSelect.onchange = (e) => {
              const val = e.target.value;
              if (hlsInstance) hlsInstance.subtitleTrack = parseInt(val);
          };

          // Show Settings Button
          // Always show if we have any audio options or subtitles
          const hasAudio = audioSelect.options.length > 0;
          const hasSubs = subtitleSelect.options.length > 0; // "Sem Legenda" is always added if hlsInstance exists or manually? 
          // subtitleSelect logic adds "Sem Legenda" (value -1) at line 1060. So it always has at least 1 option if that code ran.

          if (hasAudio || hasSubs) {
              btnSettings.style.display = "flex";
              console.log(`[SetupUI] Settings button visible. Audio: ${audioSelect.options.length}, Subs: ${subtitleSelect.options.length}`);
          } else {
              btnSettings.style.display = "flex"; // Fallback to visible
              console.warn("[SetupUI] No tracks found, but forcing settings button visible.");
          }
      };

      if (hlsInstance) {
          hlsInstance.on(window.Hls.Events.MANIFEST_PARSED, updateTracks);
          hlsInstance.on(window.Hls.Events.AUDIO_TRACKS_UPDATED, updateTracks);
          hlsInstance.on(window.Hls.Events.SUBTITLE_TRACKS_UPDATED, updateTracks);
      } else {
          // Native Events
          if (video.audioTracks) {
              video.audioTracks.onaddtrack = updateTracks;
              video.audioTracks.onremovetrack = updateTracks;
          }
          updateTracks();
      }
  };

  // Initial Load
  if (log) log.innerHTML += `<div>Loading Stream: ${streamUrl}</div>`;
  loadStream(streamUrl, startTime);
}

function setupSeriesUI(detail, video) {
    console.log("[SeriesUI] Setup triggered...", { hasEpisodes: !!detail.episodes, count: detail.episodes?.length });
    
    if (detail.episodes && detail.episodes.length > 0) {
        const btnEpList = document.getElementById("btnEpList");
        const btnNextEp = document.getElementById("btnNextEp");
        const epListModal = document.getElementById("epListModal");
        const closeEpListModal = document.getElementById("closeEpListModal");
        const epListContent = document.getElementById("epListContent");
        
        const nextEpOverlay = document.getElementById("nextEpOverlay");
        const btnPlayNextNow = document.getElementById("btnPlayNextNow");
        const btnCancelNext = document.getElementById("btnCancelNext");
        const nextEpProgress = document.getElementById("nextEpProgress");
        const nextEpTitleEl = document.getElementById("nextEpTitle");

        const hasNext = detail.currentEpIndex < detail.episodes.length - 1;
        const nextEp = hasNext ? detail.episodes[detail.currentEpIndex + 1] : null;
        
        console.log("[SeriesUI] HasNext:", hasNext, "NextEp:", nextEp);

        // Episodes List
        if (btnEpList && epListModal) {
            btnEpList.style.display = "flex"; // Force show
            
            btnEpList.addEventListener("click", () => {
                epListModal.style.display = "flex";
                if (!video.paused) video.pause();
            });
            
            if (closeEpListModal) {
                closeEpListModal.addEventListener("click", () => {
                    epListModal.style.display = "none";
                    if (video.paused) video.play().catch(() => {});
                });
            }

            // Render List
            epListContent.innerHTML = detail.episodes.map((e, idx) => {
                const isCurrent = idx === detail.currentEpIndex;
                const params = new URLSearchParams({
                    type: 'episode',
                    id: e.id,
                    seriesId: detail.seriesId,
                    title: e.title || "Episódio",
                    poster: detail.posterUrl || "",
                    stream: e.stream_url || "",
                    streamSub: e.stream_url_sub || "",
                    category: detail.category || "",
                    season: e.season_number || "",
                    episode: e.episode_number || ""
                });
                return `
                    <div class="ep-item ${isCurrent ? 'active' : ''}" 
                         onclick="window.location.assign('./player.html?${params.toString()}')"
                         style="padding: 10px; margin-bottom: 5px; background: ${isCurrent ? 'rgba(229, 9, 20, 0.2)' : 'rgba(255,255,255,0.05)'}; border-radius: 4px; cursor: pointer; display: flex; align-items: center; gap: 10px; border: ${isCurrent ? '1px solid #e50914' : '1px solid transparent'};">
                        <div style="width: 30px; color: #aaa; font-size: 14px;">${e.episode_number}</div>
                        <div style="flex: 1;">
                            <div style="color: white; font-weight: 500;">${e.title}</div>
                            <div style="color: #777; font-size: 12px;">${Math.floor(e.duration_minutes || 0)} min</div>
                        </div>
                        ${isCurrent ? '<div style="color: #e50914; font-size: 12px; font-weight: bold;">TOCANDO</div>' : ''}
                    </div>
                `;
            }).join('');
        } else {
            console.warn("[SeriesUI] Missing btnEpList or epListModal elements");
        }

        // Next Episode Button
        if (btnNextEp && hasNext && nextEp) {
            btnNextEp.style.display = "flex";
            
            btnNextEp.addEventListener("click", () => {
                 const params = new URLSearchParams({
                    type: 'episode',
                    id: nextEp.id,
                    seriesId: detail.seriesId,
                    title: nextEp.title || "Episódio",
                    poster: detail.posterUrl || "",
                    stream: nextEp.stream_url || "",
                    streamSub: nextEp.stream_url_sub || "",
                    category: detail.category || "",
                    season: nextEp.season_number || "",
                    episode: nextEp.episode_number || ""
                 });
                 console.log("[SeriesUI] Manually going to next episode:", nextEp.id);
                 window.location.assign(`./player.html?${params.toString()}`);
            });
        }

        // Auto-Play Next Logic
        if (hasNext && nextEpOverlay && nextEp) {
            let autoPlayTimer = null;
            
            const startNextCountdown = () => {
                console.log("[SeriesUI] Starting next episode countdown...");
                nextEpOverlay.style.display = "block";
                nextEpTitleEl.textContent = `S${nextEp.season_number}:E${nextEp.episode_number} - ${nextEp.title}`;
                
                // Reset progress
                nextEpProgress.style.transition = "none";
                nextEpProgress.style.width = "0%";
                
                // Force reflow
                void nextEpProgress.offsetWidth;
                
                // Start animation
                nextEpProgress.style.transition = "width 5s linear";
                nextEpProgress.style.width = "100%";
                
                autoPlayTimer = setTimeout(() => {
                    console.log("[SeriesUI] Auto-switching to next episode:", nextEp.id);
                    if (nextEp.id && detail.seriesId) {
                       const params = new URLSearchParams({
                           type: 'episode',
                           id: nextEp.id,
                           seriesId: detail.seriesId,
                           title: nextEp.title || "Episódio",
                           poster: detail.posterUrl || "",
                           stream: nextEp.stream_url || "",
                           streamSub: nextEp.stream_url_sub || "",
                           category: detail.category || "",
                           season: nextEp.season_number || "",
                           episode: nextEp.episode_number || ""
                       });
                       window.location.assign(`./player.html?${params.toString()}`);
                    } else {
                       console.error("[SeriesUI] Missing next episode ID or Series ID!", nextEp);
                       nextEpOverlay.style.display = "none";
                    }
                }, 5000);
            };
            
            const cancelNext = () => {
                if (autoPlayTimer) clearTimeout(autoPlayTimer);
                nextEpOverlay.style.display = "none";
            };

            btnPlayNextNow.addEventListener("click", () => {
                 if (autoPlayTimer) clearTimeout(autoPlayTimer);
                 console.log("[SeriesUI] User clicked Play Now for next episode");
                 if (nextEp.id && detail.seriesId) {
                     const params = new URLSearchParams({
                         type: 'episode',
                         id: nextEp.id,
                         seriesId: detail.seriesId,
                         title: nextEp.title || "Episódio",
                         poster: detail.posterUrl || "",
                         stream: nextEp.stream_url || "",
                         streamSub: nextEp.stream_url_sub || "",
                         category: detail.category || "",
                         season: nextEp.season_number || "",
                         episode: nextEp.episode_number || ""
                     });
                     window.location.assign(`./player.html?${params.toString()}`);
                 } else {
                     console.error("[SeriesUI] Missing next episode ID or Series ID!", nextEp);
                 }
            });

            btnCancelNext.addEventListener("click", cancelNext);
            
            video.addEventListener("ended", startNextCountdown);
        }
    }
}
