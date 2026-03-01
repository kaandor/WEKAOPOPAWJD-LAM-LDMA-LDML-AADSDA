import { api } from "./api.js";
import { requireAuth } from "./auth.js";

// Plan Limits
function getMaxProfiles() {
    const plan = (session.user?.plan || 'individual').toLowerCase();
    if (plan === 'premium') return 4;
    if (plan === 'familia' || plan === 'family') return 3;
    if (plan === 'duo') return 2;
    return 1; // individual
}

// Ensure user is logged in
const session = await requireAuth();
if (!session) {
  // requireAuth handles redirect
  throw new Error("Not authenticated");
}

const grid = document.getElementById("profilesGrid");
const modal = document.getElementById("createProfileModal");
const nameInput = document.getElementById("profileName");
const saveBtn = document.getElementById("saveProfileBtn");
const cancelBtn = document.getElementById("cancelCreateBtn");
const connectionDot = document.getElementById("connectionStatusDot");

// Connection Status Check
if (connectionDot) {
            api.status.checkConnection().then(isConnected => {
                if (isConnected) {
                    connectionDot.classList.add("connected");
                    connectionDot.title = "Connected to Database";
                    connectionDot.style.cursor = "default";
                    connectionDot.onclick = null;
                } else {
                    connectionDot.classList.remove("connected");
                    const err = api.status.getLastError() || "Desconectado";
                    connectionDot.title = "Erro de conexão: Clique para ver detalhes";
                    connectionDot.style.cursor = "help";
                    connectionDot.onclick = () => alert(`Erro de Conexão com Firebase:\n\n${err}\n\nVerifique se as 'Rules' (Regras) do Firebase estão públicas (.read: true, .write: true).`);
                }
            });
        }

// State
let profiles = [];

async function loadProfiles() {
  try {
    const res = await api.profiles.list();
    if (!res.ok) {
      console.error("Failed to load profiles:", res);
      // Show error in grid if possible
      grid.innerHTML = `<p style="color: #ff4444; text-align: center;">Erro ao carregar perfis. Tente recarregar a página.<br>${res.data?.error || ''}</p>`;
      return;
    }
    profiles = res.data;
    // Check if response is array or object wrapped
    if (!Array.isArray(profiles) && profiles.profiles) {
        profiles = profiles.profiles;
    }
    render();
  } catch (err) {
    console.error(err);
    grid.innerHTML = `<p style="color: #ff4444; text-align: center;">Erro de conexão. Verifique se o servidor está rodando.</p>`;
  }
}

function render() {
  grid.innerHTML = "";

  // Render existing profiles
  profiles.forEach(p => {
    const card = document.createElement("div");
    card.className = "profile-card";
    
    const avatar = document.createElement("div");
    avatar.className = "avatar";
    // Simple colored avatar based on name hash
    const hue = hashStr(p.name) % 360;
    avatar.style.backgroundColor = `hsl(${hue}, 70%, 30%)`;
    avatar.style.display = "flex";
    avatar.style.alignItems = "center";
    avatar.style.justifyContent = "center";
    avatar.style.fontSize = "3rem";
    avatar.style.color = "#fff";
    avatar.textContent = p.name.charAt(0).toUpperCase();

    const name = document.createElement("div");
    name.className = "name";
    name.textContent = p.name;

    card.append(avatar, name);
    card.addEventListener("click", () => selectProfile(p));
    grid.append(card);
  });

  // Render "Add Profile" if limit not reached
  const maxProfiles = getMaxProfiles();
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
    addCard.addEventListener("click", openCreateModal);
    grid.append(addCard);
  }
}

function selectProfile(profile) {
  console.log("Selected profile:", profile);
  localStorage.setItem("klyx_profile_id", profile.id);
  localStorage.setItem("klyx_profile_name", profile.name);
  localStorage.setItem("klyx_profile_avatar", profile.avatar_url || "");
  window.location.href = "./dashboard.html";
}

function openCreateModal() {
  modal.classList.remove("hidden");
  nameInput.value = "";
  nameInput.focus();
}

function closeCreateModal() {
  modal.classList.add("hidden");
}

async function createProfile() {
  const name = nameInput.value.trim();
  if (!name) return;

  saveBtn.disabled = true;
  saveBtn.textContent = "Salvando...";

  try {
    const res = await api.profiles.create({ name });
    if (res.ok) {
      closeCreateModal();
      await loadProfiles();
    } else {
      alert(res.data?.error || "Failed to create profile");
    }
  } catch (err) {
    console.error(err);
    alert("Error creating profile");
  } finally {
    saveBtn.disabled = false;
    saveBtn.textContent = "Salvar";
  }
}

// Helpers
function hashStr(str) {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = str.charCodeAt(i) + ((hash << 5) - hash);
  }
  return Math.abs(hash);
}

// Event Listeners
cancelBtn.addEventListener("click", closeCreateModal);
saveBtn.addEventListener("click", createProfile);
nameInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") createProfile();
  if (e.key === "Escape") closeCreateModal();
});

// Init
loadProfiles();
