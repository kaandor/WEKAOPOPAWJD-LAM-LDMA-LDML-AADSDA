import { api } from "./api.js";
import "./pwa.js";

export function getSession() {
  return api.session.read();
}

export async function requireAuth() {
  const session = api.session.read();
  const profileId = localStorage.getItem("klyx_profile_id");
  const isGuest = profileId === "guest";

  // If it's a guest profile, we allow access without a valid session
  if (isGuest) {
    return true; 
  }

  if (!session || !session.tokens || !session.tokens.accessToken) {
    console.log("[Auth] No session found, redirecting to profile selection...");
    window.location.replace("./profile-selection.html");
    return null;
  }
  return session;
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

