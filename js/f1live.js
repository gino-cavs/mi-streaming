/* =========================================================
   🏎️ F1 en vivo + análisis con telemetría (OpenF1).
   - Durante la sesión: vivos de YouTube (tus canales + búsqueda) y el Live Timing oficial.
     (los datos en tiempo real de OpenF1 son pagos; gratis se liberan al terminar la sesión)
   - Después: clasificación, ritmo por vuelta, estrategia de gomas y telemetría comparada
     (velocidad, acelerador, freno y mapa del circuito con quién fue más rápido en cada parte).
   ========================================================= */
const F1Live = (() => {
  const API = 'https://api.openf1.org/v1/';
  const F1RE = /\bf1\b|f[oó]rmula ?1|formula one|gran premio|\bgp\b|telem[eé]tric|colapinto|qualy|clasificaci[oó]n f1|sprint/i;
  const TYRE = { SOFT:['#e8002d', 'S'], MEDIUM:['#ffd12e', 'M'], HARD:['#f0f0ec', 'H'], INTERMEDIATE:['#43b02a', 'I'], WET:['#0067ad', 'W'] };
  let el = null, sessions = null, sesErr = null, sel = S.get('f1Ses', null), cache = {}, pace = null, cmp = S.get('f1Cmp', null), cmpData = null, busy = false;

  /* ---------- pedidos a OpenF1, de a uno (límite gratis: 3 por segundo, 30 por minuto) ---------- */
  let last = 0;
  async function get(path) {
    const wait = Math.max(0, last + 400 - Date.now()); if (wait) await new Promise(r => setTimeout(r, wait));
    last = Date.now();
    for (let i = 0; i < 3; i++) {
      const r = await fetch(API + path);
      if (r.status === 429) { await new Promise(r => setTimeout(r, 2500)); continue; }
      if (r.status === 401 || r.status === 403) throw new Error('vivo');
      if (!r.ok) throw new Error('HTTP ' + r.status);
      const j = await r.json(); if (j && j.detail) throw new Error(/live|real.?time|subscri/i.test(j.detail) ? 'vivo' : j.detail);
      return j;
    }
    throw new Error('OpenF1 está saturado, probá en un minuto');
  }
  const fmtLap = s => s == null ? '—' : `${Math.floor(s / 60)}:${(s % 60).toFixed(3).padStart(6, '0')}`;
  const col = d => '#' + (d.team_colour || '888888');
  const isFavD = d => db.motor.drivers.some(f => { const l = norm(f).split(' ').pop(); return l && norm(d.full_name || '').includes(l); });

  let sesP = null;
  const loadSessions = () => sesP || (sesP = _loadSessions());
  async function _loadSessions() {
    try {
      const y = new Date().getFullYear();
      let s = await get('sessions?year=' + y);
      if (!s.some(x => Date.parse(x.date_end) < Date.now())) s = await get('sessions?year=' + (y - 1));
      const m = await get('meetings?year=' + new Date(s[0].date_start).getFullYear());
      const mn = Object.fromEntries(m.map(x => [x.meeting_key, x.meeting_name]));
      sessions = s.map(x => ({ ...x, meeting:mn[x.meeting_key] || x.location })).sort((a, b) => Date.parse(b.date_start) - Date.parse(a.date_start));
      sesErr = null;
    } catch (e) { sesErr = e.message; setTimeout(() => { sesP = null; }, 60e3); }
  }
  // una sola carga por sesión aunque la pantalla se redibuje mientras tanto
  const loadSession = k => cache[k] || (cache[k] = _loadSession(k).catch(e => { delete cache[k]; throw e; }));
  async function _loadSession(k) {
    const [drivers, laps, stints, pos, pit] = [await get('drivers?session_key=' + k), await get('laps?session_key=' + k), await get('stints?session_key=' + k), await get('position?session_key=' + k), await get('pit?session_key=' + k)];
    let res = []; try { res = await get('session_result?session_key=' + k); } catch {}
    const D = new Map(drivers.map(d => [d.driver_number, d]));
    const best = {}, lapsBy = {};
    for (const l of laps) { (lapsBy[l.driver_number] = lapsBy[l.driver_number] || []).push(l); if (l.lap_duration && (!best[l.driver_number] || l.lap_duration < best[l.driver_number].lap_duration)) best[l.driver_number] = l; }
    const lastPos = {}; for (const p of pos) lastPos[p.driver_number] = p.position;
    const R = new Map(res.map(r => [r.driver_number, r]));
    const order = [...D.keys()].sort((a, b) => ((R.get(a)?.position ?? lastPos[a] ?? 99) - (R.get(b)?.position ?? lastPos[b] ?? 99)));
    const pits = {}; for (const p of pit) pits[p.driver_number] = (pits[p.driver_number] || 0) + 1;
    return { D, order, best, lapsBy, stints, pits, R, lastPos };
  }

  /* ---------- pantalla ---------- */
  function mount(box, opts = {}) {
    el = box; if (!el) return;
    el.innerHTML = `${livePanel(opts.live)}<div id="f1An"></div>`;
    el.querySelectorAll('[data-f1q]').forEach(b => b.onclick = () => Ver.open(b.dataset.f1q));
    const g = $('f1Chans'); if (g) Canales.bindGrid(g);
    renderAn();
  }
  function livePanel(live) {
    const chans = db.chans.filter(c => { const s = Canales.status[c.uid] || {}; return s.st === 'live' && !s.prem && F1RE.test((s.title || '') + ' ' + c.name); });
    return `<div class="f1live ${live ? 'on' : ''}">
      <h2 class="sec">${live ? '🔴 Sesión en vivo' : '📡 Seguimiento en vivo'}</h2>
      <div class="btns" style="flex-wrap:wrap">
        <a class="pri lnk btnl" href="https://www.formula1.com/en/timing/f1-live" target="_blank" rel="noopener">⏱️ Live Timing oficial ↗</a>
        <button data-f1q="Telemétrico F1 en vivo">🔎 Telemétrico en vivo</button>
        <button data-f1q="Fórmula 1 en vivo">🔎 Vivos de F1 en YouTube</button>
      </div>
      ${chans.length ? `<div class="grid" id="f1Chans" style="margin-top:10px">${chans.map(Canales.card).join('')}</div>`
        : `<p class="mut" style="font-size:13px;margin-top:8px">${live ? 'Ninguno de tus canales está transmitiendo F1 ahora. ' : ''}Tip: sumá en 📺 Canales los canales que cubren la carrera (Telemétrico, etc.). Cuando estén en vivo con F1 en el título, aparecen acá solos.</p>`}
      <p class="mut" style="font-size:12px;margin-top:6px">La telemetría de OpenF1 es gratis cuando termina cada sesión (en vivo es paga). Abajo tenés el análisis de la última.</p>
    </div>`;
  }
  async function renderAn() {
    const a = $('f1An'); if (!a) return;
    if (!sessions && !sesErr) { a.innerHTML = '<div class="empty">Cargando sesiones de OpenF1…</div>'; await loadSessions(); if ($('f1An') === a) renderAn(); return; }
    if (sesErr) { a.innerHTML = errBox(sesErr); return; }
    const done = sessions.filter(s => Date.parse(s.date_end) < Date.now() - 5 * 60e3);
    if (!sel || !done.some(s => s.session_key === sel)) sel = done[0]?.session_key;
    const s = done.find(x => x.session_key === sel);
    a.innerHTML = `<h2 class="sec" style="margin-top:16px">📊 Análisis con telemetría</h2>
      <div class="btns"><select id="f1Sel">${done.slice(0, 60).map(x => `<option value="${x.session_key}" ${x.session_key === sel ? 'selected' : ''}>${esc(x.meeting)} · ${esc(x.session_name)}</option>`).join('')}</select></div>
      <div id="f1Body"><div class="empty">Cargando ${esc(s ? s.session_name : '')}…</div></div>`;
    $('f1Sel').onchange = e => { sel = +e.target.value; S.set('f1Ses', sel); pace = null; cmpData = null; renderAn(); };
    if (!s) return;
    try { const d = await loadSession(sel); if (sel === s.session_key && $('f1An') === a) body(s, d); }
    catch (e) { if ($('f1Body')) $('f1Body').innerHTML = errBox(e.message); }
  }
  const errBox = m => `<div class="empty">${m === 'vivo' ? 'Hay una sesión en vivo: OpenF1 libera los datos gratis cuando termina. Mientras, usá el Live Timing y los vivos de arriba.' : 'No pude traer datos de OpenF1 (' + esc(m) + ').'}</div>`;

  function body(s, d) {
    const B = $('f1Body'); if (!B) return;
    const race = /race|sprint/i.test(s.session_type + ' ' + s.session_name) && !/qualif|shootout/i.test(s.session_name);
    const top = Math.min(...Object.values(d.best).map(l => l.lap_duration));
    if (!pace) pace = new Set([...d.order.slice(0, 3), ...d.order.filter(n => isFavD(d.D.get(n)))]);
    const rows = d.order.map((n, i) => {
      const dr = d.D.get(n), r = d.R.get(n), bl = d.best[n];
      const st = d.stints.filter(x => x.driver_number === n).sort((a, b) => a.stint_number - b.stint_number);
      const extra = race ? (r ? (r.dnf ? 'Abandono' : r.dns ? 'No largó' : r.dsq ? 'Descalificado' : i === 0 ? fmtTot(r.duration) : fmtGap(r.gap_to_leader)) : '') : (bl && i ? '+' + (bl.lap_duration - top).toFixed(3) : '');
      return `<tr class="${isFavD(dr) ? 'fav' : ''}"><td>${r?.position ?? d.lastPos[n] ?? '–'}</td>
        <td><span class="f1bar" style="background:${col(dr)}"></span><b>${esc(dr.name_acronym || '')}</b> <span class="mut">${esc(dr.full_name || '')}</span></td>
        <td class="r">${esc(extra || '')}</td><td class="r">${fmtLap(bl?.lap_duration)}</td>
        ${race ? `<td class="r">${d.pits[n] || 0}</td>` : ''}<td>${st.map(x => tyre(x.compound)).join('')}</td></tr>`;
    }).join('');
    B.innerHTML = `
      <div class="vcols">
        <div><h3 class="f1h">🏁 ${race ? 'Resultado' : 'Tiempos'}</h3>
          <table class="mtab f1tab"><thead><tr><th>P</th><th>Piloto</th><th class="r">${race ? 'Tiempo / gap' : 'Gap'}</th><th class="r">Mejor vuelta</th>${race ? '<th class="r">Paradas</th>' : ''}<th>Gomas</th></tr></thead><tbody>${rows}</tbody></table></div>
        <div><h3 class="f1h">🛞 Estrategia de gomas</h3>${strategy(d)}
          <div class="mut" style="font-size:12px;margin-top:6px">${Object.entries(TYRE).map(([k, [c, l]]) => `${tyreDot(c, l)} ${k === 'SOFT' ? 'Blanda' : k === 'MEDIUM' ? 'Media' : k === 'HARD' ? 'Dura' : k === 'INTERMEDIATE' ? 'Intermedia' : 'Lluvia'}`).join(' · ')}</div></div>
      </div>
      <h3 class="f1h">⏱️ Ritmo vuelta a vuelta</h3>
      <div class="chips" id="f1Pace">${d.order.map(n => { const dr = d.D.get(n); return `<button data-n="${n}" class="${pace.has(n) ? 'on' : ''}"><span class="f1dot" style="background:${col(dr)}"></span>${esc(dr.name_acronym)}</button>`; }).join('')}</div>
      <div class="f1chart" id="f1PaceC"></div>
      <h3 class="f1h">📡 Telemetría: vuelta más rápida, uno contra otro</h3>
      <div class="btns"><select id="f1A">${opts(d, cmp?.a ?? d.order[0])}</select><span>vs</span><select id="f1B">${opts(d, cmp?.b ?? (d.order.find(n => isFavD(d.D.get(n)) && n !== d.order[0]) ?? d.order[1]))}</select><button class="pri" id="f1Go">Comparar</button></div>
      <div id="f1Cmp"></div>`;
    $('f1Pace').onclick = e => { const b = e.target.closest('[data-n]'); if (!b) return; const n = +b.dataset.n; pace.has(n) ? pace.delete(n) : pace.add(n); b.classList.toggle('on'); paceChart(d); };
    paceChart(d);
    $('f1Go').onclick = () => { cmp = { a:+$('f1A').value, b:+$('f1B').value }; S.set('f1Cmp', cmp); compare(d); };
    if (cmpData && cmpData.k === sel) drawCmp(d, cmpData);
  }
  const opts = (d, v) => d.order.filter(n => d.best[n]).map(n => `<option value="${n}" ${n === v ? 'selected' : ''}>${esc(d.D.get(n).name_acronym)} · ${esc(d.D.get(n).full_name)}</option>`).join('');
  const fmtTot = s => typeof s === 'number' ? `${Math.floor(s / 3600)}:${String(Math.floor(s % 3600 / 60)).padStart(2, '0')}:${(s % 60).toFixed(3).padStart(6, '0')}` : '';
  const fmtGap = g => g == null ? '' : typeof g === 'number' ? '+' + g.toFixed(3) : String(g).replace(/LAP/i, 'vuelta');
  const tyreDot = (c, l) => `<span class="tyre" style="border-color:${c}">${l}</span>`;
  const tyre = cp => { const t = TYRE[cp] || ['#888', '?']; return tyreDot(t[0], t[1]); };

  function strategy(d) {
    const max = Math.max(1, ...d.stints.map(s => s.lap_end || 0));
    return `<div class="f1strat">${d.order.map(n => { const dr = d.D.get(n); const st = d.stints.filter(x => x.driver_number === n).sort((a, b) => a.stint_number - b.stint_number);
      return `<div class="f1sr"><b>${esc(dr.name_acronym)}</b><div class="f1st">${st.map(x => { const t = TYRE[x.compound] || ['#888', '?']; const w = ((x.lap_end || x.lap_start) - x.lap_start + 1) / max * 100;
        return `<span style="width:${w}%;background:${t[0]}" title="${esc(x.compound || '?')} · vueltas ${x.lap_start}–${x.lap_end}${x.tyre_age_at_start ? ' · usada (' + x.tyre_age_at_start + ' v.)' : ''}">${w > 6 ? t[1] : ''}</span>`; }).join('')}</div></div>`; }).join('')}</div>`;
  }

  /* ---------- gráficos SVG ---------- */
  const W = 760;
  function lineChart(box, series, o) {
    // series: [{ name, color, dash, pts:[[x,y]] }]
    const H = o.h || 260, P = { l:52, r:12, t:10, b:26 };
    const xs = series.flatMap(s => s.pts.map(p => p[0])), ys = series.flatMap(s => s.pts.map(p => p[1]));
    if (!xs.length) { box.innerHTML = '<div class="empty">Sin datos para mostrar.</div>'; return; }
    const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = o.y0 ?? Math.min(...ys), y1 = o.y1 ?? Math.max(...ys);
    const X = x => P.l + (x - x0) / ((x1 - x0) || 1) * (W - P.l - P.r), Y = y => o.inv ? P.t + (y - y0) / ((y1 - y0) || 1) * (H - P.t - P.b) : H - P.b - (y - y0) / ((y1 - y0) || 1) * (H - P.t - P.b);
    const ticks = (a, b, n) => Array.from({ length:n + 1 }, (_, i) => a + (b - a) * i / n);
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" class="f1svg">
      ${ticks(y0, y1, 4).map(t => `<line x1="${P.l}" x2="${W - P.r}" y1="${Y(t)}" y2="${Y(t)}" class="gr"/><text x="${P.l - 6}" y="${Y(t) + 4}" text-anchor="end">${o.fy(t)}</text>`).join('')}
      ${ticks(x0, x1, 6).map(t => `<text x="${X(t)}" y="${H - 8}" text-anchor="middle">${o.fx(t)}</text>`).join('')}
      ${series.map(s => `<polyline fill="none" stroke="${s.color}" stroke-width="2" ${s.dash ? 'stroke-dasharray="5 4"' : ''} stroke-linejoin="round" points="${s.pts.map(p => X(p[0]).toFixed(1) + ',' + Y(p[1]).toFixed(1)).join(' ')}"/>`).join('')}
      <line class="xh" y1="${P.t}" y2="${H - P.b}" style="display:none"/></svg><div class="f1tip" style="display:none"></div>
      ${series.length > 1 ? `<div class="f1leg">${series.map(s => `<span><i style="border-top:2px ${s.dash ? 'dashed' : 'solid'} ${s.color}"></i>${esc(s.name)}</span>`).join('')}</div>` : ''}`;
    // hover: línea vertical + valores de cada serie en ese punto
    const svg = box.querySelector('svg'), xh = svg.querySelector('.xh'), tip = box.querySelector('.f1tip');
    svg.onmousemove = e => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W; if (px < P.l || px > W - P.r) return;
      const xv = x0 + (px - P.l) / (W - P.l - P.r) * (x1 - x0);
      const vals = series.map(s => { let b = null; for (const p of s.pts) if (!b || Math.abs(p[0] - xv) < Math.abs(b[0] - xv)) b = p; return [s, b]; }).filter(x => x[1]);
      xh.setAttribute('x1', X(vals[0][1][0])); xh.setAttribute('x2', X(vals[0][1][0])); xh.style.display = '';
      tip.innerHTML = `<b>${o.fx(vals[0][1][0], true)}</b>` + vals.sort((a, b) => o.inv ? a[1][1] - b[1][1] : b[1][1] - a[1][1]).map(([s, p]) => `<div><i style="background:${s.color}"></i>${esc(s.name)} <b>${o.fy(p[1], true)}</b></div>`).join('');
      tip.style.display = ''; const bx = box.getBoundingClientRect(); tip.style.left = Math.min(e.clientX - bx.left + 12, bx.width - 170) + 'px'; tip.style.top = '8px';
    };
    svg.onmouseleave = () => { xh.style.display = 'none'; tip.style.display = 'none'; };
  }
  // compañeros de equipo: mismo color, el segundo punteado
  function dashOf(d, ns) { const seen = new Set(); return Object.fromEntries(ns.map(n => { const t = d.D.get(n).team_name; const r = seen.has(t); seen.add(t); return [n, r]; })); }
  function paceChart(d) {
    const ns = d.order.filter(n => pace.has(n)), dash = dashOf(d, ns);
    const series = ns.map(n => {
      const L = (d.lapsBy[n] || []).filter(l => l.lap_duration && !l.is_pit_out_lap);
      const med = L.map(l => l.lap_duration).sort((a, b) => a - b)[Math.floor(L.length / 2)] || 0;
      return { name:d.D.get(n).name_acronym, color:col(d.D.get(n)), dash:dash[n], pts:L.filter(l => l.lap_duration < med * 1.08).map(l => [l.lap_number, l.lap_duration]) };
    });
    lineChart($('f1PaceC'), series, { h:280, inv:true, fx:(x, t) => t ? 'Vuelta ' + Math.round(x) : Math.round(x), fy:(y, t) => t ? fmtLap(y) : fmtLap(y).slice(0, -2) });
  }

  async function compare(d) {
    const box = $('f1Cmp'); if (!box || busy) return;
    const la = d.best[cmp.a], lb = d.best[cmp.b];
    if (!la || !lb) { box.innerHTML = '<div class="empty">Alguno de los dos no tiene vuelta cronometrada.</div>'; return; }
    busy = true; box.innerHTML = '<div class="empty">Bajando telemetría (4 pedidos a OpenF1)…</div>';
    try {
      const win = l => { const s = new Date(l.date_start), e = new Date(+s + l.lap_duration * 1000 + 500); return `&date>=${encodeURIComponent(s.toISOString())}&date<=${encodeURIComponent(e.toISOString())}`; };
      const ca = await get(`car_data?session_key=${sel}&driver_number=${cmp.a}${win(la)}`), cb = await get(`car_data?session_key=${sel}&driver_number=${cmp.b}${win(lb)}`);
      const loc = await get(`location?session_key=${sel}&driver_number=${cmp.a}${win(la)}`);
      cmpData = { k:sel, a:cmp.a, b:cmp.b, ta:trace(ca), tb:trace(cb), loc, la, lb };
      drawCmp(d, cmpData);
    } catch (e) { box.innerHTML = errBox(e.message); }
    busy = false;
  }
  // distancia recorrida integrando la velocidad
  function trace(cd) {
    let dist = 0, prev = null; const out = [];
    for (const p of cd) { const t = Date.parse(p.date); if (prev) dist += (p.speed + prev.speed) / 2 / 3.6 * (t - prev.t) / 1000; prev = { t, speed:p.speed }; out.push({ t, d:dist, v:p.speed, th:p.throttle, br:p.brake > 0 ? 100 : 0, g:p.n_gear }); }
    return out;
  }
  const at = (tr, key, d) => { let lo = 0, hi = tr.length - 1; while (hi - lo > 1) { const m = (lo + hi) >> 1; tr[m].d < d ? lo = m : hi = m; } return tr[Math.abs(tr[lo].d - d) < Math.abs(tr[hi].d - d) ? lo : hi][key]; };
  function drawCmp(d, c) {
    const box = $('f1Cmp'); if (!box || !c.ta.length || !c.tb.length) { if (box) box.innerHTML = '<div class="empty">OpenF1 no tiene telemetría de esa vuelta.</div>'; return; }
    const A = d.D.get(c.a), B = d.D.get(c.b), same = A.team_name === B.team_name;
    const sA = { name:A.name_acronym, color:col(A) }, sB = { name:B.name_acronym, color:col(B), dash:same };
    const diff = c.lb.lap_duration - c.la.lap_duration;
    box.innerHTML = `<p style="margin:8px 0"><b>${esc(A.name_acronym)}</b> ${fmtLap(c.la.lap_duration)} (vuelta ${c.la.lap_number}) · <b>${esc(B.name_acronym)}</b> ${fmtLap(c.lb.lap_duration)} (vuelta ${c.lb.lap_number}) ·
        <b>${esc((diff >= 0 ? A : B).name_acronym)}</b> más rápido por ${Math.abs(diff).toFixed(3)} s</p>
      <div class="vcols"><div><div class="mut f1lbl">Velocidad (km/h)</div><div class="f1chart" id="f1V"></div>
        <div class="mut f1lbl">Acelerador (%)</div><div class="f1chart" id="f1T"></div>
        <div class="mut f1lbl">Freno</div><div class="f1chart" id="f1Br"></div></div>
      <div><div class="mut f1lbl">Circuito: quién fue más rápido en cada parte</div><div id="f1Map"></div></div></div>`;
    const fx = (x, t) => t ? Math.round(x) + ' m' : (x / 1000).toFixed(1) + ' km';
    const S2 = (key, s, tr) => ({ ...s, pts:tr.map(p => [p.d, p[key]]) });
    lineChart($('f1V'), [S2('v', sA, c.ta), S2('v', sB, c.tb)], { h:220, fx, fy:(y, t) => Math.round(y) + (t ? ' km/h' : '') });
    lineChart($('f1T'), [S2('th', sA, c.ta), S2('th', sB, c.tb)], { h:120, y0:0, y1:100, fx, fy:(y, t) => Math.round(y) + (t ? '%' : '') });
    lineChart($('f1Br'), [S2('br', sA, c.ta), S2('br', sB, c.tb)], { h:80, y0:0, y1:100, fx, fy:(y, t) => t ? (y > 50 ? 'frena' : '—') : '' });
    trackMap(c, sA, sB);
  }
  function trackMap(c, sA, sB) {
    const box = $('f1Map'), L = c.loc.filter(p => p.x || p.y);
    if (L.length < 20) { box.innerHTML = '<div class="empty">Sin datos de posición en pista.</div>'; return; }
    const xs = L.map(p => p.x), ys = L.map(p => p.y), x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys);
    const sc = 340 / Math.max(x1 - x0, y1 - y0), H = (y1 - y0) * sc + 20, Wm = (x1 - x0) * sc + 20;
    const P = p => [(10 + (p.x - x0) * sc).toFixed(1), (H - 10 - (p.y - y0) * sc).toFixed(1)];
    const ta = c.ta, tt0 = ta[0].t;
    const distAt = t => { let b = ta[0]; for (const p of ta) { if (p.t > t) break; b = p; } return b.d; };
    // cada tramo se pinta del color del que iba más rápido en ese punto de la vuelta
    const segs = []; let run = null;
    L.forEach(p => { const t = Date.parse(p.date); if (t < tt0) return; const dd = distAt(t), who = at(c.ta, 'v', dd) >= at(c.tb, 'v', dd) ? 'a' : 'b';
      if (!run || run.who !== who) { if (run) run.pts.push(P(p)); run = { who, pts:[P(p)] }; segs.push(run); } else run.pts.push(P(p)); });
    const pctA = Math.round(segs.filter(s => s.who === 'a').reduce((n, s) => n + s.pts.length, 0) / Math.max(1, segs.reduce((n, s) => n + s.pts.length, 0)) * 100);
    box.innerHTML = `<svg viewBox="0 0 ${Wm} ${H}" class="f1map">${segs.map(s => `<polyline fill="none" stroke="${s.who === 'a' ? sA.color : sB.color}" ${s.who === 'b' && sB.dash ? 'stroke-dasharray="6 4"' : ''} stroke-width="6" stroke-linecap="round" stroke-linejoin="round" points="${s.pts.map(q => q.join(',')).join(' ')}"/>`).join('')}
      <circle cx="${P(L[0])[0]}" cy="${P(L[0])[1]}" r="6" fill="#fff"/></svg>
      <div class="f1leg"><span><i style="border-top:4px solid ${sA.color}"></i>${esc(sA.name)} más rápido (${pctA}%)</span><span><i style="border-top:4px ${sB.dash ? 'dashed' : 'solid'} ${sB.color}"></i>${esc(sB.name)} más rápido (${100 - pctA}%)</span><span>⚪ largada</span></div>`;
  }

  return { mount, platformRe:F1RE };
})();
