/* =========================================================
   Navegación entre secciones, ajustes y arranque
   ========================================================= */
const Nav = (() => {
  const SECS = [['inicio', '🏠 Ahora'], ['canales', '📺 Canales'], ['radios', '📻 Radios'], ['calendario', '📅 Calendario'], ['fulbito', '⚽ Fulbito'], ['prode', '🎯 Prode'], ['motor', '🏁 Automovilismo'], ['boxeo', '🥊 Boxeo'], ['series', '📼 Series'], ['peliculas', '🎬 Películas'], ['musica', '🎵 Música'], ['rap', '🎤 Rap Battle'], ['420', '🍃 420 time'], ['momentos', '⭐ Momentos'], ['noticias', '📰 Noticias'], ['velez', '💙 Mundo Vélez'], ['juegos', '🎮 Juegos'], ['wrapped', '✨ Wrapped']];
  /* Menú corto: arriba van pocas pestañas; las secciones parecidas viven juntas adentro de un grupo (con pestañitas). */
  const GROUPS = { deportes:['🏟️ Deportes', ['fulbito', 'velez', 'motor', 'boxeo']], tv247:['📼 24/7', ['series', 'peliculas']], sonido:['🎧 Música y Radios', ['musica', 'radios']],
    mas:['➕ Más', ['calendario', 'noticias', 'prode', 'rap', '420', 'momentos', 'juegos', 'wrapped']] };
  const TOP = ['inicio', 'canales', 'deportes', 'tv247', 'sonido', 'mas'];
  let current = null;
  const renderers = { inicio:() => Inicio.render(), canales:() => Canales.render(), radios:() => Radio.render(), calendario:() => Calendario.render(), motor:() => Motor.render(), boxeo:() => Boxeo.render(), musica:() => Musica.render(), series:() => Series.render(), peliculas:() => Peliculas.render(), rap:() => Rap.render(), '420':() => T420.render(), prode:() => Prode.render(), momentos:() => Momentos.render(), wrapped:() => Stats.render(), fulbito:() => Fulbito.render(), noticias:() => Noticias.render(), velez:() => Velez.render(), juegos:() => Juegos.render() };
  const hidden = () => db.nav?.hidden || [];
  const members = g => { const def = GROUPS[g][1], o = (db.nav?.grp || {})[g] || []; return [...o.filter(x => def.includes(x)), ...def.filter(x => !o.includes(x))]; };
  const visMembers = g => members(g).filter(x => !hidden().includes(x) || x === current);
  const groupOf = s => Object.keys(GROUPS).find(g => GROUPS[g][1].includes(s)) || null;
  const label = id => GROUPS[id] ? db.nav?.labels?.[id] || GROUPS[id][0] : T247[id] ? T247[id].label() : db.nav?.labels?.[id] || (SECS.find(x => x[0] === id) || [, id])[1];
  function tops() {
    const o = (db.nav?.top || []).filter(x => TOP.includes(x)), ids = [...o, ...TOP.filter(x => !o.includes(x))];
    return ids.filter(id => GROUPS[id] ? visMembers(id).length && !hidden().includes(id) : !hidden().includes(id) || id === current);
  }
  function go(s) {
    if (GROUPS[s]) s = visMembers(s).includes(S.get('grpLast', {})[s]) ? S.get('grpLast', {})[s] : visMembers(s)[0] || 'canales';
    if (!renderers[s]) s = hidden().includes('inicio') ? 'canales' : 'inicio';
    current = s;
    const g = groupOf(s); if (g) S.set('grpLast', { ...S.get('grpLast', {}), [g]:s });
    document.querySelectorAll('.view').forEach(v => v.classList.toggle('show', v.id === 'v-' + s));
    $('canalTools').style.display = s === 'canales' ? '' : 'none';
    if (location.hash !== '#' + s) history.replaceState(null, '', '#' + s);
    S.set('hubSec', s);
    // última vez que abriste cada sección (para sugerirte esconder las que no usás)
    const today = new Date().toISOString().slice(0, 10); db.secUse = db.secUse || {}; if (db.secUse[s] !== today) { db.secUse[s] = today; save(); }
    badges(); renderers[s]();
  }
  function badges() {
    const n = { canales:Canales.liveCount(), fulbito:Fulbito.liveCount(), calendario:Calendario.liveCount(), motor:Motor.liveCount(), boxeo:Boxeo.liveCount(), prode:Prode.pendingCount() };
    const cnt = id => GROUPS[id] ? visMembers(id).reduce((a, x) => a + (n[x] || 0), 0) : n[id] || 0, g = groupOf(current);
    const sc = $('sections').scrollLeft;
    $('sections').innerHTML = tops().map(id => `<button data-s="${id}" class="${id === current || id === g ? 'on' : ''}">${label(id)}${cnt(id) ? `<span class="cnt">${cnt(id)}</span>` : ''}</button>`).join('');
    $('sections').scrollLeft = sc; HScroll.update($('sections'));
    const st = $('subtabs'), vm = g ? visMembers(g) : [];
    st.innerHTML = vm.length > 1 ? vm.map(id => `<button data-s="${id}" class="${id === current ? 'on' : ''}">${label(id)}${n[id] ? `<span class="cnt">${n[id]}</span>` : ''}</button>`).join('') : '';
    st.hidden = vm.length < 2;
  }
  /* Secciones que no abriste en 30 días (en ningún aparato): para ofrecerte esconderlas */
  function unused() {
    const lim = new Date(Date.now() - 30 * 864e5).toISOString().slice(0, 10), u = db.secUse || {};
    if (!db.secUseSince) { db.secUseSince = new Date().toISOString().slice(0, 10); save(); }
    if (db.secUseSince > lim) return [];   // todavía no pasó un mes desde que empecé a mirar
    return SECS.map(x => x[0]).filter(id => id !== 'inicio' && id !== 'canales' && !hidden().includes(id) && !(u[id] >= lim) && !(db.nav?.keep || []).includes(id));
  }
  function hide(ids) { db.nav = { ...(db.nav || {}), hidden:[...new Set([...hidden(), ...ids])] }; save(); badges(); }
  function keep(ids) { db.nav = { ...(db.nav || {}), keep:[...new Set([...(db.nav?.keep || []), ...ids])] }; save(); }
  function openOrder() {
    let top = tops().concat(TOP.filter(x => !tops().includes(x))), grp = Object.fromEntries(Object.keys(GROUPS).map(g => [g, members(g)]));
    let hid = [...hidden()], names = {};
    let d = $('dlgNav'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgNav'; document.body.appendChild(d); }
    const row = (id, list, i) => `<div class="ordrow ${list === 'top' ? '' : 'sub'}"><input type="checkbox" data-v="${id}" ${hid.includes(id) ? '' : 'checked'} title="Mostrar" style="width:auto;flex:none"><input class="ordname" data-lb="${id}" value="${esc(names[id] ?? label(id))}"><button class="sm" data-mv="${list}|${i}|-1">↑</button><button class="sm" data-mv="${list}|${i}|1">↓</button></div>`;
    const paint = () => {
      d.innerHTML = `<h3>✎ Menú</h3><p class="mut" style="font-size:13px;margin-top:0">Arriba van estas pestañas; las de adentro aparecen como pestañitas dentro de cada una. Cambiá nombres (con su emoji), el orden con las flechas, y destildá lo que no quieras ver: todo se puede sacar y volver a poner.</p>
        <div class="navlist">${top.map((id, i) => row(id, 'top', i) + (GROUPS[id] ? grp[id].map((m, j) => row(m, id, j)).join('') : '')).join('')}</div>
        <div class="btns"><button id="navReset">Restaurar</button><span class="sp"></span><button id="navX">Cancelar</button><button class="pri" id="navOk">Guardar</button></div>`;
      d.querySelectorAll('[data-mv]').forEach(b => b.onclick = () => { const [l, i, dd] = b.dataset.mv.split('|'), arr = l === 'top' ? top : grp[l], a = +i, z = a + +dd; if (z < 0 || z >= arr.length) return; [arr[a], arr[z]] = [arr[z], arr[a]]; paint(); });
      d.querySelectorAll('[data-lb]').forEach(i => i.oninput = () => { names[i.dataset.lb] = i.value; });
      d.querySelectorAll('[data-v]').forEach(c => c.onchange = () => { hid = c.checked ? hid.filter(x => x !== c.dataset.v) : [...hid, c.dataset.v]; });
      $('navReset').onclick = () => { top = [...TOP]; grp = Object.fromEntries(Object.keys(GROUPS).map(g => [g, [...GROUPS[g][1]]])); hid = []; names = {}; [...SECS.map(x => x[0]), ...Object.keys(GROUPS)].forEach(id => { if (!T247[id]) names[id] = GROUPS[id] ? GROUPS[id][0] : SECS.find(x => x[0] === id)[1]; }); paint(); };
      $('navX').onclick = () => d.close();
      $('navOk').onclick = () => {
        const labels = { ...(db.nav?.labels || {}) };
        for (const [id, n] of Object.entries(names)) { const v = n.trim(); if (T247[id]) { if (v) T247[id].setTitle(v); continue; } const def = GROUPS[id] ? GROUPS[id][0] : (SECS.find(x => x[0] === id) || [])[1]; if (!v || v === def) delete labels[id]; else labels[id] = v; }
        db.nav = { ...(db.nav || {}), top, grp, hidden:hid, labels }; save(); d.close(); badges(); Zap.render(); if (T247[current]) T247[current].render();
        if (hid.includes(current)) go(current === 'inicio' ? 'canales' : 'inicio');
      };
    };
    paint(); d.showModal();
  }
  function init() {
    document.querySelector('.secrow').insertAdjacentHTML('afterend', '<nav class="subtabs" id="subtabs" hidden></nav>');
    badges();
    HScroll.attach($('sections')); HScroll.attach($('tabs'));
    $('secEdit').onclick = openOrder;
    $('sections').onclick = e => { const b = e.target.closest('[data-s]'); if (b) go(b.dataset.s); };
    $('subtabs').onclick = e => { const b = e.target.closest('[data-s]'); if (b) go(b.dataset.s); };
    window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== current) go(h); });
  }
  return { init, go, badges, openOrder, unused, hide, keep, label, get current() { return current; } };
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
Player.build(); TV.build(); Reloj.init(); Buscar.init(); Partido.init(); Grafismo.init(); Tanda.init(); Zap.init(); Calidad.init(); Canales.init(); Radio.init(); Fulbito.init(); Noticias.init(); Velez.init(); Calendario.init(); Motor.init(); Musica.init(); Prode.init(); Momentos.init(); Stats.init(); Rap.init(); T420.init(); Likes.init(); Boxeo.init(); Series.init(); Peliculas.init(); Juegos.init(); Ver.init(); Diario.init(); Resumenes.init(); Clasicos.init(); Actualidad.init();
$('btnGuia').onclick = () => { S.set('canView', S.get('canView', 'cards') === 'guia' ? 'cards' : 'guia'); Canales.render(); };
setInterval(() => { if (Nav.current === 'canales' && S.get('canView', 'cards') === 'guia' && !document.hidden) Canales.render(); }, 60e3);
$('btnLikeSetup').onclick = () => { $('dlgSet').close(); Likes.openSetup(); };
$('btnTg').onclick = () => { $('dlgSet').close(); Telegram.open(); };
$('btnDnd').onclick = () => DND.toggle(); DND.paint();
initSettings(); Nav.init(); Control.init();
onChange(() => Nav.badges());
Nav.go(location.hash.slice(1) || 'inicio');
showSync(); startTimer(); Canales.refresh();
