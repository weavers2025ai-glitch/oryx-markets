/* Oryx Markets — shared header / ticker / footer injected into every public page */
(function(){
  const S = Oryx.settings();
  const u = Oryx.currentUser();
  const root = document.body.dataset.root || '';
  const logoSvg = `<svg viewBox="0 0 48 48" class="logo-mark" aria-hidden="true"><path d="M14 6 C16 16, 17 24, 16 34 L11 34 C13 24, 12 15, 10 6 Z" fill="#D8A94E"/><path d="M34 6 C32 16, 31 24, 32 34 L37 34 C35 24, 36 15, 38 6 Z" fill="#D8A94E"/><circle cx="24" cy="30" r="7.5" fill="none" stroke="#F3E5C0" stroke-width="3"/></svg>`;
  const tickerItems = INSTRUMENTS.map(i => {
    const up = Math.random() > 0.45;
    return `<span class="tick"><b>${i.symbol}</b> ${i.base.toFixed(i.digits)} <em class="${up ? 'up' : 'dn'}">${up ? '▲' : '▼'}</em></span>`;
  }).join('');
  const header = `
  <div class="ticker"><div class="ticker-track">${tickerItems}${tickerItems}</div></div>
  <header class="site-head">
    <a class="brand" href="${root}index.html">${logoSvg}<span>${Oryx.esc(S.brand.split(' ')[0])} <b>${Oryx.esc(S.brand.split(' ').slice(1).join(' ') || '')}</b></span></a>
    <nav class="main-nav">
      <a href="${root}index.html">Home</a>
      <a href="${root}markets.html">Markets</a>
      <a href="${root}accounts.html">Account Types</a>
      <a href="${root}ib.html">IB Programme</a>
      <a href="${root}blog.html">Blog</a>
      <a href="${root}about.html">About Us</a>
      <a href="${root}contact.html">Contact</a>
    </nav>
    <div class="head-cta">
      ${u
        ? `<a class="btn btn-gold" href="${root}dashboard.html">My Dashboard</a><a class="btn btn-ghost" href="#" onclick="Oryx.logout();location.href='${root}index.html';return false;">Log Out</a>`
        : `<a class="btn btn-ghost" href="${root}login.html">Log In</a><a class="btn btn-gold" href="${root}register.html">Open Account</a>`}
    </div>
  </header>`;
  const footer = `
  <footer class="site-foot">
    <div class="foot-grid">
      <div>
        <a class="brand light" href="${root}index.html">${logoSvg}<span>${Oryx.esc(S.brand.split(' ')[0])} <b>${Oryx.esc(S.brand.split(' ').slice(1).join(' ') || '')}</b></span></a>
        <p class="foot-blurb">${Oryx.esc(S.tagline)}. Trade Forex, Metals, Energies, Crypto and Indices from one account — on web, with fast execution and transparent pricing.</p>
        <p class="foot-contact">✉ info@oryx.com<br>✉ sales@oryx.com<br>☎ WhatsApp: +971 58 214 5708</p>
        <div class="foot-social"><a href="#" aria-label="X">𝕏</a><a href="#" aria-label="LinkedIn">in</a><a href="#" aria-label="Instagram">◎</a><a href="#" aria-label="Facebook">f</a></div>
      </div>
      <div>
        <h4>Company</h4>
        <a href="${root}about.html">About Us</a><a href="${root}accounts.html">Account Types</a><a href="${root}contact.html">Contact</a><a href="${root}register.html">Open Account</a>
      </div>
      <div>
        <h4>Markets</h4>
        <a href="${root}markets.html">Forex</a><a href="${root}markets.html">Gold &amp; Metals</a><a href="${root}markets.html">Crypto</a><a href="${root}markets.html">Indices &amp; Shares</a>
      </div>
      <div>
        <h4>Trading</h4>
        <a href="${root}trade.html">Web Terminal</a><a href="${root}dashboard.html">Client Dashboard</a><a href="${root}login.html">Log In</a><a href="${root}accounts.html">Leverage &amp; Spreads</a>
      </div>
      <div>
        <h4>Support</h4>
        <a href="${root}contact.html">Contact Us</a><a href="${root}guide.html">FAQs</a><a href="${root}contact.html">Customer Service</a><a href="${root}dashboard.html">My Account</a>
      </div>
      <div>
        <h4>Policies</h4>
        <a href="${root}guide.html">Privacy Policy</a><a href="${root}guide.html">Terms of Use</a><a href="${root}guide.html">Terms of Sale</a><a href="${root}about.html">Careers</a>
      </div>
    </div>
    <div class="foot-base"><span>© 2026 ${Oryx.esc(S.brand)}. All rights reserved.</span><span class="foot-badges"><span class="fb-sel">🇺🇸 USD ▾</span><span class="fb-sel">🇬🇧 English ▾</span><span class="fb-pay">VISA</span><span class="fb-pay">Mastercard</span><span class="fb-pay">PayPal</span><span class="fb-pay">Skrill</span></span></div>
  </footer>
  <a class="wa-float" href="https://wa.me/${Oryx.esc(S.whatsapp)}" target="_blank" rel="noopener" aria-label="Chat on WhatsApp">💬</a>
  <nav class="mobile-nav">
    <a href="${root}index.html"><span>🏠</span>Home</a>
    <a href="${root}markets.html"><span>🌍</span>Markets</a>
    <a href="${root}trade.html"><span>📈</span>Trade</a>
    <a href="${u ? root + 'dashboard.html' : root + 'login.html'}"><span>👤</span>${u ? 'Dashboard' : 'Log In'}</a>
  </nav>`;
  const h = document.getElementById('site-header'); if (h) h.innerHTML = header;
  const f = document.getElementById('site-footer'); if (f) f.innerHTML = footer;
})();
