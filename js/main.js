/* =========================================================
   Navegación entre secciones, ajustes y arranque
   ========================================================= */
const Nav = (() => {
  const SECS = [['inicio', '🏠 Ahora'], ['canales', '📺 Canales'], ['radios', '📻 Radios'], ['calendario', '📅 Calendario'], ['fulbito', '⚽ Fulbito'], ['prode', '🎯 Prode'], ['motor', '🏁 Automovilismo'], ['boxeo', '🥊 Boxeo'], ['series', '📼 Series'], ['peliculas', '🎬 Películas'], ['musica', '🎵 Música'], ['rap', '🎤 Rap Battle'], ['420', '🍃 420 time'], ['mg', '📍 MG News'], ['tandas', '📼 Tandas'], ['novelas', '📺 Novelas'], ['porteno', '🎻 Modo porteño'], ['paseo', '🐶 Paseo de Vaca'], ['figus', '🃏 Figus'], ['fechas', '🎂 Fechas'], ['momentos', '⭐ Momentos'], ['noticias', '📰 Noticias'], ['velez', '💙 Mundo Vélez'], ['juegos', '🎮 Juegos'], ['wrapped', '✨ Wrapped']];
  /* Menú corto: arriba van pocas pestañas; las secciones parecidas viven juntas adentro de un grupo (con pestañitas). */
  const GROUPS = { deportes:['🏟️ Deportes', ['fulbito', 'velez', 'motor', 'boxeo']], tv247:['📼 24/7', ['series', 'peliculas', 'novelas', 'tandas']], sonido:['🎧 Música y Radios', ['musica', 'radios']],
    mas:['➕ Más', ['mg', 'paseo', 'fechas', 'porteno', 'calendario', 'noticias', 'prode', 'rap', '420', 'momentos', 'juegos', 'wrapped']] };
  const TOP = ['inicio', 'canales', 'deportes', 'tv247', 'sonido', 'figus', 'mas'];
  let current = null;
  const renderers = { inicio:() => Inicio.render(), canales:() => Canales.render(), radios:() => Radio.render(), calendario:() => Calendario.render(), motor:() => Motor.render(), boxeo:() => Boxeo.render(), musica:() => Musica.render(), series:() => Series.render(), peliculas:() => Peliculas.render(), rap:() => Rap.render(), '420':() => T420.render(), mg:() => MG.render(), tandas:() => Tanda.render(), novelas:() => Novelas.render(), porteno:() => Porteno.render(), paseo:() => Paseo.render(), figus:() => Figus.render(), fechas:() => Fechas.render(), prode:() => Prode.render(), momentos:() => Momentos.render(), wrapped:() => Stats.render(), fulbito:() => Fulbito.render(), noticias:() => Noticias.render(), velez:() => Velez.render(), juegos:() => Juegos.render() };
  const hidden = () => db.nav?.hidden || [];
  const members = g => { const def = GROUPS[g][1], o = (db.nav?.grp || {})[g] || []; return [...o.filter(x => def.includes(x)), ...def.filter(x => !o.includes(x))]; };
  const visMembers = g => members(g).filter(x => !hidden().includes(x) || x === current);
  const groupOf = s => Object.keys(GROUPS).find(g => GROUPS[g][1].includes(s)) || null;
  const label = id => GROUPS[id] ? db.nav?.labels?.[id] || GROUPS[id][0] : T247[id] ? T247[id].label() : db.nav?.labels?.[id] || (SECS.find(x => x[0] === id) || [, id])[1];
  function tops() {
    const o = (db.nav?.top || []).filter(x => TOP.includes(x)), ids = [...o, ...TOP.filter(x => !o.includes(x))];
    return ids.filter(id => !(id === 'figus' && Device.mode === 'tv')).filter(id => GROUPS[id] ? visMembers(id).length && !hidden().includes(id) : !hidden().includes(id) || id === current);
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
  $('setYtClean').onchange = e => { S.set('ytClean', e.target.checked); toast('🧼 Se aplica al próximo video que pongas', { ms:2500 }); };
  $('setZfx').onchange = e => { S.set('zapFx', { ...zf(), on:e.target.checked }); if (e.target.checked && Player.slots[Player.sel]) Player.zapFx(Player.sel, Player.slots[Player.sel].c); };
  $('setZfxS').onchange = e => S.set('zapFx', { ...zf(), sound:e.target.checked });
  $('setMute').value = (db.news?.mute ?? MUTE_DEF).join(', ');
  $('setMute').onchange = e => { db.news.mute = e.target.value.split(',').map(x => x.trim()).filter(Boolean); save(); toast('🙈 Listo: lo nuevo ya sale filtrado', { ms:2500 }); Noticias.load(true).then(() => Nav.current === 'noticias' && Noticias.render()).catch(() => {}); };
  $('setIcal').value = db.grillaIcal || '';
  $('setIcal').onchange = e => { const v = e.target.value.trim(); if (v && !/^(https|webcal):\/\/.+/.test(v)) return toast('<b>Eso no parece un link de calendario</b>', { cls:'info' });
    db.grillaIcal = v; save(); toast(v ? '<b>🗓 Calendario guardado</b><small>En menos de media hora tus programas aparecen en la Guía.</small>' : '🗓 Calendario quitado', { ms:4000 }); };
  $('setIcalHelp').onclick = () => toast(`<b>🗓 Tu grilla desde Google Calendar</b><small>1. Creá un calendario nuevo (ej. "FUNVS grilla").<br>2. Cargá cada programa como evento: <b>A24 | Basta Baby</b>, con hora de inicio y fin, y "Se repite cada semana" los días que va.<br>3. Si querés, en la descripción poné <i>Conducen: Nombre, Nombre</i>.<br>4. Configuración del calendario → <b>Dirección secreta en formato iCal</b> → copiala y pegala acá.<br>Lo que cargues le gana a la grilla automática de ese canal. Se sincroniza cada media hora.</small>`, { ms:30000, cls:'info' });
  $('setDevice').innerHTML = Object.entries(Device.MODES).map(([k, v]) => `<option value="${k}" ${k === Device.mode ? 'selected' : ''}>${v}${!Device.chosen && k === Device.mode ? ' (detectado)' : ''}</option>`).join('');
  $('setDevice').onchange = e => Device.set(e.target.value);
  if (Device.mode === 'celu') { $('setEdgeRow').style.display = 'flex'; $('setEdge').value = Device.edge; $('setEdgeV').textContent = Device.edge + 'px';
    $('setEdge').oninput = e => { Device.setEdge(e.target.value); $('setEdgeV').textContent = e.target.value + 'px'; }; }
  $('setLite').onchange = e => { Lite.set(e.target.checked); toast(e.target.checked ? '⚡ Modo liviano prendido en este aparato' : 'Modo liviano apagado', { ms:2500 }); };
  // 🎨 estilo del grafismo (se sincroniza)
  const gs = () => { ['depo', 'vhs', 'mini'].forEach(k => document.body.classList.toggle('gs-' + k, db.grafStyle === k)); };
  gs(); onChange(gs);
  $('setGs').value = db.grafStyle || '';
  $('setGs').onchange = e => { db.grafStyle = e.target.value; save(); gs(); try { Grafismo.barPop('🎨 ESTILO', `<b>${esc(e.target.selectedOptions[0].text)}</b> Así se ve el zócalo`, { ms:5000 }); } catch {} };
  // 📐 zona segura: el video deja libre arriba (donde van el cartel y el logo FUNVS)
  document.body.classList.toggle('safehud', S.get('safeHud', true));
  $('setSafe').checked = S.get('safeHud', true);
  $('setSafe').onchange = e => { S.set('safeHud', e.target.checked); document.body.classList.toggle('safehud', e.target.checked); };
  // 🐶 fotos de Vaca: se achican a 200 px (pesan ~10 KB) y se sincronizan con tus aparatos
  const petPaint = () => { const L = db.vacaFotos || [];
    $('petList').innerHTML = `<span class="pett"><img src="img/vaca.jpg" alt=""><small>la de siempre</small></span>` + L.map((u, i) => `<span class="pett"><img src="${u}" alt=""><button data-pd="${i}" title="Quitar">✕</button></span>`).join('');
    $('petList').querySelectorAll('[data-pd]').forEach(b => b.onclick = () => { db.vacaFotos.splice(+b.dataset.pd, 1); save(); petPaint(); }); };
  const shrink = f => new Promise(r => { const im = new Image(); im.onload = () => { const z = 200, c = document.createElement('canvas'); c.width = c.height = z; const m = Math.min(im.width, im.height);
    c.getContext('2d').drawImage(im, (im.width - m) / 2, (im.height - m) / 2, m, m, 0, 0, z, z); URL.revokeObjectURL(im.src); r(c.toDataURL('image/jpeg', .82)); }; im.onerror = () => r(null); im.src = URL.createObjectURL(f); });
  $('petIn').onchange = async e => { db.vacaFotos = db.vacaFotos || [];
    for (const f of [...e.target.files].slice(0, 30 - db.vacaFotos.length)) { const u = await shrink(f); if (u) db.vacaFotos.push(u); }
    e.target.value = ''; save(); petPaint(); toast(`<b>🐶 ${db.vacaFotos.length + 1} fotos de Vaca</b><small>Van pasando en el logo.</small>`, { ms:3000 }); };
  $('btnSettings').addEventListener('click', petPaint);
  $('btnSettings').onclick = () => {
    $('setHud').checked = TV.on; $('setZfx').checked = S.get('zapFx', { on:true }).on; $('setYtClean').checked = S.get('ytClean', true); $('setLite').checked = Lite.on; $('setZfxS').checked = !!S.get('zapFx', {}).sound;
    $('setKey').value = db.key;
    $('setRef').value = String(db.refresh);
    { const tot = Canales.quotaTotal(), L = { pc:'🖥️ compu', tv:'📺 tele', celu:'📱 celu' }, pct = Math.min(100, tot / 100);
      $('setQuota').innerHTML = `<div class="qbar"><i style="width:${pct}%;background:${pct > 85 ? '#e11d48' : pct > 60 ? '#f59e0b' : '#22c55e'}"></i></div>
        <small>📊 Cuota de YouTube de hoy: <b>${tot.toLocaleString('es-AR')}</b> de 10.000 · ${Object.entries(db.ytq || {}).filter(([, v]) => v?.d === Canales.qDay()).map(([k, v]) => `${L[k] || k} ${v.u.toLocaleString('es-AR')}`).join(' · ') || 'sin uso todavía'}
        · se reinicia a las ~5 AM. Si pasa de 6.000, los canales se actualizan más espaciado solos.</small>`; }
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
  // si el día viene gastador, se espacia solo: más de 6.000 → cada 15 min; más de 8.500 → cada 45 min (para no quedarte sin vivos)
  let lastRef = Date.now();
  // en la Fire Stick (liviano) mientras mirás algo también se actualiza, pero cada 15 min como mínimo: así el zapping
  // no saltea canales que arrancaron después ni la grilla queda vieja
  const f = () => { if (document.hidden) return; const t = Canales.quotaTotal(), every = Math.max(db.refresh, t > 8500 ? 45 : t > 6000 ? 15 : 0, Lite.on && Lite.busy() ? 15 : 0) * 60e3;
    if (Date.now() - lastRef >= every - 5e3) { lastRef = Date.now(); Canales.refresh(); } };
  f.keep = true; refTimer = setInterval(f, db.refresh * 60e3);
}
document.addEventListener('visibilitychange', () => {
  if (document.hidden) { if (pushTimer) push(); return; }
  if (!Canales.lastUpd || Date.now() - Canales.lastUpd > db.refresh * 60e3) Canales.refresh(); else pull();
});

/* ---------- Arranque ---------- */
if (location.protocol === 'file:') warn('Estás abriendo el archivo desde la compu: Twitch y algunos datos solo andan con la página publicada (GitHub Pages).');
Player.build(); TV.build(); Reloj.init(); Dia.init();
  Franja.init(); MG.init(); Buscar.init(); Partido.init(); Grafismo.init(); Tanda.init(); Zap.init(); Teclado.init(); Zocalos.init(); Paseo.init(); Fechas.init(); Figus.init(); Calidad.init(); Canales.init(); Radio.init(); Fulbito.init(); Noticias.init(); Velez.init(); Calendario.init(); Motor.init(); Musica.init(); Prode.init(); Momentos.init(); Stats.init(); Rap.init(); T420.init(); Likes.init(); Boxeo.init(); Series.init(); Peliculas.init(); Juegos.init(); Ver.init(); Diario.init(); Resumenes.init(); Clasicos.init(); Actualidad.init();
$('btnGuia').onclick = () => { S.set('canView', S.get('canView', 'cards') === 'guia' ? 'cards' : 'guia'); Canales.render(); };
setInterval(() => { if (Nav.current === 'canales' && S.get('canView', 'cards') === 'guia' && !document.hidden) Canales.render(); }, 60e3);
$('btnLikeSetup').onclick = () => { $('dlgSet').close(); Likes.openSetup(); };
$('btnTg').onclick = () => { $('dlgSet').close(); Telegram.open(); };
$('btnDnd').onclick = () => DND.toggle(); DND.paint();
initSettings(); Nav.init(); Control.init();
onChange(() => Nav.badges());
Nav.go(location.hash.slice(1) || 'inicio');
showSync(); startTimer(); Canales.refresh();
