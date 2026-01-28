import http from 'http';
import https from 'https';
import fs from 'fs';
import path from 'path';
import { URL } from 'url';

const PORT = 8080;
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

// Global agents with Keep-Alive enabled for faster sequential requests
const httpAgent = new http.Agent({ keepAlive: true });
const httpsAgent = new https.Agent({ keepAlive: true });

http.createServer((req, res) => {
  // Handle CORS
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  const reqUrl = new URL(req.url, `http://${req.headers.host}`);
  
  // --- PROXY HANDLER ---
  if (reqUrl.pathname === '/stream-proxy') {
      const targetUrl = reqUrl.searchParams.get('url');
      if (!targetUrl) {
          res.writeHead(400);
          res.end('Missing url parameter');
          return;
      }

      // --- TS/MPEG-TS WRAPPER LOGIC ---
      // If the target is a .ts file, we must wrap it in a synthetic M3U8 playlist
      // so that HLS.js can play it. Browsers cannot play raw .ts files natively.
      const mode = reqUrl.searchParams.get('mode');
      const isRaw = reqUrl.searchParams.get('raw');
      
      // Check for .ts extension OR explicit mode, AND ensure we aren't already serving the raw stream
      if ((targetUrl.match(/\.ts($|\?)/i) || mode) && !isRaw) {
           console.log(`[Proxy] Wrapping TS stream in M3U8: ${targetUrl}`);
           res.writeHead(200, {
               'Content-Type': 'application/vnd.apple.mpegurl',
               'Access-Control-Allow-Origin': '*'
           });
           
           const isLive = (mode === 'live');
           // For live, we use a large number too to prevent HLS.js from thinking the segment ended prematurely.
           // HLS.js treats -1 as roughly infinite in some configs, but large positive is safer for standard compliance.
           const duration = isLive ? 999999 : 14400; 
           
           let m3u8 = "#EXTM3U\n";
           m3u8 += "#EXT-X-VERSION:3\n";
           // Target duration must be longer than the video length for a single-segment file
           // or sufficiently large.
           m3u8 += "#EXT-X-TARGETDURATION:999999\n"; 
           m3u8 += "#EXT-X-MEDIA-SEQUENCE:0\n";
           m3u8 += `#EXTINF:${duration}.0,\n`;
           
           // Point back to this proxy with raw=true to get the actual byte stream
           const rawLink = `/stream-proxy?url=${encodeURIComponent(targetUrl)}&raw=true`;
           m3u8 += `${rawLink}\n`;
           
           if (!isLive) {
               m3u8 += "#EXT-X-ENDLIST\n";
           }
           
           res.end(m3u8);
           return;
      }
      // --------------------------------

      console.log(`[Proxy] Proxying: ${targetUrl}`);
      
      const handleProxy = (url, redirectCount = 0) => {
          if (redirectCount > 10) {
              if (!res.headersSent) {
                  res.writeHead(502);
                  res.end('Too many redirects');
              }
              return;
          }

          let target;
          try {
              target = new URL(url);
          } catch (e) {
              if (!res.headersSent) {
                  res.writeHead(400);
                  res.end('Invalid URL');
              }
              return;
          }

          const lib = target.protocol === 'https:' ? https : http;
          
          // Filter headers to prevent conflicts
          const headers = { ...req.headers };
          delete headers.host;
          delete headers.connection;
          delete headers['accept-encoding']; // Let the response be raw or handled by browser
          
          // Set required headers
          headers.host = target.hostname;
          headers['user-agent'] = headers['user-agent'] || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36';
          
          const options = {
              hostname: target.hostname,
              port: target.port || (target.protocol === 'https:' ? 443 : 80),
              path: target.pathname + target.search,
              method: req.method, // Forward the method (GET, HEAD, etc.)
              headers: headers,
              // Increase timeout
              timeout: 30000,
              agent: target.protocol === 'https:' ? httpsAgent : httpAgent,
          };

          const proxyReq = lib.request(options, (proxyRes) => {
              // Handle Redirects
              if ([301, 302, 303, 307, 308].includes(proxyRes.statusCode) && proxyRes.headers.location) {
                  console.log(`[Proxy] Redirecting to: ${proxyRes.headers.location}`);
                  // Handle relative redirects
                  let newLocation = proxyRes.headers.location;
                  if (newLocation.startsWith('/')) {
                      newLocation = `${target.protocol}//${target.hostname}${newLocation}`;
                  }
                  
                  // Clear headers before redirecting if we started writing? No, we haven't written yet.
                  // But we must ensure we don't leak listeners.
                  proxyReq.destroy(); 
                  handleProxy(newLocation, redirectCount + 1);
                  return;
              }

              // Forward headers
              Object.keys(proxyRes.headers).forEach(key => {
                  // Skip problematic headers
                  if (key === 'content-encoding') return; // We requested identity (by deleting accept-encoding), but if server sends it anyway, we might need to be careful. Actually passing it is fine if we pipe.
                  if (key === 'access-control-allow-origin') return; // We set our own
                  
                  res.setHeader(key, proxyRes.headers[key]);
              });
              
              // Ensure CORS on response
              res.setHeader('Access-Control-Allow-Origin', '*');

              // Heuristic Fix for Content-Type if missing or generic
              let cType = proxyRes.headers['content-type'];
              if (!cType || cType === 'application/octet-stream' || cType === 'text/plain') {
                  if (targetUrl.includes('.mp4')) cType = 'video/mp4';
                  else if (targetUrl.includes('.mkv')) cType = 'video/x-matroska';
                  else if (targetUrl.includes('.m3u8')) cType = 'application/vnd.apple.mpegurl';
                  else if (targetUrl.includes('.ts')) cType = 'video/mp2t';
                  
                  if (cType) res.setHeader('Content-Type', cType);
              }
              
              res.writeHead(proxyRes.statusCode);
              proxyRes.pipe(res);
          });

          proxyReq.on('error', (e) => {
              console.error(`[Proxy] Error: ${e.message}`);
              if (!res.headersSent) {
                  res.writeHead(502);
                  res.end('Proxy Error');
              }
          });
          
          proxyReq.on('timeout', () => {
              console.error(`[Proxy] Timeout`);
              proxyReq.destroy();
              if (!res.headersSent) {
                  res.writeHead(504);
                  res.end('Gateway Timeout');
              }
          });

          // If client disconnects, abort upstream request
          req.on('close', () => {
              if (proxyReq && !proxyReq.destroyed) {
                  proxyReq.destroy();
              }
          });

          proxyReq.end();
      };

      handleProxy(targetUrl);
      return;
  }

  const cleanUrl = reqUrl.pathname;
  // Serve files from the 'www' directory
  let filePath = './www' + cleanUrl;
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

process.on('uncaughtException', (err) => {
    console.error('Uncaught Exception:', err);
});

process.on('unhandledRejection', (reason, promise) => {
    console.error('Unhandled Rejection at:', promise, 'reason:', reason);
});
