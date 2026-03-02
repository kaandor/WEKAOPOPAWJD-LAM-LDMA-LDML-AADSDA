// Vercel Serverless Function for User Management
// This replaces the client-side GitHub Gist logic for better security and scalability.
// Requires Vercel KV (Redis) or Vercel Postgres to be linked to the project.

// Example using Vercel KV (Redis)
// import { kv } from '@vercel/kv';

module.exports = async (req, res) => {
    // Enable CORS
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');

    if (req.method === 'OPTIONS') {
        res.status(200).end();
        return;
    }

    // Check for Database Configuration
    if (!process.env.KV_REST_API_URL && !process.env.POSTGRES_URL) {
        return res.status(503).json({ 
            error: 'Database not configured. Please link Vercel KV or Postgres in your Vercel Project Settings.',
            code: 'DB_MISSING'
        });
    }

    const { method } = req;
    
    try {
        if (method === 'GET') {
            // Logic to get user profile
            // const user = await kv.get('user:' + req.query.id);
            // return res.json(user);
            return res.json({ message: "DB Connection Ready (Implement Logic)" });
        } 
        
        if (method === 'POST') {
            // Logic to save user profile
            // const { id, data } = req.body;
            // await kv.set('user:' + id, data);
            return res.json({ success: true });
        }
    } catch (error) {
        console.error(error);
        return res.status(500).json({ error: error.message });
    }
};