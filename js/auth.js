import { api } from "./api.js";
import "./pwa.js";

export function getSession() {
  return api.session.read();
}

export async function requireAuth({ redirectTo = "./login.html" } = {}) {
  const session = api.session.read();
  console.log("[Auth] Checking session...", session ? "Found" : "Not found");
  
  if (session?.tokens?.accessToken) {
    console.log("[Auth] Validating token with api.auth.me()...");
    const me = await api.auth.me();
    console.log("[Auth] Validation result:", me.ok ? "OK" : "FAILED", "Status:", me.status);

    if (me.ok) {
      const mac = localStorage.getItem('klyx_device_mac');
      const key = localStorage.getItem('klyx_device_key');
      console.log("[Auth] Device context:", { mac, key });

      if (mac && key) {
          console.log("[Auth] Checking device status...");
          const deviceCheck = await api.auth.checkDevice(mac, key);
          console.log("[Auth] Device status result:", deviceCheck.ok ? "OK" : "FAILED", deviceCheck.data?.status);
          
          if (deviceCheck.ok) {
               if (deviceCheck.data.status === 'locked_activation') {
                   console.warn("[Auth] Device locked, redirecting to activate.html");
                   window.location.href = "./activate.html"; 
                   return null;
               }
               localStorage.setItem('klyx_adult_enabled', deviceCheck.data.adult_enabled ? 'true' : 'false');
          }
      }

      if (!me.data.user) {
          console.warn("[Auth] Session token valid but user data missing. Clearing session.");
          api.session.clear();
          if (redirectTo) {
              window.location.href = redirectTo;
              return null;
          }
      }

      const next = {
        user: me.data.user,
        tokens: session.tokens,
        settings: me.data.settings,
      };
      api.session.write(next);
      applyTheme(next.settings?.theme || "dark");
      console.log("[Auth] Session verified and updated.");
      return next;
    } else {
        if (me.status !== 401) {
            console.warn("[Auth] Auth check failed but not 401. Assuming offline/server error. Continuing with cached session.", me.status);
            applyTheme(session.settings?.theme || "dark");
            return session;
        } else {
            console.warn("[Auth] Session expired or invalid. Clearing session.");
            api.session.clear();
        }
    }
  }

  if (redirectTo) {
    try {
        const currentUrl = new URL(window.location.href);
        const targetUrl = new URL(redirectTo, window.location.href);
        
        if (currentUrl.href !== targetUrl.href) {
            console.log(`[Auth] No valid session. Redirecting to ${redirectTo}`);
            window.location.href = redirectTo;
        } else {
             console.log(`[Auth] No valid session. Already at target ${redirectTo}, skipping redirect.`);
        }
    } catch (e) {
        console.log(`[Auth] No valid session. Redirecting to ${redirectTo} (fallback)`);
        window.location.href = redirectTo;
    }
    return null;
  }
  return null;
}

export function applyTheme(theme) {
  const safe = theme === "light" ? "light" : "dark";
  document.documentElement.setAttribute("data-theme", safe);
}

export function redirectIfAuthed({ to = "./profile-selection.html" } = {}) {
  const session = api.session.read();
  if (session?.tokens?.accessToken) {
    window.location.href = to;
  }
}

export async function logout() {
  await api.auth.logout();
  window.location.href = "./login.html";
}

