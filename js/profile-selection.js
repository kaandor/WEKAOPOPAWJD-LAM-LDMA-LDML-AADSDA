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
const adultContentSection = document.getElementById("adultContentSection");
const profileAllowExplicit = document.getElementById("profileAllowExplicit");
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
pinModal.className = "fixed inset-0 bg-black/90 flex items-center justify-center hidden z-[60]";
pinModal.innerHTML = `
    <div class="bg-[#1a1a1a] p-8 rounded-lg w-full max-w-sm border border-gray-800 text-center">
        <h3 class="text-xl font-bold text-white mb-4">Digite o PIN do Perfil</h3>
        <p class="text-gray-400 text-sm mb-6">Este perfil é protegido.</p>
        <input type="password" id="verificationPin" maxlength="4" class="w-full bg-gray-800 text-white text-center text-3xl tracking-[0.5em] rounded p-4 mb-6 focus:outline-none focus:ring-2 focus:ring-purple-600" placeholder="0000">
        <div class="flex gap-3">
            <button id="cancelPinBtn" class="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Cancelar</button>
            <button id="submitPinBtn" class="flex-1 px-4 py-2 bg-purple-600 text-white rounded hover:bg-purple-700">Entrar</button>
        </div>
    </div>
`;
document.body.appendChild(pinModal);

const verificationPinInput = pinModal.querySelector("#verificationPin");
pinModal.querySelector("#cancelPinBtn").onclick = () => {
    pinModal.classList.add("hidden");
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
                // Check if profile is locked (Explicit Content enabled)
                if (p.allowExplicit && p.pin) {
                    verificationPinInput.value = "";
                    pinModal.classList.remove("hidden");
                    verificationPinInput.focus();
                    
                    pinVerificationCallback = (pin) => {
                        if (pin === p.pin) {
                            pinModal.classList.add("hidden");
                            selectProfile(p);
                        } else {
                            alert("PIN incorreto.");
                            verificationPinInput.value = "";
                            verificationPinInput.focus();
                        }
                    };
                } else {
                    selectProfile(p);
                }
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
    
    // Reset adult content fields
    adultContentSection.classList.remove("hidden"); // Show by default if 18, check logic below
    profileAllowExplicit.checked = false;
    pinSection.classList.add("hidden");
    profilePinInput.value = "";
    
    // Trigger age change to set visibility
    profileAgeInput.dispatchEvent(new Event('change'));

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
    
    // Set adult content fields
    profileAllowExplicit.checked = !!profile.allowExplicit;
    profilePinInput.value = profile.pin || "";
    
    // Trigger age change to set visibility of section
    profileAgeInput.dispatchEvent(new Event('change'));
    
    // Trigger check change to set visibility of PIN
    profileAllowExplicit.dispatchEvent(new Event('change'));
    
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
    const allowExplicit = profileAllowExplicit.checked;
    const pin = profilePinInput.value.trim();
    
    if (allowExplicit && (!pin || pin.length !== 4)) {
        alert("Para ativar conteúdo adulto, você deve definir um PIN de 4 dígitos.");
        return;
    }
    
    saveProfileBtn.disabled = true;
    saveProfileBtn.textContent = "Salvando...";
    
    try {
        let res;
        if (currentEditingProfileId) {
            // Update
            res = await api.profiles.update(currentEditingProfileId, {
                name,
                age,
                avatar: selectedAvatarUrl,
                allowExplicit,
                pin
            });
        } else {
            // Create
            res = await api.profiles.create({
                name,
                age,
                avatar: selectedAvatarUrl,
                allowExplicit,
                pin
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
    
    // Age change logic
    profileAgeInput.addEventListener("change", (e) => {
        const age = parseInt(e.target.value);
        if (age >= 18) {
            adultContentSection.classList.remove("hidden");
        } else {
            adultContentSection.classList.add("hidden");
            profileAllowExplicit.checked = false; // Auto uncheck if under 18
            pinSection.classList.add("hidden");
            profilePinInput.value = "";
        }
    });
    
    // Explicit toggle logic
    profileAllowExplicit.addEventListener("change", (e) => {
        if (e.target.checked) {
            pinSection.classList.remove("hidden");
        } else {
            pinSection.classList.add("hidden");
        }
    });
}

init();