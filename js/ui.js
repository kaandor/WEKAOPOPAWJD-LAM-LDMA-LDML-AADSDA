import { api } from "./api.js?v=20260201-logo1";

// --- GLOBAL SYNC INDICATOR & POLLING ---
// Initialize polling if user is logged in
if (api.session.read()?.user) {
    api.cloud.startPolling();
}

// Create Sync Indicator Element
const syncIndicator = document.createElement('div');
syncIndicator.id = 'klyx-sync-indicator';
syncIndicator.innerHTML = `
    <div style="display: flex; align-items: center; gap: 8px; background: rgba(0,0,0,0.8); padding: 8px 12px; border-radius: 20px; border: 1px solid #333;">
        <div class="spinner" style="width: 12px; height: 12px; border: 2px solid #9333ea; border-top-color: transparent; border-radius: 50%; animation: spin 1s linear infinite;"></div>
        <span style="font-size: 12px; color: #ccc;">Sincronizando...</span>
    </div>
    <style>
        @keyframes spin { 100% { transform: rotate(360deg); } }
        #klyx-sync-indicator {
            position: fixed;
            bottom: 20px;
            right: 20px;
            z-index: 9999;
            opacity: 0;
            transition: opacity 0.3s ease;
            pointer-events: none;
        }
        #klyx-sync-indicator.visible {
            opacity: 1;
        }
    </style>
`;
document.body.appendChild(syncIndicator);

// Listen for Sync Events
window.addEventListener('klyx-sync-start', () => {
    syncIndicator.classList.add('visible');
});

window.addEventListener('klyx-sync-end', () => {
    setTimeout(() => {
        syncIndicator.classList.remove('visible');
    }, 1000); // Keep visible for 1s to show activity
});

window.addEventListener('klyx-data-updated', () => {
    // Optional: Show toast "Dados Atualizados"
    console.log("UI: Data Updated from Cloud");
    
    // Re-apply theme in case it changed
    applyGlobalTheme();
    
    // If on profile selection, reload to show new profiles
    if (window.location.pathname.includes("profile-selection.html")) {
        window.location.reload();
    }
});

// --- THEME APPLICATION ---
function applyGlobalTheme() {
    try {
        const prefs = api.settings.get();
        if (prefs.theme === 'light') {
            document.documentElement.setAttribute('data-theme', 'light');
        } else {
            document.documentElement.removeAttribute('data-theme');
        }
    } catch (e) { console.warn("Theme apply error", e); }
}

// Apply on load
applyGlobalTheme();
// -------------------------
// ----------------------------------------

// Helper for Drag-to-Scroll (Mouse)
function setupDragScroll(slider) {
    let isDown = false;
    let startX;
    let scrollLeft;

    slider.addEventListener('mousedown', (e) => {
        isDown = true;
        slider.classList.add('active');
        startX = e.pageX - slider.offsetLeft;
        scrollLeft = slider.scrollLeft;
    });
    slider.addEventListener('mouseleave', () => {
        isDown = false;
        slider.classList.remove('active');
    });
    slider.addEventListener('mouseup', () => {
        isDown = false;
        slider.classList.remove('active');
    });
    slider.addEventListener('mousemove', (e) => {
        if (!isDown) return;
        e.preventDefault();
        const x = e.pageX - slider.offsetLeft;
        const walk = (x - startX) * 2; // scroll-fast
        slider.scrollLeft = scrollLeft - walk;
    });
}

// Helper to proxy images via weserv.nl to fix Mixed Content (HTTP images on HTTPS site)
function getProxiedImage(url) {
    if (!url) return 'https://via.placeholder.com/300x450?text=No+Image';
    // If already proxied, return as is
    if (url.includes('images.weserv.nl')) return url;
    // If local asset, return as is
    if (url.startsWith('./') || url.startsWith('/') || url.startsWith('assets/')) return url;
    
    // Proxy external URLs
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=400&output=webp&q=80`;
}

// Helper for infinite scroll
function setupInfiniteScroll(items, container, createCardFn) {
    const BATCH_SIZE = 200;
    let currentIndex = 0;
    let isLoading = false;

    const loadNextBatch = () => {
        if (currentIndex >= items.length) return;
        
        const batch = items.slice(currentIndex, currentIndex + BATCH_SIZE);
        const fragment = document.createDocumentFragment();
        
        batch.forEach(item => {
            const card = createCardFn(item);
            fragment.appendChild(card);
        });
        
        container.appendChild(fragment);
        currentIndex += BATCH_SIZE;
        isLoading = false;
    };

    // Initial load
    loadNextBatch();

    // Scroll handler
    const onScroll = () => {
        if (isLoading) return;
        // Check if near bottom
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1000) {
            isLoading = true;
            loadNextBatch();
        }
    };

    // Clean up previous listener
    if (window._infiniteScrollHandler) {
        window.removeEventListener('scroll', window._infiniteScrollHandler);
    }
    window._infiniteScrollHandler = onScroll;
    window.addEventListener('scroll', onScroll);
}

// Redirect Live TV requests to Dashboard
if (window.location.pathname.includes("live-tv.html")) {
    window.location.href = "./dashboard.html";
}

export function handleLoginSuccess(user) {
    console.log("Login successful:", user);
    window.location.href = "./profile-selection.html";
}

export async function initDashboard() {
    console.log("Dashboard Initialized");
    const content = document.getElementById("dashboardContent");
    if (!content) return;

    content.innerHTML = '<div class="loading-spinner">Carregando...</div>';

    try {
        const res = await api.content.getHome();
        if (!res.ok) {
            throw new Error(res.data?.error || "Erro ao carregar dados");
        }

        const data = res.data;
        if (!data.rails) {
            content.innerHTML = "<p>Nenhum conteúdo encontrado.</p>";
            return;
        }

        let html = '';
        
        // Helper to render a rail
        const renderRail = (title, items, type = 'movie') => {
            if (!items || items.length === 0) return '';
            const categoryLink = type === 'series' ? './series.html' : './movies.html';
            return `
                <div class="section">
                    <div class="section-head">
                        <h2>${title}</h2>
                        ${type !== 'mixed' ? `<a href="${categoryLink}">Ver mais</a>` : ''}
                    </div>
                    <div class="rail">
                        ${items.map(item => {
                            const itemType = item.type || type; // Use item type if mixed
                            // If mixed and still unknown, default to movie, but try to guess
                            const finalType = (itemType === 'mixed') ? 'movie' : itemType;
                            
                            const isSeries = finalType === 'series';
                            const clickAction = isSeries 
                                ? `window.showSeriesModal('${item.id}')` 
                                : `window.showMovieModal('${item.id}')`;

                            return `
                            <div class="card focusable" data-id="${item.id}" tabindex="0" 
                                 onclick="${clickAction}">
                                <img class="poster" src="${getProxiedImage(item.poster)}" alt="${item.title}" loading="lazy" draggable="false" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450?text=Error';">
                                <div class="card-body">
                                    <h3 class="card-title">${item.title}</h3>
                                    <div class="card-meta">
                                        <span class="badge">${finalType === 'movie' ? 'Filme' : 'Série'} | ${item.genre || 'Geral'}</span>
                                    </div>
                                    ${item.progress ? `<div style="height: 3px; background: #333; margin-top: 5px; border-radius: 2px;"><div style="width: ${item.progress}%; height: 100%; background: #9333ea;"></div></div>` : ''}
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;
        };

        // 1. Fetch Continue Watching
        try {
            const cwRes = await api.playback.getContinueWatching();
            if (cwRes.ok && cwRes.data.length > 0) {
                // Fetch all content to match IDs
                // Optimization: In a real app, we would have an endpoint for this. 
                // Here we load lists from cache.
                const [moviesRes, seriesRes] = await Promise.all([
                    api.movies.list(),
                    api.content.getSeries()
                ]);
                
                const allMovies = moviesRes.ok ? moviesRes.data : [];
                const allSeries = seriesRes.ok ? (seriesRes.data.series || []) : [];
                
                const cwItems = [];
                for (const item of cwRes.data) {
                    let media = null;
                    let mediaType = item.type || 'movie';
                    
                    if (mediaType === 'movie') media = allMovies.find(m => m.id === item.id);
                    else if (mediaType === 'series') media = allSeries.find(s => s.id === item.id);
                    
                    // Fallback for legacy items without type
                    if (!media) {
                        media = allMovies.find(m => m.id === item.id);
                        if (media) mediaType = 'movie';
                        else {
                            media = allSeries.find(s => s.id === item.id);
                            if (media) mediaType = 'series';
                        }
                    }
                    
                    if (media) {
                        // Clone to avoid modifying original cache
                        const entry = { ...media, type: mediaType };
                        if (item.duration > 0) {
                            entry.progress = Math.min(100, Math.max(0, (item.time / item.duration) * 100));
                        }
                        cwItems.push(entry);
                    }
                }
                
                if (cwItems.length > 0) {
                    html += renderRail("Continue Assistindo", cwItems, "mixed");
                }
            }
        } catch (e) {
            console.warn("Failed to load Continue Watching", e);
        }

        html += renderRail("Top Filmes", data.rails.topMovies, "movie");
        html += renderRail("Top Séries", data.rails.topSeries, "series");
        html += renderRail("Adicionados Recentemente", data.rails.recentMovies, "movie");
        html += renderRail("Filmes de Terror", data.rails.horrorMovies, "movie");
        html += renderRail("Comédia", data.rails.comedyMovies, "movie");
        html += renderRail("Ação", data.rails.actionMovies, "movie");

        content.innerHTML = html;

        // Initialize drag-to-scroll on all rails
        const rails = content.querySelectorAll('.rail');
        rails.forEach(rail => setupDragScroll(rail));

    } catch (e) {
        console.error("Dashboard error:", e);
        content.innerHTML = `<p style="color:red">Erro ao carregar dashboard: ${e.message}</p>`;
    }
}

// Helper to setup custom dropdown
function setupCustomDropdown(selectId, options, onSelect) {
    const originalSelect = document.getElementById(selectId);
    if (!originalSelect) return;

    const container = originalSelect.parentElement;
    
    // Create new structure
    const dropdown = document.createElement('div');
    dropdown.className = 'category-dropdown';
    
    const btn = document.createElement('button');
    btn.className = 'category-btn focusable';
    btn.innerHTML = `
        <span class="selected-label">Todas as categorias</span>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    `;
    
    const menu = document.createElement('div');
    menu.className = 'category-menu';
    
    // Add "All" option
    const addOption = (label, value) => {
        const item = document.createElement('div');
        item.className = 'category-item focusable';
        item.textContent = label;
        item.dataset.value = value;
        item.tabIndex = 0;
        
        item.onclick = () => {
            btn.querySelector('.selected-label').textContent = label;
            menu.classList.remove('active');
            onSelect(value);
            
            // Update selected state
            menu.querySelectorAll('.category-item').forEach(i => i.classList.remove('selected'));
            item.classList.add('selected');
        };
        
        // Add Enter key support
        item.onkeydown = (e) => {
            if (e.key === 'Enter') item.click();
        };

        menu.appendChild(item);
    };
    
    addOption("Todas as categorias", "");
    options.forEach(opt => addOption(opt, opt));
    
    dropdown.appendChild(btn);
    dropdown.appendChild(menu);
    
    // Toggle menu
    btn.onclick = (e) => {
        e.stopPropagation();
        const isActive = menu.classList.contains('active');
        // Close all other menus
        document.querySelectorAll('.category-menu.active').forEach(m => m.classList.remove('active'));
        
        if (!isActive) {
            menu.classList.add('active');
        }
    };
    
    // Close on click outside
    document.addEventListener('click', (e) => {
        if (!dropdown.contains(e.target)) {
            menu.classList.remove('active');
        }
    });
    
    // Replace original select
    originalSelect.style.display = 'none';
    // Remove old custom dropdown if exists
    const old = container.querySelector('.category-dropdown');
    if (old) old.remove();
    
    container.insertBefore(dropdown, originalSelect);
}

export async function initMovies() {
    console.log("Movies Initialized");
    const container = document.getElementById("moviesGrid");
    const categorySelectId = "movieCategory";
    const searchInput = document.getElementById("movieSearch");

    if (!container) return;

    container.innerHTML = '<div class="loading-spinner">Carregando filmes...</div>';

    try {
        const [moviesRes, catsRes] = await Promise.all([
            api.content.getMovies(),
            api.movies.categories()
        ]);

        if (!moviesRes.ok) throw new Error(moviesRes.data?.error || "Erro ao carregar filmes");

        const allMovies = moviesRes.data.movies || [];
        
        if (allMovies.length === 0) {
            container.innerHTML = "<p>Nenhum filme encontrado.</p>";
            return;
        }

        // Render Function
        let currentCategory = "";
        let currentSearch = "";

        const render = () => {
            const filtered = allMovies.filter(m => {
                const matchesCat = !currentCategory || (m.category && m.category.includes(currentCategory));
                const matchesSearch = !currentSearch || m.title.toLowerCase().includes(currentSearch);
                return matchesCat && matchesSearch;
            });
            
            container.innerHTML = "";
            if (filtered.length === 0) {
                container.innerHTML = "<p>Nenhum filme encontrado.</p>";
                return;
            }
            
            setupInfiniteScroll(filtered, container, (movie) => {
                return createPosterCard({
                    title: movie.title,
                    posterUrl: movie.poster,
                    metaLeft: "",
                    metaRight: movie.rating ? `★ ${movie.rating}` : "",
                    onClick: () => {
                        window.showMovieModal(movie.id);
                    }
                });
            });
        };

        // Setup Custom Dropdown
        if (catsRes.ok) {
            setupCustomDropdown(categorySelectId, catsRes.data, (val) => {
                currentCategory = val;
                render();
            });
        }

        // Search Listener
        if (searchInput) {
            searchInput.oninput = (e) => {
                currentSearch = e.target.value.toLowerCase();
                render();
            };
        }

        // Initial Render
        render();

    } catch (e) {
        console.error("Movies error:", e);
        container.innerHTML = `<p style="color:red">Erro: ${e.message}</p>`;
    }
}

export async function initSeries() {
    console.log("Series Initialized");
    const container = document.getElementById("seriesGrid");
    const categorySelectId = "seriesCategory";
    const searchInput = document.getElementById("seriesSearch");
    
    if (!container) return;

    // Switch to Grid layout (reset display if it was changed to block)
    container.style.display = "grid"; 
    container.innerHTML = '<div class="loading-spinner">Carregando séries...</div>';

    try {
        const [seriesRes, catsRes] = await Promise.all([
            api.content.getSeries(),
            api.series.categories()
        ]);

        if (!seriesRes.ok) throw new Error(seriesRes.data?.error || "Erro ao carregar séries");

        const allSeries = seriesRes.data.series || [];

        if (allSeries.length === 0) {
            container.innerHTML = "<p>Nenhuma série encontrada.</p>";
            return;
        }

        // Render Function
        let currentCategory = "";
        let currentSearch = "";

        const render = () => {
            const filtered = allSeries.filter(s => {
                const matchesCat = !currentCategory || (s.category && s.category.includes(currentCategory));
                const matchesSearch = !currentSearch || s.title.toLowerCase().includes(currentSearch);
                return matchesCat && matchesSearch;
            });
            
            container.innerHTML = "";
            if (filtered.length === 0) {
                container.innerHTML = "<p>Nenhuma série encontrada.</p>";
                return;
            }
            
            setupInfiniteScroll(filtered, container, (item) => {
                return createPosterCard({
                    title: item.title,
                    posterUrl: item.poster,
                    metaLeft: "Série",
                    metaRight: item.rating ? `★ ${item.rating}` : "",
                    onClick: () => {
                        window.showSeriesModal(item.id);
                    }
                });
            });
        };

        // Setup Custom Dropdown
        if (catsRes.ok) {
            setupCustomDropdown(categorySelectId, catsRes.data, (val) => {
                currentCategory = val;
                render();
            });
        }

        // Search Listener
        if (searchInput) {
            searchInput.oninput = (e) => {
                currentSearch = e.target.value.toLowerCase();
                render();
            };
        }

        // Initial Render
        render();

    } catch (e) {
        console.error("Series error:", e);
        container.innerHTML = `<p style="color:red">Erro: ${e.message}</p>`;
    }
}

export function createPosterCard({ title, posterUrl, metaLeft, metaRight, onClick }) {
    const card = document.createElement("div");
    card.className = "card focusable";
    card.tabIndex = 0;
    
    const img = document.createElement("img");
    img.className = "poster";
    img.src = getProxiedImage(posterUrl);
    img.alt = title;
    img.loading = "lazy";
    img.onerror = () => { img.onerror = null; img.src = 'https://via.placeholder.com/300x450?text=Error'; };
    
    const info = document.createElement("div");
    info.className = "card-body";
    
    const h3 = document.createElement("h3");
    h3.className = "card-title";
    h3.textContent = title;
    
    const meta = document.createElement("div");
    meta.className = "card-meta";
    
    // Badge style to match renderRail
    const badge = document.createElement("span");
    badge.className = "badge";
    // Construct badge text: "Year | Rating" or just "Year"
    const badgeText = [metaLeft, metaRight].filter(Boolean).join(" | ");
    badge.textContent = badgeText || "Geral";
    
    meta.append(badge);
    
    info.append(h3, meta);
    card.append(img, info);
    
    if (onClick) {
        card.addEventListener("click", (e) => {
            console.log("Card clicked:", title);
            onClick(e);
        });
        card.addEventListener("keydown", (e) => {
            if (e.key === "Enter") onClick();
        });
    }
    
    return card;
}

export function createThumbCard({ title, thumbUrl, metaLeft, metaRight, onClick }) {
    // Similar to poster card but maybe different styling class if needed
    // For now reusing similar structure
    return createPosterCard({ title, posterUrl: thumbUrl, metaLeft, metaRight, onClick });
}

export function applyTheme(theme) {
    if (theme === 'light') {
        document.documentElement.setAttribute('data-theme', 'light');
    } else {
        document.documentElement.removeAttribute('data-theme');
    }
}

export async function initSettings() {
    console.log("Settings Initialized");
    
    // Load current values
    const prefs = api.settings.get();
    if (prefs.theme) {
        const themeEl = document.getElementById("theme");
        if (themeEl) themeEl.value = prefs.theme;
        applyTheme(prefs.theme);
    }
    if (prefs.language) {
        const langEl = document.getElementById("language");
        if (langEl) langEl.value = prefs.language;
    }

    // Settings Saving
    const saveBtn = document.getElementById("saveSettings");
    if (saveBtn) {
        saveBtn.onclick = () => {
            try {
                const theme = document.getElementById("theme").value;
                const language = document.getElementById("language").value;
                
                console.log("Saving settings...", { theme, language });

                // Save to Cloud
                api.settings.save({ theme, language });
                
                // Apply immediately
                applyTheme(theme);
                
                const saveStatus = document.getElementById("settingsStatus");
                if (saveStatus) {
                    saveStatus.textContent = "Salvo & Sincronizando...";
                    saveStatus.style.color = "#4ade80";
                    setTimeout(() => saveStatus.textContent = "", 3000);
                }
            } catch (e) {
                console.error("Save Settings Error:", e);
                alert("Erro ao salvar configurações: " + e.message);
            }
        };
    }
    
    // Device Info from LocalStorage
    const macEl = document.getElementById("deviceMac");
    if (macEl) {
        macEl.textContent = localStorage.getItem('klyx_device_mac') || "00:1A:2B:3C:4D:5E";
    }
    const keyEl = document.getElementById("deviceKey");
    if (keyEl) {
        keyEl.textContent = localStorage.getItem('klyx_device_key') || "1234-5678";
    }
    const statusEl = document.getElementById("subscriptionStatus");
    if (statusEl) {
        statusEl.textContent = "Ativo";
        statusEl.style.background = "#4ade80";
        statusEl.style.color = "#000";
    }

    // Reset Data Logic
    const resetBtn = document.getElementById("resetData");
    if (resetBtn) {
        resetBtn.onclick = async () => {
            const confirmReset = confirm("TEM CERTEZA? Isso apagará todos os perfis e histórico deste dispositivo E da nuvem. Use apenas para corrigir problemas ou começar do zero.");
            
            if (confirmReset) {
                resetBtn.textContent = "Apagando...";
                resetBtn.disabled = true;
                
                try {
                    if (api.activity) api.activity.log("DATA_RESET", { confirmed: true });
                    await api.cloud.reset();
                    alert("Dados apagados com sucesso! O aplicativo será reiniciado.");
                    // Force logout/reload
                    api.session.clear();
                    window.location.href = "./index.html";
                } catch (e) {
                    alert("Erro ao apagar dados: " + e.message);
                    resetBtn.textContent = "Tentar Novamente";
                    resetBtn.disabled = false;
                }
            }
        };
    }
}

// Global Series Modal Handler
window.showSeriesModal = async function(seriesId) {
    console.log("showSeriesModal called for ID:", seriesId);
    // 1. Create Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'netflix-modal-backdrop active'; 
    backdrop.style.zIndex = "10001"; // Force high z-index
    
    // 2. Create Modal Structure
    backdrop.innerHTML = `
        <div class="netflix-modal-content">
            <button class="netflix-close-btn">&times;</button>
            <div class="netflix-modal-body loading">
                <div class="loading-spinner"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(backdrop);
    
    const closeBtn = backdrop.querySelector('.netflix-close-btn');
    const close = () => {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.remove(), 300);
    };
    
    closeBtn.onclick = close;
    backdrop.onclick = (e) => {
        if (e.target === backdrop) close();
    };
    
    // 3. Fetch Data
    try {
        const [detailsRes, episodesRes] = await Promise.all([
            api.series.get(seriesId),
            api.series.episodes(seriesId)
        ]);
        
        if (!detailsRes.ok) throw new Error(detailsRes.data?.error || "Erro ao carregar série");
        
        const series = detailsRes.data.item;
        const episodes = episodesRes.ok ? episodesRes.data.episodes : [];
        
        // Group episodes by season
        const seasons = {};
        episodes.forEach(ep => {
            const s = ep.season_number || 1;
            if (!seasons[s]) seasons[s] = [];
            seasons[s].push(ep);
        });
        
        // Sort episodes in each season
        Object.keys(seasons).forEach(s => {
            seasons[s].sort((a, b) => (a.episode_number || 0) - (b.episode_number || 0));
        });
        
        const seasonNumbers = Object.keys(seasons).sort((a, b) => a - b);
        
        // Update Modal Content
        const bodyEl = backdrop.querySelector('.netflix-modal-body');
        bodyEl.classList.remove('loading');
        
        // Render Body
        bodyEl.innerHTML = `
            <div class="netflix-hero">
                <img class="netflix-poster" src="${getProxiedImage(series.poster)}" alt="${series.title}" onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster'">
                <div class="netflix-hero-gradient"></div>
            </div>
            
            <div class="netflix-info-container">
                <h2 style="font-size: 24px; margin-bottom: 10px; font-weight: bold;">${series.title}</h2>
                <div class="netflix-meta-row" style="justify-content: flex-start;">
                    <span class="match-score">${series.rating ? series.rating + ' ★' : ''}</span>
                    <span class="meta-item">${series.year || ''}</span>
                    <span class="badge" style="background:rgba(255,255,255,0.2); padding:0 6px;">Série</span>
                </div>

                <p class="netflix-description">${series.description || 'Sem descrição.'}</p>
                
                <div class="season-selector" style="display: flex; gap: 10px; overflow-x: auto; padding-bottom: 10px; margin-bottom: 20px;">
                    ${seasonNumbers.map((s, i) => `
                        <button class="season-tab ${i === 0 ? 'active' : ''}" data-season="${s}" 
                                style="background: ${i === 0 ? '#9333ea' : 'rgba(255,255,255,0.1)'}; border: none; color: white; padding: 8px 16px; border-radius: 20px; white-space: nowrap; cursor: pointer;">
                            Temporada ${s}
                        </button>
                    `).join('')}
                </div>
                
                <div class="episodes-list" style="display: flex; flex-direction: column; gap: 10px;">
                    <!-- Episodes will be injected here -->
                </div>
            </div>
        `;
        
        const listEl = bodyEl.querySelector('.episodes-list');
        const tabs = bodyEl.querySelectorAll('.season-tab');
        
        const renderEpisodes = (season) => {
            const seasonEps = seasons[season] || [];
            if (seasonEps.length === 0) {
                listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#ccc">Nenhum episódio encontrado.</div>';
                return;
            }
            
            listEl.innerHTML = seasonEps.map(ep => `
                <div class="episode-item" onclick="window.location.href='./player.html?type=series&id=${encodeURIComponent(series.id)}&s=${ep.season_number}&e=${ep.episode_number}'"
                     style="display: flex; gap: 15px; align-items: center; padding: 10px; background: rgba(255,255,255,0.05); border-radius: 8px; cursor: pointer;">
                    <div style="font-size: 24px; font-weight: bold; color: #555; width: 30px; text-align: center;">${ep.episode_number}</div>
                    <div style="flex: 1;">
                        <div style="font-weight: bold; font-size: 14px;">${ep.title || `Episódio ${ep.episode_number}`}</div>
                        <div style="font-size: 12px; color: #aaa;">${ep.duration ? Math.round(ep.duration / 60) + ' min' : ''}</div>
                    </div>
                    <div style="width: 30px; height: 30px; border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center;">
                        <div style="width: 0; height: 0; border-top: 5px solid transparent; border-bottom: 5px solid transparent; border-left: 8px solid white; margin-left: 2px;"></div>
                    </div>
                </div>
            `).join('');
        };
        
        // Initial Render
        if (seasonNumbers.length > 0) {
            renderEpisodes(seasonNumbers[0]);
        } else {
            listEl.innerHTML = '<div style="padding:20px; text-align:center; color:#ccc">Nenhum episódio disponível.</div>';
        }
        
        // Tab Switching
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => {
                    t.style.background = 'rgba(255,255,255,0.1)';
                    t.classList.remove('active');
                });
                tab.style.background = '#9333ea';
                tab.classList.add('active');
                renderEpisodes(tab.dataset.season);
            };
        });
        
    } catch (e) {
        console.error(e);
        backdrop.querySelector('.netflix-modal-body').innerHTML = `
            <div style="padding: 20px; color: #ff4444; text-align: center;">
                Erro ao carregar detalhes: ${e.message}
            </div>
        `;
    }
};

// Global Movie Modal Handler (Netflix Mobile Style)
window.showMovieModal = async function(movieId) {
    console.log("showMovieModal called for ID:", movieId);
    // 1. Create Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'netflix-modal-backdrop active'; 
    backdrop.style.zIndex = "10001"; // Force high z-index
    
    // 2. Create Modal Structure (Loading State)
    backdrop.innerHTML = `
        <div class="netflix-modal-content">
            <button class="netflix-close-btn">&times;</button>
            <div class="netflix-modal-body loading">
                <div class="loading-spinner"></div>
            </div>
        </div>
    `;
    
    document.body.appendChild(backdrop);
    
    const closeBtn = backdrop.querySelector('.netflix-close-btn');
    const close = () => {
        backdrop.classList.remove('active');
        setTimeout(() => backdrop.remove(), 300);
    };
    
    closeBtn.onclick = close;
    backdrop.onclick = (e) => {
        if (e.target === backdrop) close();
    };
    
    // 3. Fetch Data
    try {
        const detailsRes = await api.movies.get(movieId);
        
        if (!detailsRes.ok) throw new Error(detailsRes.data?.error || "Erro ao carregar filme");
        
        const movie = detailsRes.data.item;
        
        // Prepare Trailer URL (YouTube Search)
        const trailerUrl = `https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + " trailer")}`;
        
        // Randomize Match Score for Demo
        const matchScore = Math.floor(Math.random() * (99 - 85) + 85);
        const year = movie.year || '2023';
        const age = movie.age || '14';
        const duration = movie.duration ? `${Math.floor(movie.duration/60)}h ${movie.duration%60}min` : '1h 45min';

        // Render Body
        const bodyEl = backdrop.querySelector('.netflix-modal-body');
        bodyEl.classList.remove('loading');
        
        bodyEl.innerHTML = `
            <div class="netflix-hero">
                <img class="netflix-poster" src="${getProxiedImage(movie.poster)}" alt="${movie.title}" onerror="this.src='https://via.placeholder.com/300x450?text=No+Poster'">
                <div class="netflix-hero-gradient"></div>
            </div>
            
            <div class="netflix-info-container">
                <div class="netflix-meta-row">
                    <span class="match-score">${matchScore}% relevante</span>
                    <span class="meta-item">${year}</span>
                    <span class="age-badge">${age}</span>
                    <span class="meta-item">${duration}</span>
                </div>

                <div class="netflix-actions-stack">
                     <button class="btn-play-lg" onclick="window.location.href='./player.html?type=movie&id=${encodeURIComponent(movie.id)}'">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" xmlns="http://www.w3.org/2000/svg">
                            <path d="M5 3l14 9-14 9V3z"/>
                        </svg>
                        Assistir
                    </button>
                    
                    <a href="${trailerUrl}" target="_blank" class="btn-secondary-lg">
                         <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
                            <polygon points="23 7 16 12 23 17 23 7"></polygon>
                            <rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect>
                        </svg>
                        Trailer
                    </a>
                </div>

                <p class="netflix-description">${movie.description || 'Sem descrição disponível.'}</p>
                
                <div class="netflix-cast-info">
                     <div class="meta-line"><span class="label">Elenco:</span> ${movie.cast || 'Indisponível'}</div>
                     <div class="meta-line"><span class="label">Criação:</span> ${movie.director || 'Indisponível'}</div>
                </div>

                <div class="netflix-icon-actions">
                    <div class="icon-action">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M12 5v14M5 12h14"/>
                        </svg>
                        <span>Minha lista</span>
                    </div>
                    <div class="icon-action">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <path d="M14 9V5a3 3 0 0 0-3-3l-4 9v11h11.28a2 2 0 0 0 2-1.7l1.38-9a2 2 0 0 0-2-2.3zM7 22H4a2 2 0 0 1-2-2v-7a2 2 0 0 1 2-2h3"/>
                        </svg>
                        <span>Classifique</span>
                    </div>
                    <div class="icon-action">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                            <circle cx="18" cy="5" r="3"/>
                            <circle cx="6" cy="12" r="3"/>
                            <circle cx="18" cy="19" r="3"/>
                            <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                            <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                        </svg>
                        <span>Compartilhe</span>
                    </div>
                </div>
            </div>
        `;
        
    } catch (e) {
        console.error(e);
        backdrop.querySelector('.netflix-modal-body').innerHTML = `
            <div style="padding: 40px; color: #ff4444; text-align: center;">
                <p>Erro ao carregar detalhes</p>
                <p style="font-size:12px; opacity:0.7">${e.message}</p>
            </div>
        `;
    }
};
