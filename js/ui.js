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
    if (url.includes('images.weserv.nl')) return url;
    // If local asset, return as is
    if (url.startsWith('./') || url.startsWith('/') || url.startsWith('assets/')) return url;
    
    // Proxy external URLs
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=400&output=webp&q=80`;
}

// Global Image Error Handler to try backups
window.handleImageError = function(img) {
    const originalSrc = img.getAttribute('data-original-src');
    if (!originalSrc) {
        img.src = 'https://via.placeholder.com/300x450?text=Error';
        return;
    }

    // If weserv failed, try corsproxy
    if (img.src.includes('images.weserv.nl')) {
        console.warn('Weserv failed, trying CorsProxy for image:', originalSrc);
        img.src = `https://corsproxy.io/?${encodeURIComponent(originalSrc)}`;
        return;
    }

    // If corsproxy failed (or was direct), try codetabs
    if (img.src.includes('corsproxy.io')) {
        console.warn('CorsProxy failed, trying CodeTabs for image:', originalSrc);
        img.src = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(originalSrc)}`;
        return;
    }

    // Final fallback
    img.onerror = null; // Prevent infinite loop
    img.src = 'https://via.placeholder.com/300x450?text=No+Image';
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
        try {
            const ad1 = document.createElement("ins");
            ad1.className = "adsbygoogle";
            ad1.style.display = "block";
            ad1.style.width = "100%";
            ad1.style.minHeight = "90px";
            ad1.setAttribute("data-ad-client","ca-pub-5929082469611228");
            ad1.setAttribute("data-ad-slot","1234567890");
            ad1.setAttribute("data-ad-format","auto");
            ad1.setAttribute("data-full-width-responsive","true");
            if (catalog) catalog.appendChild(ad1);
            (window.adsbygoogle=window.adsbygoogle||[]).push({});
            const ad2 = document.createElement("ins");
            ad2.className = "adsbygoogle";
            ad2.style.display = "block";
            ad2.style.width = "100%";
            ad2.style.minHeight = "90px";
            ad2.setAttribute("data-ad-client","ca-pub-5929082469611228");
            ad2.setAttribute("data-ad-slot","1234567890");
            ad2.setAttribute("data-ad-format","auto");
            ad2.setAttribute("data-full-width-responsive","true");
            if (catalog) catalog.appendChild(ad2);
            (window.adsbygoogle=window.adsbygoogle||[]).push({});
        } catch(e) {}

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

// Global Redirects for Modals (Fix for broken player)
window.showMovieModal = function(id) {
    console.log("Opening Movie:", id);
    window.location.href = `./player_v2.html?type=movie&id=${encodeURIComponent(id)}`;
};

window.showSeriesModal = function(id) {
    console.log("Opening Series:", id);
    // Redirect to player in series mode. Player will handle episode selection or default to S1E1.
    window.location.href = `./player_v2.html?type=series&id=${encodeURIComponent(id)}`;
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
