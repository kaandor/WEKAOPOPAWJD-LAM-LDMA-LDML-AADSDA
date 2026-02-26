const fs = require("fs");
const path = require("path");

const SRC_DIR = path.join(__dirname, "js");
const DST_DIR = path.resolve(__dirname, "..", "..", "..", "WEKAOPOPAWJD-LAM-LDMA-LDML-AADSDA", "www", "js");
const HTML_SRC_DIR = __dirname;
const HTML_DST_DIR = path.resolve(__dirname, "..", "..", "..", "WEKAOPOPAWJD-LAM-LDMA-LDML-AADSDA", "www");
const HTML_ROOT_DST_DIR = path.resolve(__dirname, "..", "..", "..", "WEKAOPOPAWJD-LAM-LDMA-LDML-AADSDA");
const CSS_SRC_DIR = path.join(__dirname, "css");
const CSS_DST_DIR = path.resolve(__dirname, "..", "..", "..", "WEKAOPOPAWJD-LAM-LDMA-LDML-AADSDA", "www", "css");

if (!fs.existsSync(DST_DIR)) {
  console.log("Criando diretório de destino:", DST_DIR);
  fs.mkdirSync(DST_DIR, { recursive: true });
}

["api.js", "ui.js", "player_core.js", "router.js"].forEach((file) => {
  const src = path.join(SRC_DIR, file);
  const dst = path.join(DST_DIR, file);

  if (!fs.existsSync(src)) {
    console.warn("Arquivo de origem não encontrado:", src);
    return;
  }

  fs.copyFileSync(src, dst);
  console.log("Atualizado JS:", dst);
});

["index.html", "login.html", "settings.html"].forEach((file) => {
  const src = path.join(HTML_SRC_DIR, file);
  const dst = path.join(HTML_DST_DIR, file);
  const rootDst = path.join(HTML_ROOT_DST_DIR, file);

  if (!fs.existsSync(src)) {
    console.warn("Arquivo HTML de origem não encontrado:", src);
    return;
  }

  fs.copyFileSync(src, dst);
  console.log("Atualizado HTML:", dst);
  try {
    fs.copyFileSync(src, rootDst);
    console.log("Atualizado HTML raiz:", rootDst);
  } catch (e) {
    console.warn("Falha ao atualizar HTML raiz:", rootDst, e.message);
  }
});

if (fs.existsSync(CSS_SRC_DIR) && fs.existsSync(CSS_DST_DIR)) {
  ["global.css", "netflix-ui.css"].forEach((file) => {
    const src = path.join(CSS_SRC_DIR, file);
    const dst = path.join(CSS_DST_DIR, file);

    if (!fs.existsSync(src)) {
      console.warn("Arquivo CSS de origem não encontrado:", src);
      return;
    }

    fs.copyFileSync(src, dst);
    console.log("Atualizado CSS:", dst);
  });
} else {
  console.warn("Diretório CSS de origem ou destino não encontrado, pulando CSS.");
}

console.log("Sincronização de JS, HTML e CSS concluída.");
