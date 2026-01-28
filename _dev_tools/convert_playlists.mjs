import fs from "fs";
import path from "path";
import readline from "readline";
import crypto from "crypto";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Adjust these paths as needed
// From: klyx_web_export/_dev_tools
// To:   klyx_app/playlists
const PLAYLISTS_DIR = path.resolve(__dirname, "../../playlists");
const OUTPUT_DIR = path.resolve(__dirname, "../assets/data");

// Ensure output directory exists
if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
}

function detectType(title, group) {
    title = (title || "").toLowerCase();
    group = (group || "").toLowerCase();

    // 1. Strict Series detection (Title based)
    const seriesPattern = /s\d+\s*e\d+|\d+x\d+|season\s*\d+|episod[eo]\s*\d+/i;
    if (seriesPattern.test(title)) {
        return "series";
    }

    // 2. Explicit Channel/Live detection (Group based)
    if (group.includes("canais") || group.includes("channels") || group.includes("live") || group.includes("tv")) {
        return "live";
    }

    // 3. Movies detection
    if (group.includes("movie") || group.includes("filme") || group.includes("cinema") || group.includes("vod") || group.includes("4k") || group.includes("fhd")) {
        return "movie";
    }

    // 4. Group based Series detection (fallback)
    if (group.includes("series") || group.includes("serie") || group.includes("séries")) {
        return "series";
    }

    // 5. Default to Live TV
    return "live";
}

const movies = [];
const seriesMap = new Map(); // id -> seriesObj
const episodes = [];
const live = [];

// Helper to generate IDs
const generateId = () => crypto.randomUUID();

async function processPlaylist(filePath) {
    console.log(`Processing ${filePath}...`);
    
    try {
        const fileContent = fs.readFileSync(filePath, 'utf-8');
        const lines = fileContent.split(/\r?\n/);
        let linesProcessed = 0;
        let currentItem = {};

        for (const line of lines) {
            linesProcessed++;
            if (linesProcessed % 10000 === 0) {
                 console.log(`Processed ${linesProcessed} lines... Movies: ${movies.length}, Series: ${seriesMap.size}, Live: ${live.length}`);
            }
            const l = line.trim();
            if (!l) continue;

            if (l.startsWith("#EXTINF:")) {
                // Parse metadata
                // #EXTINF:-1 tvg-id="" tvg-name="" tvg-logo="" group-title="",Title
                const info = l.substring(8);
                const commaIndex = info.lastIndexOf(",");
                const meta = info.substring(0, commaIndex);
                const title = info.substring(commaIndex + 1).trim();

                currentItem.title = title;

                // Extract logo
                const logoMatch = meta.match(/tvg-logo="([^"]*)"/);
                if (logoMatch) currentItem.logo = logoMatch[1];

                // Extract group
                const groupMatch = meta.match(/group-title="([^"]*)"/);
                if (groupMatch) currentItem.group = groupMatch[1];

            } else if (l.startsWith("http")) {
                currentItem.url = l;

                // We have a complete item, verify and add
                if (currentItem.title && currentItem.url) {
                    const type = detectType(currentItem.title, currentItem.group);
                    
                    if (type === "series") {
                        // Extract Series Name and Episode info
                        // Regex for S01E01, 1x01, etc.
                        const seriesMatch = currentItem.title.match(/(.*?)[\][\s\.-]?(?:s(\d+)\s*e(\d+)|(\d+)x(\d+)|season\s*(\d+)|episod[eo]\s*(\d+))/i);
                        
                        let seriesName = currentItem.title;
                        let season = 1;
                        let episode = 1;

                        if (seriesMatch) {
                            seriesName = (seriesMatch[1] || currentItem.title).trim();
                            // Normalize S/E
                            if (seriesMatch[2]) season = parseInt(seriesMatch[2], 10);
                            if (seriesMatch[3]) episode = parseInt(seriesMatch[3], 10);
                            if (seriesMatch[4]) season = parseInt(seriesMatch[4], 10);
                            if (seriesMatch[5]) episode = parseInt(seriesMatch[5], 10);
                        }

                        // Clean series name (remove trailing hyphens, etc)
                        seriesName = seriesName.replace(/[-\s]+$/, "");

                        // Add to Series Map
                        if (!seriesMap.has(seriesName)) {
                            seriesMap.set(seriesName, {
                                id: generateId(),
                                title: seriesName,
                                poster_url: currentItem.logo || "",
                                category: currentItem.group || "Series",
                                description: "Series",
                                rating: 0,
                                year: new Date().getFullYear() // Default
                            });
                        }

                        const seriesId = seriesMap.get(seriesName).id;

                        episodes.push({
                            id: generateId(),
                            series_id: seriesId,
                            season_number: season,
                            episode_number: episode,
                            title: currentItem.title,
                            stream_url: currentItem.url,
                            poster_url: currentItem.logo || "",
                            duration: 0
                        });

                    } else if (type === "movie") {
                        if (movies.length === 0) console.log(`DEBUG: First movie detected: ${currentItem.title} (${currentItem.group})`);
                        const yearMatch = currentItem.title.match(/\b(19|20)\d{2}\b/);
                        const year = yearMatch ? parseInt(yearMatch[0], 10) : new Date().getFullYear();
                        
                        movies.push({
                            id: generateId(),
                            title: currentItem.title,
                            year: year,
                            rating: 0,
                            category: currentItem.group,
                            poster_url: currentItem.logo || "",
                            stream_url: currentItem.url,
                            description: "Movie"
                        });
                    } else {
                        // Live TV
                        live.push({
                            id: generateId(),
                            name: currentItem.title,
                            logo: currentItem.logo || "",
                            group: currentItem.group || "Uncategorized",
                            url: currentItem.url
                        });
                    }
                }

                currentItem = {};
            }
        }
        console.log(`\nProcessed ${linesProcessed} lines from ${path.basename(filePath)}`);
    } catch (err) {
        console.error(`Error reading file ${filePath}:`, err);
    }
}

async function run() {
    console.log("Looking for playlists in:", PLAYLISTS_DIR);

    process.on('uncaughtException', (err) => {
        console.error('CRASH: Uncaught Exception:', err);
        process.exit(1);
    });

    process.on('unhandledRejection', (reason, promise) => {
        console.error('CRASH: Unhandled Rejection at:', promise, 'reason:', reason);
        process.exit(1);
    });

    if (fs.existsSync(PLAYLISTS_DIR)) {
        let files = fs.readdirSync(PLAYLISTS_DIR).filter(f => f.endsWith(".m3u") || f.endsWith(".m3u8"));
        
        // OVERRIDE: Process ONLY CanaisBR04.m3u if it exists (User request)
        if (files.includes("CanaisBR04.m3u")) {
            console.log("⚠️  OVERRIDE ACTIVE: Processing ONLY CanaisBR04.m3u as requested.");
            files = ["CanaisBR04.m3u"];
        }

        for (const file of files) {
            await processPlaylist(path.join(PLAYLISTS_DIR, file));
        }
    } else {
        console.error("Playlists directory not found!");
        return;
    }

    console.log(`Writing output...`);
    console.log(`DEBUG: Target directory: ${OUTPUT_DIR}`);
    console.log(`Movies: ${movies.length}`);
    console.log(`Series: ${seriesMap.size}`);
    console.log(`Episodes: ${episodes.length}`);
    console.log(`Live Channels: ${live.length}`);

    try {
        // Write movies.json
        console.log("DEBUG: Writing movies.json...");
        fs.writeFileSync(path.join(OUTPUT_DIR, "movies.json"), JSON.stringify({ movies }, null, 2));

        // Write series.json
        console.log("DEBUG: Writing series.json...");
        const series = Array.from(seriesMap.values());
        fs.writeFileSync(path.join(OUTPUT_DIR, "series.json"), JSON.stringify({ series }, null, 2));

        // Write episodes split into chunks of ~50k items
        console.log("DEBUG: Splitting episodes into chunks...");
        const episodesDir = path.join(OUTPUT_DIR, "episodes");
        
        // Ensure directory is clean
        if (fs.existsSync(episodesDir)) {
            fs.rmSync(episodesDir, { recursive: true, force: true });
        }
        fs.mkdirSync(episodesDir, { recursive: true });

        const CHUNK_SIZE = 50000; // 50k episodes per file
        const totalEpisodes = episodes.length;
        let chunkCount = 0;

        for (let i = 0; i < totalEpisodes; i += CHUNK_SIZE) {
            const chunk = episodes.slice(i, i + CHUNK_SIZE);
            const chunkPath = path.join(episodesDir, `episodes_${chunkCount}.json`);
            console.log(`DEBUG: Writing chunk ${chunkCount} with ${chunk.length} episodes...`);
            fs.writeFileSync(chunkPath, JSON.stringify({ episodes: chunk }, null, 2));
            chunkCount++;
        }
        console.log(`DEBUG: Wrote ${chunkCount} episode chunks.`);

        // Write live.json
        console.log("DEBUG: Writing live.json...");
        fs.writeFileSync(path.join(OUTPUT_DIR, "live.json"), JSON.stringify({ channels: live }, null, 2));


        // Generate a simple home.json based on imported data
        const home = {
            rails: {
                topMovies: movies.slice(0, 10),
                topSeries: Array.from(seriesMap.values()).slice(0, 10),
                recentMovies: movies.slice(10, 20),
                nightMovies: movies.slice(20, 30),
                horrorMovies: movies.filter(m => m.category.toLowerCase().includes("terror") || m.category.toLowerCase().includes("horror")).slice(0, 10),
                comedyMovies: movies.filter(m => m.category.toLowerCase().includes("comedia") || m.category.toLowerCase().includes("comedy")).slice(0, 10),
                actionMovies: movies.filter(m => m.category.toLowerCase().includes("acao") || m.category.toLowerCase().includes("action")).slice(0, 10),
                adventureMovies: movies.filter(m => m.category.toLowerCase().includes("aventura") || m.category.toLowerCase().includes("adventure")).slice(0, 10)
            }
        };
        fs.writeFileSync(path.join(OUTPUT_DIR, "home.json"), JSON.stringify(home, null, 2));
        console.log("DEBUG: Wrote home.json");
    } catch (err) {
        console.error("DEBUG: Write failed!", err);
    }

    console.log("Done!");
}

run();
