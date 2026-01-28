
export function redirectIfAuthed() {
    const user = localStorage.getItem('klyx_user');
    if (user) {
        // If user is logged in, redirect to profiles or dashboard
        window.location.href = './profile-selection.html'; 
    }
}

export function requireAuth() {
    const userStr = localStorage.getItem('klyx_user');
    if (!userStr) {
        window.location.href = './login.html';
        return null;
    }
    try {
        const user = JSON.parse(userStr);
        // Wrap in a structure if router expects session.user
        // router.js uses: session.user.display_name
        // If user is the direct object stored, return { user: user } or just user depending on how it was stored.
        // api.js stores: localStorage.setItem('klyx_user', JSON.stringify(user));
        // And user object has email, password, mac_address.
        // router.js expects session.user to exist.
        // So we should return { user: user } or modify router.js.
        // Let's assume session is the object returned.
        // If I return user, router.js does user.user.display_name which might be undefined if user is flat.
        // Let's check api.js login again.
        // api.js: localStorage.setItem('klyx_user', JSON.stringify(user));
        // So klyx_user IS the user object.
        // router.js: const session = await requireAuth(); ... session.user.display_name
        // So requireAuth needs to return { user: ... }
        return { user }; 
    } catch (e) {
        console.error("Invalid user data", e);
        window.location.href = './login.html';
        return null;
    }
}

export function applyTheme() {
    // Basic theme application
    document.body.style.backgroundColor = "#0b0e14";
}

export function logout() {
    localStorage.removeItem('klyx_user');
    window.location.href = './login.html';
}
