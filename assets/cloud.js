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

    /* ---------- merge: cloud -> local (only when the cloud copy is newer
       AND its content actually differs — a newer timestamp alone must never
       trigger a reload, or open tabs can chase each other's syncs) ---------- */
    function mergeBundle(b) {
      if (!b || !b.user || !b.user.email) return false;
      const email = b.user.email.toLowerCase();
      const m = tsLoad();
      if ((m[email] || 0) >= (b.updatedAt || 0)) return false;
      const accIds = (b.accounts || []).map(a => a.id);
      const newUsers = Oryx.users().filter(u => u.id !== b.user.id && u.email.toLowerCase() !== email);
      newUsers.push(b.user);
      const newAccs = Oryx.accounts().filter(a => a.userId !== b.user.id && !accIds.includes(a.id)).concat(b.accounts || []);
      const newTrs = Oryx.trades().filter(t => !accIds.includes(t.accountId)).concat(b.trades || []);
      const newTxs = Oryx.txns().filter(t => !accIds.includes(t.accountId)).concat(b.txns || []);
      const newRqs = Oryx.requests().filter(r => !accIds.includes(r.accountId)).concat(b.requests || []);
      const changed =
        JSON.stringify(newUsers) !== JSON.stringify(Oryx.users()) ||
        JSON.stringify(newAccs) !== JSON.stringify(Oryx.accounts()) ||
        JSON.stringify(newTrs) !== JSON.stringify(Oryx.trades()) ||
        JSON.stringify(newTxs) !== JSON.stringify(Oryx.txns()) ||
        JSON.stringify(newRqs) !== JSON.stringify(Oryx.requests());
      m[email] = b.updatedAt; tsSave(m);
      if (changed) {
        applying = true;
        try {
          rawSet(Oryx.K.users, JSON.stringify(newUsers));
          rawSet(Oryx.K.accounts, JSON.stringify(newAccs));
          rawSet(Oryx.K.trades, JSON.stringify(newTrs));
          rawSet(Oryx.K.txns, JSON.stringify(newTxs));
          rawSet('oryx_requests', JSON.stringify(newRqs));
        } catch (e) {}
        applying = false;
      }
      const hashes = hLoad();
      hashes[email] = hashOf(Object.assign({}, bundleOf(b.user), { updatedAt: 0 }));
      localStorage.setItem(HKEY, JSON.stringify(hashes));
      return changed;
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
       Whole lists in single documents; the newest copy wins — with two
       safeguards learned the hard way: (1) only a browser that has PULLED
       meta at least once may push it, so a fresh client browser can never
       overwrite the admins/log with its empty local copies; (2) the log is
       append-only, so pulls UNION it by entry id instead of replacing. */
    const META_TS = 'oryx_meta_ts';
    const metaTs = () => { try { return JSON.parse(localStorage.getItem(META_TS) || '{}'); } catch (e) { return {}; } };
    let metaReady = false;
    function pushMeta() {
      if (!metaReady) return;
      const m = metaTs();
      [['admins', () => Oryx.admins()], ['log', () => Oryx.adminLog()]].forEach(([docId, get]) => {
        const list = get();
        if (docId === 'admins' && list.length === 0) return;
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
          if (d.id === 'log') {
            const byId = {};
            Oryx.adminLog().forEach(e => { byId[e.id] = e; });
            let added = false;
            data.list.forEach(e => { if (e && e.id && !byId[e.id]) { byId[e.id] = e; added = true; } });
            m[d.id] = Math.max(m[d.id] || 0, data.updatedAt || 0);
            m[d.id + '_h'] = hashOf(data.list);
            if (added) {
              const merged = Object.values(byId).sort((a, b) => a.at - b.at).slice(-500);
              applying = true;
              rawSet('oryx_admin_log', JSON.stringify(merged));
              applying = false;
              changed = true;
            }
            return;
          }
          if ((m[d.id] || 0) >= (data.updatedAt || 0)) return;
          m[d.id] = data.updatedAt; m[d.id + '_h'] = hashOf(data.list);
          if (localStorage.getItem('oryx_admins') === JSON.stringify(data.list)) return; // same content: no reload
          applying = true;
          rawSet('oryx_admins', JSON.stringify(data.list));
          applying = false;
          changed = true;
        });
        localStorage.setItem(META_TS, JSON.stringify(m));
        metaReady = true;
        return changed;
      }).catch(() => false);
    }

    window.OryxCloud = { pushAll, pullUser, pullAll, tryLogin, pushMeta, pullMeta };

    /* ---------- on every app page: sync first, refresh the view once ---------- */
    function syncOnLoad() {
      const isAdmin = location.pathname.includes('/admin/');
      const done = changed => {
        if (!changed) return;
        /* Admin pages never reload for a sync: they re-render in place.
           A reload landing mid-click swallows the click and throws the
           admin back to the Dashboard — in-place rendering cannot. */
        if (isAdmin && typeof window.renderAll === 'function') { try { window.renderAll(); } catch (e) {} return; }
        /* Reload at most ONCE per manual visit: if this page already
           auto-reloaded, apply further merges silently — the next natural
           navigation shows them. This stops open tabs from ever chasing
           each other's syncs in a reload loop that swallows clicks. */
        if (sessionStorage.getItem('oryx_cloud_reload') === '1') { sessionStorage.removeItem('oryx_cloud_reload'); return; }
        sessionStorage.setItem('oryx_cloud_reload', '1');
        location.reload();
      };
      if (isAdmin) { Promise.all([pullAll(), pullMeta()]).then(([a, b]) => done(a || b)); return; }
      const u = Oryx.currentUser();
      /* Heal pass: after the pull, push once — the per-user hash guard makes
         it a no-op for data the cloud already has, but a user whose record
         never reached the cloud (registered on a cached pre-database copy
         of the site; his data sat only on his phone) is uploaded now, on a
         plain page open, without him making a new entry. */
      if (u && u.email) pullUser(u.email).then(changed => { pushAll(); done(changed); });
    }
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', syncOnLoad);
    else syncOnLoad();
  });
})();
