module.exports = (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    const { url: targetUrl } = req.query;

    if (!targetUrl) {
        res.status(400).send('Missing "url" query parameter');
        return;
    }

    // Dynamic import to support Vercel Node runtime
    import('node-fetch').then(({default: fetch}) => {
        fetch(targetUrl)
            .then(proxyRes => {
                // Forward headers
                proxyRes.headers.forEach((v, k) => {
                    if (k !== 'content-encoding') res.setHeader(k, v);
                });
                res.status(proxyRes.status);
                proxyRes.body.pipe(res);
            })
            .catch(err => {
                console.error('Proxy error:', err);
                res.status(500).send('Proxy error: ' + err.message);
            });
    }).catch(err => {
         // Fallback for environments without node-fetch (using native http/https)
         const https = require('https');
         const http = require('http');
         const url = require('url');
         
         const parsedUrl = url.parse(targetUrl);
         const protocol = parsedUrl.protocol === 'https:' ? https : http;

         const proxyReq = protocol.request(targetUrl, {
            method: req.method,
            headers: {
                ...req.headers,
                host: parsedUrl.host
            }
         }, (proxyRes) => {
            Object.keys(proxyRes.headers).forEach(key => {
                if (key !== 'content-encoding') {
                    res.setHeader(key, proxyRes.headers[key]);
                }
            });
            res.statusCode = proxyRes.statusCode;
            proxyRes.pipe(res);
         });
         
         proxyReq.on('error', (e) => res.status(500).send(e.message));
         if (req.method === 'POST' || req.method === 'PUT') req.pipe(proxyReq);
         else proxyReq.end();
    });
};