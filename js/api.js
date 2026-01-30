
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

// Helper to filter restricted content (Parental Control)
function filterRestrictedContent(items) {
    if (!items || !Array.isArray(items)) return [];
    
    // Check if Parental Control is active (default: true)
    const isActive = localStorage.getItem("klyx_parental_active") !== "false";
    if (!isActive) return items;
    
    // Expanded keywords list
    const restrictedKeywords = [
        "xxx", "adult", "porn", "sex", "+18", "18+", 
        "brazzers", "vivthomas", "hentai", "erotic",
        "[xxx]", "(xxx)", "uncensored", "sexo", "nude"
    ];
    
    return items.filter(item => {
        if (!item) return false;
        const title = (item.title || "").toLowerCase();
        const category = (item.category || "").toLowerCase();
        
        // Check title and category for keywords
        const isRestricted = restrictedKeywords.some(kw => 
            title.includes(kw) || category.includes(kw)
        );
        
        return !isRestricted;
    });
}

// Helper to deduplicate movies (merge Dub/Sub)
function deduplicateMovies(items) {
    if (!items || !Array.isArray(items)) return [];
    
    // Apply Parental Filter first
    items = filterRestrictedContent(items);
    
    const moviesMap = new Map();
    
    items.forEach(movie => {
        if (!movie || !movie.title) return;
        let title = movie.title.trim();
        
        // Normalize title for checking
        const lowerTitle = title.toLowerCase();
        
        // Check for various subtitle indicators
        const isSubtitled = 
            lowerTitle.endsWith(" [l]") || 
            lowerTitle.endsWith(" (l)") || 
            lowerTitle.includes("(legendado)") || 
            lowerTitle.includes("[legendado]") ||
            lowerTitle.includes(" legendado") ||
            lowerTitle.includes(" - legendado");

        // Clean the title to get the base version
        let baseTitle = title
            .replace(/ \[L\]$/i, "")
            .replace(/ \(L\)$/i, "")
            .replace(/\(Legendado\)/i, "")
            .replace(/\[Legendado\]/i, "")
            .replace(/ - Legendado/i, "")
            .replace(/ Legendado/i, "")
            .trim();
            
        // Also remove trailing dashes if any
        if (baseTitle.endsWith(" -")) baseTitle = baseTitle.substring(0, baseTitle.length - 2).trim();
        
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
                // Ensure we don't overwrite if it already exists (though unlikely)
                if (!mainMovie.stream_url_subtitled_version) {
                    mainMovie.stream_url_subtitled_version = versions.sub.stream_url;
                }
                // Merge categories
                if (versions.sub.category) {
                    const mainCats = mainMovie.category ? mainMovie.category.split(" | ") : [];
                    const subCats = versions.sub.category.split(" | ");
                    const combined = new Set([...mainCats, ...subCats]);
                    mainMovie.category = Array.from(combined).join(" | ");
                }
            }
            mergedMovies.push(mainMovie);
        } else if (versions.sub) {
            // If only Subtitled exists, show it but clean the title
            const subMovie = versions.sub;
            subMovie.title = title; // Use the map key (baseTitle)
            mergedMovies.push(subMovie);
        }
    });
    
    return mergedMovies;
}

// Blocklist of common disposable email domains
const DISPOSABLE_DOMAINS = [
    "yopmail.com", "mailinator.com", "guerrillamail.com", "sharklasers.com",
    "temp-mail.org", "10minutemail.com", "throwawaymail.com", "fakeinbox.com",
    "getairmail.com", "dispostable.com"
];

function validateEmail(email) {
    if (!email) return false;
    
    // Basic format validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) return false;
    
    // Check disposable domains
    const domain = email.split('@')[1].toLowerCase();
    if (DISPOSABLE_DOMAINS.includes(domain)) return false;
    
    return true;
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
        // Mock delay
        await delay(500);
        
        // 1. Check LocalStorage Users
        const users = JSON.parse(localStorage.getItem("klyx_users") || "[]");
        const user = users.find(u => u.email === email && u.password === password);
        
        if (user) {
            // Update last login
            user.last_login = new Date().toISOString();
            localStorage.setItem("klyx_users", JSON.stringify(users));
            
            // Sync Parental Control Preference
            if (user.settings && user.settings.parental_active !== undefined) {
                localStorage.setItem("klyx_parental_active", user.settings.parental_active.toString());
            } else {
                // Default to true for existing users without setting
                localStorage.setItem("klyx_parental_active", "true");
            }
            
            // Create session
            const sessionUser = { ...user };
            delete sessionUser.password; // Don't keep password in session
            writeSession({ user: sessionUser, tokens: { accessToken: "mock", refreshToken: "mock" } });
            return { ok: true, data: { user: sessionUser } };
        }

        // 2. Strict Login - No Demo Fallback
        
        return { ok: false, data: { error: "Credenciais inválidas" } };
    },
    async register({ name, email, password }) {
        await delay(500);
        
        if (!validateEmail(email)) {
             return { ok: false, data: { error: "E-mail inválido ou temporário não permitido." } };
        }
        
        const users = JSON.parse(localStorage.getItem("klyx_users") || "[]");
        
        if (users.find(u => u.email === email)) {
            return { ok: false, data: { error: "E-mail já cadastrado" } };
        }
        
        const newUser = {
            id: "u" + Date.now(),
            name,
            email,
            password, // In a real app, hash this!
            subscription_status: "active",
            subscription_expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
            created_at: new Date().toISOString(),
            settings: {
                parental_active: true // Default: Block adult content
            }
        };
        
        users.push(newUser);
        localStorage.setItem("klyx_users", JSON.stringify(users));
        
        // Create initial profile for the new user
        // Note: For a multi-user local app, we might want to isolate profiles per user,
        // but to keep it simple and compatible with existing profile-selection.js, 
        // we'll just ensure at least one profile exists.
        // We do NOT clear existing profiles here to avoid wiping other users' data on the same device,
        // unless we move to user-scoped profiles. For now, we append.
        let profiles = JSON.parse(localStorage.getItem("klyx.profiles") || "[]");
        const initialProfile = { id: "p" + Date.now(), name: name.split(' ')[0], avatar: "" };
        profiles.push(initialProfile);
        localStorage.setItem("klyx.profiles", JSON.stringify(profiles));
        
        // Auto-login
        delete newUser.password;
        const token = "klyx_" + Math.random().toString(36).substr(2) + Date.now().toString(36);
        writeSession({ user: newUser, tokens: { accessToken: token, refreshToken: token + "_refresh" } });
        
        // Enforce Parental Control locally
        localStorage.setItem("klyx_parental_active", "true");
        
        return { ok: true, data: { user: newUser } };
    },
    async logout() {
        clearSession();
        return { ok: true };
    },
    // Configuration for GitHub OAuth
    githubConfig: {
        clientId: localStorage.getItem("klyx_gh_client_id") || "Ov23li81yQjUN8E4lIAa",
        clientSecret: localStorage.getItem("klyx_gh_client_secret") || "0c94c675f7401941e807b3f924f0892412cff82d", // Only safe for demo/local apps
        redirectUri: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/index.html')
    },
    async setGithubKeys(clientId, clientSecret) {
        this.githubConfig.clientId = clientId;
        this.githubConfig.clientSecret = clientSecret;
        localStorage.setItem("klyx_gh_client_id", clientId);
        localStorage.setItem("klyx_gh_client_secret", clientSecret);
        console.log("GitHub Keys updated");
    },
    async loginWithGithub() {
        const clientId = this.githubConfig.clientId;
        if (!clientId) {
            return { ok: false, data: { error: "GitHub Client ID não configurado. Por favor configure as chaves." } };
        }
        
        // Generate state for security
        const state = Math.random().toString(36).substring(7);
        localStorage.setItem("klyx_gh_state", state);
        
        console.log("GitHub Auth Redirect URI:", this.githubConfig.redirectUri);

        // Redirect to GitHub
        const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(this.githubConfig.redirectUri)}&scope=user:email&state=${state}`;
        window.location.href = authUrl;
        
        // This promise will never resolve because of the redirect, which is expected
        return new Promise(() => {});
    },
    async handleGithubCallback(code, state) {
        const savedState = localStorage.getItem("klyx_gh_state");
        if (state !== savedState) {
            return { ok: false, data: { error: "Estado inválido (segurança)." } };
        }
        
        const clientId = this.githubConfig.clientId;
        const clientSecret = this.githubConfig.clientSecret;
        
        if (!clientSecret) {
             return { ok: false, data: { error: "GitHub Client Secret faltando." } };
        }
        
        try {
            // Exchange code for token via CORS proxy
            // GitHub requires POST. Direct calls fail CORS. We use a proxy chain.
            const tokenUrl = "https://github.com/login/oauth/access_token";
            
            
                // Proxies configuration
            // We prioritize GET requests with parameters in URL because many proxies handle GET better than POST
            const proxies = [
                {
                    name: "VercelAuth",
                    url: () => `https://klyx-api.vercel.app/api/token`,
                    method: "POST"
                },
                {
                    name: "CodeTabs",
                    url: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
                    method: "GET"
                },
                {
                    name: "AllOrigins",
                    url: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
                    method: "GET"
                },
                {
                    name: "CorsLoL",
                    url: (url) => `https://api.cors.lol/?url=${encodeURIComponent(url)}`,
                    method: "GET"
                },
                {
                    name: "ThingProxy",
                    url: (url) => `https://thingproxy.freeboard.io/fetch/${url}`,
                    method: "POST"
                }
            ];

            // Prepare parameters
            const params = new URLSearchParams();
            params.append("client_id", clientId);
            params.append("client_secret", clientSecret);
            params.append("code", code);
            params.append("redirect_uri", this.githubConfig.redirectUri);

            let data = null;
            let lastError = null;

            for (const proxy of proxies) {
                let fetchUrl;
                let fetchOptions;

                if (proxy.method === "GET") {
                    // For GET proxies, append params to GitHub URL, then encode
                    const fullGithubUrl = `${tokenUrl}?${params.toString()}`;
                    fetchUrl = proxy.url(fullGithubUrl);
                    fetchOptions = {
                        method: "GET",
                        headers: {
                            "Accept": "application/json"
                        }
                    };
                } else {
                    // For POST proxies
                    fetchUrl = proxy.url(tokenUrl);
                    fetchOptions = {
                        method: "POST",
                        headers: {
                            "Accept": "application/json",
                            "Content-Type": "application/x-www-form-urlencoded"
                        },
                        body: params.toString()
                    };
                }

                try {
                    console.log(`Trying proxy (${proxy.name}): ${fetchUrl}`);
                    
                    // Add timeout to prevent hanging
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s timeout
                    
                    const response = await fetch(fetchUrl, {
                        ...fetchOptions,
                        signal: controller.signal
                    });
                    clearTimeout(timeoutId);

                    if (!response.ok) {
                        const errText = await response.text().catch(() => response.statusText);
                        console.warn(`Proxy ${proxy.name} error ${response.status}: ${errText}`);
                        
                        // Special check for corsproxy.io 403 error (paywall)
                        if (response.status === 403 && fetchUrl.includes('corsproxy.io')) {
                             throw new Error(`CorsProxy Paywall: ${errText}`);
                        }

                        // If 401/403, it's likely a config error (revoked secret), not a proxy error.
                        // Stop trying other proxies if we got a response from GitHub.
                        if (response.status === 401 || response.status === 403) {
                             // Double check it's not a proxy error message in disguise
                             if (errText.includes('corsproxy') || errText.includes('proxy') || errText.includes('Forbidden')) {
                                 // Continue to next proxy
                                 throw new Error(`Proxy Blocked: ${errText}`);
                             }
                             throw new Error(`GitHub Error ${response.status}: ${errText}`);
                        }
                        throw new Error(`Proxy status: ${response.status}`);
                    }
                    
                    data = await response.json();
                    
                    // AllOrigins/CorsLoL sometimes wrap response
                    if (data.contents) {
                         // Sometimes contents is string, sometimes object
                         if (typeof data.contents === 'string') {
                             try { data = JSON.parse(data.contents); } catch(e) { console.error("Parse error", e); }
                         } else {
                             data = data.contents;
                         }
                    }

                    if (data && !data.error) break; // Success
                    if (data && data.error) throw new Error(`GitHub API Error: ${data.error_description || data.error}`);

                } catch (err) {
                    console.warn(`Proxy failed (${proxy.name}):`, err);
                    lastError = err;
                    if (err.message.includes("GitHub Error") && !err.message.includes("Proxy")) throw err;
                }
            }

            if (!data) {
                // If all proxies failed, show a more descriptive error
                console.error("All proxies failed. Last error:", lastError);
                return { ok: false, data: { error: `Falha na conexão (Proxies). Tente novamente. (${lastError?.message})` } };
            }
            
            if (data.error) {
                return { ok: false, data: { error: "Erro GitHub: " + data.error_description } };
            }
            
            const accessToken = data.access_token;
            
            // Fetch User Data
            const userRes = await fetch("https://api.github.com/user", {
                headers: { "Authorization": `token ${accessToken}` }
            });
            const ghUser = await userRes.json();
            
            // Create/Link User
            const users = JSON.parse(localStorage.getItem("klyx_users") || "[]");
            let user = users.find(u => u.github_id === ghUser.id || u.email === ghUser.email);
            
            if (!user) {
                user = {
                    id: "u" + Date.now(),
                    name: ghUser.name || ghUser.login,
                    email: ghUser.email || `${ghUser.login}@github.com`, // Fallback
                    github_id: ghUser.id,
                    avatar: ghUser.avatar_url,
                    subscription_status: "active",
                    subscription_expires_at: new Date(Date.now() + 86400000 * 30).toISOString(),
                    created_at: new Date().toISOString(),
                    settings: { parental_active: true }
                };
                users.push(user);
                localStorage.setItem("klyx_users", JSON.stringify(users));
            }
            
            // Login
            writeSession({ user, tokens: { accessToken, refreshToken: "gh-oauth" } });
            localStorage.setItem("klyx_parental_active", "true");
            
            return { ok: true, data: { user } };
            
        } catch (e) {
            console.error(e);
            return { ok: false, data: { error: `Falha na conexão com GitHub (${e.message}).` } };
        }
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
        // Use list() to ensure we get the deduplicated version with Audio 2
        const res = await api.movies.list();
        if (!res.ok) return { ok: false, data: { error: "Failed to load movies" } };
        
        let movie = res.data.find(m => m.id === id);
        if (!movie) return { ok: false, data: { error: "Movie not found" } };
        
        // Ensure stream_url exists (fallback to sample if missing)
        if (!movie.stream_url) {
            movie.stream_url = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"; // Big Buck Bunny HLS
        }
        return { ok: true, data: { item: movie } };
    },
    async list() {
         const data = await getLocalData("movies.json");
         const rawMovies = (data?.movies || []).map(normalize);
         return { ok: true, data: deduplicateMovies(rawMovies) };
    },
    async categories() {
        // Use deduplicated list to avoid duplicates in categories from subtitled versions if they differ
        const res = await api.movies.list();
        const movies = res.ok ? res.data : [];
        const categories = new Set();
        movies.forEach(m => {
            if (m.category) {
                // Split by " | " if exists, or just take the whole string
                const parts = m.category.split(" | ");
                parts.forEach(p => categories.add(p.trim()));
            }
        });
        return { ok: true, data: Array.from(categories).sort() };
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
    async categories() {
        const data = await getLocalData("series.json");
        let series = data?.series || [];
        
        // Apply Parental Filter so restricted categories don't show up
        series = filterRestrictedContent(series);
        
        const categories = new Set();
        series.forEach(s => {
            if (s.category) {
                const parts = s.category.split(" | ");
                parts.forEach(p => categories.add(p.trim()));
            }
        });
        return { ok: true, data: Array.from(categories).sort() };
    }
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
            const entry = progress[id];
            // Handle both legacy (number) and new (object) formats
            const time = (entry && typeof entry === 'object') ? entry.time : (entry || 0);
            return { ok: true, data: { progress: time } };
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
                    // 1. Normalize
                    let items = data.rails[key].map(normalize);
                    
                    // 2. FORCE FILTER explicitly (Safety check)
                    items = filterRestrictedContent(items);
                    
                    // 3. Deduplicate (which also filters, but we ensure it here)
                    data.rails[key] = deduplicateMovies(items);
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
            // Apply Parental Filter to Series List
            let series = filterRestrictedContent(data.series);
            data.series = series.map(normalize);
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
