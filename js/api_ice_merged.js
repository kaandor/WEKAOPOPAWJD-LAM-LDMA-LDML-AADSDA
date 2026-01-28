const STORAGE_KEY = "klyx.session";
const FIREBASE_DB_URL = "https://klix-iptv-default-rtdb.firebaseio.com";

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

function getTokens() {
  return readSession()?.tokens ?? null;
}

async function refreshTokens() {
  const session = readSession();
  if (!session?.tokens?.refreshToken || !session?.tokens?.accessToken) {
    return null;
  }

  const res = await fetch("/api/auth/refresh", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      refreshToken: session.tokens.refreshToken,
      accessToken: session.tokens.accessToken,
    }),
  });

  if (!res.ok) {
    // Do not clear session automatically to prevent accidental logouts
    // clearSession();
    return null;
  }

  const data = await res.json();
  const next = {
    ...session,
    tokens: data.tokens,
  };
  writeSession(next);
  return next.tokens;
}

async function request(method, path, body) {
  const tokens = getTokens();
  const headers = { "Content-Type": "application/json" };
  if (tokens?.accessToken) headers.Authorization = `Bearer ${tokens.accessToken}`;
  
  const mac = localStorage.getItem('klyx_device_mac');
  if (mac) headers['x-device-mac'] = mac;

  const res = await fetch(path, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (res.status !== 401) {
    const json = await res.json().catch(() => null);
    return { ok: res.ok, status: res.status, data: json };
  }

  const refreshed = await refreshTokens();
  if (!refreshed?.accessToken) {
    return { ok: false, status: 401, data: { error: "Unauthorized" } };
  }

  const retryHeaders = { "Content-Type": "application/json", Authorization: `Bearer ${refreshed.accessToken}` };
  const retry = await fetch(path, {
    method,
    headers: retryHeaders,
    body: body ? JSON.stringify(body) : undefined,
  });
  const json = await retry.json().catch(() => null);
  return { ok: retry.ok, status: retry.status, data: json };
}

export const api = {
  session: {
    read: readSession,
    write: writeSession,
    clear: clearSession,
  },
  status: {
    async checkConnection() {
        try {
            // Check both backend and firebase
            const res = await fetch(`${FIREBASE_DB_URL}/.json?shallow=true`);
            return res.ok;
        } catch (e) {
            return false;
        }
    }
  },
  auth: {
    async register({ email, password, displayName, mac, key }) {
      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName, mac, key }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
    async login({ email, password, mac, key }) {
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, mac, key }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
    async loginWithGithub() {
        // Simulated GitHub Auth via Firebase (Client-side)
        console.log("Iniciando login com GitHub...");
        
        return new Promise((resolve) => {
            setTimeout(async () => {
                const githubUser = {
                    uid: "github_user_" + Math.floor(Math.random() * 10000),
                    displayName: "GitHub User",
                    email: "github_user@example.com",
                    photoURL: "https://github.com/github.png",
                    provider: "github"
                };

                try {
                    const userRef = `${FIREBASE_DB_URL}/users/${githubUser.uid}.json`;
                    const check = await fetch(userRef);
                    const existing = await check.json();

                    let finalUser = existing;

                    if (!existing) {
                        finalUser = {
                            ...githubUser,
                            subscription: { plan: "free", active: true, started_at: new Date().toISOString() },
                            continue_watching: [],
                            mac_address: localStorage.getItem('klyx_device_mac') || "",
                            created_at: new Date().toISOString()
                        };
                        
                        await fetch(userRef, {
                            method: 'PUT',
                            body: JSON.stringify(finalUser)
                        });
                    }
                    
                    // Create fake session for compatibility
                    const fakeTokens = {
                        accessToken: "mock_github_token_" + Date.now(),
                        refreshToken: "mock_github_refresh_" + Date.now()
                    };
                    const session = {
                        user: finalUser,
                        tokens: fakeTokens,
                        settings: { theme: "dark" }
                    };
                    writeSession(session); // Use local writeSession

                    resolve({ ok: true, data: { user: finalUser, tokens: fakeTokens } });

                } catch (e) {
                    resolve({ ok: false, data: { error: "Erro ao conectar com GitHub: " + e.message } });
                }
            }, 1500);
        });
    },
    async checkDevice(mac, key) {
        const res = await fetch("/api/auth/device/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mac, key }),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    },
    async logout() {
      const session = readSession();
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session?.user?.id,
          refreshToken: session?.tokens?.refreshToken,
        }),
      }).catch(() => null);
      clearSession();
    },
    async me() {
      return request("GET", "/api/auth/me");
    },
  },
  movies: {
    list: (category, limit, offset, categoryLike) => {
      const profileId = localStorage.getItem('klyx_profile_id') || "";
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (categoryLike) params.set("categoryLike", categoryLike);
      if (limit) params.set("limit", limit);
      if (offset) params.set("offset", offset);
      if (profileId) params.set("profileId", profileId);
      return request("GET", `/api/movies?${params.toString()}`);
    },
    get: (id) => request("GET", `/api/movies/${encodeURIComponent(id)}`),
    categories: () => request("GET", "/api/movies/categories"),
  },
  series: {
    list: (category, limit, offset, categoryLike) => {
      const profileId = localStorage.getItem('klyx_profile_id') || "";
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (categoryLike) params.set("categoryLike", categoryLike);
      if (limit) params.set("limit", limit);
      if (offset) params.set("offset", offset);
      if (profileId) params.set("profileId", profileId);
      return request("GET", `/api/series?${params.toString()}`);
    },
    get: (id) => request("GET", `/api/series/${encodeURIComponent(id)}`),
    episodes: (id) => request("GET", `/api/series/${encodeURIComponent(id)}/episodes`),
    categories: () => request("GET", "/api/series/categories"),
  },
  live: {
    list: (category, limit, offset) => {
      const profileId = localStorage.getItem('klyx_profile_id') || "";
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (limit) params.set("limit", limit);
      if (offset) params.set("offset", offset);
      if (profileId) params.set("profileId", profileId);
      return request("GET", `/api/live?${params.toString()}`);
    },
    get: (id) => request("GET", `/api/live/${encodeURIComponent(id)}`),
    categories: () => request("GET", "/api/live/categories"),
  },
  catalog: {
    home: () => {
        const profileId = localStorage.getItem('klyx_profile_id') || "";
        return request("GET", `/api/catalog/home?profileId=${encodeURIComponent(profileId)}`);
    },
    categories: () => request("GET", "/api/catalog/categories"),
  },
  profiles: {
    list: () => request("GET", "/api/profiles"),
    get: (id) => request("GET", `/api/profiles/${id}`),
    create: (payload) => request("POST", "/api/profiles", payload),
    update: (id, payload) => request("PUT", `/api/profiles/${id}`, payload),
    delete: (id) => request("DELETE", `/api/profiles/${id}`),
    verifyPin: (id, pin) => request("POST", `/api/profiles/${id}/verify-pin`, { pin }),
    getBlockedCategories: (id) => request("GET", `/api/profiles/${id}/blocked-categories`),
    blockCategory: (id, category) => request("POST", `/api/profiles/${id}/blocked-categories`, { category }),
    unblockCategory: (id, category) => request("DELETE", `/api/profiles/${id}/blocked-categories/${encodeURIComponent(category)}`),
  },
  playback: {
    getProgress: ({ contentType, contentId }) => {
      const profileId = localStorage.getItem('klyx_profile_id') || "";
      return request(
        "GET",
        `/api/playback/progress?content_type=${encodeURIComponent(contentType)}&content_id=${encodeURIComponent(
          contentId,
        )}&profileId=${encodeURIComponent(profileId)}`,
      );
    },
    saveProgress: (payload) => {
      const profileId = localStorage.getItem('klyx_profile_id') || "";
      return request("POST", "/api/playback/progress", { ...payload, profileId });
    },
    removeProgress: ({ contentType, contentId }) => {
        const profileId = localStorage.getItem('klyx_profile_id') || "";
        return request(
            "DELETE",
            `/api/playback/progress?content_type=${encodeURIComponent(contentType)}&content_id=${encodeURIComponent(contentId)}&profileId=${encodeURIComponent(profileId)}`
        );
    },
    recent: () => {
        const profileId = localStorage.getItem('klyx_profile_id') || "";
        return request("GET", `/api/playback/recent?profileId=${encodeURIComponent(profileId)}`);
    },
  },
  users: {
    me: () => request("GET", "/api/users/me"),
    updateProfile: (payload) => request("PUT", "/api/users/me", payload),
    updateSettings: (payload) => request("PUT", "/api/users/settings", payload),
    changePassword: (payload) => request("POST", "/api/users/password", payload),
  },
  search: {
    query: (q) => {
        const profileId = localStorage.getItem('klyx_profile_id') || "";
        return request("GET", `/api/search?q=${encodeURIComponent(q)}&profileId=${encodeURIComponent(profileId)}`);
    },
  },
};
