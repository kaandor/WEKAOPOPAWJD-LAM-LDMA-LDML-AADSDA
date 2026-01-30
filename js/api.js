
const STORAGE_KEY = "klyx.session";
const FIREBASE_DB_URL = "https://klix-iptv-default-rtdb.firebaseio.com";

// Helper to simulate network delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// Mock Data Loaders
async function getLocalData(file) {
    try {
        const res = await fetch(`./assets/data/${file}`);
        if (!res.ok) return null;
        return await res.json();
    } catch (e) {
        console.error(`Failed to load ${file}`, e);
        return null;
    }
}

function readSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function writeSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("klyx_profile_id");
}

// Helper to normalize data structure (fix poster_url -> poster)
function normalize(item) {
    if (!item) return item;
    if (item.poster_url && !item.poster) item.poster = item.poster_url;
    return item;
}

export const api = {
  session: {
    read: readSession,
    write: writeSession,
    clear: clearSession,
  },
  status: {
    async checkConnection() {
        return true; // Always online for local demo
    }
  },
  auth: {
    async login({ email, password }) {
        // Mock login
        await delay(500);
        const user = { 
            id: "u1", 
            email, 
            name: "Demo User",
            subscription_status: "active",
            subscription_expires_at: new Date(Date.now() + 86400000 * 30).toISOString()
        };
        writeSession({ user, tokens: { accessToken: "mock", refreshToken: "mock" } });
        return { ok: true, data: { user } };
    },
    async me() {
        const session = readSession();
        if (!session?.user) return { ok: false };
        return { ok: true, data: { user: session.user } };
    },
    async checkDevice(mac, key) {
        return { ok: true, data: { active: true } };
    }
  },
  movies: {
    async get(id) {
        const data = await getLocalData("movies.json");
        let movie = data?.movies?.find(m => m.id === id);
        if (!movie) return { ok: false, data: { error: "Movie not found" } };
        
        movie = normalize(movie);

        // Ensure stream_url exists (fallback to sample if missing)
        if (!movie.stream_url) {
            movie.stream_url = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"; // Big Buck Bunny HLS
        }
        return { ok: true, data: { item: movie } };
    },
    async list() {
         const data = await getLocalData("movies.json");
         const rawMovies = (data?.movies || []).map(normalize);
         
         // Group by base title to merge Dubbed and Subtitled versions
         const moviesMap = new Map();
         
         rawMovies.forEach(movie => {
             const title = movie.title.trim();
             const isSubtitled = title.endsWith(" [L]") || title.toLowerCase().includes("(legendado)");
             const baseTitle = title.replace(" [L]", "").replace(/\(Legendado\)/i, "").trim();
             
             if (!moviesMap.has(baseTitle)) {
                 moviesMap.set(baseTitle, { dub: null, sub: null });
             }
             
             if (isSubtitled) {
                 moviesMap.get(baseTitle).sub = movie;
             } else {
                 moviesMap.get(baseTitle).dub = movie;
             }
         });

         const mergedMovies = [];
         
         moviesMap.forEach((versions, title) => {
             // Prefer Dubbed as main, attach Subtitled stream as option
             if (versions.dub) {
                 const mainMovie = versions.dub;
                 if (versions.sub) {
                     mainMovie.stream_url_subtitled_version = versions.sub.stream_url;
                 }
                 mergedMovies.push(mainMovie);
             } else if (versions.sub) {
                 // If only Subtitled exists, show it
                 mergedMovies.push(versions.sub);
             }
         });

         return { ok: true, data: mergedMovies };
    }
  },
  series: {
    async get(id) {
        const data = await getLocalData("series.json");
        let series = data?.series?.find(s => s.id === id);
        if (!series) return { ok: false, data: { error: "Series not found" } };
        series = normalize(series);
        return { ok: true, data: { item: series } };
    },
    async episodes(seriesId) {
        try {
            // Check if we have loaded all episodes yet
            if (!window.allEpisodesCache) {
                console.log("Loading all episodes chunks...");
                window.allEpisodesCache = [];
                let chunkIndex = 0;
                let loading = true;
                
                while (loading) {
                    try {
                        const response = await fetch(`assets/data/episodes/episodes_${chunkIndex}.json`);
                        if (!response.ok) {
                            loading = false;
                            break;
                        }
                        const data = await response.json();
                        window.allEpisodesCache = window.allEpisodesCache.concat(data.episodes);
                        chunkIndex++;
                    } catch (e) {
                        console.warn(`Stopped loading chunks at index ${chunkIndex}`, e);
                        loading = false;
                    }
                }
                console.log(`Loaded ${window.allEpisodesCache.length} episodes total.`);
            }

            // Filter from memory
            const episodes = window.allEpisodesCache.filter(ep => ep.series_id === seriesId);
            return { ok: true, data: { episodes } };

        } catch (error) {
            console.error("Failed to load episodes:", error);
            return { ok: false, error: "Failed to load episodes" };
        }
    },
  },
  live: {
      async get(id) {
          return { ok: false, data: { error: "Live TV not implemented in demo" } };
      }
  },
  playback: {
    async getProgress(id) {
        try {
            const progress = JSON.parse(localStorage.getItem("klyx.progress") || "{}");
            return { ok: true, data: { progress: progress[id] || 0 } };
        } catch (e) {
            return { ok: false, data: { progress: 0 } };
        }
    },
    async saveProgress(id, time, duration, type = 'movie') {
        try {
            const progress = JSON.parse(localStorage.getItem("klyx.progress") || "{}");
            progress[id] = {
                time,
                duration,
                timestamp: Date.now()
            };
            localStorage.setItem("klyx.progress", JSON.stringify(progress));
            
            // Also update "Continue Watching" list
            let continueWatching = JSON.parse(localStorage.getItem("klyx.continueWatching") || "[]");
            // Remove if exists
            continueWatching = continueWatching.filter(i => i.id !== id);
            // Add to top
            continueWatching.unshift({ id, time, duration, type, timestamp: Date.now() });
            // Limit to 20
            if (continueWatching.length > 20) continueWatching.pop();
            localStorage.setItem("klyx.continueWatching", JSON.stringify(continueWatching));
            
            return { ok: true };
        } catch (e) {
            return { ok: false };
        }
    },
    async removeProgress(id) {
        try {
            const progress = JSON.parse(localStorage.getItem("klyx.progress") || "{}");
            delete progress[id];
            localStorage.setItem("klyx.progress", JSON.stringify(progress));
            
            let continueWatching = JSON.parse(localStorage.getItem("klyx.continueWatching") || "[]");
            continueWatching = continueWatching.filter(i => i.id !== id);
            localStorage.setItem("klyx.continueWatching", JSON.stringify(continueWatching));
            return { ok: true };
        } catch (e) {
            return { ok: false };
        }
    },
    async getContinueWatching() {
        try {
            const list = JSON.parse(localStorage.getItem("klyx.continueWatching") || "[]");
            return { ok: true, data: list };
        } catch (e) {
            return { ok: true, data: [] };
        }
    }
  },
  content: {
    // Keep these for ui.js compatibility
    async getHome() { 
        const data = await getLocalData("home.json");
        if (data && data.rails) {
            for (const key in data.rails) {
                if (Array.isArray(data.rails[key])) {
                    data.rails[key] = data.rails[key].map(normalize);
                }
            }
        }
        return { ok: true, data }; 
    },
    async getMovies() { 
        // Use api.movies.list() to get deduplicated list
        const res = await api.movies.list();
        return { ok: res.ok, data: { movies: res.data } };
    },
    async getSeries() { 
        const data = await getLocalData("series.json");
        if (data && data.series) {
            data.series = data.series.map(normalize);
        }
        return { ok: true, data }; 
    }
  },
  profiles: {
      async list() {
          let profiles = [];
          try {
             profiles = JSON.parse(localStorage.getItem("klyx.profiles") || "[]");
          } catch(e) {}
          
          if (profiles.length === 0) {
              profiles = [{ id: "p1", name: "Perfil Demo", avatar: "" }];
              localStorage.setItem("klyx.profiles", JSON.stringify(profiles));
          }
          return { ok: true, data: profiles };
      },
      async create({ name }) {
          let profiles = JSON.parse(localStorage.getItem("klyx.profiles") || "[]");
          const newProfile = { id: "p" + Date.now(), name, avatar: "" };
          profiles.push(newProfile);
          localStorage.setItem("klyx.profiles", JSON.stringify(profiles));
          return { ok: true, data: newProfile };
      }
  }
};
