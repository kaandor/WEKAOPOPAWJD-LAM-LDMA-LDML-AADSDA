import { kv } from '@vercel/kv';

export default async function handler(req, res) {
    // CORS configuration
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization, X-Requested-With');

    if (req.method === 'OPTIONS') {
        return res.status(200).end();
    }

    try {
        if (req.method === 'GET') {
            const { key } = req.query;
            if (!key) return res.status(400).json({ error: 'Key is required' });
            
            // Check if KV is configured
            if (!process.env.KV_REST_API_URL) {
                console.warn("Vercel KV not configured.");
                return res.status(200).json(null);
            }

            const value = await kv.get(key);
            return res.status(200).json(value);
        }

        if (req.method === 'POST') {
            const { key, value, ttl } = req.body;
            if (!key || value === undefined) return res.status(400).json({ error: 'Key and value are required' });

            if (!process.env.KV_REST_API_URL) {
                 console.warn("Vercel KV not configured. Mocking success.");
                 return res.status(200).json({ success: true, mocked: true });
            }

            if (ttl) await kv.set(key, value, { ex: ttl });
            else await kv.set(key, value);

            return res.status(200).json({ success: true });
        }
        
        return res.status(405).json({ error: 'Method not allowed' });
    } catch (error) {
        console.error('Database Error:', error);
        return res.status(500).json({ error: 'Internal Server Error', details: error.message });
    }
}