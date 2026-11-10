/* =========================================================
   🐶 Paseo de Vaca: antes de salir te dice cómo está el tiempo (lluvia, calor, frío) y qué llevar,
   pone un canal en vivo en SOLO AUDIO (con el título del vivo) y cuenta el paseo (~1 hora).
   Al volver tocás "Volví": queda anotado (cuánto duró, el clima y, si lo medís con el celu, los km).
   Se sincroniza: db.paseos (los últimos 200) y db.vaca (hora habitual del paseo y qué llevar).
   ========================================================= */
const Paseo = (() => {
  const MG = [-34.8157, -58.4687];
  const LLEVAR = ['🛍️ Bolsitas para la caca', '🦴 2 snacks', '💧 Agua', '🥣 Plato'];
  const cfg = () => (db.vaca = db.vaca || { hora:'', llevar:LLEVAR });
  const list = () => (db.paseos = db.paseos || []);
  let cur = S.get('paseoCur', null), wx = null, wxAt = 0, geoId = null, tick = null;

  /* ---------- ⛅ el tiempo para el paseo (los 3 modelos, como el resto de FUNVS) ---------- */
  async function clima() {
    if (wx && Date.now() - wxAt < 15 * 60e3) return wx;
    try {
      const j = await meteo({ latitude:MG[0], longitude:MG[1], current:'temperature_2m,apparent_temperature,weather_code,is_day', hourly:'temperature_2m,precipitation_probability,weather_code', timezone:'America/Argentina/Buenos_Aires', forecast_days:2 });
      const now = Date.now(), H = j.hourly.time.map((t, i) => ({ t:Date.parse(t + ':00-03:00'), T:j.hourly.temperature_2m[i], p:j.hourly.precipitation_probability[i] ?? 0, c:j.hourly.weather_code[i] })).filter(h => h.t > now - 3600e3);
      wx = { T:Math.round(j.current.temperature_2m), F:Math.round(j.current.apparent_temperature ?? j.current.temperature_2m), c:j.current.weather_code, H }; wxAt = now;
    } catch { wx = null; }
    return wx;
  }
  const hm = t => new Date(t).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  // consejo "inteligente": lluvia ahora o en la próxima hora y media, calor (asfalto caliente), frío, y la mejor hora de hoy
  function consejo(w) {
    if (!w) return { ok:true, txt:'No pude ver el clima ahora.', ic:'🐶' };
    const next = w.H.filter(h => h.t <= Date.now() + 2 * 3600e3), lluviaYa = w.c >= 51, pmax = Math.max(0, ...next.map(h => h.p));
    const out = []; let ok = true, ic = '🐶';
    if (lluviaYa) { ok = false; ic = '🌧'; const seca = w.H.find(h => h.t > Date.now() && h.p < 30 && h.c < 51); out.push(`Está lloviendo.${seca ? ` Debería parar a eso de las ${hm(seca.t)}.` : ''}`); }
    else if (pmax >= 50) { ic = '☔'; const h = next.find(x => x.p >= 50); out.push(`Puede llover a las ${hm(h.t)} (${h.p}%): mejor salir ya o llevar piloto.`); }
    if (w.F >= 30) { ok = false; ic = '🥵'; out.push(`Hace ${w.T}° (se sienten ${w.F}°): el asfalto le quema las patitas. Mejor por la sombra o el pasto, más tarde, y agua extra.`); }
    else if (w.F >= 26) { ic = ic === '🐶' ? '☀️' : ic; out.push(`Hace calor (${w.T}°): llevá agua de más.`); }
    else if (w.F <= 5) { ic = '🥶'; out.push(`Hace frío (${w.T}°, se sienten ${w.F}°): abrigate.`); }
    if (!out.length) out.push(`${w.T}°, lindo para salir.`);
    // la mejor hora de las próximas 10 (sin lluvia, temperatura cómoda, de 7 a 22)
    const cand = w.H.filter(h => h.t > Date.now() && h.t < Date.now() + 10 * 3600e3 && new Date(h.t).getHours() >= 7 && new Date(h.t).getHours() <= 22)
      .map(h => ({ ...h, score:h.p + Math.abs(h.T - 19) * 3 + (h.c >= 51 ? 100 : 0) })).sort((a, b) => a.score - b.score)[0];
    const ahora = pmax + Math.abs(w.F - 19) * 3 + (lluviaYa ? 100 : 0);   // solo sugiero otra hora si de verdad es mejor
    const mejor = !ok && cand && cand.score + 15 < ahora ? `La mejor hora hoy: <b>${hm(cand.t)}</b> (${Math.round(cand.T)}°, ${cand.p}% de lluvia).` : '';
    return { ok, ic, txt:out.join(' '), mejor };
  }

  /* ---------- Salir ---------- */
  function open() {
    let d = $('dlgPaseo'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgPaseo'; d.className = 'setdlg'; document.body.appendChild(d); }
    const live = db.chans.filter(c => Canales.isLive(c)).sort((a, b) => (+a.num || 999) - (+b.num || 999));
    const L = cfg().llevar?.length ? cfg().llevar : LLEVAR;
    d.innerHTML = `<h3>🐶 Paseo de Vaca</h3>
      <div class="pswx" id="psWx">Mirando el clima…</div>
      <h4>Llevá</h4><div class="pslist">${L.map((x, i) => `<label><input type="checkbox" data-ll="${i}" style="width:auto"> ${esc(x)}</label>`).join('')}</div>
      <h4>🎧 Qué escuchar (solo audio)</h4>
      <div class="pscan">${live.length ? live.map(c => `<button data-pc="${esc(c.uid)}"><b>${esc(Canales.numTxt(c))} ${esc(c.name)}</b><small>${esc(Canales.status[c.uid]?.title || '')}</small></button>`).join('') : '<p class="mut">No hay canales en vivo ahora.</p>'}
        ${Radio.current ? `<button data-pc="radio"><b>📻 ${esc(Radio.current.name)}</b><small>la radio que venías escuchando</small></button>` : ''}
        <button data-pc=""><b>🔇 Nada</b><small>solo el paseo</small></button></div>
      ${navigator.geolocation ? `<label style="display:flex;gap:6px;align-items:center;margin-top:8px"><input type="checkbox" id="psGeo" style="width:auto" ${S.get('paseoGeo', false) ? 'checked' : ''}> 📍 Medir los km con el celu <small class="mut">(solo la distancia, no se guarda el recorrido; anda mientras FUNVS esté abierto)</small></label>` : ''}
      <div class="btns"><button data-close>Cancelar</button><span class="sp"></span><button class="pri" id="psGo">🐾 Salir</button></div>`;
    let pick = live[0]?.uid ?? '';
    const paint = () => d.querySelectorAll('[data-pc]').forEach(b => b.classList.toggle('on', b.dataset.pc === pick));
    d.querySelectorAll('[data-pc]').forEach(b => b.onclick = () => { pick = b.dataset.pc; paint(); }); paint();
    d.querySelector('[data-close]').onclick = () => d.close();
    $('psGo').onclick = () => {
      const faltan = [...d.querySelectorAll('[data-ll]')].filter(x => !x.checked).map(x => L[+x.dataset.ll]);
      if (faltan.length && !confirm(`¿Seguro? Te falta:\n${faltan.join('\n')}`)) return;
      if ($('psGeo')) S.set('paseoGeo', $('psGeo').checked);
      d.close(); start(pick);
    };
    d.showModal();
    clima().then(w => { const k = consejo(w); $('psWx').innerHTML = `<span class="psic">${k.ic}</span><div>${k.txt}${k.mejor ? `<br><small>${k.mejor}</small>` : ''}</div>`; $('psWx').classList.toggle('mal', !k.ok); });
  }
  function start(pick) {
    const w = wx;
    cur = { s:Date.now(), T:w?.T ?? null, c:w?.c ?? null, km:0, last:null }; S.set('paseoCur', cur);
    if (pick === 'radio') { /* sigue la radio */ }
    else if (pick) { const c = db.chans.find(x => x.uid === pick); if (c) { try { TV.close(); } catch {} Player.play(c, { audio:true }); } }
    if (S.get('paseoGeo', false) && navigator.geolocation) geo(true);
    run(); toast('<b>🐾 ¡A pasear!</b><small>Cuando vuelvas tocá "Volví".</small>', { cls:'info', ms:4000 });
  }
  // distancia: solo voy sumando metros (no guardo dónde estuviste)
  function geo(on) {
    if (!on) { if (geoId != null) navigator.geolocation.clearWatch(geoId); geoId = null; return; }
    const R = 6371e3, rad = x => x * Math.PI / 180;
    geoId = navigator.geolocation.watchPosition(p => {
      if (!cur || p.coords.accuracy > 40) return;
      const q = [p.coords.latitude, p.coords.longitude];
      if (cur.last) { const [a, b] = cur.last, dl = rad(q[0] - a), dn = rad(q[1] - b), h = Math.sin(dl / 2) ** 2 + Math.cos(rad(a)) * Math.cos(rad(q[0])) * Math.sin(dn / 2) ** 2, m = 2 * R * Math.asin(Math.sqrt(h));
        if (m > 4 && m < 200) cur.km += m / 1000; }
      cur.last = q; S.set('paseoCur', { ...cur, last:null });
    }, () => {}, { enableHighAccuracy:true, maximumAge:5000 });
  }
  function run() {
    document.body.classList.toggle('paseando', !!cur);
    let el = $('psBar');
    if (!cur) { el?.remove(); clearInterval(tick); tick = null; return; }
    if (!el) { el = document.createElement('div'); el.id = 'psBar'; document.body.appendChild(el); el.onclick = e => { if (e.target.closest('[data-volvi]')) end(); }; }
    const paint = () => { if (!cur) return; const m = Math.floor((Date.now() - cur.s) / 60e3);
      el.innerHTML = `<span>🐶 De paseo · <b>${m} min</b>${cur.km ? ` · ${cur.km.toFixed(1)} km` : ''}</span><button data-volvi>🏠 Volví</button>`;
      if (m === 60 && !cur.avisado) { cur.avisado = 1; S.set('paseoCur', { ...cur, last:null }); toast('<b>🐶 Ya va una hora de paseo</b><small>Cuando llegues, tocá "Volví".</small>', { cls:'info', ms:6000 }); }
      if (m >= 180) end(true); };   // si te olvidaste de tocar "Volví", a las 3 h lo cierro solo
    paint(); clearInterval(tick); tick = setInterval(paint, 30e3);
  }
  function end(auto) {
    if (!cur) return;
    const min = Math.max(1, Math.round((Math.min(Date.now(), cur.s + 3 * 3600e3) - cur.s) / 60e3));
    list().unshift({ s:cur.s, min, km:Math.round(cur.km * 10) / 10, T:cur.T, c:cur.c, auto:!!auto }); db.paseos = list().slice(0, 200); save();
    geo(false); cur = null; S.set('paseoCur', null); run();
    if (Player.slots.some(s => s?.audio)) Player.closeAll();
    toast(`<b>🏠 ¡Bienvenidos!</b><small>Paseo de ${min} min${list()[0].km ? ` · ${list()[0].km} km` : ''}. Agua para Vaca 💧</small>`, { cls:'info', ms:6000 });
    if (Nav.current === 'paseo') render();
  }

  /* ---------- 📊 la sección: historial, semana, hora habitual y qué llevar ---------- */
  const WX = c => c == null ? '' : c >= 51 ? '🌧' : c >= 45 ? '🌫' : c >= 3 ? '☁️' : c >= 1 ? '🌤' : '☀️';
  function render() {
    const v = $('v-paseo'); if (!v) return;
    const P = list(), wk = Date.now() - 7 * 864e5, sem = P.filter(p => p.s > wk);
    const tot = sem.reduce((a, p) => a + p.min, 0), km = sem.reduce((a, p) => a + (p.km || 0), 0);
    const dias = new Set(sem.map(p => new Date(p.s).toDateString())).size;
    v.innerHTML = `<div class="porhero"><div class="porlogo"><img src="img/vaca.jpg" alt="" style="width:100%;height:100%;border-radius:50%;object-fit:cover"></div><div><h2>Paseos de Vaca</h2>
        <p>${cur ? `Están de paseo hace ${Math.floor((Date.now() - cur.s) / 60e3)} min.` : 'Antes de salir te digo cómo está el tiempo y qué llevar, y te pongo un canal en solo audio.'}</p>
        <div class="btns">${cur ? '<button class="pri" id="psEnd">🏠 Volví</button>' : '<button class="pri" id="psOpen">🐾 Salir de paseo</button>'}</div></div></div>
      <div class="psstats"><div><b>${sem.length}</b><small>paseos en 7 días</small></div><div><b>${dias}/7</b><small>días que salió</small></div><div><b>${Math.round(tot / 60 * 10) / 10} h</b><small>caminando</small></div>${km ? `<div><b>${km.toFixed(1)}</b><small>km medidos</small></div>` : ''}</div>
      <h2 class="sec">Últimos paseos</h2>
      <div class="tdlist">${P.slice(0, 15).map(p => { const d = new Date(p.s); return `<div class="tdrow"><div><b>${d.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'numeric' })} · ${hm(p.s)}</b><small>${p.min} min${p.km ? ` · ${p.km} km` : ''}${p.T != null ? ` · ${WX(p.c)} ${p.T}°` : ''}${p.auto ? ' · (se cerró solo)' : ''}</small></div></div>`; }).join('') || '<div class="empty">Todavía no hay paseos anotados.</div>'}</div>
      <h2 class="sec">Ajustes del paseo</h2>
      <div class="box"><label>⏰ Hora habitual del paseo <small class="mut">(20 min antes te aviso con el clima; vacío = sin aviso)</small></label><input type="time" id="psHora" value="${esc(cfg().hora || '')}" style="width:auto">
        <label style="margin-top:8px">🎒 Qué llevar <small class="mut">(uno por renglón)</small></label><textarea id="psLlevar" rows="4" style="width:100%">${esc((cfg().llevar || LLEVAR).join('\n'))}</textarea>
        <div class="btns"><span class="sp"></span><button class="pri" id="psSave">Guardar cambios</button></div></div>
      <p class="mut" style="font-size:12px">Sobre Google Maps y Google Fit: la Cronología de Maps ahora se guarda solo en tu celu (Google no deja que otras apps la lean) y Google anunció el cierre de las conexiones de Fit para apps de afuera, así que FUNVS anota los paseos por su cuenta.</p>`;
    $('psOpen') && ($('psOpen').onclick = open); $('psEnd') && ($('psEnd').onclick = () => end());
    $('psSave').onclick = () => { const c = cfg(); c.hora = $('psHora').value; c.llevar = $('psLlevar').value.split('\n').map(x => x.trim()).filter(Boolean); if (!c.llevar.length) c.llevar = LLEVAR; save(); toast('🐶 Guardado', { ms:1500 }); };
  }
  /* ⏰ 20 min antes de la hora habitual: aviso con el clima */
  let avisoDia = S.get('paseoAviso', '');
  async function recordar() {
    const h = cfg().hora; if (!h || cur || document.hidden) return;
    const [hh, mm] = h.split(':').map(Number), t = new Date(); t.setHours(hh, mm, 0, 0);
    const d = t - Date.now(), k = new Date().toDateString(); if (d > 20 * 60e3 || d < -10 * 60e3 || avisoDia === k) return;
    avisoDia = k; S.set('paseoAviso', k);
    const kk = consejo(await clima());
    toast(`<b>${kk.ic} Paseo de Vaca a las ${esc(h)}</b><small>${kk.txt}${kk.mejor ? ' ' + kk.mejor.replace(/<[^>]+>/g, '') : ''}</small>`, { cls:'info', ms:14000, onclick:open });
  }
  // en Ahora: el botón, con el consejo del momento
  Inicio.add({ id:'paseo', order:8, html() {
    if (cur) return `<div class="psnow"><span>🐶 De paseo hace <b>${Math.floor((Date.now() - cur.s) / 60e3)} min</b></span><button class="pri" data-psend>🏠 Volví</button></div>`;
    const k = wx ? consejo(wx) : null; if (!wx) clima().then(w => { if (w && Nav.current === 'inicio' && !document.body.classList.contains('tvlock')) Inicio.render(); });
    return `<div class="psnow"><span>${k ? k.ic : '🐶'} <b>Paseo de Vaca</b>${k ? `<small>${esc(k.txt)}</small>` : ''}</span><button data-psopen>🐾 Salir</button></div>`; },
    bind(el) { el.querySelector('[data-psopen]')?.addEventListener('click', open); el.querySelector('[data-psend]')?.addEventListener('click', () => end()); } });
  function init() {
    if (cur) { run(); if (S.get('paseoGeo', false)) geo(true); }
    setInterval(recordar, 60e3);
  }
  return { init, render, open, end, get on() { return !!cur; }, get since() { return cur?.s; } };
})();

/* =========================================================
   🎂 Fechas: cumpleaños y fechas tuyas, cargadas a mano. Ese día a la mañana aparece en la barra
   (y la noche anterior en "Mañana"). Nada se guarda hasta "Guardar cambios".
   ========================================================= */
const Fechas = (() => {
  const TIPOS = { cumple:'🎂 Cumpleaños', aniv:'💍 Aniversario', otra:'📌 Otra' };
  const L = () => (db.fechas = db.fechas || []);
  let work = null;
  const hoyDe = (f, d = new Date()) => +f.d === d.getDate() && +f.m === d.getMonth() + 1;
  const txt = (f, y = new Date().getFullYear()) => f.t === 'cumple' ? `🎂 Hoy cumple ${f.n}${f.y ? ` (${y - f.y})` : ''}` : f.t === 'aniv' ? `💍 Aniversario: ${f.n}${f.y ? ` (${y - f.y} años)` : ''}` : `📌 ${f.n}`;
  function render() {
    const v = $('v-fechas'); if (!v) return;
    if (!work) work = L().map(f => ({ ...f }));
    const M = ['ene', 'feb', 'mar', 'abr', 'may', 'jun', 'jul', 'ago', 'sep', 'oct', 'nov', 'dic'];
    const ord = work.map((f, i) => ({ f, i })).sort((a, b) => (a.f.m - b.f.m) || (a.f.d - b.f.d));
    v.innerHTML = `<div class="porhero"><div class="porlogo">🎂</div><div><h2>Fechas</h2><p>Cumpleaños y fechas importantes. Ese día a la mañana te aparece en la barra, y la noche anterior en "Mañana".</p></div></div>
      <div class="box"><div class="fclist">${ord.map(({ f, i }) => `<div class="fcrow" data-i="${i}">
          <input data-k="n" value="${esc(f.n || '')}" placeholder="Nombre">
          <select data-k="d">${Array.from({ length:31 }, (_, k) => `<option ${+f.d === k + 1 ? 'selected' : ''}>${k + 1}</option>`).join('')}</select>
          <select data-k="m">${M.map((x, k) => `<option value="${k + 1}" ${+f.m === k + 1 ? 'selected' : ''}>${x}</option>`).join('')}</select>
          <input data-k="y" value="${esc(f.y || '')}" placeholder="Año (opc.)" inputmode="numeric" style="width:90px">
          <select data-k="t">${Object.entries(TIPOS).map(([k, x]) => `<option value="${k}" ${f.t === k ? 'selected' : ''}>${x}</option>`).join('')}</select>
          <button data-del title="Borrar">✕</button></div>`).join('') || '<div class="empty">Todavía no cargaste ninguna fecha.</div>'}</div>
        <div class="btns"><button id="fcAdd">＋ Agregar fecha</button><span class="sp"></span><span class="mut" id="fcDirty"></span><button id="fcUndo">Descartar</button><button class="pri" id="fcSave">Guardar cambios</button></div></div>`;
    const dirty = () => { $('fcDirty').textContent = JSON.stringify(work) !== JSON.stringify(L()) ? 'Hay cambios sin guardar' : ''; };
    v.querySelectorAll('.fcrow').forEach(r => { const f = work[+r.dataset.i];
      r.querySelectorAll('[data-k]').forEach(x => x.oninput = x.onchange = () => { f[x.dataset.k] = x.dataset.k === 'n' ? x.value : x.dataset.k === 't' ? x.value : x.value ? +x.value || '' : ''; dirty(); });
      r.querySelector('[data-del]').onclick = () => { work.splice(+r.dataset.i, 1); render(); }; });
    $('fcAdd').onclick = () => { const n = new Date(); work.push({ n:'', d:n.getDate(), m:n.getMonth() + 1, y:'', t:'cumple' }); render(); v.querySelector('.fcrow:last-child input')?.focus(); };
    $('fcUndo').onclick = () => { work = null; render(); };
    $('fcSave').onclick = () => { db.fechas = work.filter(f => (f.n || '').trim()).map(f => ({ ...f, n:f.n.trim() })); save(); work = null; render(); toast('🎂 Fechas guardadas', { ms:2000 }); };
    dirty();
  }
  let shown = S.get('fechaShown', '');
  function check() {
    const n = new Date(), k = n.toDateString(); if (n.getHours() < 8 || shown === k || document.hidden) return;
    const hoy = L().filter(f => hoyDe(f)); if (!hoy.length) { shown = k; return; }
    shown = k; S.set('fechaShown', k);
    toast(`<b>${hoy.map(f => esc(txt(f))).join(' · ')}</b>`, { cls:'info', ms:12000, onclick:() => Nav.go('fechas') });
  }
  const manana = () => { const t = new Date(); t.setDate(t.getDate() + 1); return L().filter(f => hoyDe(f, t)).map(f => txt(f, t.getFullYear()).replace(/^(\S+) Hoy /, '$1 Mañana ')); };
  Inicio.add({ id:'fechas', order:6, html() { const h = L().filter(f => hoyDe(f)); return h.length ? `<div class="psnow"><span><b>${h.map(f => esc(txt(f))).join(' · ')}</b></span></div>` : ''; } });
  function init() { setInterval(check, 60e3); setTimeout(check, 8000); }
  return { init, render, manana };
})();
