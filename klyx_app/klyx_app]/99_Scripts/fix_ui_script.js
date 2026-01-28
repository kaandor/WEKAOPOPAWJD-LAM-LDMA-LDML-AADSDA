const fs = require('fs');
const path = require('path');

const filePath = String.raw`c:\Users\kaandro\Downloads\kaandro becker\klyx_app\klyx_app]\klyx_web_export\js\ui.js`;
let content = fs.readFileSync(filePath, 'utf8');

// Pattern 1: Rails (inside arrow function, sometimes with parens)
// Match: window.location.href = `./player.html?type=movie&id=${encodeURIComponent(item.id)}`
// Replace: openPlayer(`./player.html?type=movie&id=${encodeURIComponent(item.id)}`)
content = content.replace(/window\.location\.href\s*=\s*`\.\/player\.html\?type=movie&id=\$\{encodeURIComponent\(item\.id\)\}`/g, 
    'openPlayer(`./player.html?type=movie&id=${encodeURIComponent(item.id)}`)');

// Pattern 2: Generic with params.toString()
// Match: window.location.href = `./player.html?${params.toString()}`;
// Replace: openPlayer(`./player.html?${params.toString()}`);
content = content.replace(/window\.location\.href\s*=\s*`\.\/player\.html\?\$\{params\.toString\(\)\}`/g, 
    'openPlayer(`./player.html?${params.toString()}`)');

fs.writeFileSync(filePath, content, 'utf8');
console.log("Done");
