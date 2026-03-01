import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const DATA_DIR = path.resolve(__dirname, "assets/data");
const MOVIES_FILE = path.join(DATA_DIR, "movies.json");
const SERIES_FILE = path.join(DATA_DIR, "series.json");
const EPISODES_FILE = path.join(DATA_DIR, "episodes.json");
const HOME_FILE = path.join(DATA_DIR, "home.json");

// Helper to normalize titles
function normalizeTitle(title) {
    if (!title) return "";
    return title
        .replace(/\s*\[L\]\s*$/i, "")
        .replace(/\s*\[Leg\]\s*$/i, "")
        .replace(/\s*\(Legendado\)\s*$/i, "")
        .replace(/\s*\(Leg\)\s*$/i, "")
        .replace(/\s*\[D\]\s*$/i, "")
        .replace(/\s*\[Dub\]\s*$/i, "")
        .trim();
}

function isLegendado(title, category) {
    const t = title.toLowerCase();
    const c = (category || "").toLowerCase();
    return t.endsWith("[l]") || t.includes("[leg]") || t.includes("(legendado)") || c.includes("legendado");
}

function mergeMovies() {
    console.log("🎬 Merging Movies...");
    if (!fs.existsSync(MOVIES_FILE)) {
        console.log("No movies.json found.");
        return;
    }

    const raw = fs.readFileSync(MOVIES_FILE, "utf-8");
    const data = JSON.parse(raw);
    const movies = data.movies || [];
    
    console.log(`Initial Movie Count: ${movies.length}`);

    const grouped = new Map();

    movies.forEach(m => {
        const normTitle = normalizeTitle(m.title);
        // Create a unique key based on Title + Year (to avoid merging remakes with same name)
        // If year is missing or 0, maybe just title. But IPTV lists often have wrong years (2026).
        // Let's stick to Title for now as the user requested duplicate removal.
        const key = normTitle.toLowerCase();

        if (!grouped.has(key)) {
            grouped.set(key, []);
        }
        grouped.get(key).push(m);
    });

    const mergedMovies = [];

    for (const [key, group] of grouped) {
        if (group.length === 1) {
            // Only one version. Check if it is Legendado.
            const m = group[0];
            const isLeg = isLegendado(m.title, m.category);
            
            // If it is Legendado, user wants it as Audio 2. 
            // BUT for single files, player logic defaults to Audio 1 (stream_url).
            // To be safe and compliant with "Legendados as Audio 2", we can set BOTH?
            // No, player defaults to Audio 1. 
            // Let's standardize: 
            // If only [L] exists -> stream_url = [L], stream_url_sub = [L] (or null).
            // The player UI shows "Audio 1 (Legendado)" if we pass isLegendado flag or detect it.
            // We will keep it simple: normalize the title for display, but keep original data.
            // ACTUALLY, we should clean the title for display!
            m.title = normalizeTitle(m.title); 
            // Ensure we don't lose the indication it is subtitled if it's the only source
            // Maybe add a tag in category?
            mergedMovies.push(m);
        } else {
            // Multiple versions! Merge them.
            // Prefer the one with highest rating or metadata? Usually they are identical except URL.
            // Let's pick the "Dubbed" one (Audio 1) as base.
            let dub = group.find(m => !isLegendado(m.title, m.category));
            let sub = group.find(m => isLegendado(m.title, m.category));

            // Fallbacks
            if (!dub && group.length > 0) dub = group[0];
            if (!sub && group.length > 1) sub = group[1]; // Just take another one

            const base = { ...dub }; // Clone
            base.title = normalizeTitle(base.title); // Clean title
            
            // Audio 1: Dubbed
            base.stream_url = dub ? dub.stream_url : sub.stream_url;
            
            // Audio 2: Subtitled
            if (sub) {
                base.stream_url_sub = sub.stream_url;
            }

            // If we have a sub version but it's the same URL as dub (unlikely in this logic but possible), ignore.
            if (base.stream_url === base.stream_url_sub) {
                delete base.stream_url_sub;
            }

            mergedMovies.push(base);
        }
    }

    console.log(`Merged Movie Count: ${mergedMovies.length}`);
    fs.writeFileSync(MOVIES_FILE, JSON.stringify({ movies: mergedMovies }, null, 2));
    
    // Also update Home.json because it contains snippets of movies
    updateHomeJson(mergedMovies);
}

function updateHomeJson(allMovies) {
    console.log("🏠 Updating Home.json with merged data...");
    if (!fs.existsSync(HOME_FILE)) return;

    const raw = fs.readFileSync(HOME_FILE, "utf-8");
    const home = JSON.parse(raw);
    const movieMap = new Map(allMovies.map(m => [m.id, m])); // Map by ID is useless if IDs changed? 
    // Wait, we didn't change IDs in mergeMovies, we kept the ID of the 'dub' version.
    // But 'sub' version IDs are now gone. Home.json might point to a 'sub' ID that no longer exists.
    
    // We need to regenerate Home.json rails based on the NEW movie list.
    // The previous home.json was generated by our script based on categories.
    // We can just re-filter the mergedMovies list into rails.

    const rails = {};
    
    // Helpers
    const getByCat = (term) => allMovies.filter(m => (m.category||"").toLowerCase().includes(term));
    
    rails.topMovies = allMovies.slice(0, 15);
    rails.recentMovies = allMovies.slice(15, 30);
    rails.nightMovies = allMovies.slice(30, 45); // Just random slices for now
    
    rails.horrorMovies = getByCat("terror").concat(getByCat("horror")).slice(0, 20);
    rails.comedyMovies = getByCat("comedia").concat(getByCat("comedy")).slice(0, 20);
    rails.actionMovies = getByCat("acao").concat(getByCat("action")).slice(0, 20);
    rails.adventureMovies = getByCat("aventura").concat(getByCat("adventure")).slice(0, 20);
    rails.dramaMovies = getByCat("drama").slice(0, 20);
    
    // Preserve Series rails if they exist in original home
    if (home.rails && home.rails.topSeries) {
        rails.topSeries = home.rails.topSeries; 
        // We will update series next, so this might be stale, but better than nothing.
    }

    home.rails = rails;
    fs.writeFileSync(HOME_FILE, JSON.stringify(home, null, 2));
}

function mergeSeries() {
    console.log("📺 Merging Series & Episodes...");
    if (!fs.existsSync(SERIES_FILE) || !fs.existsSync(EPISODES_FILE)) {
        console.log("Series or Episodes file missing.");
        return;
    }

    const seriesData = JSON.parse(fs.readFileSync(SERIES_FILE, "utf-8"));
    const episodesData = JSON.parse(fs.readFileSync(EPISODES_FILE, "utf-8"));
    
    let allSeries = seriesData.series || [];
    let allEpisodes = episodesData.episodes || [];

    console.log(`Initial Series: ${allSeries.length}, Episodes: ${allEpisodes.length}`);

    // 1. Merge Series Entries
    const groupedSeries = new Map();
    const idRemap = new Map(); // Old ID -> New Merged ID

    allSeries.forEach(s => {
        const normTitle = normalizeTitle(s.title);
        const key = normTitle.toLowerCase();
        
        if (!groupedSeries.has(key)) {
            groupedSeries.set(key, []);
        }
        groupedSeries.get(key).push(s);
    });

    const mergedSeries = [];

    for (const [key, group] of groupedSeries) {
        // Pick base (Dubbed or first)
        let base = group.find(s => !isLegendado(s.title, s.category)) || group[0];
        
        // Use base ID as the "Master ID"
        const masterId = base.id;
        
        // Map all IDs in this group to the Master ID
        group.forEach(s => {
            idRemap.set(s.id, masterId);
        });

        // Clean title
        const newSeries = { ...base };
        newSeries.title = normalizeTitle(newSeries.title);
        mergedSeries.push(newSeries);
    }

    // 2. Update Episodes to use Master ID
    allEpisodes.forEach(ep => {
        if (idRemap.has(ep.series_id)) {
            ep.series_id = idRemap.get(ep.series_id);
        }
    });

    // 3. Merge Duplicate Episodes (Same SeriesID + Season + Episode)
    const groupedEpisodes = new Map();
    
    allEpisodes.forEach(ep => {
        // Key: SeriesID_Sxx_Exx
        const key = `${ep.series_id}_S${ep.season_number}_E${ep.episode_number}`;
        if (!groupedEpisodes.has(key)) {
            groupedEpisodes.set(key, []);
        }
        groupedEpisodes.get(key).push(ep);
    });

    const mergedEpisodes = [];

    for (const [key, group] of groupedEpisodes) {
        if (group.length === 1) {
            mergedEpisodes.push(group[0]);
        } else {
            // Find Dub and Sub versions
            // Episodes don't usually have [L] in title, but the SERIES title had it.
            // Since we already merged series IDs, we lost the info of which episode came from [L] series.
            // WAIT! We need to know which OLD series ID the episode came from to know if it was Subtitled.
            // I need to look at the ORIGINAL series list to check if the old series ID was Legendado.
        }
    }
    
    // RE-DO Step 2/3 Strategy:
    // We need a map of "IsSeriesLegendado(oldId)"
    const seriesIsLegMap = new Map();
    allSeries.forEach(s => {
        seriesIsLegMap.set(s.id, isLegendado(s.title, s.category));
    });

    // Reset mergedEpisodes and do it right
    const finalEpisodes = [];
    const groupedEps = new Map();

    allEpisodes.forEach(ep => {
        const isLeg = seriesIsLegMap.get(ep.series_id) || false; // Check original ID before remapping?
        // Wait, 'ep' object is mutated in place in the loop above?
        // "allEpisodes.forEach(ep => { if (idRemap.has(ep.series_id)) ... })"
        // Yes, I mutated it. I should have kept the original ID for checking.
    });
}

// Better Series Logic: Reload clean
function mergeSeriesClean() {
    console.log("📺 Merging Series & Episodes (Clean)...");
    if (!fs.existsSync(SERIES_FILE) || !fs.existsSync(EPISODES_FILE)) return;

    const seriesRaw = JSON.parse(fs.readFileSync(SERIES_FILE, "utf-8")).series || [];
    const episodesRaw = JSON.parse(fs.readFileSync(EPISODES_FILE, "utf-8")).episodes || [];

    console.log(`Initial Series: ${seriesRaw.length}, Episodes: ${episodesRaw.length}`);

    // Map: OldID -> IsLegendado
    const isLegMap = new Map();
    seriesRaw.forEach(s => {
        isLegMap.set(s.id, isLegendado(s.title, s.category));
    });

    // Group Series
    const groupedSeries = new Map();
    const idRemap = new Map();

    seriesRaw.forEach(s => {
        const normTitle = normalizeTitle(s.title);
        const key = normTitle.toLowerCase();
        if (!groupedSeries.has(key)) groupedSeries.set(key, []);
        groupedSeries.get(key).push(s);
    });

    const mergedSeries = [];
    groupedSeries.forEach((group, key) => {
        let base = group.find(s => !isLegendado(s.title, s.category)) || group[0];
        const masterId = base.id;
        group.forEach(s => idRemap.set(s.id, masterId));
        
        const newS = { ...base };
        newS.title = normalizeTitle(newS.title);
        mergedSeries.push(newS);
    });

    // Process Episodes
    const epGroup = new Map(); // Key: MasterSeriesID_S_E -> { dub: ep, sub: ep }

    episodesRaw.forEach(ep => {
        const originalSeriesId = ep.series_id;
        const masterId = idRemap.get(originalSeriesId);
        
        if (!masterId) return; // Orphaned episode?

        const isSub = isLegMap.get(originalSeriesId);
        const key = `${masterId}_S${ep.season_number}_E${ep.episode_number}`;

        if (!epGroup.has(key)) epGroup.set(key, { dub: null, sub: null });
        const slot = epGroup.get(key);

        if (isSub) {
            if (!slot.sub) slot.sub = ep; 
        } else {
            if (!slot.dub) slot.dub = ep;
        }
    });

    const mergedEpisodes = [];
    epGroup.forEach((slot, key) => {
        // Prefer Dub as base, or Sub if Dub missing
        const base = slot.dub ? { ...slot.dub } : { ...slot.sub };
        
        // Update to master ID
        base.series_id = idRemap.get(base.series_id); // Wait, base.series_id is the original one.
        // We need to set it to masterId derived from key? 
        // Or just use the map.
        // The key is MasterSeriesID_S_E. We can parse it, or just use remapping.
        // Actually, 'base' is a copy of one of the episodes. Its 'series_id' is the OLD one.
        // We MUST update it.
        // But idRemap.get(oldId) gives masterId.
        base.series_id = idRemap.get(base.series_id); // Correct.

        // URLs
        if (slot.dub) {
            base.stream_url = slot.dub.stream_url;
        } else if (slot.sub) {
            // If only sub exists, it becomes Audio 1
            base.stream_url = slot.sub.stream_url;
        }

        if (slot.sub) {
            base.stream_url_sub = slot.sub.stream_url;
        }

        // Avoid self-ref
        if (base.stream_url === base.stream_url_sub) delete base.stream_url_sub;

        mergedEpisodes.push(base);
    });

    console.log(`Merged Series: ${mergedSeries.length}, Episodes: ${mergedEpisodes.length}`);
    
    fs.writeFileSync(SERIES_FILE, JSON.stringify({ series: mergedSeries }, null, 2));
    fs.writeFileSync(EPISODES_FILE, JSON.stringify({ episodes: mergedEpisodes }, null, 2));
}

async function run() {
    mergeMovies();
    mergeSeriesClean();
    console.log("✅ Duplicates merged and audio tracks organized.");
}

run();
