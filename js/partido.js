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
  function left(d) { const m = Math.round((Date.parse(d) - Date.now()) / 60e3); return m <= 0 ? 'ya empieza' : m < 60 ? `en ${m} min` : `en ${Math.floor(m / 60)} h ${m % 60} min`; }

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
    el.innerHTML = `${lg(m.h.team)}<b>${esc(short(m.h.team))}</b><span class="hs-n">${m.state === 'pre' ? 'vs' : m.hs + ' - ' + m.as}</span><b>${esc(short(m.a.team))}</b>${lg(m.a.team)}<i>${m.state === 'pre' ? hhmm(m.date) : esc(m.st)}</i>`;
  }

  /* ---------- 🏠 Ahora: el partido arriba de todo ---------- */
  Inicio.add({ id:'velez', order:1, html() {
    const m = match(); if (!m) return '';
    const ch = (() => { try { return Fulbito.channelsFor(m); } catch { return []; } })();
    const lg = t => t.logo ? `<img src="${esc(t.logo)}" alt="">` : '';
    const mid = m.state === 'pre' ? `<b class="pvs">${hhmm(m.date)}</b><small>${left(m.date)}</small>` : `<b class="pvs">${m.hs} - ${m.as}</b><small>${m.state === 'in' ? '● ' + esc(m.st) : 'Final'}</small>`;
    return `<div class="pvelez ${m.state}"><div class="pvtag">💙 ${m.state === 'post' ? 'HOY JUGÓ VÉLEZ' : m.state === 'in' ? 'ESTÁ JUGANDO VÉLEZ' : 'HOY JUEGA VÉLEZ'}</div>
      <div class="pvrow"><div class="pvt">${lg(m.h.team)}<span>${esc(m.h.team.shortDisplayName || m.h.team.displayName)}</span></div><div class="pvmid">${mid}</div><div class="pvt">${lg(m.a.team)}<span>${esc(m.a.team.shortDisplayName || m.a.team.displayName)}</span></div></div>
      ${m.goals?.length ? `<div class="pvgoals">⚽ ${m.goals.map(g => `${esc(g.who)} ${esc(g.min)}`).join(' · ')}</div>` : ''}
      ${m.state !== 'post' ? Ver.chips(ch, `${m.h.team.shortDisplayName} vs ${m.a.team.shortDisplayName}`) : ''}
      <div class="btns"><button class="pri" data-pv="fortin">🔥 Motivación fortinera</button>${m.state !== 'post' ? '<button data-pv="tv">📺 Modo partido en la tele</button>' : ''}<button data-pv="mundo">💙 Mundo Vélez</button></div></div>`; },
    bind(el) {
      el.querySelector('[data-pv=fortin]').onclick = motivacion;
      el.querySelector('[data-pv=tv]')?.addEventListener('click', () => { TV.open(); paintHud(); });
      el.querySelector('[data-pv=mundo]').onclick = () => Nav.go('velez');
    } });

  function init() {
    $('hud')?.insertAdjacentHTML('beforeend', '<div class="hud-score" id="hudScore" hidden></div>');
    // también en Mundo Vélez
    const orig = Velez.render;
    Velez.render = (...a) => { orig(...a); const v = $('v-velez'); if (v && !v.querySelector('.pvfort')) v.insertAdjacentHTML('afterbegin', '<div class="pvfort"><button class="pri" id="pvFort">🔥 Motivación fortinera</button><span class="mut">videos de la hinchada para la previa</span></div>'); $('pvFort') && ($('pvFort').onclick = motivacion); };
    setInterval(() => { paintHud(); if (Nav.current === 'inicio' && match()?.state === 'in' && !document.activeElement?.closest?.('#v-inicio')) Inicio.render(); }, 15e3);
    paintHud();
  }
  return { init, onGoal, motivacion, match };
})();
