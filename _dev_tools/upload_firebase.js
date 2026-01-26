import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const FIREBASE_DB_URL = "https://klix-iptv-default-rtdb.firebaseio.com";
const DATA_DIR = path.resolve(__dirname, "assets/data");

async function uploadFile(filename, firebasePath) {
    const filePath = path.join(DATA_DIR, filename);
    if (!fs.existsSync(filePath)) {
        console.warn(`⚠️ Arquivo não encontrado: ${filename}`);
        return;
    }

    console.log(`\n📂 Lendo ${filename}...`);
    const rawData = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(rawData);

    console.log(`☁️ Enviando para ${FIREBASE_DB_URL}/${firebasePath}...`);
    
    // Usando fetch nativo (Node 18+)
    try {
        const response = await fetch(`${FIREBASE_DB_URL}/${firebasePath}.json`, {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(data)
        });

        if (response.ok) {
            console.log(`✅ Sucesso! ${firebasePath} atualizado.`);
        } else {
            console.error(`❌ Erro ${response.status}: ${response.statusText}`);
            const text = await response.text();
            console.error("Detalhes:", text);
        }
    } catch (error) {
        console.error(`❌ Falha na requisição: ${error.message}`);
    }
}

async function run() {
    console.log("🚀 Iniciando upload para o Firebase...");
    
    // Upload Home
    await uploadFile("home.json", "catalog/home");
    
    // Upload Movies
    await uploadFile("movies.json", "catalog/movies");
    
    // Upload Series
    await uploadFile("series.json", "catalog/series");
    
    // Upload Episodes
    await uploadFile("episodes.json", "catalog/episodes");
    
    // Upload Live Channels
    await uploadFile("live.json", "catalog/live");

    console.log("\n🏁 Processo finalizado!");
}

run();
