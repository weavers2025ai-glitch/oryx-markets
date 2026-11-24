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
    starter:10, leverage:500,
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
  INSTRUMENTS.forEach(i => prices[i.symbol] = i.base);
  const inst = s => INSTRUMENTS.find(i => i.symbol === s);
  function tick(){
    INSTRUMENTS.forEach(i => {
      const vol = i.type === 'Crypto' ? 0.00045 : i.type === 'Forex' ? 0.00006 : 0.00022;
      prices[i.symbol] = Math.max(prices[i.symbol] * (1 + (Math.random() - 0.5) * 2 * vol), 0.00001);
    });
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

  const money = v => (v < 0 ? '-$' : '$') + Math.abs(v).toLocaleString('en-US', { minimumFractionDigits:2, maximumFractionDigits:2 });
  const esc = s => String(s ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));

  return { K, settings, saveSettings, users, accounts, trades, txns, addTxn,
           prices, inst, bid, ask, fmtP, startFeed,
           register, login, logout, currentUser, myAccounts, accountById,
           pnlOf, floating, usedMargin, openTrade, closeTrade,
           adminPw, issueBalance, money, esc,
           setAdminPw: v => save(K.adminpw, v) };
})();
