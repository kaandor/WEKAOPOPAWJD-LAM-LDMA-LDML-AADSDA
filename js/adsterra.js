// Adsterra Social Bar Injection
// Script URL provided by user: https://pl28795901.effectivegatecpm.com/f6/12/55/f6125592a9bf2f197c13521c26650d49.js
(function() {
    // Evita duplicidade
    if (window.adsterraSocialBarInjected) return;
    window.adsterraSocialBarInjected = true;

    var script = document.createElement('script');
    script.type = 'text/javascript';
    script.src = 'https://pl28795901.effectivegatecpm.com/f6/12/55/f6125592a9bf2f197c13521c26650d49.js';
    
    script.onerror = function() {
        console.warn('[Adsterra] Falha ao carregar script Social Bar.');
    };

    document.head.appendChild(script);
    console.log('[Adsterra] Script injetado: ' + script.src);
})();
