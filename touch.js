/* v0.26.27: phone / tablet touch controls (the real build of the PHONE_PLAN mock-up). Loads after game.js and net.js.
   On for: Settings > Touch > Touch controls = On, or Auto on a finger-first device (phones, tablets), or ?touch=1.
   It only presses the game's own keys and mouse: no game rules change and nothing extra is sent online.
   - left thumb stick (move / climb / dig into walls), right buttons (JUMP, DIG hold, E use, Q item, PACK, MAP),
     small buttons (CRAFT, EAT, DRINK, menu). Left-handed swaps the sides. Size and look are in Settings > Touch.
   - taps on the game are clicks; in menus a tap snaps to the nearest button or slot within 22 px (44 px targets),
     a long-press (0.45 s) is a right-click (use / split / set waypoint), a drag is a mouse drag.
   - map: one finger pans, two fingers pinch-zoom. The menu buttons move so they never cover the map legend.
   - on-screen key hints read as touch hints while touch controls are showing; a gamepad hides the touch buttons.
   - single player pauses when the app is hidden (switching apps, locking the phone); co-op keeps running.
   - Battery saver (30 FPS) lives on the same Touch tab and works on any device. */
(function () {
  const q = new URLSearchParams(location.search);
  const coarse = !!(window.matchMedia && matchMedia('(pointer: coarse)').matches);
  const TOUCH_DEF = { touchMode: 'auto', touchSize: 'normal', touchAlpha: 'normal', touchLeft: false, fps30: false, touchPause: true };
  const SIZE_OPTS = [['small', 'Small', 0.9], ['normal', 'Normal', 1], ['large', 'Large', 1.2]];
  const ALPHA_OPTS = [['faint', 'Faint', 0.55], ['normal', 'Normal', 0.85], ['solid', 'Solid', 1]];
  const MODE_OPTS = [['auto', 'Auto'], ['on', 'On'], ['off', 'Off']];

  /* ---------- settings (saved in burrow_settings_v1 with the rest) ---------- */
  const _tDef = defaultSettings;
  defaultSettings = function () { return Object.assign(_tDef.apply(this, arguments), TOUCH_DEF); };
  const _tMerge = mergeSettings;
  mergeSettings = function (src) {
    _tMerge.apply(this, arguments);
    if (!src || typeof src !== 'object') return;
    if (MODE_OPTS.some(o => o[0] === src.touchMode)) SETTINGS.touchMode = src.touchMode;
    if (SIZE_OPTS.some(o => o[0] === src.touchSize)) SETTINGS.touchSize = src.touchSize;
    if (ALPHA_OPTS.some(o => o[0] === src.touchAlpha)) SETTINGS.touchAlpha = src.touchAlpha;
    for (const k of ['touchLeft', 'fps30', 'touchPause']) if (typeof src[k] === 'boolean') SETTINGS[k] = src[k];
  };
  for (const k in TOUCH_DEF) if (SETTINGS[k] == null) SETTINGS[k] = TOUCH_DEF[k];
  try { const sv = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (sv) mergeSettings(sv); } catch (e) {}

  function wanted() {
    if (q.get('touch') === '1') return true;
    if (q.get('touch') === '0') return false;
    const m = SETTINGS.touchMode || 'auto';
    return m === 'on' || (m === 'auto' && coarse);
  }
  /* first run on a phone: tap-to-dig on and the bigger Handheld UI, unless the player already chose */
  try {
    const sv = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null');
    if (wanted() && !(sv && typeof sv.clickMine === 'boolean')) SETTINGS.clickMine = true;
    if (wanted() && !(sv && sv.uiScale) && typeof UI_SCALES !== 'undefined') SETTINGS.uiScale = 'handheld';
    const _d2 = defaultSettings;
    defaultSettings = function () { const d = _d2.apply(this, arguments); try { const s2 = JSON.parse(localStorage.getItem(SETTINGS_KEY) || 'null'); if (wanted() && !(s2 && typeof s2.clickMine === 'boolean')) d.clickMine = true; if (wanted() && !(s2 && s2.uiScale)) d.uiScale = 'handheld'; } catch (e) {} return d; };
  } catch (e) {}

  /* ---------- 30 FPS battery saver: skip every other display frame (the game already runs on real time) ---------- */
  let lastRun = 0;
  const _tLoop = loop;
  loop = function (ts) {
    if (SETTINGS && SETTINGS.fps30 && S && ts - lastRun < 30) { requestAnimationFrame(loop); return; }
    lastRun = ts;
    return _tLoop.apply(this, arguments);
  };

  /* ---------- pause when hidden (single player only; co-op keeps going so friends are not frozen) ---------- */
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState !== 'hidden') return;
    try {
      if (SETTINGS.touchPause === false) return;
      if (window.NET && NET.role && NET.role !== 'off') return;
      if (S && S.p && !S.p.dead && !S.paused && !S.charSel && !S.nameEntry) { openPause(); S._hidPaused = true; }
      for (const k in keys) keys[k] = false;
      mouse.down = false;
    } catch (e) {}
  });

  /* ---------- Settings > Touch tab ---------- */
  const TOUCH_ROWS = [
    { k: 'touchMode', name: 'Touch controls', kind: 'choice', opts: () => MODE_OPTS, tip: 'Auto shows the buttons on phones and tablets. On also works on touch-screen laptops. Off hides them.' },
    { k: 'touchSize', name: 'Button size', kind: 'choice', opts: () => SIZE_OPTS.map(o => [o[0], o[1]]), tip: 'How big the stick and buttons are. Every button stays at least 44 pixels.' },
    { k: 'touchAlpha', name: 'Button look', kind: 'choice', opts: () => ALPHA_OPTS.map(o => [o[0], o[1]]), tip: 'Faint lets you see more of the game behind the buttons.' },
    { k: 'touchLeft', name: 'Left-handed (swap sides)', kind: 'toggle', tip: 'Stick on the right, JUMP and DIG on the left.' },
    { k: 'clickMine', name: 'Tap a block to dig', kind: 'toggle', tip: 'Tap or hold a block to mine it. Same as Left-click to dig on a PC.' },
    { k: 'fps30', name: 'Battery saver (30 FPS)', kind: 'toggle', tip: 'Draws half as many frames. Saves battery on phones and handhelds. The game speed stays the same.' },
    { k: 'touchPause', name: 'Pause when the app is hidden', kind: 'toggle', tip: 'Single player pauses when you switch apps or lock the screen. Co-op keeps running.' }
  ];
  SET_TABS.push({ id: 'touch', name: 'Touch', x: 296 });
  SET_TAB_ORDER.push('touch');
  const TR_X = 140, TR_Y0 = 46, TR_DY = 19;
  const trY = i => TR_Y0 + i * TR_DY;
  const trLabel = r => { const o = r.opts().find(x => x[0] === SETTINGS[r.k]) || r.opts()[0]; return o[1]; };
  function trChange(r, d) {
    if (r.kind === 'toggle') SETTINGS[r.k] = !SETTINGS[r.k];
    else { const ids = r.opts().map(o => o[0]); SETTINGS[r.k] = cyc(ids, ids.includes(SETTINGS[r.k]) ? SETTINGS[r.k] : ids[0], d || 1); }
    if (typeof settingsDirty === 'function') settingsDirty(); persistSettings(); sfx('ui'); layout();
  }
  const _tTabs = drawSetTabs;
  drawSetTabs = function () {
    const sv = text;   /* four tabs: the "Q / E tabs" hint has no room, the tabs are tapped / clicked or switched with Q/E, LB/RB */
    text = function (s) { if (s === 'Q / E tabs' || s === 'LB / RB tabs') return; return sv.apply(this, arguments); };
    try { _tTabs.apply(this, arguments); } finally { text = sv; }
  };
  function drawTouchTab() {
    panelBg('SETTINGS');
    drawMenuBtn(380, 14, 70, 14, 'Back');
    drawSetTabs();
    const sel = S._trSel | 0, nav = S._trNav && lastInput !== 'mouse';
    const mx = mouse.x / SCALE, my = mouse.y / SCALE;
    text('TOUCH  (phones and tablets)', 24, 39, '#e6c34a', 6);
    for (let i = 0; i < TOUCH_ROWS.length; i++) {
      const r = TOUCH_ROWS[i], y = trY(i), hot = (nav && sel === i) || hitBox(mx, my, 20, y - 7, 420, 16);
      if (hot) { g.fillStyle = 'rgba(230,195,74,0.10)'; g.fillRect(20, y - 7, 420, 16); g.fillStyle = '#e6c34a'; g.fillRect(20, y - 7, 2, 16); }
      if (r.kind === 'toggle') { const on = !!SETTINGS[r.k]; text(drawChk(on) + ' ' + r.name, 28, y + 4, on ? '#e6c34a' : (hot ? '#ffe080' : '#e8e0d0'), 7); }
      else { text(r.name, 28, y + 4, hot ? '#ffe080' : '#c8b89a', 7); text('<  ' + trLabel(r) + '  >', TR_X, y + 4, '#e8e0d0', 7); }
    }
    const tipI = nav ? sel : TOUCH_ROWS.findIndex((r, i) => hitBox(mx, my, 20, trY(i) - 7, 420, 16));
    const tip = tipI >= 0 ? TOUCH_ROWS[tipI].tip : (on() ? 'Tap a row to change it.' : 'Click a row to change it.');
    wrapWords(tip, 400, 6).slice(0, 2).forEach((ln, j) => text(ln, 28, 190 + j * 9, '#a09080', 6));
    text('Touch buttons are ' + (on() ? 'showing' : 'hidden') + (coarse ? ' (touch screen found)' : ''), 28, 212, '#806850', 6);
    text(lastInput === 'pad' ? 'Up/Down pick   Left/Right change   A toggle' : on() ? 'Tap a row to change it' : 'W/S pick   A/D change   Enter toggle', 236, 222, '#806850', 6);
  }
  const _tDraw = drawSettings;
  drawSettings = function () { if (setTab() === 'touch') { drawTouchTab(); return; } return _tDraw.apply(this, arguments); };
  const _tUI = handleMenuUI;
  handleMenuUI = function () {
    if (!(S.paused && S.menu === 'settings' && setTab() === 'touch')) return _tUI.apply(this, arguments);
    const mx = mouse.x / SCALE, my = mouse.y / SCALE;
    for (const t of SET_TABS) if (clickedBox(mx, my, t.x, SET_TAB_Y, SET_TAB_W, SET_TAB_H)) { setTabSwitch(t.id); mouse.clicked = false; return; }
    if (pressed('q') || pressed('_slotPrev')) { setTabSwitch(cyc(SET_TAB_ORDER, setTab(), -1)); return; }
    if (pressed('e') || pressed('_slotNext')) { setTabSwitch(cyc(SET_TAB_ORDER, setTab(), 1)); return; }
    if (clickedBox(mx, my, 380, 14, 70, 14)) { persistSettings(); sfx('ui'); S.menu = 'pause'; mouse.clicked = false; return; }
    for (let i = 0; i < TOUCH_ROWS.length; i++) {
      const r = TOUCH_ROWS[i], y = trY(i);
      if (clickedBox(mx, my, 20, y - 7, 410, 16)) { S._trSel = i; S._trNav = false; trChange(r, r.kind === 'choice' && mx < TR_X + 10 && mx >= TR_X - 4 ? -1 : 1); }
    }
    const n = TOUCH_ROWS.length;
    const up = pressed('w') || pressed('ArrowUp'), dn = pressed('s') || pressed('ArrowDown');
    const lf = pressed('a') || pressed('ArrowLeft'), rt = pressed('d') || pressed('ArrowRight'), ok = pressed('Enter') || pressed(' ');
    if (up || dn || lf || rt || ok) S._trNav = true;
    if (up) { S._trSel = ((S._trSel | 0) + n - 1) % n; sfx('hover'); }
    if (dn) { S._trSel = ((S._trSel | 0) + 1) % n; sfx('hover'); }
    const r = TOUCH_ROWS[S._trSel | 0];
    if (lf || rt) trChange(r, lf ? -1 : 1); else if (ok) trChange(r, 1);
    mouse.clicked = false;
  };

  /* ---------- the overlay ---------- */
  const key = (k, down) => window.dispatchEvent(new KeyboardEvent(down ? 'keydown' : 'keyup', { key: k, bubbles: true }));
  const tap = k => { key(k, true); setTimeout(() => key(k, false), 70); };
  const safeUnlock = () => { try { unlockAudio(); } catch (e) {} };   /* v0.26.31: a sound error never blocks a button */
  const ui = document.createElement('div'); ui.id = 'tc'; document.body.appendChild(ui);
  const el = (tag, cls, html, parent) => { const e = document.createElement(tag); e.className = cls; if (html != null) e.innerHTML = html; (parent || ui).appendChild(e); return e; };
  const act = el('div', 'tc-act');
  const stick = el('div', 'tc-stick'), nub = el('div', 'tc-nub', null, stick); el('div', 'tc-lbl tc-stick-lbl', 'move / climb', stick);
  let sid = null, held = {}, lastDir = 's';
  const setDir = (dx, dy) => {
    const want = { a: dx < -0.35, d: dx > 0.35, w: dy < -0.45, s: dy > 0.45 };
    for (const k in want) { if (want[k] !== !!held[k]) { key(k, want[k]); held[k] = want[k]; } if (want[k]) lastDir = k; }
    /* v0.26.31: DIG held first, then the stick: dig where the stick points, not the old way too (that is a diagonal = no dig) */
    if (digK && (held.a || held.d || held.w || held.s) && !held[digK]) { key(digK, false); digK = null; }
  };
  const stickMove = t => { const r = stick.getBoundingClientRect(), R = r.width / 2; let dx = (t.clientX - r.left - R) / R, dy = (t.clientY - r.top - R) / R; const m = Math.hypot(dx, dy); if (m > 1) { dx /= m; dy /= m; } nub.style.transform = `translate(${dx * R * 0.55}px,${dy * R * 0.55}px)`; setDir(dx, dy); };
  stick.addEventListener('touchstart', e => { e.preventDefault(); safeUnlock(); const t = e.changedTouches[0]; sid = t.identifier; stickMove(t); }, { passive: false });
  stick.addEventListener('touchmove', e => { e.preventDefault(); for (const t of e.changedTouches) if (t.identifier === sid) stickMove(t); }, { passive: false });
  const stickEnd = e => { for (const t of e.changedTouches) if (t.identifier === sid) { sid = null; nub.style.transform = ''; setDir(0, 0); } };
  stick.addEventListener('touchend', stickEnd); stick.addEventListener('touchcancel', stickEnd);
  const btn = (parent, cls, label, sub, down, up) => {
    const b = el('div', 'tc-btn ' + cls, `<b>${label}</b>${sub ? `<i>${sub}</i>` : ''}`, parent);
    b.addEventListener('touchstart', e => { e.preventDefault(); safeUnlock(); b.classList.add('on'); down(); }, { passive: false });
    const end = e => { e.preventDefault(); b.classList.remove('on'); up && up(); };
    b.addEventListener('touchend', end, { passive: false }); b.addEventListener('touchcancel', end, { passive: false });
    b.addEventListener('click', e => { if (e.detail === 0 || !('ontouchstart' in window)) { down(); up && setTimeout(up, 70); } });  /* mouse on a touch laptop */
    return b;
  };
  /* v0.26.31 hotfix: JUMP is the game's jump key (W / Up). Before, it sent the pump key (Space), so it pumped the hose
     and never jumped. A tap always makes a fresh press, even while the stick is held up. Holding it digs up after
     0.25 s, the same as holding W on a PC. */
  let digK = null, digOn = false, jumpK = false;
  btn(act, 'tc-jump', 'JUMP', null, () => { if (keys.w) key('w', false); key('w', true); jumpK = true; }, () => { if (jumpK && !held.w) key('w', false); jumpK = false; });
  /* v0.26.31 hotfix: DIG digs even with "Tap a block to dig" on (the phone default). That setting turns off digging
     with direction keys, so DIG used to do nothing. While DIG is held, the stick (or the last way it pointed) digs. */
  btn(act, 'tc-dig', 'DIG', 'hold', () => { digOn = true; if (!(held.a || held.d || held.w || held.s)) { digK = lastDir; key(digK, true); } },
    () => { digOn = false; if (digK && !held[digK]) key(digK, false); digK = null; });
  btn(act, 'tc-pump', 'PUMP', 'hose', () => key(bindKey('pump'), true), () => key(bindKey('pump'), false));
  try { const _tcCO = a24dClickOnly; a24dClickOnly = function () { return digOn ? false : _tcCO.apply(this, arguments); }; } catch (e) {}
  btn(act, 'tc-use', 'E', 'use', () => tap(bindKey('interact')));
  btn(act, 'tc-item', 'Q', 'item', () => tap(bindKey('use')));
  btn(act, 'tc-pack', 'PACK', null, () => tap(bindKey('inv')));
  btn(act, 'tc-map', 'MAP', null, () => tap(bindKey('map') || 'm'));
  const top = el('div', 'tc-top');
  btn(top, 'tc-sm', 'CRAFT', null, () => tap(bindKey('craft')));
  btn(top, 'tc-sm', 'EAT', null, () => tap(bindKey('eat')));
  btn(top, 'tc-sm', 'DRINK', null, () => tap(bindKey('drink')));
  btn(top, 'tc-sm tc-menu-btn', '☰', null, () => tap('Escape'));
  const menu = el('div', 'tc-menu');
  btn(menu, 'tc-sm tc-tabl', '◀ TAB', null, () => tabStep(-1));
  btn(menu, 'tc-sm tc-tabr', 'TAB ▶', null, () => tabStep(1));
  btn(menu, 'tc-sm tc-leg', 'LEGEND', null, () => tap('l'));
  btn(menu, 'tc-sm tc-close', '✕ CLOSE', null, () => tap('Escape'));
  const hint = el('div', 'tc-hint', 'tap a block to dig it · hold a slot for more');
  setTimeout(() => hint.classList.add('gone'), 9000);
  /* TAB buttons: the panel tab strip (Pack, Craft, Skills...) or the Settings tabs */
  function tabStep(d) {
    try {
      if (S.paused && S.menu === 'settings') { setTabSwitch(cyc(SET_TAB_ORDER, setTab(), d)); return; }
      const ai = menuTabsActive(); if (ai >= 0) menuTabGo(ai + d);
    } catch (e) {}
  }
  function hasTabs() { try { return (S.paused && S.menu === 'settings') || menuTabsActive() >= 0; } catch (e) { return false; } }

  /* ---------- state ---------- */
  function playMode() {
    try { return !!(S && S.p && !S.p.dead && !uiOpen() && !S.mapOpen && !S.stashOpen && !S.charSel && !S.nameEntry && !S.kc); } catch (e) { return false; }
  }
  function on() { return wanted() && lastInput !== 'pad'; }
  let lastKey = '';
  /* v0.26.33: read safe-area insets (iPhone notch / home bar) without touching layout math elsewhere */
  function safeInsets() {
    const s = getComputedStyle(document.documentElement);
    const n = v => { const x = parseFloat(s.getPropertyValue(v)); return isFinite(x) ? x : 0; };
    /* env() only resolves on some elements; fall back to #tc padding once applied */
    let l = n('--sai-l'), r = n('--sai-r'), b = n('--sai-b'), t = n('--sai-t');
    if (!(l || r || b || t)) {
      try {
        const cs = getComputedStyle(ui);
        l = parseFloat(cs.paddingLeft) || 0; r = parseFloat(cs.paddingRight) || 0;
        b = parseFloat(cs.paddingBottom) || 0; t = parseFloat(cs.paddingTop) || 0;
      } catch (e) {}
    }
    return { l, r, b, t };
  }
  /* hotbar band in css px from the bottom of the canvas (Handheld UI makes it taller) */
  function hotbarBandCss(cr) {
    let hk = 1; try { if (typeof uiK === 'function') hk = uiK(); } catch (e) {}
    const viewH = (typeof VH === 'number' && VH > 0) ? VH : 270;
    return Math.max(28, (22 * hk / viewH) * cr.height + 10);
  }
  function layout() {
    const show = on();
    document.documentElement.classList.toggle('touch', show);
    ui.style.display = show ? '' : 'none';
    if (!show) return;
    const cr = canvas.getBoundingClientRect(), bar = (window.innerWidth - cr.width) / 2;
    const sz = (SIZE_OPTS.find(o => o[0] === SETTINGS.touchSize) || SIZE_OPTS[1])[2];
    const al = (ALPHA_OPTS.find(o => o[0] === SETTINGS.touchAlpha) || ALPHA_OPTS[1])[2];
    const mode = playMode() ? 'play' : (S && S.mapOpen ? 'map' : 'menu');
    const tabs = mode !== 'play' && hasTabs();
    const safe = safeInsets();
    const aspect = window.innerWidth / Math.max(1, window.innerHeight);
    const botGap = Math.max(0, window.innerHeight - cr.bottom);
    const lefty = !!SETTINGS.touchLeft;
    const k = [mode, tabs, bar >= 64, sz, al, lefty, window.innerWidth, window.innerHeight, VH, cr.top, cr.left, cr.width, cr.height, botGap.toFixed(1), aspect.toFixed(3)].join();
    if (k === lastKey) return;
    lastKey = k;
    ui.style.setProperty('--ts', sz); ui.style.setProperty('--ta', al);
    ui.style.setProperty('--bar', Math.max(0, bar) + 'px');
    ui.classList.toggle('bars', bar >= 64);
    ui.classList.toggle('lefty', lefty);
    ui.classList.toggle('menu', mode !== 'play');
    ui.classList.toggle('map', mode === 'map');
    ui.classList.toggle('notabs', !tabs);
    ui.classList.toggle('square', aspect < 1.4);
    /* the tab strip sits along the top of every panel: in map mode without side bars the buttons sit just under it */
    ui.style.setProperty('--tabh', Math.round(cr.top + cr.height * 0.075) + 'px');
    /* v0.26.29: 16:9 phones (no side bars): TAB / TAB / CLOSE sit in the strip under the menu panel instead of on top of
       its bottom edge and hint line. The panels end about 27 game pixels above the bottom of the view. */
    const below = window.innerHeight - (cr.top + cr.height * (VH - 27) / VH);
    const mbh = Math.max(34, Math.min(44, Math.floor(below - 4)));
    ui.style.setProperty('--mbh', mbh + 'px');
    ui.style.setProperty('--mbb', Math.max(2, Math.floor((below - mbh) / 2)) + 'px');

    /* ---------- v0.26.33: place stick + action cluster vs the canvas / letterbox / hotbar ---------- */
    const stickH = 110 * sz, actH = 210 * sz;
    const hb = hotbarBandCss(cr);
    const minPad = 8 + safe.b;
    let stickBottom, actBottom;
    if (mode === 'play' && aspect < 1.4 && botGap >= stickH + 12) {
      /* near-square with a real bottom letterbox: park the stick in that bar, clear of the canvas */
      stickBottom = Math.max(minPad, Math.floor((botGap - stickH) / 2));
      actBottom = Math.max(minPad, Math.min(stickBottom, Math.floor((botGap - Math.min(actH * 0.55, botGap - 8)) / 2)));
    } else if (mode === 'play') {
      /* wide or short letterbox: keep thumb reach, but lift clear of the hotbar band on the canvas */
      const aboveHb = botGap + hb + 8;
      stickBottom = 46 + safe.b;
      actBottom = safe.b;
      if (stickBottom < botGap + hb && stickBottom + stickH > botGap) stickBottom = aboveHb;
      if (actBottom < botGap + hb * 0.55 && actBottom + actH * 0.45 > botGap) actBottom = Math.min(aboveHb, botGap + Math.floor(hb * 0.35));
      /* never push the stick off-screen */
      const maxBottom = window.innerHeight - stickH - 4 - safe.t;
      if (stickBottom > maxBottom) stickBottom = Math.max(minPad, maxBottom);
    } else {
      stickBottom = 46 + safe.b; actBottom = safe.b;
    }
    /* keep stick / act inside the canvas horizontal band (or the side letterbox on wide phones) */
    const stickW = 110 * sz;
    let stickLeft = Math.max(16 + safe.l, Math.floor(cr.left + 10));
    let stickRight = Math.max(16 + safe.r, Math.floor(window.innerWidth - cr.right + 10));
    if (bar >= 64) { stickLeft = Math.max(10 + safe.l, 10); stickRight = Math.max(10 + safe.r, 10); }
    /* clamp so the stick stays on screen */
    if (!lefty && stickLeft + stickW > window.innerWidth - 8) stickLeft = Math.max(4, window.innerWidth - stickW - 8);
    if (lefty && stickRight + stickW > window.innerWidth - 8) stickRight = Math.max(4, window.innerWidth - stickW - 8);
    const actRight = Math.max(0, Math.floor(window.innerWidth - cr.right));
    const actLeft = Math.max(0, Math.floor(cr.left));
    if (lefty) {
      ui.style.setProperty('--stick-left', 'auto');
      ui.style.setProperty('--stick-right', stickRight + 'px');
      ui.style.setProperty('--act-right', 'auto');
      ui.style.setProperty('--act-left', actLeft + 'px');
    } else {
      ui.style.setProperty('--stick-left', stickLeft + 'px');
      ui.style.setProperty('--stick-right', 'auto');
      ui.style.setProperty('--act-right', actRight + 'px');
      ui.style.setProperty('--act-left', 'auto');
    }
    ui.style.setProperty('--stick-bottom', Math.round(stickBottom) + 'px');
    ui.style.setProperty('--act-bottom', Math.round(actBottom) + 'px');
  }
  setInterval(layout, 120);
  window.addEventListener('resize', () => { lastKey = ''; layout(); });
  window.addEventListener('orientationchange', () => { lastKey = ''; setTimeout(layout, 50); setTimeout(layout, 300); });

  /* a touch after using a gamepad brings the touch buttons back */
  window.addEventListener('touchstart', () => { if (wanted() && lastInput === 'pad') { lastInput = 'kb'; lastKey = ''; layout(); } }, { capture: true, passive: true });

  /* ---------- touches on the game itself ---------- */
  const cv = canvas;
  /* same mapping as the game's own mouse (v25MousePos): game units = view x SCALE, whatever the canvas backing size */
  const fitBox = () => {
    const r = cv.getBoundingClientRect(); let cw = r.width, ch = r.height, ox = 0, oy = 0, fit = '';
    try { fit = getComputedStyle(cv).objectFit; } catch (e) {}
    if (fit === 'contain') { const k = Math.min(r.width / VW, r.height / VH); cw = VW * k; ch = VH * k; ox = (r.width - cw) / 2; oy = (r.height - ch) / 2; }
    return { l: r.left + ox, t: r.top + oy, w: cw, h: ch };
  };
  const toCanvas = t => { const f = fitBox(); return [(t.clientX - f.l) * (VW * SCALE / f.w), (t.clientY - f.t) * (VH * SCALE / f.h)]; };
  const pxPerView = () => fitBox().w / VW;   /* css px per view unit */
  let T = null, pinch = null;
  function snap(x, y) {
    /* 44 px targets: a tap that misses every button by under 22 css px lands on the nearest one */
    try {
      if (!PNAV.menu || !PNAV.rects || !PNAV.rects.length) return [x, y];
      const vx = x / SCALE, vy = y / SCALE, lim = 22 / pxPerView();
      let best = null, bd = 1e9;
      for (const r of PNAV.rects) {
        const dx = Math.max(r.x - vx, 0, vx - (r.x + r.w)), dy = Math.max(r.y - vy, 0, vy - (r.y + r.h)), d = Math.hypot(dx, dy);
        if (d === 0) return [x, y];
        if (d < bd) { bd = d; best = r; }
      }
      if (best && bd <= lim) return [(best.x + best.w / 2) * SCALE, (best.y + best.h / 2) * SCALE];
    } catch (e) {}
    return [x, y];
  }
  const fishBusy = () => { try { return !!_fishTouch; } catch (e) { return false; } };
  cv.addEventListener('touchstart', e => {
    if (!on() || fishBusy()) return;
    e.preventDefault(); unlockAudio(); lastInput = 'kb';
    if (e.touches.length >= 2 && S && S.mapOpen) {
      const [a, b] = [e.touches[0], e.touches[1]];
      pinch = { d: Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY) };
      if (T && T.down) mouse.down = false;
      T = null; clearTimeout(lpT); return;
    }
    if (T) return;
    const t = e.changedTouches[0], [x, y] = toCanvas(t);
    T = { id: t.identifier, sx: t.clientX, sy: t.clientY, x, y, down: false, moved: false, long: false };
    mouse.x = x; mouse.y = y;
    if (playMode()) {
      /* v0.26.29: a tap on a Farm Plot, Chicken Coop or Animal Pen no longer picks it up; press and hold it instead */
      let pk = null; try { pk = typeof v2629PickHoldStart === 'function' ? v2620PickTarget() : null; } catch (er) { pk = null; }
      if (pk) { T.pick = true; v2629PickHoldStart(pk, 'touch'); return; }
      T.down = true; mouse.down = true; mouse.clicked = true; return;
    }
    lpT = setTimeout(() => {
      if (!T || T.moved || T.down) return;
      T.long = true; mouse.x = T.x; mouse.y = T.y; mouse.right = true;
      try { navigator.vibrate && navigator.vibrate(15); } catch (er) {}
    }, 450);
  }, { passive: false });
  let lpT = null;
  cv.addEventListener('touchmove', e => {
    if (!on() || fishBusy()) return;
    e.preventDefault();
    if (pinch && e.touches.length >= 2) {
      const [a, b] = [e.touches[0], e.touches[1]], d = Math.hypot(a.clientX - b.clientX, a.clientY - b.clientY);
      const r = d / pinch.d;
      if (r > 1.22 || r < 0.82) {
        const [cx, cy] = toCanvas({ clientX: (a.clientX + b.clientX) / 2, clientY: (a.clientY + b.clientY) / 2 });
        try { mapZoom(r > 1 ? 1 : -1, cx / SCALE, cy / SCALE); } catch (er) {}
        pinch.d = d;
      }
      return;
    }
    if (!T) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== T.id) continue;
      const [x, y] = toCanvas(t);
      if (T.pick) { if (Math.hypot(t.clientX - T.sx, t.clientY - T.sy) > 12) { try { v2629PickHoldCancel(); } catch (er) {} } continue; }
      if (!T.down && !T.long && Math.hypot(t.clientX - T.sx, t.clientY - T.sy) > 8) {
        /* a drag: press where the finger started, then follow it (moves items, pans the map, drags sliders) */
        clearTimeout(lpT); T.moved = true; T.down = true;
        mouse.x = T.x; mouse.y = T.y; mouse.down = true; mouse.clicked = true;
        setTimeout(() => { mouse.x = x; mouse.y = y; }, 40);
        return;
      }
      mouse.x = x; mouse.y = y;
    }
  }, { passive: false });
  const tEnd = e => {
    if (!on()) return;
    if (pinch) { if (e.touches.length < 2) pinch = null; e.preventDefault(); return; }
    if (!T || fishBusy()) return;
    for (const t of e.changedTouches) {
      if (t.identifier !== T.id) continue;
      e.preventDefault(); clearTimeout(lpT);
      if (T.pick) { try { v2629PickHoldEnd('touch'); } catch (er) {} }
      else if (T.down) { mouse.down = false; }
      else if (!T.long) {
        const [x, y] = snap(T.x, T.y);
        mouse.x = x; mouse.y = y; mouse.down = true; mouse.clicked = true;
        setTimeout(() => { mouse.down = false; }, 50);
        kbMaybe(x / SCALE, y / SCALE);
      }
      T = null;
    }
  };
  cv.addEventListener('touchend', tEnd, { passive: false });
  cv.addEventListener('touchcancel', tEnd, { passive: false });

  /* ---------- phone keyboard for co-op fields (name, Wi-Fi address, join code) and chat ----------
     The game reads typed keys; a phone only shows its keyboard for a focused text box, so a hidden box is focused
     when a field is tapped and what is typed in it is passed to the game as key presses (same rules, same limits). */
  const kb = document.createElement('input');
  kb.id = 'tc-kb'; kb.type = 'text'; kb.autocomplete = 'off'; kb.setAttribute('autocapitalize', 'off'); kb.setAttribute('autocorrect', 'off'); kb.spellcheck = false;
  kb.setAttribute('aria-label', 'Type here'); kb.maxLength = 80; document.body.appendChild(kb);
  const kbField = () => { try { return NET.chatOpen ? 'chatBuf' : (NET.edit && S && S.paused && S.menu === 'mp' ? NET.edit : null); } catch (e) { return null; } };
  function kbFocus() { kb.value = ''; kb.focus({ preventScroll: true }); setTimeout(() => { const f = kbField(); kb.value = f ? NET[f] : ''; }, 60); }
  function kbMaybe(vx, vy) {
    try {
      if (!(S && S.paused && S.menu === 'mp' && NET.role === 'off' && !NET.hostLeft)) return;
      const inR = (x, y, w, h) => vx >= x && vx <= x + w && vy >= y && vy <= y + h;
      if (inR(120, 40, 150, 16) || inR(210, 84, 150, 16) || inR(210, 132, 70, 16) || inR(40, 132, 120, 18)) kbFocus();
    } catch (e) {}
  }
  kb.addEventListener('input', () => {
    const f = kbField(); if (!f) { kb.value = ''; return; }
    const val = kb.value, cur = NET[f] || ''; let p = 0;
    while (p < val.length && p < cur.length && val[p] === cur[p]) p++;
    for (let i = cur.length; i > p; i--) key('Backspace', true);
    for (const ch of val.slice(p)) key(ch, true);
    kb.value = NET[f] || '';
  });
  kb.addEventListener('blur', () => { if (kbField() && !NET.chatOpen) key('Enter', true); });   /* keyboard closed: the field is done */
  setInterval(() => { if (document.activeElement === kb && !kbField()) kb.blur(); }, 200);
  /* CHAT button while playing co-op (the T key) */
  const chatB = btn(top, 'tc-sm tc-chat', 'CHAT', null, () => {
    kbFocus();
    try { const ck = (Object.keys(BIND_DEFS || {}).some(a => bindKey(a) === 't')) ? 'y' : 't'; key(ck, true); key(ck, false); } catch (e) {}
  });
  setInterval(() => { try { chatB.style.display = NET.live() ? '' : 'none'; } catch (e) { chatB.style.display = 'none'; } }, 500);

  /* ---------- touch hints: the keyboard hints on screen read as touch while the touch buttons show ---------- */
  const HINTS = [
    [/^Click a row to change it\.$/, 'Tap a row to change it.'],
    [/^W\/S pick   A\/D change   Enter toggle$/, 'Tap a row to change it'],
    [/^Q \/ E tabs$/, 'TAB buttons switch tabs'],
    [/^M \/ ESC close$/i, 'CLOSE button closes'],
    [/^drag \/ arrows pan   wheel \/ \+ - zoom   C center   L legend.*$/, 'drag to pan   pinch to zoom   LEGEND button shows / hides the key'],
    [/^LEGEND  \(L hide\)$/, 'LEGEND'],
    [/^Enter \/ A \/ click: buy or sell 1\.   Shift\+Enter: sell all\.$/, 'Tap: buy or sell 1.   Hold: more choices.'],
    [/^\* makes you trippy\.   \S+ \/ Esc: leave$/, '* makes you trippy.   CLOSE to leave'],
    [/^(.*?)\s+E close$/, '$1'],
    [/^Tab close · drag to move · right-click use · R craft$/, 'tap to pick · drag to move · hold to use'],
    [/^PACK\s+Tab\/I close\s+drag to move\s+right-click use.*$/, 'PACK   drag to move   hold to use'],
    [/^click move \u00b7 right-click use \u00b7 shift\+click split .*$/, 'tap pick up / put down \u00b7 hold to use \u00b7 drag to move'],
    [/^1 2 3 or click a tab\s+arrows pick\s+Enter learn.*$/, 'tap a tab   tap a skill to read it, tap again to learn'],
    [/^Click to learn rank (\d+)$/, 'Tap again to learn rank $1'],
    [/^tap a block to dig it.*$/, '$&']
  ];
  const memo = new Map();
  function touchHint(s) {
    let r = memo.get(s);
    if (r !== undefined) return r;
    r = s;
    for (const [re, rep] of HINTS) if (re.test(s)) { r = s.replace(re, rep); break; }
    if (r === s) r = keyHintLine(s);
    if (memo.size > 3000) memo.clear();
    memo.set(s, r);
    return r;
  }
  /* bottom key strips like "C skills  E set spawn  TAB pack  R craft  M map  SPACE pump  ESC menu": button names */
  const KEYWORD = { SPACE: 'JUMP', ESC: '☰', TAB: 'PACK', E: 'E', Q: 'Q', R: 'CRAFT', M: 'MAP', F: 'EAT', G: 'DRINK' };
  function keyHintLine(s) {
    if (!/^(?:[A-Z][A-Z0-9]{0,4}\s+[a-z][^A-Z]*?\s*){3,}$/.test(s)) return s;
    const parts = s.trim().split(/\s{2,}|\s(?=[A-Z][A-Z0-9]{0,4}\s)/);
    const out = [];
    for (const p of parts) { const m = p.match(/^([A-Z][A-Z0-9]{0,4})\s+(.*)$/); if (!m) continue; const kk = KEYWORD[m[1]]; if (kk) out.push(kk.toLowerCase() === m[2].trim().toLowerCase() ? kk : kk + ' ' + m[2]); }
    return out.join('   ');
  }
  const _tText = text;
  text = function (s) {
    if (typeof s === 'string' && s.length > 2 && on()) { const r = touchHint(s); if (r !== s) { const a = Array.prototype.slice.call(arguments); a[0] = r; return _tText.apply(this, a); } }
    return _tText.apply(this, arguments);
  };

  /* panel titles carry their key hints after the name (split into big title + small hints) */
  const _tPanelBg = panelBg;
  panelBg = function (t) { if (typeof t === 'string' && on()) { const a = Array.prototype.slice.call(arguments); a[0] = touchHint(t); return _tPanelBg.apply(this, a); } return _tPanelBg.apply(this, arguments); };
  /* the bottom-right key strip is the touch buttons' job on a phone (it sat under DIG / JUMP) */
  const _tStripHid = stripHidden;
  stripHidden = function () { return on() || _tStripHid.apply(this, arguments); };
  /* skills: on a touch screen the first tap shows the skill's card, a second tap learns it (a tap used to buy at once) */
  let lastTouchT = 0;
  cv.addEventListener('touchend', () => { lastTouchT = performance.now(); }, { capture: true, passive: true });
  const _tBuySkill = buySkill;
  buySkill = function (id) {
    if (on() && performance.now() - lastTouchT < 700 && id && S._skTouchSel !== id) { S._skTouchSel = id; S._skSel = id; try { sfx('hover'); } catch (e) {} return; }
    S._skTouchSel = null;
    return _tBuySkill.apply(this, arguments);
  };

  /* offline cache for the home-screen app: https hosting only (a LAN http address or the desktop app never registers it) */
  try {
    if ('serviceWorker' in navigator && (location.protocol === 'https:' || q.get('sw') === '1') && !/Electron/i.test(navigator.userAgent))
      navigator.serviceWorker.register('sw.js?v=' + encodeURIComponent(VERSION)).catch(() => {});
  } catch (e) {}

  /* v0.26.33: test hooks — canvas/hotbar/control rects in css px for overlap checks */
  function controlRects() {
    const stickR = stick.getBoundingClientRect();
    const btns = {};
    for (const s of ['.tc-jump', '.tc-dig', '.tc-pump', '.tc-use', '.tc-item', '.tc-pack', '.tc-map']) {
      const e = ui.querySelector(s); if (e) btns[s.slice(4)] = e.getBoundingClientRect();
    }
    const cr = canvas.getBoundingClientRect();
    const slots = [];
    try {
      const hk = (typeof uiK === 'function' ? uiK() : 1);
      for (let i = 0; i < 10; i++) {
        const vr = typeof hbSlotR === 'function' ? hbSlotR(i) : { x: (10 + i * 18) * hk, y: VH - 22 * hk, w: 17 * hk, h: 17 * hk };
        slots.push({
          i,
          left: cr.left + (vr.x / VW) * cr.width,
          top: cr.top + (vr.y / VH) * cr.height,
          right: cr.left + ((vr.x + vr.w) / VW) * cr.width,
          bottom: cr.top + ((vr.y + vr.h) / VH) * cr.height
        });
      }
    } catch (e) {}
    return { stick: stickR, btns, canvas: cr, slots, aspect: window.innerWidth / Math.max(1, window.innerHeight), square: ui.classList.contains('square') };
  }
  function overlaps(a, b) {
    return !!a && !!b && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
  }
  window.BurrowTouch = { on, wanted, playMode, touchHint, rows: TOUCH_ROWS, layout: () => { lastKey = ''; layout(); }, controlRects, overlaps };
  layout();
})();
