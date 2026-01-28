import { api } from "./api.js";
import { getDeviceMode } from "./input.js";

let playerKeyHandlerRegistered = false;
let resetControlsTimer = () => {}; // Global scope for shared access
let hideControlsNow = () => {}; // Global scope for immediate hiding

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

  // --- iOS iPhone Native Player Enforcer ---
  // Force native fullscreen on iPhone for better experience, 
  // but ensure controls come back when exiting to allow audio switching.
  const isIPhone = /iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;
  if (isIPhone) {
      console.log("[iOS] iPhone detected - Forcing Native Player");
      video.removeAttribute('playsinline');
      video.removeAttribute('webkit-playsinline');
      
      // Ensure controls come back when exiting native fullscreen
      video.addEventListener('webkitendfullscreen', () => {
          console.log("[iOS] Exited native fullscreen - Showing controls");
          if (typeof resetControlsTimer === 'function') {
              // Force show controls
              resetControlsTimer();
          }
      });
      
      video.addEventListener('pause', () => {
          if (typeof resetControlsTimer === 'function') {
             resetControlsTimer();
          }
      });
  }
  // -----------------------------------------

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
          if (video.paused) video.play();
      });
  } else {
      console.warn("[UI] Settings button or modal MISSING", { btnSettings, trackModal, closeTrackModal });
  }

  if (back) {
    back.addEventListener("click", () => {
      if (type === "live") window.location.href = "/live-tv";
      else if (type === "movie") window.location.href = "/movies";
      else window.location.href = "/series";
    });
  }

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
      console.log("[SeriesUI] Checking episodes logic...", { hasEpisodes: !!detail.episodes, count: detail.episodes?.length });
      
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
              console.log("[SeriesUI] btnEpList displayed");
              
              btnEpList.addEventListener("click", () => {
                  epListModal.style.display = "flex";
                  if (!video.paused) video.pause();
              });
              
              if (closeEpListModal) {
                  closeEpListModal.addEventListener("click", () => {
                      epListModal.style.display = "none";
                      if (video.paused) video.play();
                  });
              }

              // Render List
              epListContent.innerHTML = detail.episodes.map((e, idx) => {
                  const isCurrent = idx === detail.currentEpIndex;
                  return `
                      <div class="ep-item ${isCurrent ? 'active' : ''}" 
                           onclick="window.location.assign('/play?type=episode&id=${e.id}&seriesId=${detail.seriesId}')"
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
              console.log("[SeriesUI] btnNextEp displayed");
              
              btnNextEp.addEventListener("click", () => {
                   console.log("[SeriesUI] Manually going to next episode:", nextEp.id);
                   window.location.assign(`/play?type=episode&id=${nextEp.id}&seriesId=${detail.seriesId}`);
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
                         window.location.assign(`/play?type=episode&id=${nextEp.id}&seriesId=${detail.seriesId}`);
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
                       window.location.assign(`/play?type=episode&id=${nextEp.id}&seriesId=${detail.seriesId}`);
                   } else {
                       console.error("[SeriesUI] Missing next episode ID or Series ID!", nextEp);
                   }
              });

              btnCancelNext.addEventListener("click", cancelNext);
              
              video.addEventListener("ended", startNextCountdown);
          }
      }
  }

  const progressRes = await api.playback.getProgress({ contentType: type, contentId: id });
  const progress = progressRes.ok ? progressRes.data.progress : null;

  if (progress) {
    console.log(`[Resume] Fetched progress:`, progress);
  } else {
    console.log(`[Resume] No progress found for ${type} ${id}`);
  }

  // --- Resume Logic ---
  // MOVED BEFORE ATTACH SOURCE TO CATCH EVENTS EARLY
  let resumeApplied = false;
  const applyResume = () => {
      if (resumeApplied) return;
      
      // If we have progress, try to resume
      if (progress && progress.position_seconds > 10 && type !== "live") {
          const target = progress.position_seconds;
          const duration = video.duration || progress.duration_seconds || 0;
          
          console.log(`[Resume] Target: ${target}s, Duration Est: ${duration}s`);

          // If duration is known and valid, clamp. If not, we trust the target.
          // Note: HTML5 video clamps currentTime automatically if it exceeds duration.
          
          resumeApplied = true; // Mark as applied immediately to prevent loops

          const performSeek = () => {
             try {
                 video.currentTime = target;
                 console.log("[Resume] Seek command sent.");
             } catch (e) {
                 console.warn("[Resume] Seek failed", e);
             }
          };

          // If readyState is 0 (HAVE_NOTHING), we can't seek yet usually.
          if (video.readyState === 0) {
              // Wait for metadata
              video.addEventListener('loadedmetadata', performSeek, { once: true });
          } else {
              performSeek();
          }

          // Ensure play happens after seek
          const onSeeked = () => {
              console.log("[Resume] Seek completed. Playing...");
              const p = video.play();
              if (p && p.catch) p.catch(e => console.warn("[Resume] Play deferred", e));
              
              // Force hide spinner if it's still there
              if (window.finishLoading) window.finishLoading();
          };
          
          video.addEventListener('seeked', onSeeked, { once: true });
          
          // Fallback: If seeked doesn't fire (e.g. already at target or seek failed), ensure we play
          setTimeout(() => {
              if (video.paused) {
                  console.log("[Resume] Fallback play trigger");
                  video.play().catch(() => {});
              }
          }, 1000);

      } else {
          resumeApplied = true;
          // No resume needed, just ensure it plays
          if (video.paused && video.readyState > 2) {
              video.play().catch(() => {});
          }
      }
  };

  // Try immediately if ready (unlikely before attachSource, but safe)
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

  await attachSource({ 
      video, 
      streamUrl, 
      streamUrlSub,
      streamType,
      ui: { btnSettings, audioSelect, subtitleSelect },
      isLegendado 
  });

  registerPlayerKeys({ video, type });

  // Setup Auto-Hide Controls
  setupAutoHide(video);
  
  // --- REAL-TIME SUBSCRIPTION CHECK ---
  // Check status every 10 seconds. If expired, block playback.
  let subCheckInterval = setInterval(async () => {
       try {
           const me = await api.auth.me();
           if (me.ok && me.data?.user) {
               const u = me.data.user;
               const expires = u.subscription_expires_at ? new Date(u.subscription_expires_at) : null;
               const now = new Date();
               const isActive = u.subscription_status === 'active' && (expires && expires > now);
               
               if (!isActive) {
                   clearInterval(subCheckInterval);
                   video.pause();
                   // Show blocking modal
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
                       <h2 style="color: #e50914; margin-bottom: 20px;">Assinatura Expirada</h2>
                       <p style="color: white; margin-bottom: 30px; text-align: center;">Seu plano encerrou agora. Por favor, renove para continuar assistindo.</p>
                       <button onclick="window.location.href='/settings'" style="padding: 12px 24px; background: #e50914; color: white; border: none; border-radius: 4px; cursor: pointer; font-weight: bold;">Renovar Agora</button>
                   `;
                   document.body.appendChild(modal);
               }
           }
       } catch (e) {
           console.error("Sub check failed", e);
       }
  }, 1000);
  
  // Clear interval on unload
  window.addEventListener('beforeunload', () => clearInterval(subCheckInterval));
  // ------------------------------------

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

    const payload = {
      contentType: type,
      contentId: id,
      positionSeconds: pos,
      durationSeconds: dur,
    };
    
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

  // Remove explicit hide here, rely on events and timeout
  // const loader = document.getElementById("loading-overlay");
  // if (loader) loader.style.display = "none";
}

function registerPlayerKeys({ video, type }) {
  if (!video) return;
  if (playerKeyHandlerRegistered) return;
  
  // Use generic input mode check
  const mode = typeof getDeviceMode === "function" ? getDeviceMode() : "desktop";
  if (mode === "mobile") return;
  
  playerKeyHandlerRegistered = true;
  console.log("Registering Player Keys (TV/Desktop Mode)");

  // Make video focusable to act as the "default" state
  video.tabIndex = 0;
  video.classList.add('focusable');
  video.focus();

  // Use capture=true to intercept keys before input.js
  document.addEventListener("keydown", (e) => {
    const code = e.keyCode || e.which;
    const active = document.activeElement;
    
    // If we are focused on a control (Button/Input), let input.js handle navigation
    // UNLESS it's a specific shortcut we want to override?
    const isControl = active && (
        active.tagName === 'BUTTON' || 
        active.tagName === 'INPUT' || 
        active.tagName === 'SELECT' || 
        active.tagName === 'TEXTAREA' ||
        active.classList.contains('ep-item')
    );

    // We handle it if we are NOT on a control (i.e. watching video)
    if (isControl && code !== 27) { // Allow Escape to always work
        return; 
    }

    const btnSettings = document.getElementById("btnSettings");
    const trackModal = document.getElementById("trackModal");
    const btnEpList = document.getElementById("btnEpList");
    const epListModal = document.getElementById("epListModal");

    if (code === 37) { // Left
      resetControlsTimer();
      if (type !== "live" && !Number.isNaN(video.currentTime)) {
        video.currentTime = Math.max(0, video.currentTime - 10);
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (code === 39) { // Right
      resetControlsTimer();
      if (type !== "live" && !Number.isNaN(video.currentTime)) {
        video.currentTime = Math.min(
          Number.isFinite(video.duration) ? video.duration : video.currentTime + 10,
          video.currentTime + 10
        );
        e.preventDefault();
        e.stopPropagation();
      }
    } else if (code === 13 || code === 32) { // Enter / Space
      resetControlsTimer();
      if (video.paused) {
        const p = video.play();
        if (p && p.catch) p.catch(() => {});
      } else {
        video.pause();
      }
      e.preventDefault();
      e.stopPropagation();
    } else if (code === 38) { // Up
      resetControlsTimer();
      let handled = false;
      
      // Try episode list toggle first
      if (type === "episode" && btnEpList && epListModal) {
        const visible = epListModal.style.display === "flex";
        epListModal.style.display = visible ? "none" : "flex";
        
        if (!visible) {
             if(!video.paused) video.pause();
             setTimeout(() => {
                 const first = epListModal.querySelector('.ep-item');
                 if(first) first.focus();
             }, 100);
        } else {
             if(video.paused) video.play().catch(()=>{});
             video.focus();
        }
        handled = true;
      }
      
      // If not handled, Volume Up
      if (!handled) {
          if (video.volume <= 0.9) video.volume += 0.1;
          else video.volume = 1;
          console.log("Volume:", Math.round(video.volume * 100) + "%");
      }
      
      e.preventDefault();
      e.stopPropagation();
    } else if (code === 40) { // Down - Volume Down
      // Show UI
      resetControlsTimer();
      
      // Volume Control
      if (video.volume >= 0.1) video.volume -= 0.1;
      else video.volume = 0;
      
      // Visual Feedback for Volume could be added here
      console.log("Volume:", Math.round(video.volume * 100) + "%");

      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

// Auto-Hide Controls Logic
function setupAutoHide(video) {
    const elements = [
        document.getElementById("backBtn"),
        document.getElementById("btnSettings"),
        document.getElementById("playerTitle"),
        document.querySelector(".controls-left"), // For live badge if any
        document.getElementById("btnEpList"),
        document.getElementById("btnNextEp")
    ].filter(el => el); // Filter nulls

    if (elements.length === 0) return;

    // Add transition styles
    elements.forEach(el => {
        el.style.transition = "opacity 0.5s ease, transform 0.5s ease";
        el.style.opacity = "1";
    });

    let hideTimer = null;
    let isHidden = false;

    // Global function to hide immediately
    hideControlsNow = () => {
        if (hideTimer) clearTimeout(hideTimer);
        elements.forEach(el => {
            el.style.opacity = "0";
            el.style.pointerEvents = "none";
        });
        document.body.style.cursor = "none";
        isHidden = true;
    };

    resetControlsTimer = () => {
        if (isHidden) {
            elements.forEach(el => {
                el.style.opacity = "1";
                el.style.pointerEvents = "auto";
                el.style.transform = "translateY(0)";
            });
            document.body.style.cursor = "default";
            isHidden = false;
        }

        if (hideTimer) clearTimeout(hideTimer);
        
        hideTimer = setTimeout(() => {
            if (document.activeElement && (document.activeElement.tagName === 'SELECT' || document.activeElement.closest('.track-modal'))) {
                // Don't hide if interacting with settings
                resetControlsTimer(); 
                return;
            }
            hideControlsNow();
        }, 3000); // Hide after 3 seconds
    };

    // Attach listeners
    const events = ["mousemove", "click", "touchstart", "keydown"];
    events.forEach(evt => {
        document.addEventListener(evt, resetControlsTimer, { passive: true });
    });
    
    // If video provided, hide on play and try fullscreen
    if (video) {
        video.addEventListener('playing', () => {
            console.log("[UI] Video playing - Hiding controls & requesting fullscreen");
            hideControlsNow();
            
            // Auto Fullscreen Attempt
            try {
                if (!document.fullscreenElement) {
                     document.documentElement.requestFullscreen().catch(e => {
                         // Silent fail (expected if no user gesture)
                         console.log("Auto-Fullscreen prevented:", e);
                     });
                }
            } catch (e) {}
        });
    }
    
    // Initial call
    resetControlsTimer();
}

async function loadDetail(type, id) {
  if (type === "movie") {
    const res = await api.movies.get(id);
    if (!res.ok) return { ok: false, error: res.data?.error || "Movie not found" };
    const m = res.data.item;
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
    const eps = await api.series.episodes(id);
    const first = eps.ok ? eps.data.episodes?.[0] : null;
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
        if (sRes.ok) {
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
    if (c.blocked) return { ok: false, error: c.message || "Assinatura necessária para assistir." };
    return { ok: true, title: c.title, category: c.category, meta: `${c.category} • LIVE`, streamUrl: c.stream_url, posterUrl: c.thumbnail_url };
  }

  return { ok: false, error: "Unsupported type" };
}

async function attachSource({ video, streamUrl, streamUrlSub, streamType, ui, isLegendado }) {
  const log = null;
  let hls = null;
  // Track the current playing URL to determine selection state
  let currentPlayingUrl = streamUrl;

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

  const loadStream = (url) => {
      const log = null;
      if (log) log.innerHTML += `<div>Attempting load: ${url}</div>`;

      // FORCE PROXY for all external HTTP URLs to avoid CORS/Mixed Content/Blocked issues
      if (url.startsWith("http") && !url.includes("/stream-proxy") && !url.includes("localhost") && !url.includes("127.0.0.1")) {
          console.warn("Forcing proxy for external URL...");
          if (log) log.innerHTML += "<div>Forcing Proxy...</div>";
          
          let proxyUrl = `/stream-proxy?url=${encodeURIComponent(url)}`;
          
          // Recursively call with proxy url
          loadStream(proxyUrl);
          return;
      }

      // Define initHlsFallback outside so we can call it immediately if needed
      const initHlsFallback = () => {
          if (window.Hls && window.Hls.isSupported()) {
               if (hls) hls.destroy();
               
               // OPTIMIZED HLS CONFIG FOR INSTANT PLAYBACK & HUGE TS FILES
               const hlsConfig = {
                   enableWorker: true,
                   lowLatencyMode: true,
                   backBufferLength: 30,
                   // Aggressively start playback
                   startLevel: -1, 
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
               hls.loadSource(url); 
               hls.attachMedia(video);
               
               hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
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
                               console.warn("HLS Fatal Error. Falling back to native playback...");
                               video.src = url;
                               video.load();
                               const p = video.play();
                               if (p) p.catch(e => console.error("Native fallback play error:", e));

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
              
              // Force hide spinner on playback start or canplay
              if (evt === "playing" || evt === "canplay") {
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
                      console.warn("Media Format Error (4). Assuming IPTV Stream. Trying HLS.js...");
                      if (log) log.innerHTML += "<div>ERR 4: TRYING HLS.JS...</div>";
                      if (errMsgEl) errMsgEl.textContent = "Formato não suportado nativamente. Tentando modo compatibilidade (HLS)...";
                      
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
                  if (!url.includes("/stream-proxy") && url.startsWith("http")) {
                      console.warn("Video failed, trying proxy...");
                      if (log) log.innerHTML += "<div>RETRYING WITH PROXY...</div>";
                      const proxyUrl = `/stream-proxy?url=${encodeURIComponent(url)}`;
                      
                      if (hls) { hls.destroy(); hls = null; }
                      setTimeout(() => loadStream(proxyUrl), 500);
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
      // If the URL is a TS file and not already proxied, force it through the proxy
      // so the backend can wrap it in a synthetic M3U8 for HLS.js.
      if (url.match(/\.ts($|\?)/i) && !url.includes("/stream-proxy")) {
          console.log("Detecting .ts stream. Routing through proxy for HLS wrapping...");
          // Pass the playback type (live vs movie) to the proxy so it generates the correct playlist
          const playMode = qs("type") || "movie";
          url = `/stream-proxy?url=${encodeURIComponent(url)}&mode=${playMode}`;
      }

      currentPlayingUrl = url;
      if (hls) {
          hls.destroy();
          hls = null;
      }

      const isHls = url.includes(".m3u8") || url.includes("/stream-proxy");
      
      // Native HLS (Safari)
      if (video.canPlayType("application/vnd.apple.mpegurl")) {
          video.src = url;
          setupUI(null); 
          // Removed auto-play attempt here to prevent race conditions
          // User must click play if not handled by browser policy
          const loader = document.getElementById("loading-overlay");
          if (loader) {
              if (window.finishLoading) window.finishLoading();
              else loader.style.display = "none";
          }
          return;
      }

      if (isHls && window.Hls) {
          if (log) log.innerHTML += "<div>Init HLS.js...</div>";
          
          // Use robust config for VOD/Movies too (prevent fragLoadError on large TS files)
          const hlsConfig = {
               enableWorker: true,
               lowLatencyMode: true,
               backBufferLength: 30,
               startLevel: -1, 
               startFragPrefetch: true,
               maxBufferLength: 30,
               maxMaxBufferLength: 60,
               manifestLoadingTimeOut: 20000,
               manifestLoadingMaxRetry: 4,
               levelLoadingTimeOut: 20000,
               levelLoadingMaxRetry: 4,
               fragLoadingTimeOut: 3600000, // 1 hour timeout
                fragLoadingMaxRetry: 10,
                liveSyncDurationCount: 3, 
                liveMaxLatencyDurationCount: 10,
                liveDurationInfinity: true,
           };
          
          hls = new window.Hls(hlsConfig);
          
          hls.on(window.Hls.Events.ERROR, (event, data) => {
            console.error("HLS Error:", data);
            if (log) {
                log.style.display = 'block';
                log.innerHTML += `<div>HLS ERROR: ${data.type} - ${data.details}</div>`;
            }
            if (data.fatal) {
              const loader = document.getElementById("loading-overlay");
              if (loader) {
                  if (window.finishLoading) window.finishLoading();
                  else loader.style.display = "none";
              } // Hide spinner on fatal error

              // Proxy Fallback Logic for HLS
              if (!url.includes("/stream-proxy") && url.startsWith("http")) {
                  if (log) log.innerHTML += "<div>HLS FATAL: RETRYING WITH PROXY...</div>";
                  const proxyUrl = `/stream-proxy?url=${encodeURIComponent(url)}`;
                  hls.destroy();
                  hls = null;
                  setTimeout(() => loadStream(proxyUrl), 500);
                  return;
              }

              switch (data.type) {
                case window.Hls.ErrorTypes.NETWORK_ERROR:
                  if (log) log.innerHTML += "<div>Try Recover Network...</div>";
                  hls.startLoad();
                  break;
                case window.Hls.ErrorTypes.MEDIA_ERROR:
                  if (log) log.innerHTML += "<div>Try Recover Media...</div>";
                  hls.recoverMediaError();
                  break;
                default:
                  if (log) log.innerHTML += "<div>Fatal Error. Destroy.</div>";
                  hls.destroy();
                  break;
              }
            }
          });

          hls.on(window.Hls.Events.MANIFEST_PARSED, () => {
             if (log) log.innerHTML += "<div>Manifest Parsed, Playing...</div>";
             const p = video.play();
             if (p && typeof p.catch === 'function') {
                 p.catch(e => {
                    if (e.name !== "AbortError") console.error("Auto-play failed:", e);
                    if (log) {
                        log.style.display = 'block';
                        log.innerHTML += `<div>AUTOPLAY ERROR: ${e.message}</div>`;
                    }
                    const loader = document.getElementById("loading-overlay");
                    if (loader) {
                        if (window.finishLoading) window.finishLoading();
                        else loader.style.display = "none";
                    }
                 });
             }
          });

          setupUI(hls);
          
          hls.loadSource(url);
          hls.attachMedia(video);
          video.addEventListener("ended", () => hls && hls.destroy(), { once: true });
      } else {
          // Direct file playback
          if (log) log.innerHTML += "<div>Direct File Playback Mode</div>";
          video.src = url;
          setupUI(null);
          
          // Force hide loader immediately for direct file, but also on events
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
             // Note: 'error' event usually handles this, but sometimes catch() is faster
             if (!url.includes("/stream-proxy") && url.startsWith("http")) {
                  if (log) log.innerHTML += "<div>PLAY CATCH: RETRYING WITH PROXY...</div>";
                  const proxyUrl = `/stream-proxy?url=${encodeURIComponent(url)}`;
                  setTimeout(() => loadStream(proxyUrl), 500);
             }
            });
          }
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

          if (streamUrlSub) {
              const optDub = document.createElement("option");
              optDub.value = "source_dub";
              optDub.text = "Áudio 1";
              optDub.selected = (currentPlayingUrl === streamUrl);
              audioSelect.appendChild(optDub);

              const optSub = document.createElement("option");
              optSub.value = "source_sub";
              optSub.text = "Áudio 2 (Legendado)";
              optSub.selected = (currentPlayingUrl === streamUrlSub);
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
          audioSelect.onchange = (e) => {
              const val = e.target.value;
              if (val === "source_dub") {
                  if (currentPlayingUrl !== streamUrl) {
                    const currentTime = video.currentTime;
                    loadStream(streamUrl);
                    setTimeout(() => {
                        video.currentTime = currentTime;
                        const p = video.play();
                        if (p && p.catch) p.catch(e => { if (e.name !== 'AbortError') console.error(e); });
                    }, 100);
                  }
              } else if (val === "source_sub") {
                  if (currentPlayingUrl !== streamUrlSub) {
                    const currentTime = video.currentTime;
                    loadStream(streamUrlSub);
                    setTimeout(() => {
                        video.currentTime = currentTime;
                        const p = video.play();
                        if (p && p.catch) p.catch(e => { if (e.name !== 'AbortError') console.error(e); });
                    }, 100);
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
  loadStream(streamUrl);
}
