const fs = require('fs');
const path = require('path');

const M3U_PATH = String.raw`C:\Users\kaandro\Downloads\Iptv-Brasil-2026-master\Iptv-Brasil-2026-master\CanaisBR05.m3u`;
const OUTPUT_DIR = path.join(__dirname, 'assets/data');
const EPISODES_DIR = path.join(OUTPUT_DIR, 'episodes');

// Ensure directories exist
if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(EPISODES_DIR)) fs.mkdirSync(EPISODES_DIR, { recursive: true });

// STRICT Exclusion List (Channels & Adult)
const EXCLUDED_CATEGORIES = new Set([
    "ABERTOS",
    "ADULTOS",
    "BAND",
    "BBB 26",
    "CINE SKY",
    "DESENHOS 24H",
    "DESPORTO",
    "DISCOVERY", // Uppercase = Channel
    "DISNEY+",   // Uppercase = Channel
    "DOCUMENTÁRIOS", // Uppercase = Channel
    "ESPECIAIS 24H",
    "ESPN",
    "ESPORTES",
    "ESPORTES PPV",
    "ESTADOS UNIDOS",
    "FILMES & SERIES", // Confirmed Channels
    "FILMES 24H",
    "GLOBO CENTRO OESTE",
    "GLOBO NORDESTE",
    "GLOBO NORTE",
    "GLOBO SUDESTE",
    "GLOBO SUL ",
    "HBO ", // Uppercase = Channel
    "HORA DO JOGO",
    "INFANTIS", // Uppercase = Channel
    "LEGENDADOS", // Confirmed Channels
    "MARATONA 24H",
    "MAX", // Confirmed Channels
    "MLB GAME PASS",
    "MLS SEASON PASS",
    "NBA LEAGUE PASS",
    "NFL GAME PASS",
    "NHL CENTER ICE",
    "NOTÍCIAS",
    "NO_CATEGORY",
    "PARAMOUNT+", // Uppercase = Channel
    "PORTUGAL",
    "PREMIERE",
    "PRIME VIDEO", // Uppercase = Channel
    "RECORD",
    "RELIGIOSOS",
    "SBT",
    "SHOWS 24H",
    "TELECINE",
    "VARIEDADES",
    "XXX - A Casa das Brasileirinhas",
    "XXX - Babes.com",
    "XXX - Brasileirinhas",
    "XXX - Brazzers",
    "XXX - Filmes +18 ",
    "XXX - Hentai"
]);

// Series Identification Keywords (for Categories)
const SERIES_CATEGORY_KEYWORDS = [
    "Animes",
    "Doramas",
    "Novelas",
    "Series",
    "Séries"
];

function isRestricted(category) {
    if (!category) return true;
    if (EXCLUDED_CATEGORIES.has(category)) return true;
    if (category.includes("XXX") || category.includes("Adult")) return true;
    return false;
}

function isSeriesCategory(category) {
    return SERIES_CATEGORY_KEYWORDS.some(k => category.includes(k));
}

function parseM3U() {
    console.log("Reading M3U file...");
    const content = fs.readFileSync(M3U_PATH, 'utf8');
    const lines = content.split('\n');
    
    const movies = [];
    const seriesMap = new Map(); // Title -> { id, title, poster, backdrop, category, episodes: [] }
    
    let currentItem = {};
    let isHeader = false;

    console.log(`Processing ${lines.length} lines...`);

    lines.forEach((line, index) => {
        line = line.trim();
        if (!line) return;

        if (line.startsWith('#EXTINF:')) {
            isHeader = true;
            
            // Extract attributes
            const tvgIdMatch = line.match(/tvg-id="([^"]*)"/);
            const tvgLogoMatch = line.match(/tvg-logo="([^"]*)"/);
            const groupMatch = line.match(/group-title="([^"]*)"/);
            
            // Extract Title (everything after the last comma)
            const titleParts = line.split(',');
            const rawTitle = titleParts[titleParts.length - 1].trim();

            currentItem = {
                tvgId: tvgIdMatch ? tvgIdMatch[1] : "",
                poster: tvgLogoMatch ? tvgLogoMatch[1] : "",
                category: groupMatch ? groupMatch[1] : "NO_CATEGORY",
                rawTitle: rawTitle
            };
        } else if (!line.startsWith('#') && isHeader) {
            // URL Line
            currentItem.stream_url = line;
            isHeader = false;

            // --- FILTERING LOGIC ---
            if (isRestricted(currentItem.category)) {
                return; // Skip restricted/channel content
            }

            // Determine if Series/Episode or Movie
            let isEpisode = false;
            let seriesTitle = currentItem.rawTitle;
            let season = 1;
            let episode = 1;

            // Regex for S01E01, 1x01, etc.
            const s00e00 = currentItem.rawTitle.match(/S(\d+)\s*E(\d+)/i);
            const sxee = currentItem.rawTitle.match(/(\d+)x(\d+)/i);
            const temporada = currentItem.rawTitle.match(/T(\d+)\s*[-:]?\s*E?(\d+)/i); // T1 - E01 or T1 01
            
            if (s00e00) {
                const potentialTitle = currentItem.rawTitle.replace(/S\d+\s*E\d+.*$/i, "").trim();
                if (potentialTitle.length > 1) {
                    isEpisode = true;
                    season = parseInt(s00e00[1]);
                    episode = parseInt(s00e00[2]);
                    seriesTitle = potentialTitle;
                }
            } else if (sxee) {
                const potentialTitle = currentItem.rawTitle.replace(/\d+x\d+.*$/i, "").trim();
                if (potentialTitle.length > 1) {
                    isEpisode = true;
                    season = parseInt(sxee[1]);
                    episode = parseInt(sxee[2]);
                    seriesTitle = potentialTitle;
                }
            } else if (temporada) {
                const potentialTitle = currentItem.rawTitle.replace(/T\d+.*$/i, "").trim();
                if (potentialTitle.length > 1) {
                    isEpisode = true;
                    season = parseInt(temporada[1]);
                    episode = parseInt(temporada[2]);
                    seriesTitle = potentialTitle;
                }
            } else if (isSeriesCategory(currentItem.category)) {
                // It's in a series category but regex didn't match perfectly.
                // Treat as episode 1 of season 1 if it looks like a single item?
                // Or maybe it's just a loose episode.
                // For now, if category says "Novelas", treat as Series.
                isEpisode = true;
                // Try to extract any number as episode
                const numMatch = currentItem.rawTitle.match(/(\d+)/);
                if (numMatch) episode = parseInt(numMatch[1]);
                // Clean title slightly
                seriesTitle = currentItem.rawTitle.replace(/\d+$/, "").trim();
            }

            // Clean trailing hyphens
            seriesTitle = seriesTitle.replace(/[-:]$/, "").trim();

            if (isEpisode) {
                // Add to Series Map
                const seriesId = Buffer.from(seriesTitle).toString('base64').replace(/[^a-zA-Z0-9]/g, "").substring(0, 10).toLowerCase();
                
                if (!seriesMap.has(seriesId)) {
                    seriesMap.set(seriesId, {
                        id: seriesId,
                        title: seriesTitle,
                        poster: currentItem.poster,
                        backdrop: currentItem.poster,
                        category: currentItem.category,
                        description: "",
                        rating: 0,
                        year: "",
                        episodes: []
                    });
                }

                // Add Episode
                seriesMap.get(seriesId).episodes.push({
                    season_number: season,
                    episode_number: episode,
                    title: currentItem.rawTitle,
                    stream_url: currentItem.stream_url,
                    duration: 0
                });

            } else {
                // It's a Movie
                const movieId = Math.random().toString(36).substring(2, 8);
                movies.push({
                    id: movieId,
                    title: currentItem.rawTitle,
                    poster: currentItem.poster,
                    backdrop: currentItem.poster,
                    stream_url: currentItem.stream_url,
                    category: currentItem.category,
                    rating: 0,
                    year: "",
                    duration: 0,
                    description: ""
                });
            }
        }
    });

    console.log(`Filtered: Found ${movies.length} Movies and ${seriesMap.size} Series.`);

    // Save Movies
    fs.writeFileSync(path.join(OUTPUT_DIR, 'movies.json'), JSON.stringify({ movies }, null, 2));

    // Save Series (Metadata only)
    const seriesList = [];
    const allEpisodes = [];

    seriesMap.forEach(series => {
        seriesList.push({
            id: series.id,
            title: series.title,
            poster: series.poster,
            backdrop: series.backdrop,
            category: series.category,
            description: series.description,
            rating: series.rating,
            year: series.year
        });
        
        // Flatten episodes for chunked storage
        series.episodes.forEach(ep => {
            allEpisodes.push({
                series_id: series.id,
                ...ep
            });
        });
    });

    fs.writeFileSync(path.join(OUTPUT_DIR, 'series.json'), JSON.stringify({ series: seriesList }, null, 2));

    // Save Episodes in Chunks (2000 per file)
    const CHUNK_SIZE = 2000;
    const chunks = Math.ceil(allEpisodes.length / CHUNK_SIZE);
    
    console.log(`Saving ${allEpisodes.length} episodes in ${chunks} chunks...`);

    // Clean old episodes
    const oldFiles = fs.readdirSync(EPISODES_DIR);
    oldFiles.forEach(f => fs.unlinkSync(path.join(EPISODES_DIR, f)));

    for (let i = 0; i < chunks; i++) {
        const chunk = allEpisodes.slice(i * CHUNK_SIZE, (i + 1) * CHUNK_SIZE);
        fs.writeFileSync(path.join(EPISODES_DIR, `episodes_${i}.json`), JSON.stringify(chunk));
    }

    console.log("Conversion Complete!");
}

parseM3U();
