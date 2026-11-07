/* =========================================================
   Navegación entre secciones, ajustes y arranque
   ========================================================= */
const Nav = (() => {
  const SECS = [['canales', '📺 Canales'], ['radios', '📻 Radios'], ['calendario', '📅 Calendario'], ['fulbito', '⚽ Fulbito'], ['prode', '🎯 Prode'], ['motor', '🏁 Automovilismo'], ['musica', '🎵 Música'], ['rap', '🎤 Rap Battle'], ['420', '🍃 420 time'], ['momentos', '⭐ Momentos'], ['noticias', '📰 Noticias'], ['velez', '💙 Mundo Vélez'], ['wrapped', '✨ Wrapped']];
  let current = null;
  const renderers = { canales:() => Canales.render(), radios:() => Radio.render(), calendario:() => Calendario.render(), motor:() => Motor.render(), musica:() => Musica.render(), rap:() => Rap.render(), '420':() => T420.render(), prode:() => Prode.render(), momentos:() => Momentos.render(), wrapped:() => Stats.render(), fulbito:() => Fulbito.render(), noticias:() => Noticias.render(), velez:() => Velez.render() };
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
  function badges() {
    const n = { canales:Canales.liveCount(), fulbito:Fulbito.liveCount(), calendario:Calendario.liveCount(), motor:Motor.liveCount(), prode:Prode.pendingCount() };
    $('sections').innerHTML = SECS.map(([id, l]) => `<button data-s="${id}" class="${id === current ? 'on' : ''}">${l}${n[id] ? `<span class="cnt">${n[id]}</span>` : ''}</button>`).join('');
  }
  function init() {
    badges();
    $('sections').onclick = e => { const b = e.target.closest('[data-s]'); if (b) go(b.dataset.s); };
    window.addEventListener('hashchange', () => { const h = location.hash.slice(1); if (h && h !== current) go(h); });
  }
  return { init, go, badges, get current() { return current; } };
})();

/* ---------- Ajustes ---------- */
function initSettings() {
  document.querySelectorAll('[data-close]').forEach(b => b.onclick = () => b.closest('dialog').close());
  $('setHud').onchange = e => TV.setOn(e.target.checked);
  $('btnSettings').onclick = () => {
    $('setHud').checked = TV.on;
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
Player.build(); TV.build(); Zap.init(); Calidad.init(); Canales.init(); Radio.init(); Fulbito.init(); Noticias.init(); Velez.init(); Calendario.init(); Motor.init(); Musica.init(); Prode.init(); Momentos.init(); Stats.init(); Rap.init(); T420.init();
$('btnDnd').onclick = () => DND.toggle(); DND.paint();
initSettings(); Nav.init();
onChange(() => Nav.badges());
Nav.go(location.hash.slice(1) || S.get('hubSec', 'canales'));
showSync(); startTimer(); Canales.refresh();
