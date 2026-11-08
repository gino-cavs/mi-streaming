/* =========================================================
   Zapping: lista de canales por categoría al costado del reproductor
   Clic para cambiar · ▲▼ (o las flechas del teclado en Pantalla TV) para canal anterior / siguiente
   ========================================================= */
const Zap = (() => {
  let open = S.get('zapOpen', true), q = '', closed = new Set(S.get('zapClosed', []));
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
  function step(d) {
    const o = order(); if (!o.length) return;
    const cur = Player.slots[Player.sel ?? 0] || Player.slots.find(Boolean);
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
    z.querySelectorAll('[data-z]').forEach(b => b.onclick = () => Player.play(db.chans.find(c => c.uid === b.dataset.z)));
    z.querySelectorAll('[data-sr]').forEach(b => b.onclick = () => T247[b.dataset.srk].play(b.dataset.sr));
  }
  let digits = '', dTimer = null;
  function init() {
    $('zapToggle').onclick = () => { open = !open; S.set('zapOpen', open); render(); };
    // en la Pantalla TV, las flechas arriba/abajo cambian de canal (como el control remoto)
    document.addEventListener('keydown', e => {
      if (!$('player').classList.contains('tvmode') || /INPUT|SELECT|TEXTAREA/.test(document.activeElement.tagName)) return;
      if (e.key === 'ArrowUp' || e.key === 'PageUp') { e.preventDefault(); step(-1); }
      if (e.key === 'ArrowDown' || e.key === 'PageDown') { e.preventDefault(); step(1); }
      if (/^[0-9]$/.test(e.key)) {
        digits = (digits + e.key).slice(-3); clearTimeout(dTimer);
        toast(`<b style="font-size:26px">${digits}</b>`, { cls:'info zapt', ms:1300 });
        dTimer = setTimeout(() => { const c = db.chans.find(x => +x.num === +digits); digits = ''; if (c) Player.play(c); }, 1200);
      }
    });
    onChange(render);
    render();
  }
  return { init, render, step };
})();
