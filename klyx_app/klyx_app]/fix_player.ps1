$path = ".\WEKAOPOPAWJD-LAM-LDMA-LDML-AADSDA\player_v2.html"
$content = Get-Content -Path $path -Raw
$jsCode = @'
<script type="module">
      const getPaths = (filename) => {
        const v = "20260226-v6-fix-" + Date.now();
        return [
          `./js/${filename}?v=${v}`,
          `./www/js/${filename}?v=${v}`,
          `../js/${filename}?v=${v}`,
          `/${filename}?v=${v}`
        ];
      };

      const importFallback = async (modules) => {
        let lastError;
        for (const path of modules) {
          try {
            console.log(`[Player] Tentando carregar módulo: ${path}`);
            return await import(path);
          } catch (e) {
            console.warn(`[Player] Falha ao carregar ${path}:`, e);
            lastError = e;
          }
        }
        throw lastError;
      };

      // Register Service Worker for PWA
      if ('serviceWorker' in navigator) {
        try {
          navigator.serviceWorker.register('./sw.js')
            .then(() => console.log('Service Worker registered'))
            .catch(err => {
                if (err.name === 'InvalidStateError' || err.message.includes('InvalidStateError')) return;
                console.warn('Service Worker registration skipped:', err.message);
            });
        } catch (e) {
          // Ignore synchronous errors
        }
      }

      try {
          console.log("Player V2 starting...");

          // AGGRESSIVE SAFETY NET: Remove old manual ad overlay
          setInterval(() => {
              try {
                  const targetText = "Se o anúncio não";
                  const allElements = document.querySelectorAll('*');
                  for (let el of allElements) {
                      if (el.innerText && (
                          el.innerText.includes(targetText) || 
                          el.innerText.includes("Anúncio 1 de 1") ||
                          el.innerText.includes("Pular em") ||
                          el.innerText.includes("Skip in")
                      )) {
                          console.warn("Found and removed old manual ad overlay:", el);
                          el.style.display = 'none';
                          el.remove();
                      }
                      const style = window.getComputedStyle(el);
                      if (el.closest('#ad-container') || el.className.includes('ima-')) {
                          continue;
                      }

                      if (style.zIndex > 10000 && (el.innerText.includes("Pular") || el.innerText.includes("Skip"))) {
                           console.warn("Found and removed suspicious high z-index overlay:", el);
                           el.style.display = 'none';
                           el.remove();
                      }
                  }
              } catch(e) {}
          }, 500);

        // Load modules with fallback
        console.log("[Player] Iniciando carregamento de módulos...");
        
        const { mountAppShell } = await importFallback(getPaths('router.js'));
        const { initPlayer } = await importFallback(getPaths('player_core.js'));

        console.log("[Player] Módulos carregados. Inicializando...");
        await mountAppShell({ currentPath: "" });
        await initPlayer();
      } catch (e) {
          console.error("Critical Player Error:", e);
          document.body.innerHTML += `<div style="position:fixed;top:0;left:0;width:100%;height:100%;background:black;color:red;z-index:99999;padding:20px;"><h1>Erro Crítico</h1><p>Falha ao carregar o player.</p><pre>${e.message}</pre></div>`;
      }
    </script>
'@

# Replace content
$newContent = $content -replace '(?s)<script type="module">.*?</script>', $jsCode
Set-Content -Path $path -Value $newContent -Encoding UTF8

# Create .nojekyll
New-Item -Path ".\WEKAOPOPAWJD-LAM-LDMA-LDML-AADSDA\.nojekyll" -ItemType File -Force
