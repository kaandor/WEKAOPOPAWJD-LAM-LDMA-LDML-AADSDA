import { api } from "./api.js?v=20260204-fix1";
import "./ui.js?v=20260204-fix1";

applyGlobalTheme();
let session = api.session.read() || null;

const grid = document.getElementById("profilesGrid");
const manageBtn = document.getElementById("manageProfilesBtn");
const logoutBtn = document.getElementById("logoutBtn");

const profileModal = document.getElementById("profileModal");
const modalTitle = document.getElementById("modalTitle");
const profileNameInput = document.getElementById("profileName");
const kidProfileSection = document.getElementById("kidProfileSection");
const profileIsKid = document.getElementById("profileIsKid");
const pinSection = document.getElementById("pinSection");
const profilePinInput = document.getElementById("profilePin");

const modalAvatarPreview = document.getElementById("modalAvatarPreview");
const changeAvatarBtn = document.getElementById("changeAvatarBtn");
const deleteProfileBtn = document.getElementById("deleteProfileBtn");
const cancelProfileBtn = document.getElementById("cancelProfileBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");

let profiles = [];
let isManageMode = false;
let currentEditingProfileId = null;
let selectedAvatarUrl = "";

const DICEBEAR_BASE = "https://api.dicebear.com/7.x";
const ADULT_STYLES = ["avataaars", "big-ears", "lorelei", "micah"];
const KID_STYLES = ["fun-emoji", "bottts", "adventurer", "thumbs"];

function getAvailableIcons(isKid) {
  const styles = isKid ? KID_STYLES : ADULT_STYLES;
  const icons = [];
  for (const style of styles) {
    for (let i = 0; i < 20; i++) {
      icons.push(`${DICEBEAR_BASE}/${style}/svg?seed=icon${i}_${style}`);
    }
  }
  return icons;
}

export async function initProfileSelection() {
  session = api.session.read() || null;
  await loadProfiles();
  setupEventListeners();
  generateIconGrid(false);
}

async function loadProfiles() {
  try {
    const res = await api.profiles.list();
    if (res && res.ok) {
      profiles = res.data;
      if (!Array.isArray(profiles) && profiles && profiles.profiles) {
        profiles = profiles.profiles;
      }
      if (!Array.isArray(profiles)) profiles = [];
    } else {
      profiles = [];
    }
    render();
  } catch (e) {
    profiles = [];
    render();
  }
}

function render() {
  grid.innerHTML = "";
  profiles = profiles.filter(p => p && p.id);

  if (profiles.length === 0) {
    const defaultProfile = {
      id: "p" + Date.now(),
      name: "Perfil 1",
      avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Perfil1",
      isKid: false,
      created_at: new Date().toISOString()
    };
    profiles.push(defaultProfile);

    const user = session && session.user ? session.user : null;
    const key = user ? `klyx.profiles.${user.id}` : "klyx.profiles";
    localStorage.setItem(key, JSON.stringify(profiles));
  }

  const user = session && session.user ? session.user : null;
  const plan = user && user.plan ? user.plan : "premium";
  const maxProfiles = plan === "individual" ? 1 : 4;

  profiles.forEach(p => {
    const card = document.createElement("div");
    card.className = `profile-card ${isManageMode ? "edit-mode" : ""}`;

    const avatar = document.createElement("div");
    avatar.className = "avatar";
    const avatarUrl = p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name || "User"}`;
    avatar.style.backgroundImage = `url('${avatarUrl}')`;

    const overlay = document.createElement("div");
    overlay.className = "edit-overlay";
    overlay.innerHTML = '<div class="edit-icon">✎</div>';

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = p.name;

    card.append(avatar, overlay, name);
    card.addEventListener("click", () => {
      if (isManageMode) openEditModal(p);
      else selectProfile(p);
    });

    grid.append(card);
  });

  if (profiles.length < maxProfiles) {
    const addCard = document.createElement("div");
    addCard.className = "profile-card";

    const addAvatar = document.createElement("div");
    addAvatar.className = "avatar add-profile";
    addAvatar.innerHTML = "+";

    const addName = document.createElement("div");
    addName.className = "name";
    addName.textContent = "Adicionar Perfil";

    addCard.append(addAvatar, addName);
    addCard.addEventListener("click", () => openCreateModal());
    grid.append(addCard);
  }

  manageBtn.textContent = isManageMode ? "Concluir" : "Gerenciar Perfis";
  manageBtn.classList.toggle("active", isManageMode);
}

function selectProfile(profile) {
  api.profiles.setCurrent(profile.id);
  localStorage.setItem("klyx_profile_name", profile.name);
  localStorage.setItem("klyx_profile_avatar", profile.avatar);
  window.location.href = "./dashboard.html";
}

function openCreateModal() {
  currentEditingProfileId = null;
  modalTitle.textContent = "Adicionar Perfil";
  profileNameInput.value = "";
  kidProfileSection.classList.remove("hidden");
  profileIsKid.checked = false;
  pinSection.classList.add("hidden");
  profilePinInput.value = "";
  const icons = getAvailableIcons(false);
  const randomIcon = icons[Math.floor(Math.random() * icons.length)];
  selectedAvatarUrl = randomIcon;
  modalAvatarPreview.style.backgroundImage = `url('${selectedAvatarUrl}')`;
  deleteProfileBtn.classList.add("hidden");
  profileModal.classList.remove("hidden");
  profileNameInput.focus();
}

function openEditModal(profile) {
  currentEditingProfileId = profile.id;
  modalTitle.textContent = "Editar Perfil";
  profileNameInput.value = profile.name;
  profileIsKid.checked = !!profile.isKid;
  pinSection.classList.add("hidden");
  profilePinInput.value = "";
  selectedAvatarUrl = profile.avatar;
  modalAvatarPreview.style.backgroundImage = `url('${selectedAvatarUrl}')`;
  deleteProfileBtn.classList.remove("hidden");
  profileModal.classList.remove("hidden");
}

function closeModal() {
  profileModal.classList.add("hidden");
}

async function saveProfile() {
  const name = profileNameInput.value.trim();
  if (!name) return;
  const isKid = profileIsKid.checked;

  try {
    let res;
    const payload = { name, avatar: selectedAvatarUrl, isKid };
    if (currentEditingProfileId) res = await api.profiles.update(currentEditingProfileId, payload);
    else res = await api.profiles.create(payload);

    if (res && res.ok) {
      closeModal();
      await loadProfiles();
    } else {
      alert("Erro ao salvar perfil");
    }
  } catch (e) {
    alert("Erro ao salvar perfil");
  }
}

async function deleteProfile() {
  if (!currentEditingProfileId) return;
  if (!confirm("Tem certeza que deseja excluir este perfil?")) return;
  try {
    const res = await api.profiles.delete(currentEditingProfileId);
    if (res && res.ok) {
      closeModal();
      await loadProfiles();
    } else {
      alert("Erro ao excluir perfil");
    }
  } catch (e) {
    alert("Erro ao excluir perfil");
  }
}

function getAvailableIconsAndSet(isKid) {
  const icons = getAvailableIcons(isKid);
  const randomIcon = icons[Math.floor(Math.random() * icons.length)];
  selectedAvatarUrl = randomIcon;
  modalAvatarPreview.style.backgroundImage = `url('${selectedAvatarUrl}')`;
}

function generateIconGrid(isKid) {
  const icons = getAvailableIcons(isKid);
  const iconGrid = document.getElementById("iconGrid");
  if (!iconGrid) return;
  iconGrid.innerHTML = "";
  icons.forEach(url => {
    const img = document.createElement("div");
    img.className = "icon-option";
    img.style.backgroundImage = `url('${url}')`;
    img.onclick = () => {
      selectedAvatarUrl = url;
      modalAvatarPreview.style.backgroundImage = `url('${selectedAvatarUrl}')`;
    };
    iconGrid.append(img);
  });
}

function setupEventListeners() {
  if (manageBtn) {
    manageBtn.addEventListener("click", () => {
      isManageMode = !isManageMode;
      render();
    });
  }
  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      await api.auth.logout();
      window.location.href = "./index.html";
    });
  }
  if (cancelProfileBtn) cancelProfileBtn.addEventListener("click", closeModal);
  if (saveProfileBtn) saveProfileBtn.addEventListener("click", saveProfile);
  if (deleteProfileBtn) deleteProfileBtn.addEventListener("click", deleteProfile);
  if (changeAvatarBtn && modalAvatarPreview) {
    changeAvatarBtn.addEventListener("click", () => {
      getAvailableIconsAndSet(profileIsKid && profileIsKid.checked);
    });
  }
}
