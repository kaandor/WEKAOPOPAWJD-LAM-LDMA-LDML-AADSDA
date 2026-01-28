import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { execSync } from "child_process";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const DATA_FILE = path.resolve(__dirname, "../assets/data/live.json");

if (!fs.existsSync(DATA_FILE)) {
    console.error("❌ live.json não encontrado! Execute a conversão primeiro.");
    process.exit(1);
}

console.log("🔓 Desbloqueando canais adultos...");
const content = JSON.parse(fs.readFileSync(DATA_FILE, "utf-8"));
// Verifica estrutura (array direto ou objeto { channels: [...] })
const channels = Array.isArray(content) ? content : (content.channels || []);
let count = 0;

channels.forEach(item => {
    // Verifica se é adulto (baseado na lógica de conversão) ou se já está bloqueado
    const isAdult = /adulto|xxx|porn|sex|18\+|sexy|hentai/i.test((item.category || "") + " " + (item.title || ""));
    
    if (item.locked || isAdult) {
        if (item.locked) {
            delete item.locked;
            count++;
        }
    }
});

if (count > 0) {
    fs.writeFileSync(DATA_FILE, JSON.stringify(content, null, 2));
    console.log(`✅ ${count} canais desbloqueados.`);
    
    console.log("☁️ Enviando atualização para o Firebase...");
    try {
        // Executa o script de upload na mesma pasta
        execSync("node upload_firebase.mjs", { stdio: "inherit", cwd: __dirname });
        console.log("🎉 Processo concluído com sucesso!");
    } catch (e) {
        console.error("❌ Falha no upload:", e.message);
    }
} else {
    console.log("⚠️ Nenhum canal bloqueado encontrado para desbloquear.");
}
