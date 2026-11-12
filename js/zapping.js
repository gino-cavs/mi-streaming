/* =========================================================
   Zapping: lista de canales por categoría al costado del reproductor
   Clic para cambiar · ▲▼ (o las flechas del teclado en Pantalla TV) para canal anterior / siguiente
   ========================================================= */
const Zap = (() => {
  let open = S.get('zapOpen', !Lite.tv), q = '', closed = new Set(S.get('zapClosed', []));
  const PCOL = { youtube:'var(--yt)', twitch:'var(--tw)', kick:'var(--kick)' };
  const st = c => (Canales.status[c.uid] || {}).st || '?';
  // orden de la lista: primero los que están en vivo, después cada categoría
  function groups() {
    const f = c => !q || norm(c.name).includes(norm(q)) || norm(c.cat).includes(norm(q));
    const live = Canales.sortChans(db.chans.filter(c => Canales.isLive(c) && f(c)));
    const prem = Canales.sortChans(db.chans.filter(c => st(c) === 'live' && Canales.status[c.uid].prem && f(c)));
    const out = [];
    if (live.length) out.push(['🔴 En vivo ahora', live, 'live']);
    if (prem.length) out.push(['🎬 Estrenos ahora', prem, 'prem']);
    db.cats.forEach(k => { const l = Canales.byNum(db.chans.filter(c => c.cat === k && f(c))); if (l.length) out.push([k, l, 'c:' + k]); });
    const sin = Canales.byNum(db.chans.filter(c => !db.cats.includes(c.cat) && f(c))); if (sin.length) out.push(['Sin categoría', sin, 'c:']);
    return out;
  }
  const playing = () => Player.slots.filter(Boolean).map(s => s.c.uid);
  function order() { const seen = new Set(), o = []; groups().forEach(([, l]) => l.forEach(c => { if (!seen.has(c.uid)) { seen.add(c.uid); o.push(c); } })); return o; }
  // ▲▼ solo pasa por los que están al aire: los apagados (o que arrancan más tarde) se saltean solos.
  // Los videos fijos y los que todavía no se chequearon cuentan como al aire.
  const onAir = c => c.ref?.video || !['off', 'soon'].includes(st(c)) && !(st(c) === 'live' && Canales.status[c.uid]?.prem);
  function step(d) {
    if (typeof Humor !== 'undefined' && Humor.step(d)) return;
    if (typeof Porteno !== 'undefined' && Porteno.step(d)) return;   // 🎻 otra caminata de noche   // 🎭 sonando un humor: otro video del mismo
    const all = Canales.byNum(db.chans.slice()); if (!all.length) return;   // en orden de número, como en la tele
    const cur = Player.slots[Player.sel ?? 0] || Player.slots.find(Boolean);
    const o = all.filter(c => onAir(c) || c.uid === cur?.c.uid);
    if (o.length < 2 && cur) return toast('<b>No hay otro canal en vivo ahora</b>', { cls:'info zapt', ms:1800 });
    if (!o.length) return;
    let i = cur ? o.findIndex(c => c.uid === cur.c.uid) : -1;
    i = (i + d + o.length) % o.length;
    Player.play(o[i]);
    toast(`<b>${esc(o[i].name)}</b><small>${esc(o[i].cat || '')}</small>`, { cls:'info zapt', ms:1800 });
  }
  function render() {
    const z = $('zap'); if (!z) return;
    $('player').classList.toggle('zapon', open);
    $('zapToggle').classList.toggle('on', open);
    if (!open) return;
    const now = new Set(playing());
    z.innerHTML = `
      <div class="zhead"><input id="zapQ" placeholder="Buscar canal…" value="${esc(q)}"><button id="zapUp" title="Canal anterior">▲</button><button id="zapDn" title="Canal siguiente">▼</button></div>
      <div class="zlist">${db.chans.length ? groups().map(([name, list, id]) => `
        <div class="zgrp ${closed.has(id) && !q ? 'closed' : ''}"><button class="zgh" data-g="${esc(id)}">${esc(name)} <span>${list.length}</span></button>
        ${list.map(c => { const s = Canales.status[c.uid] || {};
          return `<button class="zi ${now.has(c.uid) ? 'now' : ''} ${s.st === 'live' && !s.prem ? 'live' : ''}" data-z="${c.uid}" title="${esc(s.title || c.name)}">
            <span class="za" style="${c.avatar ? `background-image:url('${esc(c.avatar)}')` : `background:${PCOL[c.platform]}`}"></span>
            <span class="zn"><i class="znum">${Canales.numTxt(c)}</i>${esc(c.name)}${s.title && (s.st === 'live' || s.st === 'soon') ? `<em>${esc(s.title)}</em>` : ''}<small>${s.st === 'live' && s.prem ? '🎬 estreno' + (s.viewers ? ' · ' + s.viewers.toLocaleString('es-AR') : '') : s.st === 'live' ? '● en vivo' + (s.viewers ? ' · ' + s.viewers.toLocaleString('es-AR') : '') : s.st === 'soon' ? (s.prem ? '🎬 estreno ' : '🕒 ') + fmtH(s.when) : esc(c.platform)}</small></span></button>`; }).join('')}</div>`).join('')
        : '<div class="mut" style="padding:12px;font-size:13px">Todavía no agregaste canales.</div>'}
        ${Object.values(T247).filter(T => T.chans.length && !q).map(T => `<div class="zgrp ${closed.has(T.key + '247') ? 'closed' : ''}"><button class="zgh" data-g="${T.key}247">${esc(T.label())} 24/7 <span>${T.chans.length}</span></button>
          ${T.chans.map(ch => { const n = T.now(ch.id); return `<button class="zi ${now.has(T.uidp + ch.id) ? 'now' : ''}" data-sr="${ch.id}" data-srk="${T.key}"><span class="za" style="${n ? `background-image:url('https://i.ytimg.com/vi/${n.v}/default.jpg')` : 'background:#444'}"></span>
            <span class="zn">${esc(ch.name)}${n ? `<em>${esc(n.t)}</em>` : ''}<small>● al aire 24/7</small></span></button>`; }).join('')}</div>`).join('')}</div>`;
    const inp = $('zapQ');
    inp.oninput = () => { q = inp.value; const pos = inp.selectionStart; render(); $('zapQ').focus(); $('zapQ').setSelectionRange(pos, pos); };
    $('zapUp').onclick = () => step(-1); $('zapDn').onclick = () => step(1);
    z.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { const g = b.dataset.g; closed.has(g) ? closed.delete(g) : closed.add(g); S.set('zapClosed', [...closed]); render(); });
    const tvPick = () => { if (Lite.tv && $('player').classList.contains('tvmode')) listOpen(false); };   // en la tele: elegís y se cierra
    z.querySelectorAll('[data-z]').forEach(b => b.onclick = () => { Player.play(db.chans.find(c => c.uid === b.dataset.z)); tvPick(); });
    z.querySelectorAll('[data-sr]').forEach(b => b.onclick = () => { T247[b.dataset.srk].play(b.dataset.sr); tvPick(); });
  }
  let digits = '', dTimer = null;
  function init() {
    $('zapToggle').onclick = () => { open = !open; S.set('zapOpen', open); render(); };
    // en la Pantalla TV, las flechas arriba/abajo cambian de canal (como el control remoto)
    document.addEventListener('keydown', e => {
      if (!$('player').classList.contains('tvmode') || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      // control de la tele: ← abre la lista en el canal actual; dentro de la lista ▲▼ se mueven, OK elige, → la cierra
      const inList = !!document.activeElement?.closest?.('#zap');
      if (e.key === 'ArrowLeft' && !inList) { e.preventDefault(); listOpen(true); return; }
      if (inList) { if (e.key === 'ArrowRight') { e.preventDefault(); listOpen(false); } return; }
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); step(1); }
    });
    // 🔢 número de canal con el teclado (en cualquier pantalla): 3 5 y Enter → canal 35. Esc cancela.
    // En la tele (control remoto) también entra solo a los 2 segundos.
    document.addEventListener('keydown', e => {
      if (e.ctrlKey || e.altKey || e.metaKey || /INPUT|SELECT|TEXTAREA/.test(document.activeElement?.tagName) || document.querySelector('dialog[open]')) return;
      const k = /^Numpad[0-9]$/.test(e.code || '') ? e.code.slice(-1) : e.key;   // teclado numérico aunque no tenga Bloq Num
      if (/^[0-9]$/.test(k)) { e.preventDefault(); digits = (digits + k).slice(-3); show(); return; }
      if (!digits) return;
      if (e.key === 'Enter') { e.preventDefault(); e.stopImmediatePropagation(); go(); }
      else if (e.key === 'Escape') { e.preventDefault(); digits = ''; clearTimeout(dTimer); $('zapNum')?.remove(); }
      else if (e.key === 'Backspace') { e.preventDefault(); digits = digits.slice(0, -1); digits ? show() : $('zapNum')?.remove(); }
    }, true);
    onChange(render);
    render();
  }
  const chOf = n => db.chans.find(x => +x.num === +n);
  function show() {
    clearTimeout(dTimer);
    let el = $('zapNum'); if (!el) { el = document.createElement('div'); el.id = 'zapNum'; }
    (document.fullscreenElement || document.webkitFullscreenElement || document.body).appendChild(el);
    const c = chOf(digits);
    el.innerHTML = `<b>${digits}</b><span>${c ? esc(c.name) : 'sin canal'}</span><small>${Lite.tv ? 'OK para ir' : 'Enter para ir · Esc cancela'}</small>`;
    el.classList.toggle('none', !c);
    dTimer = setTimeout(() => Lite.tv ? go() : (digits = '', el.remove()), Lite.tv ? 2000 : 6000);
  }
  function go() {
    clearTimeout(dTimer); const c = chOf(digits), n = digits; digits = ''; $('zapNum')?.remove();
    if (c) Player.play(c); else toast(`<b>No hay canal ${esc(n)}</b>`, { cls:'info', ms:1500 });
  }
  function listOpen(v) {
    open = v; render();
    if (v) { const z = $('zap'), b = z?.querySelector('.zi.now') || z?.querySelector('.zi'); b?.focus(); b?.scrollIntoView({ block:'center' }); }
    else document.activeElement?.blur?.();
  }
  return { init, render, step, listOpen, get open() { return open; } };
})();
