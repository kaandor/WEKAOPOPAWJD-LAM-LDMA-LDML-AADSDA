
export function redirectIfAuthed() {
    const user = localStorage.getItem('klyx_user');
    if (user) {
        // If user is logged in, redirect to profiles or dashboard
        window.location.href = './profile-selection.html'; 
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
