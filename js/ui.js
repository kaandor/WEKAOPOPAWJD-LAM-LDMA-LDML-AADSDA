import { api } from "./api.js?v=20260224-final-v2";

// --- THEME APPLICATION + CLOUD SYNC ---
// Start cloud polling silently (sem bolinha verde)
const session = api.session.read();
if (session?.user) {
    const token = session.tokens?.accessToken;
    const isGoogle = session.provider === "google";
    // Allow Google users to poll even without standard token
    if (isGoogle || (token && token !== "offline" && !String(token).startsWith("klyx_"))) {
        api.cloud.startPolling();
    }
}

export function applyGlobalTheme() {
    try {
        const read = api.session && typeof api.session.read === 'function' ? api.session.read : null;
        const session = read ? read() : null;
        if (!session || !session.user) {
            applyTheme();
            return;
        }
        if (!api.settings || typeof api.settings.get !== 'function') {
            applyTheme();
            return;
        }
        const prefs = api.settings.get();
        applyTheme(prefs.theme);
    } catch (e) { console.warn("Theme apply error", e); }
}

applyGlobalTheme();

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
    if (url.includes('images.weserv.nl') || url.includes('klyx-api.vercel.app')) return url;
    // If local asset, return as is
    if (url.startsWith('./') || url.startsWith('/') || url.startsWith('assets/')) return url;
    
    // Prioridade para clientetv.xyz: Vercel Proxy (mais estável que corsproxy.io)
    if (url.includes('dns.clientetv.xyz') || url.includes('clientetv.xyz')) {
        return `https://klyx-api.vercel.app/api/proxy?url=${encodeURIComponent(url)}`;
    }
    
    // Proxy external URLs
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=400&output=webp&q=80`;
}

// --- METADATA FETCHING (TMDB) ---
// Used to fetch descriptions when missing in source
const TMDB_API_KEY = "3d197569c720ea63916d97cf9ca466f1"; // Public demo key
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function fetchMetadata(title, type = 'movie') {
    if (!title) return null;
    
    // Clean title for search
    // Remove (YYYY), [Dual], [Legendado], etc.
    let cleanTitle = title
        .replace(/\(\d{4}\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/ - .*/, '') // Remove suffixes
        .trim();
        
    // Extract year if present in original title
    const yearMatch = title.match(/\((\d{4})\)/);
    const year = yearMatch ? yearMatch[1] : '';
    
    try {
        let searchUrl = `${TMDB_BASE_URL}/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}&language=pt-BR`;
        if (year) searchUrl += `&year=${year}`;
        
        const res = await fetch(searchUrl);
        const data = await res.json();
        
        if (data.results && data.results.length > 0) {
            // Return first match
            const match = data.results[0];
            return {
                description: match.overview,
                rating: match.vote_average ? match.vote_average.toFixed(1) : null,
                year: match.release_date ? match.release_date.split('-')[0] : (match.first_air_date ? match.first_air_date.split('-')[0] : ''),
                backdrop: match.backdrop_path ? `https://image.tmdb.org/t/p/w1280${match.backdrop_path}` : null,
                genre_ids: match.genre_ids
            };
        }
    } catch (e) {
        console.warn("TMDB Fetch Error:", e);
    }
    return null;
}


    // Global Image Error Handler to try backups
    window.handleImageError = function(img) {
        // Prevent infinite loop
        if (img.getAttribute('data-failed') === 'true') return;

        const originalSrc = img.getAttribute('data-original-src');
        if (!originalSrc) {
            img.src = 'https://via.placeholder.com/300x450?text=Error';
            img.setAttribute('data-failed', 'true');
            return;
        }

        const currentSrc = img.src;
        let nextSrc = '';

        // Strategy Chain: Weserv -> CorsProxy -> Vercel -> AllOrigins -> Placeholder

        // 1. If currently using Weserv (default), try CorsProxy (more robust)
        if (currentSrc.includes('images.weserv.nl')) {
            console.warn('[Image] Weserv failed, switching to CorsProxy:', originalSrc);
            nextSrc = `https://corsproxy.io/?${encodeURIComponent(originalSrc)}`;
        }
        // 2. If CorsProxy failed, try Vercel Proxy
        else if (currentSrc.includes('corsproxy.io')) {
            console.warn('[Image] CorsProxy failed, switching to Vercel:', originalSrc);
            nextSrc = `https://klyx-api.vercel.app/api/proxy?url=${encodeURIComponent(originalSrc)}`;
        }
        // 3. If Vercel failed, try AllOrigins
        else if (currentSrc.includes('klyx-api.vercel.app')) {
            console.warn('[Image] Vercel failed, switching to AllOrigins:', originalSrc);
            nextSrc = `https://api.allorigins.win/raw?url=${encodeURIComponent(originalSrc)}`;
        }
        // 4. Give up
        else {
            console.error('[Image] All proxies failed for:', originalSrc);
            img.src = 'https://via.placeholder.com/300x450?text=No+Image';
            img.setAttribute('data-failed', 'true');
            return;
        }

        img.src = nextSrc;
    };

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

function ensureProfilePlacement() {
    const headerActions = document.querySelector(".header-actions");
    if (!headerActions) return;
    const anchor = document.getElementById("toolbarProfileAnchor");
    const headerEl = document.getElementById("app-header");
    if (window.innerWidth >= 769) {
        if (anchor && !anchor.contains(headerActions)) anchor.appendChild(headerActions);
    } else {
        if (headerEl && !headerEl.contains(headerActions)) headerEl.appendChild(headerActions);
    }
}

// Redirect Live TV requests to Dashboard
if (window.location.pathname.includes("live-tv.html")) {
    window.location.href = "./dashboard.html";
}

export async function initLive() {
    window.location.href = "./dashboard.html";
}

export function handleLoginSuccess(user) {
    console.log("Login successful:", user);
    try {
        const session = api.session.read();
        const token = session && session.tokens && session.tokens.accessToken;
        const isGoogle = session && session.provider === "google";
        
        if (isGoogle || (token && token !== "offline" && !String(token).startsWith("klyx_"))) {
            api.cloud.startPolling();
        }
    } catch (e) {
        console.warn("Cloud polling start error", e);
    }
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

        let data = res.data;
        if (!data.rails) {
            try {
                const fallback = await fetch('./assets/data/home.json').then(r => r.json());
                if (fallback && fallback.rails) {
                    data = fallback;
                } else {
                    content.innerHTML = "<p>Nenhum conteúdo encontrado.</p>";
                    return;
                }
            } catch (_) {
                content.innerHTML = "<p>Nenhum conteúdo encontrado.</p>";
                return;
            }
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
                            const isLive = finalType === 'live';
                            let clickAction;
                            if (isLive) {
                                clickAction = `window.location.href='./player_v2.html?type=live&id=${item.id}'`;
                            } else if (isSeries) {
                                clickAction = `window.showSeriesModal('${item.id}')`;
                            } else {
                                clickAction = `window.showMovieModal('${item.id}')`;
                            }

                            return `
                            <div class="card focusable" data-id="${item.id}" tabindex="0" 
                                 onclick="${clickAction}">
                                <img class="poster" src="${getProxiedImage(item.poster)}" alt="${item.title}" loading="lazy" draggable="false" 
                                     data-original-src="${item.poster}"
                                     onerror="window.handleImageError(this)">
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
        html += renderRail("Jogos do Dia", data.rails.dailyGames, "mixed");
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
    ensureProfilePlacement();
    window.addEventListener("resize", ensureProfilePlacement);
    const container = document.getElementById("moviesGrid");
    const catalog = document.getElementById("moviesCatalog");
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
        container.innerHTML = `<p style="color:red">Erro ao carregar filmes: ${e.message}</p>`;
    }
}

// --- SHARED CARD CREATORS ---
export function createPosterCard({ title, posterUrl, metaLeft, metaRight, onClick }) {
    const card = document.createElement("div");
    card.className = "card focusable";
    card.tabIndex = 0;
    card.onclick = onClick;
    
    // Handle Enter key
    card.onkeydown = (e) => {
        if (e.key === 'Enter') onClick();
    };

    const img = document.createElement("img");
    img.className = "poster";
    img.src = getProxiedImage(posterUrl);
    img.alt = title;
    img.loading = "lazy";
    img.draggable = false;
    // Error handler attached to window to avoid inline JS restrictions if strict CSP
    img.setAttribute('data-original-src', posterUrl);
    img.onerror = function() { window.handleImageError(this); };

    const body = document.createElement("div");
    body.className = "card-body";

    const h3 = document.createElement("h3");
    h3.className = "card-title";
    h3.textContent = title;

    const meta = document.createElement("div");
    meta.className = "card-meta";
    
    if (metaLeft) {
        const sp1 = document.createElement("span");
        sp1.textContent = metaLeft;
        meta.appendChild(sp1);
    }
    if (metaRight) {
        const sp2 = document.createElement("span");
        sp2.className = "badge";
        sp2.textContent = metaRight;
        meta.appendChild(sp2);
    }

    body.appendChild(h3);
    body.appendChild(meta);
    card.appendChild(img);
    card.appendChild(body);
    
    return card;
}

// --- MISSING EXPORTS RESTORED ---

export async function initSeries() {
    console.log("Series Initialized");
    ensureProfilePlacement();
    window.addEventListener("resize", ensureProfilePlacement);
    const container = document.getElementById("seriesGrid");
    const categorySelectId = "seriesCategory";
    const searchInput = document.getElementById("seriesSearch");

    if (!container) return;
    container.innerHTML = '<div class="loading-spinner">Carregando séries...</div>';

    try {
        const [seriesRes, catsRes] = await Promise.all([
            api.content.getSeries(),
            api.series && api.series.categories ? api.series.categories() : Promise.resolve({ ok: true, data: [] })
        ]);

        if (!seriesRes.ok) throw new Error(seriesRes.data?.error || "Erro ao carregar séries");
        const allSeries = seriesRes.data.series || [];

        if (allSeries.length === 0) {
            container.innerHTML = "<p>Nenhum conteúdo encontrado.</p>";
            return;
        }

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
                container.innerHTML = "<p>Nenhum conteúdo encontrado.</p>";
                return;
            }
            
            setupInfiniteScroll(filtered, container, (series) => {
                return createPosterCard({
                    title: series.title,
                    posterUrl: series.poster,
                    metaLeft: "",
                    metaRight: series.rating ? `★ ${series.rating}` : "Série",
                    onClick: () => {
                        window.showSeriesModal(series.id);
                    }
                });
            });
        };

        if (catsRes.ok && catsRes.data.length > 0) {
            setupCustomDropdown(categorySelectId, catsRes.data, (val) => {
                currentCategory = val;
                render();
            });
        }

        if (searchInput) {
            searchInput.oninput = (e) => {
                currentSearch = e.target.value.toLowerCase();
                render();
            };
        }

        render();
        
    } catch (e) {
        console.error("Series error:", e);
        container.innerHTML = `<p style="color:red">Erro ao carregar séries: ${e.message}</p>`;
    }
}

// --- MODAL SYSTEM RESTORED ---

function injectModalHTML() {
    if (document.getElementById('detailsModal')) return;
    const modalHTML = `
    <div id="detailsModal" class="netflix-modal-backdrop" onclick="closeModal(event)" style="z-index: 99999;">
        <div class="netflix-modal-content" onclick="event.stopPropagation()">
            <button class="netflix-close-btn" onclick="closeModal()">×</button>
            <div id="modalBody" class="netflix-modal-body">
                <!-- Content injected here -->
            </div>
        </div>
    </div>`;
    document.body.insertAdjacentHTML('beforeend', modalHTML);
}

window.closeModal = function(e) {
    if (e && e.target !== document.getElementById('detailsModal') && e.target.className !== 'netflix-close-btn') {
        // Allow close button to work
        if (!e.target.closest('.netflix-close-btn')) return;
    } 
    const modal = document.getElementById('detailsModal');
    if (modal) {
        modal.classList.remove('active');
        // Clear content after animation to stop video/audio if any
        setTimeout(() => {
             const body = document.getElementById('modalBody');
             if(body) body.innerHTML = '';
        }, 300);
    }
};

window.showMovieModal = async function(id) {
    console.log("Opening Movie Modal:", id);
    injectModalHTML();
    const modal = document.getElementById('detailsModal');
    const body = document.getElementById('modalBody');
    
    // Reset state
    modal.classList.remove('active');
    void modal.offsetWidth; // Force reflow
    modal.classList.add('active');
    
    body.innerHTML = '<div class="loading-spinner" style="height:200px">Carregando...</div>';
    
    try {
        // Try to find movie in cached lists first to avoid network delay
        let movie = null;
        
        // 1. Try api.movies.list cache if available
        // Since we don't have direct access to internal cache, we fetch (it uses cache)
        const res = await api.content.getMovies();
        if (res.ok && res.data.movies) {
            movie = res.data.movies.find(m => m.id == id);
        }
        
        if (!movie) {
            // Fallback: Try Home data
             const homeRes = await api.content.getHome();
             if (homeRes.ok && homeRes.data.rails) {
                 // Search in all rails
                 Object.values(homeRes.data.rails).flat().forEach(m => {
                     if (m.id == id) movie = m;
                 });
             }
        }

        if (!movie) throw new Error("Filme não encontrado");

        // Render Modal Content
        const proxiedPoster = getProxiedImage(movie.poster);
        
        body.innerHTML = `
            <div class="netflix-hero">
                <img src="${proxiedPoster}" class="netflix-poster" data-original-src="${movie.poster}" onerror="window.handleImageError(this)"/>
            </div>
            <div class="netflix-info-container">
                <h2 style="font-size: 24px; margin-bottom: 10px;">${movie.title}</h2>
                <div class="netflix-meta-row">
                    <span class="match-score">98% Relevante</span>
                    <span class="age-badge">${movie.rating || '12+'}</span>
                    <span class="meta-item">${movie.year || ''}</span>
                    <span class="meta-item">${movie.duration ? Math.round(movie.duration/60) + ' min' : ''}</span>
                </div>
                
                <div class="netflix-actions-stack">
                    <button class="btn-play-lg" onclick="window.location.href='./player_v2.html?type=movie&id=${encodeURIComponent(id)}'">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px"><path d="M8 5v14l11-7z"/></svg>
                        Assistir
                    </button>
                    <!-- Future: Minha Lista button -->
                </div>
                
                <p class="netflix-description">${movie.description || 'Carregando sinopse...'}</p>
                
                <div class="netflix-cast-info">
                   <div class="meta-line"><span style="color:#777">Gênero:</span> ${movie.genre || 'Geral'}</div>
                </div>
            </div>
        `;
        
        // --- LAZY FETCH DESCRIPTION IF MISSING ---
        if (!movie.description || movie.description === 'Carregando sinopse...') {
            // Async fetch without blocking UI
            fetchMetadata(movie.title, 'movie').then(meta => {
                const descEl = body.querySelector('.netflix-description');
                if (meta && meta.description) {
                    if (descEl) descEl.textContent = meta.description;
                    
                    // Also update rating/year if missing
                    if (!movie.rating && meta.rating) {
                        const rateEl = body.querySelector('.age-badge');
                        if (rateEl) rateEl.textContent = meta.rating;
                    }
                    if (!movie.year && meta.year) {
                         const yearEl = body.querySelectorAll('.meta-item')[0]; // Assuming first is year
                         if (yearEl) yearEl.textContent = meta.year;
                    }
                } else {
                    if (descEl) descEl.textContent = 'Sinopse indisponível.';
                }
            });
        }

    } catch (e) {
        console.error("Error showing movie modal:", e);
        body.innerHTML = `<div style="padding:20px; text-align:center;">
            <p>Erro ao carregar detalhes.</p>
            <button class="btn-play-lg" onclick="window.location.href='./player_v2.html?type=movie&id=${encodeURIComponent(id)}'">
                Tentar Reproduzir Direto
            </button>
        </div>`;
    }
};

window.showSeriesModal = async function(id) {
    console.log("Opening Series Modal:", id);
    injectModalHTML();
    const modal = document.getElementById('detailsModal');
    const body = document.getElementById('modalBody');
    
    modal.classList.add('active');
    body.innerHTML = '<div class="loading-spinner" style="height:200px">Carregando...</div>';

    try {
        let series = null;
        const res = await api.content.getSeries();
        if (res.ok && res.data.series) {
            series = res.data.series.find(s => s.id == id);
        }

        if (!series) throw new Error("Série não encontrada");

        // Render Series Content
        const proxiedPoster = getProxiedImage(series.poster);
        
        body.innerHTML = `
            <div class="netflix-hero">
                <img src="${proxiedPoster}" class="netflix-poster" data-original-src="${series.poster}" onerror="window.handleImageError(this)"/>
            </div>
            <div class="netflix-info-container">
                <h2 style="font-size: 24px; margin-bottom: 10px;">${series.title}</h2>
                <div class="netflix-meta-row">
                    <span class="match-score">Série</span>
                    <span class="age-badge">${series.rating || '14+'}</span>
                    <span class="meta-item">${series.year || ''}</span>
                </div>
                
                <div class="netflix-actions-stack">
                    <button class="btn-play-lg" onclick="window.location.href='./player_v2.html?type=series&id=${encodeURIComponent(id)}'">
                        <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor" style="margin-right:8px"><path d="M8 5v14l11-7z"/></svg>
                        Assistir
                    </button>
                </div>
                
                <p class="netflix-description">${series.description || 'Carregando sinopse...'}</p>
                 <div class="netflix-cast-info">
                   <div class="meta-line"><span style="color:#777">Gênero:</span> ${series.genre || 'Geral'}</div>
                </div>
            </div>
        `;
        
        // --- LAZY FETCH DESCRIPTION IF MISSING (SERIES) ---
        if (!series.description || series.description === 'Carregando sinopse...') {
            fetchMetadata(series.title, 'tv').then(meta => {
                 const descEl = body.querySelector('.netflix-description');
                 if (meta && meta.description) {
                     if (descEl) descEl.textContent = meta.description;
                     
                     if (!series.rating && meta.rating) {
                        const rateEl = body.querySelector('.age-badge');
                        if (rateEl) rateEl.textContent = meta.rating;
                     }
                 } else {
                     if (descEl) descEl.textContent = 'Sinopse indisponível.';
                 }
            });
        }
        
    } catch (e) {
        console.error("Error showing series modal:", e);
        body.innerHTML = `<div style="padding:20px; text-align:center;">
            <p>Erro ao carregar detalhes.</p>
            <button class="btn-play-lg" onclick="window.location.href='./player_v2.html?type=series&id=${encodeURIComponent(id)}'">
                Tentar Reproduzir Direto
            </button>
        </div>`;
    }
};

// Also export initSearch just in case
import { initSearch as initSearchOriginal } from "./search.js";
export const initSearch = initSearchOriginal;


export function createThumbCard({ title, thumbUrl, metaLeft, metaRight, onClick }) {
    const card = document.createElement("div");
    card.className = "card focusable"; // Reusing card class but might need specific thumb styling
    card.tabIndex = 0;
    card.onclick = onClick;
    
    // Handle Enter key
    card.onkeydown = (e) => {
        if (e.key === 'Enter') onClick();
    };

    const img = document.createElement("img");
    img.className = "poster"; // Using poster class for now, maybe create .thumb
    img.src = getProxiedImage(thumbUrl);
    img.alt = title;
    img.loading = "lazy";
    img.draggable = false;
    img.setAttribute('data-original-src', thumbUrl);
    img.onerror = function() { window.handleImageError(this); };

    const body = document.createElement("div");
    body.className = "card-body";

    const h3 = document.createElement("h3");
    h3.className = "card-title";
    h3.textContent = title;

    const meta = document.createElement("div");
    meta.className = "card-meta";
    
    if (metaLeft) {
        const sp1 = document.createElement("span");
        sp1.textContent = metaLeft;
        meta.appendChild(sp1);
    }
    if (metaRight) {
        const sp2 = document.createElement("span");
        sp2.className = "badge";
        sp2.textContent = metaRight;
        meta.appendChild(sp2);
    }

    body.appendChild(h3);
    body.appendChild(meta);
    card.appendChild(img);
    card.appendChild(body);
    
    return card;
}
