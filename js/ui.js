
import { api } from "./api.js";

export function handleLoginSuccess(user) {
    console.log("Login successful:", user);
    window.location.href = "./profile-selection.html";
}

export async function initDashboard() {
    console.log("Dashboard Initialized");
    // Load content here
    const content = document.getElementById("dashboardContent");
    if (content) {
        content.innerHTML = "<p>Carregando conteúdo...</p>";
        // Fetch data via api...
    }
}
