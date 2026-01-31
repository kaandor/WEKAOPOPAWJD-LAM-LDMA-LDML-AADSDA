import { api } from "./api.js?v=20240130";
import { requireAuth } from "./auth.js";

// Ensure user is logged in
const session = await requireAuth();
if (!session) {
  throw new Error("Not authenticated");
}

// Elements
const grid = document.getElementById("profilesGrid");
const manageBtn = document.getElementById("manageProfilesBtn");
const logoutBtn = document.getElementById("logoutBtn");

// Profile Modal Elements
const profileModal = document.getElementById("profileModal");
const modalTitle = document.getElementById("modalTitle");
const profileNameInput = document.getElementById("profileName");
const profileAgeInput = document.getElementById("profileAge");
const modalAvatarPreview = document.getElementById("modalAvatarPreview");
const changeAvatarBtn = document.getElementById("changeAvatarBtn");
const deleteProfileBtn = document.getElementById("deleteProfileBtn");
const cancelProfileBtn = document.getElementById("cancelProfileBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");

// Icon Selector Elements
const iconSelectorModal = document.getElementById("iconSelectorModal");
const iconGrid = document.getElementById("iconGrid");
const cancelIconBtn = document.getElementById("cancelIconBtn");

// State
let profiles = [];
let isManageMode = false;
let currentEditingProfileId = null;
let selectedAvatarUrl = "";

// Constants
const DICEBEAR_BASE = "https://api.dicebear.com/7.x";
const AVATAR_STYLES = ["avataaars", "bottts", "fun-emoji", "adventurer", "big-ears"];
// Generate 100 icons (20 of each style)
const AVAILABLE_ICONS = [];
for (const style of AVATAR_STYLES) {
    for (let i = 0; i < 20; i++) {
        AVAILABLE_ICONS.push(`${DICEBEAR_BASE}/${style}/svg?seed=icon${i}_${style}`);
    }
}

// Init
async function init() {
    await loadProfiles();
    setupEventListeners();
    generateIconGrid();
}

async function loadProfiles() {
    try {
        const res = await api.profiles.list();
        if (res.ok) {
            profiles = res.data;
            if (!Array.isArray(profiles) && profiles.profiles) {
                profiles = profiles.profiles;
            }
            render();
        } else {
            console.error("Error loading profiles", res);
        }
    } catch (e) {
        console.error("Network error", e);
    }
}

function render() {
    grid.innerHTML = "";
    
    // Determine limit based on plan
    const user = session.user;
    const plan = user?.plan || "premium"; // Default to premium
    const maxProfiles = plan === "individual" ? 1 : 4;
    
    profiles.forEach(p => {
        const card = document.createElement("div");
        card.className = `profile-card ${isManageMode ? 'edit-mode' : ''}`;
        
        const avatar = document.createElement("div");
        avatar.className = "avatar";
        avatar.style.backgroundImage = `url('${p.avatar}')`;
        
        const overlay = document.createElement("div");
        overlay.className = "edit-overlay";
        overlay.innerHTML = '<div class="edit-icon">✎</div>';
        
        const name = document.createElement("div");
        name.className = "name";
        name.textContent = p.name;
        
        card.append(avatar, overlay, name);
        
        card.addEventListener("click", () => {
            if (isManageMode) {
                openEditModal(p);
            } else {
                selectProfile(p);
            }
        });
        
        grid.append(card);
    });
    
    // Add Profile Button (only if below limit)
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
        addCard.addEventListener("click", () => {
            if (isManageMode) {
                // If in manage mode, maybe still allow adding? Yes.
                openCreateModal();
            } else {
                openCreateModal();
            }
        });
        
        grid.append(addCard);
    }
    
    // Update manage button state
    if (isManageMode) {
        manageBtn.textContent = "Concluir";
        manageBtn.classList.add("active");
    } else {
        manageBtn.textContent = "Gerenciar Perfis";
        manageBtn.classList.remove("active");
    }
}

function selectProfile(profile) {
    console.log("Selecting profile:", profile.name);
    api.profiles.setCurrent(profile.id);
    localStorage.setItem("klyx_profile_name", profile.name);
    localStorage.setItem("klyx_profile_avatar", profile.avatar);
    
    // Redirect
    window.location.href = "./dashboard.html";
}

// Modal Functions
function openCreateModal() {
    currentEditingProfileId = null;
    modalTitle.textContent = "Adicionar Perfil";
    profileNameInput.value = "";
    profileAgeInput.value = "18"; // Default
    
    // Random default avatar
    const randomIcon = AVAILABLE_ICONS[Math.floor(Math.random() * AVAILABLE_ICONS.length)];
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
    profileAgeInput.value = profile.age || "18";
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
    
    const age = parseInt(profileAgeInput.value);
    
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = "Salvando...";
    
    try {
        let res;
        if (currentEditingProfileId) {
            // Update
            res = await api.profiles.update(currentEditingProfileId, {
                name,
                age,
                avatar: selectedAvatarUrl
            });
        } else {
            // Create
            res = await api.profiles.create({
                name,
                age,
                avatar: selectedAvatarUrl
            });
        }
        
        if (res.ok) {
            closeModal();
            await loadProfiles();
        } else {
            alert(res.data?.error || "Erro ao salvar perfil");
        }
    } catch (e) {
        console.error(e);
        alert("Erro ao salvar perfil");
    } finally {
        saveProfileBtn.disabled = false;
        saveProfileBtn.textContent = "Salvar";
    }
}

async function deleteProfile() {
    if (!currentEditingProfileId) return;
    
    if (!confirm("Tem certeza que deseja excluir este perfil? Esta ação não pode ser desfeita.")) {
        return;
    }
    
    try {
        const res = await api.profiles.delete(currentEditingProfileId);
        if (res.ok) {
            closeModal();
            await loadProfiles();
        } else {
            alert(res.data?.error || "Erro ao excluir perfil");
        }
    } catch (e) {
        console.error(e);
        alert("Erro ao excluir perfil");
    }
}

// Icon Selector
function generateIconGrid() {
    iconGrid.innerHTML = "";
    AVAILABLE_ICONS.forEach(iconUrl => {
        const img = document.createElement("div");
        img.className = "icon-option";
        img.style.backgroundImage = `url('${iconUrl}')`;
        img.onclick = () => {
            selectedAvatarUrl = iconUrl;
            modalAvatarPreview.style.backgroundImage = `url('${selectedAvatarUrl}')`;
            closeIconModal();
        };
        iconGrid.append(img);
    });
}

function openIconModal() {
    iconSelectorModal.classList.remove("hidden");
}

function closeIconModal() {
    iconSelectorModal.classList.add("hidden");
}

// Event Listeners
function setupEventListeners() {
    manageBtn.addEventListener("click", () => {
        isManageMode = !isManageMode;
        render();
    });
    
    logoutBtn.addEventListener("click", async () => {
        await api.auth.logout();
        window.location.href = "./index.html";
    });
    
    cancelProfileBtn.addEventListener("click", closeModal);
    saveProfileBtn.addEventListener("click", saveProfile);
    deleteProfileBtn.addEventListener("click", deleteProfile);
    
    changeAvatarBtn.addEventListener("click", openIconModal);
    modalAvatarPreview.addEventListener("click", openIconModal);
    cancelIconBtn.addEventListener("click", closeIconModal);
    
    // Enter key to save
    profileNameInput.addEventListener("keydown", (e) => {
        if (e.key === "Enter") saveProfile();
    });
}

init();