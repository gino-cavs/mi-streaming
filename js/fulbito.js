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
  // importancia de cada liga (para ordenar): de lo que más te importa a lo que menos
  const IMP = ['arg.1', 'conmebol.libertadores', 'fifa.world', 'fifa.worldq.conmebol', 'conmebol.america', 'uefa.champions', 'arg.copa', 'conmebol.sudamericana', 'fifa.cwc',
    'eng.1', 'esp.1', 'ita.1', 'ger.1', 'fra.1', 'bra.1', 'uru.1', 'por.1', 'uefa.europa', 'mex.1', 'usa.1', 'ksa.1', 'arg.2', 'fifa.friendly'];
  const imp = l => { const i = IMP.indexOf(l); return i < 0 ? 99 : i; };
  const ORDS = [['imp', '🏆 Importancia de la liga'], ['az', '🔤 Liga A-Z'], ['hora', '🕒 Horario (lo más próximo arriba)'], ['dia', '📅 Por día (próximos días)']];
  let multi = null, multiLoading = false;   // partidos de varios días para "Por día"
  const local = S.get('futlocal', { sound:false, notif:false });   // sonido y notificaciones: por dispositivo
  const saveLocalPrefs = () => S.set('futlocal', local);

  /* ---------- Canales de TV (guía de futbolenvivoargentina.com, la junta GitHub cada 30 min) ---------- */
  let guide = S.get('tvGuide', null);
  async function loadGuide() {
    if (guide && Date.now() - guide._at < 20 * 60e3) return;
    try {
      const j = await (await fetch(REPO.data + 'tv.json?t=' + Math.floor(Date.now() / 600e3))).json();
      j._at = Date.now(); guide = j; S.set('tvGuide', j);
      if (Nav.current === 'fulbito') render();
      if (Nav.current === 'velez') Velez.render();
    } catch {}
  }
  const STOP = new Set(['club', 'atletico', 'deportivo', 'de', 'del', 'la', 'el', 'los', 'fc', 'cf', 'ca', 'sc', 'cd', 'ac', 'afc', 'sad', 'y']);
  const words = n => new Set(norm(n).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(w => w.length > 2 && !STOP.has(w)));
  const sameTeam = (a, b) => { const A = words(a), B = words(b); for (const w of A) if (B.has(w)) return true; return false; };
  const ymdOf = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0'); };
  function channelsFor(m) {
    if (!guide || !guide.matches) return [];
    const day = ymdOf(m.date), H = [m.h.team.displayName, m.h.team.shortDisplayName], A = [m.a.team.displayName, m.a.team.shortDisplayName];
    const ok = (x, names) => names.some(n => n && sameTeam(x, n));
    const g = guide.matches.find(g => Math.abs(Date.parse(g.date) - Date.parse(day)) <= 864e5
      && ((ok(g.home, H) && ok(g.away, A)) || (ok(g.home, A) && ok(g.away, H))));
    return g ? g.channels : [];
  }

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
      team:d.team?.id, min:d.clock?.displayValue || '', who:d.athletesInvolved?.[0]?.displayName || '', whoId:d.athletesInvolved?.[0]?.id || null, og:d.ownGoal, pen:d.penaltyKick }));
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
    res.forEach(([l, j]) => { if (j) { next[l] = { name:j.leagues?.[0]?.name, logo:j.leagues?.[0]?.logos?.[0]?.href, events:evs(j).map(m => ({ ...m, lg:l })) }; } });
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
    { const g0 = [...(m.goals || [])].reverse().find(x => x.team === team.id); try { if (m.id !== 'test') Partido.onGoal(m, team, g0 ? `${g0.who} ${g0.min}` : ''); } catch {} }
    if (db.futbol.scope === 'none') return;
    if (db.futbol.scope !== 'all' && !isFav(m.h.team) && !isFav(m.a.team)) return;
    const g = [...m.goals].reverse().find(x => x.team === team.id);
    const who = g ? `${g.who}${g.pen ? ' (penal)' : ''}${g.og ? ' (en contra)' : ''} ${g.min}` : '';
    const line = `${m.h.team.shortDisplayName || m.h.team.displayName} ${m.hs} - ${m.as} ${m.a.team.shortDisplayName || m.a.team.displayName}`;
    if (m.id !== 'test' && isFav(team)) Stats.bump('gol', { id:m.id + '-' + m.hs + '-' + m.as, line, t:Date.now() });
    Grafismo.notify(`<span class="g">⚽ ¡GOL de ${esc(team.shortDisplayName || team.displayName)}!</span>${esc(line)}${who ? `<small>${esc(who)}</small>` : ''}`,
      { cls:'goal', ms:15000, onclick:() => Nav.go('fulbito') });
    if (local.sound && !DND.active()) beep();
    if (local.notif && !DND.active() && document.hidden && 'Notification' in window && Notification.permission === 'granted') {
      try { new Notification('⚽ ¡GOL de ' + (team.shortDisplayName || team.displayName) + '!', { body:line + (who ? '\n' + who : ''), icon:team.logo, tag:'gol' + m.id + m.hs + m.as }); } catch {}
    }
  }

  /* ---------- Pantalla ---------- */
  // escudo de cualquier equipo: el de ESPN; si no viene, el del CDN de ESPN por id; si tampoco, uno armado con sus colores e iniciales
  function crest(t) {
    const ini = (t.abbreviation || (t.shortDisplayName || t.displayName || '?').split(/\s+/).map(w => w[0]).join('')).slice(0, 3).toUpperCase();
    const col = t.color && t.color !== '000000' ? '#' + t.color : `hsl(${[...(t.displayName || '')].reduce((a, c) => a + c.charCodeAt(0), 0) % 360} 45% 38%)`;
    const src = t.logo || (t.logos && t.logos[0]?.href) || (t.id ? `https://a.espncdn.com/i/teamlogos/soccer/500/${t.id}.png` : '');
    return `<span class="crest" style="--cc:${esc(col)}"><b>${esc(ini)}</b>${src ? `<img src="${esc(src)}" alt="" loading="lazy" onerror="this.remove()">` : ''}</span>`;
  }
  function matchRow(m, opt = {}) {
    const tm = (c, cls) => `<div class="tm ${cls} ${isFav(c.team) ? 'fav' : ''}">
        ${cls === 'h' ? `<button class="star ${isFav(c.team) ? 'on' : ''}" data-fav="${esc(c.team.displayName)}" title="Equipo favorito">${isFav(c.team) ? '★' : '☆'}</button><span>${esc(c.team.shortDisplayName || c.team.displayName)}</span>${crest(c.team)}`
                      : `${crest(c.team)}<span>${esc(c.team.shortDisplayName || c.team.displayName)}</span><button class="star ${isFav(c.team) ? 'on' : ''}" data-fav="${esc(c.team.displayName)}" title="Equipo favorito">${isFav(c.team) ? '★' : '☆'}</button>`}</div>`;
    const sc = m.state === 'pre' ? 'vs' : `${m.hs} - ${m.as}`;
    const gl = m.goals.length && m.state !== 'pre'
      ? `<div class="goals">⚽ ${m.goals.map(g => `${esc(g.who)} ${esc(g.min)}${g.pen ? ' (p)' : ''}${g.og ? ' (ec)' : ''}`).join(' · ')}</div>` : '';
    const ch = m.state !== 'post' ? channelsFor(m) : [];
    const nm = t => t.team.shortDisplayName || t.team.displayName;
    const tv = m.state !== 'post' ? Ver.chips(ch, `${nm(m.h)} vs ${nm(m.a)}`) : '';
    return `<div class="match ${m.state === 'in' ? 'live' : m.state}">${opt.lg ? `<div class="lgtag">${opt.lgLogo ? `<img src="${esc(opt.lgLogo)}" alt="">` : '🏆'}${esc(opt.lg)}</div>` : ''}<div class="st">${m.state === 'in' ? '● ' : ''}${esc(m.st)}</div>${tm(m.h, 'h')}<div class="sc">${sc}</div>${tm(m.a, 'a')}${gl}${tv}</div>`;
  }
  function sortM(arr) { const r = m => ({ in:0, pre:1, post:2 }[m.state] ?? 3); return arr.slice().sort((a, b) => r(a) - r(b) || Date.parse(a.date) - Date.parse(b.date)); }

  const modeBar = () => { const m = S.get('fMode', 'partidos'), n = Clasicos.todayCount();
    return `<div class="chips fmode" id="fMode"><button data-fm="partidos" class="${m === 'partidos' ? 'on' : ''}">⚽ Partidos</button><button data-fm="clasicos" class="${m === 'clasicos' ? 'on' : ''}">⚔️ Mundo Clásicos${n ? ` <span class="cnt">${n} hoy</span>` : ''}</button><button data-fm="retro" class="${m === 'retro' ? 'on' : ''}">📼 Fútbol retro</button><button data-fm="pap" class="${m === 'pap' ? 'on' : ''}">👣 Paso a Paso</button></div>`; };
  const bindMode = v => { $('fMode').onclick = e => { const b = e.target.closest('[data-fm]'); if (!b) return; S.set('fMode', b.dataset.fm); v.dataset.built = ''; v.dataset.mode = ''; render(true); }; };
  function render(force) {
    const v = $('v-fulbito');
    const fm = S.get('fMode', 'partidos');
    if (fm === 'clasicos' || fm === 'retro' || fm === 'pap') {
      if (v.dataset.mode === fm && !force) return;      // no redibujar con cada actualización de resultados
      v.dataset.mode = fm; v.dataset.built = '';
      v.innerHTML = modeBar() + (fm === 'clasicos' ? '<div id="clBody"></div>' : '<div id="rtBody"></div>'); bindMode(v);
      if (fm === 'clasicos') Clasicos.render(v); else Retro.render($('rtBody'), fm);
      HScroll.attach($('fMode')); return;
    }
    v.dataset.mode = '';
    if (!v.dataset.built) { v.dataset.built = 1; build(v); bindMode(v); HScroll.attach($('fMode')); }
    $('fDays').querySelectorAll('[data-d]').forEach(b => b.classList.toggle('on', +b.dataset.d === day));
    $('fLigas').innerHTML = LIGAS.map(([id, n]) => `<button class="${db.futbol.leagues.includes(id) ? 'on' : ''}" data-liga="${id}">${esc(n)}</button>`).join('');
    $('fTeams').innerHTML = db.futbol.teams.map(t => `<button data-unfav="${esc(t)}">★ ${esc(t)} ✕</button>`).join('') || '<span class="mut" style="font-size:13px">Ninguno. Tocá ☆ al lado de un equipo.</span>';
    v.querySelectorAll('[name=fScope]').forEach(r => r.checked = r.value === db.futbol.scope);
    $('fSound').checked = local.sound; $('fNotif').checked = local.notif;
    $('fUpd').textContent = lastPoll ? 'Actualizado ' + fmtH(lastPoll) : '';

    const L = $('fList');
    if (!db.futbol.leagues.length) { L.innerHTML = '<div class="empty">Elegí al menos una liga en "Elegir ligas y avisos".</div>'; return; }
    if (viewLoading) { L.innerHTML = '<div class="empty">Cargando partidos…</div>'; return; }
    const ord = S.get('fSort', 'imp');
    $('fSort').value = ord; $('fDays').style.display = ord === 'dia' ? 'none' : '';
    const flat = V => db.futbol.leagues.flatMap(l => (V[l]?.events || []).map(m => [m, l, V[l]]));
    const row = ([m, l, Lg]) => matchRow(m, { lg:ligaName(l), lgLogo:Lg.logo });
    if (ord === 'dia') {     // varios días seguidos, cada día en línea de tiempo
      if (!multi) { if (!multiLoading) loadMulti(); L.innerHTML = '<div class="empty">Cargando los próximos días…</div>'; return; }
      const all = flat(multi).sort((a, b) => Date.parse(a[0].date) - Date.parse(b[0].date)), byDay = {};
      all.forEach(x => { const k = new Date(x[0].date).toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' }); (byDay[k] = byDay[k] || []).push(x); });
      L.innerHTML = Object.entries(byDay).map(([k, xs]) => `<div class="league"><h3>📅 ${esc(k[0].toUpperCase() + k.slice(1))}</h3>${xs.map(row).join('')}</div>`).join('') || '<div class="empty">No hay partidos de tus ligas en los próximos días.</div>';
      return;
    }
    const ligas = db.futbol.leagues.filter(l => view[l] && view[l].events.length);
    const favIn = l => view[l].events.some(m => isFav(m.h.team) || isFav(m.a.team));
    if (ord === 'hora') {    // todo junto, lo más próximo arriba
      const all = flat(view), r = m => ({ in:0, pre:1, post:2 }[m.state] ?? 3);
      all.sort((a, b) => r(a[0]) - r(b[0]) || (a[0].state === 'post' ? Date.parse(b[0].date) - Date.parse(a[0].date) : Date.parse(a[0].date) - Date.parse(b[0].date)));
      L.innerHTML = all.length ? `<div class="league">${all.map(row).join('')}</div>` : emptyMsg();
      return;
    }
    if (ord === 'az') ligas.sort((a, b) => ligaName(a).localeCompare(ligaName(b), 'es'));
    else ligas.sort((a, b) => (favIn(b) - favIn(a)) || imp(a) - imp(b));     // primero donde juega un favorito
    L.innerHTML = ligas.length ? ligas.map(l => `<div class="league"><h3>${view[l].logo ? `<img src="${esc(view[l].logo)}" alt="">` : '🏆'}${esc(ligaName(l))}</h3>${sortM(view[l].events).map(m => matchRow(m)).join('')}</div>`).join('') : emptyMsg();
  }
  const emptyMsg = () => `<div class="empty">No hay partidos de tus ligas ${day === 0 ? 'hoy' : day === -1 ? 'ayer' : day === 1 ? 'mañana' : 'ese día'}.${Object.keys(view).length ? '' : '<br>Si esto sigue así, puede que la fuente de resultados no esté respondiendo.'}</div>`;
  async function loadMulti() {
    multiLoading = true; const m = {};
    const days = [0, 1, 2, 3, 4, 5, 6];
    const res = await Promise.all(db.futbol.leagues.flatMap(l => days.map(d => (d === 0 && today[l] ? Promise.resolve(null) : board(l, d)).then(j => [l, d, j]).catch(() => [l, d, null]))));
    res.forEach(([l, d, j]) => { const evsL = d === 0 && today[l] ? today[l].events : j ? evs(j) : []; if (!m[l]) m[l] = { logo:today[l]?.logo || j?.leagues?.[0]?.logos?.[0]?.href, events:[] }; m[l].events.push(...evsL.filter(x => x.state !== 'post' || d === 0)); });
    multi = m; multiLoading = false; setTimeout(() => { multi = null; }, 10 * 60e3);
    if (Nav.current === 'fulbito') render();
  }
  function build(v) {
    v.innerHTML = `${modeBar()}
      ${Resumenes.block(it => it.tipo === 'futbol', '🎬 Resúmenes de tus equipos')}
      <div class="subbar">
        <div class="chips" id="fDays" style="margin:0">
          <button data-d="-1">Ayer</button><button data-d="0">Hoy</button><button data-d="1">Mañana</button><button data-d="2">Pasado</button>
        </div>
        <select id="fSort" title="Ordenar partidos" style="width:auto">${ORDS.map(([k, n]) => `<option value="${k}">${n}</option>`).join('')}</select>
        <span class="sp" style="flex:1"></span><span class="upd" id="fUpd"></span><button id="fRef">⟳</button>
      </div>
      <details class="cfg" id="fCfg" ${db.futbol.leagues.length ? '' : 'open'}>
        <summary>⚙ Elegir ligas y avisos de gol</summary>
        <div class="box">
          <h2 class="sec">Ligas que querés ver</h2><div class="chips" id="fLigas"></div>
          <h2 class="sec">📺 Tus servicios para ver los partidos</h2><div id="fServ"></div>
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
      <p class="mut" style="font-size:12px;margin-top:10px">Resultados: datos públicos de ESPN · Canales de TV: futbolenvivoargentina.com</p>`;
    $('fDays').onclick = async e => {
      const b = e.target.closest('[data-d]'); if (!b) return;
      day = +b.dataset.d;
      if (day === 0) { view = today; render(); return; }
      viewLoading = true; render();
      const res = await Promise.all(db.futbol.leagues.map(l => board(l, day).then(j => [l, j]).catch(() => [l, null])));
      view = {}; res.forEach(([l, j]) => { if (j) view[l] = { name:j.leagues?.[0]?.name, logo:j.leagues?.[0]?.logos?.[0]?.href, events:evs(j) }; });
      viewLoading = false; render();
    };
    Ver.servPicker($('fServ'));
    $('fSort').onchange = e => { S.set('fSort', e.target.value); render(); };
    $('fRef').onclick = () => { multi = null; if (day === 0) poll(); else $('fDays').querySelector(`[data-d="${day}"]`).click(); };
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
      const ch = m.state !== 'post' ? channelsFor(m) : [];
      return `⚽ ${n(m.h)} ${m.state === 'pre' ? 'vs' : m.hs + '-' + m.as} ${n(m.a)} ${m.state === 'in' ? '(' + m.st + ')' : m.state === 'pre' ? '· ' + m.st : '(final)'}${ch.length ? ' · 📺 ' + ch[0] : ''}`; });
  function init() { onChange(() => { if ($('v-fulbito').dataset.built) render(); }); poll().catch(() => {}); loadGuide(); setInterval(loadGuide, 20 * 60e3); }
  return { today:() => today, channelsFor, soundOn:() => local.sound, init, render, poll, matchRow, todayFor, liveCount, board, simplify, evs, ticker };
})();
