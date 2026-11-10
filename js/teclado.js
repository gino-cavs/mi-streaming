/* ⌨️ El teclado de la compu como control remoto (modo Compu, con el reproductor abierto).
   Los números de canal (3 5 Enter) están en zapping.js. H o ? muestra la ayuda. */
const Teclado = (() => {
  const KEYS = [
    ['↑ ↓', 'Canal siguiente / anterior'], ['⌫', 'Volver al canal que veías antes'], ['3 5 Enter', 'Ir al canal 35'],
    ['← →', 'Atrasar / adelantar 10 segundos'], ['Fin', 'Volver al vivo'], ['Espacio', 'Pausa / seguir'],
    ['M', 'Silenciar'], ['+ −', 'Subir / bajar volumen'], ['F', 'Pantalla completa'], ['T', 'Pantalla TV'],
    ['L', 'Lista de canales'], ['I', 'Qué están dando'], ['C', 'Chat'], ['A', 'Solo audio'], ['S', 'Guardar momento ⭐'], ['Z', 'Apagado automático: 15 / 30 / 60 / 90 min'],
    ['H  o  ?', 'Esta ayuda'], ['Esc', 'Cerrar / salir de pantalla completa'],
  ];
  const slotI = () => { const i = Player.slots[Player.sel] ? Player.sel : Player.slots.findIndex(Boolean); return i; };
  const sink = () => { const i = slotI(); return i >= 0 ? AudioMgr.sink('slot' + i) : null; };
  function osd(html) {
    let el = $('kbOsd'); if (!el) { el = document.createElement('div'); el.id = 'kbOsd'; }
    (document.fullscreenElement || document.body).appendChild(el);
    el.innerHTML = html; el.classList.add('on'); clearTimeout(el._t); el._t = setTimeout(() => el.classList.remove('on'), 1200);
  }
  function help(show = !$('kbHelp')) {
    $('kbHelp')?.remove(); if (!show) return;
    const el = document.createElement('div'); el.id = 'kbHelp';
    el.innerHTML = `<div><h3>⌨️ El teclado es tu control remoto</h3><div class="kbgrid">${KEYS.map(([k, t]) => `<kbd>${k}</kbd><span>${t}</span>`).join('')}</div><small>Tocá H, ? o Esc para cerrar. Si hiciste clic dentro del video, clic afuera para que vuelva a andar.</small></div>`;
    el.onclick = () => el.remove();
    (document.fullscreenElement || document.body).appendChild(el);
  }
  function full() {
    if (document.fullscreenElement) return document.exitFullscreen().catch(() => {});
    const p = $('player'), fn = p.requestFullscreen || p.webkitRequestFullscreen; if (fn) fn.call(p).catch(() => {});
  }
  function on(e) {
    if (Device.mode !== 'pc' || e.defaultPrevented || e.ctrlKey || e.altKey || e.metaKey) return;
    if (/INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]')) return;
    const k = e.key, low = k.length === 1 ? k.toLowerCase() : k;
    if ($('kbHelp') && (low === 'h' || k === '?' || k === 'Escape')) { e.preventDefault(); e.stopImmediatePropagation(); return help(false); }
    const p = $('player'); if (!p?.classList.contains('show')) { if (low === 'h' || k === '?') { e.preventDefault(); help(true); } return; }
    if (document.activeElement?.closest?.('#zap') && /^Arrow/.test(k)) return;   // dentro de la lista, las flechas recorren la lista
    const has = Player.slots.some(Boolean), s = sink();
    const done = () => { e.preventDefault(); e.stopImmediatePropagation(); };
    switch (low) {
      case 'ArrowUp': case 'PageUp': if (!has) return; done(); return Zap.step(-1);
      case 'ArrowDown': case 'PageDown': if (!has) return; done(); return Zap.step(1);
      case 'ArrowLeft': case 'ArrowRight': if (!s?.seek) return; done(); s.seek(k === 'ArrowLeft' ? -10 : 10); return osd(k === 'ArrowLeft' ? '⏪ 10 s' : '⏩ 10 s');
      case 'End': if (!s?.toLive) return; done(); s.toLive(); return osd('🔴 Al vivo');
      case ' ': case 'k': if (!s?.toggle) return; done(); { const was = s.paused?.(); s.toggle(); return osd(was ? '▶' : '⏸'); }
      case 'm': if (!s) return; done(); { const m = s.muted?.(); m ? AudioMgr.focus('slot' + slotI()) : s.mute(); try { Player.paintActs(); } catch {} return osd(m ? '🔊' : '🔇 Silencio'); }
      case '+': case '=': case '-': case '_': {
        if (!s?.setVol) return; done();
        const v = Math.max(0, Math.min(1, Math.round(((s.getVol?.() ?? S.get('vol', 1)) + (low === '+' || low === '=' ? .1 : -.1)) * 10) / 10));
        s.setVol(v); S.set('vol', v); return osd(`${v ? '🔊' : '🔇'} ${Math.round(v * 100)}%`);
      }
      case 'Backspace': { const c = Player.prev; if (!c) return; done(); return Player.play(c); }
      case 'f': done(); return full();
      case 't': done(); return p.classList.contains('tvmode') ? TV.close() : TV.open(false);
      case 'l': done(); return Zap.listOpen(!Zap.open);
      case 'i': { const i = slotI(); if (i < 0) return; done(); try { InfoBar.forChannel(Player.slots[i].c); } catch {} return; }
      case 'c': { const i = slotI(); if (i < 0) return; done(); return Player.action(i, 'chat'); }
      case 'a': { const i = slotI(); if (i < 0) return; done(); Player.action(i, 'audio'); return osd(Player.slots[i].audio ? '🎧 Solo audio' : '📺 Con video'); }
      case 's': { const i = slotI(); if (i < 0) return; done(); return Player.action(i, 'star'); }
      case 'z': done(); return Zocalos.cycle();
      case 'h': case '?': done(); return help(true);
    }
  }
  function init() {
    document.addEventListener('keydown', on, true);
    // la primera vez que abrís un canal en la compu, aviso que existe
    if (Device.mode === 'pc' && !S.get('kbTip', false)) {
      const t = setInterval(() => { if (Player.slots.some(Boolean)) { clearInterval(t); S.set('kbTip', true); toast('<b>⌨️ El teclado es tu control remoto</b><small>↑↓ cambian de canal, espacio pausa, M silencia… Tocá H para ver todo.</small>', { cls:'info', ms:7000 }); } }, 3000);
    }
  }
  return { init, help };
})();
