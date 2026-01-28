import fetch from "node-fetch";

export default async function handler(req, res) {
  const url = req.query.url;

  if (!url) {
    return res.status(400).send("URL não informada");
  }

  try {
    const response = await fetch(url, {
      headers: {
        "User-Agent": "Mozilla/5.0",
        "Referer": url
      }
    });

    res.setHeader("Access-Control-Allow-Origin", "*");
    res.setHeader("Content-Type", "application/vnd.apple.mpegurl");

    response.body.pipe(res);
  } catch (err) {
    res.status(500).send("Erro no stream");
  }
}