/* Oryx Markets — demo engine (front-end only; data lives in this browser's localStorage)
   Rules built in: a new client receives ONLY the $10 starter credit set in Settings.
   Any further balance is issued by the Admin only (Admin → Clients → Issue Balance). */
const Oryx = (() => {
  const K = { users:'oryx_users', session:'oryx_session', accounts:'oryx_accounts', trades:'oryx_trades', txns:'oryx_txns', settings:'oryx_settings', adminpw:'oryx_admin_pw', orders:'oryx_orders' };
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
  const orders   = () => load(K.orders, []);
  function saveOrders(o){ save(K.orders, o); }
  const txns     = () => load(K.txns, []);
  const saveUsers = v => save(K.users, v), saveAccounts = v => save(K.accounts, v), saveTrades = v => save(K.trades, v), saveTxns = v => save(K.txns, v);

  /* ---------- price feed (simulated live feed around the seed prices) ---------- */
  const prices = {}; // symbol -> mid price
  const HIST = {};   // symbol -> rolling price history (for sparklines / day range)
  /* The market is a pure function of TIME (layered waves + hashed noise), so
     every device and every refresh shows the SAME prices and the SAME chart.
     Nothing is re-invented when a page reloads or on another phone. */
  function hashN(str){ let h = 2166136261; for (let i = 0; i < str.length; i++){ h ^= str.charCodeAt(i); h = Math.imul(h, 16777619); } return (h >>> 0) / 4294967295; }
  function priceAt(sym, t){
    const ins = INSTRUMENTS.find(x => x.symbol === sym); const base = ins.base;
    const scale = ins.type === 'Crypto' ? 0.006 : ins.type === 'Forex' ? 0.0011 : 0.0042;
    const ph = hashN(sym) * 100;
    let v = Math.sin(t / 260000 + ph) * 0.46 + Math.sin(t / 71000 + ph * 1.7) * 0.30 + Math.sin(t / 19000 + ph * 0.6) * 0.14;
    const K30 = 30000, k = Math.floor(t / K30), f = (t - k * K30) / K30, u = f * f * (3 - 2 * f);
    const n0 = hashN(sym + '@' + k) - 0.5, n1 = hashN(sym + '@' + (k + 1)) - 0.5;
    v += (n0 + (n1 - n0) * u) * 0.55;
    const K5 = 5000, k5 = Math.floor(t / K5), f5 = (t - k5 * K5) / K5, u5 = f5 * f5 * (3 - 2 * f5);
    const m0 = hashN(sym + '#' + k5) - 0.5, m1 = hashN(sym + '#' + (k5 + 1)) - 0.5;
    v += (m0 + (m1 - m0) * u5) * 0.30;
    return Math.max(base * (1 + v * scale), base * 0.5);
  }
  INSTRUMENTS.forEach(i => {
    const now = Date.now();
    prices[i.symbol] = priceAt(i.symbol, now);
    HIST[i.symbol] = [];
    for (let n = 47; n >= 0; n--) HIST[i.symbol].push(priceAt(i.symbol, now - n * 15000));
  });
  const inst = s => INSTRUMENTS.find(i => i.symbol === s);
  function tick(){
    const now = Date.now();
    INSTRUMENTS.forEach(i => {
      prices[i.symbol] = priceAt(i.symbol, now);
      HIST[i.symbol].push(prices[i.symbol]);
      if (HIST[i.symbol].length > 48) HIST[i.symbol].shift();
    });
    tickCandles();
    trackHL();
    checkStopOut();
    checkOrders();
  }
  /* ---------- live candlesticks (built from the same feed, 5-second candles) ---------- */
  const CANDLES = {}; const BUCKET = 5000;
  let bucketStart = Math.floor(Date.now() / BUCKET) * BUCKET;
  INSTRUMENTS.forEach(i => {
    CANDLES[i.symbol] = [];
    let prevC = null;
    for (let n = 89; n >= 1; n--){
      const t0 = bucketStart - n * BUCKET;
      const o = prevC === null ? priceAt(i.symbol, t0) : prevC;
      const c = priceAt(i.symbol, t0 + BUCKET) + (hashN(i.symbol + 'B' + t0) - 0.5) * i.base * 0.0011;
      let h = Math.max(o, c), l = Math.min(o, c);
      for (let q = 1; q <= 3; q++){ const px = priceAt(i.symbol, t0 + q * 1250); if (px > h) h = px; if (px < l) l = px; }
      h += hashN(i.symbol + 'H' + t0) * i.base * 0.00020;
      l -= hashN(i.symbol + 'L' + t0) * i.base * 0.00020;
      CANDLES[i.symbol].push({ o, h, l, c });
      prevC = c;
    }
    const o0 = prevC === null ? priceAt(i.symbol, bucketStart) : prevC, px = prices[i.symbol];
    CANDLES[i.symbol].push({ o: o0, h: Math.max(o0, px), l: Math.min(o0, px), c: px });
  });
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
  /* True day high/low per symbol: tracked on every tick, kept for the whole
     calendar day and persisted, so a reload does not reset them. */
  const HLKEY = 'oryx_dayhl';
  let DAYHL = {};
  try { const saved = JSON.parse(localStorage.getItem(HLKEY) || 'null'); if (saved && saved.date === new Date().toDateString()) DAYHL = saved.m || {}; } catch (e) {}
  INSTRUMENTS.forEach(i => { if (!DAYHL[i.symbol]) DAYHL[i.symbol] = { hi: i.base, lo: i.base }; });
  function trackHL(){
    let dirty = false;
    INSTRUMENTS.forEach(i => { const p = prices[i.symbol], d = DAYHL[i.symbol]; if (p > d.hi){ d.hi = p; dirty = true; } if (p < d.lo){ d.lo = p; dirty = true; } });
    if (dirty){ try { localStorage.setItem(HLKEY, JSON.stringify({ date: new Date().toDateString(), m: DAYHL })); } catch (e) {} }
  }
  const todayHigh = s => (DAYHL[s] ? DAYHL[s].hi : prices[s]);
  const todayLow = s => (DAYHL[s] ? DAYHL[s].lo : prices[s]);
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
  /* Approval workflow: a signup is PENDING until an Admin approves it.
     Only on approval is the trading account created and the $10 starter
     credit issued. Login stays blocked until then. Users registered before
     this workflow existed have no status field and count as approved. */
  function register(name, email, pass, phone, country){
    const us = users();
    if (us.some(u => u.email.toLowerCase() === email.toLowerCase())) return { error:'An account with this email already exists. Please log in.' };
    const user = { id:uid('u'), name, email, pass, phone:phone||'', country:country||'', created:Date.now(), status:'pending' };
    us.push(user); saveUsers(us);
    return { user, pending:true };
  }
  function approveUser(userId, adminEmail){
    const us = users();
    const u = us.find(x => x.id === userId);
    if (!u) return { error:'User not found.' };
    if (u.status === 'approved') return { error:'Already approved.' };
    const st = settings();
    const accs = accounts();
    let acc = accs.find(a => a.userId === u.id);
    if (!acc) {
      const loginNo = 880001 + accs.length;
      acc = { id:uid('a'), login:loginNo, userId:u.id, type:'Standard', currency:'USD', balance:0, leverage:st.leverage, created:Date.now() };
      accs.push(acc); saveAccounts(accs);
      // Starter credit — the ONLY automatic balance. Everything else is issued by Admin.
      addTxn(acc.id, 'Starter Credit', st.starter, 'Welcome credit issued on approval');
      acc.balance = st.starter; saveAccounts(accs);
    }
    u.status = 'approved'; u.approvedAt = Date.now(); u.approvedBy = adminEmail || '';
    saveUsers(us);
    return { user:u, account:acc };
  }
  function rejectUser(userId){
    const us = users();
    const u = us.find(x => x.id === userId);
    if (!u) return { error:'User not found.' };
    u.status = 'rejected'; u.rejectedAt = Date.now(); saveUsers(us);
    return { user:u };
  }
  function addTxn(accountId, type, amount, note){
    const t = txns(); t.push({ id:uid('t'), accountId, type, amount, note:note||'', at:Date.now() }); saveTxns(t);
  }
  function login(email, pass){
    const u = users().find(u => u.email.toLowerCase() === email.toLowerCase() && u.pass === pass);
    if (!u) return { error:'Invalid email or password.' };
    if (u.status === 'pending') return { error:'Your account is under verification — it will be verified within 24 hours. Please try again after approval.' };
    if (u.status === 'rejected') return { error:'Your registration was not approved. Please contact support.' };
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
  function openTrade(accountId, symbol, side, lots, opts){
    opts = opts || {};
    const acc = accountById(accountId); if (!acc) return { error:'Account not found.' };
    lots = parseFloat(lots);
    if (!lots || lots < 0.01) return { error:'Minimum lot size is 0.01.' };
    const i = inst(symbol);
    const need = (lots * i.contract * prices[symbol]) / acc.leverage;
    const free = acc.balance + floating(accountId) - usedMargin(accountId);
    if (need > free) return { error:'Not enough free margin. Required: $' + need.toFixed(2) + ' — ask Admin to issue more balance.' };
    const tr = { id:uid('tr'), accountId, symbol, side, lots, open: opts.price ? +opts.price : (side === 'BUY' ? ask(symbol) : bid(symbol)), close:null, openAt:Date.now(), closeAt:null, status:'open', pnl:0, sl: opts.sl ? +opts.sl : null, tp: opts.tp ? +opts.tp : null, closeReason:null };
    const all = trades(); all.push(tr); saveTrades(all);
    return { trade:tr };
  }
  /* ---------- client messages (ride inside the user record, so they sync
     to every device and up to the admin with the rest of his data) ---------- */
  function notifyUser(userId, text){
    const us = users(); const u = us.find(x => x.id === userId); if (!u) return;
    if (!Array.isArray(u.msgs)) u.msgs = [];
    u.msgs.push({ id: uid('m'), at: Date.now(), text, read: false });
    if (u.msgs.length > 20) u.msgs = u.msgs.slice(-20);
    saveUsers(us);
  }
  function markMsgsRead(userId){
    const us = users(); const u = us.find(x => x.id === userId); if (!u || !Array.isArray(u.msgs)) return;
    let ch = false; u.msgs.forEach(m => { if (!m.read){ m.read = true; ch = true; } });
    if (ch) saveUsers(us);
  }

  /* ---------- stop-out: if the losses eat the whole balance, his entries
     close automatically and he is told his balance is finished ---------- */
  function checkStopOut(){
    const sess = load(K.session, null); if (!sess) return false;
    let fired = false;
    accounts().filter(a => a.userId === sess).forEach(acc => {
      const open = trades().filter(t => t.accountId === acc.id && t.status === 'open');
      if (!open.length) return;
      if (acc.balance + floating(acc.id) > 0) return;
      open.forEach(t => closeTrade(t.id));
      const accs = accounts(); const a2 = accs.find(a => a.id === acc.id);
      if (a2 && a2.balance < 0){ const adj = -a2.balance; a2.balance = 0; saveAccounts(accs); addTxn(acc.id, 'Stop-Out Adjustment', adj, 'Loss beyond the balance was covered at stop-out'); }
      notifyUser(sess, '⚠️ Stop-Out: your open trades were closed automatically because the losses used up your account balance. Your balance is now $0.00. Please request a new deposit from the Admin to continue trading.');
      fired = true;
    });
    return fired;
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

  /* Close at an exact price (used by Stop Loss / Take Profit). */
  function closeTradeAt(tradeId, price, reason){
    const all = trades(); const tr = all.find(t => t.id === tradeId);
    if (!tr || tr.status !== 'open') return { error:'Trade not open.' };
    tr.close = +price; tr.status = 'closed'; tr.closeAt = Date.now(); tr.closeReason = reason || null;
    tr.pnl = pnlOf(tr);
    saveTrades(all);
    const accs = accounts(); const acc = accs.find(a => a.id === tr.accountId);
    if (acc){ acc.balance = +(acc.balance + tr.pnl).toFixed(2); saveAccounts(accs); }
    return { trade:tr };
  }

  /* ---------- pending orders + stop-loss / take-profit ----------
     A pending order waits for its price: when the market reaches the level,
     the trade opens BY ITSELF. SL/TP close an open trade BY THEMSELVES when
     the price reaches them. Checked on every feed tick for the signed-in
     client's accounts (same pattern as the stop-out). */
  function placeOrder(accountId, symbol, side, lots, price, sl, tp){
    const acc = accountById(accountId); if (!acc) return { error:'Account not found.' };
    lots = parseFloat(lots); price = parseFloat(price);
    if (!lots || lots < 0.01) return { error:'Minimum lot size is 0.01.' };
    if (!price || price <= 0) return { error:'Enter the price at which the order should trigger.' };
    const o = { id:uid('or'), accountId, symbol, side, lots, price, sl: sl ? +sl : null, tp: tp ? +tp : null,
                ref: side === 'BUY' ? ask(symbol) : bid(symbol), status:'pending', at:Date.now(), filledAt:null, tradeId:null };
    const all = orders(); all.push(o); saveOrders(all);
    return { order:o };
  }
  function cancelOrder(orderId){
    const all = orders(); const o = all.find(x => x.id === orderId);
    if (!o || o.status !== 'pending') return { error:'Order not pending.' };
    o.status = 'cancelled'; saveOrders(all); return { order:o };
  }
  function checkOrders(){
    const sess = load(K.session, null); if (!sess) return;
    const myAccs = accounts().filter(a => a.userId === sess).map(a => a.id);
    if (!myAccs.length) return;
    trades().filter(t => myAccs.includes(t.accountId) && t.status === 'open' && (t.sl || t.tp)).forEach(t => {
      const cur = t.side === 'BUY' ? bid(t.symbol) : ask(t.symbol);
      if (t.sl && ((t.side === 'BUY' && cur <= t.sl) || (t.side === 'SELL' && cur >= t.sl))){
        closeTradeAt(t.id, t.sl, 'Stop Loss');
        notifyUser(sess, 'Stop Loss hit: your ' + t.symbol + ' ' + t.side + ' ' + t.lots + ' lots trade was closed automatically at ' + fmtP(t.symbol, t.sl) + '.');
      } else if (t.tp && ((t.side === 'BUY' && cur >= t.tp) || (t.side === 'SELL' && cur <= t.tp))){
        closeTradeAt(t.id, t.tp, 'Take Profit');
        notifyUser(sess, 'Take Profit hit: your ' + t.symbol + ' ' + t.side + ' ' + t.lots + ' lots trade was closed automatically at ' + fmtP(t.symbol, t.tp) + '.');
      }
    });
    let dirty = false;
    const all = orders();
    all.filter(o => myAccs.includes(o.accountId) && o.status === 'pending').forEach(o => {
      const cur = o.side === 'BUY' ? ask(o.symbol) : bid(o.symbol);
      const hit = (o.ref <= o.price && cur >= o.price) || (o.ref >= o.price && cur <= o.price);
      if (!hit) return;
      const r = openTrade(o.accountId, o.symbol, o.side, o.lots, { price:o.price, sl:o.sl, tp:o.tp });
      if (r.error){ o.status = 'cancelled'; notifyUser(sess, 'Your pending ' + o.side + ' order for ' + o.symbol + ' at ' + fmtP(o.symbol, o.price) + ' was cancelled: ' + r.error); }
      else { o.status = 'filled'; o.filledAt = Date.now(); o.tradeId = r.trade.id; notifyUser(sess, 'Pending order filled: ' + o.symbol + ' ' + o.side + ' ' + o.lots + ' lots opened at ' + fmtP(o.symbol, o.price) + '.'); }
      dirty = true;
    });
    if (dirty) saveOrders(all);
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
    const r = { id:'rq' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), accountId, amount: parseFloat(data.amount) || 0,
                method: data.method || 'Cash', proof: data.proof || '', note: data.note || '',
                txnId: String(data.txnId || '').trim(), senderName: String(data.senderName || '').trim(),
                senderAcct: String(data.senderAcct || '').trim(),
                status:'pending', at: Date.now(), decidedAt: 0 };
    all.push(r); save(K_REQ, all); return r;
  }
  /* ---------- payment accounts (ours — shown to clients) + bank entries + matching ----------
     The site cannot pull bank transactions by itself — no bank API. The admin records
     each payment that arrives in his EasyPaisa / JazzCash / bank app as a Bank Entry;
     the panel then auto-matches it against the client's proof. One proof and one bank
     entry can each match only ONCE — a used reference can never be credited twice. */
  const K_PAYCFG = 'oryx_paycfg';
  const payCfg = () => load(K_PAYCFG, { easypaisa:{ number:'', title:'' }, jazzcash:{ number:'', title:'' }, bank:{ bank:'', title:'', account:'', iban:'' } });
  function savePayCfg(cfg){ save(K_PAYCFG, cfg); return cfg; }
  const K_BANK = 'oryx_bankentries';
  const bankEntries = () => load(K_BANK, []);
  function addBankEntry(data){
    const all = bankEntries();
    const e = { id:'bk' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6), method: data.method || 'Bank', amount: parseFloat(data.amount) || 0,
                txnId: String(data.txnId || '').trim(), sender: String(data.sender || '').trim(),
                at: Date.now(), usedBy: null, usedAt: 0 };
    all.push(e); save(K_BANK, all); return e;
  }
  const normTxn = t => String(t || '').toUpperCase().replace(/[^A-Z0-9]/g, '');
  function isDuplicateTxn(r){
    const t = normTxn(r.txnId); if (!t) return false;
    return requests().some(x => x.id !== r.id && x.status === 'approved' && normTxn(x.txnId) === t);
  }
  /* matchStatus(r) -> { state, entry }: matched | mismatch | duplicate | noref */
  function matchStatus(r){
    const t = normTxn(r.txnId);
    if (!t) return { state:'noref', entry:null };
    if (isDuplicateTxn(r)) return { state:'duplicate', entry:null };
    const e = bankEntries().find(x => normTxn(x.txnId) === t && Math.abs(x.amount - r.amount) < 0.01);
    if (!e) return { state:'mismatch', entry:null };
    if (e.usedBy && e.usedBy !== r.id) return { state:'duplicate', entry:e };
    return { state:'matched', entry:e };
  }
  function decideRequest(id, approve){
    const all = requests(); const r = all.find(x => x.id === id);
    if (!r || r.status !== 'pending') return false;
    if (approve && isDuplicateTxn(r)) return false; /* same proof already credited once — never twice */
    r.status = approve ? 'approved' : 'rejected'; r.decidedAt = Date.now();
    save(K_REQ, all);
    if (approve){
      const m = matchStatus(r);
      if (m.state === 'matched' && m.entry){ /* consume the bank entry — it can never match another proof */
        const es = bankEntries(); const e = es.find(x => x.id === m.entry.id);
        if (e){ e.usedBy = r.id; e.usedAt = Date.now(); save(K_BANK, es); }
      }
      issueBalance(r.accountId, r.amount, r.method + ' deposit — request approved');
    }
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
           prices, hist, candles, sparkData, dayHigh, dayLow, todayHigh, todayLow, changePct, sentiment, spark,
           inst, bid, ask, fmtP, startFeed,
           register, login, logout, currentUser, myAccounts, accountById, approveUser, rejectUser,
           pnlOf, floating, usedMargin, openTrade, closeTrade, closeTradeAt, orders, placeOrder, cancelOrder,
           notifyUser, markMsgsRead, checkStopOut,
           adminPw, issueBalance, requests, createRequest, decideRequest,
           payCfg, savePayCfg, bankEntries, addBankEntry, matchStatus, money, esc,
           admins, saveAdmins, adminLogin, currentAdmin, adminLogout, logAdmin, adminLog, superPw, setSuperPw,
           setAdminPw: v => save(K.adminpw, v) };
})();
