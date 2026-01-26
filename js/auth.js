import { api } from "./api.js";
import "./pwa.js";

export function getSession() {
  return api.session.read();
}

export async function requireAuth({ redirectTo = "./login.html" } = {}) {
  const session = api.session.read();
  
  if (session?.tokens?.accessToken) {
    const me = await api.auth.me();
    if (me.ok) {
      // Check if device is active (new field in user object or separate call?)
      // Assuming 'me' returns user info, but we need device status.
      // Let's rely on the MAC stored in localStorage and check status.
      const mac = localStorage.getItem('klyx_device_mac');
      const key = localStorage.getItem('klyx_device_key');

      if (mac && key) {
          const deviceCheck = await api.auth.checkDevice(mac, key);
          if (deviceCheck.ok) {
               if (deviceCheck.data.status === 'locked_activation') {
                   window.location.href = "./activate.html"; 
                   return null;
               }
               // Store adult enabled status for API usage
               localStorage.setItem('klyx_adult_enabled', deviceCheck.data.adult_enabled ? 'true' : 'false');
          }
      }

      // Check if user object exists in response
      if (!me.data.user) {
          console.warn("Session token valid but user data missing. Clearing session.");
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
      return next;
    } else {
        // If error is NOT 401 (Unauthorized), treat as offline/server-error and allow access with cached session
        // This prevents logging out on network errors or 500s.
        if (me.status !== 401) {
            console.warn("Auth check failed but not 401. Assuming offline/server error. Continuing with cached session.", me.status);
            applyTheme(session.settings?.theme || "dark");
            return session;
        } else {
            // Token is invalid and refresh failed. Clear session to break redirect loop.
            console.warn("Session expired. Clearing session.");
            api.session.clear();
        }
    }
  }

  if (redirectTo) {
    window.location.href = redirectTo;
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

