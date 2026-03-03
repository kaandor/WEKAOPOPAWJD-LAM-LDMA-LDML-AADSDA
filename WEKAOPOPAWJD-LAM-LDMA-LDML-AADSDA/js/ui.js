import { api } from "./api.js?v=20260301-032545";

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
        // Tenta carregar direto se for HTTPS, senÃ£o usa CorsProxy
        if (url.startsWith('https://')) return url;
        return `https://corsproxy.io/?${encodeURIComponent(url)}`;
    }
    
    // Proxy external URLs (Default Weserv)
    // Weserv Ã© bom, mas pode sofrer com ORB se redirecionar para HTTP.
    // Tentar CorsProxy como fallback imediato se Weserv falhar Ã© responsabilidade do handleImageError.
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

    const originalSrc = img.getAttribute('data-original-src') || img.src; // Fallback se nÃ£o tiver attr
    // Salva o originalSrc na primeira falha se ainda nÃ£o tiver
    if (!img.getAttribute('data-original-src')) {
        img.setAttribute('data-original-src', img.src.replace(/^(https?:\/\/.*?\/\?url=|https?:\/\/corsproxy\.io\/\?|https?:\/\/api\.codetabs\.com\/v1\/proxy\?quest=)/, '')); 
    }
    
    // Recalcula originalSrc limpo para os proxies
    let cleanSrc = img.getAttribute('data-original-src');
    if (!cleanSrc || cleanSrc.startsWith('http') === false) cleanSrc = originalSrc; // Fallback

    const currentSrc = img.src;
    let nextSrc = '';

    // Strategy Chain: Direct -> Weserv -> CorsProxy -> CodeTabs -> Vercel -> AllOrigins -> Placeholder

    // 1. Falhou Weserv (PadrÃ£o) -> Tenta CorsProxy
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
    // 6. Falhou Direto (sem proxy) ou outro -> ComeÃ§a com Weserv
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
                    content.innerHTML = "<p>Nenhum conteÃºdo encontrado.</p>";
                    return;
                }
            } catch (_) {
                content.innerHTML = "<p>Nenhum conteÃºdo encontrado.</p>";
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
                                        <span class="badge">${finalType === 'movie' ? 'Filme' : 'SÃ©rie'} | ${item.genre || 'Geral'}</span>
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
        html += renderRail("Top SÃ©ries", data.rails.topSeries, "series");
        html += renderRail("Adicionados Recentemente", data.rails.recentMovies, "movie");
        html += renderRail("Filmes de Terror", data.rails.horrorMovies, "movie");
        html += renderRail("ComÃ©dia", data.rails.comedyMovies, "movie");
        html += renderRail("AÃ§Ã£o", data.rails.actionMovies, "movie");

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

    container.innerHTML = '<div class="loading-spinner">Carregando sÃ©ries...</div>';

    try {
        const res = await api.content.getSeries();
        if (!res.ok) throw new Error(res.data?.error || "Erro ao carregar sÃ©ries");

        const allSeries = res.data.series || [];

        if (allSeries.length === 0) {
            container.innerHTML = "<p>Nenhuma sÃ©rie encontrada.</p>";
            return;
        }

        let currentSearch = "";

        const render = () => {
            const filtered = allSeries.filter(s => {
                return !currentSearch || s.title.toLowerCase().includes(currentSearch);
            });

            container.innerHTML = "";
            if (filtered.length === 0) {
                container.innerHTML = "<p>Nenhuma sÃ©rie encontrada.</p>";
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
    modal.className = 'netflix-modal-backdrop active'; // Use netflix-ui.css class
    modal.innerHTML = `
        <div class="netflix-modal-content">
            <div class="netflix-close-btn" onclick="document.getElementById('genericModal').remove()">Ã—</div>
            <div class="netflix-modal-body">
                ${contentHtml}
            </div>
        </div>
    `;
    document.body.appendChild(modal);
    
    // Focus management
    const closeBtn = modal.querySelector('.netflix-close-btn');
    if (closeBtn) closeBtn.focus();
    
    // Close on escape
    modal.onkeydown = (e) => {
        if (e.key === 'Escape') modal.remove();
    };
    
    // Close on backdrop click
    modal.onclick = (e) => {
        if (e.target === modal) modal.remove();
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
            modal.querySelector('.netflix-modal-body').innerHTML = '<p>Filme nÃ£o encontrado.</p>';
            return;
        }
        
        // Fetch extra metadata if description is missing
        let description = movie.description || '';
        let rating = movie.rating || '';
        let year = movie.year || '';
        let backdrop = movie.backdrop || '';

        if (!description || description.length < 10) {
             const meta = await fetchMetadata(movie.title, 'movie');
             if (meta) {
                 description = meta.description || description;
                 rating = meta.rating || rating;
                 year = meta.year || year;
                 backdrop = meta.backdrop || backdrop;
             } else {
                 description = "Sinopse indisponÃ­vel.";
             }
        }

        // 2. Render Full Modal using netflix-ui.css structure
        // We replace the inner content of netflix-modal-body
        const bodyContent = `
            <div class="netflix-hero">
                <img class="netflix-poster" src="${getProxiedImage(movie.poster)}" alt="${movie.title}">
                ${backdrop ? `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(to bottom, transparent, #141414); z-index:0; pointer-events:none;"></div>` : ''}
            </div>
            
            <div class="netflix-info-container">
                <h1>${movie.title}</h1>
                <div class="netflix-meta-row">
                    <span class="match-score">${rating ? `${rating} Pontos` : 'Novo'}</span>
                    <span class="year">${year}</span>
                    <span class="age-badge">14</span>
                </div>
                
                <div class="netflix-actions-stack">
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-play-lg" onclick="window.location.href='./player_v2.html?type=movie&id=${movie.id}'">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            Assistir
                        </button>
                        <button class="btn-secondary-lg" onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(movie.title + ' trailer')}', '_blank')" style="background-color: rgba(109, 109, 110, 0.7); color: white; border: none; padding: 0.8rem 2.4rem; border-radius: 4px; font-size: 1.6rem; font-weight: bold; cursor: pointer; display: flex; align-items: center; gap: 1rem;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                            Trailer
                        </button>
                    </div>
                </div>
                
                <p class="netflix-description">${description}</p>
            </div>
        `;
        
        // Update modal body
        modal.querySelector('.netflix-modal-body').innerHTML = bodyContent;
        
        // Apply backdrop if available to the hero section specifically or modal background?
        // netflix-ui.css doesn't seem to have a specific backdrop container for image, 
        // but we can add inline style to hero if we want.
        // For now, the poster is enough, or we can use the backdrop image as a background for the hero.
        if (backdrop) {
             const hero = modal.querySelector('.netflix-hero');
             if (hero) {
                 hero.style.backgroundImage = `url('${getProxiedImage(backdrop)}')`;
                 hero.style.backgroundSize = 'cover';
                 hero.style.backgroundPosition = 'center';
             }
        }
        
    } catch (e) {
        console.error("Error showing movie modal:", e);
        modal.remove();
    }
};

window.showSeriesModal = async (id) => {
    const modal = createModal('<div class="loading-spinner">Carregando episÃ³dios...</div>');
    
    try {
        const res = await api.content.getSeriesEpisodes(id);
        if (!res.ok) throw new Error("Erro ao carregar episÃ³dios");
        
        const seriesData = res.data;
        // Try to fetch metadata for series if description is missing
        if (!seriesData.description || seriesData.description.length < 10) {
             const meta = await fetchMetadata(seriesData.title, 'tv'); // 'tv' for series
             if (meta) {
                 seriesData.description = meta.description || "Sinopse indisponÃ­vel.";
                 seriesData.rating = meta.rating || seriesData.rating;
                 seriesData.year = meta.year || seriesData.year;
                 if (meta.backdrop) seriesData.backdrop = meta.backdrop;
             }
        }
        
        const episodes = seriesData.episodes || [];
        
        // Group by season with Deduplication
        const seasons = {};
        const seenEpisodes = new Set(); // Key: S{s}E{e}

        episodes.forEach(ep => {
            const s = parseInt(ep.season_number || ep.season || 1);
            const e = parseInt(ep.episode_number || ep.episode || 0);
            const key = `S${s}E${e}`;
            
            if (seenEpisodes.has(key)) return; // Skip duplicate
            seenEpisodes.add(key);

            if (!seasons[s]) seasons[s] = [];
            seasons[s].push(ep);
        });
        
        // Sort seasons
        const sortedSeasons = Object.keys(seasons).sort((a,b) => a - b);
        
        // Render Seasons
        let seasonsHtml = '';
        sortedSeasons.forEach(s => {
            seasonsHtml += `
                <div style="margin-bottom: 20px;">
                    <div style="display: flex; align-items: center; gap: 15px; margin-bottom: 10px; padding-left: 20px;">
                        <h3 style="color:#e5e5e5; margin: 0;">Temporada ${s}</h3>
                        <button onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(seriesData.title + ' season ' + s + ' trailer')}', '_blank')" 
                                style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-items: center; gap: 5px;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                            Trailer
                        </button>
                    </div>
                    <div style="display:flex; flex-direction:column; gap:2px;">
                        ${seasons[s].map(ep => `
                            <div class="focusable" tabindex="0" 
                                 style="padding: 15px 20px; display:flex; align-items:center; gap:15px; cursor:pointer; transition:background 0.2s;"
                                 onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                                 onmouseout="this.style.background='transparent'"
                                 onclick="window.location.href='./player_v2.html?type=series&id=${id}&season=${s}&episode=${ep.episode_number || ep.episode}'">
                                <span style="color:#d2d2d2; font-size:18px; width:30px;">${ep.episode_number || ep.episode}</span>
                                <div style="flex:1;">
                                    <div style="color:white; font-weight:500;">${ep.title}</div>
                                </div>
                                <svg width="24" height="24" viewBox="0 0 24 24" fill="white"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        });
        
        const bodyContent = `
            <div class="netflix-hero">
                <img class="netflix-poster" src="${getProxiedImage(seriesData.poster)}" alt="${seriesData.title}">
                ${seriesData.backdrop ? `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(to bottom, transparent, #141414); z-index:0; pointer-events:none;"></div>` : ''}
            </div>
            
            <div class="netflix-info-container">
                <h1>${seriesData.title}</h1>
                <div class="netflix-meta-row">
                    <span class="match-score">${seriesData.rating ? `${seriesData.rating} Pontos` : 'Novo'}</span>
                    <span class="year">${seriesData.year || ''}</span>
                    <span class="age-badge">14</span>
                </div>
                 <p class="netflix-description">${seriesData.description || 'Sem descriÃ§Ã£o.'}</p>
                 
                 <div style="margin-top:20px;">
                    ${seasonsHtml}
                 </div>
            </div>
        `;
        
        modal.querySelector('.netflix-modal-body').innerHTML = bodyContent;

        if (seriesData.backdrop) {
             const hero = modal.querySelector('.netflix-hero');
             if (hero) {
                 hero.style.backgroundImage = `url('${getProxiedImage(seriesData.backdrop)}')`;
                 hero.style.backgroundSize = 'cover';
                 hero.style.backgroundPosition = 'center';
             }
        }

    } catch (e) {
        console.error("Error showing series modal:", e);
        modal.remove();
    }
};



