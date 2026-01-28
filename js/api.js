
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
        const movie = data?.movies?.find(m => m.id === id);
        if (!movie) return { ok: false, data: { error: "Movie not found" } };
        
        // Ensure stream_url exists (fallback to sample if missing)
        if (!movie.stream_url) {
            movie.stream_url = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"; // Big Buck Bunny HLS
        }
        return { ok: true, data: { item: movie } };
    },
    async list() {
         const data = await getLocalData("movies.json");
         return { ok: true, data: data?.movies || [] };
    }
  },
  series: {
    async get(id) {
        const data = await getLocalData("series.json");
        const series = data?.series?.find(s => s.id === id);
        if (!series) return { ok: false, data: { error: "Series not found" } };
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
  live: {
      async get(id) {
          return { ok: false, data: { error: "Live TV not implemented in demo" } };
      }
  },
  playback: {
    async getProgress() {
        return { ok: true, data: { progress: null } };
    },
    async saveProgress() {
        return { ok: true };
    },
    async removeProgress() {
        return { ok: true };
    }
  },
  content: {
    // Keep these for ui.js compatibility
    async getHome() { return { ok: true, data: await getLocalData("home.json") }; },
    async getMovies() { return { ok: true, data: await getLocalData("movies.json") }; },
    async getSeries() { return { ok: true, data: await getLocalData("series.json") }; }
  },
  profiles: {
      async list() {
          return { ok: true, data: [{ id: "p1", name: "Perfil Demo", avatar: "" }] };
      }
  }
};
