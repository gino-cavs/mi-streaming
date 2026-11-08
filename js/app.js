/* FUNVS como app (celu / Fire Stick): botón Atrás, tecla Menú, teclas multimedia
   y moverse con las flechas del control (navegación espacial). En la compu no molesta:
   solo se activa al usar las flechas fuera de un campo de texto. */
const FUNVSApp = (() => {
  const UA = navigator.userAgent, inApp = /FUNVSApp/.test(UA), tv = /FUNVSTV|AFT[A-Z]|Silk.*TV/.test(UA);
  if (inApp) document.documentElement.classList.add('inapp');
  if (tv) document.documentElement.classList.add('tvapp', 'dpad');

  const SEL = 'a[href], button:not([disabled]), input:not([disabled]):not([type=hidden]), select, textarea, summary, [tabindex]:not([tabindex="-1"])';
  const vis = el => { const r = el.getBoundingClientRect(); if (r.width < 2 || r.height < 2) return false;
    if (el.checkVisibility) return el.checkVisibility({ checkOpacity:true, checkVisibilityCSS:true });
    const s = getComputedStyle(el); return s.visibility !== 'hidden' && s.display !== 'none'; };
  const scope = () => [...document.querySelectorAll('dialog[open]')].pop() || document;

  function move(dir) {
    const cur = document.activeElement && document.activeElement !== document.body ? document.activeElement : null;
    const all = [...scope().querySelectorAll(SEL)].filter(el => el !== cur && vis(el) && !el.closest('[inert],[aria-hidden="true"]'));
    if (!cur) { const vh = innerHeight; const f = all.find(el => { const r = el.getBoundingClientRect(); return r.top >= 0 && r.top < vh; }) || all[0]; f?.focus(); return !!f; }
    const a = cur.getBoundingClientRect(), ax = a.left + a.width / 2, ay = a.top + a.height / 2;
    let best = null, bs = Infinity;
    for (const el of all) {
      const b = el.getBoundingClientRect(), bx = b.left + b.width / 2, by = b.top + b.height / 2;
      let main, side;
      if (dir === 'down')  { if (b.top < a.bottom - 4 && by <= ay + 4) continue; main = Math.max(0, b.top - a.bottom); side = b.right < a.left ? a.left - b.right : b.left > a.right ? b.left - a.right : 0; }
      if (dir === 'up')    { if (b.bottom > a.top + 4 && by >= ay - 4) continue; main = Math.max(0, a.top - b.bottom); side = b.right < a.left ? a.left - b.right : b.left > a.right ? b.left - a.right : 0; }
      if (dir === 'right') { if (b.left < a.right - 4 && bx <= ax + 4) continue; main = Math.max(0, b.left - a.right); side = b.bottom < a.top ? a.top - b.bottom : b.top > a.bottom ? b.top - a.bottom : 0; }
      if (dir === 'left')  { if (b.right > a.left + 4 && bx >= ax - 4) continue; main = Math.max(0, a.left - b.right); side = b.bottom < a.top ? a.top - b.bottom : b.top > a.bottom ? b.top - a.bottom : 0; }
      const sc = main + side * 3 + (dir === 'up' || dir === 'down' ? Math.abs(bx - ax) * .05 : Math.abs(by - ay) * .3);
      if (sc < bs) { bs = sc; best = el; }
    }
    if (!best) return false;
    best.focus({ preventScroll:true });
    best.scrollIntoView({ block:'nearest', inline:'nearest', behavior:'smooth' });
    return true;
  }

  const DIRS = { ArrowUp:'up', ArrowDown:'down', ArrowLeft:'left', ArrowRight:'right' };
  document.addEventListener('keydown', e => {
    if (e.defaultPrevented || e.altKey || e.ctrlKey || e.metaKey) return;
    const k = e.key, sink = () => AudioMgr.sink('slot' + (Player.slots[Player.sel] ? Player.sel : Player.slots.findIndex(Boolean)));
    const playing = $('player')?.classList.contains('show') && Player.slots.some(Boolean);
    if (k === 'MediaPlayPause' || k === 'MediaPlay' || k === 'MediaPause') { const s = playing && sink(); if (s?.toggle) { e.preventDefault(); s.toggle(); } return; }
    if (playing && (k === 'MediaFastForward' || k === 'MediaTrackNext' || k === 'ChannelUp')) { e.preventDefault(); Zap.step(1); return; }
    if (playing && (k === 'MediaRewind' || k === 'MediaTrackPrevious' || k === 'ChannelDown')) { e.preventDefault(); Zap.step(-1); return; }
    const dir = DIRS[k]; if (!dir) return;
    const t = document.activeElement, tag = t?.tagName;
    if (tag === 'TEXTAREA' || tag === 'SELECT' && (dir === 'up' || dir === 'down')) return;
    if (tag === 'INPUT' && (dir === 'left' || dir === 'right') && t.value) return;   // mover el cursor dentro del texto
    if (tag === 'INPUT' && t.type === 'range' && (dir === 'left' || dir === 'right')) return;
    document.documentElement.classList.add('dpad');
    if (move(dir)) e.preventDefault();
  });
  document.addEventListener('mousedown', () => { if (!tv) document.documentElement.classList.remove('dpad'); }, true);

  /** Botón Atrás del celu / control: cierra lo que esté abierto, de a una cosa por vez. */
  function back() {
    if (document.fullscreenElement) { document.exitFullscreen().catch(() => {}); return true; }
    const d = [...document.querySelectorAll('dialog[open]')].pop(); if (d) { d.close(); return true; }
    const p = $('player');
    if (p?.classList.contains('tvmode')) { TV.close(); return true; }
    if (p?.classList.contains('show') && Player.slots.some(Boolean)) { Player.closeAll(); return true; }
    const first = document.querySelector('#sections [data-s]')?.dataset.s;
    if (first && Nav.current && Nav.current !== first) { Nav.go(first); return true; }
    return false;
  }
  const menu = () => $('btnSettings')?.click();
  return { back, menu, move, inApp, tv };
})();
