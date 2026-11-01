/* BURROW art21/art23: LAN co-op (each player on their own computer).
   Loaded after game.js. Talks to serve.py's WebSocket relay at /ws.
   The HOST owns the world (tiles, enemies, bosses, boulders, drops); CLIENTS
   send requests and their own miner state. Each player's miner, bag, gear,
   skills and goals live in their own browser. Under file:// nothing here runs
   unless you join a server by address, so single-player is unchanged. */
'use strict';
(function () {
  /* v0.26.8: the co-op version check uses the game's own VERSION (the ?v= tag in index.html was stuck at 0.25.9, so
     different releases could join each other, and the app's LAN relay - which checks the app version - refused everyone) */
  const VER = (typeof VERSION === 'string' && VERSION) || ((document.querySelector('script[src*="game.js?v="]') || {}).src || '').replace(/.*[?&]v=([\w.-]+).*/, '$1') || 'dev';
  const TINTS = ['#ffd24a', '#4ac8ff', '#ff6ad5', '#7dff6a'];
  const MP_KEY = 'burrow_mp_';
  const qs = new URLSearchParams(location.search);
  const isHttp = /^https?:$/.test(location.protocol);
  /* v0.25.1: the desktop app runs its own relay (same protocol as serve.py) and keeps the world file in its user folder */
  const APP = (window.burrowNative && window.burrowNative.lan) ? window.burrowNative : null;
  const canHost = isHttp || !!APP;
  /* v0.26.32: a public https page (GitHub Pages) has no serve.py behind it, so never ask it for /save or /mp/status */
  const noServe = location.protocol === 'https:' && !/^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
  const nowMs = () => performance.now();

  const NET = window.NET = {
    role: 'off', id: 0, ws: null, ver: VER,
    peers: new Map(),          // id -> { id, name, col, s, buf, last }
    quiet: 0, applying: 0, award: null,
    status: '', statusCol: '#c8b89a', urls: [], hostName: '',
    chat: [], chatOpen: false, chatBuf: '', edit: null,
    name: (qs.get('name') || localStorage.getItem('burrow_name') || '').slice(0, 16),
    addr: isHttp ? location.host : 'localhost:8765',
    pend: new Map(), pumpAcc: {}, parts: null, built: false,
    dirty: new Map(), seq: 1, lastRopes: '', hostLeft: false,
    wantClose: false, retry: 0, retryT: 0, tAcc: { p: 0, st: 0, tl: 0, pump: 0 },
    myCol: TINTS[0], mpWorld: false, live() { return this.role === 'host' || this.role === 'client'; }
  };

  /* ---------------------------------------------------------------- v0.26.8: co-op security
     Every message from the network is checked here before the game sees it: size, type, shape and numbers.
     The host owns the world; a friend's message can only ask for things a normal game would do near that
     friend. Floods get dropped and, after 3 strikes, the sender is removed. */
  const SEC = NET.sec = { maxMsg: 64 * 1024, maxHostMsg: 4 * 1024 * 1024, rateMsgs: 300, rateBytes: 512 * 1024, kickAt: 3, banned: new Set(), dropped: 0, kicks: 0, last: '' };
  const CLIENT_T = new Set(['p', 'chat', 'nm', 'lair', 'pz', 'brk', 'tile', 'pump', 'boom', 'drop', 'take', 'rv', 'rope', 'sput', 'sup', 'stake', 'hup', 'ssort', 'char']);
  const PEER_T = new Set(['p', 'chat']);          /* the only kinds a friend may send to everyone */
  const NOFROM_T = new Set(['welcome', 'err', 'hostleft']); /* only the relay itself sends these */
  const HOST_T = new Set(['bye', 'wpart', 'ro', 'p', 'chat', 'tl', 'brkOk', 'brkNo', 'tfix', 'st', 'hs', 'rp', 'rw', 'got', 'sback', 'sgot', 'supok', 'supno', 'pop', 'arm', 'lair', 'rv', 'pzs', 'vs', 'sx', 'boss', 'bs', 'bh', 'ev', 'hostleft', 'charok']);
  const isInt = Number.isInteger, isNum = v => typeof v === 'number' && isFinite(v);
  /* v0.26.23: only known enemy kinds / underground variants from a host (an unknown kind would crash makeEnemy) */
  const EN_KINDS = new Set(['mite', 'grub', 'beetle', 'bat', 'mimic', 'firegrub', 'queen', 'gateworm', 'sow', 'lithant', 'veil']);
  const EV_KINDS = new Set(['hopper', 'centipede', 'crab', 'wisp', 'spider', 'newt', 'slag']);
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const itemOk = id => typeof id === 'string' && id.length <= 40 && typeof ITEMS === 'object' && own(ITEMS, id);
  const clampInt = (v, a, b) => isNum(v) ? Math.max(a, Math.min(b, Math.round(v))) : a;
  const inWorld = (x, y) => isInt(x) && isInt(y) && x >= 0 && y >= 0 && x < W && y < H;
  let TMAX = 0;
  const isTile = v => { if (!TMAX) TMAX = Math.max(...Object.values(T).filter(isInt)); return isInt(v) && v >= 0 && v <= TMAX; };
  function cleanText(s, n) { return String(s == null ? '' : s).replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u202a-\u202e\u2060-\u206f\ufeff]/g, '').slice(0, n); }
  function cleanName(s, d) { return String(s == null ? '' : s).replace(/[^\w .'\-]/g, '').trim().slice(0, 16) || d; }
  function cleanKey(s) { return String(s == null ? '' : s).replace(/[^\w\-]/g, '').slice(0, 40); }
  NET.cleanText = cleanText; NET.cleanName = cleanName;
  function nearPeer(pe, px, py, tiles) {
    if (!pe || !Array.isArray(pe.s) || !isNum(px) || !isNum(py)) return false;
    return Math.abs(pe.s[0] + 5 - px) <= tiles * TILE && Math.abs(pe.s[1] + 7 - py) <= tiles * TILE;
  }
  function cleanState(s) {
    if (!Array.isArray(s) || s.length < 10 || s.length > 24) return null;
    const o = s.map(v => typeof v === 'number' ? (isFinite(v) ? Math.max(-1e7, Math.min(1e7, v)) : 0)
      : typeof v === 'string' ? v.slice(0, 200) : (v == null || typeof v === 'boolean') ? v : 0);
    if (!isNum(o[0]) || !isNum(o[1])) return null;
    o[0] = Math.max(-64, Math.min(W * TILE + 64, o[0])); o[1] = Math.max(-4000, Math.min(H * TILE + 64, o[1]));
    if (isNum(o[2])) o[2] = Math.max(-3000, Math.min(3000, o[2]));
    if (isNum(o[3])) o[3] = Math.max(-3000, Math.min(3000, o[3]));
    return o;
  }
  /* a friend's message, checked on the host */
  function hostOk(m, pe) {
    switch (m.t) {
      case 'p': { const s = cleanState(m.s); if (!s) return false; m.s = s; return true; }
      case 'chat': m.m = cleanText(m.m, 80).trim(); return m.m.length > 0;
      case 'nm': m.name = cleanName(m.name, ''); return !!m.name;
      case 'lair': return typeof m.k === 'string' && m.k.length <= 24;
      case 'pz': return isInt(m.i) && m.i >= 0 && m.i < 1024 && (m.a == null || typeof m.a === 'string' && m.a.length <= 16 || isInt(m.a));
      case 'brk': return inWorld(m.x, m.y) && isTile(m.v) && nearPeer(pe, m.x * TILE + 8, m.y * TILE + 8, 24);
      case 'tile':
        return inWorld(m.x, m.y) && isTile(m.f) && isTile(m.v) && m.f !== T.BEDROCK && !CHEST.has(m.f)
          && m.v !== T.BEDROCK && m.v !== T.SPRING && m.v !== T.GRUBNEST && m.v !== T.LAKE && !CHEST.has(m.v) && !ORE.has(m.v)
          && nearPeer(pe, m.x * TILE + 8, m.y * TILE + 8, 24);
      case 'pump': {
        if (!isInt(m.id) || (m.a != null && !isNum(m.a))) return false;
        m.ov = isNum(m.ov) ? Math.max(0, Math.min(10, m.ov)) : 0;
        const e = S.enemies.find(q => q.id === m.id && !q.dead);
        return !!e && nearPeer(pe, e.x + 8, e.y + 8, 20);
      }
      case 'boom': if (!isNum(m.x) || !isNum(m.y)) return false; m.r = isNum(m.r) ? Math.max(1, Math.min(4, m.r)) : 2; return nearPeer(pe, m.x, m.y, 24);
      case 'drop': return itemOk(m.id) && isNum(m.n) && isNum(m.x) && isNum(m.y);
      case 'take': return isInt(m.i);
      case 'rv': return isNum(m.x) && isNum(m.y) && isNum(m.vx) && isNum(m.vy) && nearPeer(pe, m.x, m.y, 30);
      case 'rope':
        if (!inWorld(m.x, m.y) || S.ropes.length >= 400) return false;
        m.len = isInt(m.len) ? Math.max(1, Math.min(64, m.len)) : 8;
        return nearPeer(pe, m.x * TILE + 8, m.y * TILE + 8, 24);
      case 'sput': return itemOk(m.id);
      case 'sup': case 'stake': case 'ssort': return true;
      case 'hup': m.lv = m.lv === 2 ? 2 : 1; return true;   /* v0.26.26: level 2 = House Upgrade II */
      case 'char': { if (pe && pe._charN >= 3) return false; const c = clampNums(m); for (const k in c) m[k] = c[k]; return true; }   /* v0.26.9 */
    }
    return false;
  }
  const arrOf = (a, max) => Array.isArray(a) && a.length <= max;
  const flatOk = a => Array.isArray(a) && a.length <= 16 && a.every(v => v == null || typeof v === 'boolean' || isNum(v) || typeof v === 'string' && v.length <= 40);
  /* the host's message, checked on a friend's computer */
  function clientOk(m) {
    switch (m.t) {
      case 'bye': return true;
      case 'wpart': return isInt(m.n) && m.n >= 1 && m.n <= 1000 && isInt(m.i) && m.i >= 0 && m.i < m.n && typeof m.d === 'string' && m.d.length <= 200000;
      case 'ro':
        if (!arrOf(m.l, 8)) return false;
        m.l = m.l.filter(r => Array.isArray(r) && isInt(r[0])).map(r => [r[0], cleanName(r[1], 'Miner'), /^#[0-9a-fA-F]{3,8}$/.test(r[2]) ? r[2] : '#c8b89a'].concat(r.slice(3, 6).filter(v => isNum(v) || typeof v === 'string' && v.length <= 40)));
        return true;
      case 'p': { const s = cleanState(m.s); if (!s || !isInt(m.from)) return false; m.s = s; return true; }
      case 'chat': m.m = cleanText(m.m, 80).trim(); return m.m.length > 0 && isInt(m.from);
      case 'tl':
        if (!Array.isArray(m.d) || m.d.length % 3 || m.d.length > 600000) return false;
        for (let i = 0; i < m.d.length; i += 3) if (!inWorld(m.d[i], m.d[i + 1]) || !isTile(m.d[i + 2])) return false;
        return true;
      case 'brkOk': case 'brkNo': case 'tfix': return inWorld(m.x, m.y) && isTile(m.v);
      case 'st':
        if (!['e', 'f', 'k'].every(k => arrOf(m[k], 6000) && m[k].every(flatOk))) return false;
        m.e = m.e.filter(a => isNum(a[0]) && typeof a[1] === 'string' && EN_KINDS.has(a[1]) && isNum(a[2]) && isNum(a[3]));
        for (const a of m.e) if (a.length > 10 && !EV_KINDS.has(a[10])) a[10] = 0;   /* v0.26.23: underground variant (whitelisted) */
        m.f = m.f.filter(a => isNum(a[0]) && isNum(a[1]) && isNum(a[2]));
        m.k = m.k.filter(a => isNum(a[0]) && (a[1] === 'c' || a[1] === 'i' && itemOk(a[2])) && isNum(a[3]) && isNum(a[4]) && isNum(a[5]));
        if (m.dc != null && !(isNum(m.dc) && m.dc >= 0 && m.dc < 100000)) delete m.dc;   /* v0.26.22: day clock (seconds) */
        return true;
      case 'hs': return arrOf(m.h, 64) && m.h.every(h => h && typeof h === 'object') && (m.on == null || arrOf(m.on, 16));
      case 'rp': if (!arrOf(m.r, 400)) return false; m.r = m.r.filter(r => r && inWorld(r.x, r.y) && isInt(r.len) && r.len > 0 && r.len <= 64); return true;
      case 'rw':
        m.xp = clampInt(m.xp, 0, 1e6); m.gold = clampInt(m.gold, 0, 1e7);
        m.items = Array.isArray(m.items) ? m.items.filter(a => Array.isArray(a) && itemOk(a[0]) && isInt(a[1]) && a[1] > 0 && a[1] <= 999).slice(0, 64) : [];
        if (m.pops != null && !arrOf(m.pops, 64)) m.pops = [];
        return true;
      case 'got': if (!isInt(m.i)) return false; m.n = clampInt(m.n, 1, m.k === 'coin' ? 1e6 : 999); return m.k === 'coin' || itemOk(m.id);
      case 'sback': case 'sgot': return itemOk(m.id) && isInt(m.n) && m.n >= 0 && m.n <= 9999;
      case 'supok': case 'supno': m.pr = clampInt(m.pr, 0, 1e7); m.cap = clampInt(m.cap, 0, 9999); return true;
      case 'pop': case 'arm': return isInt(m.id);
      case 'lair': return typeof m.k === 'string' && m.k.length <= 24;
      case 'rv': return isNum(m.x) && isNum(m.y) && isNum(m.vx) && isNum(m.vy);
      case 'pzs': return isInt(m.i) && m.i >= 0 && m.i < 1024;
      case 'charok': { const c = clampNums(m); for (const k in c) m[k] = c[k]; return true; }   /* v0.26.9 */
    }
    return HOST_T.has(m.t);   /* other host-only kinds (boss state etc.) are read by game.js, which checks its own fields */
  }
  /* rate limit: a 1 s window per sender; going over it is a strike, 3 strikes and you are out */
  function rateHit(c, bytes) {
    const t = nowMs();
    if (!c.rw || t - c.rw >= 1000) { if (c.strikes > 0 && t - (c.st || 0) > 30000) { c.strikes--; c.st = t; } c.rw = t; c.rn = 0; c.rb = 0; c.over = false; }
    c.rn++; c.rb += bytes;
    if (c.rn > SEC.rateMsgs || c.rb > SEC.rateBytes) {
      if (!c.over) { c.over = true; c.strikes = (c.strikes | 0) + 1; c.st = t; }
      return c.strikes >= SEC.kickAt ? 'kick' : 'drop';
    }
    return 'ok';
  }
  function strike(c) { c.strikes = (c.strikes | 0) + 1; c.st = nowMs(); return c.strikes >= SEC.kickAt; }
  NET.secRateHit = rateHit;
  function secDrop(why) { SEC.dropped++; SEC.last = why; }
  /* online codes and install keys come from the browser's secure random source */
  function rnd(n) { const a = new Uint32Array(1), lim = Math.floor(0x100000000 / n) * n; do { crypto.getRandomValues(a); } while (a[0] >= lim); return a[0] % n; }
  NET.secRnd = rnd;
  const cl = () => NET.role === 'client' && NET.built;
  if (!NET.name) NET.name = 'Miner' + (10 + Math.floor(Math.random() * 89));
  NET.roleLabel = () => ({ host: 'hosting', client: 'joined', offline: 'offline', connecting: '...' })[NET.role] || '';

  /* ---------------------------------------------------------------- socket */
  function wsUrl(addr) {
    addr = String(addr || '').trim().replace(/^https?:\/\//, '').replace(/^wss?:\/\//, '').replace(/\/.*$/, '');
    if (!addr) addr = 'localhost:8765';
    if (!/:\d+$/.test(addr)) addr += ':8765';
    return 'ws://' + addr + '/ws';
  }
  function setStatus(s, col) { NET.status = s; NET.statusCol = col || '#c8b89a'; }
  function send(o) {
    const ws = NET.ws;
    if (ws && ws.readyState === 1) { try { ws.send(JSON.stringify(o)); } catch (err) {} }
  }
  NET.send = send;
  function sendTo(id, o) { o.to = id; send(o); }

  function connect(role) {
    if (NET.ws) { NET.wantClose = true; try { NET.ws.close(); } catch (err) {} }
    NET.wantClose = false;
    NET.connRole = role;
    let ws;
    try { ws = NET.online ? onlineSocket(role) : new WebSocket(wsUrl(role === 'host' ? (isHttp ? location.host : (NET.relayAddr || NET.addr)) : NET.addr)); }
    catch (err) { setStatus('Bad address: ' + NET.addr, '#e07070'); return; }
    NET.ws = ws;
    if (NET.role === 'off' || NET.role === 'offline') NET.role = 'connecting';
    setStatus(NET.online ? (role === 'host' ? 'Getting a join code...' : NET.online.rj ? 'Connecting to ' + (NET.online.rjName || 'your friend') + '...' : 'Connecting to code ' + NET.online.code + '...') : role === 'host' ? 'Starting host...' : 'Connecting to ' + NET.addr + '...');
    ws.onopen = () => send({ t: 'hello', role, name: NET.name, ver: VER, key: myKey() });
    ws.onmessage = (ev) => { if (typeof ev.data !== 'string' || ev.data.length > SEC.maxHostMsg) return secDrop('size'); let m; try { m = JSON.parse(ev.data); } catch (err) { return; } try { onMsg(m); } catch (err) { console.error('net msg', m && m.t, err); } };
    ws.onclose = () => { if (NET.ws === ws) onClosed(); };
    ws.onerror = () => {};
  }
  function myKey() {
    let k = localStorage.getItem('burrow_mp_key');
    if (!k || !/^[\w-]{6,40}$/.test(k)) { k = ''; for (let i = 0; i < 16; i++) k += '0123456789abcdefghijklmnopqrstuvwxyz'[rnd(36)]; localStorage.setItem('burrow_mp_key', k); }
    return k;
  }
  function onClosed() {
    NET.ws = null;
    if (NET.wantClose) return;
    if (NET.role === 'client' && NET.awayOk && (NET.away || NET.awayOk())) {   /* v0.26.11: the host may be restarting */
      if (!NET.away) NET.hostAway(true);
      else if (NET.retry < 99 && nowMs() - NET.away.t0 < NET.AWAY_MS) { NET.retry = Math.max(1, NET.retry); NET.retryT = 3; }
      else { const why = NET.awayWhy || (NET.kickedMsg ? 'Removed by the host' : "Host didn't come back"); NET.away = null; NET.awayWhy = ''; hostGone(why); }
    } else if (NET.role === 'client') {
      if (NET.retry < 15) {
        NET.retry++; NET.retryT = 2;
        setStatus('Connection lost - reconnecting (' + NET.retry + '/15)...', '#e0c060');
        if (NET.retry === 1) toast('Connection lost', 'reconnecting...', '#e0c060', 'ui');
      } else hostGone(NET.kickedMsg ? 'Removed by the host' : 'Lost the host');
    } else if (NET.role === 'host') {
      NET.role = 'off'; NET.peers.clear(); scaleBosses();
      setStatus(NET.online ? 'Online hosting stopped - you are playing solo.' : 'Server stopped - you are playing solo.', '#e0c060');
      toast('Server stopped', 'your world is still saved here', '#e0c060', 'ui');
    } else if (NET.role === 'connecting') {
      NET.role = 'off';
      if (!NET.errShown && NET.rejoining()) setStatus(HOST_AWAY, '#e07070');
      else if (!NET.errShown) setStatus(NET.online ? 'Could not connect online. Check the code and your internet.' : 'Could not reach ' + NET.addr + '. Is serve.py running there?', '#e07070');
    }
    NET.errShown = false;
  }

  /* art24d: house ownership - the host keeps the list in the world and tells everyone who is online */
  NET.key = myKey;
  NET.sendHouses = function () {
    if (NET.role !== 'host') return;
    const on = [myKey()].concat([...NET.peers.values()].map(p => p.key || ('peer' + p.id)));   /* v0.26.13: same key assignHouse used for a keyless peer */
    send({ t: 'hs', h: S.houses || [], on });
  };
  NET.sendName = function (nm) {
    NET.name = nm;
    if (NET.role === 'client') send({ t: 'nm', name: nm });
    else if (NET.role === 'host') { sendRoster(); NET.sendHouses(); }
  };
  NET.host = function () {
    NET.hostLeft = false; NET.online = null;
    if (!APP || isHttp) return connect('host');
    setStatus('Starting host...');
    APP.lan.start().then(r => {
      if (!r || !r.ok) { setStatus('Could not start hosting: ' + ((r && r.why) || 'port busy'), '#e07070'); return; }
      NET.relayAddr = '127.0.0.1:' + r.port; NET.urls = (r.ips || []).map(ip => ip + (r.port === 8765 ? '' : ':' + r.port));
      connect('host');
    }).catch(err => setStatus('Could not start hosting: ' + err, '#e07070'));
  };
  NET.join = function () { NET.online = null; NET.hostLeft = false; NET.retry = 0; NET.built = false; connect('join'); };
  NET.leave = function () {
    if (NET.role === 'client' || NET.role === 'offline') { savePlayer(); backToMenu(); return; }
    NET.wantClose = true;
    if (NET.ws) try { NET.ws.close(); } catch (err) {}
    NET.ws = null; NET.role = 'off'; NET.peers.clear(); scaleBosses();
    if (APP && !isHttp) { try { APP.lan.stop(); } catch (err) {} NET.relayAddr = ''; }
    setStatus('Left multiplayer.');
  };
  function backToMenu() {
    try { sessionStorage.setItem('burrow_noauto', '1'); } catch (err) {}
    NET.wantClose = true;
    if (NET.ws) try { NET.ws.close(); } catch (err) {}
    location.href = location.pathname;
  }
  function hostGone(why) {
    savePlayer();
    NET.hostLeft = why || 'Host left';
    NET.wantClose = true;
    if (NET.ws) try { NET.ws.close(); } catch (err) {}
    NET.ws = null;
    NET.role = 'offline';
    NET.peers.clear();
    for (const u of S.pickups) delete u.nid;
    NET.pend.clear();
    S.paused = true; S.menu = 'mp';
    setStatus(NET.hostLeft + '. Keep playing offline, or go back to your own burrow.', '#e0c060');
  }

  /* ---------------------------------------------------------------- messages */
  function onMsg(m) {
    if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.t !== 'string' || m.t.length > 12) return secDrop('shape');
    if (m.from != null && NOFROM_T.has(m.t)) return secDrop('forged ' + m.t);   /* v0.26.8: a friend can not fake the relay */
    switch (m.t) {
      case 'err':
        NET.errShown = true;
        if (NET.away && (m.code === 'nohost' || m.code === 'online')) {   /* v0.26.11: host still restarting - quietly try again */
          const w = NET.ws; if (w) setTimeout(() => { try { w.close(); } catch (e) {} }, 50);
          return;
        }
        if (m.code === 'version' && m.need) {
          const vv = v => 'v' + String(v).replace(/^v/, ''), num = v => String(v).replace(/^v/, '').split('.').map(n => +n || 0);
          const a = num(m.need), b = num(m.have || VER); let cmp = 0; for (let i = 0; i < 3 && !cmp; i++) cmp = (a[i] || 0) - (b[i] || 0);
          m.msg = cmp > 0 ? 'Your friend is on ' + vv(m.need) + ', please update.' : 'Your friend is on ' + vv(m.need) + ' (older), ask them to update.';
        }
        if (m.code === 'nohost' && NET.rejoining()) m.msg = HOST_AWAY;   /* v0.26.9: Recent games */
        setStatus(m.msg || m.code, '#e07070');
        if (NET.role === 'connecting') NET.role = 'off';
        if (NET.role === 'client' && m.code === 'nohost' && !NET.away) { NET.retry = 99; }
        if (m.code === 'version' && NET.away) { NET.retry = 99; NET.awayWhy = m.need && /please update/.test(m.msg) ? 'Host updated to v' + String(m.need).replace(/^v/, '') + ' - Update to rejoin' : (m.msg || 'Update to rejoin'); if (/please update/.test(m.msg)) m.msg = NET.awayWhy; }
        if (m.code === 'kicked' || m.code === 'denied') { NET.retry = 99; NET.kickedMsg = m.msg || 'The host removed you'; }
        toast('Multiplayer', m.msg || m.code, '#e07070', 'ui');
        return;
      case 'wait': if (NET.role === 'connecting' || (NET.role === 'client' && !NET.built)) setStatus(cleanText(m.msg, 80) || 'Waiting for the host...', '#e0c060'); return;
      case 'jno':   /* v0.26.9: a Wi-Fi host said no (online hosts send err 'denied' before the welcome) */
        if (NET.role !== 'client' || NET.built || (m.from != null && NET.hostId != null && m.from !== NET.hostId)) return;
        lanDenied(cleanText(m.msg, 80) || 'The host said no this time.');
        return;
      case 'welcome':
        NET.id = m.id; NET.hostId = isInt(m.hostId) ? m.hostId : (m.role === 'host' ? m.id : null); NET.kickedMsg = '';
        if (m.role === 'host') {
          NET.role = 'host'; NET.urls = m.urls || [];
          if (!S.worldId) S.worldId = 'w' + Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
          saveGame();
          NET.myCol = TINTS[0];
          setStatus('Hosting! Friends on your Wi-Fi open the address below.', '#80e080');
          toast('Hosting your world', NET.urls[0] ? 'friends open ' + NET.urls[0] : 'friends join from the Multiplayer menu', '#80e080', 'ui');
          sendRoster();
        } else {
          try { homeSnapshot(); } catch (err) { console.warn('could not take your miner along', err); }   /* v0.26.9 */
          if (NET.away) { toast('Rejoined ' + cleanName(m.hostName, 'the host'), 'back in the game', '#80e080', 'ui'); NET.away = null; }   /* v0.26.11 */
          NET.hostBack = null;
          NET.role = 'client'; NET.hostName = m.hostName || 'host'; NET.built = false; NET.parts = null;
          NET.hostRj = (typeof m.rj === 'string' && /^[a-z0-9]{12,32}$/.test(m.rj)) ? m.rj : '';   /* v0.26.9: Recent games */
          setStatus('Joined ' + NET.hostName + "'s world - loading...", '#80e080');
        }
        return;
    }
    if (NET.role === 'host') {
      if (m.t === 'join' || m.t === 'leave') { if (!isInt(m.from) || m.from < 2) return secDrop('bad id'); m.name = cleanName(m.name, 'Miner'); m.key = cleanKey(m.key); return hostMsg(m); }
      if (!CLIENT_T.has(m.t)) return secDrop('type ' + m.t);
      const pe = peerOf(m.from);
      if (!pe) return secDrop('unknown sender');
      if (!hostOk(m, pe)) {
        if ((m.t === 'brk' || m.t === 'tile') && inWorld(m.x, m.y)) sendTo(m.from, { t: 'tfix', x: m.x, y: m.y, v: tget(m.x, m.y) });
        return secDrop('bad ' + m.t);
      }
      return hostMsg(m);
    }
    if (NET.role === 'client') {
      if (m.from != null && NET.hostId != null && m.from !== NET.hostId && !PEER_T.has(m.t)) return secDrop('not the host: ' + m.t);
      if (!HOST_T.has(m.t) || !clientOk(m)) return secDrop('bad ' + m.t);
      return clientMsg(m);
    }
  }

  /* ---- host side ---- */
  function peerOf(id) { return NET.peers.get(id); }
  function hostMsg(m) {
    const from = m.from;
    switch (m.t) {
      case 'join': {
        if (!NET.online && NET.kickedHas && NET.kickedHas(m.key)) { send({ t: 'kick', id: from }); SEC.blocked = (SEC.blocked | 0) + 1; return; }   /* v0.26.8: on the kicked list */
        if (!NET.online && !LAN_OK.has(m) && NET.askOn() && !(NET.autoOk && NET.autoOk(m.key))) { lanAsk(from, m); return; }   /* v0.26.9: Wi-Fi asks too */
        const used = new Set([NET.myCol, ...[...NET.peers.values()].map(p => p.col)]);
        const col = TINTS.find(c => !used.has(c)) || TINTS[NET.peers.size % 4];
        NET.peers.set(from, { id: from, name: m.name, col, s: null, buf: [], last: nowMs(), key: m.key || '' });
        if (typeof assignHouse === 'function') { try { assignHouse(m.key || ('peer' + from), m.name); } catch (err) { console.error(err); } }
        sendWorld(from);
        NET.sendHouses();
        sendRoster();
        scaleBosses();
        toast(m.name + ' joined', 'co-op on your Wi-Fi', col, 'ui');
        return;
      }
      case 'leave': {
        lanAskDrop(from);
        const p = peerOf(from);
        NET.peers.delete(from);
        NET.sendHouses();
        sendRoster(); scaleBosses();
        if (p) toast(p.name + ' left', '', '#c8b89a', 'ui');
        return;
      }
      case 'nm': {
        const pe = peerOf(from); if (!pe) return;
        pe.name = String(m.name || '').replace(/[^\w .'\-]/g, '').trim().slice(0, 16) || pe.name;
        if (typeof assignHouse === 'function') assignHouse(pe.key || ('peer' + from), pe.name);
        sendRoster(); NET.sendHouses();
        return;
      }
      case 'p': return gotPeerState(m);
      case 'chat': return gotChat(m);
      case 'lair': if (typeof lairFound === 'function') lairFound(m.k, true); return; /* v0.25.2: a friend found a boss lair (relay to the others) */
      case 'pz': if (typeof pvNet === 'function') pvNet(m, from, peerOf(from)); return; /* v0.25.3: a friend pushes/turns/pours in a puzzle vault (host checks it) */
      case 'brk': {
        const cur = tget(m.x, m.y);
        if (cur === m.v && cur !== T.AIR && cur !== T.BEDROCK && !isProtected(m.x, m.y)) {
          if (CHEST.has(cur)) startChestFx(m.x, m.y, cur, false);
          tset(m.x, m.y, T.AIR);
          const pe0 = peerOf(from); S._digBy = pe0 ? pe0.name : 'a friend';
          try { onRemoved(m.x, m.y); } finally { S._digBy = null; }
          sendTo(from, { t: 'brkOk', x: m.x, y: m.y, v: m.v });
        } else sendTo(from, { t: 'brkNo', x: m.x, y: m.y, v: cur });
        return;
      }
      case 'tile': {
        const cur = tget(m.x, m.y);
        if (cur === m.f && !isProtected(m.x, m.y)) { tset(m.x, m.y, m.v); if (m.v === T.AIR) onRemoved(m.x, m.y); }
        else sendTo(from, { t: 'tfix', x: m.x, y: m.y, v: cur });
        return;
      }
      case 'pump': {
        const e = S.enemies.find(q => q.id === m.id && !q.dead);
        if (!e) return;
        e._rp = 0.25;
        if (m.pop) { popBy(e, from, m.ov); return; }
        e.swell += Math.min(1, +m.a || 0);
        if (e.swell >= diffMul().popNeed) {
          e.armor--;
          if (e.armor <= 0) popBy(e, from, m.ov);
          else {
            e.swell = 0;
            floatTxt(e.x, e.y, 'ARMOR', '#e8d080');
            burst(e.x + 8, e.y + 8, '#e8d080', 10, 40);
            send({ t: 'arm', id: e.id });
          }
        }
        return;
      }
      case 'boom': {
        for (const e of S.enemies) {
          if (!e.dead && dist(m.x, m.y, e.x + 6, e.y + 6) < (m.r || 2) * TILE + 8) {
            e.armor--; if (e.armor <= 0) popBy(e, from, 0); else e.swell = 0.4;
          }
        }
        burst(m.x, m.y, '#e0a040', 20, 80);
        return;
      }
      case 'drop': { /* v0.26.3: a joiner dropped an item from their pack; the host puts it in the world for everybody */
        const pe = peerOf(from);
        const id = String(m.id || ''), n = Math.floor(+m.n || 0), x = +m.x, y = +m.y;
        if (!pe || !pe.s || !itemOk(id) || !(n >= 1 && n <= 999) || !isFinite(x) || !isFinite(y)) return;
        if (Math.abs(pe.s[0] + 5 - (x + 4)) + Math.abs(pe.s[1] + 7 - (y + 4)) > 80) return;
        const cl = (v, a, b) => Math.max(a, Math.min(b, +v || 0));
        S.pickups.push({ kind: 'item', id, n, x, y, vx: cl(m.vx, -120, 120), vy: cl(m.vy, -140, 40), life: 99, lockBy: from });
        return;
      }
      case 'take': {
        const u = S.pickups.find(q => q.nid === m.i && !q.dead);
        const pe = peerOf(from);
        if (!u || !pe || !pe.s) return;
        if (u.lockBy === from) return; /* v0.26.3: they just dropped it; it waits until they step away */
        if (dist(pe.s[0] + 5, pe.s[1] + 7, u.x + 4, u.y + 4) > 90) return;
        u.dead = true;
        sendTo(from, { t: 'got', i: u.nid, k: u.kind, id: u.id, n: u.n, x: u.x | 0, y: u.y | 0 });
        return;
      }
      case 'rv': /* art24d: a friend's rivet - the host pins, then shows it to everyone else */
        if (typeof rivetFromNet === 'function') { rivetFromNet(m, true); send({ t: 'rv', x: +m.x, y: +m.y, vx: +m.vx, vy: +m.vy, mk: Math.max(1, Math.min(3, m.mk | 0)), o: from }); }
        return;
      case 'rope':
        if (!S.ropes.some(r => r.x === m.x && r.y === m.y)) S.ropes.push({ x: m.x, y: m.y, len: m.len || 8 });
        return;
      case 'sput': {
        /* art24d: stashes are private - an old client's deposit is handed straight back, never stored in the host's stash */
        if (!itemOk(m.id)) return;
        sendTo(from, { t: 'sback', id: m.id, n: Math.max(1, Math.min(999, m.n | 0)) });
        return;
      }
      case 'char': { /* v0.26.9: a friend brought their own miner; the numbers were clamped in hostOk, send them back as the ones to use */
        const pe = peerOf(from); if (!pe) return;
        pe._charN = (pe._charN | 0) + 1;
        pe.char = { level: m.level, prestige: m.prestige, gold: m.gold, houseUp: m.houseUp, houseUp2: m.houseUp2 };
        sendTo(from, { t: 'charok', level: m.level, xp: m.xp, gold: m.gold, prestige: m.prestige, sp: m.sp, hpBase: m.hpBase, skills: m.skills,
          pack: m.pack, packBought: m.packBought, stashSize: m.stashSize, houseUp: m.houseUp, houseUp2: m.houseUp2, n: isInt(m.n) ? m.n : 0 });
        return;
      }
      case 'sup': sendTo(from, { t: 'supno', cap: 0, pr: 0 }); return; /* art24d: each player upgrades their own stash */
      case 'stake': return; /* art24d: the host's stash is private */
      case 'hup': { /* v0.26.5: a joiner bought the house upgrade (paid from their own gold); the host marks their house so everyone sees it */
        const pe = peerOf(from);
        const h = pe && pe.key ? (S.houses || []).find(q => q.key === pe.key) : null;
        /* v0.26.26: level 2 only on a house that already has level 1 */
        const lv = m.lv === 2 && h && h.up ? 2 : 1;
        if (h && (h.up | 0) < lv) { h.up = lv; try { saveGame(); } catch (e) {} }
        if (h) NET.sendHouses();
        return;
      }
    }
  }
  function sendRoster() {
    const l = [[NET.id, NET.name, NET.myCol]];
    for (const p of NET.peers.values()) l.push([p.id, p.name, p.col]);
    send({ t: 'ro', l });
  }
  function popBy(e, pid, ov) {
    NET.award = { pid, xp: 0, gold: 0, items: [], pops: [], ov: ov | 0 };
    const sh = S.p.shake, fl = S.flash, hs = S.hitStop;
    try { popEnemy(e); }
    finally {
      const a = NET.award; NET.award = null;
      if (dist(S.p.x, S.p.y, e.x, e.y) > TILE * 12) { S.p.shake = sh; S.flash = fl; S.hitStop = hs; }
      sendTo(pid, { t: 'rw', xp: a.xp, gold: a.gold, items: a.items, pops: a.pops });
    }
  }
  function scaleBosses() {
    const n = NET.role === 'host' ? 1 + NET.peers.size : 1;
    NET.bossMul = 1 + 0.6 * (n - 1);
    for (const e of S.enemies) {
      if (!e.boss || e.dead) continue;
      if (!e._p0) e._p0 = e.pumps || 3;
      const np = Math.max(1, Math.round(e._p0 * NET.bossMul));
      if (np !== e.pumps) { e.armor = Math.max(1, Math.round(e.armor * np / (e.pumps || e._p0))); e.pumps = np; }
    }
  }
  /* world snapshot: RLE + base64, always chunked */
  function rle(u8) {
    const out = [];
    for (let i = 0; i < u8.length;) {
      const v = u8[i]; let n = 1;
      while (i + n < u8.length && u8[i + n] === v && n < 255) n++;
      out.push(n, v); i += n;
    }
    return u8b64(Uint8Array.from(out));
  }
  function unrle(b64, len) {
    const a = b64u8(b64), out = new Uint8Array(len);
    let o = 0;
    for (let i = 0; i < a.length; i += 2) { out.fill(a[i + 1], o, o + a[i]); o += a[i]; }
    return out;
  }
  function sendWorld(to) {
    const w = {
      seed: S.seed, w: W, h: H, sh: (typeof STRATA_H !== 'undefined' && STRATA_H !== H) ? STRATA_H : undefined, tiles: rle(S.tiles), hp: rle(S.hp), n: S.tiles.length,
      surface: Array.from(S.surface), surfAvg: S.surfAvg,
      queen: S.queenRoom, worm: S.wormRoom, sow: S.sowRoom, lith: S.lithRoom, veil: S.veilRoom,
      shop: S.shop, bench: S.bench, bossesKilled: S.bossesKilled, lairsFound: S.lairsFound || {}, magmaUnlocked: S.magmaUnlocked,
      contentV: CONTENT_V, worldId: S.worldId, ropes: S.ropes.map(r => ({ x: r.x, y: r.y, len: r.len })),
      base: S.base || null, houses: S.houses || null, worldTier: S.worldTier || 1, vaults: S.vaults || [], pvaults: typeof pvWorldOut === 'function' ? pvWorldOut() : [], lootTotal: S.lootTotal || 0, restP: Array.isArray(S.restP) ? S.restP.slice(0, 600) : [], undV: S.undV === 1 ? 1 : 0, dlakes: typeof dlkClean === 'function' ? dlkClean(S.dlakes) : [], dlakesV: S.dlakesV === 1 ? 1 : 0, npc2612: (S.npc2612 && Array.isArray(S.npc2612.list)) ? { v: 1, list: S.npc2612.list.slice(0, 8).map(q => ({ id: q.id, x: q.x | 0, y: q.y | 0 })) } : null /* v0.26.12: stranded-miner camps (joiners re-check them with npcClean) */ /* art24d big world: same seed, tier and vaults as the host; art24d: stashes are private; houses are shared */
    };
    const str = JSON.stringify(w), CH = 60000, n = Math.ceil(str.length / CH);
    for (let i = 0; i < n; i++) sendTo(to, { t: 'wpart', n, i, d: str.slice(i * CH, (i + 1) * CH) });
  }
  NET.targets = function () {
    const out = [];
    if (!S.p.dead) out.push(S.p);
    for (const pe of NET.peers.values()) {
      if (pe.s && !pe.s[9] && nowMs() - pe.last < 5000) out.push({ x: pe.s[0], y: pe.s[1], w: 10, h: 14 });
    }
    if (!out.length) out.push(S.p);
    return out;
  };

  /* ---- client side ---- */
  function clientMsg(m) {
    switch (m.t) {
      case 'wpart': {
        if (!NET.parts || NET.parts.n !== m.n) NET.parts = { n: m.n, got: 0, d: [] };
        if (NET.parts.d[m.i] == null) { NET.parts.d[m.i] = m.d; NET.parts.got++; }
        if (NET.parts.got === NET.parts.n) { const s = NET.parts.d.join(''); NET.parts = null; let w = null; try { w = JSON.parse(s); } catch (e) {} if (!w || typeof w !== 'object' || Array.isArray(w)) return secDrop('bad world'); buildWorld(w); }
        return;
      }
      case 'ro': return gotRoster(m.l);
      case 'p': return gotPeerState(m);
      case 'chat': return gotChat(m);
      case 'hostleft': if (NET.awayOk && NET.awayOk()) return NET.hostAway(); return hostGone('Host left');   /* v0.26.11: resume */
      case 'bye': NET.hostBack = m.back ? 1 : 0; return;
    }
    if (!NET.built) return;
    switch (m.t) {
      case 'tl': {
        const d = m.d;
        for (let i = 0; i < d.length; i += 3) {
          const was = tget(d[i], d[i + 1]);
          if (CHEST.has(was) && d[i + 2] === T.AIR && !NET.pend.has(d[i + 1] * W + d[i])) startChestFx(d[i], d[i + 1], was, false);
          _tset(d[i], d[i + 1], d[i + 2]);
          NET.pend.delete(d[i + 1] * W + d[i]);
        }
        return;
      }
      case 'brkOk': {
        NET.pend.delete(m.y * W + m.x);
        NET.applying++;
        try { _tset(m.x, m.y, m.v); _breakTile(m.x, m.y); }
        finally { NET.applying--; _tset(m.x, m.y, T.AIR); }
        return;
      }
      case 'brkNo': case 'tfix':
        NET.pend.delete(m.y * W + m.x);
        _tset(m.x, m.y, m.v);
        return;
      case 'pzs': if (typeof pvNetState === 'function') pvNetState(m); return; /* v0.25.3: puzzle vault state from the host */
      case 'vs': if (typeof vaultNet === 'function') vaultNet(m); return; /* art24d: vault puzzle progress (host solves) */
      case 'rv': if (m.o !== NET.id && typeof rivetFromNet === 'function') rivetFromNet(m, false); return;
      case 'st': return gotState(m);
      case 'sx': return; /* art24d: stashes are private - a host's stash never overwrites yours */
      case 'hs': if (Array.isArray(m.h)) { S.houses = m.h; S.housesOn = m.on || []; } return;
      case 'supok': {
        NET._supT = 0;
        S.p.gold = Math.max(0, S.p.gold - (m.pr | 0));
        floatTxt(S.p.x, S.p.y, '+10 stash', '#e6c34a');
        toast('Stash upgraded', (m.cap | 0) + ' slots at home' + ((m.cap | 0) < STASH_MAX ? '' : '  (max)'), '#e6c34a', 'ui');
        try { savePlayer(); } catch (e) {}
        return;
      }
      case 'supno':
        NET._supT = 0;
        floatTxt(S.p.x, S.p.y, (m.cap | 0) >= STASH_MAX ? 'stash max' : 'price changed, try again', '#c07070');
        return;
      case 'sback': case 'sgot': {
        if (!itemOk(m.id)) return;
        let n = Math.max(0, m.n | 0);
        while (n > 0 && invFits(S.inv, m.id, 1)) { addToInv(m.id, 1); n--; }
        if (n > 0) _give(S.p.x, S.p.y, m.id, n);
        if (m.t === 'sgot') sfx('pickup');
        else floatTxt(S.p.x, S.p.y - 8, 'stash full', '#c07070', { sz: 6 });
        return;
      }
      case 'pop': return gotPop(m);
      case 'lair': if (typeof lairFound === 'function') lairFound(m.k, true); return; /* v0.25.2: a friend found a boss lair */
      case 'arm': {
        const e = S.enemies.find(q => q.id === m.id);
        if (e) { e.swell = 0; e._pred = 0; floatTxt(e.x, e.y, 'ARMOR', '#e8d080'); burst(e.x + 8, e.y + 8, '#e8d080', 10, 40); }
        return;
      }
      case 'charok': applyCharOk(m); return;   /* v0.26.9 */
      case 'rw': {
        for (const k of (m.pops || []).filter(k => typeof k === 'string' && k.length <= 16)) {
          if (S.stats) S.stats.pops = (S.stats.pops || 0) + 1;
          tutFlag('pump');
          bountyOnPop({ kind: k, boss: ['queen', 'gateworm', 'sow', 'lithant', 'veil'].includes(k) });
        }
        if (m.xp) addXp(m.xp);
        if (m.gold) addGold(m.gold);
        for (const [id, n] of m.items || []) give(S.p.x, S.p.y - 8, id, n);
        return;
      }
      case 'got': {
        S.pickups = S.pickups.filter(u => u.nid !== m.i);
        if (m.k === 'coin') addGold(m.n, m.x, m.y);
        else if (!addToInv(m.id, m.n)) S.pickups.push({ kind: 'item', id: m.id, n: m.n, x: S.p.x, y: S.p.y - 6, vy: -20, life: 40 });
        else spawnFlyer(m.x, m.y, m.id);
        sfx('coin');
        return;
      }
      case 'rp': {
        const local = S.ropes.filter(r => !r._s);
        S.ropes = m.r.map(r => ({ x: r.x, y: r.y, len: r.len, _s: 1 })).concat(local);
        return;
      }
    }
  }
  function freshBlob() {
    const inv = emptyInv(10).concat(emptyInv(30));
    inv[0] = { id: 'mite_lunch', n: 2 }; inv[1] = { id: 'well_water', n: 2 }; inv[2] = { id: 'flask', n: 1 };
    inv[3] = { id: 'cave_morel', n: 1 }; inv[4] = { id: 'canteen_tea', n: 1 };
    const p = newPlayer(0, 0);
    if (S.p && S.p.look && typeof fixLook === 'function') p.look = fixLook(S.p.look);   // keep the miner picked on this PC
    return {
      p, skills: {}, inv, packSize: 40,
      equip: { hose: 'hose_mk1', helm: null, boots: null, back: null, charm: null, pick: null, body: null },
      packBought: 0, relics: {}, bounties: null, stats: null, goals: null, tut: null, craft: null,
      stash: new Array(30).fill(null), stashSize: 30, mail: null
    };
  }
  const PLAYER_KEYS = ['p', 'inv', 'skills', 'equip', 'packSize', 'packBought', 'relics', 'bounties', 'stats', 'goals', 'tut', 'craft', 'stash', 'stashSize', 'mail', 'gold', 'xp'];
  /* ---------------------------------------------------------------- v0.26.9: bring your own miner
     Joining a friend's world now brings YOUR miner from your own save: level, XP, gold, skills, prestige,
     inventory + hotbar, gear, bag size, both storage chests and your house upgrade.
     - Your own save is backed up (burrow_save_v2_prejoin) before every join and is never written while you
       are in someone else's world (saveGame only writes the travel copy, burrow_carry_v1).
     - When you load your own world again (Leave, quit, crash, next launch) the travel copy is merged back
       into it once, then removed. A travel copy older than your own save is never applied (kept as _stale).
     - Everything imported is cleaned and clamped (clampChar) on your side, and the host checks the summary
       ('char') and answers with the clamped numbers ('charok') that your game then uses.
     - Storage chests stay private: they open only on your side, inside your house in the host's world.
       Your house upgrade shows on your house there and gives you Storage 2, exactly as at home. */
  const CARRY_KEY = 'burrow_carry_v1', PREJOIN_KEY = SAVE_KEY + '_prejoin';
  const P_SKIP = new Set(['x', 'y', 'vx', 'vy', 'dead', 'dig', 'pumpTgt', 'pumping', 'grounded', 'iFrames', 'anim', 'shake', 'wobble',
    'inWater', 'chargeCd', 'climb', 'onLadder', 'deadT', 'respawnT', 'digSwing', 'hurtT']);
  const CAP = { level: () => (typeof LEVEL_CAP === 'number' ? LEVEL_CAP : 50), gold: 9999999, prestige: 10, sp: 300, hpBase: 40, pack: () => (typeof PACK_MAX === 'number' ? PACK_MAX : 80), packBought: 8,
    stash: () => (typeof STASH_MAX === 'number' ? STASH_MAX : 120), blob: 60000 };
  const jsonSize = v => { try { return JSON.stringify(v).length; } catch (e) { return 1e9; } };
  function cleanSlot(s) {
    if (!s || typeof s !== 'object' || !itemOk(s.id)) return null;
    const st = (ITEMS[s.id] && ITEMS[s.id].stack) || 99;
    const o = {}; for (const k in s) { const v = s[k]; if (typeof v === 'number' ? isFinite(v) : (typeof v === 'string' ? v.length <= 40 : typeof v === 'boolean')) o[k] = v; }
    o.id = s.id; o.n = clampInt(s.n == null ? 1 : s.n, 1, Math.max(1, st));
    return o;
  }
  const cleanSlots = (a, len) => { const o = []; for (let i = 0; i < len; i++) o.push(Array.isArray(a) ? cleanSlot(a[i]) : null); return o; };
  function skillOk(id) { return typeof SKILL_DEFS !== 'undefined' && SKILL_DEFS.some(s => s.id === id); }
  /* shared by the joiner (on import) and the host (on the 'char' summary): the sane limits */
  function clampNums(c) {
    const L = clampInt(c.level, 1, CAP.level());
    let need = 1e6; try { need = Math.max(1, xpNeed(L)); } catch (e) {}
    const sk = {}; if (c.skills && typeof c.skills === 'object') for (const k in c.skills) if (skillOk(k)) { const r = clampInt(c.skills[k], 0, 3); if (r) sk[k] = r; }
    return { level: L, xp: L >= CAP.level() ? clampInt(c.xp, 0, need) : clampInt(c.xp, 0, need - 1), gold: clampInt(c.gold, 0, CAP.gold), prestige: clampInt(c.prestige, 0, CAP.prestige),
      sp: clampInt(c.sp, 0, CAP.sp), hpBase: clampInt(c.hpBase == null ? 6 : c.hpBase, 1, CAP.hpBase), skills: sk, pack: clampInt(c.pack == null ? 40 : c.pack, 40, CAP.pack()),
      packBought: clampInt(c.packBought, 0, CAP.packBought), stashSize: clampInt(c.stashSize == null ? 30 : c.stashSize, 30, CAP.stash()), houseUp: !!c.houseUp, houseUp2: !!c.houseUp && !!c.houseUp2 };
  }
  NET.clampNums = clampNums;
  /* a character (from a save or the travel copy) -> a clean character */
  function clampChar(ch) {
    if (!ch || typeof ch !== 'object' || !ch.p || typeof ch.p !== 'object') return null;
    const p = {}; for (const k in ch.p) if (!P_SKIP.has(k)) p[k] = ch.p[k];
    if (jsonSize(p) > CAP.blob) for (const k of Object.keys(p)) if (p[k] && typeof p[k] === 'object' && k !== 'look') delete p[k];
    const n = clampNums({ level: p.level, xp: p.xp, gold: p.gold, prestige: p.prestige, sp: p.sp, hpBase: p.maxHpBase, skills: ch.skills, pack: ch.packSize,
      packBought: ch.packBought, stashSize: ch.stashSize, houseUp: ch.houseUp, houseUp2: ch.houseUp2 });
    p.level = n.level; p.xp = n.xp; p.gold = n.gold; p.prestige = n.prestige; p.sp = n.sp; p.maxHpBase = n.hpBase;
    p.hp = isNum(p.hp) ? Math.max(1, Math.min(n.hpBase + 10, p.hp)) : n.hpBase;
    for (const k of ['hunger', 'thirst']) if (p[k] != null) p[k] = Math.max(0, Math.min(100, +p[k] || 0));
    const eq = {}; if (ch.equip && typeof ch.equip === 'object') for (const k of ['hose', 'helm', 'boots', 'back', 'charm', 'pick', 'body']) eq[k] = itemOk(ch.equip[k]) ? ch.equip[k] : null;
    if (!eq.hose) eq.hose = 'hose_mk1';
    const rel = {}; if (ch.relics && typeof ch.relics === 'object') for (const k in ch.relics) if (k.length <= 40 && Object.keys(rel).length < 200) rel[k] = typeof ch.relics[k] === 'number' ? clampInt(ch.relics[k], 0, 999) : !!ch.relics[k];
    const obj = v => v && typeof v === 'object' && jsonSize(v) <= CAP.blob ? v : null;
    /* v0.26.9: Storage 2 keeps its own size (30 = level 1); an old copy without stash2v shrinks to the slots that hold items */
    const s2raw = Array.isArray(ch.stash2) ? ch.stash2.slice(0, CAP.stash()) : [];
    const s2 = ch.stash2v === 2 || typeof stash2Trim !== 'function' ? s2raw : stash2Trim(s2raw);
    const s3 = Array.isArray(ch.stash3) ? ch.stash3.slice(0, CAP.stash()) : [];   /* v0.26.26: Storage 3 */
    return {
      p, skills: n.skills, inv: cleanSlots(ch.inv, 10 + n.pack), packSize: n.pack, packBought: n.packBought, equip: eq, relics: rel,
      craft: obj(ch.craft), stats: obj(ch.stats), tut: obj(ch.tut), stash: cleanSlots(ch.stash, Math.min(CAP.stash(), Math.max(n.stashSize, Array.isArray(ch.stash) ? ch.stash.length : 0))),
      stashSize: n.stashSize, houseUp: n.houseUp, stash2: n.houseUp ? cleanSlots(s2, Math.min(CAP.stash(), Math.max(30, Math.ceil(s2.length / 10) * 10))) : null, stash2v: n.houseUp ? 2 : undefined,
      houseUp2: n.houseUp2, stash3: n.houseUp2 ? cleanSlots(s3, Math.min(CAP.stash(), Math.max(30, Math.ceil(s3.length / 10) * 10))) : null, stash3v: n.houseUp2 ? 1 : undefined
    };
  }
  NET.clampChar = clampChar;
  /* your miner as it is right now (also works for a save object d) */
  function charOf(src) {
    const pr = src === S && typeof stashPair === 'function' ? stashPair() : [src.stash, src.stash2];
    return { p: Object.assign({}, src.p, { pumpTgt: null, dig: null }), skills: src.skills, inv: src.inv, packSize: src.packSize, packBought: src.packBought, equip: src.equip,
      relics: src.relics, craft: src.craft, stats: src.stats, tut: src.tut ? { step: src.tut.step, done: !!src.tut.done, flags: src.tut.flags } : null,
      stash: pr[0], stashSize: src.stashSize, houseUp: !!src.houseUp, stash2: pr[1], stash2v: src === S ? 2 : src.stash2v,
      houseUp2: !!(src.houseUp && src.houseUp2), stash3: src === S && typeof stash3Cur === 'function' ? stash3Cur() : src.stash3 };
  }
  function readCarry() { try { const c = JSON.parse(localStorage.getItem(CARRY_KEY) || 'null'); return c && c.v === 1 && c.home && c.ch ? c : null; } catch (e) { return null; } }
  /* called when the relay says we are joining: own world -> backup + the miner we take along */
  function homeSnapshot() {
    if (NET.mpWorld || NET.home) return;
    let raw = null, d = null;
    try { raw = localStorage.getItem(SAVE_KEY); d = raw && JSON.parse(raw); if (!validSaveData(d)) d = null; } catch (e) { d = null; }
    /* the game on screen is your own saved world (or you have no save at all; a broken one is never overwritten): save it first so the newest progress comes along */
    if (S && S.p && S.tiles && (!raw || (d && SAVE_INFO.bootLoaded && S.seed === d.seed))) {
      try { if (saveGame()) { raw = LAST_SAVE_JSON; d = JSON.parse(raw); } } catch (e) {}
    }
    if (!d) return;
    try { localStorage.setItem(PREJOIN_KEY, raw); }
    catch (err) { try { localStorage.removeItem(SAVE_KEY + '_old'); localStorage.setItem(PREJOIN_KEY, raw); } catch (err2) { console.warn('pre-join backup did not fit', err2); } }
    NET.home = { seed: d.seed, worldId: d.worldId || null, savedAt: d.savedAt || 0 };
    /* a travel copy that never made it home yet (joined twice in a row): it is newer, take that one */
    const c = readCarry();
    const sameHome = c && c.home.seed === d.seed && (c.home.worldId || null) === (d.worldId || null) && (c.at || 0) > (d.savedAt || 0);
    NET.carry = clampChar(sameHome ? c.ch : charOf(d));
  }
  NET.homeSnapshot = homeSnapshot;
  function writeCarry() {
    if (!NET.home || !NET.mpWorld || !S || !S.p) return;
    try { localStorage.setItem(CARRY_KEY, JSON.stringify({ v: 1, home: NET.home, at: Date.now(), host: NET.hostName || '', ch: charOf(S) })); }
    catch (err) { console.warn('travel copy did not fit', err); }
  }
  /* back home: merge the travel copy into your own world once */
  function carryHome(d) {
    const c = readCarry(); if (!c || !S || !S.p) return;
    if (c.home.seed !== d.seed || (c.home.worldId || null) !== (d.worldId || null)) return;     /* another world's miner: leave it for that one */
    if ((d.savedAt || 0) > (c.at || 0)) { try { localStorage.setItem(CARRY_KEY + '_stale', JSON.stringify(c)); localStorage.removeItem(CARRY_KEY); } catch (e) {} return; }
    const ch = clampChar(c.ch); if (!ch) return;
    const keep = { x: S.p.x, y: S.p.y };
    if (S._st2On && typeof stash2Close === 'function') stash2Close();
    if (S._st3On && typeof stash3Close === 'function') stash3Close();
    S.p = Object.assign(S.p, ch.p, keep, { dead: false, vx: 0, vy: 0 });
    Object.assign(S, { skills: ch.skills, inv: ch.inv, packSize: ch.packSize, packBought: ch.packBought, equip: ch.equip, relics: ch.relics, stash: ch.stash, stashSize: ch.stashSize });
    if (ch.craft) S.craft = ch.craft; if (ch.stats) S.stats = ch.stats;
    if (ch.houseUp) { S.houseUp = true; S.stash2 = ch.stash2 || []; try { const me = myHouse(); if (me) me.up = 1; } catch (e) {} } 
    if (ch.houseUp2) { S.houseUp2 = true; S.stash3 = ch.stash3 || []; try { const me = myHouse(); if (me) me.up = 2; } catch (e) {} }
    try { stashFit(); if (S.houseUp) stash2Fit(); if (S.houseUp2 && typeof stash3Fit === 'function') stash3Fit(); } catch (e) {}
    NET._carriedHome = { host: c.host, at: c.at };
    setTimeout(() => {
      try { if (!NET.mpWorld && saveGame()) { localStorage.removeItem(CARRY_KEY); toast('Back home', 'your miner brought everything from ' + (c.host ? possessive(c.host) + ' world' : 'co-op'), '#80e080', 'ui'); } } catch (e) { console.warn(e); }
    }, 0);
  }
  NET.carryHome = carryHome;
  const _ldCarry = loadGameData;
  loadGameData = function (d, net) {
    /* v0.26.9: a slot named after a built-in (constructor, __proto__...) used to stop a hand-edited save from loading; drop just those */
    const proto = sl => sl && typeof sl === 'object' && typeof sl.id === 'string' && !own(ITEMS, sl.id) && (sl.id in ITEMS);
    if (d && typeof d === 'object') for (const k of ['inv', 'stash', 'stash2', 'stash3']) if (Array.isArray(d[k])) d[k] = d[k].map(sl => proto(sl) ? null : sl);
    const ok = _ldCarry.apply(this, arguments);
    if (ok && !net && d) { try { carryHome(d); } catch (err) { console.warn('could not bring your miner home', err); } }
    return ok;
  };
  /* the host's view: a friend's miner summary, clamped (the friend's game then uses these numbers) */
  function charSummary() {
    const p = S.p;
    return { t: 'char', level: p.level | 0, xp: p.xp | 0, gold: p.gold | 0, prestige: p.prestige | 0, sp: p.sp | 0, hpBase: p.maxHpBase | 0, skills: S.skills || {},
      pack: S.packSize | 0, packBought: S.packBought | 0, stashSize: S.stashSize | 0, houseUp: !!S.houseUp, houseUp2: !!(S.houseUp && S.houseUp2), n: 1 + rnd(1e9) };
  }
  function applyCharOk(m) {
    const sent = NET._charSent; if (!sent || !S || !S.p || !isInt(m.n) || m.n !== sent.n) return;   /* only the answer to the summary we sent */
    const p = S.p; let fixed = 0;
    /* only what the host had to trim changes; anything you earned since the summary stays */
    const fix = (o, k, sk, v) => { if (sent[sk] !== v) { o[k] = v; fixed++; } };
    fix(p, 'level', 'level', m.level); fix(p, 'xp', 'xp', m.xp); fix(p, 'gold', 'gold', m.gold); fix(p, 'prestige', 'prestige', m.prestige);
    fix(p, 'sp', 'sp', m.sp); fix(p, 'maxHpBase', 'hpBase', m.hpBase);
    const ss = sent.skills || {}; for (const k of new Set([...Object.keys(ss), ...Object.keys(m.skills || {})])) if ((ss[k] | 0) !== (m.skills[k] | 0)) { if (m.skills[k]) S.skills[k] = m.skills[k]; else delete S.skills[k]; fixed++; }
    if (sent.pack !== m.pack) { S.packSize = m.pack; S.inv = cleanSlots(S.inv, 10 + m.pack); fixed++; }
    fix(S, 'packBought', 'packBought', m.packBought);
    if (sent.houseUp && !m.houseUp) { S.houseUp = false; fixed++; }
    if (sent.houseUp2 && !m.houseUp2) { S.houseUp2 = false; fixed++; }
    NET.charOk = m; NET.charFixed = fixed;
    if (fixed) toast('Miner checked', 'the host trimmed values that were out of range', '#e0c060', 'ui');
  }
  function buildWorld(w) {
    w = Object.assign({}, w);
    for (const k of PLAYER_KEYS) delete w[k];      /* v0.26.8: the host sends the world, never your miner or bag */
    for (const k of ['houseUp', 'stash2', 'stash2v', 'houseUp2', 'stash3', 'stash3v', 'playerName', 'fog']) delete w[k];   /* v0.26.9: nor the host's house upgrade, Storage 2 or map */
    if (typeof w.worldId !== 'string' || !/^[\w-]{1,40}$/.test(w.worldId) || w.worldId === 'key') w.worldId = 'w_host';
    let blob = null;
    try { blob = JSON.parse(localStorage.getItem(MP_KEY + w.worldId) || 'null'); } catch (err) {}
    const fresh = !blob || !blob.p || !Array.isArray(blob.inv);
    if (fresh) blob = freshBlob();
    /* v0.26.9: your own miner comes along; this world only keeps where you were, what you explored, its goals and mail */
    const carried = !!NET.carry;
    if (carried) {
      const ch = NET.carry, at = blob.p || {};
      blob = Object.assign({}, blob, ch, { p: Object.assign({}, ch.p, { x: at.x || 0, y: at.y || 0 }), tut: blob.tut || ch.tut, goals: blob.goals || null, bounties: blob.bounties || null, mail: blob.mail || null });
      if (!ch.houseUp) { blob.houseUp = undefined; blob.stash2 = undefined; blob.stash2v = undefined; }
      if (!ch.houseUp2) { blob.houseUp2 = undefined; blob.stash3 = undefined; blob.stash3v = undefined; }
    }
    const tiles = unrle(w.tiles, w.n), hp = unrle(w.hp, w.n);
    const d = Object.assign({}, blob, w, { tiles: u8b64(tiles), hp: u8b64(hp), enemies: [], coinPiles: [], time: 0 });
    NET.quiet++;
    try {
      if (!loadGameData(d, true)) throw new Error('could not build the host world');
      S.worldId = w.worldId;
      S.p.dead = false; S.p.hp = Math.max(S.p.hp, 1);
      snapToSwardGrass();
      S.p.iFrames = 2.5;
      S.ropes = (w.ropes || []).map(r => ({ x: r.x, y: r.y, len: r.len, _s: 1 }));
      S.paused = false;
    } finally { NET.quiet--; }
    NET.built = true; NET.mpWorld = true; NET.retry = 0;
    try { NET.recentAdd(); } catch (err) { console.warn('recent games', err); }   /* v0.26.9 */
    NET._rejoin = null;
    NET.pend.clear();
    setStatus('Playing in ' + NET.hostName + "'s world.", '#80e080');
    toast("Joined " + NET.hostName + "'s world", carried ? 'you brought your miner - progress goes home with you' : fresh ? 'fresh miner - your progress saves on this computer' : 'welcome back - your miner was saved here', '#80e080', 'ui');
    savePlayer();
    if (carried) { try { NET._charSent = charSummary(); send(Object.assign({}, NET._charSent, { skills: Object.assign({}, NET._charSent.skills) })); if (S.houseUp) { send({ t: 'hup' }); S._hupSent = performance.now(); } if (S.houseUp2) { send({ t: 'hup', lv: 2 }); S._hup2Sent = performance.now(); } } catch (err) {} }
  }
  function gotRoster(l) {
    const seen = new Set();
    for (const [id, name, col] of l) {
      seen.add(id);
      if (id === NET.id) { NET.myCol = col; continue; }
      let p = NET.peers.get(id);
      if (!p) {
        p = { id, name, col, s: null, buf: [], last: nowMs() };
        NET.peers.set(id, p);
        if (NET.rosterSeen) toast(name + ' joined', '', col, 'ui');
      }
      p.name = name; p.col = col;
    }
    for (const [id, p] of NET.peers) if (!seen.has(id)) { NET.peers.delete(id); toast(p.name + ' left', '', '#c8b89a', 'ui'); }
    NET.rosterSeen = true;
  }
  function gotState(m) {
    const t = nowMs();
    if (m.dc != null && typeof dnSyncFrom === 'function') { try { dnSyncFrom(m.dc); } catch (e) {} }
    const byId = new Map();
    for (const e of S.enemies) if (e.id) byId.set(e.id, e);
    const live = new Set();
    for (const a of m.e) {
      const [id, kind, x, y, face, swell, awake, armor, pumps, pin] = a;
      live.add(id);
      let e = byId.get(id);
      if (!e) {
        e = makeEnemy(kind, x, y); e.id = id; e._b = [];
        if (a[10] && typeof evApply === 'function') { try { evApply(e, a[10]); } catch (er) {} }   /* v0.26.23 */
        S.enemies.push(e);
      }
      if (e.dead) continue;
      e._b.push([t, x, y]); if (e._b.length > 6) e._b.shift();
      e.face = face; e.awake = !!awake; e.armor = armor; e.pumps = pumps; e._pinV = !!pin;
      e.swell = (e._pred > 0) ? Math.max(swell, e.swell) : swell;
    }
    for (const e of S.enemies) if (!e.dead && e.id && !live.has(e.id)) { e.dead = true; e.squash = 1; }
    const fb = new Map(S.falling.map(f => [f.id, f]));
    S.falling = m.f.map(([id, x, y, vy, by, wob, gy]) => { const f = fb.get(id) || { id }; f.x = x; f.y = y; f.vy = vy; f.by = by === NET.name ? 'you' : (by || ''); f.wob = +wob || 0; f.gy = gy || 0; f._fr = 1; return f; });
    const pb = new Map(); const local = [];
    for (const u of S.pickups) { if (u.nid) pb.set(u.nid, u); else local.push(u); }
    S.pickups = local.concat(m.k.map(([nid, k, id, n, x, y]) => {
      const u = pb.get(nid) || { nid, spark: Math.random(), vy: 0, life: 99 };
      u.kind = k === 'c' ? 'coin' : 'item'; u.id = id || null; u.n = n; u.x = x; u.y = y;
      return u;
    }));
  }
  function gotPop(m) {
    const e = S.enemies.find(q => q.id === m.id);
    const mine = m.by === NET.id;
    if (e && !e.dead) {
      e.dead = true; e.popped = true; e.swell = 1; e.squash = 1;
      if (!S.fxMarks) S.fxMarks = [];
      S.fxMarks.push({ kind: 'popburst', x: e.x + e.w / 2, y: e.y + e.h / 2, r: Math.max(e.w, e.h) * (e.boss ? 1.1 : 0.9), col: POP_COL[e.kind] || '#e8c0a0', t: 0.32, tmax: 0.32, seed: (Math.random() * 100) | 0 });
      if (e.boss) fxBossKill(e); else fxPop(e);
    }
    if (mine) {
      S.hitStop = Math.max(S.hitStop || 0, e && e.boss ? 0.14 : 0.06);
      S.p.shake = Math.max(S.p.shake, 0.12);
      S.flash = Math.max(S.flash || 0, SETTINGS.reduceFlash ? 0.12 : 0.28);
    }
    if (mine || dist(S.p.x, S.p.y, m.x, m.y) < TILE * 16) sfx('pop');
    if (['queen', 'gateworm', 'sow', 'lithant', 'veil'].includes(m.kind)) {
      S.bossesKilled[m.kind] = 1;
      if (m.kind === 'gateworm' && S.goals && !S.goals.won) S.winPending = 1.4;
      if (!mine) toast(bossTitle(m.kind) + ' popped!', 'by ' + nameOf(m.by), '#ffcc40');
    }
  }
  function nameOf(id) { if (id === NET.id) return NET.name; const p = NET.peers.get(id); return p ? p.name : 'a friend'; }

  /* ---- both ---- */
  function gotPeerState(m) {
    let p = NET.peers.get(m.from);
    if (!p && (NET.role === 'host' || NET.peers.size >= 8)) return;
    if (!p) { p = { id: m.from, name: '?', col: '#ccc', s: null, buf: [], last: 0 }; NET.peers.set(m.from, p); }
    p.s = m.s; p.last = nowMs();
    /* art24c: a big jump (Joint of Return / Bong of Destiny, respawn) snaps instead of sliding across the map */
    const lb = p.buf[p.buf.length - 1]; if (lb && Math.abs(lb[1] - m.s[0]) + Math.abs(lb[2] - m.s[1]) > TILE * 8) p.buf.length = 0;
    /* v0.26.11: place each sample by the sender's own clock (evenly spaced) instead of when it happened to arrive,
       so Wi-Fi bunching no longer makes friends hitch. Older builds send no ts and keep the arrival time. */
    let st = p.last;
    if (typeof m.ts === 'number' && isFinite(m.ts)) {
      const d = p.last - m.ts;
      p.tOff = p.tOff == null || d < p.tOff || Math.abs(d - p.tOff) > 1000 ? d : p.tOff + 0.25;
      st = m.ts + p.tOff;
    }
    const lb2 = p.buf[p.buf.length - 1]; if (lb2 && st <= lb2[0]) st = lb2[0] + 1;
    p.buf.push([st, m.s[0], m.s[1]]); if (p.buf.length > 8) p.buf.shift();
  }
  function gotChat(m) {
    const p = NET.peers.get(m.from);
    addChat(p ? p.name : '?', p ? p.col : '#ccc', m.m);
  }
  function addChat(name, col, msg) {
    NET.chat.push({ name, col, msg: String(msg).slice(0, 80), t: 8 });
    if (NET.chat.length > 5) NET.chat.shift();
    sfx('ui');
  }
  function interp(buf, rt) {
    if (!buf.length) return null;
    if (rt <= buf[0][0]) return buf[0];
    for (let i = buf.length - 1; i > 0; i--) {
      const a = buf[i - 1], b = buf[i];
      if (rt >= a[0] && rt <= b[0]) { const k = (rt - a[0]) / Math.max(1, b[0] - a[0]); return [rt, a[1] + (b[1] - a[1]) * k, a[2] + (b[2] - a[2]) * k]; }
    }
    return buf[buf.length - 1];
  }
  function myState() {
    const p = S.p;
    const tx = Math.floor((p.x + 5) / TILE), ty = Math.floor((p.y + 7) / TILE);
    return [Math.round(p.x * 10) / 10, Math.round(p.y * 10) / 10, p.vx | 0, p.vy | 0, p.face, minerPose(p), Math.round((p.anim || 0) * 100) / 100,
      p.pumping ? 1 : 0, Math.round((p.digSwing || 0) * 100) / 100, p.dead ? 1 : 0, Math.max(0, ty - localSurf(tx)), p.phantomT > 0 ? 1 : 0,
      lookStr(p.look, S.equip), p.pumping && p.pumpTgt && p.pumpTgt.id ? p.pumpTgt.id : 0].concat(typeof fishNetState === 'function' ? fishNetState() : [0, 0, 0]) /* v0.26.9: [14..16] fishing line */
      .slice(0, 17).concat([(p._sprinting ? 1 : 0) | (typeof minerAir === 'function' && minerAir(p) ? 2 : 0)]); /* v0.26.11: [17] gait flags 1 sprint, 2 airborne */
  }
  function savePlayer() {
    if (!S || !S.worldId || !S.p) return;
    try {
      const p = Object.assign({}, S.p, { pumpTgt: null, dig: null });
      localStorage.setItem(MP_KEY + S.worldId, JSON.stringify({
        p, skills: S.skills, inv: S.inv, packSize: S.packSize, equip: S.equip, packBought: S.packBought,
        relics: S.relics || {}, bounties: S.bounties || null, stats: S.stats || null,
        goals: S.goals ? { done: S.goals.done, won: !!S.goals.won } : null,
        tut: S.tut ? { step: S.tut.step, done: !!S.tut.done, flags: S.tut.flags } : null, craft: S.craft || null,
        fog: typeof fogPack === 'function' ? fogPack() : undefined,
        stash: (typeof stashPair === 'function' ? stashPair()[0] : S.stash) || null, stashSize: S.stashSize || 30, mail: S.mail || null, playerName: S.playerName || NET.name,
        houseUp: S.houseUp ? true : undefined, stash2: S.houseUp && typeof stashPair === 'function' ? stashPair()[1] || [] : undefined /* v0.26.5 */,
        stash2v: S.houseUp ? 2 : undefined /* v0.26.9: Storage 2 has its own size */,
        houseUp2: S.houseUp && S.houseUp2 ? true : undefined, stash3: S.houseUp && S.houseUp2 && typeof stash3Cur === 'function' ? stash3Cur() || [] : undefined /* v0.26.26 */
      }));
      persistSettings();
    } catch (err) { console.warn('mp save failed', err); }
    writeCarry();
  }

  /* ---------------------------------------------------------------- wrappers */
  const _tset = tset;
  tset = function (x, y, v) {
    if (cl() && !NET.quiet && !NET.applying) {
      if (x < 0 || y < 0 || x >= W || y >= H) return;
      const old = tget(x, y);
      _tset(x, y, v);
      if (old !== v) send({ t: 'tile', x, y, f: old, v });
      return;
    }
    _tset(x, y, v);
    if (NET.role === 'host' && !NET.quiet && x >= 0 && y >= 0 && x < W && y < H) NET.dirty.set(y * W + x, v);
  };
  const _breakTile = breakTile;
  breakTile = function (tx, ty) {
    if (!cl() || NET.applying) return _breakTile(tx, ty);
    if (isProtected(tx, ty)) return;
    const t = tget(tx, ty);
    if (t === T.AIR || t === T.BEDROCK) return;
    if (t === T.CHEST_L && countItem('grub_key') < 1) return _breakTile(tx, ty);
    const k = ty * W + tx;
    if (NET.pend.has(k)) return;
    NET.pend.set(k, nowMs());
    _tset(tx, ty, T.AIR);
    send({ t: 'brk', x: tx, y: ty, v: t });
  };
  const _onRemoved = onRemoved;
  onRemoved = function (tx, ty) { if (cl()) return; return _onRemoved(tx, ty); };

  const _addXp = addXp, _addGold = addGold, _give = give, _bountyOnPop = bountyOnPop;
  addXp = function (n) { if (NET.award) { NET.award.xp += n | 0; return; } return _addXp(n); };
  addGold = function (n, x, y) { if (NET.award) { NET.award.gold += n; return; } return _addGold(n, x, y); };
  give = function (x, y, id, n) { if (NET.award) { NET.award.items.push([id, n || 1]); return true; } return _give(x, y, id, n); };
  bountyOnPop = function (e) { if (NET.award) { NET.award.pops.push(e.kind); return; } return _bountyOnPop(e); };

  const _popEnemy = popEnemy;
  popEnemy = function (e) {
    if (cl()) {
      if (!e._popReq && e.id) { e._popReq = 1; send({ t: 'pump', id: e.id, pop: 1, ov: myOverfill() }); }
      return;
    }
    if (NET.role === 'host' && !e.id) e.id = NET.seq++;
    const by = NET.award ? NET.award.pid : NET.id;
    _popEnemy(e);
    if (NET.role === 'host') send({ t: 'pop', id: e.id, x: e.x | 0, y: e.y | 0, kind: e.kind, by });
  };
  function myOverfill() { return skill('overfill') + (mods().overfillLite ? 1 : 0); }

  const _tryPump = tryPump;
  tryPump = function (dt, m) {
    if (!cl()) return _tryPump(dt, m);
    const p = S.p;
    let best = null, bestD = 1e9;
    const range = pumpRange(m);
    const wob = m.wobble ? range * 0.75 : range;
    const cx = p.x + p.w / 2, cy = p.y + p.h / 2;
    for (const e of S.enemies) {
      if (e.dead || e._popReq) continue;
      const ex = e.x + e.w / 2, ey = e.y + e.h / 2;
      const d = dist(cx, cy, ex, ey);
      if (d > wob + 8) continue;
      const dx = ex - cx, dy = ey - cy;
      const aligned = (Math.abs(dx) >= Math.abs(dy) && dx * p.face > 0) || d < TILE * 1.2;
      const los = d < TILE * 1.35 || aligned;
      if (los && d < bestD) { best = e; bestD = d; }
    }
    if (!best) return false;
    S.hintPump = false;
    if (p.airTank > 0) { p.airTank--; popEnemy(best); return true; }
    const a = pumpRate(m) * dt;
    best.pumping = true; best._pred = 0.35;
    best.swell = Math.min(diffMul().popNeed * 0.97, best.swell + a);
    NET.pumpAcc[best.id] = (NET.pumpAcc[best.id] || 0) + a;
    const stg = Math.min(4, Math.floor(best.swell * 4));
    if (stg > (best._stg || 0)) sfx('swell', stg);
    best._stg = stg;
    p.pumpTgt = best;
    if (!S._pumpSfx || S.time - S._pumpSfx > 0.18) { sfx('pump'); S._pumpSfx = S.time; }
    return true;
  };

  const _explode = explode;
  explode = function (x, y, r) {
    if (!cl()) return _explode(x, y, r);
    const en = S.enemies; S.enemies = [];
    try { _explode(x, y, r); } finally { S.enemies = en; }
    send({ t: 'boom', x, y, r });
  };

  const _updateEnemies = updateEnemies;
  updateEnemies = function (dt) {
    if (!cl()) return _updateEnemies(dt);
    const p = S.p, rt = nowMs() - 100;
    S.bossFightKind = null;
    for (const e of S.enemies) {
      if (e.dead) continue;
      e.frame += dt;
      if (e._pred > 0) e._pred -= dt;
      const q = e._b && interp(e._b, rt);
      if (q) { e.x = q[1]; e.y = q[2]; }
      if (e.boss && e.awake && dist(e.x, e.y, p.x, p.y) < TILE * 14) S.bossFightKind = e.kind;
      if (e.swell > 0.12 || (e.kind === 'mimic' && !e.awake) || (e.boss && !e.awake)) continue;
      if (!p.dead && aabb(p.x, p.y, p.w, p.h, e.x, e.y, e.w, e.h)) {
        if (!enemyCanContact(e)) continue;
        const push = Math.sign(p.x - e.x) || p.face;
        p.x += push * 3;
        if (!(p.pumpTgt && !p.pumpTgt.dead)) hurt(e.dmg, e.kind);
      }
    }
    S.enemies = S.enemies.filter(e => !e.dead || (e._fade = (e._fade || 0.35) - dt) > 0);
  };
  const _updateFalling = updateFalling;
  updateFalling = function (dt) {
    if (!cl()) return _updateFalling(dt);
    for (const f of S.falling) {
      f.y += (f.vy || 0) * dt;
      if (!f.crushed && f.vy > 140 && aabb(f.x + 2, f.y + 2, 12, 14, S.p.x, S.p.y, S.p.w, S.p.h)) { f.crushed = true; S._crushBy = f.by || ''; hurt(2, 'rock', true); }
    }
    for (const f of S.fires) { f.t -= dt; if (f.t <= 0 && tget(f.x, f.y) === T.FIRE) _tset(f.x, f.y, T.AIR); }
    S.fires = S.fires.filter(f => f.t > 0);
  };
  const _updatePickups = updatePickups;
  updatePickups = function (dt) {
    if (!cl()) return _updatePickups(dt);
    const net = [], local = [];
    for (const u of S.pickups) (u.nid ? net : local).push(u);
    S.pickups = local;
    _updatePickups(dt);
    const p = S.p, t = nowMs();
    for (const u of net) {
      u.spark = (u.spark || 0) + dt;
      const d = Math.abs(p.x + p.w / 2 - (u.x + 4)) + Math.abs(p.y + p.h / 2 - (u.y + 4));
      if (!p.dead && d < (u.kind === 'coin' ? 40 : 22) && (!u._req || t - u._req > 600)) {
        if (u.kind === 'item' && !canAddToInv(u.id, u.n)) continue;
        u._req = t; send({ t: 'take', i: u.nid });
      }
    }
    S.pickups = S.pickups.concat(net);
  };
  function canAddToInv(id, n) {
    try { return S.inv.some(s => !s || (s.id === id && s.n + n <= (ITEMS[id].stack || 99))); } catch (err) { return true; }
  }

  const _saveGame = saveGame;
  saveGame = function () {
    if (NET.mpWorld) return savePlayer();
    const r = _saveGame();
    try { diskPush(false); } catch (err) {}
    return r;
  };

  /* ---------------------------------------------------------------- art23: host world file on the server
     When the game is opened through serve.py on the computer running it, the world is also kept in
     saves/world.json next to serve.py, so it survives switching between index.html and the server
     address (they have separate browser storage) and cleared browser data. */
  const DISK = NET.disk = { on: false, ready: !canHost, last: 0, busy: false, sentAt: 0, loaded: false };
  const DISK_GAP = 12000;
  function diskAllowed() { return DISK.on && DISK.ready && !NET.mpWorld && (NET.role === 'off' || NET.role === 'host' || NET.role === 'connecting'); }
  /* rough progress score: time played + skills + goals + bosses (natural caves make dug-tile counts useless) */
  function saveProgress(d) {
    let sk = 0, gl = 0, bs = 0;
    try { for (const k in (d.skills || {})) sk += +d.skills[k] || 0; } catch (err) {}
    try { gl = Object.keys((d.goals && d.goals.done) || {}).length; } catch (err) {}
    try { bs = Array.isArray(d.bossesKilled) ? d.bossesKilled.length : Object.keys(d.bossesKilled || {}).length; } catch (err) {}
    return (+d.time || 0) + sk * 120 + gl * 60 + bs * 300;
  }
  /* which copy to keep when this browser and the server both have one:
     same world with timestamps on both -> the newer one;
     an older-format save (no timestamp) or two different worlds -> the one with more progress */
  function serverWins(d) {
    if (!SAVE_INFO.bootLoaded || !S) return true;
    const localAt = SAVE_INFO.bootSavedAt || 0;
    if (d.seed === S.seed && localAt && d.savedAt) return d.savedAt > localAt;
    let local = null;
    try { local = JSON.parse(LAST_SAVE_JSON || localStorage.getItem(SAVE_KEY)); } catch (err) {}
    const ps = saveProgress(d), pl = local ? saveProgress(local) : 0;
    if (ps !== pl) return ps > pl;
    return (d.savedAt || 0) > localAt;
  }
  /* where the host world file lives: serve.py's saves/ folder, or the desktop app's user folder */
  async function diskGet() {
    if (APP && !isHttp) { const t = await APP.save.read(); return { status: t ? 200 : 204, json: async () => JSON.parse(t) }; }
    return fetch('/save', { cache: 'no-store' });
  }
  function diskPost(body) {
    if (APP && !isHttp) return APP.save.write(body).then(r => ({ ok: !!(r && r.ok), status: r && r.ok ? 200 : 409 }));
    return fetch('/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body });
  }
  async function diskInit() {
    if (!canHost) return;
    if (noServe) { DISK.ready = true; return; }
    /* someone else (another tab or browser) is already hosting: the world file is theirs, so this tab leaves it alone */
    if (isHttp) try {
      const sr = await fetch('/mp/status', { cache: 'no-store' });
      const st = sr.ok ? await sr.json() : null;
      if (st && st.host) { DISK.ready = true; DISK.on = false; DISK.peerOwned = true; return; }
    } catch (err) {}
    let r = null;
    try { r = await diskGet(); } catch (err) {}
    if (!r || !(r.status === 200 || r.status === 204)) { DISK.ready = true; return; }   // 403 = a friend's computer
    DISK.on = true;
    if (r.status === 200 && !/[?&]fresh=1/.test(location.search)) {
      let d = null;
      try { d = await r.json(); } catch (err) {}
      if (d && d.enc === 'rle' && d.n) { try { d = Object.assign({}, d, { tiles: u8b64(saveUnrle(d.tiles, d.n)), hp: u8b64(saveUnrle(d.hp, d.n)), enc: null }); } catch (err) { d = null; } }
      if (d && validSaveData(d) && serverWins(d)) {
        /* a different world in this browser is about to be replaced: keep it in the "old" slot */
        if (S && S.tiles && d.seed !== S.seed && typeof keepOldSave === 'function') keepOldSave();
        if (loadGameData(d, false)) {
          writeLocalSave(JSON.stringify(d));
          DISK.loaded = true;
          toast('Welcome back', 'progress loaded from the server save', '#80e080', 'ui');
        } else if (!loadGame()) newGame();
      }
    }
    DISK.ready = true;
    saveGame();
  }
  function diskPush(force) {
    if (!diskAllowed() || !LAST_SAVE_JSON || DISK.busy || DISK.sentAt === LAST_SAVE_AT) return;
    const now = Date.now();
    if (!force && now - DISK.last < DISK_GAP) return;
    DISK.last = now; DISK.busy = true;
    const at = LAST_SAVE_AT;
    diskPost(LAST_SAVE_JSON)
      .then(r => { if (r.ok) DISK.sentAt = at; else if (r.status === 403) DISK.on = false; })
      .catch(() => {})
      .then(() => { DISK.busy = false; });
  }
  NET.diskPush = diskPush;
  /* v0.25.4: Quit Game / window close: write the world file now (desktop app: synchronously) */
  NET.flushNow = function () {
    if (!diskAllowed() || !LAST_SAVE_JSON) return false;
    if (APP && !isHttp) { try { const r = APP.save.writeSync(LAST_SAVE_JSON); if (r && r.ok) DISK.sentAt = LAST_SAVE_AT; return !!(r && r.ok); } catch (err) { return false; } }
    diskFlushOnClose(); return true;
  };
  /* if this tab later becomes the host itself, its world is the one to keep on disk */
  const _diskHost = NET.host;
  NET.host = function () { if (DISK.peerOwned) { DISK.peerOwned = false; DISK.on = true; } return _diskHost.apply(this, arguments); };
  /* page is closing: the host's open socket carries the whole save; otherwise a small beacon */
  function diskFlushOnClose() {
    if (!diskAllowed() || !LAST_SAVE_JSON || DISK.sentAt === LAST_SAVE_AT) return;
    if (NET.role === 'host' && NET.ws && NET.ws.readyState === 1) { send({ t: 'save', data: LAST_SAVE_JSON }); DISK.sentAt = LAST_SAVE_AT; return; }
    if (APP && !isHttp) { try { APP.save.writeSync(LAST_SAVE_JSON); DISK.sentAt = LAST_SAVE_AT; } catch (err) {} return; }
    const c = compactSave(LAST_SAVE_JSON);
    if (c && c.length < 63000 && navigator.sendBeacon && navigator.sendBeacon('/save', new Blob([c], { type: 'text/plain' }))) { DISK.sentAt = LAST_SAVE_AT; return; }
    try { fetch('/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: LAST_SAVE_JSON }); } catch (err) {}
  }
  window.addEventListener('beforeunload', diskFlushOnClose);
  window.addEventListener('pagehide', diskFlushOnClose);
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') diskPush(true); });
  setInterval(() => { if (LAST_SAVE_AT && DISK.sentAt !== LAST_SAVE_AT) diskPush(false); }, 3000);

  const _drawReadableMiner = drawReadableMiner;
  const mc = document.createElement('canvas'); mc.width = 24; mc.height = 24;
  const mcx = mc.getContext('2d');
  drawReadableMiner = function () {
    if (typeof a24cInEntityPass === 'function' && a24cInEntityPass()) return; /* art24c: peers + miner draw once, last */
    if (NET.role !== 'off' && NET.peers.size) drawPeers();
    return _drawReadableMiner();
  };
  function drawPeers() {
    const rt = nowMs() - 100;
    for (const pe of NET.peers.values()) {
      if (!pe.s) continue;
      const q = interp(pe.buf, rt) || [0, pe.s[0], pe.s[1]];
      const [, , , , face, pose, anim, pumping, digSwing, dead, , phantom, lkS, ptId] = pe.s;
      const LK = parseLook(lkS);
      const sx = Math.round(q[1] - S.camX - 3), sy = Math.round(q[2] - S.camY - 2);
      if (sx < -30 || sy < -30 || sx > VW + 30 || sy > VH + 30) continue;
      let walk = pose === 'walk' ? ((anim * 2) | 0) % 4 : 0, sub = '';
      /* v0.26.11: remote walk cycle from the interpolated position (phase = distance moved, so no sliding), sprint from the flag */
      const gf = pe.s[17] | 0;
      if (pose === 'walk' && typeof gaitStep === 'function') { sub = gaitStep(pe, q[1], !!(gf & 1) || Math.abs(pe.s[2] | 0) > 100); walk = 0; }
      else { if (typeof gaitTrack === 'function') gaitTrack(pe, q[1]); if (pose === 'idle' && ((gf & 2) || (!gf && pe.s[17] === undefined && Math.abs(pe.s[3] | 0) > 40))) sub = 'jump'; }
      if (pose === 'idle' && !sub) walk = ((S.time * 1.3 + pe.id) | 0) % 2 ? 1 : 0;
      else if (pose === 'dig') sub = (digSwing % 0.24) < 0.12 ? 'dig2' : '';
      else if (pose === 'fall') sub = 'fall';
      /* v0.26.6: peers on a ladder climb (back pose, frame steps with their interpolated height, centred on the ladder column) */
      let cdx = 0;
      if (typeof pose === 'string' && /^(climb|rope)/.test(pose) && !dead) {
        const rp = pose.indexOf('rope') === 0 ? 'rope' : 'climb';
        sub = /I$/.test(pose) ? rp + 'I' : rp + (Math.floor(q[2] / 4) & 3);
        cdx = Math.round(Math.floor((q[1] + 5) / TILE) * TILE + TILE / 2 - 8 - (q[1] - 3));
        walk = 0;
      }
      mcx.clearRect(0, 0, 24, 24);
      mcx.globalCompositeOperation = 'source-over';
      mcx.save();
      if (dead) { mcx.translate(12, 20); mcx.rotate(-face * Math.PI / 2); drawMiner(mcx, -8, -16, face, 0, false, true, false, false, 'dead', LK.look, LK.gear); }
      else drawMiner(mcx, 4, 4, face, walk, !!pumping, false, !!phantom, pose === 'dig' && sub !== 'dig2', sub || (pose === 'idle' ? 'idle' : ''), LK.look, LK.gear);
      mcx.restore();
      mcx.globalCompositeOperation = 'source-atop';
      mcx.globalAlpha = 0.14; mcx.fillStyle = pe.col; mcx.fillRect(0, 0, 24, 24);
      mcx.globalAlpha = 1; mcx.globalCompositeOperation = 'source-over';
      g.globalAlpha = dead ? 0.55 : 1;
      g.drawImage(mc, sx - 4 + cdx, sy - 4);
      g.globalAlpha = 1;
      if (!dead && typeof drawPeerFish === 'function') { try { drawPeerFish(pe.s, q[1], q[2], face); } catch (e) {} }
      const ptE = pumping && ptId ? S.enemies.find(q => q.id === ptId && !q.dead) : null;
      if (pumping && !dead && ptE) drawHose22(sx + 8 + face * 6, sy + 9, face, ptE, S.time);
      else if (pumping && !dead) {
        g.fillStyle = 'rgba(150,210,255,0.85)';
        const x0 = sx + 8 + face * 7, y0 = sy + 9;
        for (let i = 0; i < 7; i++) {
          const k = (i + (S.time * 18) % 1) * 4;
          g.fillRect(x0 + face * k, y0 + Math.sin(S.time * 20 + i) * 1.2, 2, 1);
        }
      }
      const nm = fitText(pe.name, 70, 6);
      font(6, pe.col);
      const tw = g.measureText(nm).width;
      g.fillStyle = 'rgba(10,7,4,0.82)'; g.fillRect(Math.round(sx + 8 - tw / 2 - 2), Math.round(sy - 11), Math.ceil(tw + 4), 9);
      textOutlined(nm, sx + 8 - tw / 2, sy - 4, pe.col, 6);
    }
  }

  const _drawHUD = drawHUD;
  drawHUD = function () {
    _drawHUD();
    if (NET.role === 'off') return;
    drawPlayerList();
  };
  function drawPlayerList() {
    const rows = [[NET.name + ' (you)', NET.myCol, depthOf(S.p), 2]];
    for (const pe of NET.peers.values()) {
      const age = nowMs() - pe.last;
      rows.push([pe.name, pe.col, pe.s ? pe.s[10] : 0, NET.role === 'offline' ? 0 : age < 1500 ? 2 : age < 5000 ? 1 : 0, pe.s && pe.s[9]]);
    }
    /* v0.26.11: drawn at the UI scale, in the same right-hand column as the Lv panel and the minimap */
    if (typeof uiScaled === 'function' && !drawPlayerList._in) { drawPlayerList._in = 1; try { return uiScaled(drawPlayerList); } finally { drawPlayerList._in = 0; } }
    const RS = typeof hudRightStack === 'function' ? hudRightStack().coop : null;
    const x = RS ? RS.x : VW - 96, w = RS ? RS.w : 92, y0 = RS ? RS.y : 27 + (S.p && S.p.sp > 0 && !S.paused ? 14 : 0), h = 8 + rows.length * 9; /* art24d: below the skill point chip */
    g.fillStyle = 'rgba(12,8,6,0.72)'; g.fillRect(x, y0, w, h);
    g.strokeStyle = '#6a5030'; g.lineWidth = 1; g.strokeRect(x + 0.5, y0 + 0.5, w - 1, h - 1);
    text(NET.role === 'host' ? 'HOSTING' : NET.role === 'offline' ? 'OFFLINE' : 'CO-OP', x + 4, y0 + 7, '#a08060', 6);
    rows.forEach((r, i) => {
      const yy = y0 + 15 + i * 9;
      g.fillStyle = ['#e05040', '#e0c040', '#60e060'][r[3]];
      g.fillRect(x + 4, yy - 4, 3, 3);
      text(fitText(r[0], 52, 6), x + 10, yy, r[4] ? '#806850' : r[1], 6);
      text(r[4] ? 'down' : (r[2] | 0) + 'm', x + 66, yy, '#c8b89a', 6);
    });
  }
  function depthOf(p) { const tx = Math.floor((p.x + 5) / TILE), ty = Math.floor((p.y + 7) / TILE); return Math.max(0, ty - localSurf(tx)); }

  const _drawToasts = drawToasts;
  drawToasts = function () {
    _drawToasts();
    if ((NET.role === 'off' && !NET.chat.length) || S.paused) return;
    let y = VH - 40;
    if (NET.chatOpen) {
      g.fillStyle = 'rgba(10,7,4,0.85)'; g.fillRect(8, y - 8, 260, 11);
      g.strokeStyle = '#c8a050'; g.strokeRect(8.5, y - 7.5, 259, 10);
      text('say: ' + NET.chatBuf + ((S.time * 2 | 0) % 2 ? '_' : ''), 12, y, '#fff0c0', 6);
      y -= 12;
    }
    for (let i = NET.chat.length - 1; i >= 0; i--) {
      const c = NET.chat[i];
      g.globalAlpha = Math.min(1, c.t);
      textOutlined(c.name + ':', 10, y, c.col, 6);
      font(6, '#fff'); const w = g.measureText(c.name + ': ').width;
      textOutlined(c.msg, 10 + w, y, '#f0e8d8', 6);
      g.globalAlpha = 1;
      y -= 9;
    }
  };

  /* ---------------------------------------------------------------- tick */
  NET.tick = function (raw) {
    const t = nowMs();
    for (const c of NET.chat) c.t -= raw;
    NET.chat = NET.chat.filter(c => c.t > 0);
    if (NET.role === 'client' && !NET.ws && NET.retry > 0 && NET.retry < 99) {
      NET.retryT -= raw;
      if (NET.retryT <= 0) { NET.retryT = 2; savePlayer(); connect('join'); }
    }
    if (!NET.ws || NET.ws.readyState !== 1) return;
    const A = NET.tAcc;
    A.p += raw; A.st += raw; A.tl += raw; A.pump += raw;
    if (NET.role === 'host') {
      if (A.tl >= 0.05 && NET.dirty.size) {
        A.tl = 0;
        const d = [];
        for (const [k, v] of NET.dirty) d.push(k % W, (k / W) | 0, v);
        NET.dirty.clear();
        send({ t: 'tl', d });
      }
      if (A.st >= 0.08) {
        A.st = 0;
        if (NET.peers.size) {
          const e = [];
          for (const q of S.enemies) {
            if (q.dead) continue;
            if (!q.id) q.id = NET.seq++;
            e.push([q.id, q.kind, Math.round(q.x * 10) / 10, Math.round(q.y * 10) / 10, q.face, Math.round(q.swell * 100) / 100, q.awake ? 1 : 0, q.armor, q.pumps || 1, q.pinT > 0 ? 1 : 0, q.ev || 0]);
          }
          const f = S.falling.map(q => { if (!q.id) q.id = NET.seq++; return [q.id, q.x | 0, Math.round(q.y), q.vy | 0, q.by === 'you' ? NET.name : (q.by || ''), q.wob > 0 ? Math.round(q.wob * 100) / 100 : 0, q.gy | 0]; });
          const k = [];
          for (const u of S.pickups) { if (u.dead) continue; if (!u.nid) u.nid = NET.seq++; k.push([u.nid, u.kind === 'coin' ? 'c' : 'i', u.id || 0, u.n, Math.round(u.x), Math.round(u.y)]); }
          send({ t: 'st', e, f, k, dc: (S && isFinite(S.dayClock)) ? Math.round(S.dayClock * 10) / 10 : undefined });   /* v0.26.22: host day clock */
        }
        const rs = JSON.stringify(S.ropes.map(r => [r.x, r.y, r.len]));
        if (rs !== NET.lastRopes) { NET.lastRopes = rs; send({ t: 'rp', r: S.ropes.map(r => ({ x: r.x, y: r.y, len: r.len })) }); }
      }
    }
    if (NET.role === 'client' && NET.built) {
      if (A.pump >= 0.05) {
        A.pump = 0;
        for (const id in NET.pumpAcc) send({ t: 'pump', id: +id, a: Math.round(NET.pumpAcc[id] * 1000) / 1000 });
        NET.pumpAcc = {};
      }
      for (const r of S.ropes) if (!r._s) { r._s = 1; send({ t: 'rope', x: r.x, y: r.y, len: r.len }); }
      for (const [k, at] of NET.pend) if (t - at > 4000) NET.pend.delete(k);
    }
    if (A.p >= 0.05 && (NET.role === 'host' || NET.built)) { A.p = 0; send({ t: 'p', to: '*', s: myState(), ts: Math.round(nowMs()) }); }
  };

  /* ---------------------------------------------------------------- keyboard: chat + text fields */
  window.addEventListener('keydown', (e) => {
    const k = e.key;
    const typing = NET.chatOpen || (NET.edit && S && S.paused && S.menu === 'mp');
    if (typing) {
      e.preventDefault(); e.stopImmediatePropagation();
      const field = NET.chatOpen ? 'chatBuf' : NET.edit;
      const max = NET.chatOpen ? 80 : (NET.edit === 'name' ? 16 : NET.edit === 'code' ? 6 : 40);
      if (k === 'Enter') {
        if (NET.chatOpen) {
          const msg = NET.chatBuf.trim();
          if (msg) { send({ t: 'chat', to: '*', m: msg }); addChat(NET.name, NET.myCol, msg); }
          NET.chatOpen = false; NET.chatBuf = '';
        } else { const wasCode = NET.edit === 'code'; finishEdit(); if (wasCode && NET.role === 'off' && NET.code.length === 6) NET.joinOnline(); }
      } else if (k === 'Escape') {
        if (NET.chatOpen) { NET.chatOpen = false; NET.chatBuf = ''; } else finishEdit();
      } else if (k === 'Backspace') NET[field] = NET[field].slice(0, -1);
      else if (k.length === 1 && NET[field].length < max && (field !== 'code' || /[a-z]/i.test(k))) NET[field] += field === 'code' ? k.toUpperCase() : k;
      return;
    }
    const chatKey = (typeof bindKey === 'function' && Object.keys(BIND_DEFS || {}).some(a => bindKey(a) === 't')) ? 'y' : 't';
    if (NET.live() && (k === chatKey || k === chatKey.toUpperCase()) && S && !S.paused && !e.repeat) {
      e.preventDefault(); e.stopImmediatePropagation();
      for (const kk in keys) keys[kk] = false;
      NET.chatOpen = true; NET.chatBuf = '';
    }
  }, true);
  function finishEdit() {
    if (NET.edit === 'name') {
      NET.name = NET.name.replace(/[^\w .'\-]/g, '').trim().slice(0, 16) || 'Miner';
      try { localStorage.setItem('burrow_name', NET.name); } catch (err) {}
    }
    if (NET.edit === 'code') NET.code = cleanCode(NET.code);
    NET.edit = null;
  }

  /* ---------------------------------------------------------------- v0.26.4: online co-op with join codes
     Host online / Join online: players connect directly (WebRTC data channels). The free public PeerJS
     service (0.peerjs.com) only introduces the two computers; no account, no Burrow server. Public STUN finds
     a direct path; PeerJS's free public relay is tried when a router blocks that. The HOST's browser plays
     the relay's part (hello / welcome / join / routing / leave / hostleft), so every co-op message is the same
     one the Wi-Fi relay carries and the rest of net.js does not know the difference. */
  const CODE_ABC = 'ABCDEFGHJKLMNPQRSTUVWXYZ';           /* no I / O, they look like 1 / 0 */
  const ON_MAX = 4, ON_PREFIX = 'burrow-v1-';
  NET.code = '';
  function newCode() { let s = ''; for (let i = 0; i < 6; i++) s += CODE_ABC[rnd(CODE_ABC.length)]; return s; }   /* v0.26.8: crypto random, 24^6 = 191 million codes */
  function cleanCode(s) { return String(s || '').toUpperCase().replace(/[^A-Z]/g, '').slice(0, 6); }
  NET.cleanCode = cleanCode;
  let pjLoad = null;
  function loadPeerJs() {
    if (window.Peer) return Promise.resolve(window.Peer);
    if (pjLoad) return pjLoad;
    pjLoad = new Promise((res, rej) => {
      const s = document.createElement('script'); s.src = 'peerjs.min.js';
      s.onload = () => window.Peer ? res(window.Peer) : rej(new Error('peerjs'));
      s.onerror = () => { pjLoad = null; rej(new Error('peerjs')); };
      document.head.appendChild(s);
    });
    return pjLoad;
  }
  /* a WebSocket look-alike: readyState / send / close / onopen / onmessage / onclose */
  function fakeSock() {
    const fs = { readyState: 0, online: true, onopen: null, onmessage: null, onclose: null, onerror: null, _closed: false };
    fs.deliver = o => { if (fs._closed) return; const data = typeof o === 'string' ? o : JSON.stringify(o); setTimeout(() => { if (!fs._closed && fs.onmessage) fs.onmessage({ data }); }, 0); };
    fs.fail = (code, msg) => { fs.deliver({ t: 'err', code, msg }); setTimeout(() => fs.close(), 30); };
    fs.finish = () => { if (fs._closed) return; fs._closed = true; fs.readyState = 3; const f = fs.onclose; setTimeout(() => f && f({}), 0); };
    return fs;
  }
  /* v0.26.8: Settings 'Hide my IP (use relay)': WebRTC only uses the PeerJS TURN relay, so the other computer
     sees the relay's address, never yours. Off: a direct link (faster) where both sides learn each other's IP. */
  /* v0.26.14: the free PeerJS TURN relay shut down (its hostnames no longer resolve), so Hide my IP could never connect.
     RELAY_AVAILABLE = false hides the switch and ignores a saved mpHideIp (the key stays in settings) until the game has
     its own relay; flip it back on with a working relay in iceOpts. Direct games use STUN only (no dead relays to wait on). */
  const RELAY_AVAILABLE = false;
  const DIRECT_ICE = [{ urls: ['stun:stun.l.google.com:19302', 'stun:stun.cloudflare.com:3478'] }];
  function hideOn(v) { return RELAY_AVAILABLE && !!(v != null ? v : SETTINGS && SETTINGS.mpHideIp); }
  NET.relayAvailable = () => RELAY_AVAILABLE;
  NET.hideOn = hideOn;
  function iceOpts() {
    const o = { debug: 0, config: { iceServers: DIRECT_ICE } };
    const hide = hideOn(NET.online && NET.online.hideIp != null ? NET.online.hideIp : null);
    if (hide) o.config = {
      iceServers: [{ urls: ['turn:eu-0.turn.peerjs.com:3478', 'turn:us-0.turn.peerjs.com:3478'], username: 'peerjs', credential: 'peerjsp' }],
      iceTransportPolicy: 'relay'
    };
    return o;
  }
  NET.iceOpts = iceOpts;

  /* ---------------------------------------------------------------- v0.26.9: Recent games + Wi-Fi Allow / Deny
     Recent games (pause > Multiplayer > Recent games) lists the last 10 hosts you played with, on this computer only
     (own key burrow_mp_recent; never the save or settings keys). A row keeps just the host's name, when you last played,
     and how to reach them: the Wi-Fi address you typed, or the host's rejoin id for online games. No codes, IPs of
     online hosts, keys or world data. The host still says Allow / Deny on every rejoin, and their kicked list still blocks. */
  const HOST_AWAY = "Host isn't online right now.";
  const RECENT_K = 'burrow_mp_recent', RECENT_MAX = 10, REJOIN_K = 'burrow_mp_rejoin';
  const RJ_RE = /^[a-z0-9]{12,32}$/, ADDR_RE = /^(?:[\w.\-]{1,63}|\[[0-9a-fA-F:.]{2,45}\])(?::\d{1,5})?$/;
  const LAN_OK = new WeakSet();
  function rejoinId() {
    let k = ''; try { k = localStorage.getItem(REJOIN_K) || ''; } catch (e) {}
    if (!/^[a-z0-9]{20}$/.test(k)) { k = ''; for (let i = 0; i < 20; i++) k += '0123456789abcdefghijklmnopqrstuvwxyz'[rnd(36)]; try { localStorage.setItem(REJOIN_K, k); } catch (e) {} }
    return k;
  }
  NET.rejoinId = rejoinId;
  function recentOk(e) { return e && typeof e === 'object' && (e.k === 'on' ? RJ_RE.test(e.a) : e.k === 'lan' ? (typeof e.a === 'string' && ADDR_RE.test(e.a)) : false); }
  function recentLoad() {
    try {
      const a = JSON.parse(localStorage.getItem(RECENT_K) || '[]');
      if (!Array.isArray(a)) return [];
      return a.filter(recentOk).map(e => ({ k: e.k, a: e.a, n: cleanName(e.n, 'Host'), t: Number(e.t) || 0 })).slice(0, RECENT_MAX);
    } catch (e) { return []; }
  }
  function recentSave() { try { localStorage.setItem(RECENT_K, JSON.stringify(NET.recent.slice(0, RECENT_MAX))); } catch (e) {} }
  NET.recent = recentLoad();
  NET.recentReload = () => { NET.recent = recentLoad(); };
  NET.recentAdd = function () {
    const e = NET.online ? { k: 'on', a: NET.hostRj || '' } : { k: 'lan', a: String(NET.addr || (isHttp ? location.host : '')).trim() };
    if (!recentOk(e)) return false;
    e.n = cleanName(NET.hostName, 'Host'); e.t = Date.now();
    NET.recent = [e].concat(NET.recent.filter(o => !(o.k === e.k && o.a === e.a))).slice(0, RECENT_MAX);
    recentSave(); return true;
  };
  NET.recentRemove = function (e) { NET.recent = NET.recent.filter(o => o !== e); recentSave(); };
  NET.recentClear = function () { NET.recent = []; recentSave(); };
  NET.rejoining = function () {
    const r = NET._rejoin; if (!r || Date.now() - r.at > 90000) return false;
    return r.k === 'on' ? !!(NET.online && NET.online.rj === r.a) : (!NET.online && NET.addr === r.a);
  };
  NET.rejoin = function (e) {
    if (!recentOk(e)) return false;
    if (NET.role !== 'off') { setStatus(NET.role === 'host' ? 'Stop hosting first, then rejoin.' : 'Leave this game first, then rejoin.', '#e0c060'); return false; }
    NET._rejoin = { k: e.k, a: e.a, n: e.n, at: Date.now() };
    if (e.k === 'on') {
      if (typeof DISK !== 'undefined' && DISK.peerOwned) { DISK.peerOwned = false; DISK.on = true; }
      NET.online = { code: '', rj: e.a, rjName: e.n, hideIp: hideOn() }; NET.hostLeft = false; NET.retry = 0; NET.built = false;
      connect('join'); ipNote();
    } else { NET.addr = e.a; NET.join(); }
    return true;
  };
  /* Wi-Fi host: the relay lets people in at once, so the host holds them here until Allow (no world is sent before that).
     Deny = a kick plus an unban at the relay: they are out, but not blocked (the kicked list is for kicks). */
  function lanAsk(from, m) {
    if (NET.joinAsk.some(q => q.lan && q.from === from)) return;
    if (NET.joinAsk.length >= 8) { sendTo(from, { t: 'jno', msg: 'The host is busy, try again in a moment.' }); send({ t: 'kick', id: from }); if (m.key) send({ t: 'unban', key: m.key }); return; }
    const q = { lan: true, from, m, name: m.name, key: m.key || '', t: nowMs() };
    q.timer = setTimeout(() => lanAnswer(q, false), 30000);
    NET.joinAsk.push(q);
    sendTo(from, { t: 'wait', msg: 'Waiting for ' + NET.name + ' to let you in...' });
    if (S && !S.p.dead) { S.paused = true; S.menu = 'mp'; }
    toast(m.name + ' wants to join', 'Allow or Deny in the Multiplayer menu', '#ffe080', 'ui');
  }
  function lanAskDrop(from) {
    const q = NET.joinAsk.find(o => o.lan && o.from === from);
    if (q) { clearTimeout(q.timer); NET.joinAsk = NET.joinAsk.filter(o => o !== q); }
  }
  function lanAnswer(q, allow) {
    if (!NET.joinAsk.includes(q)) return;
    NET.joinAsk = NET.joinAsk.filter(o => o !== q); clearTimeout(q.timer);
    if (NET.role !== 'host' || NET.online) return;
    sfx('ui');
    if (allow) { LAN_OK.add(q.m); if (NET.okRemember) NET.okRemember(q.key); hostMsg(q.m); setStatus(q.name + ' is joining...', '#80e080'); }
    else {
      sendTo(q.from, { t: 'jno', msg: 'The host said no this time.' });
      send({ t: 'kick', id: q.from });
      if (q.key) send({ t: 'unban', key: q.key });
      setStatus('You said no to ' + q.name + '.', '#c8b89a');
    }
  }
  NET.lanAnswer = lanAnswer;
  function lanDenied(msg) {
    NET.retry = 99; NET.kickedMsg = msg; NET.errShown = true;
    NET.wantClose = true;
    if (NET.ws) try { NET.ws.close(); } catch (err) {}
    NET.ws = null; NET.role = 'off'; NET.home = null; NET.carry = null; NET.peers.clear();
    setStatus(msg, '#e07070');
    toast('Multiplayer', msg, '#e07070', 'ui');
  }
  NET.askOn = () => !SETTINGS || SETTINGS.mpAsk !== false;
  NET.joinAsk = [];
  /* v0.26.8: the host's kicked list (pause > Multiplayer > Kicked list). Saved on this computer (own key, not the save or
     settings keys), so a kicked player stays out after a restart, online and on Wi-Fi, until the host unblocks them. */
  const KICK_K = 'burrow_mp_kicked', KICK_MAX = 50;
  function kickLoad() {
    try {
      const a = JSON.parse(localStorage.getItem(KICK_K) || '[]');
      if (!Array.isArray(a)) return [];
      return a.filter(e => e && typeof e === 'object').map(e => ({ key: cleanKey(e.key), name: cleanName(e.name, 'Miner'), t: Number(e.t) || 0, why: cleanText(String(e.why || ''), 40), ids: Array.isArray(e.ids) ? e.ids.filter(x => typeof x === 'string').map(x => x.slice(0, 60)).slice(0, 4) : [] })).filter(e => e.key || e.ids.length).slice(-KICK_MAX);
    } catch (e) { return []; }
  }
  function kickSave() { try { localStorage.setItem(KICK_K, JSON.stringify(NET.kicked.slice(-KICK_MAX))); } catch (e) {} }
  NET.kicked = kickLoad();
  NET.kickedHas = key => { key = cleanKey(key); return !!key && NET.kicked.some(e => e.key === key); };
  NET.addKicked = function (key, name, pid, why) {
    key = cleanKey(key);
    let e = key ? NET.kicked.find(o => o.key === key) : null;
    if (!e) { e = { key, name: 'Miner', t: 0, why: '', ids: [] }; NET.kicked.push(e); }
    e.name = cleanName(name, 'Miner'); e.t = Date.now(); e.why = cleanText(String(why || ''), 40);
    if (pid && !e.ids.includes(pid)) e.ids = e.ids.concat(String(pid).slice(0, 60)).slice(-4);
    NET.kicked = NET.kicked.filter(o => o === e || o.key !== key || !key).slice(-KICK_MAX);
    kickSave();
  };
  NET.unblock = function (e) {
    if (!e) return;
    NET.kicked = NET.kicked.filter(o => o !== e);
    if (e.key) SEC.banned.delete(e.key);
    for (const id of e.ids || []) SEC.banned.delete(id);
    kickSave();
    if (NET.role === 'host' && !NET.online) send({ t: 'unban', key: e.key });      /* Wi-Fi: the relay forgets it too */
    toast(e.name + ' unblocked', 'they can ask to join again', '#80e080', 'ui');
  };
  NET.unblockAll = function () {
    if (!NET.kicked.length) return;
    NET.kicked = []; SEC.banned.clear(); kickSave();
    if (NET.role === 'host' && !NET.online) send({ t: 'unban', all: true });
    toast('Kicked list cleared', 'everyone can ask to join again', '#80e080', 'ui');
  };
  NET.kickedReload = () => { NET.kicked = kickLoad(); };
  function onlineSocket(role) {
    const fs = fakeSock(), code = NET.online.code;
    let peer = null, timer = 0;
    const clear = () => { if (timer) clearTimeout(timer); timer = 0; };
    loadPeerJs().then(Peer => { if (!fs._closed) (role === 'host' ? startHost : startJoin)(Peer); })
      .catch(() => fs.fail('online', 'Online play could not load (peerjs.min.js missing).'));

    function startHost(Peer) {
      const conns = new Map(); let nextId = 2, me = null, tries = 0, myCode = code;
      const live = () => [...conns.values()].filter(c => c.ok);
      const tx = (c, o) => { try { c.conn.send(typeof o === 'string' ? o : JSON.stringify(o)); } catch (e) {} };
      function open() {
        peer = new Peer(ON_PREFIX + myCode, iceOpts());
        timer = setTimeout(() => fs.fail('online', 'Could not reach the online join service. Check your internet and try again.'), 15000);
        peer.on('open', () => {
          clear(); NET.online.code = NET.code = myCode; fs.readyState = 1;
          if (fs.onopen) fs.onopen({});
          openRj();
        });
        peer.on('error', err => {
          const ty = err && err.type;
          if (ty === 'unavailable-id' && tries++ < 4 && fs.readyState === 0) { clear(); try { peer.destroy(); } catch (e) {} myCode = newCode(); open(); return; }
          if (fs.readyState === 0) { clear(); fs.fail('online', 'Could not start online hosting (' + (ty || 'error') + '). Check your internet.'); }
        });
        peer.on('disconnected', () => { if (!fs._closed) setTimeout(() => { try { if (!fs._closed && peer.disconnected && !peer.destroyed) peer.reconnect(); } catch (e) {} }, 2000); });
        peer.on('connection', conn => onConn(conn, false));
      }
      /* v0.26.9: Recent games - a second PeerJS id that stays the same on this computer (burrow_mp_rejoin), so friends
         who played here can rejoin without a new code. Every rejoin asks Allow / Deny, and the kicked list still blocks. */
      let rjPeer = null;
      function openRj() {
        if (rjPeer || fs._closed) return;
        try {
          rjPeer = new Peer(ON_PREFIX + 'r-' + rejoinId(), iceOpts());
          rjPeer.on('connection', conn => onConn(conn, true));
          rjPeer.on('error', err => {   /* v0.26.11: after a restart the old rejoin id can be held for a bit - keep trying */
            if (err && err.type === 'unavailable-id' && !fs._closed && (NET.online && (NET.online.rjTries = (NET.online.rjTries || 0) + 1)) < 40) {
              const old = rjPeer; rjPeer = null; try { old.destroy(); } catch (e) {}
              setTimeout(openRj, 4000);
            }
          });
          rjPeer.on('disconnected', () => { if (!fs._closed) setTimeout(() => { try { if (!fs._closed && rjPeer && rjPeer.disconnected && !rjPeer.destroyed) rjPeer.reconnect(); } catch (e) {} }, 2000); });
        } catch (e) { rjPeer = null; }
      }
      NET.online.rjOpen = () => !!(rjPeer && rjPeer.open);
      function onConn(conn, rj) {
        {
          const c = { conn, id: 0, ok: false, hello: false, name: 'Miner', strikes: 0, rj: !!rj };
          NET.online.inbound = (NET.online.inbound || 0) + 1;
          if (SEC.banned.has(conn.peer) || [...conns.values()].length + NET.joinAsk.length >= 8) { setTimeout(() => { try { conn.close(); } catch (e) {} }, 50); return; }
          const hiT = setTimeout(() => { if (!c.hello && !c.gone) { try { conn.close(); } catch (e) {} } }, 10000);   /* say hello within 10 s */
          conn.on('data', d => onData(c, d));
          const gone = () => {
            clearTimeout(hiT);
            if (c.gone) return; c.gone = true;
            NET.joinAsk = NET.joinAsk.filter(q => q.c !== c);
            if (c.id) { conns.delete(c.id); if (c.ok) fs.deliver({ t: 'leave', from: c.id }); }
          };
          conn.on('close', gone); conn.on('error', gone);
          conn.on('iceStateChanged', s => { if (s === 'failed' || s === 'closed' || s === 'disconnected') { if (s !== 'disconnected') gone(); } });
        }
      }
      function kickConn(c, why) {
        if (c.gone) return;
        SEC.kicks++; SEC.last = 'kick: ' + why;
        if (c.key) SEC.banned.add(c.key);
        SEC.banned.add(c.conn.peer);
        if (c.hello) NET.addKicked(c.key, c.name, c.conn.peer, why);
        tx(c, { t: 'err', code: 'kicked', msg: 'The host removed you from this game' + (why ? ' (' + why + ')' : '') + '.' });
        const was = c.ok; c.ok = false; c.gone = true;
        NET.joinAsk = NET.joinAsk.filter(q => q.c !== c);
        if (c.id) { conns.delete(c.id); if (was) fs.deliver({ t: 'leave', from: c.id }); }
        setTimeout(() => { try { c.conn.close(); } catch (e) {} }, 200);
        toast((c.name || 'A player') + ' was removed', why || 'by you', '#e07070', 'ui');
      }
      function admit(c) {
        if (c.gone) return;
        if (live().length + 1 >= ON_MAX) { tx(c, { t: 'err', code: 'full', msg: 'The game is full (' + ON_MAX + ' players max).' }); setTimeout(() => { try { c.conn.close(); } catch (e) {} }, 300); return; }
        c.id = nextId++; c.ok = true; c.pending = false; NET.okRemember && NET.okRemember(c.key);
        conns.set(c.id, c);
        tx(c, { t: 'welcome', id: c.id, role: 'client', ver: VER, hostName: NET.name, hostId: 1, rj: rejoinId() });
        fs.deliver({ t: 'join', from: c.id, name: c.name, key: c.key });
      }
      NET.online.kick = id => { const c = conns.get(id); if (c) kickConn(c, 'kicked by the host'); };
      NET.online.answer = (q, allow) => {
        NET.joinAsk = NET.joinAsk.filter(o => o !== q);
        clearTimeout(q.timer);
        const c = q.c; if (c.gone) return;
        if (allow) admit(c);
        else { tx(c, { t: 'err', code: 'denied', msg: 'The host said no this time.' }); c.gone = true; setTimeout(() => { try { c.conn.close(); } catch (e) {} }, 300); }
      };
      function onData(c, d) {
        if (c.gone) return;
        const size = typeof d === 'string' ? d.length : -1;
        if (size < 0 || size > SEC.maxMsg) { secDrop('size'); if (!c.hello || strike(c)) kickConn(c, 'sent bad data'); return; }
        const r = rateHit(c, size);
        if (r === 'kick') return kickConn(c, 'flooding');
        if (r === 'drop') return secDrop('rate');
        let m; try { m = JSON.parse(d); } catch (e) { m = null; }
        if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.t !== 'string') { secDrop('shape'); if (!c.hello || strike(c)) kickConn(c, 'sent bad data'); return; }
        if (!c.hello) {
          c.hello = true;
          if (m.t !== 'hello') { try { c.conn.close(); } catch (e) {} return; }
          const ver = String(m.ver || '').slice(0, 20);
          c.key = cleanKey(m.key); c.name = cleanName(m.name, 'Miner');
          let err = null;
          if (SEC.banned.has(c.key) || NET.kickedHas(c.key)) err = { t: 'err', code: 'kicked', msg: 'The host removed you from this game.' };
          else if (ver !== VER) err = { t: 'err', code: 'version', need: VER, have: ver, msg: 'Your friend is on v' + VER + ', please update.' };
          else if (live().length + NET.joinAsk.length + 1 >= ON_MAX) err = { t: 'err', code: 'full', msg: 'The game is full (' + ON_MAX + ' players max).' };
          else if (m.role === 'host') err = { t: 'err', code: 'host_taken', msg: NET.name + ' is already hosting. Use Join online instead.' };
          if (err) { tx(c, err); c.gone = true; setTimeout(() => { try { c.conn.close(); } catch (e) {} }, 300); return; }
          if ((NET.askOn() || c.rj) && !(NET.autoOk && NET.autoOk(c.key))) {
            /* v0.26.8: the host says yes first ('Dom wants to join: Allow / Deny'); no answer in 30 s = no */
            c.pending = true;
            const q = { c, name: c.name, t: nowMs() };
            q.timer = setTimeout(() => NET.online && NET.online.answer && NET.online.answer(q, false), 30000);
            NET.joinAsk.push(q);
            tx(c, { t: 'wait', msg: 'Waiting for ' + NET.name + ' to let you in...' });
            if (S && !S.p.dead) { S.paused = true; S.menu = 'mp'; }
            toast(c.name + ' wants to join', 'Allow or Deny in the Multiplayer menu', '#ffe080', 'ui');
            return;
          }
          admit(c);
          return;
        }
        if (!c.ok) return secDrop('not admitted');
        if (!CLIENT_T.has(m.t)) return secDrop('type ' + m.t);
        m.from = c.id;
        if (m.to === '*' && PEER_T.has(m.t)) { const out = JSON.stringify(m); for (const o of live()) if (o !== c) tx(o, out); fs.deliver(out); }
        else { delete m.to; fs.deliver(JSON.stringify(m)); }
      }
      fs.send = str => {
        if (fs.readyState !== 1) return;
        let m; try { m = JSON.parse(str); } catch (e) { return; }
        if (!me) {
          if (m.t !== 'hello') return;
          me = 1;
          fs.deliver({ t: 'welcome', id: 1, role: 'host', ver: VER, urls: [], hostId: 1 });
          setTimeout(() => {
            setStatus('Hosting online! Your join code is ' + NET.code + '.', '#80e080');
            toast('Hosting online', 'join code ' + NET.code, '#80e080', 'ui');
          }, 30);
          return;
        }
        if (m.t === 'save') { onlineDiskSave(m.data); return; }
        m.from = 1;
        const out = JSON.stringify(m);
        if (Number.isInteger(m.to)) { const c = conns.get(m.to); if (c && c.ok) tx(c, out); }
        else for (const c of live()) tx(c, out);
      };
      fs.close = () => {
        if (fs._closed) return;
        clear();
        for (const c of live()) tx(c, { t: 'hostleft', name: NET.name });
        for (const q of NET.joinAsk) clearTimeout(q.timer);
        NET.joinAsk = [];                         /* the code dies with the session: the PeerJS id is released */
        const rp = rjPeer; rjPeer = null;
        setTimeout(() => { try { peer && peer.destroy(); } catch (e) {} try { rp && rp.destroy(); } catch (e) {} }, 250);
        fs.finish();
      };
      NET.online.peers = () => live().length;
      open();
    }

    function startJoin(Peer) {
      let conn = null, opened = false;
      const rjTo = NET.online.rj || '', who = rjTo ? (NET.online.rjName || 'your friend') : code;
      peer = new Peer(iceOpts());
      timer = setTimeout(() => {
        if (opened) return;
        fs.fail(peer && peer.open ? 'nohost' : 'online', peer && peer.open
          ? 'Could not connect to ' + who + '. A strict router or firewall may block it; try again.'
          : 'Could not reach the online join service. Check your internet and try again.');
      }, 25000);
      peer.on('open', () => {
        conn = peer.connect(rjTo ? ON_PREFIX + 'r-' + rjTo : ON_PREFIX + code, { reliable: true });
        conn.on('open', () => { opened = true; clear(); fs.readyState = 1; if (fs.onopen) fs.onopen({}); });
        conn.on('data', d => { if (typeof d !== 'string' || d.length > SEC.maxHostMsg) return secDrop('size'); fs.deliver(d); });
        conn.on('close', () => fs.finish());
        conn.on('error', () => { if (!opened) return; fs.finish(); });
        conn.on('iceStateChanged', s => { if (s === 'failed' && !opened) { clear(); fs.fail('nohost', 'Could not connect to ' + who + ': the network blocked the connection. Try again, or another network.'); } });
      });
      peer.on('error', err => {
        const ty = err && err.type;
        if (ty === 'peer-unavailable' && rjTo) { clear(); fs.fail('nohost', HOST_AWAY); return; }
        if (ty === 'peer-unavailable') { clear(); fs.fail('nohost', 'No game with code ' + code + '. Check the code, and that your friend clicked Host online.'); return; }
        if (!opened) { clear(); fs.fail('online', 'Online join failed (' + (ty || 'error') + '). Check your internet and try again.'); }
      });
      fs.send = str => { if (fs.readyState === 1 && conn && conn.open) { try { conn.send(str); } catch (e) {} } };
      fs.close = () => { if (fs._closed) return; clear(); try { peer && peer.destroy(); } catch (e) {} fs.finish(); };
    }
    fs.send = () => {}; fs.close = () => { clear(); try { peer && peer.destroy(); } catch (e) {} fs.finish(); };
    return fs;
  }
  function onlineDiskSave(data) {
    if (typeof data !== 'string') return;
    if (APP && !isHttp) { try { APP.save.writeSync(data); } catch (e) {} return; }
    if (isHttp && !noServe) try { fetch('/save', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: data, keepalive: data.length < 63000 }); } catch (e) {}
  }
  NET.hostOnline = function (again) {
    if (DISK.peerOwned) { DISK.peerOwned = false; DISK.on = true; }
    const ag = again && typeof again === 'object' ? again : null;
    NET.hostLeft = false; NET.code = ag && cleanCode(ag.code).length === 6 ? cleanCode(ag.code) : newCode(); NET.online = { code: NET.code, hideIp: ag ? hideOn(!!ag.hide) : hideOn() };
    connect('host'); ipNote();
  };
  NET.joinOnline = function (code) {
    code = cleanCode(code != null ? code : NET.code);
    if (code.length !== 6) { setStatus('Type the 6-letter code your friend sees, then click Join online.', '#e0c060'); return false; }
    NET.code = code; NET.online = { code, hideIp: hideOn() }; NET.hostLeft = false; NET.retry = 0; NET.built = false;
    connect('join'); ipNote(); return true;
  };
  NET.isOnline = () => !!NET.online;
  /* v0.26.8b: say it once when an online game starts with Hide my IP off */
  function ipNote() {
    if (!RELAY_AVAILABLE) { toast('Direct online connection', 'players in this game can see your IP', '#ffd84a', 'ui'); return; }
    if (hideOn(NET.online && NET.online.hideIp != null ? NET.online.hideIp : null)) toast('Hide my IP is on', 'you connect through a relay', '#80e080', 'ui');
    else toast('Your IP is visible to players', 'turn on Hide my IP in Multiplayer', '#ffd84a', 'ui');
  }

  /* ---------------------------------------------------------------- menu (pause > Multiplayer) */
  NET.menuUI = function (mx, my) {
    if (!mouse.clicked) return;
    const hit = (x, y, w, h) => clickedBox(mx, my, x, y, w, h);
    if (NET.edit && !hit(120, 40, 150, 16) && !hit(210, 84, 150, 16) && !hit(210, 132, 70, 16)) finishEdit();
    if (NET.hostLeft) {
      if (hit(40, 200, 150, 18)) { NET.hostLeft = false; S.menu = 'pause'; closePause(); toast('Playing offline', 'your miner keeps saving on this computer', '#c8b89a', 'ui'); }
      else if (hit(210, 200, 150, 18)) backToMenu();
      mouse.clicked = false;
      return;
    }
    const off = NET.role === 'off';
    if (hit(40, 200, 80, 18)) { sfx('ui'); finishEdit(); S.menu = 'pause'; }
    else if (hit(120, 40, 150, 16) && off) { NET.edit = 'name'; }
    else if (hit(40, 62, 120, 18) && off) { sfx('ui'); finishEdit(); if (canHost) NET.host(); else setStatus('Hosting on Wi-Fi needs serve.py - or use Host online.', '#e0c060'); }
    else if (hit(40, 84, 120, 18) && off) { sfx('ui'); finishEdit(); NET.join(); }
    else if (hit(210, 84, 150, 16) && off) { NET.edit = 'addr'; }
    else if (hit(40, 110, 120, 18) && off) { sfx('ui'); finishEdit(); NET.hostOnline(); }
    else if (hit(40, 132, 120, 18) && off) { sfx('ui'); finishEdit(); if (!NET.joinOnline()) NET.edit = 'code'; }
    else if (hit(210, 132, 70, 16) && off) { NET.edit = 'code'; }
    else if (hit(130, 200, 140, 18) && !off) { sfx('ui'); NET.leave(); }
    mouse.clicked = false;
  };
  NET.drawMenu = function () {
    panelBg('MULTIPLAYER  -  play together on Wi-Fi or online');
    const off = NET.role === 'off', live = NET.role === 'host' || NET.role === 'client';
    const field = (x, y, w, val, on) => {
      g.fillStyle = on ? '#2a2014' : '#18120c'; g.fillRect(x, y, w, 16);
      g.strokeStyle = on ? '#e6c34a' : '#6a5030'; g.lineWidth = 1; g.strokeRect(x + 0.5, y + 0.5, w - 1, 15);
      text(fitText(val, w - 10, 7) + (on && (S.time * 2 | 0) % 2 ? '_' : ''), x + 5, y + 11, off ? '#f0e8d8' : '#a09080', 7);
    };
    if (NET.hostLeft) {
      text(NET.hostLeft.toUpperCase(), 40, 70, '#e0c060', 12);
      text('The host closed their game, so the shared world stopped.', 40, 92, '#e8e0d0', 7);
      text('Keep playing offline: you keep exploring a copy of that world right here.', 40, 108, '#c8b89a', 6);
      text('Your miner, bag and skills were saved on this computer and come back', 40, 118, '#c8b89a', 6);
      text('next time you join the same host.', 40, 128, '#c8b89a', 6);
      text('Back to menu: return to your own single-player burrow.', 40, 142, '#c8b89a', 6);
      drawMenuBtn(40, 200, 150, 18, 'Keep playing offline', true);
      drawMenuBtn(210, 200, 150, 18, 'Back to menu');
      return;
    }
    const onl = !!NET.online;
    text('Your name', 40, 52, '#c8b89a', 7);
    field(120, 40, 150, NET.name, NET.edit === 'name');
    if (off) text('click to type', 276, 51, '#806850', 6);
    drawMenuBtn(40, 62, 120, 18, 'Host game', NET.role === 'host' && !onl);
    text(canHost ? 'Wi-Fi: friends on your network join you.' : 'Wi-Fi hosting needs serve.py on this computer.', 170, 74, '#c8b89a', 6);
    drawMenuBtn(40, 84, 120, 18, 'Join game', NET.role === 'client' && !onl);
    text('Address', 170, 95, '#c8b89a', 6);
    field(210, 84, 150, NET.addr, NET.edit === 'addr');
    drawMenuBtn(40, 110, 120, 18, 'Host online', NET.role === 'host' && onl);
    text('Internet: get a 6-letter code for a friend.', 170, 122, '#c8b89a', 6);
    drawMenuBtn(40, 132, 120, 18, 'Join online', NET.role === 'client' && onl);
    text('Code', 170, 143, '#c8b89a', 6);
    field(210, 132, 70, NET.code, NET.edit === 'code');
    if (off) text('from your friend', 288, 143, '#806850', 6);
    const SY = RELAY_AVAILABLE ? 187 : 166;   /* v0.26.14: no Hide my IP box, so the status lines sit right under Join online */
    text(fitText(NET.status || (off ? 'Pick Host or Join.' : ''), 410, 7), 40, SY, NET.statusCol, 7);
    if (NET.role === 'host' && onl && NET.code) {
      text('Join code: ' + NET.code, 40, SY + 12, '#ffe080', 8);
      text('Friend: Multiplayer > type it > Join online', 150, SY + 12, '#c8b89a', 6);
    } else if (NET.role === 'host' && NET.urls.length) {
      text(fitText((APP && !isHttp ? 'Friends type this address in Join game: ' : 'Friends on your Wi-Fi open: ') + NET.urls.slice(0, 2).join('  '), 410, 7), 40, SY + 12, '#ffe080', 7);
    } else if (off && !isHttp && !APP) {
      text('Wi-Fi play needs serve.py on the host (see README). Online play with a code works without it.', 40, SY + 12, '#a09080', 6);
    } else if (off) {
      text('Online play: free PeerJS service, no account. Some strict networks block it; Wi-Fi always works.', 40, SY + 12, '#a09080', 6);
    }
    if (live) {
      const names = [NET.name + ' (you)'].concat([...NET.peers.values()].map(p => p.name));
      text(fitText('Players (' + names.length + '/4): ' + names.join(', '), 180, 6), 280, 212, '#c8b89a', 6);
    }
    drawMenuBtn(40, 200, 80, 18, 'Back');
    if (!off) drawMenuBtn(130, 200, 140, 18, NET.role === 'host' ? 'Stop hosting' : 'Leave multiplayer');
  };

  /* ---------------------------------------------------------------- auto-detect when served by serve.py */
  function openMpMenu() { if (!S) return; S.paused = true; S.menu = 'mp'; }
  async function autoStart() {
    if (APP && !isHttp) { await diskInit(); return; }
    if (!isHttp) return;
    await diskInit();
    if (noServe) return;
    let st = null;
    try { const r = await fetch('/mp/status', { cache: 'no-store' }); if (r.ok) st = await r.json(); } catch (err) {}
    if (!st || typeof st.host !== 'boolean') return;          // not served by serve.py
    NET.urls = st.urls || [];
    if (qs.get('host') === '1') return NET.host();
    if (qs.get('join') === '1') return NET.join();
    let noauto = false;
    try { noauto = sessionStorage.getItem('burrow_noauto') === '1'; } catch (err) {}
    const local = /^(localhost|127\.0\.0\.1|\[::1\])$/.test(location.hostname);
    if (st.ver !== VER) { setStatus('This page is ' + VER + ' but the server runs ' + st.ver + '. Refresh (Ctrl+F5).', '#e07070'); return; }
    if (!st.host && local && !noauto) NET.host();
    else if (st.host) { setStatus(st.hostName + ' is hosting. Click Join game.', '#80e080'); openMpMenu(); }
    else if (!noauto) { setStatus('Nobody is hosting yet. Click Host game to share your world.', '#c8b89a'); }
  }

  /* ---------------------------------------------------------------- v0.26.8: join requests, kick, privacy toggles (pause > Multiplayer) */
  try { const o = JSON.parse(localStorage.getItem('burrow_settings_v1') || 'null'); if (o && typeof o.mpAsk === 'boolean') SETTINGS.mpAsk = o.mpAsk; if (o && typeof o.mpHideIp === 'boolean') SETTINGS.mpHideIp = o.mpHideIp; } catch (e) {}
  if (typeof SETTINGS.mpAsk !== 'boolean') SETTINGS.mpAsk = true;
  if (typeof SETTINGS.mpHideIp !== 'boolean') SETTINGS.mpHideIp = false;
  /* v0.26.14: a later settings reload (defaults + merge) kept dropping the two co-op switches, and the next save then lost the
     saved Hide my IP key. Carry them through the merge (the switch stays hidden and ignored while RELAY_AVAILABLE is false). */
  if (typeof mergeSettings === 'function') { const _mrg = mergeSettings; mergeSettings = function (src) { const r = _mrg.apply(this, arguments);
    try { if (src && typeof src.mpAsk === 'boolean') SETTINGS.mpAsk = src.mpAsk; if (src && typeof src.mpHideIp === 'boolean') SETTINGS.mpHideIp = src.mpHideIp;
      if (typeof SETTINGS.mpAsk !== 'boolean') SETTINGS.mpAsk = true; if (typeof SETTINGS.mpHideIp !== 'boolean') SETTINGS.mpHideIp = false; } catch (e) {} return r; }; }
  NET.kick = function (id) {
    if (NET.role !== 'host' || !NET.peers.has(id)) return;
    if (NET.online && NET.online.kick) NET.online.kick(id);
    else { const p = NET.peers.get(id); NET.addKicked(p.key, p.name, '', 'kicked by the host'); send({ t: 'kick', id }); toast((p.name || 'A player') + ' was removed', 'by you', '#e07070', 'ui'); }
  };
  NET.answerJoin = function (allow, qq) {
    const q = qq || NET.joinAsk[0]; if (!q) return;
    if (q.lan) { lanAnswer(q, allow); return; }
    if (!NET.online || !NET.online.answer) return;
    sfx('ui'); NET.online.answer(q, allow);
    setStatus(allow ? q.name + ' is joining...' : 'You said no to ' + q.name + '.', allow ? '#80e080' : '#c8b89a');
  };
  /* v0.26.8b: 'Hide my IP' is a big switch right under Host online / Join online (it was a small checkbox), with a
     one-line explanation, and a yellow warning while you are in an online game with it off. 'Ask before join' moved
     to the right column; 'Kicked list' opens the host's list of kicked players (Unblock / Unblock all). */
  const MPT = { ask: { x: 372, y: 134, w: 86, h: 12 }, ip: { x: 40, y: 153, w: 418, h: 25 }, kl: { x: 372, y: 108, w: 86, h: 15 }, rg: { x: 372, y: 62, w: 86, h: 15 } };
  /* v0.26.9: Recent games list */
  const RG = { rows: RECENT_MAX, row: i => ({ y: 44 + i * 14, h: 12 }), rejoin: i => ({ x: 330, y: 44 + i * 14, w: 58, h: 12 }), remove: i => ({ x: 394, y: 44 + i * 14, w: 58, h: 12 }),
    back: { x: 40, y: 200, w: 80, h: 18 }, all: { x: 130, y: 200, w: 140, h: 18 } };
  NET.recentView = false; NET._rgSeen = 0;
  const ASK = { x: 96, y: 52, w: 288, h: 114, allow: { x: 130, y: 118, w: 100, h: 18 }, deny: { x: 250, y: 118, w: 100, h: 18 } };
  const kickBox = i => ({ x: 420, y: 42 + i * 15, w: 32, h: 12 });
  const KL = { rows: 8, row: i => ({ x: 372, y: 46 + i * 17, w: 76, h: 14 }), back: { x: 40, y: 200, w: 80, h: 18 }, all: { x: 130, y: 200, w: 140, h: 18 } };
  NET.secUI = { MPT, ASK, kickBox, KL, RG };
  NET.kickView = false; NET._kvSeen = 0;
  NET.ipWarn = () => RELAY_AVAILABLE && NET.role !== 'off' && !!NET.online && !(NET.online.hideIp != null ? NET.online.hideIp : SETTINGS.mpHideIp);
  function kickWhen(t) {
    if (!t) return '';
    const d = new Date(t), now = new Date();
    let hh = d.getHours(), ap = hh >= 12 ? 'PM' : 'AM'; hh = hh % 12 || 12;
    const tm = hh + ':' + String(d.getMinutes()).padStart(2, '0') + ' ' + ap;
    if (d.toDateString() === now.toDateString()) return 'today ' + tm;
    const M = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
    return M[d.getMonth()] + ' ' + d.getDate() + (d.getFullYear() !== now.getFullYear() ? ' ' + d.getFullYear() : '') + ', ' + tm;
  }
  NET.kickWhen = kickWhen;
  function klClick(mx, my) {
    if (!mouse.clicked) return;
    if (clickedBox(mx, my, KL.back.x, KL.back.y, KL.back.w, KL.back.h)) { sfx('ui'); NET.kickView = false; }
    else if (clickedBox(mx, my, KL.all.x, KL.all.y, KL.all.w, KL.all.h)) { sfx('ui'); NET.unblockAll(); }
    else {
      const L = NET.kicked.slice().reverse().slice(0, KL.rows);
      for (let i = 0; i < L.length; i++) { const b = KL.row(i); if (clickedBox(mx, my, b.x, b.y, b.w, b.h)) { sfx('ui'); NET.unblock(L[i]); break; } }
    }
    mouse.clicked = false;
  }
  function rgClick(mx, my) {
    if (!mouse.clicked) return;
    const hit = b => clickedBox(mx, my, b.x, b.y, b.w, b.h);
    if (hit(RG.back)) { sfx('ui'); NET.recentView = false; }
    else if (NET.recent.length && hit(RG.all)) { sfx('ui'); NET.recentClear(); setStatus('Recent games cleared.'); }
    else {
      const L = NET.recent.slice(0, RG.rows);
      for (let i = 0; i < L.length; i++) {
        if (hit(RG.rejoin(i))) { sfx('ui'); NET._rgT = nowMs(); NET.rejoin(L[i]); break; }
        if (hit(RG.remove(i))) { sfx('ui'); NET.recentRemove(L[i]); break; }
      }
    }
    mouse.clicked = false;
  }
  function smallBtn(b, label, mx, my, col) {
    const hov = hitBox(mx, my, b.x, b.y, b.w, b.h);
    if (hov) noteHover(b.x, b.y, b.w, b.h);
    g.fillStyle = col === 'red' ? (hov ? '#5a2018' : '#301410') : (hov ? '#1e4a26' : '#14301a'); g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeStyle = col === 'red' ? (hov ? '#ff8070' : '#a04838') : (hov ? '#90f0a0' : '#4a9a58'); g.lineWidth = 1; g.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    text(label, b.x + Math.max(3, Math.round((b.w - label.length * 4.2) / 2)), b.y + 9, col === 'red' ? '#ffd0c8' : '#d8ffd8', 6);
  }
  function drawRecent() {
    panelBg('RECENT GAMES  -  rejoin a friend');
    const mx = mouse.x / SCALE, my = mouse.y / SCALE;
    const L = NET.recent.slice(0, RG.rows);
    if (!L.length) {
      text('No recent games yet.', 40, 60, '#e8e0d0', 7);
      text('Games you join show up here (the last ' + RECENT_MAX + '), so you can rejoin a friend', 40, 76, '#c8b89a', 6);
      text('without a new code. They still get Allow / Deny every time.', 40, 86, '#c8b89a', 6);
    } else {
      text('Host', 40, 39, '#a09080', 6); text('Last played', 150, 39, '#a09080', 6); text('Type', 262, 39, '#a09080', 6);
      L.forEach((e, i) => {
        const r = RG.row(i), y = r.y + 9;
        if (i % 2 === 0) { g.fillStyle = 'rgba(255,240,200,0.04)'; g.fillRect(36, r.y - 1, 420, r.h + 2); }
        text(fitText(e.n || 'Host', 104, 7), 40, y, '#f0e8d8', 7);
        text(fitText(kickWhen(e.t), 106, 6), 150, y, '#c8b89a', 6);
        text(e.k === 'on' ? 'Online' : 'LAN', 262, y, e.k === 'on' ? '#a0d0ff' : '#e6c34a', 6);
        smallBtn(RG.rejoin(i), 'Rejoin', mx, my, 'green');
        smallBtn(RG.remove(i), 'Remove', mx, my, 'red');
      });
    }
    const fresh = NET._rgT && nowMs() - NET._rgT < 30000;
    if (fresh && NET.status) text(fitText(NET.status, 410, 6), 40, 192, NET.statusCol || '#c8b89a', 6);
    else text(lastInput === 'pad' ? 'D-pad to pick, A to press, B to go back.  The host still says Allow / Deny.' : 'The host still says Allow / Deny, and kicked players stay blocked.', 40, 192, '#a09080', 6);
    drawMenuBtn(RG.back.x, RG.back.y, RG.back.w, RG.back.h, 'Back');
    if (NET.recent.length) drawMenuBtn(RG.all.x, RG.all.y, RG.all.w, RG.all.h, 'Clear all (' + NET.recent.length + ')');
  }
  NET.drawRecent = drawRecent;
  const _menuUI = NET.menuUI;
  NET.menuUI = function (mx, my) {
    if (NET.kickView && !NET.hostLeft) return klClick(mx, my);
    if (NET.recentView && !NET.hostLeft && !NET.joinAsk.length) return rgClick(mx, my);
    if (NET.joinAsk.length && !NET.hostLeft) {
      if (pressed('Enter') || padJust.Enter || padJust[bindKey('pump')]) { delete padJust.Enter; delete padJust[bindKey('pump')]; just.Enter = false; NET.answerJoin(true); return; }
      if (pressed('Backspace') || pressed('n') || padJust[bindKey('eat')]) { just.Backspace = false; delete padJust[bindKey('eat')]; NET.answerJoin(false); return; }
      if (mouse.clicked) {
        if (clickedBox(mx, my, ASK.allow.x, ASK.allow.y, ASK.allow.w, ASK.allow.h)) NET.answerJoin(true);
        else if (clickedBox(mx, my, ASK.deny.x, ASK.deny.y, ASK.deny.w, ASK.deny.h)) NET.answerJoin(false);
        mouse.clicked = false;
      }
      return;
    }
    if (mouse.clicked && !NET.hostLeft && !NET.edit) {
      if (clickedBox(mx, my, MPT.ask.x, MPT.ask.y, MPT.ask.w, MPT.ask.h)) { SETTINGS.mpAsk = !SETTINGS.mpAsk; persistSettings(); sfx('ui'); mouse.clicked = false; return; }
      if (clickedBox(mx, my, MPT.kl.x, MPT.kl.y, MPT.kl.w, MPT.kl.h)) { sfx('ui'); NET.kickView = true; NET._kvSeen = nowMs(); mouse.clicked = false; return; }
      if (clickedBox(mx, my, MPT.rg.x, MPT.rg.y, MPT.rg.w, MPT.rg.h)) { sfx('ui'); NET.recentReload(); NET.recentView = true; NET._rgSeen = nowMs(); NET._rgT = 0; mouse.clicked = false; return; }
      if (RELAY_AVAILABLE && clickedBox(mx, my, MPT.ip.x, MPT.ip.y, MPT.ip.w, MPT.ip.h)) {
        sfx('ui'); mouse.clicked = false;
        if (NET.role === 'off') { SETTINGS.mpHideIp = !SETTINGS.mpHideIp; persistSettings(); }
        else setStatus('Hide my IP changes take effect next game: leave, then host or join again.', '#e0c060');
        return;
      }
      if (NET.role === 'host') {
        const ids = [...NET.peers.keys()];
        for (let i = 0; i < ids.length && i < 3; i++) { const b = kickBox(i); if (clickedBox(mx, my, b.x, b.y, b.w, b.h)) { sfx('ui'); NET.kick(ids[i]); mouse.clicked = false; return; } }
      }
    }
    return _menuUI(mx, my);
  };
  function drawKickedList() {
    panelBg('KICKED PLAYERS  -  they cannot join your games');
    const mx = mouse.x / SCALE, my = mouse.y / SCALE;
    const all = NET.kicked.slice().reverse(), L = all.slice(0, KL.rows);
    if (!L.length) {
      text('Nobody is on your kicked list.', 40, 60, '#e8e0d0', 7);
      text('When you kick someone from your game they show up here, and stay blocked', 40, 76, '#c8b89a', 6);
      text('(online and Wi-Fi, even after a restart) until you unblock them.', 40, 86, '#c8b89a', 6);
    } else {
      text('Name', 40, 40, '#a09080', 6); text('Kicked', 160, 40, '#a09080', 6);
      L.forEach((e, i) => {
        const b = KL.row(i), y = b.y + 10;
        if (i % 2 === 0) { g.fillStyle = 'rgba(255,240,200,0.04)'; g.fillRect(36, b.y - 1, 416, b.h + 2); }
        text(fitText(e.name || 'Miner', 112, 7), 40, y, '#f0e8d8', 7);
        text(fitText(kickWhen(e.t) + (e.why && e.why !== 'kicked by the host' ? '  (' + e.why + ')' : ''), 200, 6), 160, y, '#c8b89a', 6);
        const hov = hitBox(mx, my, b.x, b.y, b.w, b.h);
        g.fillStyle = hov ? '#1e4a26' : '#14301a'; g.fillRect(b.x, b.y, b.w, b.h);
        g.strokeStyle = hov ? '#90f0a0' : '#4a9a58'; g.lineWidth = 1; g.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        text('Unblock', b.x + 20, b.y + 10, '#d8ffd8', 7);
      });
      if (all.length > L.length) text('+ ' + (all.length - L.length) + ' more (Unblock all clears them too)', 40, 46 + KL.rows * 17 + 6, '#a09080', 6);
    }
    text('Unblocked players can ask to join again (you still Allow / Deny).', 40, 192, '#a09080', 6);
    drawMenuBtn(KL.back.x, KL.back.y, KL.back.w, KL.back.h, 'Back');
    if (NET.kicked.length) drawMenuBtn(KL.all.x, KL.all.y, KL.all.w, KL.all.h, 'Unblock all (' + NET.kicked.length + ')');
  }
  function drawHideIp(mx, my) {
    const b = MPT.ip, on = !!SETTINGS.mpHideIp, off = NET.role === 'off', warn = NET.ipWarn();
    const hov = hitBox(mx, my, b.x, b.y, b.w, b.h);
    g.fillStyle = on ? '#12261a' : warn ? '#2c2408' : hov ? '#261e12' : '#1c160e'; g.fillRect(b.x, b.y, b.w, b.h);
    g.strokeStyle = on ? '#60c070' : warn ? '#ffd84a' : hov ? '#c8a050' : '#8a6840'; g.lineWidth = 1; g.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
    const sx = b.x + 6, sy = b.y + 4, sw = 28, sh = 11;      /* the switch */
    g.fillStyle = on ? '#3a9a4c' : '#5a4630'; g.fillRect(sx, sy, sw, sh);
    g.strokeStyle = on ? '#a0f0b0' : '#a08868'; g.strokeRect(sx + 0.5, sy + 0.5, sw - 1, sh - 1);
    g.fillStyle = '#f0e8d8'; g.fillRect(on ? sx + sw - 11 : sx + 2, sy + 2, 9, sh - 4);
    text(on ? 'ON' : 'OFF', on ? sx + 3 : sx + 12, sy + 8, on ? '#e8ffe8' : '#e8d8c0', 6);
    text('Hide my IP', sx + sw + 6, b.y + 12, on ? '#a0f0a0' : '#ffe080', 8);
    const lon = !off && NET.online ? !!NET.online.hideIp : on;
    const tail = !off && NET.online ? (lon ? 'on for this game: players see the relay, not you' : 'off for this game (switch applies next game)') : !off ? 'changes apply to your next online game' : on ? 'on: other players see the relay, not you' : 'off: direct link, other players can see your IP';
    text(tail, sx + sw + 66, b.y + 12, off ? (on ? '#90d0a0' : '#c8b89a') : '#a09080', 6);
    if (warn) text('Your IP is visible to players in this game. Turn on Hide my IP to hide it.', b.x + 6, b.y + 22, '#ffd84a', 6);
    else if (NET.role !== 'off' && !NET.online) text('Hide my IP is for online games. Wi-Fi games stay on your own network.', b.x + 6, b.y + 22, '#c8b89a', 6);
    else text('Hide my IP: connect through a relay so other players can\'t see your IP address (may add a little lag).', b.x + 6, b.y + 22, '#c8b89a', 6);
  }
  NET.drawHideIp = drawHideIp;
  const _drawMenu = NET.drawMenu;
  NET.drawMenu = function () {
    if (NET.kickView && nowMs() - NET._kvSeen > 400) NET.kickView = false;      /* left the menu (Esc / B) */
    if (NET.kickView && !NET.hostLeft) { NET._kvSeen = nowMs(); return drawKickedList(); }
    if (NET.joinAsk.length) NET.joinAsk = NET.joinAsk.filter(q => !q.lan || (NET.role === 'host' && !NET.online));
    if (NET.recentView && nowMs() - NET._rgSeen > 400) NET.recentView = false;
    if (NET.recentView && !NET.hostLeft && !NET.joinAsk.length) { NET._rgSeen = nowMs(); return drawRecent(); }
    _drawMenu.apply(this, arguments);
    if (NET.hostLeft) return;
    const mx = mouse.x / SCALE, my = mouse.y / SCALE;
    const ah = hitBox(mx, my, MPT.ask.x, MPT.ask.y, MPT.ask.w, MPT.ask.h), askOn = SETTINGS.mpAsk !== false;
    text(drawChk(askOn) + ' Ask before join', MPT.ask.x, MPT.ask.y + 9, askOn ? '#e6c34a' : ah ? '#ffe080' : '#e8e0d0', 6);
    if (RELAY_AVAILABLE) drawHideIp(mx, my);
    const n = NET.kicked.length;
    drawMenuBtn(MPT.kl.x, MPT.kl.y, MPT.kl.w, MPT.kl.h, 'Kicked list' + (n ? ' (' + n + ')' : ''));
    const rn = NET.recent.length;
    drawMenuBtn(MPT.rg.x, MPT.rg.y, MPT.rg.w, MPT.rg.h, 'Recent games' + (rn ? ' (' + rn + ')' : ''));
    if (NET.role === 'host') {
      const L = [...NET.peers.values()].slice(0, 3);
      L.forEach((p, i) => {
        const b = kickBox(i), hov = hitBox(mx, my, b.x, b.y, b.w, b.h);
        text(fitText(p.name || '?', 44, 6), 372, b.y + 9, p.col || '#c8b89a', 6);
        g.fillStyle = hov ? '#5a2018' : '#301410'; g.fillRect(b.x, b.y, b.w, b.h);
        g.strokeStyle = hov ? '#ff8070' : '#a04838'; g.lineWidth = 1; g.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
        text('Kick', b.x + 6, b.y + 9, '#ffd0c8', 6);
      });
    }
    const q = NET.joinAsk[0];
    if (q) {
      g.fillStyle = 'rgba(0,0,0,0.55)'; g.fillRect(0, 0, VW, VH);
      g.fillStyle = '#20160c'; g.fillRect(ASK.x, ASK.y, ASK.w, ASK.h);
      g.strokeStyle = '#e6c34a'; g.lineWidth = 1; g.strokeRect(ASK.x + 0.5, ASK.y + 0.5, ASK.w - 1, ASK.h - 1);
      text(fitText(q.name + ' wants to join', ASK.w - 24, 10), ASK.x + 12, ASK.y + 20, '#ffe080', 10);
      text('Only let in people you know. They can dig and build in your world.', ASK.x + 12, ASK.y + 36, '#c8b89a', 6);
      const left = Math.max(0, 30 - Math.floor((nowMs() - q.t) / 1000));
      text('No answer in ' + left + ' s = Deny.' + (NET.joinAsk.length > 1 ? '  (' + (NET.joinAsk.length - 1) + ' more waiting)' : ''), ASK.x + 12, ASK.y + 48, '#a09080', 6);
      drawMenuBtn(ASK.allow.x, ASK.allow.y, ASK.allow.w, ASK.allow.h, 'Allow', true);
      drawMenuBtn(ASK.deny.x, ASK.deny.y, ASK.deny.w, ASK.deny.h, 'Deny');
      text(lastInput === 'pad' ? 'A = Allow    X = Deny' : 'Enter = Allow    N = Deny', ASK.x + 12, ASK.y + 106, '#a08868', 6);
    }
  };

  /* ---------------------------------------------------------------- v0.26.11: auto-resume hosting
     If you were hosting (Wi-Fi or online) when the game closed - an update, a quit or a crash - and you did not press
     Stop hosting, loading the same world again starts hosting again by itself, with the same rejoin id (Recent games >
     Rejoin keeps working) and the same join code when it is still free. Hide my IP, Allow / Deny and the Kicked list stay
     as they were. Kept in its own key (burrow_mp_host), never the save or settings keys. Friends see 'Host is updating -
     rejoining...' and keep trying for about 2 minutes (Cancel stops it). Players who were in your game in the last
     10 minutes get back in without a new Allow / Deny (switch: Let recent players back in). */
  const RESUME_K = 'burrow_mp_host', OKREC_K = 'burrow_mp_okrecent', OK_MS = 600000;
  NET.AWAY_MS = 120000;
  try { const o = JSON.parse(localStorage.getItem('burrow_settings_v1') || 'null'); if (o && typeof o.mpResume === 'boolean') SETTINGS.mpResume = o.mpResume; if (o && typeof o.mpAutoOk === 'boolean') SETTINGS.mpAutoOk = o.mpAutoOk; } catch (e) {}
  if (typeof SETTINGS.mpResume !== 'boolean') SETTINGS.mpResume = true;
  if (typeof SETTINGS.mpAutoOk !== 'boolean') SETTINGS.mpAutoOk = true;
  function resumeRead() {
    try {
      const r = JSON.parse(localStorage.getItem(RESUME_K) || 'null');
      return r && r.v === 1 && (r.k === 'on' || r.k === 'lan') && typeof r.w === 'string' && r.w.length <= 40 ? r : null;
    } catch (e) { return null; }
  }
  function resumeWrite() {
    if (NET.role !== 'host' || !S || !S.worldId) return;
    const r = { v: 1, k: NET.online ? 'on' : 'lan', w: S.worldId, code: NET.online ? cleanCode(NET.code) : '', hide: NET.online ? !!NET.online.hideIp : hideOn(), t: Date.now() };
    try { localStorage.setItem(RESUME_K, JSON.stringify(r)); } catch (e) {}
  }
  function resumeClear() { try { localStorage.removeItem(RESUME_K); } catch (e) {} }
  NET.resumeRead = resumeRead; NET.resumeClear = resumeClear;
  /* players let in recently (install ids), refreshed while they are in the game */
  function okLoad() {
    try { const o = JSON.parse(localStorage.getItem(OKREC_K) || '{}'); const out = {}, now = Date.now(); if (o && typeof o === 'object') for (const k in o) { const ck = cleanKey(k); if (ck && now - (+o[k] || 0) < OK_MS) out[ck] = +o[k]; } return out; } catch (e) { return {}; }
  }
  let OKREC = okLoad();
  function okSave() { try { localStorage.setItem(OKREC_K, JSON.stringify(OKREC)); } catch (e) {} }
  NET.okRemember = function (key) { key = cleanKey(key); if (!key) return; OKREC[key] = Date.now(); okSave(); };
  NET.autoOk = function (key) {
    key = cleanKey(key);
    if (!key || SETTINGS.mpAutoOk === false || NET.kickedHas(key) || SEC.banned.has(key)) return false;
    const t = OKREC[key]; return !!t && Date.now() - t < OK_MS;
  };
  /* Stop hosting = no resume, and friends are told it is over */
  const _rsLeave = NET.leave;
  NET.leave = function () {
    if (NET.role === 'host' || (NET.role === 'connecting' && NET.connRole === 'host')) { resumeClear(); send({ t: 'bye', back: 0 }); }
    return _rsLeave.apply(this, arguments);
  };
  function hostClosing() { if (NET.role === 'host') { if (SETTINGS.mpResume !== false) resumeWrite(); else resumeClear(); send({ t: 'bye', back: SETTINGS.mpResume !== false ? 1 : 0 }); } }
  window.addEventListener('beforeunload', hostClosing);
  window.addEventListener('pagehide', hostClosing);
  /* joiner side */
  NET.away = null; NET.awayWhy = ''; NET.hostBack = null;
  NET.awayOk = () => NET.role === 'client' && NET.built && NET.hostBack !== 0 && !NET.kickedMsg && NET.retry < 99;
  NET.hostAway = function (lost) {
    NET.away = { t0: nowMs(), upd: NET.hostBack === 1 || !lost };
    NET.awayWhy = '';
    if (NET.ws) { NET.wantClose = true; try { NET.ws.close(); } catch (e) {} NET.ws = null; NET.wantClose = false; }
    NET.retry = 1; NET.retryT = 3;
    if (NET.online && NET.hostRj) { NET.online.rj = NET.hostRj; NET.online.rjName = NET.hostName; }   /* the rejoin id survives a new code */
    NET.peers.clear();
    setStatus(awayText(), '#e0c060');
    toast(NET.away.upd ? 'Host is updating' : 'Lost the host', 'rejoining...', '#e0c060', 'ui');
  };
  function awayText() { return (NET.away && NET.away.upd ? 'Host is updating' : 'Host connection lost') + ' - rejoining...'; }
  NET.awayText = awayText;
  NET.awayLeft = () => NET.away ? Math.max(0, Math.ceil((NET.AWAY_MS - (nowMs() - NET.away.t0)) / 1000)) : 0;
  NET.cancelAway = function () {
    if (!NET.away) return;
    NET.away = null; NET.retry = 99;
    hostGone('Stopped rejoining');
  };
  const AWB = { x: VW / 2 - 110, y: 24, w: 220, h: 30, cancel: { x: VW / 2 + 48, y: 33, w: 56, h: 14 } };
  NET.awayUI = AWB;
  /* host side: restart hosting once the same world is loaded */
  NET._rsT0 = nowMs(); NET._rsDone = false; NET._okT = 0; NET._rsT = 0;
  function resumeCheck() {
    if (NET._rsDone || nowMs() - NET._rsT0 < 1500 || nowMs() - NET._rsT < 1000) return;
    NET._rsT = nowMs();
    if (!S || !S.p || S.charSel || S.sizeAsk || NET.mpWorld || NET.role !== 'off') return;
    const r = resumeRead();
    if (!r || SETTINGS.mpResume === false) { NET._rsDone = true; return; }
    if (!S.worldId || r.w !== S.worldId) return;          /* a different world: wait until the hosted one is loaded */
    NET._rsDone = true;
    NET._resumed = r.k;
    if (r.k === 'on') NET.hostOnline({ code: r.code, hide: r.hide });
    else { if (!canHost) return; NET.host(); }
    setTimeout(() => toast('Hosting again - friends can rejoin', r.k === 'on' ? 'same rejoin id' + (r.code ? ', code ' + r.code + ' if free' : '') : 'same Wi-Fi address', '#80e080', 'ui'), 400);
  }
  NET.resumeCheck = resumeCheck;
  const _rsTick = NET.tick;
  NET.tick = function (raw) {
    try {
      resumeCheck();
      if (NET.role !== 'host') NET._rsW = false;
      else if (!NET._rsW || nowMs() - NET._okT > 15000) {
        NET._okT = nowMs(); NET._rsW = true;
        if (SETTINGS.mpResume !== false) resumeWrite();
        let n = 0; for (const pe of NET.peers.values()) if (pe.key) { OKREC[cleanKey(pe.key)] = Date.now(); n++; }
        if (n) okSave();
      }
      if (NET.away && mouse.clicked) {
        const mx = mouse.x / SCALE, my = mouse.y / SCALE, b = AWB.cancel;
        if (clickedBox(mx, my, b.x, b.y, b.w, b.h)) { mouse.clicked = false; sfx('ui'); NET.cancelAway(); }
      }
      if (NET.away && NET.role === 'client' && !NET.ws) {
        if (nowMs() - NET.away.t0 >= NET.AWAY_MS) { NET.away = null; hostGone("Host didn't come back"); }
        else setStatus(awayText() + ' (' + NET.awayLeft() + ' s)', '#e0c060');
      }
    } catch (e) { console.warn('resume', e); }
    return _rsTick.apply(this, arguments);
  };
  /* players admitted count as recently let in */
  const _rsHud = drawHUD;
  drawHUD = function () {
    const r = _rsHud.apply(this, arguments);
    if (NET.away && NET.role === 'client') {
      const b = AWB, c = b.cancel, mx = mouse.x / SCALE, my = mouse.y / SCALE, hov = hitBox(mx, my, c.x, c.y, c.w, c.h);
      g.fillStyle = 'rgba(20,14,8,0.88)'; g.fillRect(b.x, b.y, b.w, b.h);
      g.strokeStyle = '#e0c060'; g.lineWidth = 1; g.strokeRect(b.x + 0.5, b.y + 0.5, b.w - 1, b.h - 1);
      text(NET.away.upd ? 'Host is updating - rejoining...' : 'Host connection lost - rejoining...', b.x + 8, b.y + 12, '#ffe080', 7);
      text('trying for ' + NET.awayLeft() + ' s more', b.x + 8, b.y + 23, '#c8b89a', 6);
      g.fillStyle = hov ? '#5a2018' : '#301410'; g.fillRect(c.x, c.y, c.w, c.h);
      g.strokeStyle = hov ? '#ff8070' : '#a04838'; g.strokeRect(c.x + 0.5, c.y + 0.5, c.w - 1, c.h - 1);
      text('Cancel', c.x + 14, c.y + 10, '#ffd0c8', 6);
    }
    return r;
  };
  /* menu switches (pause > Multiplayer, right column) */
  const RSB = { rs: { x: 372, y: 86, w: 86, h: 10 }, ok: { x: 372, y: 97, w: 86, h: 10 } };
  NET.secUI.RSB = RSB;
  const _rsMenuUI = NET.menuUI;
  NET.menuUI = function (mx, my) {
    if (mouse.clicked && !NET.hostLeft && !NET.kickView && !NET.recentView && !NET.joinAsk.length) {
      if (clickedBox(mx, my, RSB.rs.x, RSB.rs.y, RSB.rs.w, RSB.rs.h)) { SETTINGS.mpResume = !SETTINGS.mpResume; if (!SETTINGS.mpResume) resumeClear(); else resumeWrite(); persistSettings(); sfx('ui'); mouse.clicked = false; return; }
      if (clickedBox(mx, my, RSB.ok.x, RSB.ok.y, RSB.ok.w, RSB.ok.h)) { SETTINGS.mpAutoOk = !SETTINGS.mpAutoOk; persistSettings(); sfx('ui'); mouse.clicked = false; return; }
    }
    if (NET.away && mouse.clicked && clickedBox(mx, my, 130, 200, 140, 18)) { mouse.clicked = false; sfx('ui'); NET.cancelAway(); return; }
    return _rsMenuUI.apply(this, arguments);
  };
  const _rsDrawMenu = NET.drawMenu;
  NET.drawMenu = function () {
    const r = _rsDrawMenu.apply(this, arguments);
    if (NET.hostLeft || NET.kickView || NET.recentView || NET.joinAsk.length) return r;
    const mx = mouse.x / SCALE, my = mouse.y / SCALE;
    const a = SETTINGS.mpResume !== false, b = SETTINGS.mpAutoOk !== false;
    const ha = hitBox(mx, my, RSB.rs.x, RSB.rs.y, RSB.rs.w, RSB.rs.h), hb = hitBox(mx, my, RSB.ok.x, RSB.ok.y, RSB.ok.w, RSB.ok.h);
    text(drawChk(a) + ' Resume hosting', RSB.rs.x, RSB.rs.y + 8, a ? '#e6c34a' : ha ? '#ffe080' : '#e8e0d0', 6);
    text(drawChk(b) + ' Recent back in', RSB.ok.x, RSB.ok.y + 8, b ? '#e6c34a' : hb ? '#ffe080' : '#e8e0d0', 6);
    if (ha) text('Resume hosting after restart: if the game closes while you host, hosting starts again', 40, 150, '#ffe080', 6);
    else if (hb) text('Players from your game in the last 10 minutes rejoin without Allow / Deny (not kicked ones)', 40, 150, '#ffe080', 6);
    return r;
  };
  /* v0.26.27 (Steam Deck): type in the Multiplayer fields with a controller. The fields are pad targets (A starts
     typing). While typing: D-pad / stick up-down changes the current letter, right (or A) adds a letter, left (or X)
     deletes, B stops typing. On the join code, A with all 6 letters presses Join online. The pad's menu highlight
     pauses meanwhile. (Steam's own keyboard, Steam + X, types into the fields too.) */
  if (typeof pollGamepad === 'function' && typeof pnavMenu === 'function') {
    const PAD_ABC = { code: CODE_ABC, name: 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789 ', addr: '0123456789.:abcdefghijklmnopqrstuvwxyz-' };
    const PAD_MAX = { code: 6, name: 16, addr: 40 };
    const padTyping = () => !!(NET.edit && PAD_ABC[NET.edit] && S && S.paused && S.menu === 'mp' && NET.role === 'off' && lastInput === 'pad');
    const _ncMenu = pnavMenu;
    pnavMenu = function () { if (padTyping()) return null; return _ncMenu.apply(this, arguments); };
    const _ncPoll = pollGamepad;
    pollGamepad = function () {
      const r = _ncPoll.apply(this, arguments);
      try {
        if (padTyping() && PADB.ok) {
          const J = PADB.just || [], fld = NET.edit, ABC = PAD_ABC[fld], MAX = PAD_MAX[fld];
          const up = padJust.w || J[12], dn = padJust.s || J[13], lf = padJust.a || J[14] || J[2], rt = padJust.d || J[15];
          let c = fld === 'code' ? cleanCode(NET[fld]) : String(NET[fld] || '');
          const bump = d => { if (!c.length) { c = ABC[0]; return; } const i = ABC.indexOf(c[c.length - 1]); c = c.slice(0, -1) + ABC[((i < 0 ? 0 : i) + d + ABC.length) % ABC.length]; };
          if (J[1]) { sfx('ui'); NET[fld] = c; finishEdit(); }
          else if (J[0] && fld === 'code' && c.length === 6) { sfx('ui'); NET.code = c; finishEdit(); NET.joinOnline(); }
          else {
            if (up) bump(-1); else if (dn) bump(1);
            else if (lf) c = c.slice(0, -1);
            else if ((rt || J[0]) && c.length < MAX) c += fld === 'name' && /[A-Za-z]$/.test(c) ? 'a' : ABC[0];
            if (c !== NET[fld]) { NET[fld] = c; sfx('ui'); }
          }
          if (J[1] && typeof just !== 'undefined') just.Escape = false;   /* the v0.26.0 'pad B = Esc' hook must not also leave the menu */
          for (const k in padJust) delete padJust[k];
          for (const k of ['w', 'a', 's', 'd']) delete padHeld[k];
          PADB.just = (PADB.just || []).map(() => false);   /* B / A were used for typing: nothing else acts on them this frame */
        }
      } catch (e) {}
      return r;
    };
    const _ncDraw = NET.drawMenu;
    NET.drawMenu = function () {
      const r = _ncDraw.apply(this, arguments);
      try {
        if (!NET.hostLeft && NET.role === 'off' && typeof PNAV_REC !== 'undefined' && PNAV_REC && typeof pnAdd === 'function') { pnAdd(120, 40, 150, 16); pnAdd(210, 84, 150, 16); pnAdd(210, 132, 70, 16); }
        if (padTyping() && !NET.hostLeft) text('Pad: Up/Down letter   Right add   Left delete   B done' + (NET.edit === 'code' ? '   A join (6 letters)' : ''), 40, 157, '#e6c34a', 6);
      } catch (e) {}
      return r;
    };
  }
  setTimeout(autoStart, 50);
  window.addEventListener('beforeunload', () => { if (NET.role === 'client' || NET.role === 'offline') savePlayer(); });
})();
