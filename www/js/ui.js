import { api } from "./api.js?v=20260211-fix7";

// Inicia o polling da nuvem em silêncio (sem UI)
if (api.session.read()?.user) {
    api.cloud.startPolling();
}

export function applyGlobalTheme() {
    try {
        if (api.settings && typeof api.settings.get === 'function') {
            const prefs = api.settings.get();
            applyTheme(prefs.theme);
        } else {
            console.warn("api.settings not available yet");
        }
    } catch (e) { console.warn("Theme apply error", e); }
}

applyGlobalTheme();
    if (window.location.pathname.includes("profile-selection.html")) {
        window.location.reload();
    }
});

// THEME
export function applyGlobalTheme() {
    try {
        if (api.settings && typeof api.settings.get === 'function') {
            const prefs = api.settings.get();
            applyTheme(prefs.theme);
        } else {
            console.warn("api.settings not available yet");
        }
    } catch (e) { console.warn("Theme apply error", e); }
}
applyGlobalTheme();

// Helpers...
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
        const walk = (x - startX) * 2;
        slider.scrollLeft = scrollLeft - walk;
    });
}

function getProxiedImage(url) {
    if (!url) return 'https://via.placeholder.com/300x450?text=No+Image';
    if (url.includes('images.weserv.nl')) return url;
    if (url.startsWith('./') || url.startsWith('/') || url.startsWith('assets/')) return url;
    return `https://images.weserv.nl/?url=${encodeURIComponent(url)}&w=400&output=webp&q=80`;
}

window.handleImageError = function(img) {
    const originalSrc = img.getAttribute('data-original-src');
    if (!originalSrc) {
        img.src = 'https://via.placeholder.com/300x450?text=Error';
        return;
    }
    if (img.src.includes('images.weserv.nl')) {
        console.warn('Weserv failed, trying CorsProxy for image:', originalSrc);
        img.src = `https://corsproxy.io/?${encodeURIComponent(originalSrc)}`;
        return;
    }
    if (img.src.includes('corsproxy.io')) {
        console.warn('CorsProxy failed, trying CodeTabs for image:', originalSrc);
        img.src = `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(originalSrc)}`;
        return;
    }
    img.onerror = null;
    img.src = 'https://via.placeholder.com/300x450?text=No+Image';
};

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

    loadNextBatch();

    const onScroll = () => {
        if (isLoading) return;
        if ((window.innerHeight + window.scrollY) >= document.body.offsetHeight - 1000) {
            isLoading = true;
            loadNextBatch();
        }
    };

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

// Redireciona qualquer acesso direto a live-tv para dashboard
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
                            const itemType = item.type || type;
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

        // Continue Assistindo, rails, etc (igual versão nova)
        // (resto do arquivo pode ficar exatamente como no klyx_web_export)

    } catch (e) {
        console.error("Dashboard error:", e);
        content.innerHTML = `<p style="color:red">Erro ao carregar dashboard: ${e.message}</p>`;
    }
}
