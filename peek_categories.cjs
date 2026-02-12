const fs = require('fs');
const M3U_PATH = String.raw`C:\Users\kaandro\Downloads\Iptv-Brasil-2026-master\Iptv-Brasil-2026-master\CanaisBR05.m3u`;

function peek() {
    const content = fs.readFileSync(M3U_PATH, 'utf8');
    const lines = content.split('\n');
    
    let currentCategory = "";
    
    const samples = {
        "FILMES & SERIES": [],
        "MAX": [],
        "ABERTOS": []
    };

    lines.forEach(line => {
        if (line.startsWith('#EXTINF:')) {
            const groupMatch = line.match(/group-title="([^"]*)"/);
            currentCategory = groupMatch ? groupMatch[1] : "NO_CATEGORY";
            
            if (samples[currentCategory] && samples[currentCategory].length < 5) {
                // Extract title
                const titleParts = line.split(',');
                const title = titleParts[titleParts.length - 1].trim();
                samples[currentCategory].push(title);
            }
        }
    });

    console.log(JSON.stringify(samples, null, 2));
}

peek();
