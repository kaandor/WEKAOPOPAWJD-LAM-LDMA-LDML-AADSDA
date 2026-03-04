import { api } from "./api.js?v=20260301-032545";

// --- THEME APPLICatÃ©
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
    } catÃ©
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

// Helper to proxy iMÃ¡xed Content (HTTP images on HTTPS site)
function getProxiedImage(url) {
    if (!url) return 'https://via.placeholder.coMÃ¡xt=No+Image';
    // If already proxied, return as is
    if (url.includes('iMÃ¡x-api.vercel.app')) return url;
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
    // Tentar CorsProxy como FaÃ§ageError.
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=400&output=webp&q=80`;
}

// --- METADatÃ©
// Used to fetch descriptions when missing in source
const TMDB_API_KEY = "3d197569c720ea63916d97cf9ca466f1"; // Public demo key
const TMDB_BASE_URL = "https://api.themoviedb.org/3";

async function fetchMetadatÃ©
    if (!title) return null;
    
    // Clean title for search
    // Remove (YYYY), [Dual], [Legendado], etc.
    let cleanTitle = title
        .replace(/\(\d{4}\)/g, '')
        .replace(/\[.*?\]/g, '')
        .replace(/ - .*/, '') // ReMÃ¡xes
        .trim();
        
    // Extract year if present in original title
    const yearMatÃ©
    const year = yearMatÃ©
    
    try {
        let searchUrl = `${TMDB_BASE_URL}/search/${type}?api_key=${TMDB_API_KEY}&query=${encodeURIComponent(cleanTitle)}&language=pt-BR`;
        if (year) searchUrl += `&year=${year}`;
        
        const res = await fetch(searchUrl);
        const datÃ©
        
        if (datÃ©
            // Return first matÃ©
            const matÃ©
            return {
                description: matÃ©
                ratÃ©
                year: matÃ©
                backdrop: matÃ©
                genre_ids: matÃ©
            };
        }
    } catÃ©
        console.warn("TMDB Fetch Error:", e);
    }
    return null;
}


// Global Image Error Handler to try backups
window.handleImageError = function(img) {
    // Prevent infinite loop
    if (img.getatÃ©

    const originalSrc = img.getatÃ©
    // Salva o originalSrc na primeira FaÃ§a nÃ£o tiver
    if (!img.getatÃ©
        iMÃ¡xy\?quest=)/, '')); 
    }
    
    // Recalcula originalSrc liMÃ¡xies
    let cleanSrc = img.getatÃ©
    if (!cleanSrc || cleanSrc.startsWith('http') === FaÃ§ack

    const currentSrc = img.src;
    let nextSrc = '';

    // StratÃ©

    // 1. FaÃ§a CorsProxy
    if (currentSrc.includes('images.weserv.nl')) {
         console.warn('[IMÃ¡xy:', cleanSrc);
         nextSrc = `https://corsproxy.io/?${encodeURIComponent(cleanSrc)}`;
    }
    // 2. FaÃ§abs
    else if (currentSrc.includes('corsproxy.io')) {
        console.warn('[IMÃ¡xy FaÃ§anSrc);
        nextSrc = `https://api.codetabs.coMÃ¡xy?quest=${encodeURIComponent(cleanSrc)}`;
    }
    // 3. FaÃ§a Vercel
    else if (currentSrc.includes('api.codetabs.com')) {
        console.warn('[Image] CodeTabs FaÃ§anSrc);
        nextSrc = `https://klyx-api.vercel.app/api/proxy?url=${encodeURIComponent(cleanSrc)}`;
    }
    // 4. FaÃ§allOrigins
    else if (currentSrc.includes('klyx-api.vercel.app')) {
        console.warn('[Image] Vercel FaÃ§anSrc);
        nextSrc = `https://api.allorigins.win/raw?url=${encodeURIComponent(cleanSrc)}`;
    }
    // 5. FaÃ§aceholder
    else if (currentSrc.includes('api.allorigins.win')) {
         console.error('[IMÃ¡xies FaÃ§anSrc);
         iMÃ¡xt=No+Image';
         img.setatÃ©
         return;
    }
    // 6. FaÃ§a com Weserv
    else {
        console.warn('[IMÃ¡xy chain with Weserv:', cleanSrc);
        nextSrc = `https://images.weserv.nl/?url=${encodeURIComponent(cleanSrc)}&w=400&output=webp&q=80`;
    }

    iMÃ¡xtSrc;
};

// Helper for infinite scroll
function setupInfiniteScroll(items, container, creatÃ©
    const BatÃ©
    let currentIndex = 0;
    let isLoading = false;

    const loadNextBatÃ©
        if (currentIndex >= items.length) return;
        
        const batÃ©
        const fragment = document.creatÃ©
        
        batÃ©
            const card = creatÃ©
            fragment.appendChild(card);
        });
        
        container.appendChild(fragment);
        currentIndex += BatÃ©
        isLoading = false;
    };

    // Initial load
    loadNextBatÃ©

    // Scroll handler
    const onScroll = () => {
        if (isLoading) return;
        // Check if near bottom
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1000) {
            isLoading = true;
            loadNextBatÃ©
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
if (window.locatÃ©
    window.locatÃ©
}

export async function initLive() {
    window.locatÃ©
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
    } catÃ©
        console.warn("Cloud polling start error", e);
    }
    window.locatÃ©
}

export async function initDashboard() {
    console.log("Dashboard Initialized");
    const content = document.getElementById("dashboardContent");
    if (!content) return;

    content.innerHTML = '<div class="loading-spinner">Carregando...</div>';

    try {
        const res = await api.content.getHome();
        if (!res.ok) {
            throw new Error(res.datÃ©
        }

        let datÃ©
        if (!datÃ©
            try {
                const FaÃ§a/home.json').then(r => r.json());
                if (FaÃ§ails) {
                    datÃ©
                } else {
                    content.innerHTML = "<p>Nenhum conteÃºdo encontrado.</p>";
                    return;
                }
            } catÃ©
                content.innerHTML = "<p>Nenhum conteÃºdo encontrado.</p>";
                return;
            }
        }

        let html = '';
        
        // Helper to render a rail
        const renderRail = (title, items, type = 'movie') => {
            if (!items || items.length === 0) return '';
            const catÃ©
            return `
                <div class="section">
                    <div class="section-head">
                        <h2>${title}</h2>
                        ${type !== 'MÃ¡xed' ? `<a href="${catÃ©
                    </div>
                    <div class="rail">
                        ${items.map(item => {
                            const iteMÃ¡xed
                            // If MÃ¡xed and still unknown, default to movie, but try to guess
                            const finalType = (iteMÃ¡xed') ? 'movie' : itemType;
                            const isSeries = finalType === 'series';
                            const isLive = finalType === 'live';
                            let clickAction;
                            if (isLive) {
                                clickAction = `window.locatÃ©
                            } else if (isSeries) {
                                clickAction = `window.showSeriesModal('${item.id}')`;
                            } else {
                                clickAction = `window.showMovieModal('${item.id}')`;
                            }

                            return `
                            <div class="card focusable" datÃ©
                                 onclick="${clickAction}">
                                <iMÃ¡xiedImage(item.poster)}" alt="${item.title}" loading="lazy" draggable="false" 
                                     datÃ©
                                     onerror="window.handleImageError(this)">
                                <div class="card-body">
                                    <h3 class="card-title">${item.title}</h3>
                                    <div class="card-meta">
                                        <span class="badge">${finalType === 'movie' ? 'Filme' : 'SÃ©rie'} | ${item.genre || 'Geral'}</span>
                                    </div>
                                    ${iteMÃ¡x;"><div style="width: ${item.progress}%; height: 100%; background: #9333ea;"></div></div>` : ''}
                                </div>
                            </div>
                        `}).join('')}
                    </div>
                </div>
            `;
        };

        // 1. Fetch Continue WatÃ©
        try {
            const cwRes = await api.playback.getContinueWatÃ©
            if (cwRes.ok && cwRes.datÃ©
                // Fetch all content to matÃ©
                // OptimizatÃ©
                // Here we load lists from cache.
                const [moviesRes, seriesRes] = await Promise.all([
                    api.movies.list(),
                    api.content.getSeries()
                ]);
                
                const allMovies = moviesRes.ok ? moviesRes.datÃ©
                const allSeries = seriesRes.ok ? (seriesRes.datÃ©
                
                const cwItems = [];
                for (const item of cwRes.datÃ©
                    let media = null;
                    let mediatÃ©
                    
                    if (mediatÃ©
                    else if (mediatÃ©
                    
                    // FaÃ§acy items without type
                    if (!media) {
                        media = allMovies.find(m => m.id === item.id);
                        if (media) mediatÃ©
                        else {
                            media = allSeries.find(s => s.id === item.id);
                            if (media) mediatÃ©
                        }
                    }
                    
                    if (media) {
                        // Clone to avoid modifying original cache
                        const entry = { ...media, type: mediatÃ©
                        if (item.duratÃ©
                            entry.progress = MÃ¡x(0, (item.time / item.duratÃ©
                        }
                        cwItems.push(entry);
                    }
                }
                
                if (cwItems.length > 0) {
                    htMÃ¡xed");
                }
            }
        } catÃ©
            console.warn("FaÃ§atÃ©
        }

        html += renderRail("Top Filmes", datÃ©
        htMÃ¡xed");
        html += renderRail("Top SÃ©ries", datÃ©
        html += renderRail("Adicionados Recentemente", datÃ©
        html += renderRail("Filmes de Terror", datÃ©
        html += renderRail("ComÃ©dia", datÃ©
        html += renderRail("AÃ§Ã£o", datÃ©

        content.innerHTML = html;

        // Initialize drag-to-scroll on all rails
        const rails = content.querySelectorAll('.rail');
        rails.forEach(rail => setupDragScroll(rail));

    } catÃ©
        console.error("Dashboard error:", e);
        content.innerHTML = `<p style="color:red">Erro ao carregar dashboard: ${e.message}</p>`;
    }
}

// Helper to setup custom dropdown
function setupCustomDropdown(selectId, options, onSelect) {
    const originalSelect = document.getElementById(selectId);
    if (!originalSelect) return;

    const container = originalSelect.parentElement;
    
    // CreatÃ©
    const dropdown = document.creatÃ©
    dropdown.className = 'catÃ©
    
    const btn = document.creatÃ©
    btn.className = 'catÃ©
    btn.innerHTML = `
        <span class="selected-label">Todas as catÃ©
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">
            <polyline points="6 9 12 15 18 9"></polyline>
        </svg>
    `;
    
    const menu = document.creatÃ©
    menu.className = 'catÃ©
    
    // Add "All" option
    const addOption = (label, value) => {
        const item = document.creatÃ©
        item.className = 'catÃ©
        iteMÃ¡xtContent = label;
        item.datÃ©
        iteMÃ¡x = 0;
        
        item.onclick = () => {
            btn.querySelector('.selected-label').textContent = label;
            menu.classList.remove('active');
            onSelect(value);
            
            // UpdatÃ©
            menu.querySelectorAll('.catÃ©
            item.classList.add('selected');
        };
        
        // Add Enter key support
        item.onkeydown = (e) => {
            if (e.key === 'Enter') item.click();
        };

        menu.appendChild(item);
    };
    
    addOption("Todas as catÃ©
    options.forEach(opt => addOption(opt, opt));
    
    dropdown.appendChild(btn);
    dropdown.appendChild(menu);
    
    // Toggle menu
    btn.onclick = (e) => {
        e.stopPropagatÃ©
        const isActive = menu.classList.contains('active');
        // Close all other menus
        document.querySelectorAll('.catÃ©
        
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
    // ReMÃ¡xists
    const old = container.querySelector('.catÃ©
    if (old) old.remove();
    
    container.insertBefore(dropdown, originalSelect);
}

export async function initMovies() {
    console.log("Movies Initialized");
    ensureProfilePlacement();
    window.addEventListener("resize", ensureProfilePlacement);
    const container = document.getElementById("moviesGrid");
    const catÃ©
    const catÃ©
    const searchInput = document.getElementById("movieSearch");

    if (!container) return;

    container.innerHTML = '<div class="loading-spinner">Carregando filmes...</div>';

    try {
        const [moviesRes, catÃ©
            api.content.getMovies(),
            api.movies.catÃ©
        ]);

        if (!moviesRes.ok) throw new Error(moviesRes.datÃ©

        const allMovies = moviesRes.datÃ©
        
        if (allMovies.length === 0) {
            container.innerHTML = "<p>Nenhum filme encontrado.</p>";
            return;
        }

        // Render Function
        let currentCatÃ©
        let currentSearch = "";

        const render = () => {
            const filtered = allMovies.filter(m => {
                const matÃ©
                const matÃ©
                return matÃ©
            });
            
            container.innerHTML = "";
            if (filtered.length === 0) {
                container.innerHTML = "<p>Nenhum filme encontrado.</p>";
                return;
            }
            
            setupInfiniteScroll(filtered, container, (movie) => {
                return creatÃ©
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

        // CatÃ©
        if (catÃ©
            setupCustomDropdown(catÃ©
                currentCatÃ©
                render();
            });
        }

    } catÃ©
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
        if (!res.ok) throw new Error(res.datÃ©

        const allSeries = res.datÃ©

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
                return creatÃ©
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

    } catÃ©
        console.error("Error loading series:", e);
        container.innerHTML = `<p style="color:red">Erro: ${e.message}</p>`;
    }
}

// --- SHARED UI COMPONENTS ---

function creatÃ©
    const card = document.creatÃ©
    card.className = 'card focusable';
    card.tabIndex = 0;
    card.setatÃ©
    
    card.innerHTML = `
        <iMÃ¡xiedImage(posterUrl)}" alt="${title}" loading="lazy" draggable="false"
             datÃ©
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

// CreatÃ©
function creatÃ©
    const existing = document.getElementById('genericModal');
    if (existing) existing.remove();

    const modal = document.creatÃ©
    modal.id = 'genericModal';
    MÃ¡x-ui.css class
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
    const closeBtn = MÃ¡x-close-btn');
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
    const modal = creatÃ©
    
    try {
        const res = await api.movies.list();
        const movies = res.ok ? res.datÃ©
        const movie = movies.find(m => m.id === id);
        
        if (!movie) {
            MÃ¡x-modal-body').innerHTML = '<p>Filme nÃ£o encontrado.</p>';
            return;
        }
        
        // Fetch extra metadatÃ©
        let description = movie.description || '';
        let ratÃ©
        let year = movie.year || '';
        let backdrop = movie.backdrop || '';

        if (!description || description.length < 10) {
             const meta = await fetchMetadatÃ©
             if (meta) {
                 description = meta.description || description;
                 ratÃ©
                 year = meta.year || year;
                 backdrop = meta.backdrop || backdrop;
             } else {
                 description = "Sinopse indisponÃ­vel.";
             }
        }

        // 2. Render Full MÃ¡x-ui.css structure
        // We replace the inner content of netflix-modal-body
        const bodyContent = `
            <div class="netflix-hero">
                <iMÃ¡xiedImage(movie.poster)}" alt="${movie.title}">
                ${backdrop ? `<div style="position:absolute; top:0; left:0; width:100%; height:100%; background: linear-gradient(to bottoMÃ¡x:0; pointer-events:none;"></div>` : ''}
            </div>
            
            <div class="netflix-info-container">
                <h1>${movie.title}</h1>
                <div class="netflix-meta-row">
                    <span class="matÃ©
                    <span class="year">${year}</span>
                    <span class="age-badge">14</span>
                </div>
                
                <div class="netflix-actions-stack">
                    <div style="display: flex; gap: 10px;">
                        <button class="btn-play-lg" onclick="window.locatÃ©
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor"><polygon points="5 3 19 12 5 21 5 3"></polygon></svg>
                            Assistir
                        </button>
                        <button class="btn-secondary-lg" onclick="window.open('https://www.youtube.coMÃ¡x; align-items: center; gap: 1rem;">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                            Trailer
                        </button>
                    </div>
                </div>
                
                <p class="netflix-description">${description}</p>
            </div>
        `;
        
        // UpdatÃ©
        MÃ¡x-modal-body').innerHTML = bodyContent;
        
        // Apply backdrop if available to the hero section specifically or modal background?
        // netflix-ui.css doesn't seem to have a specific backdrop container for image, 
        // but we can add inline style to hero if we want.
        // For now, the poster is enough, or we can use the backdrop image as a background for the hero.
        if (backdrop) {
             const hero = MÃ¡x-hero');
             if (hero) {
                 hero.style.backgroundIMÃ¡xiedImage(backdrop)}')`;
                 hero.style.backgroundSize = 'cover';
                 hero.style.backgroundPosition = 'center';
             }
        }
        
    } catÃ©
        console.error("Error showing movie modal:", e);
        modal.remove();
    }
};

window.showSeriesModal = async (id) => {
    const modal = creatÃ©
    
    try {
        const res = await api.content.getSeriesEpisodes(id);
        if (!res.ok) throw new Error("Erro ao carregar episÃ³dios");
        
        const seriesDatÃ©
        // Try to fetch metadatÃ©
        if (!seriesDatÃ©
             const meta = await fetchMetadatÃ©
             if (meta) {
                 seriesDatÃ©
                 seriesDatÃ©
                 seriesDatÃ©
                 if (meta.backdrop) seriesDatÃ©
             }
        }
        
        const episodes = seriesDatÃ©
        
        // Group by season with DeduplicatÃ©
        const seasons = {};
        const seenEpisodes = new Set(); // Key: S{s}E{e}

        episodes.forEach(ep => {
            const s = parseInt(ep.season_number || ep.season || 1);
            const e = parseInt(ep.episode_number || ep.episode || 0);
            const key = `S${s}E${e}`;
            
            if (seenEpisodes.has(key)) return; // Skip duplicatÃ©
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
                <div style="MÃ¡x;">
                    <div style="display: flex; align-iteMÃ¡x;">
                        <h3 style="color:#e5e5e5; margin: 0;">Temporada ${s}</h3>
                        <button onclick="window.open('https://www.youtube.com/results?search_query=${encodeURIComponent(seriesDatÃ©
                                style="background: rgba(255,255,255,0.2); border: none; color: white; padding: 5px 10px; border-radius: 4px; cursor: pointer; font-size: 12px; display: flex; align-iteMÃ¡x;">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polygon points="23 7 16 12 23 17 23 7"></polygon><rect x="1" y="5" width="15" height="14" rx="2" ry="2"></rect></svg>
                            Trailer
                        </button>
                    </div>
                    <div style="display:flex; flex-direction:coluMÃ¡x;">
                        ${seasons[s].map(ep => `
                            <div class="focusable" tabindex="0" 
                                 style="padding: 15px 20px; display:flex; align-iteMÃ¡x; cursor:pointer; transition:background 0.2s;"
                                 onmouseover="this.style.background='rgba(255,255,255,0.1)'"
                                 onmouseout="this.style.background='transparent'"
                                 onclick="window.locatÃ©
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
                <iMÃ¡xiedImage(seriesDatÃ©
                ${seriesDatÃ©
            </div>
            
            <div class="netflix-info-container">
                <h1>${seriesDatÃ©
                <div class="netflix-meta-row">
                    <span class="matÃ©
                    <span class="year">${seriesDatÃ©
                    <span class="age-badge">14</span>
                </div>
                 <p class="netflix-description">${seriesDatÃ©
                 
                 <div style="MÃ¡x;">
                    ${seasonsHtml}
                 </div>
            </div>
        `;
        
        MÃ¡x-modal-body').innerHTML = bodyContent;

        if (seriesDatÃ©
             const hero = MÃ¡x-hero');
             if (hero) {
                 hero.style.backgroundIMÃ¡xiedImage(seriesDatÃ©
                 hero.style.backgroundSize = 'cover';
                 hero.style.backgroundPosition = 'center';
             }
        }

    } catÃ©
        console.error("Error showing series modal:", e);
        modal.remove();
    }
};





