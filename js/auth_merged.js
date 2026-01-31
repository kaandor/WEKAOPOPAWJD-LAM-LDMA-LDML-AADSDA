import { api } from "./api.js?v=20260131-realtime";
import "./pwa.js";

export function getSession() {
  return api.session.read();
}

export async function requireAuth({ redirectTo = "/login" } = {}) {
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
          if (deviceCheck.ok && deviceCheck.data.status === 'locked_activation') {
               window.location.href = "/activate";
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

export function redirectIfAuthed({ to = "/profiles" } = {}) {
  const session = api.session.read();
  if (session?.tokens?.accessToken) {
    window.location.href = to;
  }
}

export async function logout() {
  await api.auth.logout();
  window.location.href = "/login";
}

export function handleLoginSuccess(user) {
    // Session is already written by api.js loginWithGithub or login
    // Just handle redirection
    window.location.href = "/profiles";
}
