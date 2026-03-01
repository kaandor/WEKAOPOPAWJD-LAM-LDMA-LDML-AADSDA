import { api } from "./api.js?v=20260225-v1";

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
    
    // Prioridade para clientetv.xyz: CorsProxy (Melhor contra ORB e bloqueios recentes)
    if (url.includes('dns.clientetv.xyz') || url.includes('clientetv.xyz')) {
        // Tenta carregar direto se for HTTPS, senão usa CorsProxy
        if (url.startsWith('https://')) return url;
        return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }
    
    // Proxy external URLs (Default Weserv)
    // Weserv é bom, mas pode sofrer com ORB se redirecionar para HTTP.
    // Tentar CorsProxy como fallback imediato se Weserv falhar é responsabilidade do handleImageError.
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

    const originalSrc = img.getAttribute('data-original-src') || img.src; // Fallback se não tiver attr
    // Salva o originalSrc na primeira falha se ainda não tiver
    if (!img.getAttribute('data-original-src')) {
        img.setAttribute('data-original-src', img.src.replace(/^(https?:\/\/.*?\/\?url=|https?:\/\/corsproxy\.io\/\?|https?:\/\/api\.codetabs\.com\/v1\/proxy\?quest=)/, '')); 
    }
    
    // Recalcula originalSrc limpo para os proxies
    let cleanSrc = img.getAttribute('data-original-src');
    if (!cleanSrc || cleanSrc.startsWith('http') === false) cleanSrc = originalSrc; // Fallback

    const currentSrc = img.src;
    let nextSrc = '';

    // Strategy Chain: Direct -> Weserv -> CorsProxy -> CodeTabs -> Vercel -> AllOrigins -> Placeholder

    // 1. Falhou Weserv (Padrão) -> Tenta CorsProxy
    if (currentSrc.includes('images.weserv.nl')) {
         console.warn('[Image] Weserv failed, switching to CorsProxy:', cleanSrc);
         nextSrc = `https://corsproxy.io/?${encodeURIComponent(cleanSrc)}`;
    }
    // 2. Falhou CorsProxy -> Tenta CodeTabs
    else if (currentSrc.includes('corsproxy.io')) {
        console.warn('[Image] CorsProxy failed, switching to CodeTabs:', cleanSrc);
        nextSrc = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(cleanSrc)}`;
    }
    // 3. Falhou CodeTabs -> Tenta Vercel
    else if (currentSrc.includes('api.codetabs.com')) {
        console.warn('[Image] CodeTabs failed, switching to Vercel:', cleanSrc);
        nextSrc = `https://klyx-api.vercel.app/api/proxy?url=${encodeURIComponent(cleanSrc)}`;
    }
    // 4. Falhou Vercel -> Tenta AllOrigins
    else if (currentSrc.includes('klyx-api.vercel.app')) {
        console.warn('[Image] Vercel failed, switching to AllOrigins:', cleanSrc);
        nextSrc = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanSrc)}`;
    }
    // 5. Falhou AllOrigins -> Placeholder
    else if (currentSrc.includes('api.allorigins.win')) {
         console.error('[Image] All proxies failed for:', cleanSrc);
         img.src = 'https://via.placeholder.com/300x450?text=No+Image';
         img.setAttribute('data-failed', 'true');
         return;
    }
    // 6. Falhou Direto (sem proxy) ou outro -> Começa com Weserv
    else {
        console.warn('[Image] Direct load failed, starting proxy chain with Weserv:', cleanSrc);
        nextSrc = `https://images.weserv.nl/?url=${encodeURIComponent(cleanSrc)}&w=400&output=webp&q=80`;
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
                    metaRight: "",
                    clickAction: `window.showMovieModal('${movie.id}')`
                });
            });
        };

        // Initialize
        render();

        // Search Listener
        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                currentSearch = e.target.value.toLowerCase();
                render();
            });
        }

        // Category Filter
        if (catsRes.ok && catsRes.data) {
            setupCustomDropdown(categorySelectId, catsRes.data, (value) => {
                currentCategory = value;
                render();
            });
        }

    } catch (e) {
        console.error("Error loading movies:", e);
        container.innerHTML = `<p style="color:red">Erro: ${e.message}</p>`;
    }
}

export async function initSeries() {
    console.log("Series Initialized");
    ensureProfilePlacement();
    window.addEventListener("resize", ensureProfilePlacement);
    const container = document.getElementById("seriesGrid");
    const searchInput = document.getElementById("seriesSearch");

    if (!container) return;

    container.innerHTML = '<div class="loading-spinner">Carregando séries...</div>';

    try {
        const res = await api.content.getSeries();
        if (!res.ok) throw new Error(res.data?.error || "Erro ao carregar séries");

        const allSeries = res.data.series || [];

        if (allSeries.length === 0) {
            container.innerHTML = "<p>Nenhuma série encontrada.</p>";
            return;
        }

        let currentSearch = "";

        const render = () => {
            const filtered = allSeries.filter(s => {
                return !currentSearch || s.title.toLowerCase().includes(currentSearch);
            });

            container.innerHTML = "";
            if (filtered.length === 0) {
                container.innerHTML = "<p>Nenhuma série encontrada.</p>";
                return;
            }

            setupInfiniteScroll(filtered, container, (serie) => {
                return createPosterCard({
                    title: serie.title,
                    posterUrl: serie.poster,
                    metaLeft: "",
                    metaRight: "",
                    clickAction: `window.showSeriesModal('${serie.id}')`
                });
            });
        };

        render();

        if (searchInput) {
            searchInput.addEventListener("input", (e) => {
                currentSearch = e.target.value.toLowerCase();
                render();
            });
        }

    } catch (e) {
        console.error("Error loading series:", e);
        container.innerHTML = `<p style="color:red">Erro: ${e.message}</p>`;
    }
}

// --- SHARED UI COMPONENTS ---

function createPosterCard({ title, posterUrl, metaLeft, metaRight, clickAction }) {
    const card = document.createElement('div');
    card.className = 'card focusable';
    card.tabIndex = 0;
    card.setAttribute('onclick', clickAction);
    
    card.innerHTML = `
        <img class="poster" src="${getProxiedImage(posterUrl)}" alt="${title}" loading="lazy" draggable="false"
             data-original-src="${posterUrl}"
             onerror="window.handleImageError(this)">
        <div class="card-body">
            <h3 class="card-title">${title}</h3>
        </div>
    `;
    
    // Add Enter key support
    card.onkeydown = (e) => {
        if (e.key === 'Enter') {
            eval(clickAction);
        }
    };
    
    return card;
}

// --- MODAL HELPERS ---

// Create and show modal (generic)
function createModal(contentHtml) {
    const existing = document.getElementById('genericModal');
    if (existing) existing.remove();

    const modal = document.createElement('div');
    modal.id = 'genericModal';
    modal.className = 'modal-overlay';
    modal.innerHTML = `
        <div class="modal-content">
            <button class="modal-close" onclick="document.getElementById('genericModal').remove()">×</button>
            ${contentHtml}
        </div>
    `;
    document.body.appendChild(modal);
    
    // Focus management
    const closeBtn = modal.querySelector('.modal-close');
    closeBtn.focus();
    
    // Close on escape
    modal.onkeydown = (e) => {
        if (e.key === 'Escape') modal.remove();
    };
    
    return modal;
}

window.showMovieModal = async (id) => {
    // 1. Show loading modal
    const modal = createModal('<div class="loading-spinner">Carregando detalhes...</div>');
    
    try {
        const res = await api.movies.list();
        const movies = res.ok ? res.data : [];
        const movie = movies.find(m => m.id === id);
        
        if (!movie) {
            modal.querySelector('.modal-content').innerHTML = '<p>Filme não encontrado.</p><button onclick="this.closest(\'.modal-overlay\').remove()">Fechar</button>';
            return;
        }
        
        // Fetch extra metadata if description is missing
        let description = movie.description || '';
        let rating = movie.rating || '';
        let year = movie.year || '';
        let backdrop = movie.backdrop || '';

        if (!description || description.length < 10) {
             const modalContent = modal.querySelector('.modal-content');
             // Show we are loading metadata...
             // Note: We don't block UI, just update later
             const meta = await fetchMetadata(movie.title, 'movie');
             if (meta) {
                 description = meta.description || description;
                 rating = meta.rating || rating;
                 year = meta.year || year;
                 backdrop = meta.backdrop || backdrop;
             } else {
                 description = "Sinopse indisponível.";
             }
        }

        // 2. Render Full Modal
        const content = `
            <div class="movie-detail-modal" style="${backdrop ? `background-image: linear-gradient(to top, #141414 10%, rgba(20,20,20,0.8) 50%, rgba(20,20,20,0.6) 100%), url('${backdrop}'); background-size: cover; background-position: center;` : ''}">
                <div class="detail-content">
                    <h1>${movie.title}</h1>
                    <div class="meta-row">
                        <span class="match-score">${rating ? `${rating} Pontos` : 'Novo'}</span>
                        <span class="year">${year}</span>
                        <span class="age-limit">14</span>
                    </div>
                    <p class="description">${description}</p>
                    
                    <div class="actions">
                        <button class="play-btn focusable" onclick="window.location.href='./player_v2.html?type=movie&id=${movie.id}'">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            Assistir
                        </button>
                    </div>
                </div>
                <button class="modal-close-btn" onclick="document.getElementById('genericModal').remove()">×</button>
            </div>
        `;
        
        modal.innerHTML = content;
        
    } catch (e) {
        console.error("Error showing movie modal:", e);
        modal.remove();
    }
};

window.showSeriesModal = async (id) => {
    const modal = createModal('<div class="loading-spinner">Carregando episódios...</div>');
    
    try {
        const res = await api.content.getSeriesEpisodes(id);
        if (!res.ok) throw new Error("Erro ao carregar episódios");
        
        const seriesData = res.data;
        // Try to fetch metadata for series if description is missing
        if (!seriesData.description || seriesData.description.length < 10) {
             const meta = await fetchMetadata(seriesData.title, 'tv'); // 'tv' for series
             if (meta) {
                 seriesData.description = meta.description || "Sinopse indisponível.";
                 seriesData.rating = meta.rating || seriesData.rating;
                 seriesData.year = meta.year || seriesData.year;
                 if (meta.backdrop) seriesData.backdrop = meta.backdrop;
             }
        }
        
        const episodes = seriesData.episodes || [];
        
        // Group by season
        const seasons = {};
        episodes.forEach(ep => {
            const s = ep.season_number || ep.season || 1; // Default to 1 if missing
            if (!seasons[s]) seasons[s] = [];
            seasons[s].push(ep);
        });
        
        // Sort seasons
        const sortedSeasons = Object.keys(seasons).sort((a,b) => a - b);
        
        // Render
        let seasonsHtml = '';
        sortedSeasons.forEach(s => {
            seasonsHtml += `
                <div class="season-block">
                    <h3>Temporada ${s}</h3>
                    <div class="episodes-list">
                        ${seasons[s].map(ep => `
                            <div class="episode-item focusable" tabindex="0" 
                                 onclick="window.location.href='./player_v2.html?type=series&id=${id}&season=${s}&episode=${ep.episode_number || ep.episode}'">
                                <span class="ep-num">${ep.episode_number || ep.episode}</span>
                                <span class="ep-title">${ep.title}</span>
                                <svg class="play-icon" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        
        const content = `
            <div class="series-detail-modal" style="${seriesData.backdrop ? `background-image: linear-gradient(to top, #141414 10%, rgba(20,20,20,0.8) 50%, rgba(20,20,20,0.6) 100%), url('${seriesData.backdrop}'); background-size: cover; background-position: center;` : ''}">
                <div class="detail-header">
                    <h1>${seriesData.title}</h1>
                    <p class="description">${seriesData.description || 'Sem descrição.'}</p>
                </div>
                <div class="seasons-container">
                    ${seasonsHtml}
                </div>
                <button class="modal-close-btn" onclick="document.getElementById('genericModal').remove()">×</button>
            </div>
        `;
        
        modal.innerHTML = content;

    } catch (e) {
        console.error("Error showing series modal:", e);
        modal.innerHTML = `<div class="modal-content"><p>Erro: ${e.message}</p><button onclick="this.closest('.modal-overlay').remove()">Fechar</button></div>`;
    }
};
