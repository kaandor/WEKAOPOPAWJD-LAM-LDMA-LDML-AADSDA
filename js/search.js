import { api } from "./api.js?v=20240130";
import { createPosterCard, createThumbCard } from "./ui.js";

function debounce(fn, waitMs) {
  let t;
  return (...args) => {
    if (t) window.clearTimeout(t);
    t = window.setTimeout(() => fn(...args), waitMs);
  };
}

export function initSearch() {
  const input = document.getElementById("searchInput");
  const filter = document.getElementById("searchType");
  const results = document.getElementById("searchResults");
  const status = document.getElementById("searchStatus");
  if (!input || !filter || !results || !status) return;

  async function run() {
    const q = String(input.value || "").trim();
    const type = String(filter.value || "all");

    if (!q) {
      status.textContent = "Type to search movies, series, and live channels.";
      results.innerHTML = "";
      return;
    }

    status.textContent = "Searching…";
    const res = await api.search.query(q);
    if (!res.ok) {
      status.textContent = res.data?.error || "Search failed";
      return;
    }

    const filtered = res.data.results.filter((r) => (type === "all" ? true : r.type === type));
    status.textContent = `${filtered.length} result(s)`;
    results.innerHTML = "";

    filtered.forEach((r) => {
      const card =
        r.type === "live"
          ? createThumbCard({
              title: r.title,
              thumbUrl: r.image_url,
              metaLeft: r.category || "Live",
              metaRight: "LIVE",
              onClick: () => (window.location.href = `./player.html?type=live&id=${encodeURIComponent(r.id)}`),
            })
          : createPosterCard({
              title: r.title,
              posterUrl: r.image_url,
              metaLeft: r.year ? String(r.year) : "",
              metaRight: r.rating ? `★ ${Number(r.rating).toFixed(1)}` : r.category || "",
              onClick: () => {
                if (r.type === "movie") window.location.href = `./player.html?type=movie&id=${encodeURIComponent(r.id)}`;
                else window.location.href = `./series.html?seriesId=${encodeURIComponent(r.id)}`;
              },
            });
      results.append(card);
    });
  }

  const debounced = debounce(run, 220);
  input.addEventListener("input", debounced);
  filter.addEventListener("change", run);
}

