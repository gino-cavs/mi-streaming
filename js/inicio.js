/* =========================================================
   🏠 Ahora: lo que importa en este momento, en un solo lugar.
   Cada bloque aparece solo si tiene algo para mostrar. Se puede esconder desde ✎ como cualquier sección.
   ========================================================= */
const Inicio = (() => {
  const blocks = [];   // otros módulos suman bloques: { id, order, html(), bind?(el) }
  function add(b) { blocks.push(b); blocks.sort((a, z) => a.order - z.order); }
  const hola = h => h < 6 ? 'Buenas noches' : h < 13 ? 'Buen día' : h < 20 ? 'Buenas tardes' : 'Buenas noches';

  // --- bloques propios ---
  add({ id:'vivo', order:30, html() {
    const live = db.chans.filter(c => Canales.status[c.uid]?.st === 'live').slice(0, 12);
    if (!live.length) return '';
    return `<h2 class="sec">🔴 En vivo ahora</h2><div class="inrow">${live.map(c => { const s = Canales.status[c.uid];
      return `<button class="incard" data-play="${c.uid}"><span class="inimg" style="${s.thumb ? `background-image:url('${esc(s.thumb)}')` : ''}"><i class="inlive">● VIVO</i></span><b>${esc(Canales.numTxt(c))} ${esc(c.name)}</b><small>${esc(s.title || '')}</small></button>`; }).join('')}</div>`; },
    bind(el) { el.querySelectorAll('[data-play]').forEach(b => b.onclick = () => Player.play(db.chans.find(c => c.uid === b.dataset.play))); } });
  add({ id:'radios', order:50, html() {
    if (!db.radios.length) return '';
    RadioGrilla.load();
    const r = db.radios.slice(0, 8).map((x, i) => ({ x, i, p:RadioGrilla.nowFor(x) }));
    return `<h2 class="sec">📻 Ahora en tus radios</h2><div class="inlist">${r.map(({ x, i, p }) => `<button data-radio="${i}" class="${Radio.current?.url === x.url ? 'on' : ''}"><b>${esc(x.name)}</b><span>${p ? esc(p.name) + (p.pan?.length ? ' · ' + esc(p.pan.slice(0, 2).join(', ')) : '') : 'sin grilla'}</span></button>`).join('')}</div>`; },
    bind(el) { el.querySelectorAll('[data-radio]').forEach(b => b.onclick = () => Radio.play(db.radios[+b.dataset.radio])); } });
  add({ id:'album', order:60, html() {
    const a = Musica.album(); if (!a) return '';
    return `<h2 class="sec">💿 Álbum del día</h2><button class="inalb" data-alb><span style="background-image:url('${esc(a.thumb)}')"></span><div><small>${esc(a.genre)}</small><b>${esc(a.album)}</b><em>${esc(a.artist)}${a.year ? ' · ' + esc(a.year) : ''}</em></div><i>▶</i></button>`; },
    bind(el) { el.querySelector('[data-alb]')?.addEventListener('click', () => Musica.playAlbum()); } });
  add({ id:'futbol', order:70, html() {
    let t = []; try { t = Fulbito.ticker().slice(0, 8); } catch {}
    if (!t.length) return '';
    return `<h2 class="sec">⚽ Hoy en el fútbol</h2><div class="inticks">${t.map(x => `<div>${esc(x)}</div>`).join('')}</div><button class="lnk" data-go="fulbito">Ver todo en Fulbito →</button>`; },
    bind(el) { el.querySelector('[data-go]')?.addEventListener('click', () => Nav.go('fulbito')); } });
  add({ id:'limpiar', order:90, html() {
    const u = Nav.unused(); if (!u.length) return '';
    return `<div class="inclean"><b>🧹 Hace más de un mes que no abrís:</b> ${u.map(id => esc(Nav.label(id))).join(', ')}.<div class="btns"><button class="pri" data-cl="hide">Esconderlas</button><button data-cl="keep">Dejarlas</button><button data-cl="edit">Elegir…</button></div><small class="mut">Se pueden volver a poner cuando quieras desde ✎.</small></div>`; },
    bind(el) { el.querySelectorAll('[data-cl]').forEach(b => b.onclick = () => { const u = Nav.unused(); if (b.dataset.cl === 'hide') Nav.hide(u); if (b.dataset.cl === 'keep') Nav.keep(u); if (b.dataset.cl === 'edit') return Nav.openOrder(); render(); }); } });

  function render() {
    const v = $('v-inicio'); if (!v) return;
    const now = new Date(), parts = blocks.map(b => { let h = ''; try { h = b.html(); } catch {} return h ? `<div class="inblk" data-b="${b.id}">${h}</div>` : ''; }).join('');
    v.innerHTML = `<div class="inhead"><h1>${hola(now.getHours())} 👋</h1><span class="mut">${now.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })}</span></div>
      ${parts || '<div class="empty">Todavía no hay nada para mostrar acá: agregá canales, radios o tus equipos y aparece lo que está pasando.</div>'}`;
    blocks.forEach(b => { const el = v.querySelector(`[data-b="${b.id}"]`); if (el && b.bind) try { b.bind(el); } catch {} });
  }
  setInterval(() => { if (Nav.current === 'inicio' && !document.hidden && !document.activeElement?.closest?.('#v-inicio')) render(); }, 60e3);
  return { render, add };
})();
