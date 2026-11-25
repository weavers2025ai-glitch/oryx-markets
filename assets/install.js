/* Oryx Markets — app install helper.
   Registers the service worker and shows an "Install App" pill when the
   browser offers installation (Android/Chrome). On iPhone the pill explains
   the Share → Add to Home Screen steps instead. */
(function () {
  /* Mobile / app entry: on a phone (or when running as the installed app),
     the home page goes straight to the client Dashboard — the app is just
     the Dashboard and the Trade terminal. Desktop keeps the full website. */
  const p = location.pathname;
  if (p.endsWith('/') || p.endsWith('index.html')) {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone;
    const mobile = window.matchMedia('(max-width: 820px)').matches || /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (standalone || mobile) { location.replace('dashboard.html'); return; }
  }

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
    try { if (sessionStorage.getItem('oryx_install_dismissed') === '1') return; } catch (e) {}
    const wrap = document.createElement('div');
    wrap.id = 'appInstallPill';
    wrap.style.cssText = 'position:fixed;left:50%;transform:translateX(-50%);bottom:86px;z-index:1200;display:flex;align-items:center;gap:4px;background:linear-gradient(135deg,#D8A94E,#C79A3F);border-radius:999px;padding:6px 6px 6px 20px;box-shadow:0 14px 34px rgba(0,0,0,.45)';
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = '📲 Install the Oryx App';
    b.style.cssText = 'background:transparent;border:0;color:#0A1128;font:700 14px system-ui,sans-serif;cursor:pointer;padding:6px 4px;text-align:left';
    b.onclick = async () => {
      if (mode === 'prompt' && deferred) {
        deferred.prompt();
        await deferred.userChoice;
        deferred = null;
        wrap.remove();
      } else {
        alert('To install the Oryx app on iPhone: tap the Share button in Safari, then choose "Add to Home Screen".');
      }
    };
    const x = document.createElement('button');
    x.type = 'button';
    x.textContent = '✕';
    x.setAttribute('aria-label', 'Dismiss');
    x.style.cssText = 'flex:none;width:26px;height:26px;border-radius:50%;border:0;background:rgba(10,17,40,.18);color:#0A1128;font:800 13px system-ui,sans-serif;cursor:pointer;line-height:1';
    x.onclick = (e) => {
      e.stopPropagation();
      try { sessionStorage.setItem('oryx_install_dismissed', '1'); } catch (err) {}
      wrap.remove();
    };
    wrap.appendChild(b);
    wrap.appendChild(x);
    document.body.appendChild(wrap);
    setTimeout(() => { if (wrap.parentNode && !deferred) wrap.remove(); }, 30000);
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
