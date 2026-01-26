
// Detect if the app is running in standalone mode
const isStandalone = window.matchMedia('(display-mode: standalone)').matches || 
                    window.matchMedia('(display-mode: fullscreen)').matches || 
                    window.navigator.standalone === true;

// Detect iOS
const isIOS = /iPad|iPhone|iPod/.test(navigator.userAgent) && !window.MSStream;

// Create the install prompt element
function createInstallPrompt() {
  if (isStandalone) return; // Don't show if already installed
  if (sessionStorage.getItem('pwa-prompt-dismissed')) return; // Don't show if dismissed

  const prompt = document.createElement('div');
  prompt.className = 'pwa-install-prompt';
  prompt.innerHTML = `
    <div class="pwa-content">
      <div class="pwa-icon">
        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path stroke-linecap="round" stroke-linejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
        </svg>
      </div>
      <div class="pwa-text">
        <h3>Instalar Aplicativo</h3>
        <p>Instale para remover a barra de navegação e ter melhor desempenho.</p>
      </div>
      <button class="pwa-close">&times;</button>
    </div>
    ${isIOS ? `
      <div class="pwa-ios-instructions">
        <p>Toque em <span class="share-icon">⎋</span> e depois em "Adicionar à Tela de Início" <span class="plus-icon">＋</span></p>
      </div>
    ` : `
      <button class="pwa-install-btn">Instalar</button>
    `}
  `;

  document.body.appendChild(prompt);

  // Styles
  const style = document.createElement('style');
  style.textContent = `
    .pwa-install-prompt {
      position: fixed;
      bottom: 20px;
      left: 20px;
      right: 20px;
      background: rgba(20, 20, 25, 0.95);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.1);
      border-radius: 16px;
      padding: 16px;
      z-index: 10000;
      box-shadow: 0 10px 40px rgba(0,0,0,0.5);
      animation: slideUp 0.5s ease-out;
      color: #fff;
      font-family: -apple-system, system-ui, sans-serif;
    }
    .pwa-content {
      display: flex;
      align-items: center;
      gap: 12px;
      margin-bottom: ${isIOS ? '12px' : '0'};
    }
    .pwa-icon {
      width: 40px;
      height: 40px;
      background: var(--accent, #6d5ef5);
      border-radius: 10px;
      display: flex;
      align-items: center;
      justify-content: center;
    }
    .pwa-icon svg {
      width: 20px;
      height: 20px;
      stroke: #fff;
    }
    .pwa-text {
      flex: 1;
    }
    .pwa-text h3 {
      margin: 0;
      font-size: 16px;
      font-weight: 600;
    }
    .pwa-text p {
      margin: 4px 0 0;
      font-size: 13px;
      opacity: 0.7;
      line-height: 1.3;
    }
    .pwa-close {
      background: none;
      border: none;
      color: #fff;
      font-size: 24px;
      opacity: 0.5;
      cursor: pointer;
      padding: 0 4px;
    }
    .pwa-install-btn {
      background: #fff;
      color: #000;
      border: none;
      padding: 8px 16px;
      border-radius: 20px;
      font-weight: 600;
      font-size: 13px;
      margin-top: 12px;
      width: 100%;
      cursor: pointer;
    }
    .pwa-ios-instructions {
      border-top: 1px solid rgba(255,255,255,0.1);
      padding-top: 12px;
      font-size: 13px;
      color: #aaa;
    }
    .share-icon {
      font-size: 16px;
      display: inline-block;
      transform: translateY(-2px);
    }
    @keyframes slideUp {
      from { transform: translateY(100px); opacity: 0; }
      to { transform: translateY(0); opacity: 1; }
    }
  `;
  document.head.appendChild(style);

  // Logic
  const closeBtn = prompt.querySelector('.pwa-close');
  closeBtn.addEventListener('click', () => {
    prompt.remove();
    sessionStorage.setItem('pwa-prompt-dismissed', 'true');
  });

  if (!isIOS) {
    const installBtn = prompt.querySelector('.pwa-install-btn');
    let deferredPrompt;

    window.addEventListener('beforeinstallprompt', (e) => {
      e.preventDefault();
      deferredPrompt = e;
      installBtn.style.display = 'block';
    });

    installBtn?.addEventListener('click', async () => {
      if (deferredPrompt) {
        deferredPrompt.prompt();
        const { outcome } = await deferredPrompt.userChoice;
        if (outcome === 'accepted') {
          deferredPrompt = null;
          prompt.remove();
        }
      }
    });
  }
}

// Initialize
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', createInstallPrompt);
} else {
  createInstallPrompt();
}
