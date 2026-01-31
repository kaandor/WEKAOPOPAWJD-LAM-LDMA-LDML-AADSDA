import { api } from "./api.js?v=20260130";

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
                                : `window.location.href='./player.html?type=${finalType}&id=${encodeURIComponent(item.id)}'`;

                            return `
                            <div class="card focusable" data-id="${item.id}" tabindex="0" 
                                 onclick="${clickAction}">
                                <img class="poster" src="${getProxiedImage(item.poster)}" alt="${item.title}" loading="lazy" onerror="this.onerror=null; this.src='https://via.placeholder.com/300x450?text=Error';">
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

export async function initMovies() {
    console.log("Movies Initialized");
    const container = document.getElementById("moviesGrid");
    const categorySelect = document.getElementById("movieCategory"); // Updated ID
    const searchInput = document.getElementById("movieSearch"); // Updated ID if needed, but usually movieSearch

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

        // Populate Categories
        if (categorySelect && catsRes.ok) {
            // Keep first option (All)
            const first = categorySelect.firstElementChild;
            categorySelect.innerHTML = '';
            if (first) categorySelect.appendChild(first);

            catsRes.data.forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat;
                opt.textContent = cat;
                categorySelect.appendChild(opt);
            });
        }

        const render = () => {
            const cat = categorySelect ? categorySelect.value : "";
            const query = searchInput ? searchInput.value.toLowerCase() : "";
            
            const filtered = allMovies.filter(m => {
                const matchesCat = !cat || (m.category && m.category.includes(cat));
                const matchesSearch = !query || m.title.toLowerCase().includes(query);
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
                    metaLeft: "", // Year removed as requested
                    metaRight: movie.rating ? `★ ${movie.rating}` : "",
                    onClick: () => {
                        window.location.href = `./player.html?type=movie&id=${encodeURIComponent(movie.id)}`;
                    }
                });
            });
        };

        // Event Listeners
        if (categorySelect) categorySelect.onchange = render;
        if (searchInput) searchInput.oninput = render;

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
    const categorySelect = document.getElementById("seriesCategory");
    const searchInput = document.getElementById("seriesSearch");

    if (!container) return;

    container.innerHTML = '<div class="loading-spinner">Carregando séries...</div>';

    try {
        const [seriesRes, catsRes] = await Promise.all([
            api.content.getSeries(),
            api.series.categories()
        ]);

        if (!seriesRes.ok) throw new Error(seriesRes.data?.error || "Erro ao carregar séries");

        let allSeries = seriesRes.data.series || [];

        // Populate Categories
        if (categorySelect && catsRes.ok) {
             // Keep first option (All)
             const first = categorySelect.firstElementChild;
             categorySelect.innerHTML = '';
             if (first) categorySelect.appendChild(first);

            catsRes.data.forEach(cat => {
                const opt = document.createElement("option");
                opt.value = cat;
                opt.textContent = cat;
                categorySelect.appendChild(opt);
            });
        }

        const render = () => {
            const cat = categorySelect ? categorySelect.value : "";
            const query = searchInput ? searchInput.value.toLowerCase() : "";
            
            const filtered = allSeries.filter(s => {
                const matchesCat = !cat || (s.category && s.category.includes(cat));
                const matchesSearch = !query || s.title.toLowerCase().includes(query);
                return matchesCat && matchesSearch;
            });
            
            container.innerHTML = "";
            if (filtered.length === 0) {
                container.innerHTML = "<p>Nenhuma série encontrada.</p>";
                return;
            }
            
            setupInfiniteScroll(filtered, container, (series) => {
                return createPosterCard({
                    title: series.title,
                    posterUrl: series.poster,
                    metaLeft: "", // Year removed as requested
                    metaRight: series.rating ? `★ ${series.rating}` : "",
                    onClick: () => {
                        window.showSeriesModal(series.id);
                    }
                });
            });
        };

        // Event Listeners
        if (categorySelect) categorySelect.onchange = render;
        if (searchInput) searchInput.oninput = render;

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
        card.addEventListener("click", onClick);
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

export async function initSettings() {
    console.log("Settings Initialized");
    
    // --- Parental Control Logic ---
    const adultToggle = document.getElementById("adultContentToggle");
    if (adultToggle) {
        // Load initial state
        const isEnabled = localStorage.getItem("klyx_adult_content_enabled") === "true";
        adultToggle.checked = isEnabled;
        
        // Handle change
        adultToggle.onchange = (e) => {
            if (adultToggle.checked) {
                // User trying to ENABLE
                const pin = prompt("Digite o PIN para ativar o Conteúdo Adulto (Padrão: 0000):");
                if (pin === "0000") {
                    localStorage.setItem("klyx_adult_content_enabled", "true");
                    alert("Conteúdo Adulto Ativado!");
                } else {
                    alert("PIN Incorreto!");
                    adultToggle.checked = false; // Revert
                }
            } else {
                // User trying to DISABLE (Always allowed)
                localStorage.setItem("klyx_adult_content_enabled", "false");
            }
        };
    }

    // Settings Saving Mock
    const saveBtn = document.getElementById("saveSettings");
    if (saveBtn) {
        saveBtn.onclick = () => {
            const saveStatus = document.getElementById("settingsStatus");
            if (saveStatus) {
                saveStatus.textContent = "Salvo!";
                setTimeout(() => saveStatus.textContent = "", 2000);
            }
            // Reload page to apply changes (simplest way to refresh api.js filters)
            setTimeout(() => window.location.reload(), 500);
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
    // 1. Create Backdrop
    const backdrop = document.createElement('div');
    backdrop.className = 'modal-backdrop active'; 
    
    // 2. Create Modal Structure
    backdrop.innerHTML = `
        <div class="series-modal">
            <div class="series-modal-header">
                <h2 class="series-modal-title">Carregando...</h2>
                <button class="close-modal-btn">&times;</button>
            </div>
            <div class="series-modal-body">
                <div style="display:flex; justify-content:center; padding: 40px;">
                    <div class="loading-spinner"></div>
                </div>
            </div>
        </div>
    `;
    
    document.body.appendChild(backdrop);
    
    const closeBtn = backdrop.querySelector('.close-modal-btn');
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
        const titleEl = backdrop.querySelector('.series-modal-title');
        const bodyEl = backdrop.querySelector('.series-modal-body');
        
        titleEl.textContent = series.title;
        
        // Render Body
        bodyEl.innerHTML = `
            <div class="series-info">
                <img class="series-poster" src="${getProxiedImage(series.poster)}" alt="${series.title}" onerror="this.src='https://via.placeholder.com/200x300?text=No+Poster'">
                <div class="series-details">
                    <div style="display:flex; gap:10px; align-items:center; flex-wrap:wrap; margin-bottom: 10px;">
                        <span class="badge">Série</span>
                        <span class="badge">★ ${series.rating || 'N/A'}</span>
                        <span style="color:var(--muted)">${series.genre || ''}</span>
                    </div>
                    <div class="series-desc">${series.description || 'Sem descrição.'}</div>
                </div>
            </div>
            
            <div class="season-selector">
                ${seasonNumbers.map((s, i) => `
                    <button class="season-tab ${i === 0 ? 'active' : ''}" data-season="${s}">
                        Temporada ${s}
                    </button>
                `).join('')}
            </div>
            
            <div class="episodes-list">
                <!-- Episodes will be injected here -->
            </div>
        `;
        
        const listEl = bodyEl.querySelector('.episodes-list');
        const tabs = bodyEl.querySelectorAll('.season-tab');
        const seasonSelector = bodyEl.querySelector('.season-selector');

        // Enable Drag-to-Scroll for Season Selector
        if (seasonSelector) setupDragScroll(seasonSelector);
        
        const renderEpisodes = (season) => {
            const seasonEps = seasons[season] || [];
            if (seasonEps.length === 0) {
                listEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted)">Nenhum episódio encontrado.</div>';
                return;
            }
            
            listEl.innerHTML = seasonEps.map(ep => `
                <div class="episode-item" onclick="window.location.href='./player.html?type=series&id=${encodeURIComponent(series.id)}&s=${ep.season_number}&e=${ep.episode_number}'">
                    <div class="episode-number">${ep.episode_number}</div>
                    <div class="episode-info">
                        <span class="episode-title">${ep.title || `Episódio ${ep.episode_number}`}</span>
                        <span class="episode-meta">${ep.duration ? Math.round(ep.duration / 60) + ' min' : ''}</span>
                    </div>
                    <div class="play-icon">▶</div>
                </div>
            `).join('');
        };
        
        // Initial Render (First Season)
        if (seasonNumbers.length > 0) {
            renderEpisodes(seasonNumbers[0]);
        } else {
            listEl.innerHTML = '<div style="padding:20px; text-align:center; color:var(--muted)">Nenhum episódio disponível.</div>';
        }
        
        // Tab Switching
        tabs.forEach(tab => {
            tab.onclick = () => {
                tabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                renderEpisodes(tab.dataset.season);
            };
        });
        
    } catch (e) {
        console.error(e);
        backdrop.querySelector('.series-modal-body').innerHTML = `
            <div style="padding: 20px; color: #ff4444; text-align: center;">
                Erro ao carregar detalhes: ${e.message}
            </div>
        `;
    }
};
