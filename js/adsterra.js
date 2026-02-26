// Adsterra Social Bar Injection
// Token: 5dc8b316f75f6ba11bf1202ce6bd1609
(function() {
    // Evita duplicidade
    if (window.adsterraSocialBarInjected) return;
    window.adsterraSocialBarInjected = true;

    var script = document.createElement('script');
    script.type = 'text/javascript';
    
    // -------------------------------------------------------------------------
    // IMPORTANTE: O domínio abaixo ('pl25436398.net') é um EXEMPLO comum.
    // Se o anúncio não aparecer, verifique no painel da Adsterra qual é o domínio 
    // correto para o seu script (ex: glotgrone.com, ou outro) e altere aqui.
    // -------------------------------------------------------------------------
    var adsterraDomain = 'pl25436398.net'; 
    
    script.src = '//' + adsterraDomain + '/5d/c8/b3/5dc8b316f75f6ba11bf1202ce6bd1609.js';
    
    script.onerror = function() {
        console.warn('[Adsterra] Falha ao carregar script. Verifique se o domínio ' + adsterraDomain + ' está correto.');
    };

    document.head.appendChild(script);
    console.log('[Adsterra] Script injetado: ' + script.src);
})();
