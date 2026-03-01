
export function redirectIfAuthed() {
    const sessionStr = localStorage.getItem('klyx.session');
    if (!sessionStr) return;
    try {
        const session = JSON.parse(sessionStr);
        // Strict validation to prevent ghost logins
        if (session && session.user && session.user.id && (session.user.name || session.user.email)) {
            window.location.href = './profile-selection.html';
        } else {
            // Invalid session found, clear it
            console.warn("Sessão inválida detectada (usuário incompleto). Limpando...");
            localStorage.removeItem('klyx.session');
        }
    } catch (e) {
        // Invalid JSON leftover; clear to avoid redirect loops
        localStorage.removeItem('klyx.session');
    }
}

export function requireAuth() {
    const sessionStr = localStorage.getItem('klyx.session');
    if (!sessionStr) {
        window.location.href = './index.html';
        return null;
    }
    try {
        const session = JSON.parse(sessionStr);
        if (!session || !session.user) {
             throw new Error("Invalid session structure");
        }
        return session; 
    } catch (e) {
        console.error("Invalid user data", e);
        window.location.href = './index.html';
        return null;
    }
}

export function applyTheme() {
    // Basic theme application
    document.body.style.backgroundColor = "#0b0e14";
}

export function logout() {
    localStorage.removeItem('klyx.session');
    localStorage.removeItem('klyx_profile_id');
    window.location.href = './index.html';
}
