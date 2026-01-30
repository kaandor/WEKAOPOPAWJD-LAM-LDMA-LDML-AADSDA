import fetch from "node-fetch";

export default async function handler(req, res) {
  // Set CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept');

  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }

  // Get parameters from body (POST) or query (GET)
  let params = req.query;
  if (req.method === 'POST') {
    // If body is already parsed by Vercel (e.g. content-type application/json)
    if (req.body && typeof req.body === 'object') {
      params = { ...params, ...req.body };
    } else if (req.body) {
      try {
        params = { ...params, ...JSON.parse(req.body) };
      } catch (e) {
        // Body might be empty or invalid
      }
    }
  }

  const { code, client_id, client_secret, redirect_uri } = params;

  if (!code || !client_id || !client_secret) {
    return res.status(400).json({ 
      error: 'Missing required parameters',
      received: { code: !!code, client_id: !!client_id, client_secret: !!client_secret }
    });
  }

  try {
    const response = await fetch('https://github.com/login/oauth/access_token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json'
      },
      body: JSON.stringify({
        client_id,
        client_secret,
        code,
        redirect_uri
      })
    });

    const data = await response.json();
    return res.status(200).json(data);
  } catch (error) {
    console.error('Token exchange error:', error);
    return res.status(500).json({ error: 'Failed to exchange token', details: error.message });
  }
}
