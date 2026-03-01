const fs = require('fs');
const path = require('path');

const M3U_PATH = String.raw`C:\Users\kaandro\Downloads\Iptv-Brasil-2026-master\Iptv-Brasil-2026-master\CanaisBR05.m3u`;

function analyze() {
    try {
        const content = fs.readFileSync(M3U_PATH, 'utf8');
        const lines = content.split('\n');
        const categories = new Set();
        let totalItems = 0;

        lines.forEach(line => {
            if (line.startsWith('#EXTINF:')) {
                totalItems++;
                const groupMatch = line.match(/group-title="([^"]*)"/);
                if (groupMatch) {
                    categories.add(groupMatch[1]);
                } else {
                    categories.add("NO_CATEGORY");
                }
            }
        });

        console.log(`Total items: ${totalItems}`);
        console.log(`Total unique categories: ${categories.size}`);
        console.log("Categories:");
        const sorted = Array.from(categories).sort();
        console.log(JSON.stringify(sorted, null, 2));

    } catch (e) {
        console.error("Error:", e);
    }
}

analyze();
