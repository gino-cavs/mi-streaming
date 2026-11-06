/* =========================================================
   Automovilismo: F1, MotoGP, NASCAR, TC, TC2000 y Top Race
   Los datos los junta GitHub cada 30 min (motor.json en la rama "datos").
   ========================================================= */
const Motor = (() => {
  const CATS = [['f1', 'Fórmula 1', '🏎️'], ['motogp', 'MotoGP', '🏍️'], ['nascar', 'NASCAR', '🇺🇸'], ['tc', 'Turismo Carretera', '🇦🇷'], ['tc2000', 'TC2000', '🇦🇷'], ['toprace', 'Top Race', '🇦🇷']];
  const DUR = { f1:{ Carrera:120, Sprint:45, def:60 }, motogp:{ Carrera:45, Sprint:25, Q1:15, Q2:15, 'Warm Up':10, def:45 }, nascar:{ Carrera:210, def:60 } };
  const DIAS = ['dom', 'lun', 'mar', 'mié', 'jue', 'vie', 'sáb'];
  let data = S.get('motorData', null);
  if (data && !data.cats) data = null;
  let tab = S.get('motorTab', 'resumen');

  async function load(force) {
    if (!force && data && Date.now() - data._at < 15 * 60e3) return;
    try {
      const j = await (await fetch(REPO.data + 'motor.json?t=' + Math.floor(Date.now() / 600e3))).json();
      if (!j || !j.cats) return;
      j._at = Date.now(); data = j; S.set('motorData', j);
      if (Nav.current === 'motor') render();
      Nav.badges();
    } catch {}
  }

  /* ---------- Utilidades ---------- */
  const isFav = name => db.motor.drivers.some(d => { const a = norm(d), b = norm(name); return a && (b.includes(a) || a.split(' ').every(w => b.includes(w))); });
  function dur(cat, s) { const d = DUR[cat] || {}; return (d[s.name] || d.def || 120) * 60e3; }
  function sState(cat, s) {
    const t = Date.parse(s.start), now = Date.now();
    if (s.dayOnly) {
      const same = new Date(t).toDateString() === new Date().toDateString();
      return same ? 'today' : t < now ? 'done' : 'pre';
    }
    if (s.live || (now >= t && now < t + dur(cat, s))) return 'live';
    return now >= t + dur(cat, s) ? 'done' : 'pre';
  }
  function when(s) {
    const d = new Date(s.start), today = new Date(), tm = new Date(Date.now() + 864e5);
    const day = d.toDateString() === today.toDateString() ? 'Hoy' : d.toDateString() === tm.toDateString() ? 'Mañana' : DIAS[d.getDay()] + ' ' + d.getDate() + '/' + (d.getMonth() + 1);
    return s.dayOnly ? day : day + ' ' + fmtH(d);
  }
  function countdown(iso) {
    const ms = Date.parse(iso) - Date.now(); if (ms <= 0) return '';
    const d = Math.floor(ms / 864e5), h = Math.floor(ms % 864e5 / 3600e3), m = Math.floor(ms % 3600e3 / 60e3);
    return 'Faltan ' + (d ? d + ' d ' : '') + (d < 3 ? h + ' h ' : '') + (!d ? m + ' min' : '');
  }
  const tvChips = tv => tv && tv.length ? `<div class="tvch">📺 ${tv.map(c => `<span>${esc(c)}</span>`).join('')}</div>` : '';
  const liveSessions = () => !data ? [] : CATS.flatMap(([id]) => (data.cats[id]?.next?.sessions || []).filter(s => sState(id, s) === 'live').map(s => ({ id, s })));

  /* ---------- Pantallas ---------- */
  function render() {
    const v = $('v-motor');
    if (!data) { v.innerHTML = '<div class="empty">Cargando automovilismo…</div>'; load(true).then(() => { if (!data) v.innerHTML = '<div class="empty">Todavía no hay datos. GitHub los junta cada 30 minutos: si recién lo activamos, esperá un rato.</div>'; }); return; }
    if (!Noticias.loaded) Noticias.load().then(() => { if (Nav.current === 'motor') render(); }).catch(() => {});
    const live = liveSessions();
    v.innerHTML = `
      <div class="subbar"><div class="tabs" id="mTabs">
        <button data-m="resumen" class="${tab === 'resumen' ? 'on' : ''}">🏁 Resumen</button>
        ${CATS.map(([id, n, ic]) => `<button data-m="${id}" class="${tab === id ? 'on' : ''}">${ic} ${n}${live.some(x => x.id === id) ? ' <span class="cnt" style="background:var(--live);color:#fff;border-radius:10px;padding:0 6px">●</span>' : ''}</button>`).join('')}
      </div></div>
      <div id="mBody">${tab === 'resumen' ? resumen() : catView(tab)}</div>
      <p class="mut" style="font-size:12px;margin-top:14px">Datos: Jolpica (F1), motogp.com, ESPN (NASCAR), ACTC, tc2000.com.ar, toprace.com.ar · Canales: futbolenvivoargentina.com · Actualizado ${ago(data.updated)} · <a href="https://vueltarapida.com/calendario" target="_blank" rel="noopener" style="color:var(--acc)">Calendario de +50 categorías en Vuelta Rápida ↗</a></p>`;
    $('mTabs').onclick = e => { const b = e.target.closest('[data-m]'); if (b) { tab = b.dataset.m; S.set('motorTab', tab); render(); } };
    v.querySelectorAll('[data-go]').forEach(b => b.onclick = () => { tab = b.dataset.go; S.set('motorTab', tab); render(); window.scrollTo(0, 0); });
    const f = $('mFavForm');
    if (f) f.onsubmit = e => { e.preventDefault(); const n = $('mFavIn').value.trim(); if (n && !db.motor.drivers.some(d => norm(d) === norm(n))) { db.motor.drivers.push(n); save(); } render(); };
    v.querySelectorAll('[data-unfav]').forEach(b => b.onclick = () => { db.motor.drivers = db.motor.drivers.filter(d => d !== b.dataset.unfav); save(); render(); });
    const pr = $('mPractice'); if (pr) pr.onchange = () => { db.motor.practice = pr.checked; save(); };
  }

  function resumen() {
    // tus pilotos: dónde corren y cómo van
    const favs = db.motor.drivers.map(d => {
      const where = CATS.map(([id, n]) => {
        const c = data.cats[id]; if (!c) return null;
        const st = (c.standings || []).find(x => isFav(x.name) && norm(x.name).includes(norm(d).split(' ').pop()));
        const lr = (c.last?.results || []).find(x => isFav(x.name) && norm(x.name).includes(norm(d).split(' ').pop()));
        return st || lr ? { id, n, st, lr, last:c.last } : null;
      }).filter(Boolean);
      return { d, where };
    });
    const week = CATS.flatMap(([id, n, ic]) => (data.cats[id]?.next?.sessions || [])
      .filter(s => sState(id, s) !== 'done' && Date.parse(s.start) - Date.now() < 7 * 864e5 && (s.key || db.motor.practice || id === 'f1' || id === 'motogp'))
      .map(s => ({ id, n, ic, s, ev:data.cats[id].next.name, tv:data.cats[id].tv })))
      .sort((a, b) => Date.parse(a.s.start) - Date.parse(b.s.start));
    return `
      <h2 class="sec">⭐ Tus pilotos</h2>
      <div class="mfavs">${favs.map(f => `<div class="mfav"><b>${esc(f.d)}</b>${f.where.length ? f.where.map(w => `
          <div class="mfav-l" data-go="${w.id}">${esc(w.n)}: ${w.st ? `<span class="pos">P${w.st.pos}</span> en el campeonato · ${w.st.pts} pts` : ''}${w.lr ? `<br><span class="mut">Última (${esc(w.last.name)}): P${w.lr.pos}</span>` : ''}</div>`).join('')
          : '<div class="mut" style="font-size:13px">Sin datos en las categorías que seguís.</div>'}</div>`).join('')}</div>
      <form id="mFavForm" class="rsearch" style="margin:-4px 0 6px"><input id="mFavIn" placeholder="Agregar piloto favorito"><button>Agregar</button></form>
      <div class="chips">${db.motor.drivers.map(d => `<button data-unfav="${esc(d)}" class="sm">★ ${esc(d)} ✕</button>`).join('')}</div>

      <h2 class="sec" style="margin-top:16px">📅 Próximos 7 días</h2>
      ${week.length ? `<div class="msess">${week.map(x => sessRow(x.id, x.s, `${x.ic} <b>${esc(x.n)}</b> · ${esc(x.ev)}`, x.tv)).join('')}</div>` : '<div class="empty" style="padding:12px">No hay carreras de tus categorías en los próximos 7 días.</div>'}

      <h2 class="sec" style="margin-top:16px">🏁 Próxima fecha de cada categoría</h2>
      <div class="mnext">${CATS.map(([id, n, ic]) => { const c = data.cats[id], nx = c?.next, race = nx?.sessions?.find(s => s.race) || nx?.sessions?.slice(-1)[0];
        return `<div class="mcard" data-go="${id}"><div class="mut" style="font-size:12px">${ic} ${esc(n)}</div>
          <b>${nx ? esc(nx.name) : (c?.error ? 'Sin datos' : 'Temporada terminada')}</b>
          ${nx ? `<div class="mut" style="font-size:12px">${esc(nx.place || nx.circuit || '')}</div><div style="margin-top:4px">${esc(when(race))}${race.dayOnly ? '' : ''}</div><div class="cd">${esc(countdown(race.start))}</div>` : ''}</div>`; }).join('')}</div>
      <label class="mut" style="font-size:13px;display:flex;gap:6px;align-items:center;margin-top:12px"><input type="checkbox" id="mPractice" ${db.motor.practice ? 'checked' : ''}> Avisarme también de los entrenamientos (además de clasificación, sprint y carrera)</label>`;
  }
  function sessRow(id, s, label, tv) {
    const st = sState(id, s);
    return `<div class="msrow ${st}"><div class="mt">${st === 'live' ? '<span class="lv">● EN VIVO</span>' : esc(when(s))}</div>
      <div class="mx">${label ? label + ' · ' : ''}${esc(s.name)}${s.key && !s.race ? '' : ''}${st === 'done' ? ' <span class="mut">(terminó)</span>' : ''}</div>${tv && st !== 'done' ? tvChips(tv) : ''}</div>`;
  }
  function table(list, cols) {
    return `<table class="mtab"><tbody>${list.map(r => `<tr class="${isFav(r.name) ? 'fav' : ''}"><td>${r.pos}</td><td>${isFav(r.name) ? '★ ' : ''}${esc(r.name)}${r.team && cols.team ? `<small> ${esc(r.team)}</small>` : ''}</td>${cols.pts ? `<td class="r">${r.pts}</td>` : ''}</tr>`).join('')}</tbody></table>`;
  }
  function catView(id) {
    const c = data.cats[id], [, n, ic] = CATS.find(x => x[0] === id);
    if (!c || c.error) return `<div class="empty">No pude traer los datos de ${esc(n)} esta vez.${c?.error ? '<br><small>' + esc(c.error) + '</small>' : ''}</div>`;
    const nx = c.next, race = nx?.sessions?.find(s => s.race);
    const favSt = (c.standings || []).filter(x => isFav(x.name));
    const top = (c.standings || []).slice(0, 15);
    favSt.forEach(f => { if (!top.includes(f)) top.push(f); });
    const lastTop = (c.last?.results || []).slice(0, 10);
    (c.last?.results || []).filter(x => isFav(x.name)).forEach(f => { if (!lastTop.includes(f)) lastTop.push(f); });
    const news = Noticias.byTopic('motor-' + id).slice(0, 8);
    return `
      ${nx ? `<div class="mhero"><div class="mut" style="font-size:12px">${ic} ${esc(n)} · Fecha ${nx.round}</div><h2>${esc(nx.name)}</h2>
        <div class="mut">${esc([nx.circuit, nx.place].filter((x, i, a) => x && a.indexOf(x) === i).join(' · '))}</div>
        ${race ? `<div class="cd big">${esc(countdown(race.start)) || (sState(id, race) === 'live' ? '● EN VIVO' : '')}</div>` : ''}
        ${tvChips(c.tv)}
        ${nx.dayOnly ? '<div class="mut" style="font-size:12px;margin-top:6px">Los horarios de las categorías argentinas se confirman cerca de cada fecha.</div>' : ''}</div>
        <div class="msess">${nx.sessions.map(s => sessRow(id, s, '', null)).join('')}</div>`
        : '<div class="empty">No hay próximas fechas: la temporada terminó.</div>'}
      <div class="vcols" style="margin-top:16px">
        <div>
          ${c.last && lastTop.length ? `<h2 class="sec">🏆 Último resultado · ${esc(c.last.name)}</h2>${table(lastTop, { team:true })}` : ''}
          ${top.length ? `<h2 class="sec" style="margin-top:14px">📊 Campeonato</h2>${table(top, { pts:true, team:id === 'f1' || id === 'motogp' })}` : ''}
        </div>
        <div>
          ${news.length ? `<h2 class="sec">📰 Noticias</h2>${Noticias.list(news, 8)}` : ''}
          <h2 class="sec" style="margin-top:14px">🗓️ Calendario</h2>
          <div class="mcal">${c.cal.map(f => { const past = Date.parse(f.date) < Date.now() - 864e5, isNext = nx && f.round === nx.round;
            return `<div class="${past ? 'past' : ''} ${isNext ? 'nx' : ''}"><span>${f.round}</span><b>${esc(f.name)}</b><small>${new Date(f.date).toLocaleDateString('es-AR', { day:'numeric', month:'short' })}</small></div>`; }).join('')}</div>
        </div>
      </div>`;
  }

  /* ---------- Avisos dentro del centro ---------- */
  const fired = new Set(S.get('motorAlerts', []));
  function alerts() {
    if (!data) return;
    const now = Date.now();
    CATS.forEach(([id, n, ic]) => {
      const c = data.cats[id]; const nx = c?.next; if (!nx) return;
      nx.sessions.forEach(s => {
        const t = Date.parse(s.start);
        if (s.dayOnly) {
          const k = id + s.start + 'day';
          if (new Date(t).toDateString() === new Date().toDateString() && new Date().getHours() >= 9 && !fired.has(k)) {
            fired.add(k); pop(`<span class="g">🏁 Hoy corre el ${esc(n)}</span>${esc(nx.name)}${nx.place && nx.place !== nx.name ? ' · ' + esc(nx.place) : ''}`, id);
          }
          return;
        }
        if (!s.key && !db.motor.practice) return;
        const k15 = id + s.start + '15', k0 = id + s.start + '0';
        if (t - now <= 15 * 60e3 && t - now > 0 && !fired.has(k15)) { fired.add(k15); pop(`<span class="g">⏱️ En 15 min: ${esc(n)}</span>${esc(s.name)} · ${esc(nx.name)}${c.tv?.length ? `<small>📺 ${esc(c.tv.slice(0, 2).join(' · '))}</small>` : ''}`, id); }
        if (now >= t && now - t < 10 * 60e3 && !fired.has(k0)) { fired.add(k0); pop(`<span class="g">🔴 Arrancó: ${esc(n)}</span>${esc(s.name)} · ${esc(nx.name)}${c.tv?.length ? `<small>📺 ${esc(c.tv.slice(0, 2).join(' · '))}</small>` : ''}`, id); }
      });
    });
    S.set('motorAlerts', [...fired].slice(-200));
  }
  function pop(html, id) {
    toast(html, { cls:'goal race', ms:20000, onclick:() => { tab = id; S.set('motorTab', id); Nav.go('motor'); } });
    if (Fulbito.soundOn && Fulbito.soundOn() && !DND.active()) beep();
  }
  // renglones para el zócalo de la Pantalla TV
  function ticker() {
    if (!data) return [];
    return CATS.flatMap(([id, n]) => {
      const nx = data.cats[id]?.next; if (!nx) return [];
      return nx.sessions.filter(s => { const st = sState(id, s); return st === 'live' || st === 'today' || (st === 'pre' && Date.parse(s.start) - Date.now() < 864e5 && (s.key || s.race)); })
        .map(s => `🏁 ${n}: ${s.name} ${sState(id, s) === 'live' ? '(EN VIVO)' : '· ' + when(s)} · ${nx.name}`);
    });
  }
  function init() {
    load(); setInterval(load, 15 * 60e3);
    setInterval(() => { alerts(); if (Nav.current === 'motor' && !document.hidden) { const y = window.scrollY; render(); window.scrollTo(0, y); } }, 60e3);
    setTimeout(alerts, 3000);
    onChange(() => { if (Nav.current === 'motor') render(); });
  }
  return { init, render, ticker, liveCount:() => liveSessions().length };
})();
