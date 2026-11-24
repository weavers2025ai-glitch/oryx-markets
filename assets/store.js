/* Oryx Markets — demo engine (front-end only; data lives in this browser's localStorage)
   Rules built in: a new client receives ONLY the $10 starter credit set in Settings.
   Any further balance is issued by the Admin only (Admin → Clients → Issue Balance). */
const Oryx = (() => {
  const K = { users:'oryx_users', session:'oryx_session', accounts:'oryx_accounts', trades:'oryx_trades', txns:'oryx_txns', settings:'oryx_settings', adminpw:'oryx_admin_pw' };
  const load = (k, d) => { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch(e){ return d; } };
  const save = (k, v) => localStorage.setItem(k, JSON.stringify(v));
  const uid = p => p + Math.random().toString(36).slice(2, 9) + Date.now().toString(36).slice(-4);

  const DEFAULT_SETTINGS = {
    brand:'Oryx Markets', tagline:'Trade Global Markets with Confidence',
    starter:10, leverage:1000,
    whatsapp:'923349001195', email:'weavers2025ai@gmail.com',
    heroTitle:'Trade the World Markets', heroSub:'Forex, Gold, Oil, Crypto and Global Indices — one account, one powerful platform, spreads from 0.1 pips.'
  };
  const settings = () => Object.assign({}, DEFAULT_SETTINGS, load(K.settings, {}));
  const saveSettings = s => save(K.settings, Object.assign(settings(), s));

  const users    = () => load(K.users, []);
  const accounts = () => load(K.accounts, []);
  const trades   = () => load(K.trades, []);
  const txns     = () => load(K.txns, []);
  const saveUsers = v => save(K.users, v), saveAccounts = v => save(K.accounts, v), saveTrades = v => save(K.trades, v), saveTxns = v => save(K.txns, v);

  /* ---------- price feed (simulated live feed around the seed prices) ---------- */
  const prices = {}; // symbol -> mid price
  const HIST = {};   // symbol -> rolling price history (for sparklines / day range)
  INSTRUMENTS.forEach(i => {
    prices[i.symbol] = i.base;
    HIST[i.symbol] = [];
    let p = i.base * (1 - (Math.random() * 0.004 - 0.002));
    for (let n = 0; n < 28; n++){ p = p * (1 + (Math.random() - 0.48) * 0.0012); HIST[i.symbol].push(p); }
    HIST[i.symbol].push(i.base);
  });
  const inst = s => INSTRUMENTS.find(i => i.symbol === s);
  function tick(){
    INSTRUMENTS.forEach(i => {
      const vol = i.type === 'Crypto' ? 0.00045 : i.type === 'Forex' ? 0.00006 : 0.00022;
      prices[i.symbol] = Math.max(prices[i.symbol] * (1 + (Math.random() - 0.5) * 2 * vol), 0.00001);
      HIST[i.symbol].push(prices[i.symbol]);
      if (HIST[i.symbol].length > 48) HIST[i.symbol].shift();
    });
    tickCandles();
  }
  /* ---------- live candlesticks (built from the same feed, 5-second candles) ---------- */
  const CANDLES = {}; const BUCKET = 5000;
  INSTRUMENTS.forEach(i => {
    CANDLES[i.symbol] = [];
    let p = i.base * (1 - (Math.random() * 0.006 - 0.003));
    for (let n = 0; n < 64; n++){
      const o = p; const drift = (Math.random() - 0.485) * i.base * 0.0011;
      const c = o + drift; const h = Math.max(o, c) + Math.random() * i.base * 0.00035; const l = Math.min(o, c) - Math.random() * i.base * 0.00035;
      CANDLES[i.symbol].push({ o, h, l, c }); p = c;
    }
    const last = CANDLES[i.symbol][CANDLES[i.symbol].length - 1];
    last.c = i.base; last.h = Math.max(last.h, i.base); last.l = Math.min(last.l, i.base);
  });
  let bucketStart = Date.now();
  function tickCandles(){
    const now = Date.now();
    INSTRUMENTS.forEach(i => {
      const arr = CANDLES[i.symbol]; const cur = arr[arr.length - 1]; const px = prices[i.symbol];
      cur.c = px; if (px > cur.h) cur.h = px; if (px < cur.l) cur.l = px;
      if (now - bucketStart >= BUCKET){ arr.push({ o: px, h: px, l: px, c: px }); if (arr.length > 90) arr.shift(); }
    });
    if (now - bucketStart >= BUCKET) bucketStart = now;
  }
  const candles = s => CANDLES[s] || [];
  function sparkData(arr, w, h, color){
    if (!arr || arr.length < 2) arr = [0, 0];
    const min = Math.min(...arr), max = Math.max(...arr), rng = (max - min) || 1;
    const pts = arr.map((v, ix) => (ix / (arr.length - 1) * w).toFixed(1) + ',' + (h - 2 - (v - min) / rng * (h - 4)).toFixed(1)).join(' ');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${color || '#fff'}" stroke-width="1.8" stroke-linejoin="round" opacity="0.9"/></svg>`;
  }
  const hist = s => HIST[s] || [];
  const dayHigh = s => Math.max(...HIST[s]);
  const dayLow = s => Math.min(...HIST[s]);
  const changePct = s => (prices[s] - inst(s).base) / inst(s).base * 100;
  const sentiment = () => { const up = INSTRUMENTS.filter(i => prices[i.symbol] >= i.base).length; return Math.round(up / INSTRUMENTS.length * 100); };
  function spark(s, w, h, color){
    const d = HIST[s]; if (!d || d.length < 2) return '';
    const min = Math.min(...d), max = Math.max(...d), rng = (max - min) || 1;
    const pts = d.map((v, ix) => (ix / (d.length - 1) * w).toFixed(1) + ',' + (h - 3 - (v - min) / rng * (h - 6)).toFixed(1)).join(' ');
    const c = color || (changePct(s) >= 0 ? '#16C784' : '#EA3943');
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="none"><polyline points="${pts}" fill="none" stroke="${c}" stroke-width="1.8" stroke-linejoin="round"/></svg>`;
  }
  const bid = s => prices[s] - inst(s).spread / 2;
  const ask = s => prices[s] + inst(s).spread / 2;
  const fmtP = (s, v) => v.toFixed(inst(s).digits);
  let feedTimer = null;
  function startFeed(cb, ms){ tick(); if (cb) cb(); feedTimer = setInterval(() => { tick(); if (cb) cb(); }, ms || 1000); return feedTimer; }

  /* ---------- auth & clients ---------- */
  function register(name, email, pass, phone, country){
    const us = users();
    if (us.some(u => u.email.toLowerCase() === email.toLowerCase())) return { error:'An account with this email already exists. Please log in.' };
    const user = { id:uid('u'), name, email, pass, phone:phone||'', country:country||'', created:Date.now() };
    us.push(user); saveUsers(us);
    const st = settings();
    const accs = accounts();
    const loginNo = 880001 + accs.length;
    const acc = { id:uid('a'), login:loginNo, userId:user.id, type:'Standard', currency:'USD', balance:0, leverage:st.leverage, created:Date.now() };
    accs.push(acc); saveAccounts(accs);
    // Starter credit — the ONLY automatic balance. Everything else is issued by Admin.
    addTxn(acc.id, 'Starter Credit', st.starter, 'Welcome credit issued on registration');
    acc.balance = st.starter; saveAccounts(accs);
    save(K.session, user.id);
    return { user, account:acc };
  }
  function addTxn(accountId, type, amount, note){
    const t = txns(); t.push({ id:uid('t'), accountId, type, amount, note:note||'', at:Date.now() }); saveTxns(t);
  }
  function login(email, pass){
    const u = users().find(u => u.email.toLowerCase() === email.toLowerCase() && u.pass === pass);
    if (!u) return { error:'Invalid email or password.' };
    save(K.session, u.id); return { user:u };
  }
  function logout(){ localStorage.removeItem(K.session); }
  function currentUser(){ const id = load(K.session, null); return users().find(u => u.id === id) || null; }
  function myAccounts(){ const u = currentUser(); return u ? accounts().filter(a => a.userId === u.id) : []; }
  function accountById(id){ return accounts().find(a => a.id === id) || null; }

  /* ---------- trading ---------- */
  function pnlOf(tr, atBidAsk){
    const i = inst(tr.symbol);
    const px = atBidAsk === 'open' ? null : (tr.side === 'BUY' ? bid(tr.symbol) : ask(tr.symbol));
    const closePx = tr.status === 'closed' ? tr.close : px;
    const dir = tr.side === 'BUY' ? 1 : -1;
    return (closePx - tr.open) * dir * tr.lots * i.contract;
  }
  function floating(accountId){ return trades().filter(t => t.accountId === accountId && t.status === 'open').reduce((s, t) => s + pnlOf(t), 0); }
  function usedMargin(accountId){
    return trades().filter(t => t.accountId === accountId && t.status === 'open')
      .reduce((s, t) => s + (t.lots * inst(t.symbol).contract * t.open) / (accountById(accountId)?.leverage || 500), 0);
  }
  function openTrade(accountId, symbol, side, lots){
    const acc = accountById(accountId); if (!acc) return { error:'Account not found.' };
    lots = parseFloat(lots);
    if (!lots || lots < 0.01) return { error:'Minimum lot size is 0.01.' };
    const i = inst(symbol);
    const need = (lots * i.contract * prices[symbol]) / acc.leverage;
    const free = acc.balance + floating(accountId) - usedMargin(accountId);
    if (need > free) return { error:'Not enough free margin. Required: $' + need.toFixed(2) + ' — ask Admin to issue more balance.' };
    const tr = { id:uid('tr'), accountId, symbol, side, lots, open: side === 'BUY' ? ask(symbol) : bid(symbol), close:null, openAt:Date.now(), closeAt:null, status:'open', pnl:0 };
    const all = trades(); all.push(tr); saveTrades(all);
    return { trade:tr };
  }
  function closeTrade(tradeId){
    const all = trades(); const tr = all.find(t => t.id === tradeId);
    if (!tr || tr.status !== 'open') return { error:'Trade not open.' };
    tr.close = tr.side === 'BUY' ? bid(tr.symbol) : ask(tr.symbol);
    tr.pnl = pnlOf(tr, 'now'); tr.status = 'closed'; tr.closeAt = Date.now();
    saveTrades(all);
    const accs = accounts(); const acc = accs.find(a => a.id === tr.accountId);
    if (acc){ acc.balance = +(acc.balance + tr.pnl).toFixed(2); saveAccounts(accs); }
    return { trade:tr };
  }

  /* ---------- admin ---------- */
  const adminPw = () => load(K.adminpw, 'admin1234');
  function issueBalance(accountId, amount, note){
    amount = parseFloat(amount); if (!amount) return { error:'Enter an amount.' };
    const accs = accounts(); const acc = accs.find(a => a.id === accountId);
    if (!acc) return { error:'Account not found.' };
    acc.balance = +(acc.balance + amount).toFixed(2); saveAccounts(accs);
    addTxn(accountId, amount >= 0 ? 'Admin Deposit' : 'Admin Withdrawal', amount, note || 'Issued by Admin');
    return { account:acc };
  }

  /* ---------- balance requests (client -> admin, with payment proof) ---------- */
  const K_REQ = 'oryx_requests';
  const requests = () => load(K_REQ, []);
  function createRequest(accountId, data){
    const all = requests();
    const r = { id:'rq' + Date.now().toString(36), accountId, amount: parseFloat(data.amount) || 0,
                method: data.method || 'Cash', proof: data.proof || '', note: data.note || '',
                status:'pending', at: Date.now(), decidedAt: 0 };
    all.push(r); save(K_REQ, all); return r;
  }
  function decideRequest(id, approve){
    const all = requests(); const r = all.find(x => x.id === id);
    if (!r || r.status !== 'pending') return false;
    r.status = approve ? 'approved' : 'rejected'; r.decidedAt = Date.now();
    save(K_REQ, all);
    if (approve) issueBalance(r.accountId, r.amount, r.method + ' deposit — request approved');
    return true;
  }

  /* ---------- admins, super admin & activity log ----------
     Above the Admin panel sits a Super Admin. Admins are named accounts
     (created by the Super Admin); every important thing an admin does is
     written to the activity log, which the Super Admin reviews. */
  const K_ADMINS = 'oryx_admins', K_ALOG = 'oryx_admin_log', K_ASESS = 'oryx_admin_session', K_SUPER = 'oryx_super_pw';
  function admins(){
    let list = load(K_ADMINS, null);
    if (!list){
      list = [{ id:'adm1', name:'Main Admin', email:'admin@oryx.local', pass:'admin1234', active:true, created:Date.now() }];
      save(K_ADMINS, list);
    }
    return list;
  }
  const saveAdmins = v => save(K_ADMINS, v);
  function currentAdmin(){ const e = load(K_ASESS, null); return admins().find(x => x.email === e) || null; }
  function logAdmin(action, detail, meta){
    const a = currentAdmin();
    const log = load(K_ALOG, []);
    const entry = { id:uid('log'), at:Date.now(), admin: a ? a.name : 'Super Admin', email: a ? a.email : '', action, detail: detail || '' };
    if (meta && meta.clientId) entry.clientId = meta.clientId;   // which client this action touched (builds the admin's tree)
    if (meta && meta.amount != null) entry.amount = meta.amount;
    log.push(entry);
    while (log.length > 500) log.shift();
    save(K_ALOG, log);
  }
  function adminLogin(email, pass){
    const a = admins().find(x => x.email.toLowerCase() === String(email || '').toLowerCase() && x.pass === pass);
    if (!a) return { error:'Invalid admin email or password.' };
    if (!a.active) return { error:'This admin account has been disabled by the Super Admin.' };
    save(K_ASESS, a.email);
    logAdmin('Admin login', a.name + ' signed in to the Admin panel');
    return { admin:a };
  }
  function adminLogout(){ localStorage.removeItem(K_ASESS); }
  const adminLog = () => load(K_ALOG, []);
  const superPw = () => load(K_SUPER, 'admin1234');
  const setSuperPw = v => save(K_SUPER, v);

  /* one-time migration: bring every existing account to the current default leverage */
  try {
    if (!load('oryx_lev2', false)) {
      const accs = accounts(); accs.forEach(a => a.leverage = settings().leverage); saveAccounts(accs);
      save('oryx_lev2', true);
    }
  } catch(e){}

  const money = v => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  return { K, settings, saveSettings, users, accounts, trades, txns, addTxn,
           prices, hist, candles, sparkData, dayHigh, dayLow, changePct, sentiment, spark,
           inst, bid, ask, fmtP, startFeed,
           register, login, logout, currentUser, myAccounts, accountById,
           pnlOf, floating, usedMargin, openTrade, closeTrade,
           adminPw, issueBalance, requests, createRequest, decideRequest, money, esc,
           admins, saveAdmins, adminLogin, currentAdmin, adminLogout, logAdmin, adminLog, superPw, setSuperPw,
           setAdminPw: v => save(K.adminpw, v) };
})();
