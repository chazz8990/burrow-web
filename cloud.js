/* ================= v0.26.30: cloud saves with a device handoff lock =================
   Play the same burrow on the PC, the Legion Go and a phone - one device at a time.
   - Settings > Cloud makes a private sync code (130 random bits). Typing that code on another device links it.
     No accounts, no passwords. The code is the key, so keep it private.
   - A device holds a "lease" while it plays (2 minutes, renewed every 30 s). Opening the burrow on a second device
     asks "Playing on <device> - Take over?". After a take-over the first device is told "Continued on <device>"
     and stops without uploading anything.
   - Uploads are versioned: the server refuses a save that is not based on its newest version, so an old copy
     can never overwrite a newer one. If both changed (offline play), the game asks which one to keep.
   - The server keeps the last 5 versions (Settings > Cloud > Restore backup).
   - Co-op guests never sync (only the host's own save does). The device settings (keys, graphics, touch) stay per device.
   Server: Cloudflare Worker + Durable Object, see /workspace/burrow-cloud. */
(function () {
  'use strict';
  if (typeof S === 'undefined' || typeof saveGame !== 'function') return;
  const DEF_URL = 'https://burrow-cloud.chazz8990.workers.dev';
  const CFG_KEY = 'burrow_cloud_v1';
  const BEAT_MS = 30000, UP_GAP_MS = 25000, CLAIM_TIMEOUT = 6000, REQ_TIMEOUT = 12000, MAX_UP = 1900000;
  const AL = '0123456789ABCDEFGHJKMNPQRSTVWXYZ';
  const CODE_RE = /^[0-9A-HJKMNP-TV-Z]{26}$/;
  /* tests can point a local copy of the server at 127.0.0.1 only (never any other host) */
  function baseUrl() {
    try { const u = localStorage.getItem('burrow_cloud_url'); if (u && /^http:\/\/127\.0\.0\.1:\d{2,5}$/.test(u)) return u; } catch (e) {}
    return DEF_URL;
  }
  const rndHex = n => Array.from(crypto.getRandomValues(new Uint8Array(n)), b => b.toString(16).padStart(2, '0')).join('');
  function newCode() { return Array.from(crypto.getRandomValues(new Uint8Array(26)), b => AL[b & 31]).join(''); }
  function normCode(s) {
    const c = String(s || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1');
    return CODE_RE.test(c) ? c : null;
  }
  const prettyCode = c => c ? c.match(/.{1,5}/g).join('-') : '';
  function guessName() {
    const ua = navigator.userAgent || '', tp = navigator.maxTouchPoints | 0;
    const sw = Math.max(screen.width, screen.height) * (devicePixelRatio || 1), sh = Math.min(screen.width, screen.height) * (devicePixelRatio || 1);
    if (/iPhone/.test(ua)) return 'iPhone';
    if (/iPad/.test(ua) || (/Macintosh/.test(ua) && tp > 1)) return 'iPad';
    if (/Android/.test(ua)) return /Mobile/.test(ua) ? 'Android phone' : 'Android tablet';
    if (/Linux/.test(ua) && (/SteamDeck|Valve/i.test(ua) || (Math.round(sw) === 1280 && Math.round(sh) === 800))) return 'Steam Deck';
    if (/Windows/.test(ua) && tp > 0 && ((Math.round(sw) === 2560 && Math.round(sh) === 1600) || (Math.round(sw) === 1920 && Math.round(sh) === 1200))) return 'Legion Go';
    return window.burrowNative ? 'PC' : 'PC (browser)';
  }
  function loadCfg() {
    let c = null;
    try { c = JSON.parse(localStorage.getItem(CFG_KEY) || 'null'); } catch (e) {}
    if (!c || typeof c !== 'object') c = {};
    if (!/^[a-f0-9]{32}$/.test(c.dev || '')) c.dev = rndHex(16);
    if (c.code && !normCode(c.code)) c.code = null;
    if (typeof c.name !== 'string' || !c.name) c.name = guessName();
    c.base = c.base | 0; c.dirty = !!c.dirty;
    return c;
  }
  const CL = window.BURROW_CLOUD = {
    cfg: loadCfg(), sess: rndHex(16), phase: 'boot', modal: null, busy: false, upBusy: false, lastBeat: 0, lastUp: 0, lastTry: 0,
    meta: null, since: 0, upKey: null, quiet: 0, pausedByUs: false, msg: '', msgT: 0, dom: null, showCode: false, sel: 0, btns: [], nextRetry: 0, waitT: 0
  };
  function saveCfg() { try { localStorage.setItem(CFG_KEY, JSON.stringify(CL.cfg)); } catch (e) {} }
  saveCfg();
  function isGuest() {
    if (/[?&]join=/.test(location.search)) return true;
    const N = window.NET;
    return !!(N && (N.mpWorld || N.role === 'client'));
  }
  function fmtT(ms) {
    if (!ms) return 'unknown';
    const d = new Date(ms), now = new Date();
    const t = d.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' });
    return d.toDateString() === now.toDateString() ? t : d.toLocaleDateString([], { month: 'short', day: 'numeric' }) + ', ' + t;
  }
  function note(m) { CL.msg = m; CL.msgT = performance.now(); }

  /* ---------- network ---------- */
  async function call(op, body, ms) {
    const ac = new AbortController(), t = setTimeout(() => ac.abort(), ms || REQ_TIMEOUT);
    try {
      const r = await fetch(baseUrl() + '/v1/' + op, { method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store',
        headers: { 'Content-Type': 'text/plain' }, body: JSON.stringify(Object.assign({ code: CL.cfg.code, dev: CL.cfg.dev, sess: CL.sess, name: CL.cfg.name }, body || {})), signal: ac.signal });
      const ct = r.headers.get('content-type') || '';
      if (ct.includes('json')) return { s: r.status, j: await r.json() };
      return { s: r.status, bin: new Uint8Array(await r.arrayBuffer()), ver: +(r.headers.get('X-Burrow-Ver') || 0), at: +(r.headers.get('X-Burrow-At') || 0), enc: r.headers.get('X-Burrow-Enc') || 'raw', dev: decodeURIComponent(r.headers.get('X-Burrow-Dev') || '') };
    } catch (e) { return { s: 0, err: e && e.name }; }
    finally { clearTimeout(t); }
  }
  async function gzip(str) {
    if (typeof CompressionStream === 'undefined') return null;
    try { return new Uint8Array(await new Response(new Blob([str]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer()); } catch (e) { return null; }
  }
  async function gunzip(u8) {
    return await new Response(new Blob([u8]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  }
  const keyOf = json => json ? json.replace(/"savedAt":\d+,?/, '') : null;

  /* ---------- saves: block while stopped, mark "not synced" when something changed ---------- */
  function blocked() { return CL.phase === 'lost' || CL.phase === 'pulling'; }
  function counts() { return !!CL.cfg.code && !CL.quiet && (CL.phase === 'live' || CL.phase === 'offline'); }
  const _saveGame = saveGame;
  saveGame = function () {
    if (blocked()) return false;
    const ok = _saveGame.apply(this, arguments);
    if (ok && counts() && LAST_SAVE_JSON) {
      const k = keyOf(LAST_SAVE_JSON);
      if (k !== CL.upKey) { if (!CL.cfg.dirty) { CL.cfg.dirty = true; } CL.cfg.localAt = LAST_SAVE_AT; saveCfg(); }
      if (CL.phase === 'live' && CL.cfg.dirty && Date.now() - CL.lastTry > UP_GAP_MS) upload();
    }
    return ok;
  };
  function curSaveJson() {
    if (LAST_SAVE_JSON) return LAST_SAVE_JSON;
    try { return localStorage.getItem(SAVE_KEY); } catch (e) { return null; }
  }
  async function upload(opts) {
    opts = opts || {};
    if (!CL.cfg.code || CL.upBusy || (CL.phase !== 'live' && !opts.any)) return false;
    const json = curSaveJson(); if (!json) return false;
    CL.upBusy = true; CL.lastTry = Date.now();
    try {
      const k = keyOf(json), at = LAST_SAVE_AT || Date.now();
      let seed = null; try { seed = +(/"seed":(-?\d+)/.exec(json) || [])[1]; } catch (e) {}
      const small = (typeof compactSave === 'function' && compactSave(json)) || json;
      let body = await gzip(small), enc = 'gzip';
      if (!body) { body = new TextEncoder().encode(small); enc = 'raw'; }
      if (body.length > MAX_UP) { note('This save is too big for the cloud'); return false; }
      const keep = opts.keep || (CL.cfg.seed != null && seed != null && seed !== CL.cfg.seed);
      const base = opts.base != null ? opts.base : CL.cfg.base;
      const ac = new AbortController(), t = setTimeout(() => ac.abort(), REQ_TIMEOUT);
      let r;
      try {
        const res = await fetch(baseUrl() + '/v1/save', { method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', cache: 'no-store', signal: ac.signal,
          headers: { 'Content-Type': 'application/octet-stream', 'X-Burrow-Code': CL.cfg.code, 'X-Burrow-Dev': CL.cfg.dev, 'X-Burrow-Sess': CL.sess,
            'X-Burrow-Base': String(base), 'X-Burrow-At': String(at), 'X-Burrow-Enc': enc, 'X-Burrow-Keep': keep ? '1' : '0' }, body });
        r = { s: res.status, j: await res.json().catch(() => ({})) };
      } catch (e) { r = { s: 0 }; } finally { clearTimeout(t); }
      if (r.s === 200) {
        CL.meta = r.j; CL.cfg.base = r.j.v; CL.cfg.baseAt = at; CL.cfg.lastSync = Date.now(); CL.cfg.seed = seed;
        if (keyOf(curSaveJson()) === k) CL.cfg.dirty = false;
        CL.upKey = k; saveCfg();
        if (CL.phase === 'offline') CL.phase = 'live';
        return true;
      }
      if (r.s === 409 && r.j.err === 'lost') { lostTo(r.j.by); return false; }
      if (r.s === 409 && r.j.err === 'conflict') { CL.meta = r.j; showConflict(r.j); return false; }
      if (r.s === 413) { note('This save is too big for the cloud'); return false; }
      if (r.s === 429) { note('Cloud is busy, trying again soon'); return false; }
      goOffline(); return false;
    } finally { CL.upBusy = false; }
  }
  function goOffline() { if (CL.phase === 'live' || CL.phase === 'claiming') { CL.phase = 'offline'; CL.nextRetry = Date.now() + BEAT_MS; } }

  /* ---------- pull the cloud copy and load it ---------- */
  async function pullLoad(id) {
    const prev = CL.phase;
    CL.phase = 'pulling';
    try {
      const r = await call('pull', id != null ? { id } : {});
      if (r.s !== 200 || !r.bin) { CL.phase = prev; return r.s === 0 ? 'offline' : 'error'; }
      let txt = r.enc === 'gzip' ? await gunzip(r.bin) : new TextDecoder().decode(r.bin);
      let d = null; try { d = JSON.parse(txt); } catch (e) {}
      txt = null;
      if (!d || !validSaveData(d)) { CL.phase = prev; note('The cloud save would not load'); return 'error'; }
      delete d.settings;                   /* keys, graphics and touch settings stay with each device */
      try { if (S && S.p && S.tiles) keepOldSave(); } catch (e) {}
      if (!loadGameData(d, false)) { CL.phase = prev; try { loadGame(); } catch (e) {} note('The cloud save would not load'); return 'error'; }
      CL.phase = 'live'; CL.quiet++;
      try { _saveGame(); } finally { CL.quiet--; }
      CL.cfg.base = r.ver; CL.cfg.baseAt = r.at; CL.cfg.dirty = false; CL.cfg.lastSync = Date.now(); CL.cfg.seed = d.seed; CL.upKey = keyOf(LAST_SAVE_JSON); saveCfg();
      try { if (window.NET && NET.flushNow) NET.flushNow(); } catch (e) {}
      CL.pausedByUs = false;
      return 'ok:' + (r.dev || '') + ':' + r.at;
    } catch (e) { CL.phase = prev; return 'error'; }
  }

  /* ---------- lease ---------- */
  function pauseForUs() { if (S && !S.paused) { openPause(); CL.pausedByUs = true; } }
  function unpauseIfOurs() { if (CL.pausedByUs && S && S.paused && S.menu === 'pause') closePause(); CL.pausedByUs = false; }
  function closeModal() { CL.modal = null; }
  async function claim(force, why) {
    if (!CL.cfg.code || CL.busy) return;
    CL.busy = true; CL.phase = 'claiming';
    if (why !== 'retry' && why !== 'wait') { pauseForUs(); CL.modal = { kind: 'sync', title: 'Cloud saves', lines: ['Syncing with the cloud...'], btns: [] }; }
    try {
      const r = await call('claim', { force: !!force }, CLAIM_TIMEOUT);
      if (r.s === 0 || r.s >= 500 || r.s === 429) {
        if (why === 'wait' && CL.modal && CL.modal.kind === 'wait') { CL.phase = 'held'; return; }
        CL.phase = 'offline'; CL.nextRetry = Date.now() + BEAT_MS;
        if (why !== 'retry') { closeModal(); unpauseIfOurs(); toast('Cloud is offline', 'playing on this device - it syncs when it can', '#e0b060', 'ui'); }
        return;
      }
      if (r.s === 409 && r.j.held) { CL.meta = r.j; if (why === 'wait' && CL.modal && CL.modal.kind === 'wait') { CL.phase = 'held'; return; } showHeld(r.j.held); return; }
      if (r.s !== 200) { CL.phase = 'offline'; CL.nextRetry = Date.now() + BEAT_MS * 4; closeModal(); unpauseIfOurs(); note(r.s === 400 ? 'That sync code is not valid' : 'Cloud error ' + r.s); return; }
      CL.meta = r.j; CL.since = r.j.lease ? r.j.lease.since : Date.now(); CL.lastBeat = Date.now();
      await afterLease(r.j, why);
    } finally { CL.busy = false; }
  }
  async function afterLease(j, why) {
    const v = j.v | 0, base = CL.cfg.base | 0;
    if (v > base) {
      if (CL.cfg.dirty) { showConflict(j); return; }
      if (why !== 'retry' && why !== 'beat') {
        CL.modal = { kind: 'sync', title: 'Cloud saves', lines: ['Loading your burrow from the cloud...'], btns: [] };
        const res = await pullLoad();
        closeModal();
        if (String(res).startsWith('ok')) toast('Loaded from the cloud', 'saved on ' + (j.dev || 'another device') + ' at ' + fmtT(j.at), '#80e080', 'ui');
        else if (res === 'offline') { CL.phase = 'offline'; CL.nextRetry = Date.now() + BEAT_MS; }
        else CL.phase = 'live';
        unpauseIfOurs();
        return;
      }
      showConflict(j, true); return;   /* never swap the world under a running game without asking */
    }
    CL.phase = 'live';
    if (!CL.cfg.dirty) CL.upKey = keyOf(curSaveJson());
    if (v < base) { CL.cfg.base = v; CL.cfg.dirty = true; saveCfg(); }
    if (CL.modal && CL.modal.kind === 'sync') closeModal();
    unpauseIfOurs();
    if (CL.cfg.dirty) upload();
  }
  async function beat() {
    if (CL.phase !== 'live' || !CL.cfg.code) return;
    CL.lastBeat = Date.now();
    const r = await call('beat', { since: CL.since });
    if (CL.phase !== 'live') return;
    if (r.s === 200) { CL.meta = r.j; if (r.j.regained) { CL.since = r.j.lease.since; if ((r.j.v | 0) > (CL.cfg.base | 0)) showConflict(r.j, !CL.cfg.dirty); } return; }
    if (r.s === 409 && r.j.err === 'lost') { lostTo(r.j.by); return; }
    if (r.s === 0 || r.s >= 500) goOffline();
  }
  async function retryOffline() {
    if (CL.busy) return;
    CL.nextRetry = Date.now() + BEAT_MS;
    if (CL.since) {
      const r = await call('beat', { since: CL.since });
      if (r.s === 200) { CL.meta = r.j; CL.phase = 'live'; CL.lastBeat = Date.now(); if (r.j.regained) CL.since = r.j.lease.since;
        if ((r.j.v | 0) > (CL.cfg.base | 0)) showConflict(r.j, !CL.cfg.dirty); else if (CL.cfg.dirty) upload(); return; }
      if (r.s === 409 && r.j.err === 'lost') { lostTo(r.j.by); return; }
      return;
    }
    await claim(false, 'retry');
  }
  function release(beacon) {
    if (!CL.cfg.code || !(CL.phase === 'live' || CL.phase === 'offline')) return;
    const body = JSON.stringify({ code: CL.cfg.code, dev: CL.cfg.dev, sess: CL.sess });
    try {
      if (beacon && navigator.sendBeacon) { navigator.sendBeacon(baseUrl() + '/v1/release', new Blob([body], { type: 'text/plain' })); return; }
      fetch(baseUrl() + '/v1/release', { method: 'POST', mode: 'cors', credentials: 'omit', referrerPolicy: 'no-referrer', keepalive: true, headers: { 'Content-Type': 'text/plain' }, body }).catch(() => {});
    } catch (e) {}
  }
  function lostTo(by) {
    CL.phase = 'lost'; CL.cfg.dirty = false; saveCfg();
    try { for (const k in keys) keys[k] = false; mouse.down = false; } catch (e) {}
    if (S && !S.paused) openPause();
    CL.pausedByUs = false;
    const name = by || 'another device';
    const b = [{ label: 'Play here instead', hot: true, act: () => { closeModal(); CL.phase = 'boot'; claim(true, 'takeback'); } }];
    if (typeof quitOn === 'function' && quitOn()) b.push({ label: 'Quit', act: () => { closeModal(); try { S.quitting = true; NATIVE.quit(); } catch (e) {} } });
    CL.modal = { kind: 'lost', title: 'Continued on ' + name, lines: ['Your burrow is now being played on ' + name + '.', 'This device stopped and did not upload anything,', 'so nothing on ' + name + ' gets overwritten.'], btns: b, sel: 0, noEsc: true };
  }
  function showHeld(h) {
    CL.phase = 'held'; pauseForUs();
    const name = h.name || 'another device';
    const take = { label: 'Take over', hot: true, act: () => { closeModal(); claim(true, 'take'); } };
    CL.modal = { kind: 'held', title: 'Playing on ' + name, lines: ['Your burrow is open on ' + name + (h.since ? ' (since ' + fmtT(h.since) + ')' : '') + '.', 'Take over? ' + name + ' stops and this device continues.', 'Its last few seconds of play may not be saved.'],
      btns: [take, { label: 'Wait', act: () => { CL.modal = { kind: 'wait', title: 'Waiting for ' + name, lines: ['This device continues as soon as ' + name + ' quits.', 'Checking every 10 seconds...'], btns: [take, { label: 'Check now', act: () => { closeModal(); claim(false, 'wait'); } }], sel: 1, noEsc: true }; CL.waitT = Date.now(); } }],
      sel: 0, noEsc: true };
  }
  function showConflict(j, cloudOnly) {
    CL.phase = 'conflict'; pauseForUs();
    const localAt = CL.cfg.localAt || LAST_SAVE_AT || (SAVE_INFO && SAVE_INFO.bootSavedAt) || 0;
    const useCloud = { label: 'Use cloud', hot: !!cloudOnly, act: async () => {
      CL.modal = { kind: 'sync', title: 'Cloud saves', lines: ['Loading the cloud save...'], btns: [] };
      const res = await pullLoad();
      closeModal();
      if (String(res).startsWith('ok')) toast('Loaded from the cloud', 'this device\'s burrow is kept as a local backup', '#80e080', 'ui');
      else { CL.phase = 'offline'; CL.nextRetry = Date.now() + BEAT_MS; toast('Could not load the cloud save', 'still playing this device\'s burrow', '#e07070', 'ui'); }
      unpauseIfOurs();
    } };
    const keepLocal = { label: 'Keep this device', hot: !cloudOnly, act: async () => {
      CL.modal = { kind: 'sync', title: 'Cloud saves', lines: ['Uploading this device\'s burrow...'], btns: [] };
      CL.phase = 'live'; CL.quiet++; try { _saveGame(); } finally { CL.quiet--; }
      const ok = await upload({ base: j.v | 0, keep: true });
      if (CL.phase === 'lost' || CL.phase === 'conflict') return;
      closeModal();
      if (ok) toast('Cloud updated', 'the older cloud save is kept in Restore backup', '#80e080', 'ui');
      unpauseIfOurs();
    } };
    CL.modal = { kind: 'conflict', title: 'Two different saves', lines: [
      'This device:  ' + fmtT(localAt) + (CL.cfg.dirty ? '  (not synced)' : ''),
      'Cloud' + (j.dev ? ' (' + j.dev + ')' : '') + ':  ' + fmtT(j.at),
      'Pick the one to keep. The other one is kept as a backup.'], btns: [keepLocal, useCloud], sel: cloudOnly ? 1 : 0, noEsc: true, hi: [0, 1] };
  }

  /* ---------- timers ---------- */
  let wasGuest = false;
  setInterval(() => {
    try {
      if (!S || !S.p) return;
      if (!CL.cfg.code) { if (CL.phase !== 'off') CL.phase = 'off'; return; }
      const guest = isGuest();
      if (guest) { if (!wasGuest) { release(false); CL.phase = 'guest'; CL.modal = null; } wasGuest = true; return; }
      if (wasGuest) { wasGuest = false; CL.phase = 'boot'; }
      if (CL.phase === 'off') CL.phase = 'boot';
      const now = Date.now();
      if (CL.phase === 'boot') {
        if (S.charSel || S.nameEntry) return;
        if (window.NET && NET.disk && !NET.disk.ready) return;
        claim(false, 'boot'); return;
      }
      if (CL.phase === 'live' && now - CL.lastBeat > BEAT_MS) beat();
      if (CL.phase === 'offline' && now > CL.nextRetry) retryOffline();
      if (CL.modal && CL.modal.kind === 'wait' && now - CL.waitT > 10000) { CL.waitT = now; claim(false, 'wait'); }
    } catch (e) {}
  }, 1000);

  /* pause menu, quit and closing the window upload first */
  const _openPause = openPause;
  openPause = function () { const r = _openPause.apply(this, arguments); try { if (CL.phase === 'live' && CL.cfg.dirty && Date.now() - CL.lastTry > 8000) { CL.quiet = 0; saveGame(); upload(); } } catch (e) {} return r; };
  function flushAndRelease(maxMs) {
    if (!(CL.phase === 'live') || !CL.cfg.code) return null;
    return Promise.race([upload().then(() => { release(false); return true; }), new Promise(res => setTimeout(() => res(false), maxMs))]);
  }
  if (typeof burrowSaveAll === 'function') {
    const _bsa = burrowSaveAll;
    burrowSaveAll = function () {
      if (blocked()) return true;          /* this device lost the lease: nothing to save, just close */
      const ok = _bsa.apply(this, arguments);
      const p = flushAndRelease(3500);
      return p ? p.then(() => ok) : ok;    /* the v0.26.30 app waits for this promise (older apps do not) */
    };
  }
  if (typeof burrowQuitNow === 'function') {
    const _bqn = burrowQuitNow;
    burrowQuitNow = function () {
      if (!S || CL._quitting) return;
      if (CL.phase !== 'live') return _bqn.apply(this, arguments);
      CL._quitting = true; S.quitAsk = false;
      CL.modal = { kind: 'sync', title: 'Cloud saves', lines: ['Saving to the cloud...'], btns: [] };
      try { saveGame(); } catch (e) {}
      const p = flushAndRelease(4000) || Promise.resolve();
      p.then(() => { CL.modal = null; CL.phase = 'quit'; _bqn.apply(this, arguments); });
    };
  }
  const leave = () => { try { if (CL.phase === 'live' && CL.cfg.dirty) upload(); } catch (e) {} };
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden') leave(); });
  window.addEventListener('pagehide', () => { try { release(true); } catch (e) {} });

  /* ---------- modal popups (canvas) ---------- */
  function modalRect(m) { const h = 56 + m.lines.length * 11 + (m.btns.length ? 26 : 0); return { x: 90, y: Math.round((VH - h) / 2) - 8, w: 300, h }; }
  function modalBtns(m) {
    const r = modalRect(m), n = m.btns.length, bw = n > 2 ? 86 : 110, gap = 12, tot = n * bw + (n - 1) * gap;
    return m.btns.map((b, i) => ({ x: r.x + Math.round((r.w - tot) / 2) + i * (bw + gap), y: r.y + r.h - 28, w: bw, h: 18, b }));
  }
  function drawModal() {
    const m = CL.modal; if (!m) return;
    g.fillStyle = 'rgba(0,0,0,0.6)'; g.fillRect(0, 0, VW, VH);
    const r = modalRect(m);
    g.fillStyle = 'rgb(18,12,8)'; g.fillRect(r.x, r.y, r.w, r.h);
    g.strokeStyle = '#c8a050'; g.lineWidth = 2; g.strokeRect(r.x, r.y, r.w, r.h); g.lineWidth = 1;
    text(fitText(m.title, r.w - 28, 8), r.x + 14, r.y + 20, '#ffe8a8', 8);
    g.fillStyle = '#6a4828'; g.fillRect(r.x + 14, r.y + 25, r.w - 28, 1);
    m.lines.forEach((ln, i) => text(fitText(ln, r.w - 28, 7), r.x + 14, r.y + 40 + i * 11, m.hi && m.hi.includes(i) ? '#e8e0d0' : '#c8b89a', 7));
    if (!m.btns.length) { const dots = '.'.repeat(1 + ((performance.now() / 400) | 0) % 3); text('please wait' + dots, r.x + 14, r.y + r.h - 12, '#806850', 6); }
    const pad = lastInput === 'pad';
    modalBtns(m).forEach((bb, i) => drawMenuBtn(bb.x, bb.y, bb.w, bb.h, bb.b.label + (pad && i === (m.sel | 0) ? ' (A)' : ''), i === (m.sel | 0)));
  }
  function handleModal() {
    const m = CL.modal; if (!m) return;
    const mx = mouse.x / SCALE, my = mouse.y / SCALE, bs = modalBtns(m);
    let act = null;
    bs.forEach((bb, i) => { if (clickedBox(mx, my, bb.x, bb.y, bb.w, bb.h)) { act = bb.b; m.sel = i; } });
    if (bs.length) {
      if (pressed('a') || pressed('ArrowLeft') || pressed('w') || pressed('ArrowUp') || pressed('_slotPrev')) { m.sel = ((m.sel | 0) + bs.length - 1) % bs.length; sfx('hover'); }
      if (pressed('d') || pressed('ArrowRight') || pressed('s') || pressed('ArrowDown') || pressed('_slotNext') || pressed('Tab')) { m.sel = ((m.sel | 0) + 1) % bs.length; sfx('hover'); }
      if (!act && (pressed('Enter') || pressed(' ') || (PADB.just && PADB.just[0]))) act = bs[m.sel | 0].b;
      if (!act && !m.noEsc && (pressed('Escape') || padJust.Escape || (PADB.just && PADB.just[1]))) act = (m.btns.find(b => b.cancel) || m.btns[m.btns.length - 1]);
    }
    if (act) { sfx('ui'); try { act.act(); } catch (e) {} }
    mouse.clicked = false; just.Escape = false; just.Enter = false; delete padJust.Escape;
  }
  /* small "not synced" chip while playing */
  function drawChip() {
    if (!CL.cfg.code || CL.modal) return;
    let s = null, col = '#e0b060';
    if (CL.phase === 'offline') s = 'Cloud: not synced';
    else if (CL.msg && performance.now() - CL.msgT < 4000) { s = CL.msg; col = '#e0a070'; }
    if (!s) return;
    font(6, col); const w = g.measureText(s).width + 10;
    const x = Math.round((VW - w) / 2), y = 2;
    g.fillStyle = 'rgba(18,12,8,0.82)'; g.fillRect(x, y, w, 11); g.strokeStyle = '#6a5030'; g.strokeRect(x + 0.5, y + 0.5, w - 1, 10);
    text(s, x + 5, y + 8, col, 6);
  }
  const _dt = drawToasts;
  drawToasts = function () { _dt.apply(this, arguments); try { drawChip(); drawModal(); } catch (e) {} };
  const _hui = handleUI;
  handleUI = function () {
    if (CL.dom) { mouse.clicked = false; if (pressed('Escape') || padJust.Escape || (PADB.just && PADB.just[1])) domClose(null); just.Escape = false; delete padJust.Escape; return; }
    if (CL.modal) { handleModal(); return; }
    return _hui.apply(this, arguments);
  };
  const _hpk = handlePauseKey;
  handlePauseKey = function () { if (CL.modal || CL.dom) return; return _hpk.apply(this, arguments); };

  /* ---------- typed input (sync code, device name): a small HTML box over the game ---------- */
  function domClose(v) {
    const d = CL.dom; if (!d) return; CL.dom = null;
    if (d.scan || CL._scan) try { v2632stopScan(CL._scan && CL._scan.stream); } catch (e) {}
    try { d.el.remove(); } catch (e) {} try { canvas.focus(); } catch (e) {}
    if (typeof d.res === 'function') d.res(v);
  }
  /* v0.26.32: chunk typed sync codes (uppercase, strip junk, dash every 5, keep the caret) */
  function v2632fmtCode(raw) {
    const c = String(raw || '').toUpperCase().replace(/[\s-]/g, '').replace(/O/g, '0').replace(/[IL]/g, '1').replace(/[^0-9A-HJKMNP-TV-Z]/g, '').slice(0, 26);
    return c ? c.match(/.{1,5}/g).join('-') : '';
  }
  function v2632wireCodeInput(inp) {
    let lock = false;
    const apply = () => {
      if (lock) return;
      const old = inp.value, start = inp.selectionStart | 0;
      const before = v2632fmtCode(old.slice(0, start)).length;
      const next = v2632fmtCode(old);
      if (next === old) return;
      lock = true; inp.value = next;
      try { inp.setSelectionRange(before, before); } catch (e) {}
      lock = false;
    };
    inp.addEventListener('input', apply);
    inp.addEventListener('blur', apply);
  }
  function domAsk(o) {
    return new Promise(res => {
      if (CL.dom) domClose(null);
      const el = document.createElement('div');
      el.setAttribute('role', 'dialog');
      el.style.cssText = 'position:fixed;left:50%;top:40%;transform:translate(-50%,-50%);z-index:99999;background:#120c08;border:2px solid #c8a050;' +
        'padding:16px 18px;min-width:min(420px,88vw);max-width:92vw;font:16px/1.4 monospace;color:#e8e0d0;box-shadow:0 0 0 100vmax rgba(0,0,0,.55)';
      const h = document.createElement('div'); h.textContent = o.title; h.style.cssText = 'color:#ffe8a8;font-size:18px;margin-bottom:8px';
      const p = document.createElement('div'); p.textContent = o.label || ''; p.style.cssText = 'color:#c8b89a;font-size:14px;margin-bottom:8px';
      const inp = document.createElement('input');
      inp.type = 'text'; inp.value = o.value || ''; inp.maxLength = o.max || 40; inp.placeholder = o.placeholder || '';
      inp.autocomplete = 'off'; inp.spellcheck = false; inp.setAttribute('autocapitalize', o.caps ? 'characters' : 'words'); inp.readOnly = !!o.readOnly;
      inp.style.cssText = 'width:100%;box-sizing:border-box;font:18px monospace;padding:8px;background:#241c14;color:#ffe080;border:1px solid #6a5030;letter-spacing:1px';
      if (o.codeFmt) { inp.value = v2632fmtCode(inp.value); v2632wireCodeInput(inp); inp.maxLength = 31; }
      const err = document.createElement('div'); err.style.cssText = 'color:#e07070;font-size:14px;min-height:20px;margin-top:4px';
      const row = document.createElement('div'); row.style.cssText = 'display:flex;gap:10px;justify-content:flex-end;margin-top:6px;flex-wrap:wrap';
      const mk = (t, hot) => { const b = document.createElement('button'); b.type = 'button'; b.textContent = t;
        b.style.cssText = 'font:16px monospace;padding:8px 14px;min-height:44px;cursor:pointer;background:' + (hot ? '#3a2a14' : '#241c14') + ';color:' + (hot ? '#ffe080' : '#e8e0d0') + ';border:1px solid ' + (hot ? '#e6c34a' : '#6a5030'); return b; };
      const ok = mk(o.ok || 'OK', true), no = mk(o.cancel || 'Cancel');
      /* v0.26.32: optional extra button (e.g. Scan) on the left of Cancel */
      if (o.extra && o.extra.label) {
        const ex = mk(o.extra.label, false);
        ex.onclick = () => { const act = o.extra.act; domClose(null); if (act) try { act(); } catch (e) {} };
        row.appendChild(ex);
      }
      if (!o.noCancel) row.appendChild(no);
      row.appendChild(ok);
      el.append(h, p, inp, err, row);
      const submit = () => {
        if (o.readOnly) { domClose(true); return; }
        const v = o.check ? o.check(inp.value) : inp.value;
        if (v == null || v === false) { err.textContent = o.bad || 'Please check that'; return; }
        domClose(v);
      };
      ok.onclick = submit; no.onclick = () => domClose(null);
      el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Enter') { e.preventDefault(); submit(); } else if (e.key === 'Escape') { e.preventDefault(); domClose(null); } });
      el.addEventListener('keyup', e => e.stopPropagation());
      el.addEventListener('pointerdown', e => e.stopPropagation());
      el.addEventListener('mousedown', e => e.stopPropagation());
      el.addEventListener('touchstart', e => e.stopPropagation(), { passive: true });
      document.body.appendChild(el);
      CL.dom = { el, res, inp };
      try { for (const k in keys) keys[k] = false; } catch (e) {}
      setTimeout(() => { try { inp.focus(); if (o.readOnly || o.select) inp.select(); } catch (e) {} }, 30);
    });
  }
  async function copyCode() {
    const c = prettyCode(CL.cfg.code);
    let done = false;
    try { if (navigator.clipboard && navigator.clipboard.writeText) { await navigator.clipboard.writeText(c); done = true; } } catch (e) {}
    if (!done) {
      try { const ta = document.createElement('textarea'); ta.value = c; ta.style.cssText = 'position:fixed;left:-9999px'; document.body.appendChild(ta); ta.select(); done = document.execCommand('copy'); ta.remove(); } catch (e) {}
    }
    if (done) note('Code copied'); else await domAsk({ title: 'Your sync code', label: 'Select it and copy it (keep it private):', value: c, readOnly: true, noCancel: true, ok: 'Done' });
  }

  /* ---------- Settings > Cloud tab ---------- */
  try {
    const xs = { general: 78, audio: 138, graphics: 198, touch: 258 };
    for (const t of SET_TABS) if (xs[t.id] != null) t.x = xs[t.id];
    SET_TABS.push({ id: 'cloud', name: 'Cloud', x: 318 });
    SET_TAB_ORDER.push('cloud');
  } catch (e) {}
  function statusLine() {
    const c = CL.cfg;
    if (!c.code) return ['Off on this device', '#a09080'];
    switch (CL.phase) {
      case 'live': return c.dirty ? ['Connected - uploading soon', '#e6c34a'] : ['Synced' + (c.lastSync ? ' at ' + fmtT(c.lastSync) : '') + '  (version ' + (c.base | 0) + ')', '#80e080'];
      case 'offline': return ['Offline - not synced, it retries every 30 s', '#e0b060'];
      case 'guest': return ['Paused while you play in a friend\'s world', '#a09080'];
      case 'lost': return ['Stopped - continued on another device', '#e07070'];
      default: return ['Connecting...', '#c8b89a'];
    }
  }
  function cloudButtons() {
    const c = CL.cfg, B = [];
    if (!c.code) {
      B.push({ x: 28, y: 92, w: 170, h: 18, label: 'Turn on cloud saves', hot: true, act: turnOn });
      B.push({ x: 28, y: 118, w: 170, h: 18, label: 'I have a code', act: enterCode });
      /* v0.26.32: scan a QR instead of typing the long code; Device name moves down */
      B.push({ x: 28, y: 144, w: 170, h: 18, label: 'Scan QR code', act: v2632scan });
      B.push({ x: 28, y: 170, w: 170, h: 18, label: 'Device name', act: rename });
      return B;
    }
    B.push({ x: 300, y: 70, w: 64, h: 16, label: CL.showCode ? 'Hide' : 'Show', act: () => { CL.showCode = !CL.showCode; } });
    B.push({ x: 370, y: 70, w: 64, h: 16, label: 'Copy', act: copyCode });
    B.push({ x: 370, y: 96, w: 64, h: 16, label: 'Rename', act: rename });
    B.push({ x: 28, y: 146, w: 128, h: 18, label: 'Sync now', hot: true, act: syncNow });
    B.push({ x: 164, y: 146, w: 128, h: 18, label: 'Restore backup', act: openRestore });
    B.push({ x: 300, y: 146, w: 134, h: 18, label: 'Use another code', act: enterCode });
    B.push({ x: 28, y: 170, w: 128, h: 18, label: 'Turn off here', act: turnOff });
    B.push({ x: 164, y: 170, w: 128, h: 18, label: 'QR code', act: v2632showQr });
    return B;
  }
  function drawCloudTab() {
    panelBg('SETTINGS');
    drawMenuBtn(380, 14, 70, 14, 'Back');
    drawSetTabs();
    const c = CL.cfg, mx = mouse.x / SCALE, my = mouse.y / SCALE;
    text('CLOUD SAVES  (one burrow on your PC, Legion Go and phone)', 24, 39, '#e6c34a', 6);
    const st = statusLine();
    text('Status:', 28, 54, '#c8b89a', 7); text(fitText(st[0], 330, 7), 74, 54, st[1], 7);
    if (!c.code) {
      wrapWords('Turn this on to get a private sync code. Type the same code on your other devices, or scan the QR, to play the same burrow. Only one device plays at a time.', 410, 6).slice(0, 2).forEach((ln, i) => text(ln, 28, 70 + i * 9, '#a09080', 6));
      text('This device:  ' + c.name, 210, 182, '#e8e0d0', 7);
    } else {
      text('Sync code', 28, 81, '#c8b89a', 7);
      const pc = prettyCode(c.code);
      text(CL.showCode ? pc : pc.slice(0, 5) + '-*****-*****-*****-******', 92, 81, '#ffe080', 7);
      text('This device', 28, 107, '#c8b89a', 7); text(fitText(c.name, 270, 7), 92, 107, '#e8e0d0', 7);
      const L = CL.meta && CL.meta.lease;
      const where = CL.phase === 'live' ? 'this device' : (L && L.active ? L.name : 'nobody right now');
      text('Playing on', 28, 125, '#c8b89a', 7); text(fitText(where, 200, 7), 92, 125, '#e8e0d0', 7);
      if (CL.meta && CL.meta.v) text(fitText('Cloud save: ' + fmtT(CL.meta.at) + (CL.meta.dev ? ' on ' + CL.meta.dev : ''), 180, 6), 250, 125, '#a09080', 6);
    }
    const B = CL.btns = cloudButtons(), nav = lastInput !== 'mouse' && CL.nav;
    if ((CL.sel | 0) >= B.length) CL.sel = 0;
    B.forEach((b, i) => drawMenuBtn(b.x, b.y, b.w, b.h, b.label, b.hot || (nav && i === (CL.sel | 0))));
    if (nav && B[CL.sel | 0]) { const b = B[CL.sel | 0]; g.strokeStyle = '#ffe080'; g.strokeRect(b.x - 1.5, b.y - 1.5, b.w + 3, b.h + 3); }
    const tip = c.code ? 'Keep the code private: anyone with it can load your burrow. Paste it on a new device with "Use another code".' : '';
    wrapWords(tip, 420, 6).slice(0, 2).forEach((ln, j) => text(ln, 28, 200 + j * 9, '#806850', 6));
    if (CL.msg && performance.now() - CL.msgT < 4000) text(CL.msg, 28, 220, '#e6c34a', 6);
    text(lastInput === 'pad' ? 'D-pad pick   A press' : 'Click a button', 330, 222, '#806850', 6);
  }
  const _ds = drawSettings;
  drawSettings = function () { if (setTab() === 'cloud') { drawCloudTab(); return; } return _ds.apply(this, arguments); };
  const _hm = handleMenuUI;
  handleMenuUI = function () {
    if (!(S.paused && S.menu === 'settings' && setTab() === 'cloud')) return _hm.apply(this, arguments);
    const mx = mouse.x / SCALE, my = mouse.y / SCALE;
    for (const t of SET_TABS) if (clickedBox(mx, my, t.x, SET_TAB_Y, SET_TAB_W, SET_TAB_H)) { setTabSwitch(t.id); mouse.clicked = false; return; }
    if (pressed('q') || pressed('_slotPrev')) { setTabSwitch(cyc(SET_TAB_ORDER, setTab(), -1)); return; }
    if (pressed('e') || pressed('_slotNext')) { setTabSwitch(cyc(SET_TAB_ORDER, setTab(), 1)); return; }
    if (clickedBox(mx, my, 380, 14, 70, 14)) { persistSettings(); sfx('ui'); S.menu = 'pause'; mouse.clicked = false; return; }
    const B = CL.btns || [];
    for (let i = 0; i < B.length; i++) if (clickedBox(mx, my, B[i].x, B[i].y, B[i].w, B[i].h)) { CL.sel = i; CL.nav = false; mouse.clicked = false; sfx('ui'); B[i].act(); return; }
    const n = B.length; if (!n) return;
    const prev = pressed('w') || pressed('ArrowUp') || pressed('a') || pressed('ArrowLeft'), next = pressed('s') || pressed('ArrowDown') || pressed('d') || pressed('ArrowRight');
    if (prev || next) { CL.nav = true; CL.sel = ((CL.sel | 0) + (prev ? n - 1 : 1)) % n; sfx('hover'); }
    if (pressed('Enter') || pressed(' ')) { CL.nav = true; sfx('ui'); B[CL.sel | 0].act(); }
    mouse.clicked = false;
  };

  /* ---------- actions ---------- */
  function startWith(code, isNew) {
    CL.cfg.code = code; CL.cfg.base = 0;
    /* a new code uploads this burrow; linking a device with little play just loads the cloud one (the local one is kept as the old save), more play asks */
    CL.cfg.dirty = isNew || ((S && S.stats && S.stats.playT) || 0) >= 600; CL.cfg.baseAt = 0; CL.cfg.localAt = LAST_SAVE_AT || Date.now(); CL.since = 0; CL.upKey = null; saveCfg();
    CL.phase = 'boot';
    if (isGuest()) { note('Cloud starts when you are back in your own world'); return; }
    claim(false, isNew ? 'new' : 'link');
  }
  function turnOn() {
    if (CL.cfg.code) return;
    try { saveGame(); } catch (e) {}
    startWith(newCode(), true);
    CL.showCode = true;
  }
  async function enterCode() {
    const v = await domAsk({ title: 'Link this device', label: 'Type the sync code from your other device (the dashes are optional):', placeholder: 'XXXXX-XXXXX-XXXXX-XXXXX-XXXXXX', max: 40, caps: true, ok: 'Link',
      codeFmt: true, check: s => normCode(s), bad: 'That code is not right - it has 26 letters and numbers',
      extra: { label: 'Scan', act: () => { v2632scan(); } } });
    if (!v) return;
    v2632linkCode(v, 'typed');
  }
  /* v0.26.32: shared link path used by typing, QR scan and #cloud= links (never silent) */
  function v2632linkCode(v, why) {
    if (!v) return;
    if (v === CL.cfg.code) { note('This device already uses that code'); return; }
    if (CL.cfg.code) release(false);
    try { saveGame(); } catch (e) {}
    startWith(v, false);
  }
  async function rename() {
    const v = await domAsk({ title: 'Device name', label: 'Shown on your other devices, e.g. "Playing on Legion Go".', value: CL.cfg.name, max: 24, ok: 'Save', select: true,
      check: s => { const n = String(s).replace(/[^\p{L}\p{N} '._()-]/gu, '').trim().slice(0, 24); return n || null; }, bad: 'Use letters and numbers' });
    if (!v) return;
    CL.cfg.name = v; saveCfg();
    if (CL.phase === 'live') { CL.lastBeat = 0; call('claim', {}).then(r => { if (r.s === 200) CL.meta = r.j; }); }
    note('Device name saved');
  }
  async function syncNow() {
    if (CL.phase === 'offline') { await retryOffline(); note(CL.phase === 'live' ? 'Synced' : 'Still offline'); return; }
    if (CL.phase !== 'live') { note('Not connected yet'); return; }
    CL.quiet = 0; try { saveGame(); } catch (e) {}
    if (CL.cfg.dirty) { const ok = await upload(); note(ok ? 'Synced' : (CL.phase === 'offline' ? 'Offline - will retry' : 'Not synced')); }
    else { const r = await call('meta'); if (r.s === 200) { CL.meta = r.j; if ((r.j.v | 0) > (CL.cfg.base | 0)) showConflict(r.j, true); else note('Already up to date'); } else note('Could not reach the cloud'); }
  }
  async function openRestore() {
    if (CL.phase !== 'live') { note(CL.phase === 'offline' ? 'Connect to the internet to restore' : 'Not connected yet'); return; }
    const r = await call('meta');
    if (r.s !== 200) { note('Could not reach the cloud'); return; }
    CL.meta = r.j;
    const bk = (r.j.backups || []).slice(0, 5);
    if (!bk.length) { note('No backups yet - one is kept every 10 minutes of play'); return; }
    const btns = bk.map(b => ({ label: fmtT(b.at) + '  ' + (b.dev || ''), act: () => confirmRestore(b) }));
    btns.push({ label: 'Cancel', cancel: true, act: closeModal });
    CL.modal = { kind: 'restore', title: 'Restore a backup', lines: ['Pick a save to go back to. Your burrow right now', 'is kept as a backup too.'], btns, sel: 0, list: true };
  }
  function confirmRestore(b) {
    CL.modal = { kind: 'restoreAsk', title: 'Restore this backup?', lines: ['Saved ' + fmtT(b.at) + (b.dev ? ' on ' + b.dev : '') + '.', 'Your burrow right now is kept as a backup.'],
      btns: [{ label: 'Restore', hot: true, act: () => doRestore(b) }, { label: 'Cancel', cancel: true, act: closeModal }], sel: 1 };
  }
  async function doRestore(b) {
    CL.modal = { kind: 'sync', title: 'Cloud saves', lines: ['Restoring...'], btns: [] };
    try { saveGame(); } catch (e) {}
    if (CL.cfg.dirty) await upload();
    if (CL.phase !== 'live') { if (CL.modal && CL.modal.kind === 'sync') closeModal(); return; }
    const r = await call('restore', { id: b.id, base: CL.cfg.base | 0 });
    if (r.s !== 200) { closeModal(); note(r.s === 409 && r.j.err === 'lost' ? 'Another device took over' : 'Could not restore'); if (r.s === 409 && r.j.err === 'lost') lostTo(r.j.by); return; }
    const res = await pullLoad();
    closeModal();
    if (String(res).startsWith('ok')) { toast('Backup restored', 'saved ' + fmtT(b.at), '#80e080', 'ui'); S.paused = false; S.menu = null; }
    else note('Could not load the backup');
  }
  function turnOff() {
    CL.modal = { kind: 'offAsk', title: 'Turn off cloud saves here?', lines: ['This device stops syncing and forgets the code.', 'Your saves stay on this device and in the cloud.', 'Write the code down first if you need it.'],
      btns: [{ label: 'Turn off', act: () => { closeModal(); release(false); CL.cfg.code = null; CL.cfg.base = 0; CL.cfg.dirty = false; CL.since = 0; saveCfg(); CL.phase = 'off'; CL.meta = null; note('Cloud saves are off on this device'); } },
        { label: 'Cancel', cancel: true, act: closeModal }], sel: 1 };
  }
  /* the restore list stacks its buttons */
  const _mb = modalBtns;
  modalBtns = function (m) {
    if (!m.list) return _mb(m);
    const r = modalRect(m);
    return m.btns.map((b, i) => ({ x: r.x + 30, y: r.y + 64 + i * 20, w: r.w - 60, h: 16, b }));
  };
  const _mr = modalRect;
  modalRect = function (m) { if (!m.list) return _mr(m); const h = 74 + m.btns.length * 20; return { x: 90, y: Math.round((VH - h) / 2) - 8, w: 300, h }; };
  /* ================= v0.26.32: QR code linking for cloud saves =================
     Show a QR of the GitHub Pages #cloud= URL so a phone can link without typing 26 characters.
     Scan with the camera (BarcodeDetector on Chrome Android, jsQR on iOS Safari). Opening a
     #cloud= link asks first and never links silently. The code is a credential: clear it from
     the URL, never log it, and warn about scanning strangers' codes. */
  const V2632_PAGES = 'https://chazz8990.github.io/burrow-web/';
  const v2632cloudUrl = code => V2632_PAGES + '#cloud=' + code;
  function v2632parseCloudPayload(raw) {
    const s = String(raw || '').trim();
    if (!s) return null;
    /* accept Pages URL, localhost (tests), a bare #cloud= fragment, or a bare code */
    const m = s.match(/^(?:https:\/\/chazz8990\.github\.io\/burrow-web\/?|https?:\/\/(?:localhost|127\.0\.0\.1)(?::\d+)?\/?)?#cloud=([0-9A-Za-zIlO\s-]{16,40})\s*$/i);
    if (m) {
      const c = normCode(m[1]);
      return c ? { code: c } : { err: 'bad' };
    }
    if (/^https?:\/\//i.test(s) || /#cloud=/i.test(s)) return { err: 'bad' };
    const c = normCode(s);
    return c ? { code: c } : { err: 'bad' };
  }
  function v2632clearHash() {
    try {
      if (location.hash && /cloud=/i.test(location.hash)) history.replaceState(null, '', location.pathname + location.search);
    } catch (e) {}
  }
  function v2632readHash() {
    try {
      const h = location.hash || '';
      const m = /^#cloud=(.+)$/i.exec(h);
      if (!m) return;
      const parsed = v2632parseCloudPayload('#cloud=' + m[1]);
      v2632clearHash();
      if (!parsed || parsed.err || !parsed.code) { note('That link has a broken code'); return; }
      CL._pendingCloud = parsed.code;
    } catch (e) { try { v2632clearHash(); } catch (e2) {} }
  }
  v2632readHash();
  window.addEventListener('hashchange', () => { try { v2632readHash(); } catch (e) {} });

  function v2632domShell(title) {
    if (CL.dom) domClose(null);
    const el = document.createElement('div');
    el.setAttribute('role', 'dialog');
    el.style.cssText = 'position:fixed;left:50%;top:42%;transform:translate(-50%,-50%);z-index:99999;background:#120c08;border:2px solid #c8a050;' +
      'padding:14px 16px;min-width:min(320px,88vw);max-width:92vw;font:16px/1.4 monospace;color:#e8e0d0;box-shadow:0 0 0 100vmax rgba(0,0,0,.55)';
    const h = document.createElement('div'); h.textContent = title; h.style.cssText = 'color:#ffe8a8;font-size:18px;margin-bottom:8px';
    el.appendChild(h);
    return el;
  }
  function v2632mkBtn(t, hot) {
    const b = document.createElement('button'); b.type = 'button'; b.textContent = t;
    b.style.cssText = 'font:16px monospace;padding:8px 14px;min-height:44px;cursor:pointer;background:' + (hot ? '#3a2a14' : '#241c14') +
      ';color:' + (hot ? '#ffe080' : '#e8e0d0') + ';border:1px solid ' + (hot ? '#e6c34a' : '#6a5030');
    return b;
  }
  function v2632showQr() {
    if (!CL.cfg.code) return;
    const code = CL.cfg.code, url = v2632cloudUrl(code);
    if (typeof qrcode !== 'function') { note('QR library missing'); return; }
    const el = v2632domShell('Scan to link a device');
    el.style.top = '50%';
    el.style.maxHeight = '92vh';
    el.style.overflow = 'auto';
    const tip = document.createElement('div');
    tip.textContent = 'Phone camera → this QR.';
    tip.style.cssText = 'color:#c8b89a;font-size:13px;margin-bottom:6px';
    const warn = document.createElement('div');
    warn.textContent = 'Only scan with your own devices';
    warn.style.cssText = 'color:#e0a070;font-size:13px;margin:0 0 6px';
    const cv = document.createElement('canvas');
    cv.setAttribute('aria-label', 'Cloud save QR code');
    cv.style.cssText = 'display:block;margin:0 auto 6px;background:#fff;image-rendering:pixelated;max-width:min(220px,70vw);height:auto';
    try {
      const q = qrcode(0, 'M');
      q.addData(url); q.make();
      /* 6-8 px/module with quiet zone; keep under ~220px so short phone landscape still fits */
      const n = q.getModuleCount(), quiet = 2;
      const cell = Math.max(4, Math.min(7, Math.floor(200 / (n + quiet * 2))));
      const size = (n + quiet * 2) * cell;
      cv.width = size; cv.height = size;
      const ctx = cv.getContext('2d');
      ctx.fillStyle = '#ffffff'; ctx.fillRect(0, 0, size, size);
      ctx.fillStyle = '#000000';
      for (let r = 0; r < n; r++) for (let c = 0; c < n; c++) if (q.isDark(r, c))
        ctx.fillRect((c + quiet) * cell, (r + quiet) * cell, cell, cell);
    } catch (e) { tip.textContent = 'Could not draw the QR code'; }
    const codeLine = document.createElement('div');
    codeLine.textContent = prettyCode(code);
    codeLine.style.cssText = 'color:#ffe080;font-size:12px;text-align:center;letter-spacing:1px;margin-bottom:6px;word-break:break-all';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:flex-end;margin-top:2px';
    const close = v2632mkBtn('Close', true);
    close.onclick = () => domClose(null);
    row.appendChild(close);
    el.append(tip, warn, cv, codeLine, row);
    el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); domClose(null); } });
    el.addEventListener('keyup', e => e.stopPropagation());
    el.addEventListener('pointerdown', e => e.stopPropagation());
    document.body.appendChild(el);
    CL.dom = { el, res: () => {}, inp: null, qr: true };
    try { for (const k in keys) keys[k] = false; } catch (e) {}
    setTimeout(() => { try { close.focus(); } catch (e) {} }, 30);
  }

  let v2632jsqrP = null;
  function v2632loadJsQR() {
    if (typeof jsQR === 'function') return Promise.resolve(jsQR);
    if (v2632jsqrP) return v2632jsqrP;
    v2632jsqrP = new Promise((res, rej) => {
      const s = document.createElement('script');
      s.src = 'jsqr.min.js?v=' + (typeof VERSION === 'string' ? VERSION : '0');
      s.onload = () => (typeof jsQR === 'function' ? res(jsQR) : rej(new Error('jsQR')));
      s.onerror = () => rej(new Error('jsQR load'));
      document.head.appendChild(s);
    });
    return v2632jsqrP;
  }
  function v2632stopScan(stream) {
    try { if (stream) stream.getTracks().forEach(t => t.stop()); } catch (e) {}
    if (CL._scan) { try { clearInterval(CL._scan.iv); } catch (e) {} CL._scan = null; }
  }
  async function v2632scan() {
    const media = navigator.mediaDevices;
    if (!media || typeof media.getUserMedia !== 'function') {
      note('No camera here - type the code instead');
      enterCode();
      return;
    }
    let stream = null;
    try {
      stream = await media.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
    } catch (e) {
      note('Camera permission denied - type the code instead');
      enterCode();
      return;
    }
    const el = v2632domShell('Scan a Burrow QR');
    const tip = document.createElement('div');
    tip.textContent = 'Point at the QR on your other device. Only scan your own codes.';
    tip.style.cssText = 'color:#c8b89a;font-size:13px;margin-bottom:8px;max-width:300px';
    const vid = document.createElement('video');
    vid.setAttribute('playsinline', ''); vid.muted = true; vid.autoplay = true;
    vid.style.cssText = 'display:block;width:min(280px,80vw);max-height:40vh;background:#000;margin:0 auto 8px';
    vid.srcObject = stream;
    try { await vid.play(); } catch (e) {}
    const err = document.createElement('div'); err.style.cssText = 'color:#e07070;font-size:13px;min-height:18px';
    const row = document.createElement('div'); row.style.cssText = 'display:flex;justify-content:flex-end;gap:10px';
    const cancel = v2632mkBtn('Cancel', false);
    const finish = (code, bad) => {
      v2632stopScan(stream);
      domClose(null);
      if (bad) { note(bad); return; }
      if (code) v2632confirmLink(code, 'scan');
    };
    cancel.onclick = () => finish(null);
    row.appendChild(cancel);
    el.append(tip, vid, err, row);
    el.addEventListener('keydown', e => { e.stopPropagation(); if (e.key === 'Escape') { e.preventDefault(); finish(null); } });
    el.addEventListener('pointerdown', e => e.stopPropagation());
    document.body.appendChild(el);
    CL.dom = { el, res: () => {}, inp: null, scan: true };
    const onHide = () => finish(null);
    window.addEventListener('pagehide', onHide, { once: true });

    let detector = null;
    try { if (typeof BarcodeDetector === 'function') detector = new BarcodeDetector({ formats: ['qr_code'] }); } catch (e) {}
    const off = document.createElement('canvas');
    const octx = off.getContext('2d', { willReadFrequently: true });
    let jsqrFn = null;
    if (!detector) {
      try { jsqrFn = await v2632loadJsQR(); } catch (e) { err.textContent = 'Scanner failed to load'; finish(null, 'Could not start the scanner'); return; }
    }
    const tick = async () => {
      if (!CL.dom || !CL.dom.scan) return;
      try {
        if (vid.readyState < 2) return;
        let text = null;
        if (detector) {
          const codes = await detector.detect(vid);
          if (codes && codes[0] && codes[0].rawValue) text = codes[0].rawValue;
        } else if (jsqrFn) {
          const w = vid.videoWidth | 0, h = vid.videoHeight | 0;
          if (w < 8 || h < 8) return;
          off.width = w; off.height = h;
          octx.drawImage(vid, 0, 0, w, h);
          const img = octx.getImageData(0, 0, w, h);
          const r = jsqrFn(img.data, w, h);
          if (r && r.data) text = r.data;
        }
        if (!text) return;
        const parsed = v2632parseCloudPayload(text);
        if (!parsed || parsed.err || !parsed.code) { err.textContent = 'That QR is not a Burrow code'; return; }
        finish(parsed.code);
      } catch (e) {}
    };
    CL._scan = { iv: setInterval(tick, 200), stream };
    try { for (const k in keys) keys[k] = false; } catch (e) {}
  }

  function v2632confirmLink(code, why) {
    if (!code) return;
    if (code === CL.cfg.code) { note('Already linked'); return; }
    const mask = prettyCode(code).slice(0, 5) + '-*****';
    const lines = ['Code ' + mask + '  (only continue if this is yours)'];
    if (CL.cfg.code) lines.push('This switches away from the code on this device.');
    const localAt = CL.cfg.localAt || LAST_SAVE_AT;
    if (localAt) lines.push('This device save: ' + fmtT(localAt));
    if (CL.meta && CL.meta.at) lines.push('Cloud save: ' + fmtT(CL.meta.at));
    CL.modal = {
      kind: 'linkAsk', title: 'Link this device to cloud save?', lines,
      btns: [
        { label: 'Link', hot: true, act: () => { closeModal(); unpauseIfOurs(); v2632linkCode(code, why || 'confirm'); } },
        { label: 'Cancel', cancel: true, act: () => { closeModal(); unpauseIfOurs(); } }
      ],
      sel: 1
    };
    pauseForUs();
  }

  /* pending #cloud= from a cold open: ask once the miner is in the world */
  setInterval(() => {
    try {
      if (!CL._pendingCloud) return;
      if (!S || !S.p || S.charSel || S.nameEntry) return;
      if (CL.modal || CL.dom) return;
      const code = CL._pendingCloud; CL._pendingCloud = null;
      v2632confirmLink(code, 'hash');
    } catch (e) {}
  }, 1000);

  CL._test = { normCode, prettyCode, guessName, claim, beat, upload, pullLoad, showConflict, lostTo, showHeld, release, turnOn, startWith, syncNow, openRestore, retryOffline, flushAndRelease, isGuest,
    v2632fmtCode, v2632parseCloudPayload, v2632cloudUrl, v2632showQr, v2632scan, v2632confirmLink, v2632linkCode, v2632clearHash };
})();
