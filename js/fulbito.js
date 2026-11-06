/* =========================================================
   Fulbito: resultados en vivo (datos públicos de ESPN) y avisos de gol
   ========================================================= */
const Fulbito = (() => {
  const LIGAS = [
    ['arg.1', 'Liga Profesional'], ['arg.copa', 'Copa Argentina'], ['arg.2', 'Primera Nacional'],
    ['conmebol.libertadores', 'Copa Libertadores'], ['conmebol.sudamericana', 'Copa Sudamericana'],
    ['fifa.worldq.conmebol', 'Eliminatorias Sudamericanas'], ['fifa.friendly', 'Amistosos de selecciones'],
    ['conmebol.america', 'Copa América'], ['fifa.world', 'Mundial'], ['fifa.cwc', 'Mundial de Clubes'],
    ['uefa.champions', 'Champions League'], ['uefa.europa', 'Europa League'],
    ['esp.1', 'LaLiga (España)'], ['eng.1', 'Premier League'], ['ita.1', 'Serie A (Italia)'],
    ['ger.1', 'Bundesliga'], ['fra.1', 'Ligue 1'], ['por.1', 'Liga de Portugal'],
    ['bra.1', 'Brasileirão'], ['uru.1', 'Liga Uruguaya'], ['mex.1', 'Liga MX'], ['usa.1', 'MLS'], ['ksa.1', 'Liga Saudí']
  ];
  const ligaName = id => (LIGAS.find(l => l[0] === id) || [id, id])[1];
  const local = S.get('futlocal', { sound:false, notif:false });   // sonido y notificaciones: por dispositivo
  const saveLocalPrefs = () => S.set('futlocal', local);

  let day = 0, view = {}, today = {}, prev = null, lastPoll = null, timer = null, viewLoading = false;

  const ymd = off => { const d = new Date(); d.setDate(d.getDate() + off); return d.getFullYear() + String(d.getMonth() + 1).padStart(2, '0') + String(d.getDate()).padStart(2, '0'); };
  async function board(liga, off) {
    const r = await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${liga}/scoreboard?dates=${ymd(off)}`);
    if (!r.ok) throw new Error(r.status);
    return r.json();
  }
  const isFav = team => db.futbol.teams.some(f => { const a = norm(f), b = norm(team.displayName), c = norm(team.shortDisplayName); return b.includes(a) || a.includes(b) || (c && a.includes(c)); });

  function simplify(ev) {
    const comp = ev.competitions[0];
    const h = comp.competitors.find(c => c.homeAway === 'home'), a = comp.competitors.find(c => c.homeAway === 'away');
    const status = ev.status || comp.status, t = status.type;
    const num = c => +(c.score && typeof c.score === 'object' ? c.score.displayValue ?? c.score.value : c.score) || 0;
    let st;
    if (t.state === 'pre') st = /postpon|cancel|suspend/i.test(t.name) ? 'Postergado' : fmtH(ev.date);
    else if (t.state === 'in') st = /half/i.test(t.name) || t.shortDetail === 'HT' ? 'ET' : (status.displayClock || t.shortDetail);
    else st = /postpon|cancel|suspend|abandon/i.test(t.name) ? 'Suspendido' : 'Final';
    const goals = (comp.details || []).filter(d => d.scoringPlay).map(d => ({
      team:d.team?.id, min:d.clock?.displayValue || '', who:d.athletesInvolved?.[0]?.displayName || '', og:d.ownGoal, pen:d.penaltyKick }));
    return { id:ev.id, date:ev.date, state:t.state, st, h, a, hs:num(h), as:num(a), goals };
  }

  const evs = j => (j.events || []).map(e => { try { return simplify(e); } catch { return null; } }).filter(Boolean);

  /* ---------- Sondeo de hoy + avisos de gol ---------- */
  async function poll() {
    clearTimeout(timer);
    try { await pollOnce(); } catch (e) { console.error(e); timer = setTimeout(poll, 2 * 60e3); }
  }
  async function pollOnce() {
    const ligas = db.futbol.leagues;
    const res = await Promise.all(ligas.map(l => board(l, 0).then(j => [l, j]).catch(() => [l, null])));
    const next = {}, scores = {};
    res.forEach(([l, j]) => { if (j) { next[l] = { name:j.leagues?.[0]?.name, logo:j.leagues?.[0]?.logos?.[0]?.href, events:evs(j) }; } });
    Object.values(next).forEach(L => L.events.forEach(m => scores[m.id] = m));
    if (prev) Object.values(scores).forEach(m => {
      const p = prev[m.id]; if (!p) return;
      if (m.hs > p.hs) goalAlert(m, 'h');
      if (m.as > p.as) goalAlert(m, 'a');
    });
    prev = scores; today = next; lastPoll = new Date();
    if (day === 0) view = today;
    if (Nav.current === 'fulbito') render();
    if (Nav.current === 'velez') Velez.render();
    Nav.badges();
    // con partidos en juego reviso cada 30 s; si alguno arranca pronto, cada minuto; si no, cada 5 min
    const all = Object.values(scores);
    const soon = all.some(m => m.state === 'pre' && Date.parse(m.date) - Date.now() < 20 * 60e3 && Date.parse(m.date) - Date.now() > -3 * 3600e3);
    timer = setTimeout(poll, all.some(m => m.state === 'in') ? 30e3 : soon ? 60e3 : 5 * 60e3);
  }
  function goalAlert(m, side) {
    const team = side === 'h' ? m.h.team : m.a.team;
    if (db.futbol.scope === 'none') return;
    if (db.futbol.scope !== 'all' && !isFav(m.h.team) && !isFav(m.a.team)) return;
    const g = [...m.goals].reverse().find(x => x.team === team.id);
    const who = g ? `${g.who}${g.pen ? ' (penal)' : ''}${g.og ? ' (en contra)' : ''} ${g.min}` : '';
    const line = `${m.h.team.shortDisplayName || m.h.team.displayName} ${m.hs} - ${m.as} ${m.a.team.shortDisplayName || m.a.team.displayName}`;
    toast(`<span class="g">⚽ ¡GOL de ${esc(team.shortDisplayName || team.displayName)}!</span>${esc(line)}${who ? `<small>${esc(who)}</small>` : ''}`,
      { cls:'goal', ms:15000, onclick:() => Nav.go('fulbito') });
    if (local.sound) beep();
    if (local.notif && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('⚽ ¡GOL de ' + (team.shortDisplayName || team.displayName) + '!', { body:line + (who ? '\n' + who : ''), icon:team.logo, tag:'gol' + m.id + m.hs + m.as }); } catch {}
    }
  }

  /* ---------- Pantalla ---------- */
  function matchRow(m) {
    const tm = (c, cls) => `<div class="tm ${cls} ${isFav(c.team) ? 'fav' : ''}">
        ${cls === 'h' ? `<button class="star ${isFav(c.team) ? 'on' : ''}" data-fav="${esc(c.team.displayName)}" title="Equipo favorito">${isFav(c.team) ? '★' : '☆'}</button><span>${esc(c.team.shortDisplayName || c.team.displayName)}</span>${c.team.logo ? `<img src="${esc(c.team.logo)}" alt="">` : ''}`
                      : `${c.team.logo ? `<img src="${esc(c.team.logo)}" alt="">` : ''}<span>${esc(c.team.shortDisplayName || c.team.displayName)}</span><button class="star ${isFav(c.team) ? 'on' : ''}" data-fav="${esc(c.team.displayName)}" title="Equipo favorito">${isFav(c.team) ? '★' : '☆'}</button>`}</div>`;
    const sc = m.state === 'pre' ? 'vs' : `${m.hs} - ${m.as}`;
    const gl = m.goals.length && m.state !== 'pre'
      ? `<div class="goals">⚽ ${m.goals.map(g => `${esc(g.who)} ${esc(g.min)}${g.pen ? ' (p)' : ''}${g.og ? ' (ec)' : ''}`).join(' · ')}</div>` : '';
    return `<div class="match ${m.state === 'in' ? 'live' : m.state}"><div class="st">${m.state === 'in' ? '● ' : ''}${esc(m.st)}</div>${tm(m.h, 'h')}<div class="sc">${sc}</div>${tm(m.a, 'a')}${gl}</div>`;
  }
  function sortM(arr) { const r = m => ({ in:0, pre:1, post:2 }[m.state] ?? 3); return arr.slice().sort((a, b) => r(a) - r(b) || Date.parse(a.date) - Date.parse(b.date)); }

  function render() {
    const v = $('v-fulbito');
    if (!v.dataset.built) { v.dataset.built = 1; build(v); }
    $('fDays').querySelectorAll('[data-d]').forEach(b => b.classList.toggle('on', +b.dataset.d === day));
    $('fLigas').innerHTML = LIGAS.map(([id, n]) => `<button class="${db.futbol.leagues.includes(id) ? 'on' : ''}" data-liga="${id}">${esc(n)}</button>`).join('');
    $('fTeams').innerHTML = db.futbol.teams.map(t => `<button data-unfav="${esc(t)}">★ ${esc(t)} ✕</button>`).join('') || '<span class="mut" style="font-size:13px">Ninguno. Tocá ☆ al lado de un equipo.</span>';
    v.querySelectorAll('[name=fScope]').forEach(r => r.checked = r.value === db.futbol.scope);
    $('fSound').checked = local.sound; $('fNotif').checked = local.notif;
    $('fUpd').textContent = lastPoll ? 'Actualizado ' + fmtH(lastPoll) : '';

    const L = $('fList');
    if (!db.futbol.leagues.length) { L.innerHTML = '<div class="empty">Elegí al menos una liga en "Elegir ligas y avisos".</div>'; return; }
    if (viewLoading) { L.innerHTML = '<div class="empty">Cargando partidos…</div>'; return; }
    const ligas = db.futbol.leagues.filter(l => view[l] && view[l].events.length);
    // primero las ligas donde juega un favorito
    ligas.sort((a, b) => (view[b].events.some(m => isFav(m.h.team) || isFav(m.a.team)) - view[a].events.some(m => isFav(m.h.team) || isFav(m.a.team)))
                         || LIGAS.findIndex(x => x[0] === a) - LIGAS.findIndex(x => x[0] === b));
    L.innerHTML = ligas.length ? ligas.map(l => `<div class="league"><h3>${view[l].logo ? `<img src="${esc(view[l].logo)}" alt="">` : '🏆'}${esc(ligaName(l))}</h3>${sortM(view[l].events).map(matchRow).join('')}</div>`).join('')
      : `<div class="empty">No hay partidos de tus ligas ${day === 0 ? 'hoy' : day === -1 ? 'ayer' : day === 1 ? 'mañana' : 'ese día'}.${Object.keys(view).length ? '' : '<br>Si esto sigue así, puede que la fuente de resultados no esté respondiendo.'}</div>`;
  }
  function build(v) {
    v.innerHTML = `
      <div class="subbar">
        <div class="chips" id="fDays" style="margin:0">
          <button data-d="-1">Ayer</button><button data-d="0">Hoy</button><button data-d="1">Mañana</button><button data-d="2">Pasado</button>
        </div>
        <span class="sp" style="flex:1"></span><span class="upd" id="fUpd"></span><button id="fRef">⟳</button>
      </div>
      <details class="cfg" id="fCfg" ${db.futbol.leagues.length ? '' : 'open'}>
        <summary>⚙ Elegir ligas y avisos de gol</summary>
        <div class="box">
          <h2 class="sec">Ligas que querés ver</h2><div class="chips" id="fLigas"></div>
          <h2 class="sec">Equipos favoritos</h2><div class="chips" id="fTeams"></div>
          <form id="fTeamForm" class="rsearch" style="margin-bottom:6px"><input id="fTeamIn" placeholder="Agregar equipo (ej: Argentina, Barcelona)"><button>Agregar</button></form>
          <h2 class="sec">Avisos de gol</h2>
          <label><input type="radio" name="fScope" value="teams"> Solo partidos de mis equipos favoritos</label>
          <label><input type="radio" name="fScope" value="all"> Todos los partidos de mis ligas</label>
          <label><input type="radio" name="fScope" value="none"> Ninguno</label>
          <label style="margin-top:8px"><input type="checkbox" id="fSound"> Con sonido (en este dispositivo)</label>
          <label><input type="checkbox" id="fNotif"> Notificación del sistema si la página está en segundo plano (PC y Android, en este dispositivo)</label>
          <div class="btns"><button id="fTest" class="sm">Probar un aviso</button></div>
          <p class="mut" style="font-size:12px;margin-top:8px">Los avisos funcionan mientras la página esté abierta (aunque estés en otra sección o pestaña).</p>
        </div>
      </details>
      <div id="fList"></div>
      <p class="mut" style="font-size:12px;margin-top:10px">Resultados: datos públicos de ESPN.</p>`;
    $('fDays').onclick = async e => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      day = +b.dataset.d;
      if (day === 0) { view = today; render(); return; }
      viewLoading = true; render();
      const res = await Promise.all(db.futbol.leagues.map(l => board(l, day).then(j => [l, j]).catch(() => [l, null])));
      view = {}; res.forEach(([l, j]) => { if (j) view[l] = { name:j.leagues?.[0]?.name, logo:j.leagues?.[0]?.logos?.[0]?.href, events:evs(j) }; });
      viewLoading = false; render();
    };
    $('fRef').onclick = () => { if (day === 0) poll(); else $('fDays').querySelector(`[data-d="${day}"]`).click(); };
    $('fLigas').onclick = e => {
      const b = e.target.closest('[data-liga]'); if (!b) return;
      const l = b.dataset.liga, L = db.futbol.leagues;
      db.futbol.leagues = L.includes(l) ? L.filter(x => x !== l) : [...L, l];
      save(); prev = null; render(); poll();
    };
    $('fTeams').onclick = e => { const b = e.target.closest('[data-unfav]'); if (b) { db.futbol.teams = db.futbol.teams.filter(t => t !== b.dataset.unfav); save(); render(); } };
    $('fTeamForm').onsubmit = e => { e.preventDefault(); const t = $('fTeamIn').value.trim(); if (t && !db.futbol.teams.some(x => norm(x) === norm(t))) { db.futbol.teams.push(t); save(); } $('fTeamIn').value = ''; render(); };
    $('fList').onclick = e => {
      const b = e.target.closest('[data-fav]'); if (!b) return;
      const name = b.dataset.fav, fake = { displayName:name, shortDisplayName:'' };
      if (isFav(fake)) db.futbol.teams = db.futbol.teams.filter(f => { const a = norm(f), x = norm(name); return !(x.includes(a) || a.includes(x)); });
      else db.futbol.teams.push(name);
      save(); render();
    };
    v.querySelectorAll('[name=fScope]').forEach(r => r.onchange = () => { db.futbol.scope = r.value; save(); });
    $('fSound').onchange = e => { local.sound = e.target.checked; saveLocalPrefs(); if (local.sound) beep(); };
    $('fNotif').onchange = async e => {
      local.notif = e.target.checked; saveLocalPrefs();
      if (local.notif && 'Notification' in window && Notification.permission !== 'granted') {
        const p = await Notification.requestPermission().catch(() => 'denied');
        if (p !== 'granted') { local.notif = false; saveLocalPrefs(); e.target.checked = false; toast('<b>No se activaron las notificaciones</b><small>El navegador no dio permiso. Podés habilitarlo desde el candadito de la barra de direcciones.</small>', { cls:'info' }); }
      }
    };
    $('fTest').onclick = () => {
      const fake = { id:'test', hs:1, as:0, goals:[{ team:'x', who:'Jugador de prueba', min:"34'" }],
        h:{ team:{ id:'x', displayName:db.futbol.teams[0] || 'Vélez Sarsfield', shortDisplayName:db.futbol.teams[0] || 'Vélez' } }, a:{ team:{ id:'y', displayName:'Rival', shortDisplayName:'Rival' } } };
      const sc = db.futbol.scope; db.futbol.scope = 'all'; goalAlert(fake, 'h'); db.futbol.scope = sc;
    };
  }

  // partidos de hoy de un equipo (para Mundo Vélez)
  const todayFor = name => Object.values(today).flatMap(L => L.events).filter(m => [m.h.team, m.a.team].some(t => norm(t.displayName).includes(norm(name))));
  const liveCount = () => Object.values(today).flatMap(L => L.events).filter(m => m.state === 'in' && (isFav(m.h.team) || isFav(m.a.team))).length;

  // renglones para la barra que corre abajo en la Pantalla TV
  const ticker = () => Object.values(today).flatMap(L => L.events)
    .filter(m => m.state === 'in' || isFav(m.h.team) || isFav(m.a.team))
    .map(m => { const n = t => t.team.shortDisplayName || t.team.displayName;
      return `⚽ ${n(m.h)} ${m.state === 'pre' ? 'vs' : m.hs + '-' + m.as} ${n(m.a)} ${m.state === 'in' ? '(' + m.st + ')' : m.state === 'pre' ? '· ' + m.st : '(final)'}`; });
  function init() { onChange(() => { if ($('v-fulbito').dataset.built) render(); }); poll().catch(() => {}); }
  return { init, render, poll, matchRow, todayFor, liveCount, board, simplify, evs, ticker };
})();
