/* Oryx Support — instant automatic support assistant (built-in answers).
   Answers common questions immediately; anything else is routed to WhatsApp/email. */
(function(){
  if (document.getElementById('supBtn')) return;
  const S = (window.Oryx && Oryx.settings) ? Oryx.settings() : { whatsapp:'971582145708', email:'info@oryx.com', brand:'Oryx Markets' };
  const css = `
  #supBtn{position:fixed;right:18px;bottom:18px;z-index:400;width:58px;height:58px;border-radius:50%;border:0;cursor:pointer;
    background:linear-gradient(135deg,#22C55E,#0E9F6E);color:#fff;font-size:26px;box-shadow:0 12px 30px rgba(14,159,110,.45);
    display:flex;align-items:center;justify-content:center;animation:supPulse 2.6s infinite}
  @keyframes supPulse{0%,100%{transform:scale(1)}50%{transform:scale(1.07)}}
  #supBtn .sup-dot{position:absolute;top:2px;right:2px;width:13px;height:13px;border-radius:50%;background:#EA3943;border:2px solid #0A1128}
  #supPanel{position:fixed;right:18px;bottom:86px;z-index:400;width:min(360px,calc(100vw - 24px));height:min(520px,calc(100vh - 110px));
    background:#0D1633;border:1px solid rgba(255,255,255,.14);border-radius:18px;display:none;flex-direction:column;overflow:hidden;
    box-shadow:0 24px 60px rgba(0,0,0,.55);font-family:'Segoe UI',system-ui,Arial,sans-serif}
  #supPanel.open{display:flex}
  .sup-head{background:linear-gradient(135deg,#065F46,#10B981);color:#fff;padding:14px 16px;display:flex;gap:11px;align-items:center}
  .sup-head .av{width:38px;height:38px;border-radius:50%;background:rgba(255,255,255,.22);display:flex;align-items:center;justify-content:center;font-size:19px}
  .sup-head b{font-size:15.5px;display:block}
  .sup-head span{font-size:12px;opacity:.88}
  .sup-msgs{flex:1;overflow-y:auto;padding:14px;display:flex;flex-direction:column;gap:9px}
  .sup-m{max-width:85%;padding:10px 13px;border-radius:14px;font-size:13.5px;line-height:1.5;white-space:pre-line}
  .sup-m.bot{background:#16265A;color:#E7EBF5;border-bottom-left-radius:4px;align-self:flex-start}
  .sup-m.me{background:#22C55E;color:#fff;border-bottom-right-radius:4px;align-self:flex-end}
  .sup-m a{color:#7DD3FC;font-weight:700}
  .sup-chips{display:flex;gap:7px;flex-wrap:wrap;padding:0 14px 10px}
  .sup-chip{background:rgba(255,255,255,.07);border:1px solid rgba(255,255,255,.16);color:#C9D3EA;border-radius:999px;
    padding:6px 12px;font-size:12.5px;cursor:pointer}
  .sup-chip:hover{background:rgba(34,197,94,.18);color:#fff}
  .sup-in{display:flex;gap:8px;padding:12px;border-top:1px solid rgba(255,255,255,.1)}
  .sup-in input{flex:1;background:#0A1128;border:1px solid rgba(255,255,255,.16);color:#fff;border-radius:10px;padding:11px 12px;font-size:13.5px}
  .sup-in button{background:#22C55E;color:#fff;border:0;border-radius:10px;padding:0 17px;font-weight:800;cursor:pointer}
  .sup-typing{color:#7C88A8;font-size:12.5px;padding:0 14px 8px;display:none}`;
  const st = document.createElement('style'); st.textContent = css; document.head.appendChild(st);

  const btn = document.createElement('button'); btn.id = 'supBtn'; btn.title = 'Chat with Support';
  btn.innerHTML = '💬<span class="sup-dot"></span>';
  const panel = document.createElement('div'); panel.id = 'supPanel';
  panel.innerHTML = `
    <div class="sup-head"><span class="av">🛟</span><div><b>${S.brand} Support</b><span>● Online — replies instantly</span></div>
      <button id="supClose" style="margin-left:auto;background:rgba(255,255,255,.18);border:0;color:#fff;width:30px;height:30px;border-radius:50%;cursor:pointer;font-size:15px">✕</button></div>
    <div class="sup-msgs" id="supMsgs"></div>
    <div class="sup-typing" id="supTyping">Support is typing…</div>
    <div class="sup-chips" id="supChips"></div>
    <div class="sup-in"><input id="supText" placeholder="Type your question…"><button id="supSend">Send</button></div>`;
  document.body.appendChild(btn); document.body.appendChild(panel);

  const msgs = panel.querySelector('#supMsgs'), chips = panel.querySelector('#supChips'),
        input = panel.querySelector('#supText'), typing = panel.querySelector('#supTyping');
  let greeted = false;

  const KB = [
    { k:['balance','deposit','top up','topup','add money','fund'], a:`Every new account starts with a $10 welcome credit.\n\nTo add more balance:\n1) Open your Dashboard\n2) Click "💸 Request Balance"\n3) Enter the amount, choose how you paid (Cash, Bank, Card, Binance…) and attach your payment proof\n4) As soon as Admin approves, the amount lands in your account automatically.` },
    { k:['withdraw','cash out','payout'], a:`Withdrawals are processed by the Admin team. Send your request from the Dashboard's Request Balance section with a note saying "Withdrawal", or message us on WhatsApp and we will process it for you.` },
    { k:['request','pending','approve','approval','status'], a:`After you send a balance request it shows as "pending" in your Dashboard under My Requests. Admin reviews your payment proof and approves it — the balance is then credited instantly and the status turns "approved".` },
    { k:['leverage','margin'], a:`${S.brand} offers leverage up to 1:1000. Example: a 0.01-lot gold trade needs only about $3.64 of margin at 1:1000. Your free margin and used margin are always visible at the top of the Web Terminal.` },
    { k:['account type','standard','pro','vip','account'], a:`We offer three account types — Standard, Pro and VIP — with different spreads and perks. You can compare them on the Account Types page, and every account starts with the same $10 welcome credit.` },
    { k:['trade','buy','sell','how to','terminal','chart'], a:`Trading is easy:\n1) Log in and open the Web Terminal\n2) Pick an instrument on the left (gold XAUUSD is the most popular)\n3) Enter your lot size and press BUY or SELL\nYour open position appears on the left with live profit/loss and a small Close button — green in profit, red in loss.` },
    { k:['register','sign up','signup','join','create account'], a:`Click "Open Live Account" on the home page, fill in your name, email and password — your trading account is created instantly with a $10 welcome credit. No documents needed for the demo.` },
    { k:['gold','xau','price','spread'], a:`Gold (XAUUSD) trades with a spread of about 0.28 and a contract size of 100 oz per lot. Prices on this platform move live, 24/5 — watch the Web Terminal chart with its MA lines and volume bars.` },
    { k:['safe','real','demo','scam','trust'], a:`This is a front-end demonstration platform with virtual demo funds, so you can practise and explore everything risk-free. Real live trading begins once the brokerage licensing and MT5 setup are connected by the company.` },
    { k:['contact','human','agent','whatsapp','call','phone','email'], a:`You can reach a human here:\nWhatsApp: +${S.whatsapp}\nEmail: ${S.email}\nOr keep asking me — I answer most questions instantly.` },
    { k:['hello','hi','hey','salam','aoa'], a:`Hello! 👋 Welcome to ${S.brand}. Ask me anything — deposits, balance requests, leverage, account types or how to trade.` },
    { k:['thank','shukria','great','nice'], a:`You're welcome! 😊 Anything else I can help with — deposits, trading or your account?` }
  ];
  function answer(q){
    const t = ' ' + q.toLowerCase() + ' ';
    let best = null, score = 0;
    KB.forEach(item => { let s = 0; item.k.forEach(k => { if (t.includes(k)) s += k.length; }); if (s > score){ score = s; best = item; } });
    if (best) return best.a;
    return `I want to make sure you get the exact answer. I can help instantly with:\n• Deposits & balance requests\n• Withdrawals\n• Leverage & margin\n• Account types\n• How to trade\nFor anything else, message us on WhatsApp +${S.whatsapp} or email ${S.email} and the team will reply.`;
  }
  function addMsg(text, who){
    const d = document.createElement('div'); d.className = 'sup-m ' + who; d.textContent = text;
    msgs.appendChild(d); msgs.scrollTop = msgs.scrollHeight; return d;
  }
  function botReply(q){
    typing.style.display = 'block'; msgs.scrollTop = msgs.scrollHeight;
    setTimeout(() => { typing.style.display = 'none'; addMsg(answer(q), 'bot'); }, 650 + Math.random() * 500);
  }
  function send(){
    const v = input.value.trim(); if (!v) return;
    addMsg(v, 'me'); input.value = ''; botReply(v);
  }
  const CHIPS = ['💸 How do I add balance?', '📈 How do I trade?', '⚖️ Leverage & margin', '👤 Account types', '📞 Talk to a human'];
  chips.innerHTML = CHIPS.map(c => `<button class="sup-chip">${c}</button>`).join('');
  chips.querySelectorAll('.sup-chip').forEach(c => c.addEventListener('click', () => { addMsg(c.textContent, 'me'); botReply(c.textContent); }));

  function toggle(open){
    panel.classList.toggle('open', open);
    if (open && !greeted){
      greeted = true;
      setTimeout(() => addMsg(`Hello! 👋 I'm the ${S.brand} support assistant. Ask me anything about deposits, balance requests, leverage or trading — or tap a topic below.`, 'bot'), 250);
    }
    if (open) input.focus();
  }
  btn.addEventListener('click', () => toggle(!panel.classList.contains('open')));
  panel.querySelector('#supClose').addEventListener('click', () => toggle(false));
  panel.querySelector('#supSend').addEventListener('click', send);
  input.addEventListener('keydown', e => { if (e.key === 'Enter') send(); });
})();
