import { api } from "./api.js?v=20260204-fix1";
import "./ui.js?v=20260204-fix1";

// Estado
let profiles = [];
let isManageMode = false;

// Elementos da tela
const grid = document.getElementById("profilesGrid");
const manageBtn = document.getElementById("manageProfilesBtn");
const logoutBtn = document.getElementById("logoutBtn");

// Modal de perfil
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

const iconSelectorModal = document.getElementById("iconSelectorModal");
const iconGrid = document.getElementById("iconGrid");
const cancelIconBtn = document.getElementById("cancelIconBtn");

let currentEditingProfileId = null;
let selectedAvatarUrl = "";

// Avatares
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

// INIT chamado pelo HTML
export async function initProfileSelection() {
  await loadProfiles();
  setupEventListeners();
  generateIconGrid(false);
}

// Carrega lista de perfis (ou cria Perfil 1 se estiver vazio)
async function loadProfiles() {
  try {
    let res = await api.profiles.list();
    if (res && res.ok && Array.isArray(res.data)) {
      profiles = res.data;
    } else {
      profiles = [];
    }

    // se não tiver nenhum perfil, cria "Perfil 1"
    if (profiles.length === 0) {
      try {
        const createRes = await api.profiles.create({
          name: "Perfil 1",
          avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Perfil1",
          isKid: false
        });
        if (createRes && createRes.ok && createRes.data) {
          profiles = [createRes.data];
        } else {
          profiles = [];
        }
      } catch (e) {
        console.warn("Erro criando perfil padrão", e);
      }
    }

    render();
  } catch (e) {
    console.error("Erro ao carregar perfis", e);
    profiles = [];
    render();
  }
}

// Desenha os cards na tela
function render() {
  if (!grid) return;
  grid.innerHTML = "";

  profiles = profiles.filter(p => p && p.id);

  // cards de perfis
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
    name.textContent = p.name || "Perfil";

    card.append(avatar, overlay, name);

    card.addEventListener("click", () => {
      if (isManageMode) openEditModal(p);
      else selectProfile(p);
    });

    grid.append(card);
  });

  // botão "Adicionar Perfil" (limite 4)
  const maxProfiles = 4;
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

  if (manageBtn) {
    manageBtn.textContent = isManageMode ? "Concluir" : "Gerenciar Perfis";
    manageBtn.classList.toggle("active", isManageMode);
  }
}

// Seleciona perfil e vai para dashboard
function selectProfile(profile) {
  try {
    api.profiles.setCurrent(profile.id);
  } catch (e) {
    console.warn("Erro ao setar perfil atual", e);
  }
  localStorage.setItem("klyx_profile_name", profile.name || "");
  localStorage.setItem("klyx_profile_avatar", profile.avatar || "");
  window.location.href = "./dashboard.html";
}

// Modal criar perfil
function openCreateModal() {
  currentEditingProfileId = null;
  modalTitle.textContent = "Adicionar Perfil";
  profileNameInput.value = "";

  if (kidProfileSection) kidProfileSection.classList.remove("hidden");
  if (profileIsKid) profileIsKid.checked = false;

  if (pinSection) pinSection.classList.add("hidden");
  if (profilePinInput) profilePinInput.value = "";

  const icons = getAvailableIcons(false);
  const randomIcon = icons[Math.floor(Math.random() * icons.length)];
  selectedAvatarUrl = randomIcon;
  if (modalAvatarPreview) {
    modalAvatarPreview.style.backgroundImage = `url('${selectedAvatarUrl}')`;
  }

  if (deleteProfileBtn) deleteProfileBtn.classList.add("hidden");
  if (profileModal) profileModal.classList.remove("hidden");
  if (profileNameInput) profileNameInput.focus();
}

// Modal editar perfil
function openEditModal(profile) {
  currentEditingProfileId = profile.id;
  modalTitle.textContent = "Editar Perfil";
  profileNameInput.value = profile.name || "";

  if (profileIsKid) profileIsKid.checked = !!profile.isKid;
  if (pinSection) pinSection.classList.add("hidden");
  if (profilePinInput) profilePinInput.value = "";

  selectedAvatarUrl = profile.avatar || "";
  if (modalAvatarPreview) {
    modalAvatarPreview.style.backgroundImage = `url('${selectedAvatarUrl}')`;
  }

  if (deleteProfileBtn) deleteProfileBtn.classList.remove("hidden");
  if (profileModal) profileModal.classList.remove("hidden");
}

function closeModal() {
  if (profileModal) profileModal.classList.add("hidden");
}

// Salva perfil (criar/editar)
async function saveProfile() {
  const name = profileNameInput.value.trim();
  if (!name) return;

  const isKid = profileIsKid ? profileIsKid.checked : false;

  try {
    let res;
    const payload = { name, avatar: selectedAvatarUrl, isKid };

    if (currentEditingProfileId) {
      res = await api.profiles.update(currentEditingProfileId, payload);
    } else {
      res = await api.profiles.create(payload);
    }

    if (res && res.ok) {
      closeModal();
      await loadProfiles();
    } else {
      alert("Erro ao salvar perfil");
    }
  } catch (e) {
    console.error(e);
    alert("Erro ao salvar perfil");
  }
}

// Excluir perfil
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
    console.error(e);
    alert("Erro ao excluir perfil");
  }
}

function generateIconGrid(isKid) {
  const icons = getAvailableIcons(isKid);
  if (!iconGrid) return;

  iconGrid.innerHTML = "";
  icons.forEach(url => {
    const div = document.createElement("div");
    div.className = "icon-option";
    div.style.backgroundImage = `url('${url}')`;
    div.onclick = () => {
      selectedAvatarUrl = url;
      if (modalAvatarPreview) {
        modalAvatarPreview.style.backgroundImage = `url('${selectedAvatarUrl}')`;
      }
      if (iconSelectorModal) {
        iconSelectorModal.classList.add("hidden");
      }
    };
    iconGrid.append(div);
  });

  if (iconSelectorModal) {
    iconSelectorModal.classList.remove("hidden");
  }
}

  if (iconSelectorModal) {
    iconSelectorModal.classList.remove("hidden");
  }
}

// Eventos
function setupEventListeners() {
  if (manageBtn) {
    manageBtn.addEventListener("click", () => {
      isManageMode = !isManageMode;
      render();
    });
  }

  if (logoutBtn) {
    logoutBtn.addEventListener("click", async () => {
      try {
        await api.auth.logout();
      } catch (e) {}
      window.location.href = "./index.html";
    });
  }

  if (cancelProfileBtn) cancelProfileBtn.addEventListener("click", closeModal);
  if (saveProfileBtn) saveProfileBtn.addEventListener("click", saveProfile);
  if (deleteProfileBtn) deleteProfileBtn.addEventListener("click", deleteProfile);

  if (changeAvatarBtn) {
    changeAvatarBtn.addEventListener("click", () => {
      const isKid = profileIsKid ? profileIsKid.checked : false;
      generateIconGrid(isKid);
    });
  }

  if (cancelIconBtn) {
    cancelIconBtn.addEventListener("click", () => {
      if (iconSelectorModal) {
        iconSelectorModal.classList.add("hidden");
      }
    });
  }

  if (profileNameInput) {
    profileNameInput.addEventListener("keydown", (e) => {
      if (e.key === "Enter") saveProfile();
    });
  }

  if (profileIsKid) {
    profileIsKid.addEventListener("change", () => {
      const isKid = profileIsKid.checked;
      const icons = getAvailableIcons(isKid);
      const randomIcon = icons[Math.floor(Math.random() * icons.length)];
      selectedAvatarUrl = randomIcon;
      if (modalAvatarPreview) {
        modalAvatarPreview.style.backgroundImage = `url('${selectedAvatarUrl}')`;
      }
    });
  }
}