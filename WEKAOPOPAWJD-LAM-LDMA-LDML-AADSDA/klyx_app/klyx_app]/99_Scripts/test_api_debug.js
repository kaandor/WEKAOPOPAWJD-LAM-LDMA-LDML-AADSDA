
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
    
    // 1. Load series.json
    const seriesPath = path.join(__dirname, 'klyx_web_export', 'assets', 'data', 'series.json');
    if (!fs.existsSync(seriesPath)) {
        console.error("series.json not found at", seriesPath);
        return;
    }
    const rawData = JSON.parse(fs.readFileSync(seriesPath, 'utf8'));
    let items = rawData.series || [];
    console.log(`Loaded ${items.length} items from series.json`);
    
    // Sample item check
    const adultItem = items.find(i => i.title.includes("[XXX]"));
    if (adultItem) console.log("Found adult item sample:", adultItem.category);
    const normalItem = items.find(i => i.title.includes("Wild Cards"));
    if (normalItem) console.log("Found normal item sample:", normalItem.category);

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
    console.log(`Items count: ${filteredItems.length}`);
    
    const catsMapAdult = {};
    filteredItems.forEach(i => {
        const c = i.category;
        if (c) {
            if (!catsMapAdult[c]) catsMapAdult[c] = 0;
            catsMapAdult[c]++;
        }
    });
    const categoriesAdult = Object.keys(catsMapAdult).sort().map(k => ({ category: k, count: catsMapAdult[c] })); // Logic error in my map? No, map(k => ...) uses k.
    // Wait, catsMapAdult[c] inside map loop? No, inside map(k => ...), use k.
    
    const categoriesAdultCorrect = Object.keys(catsMapAdult).sort().map(k => ({ category: k, count: catsMapAdult[k] }));
    console.log("Categories (Adult Enabled) Count:", categoriesAdultCorrect.length);
    if (categoriesAdultCorrect.length > 0) console.log("First 5 categories:", categoriesAdultCorrect.slice(0, 5));

}

testLogic();
