
const fs = require('fs');
const path = require('path');

// Mock localStorage
const localStorage = {
    getItem: (key) => {
        if (key === "klyx_content_rating_limit") return "18"; // Default
        if (key === "klyx_profile_explicit_allowed") return "true";
        return null;
    }
};

// Copy of filterRestrictedContent
function filterRestrictedContent(items) {
    if (!items || !Array.isArray(items)) return [];
    
    const ratingLimit = parseInt(localStorage.getItem("klyx_content_rating_limit") || "18");
    const isExplicitAllowed = localStorage.getItem("klyx_profile_explicit_allowed") === "true";

    const keywordsExplicit = ["xxx", "porn", "porno", "hentai", "adultos", "adults", "adult", "erotic", "nude", "sexo", "sex", "18+ explicit", "hardcore", "playboy", "erotico", "erótica", "erotica", "sexul"];
    const keywords18 = ["+18", "18+", "horror", "terror", "hot", "violencia extrema", "gore", "thriller", "suspense pesado", "morte"];
    const keywords16 = ["violence", "crime", "drug", "16+", "violencia", "drogas", "assassinato", "misterio", "investigacao"];
    const keywords14 = ["action", "fight", "14+", "acao", "luta", "guerra", "tiro"];
    const keywords12 = ["adventure", "drama", "12+", "aventura", "suspense", "romance"];
    const keywords10 = ["comedy", "10+", "comedia"];
    const keywordsSafe = ["animacao", "animation", "desenho", "infantil", "kids", "crianca", "criança", "livre", "disney", "pixar", "fantasia", "fantasy", "familia", "family"];
    
    return items.filter(item => {
        if (!item) return false;
        const title = (item.title || "").toLowerCase();
        const category = (item.category || "").toLowerCase();
        const combined = title + " " + category;
        
        if (keywordsExplicit.some(kw => combined.includes(kw))) {
            return ratingLimit >= 18 && isExplicitAllowed;
        }

        let contentRating = 12; 
        
        if (keywords18.some(kw => combined.includes(kw))) contentRating = 18;
        else if (keywords16.some(kw => combined.includes(kw))) contentRating = 16;
        else if (keywords14.some(kw => combined.includes(kw))) contentRating = 14;
        else if (keywordsSafe.some(kw => combined.includes(kw))) contentRating = 0; // Livre
        else if (keywords12.some(kw => combined.includes(kw))) contentRating = 12;
        else if (keywords10.some(kw => combined.includes(kw))) contentRating = 10;
        
        return contentRating <= ratingLimit;
    });
}

// Copy of deduplicateMovies
function deduplicateMovies(items) {
    if (!items || !Array.isArray(items)) return [];
    
    items = filterRestrictedContent(items);
    
    const moviesMap = new Map();
    
    items.forEach(movie => {
        if (!movie || !movie.title) return;
        let title = movie.title.trim();
        const lowerTitle = title.toLowerCase();
        
        const keywordsSafe = ["animacao", "animation", "desenho", "infantil", "kids", "crianca", "criança", "livre", "disney", "pixar", "fantasia", "fantasy", "familia", "family"];
        const combinedForCat = (title + " " + (movie.category || "")).toLowerCase();
        if (keywordsSafe.some(kw => combinedForCat.includes(kw))) {
             if (movie.category && !movie.category.includes("Criança")) {
                 movie.category += " | Criança";
             }
        }
        
        // Simplified dedupe for test
        const baseTitle = title; 
        if (!moviesMap.has(baseTitle)) {
            moviesMap.set(baseTitle, movie);
        }
    });

    return Array.from(moviesMap.values());
}

// Load Movies
const moviesPath = path.join(__dirname, 'klyx_web_export/assets/data/movies.json');
try {
    const data = fs.readFileSync(moviesPath, 'utf8');
    const json = JSON.parse(data);
    
    console.log(`Total Movies: ${json.movies.length}`);
    
    const processed = deduplicateMovies(json.movies);
    console.log(`Processed Movies: ${processed.length}`);
    
    const kidsMovies = processed.filter(m => m.category && m.category.includes("Criança"));
    console.log(`Kids Movies (Criança): ${kidsMovies.length}`);
    
    if (kidsMovies.length > 0) {
        console.log("Sample Kids Movies:");
        kidsMovies.slice(0, 5).forEach(m => console.log(`- ${m.title} (${m.category})`));
    } else {
        console.log("NO KIDS MOVIES FOUND!");
    }
    
} catch (e) {
    console.error("Error:", e.message);
}
