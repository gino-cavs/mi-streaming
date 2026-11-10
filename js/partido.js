/* =========================================================
   💙 Modo partido de Vélez: el día que juega, FUNVS se arma solo.
   - En 🏠 Ahora: el partido arriba de todo (cuenta regresiva o resultado en vivo) y dónde verlo.
   - En la Pantalla TV: marcador en el grafismo mientras se juega.
   - Gol de Vélez: festejo en grande en pantalla.
   - 🔥 Motivación fortinera: videos de la hinchada (YouTube, con tu clave; se buscan una vez por semana).
   ========================================================= */
const Partido = (() => {
  const isV = t => norm(t?.displayName || '').includes('velez');
  const short = t => (t.abbreviation || t.shortDisplayName || t.displayName || '').toUpperCase().slice(0, 3);
  function match() {
    let l = []; try { l = Fulbito.todayFor('velez'); } catch {}
    return l.sort((a, b) => ({ in:0, pre:1, post:2 }[a.state] - { in:0, pre:1, post:2 }[b.state]))[0] || null;
  }
  const hhmm = d => new Date(d).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  function left(d) { const s = Math.round((Date.parse(d) - Date.now()) / 1e3), m = Math.floor(s / 60); return s <= 0 ? 'ya empieza' : m < 60 ? `faltan ${m}:${String(s % 60).padStart(2, '0')}` : `en ${Math.floor(m / 60)} h ${m % 60} min`; }

  /* ---------- 📋 Previa: historial frente a frente, cómo vienen y la tabla (ESPN, se guarda 1 hora) ---------- */
  let previa = S.get('previa', null), pBusy = false;
  async function loadPrevia(m) {
    if (!m || pBusy || (previa?.id === m.id && Date.now() - previa.at < 3600e3)) return previa?.id === m.id ? previa : null;
    pBusy = true;
    try {
      const s = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${m.lg || 'arg.1'}/summary?event=${m.id}`)).json();
      const ss = (s.seasonseries || []).find(x => x.type === 'head-to-head') || s.seasonseries?.[0];
      const h2h = (ss?.events || []).filter(e => e.status === 'post' || e.statusType?.completed).slice(-5).reverse().map(e => { const H = e.competitors.find(c => c.homeAway === 'home'), A = e.competitors.find(c => c.homeAway === 'away');
        return { d:e.date.slice(0, 10), t:`${H.team.abbreviation} ${H.score} - ${A.score} ${A.team.abbreviation}` }; });
      const form = {}; (s.lastFiveGames || []).forEach(x => form[x.team.id] = (x.events || []).slice(0, 5).map(e => e.gameResult).join(''));
      const tab = {}; (s.standings?.groups || []).forEach(g => (g.standings?.entries || []).forEach(e => { const st = Object.fromEntries(e.stats.map(x => [x.name, x.displayValue])); tab[e.id] = { pos:st.rank, pts:st.points }; }));
      previa = { id:m.id, at:Date.now(), serie:(ss?.summary || '').replace(/leads series/, 'gana la serie').replace(/series tied/i, 'serie empatada'), h2h, form, tab, venue:s.gameInfo?.venue?.fullName || '' };
      S.set('previa', previa); if (Nav.current === 'inicio') setTimeout(() => Inicio.render(), 0);
    } catch {}
    pBusy = false; return previa?.id === m.id ? previa : null;
  }
  const formHtml = f => (f || '').split('').map(r => `<i class="fm ${r}">${{ W:'G', D:'E', L:'P' }[r] || r}</i>`).join('');
  function previaHtml(m, p) {
    if (!p) return '';
    const row = t => `<div class="pvf"><span>${esc(t.shortDisplayName || t.displayName)}</span>${p.tab[t.id] ? `<small>${p.tab[t.id].pos}° · ${p.tab[t.id].pts} pts</small>` : ''}<span class="fms">${formHtml(p.form[t.id])}</span></div>`;
    return `<div class="pvprev"><div><b>📋 Previa</b>${p.venue ? ` · 🏟️ ${esc(p.venue)}` : ''}</div>${row(m.h.team)}${row(m.a.team)}
      ${p.h2h.length ? `<div class="pvh2h"><b>Frente a frente${p.serie ? ' · ' + esc(p.serie) : ''}</b>${p.h2h.map(x => `<span>${esc(x.t)} <small>${x.d.split('-').reverse().join('/')}</small></span>`).join('')}</div>` : ''}</div>`;
  }

  /* ---------- 💙 Un día como hoy (efemérides de Wikipedia y Wikidata, las arma GitHub una vez por mes) ---------- */
  let efem = S.get('efem', null), efAt = 0;
  async function loadEfem() { if (Date.now() - efAt < 6 * 3600e3) return efem; efAt = Date.now(); try { const j = await (await fetch(REPO.data + 'efemerides.json?t=' + Math.floor(Date.now() / 864e5))).json(); if (j?.dias) { efem = j; S.set('efem', j); } } catch {} return efem; }
  function efemHoy() {
    if (!efem) return null;
    const n = new Date(), md = String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'), l = efem.dias[md] || [];
    const hito = l.find(x => x.k === 'hito'), cumples = l.filter(x => x.k === 'cumple').slice(0, 3);
    return hito || cumples.length ? { hito, cumples, y:n.getFullYear() } : null;
  }
  const cumpleTxt = (c, y) => `${esc(c.t)} cumple ${y - c.y}${c.v ? ` (jugó en Vélez ${esc(c.v)})` : ''}`;
  let efShown = S.get('efShown', '');
  function efemTv() {   // en la Pantalla TV, una vez por día, como zócalo
    const e = efemHoy(), k = new Date().toDateString(); if (!e || efShown === k || document.hidden || new Date().getHours() < 13) return;   // siempre a las 13
    efShown = k; S.set('efShown', k);
    Grafismo.notify(`<b>💙 Un día como hoy</b>${e.hito ? `<span>${esc(e.hito.y)}: ${esc(e.hito.t.slice(0, 160))}</span>` : ''}${e.cumples.length ? `<small>🎂 ${e.cumples.map(c => cumpleTxt(c, e.y)).join(' · ')}</small>` : ''}`, { ms:12000, onclick:() => Nav.go('velez') });
  }
  Inicio.add({ id:'efem', order:75, html() {
    loadEfem().then(d => { if (d && !$('v-inicio')?.querySelector('[data-b="efem"]') && Nav.current === 'inicio' && efemHoy()) Inicio.render(); });
    const e = efemHoy(); if (!e) return '';
    return `<h2 class="sec">💙 Un día como hoy</h2><div class="pvefem">${e.hito ? `<p><b>${esc(e.hito.y)}</b> · ${esc(e.hito.t)}</p>` : ''}${e.cumples.length ? `<p>🎂 ${e.cumples.map(c => cumpleTxt(c, e.y)).join(' · ')}</p>` : ''}<small class="mut">Fuente: Wikipedia y Wikidata</small></div>`; } });

  /* ---------- 🔥 Motivación fortinera ---------- */
  let fortin = S.get('fortin', null), busy = false;
  async function videos() {
    if (fortin && Date.now() - fortin.at < 7 * 864e5 && fortin.ids.length) return fortin.ids;
    if (!db.key || busy) return fortin?.ids || [];
    busy = true; const ids = new Set();
    try {
      for (const q of ['hinchada de Vélez Sarsfield', 'Vélez Sarsfield recibimiento hinchada', 'Vélez fortín canciones de la hinchada', 'Vélez Sarsfield mística historia goles']) {
        const j = await Canales.yt('search', { part:'snippet', type:'video', videoEmbeddable:'true', maxResults:15, q, regionCode:'AR', relevanceLanguage:'es' });
        (j.items || []).forEach(x => x.id?.videoId && ids.add(x.id.videoId));
      }
    } catch (e) { toast(`<b>No pude buscar los videos</b><small>${esc(e.message)}</small>`, { cls:'info' }); }
    busy = false;
    if (ids.size) { fortin = { at:Date.now(), ids:[...ids] }; S.set('fortin', fortin); }
    return fortin?.ids || [];
  }
  async function motivacion() {
    toast('🔥 Buscando la previa fortinera…', { ms:1500 });
    const ids = (await videos()).map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    if (!ids.length) return toast('<b>Para la motivación fortinera necesito tu clave de YouTube</b><small>Cargala en ⚙ Ajustes.</small>', { cls:'info' });
    Player.play({ uid:'fortin', platform:'youtube', ref:{ video:ids[0], more:ids.slice(1, 40) }, name:'🔥 Motivación fortinera', noResume:true });
  }

  /* ---------- ⚽ Gol de Vélez en grande ---------- */
  function onGoal(m, team, who) {
    if (!isV(team)) return;
    const o = document.createElement('div'); o.className = 'golazo';
    const sc = `${short(m.h.team)} ${m.hs} - ${m.as} ${short(m.a.team)}`;
    o.innerHTML = `<div class="gz-v">V</div><div class="gz-t">¡GOOOOOL<br>DE VÉLEZ!</div><div class="gz-s">${esc(sc)}</div>${who ? `<div class="gz-w">⚽ ${esc(who)}</div>` : ''}`;
    document.body.appendChild(o); setTimeout(() => o.classList.add('out'), 7000); setTimeout(() => o.remove(), 7800);
    o.onclick = () => o.remove();
  }

  /* ---------- Marcador en la Pantalla TV ---------- */
  function paintHud() {
    const el = $('hudScore'); if (!el) return;
    const m = match(), show = m && (m.state === 'in' || (m.state === 'pre' && Date.parse(m.date) - Date.now() < 45 * 60e3));
    el.hidden = !show; if (!show) return;
    const lg = t => t.logo ? `<img src="${esc(t.logo)}" alt="">` : '';
    const cd = () => { const s = Math.max(0, Math.round((Date.parse(m.date) - Date.now()) / 1e3)); return `faltan ${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`; };
    el.innerHTML = `${lg(m.h.team)}<b>${esc(short(m.h.team))}</b><span class="hs-n">${m.state === 'pre' || !Fulbito.wants(m) ? 'vs' : m.hs + ' - ' + m.as}</span><b>${esc(short(m.a.team))}</b>${lg(m.a.team)}<i>${m.state === 'pre' ? cd() : Fulbito.wants(m) ? esc(m.st) : 'EN JUEGO'}</i>`;
    // Mientras tanto: los otros partidos de la fecha
    const mt = $('hudMt'); if (!mt) return;
    let others = []; try { others = (Fulbito.today()[m.lg]?.events || []).filter(x => x.id !== m.id && x.state !== 'pre'); } catch {}
    mt.hidden = m.state !== 'in' || !others.length; if (mt.hidden) return;
    const x = others[Math.floor(Date.now() / 6000) % others.length];
    mt.innerHTML = `<span class="mt-l">MIENTRAS TANTO</span><span>${esc(short(x.h.team))} <b>${x.hs}-${x.as}</b> ${esc(short(x.a.team))}</span><i>${x.state === 'post' ? 'Final' : esc(x.st)}</i>`;
  }

  /* ---------- 🏠 Ahora: el partido arriba de todo ---------- */
  Inicio.add({ id:'velez', order:1, html() {
    const m = match(); if (!m) return '';
    const ch = (() => { try { return Fulbito.channelsFor(m); } catch { return []; } })();
    const lg = t => t.logo ? `<img src="${esc(t.logo)}" alt="">` : '';
    const mid = m.state === 'pre' ? `<b class="pvs">${hhmm(m.date)}</b><small id="pvCd">${left(m.date)}</small>` : `<b class="pvs">${m.hs} - ${m.as}</b><small>${m.state === 'in' ? '● ' + esc(m.st) : 'Final'}</small>`;
    return `<div class="pvelez ${m.state}"><div class="pvtag">💙 ${m.state === 'post' ? 'HOY JUGÓ VÉLEZ' : m.state === 'in' ? 'ESTÁ JUGANDO VÉLEZ' : 'HOY JUEGA VÉLEZ'}</div>
      <div class="pvrow"><div class="pvt">${lg(m.h.team)}<span>${esc(m.h.team.shortDisplayName || m.h.team.displayName)}</span></div><div class="pvmid">${mid}</div><div class="pvt">${lg(m.a.team)}<span>${esc(m.a.team.shortDisplayName || m.a.team.displayName)}</span></div></div>
      ${m.goals?.length ? `<div class="pvgoals">⚽ ${m.goals.map(g => `${esc(g.who)} ${esc(g.min)}`).join(' · ')}</div>` : ''}
      ${m.state !== 'post' ? Ver.chips(ch, `${m.h.team.shortDisplayName} vs ${m.a.team.shortDisplayName}`) : ''}
      ${m.state === 'pre' ? previaHtml(m, previa?.id === m.id ? previa : null) : ''}
      <div class="btns"><button class="pri" data-pv="fortin">🔥 Motivación fortinera</button>${m.state !== 'post' ? '<button data-pv="tv">📺 Modo partido en la tele</button>' : ''}<button data-pv="mundo">💙 Mundo Vélez</button></div></div>`; },
    bind(el) {
      el.querySelector('[data-pv=fortin]').onclick = motivacion;
      el.querySelector('[data-pv=tv]')?.addEventListener('click', () => { const m = match(); TV.open(); if (m) setTimeout(() => Grafismo.separator(`FUNVS presenta · ${m.h.team.shortDisplayName} vs ${m.a.team.shortDisplayName}`), 50); paintHud(); });
      el.querySelector('[data-pv=mundo]').onclick = () => Nav.go('velez');
    } });

  function init() {
    $('hud')?.insertAdjacentHTML('beforeend', '<div class="hud-score" id="hudScore" hidden></div><div class="hud-mt" id="hudMt" hidden></div>');
    // también en Mundo Vélez
    const orig = Velez.render;
    Velez.render = (...a) => { orig(...a); const v = $('v-velez'); if (v && !v.querySelector('.pvfort')) v.insertAdjacentHTML('afterbegin', '<div class="pvfort"><button class="pri" id="pvFort">🔥 Motivación fortinera</button><span class="mut">videos de la hinchada para la previa</span></div>'); $('pvFort') && ($('pvFort').onclick = motivacion); };
    setInterval(() => { paintHud(); efemTv(); const m = match(); if (m?.state === 'pre' && Date.parse(m.date) - Date.now() < 3 * 3600e3) loadPrevia(m);
      if (Nav.current === 'inicio' && m && m.state !== 'post' && !document.activeElement?.closest?.('#v-inicio')) Inicio.render(); }, 6e3);
    setInterval(() => { const el = $('pvCd'), m = match(); if (el && m?.state === 'pre') el.textContent = left(m.date, true); }, 1000);
    loadEfem();
    paintHud();
  }
  return { init, onGoal, motivacion, match, loadPrevia, efemHoy };
})();
