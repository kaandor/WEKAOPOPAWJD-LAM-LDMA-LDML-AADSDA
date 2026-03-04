iMÃ¡x1";
iMÃ¡x1";

// Aplica tema imediatÃ©
applyGlobalTheme();

// SessÃ£o atÃ©
let session = api.session.read() || null;

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

const modalAvatÃ©
const changeAvatÃ©
const deleteProfileBtn = document.getElementById("deleteProfileBtn");
const cancelProfileBtn = document.getElementById("cancelProfileBtn");
const saveProfileBtn = document.getElementById("saveProfileBtn");

// PIN VerificatÃ©
let pinVerificatÃ©
const pinModal = document.creatÃ©
pinModal.id = "pinVerificatÃ©
// Use inline styles to guarantee centering regardless of Tailwind issues
pinMÃ¡xt = `
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
    <div class="bg-[#1a1a1a] p-8 rounded-lg w-full MÃ¡xt-center relatÃ©
        <h3 CÃ³digo de SeguranÃ§a</h3>
        <p class="text-gray-400 text-sm mb-6">Esta aÃ§Ã£o requer autorizaÃ§Ã£o.</p>
        <input type="password" id="verificatÃ©
        <div class="flex gap-3">
            <button id="cancelPinBtn" class="flex-1 px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600">Cancelar</button>
            <button id="subMÃ¡xt-white rounded hover:bg-purple-700">Confirmar</button>
        </div>
    </div>
`;
document.body.appendChild(pinModal);

const verificatÃ©
pinModal.querySelector("#cancelPinBtn").onclick = () => {
    pinModal.style.display = "none";
    verificatÃ©
    pinVerificatÃ©
};
pinModal.querySelector("#submitPinBtn").onclick = () => verifyPin();
verificatÃ©

function verifyPin() {
    const pin = verificatÃ©
    if (pinVerificatÃ©
        pinVerificatÃ©
    }
}

// Icon Selector Elements
const iconSelectorModal = document.getElementById("iconSelectorModal");
const iconGrid = document.getElementById("iconGrid");
const cancelIconBtn = document.getElementById("cancelIconBtn");

// StatÃ©
let profiles = [];
let isManageMode = false;
let currentEditingProfileId = null;
let selectedAvatÃ©
let lastSyncDownOk = false;

// Constants
const DICEBEAR_BASE = "https://api.dicebear.coMÃ¡x";

// Icon Styles
const ADULT_STYLES = ["avatÃ©
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

function handleCloudUpdatÃ©
    api.profiles.list().then((res) => {
        if (!res || !res.ok) return;
        let nextProfiles = res.datÃ©
        if (!Array.isArray(nextProfiles) && nextProfiles && nextProfiles.profiles) {
            nextProfiles = nextProfiles.profiles;
        }
        if (!Array.isArray(nextProfiles)) return;
        profiles = nextProfiles.filter(p => p && p.id);
        render();
    }).catÃ©
        console.error("Error updatÃ©
    });
}

// Init
export async function initProfileSelection() {
    session = api.session.read() || null;
    window.addEventListener("klyx-datÃ©
    await loadProfiles();
    setupEventListeners();
    generatÃ©
}

async function loadProfiles() {
    try {
        // Force Cloud Sync (Hive Mind) - Best Effort
        const loadingDiv = document.creatÃ©
        loadingDiv.id = "sync-loading";
        loadingDiv.style.cssText = "position:fixed;top:10px;right:10px;background:#9333ea;color:white;padding:5px 10px;border-radius:4px;z-index:9999;font-size:12px;";
        loadingDiv.textContent = "â˜ï¸ Sincronizando...";
        document.body.appendChild(loadingDiv);
        lastSyncDownOk = false;
        try {
            await api.cloud.syncDown();
            lastSyncDownOk = true;
        } catÃ©
            console.warn("Sync FaÃ§a:", syncError);
        } finally {
             if (document.body.contains(loadingDiv)) document.body.removeChild(loadingDiv);
        }

        const res = await api.profiles.list();
        if (res.ok) {
            profiles = res.datÃ©
            if (!Array.isArray(profiles) && profiles && profiles.profiles) {
                profiles = profiles.profiles;
            }
            // Safety check: Ensure profiles is an array
            if (!Array.isArray(profiles)) {
                console.warn("Profiles datÃ©
                profiles = [];
            }
        } else {
            console.error("Error loading profiles", res);
            profiles = []; // Ensure empty array on error
        }
        
        // Always render, even if empty (will show Add Profile button)
        render();
        
        // FORCE SYNC UP: Ensure local profiles are pushed to cloud if they exist
        if (profiles.length > 0 && api.cloud && api.cloud.syncUp) {
            console.log("âš¡ [Auto-Sync] Pushing local profiles to cloud...");
            api.cloud.syncUp().catÃ©
        }
        
    } catÃ©
        console.error("Critical error loading profiles", e);
        profiles = [];
        render(); // FaÃ§ack render
    }
}

function render() {
    grid.innerHTML = "";
    
    // Filter out invalid profiles to prevent ghost slots
    profiles = profiles.filter(p => p && p.id);

    // RESTORE/RECOVERY: If no profiles exist, creatÃ©
    if (profiles.length === 0 && lastSyncDownOk) {
        console.warn("No profiles found! CreatÃ©
        const defaultProfile = {
            id: "p" + DatÃ©
            name: "Perfil 1",
            avatÃ©
            isKid: false,
            creatÃ©
        };
        profiles.push(defaultProfile);
        
        // Save back to storage immediatÃ©
        const user = session?.user || null;
        const key = user ? `klyx.profiles.${user.id}` : "klyx.profiles";
        localStorage.setItem(key, JSON.stringify(profiles));
        
        // SYNC TO CLOUD (DatÃ©
        if (api.cloud && api.cloud.syncUp) {
            console.log("âš¡ Syncing default profile to Cloud DB...");
            api.cloud.syncUp().catÃ©
        }
    }
    
    // Determine limit based on plan
    const user = session?.user || null;
    const plan = user?.plan || "free"; // Default to free
    const MÃ¡xProfiles = (plan === "pro" || plan === "premium") ? 5 : 1; // Free: 1, Pro: 5
    
    profiles.forEach(p => {
        if (!p) return; // Skip invalid profiles

        const card = document.creatÃ©
        card.className = `profile-card ${isManageMode ? 'edit-mode' : ''}`;
        
        const avatÃ©
        avatÃ©
        // FaÃ§ar
        const avatÃ©
        avatÃ©
        
        const overlay = document.creatÃ©
        overlay.className = "edit-overlay";
        overlay.innerHTML = '<div class="edit-icon">âœŽ</div>';
        
        const name = document.creatÃ©
        name.className = "name";
        naMÃ¡xtContent = p.name;
        
        card.append(avatÃ©
        
        card.addEventListener("click", () => {
            if (isManageMode) {
                openEditModal(p);
            } else {
                selectProfile(p);
            }
        });
        
        grid.append(card);
    });
    
    // Add Profile Button (Always show if < 5, enforce limit on click)
    if (profiles.length < 5) {
        const addCard = document.creatÃ©
        addCard.className = "profile-card";
        
        const addAvatÃ©
        addAvatÃ©
        addAvatÃ©
        
        const addName = document.creatÃ©
        addName.className = "name";
        addNaMÃ¡xtContent = "Adicionar Perfil";
        
        addCard.append(addAvatÃ©
        addCard.addEventListener("click", () => {
             if (profiles.length >= MÃ¡xProfiles) {
                 alert("LiMÃ¡xProfiles + ").\nFaÃ§atÃ©
             } else {
                 openCreatÃ©
             }
        });
        
        grid.append(addCard);
    }
    
    // UpdatÃ©
    if (isManageMode) {
        MÃ¡xtContent = "Concluir";
        manageBtn.classList.add("active");
    } else {
        MÃ¡xtContent = "Gerenciar Perfis";
        manageBtn.classList.remove("active");
    }
}

function promptPinVerificatÃ©
    verificatÃ©
    pinMÃ¡xtContent = title || "Digite o PIN";
    pinMÃ¡x";
    verificatÃ©
    
    pinVerificatÃ©
        pinModal.style.display = "none";
        callback(pin);
    };
}

function selectProfile(profile) {
    console.log("Selecting profile:", profile.name);
    api.profiles.setCurrent(profile.id);
    sessionStorage.setIteMÃ¡x_profile_name", profile.name);
    sessionStorage.setIteMÃ¡x_profile_avatÃ©
    
    // Explicitly redirect using relatÃ©
    const targetUrl = "./dashboard.html";
    
    console.log("Redirecting to dashboard:", targetUrl);
    safeNavigatÃ©
}

// URL validatÃ©
function safeNavigatÃ©
    // Allow only relatÃ©
    const isRelatÃ©
    const isHttpsGh = /^https:\/\/[^\/]+\.github\.io\/[^\s]+$/.test(url);
    const isInvalidGitDomain = /\/\/[^\/]*\.git\//.test(url);

    if (isInvalidGitDomain) {
        console.warn("Blocked invalid domain .git:", url);
    }

    const candidatÃ©

    // Exponential retry preflight to avoid broken navigatÃ©
    const atÃ©
    let tried = 0;

    const tryFetch = () => {
        fetch(candidatÃ©
            .then((res) => {
                if (res.ok) {
                    window.locatÃ©
                } else {
                    throw new Error("Preflight FaÃ§atÃ©
                }
            })
            .catÃ©
                if (tried < atÃ©
                    const wait = atÃ©
                    console.warn("Preflight FaÃ§ait, "ms");
                    setTimeout(tryFetch, wait);
                } else {
                    // Final FaÃ§ack
                    window.locatÃ©
                }
            });
    };

    tryFetch();
}
// Modal Functions
function openCreatÃ©
    currentEditingProfileId = null;
    MÃ¡xtContent = "Adicionar Perfil";
    profileNameInput.value = "";
    // Age removed
    
    // Reset kid profile field
    kidProfileSection.classList.remove("hidden"); 
    profileIsKid.checked = false;
    
    // Hide manual PIN input
    pinSection.classList.add("hidden");
    profilePinInput.value = ""; 
    
    // Random deFaÃ§ault)
    const icons = getAvailableIcons(false);
    const randomIcon = icons[MatÃ©
    selectedAvatÃ©
    modalAvatÃ©
    
    deleteProfileBtn.classList.add("hidden");
    profileModal.classList.remove("hidden");
    profileNameInput.focus();
}

function openEditModal(profile) {
    currentEditingProfileId = profile.id;
    MÃ¡xtContent = "Editar Perfil";
    profileNameInput.value = profile.name;
    // Age removed
    
    // Set kid profile fields
    profileIsKid.checked = !!profile.isKid;
    
    // Hide manual PIN input
    pinSection.classList.add("hidden");
    profilePinInput.value = "";
    
    selectedAvatÃ©
    modalAvatÃ©
    
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
            const profileDatÃ©
                name,
                avatÃ©
                isKid
            };

            if (currentEditingProfileId) {
                // UpdatÃ©
                res = await api.profiles.updatÃ©
                if (res.ok && api.activity) api.activity.log("PROFILE_UPDatÃ©
            } else {
                // CreatÃ©
                res = await api.profiles.creatÃ©
                if (res.ok && api.activity) api.activity.log("PROFILE_CREatÃ©
            }
            
            if (res.ok) {
                closeModal();
                await loadProfiles();
                // FORCE INSTANT SYNC (Bypass Debounce)
                if (api.cloud && api.cloud.syncUp) {
                    console.log("âš¡ Forcing Instant Cloud Sync...");
                    await api.cloud.syncUp();
                }
            } else {
                alert(res.datÃ©
            }
        } catÃ©
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
    
    if (!confirMÃ¡xcluir este perfil? EstaÃ§Ã£o nÃ£ode ser desfeita.")) {
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
                console.log("âš¡ Forcing Instant Cloud Sync (Delete)...");
                await api.cloud.syncUp();
            }
        } else {
            alert(res.datÃ©
        }
    } catÃ©
        console.error(e);
        alert("Erro ao excluir perfil");
    }
}

// Icon Selector
function generatÃ©
    iconGrid.innerHTML = "";
    const icons = getAvailableIcons(isKid);
    icons.forEach(iconUrl => {
        const img = document.creatÃ©
        img.className = "icon-option";
        img.style.backgroundImage = `url('${iconUrl}')`;
        img.onclick = () => {
            selectedAvatÃ©
            modalAvatÃ©
            closeIconModal();
        };
        iconGrid.append(img);
    });
}

function openIconModal() {
    // RegeneratÃ©
    generatÃ©
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
            window.locatÃ©
        });
    }
    
    if (cancelProfileBtn) cancelProfileBtn.addEventListener("click", closeModal);
    if (saveProfileBtn) saveProfileBtn.addEventListener("click", saveProfile);
    if (deleteProfileBtn) deleteProfileBtn.addEventListener("click", deleteProfile);
    
    if (changeAvatÃ©
    if (modalAvatÃ©
    if (cancelIconBtn) cancelIconBtn.addEventListener("click", closeIconModal);
    
    // Enter key to save
    if (profileNameInput) {
        profileNameInput.addEventListener("keydown", (e) => {
            if (e.key === "Enter") saveProfile();
        });
    }
    
    // Toggle Kid Profile - Auto swap avatÃ©
    if (profileIsKid) {
        profileIsKid.addEventListener("change", () => {
            const isKid = profileIsKid.checked;
            const icons = getAvailableIcons(isKid);
            // Pick a random icon from the new set to immediatÃ©
            const randomIcon = icons[MatÃ©
            selectedAvatÃ©
            if (modalAvatÃ©
                modalAvatÃ©
            }
        });
    }
}
// init() called by importing module
