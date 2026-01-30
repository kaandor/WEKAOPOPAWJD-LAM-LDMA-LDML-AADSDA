
export function redirectIfAuthed() {
    const session = localStorage.getItem('klyx.session');
    if (session) {
        // If user is logged in, redirect to profiles or dashboard
        window.location.href = './profile-selection.html'; 
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
