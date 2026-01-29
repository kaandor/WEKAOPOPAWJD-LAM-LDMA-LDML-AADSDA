
import { api } from "./api.js";

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
            return `
                <div class="category-row">
                    <h2 class="category-title">${title}</h2>
                    <div class="movie-row">
                        ${items.map(item => `
                            <div class="movie-card focusable" data-id="${item.id}" tabindex="0" 
                                 onclick="window.location.href='./player.html?type=${type}&id=${encodeURIComponent(item.id)}'">
                                <img src="${item.poster}" alt="${item.title}" loading="lazy">
                                <div class="movie-info">
                                    <h3>${item.title}</h3>
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            `;
        };

        html += renderRail("Top Filmes", data.rails.topMovies, "movie");
        html += renderRail("Top Séries", data.rails.topSeries, "series");
        html += renderRail("Adicionados Recentemente", data.rails.recentMovies, "movie");
        html += renderRail("Filmes de Terror", data.rails.horrorMovies, "movie");
        html += renderRail("Comédia", data.rails.comedyMovies, "movie");
        html += renderRail("Ação", data.rails.actionMovies, "movie");

        content.innerHTML = html;

    } catch (e) {
        console.error("Dashboard error:", e);
        content.innerHTML = `<p style="color:red">Erro ao carregar dashboard: ${e.message}</p>`;
    }
}

export async function initMovies() {
    console.log("Movies Initialized");
    const container = document.getElementById("moviesGrid");
    if (!container) return;

    container.innerHTML = '<div class="loading-spinner">Carregando filmes...</div>';

    try {
        const res = await api.content.getMovies();
        if (!res.ok) throw new Error(res.data?.error || "Erro ao carregar filmes");

        const movies = res.data.movies;
        if (!movies || movies.length === 0) {
            container.innerHTML = "<p>Nenhum filme encontrado.</p>";
            return;
        }

        container.innerHTML = "";
        movies.forEach(movie => {
            const card = createPosterCard({
                title: movie.title,
                posterUrl: movie.poster,
                metaLeft: movie.year,
                metaRight: movie.rating ? `★ ${movie.rating}` : "",
                onClick: () => {
                    window.location.href = `./player.html?type=movie&id=${encodeURIComponent(movie.id)}`;
                }
            });
            container.append(card);
        });

    } catch (e) {
        console.error("Movies error:", e);
        container.innerHTML = `<p style="color:red">Erro: ${e.message}</p>`;
    }
}

export async function initSeries() {
    console.log("Series Initialized");
    const container = document.getElementById("seriesGrid");
    if (!container) return;

    container.innerHTML = '<div class="loading-spinner">Carregando séries...</div>';

    try {
        const res = await api.content.getSeries();
        if (!res.ok) throw new Error(res.data?.error || "Erro ao carregar séries");

        const seriesList = res.data.series;
        if (!seriesList || seriesList.length === 0) {
            container.innerHTML = "<p>Nenhuma série encontrada.</p>";
            return;
        }

        container.innerHTML = "";
        seriesList.forEach(series => {
            const card = createPosterCard({
                title: series.title,
                posterUrl: series.poster,
                metaLeft: series.year,
                metaRight: series.rating ? `★ ${series.rating}` : "",
                onClick: () => {
                    window.location.href = `./player.html?type=series&id=${encodeURIComponent(series.id)}`;
                }
            });
            container.append(card);
        });

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
    img.src = posterUrl;
    img.alt = title;
    img.loading = "lazy";
    
    const info = document.createElement("div");
    info.className = "card-body";
    
    const h3 = document.createElement("h3");
    h3.className = "card-title";
    h3.textContent = title;
    
    const meta = document.createElement("div");
    meta.className = "card-meta";
    
    // Create badge style for meta
    const badge = document.createElement("span");
    badge.className = "badge";
    badge.textContent = `${metaLeft} | ${metaRight || 'Geral'}`;
    
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
