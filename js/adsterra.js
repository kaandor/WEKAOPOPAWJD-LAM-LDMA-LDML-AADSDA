// Adsterra Ads Injection (Social Bar + Popunder)
(function() {
    // Evita duplicidade
    if (window.adsterraInjected) return;
    window.adsterraInjected = true;

    console.log('[Adsterra] Iniciando injeção de anúncios...');

    // Verifica se estamos no player
    const isPlayer = window.location.href.includes('player');

    // 1. Social Bar Script - ENABLED GLOBALLY (INCLUDING PLAYER)
    var socialBar = document.createElement('script');
    socialBar.type = 'text/javascript';
    socialBar.src = 'https://pl28795901.effectivegatecpm.com/f6/12/55/f6125592a9bf2f197c13521c26650d49.js';
    
    socialBar.onerror = function() { console.warn('[Adsterra] Falha ao carregar Social Bar.'); };
    document.head.appendChild(socialBar);
    console.log('[Adsterra] Social Bar injetado.');

    // 2. Popunder Script - SEMPRE INJETAR (Background Ads)
    // URL: https://pl28795942.effectivegatecpm.com/7e/f3/3b/7ef33b35b33d3da55916f217de607f9b.js
    var popunder = document.createElement('script');
    popunder.type = 'text/javascript';
    popunder.src = 'https://pl28795942.effectivegatecpm.com/7e/f3/3b/7ef33b35b33d3da55916f217de607f9b.js';
    popunder.onerror = function() { console.warn('[Adsterra] Falha ao carregar Popunder.'); };
    document.head.appendChild(popunder);
    console.log('[Adsterra] Popunder injetado.');

})();
