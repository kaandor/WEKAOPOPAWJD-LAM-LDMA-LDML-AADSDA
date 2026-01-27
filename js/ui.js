import { api } from "./api.js";

const PAGE_LIMIT = 200;
let movieOffset = 0;
let seriesOffset = 0;
let liveOffset = 0;

let isLoadingMovies = false;
let isLoadingSeries = false;
let isLoadingLive = false;

function setupInfiniteScroll(containerId, hasMore, loadMoreCallback) {
  const container = document.getElementById(containerId);
  if (!container) return;

  const sentinelId = `${containerId}-sentinel`;
  const existingSentinel = document.getElementById(sentinelId);
  if (existingSentinel) {
    if (existingSentinel._observer) existingSentinel._observer.disconnect();
    existingSentinel.remove();
  }

  if (!hasMore) return;

  const sentinel = document.createElement("div");
  sentinel.id = sentinelId;
  sentinel.style.height = "80px";
  sentinel.style.width = "100%";
  sentinel.style.display = "flex";
  sentinel.style.alignItems = "center";
  sentinel.style.justifyContent = "center";
  sentinel.style.marginTop = "20px";
  sentinel.innerHTML = '<span class="spinner"></span><span style="margin-left: 10px; color: var(--text-muted);">Loading more...</span>';

  container.parentNode.append(sentinel);

  const observer = new IntersectionObserver((entries) => {
    if (entries[0].isIntersecting) {
      console.log(`[InfiniteScroll] Loading more for ${containerId}`);
      loadMoreCallback();
    }
  }, { rootMargin: "200px" });

  observer.observe(sentinel);
  sentinel._observer = observer;
}

function el(tag, className) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  return node;
}

function formatRating(rating) {
  if (rating === null || rating === undefined) return "";
  const n = Number(rating);
  return Number.isFinite(n) ? n.toFixed(1) : "";
}

function formatReleaseDate(dateStr, fallbackYear) {
  if (dateStr) {
    try {
      const d = new Date(dateStr);
      if (!isNaN(d.getTime())) {
        return d.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });
      }
    } catch (e) {
      // ignore
    }
  }
  return fallbackYear ? String(fallbackYear) : "";
}

export function createPosterCard({ title, posterUrl, metaLeft, metaRight, onClick, progress, watched }) {
  const card = el("div", "card");
  // Ensure card is relative for positioning
  card.style.position = "relative";

  const img = document.createElement("img");
  img.className = "poster";
  img.alt = title;
  img.loading = "lazy";
  
  const fallbackUrl = "./assets/logos/logo.svg";
  img.src = posterUrl || fallbackUrl;
  
  img.onerror = () => {
      if (img.src.includes(fallbackUrl)) return;
      img.src = fallbackUrl;
      img.style.objectFit = "contain";
      img.style.padding = "20px";
      img.style.background = "#000";
  };

  const body = el("div", "card-body");
  const t = el("div", "card-title");
  t.textContent = title;

  const meta = el("div", "card-meta");
  const left = el("span");
  
  if (watched) {
      const check = el("span", "badge");
      check.style.backgroundColor = "#22c55e"; // Green
      check.style.color = "#000";
      check.style.marginRight = "8px";
      check.textContent = "✔ Assistido";
      left.append(check);
  }
  
  left.append(document.createTextNode(metaLeft || ""));
  
  const right = el("span", "badge");
  right.textContent = metaRight || "";
  meta.append(left, right);

  body.append(t, meta);
  card.append(img);

  // Progress Bar (Only the line, no text)
  if (progress && progress > 0 && !watched) {
      const barContainer = el("div", "progress-container");
      // Position: Overlay at the bottom of the poster image
      // We insert it after the image. Using negative margin to pull it up.
       barContainer.style.cssText = `
           width: 100%;
           height: 4px;
           background: rgba(0,0,0,0.5);
           margin-top: -4px;
           position: relative;
           z-index: 10;
       `;
       
       const barFill = el("div", "progress-fill");
       barFill.style.cssText = `width: ${Math.min(100, Math.max(0, progress))}%; height: 100%; background: #a855f7;`; 
       
       barContainer.appendChild(barFill);
       card.append(barContainer);
  }

  card.append(body);

  if (onClick) {
      card.addEventListener("click", (e) => {
          onClick(e);
      });
  }
  return card;
}

export function createThumbCard({ title, thumbUrl, metaLeft, metaRight, onClick }) {
  const card = el("div", "card");
  const img = document.createElement("img");
  img.className = "thumb";
  img.alt = title;
  img.loading = "lazy";
  
  const fallbackUrl = "./assets/logos/logo.svg";
  img.src = thumbUrl || fallbackUrl;

  img.onerror = () => {
      if (img.src.includes(fallbackUrl)) return;
      img.src = fallbackUrl;
      img.style.objectFit = "contain";
      img.style.padding = "10px";
      img.style.background = "#000";
  };

  const body = el("div", "card-body");
  const t = el("div", "card-title");
  t.textContent = title;

  const meta = el("div", "card-meta");
  const left = el("span");
  left.textContent = metaLeft || "";
  const right = el("span", "badge");
  right.textContent = metaRight || "";
  meta.append(left, right);

  body.append(t, meta);
  card.append(img, body);

  if (onClick) card.addEventListener("click", onClick);
  return card;
}

function setText(id, value) {
  const n = document.getElementById(id);
  if (n) n.textContent = value;
}

function setHtml(id, value) {
  const n = document.getElementById(id);
  if (n) n.innerHTML = value;
}

function showError(containerId, message) {
  setHtml(
    containerId,
    `<div class="panel"><div style="font-weight:650">Something went wrong</div><div class="subtext" style="margin-top:6px">${escapeHtml(
      message,
    )}</div></div>`,
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function filterGrid(gridId, query) {
  const val = query.toLowerCase();
  const grid = document.getElementById(gridId);
  if (!grid) return;
  const items = grid.querySelectorAll(".card");
  items.forEach((card) => {
    const title = card.dataset.title || card.textContent.toLowerCase();
    if (title.includes(val)) {
      card.style.display = "";
    } else {
      card.style.display = "none";
    }
  });
}

export async function initDashboard() {
  // Check Subscription Status
  const session = api.session.read();
  if (session?.user && session.user.status !== 'active') {
      const root = document.getElementById("dashboardContent");
      if (root) {
          const isExpired = session.user.status === 'expired';
          const isPending = session.user.status === 'pending_activation';
          
          let msg = "Este conteúdo exige uma assinatura ativa.";
          let title = "🔒 Conteúdo Bloqueado";
          
          if (isExpired) {
              msg = "Renove para continuar assistindo";
              title = "Assinatura Expirada";
          } else if (isPending) {
              msg = "Ative pela primeira vez sua conta";
              title = "Bem-vindo ao Klyx";
          }
              
          root.innerHTML = `
            <div style="display: flex; flex-direction: column; align-items: center; justify-content: center; height: 60vh; text-align: center; color: #fff;">
                <h1 style="font-size: 2.5rem; margin-bottom: 20px;">${title}</h1>
                <p style="font-size: 1.2rem; margin-bottom: 30px; color: #ccc; text-transform: uppercase;">${msg}</p>
                <button onclick="window.showSubscriptionModal()" style="background: #e50914; color: white; border: none; padding: 15px 40px; font-size: 1.2rem; border-radius: 4px; cursor: pointer; font-weight: bold; text-transform: uppercase;">
                    Assine Já
                </button>
                ${session.user.expires_at ? `<p style="margin-top: 20px; color: #777;">Vencimento: ${new Date(session.user.expires_at).toLocaleDateString()}</p>` : ''}
            </div>
          `;
      }
      return;
  }

  // Define global modal helper
  if (!window.showSubscriptionModal) {
      window.showSubscriptionModal = () => {
        const modal = document.createElement('div');
        modal.style.cssText = "position:fixed;top:0;left:0;width:100%;height:100%;background:rgba(0,0,0,0.9);z-index:9999;display:flex;align-items:center;justify-content:center;backdrop-filter:blur(5px);";
        modal.innerHTML = `
            <div style="background:#1f1f1f;padding:40px;border-radius:12px;max-width:500px;width:90%;text-align:center;color:#fff;border:1px solid #333;box-shadow:0 10px 25px rgba(0,0,0,0.5);">
                <h2 style="margin-bottom:20px;color:#e50914;font-size:2rem;">Assine o Klyx Premium</h2>
                <p style="margin-bottom:30px;line-height:1.6;font-size:1.1rem;color:#ddd;">
                    Tenha acesso ilimitado a todo o catálogo de filmes, séries e canais ao vivo em Full HD.
                    <br><br>
                    <strong>Planos a partir de R$ 19,90/mês</strong>
                </p>
                <div style="background:#2a2a2a;padding:20px;border-radius:8px;margin-bottom:30px;text-align:left;">
                    <div style="margin-bottom:10px;">📱 <strong>WhatsApp:</strong> (11) 99999-9999</div>
                    <div>📧 <strong>Email:</strong> suporte@klyx.com</div>
                </div>
                <button onclick="this.closest('div').parentElement.remove()" style="background:#e50914;color:white;border:none;padding:12px 30px;border-radius:6px;cursor:pointer;font-weight:bold;font-size:1rem;transition:transform 0.2s;">Fechar</button>
            </div>
        `;
        document.body.appendChild(modal);
      };
  }

  const res = await api.catalog.home();
  
  if (!res.ok) {
    showError("dashboardContent", res.data?.error || "Failed to load catalog");
    return;
  }

  if (!res.data || !res.data.rails) {
      console.warn("[Dashboard] Rails missing in response", res);
      // Try to load fallback manually if API didn't
      try {
          const fallback = await fetch('./assets/data/home.json').then(r => r.json());
          if (fallback && fallback.rails) {
              res.data = fallback;
          } else {
              showError("dashboardContent", "Catálogo vazio ou inválido.");
              return;
          }
      } catch (e) {
          showError("dashboardContent", "Erro ao carregar catálogo.");
          return;
      }
  }

  const { rails } = res.data;
  const root = document.getElementById("dashboardContent");
  if (!root) return;

  root.innerHTML = "";

  if (rails.continueWatching && rails.continueWatching.length > 0) {
    root.append(
      renderSection({
        title: "Continue Assistindo",
        items: rails.continueWatching,
        itemType: "mixed",
        imageKey: "poster_url",
        onSelect: (item) => {
          const params = new URLSearchParams({
            type: item.content_type,
            id: item.id,
            title: item.title || "",
            poster: item.poster_url || "",
            // Add extra metadata for fast UI rendering
            category: item.category || "",
            seriesId: item.series_id || "",
            // Note: We don't pass stream/streamSub here as they might be stale in history.
            // The player will fetch fresh ones via API, but UI will load instantly.
          });
          
          if (item.content_type === "episode") {
             // For episodes, we try to pass season/episode info if available
             // (Note: api.js maps recent items, check if season/episode are preserved)
             if (item.season_number) params.set("season", item.season_number);
             if (item.episode_number) params.set("episode", item.episode_number);
             window.location.href = `./player.html?${params.toString()}`;
          } else {
             window.location.href = `./player.html?${params.toString()}`;
          }
        },
      }),
    );
  }

  root.append(
    renderSection({
      title: "Filmes em Destaque",
      items: rails.topMovies,
      itemType: "movie",
      imageKey: "poster_url",
      onSelect: (item) => (window.location.href = `./player.html?type=movie&id=${encodeURIComponent(item.id)}`),
    }),
  );

  if (rails.recentMovies && rails.recentMovies.length > 0) {
    root.append(
      renderSection({
        title: "Adicionados Recentemente",
        items: rails.recentMovies,
        itemType: "movie",
        imageKey: "poster_url",
        onSelect: (item) => (window.location.href = `./player.html?type=movie&id=${encodeURIComponent(item.id)}`),
      }),
    );
  }

  root.append(
    renderSection({
      title: "Séries em Destaque",
      items: rails.topSeries,
      itemType: "series",
      imageKey: "poster_url",
      onSelect: (item) => (window.location.href = `./series.html?seriesId=${encodeURIComponent(item.id)}`),
    }),
  );

  if (rails.nightMovies && rails.nightMovies.length > 0) {
    root.append(
      renderSection({
        title: "Assista à noite",
        items: rails.nightMovies,
        itemType: "movie",
        imageKey: "poster_url",
        onSelect: (item) => (window.location.href = `./player.html?type=movie&id=${encodeURIComponent(item.id)}`),
      }),
    );
  }

  if (rails.horrorMovies && rails.horrorMovies.length > 0) {
    root.append(
      renderSection({
        title: "Terror",
        items: rails.horrorMovies,
        itemType: "movie",
        imageKey: "poster_url",
        onSelect: (item) => (window.location.href = `./player.html?type=movie&id=${encodeURIComponent(item.id)}`),
      }),
    );
  }

  if (rails.comedyMovies && rails.comedyMovies.length > 0) {
    root.append(
      renderSection({
        title: "Comédias",
        items: rails.comedyMovies,
        itemType: "movie",
        imageKey: "poster_url",
        onSelect: (item) => (window.location.href = `./player.html?type=movie&id=${encodeURIComponent(item.id)}`),
      }),
    );
  }

  if (rails.actionMovies && rails.actionMovies.length > 0) {
    root.append(
      renderSection({
        title: "Ação",
        items: rails.actionMovies,
        itemType: "movie",
        imageKey: "poster_url",
        onSelect: (item) => (window.location.href = `./player.html?type=movie&id=${encodeURIComponent(item.id)}`),
      }),
    );
  }

  if (rails.adventureMovies && rails.adventureMovies.length > 0) {
    root.append(
      renderSection({
        title: "Aventura",
        items: rails.adventureMovies,
        itemType: "movie",
        imageKey: "poster_url",
        onSelect: (item) => (window.location.href = `./player.html?type=movie&id=${encodeURIComponent(item.id)}`),
      }),
    );
  }


}

function enableDragScroll(slider) {
  let isDown = false;
  let startX;
  let scrollLeft;
  let isDragging = false;
  let velX = 0;
  let lastX = 0;
  let momentumID;

  slider.addEventListener('mousedown', (e) => {
    isDown = true;
    isDragging = false;
    slider.classList.add('active');
    startX = e.pageX - slider.offsetLeft;
    scrollLeft = slider.scrollLeft;
    lastX = e.pageX;
    velX = 0;
    cancelAnimationFrame(momentumID);
    e.preventDefault();
  });

  const stopDrag = () => {
    isDown = false;
    slider.classList.remove('active');
    setTimeout(() => isDragging = false, 50);
    
    // Momentum
    const friction = 0.95;
    const step = () => {
      if (Math.abs(velX) < 0.5) return;
      slider.scrollLeft -= velX;
      velX *= friction;
      momentumID = requestAnimationFrame(step);
    };
    cancelAnimationFrame(momentumID);
    momentumID = requestAnimationFrame(step);
  };

  slider.addEventListener('mouseleave', stopDrag);
  slider.addEventListener('mouseup', stopDrag);

  slider.addEventListener('mousemove', (e) => {
    if (!isDown) return;
    e.preventDefault();
    const x = e.pageX - slider.offsetLeft;
    const walk = (x - startX) * 1.2; // Slightly reduced multiplier for smoother feel
    
    // Calculate velocity for momentum
    const pageX = e.pageX;
    velX = pageX - lastX;
    lastX = pageX;

    if (Math.abs(walk) > 5) isDragging = true;
    slider.scrollLeft = scrollLeft - walk;
  });

  // Capture clicks and prevent them if we were dragging
  slider.addEventListener('click', (e) => {
    if (isDragging) {
      e.preventDefault();
      e.stopPropagation();
    }
  }, true);
}

function renderSection({ title, items, itemType, imageKey, onSelect, useThumb }) {
  const section = el("section", "section");

  if (title) {
    const head = el("div", "section-head");
    const h2 = el("h2");
    h2.textContent = title;
    
    if (itemType !== "mixed") {
        const link = el("a");
        link.href = itemType === "movie" ? "./movies.html" : itemType === "series" ? "./series.html" : "./live-tv.html";
        link.textContent = "Ver mais";
        head.append(h2, link);
    } else {
        head.append(h2);
    }
    
    section.append(head);
  }
  
  const grid = el("div", "rail");
  enableDragScroll(grid);

  items.forEach((it) => {
    if (!it.title) return;

    const titleText = it.title;
    const category = it.category || "";
    const rating = it.subtitle ? it.subtitle : (it.rating ? `★ ${formatRating(it.rating)}` : category);
    const sub = itemType === 'movie' ? "" : formatReleaseDate(it.release_date, it.year);
    const imgUrl = it[imageKey] || "";

    const card = useThumb
      ? createThumbCard({
          title: titleText,
          thumbUrl: imgUrl,
          metaLeft: sub,
          metaRight: rating,
          onClick: () => onSelect(it),
        })
      : createPosterCard({
          title: titleText,
          posterUrl: imgUrl,
          metaLeft: sub,
          metaRight: rating,
          onClick: () => onSelect(it),
          progress: (it.position_seconds && it.duration_seconds) ? (it.position_seconds / it.duration_seconds) * 100 : 0,
          watched: it.position_seconds && it.duration_seconds && (it.position_seconds / it.duration_seconds > 0.9),
          type: itemType
        });

    grid.append(card);
  });

  section.append(grid);
  return section;
}

export async function initMovies() {
  const cats = await api.movies.categories();
  if (cats.ok) {
    const select = document.getElementById("movieCategory");
    if (select) {
      select.innerHTML = `<option value="">All categories</option>`;
      cats.data.categories.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.category;
        opt.textContent = `${c.category} (${c.count})`;
        select.append(opt);
      });
    }
  }

  // Load Catalog Rows
  await loadMoviesCatalog();

  await loadMovies();

  const select = document.getElementById("movieCategory");
  if (select) {
      select.addEventListener("change", () => loadMovies());
  }

  const search = document.getElementById("movieSearch");
  search?.addEventListener("input", () => filterGrid("moviesGrid", search.value));
}

async function loadMoviesCatalog() {
  const root = document.getElementById("moviesCatalog");
  if (!root) return;
  root.innerHTML = "";

  const rows = [
    { title: "4K UHD", like: "%Filmes | 4K%" },
    { title: "Crime", like: "%Filmes | Crime%" },
    { title: "Animação", like: "%Filmes | Animacao%" },
    { title: "Drama", like: "%Filmes | Drama%" },
    { title: "Família", like: "%Filmes | Família%" },
    { title: "Ficção Científica", like: "%Filmes | Ficcao%" },
    { title: "Guerra", like: "%Filmes | Guerra%" },
    { title: "Infantis", like: "%Filmes | Infantis%" },
    { title: "Nacionais", like: "%Filmes | Nacionais%" },
    { title: "Religiosos", like: "%Filmes | Religiosos%" },
    { title: "Romance", like: "%Filmes | Romance%" },
    { title: "Suspense", like: "%Filmes | Suspense%" },
  ];

  const promises = rows.map(async (row) => {
      const res = await api.movies.list(null, 20, 0, row.like);
      return { ...row, items: res.ok ? res.data.items : [] };
  });

  const results = await Promise.all(promises);

  results.forEach(row => {
      if (row.items.length > 0) {
          root.append(renderSection({
              title: row.title,
              items: row.items,
              itemType: "movie",
              imageKey: "poster_url",
              onSelect: (item) => {
                  const params = new URLSearchParams({
                      type: 'movie',
                      id: item.id,
                      title: item.title || "",
                      poster: item.poster_url || "",
                      stream: item.stream_url || "",
                      streamSub: item.stream_url_sub || "",
                      category: item.category || ""
                  });
                  window.location.href = `./player.html?${params.toString()}`;
              },
          }));
      }
  });
}

async function loadMovies(isLoadMore = false) {
  if (isLoadingMovies) return;

  const select = document.getElementById("movieCategory");
  const category = select ? select.value : "";
  
  // Toggle Catalog Visibility: Hide if category selected, Show if "All"
  const catalog = document.getElementById("moviesCatalog");
  if (catalog) {
      catalog.style.display = category ? "none" : "flex";
  }

  if (!isLoadMore) {
    movieOffset = 0;
  }

  isLoadingMovies = true;
  try {
    const res = await api.movies.list(category || null, PAGE_LIMIT, movieOffset);
    if (!res.ok) {
      showError("moviesGrid", res.data?.error || "Failed to load movies");
      return;
    }

    const grid = document.getElementById("moviesGrid");
    if (!grid) return;
    
    if (!isLoadMore) {
      grid.innerHTML = "";
    }

    // Check if empty and adult category
    if (category) {
       const c = category.toLowerCase();
       if ((c.includes("xxx") || c.includes("porn") || c.includes("adult") || c.includes("18+")) && res.data.items.length === 0) {
          grid.innerHTML = `
            <div style="width:100%; grid-column:1/-1; height:300px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:#fff;">
               <h2 style="margin-bottom:10px; font-size:1.5rem">Conteúdo Restrito</h2>
               <p style="color:#aaa; font-size:1.1rem">Entre em contato com o suporte para ativar o conteúdo.</p>
            </div>
          `;
          return;
       }
    }

    res.data.items.forEach((m) => {
      const card = createPosterCard({
        title: m.title,
        posterUrl: m.poster_url,
        metaLeft: "", 
        metaRight: `★ ${formatRating(m.rating)}`,
        onClick: () => {
            const params = new URLSearchParams({
                type: 'movie',
                id: m.id,
                title: m.title || "",
                poster: m.poster_url || "",
                stream: m.stream_url || "",
                streamSub: m.stream_url_sub || "",
                category: m.category || ""
            });
            window.location.href = `./player.html?${params.toString()}`;
        },
        progress: (m.position_seconds && m.duration_seconds) ? (m.position_seconds / m.duration_seconds) * 100 : 0,
        type: 'movie'
      });
      card.dataset.title = m.title.toLowerCase();
      grid.append(card);
    });
    
    movieOffset += res.data.items.length;
    setupInfiniteScroll("moviesGrid", res.data.items.length === PAGE_LIMIT, () => loadMovies(true));
  } finally {
    isLoadingMovies = false;
  }
}

export async function initSeries() {
  const cats = await api.series.categories();
  if (cats.ok) {
    const select = document.getElementById("seriesCategory");
    if (select) {
      select.innerHTML = `<option value="">Todas as categorias</option>`;
      cats.data.categories.forEach((c) => {
        const opt = document.createElement("option");
        opt.value = c.category;
        opt.textContent = `${c.category} (${c.count})`;
        select.append(opt);
      });
    }
  }

  const backBtn = document.getElementById("backToSeriesBtn");
  backBtn?.addEventListener("click", () => {
    document.getElementById("seriesDetailView").classList.add("hidden");
    document.getElementById("seriesListing").classList.remove("hidden");
    const url = new URL(window.location.href);
    url.searchParams.delete("seriesId");
    window.history.pushState({}, "", url.toString());
  });

  // Load Catalog Rows
  await loadSeriesCatalog();

  await loadSeries();

  const select = document.getElementById("seriesCategory");
  if (select) {
      console.log("[UI] Adding change listener to seriesCategory");
      select.addEventListener("change", () => {
          console.log("[UI] Series Category changed:", select.value);
          loadSeries();
      });
  }

  const search = document.getElementById("seriesSearch");
  search?.addEventListener("input", () => filterGrid("seriesGrid", search.value));

  const params = new URLSearchParams(window.location.search);
  const seriesId = params.get("seriesId");
  if (seriesId) {
    document.getElementById("seriesListing").classList.add("hidden");
    document.getElementById("seriesDetailView").classList.remove("hidden");
    await showSeriesDetails(seriesId);
  }
}

async function loadSeriesCatalog() {
  const root = document.getElementById("seriesCatalog");
  if (!root) return;
  root.innerHTML = "";

  const rows = [
    { title: "Netflix", like: "%Series | Netflix%" },
    { title: "HBO Max", like: "%Series | Max%" },
    { title: "Prime Video", like: "%Series | Amazon Prime Video%" },
    { title: "Disney+", like: "%Series | Disney+%" },
    { title: "Globoplay", like: "%Series | Globoplay%" },
    { title: "Apple TV+", like: "%Series | Apple%" },
    { title: "Animes", like: "%Series | Animes%" },
    { title: "Novelas", like: "%Series | Novelas%" },
    { title: "Documentários", like: "%Series | Documentarios%" },
  ];

  const promises = rows.map(async (row) => {
      const res = await api.series.list(null, 20, 0, row.like);
      return { ...row, items: res.ok ? res.data.items : [] };
  });

  const results = await Promise.all(promises);

  results.forEach(row => {
      if (row.items.length > 0) {
          root.append(renderSection({
              title: row.title,
              items: row.items,
              itemType: "series",
              imageKey: "poster_url",
              onSelect: (item) => (window.location.href = `./series.html?seriesId=${encodeURIComponent(item.id)}`),
          }));
      }
  });
}

async function loadSeries(isLoadMore = false) {
  if (isLoadingSeries) return;

  const select = document.getElementById("seriesCategory");
  const category = select ? select.value : "";

  // Toggle Catalog Visibility: Hide if category selected, Show if "All"
  const catalog = document.getElementById("seriesCatalog");
  if (catalog) {
      catalog.style.display = category ? "none" : "flex";
  }

  if (!isLoadMore) {
    seriesOffset = 0;
  }

  isLoadingSeries = true;
  try {
    const res = await api.series.list(category || null, PAGE_LIMIT, seriesOffset);
    if (!res.ok) {
      showError("seriesGrid", res.data?.error || "Failed to load series");
      return;
    }

    const grid = document.getElementById("seriesGrid");
    if (!grid) return;

    if (!isLoadMore) {
      grid.innerHTML = "";
    }

    // Check if empty and adult category
    if (category) {
       const c = category.toLowerCase();
       if ((c.includes("xxx") || c.includes("porn") || c.includes("adult") || c.includes("18+")) && res.data.items.length === 0) {
          grid.innerHTML = `
            <div style="width:100%; grid-column:1/-1; height:300px; display:flex; flex-direction:column; align-items:center; justify-content:center; text-align:center; color:#fff;">
               <h2 style="margin-bottom:10px; font-size:1.5rem">Conteúdo Restrito</h2>
               <p style="color:#aaa; font-size:1.1rem">Entre em contato com o suporte para ativar o conteúdo.</p>
            </div>
          `;
          return;
       }
    }

    res.data.items.forEach((s) => {
      const card = createPosterCard({
        title: s.title,
        posterUrl: s.poster_url,
        metaLeft: formatReleaseDate(s.release_date, s.year),
        metaRight: `★ ${formatRating(s.rating)}`,
        onClick: () => (window.location.href = `./series.html?seriesId=${encodeURIComponent(s.id)}`),
        progress: (s.position_seconds && s.duration_seconds) ? (s.position_seconds / s.duration_seconds) * 100 : 0,
        type: 'series'
      });
      card.dataset.title = s.title.toLowerCase();
      grid.append(card);
    });

    seriesOffset += res.data.items.length;
    setupInfiniteScroll("seriesGrid", res.data.items.length === PAGE_LIMIT, () => loadSeries(true));
  } finally {
    isLoadingSeries = false;
  }
}

async function showSeriesDetails(seriesId) {
  const res = await api.series.get(seriesId);
  if (!res.ok) {
    showError("seriesDetailView", "Failed to load series details");
    return;
  }
  const series = res.data.item;
  
  // Populate details
  const bg = document.querySelector(".series-backdrop");
  if (bg) bg.style.backgroundImage = `url('${series.backdrop_url || series.poster_url}')`;

  const poster = document.querySelector(".series-poster-large");
  if (poster) {
      const fallbackUrl = "./assets/logos/logo.svg";
      poster.src = fallbackUrl; // Show fallback immediately while loading
      
      // Load from cache/internet
      api.posters.get(series.title, series.poster_url, 'series').then(url => {
          if (url) poster.src = url;
          else poster.src = series.poster_url || fallbackUrl;
      });
  }

  setText("seriesTitle", series.title);
  setText("seriesMeta", `${series.year || ""} • ${series.category || ""} • ★ ${formatRating(series.rating)}`);
  setText("seriesPlot", series.plot || "No description available.");

  // Load episodes
  const epRes = await api.series.episodes(seriesId);
  const epList = document.getElementById("episodesList");
  if (epList) {
    epList.innerHTML = "";
    if (epRes.ok && epRes.data.items) {
      epRes.data.items.forEach((ep) => {
        const card = createThumbCard({
          title: ep.title || `Episode ${ep.episode_number || ""}`,
          thumbUrl: ep.backdrop_url || series.backdrop_url, // Fallback to series backdrop
          metaLeft: `T${ep.season_number || 1}:E${ep.episode_number || 1}`,
          metaRight: "",
          onClick: () => {
              const params = new URLSearchParams({
                  type: 'episode',
                  id: ep.id,
                  seriesId: seriesId,
                  title: ep.title || `Episode ${ep.episode_number || ""}`,
                  poster: s.poster_url || "",
                  stream: ep.stream_url || "",
                  streamSub: ep.stream_url_sub || "",
                  category: s.category || "",
                  season: ep.season_number || "",
                  episode: ep.episode_number || ""
              });
              window.location.href = `./player.html?${params.toString()}`;
          }
        });
        epList.append(card);
      });
    } else {
        epList.innerHTML = "<p>No episodes found.</p>";
    }
  }
}

export async function initLive() {
    const cats = await api.live.categories();
    if (cats.ok) {
      const select = document.getElementById("liveCategory");
      if (select) {
        select.innerHTML = `<option value="">All categories</option>`;
        cats.data.categories.forEach((c) => {
          const opt = document.createElement("option");
          opt.value = c.category;
          opt.textContent = `${c.category} (${c.count})`;
          select.append(opt);
        });
      }
    }
  
    await loadLive();
  
    const select = document.getElementById("liveCategory");
    select?.addEventListener("change", () => loadLive());
  
    const search = document.getElementById("liveSearch");
    search?.addEventListener("input", () => filterGrid("liveGrid", search.value));
}

async function loadLive(isLoadMore = false) {
    if (isLoadingLive) return;
    
    const select = document.getElementById("liveCategory");
    const category = select ? select.value : "";
  
    if (!isLoadMore) {
      liveOffset = 0;
    }
  
    isLoadingLive = true;
    try {
      const res = await api.live.list(category || null, PAGE_LIMIT, liveOffset);
      if (!res.ok) {
        showError("liveGrid", res.data?.error || "Failed to load channels");
        return;
      }
  
      const grid = document.getElementById("liveGrid");
      if (!grid) return;
  
      if (!isLoadMore) {
        grid.innerHTML = "";
      }
  
      res.data.items.forEach((c) => {
        const card = createPosterCard({
          title: c.title || c.name || "Sem Título",
          posterUrl: c.thumbnail_url || c.logo_url || c.poster_url,
          metaLeft: "",
          metaRight: "",
          onClick: () => {
              const params = new URLSearchParams({
                  type: 'live',
                  id: c.id,
                  title: c.title || c.name || "Sem Título",
                  poster: c.thumbnail_url || c.logo_url || c.poster_url || "",
                  stream: c.stream_url || "",
                  category: c.category || ""
              });
              window.location.href = `./player.html?${params.toString()}`;
          },
          type: 'live'
        });
        card.dataset.title = (c.title || c.name || "").toLowerCase();
        grid.append(card);
      });
      
      liveOffset += res.data.items.length;
      setupInfiniteScroll("liveGrid", res.data.items.length === PAGE_LIMIT, () => loadLive(true));
    } finally {
      isLoadingLive = false;
    }
}

export async function initSettings() {
  // --- Device Info Logic (Run FIRST, client-side only) ---
  console.log("Initializing Device Info...");
  const macEl = document.getElementById("deviceMac");
  const keyEl = document.getElementById("deviceKey");
  const planEl = document.getElementById("devicePlan");
  const statusEl = document.getElementById("subscriptionStatus");

  // Ensure MAC/Key exist (migration/generation)
  let storedMac = localStorage.getItem('klyx_device_mac');
  let storedKey = localStorage.getItem('klyx_device_key');
  console.log("Stored MAC:", storedMac, "Key:", storedKey ? "Found" : "Missing");

  if (!storedMac) {
      // Try legacy key
      const legacyMac = localStorage.getItem('device_mac');
      if (legacyMac) {
          storedMac = legacyMac;
          localStorage.setItem('klyx_device_mac', legacyMac);
      } else {
          // Generate new
          const hex = () => Math.floor(Math.random() * 256).toString(16).padStart(2, '0');
          storedMac = `${hex()}:${hex()}:${hex()}:${hex()}:${hex()}:${hex()}`;
          localStorage.setItem('klyx_device_mac', storedMac);
      }
  }

  if (!storedKey) {
       // Try legacy key
      const legacyKey = localStorage.getItem('device_key');
      if (legacyKey) {
          storedKey = legacyKey;
          localStorage.setItem('klyx_device_key', legacyKey);
      } else {
          // Generate new
          const chars = "ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789";
          storedKey = Array(12).fill(0).map(() => chars[Math.floor(Math.random() * chars.length)]).join("");
          localStorage.setItem('klyx_device_key', storedKey);
      }
  }

  if (macEl) macEl.textContent = storedMac;
  if (keyEl) keyEl.textContent = storedKey;

  // Poll device status (async)
  if (statusEl) {
       const pollDevice = async () => {
          // 1. Check User Session First (Email/Pass)
          if (api.users.sync) {
              const u = await api.users.sync();
              if (u && u.email) {
                   const expires = u.expires_at;
                   const dateStr = expires ? ` (Vence: ${new Date(expires).toLocaleDateString()})` : "";
                   statusEl.textContent = (u.status || "Ativo").toUpperCase() + dateStr;
                   statusEl.style.color = (u.status === 'active') ? "#4caf50" : "#f44336";
                   if (planEl) planEl.textContent = (u.plan || "Individual").toUpperCase() + " - " + u.email;
                   return; 
              }
          }

          try {
              // Try to check status, but don't block if API fails
              const dRes = await api.auth.checkDevice(storedMac, storedKey);
              if (dRes.ok && dRes.data) {
                  const d = dRes.data;
                  const expires = d.expires_at || d.subscription_expires_at;
                  const dateStr = expires ? ` (Vence: ${new Date(expires).toLocaleDateString()})` : "";
                  
                  statusEl.textContent = (d.status || (d.active ? "Ativo" : "Inativo")) + dateStr;
                  statusEl.style.color = (d.active || d.status === 'active') ? "#4caf50" : "#f44336";
                  if (planEl) planEl.textContent = (d.plan || "Padrão").toUpperCase();
              } else {
                  // If check fails (offline/API down), show fallback
                  statusEl.textContent = "Offline / Local";
                  statusEl.style.color = "#888";
              }
          } catch (e) {
              console.warn("Poll device failed", e);
              statusEl.textContent = "Offline / Local";
              statusEl.style.color = "#888";
          }
       };
       pollDevice();
       // Poll every 30s
       setInterval(pollDevice, 30000);
  }

  // --- User Settings Logic (Try fetch, but don't crash) ---
  try {
      const res = await api.users.me();
      if (!res.ok) {
        console.warn("Failed to load user settings from API, using defaults");
        // showError("settingsPanel", res.data?.error || "Failed to load settings"); 
        // Don't show error, just let it fail silently and use defaults
      } else {
          const settings = res.data.settings || {};
          const theme = document.getElementById("theme");
          const language = document.getElementById("language");
          const autoplay = document.getElementById("autoplayNext");

          if (theme) theme.value = settings.theme || "dark";
          if (language) language.value = settings.language || "en";
          if (autoplay) autoplay.checked = Boolean(settings.autoplay_next);
      }
  } catch(e) {
      console.warn("Settings init error:", e);
  }

  // Setup Event Listeners (Always setup, even if API failed)
  const theme = document.getElementById("theme");
  const language = document.getElementById("language");
  const autoplay = document.getElementById("autoplayNext");
  const save = document.getElementById("saveSettings");

  const saveSettings = async () => {
    const payload = {
      theme: theme?.value || "dark",
      language: language?.value || "en",
      autoplayNext: Boolean(autoplay?.checked),
    };
    try {
        const upd = await api.users.updateSettings(payload);
        if (upd.ok) {
          setText("settingsStatus", "Salvo.");
          setTimeout(() => setText("settingsStatus", ""), 2000);
        } else {
          setText("settingsStatus", "Salvo (Local)"); // Pretend success in offline mode
        }
    } catch(e) {
         setText("settingsStatus", "Salvo (Local)");
    }
  };

  if (theme) {
    theme.addEventListener("change", () => {
      document.documentElement.setAttribute("data-theme", theme.value === "light" ? "light" : "dark");
      saveSettings();
    });
  }
  if (language) {
    language.addEventListener("change", saveSettings);
  }
  if (autoplay) {
    autoplay.addEventListener("change", saveSettings);
  }
  if (save) {
    save.addEventListener("click", saveSettings);
  }
}
