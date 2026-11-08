/* =========================================================
   Navegación entre secciones, ajustes y arranque
   ========================================================= */
const Nav = (() => {
  const SECS = [['canales', '📺 Canales'], ['radios', '📻 Radios'], ['calendario', '📅 Calendario'], ['fulbito', '⚽ Fulbito'], ['prode', '🎯 Prode'], ['motor', '🏁 Automovilismo'], ['boxeo', '🥊 Boxeo'], ['series', '📼 Series'], ['peliculas', '🎬 Películas'], ['musica', '🎵 Música'], ['rap', '🎤 Rap Battle'], ['420', '🍃 420 time'], ['momentos', '⭐ Momentos'], ['noticias', '📰 Noticias'], ['velez', '💙 Mundo Vélez'], ['juegos', '🎮 Juegos'], ['wrapped', '✨ Wrapped']];
  let current = null;
  const renderers = { canales:() => Canales.render(), radios:() => Radio.render(), calendario:() => Calendario.render(), motor:() => Motor.render(), boxeo:() => Boxeo.render(), musica:() => Musica.render(), series:() => Series.render(), peliculas:() => Peliculas.render(), rap:() => Rap.render(), '420':() => T420.render(), prode:() => Prode.render(), momentos:() => Momentos.render(), wrapped:() => Stats.render(), fulbito:() => Fulbito.render(), noticias:() => Noticias.render(), velez:() => Velez.render(), juegos:() => Juegos.render() };
  function go(s) {
    if (!renderers[s]) s = 'canales';
    current = s;
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('show', v.id === 'v-' + s));
    document.querySelectorAll('#sections [data-s]').forEach(b => b.classList.toggle('on', b.dataset.s === s));
    $('canalTools').style.display = s === 'canales' ? '' : 'none';
    if (location.hash !== '#' + s) history.replaceState(null, '', '#' + s);
    S.set('hubSec', s);
    renderers[s]();
  }
  // orden y secciones ocultas: tuyos, guardados y sincronizados (db.nav)
  const label = id => T247[id] ? T247[id].label() : db.nav?.labels?.[id] || (SECS.find(x => x[0] === id) || [, id])[1];
  function ordered() {
    const o = db.nav?.order || [], hid = db.nav?.hidden || [];
    const ids = [...o.filter(id => SECS.some(x => x[0] === id)), ...SECS.map(x => x[0]).filter(id => !o.includes(id))];
    return ids.filter(id => !hid.includes(id) || id === current);
  }
  function badges() {
    const n = { canales:Canales.liveCount(), fulbito:Fulbito.liveCount(), calendario:Calendario.liveCount(), motor:Motor.liveCount(), boxeo:Boxeo.liveCount(), prode:Prode.pendingCount() };
    const sc = $('sections').scrollLeft;
    $('sections').innerHTML = ordered().map(id => `<button data-s="${id}" class="${id === current ? 'on' : ''}">${label(id)}${n[id] ? `<span class="cnt">${n[id]}</span>` : ''}</button>`).join('');
    $('sections').scrollLeft = sc; HScroll.update($('sections'));
  }
  function openOrder() {
    let work = [...(db.nav?.order || []).filter(id => SECS.some(x => x[0] === id)), ...SECS.map(x => x[0]).filter(id => !(db.nav?.order || []).includes(id))];
    let hid = [...(db.nav?.hidden || [])], names = {};
    let d = $('dlgNav'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgNav'; document.body.appendChild(d); }
    const paint = () => {
      d.innerHTML = `<h3>✎ Secciones</h3><p class="mut" style="font-size:13px;margin-top:0">Cambiá el nombre (con su emoji), el orden (arrastrando o con las flechas) y destildá las que no quieras ver.</p>
        <div class="navlist">${work.map((id, i) => `<div class="ordrow" draggable="true" data-i="${i}"><span class="ordh">☰</span><input type="checkbox" data-v="${id}" ${hid.includes(id) ? '' : 'checked'} title="Mostrar en la barra" style="width:auto;flex:none"><input class="ordname" data-lb="${id}" value="${esc(names[id] ?? label(id))}" title="Nombre de la sección"><button class="sm" data-up="${i}">↑</button><button class="sm" data-dn="${i}">↓</button></div>`).join('')}</div>
        <div class="btns"><button id="navReset">Restaurar</button><span class="sp"></span><button id="navX">Cancelar</button><button class="pri" id="navOk">Guardar</button></div>`;
      const mv = (i, j) => { if (j < 0 || j >= work.length) return; const [x] = work.splice(i, 1); work.splice(j, 0, x); paint(); };
      d.querySelectorAll('[data-up]').forEach(b => b.onclick = () => mv(+b.dataset.up, +b.dataset.up - 1));
      d.querySelectorAll('[data-dn]').forEach(b => b.onclick = () => mv(+b.dataset.dn, +b.dataset.dn + 1));
      d.querySelectorAll('[data-lb]').forEach(i => i.oninput = () => { names[i.dataset.lb] = i.value; });
      d.querySelectorAll('[data-v]').forEach(c => c.onchange = () => { hid = c.checked ? hid.filter(x => x !== c.dataset.v) : [...hid, c.dataset.v]; });
      let drag = null;
      d.querySelectorAll('.ordrow').forEach(r => { r.ondragstart = () => { drag = +r.dataset.i; }; r.ondragover = e => e.preventDefault(); r.ondrop = e => { e.preventDefault(); if (drag != null) mv(drag, +r.dataset.i); }; });
      $('navReset').onclick = () => { work = SECS.map(x => x[0]); hid = []; names = Object.fromEntries(SECS.filter(x => !T247[x[0]]).map(x => [x[0], x[1]])); paint(); };
      $('navX').onclick = () => d.close();
      $('navOk').onclick = () => {
        if (hid.length >= work.length) hid = [];
        const labels = { ...(db.nav?.labels || {}) };
        for (const [id, n] of Object.entries(names)) { const v = n.trim(); if (T247[id]) { if (v) T247[id].setTitle(v); continue; } const def = (SECS.find(x => x[0] === id) || [])[1]; if (!v || v === def) delete labels[id]; else labels[id] = v; }
        db.nav = { order:work, hidden:hid, labels }; save(); d.close(); badges(); Zap.render(); if (T247[current]) T247[current].render();
      };
    };
    paint(); d.showModal();
  }
  function init() {
    badges();
    HScroll.attach($('sections')); HScroll.attach($('tabs'));
    $('secEdit').onclick = openOrder;
    $('sections').onclick = e => { const b = e.target.closest('[data-s]'); if (b) go(b.dataset.s); };
    window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== current) go(h); });
  }
  return { init, go, badges, openOrder, get current() { return current; } };
})();

/* ---------- Ajustes ---------- */
function initSettings() {
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('setHud').onchange = e => TV.setOn(e.target.checked);
  const zf = () => S.get('zapFx', { on:true, sound:false });
  $('setZfx').onchange = e => { S.set('zapFx', { ...zf(), on:e.target.checked }); if (e.target.checked && Player.slots[Player.sel]) Player.zapFx(Player.sel, Player.slots[Player.sel].c); };
  $('setZfxS').onchange = e => S.set('zapFx', { ...zf(), sound:e.target.checked });
  $('setLite').onchange = e => { Lite.set(e.target.checked); toast(e.target.checked ? '⚡ Modo liviano prendido en este aparato' : 'Modo liviano apagado', { ms:2500 }); };
  $('btnSettings').onclick = () => {
    $('setHud').checked = TV.on; $('setZfx').checked = S.get('zapFx', { on:true }).on; $('setLite').checked = Lite.on; $('setZfxS').checked = !!S.get('zapFx', {}).sound;
    $('setKey').value = db.key;
    $('setRef').value = String(db.refresh);
    $('setTok').value = db.sync.token;
    $('dndSched').checked = DND.st.sched; $('dndFrom').value = DND.st.from; $('dndTo').value = DND.st.to;
    $('syncCode').textContent = db.sync.gistId || '(se genera al conectar el token)';
    const o = {}; SYNC_KEYS.forEach(k => o[k] = db[k]);
    $('setSync').value = JSON.stringify(o);
    $('setMsg').textContent = '';
    showSync();
    $('dlgSet').showModal();
  };
  $('setSave').onclick = async () => {
    const newKey = $('setKey').value.trim(), newRef = +$('setRef').value, newTok = $('setTok').value.trim();
    const keyChanged = db.key !== newKey, tokChanged = db.sync.token !== newTok;
    DND.set({ sched:$('dndSched').checked, from:$('dndFrom').value || '00:00', to:$('dndTo').value || '08:00' });
    if (keyChanged || db.refresh !== newRef) { db.key = newKey; db.refresh = newRef; save(); }
    if (tokChanged) {
      db.sync = { token:newTok, gistId:null }; saveLocal();
      syncInfo = { ok:null }; showSync();
      if (newTok) await pull(true);
    }
    startTimer(); $('dlgSet').close(); $('warns').innerHTML = '';
    if (keyChanged || tokChanged) Canales.refresh(); else fireChange();
  };
  $('btnCopy').onclick = async () => {
    const t = $('setSync'), m = $('setMsg');
    try { await navigator.clipboard.writeText(t.value); m.className = 'msg ok'; m.textContent = '¡Copiado! Pegalo en este mismo cuadro en el otro dispositivo.'; }
    catch { t.select(); m.className = 'msg'; m.textContent = 'Seleccioné el texto: copialo a mano.'; }
  };
  $('btnImport').onclick = () => {
    const m = $('setMsg');
    try { const n = mergeInto(JSON.parse($('setSync').value)); $('setKey').value = db.key; save(); fireChange(); Canales.refresh(); m.className = 'msg ok'; m.textContent = `Listo: agregué ${n} cosa(s).`; }
    catch { m.className = 'msg err'; m.textContent = 'Ese texto no es válido.'; }
  };
}

/* ---------- Actualización automática ---------- */
let refTimer;
function startTimer() {
  clearInterval(refTimer);
  refTimer = setInterval(() => { if (!document.hidden) Canales.refresh(); }, db.refresh * 60e3);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (pushTimer) push(); return; }
  if (!Canales.lastUpd || Date.now() - Canales.lastUpd > db.refresh * 60e3) Canales.refresh(); else pull();
});

/* ---------- Arranque ---------- */
if (location.protocol === 'file:') warn('Estás abriendo el archivo desde la compu: Twitch y algunos datos solo andan con la página publicada (GitHub Pages).');
Player.build(); TV.build(); Zap.init(); Calidad.init(); Canales.init(); Radio.init(); Fulbito.init(); Noticias.init(); Velez.init(); Calendario.init(); Motor.init(); Musica.init(); Prode.init(); Momentos.init(); Stats.init(); Rap.init(); T420.init(); Likes.init(); Boxeo.init(); Series.init(); Peliculas.init(); Juegos.init(); Ver.init(); Diario.init(); Resumenes.init(); Clasicos.init(); Actualidad.init();
$('btnGuia').onclick = () => { S.set('canView', S.get('canView', 'cards') === 'guia' ? 'cards' : 'guia'); Canales.render(); };
setInterval(() => { if (Nav.current === 'canales' && S.get('canView', 'cards') === 'guia' && !document.hidden) Canales.render(); }, 60e3);
$('btnLikeSetup').onclick = () => { $('dlgSet').close(); Likes.openSetup(); };
$('btnTg').onclick = () => { $('dlgSet').close(); Telegram.open(); };
$('btnDnd').onclick = () => DND.toggle(); DND.paint();
initSettings(); Nav.init();
onChange(() => Nav.badges());
Nav.go(location.hash.slice(1) || S.get('hubSec', 'canales'));
showSync(); startTimer(); Canales.refresh();
