const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = 8081;
const MIME_TYPES = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.m3u': 'text/plain',
  '.m3u8': 'application/vnd.apple.mpegurl',
  '.ts': 'video/mp2t'
};

http.createServer((req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Stream Proxy
  if (req.url.startsWith('/stream-proxy')) {
    const urlParams = new URLSearchParams(req.url.split('?')[1]);
    const targetUrl = urlParams.get('url');

    if (!targetUrl) {
      res.writeHead(400);
      res.end('Missing "url" parameter');
      return;
    }

    // --- TS/MPEG-TS WRAPPER LOGIC ---
    const mode = urlParams.get('mode');
    const isRaw = urlParams.get('raw');
    
    if ((targetUrl.match(/\.ts($|\?)/i) || mode) && !isRaw) {
         console.log(`[Proxy] Wrapping TS stream in M3U8: ${targetUrl}`);
         res.writeHead(200, {
             'Content-Type': 'application/vnd.apple.mpegurl',
             'Access-Control-Allow-Origin': '*'
         });
         
         const isLive = (mode === 'live');
         const duration = isLive ? -1 : 14400; 
         
         let m3u8 = "#EXTM3U\n";
         m3u8 += "#EXT-X-VERSION:3\n";
         m3u8 += "#EXT-X-TARGETDURATION:14400\n"; 
         m3u8 += "#EXT-X-MEDIA-SEQUENCE:0\n";
         m3u8 += `#EXTINF:${isLive ? -1 : 14400.0},\n`;
         
         const rawLink = `/stream-proxy?url=${encodeURIComponent(targetUrl)}&raw=true`;
         m3u8 += `${rawLink}\n`;
         
         if (!isLive) {
             m3u8 += "#EXT-X-ENDLIST\n";
         }
         
         res.end(m3u8);
         return;
    }
    // --------------------------------

    // Basic Proxy Implementation with Redirect Support
    const followRedirects = (url, attempts = 0) => {
        if (attempts > 5) {
            if (!res.headersSent) {
                res.writeHead(500);
                res.end("Too many redirects");
            }
            return;
        }

        const lib = url.startsWith('https') ? require('https') : require('http');
        const parsedUrl = new URL(url);
        
        const options = {
            hostname: parsedUrl.hostname,
            port: parsedUrl.port || (url.startsWith('https') ? 443 : 80),
            path: parsedUrl.pathname + parsedUrl.search,
            method: 'GET',
            headers: {
                'User-Agent': req.headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
                'Accept': '*/*',
                'Connection': 'keep-alive'
            }
        };

        // Forward Range header if present (Critical for video seeking)
        if (req.headers['range']) {
            options.headers['Range'] = req.headers['range'];
        }

        const proxyReq = lib.request(options, (proxyRes) => {
            // Handle Redirects
            if (proxyRes.statusCode >= 300 && proxyRes.statusCode < 400 && proxyRes.headers.location) {
                const newUrl = new URL(proxyRes.headers.location, url).href;
                console.log(`[Proxy] Redirecting to: ${newUrl}`);
                // consume response data to free up memory
                proxyRes.resume(); 
                followRedirects(newUrl, attempts + 1);
                return;
            }

            // Forward Status
            res.statusCode = proxyRes.statusCode;

            // Forward Headers
            const headersToForward = [
                'content-type', 'content-length', 'accept-ranges', 
                'content-range', 'date', 'last-modified', 'etag'
            ];
            
            headersToForward.forEach(header => {
                if (proxyRes.headers[header]) {
                    res.setHeader(header, proxyRes.headers[header]);
                }
            });

            // Heuristic Fix for MP4/MKV Content-Type if missing or generic
            let contentType = proxyRes.headers['content-type'];
            if (!contentType || contentType === 'application/octet-stream' || contentType === 'text/plain') {
                if (url.includes('.mp4')) contentType = 'video/mp4';
                else if (url.includes('.mkv')) contentType = 'video/x-matroska';
                else if (url.includes('.m3u8')) contentType = 'application/vnd.apple.mpegurl';
                else if (url.includes('.ts')) contentType = 'video/mp2t';
                
                if (contentType) res.setHeader('Content-Type', contentType);
            }

            proxyRes.pipe(res);
        });

        proxyReq.on('error', (err) => {
            console.error("Proxy Error:", err.message);
            if (!res.headersSent) {
                res.writeHead(500);
                res.end("Proxy Error");
            }
        });

        proxyReq.end();
    };

    followRedirects(targetUrl);
    return;
  }
  
  const cleanUrl = req.url.split('?')[0];
  let filePath = '.' + cleanUrl;
  if (filePath.endsWith('/')) filePath += 'index.html';

  const extname = path.extname(filePath);
  let contentType = MIME_TYPES[extname] || 'application/octet-stream';

  fs.readFile(filePath, (error, content) => {
    if (error) {
      if(error.code == 'ENOENT'){
         console.log(`404: ${filePath}`);
         res.writeHead(404);
         res.end('Not Found');
      } else {
        res.writeHead(500);
        res.end('Server Error: '+error.code);
      }
    } else {
      res.writeHead(200, { 'Content-Type': contentType });
      res.end(content, 'utf-8');
    }
  });
}).listen(PORT, () => {
    console.log(`Frontend Server running at http://localhost:${PORT}/`);
});
