/* Oryx Markets — cloud sync (Firebase Firestore).
   Keeps every client's full record (profile + accounts + trades + transactions
   + balance requests) in ONE online database, so a client who registers on any
   device, anywhere, appears in the Admin panel on every device — and balance
   issued by Admin reaches the client's own device too.
   localStorage stays the working copy; the cloud copy wins when it is newer.
   Demo-grade security: records are protected only by the database rules, and
   passwords sit inside the client record — a production brokerage must move
   to real authentication (Firebase Auth) and per-user rules. */
(function () {
  const CONFIG = {
    apiKey: 'AIzaSyDagLPXiBy3D9qu9AfWQD1Zb2J2CHHMZdk',
    authDomain: 'oryx-markets.firebaseapp.com',
    projectId: 'oryx-markets',
    storageBucket: 'oryx-markets.firebasestorage.app',
    messagingSenderId: '497099014129',
    appId: '1:497099014129:web:dbda31ae3364d04e488e50'
  };
  if (!CONFIG.apiKey || typeof Oryx === 'undefined') return;

  const SDK = [
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-app-compat.js',
    'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore-compat.js'
  ];
  function loadSdk(i, done) {
    if (i >= SDK.length) return done();
    const s = document.createElement('script');
    s.src = SDK[i];
    s.onload = () => loadSdk(i + 1, done);
    s.onerror = () => {};
    document.head.appendChild(s);
  }

  loadSdk(0, () => {
    if (typeof firebase === 'undefined') return;
    let db;
    try {
      firebase.initializeApp(CONFIG);
      db = firebase.firestore();
    } catch (e) { return; }
    const col = db.collection('clients');

    const WATCH = ['oryx_users', 'oryx_accounts', 'oryx_trades', 'oryx_txns', 'oryx_requests', 'oryx_admins', 'oryx_admin_log'];
    const TSKEY = 'oryx_cloud_ts';
    const tsLoad = () => { try { return JSON.parse(localStorage.getItem(TSKEY) || '{}'); } catch (e) { return {}; } };
    const tsSave = m => localStorage.setItem(TSKEY, JSON.stringify(m));
    let applying = false;

    /* ---------- build one client's bundle from the local store ---------- */
    function bundleOf(user) {
      const accs = Oryx.accounts().filter(a => a.userId === user.id);
      const ids = accs.map(a => a.id);
      return {
        user: user,
        accounts: accs,
        trades: Oryx.trades().filter(t => ids.includes(t.accountId)),
        txns: Oryx.txns().filter(t => ids.includes(t.accountId)),
        requests: Oryx.requests().filter(r => ids.includes(r.accountId)),
        updatedAt: Date.now()
      };
    }
    /* Firestore documents cap at ~1 MB and proof photos are heavy: if a bundle
       is too large, drop proofs from decided requests first, then all proofs. */
    function sized(b) {
      let out = b, s = JSON.stringify(out).length;
      if (s < 900000) return out;
      out = JSON.parse(JSON.stringify(b));
      out.requests.forEach(r => { if (r.status !== 'pending') r.proof = ''; });
      s = JSON.stringify(out).length;
      if (s < 900000) return out;
      out.requests.forEach(r => { r.proof = ''; });
      return out;
    }

    /* ---------- push: local -> cloud (debounced, on any data write) ----------
       Only bundles whose contents actually changed are pushed (per-user hash),
       so one device can never overwrite another client's newer record with a
       stale local copy it happens to hold. */
    const HKEY = 'oryx_cloud_hash';
    const hLoad = () => { try { return JSON.parse(localStorage.getItem(HKEY) || '{}'); } catch (e) { return {}; } };
    const hashOf = o => { const s = JSON.stringify(o); let h = 0; for (let i = 0; i < s.length; i++) { h = (h * 31 + s.charCodeAt(i)) | 0; } return h; };
    let pushTimer = null;
    function pushAll() {
      const hashes = hLoad();
      Oryx.users().forEach(u => {
        const email = (u.email || '').toLowerCase();
        if (!email) return;
        const raw = bundleOf(u);
        const h = hashOf(Object.assign({}, raw, { updatedAt: 0 }));
        if (hashes[email] === h) return;
        hashes[email] = h;
        localStorage.setItem(HKEY, JSON.stringify(hashes));
        const b = sized(raw);
        const m = tsLoad(); m[email] = b.updatedAt; tsSave(m);
        col.doc(email).set(b).catch(() => {});
      });
    }
    function schedulePush() {
      if (applying) return;
      clearTimeout(pushTimer);
      pushTimer = setTimeout(() => { pushAll(); pushMeta(); }, 900);
    }
    const rawSet = localStorage.setItem.bind(localStorage);
    localStorage.setItem = function (k, v) {
      rawSet(k, v);
      if (WATCH.includes(k)) schedulePush();
    };

    /* ---------- merge: cloud -> local (only when the cloud copy is newer) ---------- */
    function mergeBundle(b) {
      if (!b || !b.user || !b.user.email) return false;
      const email = b.user.email.toLowerCase();
      const m = tsLoad();
      if ((m[email] || 0) >= (b.updatedAt || 0)) return false;
      applying = true;
      try {
        const accIds = (b.accounts || []).map(a => a.id);
        const users = Oryx.users().filter(u => u.id !== b.user.id && u.email.toLowerCase() !== email);
        users.push(b.user);
        rawSet(Oryx.K.users, JSON.stringify(users));
        const accs = Oryx.accounts().filter(a => a.userId !== b.user.id && !accIds.includes(a.id));
        rawSet(Oryx.K.accounts, JSON.stringify(accs.concat(b.accounts || [])));
        const trs = Oryx.trades().filter(t => !accIds.includes(t.accountId));
        rawSet(Oryx.K.trades, JSON.stringify(trs.concat(b.trades || [])));
        const txs = Oryx.txns().filter(t => !accIds.includes(t.accountId));
        rawSet(Oryx.K.txns, JSON.stringify(txs.concat(b.txns || [])));
        const rqs = Oryx.requests().filter(r => !accIds.includes(r.accountId));
        rawSet('oryx_requests', JSON.stringify(rqs.concat(b.requests || [])));
        m[email] = b.updatedAt; tsSave(m);
        const hashes = hLoad();
        hashes[email] = hashOf(Object.assign({}, bundleOf(b.user), { updatedAt: 0 }));
        localStorage.setItem(HKEY, JSON.stringify(hashes));
      } catch (e) {}
      applying = false;
      return true;
    }

    function pullUser(email) {
      return col.doc(email.toLowerCase()).get()
        .then(d => (d.exists ? mergeBundle(d.data()) : false))
        .catch(() => false);
    }
    function pullAll() {
      return col.get()
        .then(snap => { let changed = false; snap.forEach(d => { if (mergeBundle(d.data())) changed = true; }); return changed; })
        .catch(() => false);
    }
    function tryLogin(email, pass) {
      return col.doc(email.toLowerCase()).get().then(d => {
        if (!d.exists) return false;
        const b = d.data();
        if (!b.user || b.user.pass !== pass) return false;
        const m = tsLoad(); delete m[email.toLowerCase()]; tsSave(m); // force-merge on login
        return mergeBundle(b);
      }).catch(() => false);
    }

    /* ---------- meta sync: admin accounts + activity log ----------
       Whole lists in single documents; the newest copy wins. */
    const META_TS = 'oryx_meta_ts';
    const metaTs = () => { try { return JSON.parse(localStorage.getItem(META_TS) || '{}'); } catch (e) { return {}; } };
    function pushMeta() {
      const m = metaTs();
      [['admins', () => Oryx.admins()], ['log', () => Oryx.adminLog()]].forEach(([docId, get]) => {
        const list = get();
        const h = hashOf(list);
        if (m[docId + '_h'] === h) return;
        m[docId + '_h'] = h; m[docId] = Date.now();
        localStorage.setItem(META_TS, JSON.stringify(m));
        db.collection('meta').doc(docId).set({ list: list, updatedAt: m[docId] }).catch(() => {});
      });
    }
    function pullMeta() {
      return db.collection('meta').get().then(snap => {
        let changed = false; const m = metaTs();
        snap.forEach(d => {
          const data = d.data();
          if (!data || !Array.isArray(data.list)) return;
          if ((m[d.id] || 0) >= (data.updatedAt || 0)) return;
          applying = true;
          rawSet(d.id === 'admins' ? 'oryx_admins' : 'oryx_admin_log', JSON.stringify(data.list));
          applying = false;
          m[d.id] = data.updatedAt; m[d.id + '_h'] = hashOf(data.list);
          changed = true;
        });
        localStorage.setItem(META_TS, JSON.stringify(m));
        return changed;
      }).catch(() => false);
    }

    window.OryxCloud = { pushAll, pullUser, pullAll, tryLogin, pushMeta, pullMeta };

    /* ---------- on every app page: sync first, refresh the view once ---------- */
    function syncOnLoad() {
      const isAdmin = location.pathname.includes('/admin/');
      const done = changed => {
        if (!changed) return;
        const mark = sessionStorage.getItem('oryx_cloud_reload') || '';
        const now = String(Date.now());
        if (mark !== now) { sessionStorage.setItem('oryx_cloud_reload', now); location.reload(); }
      };
      if (isAdmin) { Promise.all([pullAll(), pullMeta()]).then(([a, b]) => done(a || b)); return; }
      const u = Oryx.currentUser();
      if (u && u.email) pullUser(u.email).then(done);
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncOnLoad);
    else syncOnLoad();
  });
})();
