/* =========================================================
   Estadísticas de uso + FUNVS Wrapped trimestral
   Cada dispositivo suma lo suyo (db.stats[dispositivo][trimestre]) y el Wrapped junta todos.
   ========================================================= */
const Stats = (() => {
  const TICK = 30;                       // segundos
  let dirty = false, lastSave = Date.now();
  const qKey = (d = new Date()) => d.getFullYear() + '-T' + (Math.floor(d.getMonth() / 3) + 1);
  const qName = k => { const [y, t] = k.split('-T'); return ['', '1er', '2do', '3er', '4to'][+t] + ' trimestre ' + y; };
  const qMonths = k => { const t = +k.split('-T')[1]; return [['ene', 'feb', 'mar'], ['abr', 'may', 'jun'], ['jul', 'ago', 'sep'], ['oct', 'nov', 'dic']][t - 1].join(' · '); };
  function bucket() {
    db.stats = db.stats || {};
    const me = db.stats[DEVICE] = db.stats[DEVICE] || {};
    const q = me[qKey()] = me[qKey()] || { secs:{ radio:{}, canal:{}, musica:{}, artista:{} }, days:{}, goles:[], momentos:0, carreras:0 };
    return q;
  }
  const add = (map, k, s) => { if (k) map[k] = (map[k] || 0) + s; };

  // cada 30 s: si algo está sonando de verdad, suma ese tiempo
  function tick() {
    const id = AudioMgr.active, s = id && AudioMgr.sink(id);
    const today = new Date().toISOString().slice(0, 10);
    const q = bucket();
    if (!q.days[today] && !document.hidden) { q.days[today] = 1; dirty = true; }
    if (!s || !s.label || !s.label()) return;
    let paused = false, muted = false; try { paused = s.paused ? s.paused() : false; muted = s.muted ? s.muted() : false; } catch {}
    if (paused || muted) return;
    if (id === 'radio') add(q.secs.radio, s.label(), TICK);
    else if (id === 'music') { add(q.secs.musica, s.label(), TICK); add(q.secs.artista, Musica.track && Musica.track.by, TICK); }
    else add(q.secs.canal, s.label().replace(/ \(ventana flotante\)$/, ''), TICK);
    dirty = true;
    if (Date.now() - lastSave > 10 * 60e3) flush();
  }
  function flush() { if (dirty) { dirty = false; lastSave = Date.now(); save(); } }
  function bump(k, val) {
    const q = bucket();
    if (k === 'gol') q.goles.push(val); else q[k] = (q[k] || 0) + 1;
    dirty = true;
  }

  /* ---------- Juntar todos los dispositivos ---------- */
  function merged(k) {
    const out = { secs:{ radio:{}, canal:{}, musica:{}, artista:{} }, days:{}, goles:[], momentos:0, carreras:0 };
    Object.values(db.stats || {}).forEach(dev => {
      const q = dev[k]; if (!q) return;
      Object.keys(out.secs).forEach(t => Object.entries(q.secs?.[t] || {}).forEach(([n, s]) => add(out.secs[t], n, s)));
      Object.assign(out.days, q.days || {});
      (q.goles || []).forEach(g => { if (!out.goles.some(x => x.id === g.id)) out.goles.push(g); });
      out.momentos += q.momentos || 0; out.carreras += q.carreras || 0;
    });
    return out;
  }
  const top = (map, n = 5) => Object.entries(map).sort((a, b) => b[1] - a[1]).slice(0, n);
  const hrs = s => s >= 3600 ? (s / 3600).toFixed(s >= 36000 ? 0 : 1).replace('.', ',') + ' h' : Math.round(s / 60) + ' min';
  const sum = map => Object.values(map).reduce((a, b) => a + b, 0);
  function quarters() {
    const ks = new Set([qKey()]);
    Object.values(db.stats || {}).forEach(dev => Object.keys(dev).forEach(k => ks.add(k)));
    return [...ks].sort().reverse();
  }
  // prode del trimestre: los meses que caen dentro
  function prodeQ(k) {
    const [y, t] = k.split('-T'); const ms = [1, 2, 3].map(i => y + '-' + String((t - 1) * 3 + i).padStart(2, '0'));
    const M = Prode.months(); let pts = 0, best = null;
    ms.forEach(m => { const v = Prode.monthTotal(m); pts += v; if (M[m] && (!best || v > best[1])) best = [m, v]; });
    return { pts, best, exact:ms.reduce((a, m) => a + (M[m]?.exact || 0), 0), goals:ms.reduce((a, m) => a + (M[m]?.goals || 0), 0) };
  }

  /* ---------- Pantalla ---------- */
  let sel = null;
  function slides(k) {
    const d = merged(k), P = prodeQ(k);
    const tot = sum(d.secs.radio) + sum(d.secs.canal) + sum(d.secs.musica);
    const out = [{ big:'FUNVS', sub:'WRAPPED', txt:qName(k) + ' · ' + qMonths(k), cls:'s0' }];
    out.push({ kicker:'Le diste play a FUNVS', big:hrs(tot), txt:`en ${Object.keys(d.days).length} días distintos`, cls:'s1' });
    const tr = top(d.secs.radio, 3); if (tr.length) out.push({ kicker:'Tu radio', big:tr[0][0], txt:hrs(tr[0][1]) + ' sintonizada' + (tr[1] ? ` · después: ${tr.slice(1).map(x => x[0]).join(', ')}` : ''), cls:'s2' });
    const tc = top(d.secs.canal, 3); if (tc.length) out.push({ kicker:'Tu canal', big:tc[0][0], txt:hrs(tc[0][1]) + ' mirando' + (tc[1] ? ` · después: ${tc.slice(1).map(x => x[0]).join(', ')}` : ''), cls:'s3' });
    const ta = top(d.secs.artista, 3), tm = top(d.secs.musica, 1);
    if (ta.length) out.push({ kicker:'Tu artista', big:ta[0][0], txt:(tm.length ? `Tu tema: “${tm[0][0]}”` : '') + (ta[1] ? ` · también: ${ta.slice(1).map(x => x[0]).join(', ')}` : ''), cls:'s4' });
    if (d.goles.length) out.push({ kicker:'Goles de tus equipos que viviste en vivo', big:String(d.goles.length), txt:d.goles.slice(-3).map(g => g.line).join(' · '), cls:'s5' });
    if (P.pts) out.push({ kicker:'Prode + Llave de gol', big:P.pts + ' pts', txt:`${P.exact} resultados exactos · ${P.goals} goleadores acertados${P.best ? ` · tu mejor mes: ${P.best[0].slice(5)}/${P.best[0].slice(0, 4)} (${P.best[1]})` : ''}`, cls:'s6' });
    if (d.momentos) out.push({ kicker:'Momentos guardados', big:String(d.momentos), txt:'⭐ cosas que no te quisiste olvidar', cls:'s7' });
    out.push({ big:'Gracias por darle play', sub:'FUNVS', txt:'Nos vemos el próximo trimestre', cls:'s0' });
    return out;
  }
  function render() {
    const v = $('v-wrapped'), qs = quarters();
    sel = sel && qs.includes(sel) ? sel : qs[0];
    const d = merged(sel), P = prodeQ(sel), tot = sum(d.secs.radio) + sum(d.secs.canal) + sum(d.secs.musica);
    const list = (map, n) => { const t = top(map, n); return t.length ? `<ol class="wlist">${t.map(([k, s]) => `<li><span>${esc(k)}</span><b>${hrs(s)}</b></li>`).join('')}</ol>` : '<div class="mut" style="font-size:13px">Todavía nada.</div>'; };
    const isCur = sel === qKey();
    v.innerHTML = `
      <div class="subbar"><div class="tabs">${qs.map(k => `<button data-q="${k}" class="${k === sel ? 'on' : ''}">${esc(qName(k))}</button>`).join('')}</div>
        <button class="pri" id="wPlay">▶ Ver mi Wrapped</button></div>
      <div class="whero"><div class="wlogo"><span class="f">FUN</span><span class="v">VS</span></div><div><b>WRAPPED</b><div>${esc(qName(sel))} · ${esc(qMonths(sel))}${isCur ? ' · <i>en curso</i>' : ''}</div></div></div>
      <div class="wgrid">
        <div class="wcard"><div class="wk">Tiempo total</div><div class="wn">${hrs(tot)}</div><div class="mut">${Object.keys(d.days).length} días usando FUNVS</div></div>
        <div class="wcard"><div class="wk">Prode + Llave</div><div class="wn">${P.pts} pts</div><div class="mut">${P.exact} exacto${P.exact === 1 ? "" : "s"} · ${P.goals} goleador${P.goals === 1 ? "" : "es"}</div></div>
        <div class="wcard"><div class="wk">Goles vividos en vivo</div><div class="wn">${d.goles.length}</div><div class="mut">de tus equipos favoritos</div></div>
        <div class="wcard"><div class="wk">Momentos guardados</div><div class="wn">${d.momentos}</div><div class="mut">⭐</div></div>
        <div class="wcard"><div class="wk">📻 Radios</div>${list(d.secs.radio, 5)}</div>
        <div class="wcard"><div class="wk">📺 Canales</div>${list(d.secs.canal, 5)}</div>
        <div class="wcard"><div class="wk">🎵 Artistas</div>${list(d.secs.artista, 5)}</div>
        <div class="wcard"><div class="wk">🎶 Temas</div>${list(d.secs.musica, 5)}</div>
      </div>
      <p class="mut" style="font-size:12px;margin-top:12px">Se cuenta el tiempo en que algo suena de verdad (sin pausa ni silencio), sumando todos tus dispositivos sincronizados. Los datos son solo tuyos.</p>`;
    v.querySelector('.tabs').onclick = e => { const b = e.target.closest('[data-q]'); if (b) { sel = b.dataset.q; render(); } };
    $('wPlay').onclick = () => story(sel);
  }
  // modo historia: pantallas grandes que pasan solas
  function story(k) {
    const sl = slides(k); let i = 0, timer;
    const o = document.createElement('div'); o.className = 'wstory';
    o.innerHTML = `<div class="wbars">${sl.map(() => '<i><b></b></i>').join('')}</div><div class="wslide"></div><button class="wx">✕</button><div class="wnav"><span data-d="-1"></span><span data-d="1"></span></div>`;
    document.body.appendChild(o);
    const show = () => {
      const s = sl[i];
      o.querySelector('.wslide').className = 'wslide ' + s.cls;
      o.querySelector('.wslide').innerHTML = `${s.kicker ? `<div class="wk">${esc(s.kicker)}</div>` : ''}<div class="wbig">${esc(s.big)}</div>${s.sub ? `<div class="wsub">${esc(s.sub)}</div>` : ''}${s.txt ? `<div class="wtxt">${esc(s.txt)}</div>` : ''}`;
      o.querySelectorAll('.wbars i').forEach((b, j) => b.className = j < i ? 'done' : j === i ? 'now' : '');
      clearTimeout(timer); timer = setTimeout(() => go(1), 5500);
    };
    const go = d => { i += d; if (i >= sl.length) return close(); if (i < 0) i = 0; show(); };
    const close = () => { clearTimeout(timer); o.remove(); document.removeEventListener('keydown', key); };
    const key = e => { if (e.key === 'Escape') close(); if (e.key === 'ArrowRight') go(1); if (e.key === 'ArrowLeft') go(-1); };
    o.querySelector('.wx').onclick = close;
    o.querySelectorAll('.wnav span').forEach(s => s.onclick = () => go(+s.dataset.d));
    document.addEventListener('keydown', key);
    show();
  }
  function init() {
    setInterval(tick, TICK * 1000);
    document.addEventListener('visibilitychange', () => { if (document.hidden) flush(); });
    window.addEventListener('pagehide', flush);
    onChange(() => { if (Nav.current === 'wrapped') render(); });
  }
  return { init, render, bump, flush };
})();
