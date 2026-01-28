
import { api } from "./api.js";

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
        const renderRail = (title, items) => {
            if (!items || items.length === 0) return '';
            return `
                <div class="category-row">
                    <h2 class="category-title">${title}</h2>
                    <div class="movie-row">
                        ${items.map(item => `
                            <div class="movie-card focusable" data-id="${item.id}" tabindex="0">
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

        html += renderRail("Top Filmes", data.rails.topMovies);
        html += renderRail("Top Séries", data.rails.topSeries);
        html += renderRail("Adicionados Recentemente", data.rails.recentMovies);
        html += renderRail("Filmes de Terror", data.rails.horrorMovies);
        html += renderRail("Comédia", data.rails.comedyMovies);
        html += renderRail("Ação", data.rails.actionMovies);

        content.innerHTML = html;

    } catch (e) {
        console.error("Dashboard error:", e);
        content.innerHTML = `<p style="color:red">Erro ao carregar dashboard: ${e.message}</p>`;
    }
}

export function createPosterCard({ title, posterUrl, metaLeft, metaRight, onClick }) {
    const card = document.createElement("div");
    card.className = "movie-card focusable";
    card.tabIndex = 0;
    
    const img = document.createElement("img");
    img.src = posterUrl;
    img.alt = title;
    img.loading = "lazy";
    
    const info = document.createElement("div");
    info.className = "movie-info";
    
    const h3 = document.createElement("h3");
    h3.textContent = title;
    
    const meta = document.createElement("div");
    meta.className = "meta";
    meta.innerHTML = `<span>${metaLeft}</span><span>${metaRight}</span>`;
    
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
