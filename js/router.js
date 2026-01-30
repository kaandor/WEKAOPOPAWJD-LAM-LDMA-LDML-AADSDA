import { requireAuth } from "./auth.js";
import { api } from "./api.js";
import { initInput } from "./input.js";

function icon() {
  return `
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <path d="M8 7.5C8 6.67157 8.67157 6 9.5 6H14.5C15.3284 6 16 6.67157 16 7.5V16.5C16 17.3284 15.3284 18 14.5 18H9.5C8.67157 18 8 17.3284 8 16.5V7.5Z" fill="currentColor" opacity="0.85"/>
      <path d="M11 9.5L15 12L11 14.5V9.5Z" fill="var(--bg)"/>
    </svg>
  `;
}

export async function mountAppShell({ currentPath }) {
  initInput(); // Initialize TV Navigation globally
  const session = await requireAuth();
  if (!session) return;

  // Check profile selection
  const profileId = localStorage.getItem("klyx_profile_id");
  if (!profileId) {
      window.location.href = "./profile-selection.html";
      return;
  }

  const header = document.getElementById("app-header");
  if (!header) return;

  const profileName = localStorage.getItem("klyx_profile_name") || session.user.display_name || session.user.email;
  const profileAvatar = localStorage.getItem("klyx_profile_avatar");
  const userLabel = profileName;
  const initial = userLabel ? userLabel.charAt(0).toUpperCase() : "?";
  
  // Calculate avatar color
  function hashStr(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = str.charCodeAt(i) + ((hash << 5) - hash);
    }
    return Math.abs(hash);
  }
  const hue = profileName ? hashStr(profileName) % 360 : 0;
  const avatarColor = `hsl(${hue}, 70%, 30%)`;

  // Avatar HTML
  const avatarHtml = profileAvatar 
    ? `<img src="${escapeHtml(profileAvatar)}" alt="${escapeHtml(userLabel)}" style="width: 100%; height: 100%; object-fit: cover; border-radius: inherit;" onerror="this.style.display='none'; this.nextElementSibling.style.display='block';"> <span style="display:none">${initial}</span>`
    : initial;
  
  // Icons
  const icons = {
    home: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 12l2-2m0 0l7-7 7 7M5 10v10a1 1 0 001 1h3m10-11l2 2m-2-2v10a1 1 0 01-1 1h-3m-6 0a1 1 0 001-1v-4a1 1 0 011-1h2a1 1 0 011 1v4a1 1 0 001 1m-6 0h6" /></svg>`,
    movies: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" /></svg>`,
    series: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9.75 17L9 20l-1 1h8l-1-1-.75-3M3 13h18M5 17h14a2 2 0 002-2V5a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z" /></svg>`,
    search: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" /></svg>`,
    profile: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>`,
    settings: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" /><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" /></svg>`,
    switch: `<svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M8 7h12m0 0l-4-4m4 4l-4 4m0 6H4m0 0l4 4m-4-4l4-4" /></svg>`
  };

  header.innerHTML = `
    <div class="app-header">
      <div class="container header-inner">
        <a class="brand" href="./dashboard.html">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 220 80" preserveAspectRatio="xMinYMid slice" fill="none" class="brand-logo">
            <g class="brand-icon-group">
              <path d="M20 15 L 20 65 L 60 40 Z" fill="none" stroke="#A855F7" stroke-width="10" stroke-linejoin="round" stroke-linecap="round"/>
              <rect x="155" y="15" width="6" height="6" rx="1" fill="#A855F7" class="brand-dots" />
              <rect x="163" y="8" width="6" height="6" rx="1" fill="#A855F7" class="brand-dots" />
              <rect x="148" y="22" width="4" height="4" rx="1" fill="#A855F7" opacity="0.8" class="brand-dots" />
            </g>
            <g class="brand-text-group">
              <text x="75" y="52" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-weight="800" font-size="42" fill="currentColor">Klyx</text>
              <text x="78" y="72" font-family="system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif" font-weight="600" font-size="13" fill="currentColor" opacity="0.8" letter-spacing="4">IPTV</text>
            </g>
          </svg>
        </a>
        <nav class="nav" aria-label="Primary">
          <a href="./dashboard.html" data-path="/dashboard" class="nav-item-home focusable" translate="no">
            <span class="nav-icon">${icons.home}</span>
            <span class="nav-text">Início</span>
          </a>
          <a href="./movies.html" data-path="/movies" class="focusable" translate="no">
            <span class="nav-icon">${icons.movies}</span>
            <span class="nav-text">Filmes</span>
          </a>
          <a href="./series.html" data-path="/series" class="focusable" translate="no">
            <span class="nav-icon">${icons.series}</span>
            <span class="nav-text">Séries</span>
          </a>
        </nav>
        <div class="header-actions">
          <div class="profile-dropdown-container">
            <button id="switchProfileBtn" class="profile-avatar-btn focusable" type="button" title="${escapeHtml(userLabel)}" style="background-color: ${avatarColor};">${avatarHtml}</button>
            <div id="profileDropdown" class="profile-dropdown hidden">
              <a href="./profile.html" class="dropdown-item focusable">
                <span class="dropdown-icon">${icons.profile}</span>
                Perfil
              </a>
              <a href="./settings.html" class="dropdown-item focusable">
                <span class="dropdown-icon">${icons.settings}</span>
                Configurações
              </a>
              <a href="./profile-selection.html" class="dropdown-item focusable">
                <span class="dropdown-icon">${icons.switch}</span>
                Trocar Perfil
              </a>
              <div class="dropdown-divider"></div>
              <button id="logoutBtn" class="dropdown-item dropdown-danger focusable" type="button">
                <span class="dropdown-icon">
                  <svg width="20" height="20" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M17 16l4-4m0 0l-4-4m4 4H7m6 4v1a3 3 0 01-3 3H6a3 3 0 01-3-3V7a3 3 0 013-3h4a3 3 0 013 3v1" />
                  </svg>
                </span>
                Sair
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  `;

  const links = header.querySelectorAll(".nav a");
  links.forEach((a) => {
    const path = a.getAttribute("data-path");
    if (path === currentPath) a.setAttribute("aria-current", "page");
  });

  // Profile Dropdown Logic
  const profileBtn = document.getElementById("switchProfileBtn");
  const dropdown = document.getElementById("profileDropdown");
  
  // Toggle dropdown
  profileBtn?.addEventListener("click", (e) => {
    e.stopPropagation();
    dropdown?.classList.toggle("hidden");
  });

  // Close dropdown when clicking outside
  document.addEventListener("click", (e) => {
    if (!profileBtn?.contains(e.target) && !dropdown?.contains(e.target)) {
      dropdown?.classList.add("hidden");
    }
  });

  const btn = document.getElementById("logoutBtn");
  btn?.addEventListener("click", async () => {
    localStorage.removeItem("klyx_profile_id");
    localStorage.removeItem("klyx_profile_name");
    localStorage.removeItem("klyx_profile_avatar");
    if (api.auth.logout) {
        await api.auth.logout();
    } else {
        api.session.clear();
    }
    window.location.href = "./index.html";
  });
  
  const switchBtn = document.getElementById("switchProfileBtn");
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}
