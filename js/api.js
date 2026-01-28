
const FIREBASE_DB_URL = "https://klix-iptv-default-rtdb.firebaseio.com";
const USE_LOCAL_ONLY = false; // Set to true if offline

export const api = {
    status: {
        async checkConnection() {
            try {
                const res = await fetch(`${FIREBASE_DB_URL}/.json?shallow=true`);
                return res.ok;
            } catch (e) {
                console.error("Connection check failed:", e);
                return false;
            }
        },
        getLastError() {
            return "Erro de conexão. Verifique sua internet.";
        }
    },
    auth: {
        async login({ email, password, mac, key }) {
            // Standard Email/Password Login (Mock or against DB)
            // Since we don't have Auth SDK, we'll check 'users' node in DB manually (insecure but functional for this demo)
            try {
                // Fetch all users (inefficient but works for small demo)
                // In real app, we'd use query parameters or Auth SDK
                const res = await fetch(`${FIREBASE_DB_URL}/users.json`);
                const users = await res.json();
                
                if (!users) return { ok: false, data: { error: "Nenhum usuário encontrado." } };

                // Simple client-side match (INSECURE - DEMO ONLY)
                const userKey = Object.keys(users).find(k => users[k].email === email && users[k].password === password);
                
                if (userKey) {
                    const user = users[userKey];
                    // Update MAC/Key if needed
                    if (mac && user.mac_address !== mac) {
                        await fetch(`${FIREBASE_DB_URL}/users/${userKey}.json`, {
                            method: 'PATCH',
                            body: JSON.stringify({ mac_address: mac })
                        });
                    }
                    localStorage.setItem('klyx_user', JSON.stringify(user));
                    return { ok: true, data: { user } };
                } else {
                    return { ok: false, data: { error: "E-mail ou senha incorretos." } };
                }
            } catch (e) {
                return { ok: false, data: { error: e.message } };
            }
        },
        async loginWithGithub() {
            // Simulated GitHub Auth
            // In a real app, this would use firebase.auth().signInWithPopup(new GithubAuthProvider())
            console.log("Iniciando login com GitHub...");
            
            return new Promise((resolve) => {
                // Simulate network delay
                setTimeout(async () => {
                    // Simulate a successful GitHub user
                    // In real implementation, this comes from the provider
                    const githubUser = {
                        uid: "github_user_" + Math.floor(Math.random() * 10000),
                        displayName: "GitHub User",
                        email: "github_user@example.com",
                        photoURL: "https://github.com/github.png",
                        provider: "github"
                    };

                    // Check if user exists in our DB, if not create
                    try {
                        const userRef = `${FIREBASE_DB_URL}/users/${githubUser.uid}.json`;
                        const check = await fetch(userRef);
                        const existing = await check.json();

                        let finalUser = existing;

                        if (!existing) {
                            // Create new account
                            finalUser = {
                                ...githubUser,
                                subscription: {
                                    plan: "free", // Default plan
                                    active: true,
                                    started_at: new Date().toISOString()
                                },
                                continue_watching: [],
                                mac_address: localStorage.getItem('klyx_device_mac') || "",
                                created_at: new Date().toISOString()
                            };
                            
                            await fetch(userRef, {
                                method: 'PUT',
                                body: JSON.stringify(finalUser)
                            });
                        }

                        // Save session
                        localStorage.setItem('klyx_user', JSON.stringify(finalUser));
                        resolve({ ok: true, data: { user: finalUser } });

                    } catch (e) {
                        resolve({ ok: false, data: { error: "Erro ao conectar com GitHub: " + e.message } });
                    }
                }, 1500);
            });
        },
        async register({ email, password, name }) {
             // Basic register logic
             const uid = "user_" + Date.now();
             const newUser = {
                 email,
                 password, // Storing plain text password is bad, but this is a demo without Auth SDK
                 displayName: name,
                 subscription: { plan: "free", active: true },
                 created_at: new Date().toISOString()
             };
             
             try {
                 await fetch(`${FIREBASE_DB_URL}/users/${uid}.json`, {
                     method: 'PUT',
                     body: JSON.stringify(newUser)
                 });
                 localStorage.setItem('klyx_user', JSON.stringify(newUser));
                 return { ok: true, data: { user: newUser } };
             } catch(e) {
                 return { ok: false, data: { error: e.message } };
             }
        }
    },
    profiles: {
        async list() {
            // Mock profiles for now since we focus on auth
            const profiles = [
                { id: 'p1', name: 'Perfil Principal', avatar: 'https://occ-0-2794-2219.1.nflxso.net/dnm/api/v6/K6hjPJd6cR6FpVELC5Pd6ovHRSk/AAAABY20DrC9-11ewwAs6nfEgb1vrORxRPP9IGmlW1WtKuaLIz8CxMfZcfXj3DKj_ieZxJhWyejku5hb541z0c0.png?r=453' },
                { id: 'p2', name: 'Kids', avatar: 'https://occ-0-2794-2219.1.nflxso.net/dnm/api/v6/K6hjPJd6cR6FpVELC5Pd6ovHRSk/AAAABf9M5_y10B8o8g5t5c6.png?r=fcd' }
            ];
            // Check local storage for custom profiles
            try {
                const local = localStorage.getItem('klyx_custom_profiles');
                if (local) {
                    const parsed = JSON.parse(local);
                    if (Array.isArray(parsed)) {
                        return { ok: true, data: parsed };
                    }
                }
            } catch(e) {}
            
            return { ok: true, data: profiles };
        },
        async create(profile) {
            // Save to local storage for demo
            try {
                let profiles = [
                    { id: 'p1', name: 'Perfil Principal', avatar: 'https://occ-0-2794-2219.1.nflxso.net/dnm/api/v6/K6hjPJd6cR6FpVELC5Pd6ovHRSk/AAAABY20DrC9-11ewwAs6nfEgb1vrORxRPP9IGmlW1WtKuaLIz8CxMfZcfXj3DKj_ieZxJhWyejku5hb541z0c0.png?r=453' },
                    { id: 'p2', name: 'Kids', avatar: 'https://occ-0-2794-2219.1.nflxso.net/dnm/api/v6/K6hjPJd6cR6FpVELC5Pd6ovHRSk/AAAABf9M5_y10B8o8g5t5c6.png?r=fcd' }
                ];
                const local = localStorage.getItem('klyx_custom_profiles');
                if (local) profiles = JSON.parse(local);
                
                profile.id = 'p' + Date.now();
                profiles.push(profile);
                localStorage.setItem('klyx_custom_profiles', JSON.stringify(profiles));
                return { ok: true, data: profile };
            } catch (e) {
                return { ok: false, data: { error: e.message } };
            }
        }
    },
    content: {
        async getHome() {
            try {
                const res = await fetch('./assets/data/home.json');
                if (!res.ok) throw new Error("Failed to load home data");
                const data = await res.json();
                return { ok: true, data };
            } catch (e) {
                // Fallback if file missing
                return { ok: false, data: { error: e.message } };
            }
        },
        async getMovies() {
            try {
                const res = await fetch('./assets/data/movies.json');
                if (!res.ok) throw new Error("Failed to load movies");
                const data = await res.json();
                return { ok: true, data };
            } catch (e) {
                return { ok: false, data: { error: e.message } };
            }
        },
        async getSeries() {
            try {
                const res = await fetch('./assets/data/series.json');
                if (!res.ok) throw new Error("Failed to load series");
                const data = await res.json();
                return { ok: true, data };
            } catch (e) {
                return { ok: false, data: { error: e.message } };
            }
        }
    }
};
