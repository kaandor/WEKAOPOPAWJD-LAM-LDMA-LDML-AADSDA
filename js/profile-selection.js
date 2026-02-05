import { api } from "./api.js?v=20260201-db2";
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
// Age input removed
const kidProfileSection = document.getElementById("kidProfileSection");
const profileIsKid = document.getElementById("profileIsKid");
const pinSection = document.getElementById("pinSection");
const profilePinInput = document.getElementById("profilePin");

const modalAvatarPreview = document.getElementById("modalAvatarPreview");
const changeAvatarBtn = document.getElementById("changeAvatarBtn");
const deleteProfileBtn = document.getElementById("deleteProfileBtn");
const cancelProfileBtn = document.getElementById("cancelProfileBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");

// PIN Verification Modal (Created dynamically)
let pinVerificationCallback = null;
const pinModal = document.createElement("div");
pinModal.id = "pinVerificationModal";
// Use inline styles to guarantee centering regardless of Tailwind issues
pinModal.style.cssText = `
    position: fixed;
    top: 0;
    left: 0;
    width: 100%;
    height: 100%;
    background-color: rgba(0, 0, 0, 0.9);
    display: none;
    align-items: center;
    justify-content: center;
    z-index: 9999;
`;
pinModal.innerHTML = `
    <div class="bg-[#1a1a1a] p-8 rounded-lg w-full max-w-sm border border-gray-800 text-center relative">
        <h3 class="text-xl font-bold text-white mb-4">Digite o Código de Segurança</h3>
        <p class="text-gray-400 text-sm mb-6">Esta ação requer autorização.</p>
        <input type="password" id="verificationPin" maxlength="4" class="w-full bg-gray-800 text-white text-center text-3xl tracking-[0.5em] rounded p-4 mb-6 focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="0000">
        <div class="flex gap-3">
            <button id="cancelPinBtn" class="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Cancelar</button>
            <button id="submitPinBtn" class="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Confirmar</button>
        </div>
    </div>
`;
document.body.appendChild(pinModal);

const verificationPinInput = pinModal.querySelector("#verificationPin");
pinModal.querySelector("#cancelPinBtn").onclick = () => {
    pinModal.style.display = "none";
    verificationPinInput.value = "";
    pinVerificationCallback = null;
};
pinModal.querySelector("#submitPinBtn").onclick = () => verifyPin();
verificationPinInput.onkeydown = (e) => { if (e.key === "Enter") verifyPin(); };

function verifyPin() {
    const pin = verificationPinInput.value;
    if (pinVerificationCallback) {
        pinVerificationCallback(pin);
    }
}

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
export async function init() {
    await loadProfiles();
    setupEventListeners();
    generateIconGrid();
}

async function loadProfiles() {
    try {
        // Force Cloud Sync (Hive Mind) - Best Effort
        const loadingDiv = document.createElement("div");
        loadingDiv.id = "sync-loading";
        loadingDiv.style.cssText = "position:fixed;top:10px;right:10px;background:#9333ea;color:white;padding:5px 10px;border-radius:4px;z-index:9999;font-size:12px;";
        loadingDiv.textContent = "☁️ Sincronizando...";
        document.body.appendChild(loadingDiv);
        
        try {
            await api.cloud.syncDown();
        } catch (syncError) {
            console.warn("Sync failed, proceeding with local data:", syncError);
        } finally {
             if (document.body.contains(loadingDiv)) document.body.removeChild(loadingDiv);
        }

        const res = await api.profiles.list();
        if (res.ok) {
            profiles = res.data;
            if (!Array.isArray(profiles) && profiles.profiles) {
                profiles = profiles.profiles;
            }
        } else {
            console.error("Error loading profiles", res);
            profiles = []; // Ensure empty array on error
        }
        
        // Always render, even if empty (will show Add Profile button)
        render();
        
    } catch (e) {
        console.error("Critical error loading profiles", e);
        profiles = [];
        render(); // Fallback render
    }
}

function render() {
    grid.innerHTML = "";
    
    // Filter out invalid profiles to prevent ghost slots
    profiles = profiles.filter(p => p && p.id);

    // RESTORE/RECOVERY: If no profiles exist (wiped or sync error), create a default one immediately
    if (profiles.length === 0) {
        console.warn("No profiles found! Creating default 'Perfil 1'...");
        const defaultProfile = {
            id: "p" + Date.now(),
            name: "Perfil 1",
            avatar: "https://api.dicebear.com/7.x/avataaars/svg?seed=Perfil1",
            age: 18,
            isKid: false,
            allowExplicit: false,
            created_at: new Date().toISOString()
        };
        profiles.push(defaultProfile);
        
        // Save back to storage immediately so it persists
        const user = session.user;
        const key = user ? `klyx.profiles.${user.id}` : "klyx.profiles";
        localStorage.setItem(key, JSON.stringify(profiles));
        
        // SYNC TO CLOUD (Database)
        if (api.cloud && api.cloud.syncUp) {
            console.log("⚡ Syncing default profile to Cloud DB...");
            api.cloud.syncUp().catch(e => console.error("Default profile sync failed", e));
        }
    }
    
    // Determine limit based on plan
    const user = session.user;
    const plan = user?.plan || "premium"; // Default to premium
    const maxProfiles = plan === "individual" ? 1 : 4;
    
    profiles.forEach(p => {
        if (!p) return; // Skip invalid profiles

        const card = document.createElement("div");
        card.className = `profile-card ${isManageMode ? 'edit-mode' : ''}`;
        
        const avatar = document.createElement("div");
        avatar.className = "avatar";
        // Fallback for missing avatar
        const avatarUrl = p.avatar || `https://api.dicebear.com/7.x/avataaars/svg?seed=${p.name || 'User'}`;
        avatar.style.backgroundImage = `url('${avatarUrl}')`;
        
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
             openCreateModal();
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

function promptPinVerification(title, callback) {
    verificationPinInput.value = "";
    pinModal.querySelector("h3").textContent = title || "Digite o PIN";
    pinModal.style.display = "flex";
    verificationPinInput.focus();
    
    pinVerificationCallback = (pin) => {
        pinModal.style.display = "none";
        callback(pin);
    };
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
    // Age removed
    
    // Reset kid profile field
    kidProfileSection.classList.remove("hidden"); 
    profileIsKid.checked = false;
    
    // Hide manual PIN input
    pinSection.classList.add("hidden");
    profilePinInput.value = ""; 
    
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
    // Age removed
    
    // Set kid profile fields
    profileIsKid.checked = !!profile.isKid;
    
    // Hide manual PIN input
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

    const performSave = async () => {
        saveProfileBtn.disabled = true;
        saveProfileBtn.textContent = "Salvando...";
        
        try {
            let res;
            const profileData = {
                name,
                avatar: selectedAvatarUrl,
                isKid
            };

            if (currentEditingProfileId) {
                // Update
                res = await api.profiles.update(currentEditingProfileId, profileData);
                if (res.ok && api.activity) api.activity.log("PROFILE_UPDATE", { name: profileData.name });
            } else {
                // Create
                res = await api.profiles.create(profileData);
                if (res.ok && api.activity) api.activity.log("PROFILE_CREATE", { name: profileData.name });
            }
            
            if (res.ok) {
                closeModal();
                await loadProfiles();
                // FORCE INSTANT SYNC (Bypass Debounce)
                if (api.cloud && api.cloud.syncUp) {
                    console.log("⚡ Forcing Instant Cloud Sync...");
                    await api.cloud.syncUp();
                }
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
    };

    performSave();
}

async function deleteProfile() {
    if (!currentEditingProfileId) return;
    
    if (!confirm("Tem certeza que deseja excluir este perfil? Esta ação não pode ser desfeita.")) {
        return;
    }
    
    try {
        const res = await api.profiles.delete(currentEditingProfileId);
        if (res.ok) {
            if (api.activity) api.activity.log("PROFILE_DELETE", { id: currentEditingProfileId });
            closeModal();
            await loadProfiles();
            // FORCE INSTANT SYNC
            if (api.cloud && api.cloud.syncUp) {
                console.log("⚡ Forcing Instant Cloud Sync (Delete)...");
                await api.cloud.syncUp();
            }
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
    if (!manageBtn) {
        console.error("Manage Profiles button not found!");
        return;
    }

    manageBtn.addEventListener("click", () => {
        console.log("Manage Profiles clicked. Mode:", !isManageMode);
        isManageMode = !isManageMode;
        render();
    });
    
    if (logoutBtn) {
        logoutBtn.addEventListener("click", async () => {
            await api.auth.logout();
            window.location.href = "./index.html";
        });
    }
    
    if (cancelProfileBtn) cancelProfileBtn.addEventListener("click", closeModal);
    if (saveProfileBtn) saveProfileBtn.addEventListener("click", saveProfile);
    if (deleteProfileBtn) deleteProfileBtn.addEventListener("click", deleteProfile);
    
    if (changeAvatarBtn) changeAvatarBtn.addEventListener("click", openIconModal);
    if (modalAvatarPreview) modalAvatarPreview.addEventListener("click", openIconModal);
    if (cancelIconBtn) cancelIconBtn.addEventListener("click", closeIconModal);
    
    // Enter key to save
    if (profileNameInput) {
        profileNameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") saveProfile();
        });
    }
    
    // (Removed explicit toggle logic)
}
// init() called by importing module
