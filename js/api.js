const STORAGE_KEY = "klyx.session";
const FIREBASE_DB_URL = "https://klix-iptv-default-rtdb.firebaseio.com";

// Simple in-memory cache for catalog data to prevent redownloading huge JSONs
const requestCache = {};

// Helper para converter email em chave segura para o Firebase
function escapeEmail(email) {
    if (!email) return "unknown";
    return email.replace(/\./g, ',').replace(/@/g, '_at_'); // Firebase não aceita . em chaves, mas aceita ,
}

function readSession() {
  const raw = localStorage.getItem(STORAGE_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch (e) {
    return null;
  }
}

function writeSession(session) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(session));
  if (session.user && session.user.id) {
      localStorage.setItem("klyx_user_id", session.user.id);
  }
}

function clearSession() {
  localStorage.removeItem(STORAGE_KEY);
  localStorage.removeItem("klyx_profile_id");
  localStorage.removeItem("klyx_user_id");
}

function getTokens() {
  return readSession()?.tokens ?? null;
}

// Verifica se estamos em ambiente sem backend (GitHub Pages, Localhost, etc)
function isClientSideMode() {
    const h = window.location.hostname;
    return h.includes("github.io") || 
           h === "localhost" || 
           h === "127.0.0.1" ||
           h.startsWith("192.168.") ||
           h.startsWith("10.") ||
           h.startsWith("172.") ||
           window.location.protocol === "file:";
}

function isAdultEnabled() {
    const enabled = localStorage.getItem('klyx_adult_enabled') === 'true';
    console.log("[API] isAdultEnabled:", enabled);
    return enabled;
}

async function refreshTokens() {
  // Em modo client-side Firebase, não usamos refresh tokens da mesma forma
  if (isClientSideMode()) return null;

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
  const isClient = isClientSideMode();
  
  if (isClient) {
      // --- LÓGICA FIREBASE / CLIENT SIDE ---

      // --- PLAYBACK HANDLER (Client-Side) ---
      if (path.includes("/playback/progress")) {
          const profileId = localStorage.getItem('klyx_profile_id') || "default";
          const key = `klyx_recent_${profileId}`;
          
          if (method === "POST") {
              // Save Progress
              try {
                  const payload = body;
                  let recent = [];
                  const raw = localStorage.getItem(key);
                  if (raw) recent = JSON.parse(raw);
                  
                  // Remove existing entry for this content
                  recent = recent.filter(r => {
                      const rId = r.contentId || r.content_id;
                      const pId = payload.contentId || payload.content_id;
                      const rType = r.contentType || r.content_type;
                      const pType = payload.contentType || payload.content_type;
                      // Use loose equality for IDs to handle string/number mismatch
                      return !(rId == pId && rType == pType);
                  });
                  
                  // Add new entry
                  recent.unshift({
                      ...payload,
                      updated_at: new Date().toISOString()
                  });
                  
                  // Limit size
                  if (recent.length > 50) recent = recent.slice(0, 50);
                  
                  localStorage.setItem(key, JSON.stringify(recent));
                  return { ok: true, status: 200, data: { message: "Saved" } };
              } catch (e) {
                  return { ok: false, status: 500, data: { error: e.message } };
              }
          } else if (method === "GET") {
               // Get Progress
               try {
                   const urlParams = new URLSearchParams(path.split('?')[1]);
                   const contentId = urlParams.get('content_id');
                   const contentType = urlParams.get('content_type');
                   
                   const raw = localStorage.getItem(key);
                   if (raw) {
                       const recent = JSON.parse(raw);
                       const item = recent.find(r => {
                           const rId = r.contentId || r.content_id;
                           const rType = r.contentType || r.content_type;
                           // Use loose equality for IDs
                           return rId == contentId && rType == contentType;
                       });
                       if (item) {
                           return { ok: true, status: 200, data: item };
                       }
                   }
                   return { ok: true, status: 200, data: {} }; // Not found but OK
               } catch (e) {
                   return { ok: false, status: 500, data: { error: e.message } };
               }
          } else if (method === "DELETE") {
               // Remove Progress
               try {
                   const urlParams = new URLSearchParams(path.split('?')[1]);
                   const contentId = urlParams.get('content_id');
                   const contentType = urlParams.get('content_type');
                   
                   let recent = [];
                   const raw = localStorage.getItem(key);
                   if (raw) recent = JSON.parse(raw);
                   
                   recent = recent.filter(r => {
                       const rId = r.contentId || r.content_id;
                       const rType = r.contentType || r.content_type;
                       return !(rId === contentId && rType === contentType);
                   });
                   localStorage.setItem(key, JSON.stringify(recent));
                   
                   return { ok: true, status: 200, data: { message: "Removed" } };
               } catch (e) {
                   return { ok: false, status: 500, data: { error: e.message } };
               }
          }
      }
      
      if (path.includes("/playback/recent")) {
          const profileId = localStorage.getItem('klyx_profile_id') || "default";
          const key = `klyx_recent_${profileId}`;
          let recent = [];
          const raw = localStorage.getItem(key);
          if (raw) recent = JSON.parse(raw);
          
          // Filter completed items for "Continue Watching" list
           const validRecent = recent.filter(r => {
              const pos = r.positionSeconds || r.position_seconds || 0;
              const dur = r.durationSeconds || r.duration_seconds || 0;
              if (dur > 0 && (pos / dur) > 0.9) return false; // Remove completed (> 90%)
              return true;
          });

          return { ok: true, status: 200, data: validRecent };
      }

      
      // Roteamento de requisições para o Firebase
      if (method === "GET") {
          let firebasePath = null;
          let localFallback = null;

          // Mapeamento de rotas da API antiga para estrutura do Firebase
          if (path.includes("/catalog/home")) {
              firebasePath = "catalog/home";
              localFallback = "./assets/data/home.json";
          }
          else if (path.includes("/movies")) {
               firebasePath = "catalog/movies";
               localFallback = "./assets/data/movies.json";
          }
          else if (path.includes("/series") && path.includes("/episodes")) {
               firebasePath = "catalog/episodes";
               localFallback = "./assets/data/episodes.json";
          }
          else if (path.includes("/series")) {
               firebasePath = "catalog/series";
               localFallback = "./assets/data/series.json";
          }
          else if (path.includes("/live")) {
               firebasePath = "catalog/live";
               localFallback = "./assets/data/live.json";
          }
          else if (path.includes("/profiles")) {
              // Perfis são buscados diretamente do nó do usuário logado
              const session = readSession();
              if (session && session.user && session.user.email_key) {
                  firebasePath = `users/${session.user.email_key}/profiles`;
              } else {
                  // Fallback para demo se não estiver logado (improvável nessa rota)
                  console.log("[Firebase] User not logged in for profiles, returning mock");
                  return { ok: true, status: 200, data: [{ id: "p1", name: "Perfil 1" }, { id: "p2", name: "Infantil" }] };
              }
          }
          else if (path.includes("/auth/me") || path.includes("/users/me")) {
               const session = readSession();
               if (session) return { ok: true, status: 200, data: { user: session.user, settings: { theme: "dark" } } };
               return { ok: false, status: 401, data: null };
          }
          
          if (firebasePath) {
              console.log(`[Firebase] Fetching ${firebasePath}...`);
              let rawData = null;

              try {
                  // Check cache first for catalog items
                  if (requestCache[firebasePath]) {
                      console.log(`[Firebase] Cache hit for ${firebasePath}`);
                      rawData = requestCache[firebasePath];
                  } else {
                      const fbRes = await fetch(`${FIREBASE_DB_URL}/${firebasePath}.json`);
                      if (fbRes.ok) {
                          rawData = await fbRes.json();
                          // Cache large catalogs
                          if (firebasePath.startsWith("catalog/") && rawData) {
                              requestCache[firebasePath] = rawData;
                          }
                      }
                  }
              } catch (e) {
                  console.warn("[Firebase] Fetch failed, trying fallback", e);
              }
              
              // Se Firebase falhar ou retornar null/vazio, tenta fallback local
              if ((!rawData || (Array.isArray(rawData) && rawData.length === 0) || (typeof rawData === 'object' && Object.keys(rawData).length === 0)) && localFallback) {
                  console.log(`[Firebase] Data not found/error, using local fallback: ${localFallback}`);
                  try {
                      const localRes = await fetch(localFallback);
                      if (localRes.ok) {
                          rawData = await localRes.json();
                      }
                  } catch(e) {
                      console.error("Fallback failed", e);
                  }
              }

              if (rawData) {
                  // Se for lista de perfis e retornar objeto (Firebase retorna objetos para listas), converter para array
                  let dataToReturn = rawData;
                  
                  if (path.includes("/profiles") && !Array.isArray(rawData)) {
                      dataToReturn = Object.values(rawData);
                  }

                  // 1. Prepare for Injection (Get Recent Progress)
                  // We need this for both Home Rails and Lists (Movies/Series)
                  const profileId = localStorage.getItem('klyx_profile_id') || "default";
                  const recentRaw = localStorage.getItem(`klyx_recent_${profileId}`);
                  let progressMap = {};
                  if (recentRaw) {
                      try {
                          const recent = JSON.parse(recentRaw);
                          recent.forEach(r => {
                              const id = r.contentId || r.content_id;
                              if (id) {
                                  progressMap[id] = r;
                                  // Also map by string/number variant just in case
                                  progressMap[String(id)] = r;
                              }
                          });
                      } catch(e) {}
                  }

                  // 2. Handle Catalog Home (Rails)
                  if (path.includes("/catalog/home") && rawData.rails) {
                      console.log("[API] Processing Home Rails...");
                      
                      // Adult Filter (Home specific recursive filter)
                      const showAdult = isAdultEnabled();
                      const adultKeywords = ['adult', 'xxx', 'porn', '18+', 'sex', 'hentai', 'erotic', 'hot', 'sexy', '+18', 'adultos'];
                      
                      if (!showAdult) {
                          console.log("[API] Filtering Adult Content...");
                          Object.keys(rawData.rails).forEach(railKey => {
                              const rail = rawData.rails[railKey];
                              if (Array.isArray(rail)) {
                                  const originalLen = rail.length;
                                  rawData.rails[railKey] = rail.filter(i => {
                                      const c = (i.category || "").toLowerCase();
                                      const g = (i.genres || "").toLowerCase();
                                      const t = (i.title || "").toLowerCase();
                                      return !adultKeywords.some(k => c.includes(k) || g.includes(k) || t.includes(k));
                                  });
                                  if (rawData.rails[railKey].length < originalLen) {
                                      console.log(`[API] Filtered ${originalLen - rawData.rails[railKey].length} items from ${railKey}`);
                                  }
                              }
                          });
                      }

                      // Progress Injection (Inject progress into all rails items)
                      console.log("[API] Injecting Progress...");
                      Object.keys(rawData.rails).forEach(railKey => {
                          const rail = rawData.rails[railKey];
                          if (Array.isArray(rail)) {
                              rail.forEach(item => {
                                  // Check both ID types
                                  const p = progressMap[item.id] || progressMap[String(item.id)];
                                  if (p) {
                                      item.position_seconds = p.positionSeconds || p.position_seconds;
                                      item.duration_seconds = p.durationSeconds || p.duration_seconds;
                                  }
                              });
                          }
                      });

                      // Continue Watching Injection
                      if (recentRaw) {
                          const recent = JSON.parse(recentRaw);
                          console.log("[API] Recent items found:", recent.length);
                          
                          const validRecent = recent.filter(r => {
                              // Remove items > 90% completed
                              const pos = r.positionSeconds || r.position_seconds;
                              const dur = r.durationSeconds || r.duration_seconds;
                              
                              if (pos && dur) {
                                  const pct = (pos / dur) * 100;
                                  if (pct > 90) return false;
                              }
                              return true;
                          }).sort((a, b) => new Date(b.updated_at) - new Date(a.updated_at));
                          
                          console.log("[API] Valid items for Continue Watching:", validRecent.length);

                          if (validRecent.length > 0) {
                              // Map to catalog item structure
                              const cwItems = validRecent.map(r => ({
                                  id: r.contentId || r.content_id,
                                  title: r.title || "Retomar",
                                  content_type: r.contentType || r.content_type, // needed for UI
                                  series_id: r.seriesId || r.series_id, 
                                  poster_url: r.posterUrl || r.poster_url || "./assets/logos/logo.svg",
                                  backdrop_url: r.posterUrl || r.poster_url, // fallback
                                  position_seconds: r.positionSeconds || r.position_seconds,
                                  duration_seconds: r.durationSeconds || r.duration_seconds,
                                  // Ensure category/genre doesn't trigger adult filter if strictly checking (though filter ran before)
                                  category: r.category || ""
                              }));
                              
                              // Inject into rails
                              rawData.rails.continueWatching = cwItems;
                              console.log("[API] Injected Continue Watching rail.");
                          }
                      }
                  }

                  // Normalização para Catálogos (Movies, Series, Live)
                  // O UI espera { items: [...] } e suporta filtragem
                  if (path.includes("/movies") || path.includes("/series") || path.includes("/live")) {
                      let items = [];
                      // Extrair items da resposta (suporta { movies: [...] } ou array direto ou objeto indexado)
                       if (rawData.movies) items = rawData.movies;
                       else if (rawData.series) items = rawData.series;
                       else if (rawData.episodes) items = rawData.episodes;
                       else if (rawData.live) items = rawData.live;
                       else if (rawData.channels) items = rawData.channels;
                       else if (Array.isArray(rawData)) items = rawData;
                       else items = Object.values(rawData);

                      // --- CATEGORIES HANDLER ---
                      // Moved BEFORE filtering to ensure Adult categories appear in dropdown (but content is blocked later)
                      if (path.includes("categories")) {
                          // Force load items if empty (Safety Check)
                          if (items.length === 0 && localFallback) {
                              try {
                                  console.log("[API] Items empty for categories, forcing fallback load: " + localFallback);
                                  const fallbackRes = await fetch(localFallback);
                                  if (fallbackRes.ok) {
                                      const fallbackData = await fallbackRes.json();
                                      if (fallbackData.movies) items = fallbackData.movies;
                                      else if (fallbackData.series) items = fallbackData.series;
                                      else if (fallbackData.episodes) items = fallbackData.episodes;
                                      else if (fallbackData.live) items = fallbackData.live;
                                      else if (Array.isArray(fallbackData)) items = fallbackData;
                                  }
                              } catch(e) {
                                  console.error("[API] Failed to force load categories", e);
                              }
                          }

                          const catsMap = {};
                          items.forEach(i => {
                              let c = i.category;
                              if (Array.isArray(c)) c = c.toString(); // Handle array categories
                              if (typeof c === 'string') c = c.trim();
                              
                              if (c) {
                                  if (!catsMap[c]) catsMap[c] = 0;
                                  catsMap[c]++;
                              }
                          });
                          
                          const categories = Object.keys(catsMap).sort().map(k => ({ category: k, count: catsMap[k] }));
                          return { ok: true, status: 200, data: { categories } };
                      }

                      // --- ADULT FILTER (Generic Lists) ---
                      const showAdult = isAdultEnabled();
                      const adultKeywords = ['adult', 'xxx', 'porn', '18+', 'sex', 'hentai', 'erotic', 'hot', 'sexy', '+18', 'adultos'];

                      // 1. Block specific category requests (Immediate 403)
                      if (!showAdult) {
                          const queryString = path.split('?')[1];
                          if (queryString) {
                              const urlParams = new URLSearchParams(queryString);
                              const queryCat = (urlParams.get('category') || "").toLowerCase();
                              if (queryCat && adultKeywords.some(k => queryCat.includes(k))) {
                                  return { ok: false, status: 403, data: { error: "Fale com o suporte para desbloquear o conteudo" } };
                              }
                          }
                      }

                      // 2. Filter items list
                      if (!showAdult) {
                          const originalCount = items.length;
                          items = items.filter(i => {
                              const c = (i.category || "").toLowerCase();
                              const g = (i.genres || "").toLowerCase();
                              const t = (i.title || "").toLowerCase();
                              return !adultKeywords.some(k => c.includes(k) || g.includes(k) || t.includes(k));
                          });
                          console.log(`[API] Generic Filter: Removed ${originalCount - items.length} adult items.`);
                      }
                      
                      // --- PROGRESS INJECTION (Generic Lists) ---
                      if (recentRaw) {
                          try {
                              const recent = JSON.parse(recentRaw);
                              const pMap = {};
                              recent.forEach(r => {
                                  if (r.contentId) pMap[r.contentId] = r;
                                  if (r.content_id) pMap[r.content_id] = r;
                              });
                              
                              items.forEach(item => {
                                  const p = pMap[item.id] || pMap[String(item.id)];
                                  if (p) {
                                      item.position_seconds = p.positionSeconds || p.position_seconds;
                                      item.duration_seconds = p.durationSeconds || p.duration_seconds;
                                  }
                              });
                          } catch(e) {}
                      }

                      // Filtragem Client-Side (Simulando Backend)
                      try {
                          // Detectar se é uma requisição de item único (GET /api/movies/:id)
                          const idMatch = path.match(/\/(movies|series|live)\/([^/?]+)$/);
                          const isEpisodeList = path.includes("/episodes");

                          if (idMatch && !isEpisodeList) {
                              // Retornar item único
                              const id = idMatch[2];
                              const item = items.find(i => i.id === id);
                              if (item) {
                                  dataToReturn = { item: item };
                              } else {
                                  return { ok: false, status: 404, data: { error: "Item not found" } };
                              }
                          } else {
                              // Retornar lista (já filtrada por adulto acima)
                              
                              // Filtrar Episódios por ID da Série
                              if (path.includes("/episodes")) {
                                  const parts = path.split('/series/');
                                  if (parts.length > 1) {
                                      const seriesId = parts[1].split('/')[0];
                                      // Decodificar URI component caso o ID tenha caracteres especiais
                                      const decodedId = decodeURIComponent(seriesId);
                                      if (decodedId) {
                                          items = items.filter(i => i.series_id == decodedId || i.series_id == seriesId);
                                      }
                                  }
                              }

                              const queryString = path.split('?')[1];
                              if (queryString) {
                                  const urlParams = new URLSearchParams(queryString);
                                  const category = urlParams.get('category');
                                  const limit = parseInt(urlParams.get('limit')) || 0;
                                  const offset = parseInt(urlParams.get('offset')) || 0;
                                  
                                  // Parâmetro 'like' usado nas rows (ex: "%Filmes | Crime%")
                                  // Vamos extrair a parte relevante da string
                                  let like = urlParams.get('like'); 
                                  
                                  if (category) {
                                      const target = category.trim();
                                      items = items.filter(i => {
                                          let iCat = i.category;
                                          if (Array.isArray(iCat)) iCat = iCat.toString();
                                          if (typeof iCat === 'string') iCat = iCat.trim();
                                          
                                          return iCat === target || (Array.isArray(i.categories) && i.categories.some(cat => String(cat).trim() === target));
                                      });
                                  }
                                  
                                  if (like) {
                                      // Remove %
                                      const term = like.replace(/%/g, '');
                                      // Tenta extrair categoria (ex: "Filmes | Crime" -> "Crime")
                                      const parts = term.split('|');
                                      const target = parts.length > 1 ? parts[1].trim() : term.trim();
                                      
                                      if (target) {
                                          items = items.filter(i => 
                                              (i.category && i.category.toLowerCase().includes(target.toLowerCase())) ||
                                              (i.genres && i.genres.toLowerCase().includes(target.toLowerCase()))
                                          );
                                      }
                                  }
                                  
                                  // Apply Pagination (Slice) AFTER filtering
                                  if (limit > 0) {
                                      // Note: In a real DB, offset is skipped. In array slice, start index is offset.
                                      // Ensure we don't go out of bounds (slice handles this gracefully usually)
                                      items = items.slice(offset, offset + limit);
                                  }
                              }
                              
                              // Retorna no formato esperado pelo UI
                              dataToReturn = { items: items };
                          }
                      } catch (err) {
                          console.warn("[Firebase] Filter error:", err);
                      }
                  }

                  // --- PLAYBACK HANDLER (Client-Side) ---
                  if (path.includes("/playback/progress")) {
                      const profileId = localStorage.getItem('klyx_profile_id') || "default";
                      const storageKey = `klyx_recent_${profileId}`;
                      
                      if (method === "GET") {
                          const urlParams = new URLSearchParams(path.split('?')[1]);
                          const contentId = urlParams.get('content_id');
                          
                          let progress = null;
                          if (contentId) {
                              const recentRaw = localStorage.getItem(storageKey);
                              if (recentRaw) {
                                  try {
                                      const recent = JSON.parse(recentRaw);
                                      // Loose equality for ID check
                                      progress = recent.find(r => (r.contentId == contentId) || (r.content_id == contentId));
                                  } catch(e) {}
                              }
                          }
                          console.log(`[API] GetProgress for ${contentId}:`, progress);
                          return { ok: true, status: 200, data: { progress } };
                      }
                      
                      if (method === "POST") {
                          const payload = body;
                          let recent = [];
                          const recentRaw = localStorage.getItem(storageKey);
                          if (recentRaw) {
                              try { recent = JSON.parse(recentRaw); } catch(e) {}
                          }
                          
                          // Remove existing entry
                          recent = recent.filter(r => 
                              String(r.contentId || r.content_id) !== String(payload.contentId || payload.content_id)
                          );
                          
                          // Add new entry
                          payload.updated_at = new Date().toISOString();
                          recent.unshift(payload);
                          
                          // Limit history
                          if (recent.length > 100) recent = recent.slice(0, 100);
                          
                          localStorage.setItem(storageKey, JSON.stringify(recent));
                          return { ok: true, status: 200, data: { success: true } };
                      }
                      
                      if (method === "DELETE") {
                           const urlParams = new URLSearchParams(path.split('?')[1]);
                           const contentId = urlParams.get('content_id');
                           let recent = [];
                           const recentRaw = localStorage.getItem(storageKey);
                           if (recentRaw) {
                               try { recent = JSON.parse(recentRaw); } catch(e) {}
                           }
                           recent = recent.filter(r => String(r.contentId || r.content_id) !== String(contentId));
                           localStorage.setItem(storageKey, JSON.stringify(recent));
                           return { ok: true, status: 200, data: { success: true } };
                      }
                  }

                  return { ok: true, status: 200, data: dataToReturn };
              }
              
              // Se tudo falhar, retorna vazio mas OK para não quebrar a UI
              return { ok: true, status: 200, data: { items: [] } };
          }
      } 
      // POST/PUT/DELETE logic para Firebase (gerenciado principalmente nas funções específicas abaixo)
      
      return { ok: false, status: 404, data: { error: "Route not handled in Firebase mode" } };
  }

  // --- LÓGICA BACKEND ORIGINAL ---
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
  auth: {
    async register({ email, password, displayName, mac, key }) {
      if (isClientSideMode()) {
        console.log("[Firebase] Registering user...");
        const emailKey = escapeEmail(email);
        
        // Verificar se usuário já existe
        const checkRes = await fetch(`${FIREBASE_DB_URL}/users/${emailKey}.json`);
        const existingUser = await checkRes.json();
        
        if (existingUser) {
            return { ok: false, status: 400, data: { message: "User already exists" } };
        }

        const newUser = {
            id: emailKey,
            email: email,
            password: password, // NOTA: Em produção, NUNCA salve senhas em texto puro. Isso é apenas para MVP client-side.
            display_name: displayName,
            created_at: new Date().toISOString(),
            // Assinatura (Subscription) & Vinculação de Dispositivo
            subscription: {
                device_key: key || null,
                linked_mac: mac || null
            },
            plan: 'individual', // individual, duo, family, premium
            status: 'pending_activation', // active, expired, pending_activation
            expires_at: null, 
            profiles: [
                { id: "p1", name: displayName || "Perfil 1", avatar: "avatar1.png", is_kid: false }
            ]
        };

        // Salvar no Firebase
        await fetch(`${FIREBASE_DB_URL}/users/${emailKey}.json`, {
            method: "PUT",
            body: JSON.stringify(newUser)
        });

        return { ok: true, status: 201, data: { message: "User created" } };
      }

      const res = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password, displayName, mac, key }),
      });
      const data = await res.json().catch(() => ({}));
      return { ok: res.ok, status: res.status, data };
    },
    async login({ email, password, mac, key }) {
      try {
        if (isClientSideMode()) {
            console.log("[Firebase] Logging in...");
            const emailKey = escapeEmail(email);
            
            // Buscar usuário
            const res = await fetch(`${FIREBASE_DB_URL}/users/${emailKey}.json`);
            const user = await res.json();

            if (user && user.password === password) {
                // SYNC: Se usuário tem assinatura salva, retorna junto para o front
                const sub = user.subscription || {};

                // AUTO-LINK: Se o usuário não tem chave vinculada, mas está logando com um device válido, vincular agora
                if (!sub.device_key && key) {
                    sub.device_key = key;
                    sub.linked_mac = mac;
                    // Salvar vínculo no Firebase
                    fetch(`${FIREBASE_DB_URL}/users/${emailKey}/subscription.json`, {
                        method: 'PUT',
                        body: JSON.stringify(sub)
                    });
                }

                const session = {
                    user: { 
                        id: user.id, 
                        email: user.email, 
                        name: user.display_name,
                        email_key: emailKey, // Guardar key para uso posterior
                        plan: user.plan || 'individual',
                        status: user.status || 'pending_activation',
                        expires_at: user.expires_at || null,
                        // Retorna dados de assinatura para o front atualizar localmente
                        subscription: sub
                    },
                    tokens: { accessToken: "firebase-mock-token", refreshToken: "firebase-mock-refresh" }
                };
                writeSession(session);
                return { ok: true, status: 200, data: { ...session } };
            }
            
            return { ok: false, status: 401, data: { message: "Invalid credentials" } };
        }

        const res = await fetch("/api/auth/login", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ email, password, mac, key }),
        });
        const data = await res.json().catch(() => ({}));
        if (res.ok && data.tokens) {
            writeSession(data);
        }
        return { ok: res.ok, status: res.status, data };
      } catch (e) {
          console.error("Login Error:", e);
          return { ok: false, status: 500, data: { error: e.message || "Erro de conexão" } };
      }
    },
    async checkDevice(mac, key) {
        if (isClientSideMode()) {
             try {
                 // Sanitize MAC for Firebase Key (matches manage-subs.js logic)
                 const macId = mac.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
                 
                 // Add timeout to prevent hanging
                 const controller = new AbortController();
                 const timeoutId = setTimeout(() => controller.abort(), 5000);

                 const res = await fetch(`${FIREBASE_DB_URL}/devices/${macId}.json`, { signal: controller.signal });
                 clearTimeout(timeoutId);
                 
                 if (!res.ok) throw new Error("Firebase fetch failed");

                 const device = await res.json();
                 
                 if (!device) {
                     // TENTATIVA DE AUTO-ATIVAÇÃO VIA CHAVE MESTRA
                     // Se não achou pelo MAC, verifique se a CHAVE existe e permite múltiplos dispositivos
                     if (key) {
                         try {
                             const keyRes = await fetch(`${FIREBASE_DB_URL}/keys/${key}.json`, { signal: controller.signal });
                             const keyData = await keyRes.json();
                             
                             if (keyData && keyData.mac) {
                                 const masterMac = keyData.mac;
                                 // Fetch master device
                                 const masterRes = await fetch(`${FIREBASE_DB_URL}/devices/${masterMac}.json`, { signal: controller.signal });
                                 const masterDevice = await masterRes.json();
                                 
                                 if (masterDevice && masterDevice.status === 'active') {
                                     // Check limits
                                     const max = parseInt(masterDevice.max_ips || 1);
                                     const allowed = Array.isArray(masterDevice.allowed_ips) ? masterDevice.allowed_ips : [];
                                     
                                     // Se já está na lista (mas por algum motivo não tinha registro próprio), ok
                                     // Se não está, verifica se tem vaga
                                     if (allowed.includes(macId) || allowed.length < max) {
                                          console.log(`[AutoActivate] Linking ${macId} to master ${masterMac} (Slots: ${allowed.length}/${max})`);
                                          
                                          // Add to allowed list if not present
                                          if (!allowed.includes(macId)) {
                                              allowed.push(macId);
                                              // Update master allowed list
                                              await fetch(`${FIREBASE_DB_URL}/devices/${masterMac}.json`, {
                                                  method: 'PATCH',
                                                  body: JSON.stringify({ allowed_ips: allowed })
                                              });
                                          }
                                          
                                          // Create Mirror Device Record
                                          const newDevice = { ...masterDevice };
                                          newDevice.mac_address = macId; // Override MAC
                                          // Manter referência ao mestre? Talvez não precise, basta copiar os dados de acesso.
                                          // Mas se o mestre renovar, esse aqui fica desatualizado.
                                          // IDEAL: O cliente deveria sempre checar o mestre.
                                          // MAS para compatibilidade, vamos criar um registro duplicado E manter sincronia futura (difícil sem backend).
                                          // SOLUÇÃO: Criar registro independente mas com MESMOS dados.
                                          
                                          await fetch(`${FIREBASE_DB_URL}/devices/${macId}.json`, {
                                              method: 'PUT',
                                              body: JSON.stringify(newDevice)
                                          });
                                          
                                          return { ok: true, status: 200, data: newDevice };
                                     }
                                 }
                             }
                         } catch(e) {
                             console.error("Auto-activate failed", e);
                         }
                     }

                    return { ok: true, status: 200, data: { status: 'inactive', active: false, plan: 'free' } };
                 }

                 // Check key if provided (optional)
                 if (key && device.device_key !== key) {
                      return { ok: false, status: 401, data: { error: "Invalid Key" } };
                 }

                 // Check expiry
                 if (device.expires_at && new Date(device.expires_at) < new Date()) {
                     device.status = 'expired';
                     device.active = false;
                 } else {
                     const s = String(device.status || '').toLowerCase();
                     device.active = (s === 'active' || s === 'true' || s === '1' || device.active === true);
                 }

                 return { ok: true, status: 200, data: device };
             } catch(e) {
                 console.error("Firebase Device Check Error:", e);
                 // On network error, assume active/offline mode to not block user
                 return { ok: true, status: 200, data: { status: 'active', active: true, offline: true } };
             }
        }
        const res = await fetch("/api/auth/device/check", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ mac, key }),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    },
    async logout() {
      clearSession();
      if (isClientSideMode()) return;

      const session = readSession();
      await fetch("/api/auth/logout", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userId: session?.user?.id,
          refreshToken: session?.tokens?.refreshToken,
        }),
      }).catch(() => null);
    },
    async me() {
      if (isClientSideMode()) {
          const session = readSession();
          if (session) {
              return { ok: true, status: 200, data: { user: session.user, settings: { theme: "dark" } } };
          }
          return { ok: false, status: 401, data: null };
      }
      return request("GET", "/api/auth/me");
    },
  },
  movies: {
    list: (category, limit, offset, categoryLike) => {
      // Implementação simplificada para Firebase: busca tudo e filtra no cliente (ineficiente para grandes bases, ok para MVP)
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (limit) params.set("limit", limit);
      if (offset) params.set("offset", offset);
      if (categoryLike) params.set("like", categoryLike);
      return request("GET", `/api/movies?${params.toString()}`);
    },
    get: (id) => request("GET", `/api/movies/${encodeURIComponent(id)}`),
    categories: () => request("GET", "/api/movies/categories"),
  },
  series: {
    list: (category, limit, offset, categoryLike) => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (limit) params.set("limit", limit);
      if (offset) params.set("offset", offset);
      if (categoryLike) params.set("like", categoryLike);
      return request("GET", `/api/series?${params.toString()}`);
    },
    get: (id) => request("GET", `/api/series/${encodeURIComponent(id)}`),
    episodes: (id) => request("GET", `/api/series/${encodeURIComponent(id)}/episodes`),
    categories: () => request("GET", "/api/series/categories"),
  },
  live: {
    list: (category, limit, offset) => {
      const params = new URLSearchParams();
      if (category) params.set("category", category);
      if (limit) params.set("limit", limit);
      if (offset) params.set("offset", offset);
      return request("GET", `/api/live?${params.toString()}`);
    },
    get: (id) => request("GET", `/api/live/${encodeURIComponent(id)}`),
    categories: () => request("GET", "/api/live/categories"),
  },
  catalog: {
    home: () => {
        return request("GET", `/api/catalog/home`);
    },
    categories: () => request("GET", "/api/catalog/categories"),
  },
  profiles: {
    list: () => request("GET", "/api/profiles"),
    get: (id) => request("GET", `/api/profiles/${id}`),
    create: async (payload) => {
        if (isClientSideMode()) {
            const session = readSession();
            if (!session?.user?.email_key) return { ok: false };
            
            // Gerar ID simples
            const newId = "p" + Date.now();
            const newProfile = { ...payload, id: newId };
            
            // Salvar no Firebase (adicionar à lista ou objeto)
            await fetch(`${FIREBASE_DB_URL}/users/${session.user.email_key}/profiles/${newId}.json`, {
                method: "PUT",
                body: JSON.stringify(newProfile)
            });
            return { ok: true, status: 201, data: newProfile };
        }

        const res = await fetch("/api/profiles", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
        });
        const data = await res.json().catch(() => ({}));
        return { ok: res.ok, status: res.status, data };
    },
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
    sync: async () => {
        const session = readSession();
        if (!session || !session.user || !session.user.email_key) return null;
        
        try {
            const res = await fetch(`${FIREBASE_DB_URL}/users/${session.user.email_key}.json`);
            if (res.ok) {
                const remoteUser = await res.json();
                if (remoteUser) {
                    session.user = { ...session.user, ...remoteUser };
                    writeSession(session);
                    return session.user;
                }
            }
        } catch (e) {
            console.error("Sync user failed", e);
        }
        return session.user;
    },
  },
  posters: {
    get: async (title, originalUrl, type = 'series') => {
        if (!title) return originalUrl;
        
        // 1. Sanitize title for Firebase Key
        const safeTitle = title.replace(/[.#$\[\]]/g, '_').replace(/\//g, '_').replace(/\s+/g, '_').toLowerCase();
        // Use type in path to avoid collisions between movies and series
        const safeType = (type || 'series').toLowerCase();
        const firebasePath = `catalog/posters/${safeType}/${safeTitle}`;
        
        // 2. Check Firebase
        try {
             const fbRes = await fetch(`${FIREBASE_DB_URL}/${firebasePath}.json`);
             if (fbRes.ok) {
                 const cachedUrl = await fbRes.json();
                 if (cachedUrl && typeof cachedUrl === 'string' && cachedUrl.startsWith('http')) {
                     return cachedUrl;
                 }
             }
        } catch(e) { 
            // Silent fail on Firebase check
        }

        // 3. Search External APIs
        // Only search if we don't have a valid-looking original URL or if we want to force valid covers
        // User reported missing covers, so we try to find one.
        
        try {
            if (safeType === 'series' || safeType === 'episode') {
                // Search TVMaze for Series
                const searchRes = await fetch(`https://api.tvmaze.com/singlesearch/shows?q=${encodeURIComponent(title)}`);
                if (searchRes.ok) {
                    const data = await searchRes.json();
                    if (data && data.image && (data.image.medium || data.image.original)) {
                        const newUrl = data.image.medium || data.image.original;
                        
                        // 4. Save to Firebase
                        try {
                            await fetch(`${FIREBASE_DB_URL}/${firebasePath}.json`, {
                                method: "PUT",
                                body: JSON.stringify(newUrl)
                            });
                        } catch(e) {}
                        
                        return newUrl;
                    }
                }
            } else if (safeType === 'movie') {
                // For movies, we could search OMDB or TMDB if we had keys.
                // Without keys, options are limited. 
                // We could try to use a public search or just return original for now.
                // But let's leave this placeholder for future expansion.
            }
        } catch(e) { 
            console.warn(`External search failed for [${safeType}] ${title}:`, e);
        }

        // 5. Fallback
        return originalUrl;
    }
  },
  search: {
    query: (q) => {
        const profileId = localStorage.getItem('klyx_profile_id') || "";
        return request("GET", `/api/search?q=${encodeURIComponent(q)}&profileId=${encodeURIComponent(profileId)}`);
    },
  },
  status: {
      _lastError: null,
      getLastError: () => api.status._lastError,
      checkConnection: async () => {
          if (!isClientSideMode()) return true;
          try {
              // Timeout curto para verificar conexão (Aumentado para 10s)
              const controller = new AbortController();
              const timeoutId = setTimeout(() => controller.abort(), 10000);
              
              // Tenta verificar um caminho público primeiro para evitar erros 401/404 na raiz se as regras forem estritas
              let res = await fetch(`${FIREBASE_DB_URL}/catalog/home.json?shallow=true`, { signal: controller.signal }).catch(() => null);
              
              // Se falhar, tenta a raiz como fallback (algumas configurações podem permitir raiz mas não subcaminhos sem auth)
              if (!res || !res.ok) {
                   res = await fetch(`${FIREBASE_DB_URL}/.json?shallow=true`, { signal: controller.signal }).catch(() => null);
              }

              clearTimeout(timeoutId);
              
              if (!res || !res.ok) {
                  api.status._lastError = res ? `Status ${res.status}: ${res.statusText}.` : "Falha na requisição (Network Error).";
                  return false;
              } else {
                  api.status._lastError = null;
                  return true;
              }
          } catch (e) {
              api.status._lastError = `Erro: ${e.message}`;
              return false;
          }
      }
  }
};
