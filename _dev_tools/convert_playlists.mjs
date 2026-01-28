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
    const fileStream = fs.createReadStream(filePath);
    
    const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
    });

    let currentItem = {};

    let linesProcessed = 0;
    for await (const line of rl) {
        linesProcessed++;
        if (linesProcessed % 100000 === 0) {
            console.log(`Processed ${linesProcessed} lines...`);
        }
        const l = line.trim();
        if (!l) continue;

        if (l.startsWith("#EXTINF:")) {
            // Parse metadata
            const info = l.substring(8);
            const commaIndex = info.lastIndexOf(",");
            const title = info.substring(commaIndex + 1).trim();
            const metaPart = info.substring(0, commaIndex);

            const getMeta = (key) => {
                const match = metaPart.match(new RegExp(`${key}="([^"]*)"`));
                return match ? match[1] : null;
            };
            
            let durationSec = parseInt(metaPart);
            if (isNaN(durationSec) || durationSec < 0) durationSec = 0;

            currentItem = {
                title: title,
                logo: getMeta("tvg-logo"),
                group: getMeta("group-title") || "Uncategorized",
                duration: durationSec,
            };
        } else if (!l.startsWith("#")) {
            // URL found
            if (currentItem.title) {
                currentItem.url = l;
                
                const type = detectType(currentItem.title, currentItem.group);

                if (type === "live") {
                    const isAdult = /adulto|xxx|porn|sex|18\+|sexy|hentai/i.test((currentItem.group || "") + " " + (currentItem.title || ""));
                    const isLegendado = /legendado|\[LEG\]/i.test((currentItem.group || "") + " " + (currentItem.title || ""));
                    
                    const channelObj = {
                        id: generateId(),
                        title: currentItem.title,
                        category: currentItem.group,
                        thumbnail_url: currentItem.logo || "",
                        stream_url: currentItem.url,
                        description: "Live Channel"
                    };

                    if (isAdult) {
                        channelObj.locked = true;
                    }
                    
                    if (isLegendado) {
                        console.log(`Detected Legendado: ${currentItem.title}`);
                        channelObj.audio_track = "audio2";
                        // console.log("Channel Object:", JSON.stringify(channelObj));
                    }

                    live.push(channelObj);
                } else if (type === "movie") {
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
                } else if (type === "series") {
                    // Series Logic
                    const seasonRegex = /^(.*?)[\s\.\-]S(\d+)E(\d+)/i;
                    let showTitle = currentItem.title;
                    let seasonNum = 1;
                    let episodeNum = 1;
                    let epTitle = currentItem.title;

                    const match = currentItem.title.match(seasonRegex);
                    if (match) {
                        showTitle = match[1].trim();
                        seasonNum = parseInt(match[2], 10);
                        episodeNum = parseInt(match[3], 10);
                        let potentialTitle = currentItem.title.replace(match[0], "").trim();
                        potentialTitle = potentialTitle.replace(/^[\s\.\-]+/, "").trim();
                        if (potentialTitle.length > 1) epTitle = potentialTitle;
                        else epTitle = `Episode ${episodeNum}`;
                    } else {
                        const dashParts = currentItem.title.split(" - ");
                        if (dashParts.length > 1) {
                            showTitle = dashParts[0].trim();
                            epTitle = dashParts.slice(1).join(" - ").trim();
                        }
                    }

                    // Find or create series
                    let seriesId = null;
                    // Simple check in our map
                    for (const [id, s] of seriesMap.entries()) {
                        if (s.title === showTitle) {
                            seriesId = id;
                            break;
                        }
                    }

                    if (!seriesId) {
                        seriesId = generateId();
                        seriesMap.set(seriesId, {
                            id: seriesId,
                            title: showTitle,
                            year: new Date().getFullYear(),
                            rating: 0,
                            category: currentItem.group,
                            poster_url: currentItem.logo || "",
                            description: "Series"
                        });
                    }

                    episodes.push({
                        id: generateId(),
                        series_id: seriesId,
                        season_number: seasonNum,
                        episode_number: episodeNum,
                        title: epTitle,
                        duration_minutes: Math.floor((currentItem.duration || 0) / 60),
                        stream_url: currentItem.url
                    });
                }

                currentItem = {};
            }
        }
    }
    console.log(`\nProcessed ${linesProcessed} lines from ${path.basename(filePath)}`);
}

async function run() {
    console.log("Looking for playlists in:", PLAYLISTS_DIR);
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
        fs.writeFileSync(path.join(OUTPUT_DIR, "movies.json"), JSON.stringify({ movies }, null, 2));
        console.log("DEBUG: Wrote movies.json");
        fs.writeFileSync(path.join(OUTPUT_DIR, "series.json"), JSON.stringify({ series: Array.from(seriesMap.values()) }, null, 2));
        console.log("DEBUG: Wrote series.json");
        fs.writeFileSync(path.join(OUTPUT_DIR, "live.json"), JSON.stringify({ channels: live }, null, 2));
        console.log("DEBUG: Wrote live.json");
        fs.writeFileSync(path.join(OUTPUT_DIR, "episodes.json"), JSON.stringify({ episodes }, null, 2));
        console.log("DEBUG: Wrote episodes.json");

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
