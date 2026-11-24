/* Oryx Markets — app install helper.
   Registers the service worker and shows an "Install App" pill when the
   browser offers installation (Android/Chrome). On iPhone the pill explains
   the Share → Add to Home Screen steps instead. */
(function () {
  if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('sw.js').catch(() => {});
    });
  }

  let deferred = null;
  const isStandalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
  if (isStandalone) return;

  function showPill(mode) {
    if (document.getElementById('appInstallPill')) return;
    const b = document.createElement('button');
    b.id = 'appInstallPill';
    b.textContent = '📲 Install the Oryx App';
    b.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:86px;z-index:1200;background:linear-gradient(135deg,#D8A94E,#C79A3F);color:#0A1128;border:0;border-radius:999px;padding:12px 22px;font:700 14px system-ui,sans-serif;box-shadow:0 14px 34px rgba(0,0,0,.45);cursor:pointer';
    b.onclick = async () => {
      if (mode === 'prompt' && deferred) {
        deferred.prompt();
        await deferred.userChoice;
        deferred = null;
        b.remove();
      } else {
        alert('To install the Oryx app on iPhone: tap the Share button in Safari, then choose "Add to Home Screen".');
      }
    };
    document.body.appendChild(b);
    setTimeout(() => { if (b.parentNode && !deferred) b.remove(); }, 30000);
  }

  window.addEventListener('beforeinstallprompt', e => {
    e.preventDefault();
    deferred = e;
    showPill('prompt');
  });

  const isIOS = /iphone|ipad|ipod/i.test(navigator.userAgent);
  if (isIOS) window.addEventListener('load', () => setTimeout(() => showPill('ios'), 2500));

  window.addEventListener('appinstalled', () => {
    const b = document.getElementById('appInstallPill');
    if (b) b.remove();
  });
})();
