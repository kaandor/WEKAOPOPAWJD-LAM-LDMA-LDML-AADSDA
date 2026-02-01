
const STORAGE_KEY = "klyx.session";
const FIREBASE_DB_URL = "https://klix-iptv-default-rtdb.firebaseio.com";

// Helper to simulate network delay
const delay = (ms) => new Promise(resolve => setTimeout(resolve, ms));

// --- EMERGENCY KILL SWITCH FOR BUGGED ACCOUNTS ---
// Detects specific bugged MAC address or corrupted state and forces a wipe
try {
    const buggedMac = "32:b6:78:63:78:8d";
    const currentMac = localStorage.getItem("klyx_device_mac");
    if (currentMac === buggedMac) {
        console.warn("⚠️ DETECTED BUGGED DEVICE IDENTITY. INITIATING EMERGENCY WIPE.");
        localStorage.clear(); // NUKE EVERYTHING
        sessionStorage.clear();
        window.location.reload(); // Reload to start fresh
    }
} catch (e) {
    console.error("Kill switch error", e);
}
// ------------------------------------------------

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
    
    // Check Content Rating Limit (set by profile)
    // NEW SIMPLIFIED LOGIC: Adult Content Toggle (Boolean)
    const isAdultEnabled = localStorage.getItem("klyx_adult_content_enabled") === "true";
    
    // Keywords for rating classification
    // Explicit Adult Content (Requires specific permission + PIN)
    // Using Regex for word boundaries to avoid false positives (e.g. "Essex" matching "sex")
    const keywordsExplicit = [
        /\bxxx\b/, /\bporn\b/, /\bporno\b/, /\bhentai\b/, /\badultos\b/, /\badults\b/, /\badult\b/, 
        /\berotic\b/, /\bnude\b/, /\bsexo\b/, /\bsex\b/, /18\+\s*explicit/, /\bhardcore\b/, 
        /\bplayboy\b/, /\berotico\b/, /\berótica\b/, /\berotica\b/, /\bsexul\b/
    ];
    
    // Standard 18+ Content (Horror, Thriller, Strong Violence)
    const keywords18 = [
        /\+18/, /18\+/, /\bhorror\b/, /\bterror\b/, /\bhot\b/, /\bviolencia\s*extrema\b/, 
        /\bgore\b/, /\bthriller\b/, /\bsuspense\s*pesado\b/, /\bmorte\b/
    ];
    
    return items.filter(item => {
        if (!item) return false;
        const title = (item.title || "").toLowerCase();
        const category = (item.category || "").toLowerCase();
        const combined = title + " " + category;
        
        // Check for Adult Content (Explicit or 18+)
        const isAdult = keywordsExplicit.some(pattern => pattern.test(combined)) || 
                        keywords18.some(pattern => pattern.test(combined));
        
        // If Adult Content is NOT enabled, hide it
        if (isAdult && !isAdultEnabled) {
            return false;
        }
        
        // Otherwise show everything (Simpler logic as requested)
        return true;
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
        
        // Enrich Category for Smart Categorization (Kids/Criança)
        // This ensures "Criança" appears in the category dropdown if the movie matches safe keywords
        const keywordsSafe = ["animacao", "animation", "desenho", "infantil", "kids", "crianca", "criança", "livre", "disney", "pixar", "fantasia", "fantasy", "familia", "family"];
        const combinedForCat = (title + " " + (movie.category || "")).toLowerCase();
        if (keywordsSafe.some(kw => combinedForCat.includes(kw))) {
             if (movie.category && !movie.category.includes("Criança")) {
                 movie.category += " | Criança";
             }
        }
        
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
  cloud: {
    // Configuration
    GIST_FILENAME: "klyx_user_data_v1.json",
    GIST_DESCRIPTION: "Klyx App User Data - Do not delete",
    _syncTimer: null,

    // Helper: Get GitHub Token
    _getToken() {
        const session = readSession();
        return session?.tokens?.accessToken;
    },

    // 1. Find existing Gist
    async _findGist(token) {
        try {
            const res = await fetch("https://api.github.com/gists", {
                headers: { "Authorization": `token ${token}` }
            });
            if (!res.ok) return null;
            const gists = await res.json();
            return gists.find(g => g.files && g.files[this.GIST_FILENAME]);
        } catch (e) {
            console.error("Gist Find Error", e);
            return null;
        }
    },

    // 2. Create new Gist
    async _createGist(token, data) {
        try {
            const res = await fetch("https://api.github.com/gists", {
                method: "POST",
                headers: { 
                    "Authorization": `token ${token}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    description: this.GIST_DESCRIPTION,
                    public: false,
                    files: {
                        [this.GIST_FILENAME]: {
                            content: JSON.stringify(data, null, 2)
                        }
                    }
                })
            });
            return await res.json();
        } catch (e) {
            console.error("Gist Create Error", e);
            return null;
        }
    },

    // 3. Update existing Gist -> NOW REPLACED WITH REPO DB WRITE
    async _updateGist(token, gistId, data) {
        // Fallback or Migration
        console.warn("Using Legacy Gist Sync");
    },
    
    // --- CRYPTO HELPER (Web Crypto API) ---
    async _deriveKey(userEmail) {
        const enc = new TextEncoder();
        const baseKey = await crypto.subtle.importKey(
            "raw",
            enc.encode("KLYX_HIVE_MIND_SECRET_SALT_v1_" + userEmail),
            { name: "PBKDF2" },
            false,
            ["deriveKey"]
        );
        return await crypto.subtle.deriveKey(
            {
                name: "PBKDF2",
                salt: enc.encode("KLYX_SALT"),
                iterations: 100000,
                hash: "SHA-256"
            },
            baseKey,
            { name: "AES-GCM", length: 256 },
            false,
            ["encrypt", "decrypt"]
        );
    },

    async _encryptData(data, userEmail) {
        try {
            const key = await this._deriveKey(userEmail);
            const iv = crypto.getRandomValues(new Uint8Array(12));
            const enc = new TextEncoder();
            const encodedData = enc.encode(JSON.stringify(data));
            
            const ciphertext = await crypto.subtle.encrypt(
                { name: "AES-GCM", iv: iv },
                key,
                encodedData
            );
            
            // Return as base64 string: "iv_base64:ciphertext_base64"
            const ivStr = btoa(String.fromCharCode(...iv));
            const cipherStr = btoa(String.fromCharCode(...new Uint8Array(ciphertext)));
            return `${ivStr}:${cipherStr}`;
        } catch (e) {
            console.error("Encryption Failed", e);
            throw e;
        }
    },

    async _decryptData(encryptedStr, userEmail) {
        try {
            if (!encryptedStr || !encryptedStr.includes(":")) return null;
            
            const [ivStr, cipherStr] = encryptedStr.split(":");
            const iv = new Uint8Array(atob(ivStr).split("").map(c => c.charCodeAt(0)));
            const ciphertext = new Uint8Array(atob(cipherStr).split("").map(c => c.charCodeAt(0)));
            const key = await this._deriveKey(userEmail);
            
            const decrypted = await crypto.subtle.decrypt(
                { name: "AES-GCM", iv: iv },
                key,
                ciphertext
            );
            
            const dec = new TextDecoder();
            return JSON.parse(dec.decode(decrypted));
        } catch (e) {
            console.error("Decryption Failed", e);
            return null;
        }
    },

    // --- REPO DB IMPLEMENTATION ---
    async _getRepoFile(token, userEmail) {
        if (!userEmail) return null;
        const owner = api.auth.githubConfig.repoOwner;
        const repo = api.auth.githubConfig.repoName;
        // Sanitized filename from email or ID
        const filename = `banco_de_dados/user_${userEmail.replace(/[@.]/g, '_')}.json`;
        
        try {
            const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`;
            // Add timestamp to bypass cache
            const res = await fetch(url + `?t=${Date.now()}`, {
                 headers: { 
                     "Authorization": `token ${token}`,
                     "Accept": "application/vnd.github.v3+json"
                 }
            });
            
            if (res.status === 404) return null; // File doesn't exist yet
            if (!res.ok) throw new Error(`Repo Read Error ${res.status}`);
            
            const json = await res.json();
            // Decode Base64 content wrapper (GitHub API format)
            const contentRaw = decodeURIComponent(escape(atob(json.content)));
            
            // Try to parse as JSON first (Legacy support or new format container)
            let parsed;
            try {
                parsed = JSON.parse(contentRaw);
            } catch {
                parsed = contentRaw;
            }

            // Check if it's our new encrypted format (has 'encryptedPayload')
            let finalData = parsed;
            if (parsed && parsed.encryptedPayload) {
                console.log("🔐 Decrypting Cloud Data...");
                const decrypted = await this._decryptData(parsed.encryptedPayload, userEmail);
                if (decrypted) {
                    finalData = decrypted;
                } else {
                    console.error("Failed to decrypt data!");
                    // Fallback to empty or raw to avoid crash, but warn user
                }
            } else {
                console.log("⚠️ Legacy Data Detected (Unencrypted). will migrate on next save.");
            }

            return {
                sha: json.sha,
                data: finalData
            };
        } catch (e) {
            console.error("Repo DB Read Error", e);
            return null;
        }
    },
    
    async _writeRepoFile(token, userEmail, data, sha = null) {
        if (!userEmail) return;
        const owner = api.auth.githubConfig.repoOwner;
        const repo = api.auth.githubConfig.repoName;
        const filename = `banco_de_dados/user_${userEmail.replace(/[@.]/g, '_')}.json`;
        
        try {
            // ENCRYPT DATA BEFORE SENDING
            console.log("🔒 Encrypting Data before Sync...");
            const encryptedPayload = await this._encryptData(data, userEmail);
            
            // Wrap in a container
            const container = {
                version: "2.0-encrypted",
                updatedAt: new Date().toISOString(),
                userEmail: userEmail, // Public metadata
                encryptedPayload: encryptedPayload // THE SECRET SAUCE
            };

            const url = `https://api.github.com/repos/${owner}/${repo}/contents/${filename}`;
            
            // Encode content to Base64 (UTF-8 safe) for GitHub API
            const contentStr = JSON.stringify(container, null, 2);
            const contentBase64 = btoa(unescape(encodeURIComponent(contentStr)));
            
            const body = {
                message: `update: sync user data (encrypted) for ${userEmail}`,
                content: contentBase64
            };
            
            if (sha) {
                body.sha = sha;
            }
            
            const res = await fetch(url, {
                method: "PUT",
                headers: { 
                    "Authorization": `token ${token}`,
                    "Content-Type": "application/json",
                    "Accept": "application/vnd.github.v3+json"
                },
                body: JSON.stringify(body)
            });
            
            if (!res.ok) {
                const errText = await res.text();
                throw new Error(`Repo Write Error ${res.status}: ${errText}`);
            }
            
            return await res.json();
        } catch (e) {
            console.error("Repo DB Write Error", e);
            throw e;
        }
    },

    // SYNC DOWN: Cloud -> Local (Updated for Repo DB + Encryption)
    async syncDown() {
        const token = this._getToken();
        if (!token || token.startsWith("klyx_")) return;

        // Dispatch Event: Sync Start
        window.dispatchEvent(new CustomEvent('klyx-sync-start'));

        // We need user email to find the file
        let user = readSession().user;
        if (!user || !user.email) {
             try {
                 const userRes = await fetch("https://api.github.com/user", {
                    headers: { "Authorization": `token ${token}` }
                 });
                 if (userRes.ok) {
                     const ghUser = await userRes.json();
                     user = { email: ghUser.email || ghUser.login + "@github.com", id: "u" + ghUser.id };
                 }
             } catch(e) { console.warn("Failed to fetch user for sync", e); return; }
        }
        
        if (!user) {
            window.dispatchEvent(new CustomEvent('klyx-sync-end'));
            return;
        }

        const repoFile = await this._getRepoFile(token, user.email);
        
        if (repoFile) {
            // Check SHA to avoid unnecessary overwrites (Optimistic Sync)
            const lastSha = localStorage.getItem(`klyx_repodb_sha_${user.id}`);
            if (lastSha === repoFile.sha) {
                // No changes on cloud
                window.dispatchEvent(new CustomEvent('klyx-sync-end'));
                return;
            }

            const cloudData = repoFile.data;
            
            // Store SHA for next update
            localStorage.setItem(`klyx_repodb_sha_${user.id}`, repoFile.sha);
            
            // Restore to LocalStorage (Expanded Data)
            const profiles = cloudData.profiles || [];
            const progress = cloudData.progress || {};
            const activityLog = cloudData.activityLog || [];
            const favorites = cloudData.favorites || [];
            const supportStats = cloudData.supportStats || {tickets:0, lastContact:null};
            const subscription = cloudData.subscription || {plan:"free", status:"active"};
            const accountStatus = cloudData.accountStatus || "active";
            
            localStorage.setItem(`klyx.profiles.${user.id}`, JSON.stringify(profiles));
            localStorage.setItem(`klyx_progress_${user.id}`, JSON.stringify(progress));
            localStorage.setItem(`klyx_activity_log_${user.id}`, JSON.stringify(activityLog));
            localStorage.setItem(`klyx_favorites_${user.id}`, JSON.stringify(favorites));
            localStorage.setItem(`klyx_support_stats_${user.id}`, JSON.stringify(supportStats));
            localStorage.setItem(`klyx_subscription_${user.id}`, JSON.stringify(subscription));
            localStorage.setItem(`klyx_account_status_${user.id}`, accountStatus);
            
            // Sync Account-Bound Device Identity
            if (cloudData.deviceIdentity && cloudData.deviceIdentity.mac) {
                localStorage.setItem('klyx_device_mac', cloudData.deviceIdentity.mac);
                localStorage.setItem('klyx_device_key', cloudData.deviceIdentity.key);
            }
            
            console.log("☁️ Sync Down Complete (New Encrypted Data Received)");
            
            // Dispatch Event: Data Updated (UI should reload if needed)
            window.dispatchEvent(new CustomEvent('klyx-data-updated'));
        } else {
            console.log("☁️ No Repo DB file found. Creating INITIAL encrypted file...");
            // Immediately trigger syncUp to create the file
            await this.syncUp();
        }
        
        window.dispatchEvent(new CustomEvent('klyx-sync-end'));
    },

    // Auto-Polling for Real-Time Sync
    startPolling() {
        if (this._syncTimer) clearInterval(this._syncTimer);
        console.log("🔄 Starting Real-Time Sync Polling (2s)");
        
        // Initial Sync
        this.syncDown();
        
        // Poll every 2 seconds
        this._syncTimer = setInterval(() => {
            this.syncDown();
        }, 2000);
    },
    
    stopPolling() {
        if (this._syncTimer) clearInterval(this._syncTimer);
        this._syncTimer = null;
    },

    // SYNC UP: Local -> Cloud (Updated for Repo DB + Encryption)
    async syncUp() {
        const token = this._getToken();
        if (!token || token.startsWith("klyx_")) return;

        window.dispatchEvent(new CustomEvent('klyx-sync-start'));
        console.log("☁️ Syncing Up to Repo DB (Encrypted)...");
        const user = readSession().user;
        if (!user) return;

        // Gather Local Data (Expanded)
        const profiles = JSON.parse(localStorage.getItem(`klyx.profiles.${user.id}`) || "[]");
        const progress = JSON.parse(localStorage.getItem(`klyx_progress_${user.id}`) || "{}");
        const activityLog = JSON.parse(localStorage.getItem(`klyx_activity_log_${user.id}`) || "[]");
        const favorites = JSON.parse(localStorage.getItem(`klyx_favorites_${user.id}`) || "[]");
        const supportStats = JSON.parse(localStorage.getItem(`klyx_support_stats_${user.id}`) || '{"tickets":0,"lastContact":null}');
        const subscription = JSON.parse(localStorage.getItem(`klyx_subscription_${user.id}`) || '{"plan":"free","status":"active"}');
        const accountStatus = localStorage.getItem(`klyx_account_status_${user.id}`) || "active";
        
        const deviceIdentity = {
            mac: localStorage.getItem('klyx_device_mac'),
            key: localStorage.getItem('klyx_device_key')
        };
        
        const data = {
            updatedAt: new Date().toISOString(),
            githubUser: user, // Include GitHub User Data snapshot
            profiles,
            progress,
            activityLog,
            favorites,
            supportStats,
            subscription,
            accountStatus,
            deviceIdentity
        };

        // Try to get SHA first (optimistic locking)
        let sha = localStorage.getItem(`klyx_repodb_sha_${user.id}`);
        
        // If no SHA, check if file exists to get it
        if (!sha) {
            const existing = await this._getRepoFile(token, user.email);
            if (existing) sha = existing.sha;
        }

        try {
            const res = await this._writeRepoFile(token, user.email, data, sha);
            // Update SHA
            if (res && res.content && res.content.sha) {
                localStorage.setItem(`klyx_repodb_sha_${user.id}`, res.content.sha);
            }
            console.log("☁️ Sync Up Complete (Saved Encrypted to Repo DB)");
        } catch (e) {
            console.error("Sync Up Failed", e);
            if (e.message.includes("403") || e.message.includes("404")) {
                 // alert("⚠️ Erro de Permissão: O GitHub não permitiu salvar os dados.");
                 console.warn("Write permission denied or repo not found");
            }
        }
        window.dispatchEvent(new CustomEvent('klyx-sync-end'));
    },

    // Debounced Sync Up
    scheduleSyncUp() {
        // Use a separate timer for debounce to avoid conflicting with polling
        if (window._debounceTimer) clearTimeout(window._debounceTimer);
        window._debounceTimer = setTimeout(() => {
            this.syncUp();
        }, 2000); // Wait 2 seconds
    },

    // 4. RESET / WIPE CLOUD DATA
    async reset() {
        console.log("🔥 INITIATING NUCLEAR RESET...");
        
        try {
            const token = this._getToken();
            
            // 1. Try to Wipe Cloud (Best Effort)
            if (token) {
                try {
                    const gist = await this._findGist(token);
                    if (gist) {
                         // Overwrite with empty data and explicitly NULL identity
                        await this._updateGist(token, gist.id, {
                            updatedAt: new Date().toISOString(),
                            profiles: [],
                            progress: {},
                            deviceIdentity: { mac: null, key: null }
                        });
                        console.log("☁️ Cloud Data Wiped");
                    }
                } catch (cloudError) {
                    console.warn("⚠️ Cloud wipe failed (network/auth issue?), proceeding with local wipe anyway.", cloudError);
                }
            }
        } catch (e) {
            console.warn("Reset preparation error", e);
        }

        // 2. NUCLEAR LOCAL WIPE (Unconditional)
        console.log("🗑️ Wiping Local Storage...");
        localStorage.clear(); // Delete EVERYTHING: users, settings, profiles, mac, key, tokens
        sessionStorage.clear();
        
        // 3. Force reload to clear memory state
        console.log("🔥 RESET COMPLETE. RELOADING.");
        window.location.href = "./index.html";
        return { ok: true };
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
        // Scoped to user ID
        const profileKey = `klyx.profiles.${newUser.id}`;
        let profiles = []; 
        const initialProfile = { 
            id: "p" + Date.now(), 
            name: name.split(' ')[0], 
            avatar: `https://api.dicebear.com/7.x/avataaars/svg?seed=${name.split(' ')[0]}`,
            // age: 18, // Removed
            isKid: false,
            allowExplicit: false, // Default to Safe
            created_at: new Date().toISOString()
        };
        profiles.push(initialProfile);
        localStorage.setItem(profileKey, JSON.stringify(profiles));
        
        // Auto-login
        delete newUser.password;
        const token = "klyx_" + Math.random().toString(36).substr(2) + Date.now().toString(36);
        writeSession({ user: newUser, tokens: { accessToken: token, refreshToken: token + "_refresh" } });
        
        // Enforce Parental Control locally
        localStorage.setItem("klyx_parental_active", "true");
        
        // Sync new user data to Cloud immediately
        setTimeout(() => api.cloud.syncUp(), 100);

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
        redirectUri: window.location.origin + window.location.pathname.replace(/\/[^/]*$/, '/index.html'),
        repoOwner: "kaandor",
        repoName: "WEKAOPOPAWJD-LAM-LDMA-LDML-AADSDA"
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
        // Request 'public_repo' scope to allow writing to the database folder
        const authUrl = `https://github.com/login/oauth/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(this.githubConfig.redirectUri)}&scope=user:email,public_repo&state=${state}`;
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
            // We prioritize CodeTabs and CorsProxyIO. Added AllOrigins with improved parsing logic.
            const proxies = [
                {
                    name: "CodeTabs",
                    url: (url) => `https://api.codetabs.com/v1/proxy?quest=${encodeURIComponent(url)}`,
                    method: "GET"
                },
                {
                    name: "CorsProxyIO",
                    url: (url) => `https://corsproxy.io/?${url}`,
                    method: "GET"
                },
                {
                    name: "AllOrigins",
                    url: (url) => `https://api.allorigins.win/get?url=${encodeURIComponent(url)}`,
                    method: "GET"
                },
                {
                    name: "VercelAuth",
                    url: () => `https://klyx-api.vercel.app/api/token`,
                    method: "POST"
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
                    
                    // Special handling for CorsProxyIO (needs unencoded)
                    // The proxy.url function handles the wrapping, but we need to ensure we don't double encode
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
                    
                    // Add timeout to prevent hanging (increased to 20s for slow proxies)
                    const controller = new AbortController();
                    const timeoutId = setTimeout(() => controller.abort(), 20000); // 20s timeout
                    
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
                    
                    // Parse response with fallback for non-JSON (GitHub default)
                    const responseText = await response.text();
                    try {
                        data = JSON.parse(responseText);
                    } catch (e) {
                        // Not JSON, assume form-encoded string (e.g. CodeTabs ignoring Accept header)
                        // GitHub returns: access_token=...&scope=...&token_type=bearer
                        console.log(`Proxy ${proxy.name} returned non-JSON, checking form-encoded...`);
                        const params = new URLSearchParams(responseText);
                        if (params.has('access_token')) {
                            data = Object.fromEntries(params.entries());
                        } else {
                            // If it's not a token response, maybe it's an error in plain text
                            throw new Error(`Invalid response format: ${responseText.substring(0, 100)}...`);
                        }
                    }
                    
                    // Handle Proxy Wrappers (AllOrigins, CorsLoL)
                    // Some proxies wrap the actual content in a JSON object
                    if (data.contents) {
                         if (typeof data.contents === 'string') {
                             try { 
                                 // Try to parse contents as JSON
                                 data = JSON.parse(data.contents); 
                             } catch(e) { 
                                 // If JSON parse fails, it might be form-encoded
                                 console.log("Wrapper contents not JSON, trying form-encoded parse:", data.contents);
                                 const params = new URLSearchParams(data.contents);
                                 if (params.has('access_token')) {
                                     data = Object.fromEntries(params.entries());
                                 } else {
                                     // If we can't parse contents, and it's not a token, it might be the data itself?
                                     // But for token endpoint, we expect an object or form params.
                                     // Keep data as is if it has access_token property (unlikely if string)
                                 }
                             }
                         } else {
                             // Contents is already an object
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

            // Sync Cloud Data
            await api.cloud.syncDown();
            
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
  playback: {
      async saveProgress(contentId, currentTime, duration, type) {
          const session = readSession();
          if (!session || !session.user) return { ok: false, error: "Usuário não logado" };
          
          const userId = session.user.id;
          const progressData = {
              progress: Math.floor(currentTime),
              duration: Math.floor(duration),
              updatedAt: new Date().toISOString(),
              type: type || 'movie'
          };
          
          try {
              // Save to LocalStorage (Immediate / Offline)
              const localKey = `klyx_progress_${userId}`;
              const localData = JSON.parse(localStorage.getItem(localKey) || "{}");
              localData[contentId] = progressData;
              localStorage.setItem(localKey, JSON.stringify(localData));
              
              // Save to Cloud (GitHub Gist)
              api.cloud.scheduleSyncUp();
              
              return { ok: true };
          } catch (e) {
              console.error("Save Progress Error", e);
              return { ok: false, error: e.message };
          }
      },
      
      async getProgress(contentId) {
          const session = readSession();
          if (!session || !session.user) return { ok: false, error: "Usuário não logado" };
          
          const userId = session.user.id;
          
          try {
              // Read from LocalStorage (Synced via Cloud on Login)
              const localKey = `klyx_progress_${userId}`;
              const localData = JSON.parse(localStorage.getItem(localKey) || "{}");
              if (localData[contentId]) {
                  return { ok: true, data: localData[contentId] };
              }
              
              return { ok: true, data: { progress: 0 } };
          } catch (e) {
              console.error("Get Progress Error", e);
              return { ok: true, data: { progress: 0 } };
          }
      },
      
      async getAllProgress() {
          const session = readSession();
          if (!session || !session.user) return { ok: false, error: "Usuário não logado" };
          
          const userId = session.user.id;
          
          try {
               const url = `${FIREBASE_DB_URL}/users/${userId}/playback.json`;
               const res = await fetch(url);
               if (res.ok) {
                   const data = await res.json();
                   return { ok: true, data: data || {} };
               }
          } catch (e) {
              console.warn("Firebase list failed", e);
          }
          
          // Fallback
          const localKey = `klyx_progress_${userId}`;
          return { ok: true, data: JSON.parse(localStorage.getItem(localKey) || "{}") };
      }
  },
  movies: {
    async get(id) {
        // Fetch raw data to find any movie, even if hidden by deduplication
        const data = await getLocalData("movies.json");
        let rawMovies = (data?.movies || []).map(normalize);
        
        // Apply Parental Filter
        rawMovies = filterRestrictedContent(rawMovies);
        
        let movie = rawMovies.find(m => m.id === id);
        if (!movie) return { ok: false, data: { error: "Movie not found" } };
        
        // Attempt to find sibling version (Dub/Sub) for Audio 2 support
        // This reproduces the logic of deduplicateMovies for a single item
        const title = movie.title.trim();
        const lowerTitle = title.toLowerCase();
        
        // Determine if current is Subtitled
        const isSubtitled = 
            lowerTitle.endsWith(" [l]") || 
            lowerTitle.endsWith(" (l)") || 
            lowerTitle.includes("(legendado)") || 
            lowerTitle.includes("[legendado]") ||
            lowerTitle.includes(" legendado") ||
            lowerTitle.includes(" - legendado");
            
        // Get Base Title
        let baseTitle = title
            .replace(/ \[L\]$/i, "")
            .replace(/ \(L\)$/i, "")
            .replace(/\(Legendado\)/i, "")
            .replace(/\[Legendado\]/i, "")
            .replace(/ - Legendado/i, "")
            .replace(/ Legendado/i, "")
            .trim();
        if (baseTitle.endsWith(" -")) baseTitle = baseTitle.substring(0, baseTitle.length - 2).trim();
        
        // Find sibling
        // If we are Dubbed, look for Subtitled
        // If we are Subtitled, look for Dubbed
        const sibling = rawMovies.find(m => {
            if (m.id === id) return false; // Skip self
            const t = m.title.trim();
            return t.startsWith(baseTitle) && (
                (isSubtitled && !t.toLowerCase().includes("legendado")) || // We are sub, looking for dub
                (!isSubtitled && (t.toLowerCase().includes("legendado") || t.toLowerCase().includes("[l]"))) // We are dub, looking for sub
            );
        });
        
        if (sibling) {
            if (isSubtitled) {
                // If we are playing the Subtitled version, treat it as main but maybe offer Dubbed as Audio 2?
                // Or just keep it as is.
                console.log(`Playing Subtitled version: ${title}. Sibling (Dub) found: ${sibling.title}`);
            } else {
                // We are playing Dubbed, attach Subtitled as Audio 2
                if (!movie.stream_url_subtitled_version) {
                    movie.stream_url_subtitled_version = sibling.stream_url;
                }
            }
        }

        // Ensure stream_url exists (fallback)
        if (!movie.stream_url) {
            movie.stream_url = "https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8"; 
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
        const res = await api.content.getSeries();
        const series = res.ok ? (res.data.series || []) : [];
        
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
            const profileId = localStorage.getItem("klyx_profile_id");
            if (!profileId) return { ok: false, data: { progress: 0 } };

            const progress = JSON.parse(localStorage.getItem(`klyx.progress.${profileId}`) || "{}");
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
            const profileId = localStorage.getItem("klyx_profile_id");
            if (!profileId) return { ok: false };

            const progress = JSON.parse(localStorage.getItem(`klyx.progress.${profileId}`) || "{}");
            progress[id] = {
                time,
                duration,
                timestamp: Date.now()
            };
            localStorage.setItem(`klyx.progress.${profileId}`, JSON.stringify(progress));
            
            // Also update "Continue Watching" list
            let continueWatching = JSON.parse(localStorage.getItem(`klyx.continueWatching.${profileId}`) || "[]");
            // Remove if exists
            continueWatching = continueWatching.filter(i => i.id !== id);
            // Add to top
            continueWatching.unshift({ id, time, duration, type, timestamp: Date.now() });
            // Limit to 20
            if (continueWatching.length > 20) continueWatching.pop();
            localStorage.setItem(`klyx.continueWatching.${profileId}`, JSON.stringify(continueWatching));
            
            return { ok: true };
        } catch (e) {
            return { ok: false };
        }
    },
    async removeProgress(id) {
        try {
            const profileId = localStorage.getItem("klyx_profile_id");
            if (!profileId) return { ok: false };

            const progress = JSON.parse(localStorage.getItem(`klyx.progress.${profileId}`) || "{}");
            delete progress[id];
            localStorage.setItem(`klyx.progress.${profileId}`, JSON.stringify(progress));
            
            let continueWatching = JSON.parse(localStorage.getItem(`klyx.continueWatching.${profileId}`) || "[]");
            continueWatching = continueWatching.filter(i => i.id !== id);
            localStorage.setItem(`klyx.continueWatching.${profileId}`, JSON.stringify(continueWatching));
            return { ok: true };
        } catch (e) {
            return { ok: false };
        }
    },
    async getContinueWatching() {
        try {
            const profileId = localStorage.getItem("klyx_profile_id");
            if (!profileId) return { ok: true, data: [] };
            
            const list = JSON.parse(localStorage.getItem(`klyx.continueWatching.${profileId}`) || "[]");
            return { ok: true, data: list };
        } catch (e) {
            return { ok: true, data: [] };
        }
    }
  },
  content: {
    // Keep these for ui.js compatibility
    async getHome() { 
        // Dynamic Home Generation (Bypassing static home.json limits)
        try {
            const [moviesRes, seriesRes] = await Promise.all([
                api.movies.list(),
                api.content.getSeries()
            ]);

            const allMovies = moviesRes.ok ? moviesRes.data : [];
            const allSeries = seriesRes.ok ? (seriesRes.data.series || []) : [];
            
            // Helper to get random or sliced items
            const getItems = (items, count = 100, filterFn = null) => {
                let filtered = filterFn ? items.filter(filterFn) : items;
                return filtered.slice(0, count);
            };

            const rails = {
                topMovies: getItems(allMovies, 100),
                topSeries: getItems(allSeries, 100),
                recentMovies: getItems(allMovies, 100, m => true).reverse().slice(0, 100), // Simple "recent" simulation
                horrorMovies: getItems(allMovies, 100, m => (m.category || "").toLowerCase().includes("terror")),
                comedyMovies: getItems(allMovies, 100, m => (m.category || "").toLowerCase().includes("comédia")),
                actionMovies: getItems(allMovies, 100, m => (m.category || "").toLowerCase().includes("ação"))
            };

            return { ok: true, data: { rails } };
        } catch (e) {
            console.error("Dynamic Home Error", e);
            // Fallback to static file if dynamic fails
            const data = await getLocalData("home.json");
            return { ok: true, data };
        }
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
            data.series = series.map(s => {
                s = normalize(s);
                // Enrich Category for Smart Categorization
                const keywordsSafe = ["animacao", "animation", "desenho", "infantil", "kids", "crianca", "criança", "livre", "disney", "pixar", "fantasia", "fantasy", "familia", "family"];
                const combinedForCat = (s.title + " " + (s.category || "")).toLowerCase();
                if (keywordsSafe.some(kw => combinedForCat.includes(kw))) {
                     if (s.category && !s.category.includes("Criança")) {
                         s.category += " | Criança";
                     }
                }
                return s;
            });
        }
        return { ok: true, data }; 
    }
  },
  search: {
      async query(q) {
          if (!q) return { ok: false, data: { error: "Query empty" } };
          q = q.toLowerCase();
          
          // Search Movies (already filtered by restriction)
          const moviesRes = await api.movies.list();
          const movies = moviesRes.ok ? moviesRes.data : [];
          
          // Search Series (already filtered by restriction)
          const seriesRes = await api.content.getSeries();
          const series = seriesRes.ok ? (seriesRes.data.series || []) : [];
          
          // Filter
          const results = [];
          
          movies.forEach(m => {
              if (m.title.toLowerCase().includes(q)) {
                  results.push({ ...m, type: 'movie', image_url: m.poster });
              }
          });
          
          series.forEach(s => {
              if (s.title.toLowerCase().includes(q)) {
                  results.push({ ...s, type: 'series', image_url: s.poster });
              }
          });
          
          return { ok: true, data: { results } };
      }
  },
  profiles: {
      _getUserProfilesKey() {
          const user = JSON.parse(localStorage.getItem("klyx.session") || "{}").user;
          return user ? `klyx.profiles.${user.id}` : "klyx.profiles";
      },
      list() {
          const key = this._getUserProfilesKey();
          const profiles = JSON.parse(localStorage.getItem(key) || "[]");
          return { ok: true, data: profiles };
      },
      async create(data) {
          // Check plan limits
          const user = JSON.parse(localStorage.getItem("klyx.session") || "{}").user;
          const key = this._getUserProfilesKey();
          const profiles = JSON.parse(localStorage.getItem(key) || "[]");
          
          // Default plan limits (Mock)
          // Individual: 1 profile (owner)
          // Premium: 4 profiles
          const plan = user?.plan || "premium"; // Default to premium for demo/dev
          const limit = plan === "individual" ? 1 : 4;

          if (profiles.length >= limit) {
              return { ok: false, data: { error: `Limite de perfis atingido (${limit}) para o plano ${plan}.` } };
          }

          const newProfile = {
              id: "p" + Date.now(),
              name: data.name,
              avatar: data.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${data.name}`,
              age: parseInt(data.age) || 18,
              isKid: (parseInt(data.age) || 18) <= 12,
              allowExplicit: data.allowExplicit, // Store explicit permission
              pin: data.pin || null, // For adult profiles if needed
              created_at: new Date().toISOString()
          };

          profiles.push(newProfile);
          localStorage.setItem(key, JSON.stringify(profiles));
          
          // Force Immediate Sync for Critical Data
          console.log("Creating Profile - Forcing Immediate Sync");
          await api.cloud.syncUp();
          
          return { ok: true, data: newProfile };
      },
      async update(id, data) {
          const key = this._getUserProfilesKey();
          const profiles = JSON.parse(localStorage.getItem(key) || "[]");
          const index = profiles.findIndex(p => p.id === id);
          
          if (index === -1) return { ok: false, data: { error: "Perfil não encontrado" } };
          
          profiles[index] = { ...profiles[index], ...data };
          localStorage.setItem(key, JSON.stringify(profiles));
          
          // Force Immediate Sync for Critical Data
          await api.cloud.syncUp();
          
          return { ok: true, data: profiles[index] };
      },
      async delete(id) {
          const key = this._getUserProfilesKey();
          let profiles = JSON.parse(localStorage.getItem(key) || "[]");
          // Prevent deleting the last profile
          if (profiles.length <= 1) {
              return { ok: false, data: { error: "Você não pode excluir o último perfil." } };
          }
          
          profiles = profiles.filter(p => p.id !== id);
          localStorage.setItem(key, JSON.stringify(profiles));
          
          // Force Immediate Sync for Critical Data
          await api.cloud.syncUp();
          
          return { ok: true };
      },
      setCurrent(id) {
          localStorage.setItem("klyx_profile_id", id);
          
          // Apply Age Restrictions based on profile
          const key = this._getUserProfilesKey();
          const profiles = JSON.parse(localStorage.getItem(key) || "[]");
          const profile = profiles.find(p => p.id === id);
          
          if (profile) {
              // Determine content restriction level
              // 18+: No restriction
              // 16-17: Block 18+
              // 14-15: Block 16+
              // 10-13: Block 14+
              // <10: Kids mode (Block 10+)
              
              let maxRating = 18;
              if (profile.age < 18) maxRating = 16;
              if (profile.age < 16) maxRating = 14;
              if (profile.age < 14) maxRating = 12;
              if (profile.age < 12) maxRating = 10;
              if (profile.age < 10) maxRating = 0; // Kids only
              
              localStorage.setItem("klyx_active_profile_name", profile.name);
              localStorage.setItem("klyx_active_profile_avatar", profile.avatar);
              localStorage.setItem("klyx_content_rating_limit", maxRating.toString());
              localStorage.setItem("klyx_profile_explicit_allowed", profile.allowExplicit ? "true" : "false");
              
              // Also toggle parental control flag for legacy checks
              localStorage.setItem("klyx_parental_active", (profile.age < 18).toString());
          }
          
          return { ok: true };
      },
      getCurrent() {
          const id = localStorage.getItem("klyx_profile_id");
          const key = this._getUserProfilesKey();
          const profiles = JSON.parse(localStorage.getItem(key) || "[]");
          return profiles.find(p => p.id === id) || profiles[0];
      }
  }
};
