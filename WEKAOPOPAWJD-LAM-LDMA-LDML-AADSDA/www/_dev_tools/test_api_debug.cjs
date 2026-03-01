
const fs = require('fs');
const path = require('path');

// Mock browser environment
const localStorageMock = {
    store: {},
    getItem: function(key) { return this.store[key] || null; },
    setItem: function(key, value) { this.store[key] = value.toString(); },
    removeItem: function(key) { delete this.store[key]; }
};

global.localStorage = localStorageMock;
global.window = { location: { hostname: 'localhost', protocol: 'http:' } };

// Mock api.js functions
function isAdultEnabled() {
    return localStorage.getItem('klyx_adult_enabled') === 'true';
}

async function testLogic() {
    console.log("--- Testing API Logic ---");
    
    // 1. Load series.json (Corrected Path)
    const seriesPath = path.join(__dirname, 'assets', 'data', 'series.json');
    const moviesPath = path.join(__dirname, 'assets', 'data', 'movies.json');
    
    let items = [];
    
    if (fs.existsSync(seriesPath)) {
        const rawSeries = JSON.parse(fs.readFileSync(seriesPath, 'utf8'));
        items = items.concat(rawSeries.series || []);
        console.log(`Loaded ${items.length} items from series.json`);
    }

    if (fs.existsSync(moviesPath)) {
        const rawMovies = JSON.parse(fs.readFileSync(moviesPath, 'utf8'));
        items = items.concat(rawMovies.movies || []);
        console.log(`Loaded items total (including movies): ${items.length}`);
    }

    
    // Sample item check
    const adultItem = items.find(i => i.title.includes("[XXX]"));
    if (adultItem) console.log("Found adult item sample:", adultItem.category);
    const normalItem = items.find(i => !i.title.includes("[XXX]"));
    if (normalItem) console.log("Found normal item sample:", normalItem.category, normalItem.title);

    // 2. Test Filter Logic (Adult Disabled)
    console.log("\n--- Test 1: Adult Disabled ---");
    localStorage.setItem('klyx_adult_enabled', 'false');
    let filteredItems = [...items];
    const showAdult = isAdultEnabled();
    const adultKeywords = ['adult', 'xxx', 'porn', '18+', 'sex', 'hentai'];
    
    if (!showAdult) {
        filteredItems = filteredItems.filter(i => {
            const c = (i.category || "").toLowerCase();
            const g = (i.genres || "").toLowerCase();
            return !adultKeywords.some(k => c.includes(k) || g.includes(k));
        });
    }
    console.log(`Filtered items count: ${filteredItems.length}`);
    const remainingAdult = filteredItems.find(i => i.title.includes("[XXX]"));
    console.log("Adult item present?", !!remainingAdult);
    
    // 3. Test Categories Logic
    console.log("\n--- Test 2: Categories Generation ---");
    const catsMap = {};
    filteredItems.forEach(i => {
        const c = i.category;
        if (c) {
            if (!catsMap[c]) catsMap[c] = 0;
            catsMap[c]++;
        }
    });
    const categories = Object.keys(catsMap).sort().map(k => ({ category: k, count: catsMap[k] }));
    console.log("Categories:", categories);
    
    // 4. Test Adult Enabled
    console.log("\n--- Test 3: Adult Enabled ---");
    localStorage.setItem('klyx_adult_enabled', 'true');
    filteredItems = [...items];
    // No filter
    console.log(`Items count (Adult Enabled): ${filteredItems.length}`);
    
    const catsMapAdult = {};
    filteredItems.forEach(i => {
        const c = i.category;
        if (c) {
            if (!catsMapAdult[c]) catsMapAdult[c] = 0;
            catsMapAdult[c]++;
        }
    });
    const categoriesAdultCorrect = Object.keys(catsMapAdult).sort().map(k => ({ category: k, count: catsMapAdult[k] }));
    console.log("Categories (Adult Enabled) Count:", categoriesAdultCorrect.length);
    if (categoriesAdultCorrect.length > 0) console.log("First 5 categories:", categoriesAdultCorrect.slice(0, 5));

}

testLogic();
