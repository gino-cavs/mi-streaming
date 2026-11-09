/* =========================================================
   🕰️ Franjas del día: madrugada · mañana · mediodía · tarde · noche.
   FUNVS se acomoda a cada una: qué aparece primero en Ahora, el saludo y lo que te sugiere.
   ========================================================= */
const Franja = (() => {
  const F = [
    { id:'madrugada', n:'Madrugada', ic:'🌌', from:0 },
    { id:'manana', n:'Mañana', ic:'🌅', from:6 },
    { id:'mediodia', n:'Mediodía', ic:'☀️', from:12 },
    { id:'tarde', n:'Tarde', ic:'🌇', from:14 },
    { id:'noche', n:'Noche', ic:'🌙', from:20 },
  ];
  const now = (d = new Date()) => [...F].reverse().find(f => d.getHours() >= f.from);
  // qué va primero en Ahora según la franja (lo demás sigue en su orden de siempre)
  const ORDEN = {
    madrugada:['humor', 'dia', 'seguir', 'vivo'],
    manana:['dia', 'mg', 'avisos', 'radios', 'vivo', 'humor'],
    mediodia:['mg', 'vivo', 'dia', 'futbol', 'seguir'],
    tarde:['dia', 'vivo', 'futbol', 'seguir', 'mg', 'humor'],
    noche:['dia', 'humor', 'seguir', 'vivo', 'tanda', 'mg'],
  };
  const SUG = { madrugada:'dormir', manana:'info', mediodia:'info', tarde:'reir', noche:'cansado' };
  function order(id, base) { const l = ORDEN[now().id] || [], i = l.indexOf(id); return i >= 0 ? i : 100 + base; }
  let cur = null;
  function tick() { const f = now(); if (f.id !== cur) { document.body.classList.remove('f-' + cur); cur = f.id; document.body.classList.add('f-' + cur); try { if (Nav.current === 'inicio') Inicio.render(); } catch {} } }
  function init() { tick(); setInterval(tick, 60e3); }
  return { now, order, sug:() => SUG[now().id], init, F };
})();

/* =========================================================
   📍 MG News: Monte Grande y Esteban Echeverría. Clima completo, el Roca, cortes de luz y de tránsito,
   noticias de la zona, agenda del Municipio y efemérides de la ciudad. Lo junta GitHub cada media hora.
   En la tele, de 7 a 22, un titular de MG en la barra de abajo a horarios al azar.
   ========================================================= */
const MG = (() => {
  let data = S.get('mgData', null), wx = null, wxAt = 0;
  async function load() {
    try { const j = await (await fetch(REPO.data + 'mg.json?t=' + Math.floor(Date.now() / 600e3))).json();
      if (j?.updated) { j.noticias = (j.noticias || []).filter(i => !muted(i.t)); data = j; S.set('mgData', j); feedRoca(); } } catch {}
    return data;
  }
  // el estado del Roca le sirve a Mi día (despertador y avisos del viaje)
  function feedRoca() {
    const r = data?.trenRoca; if (!r) return;
    const fresh = r.d && Date.now() - Date.parse(r.d) < 6 * 3600e3;
    Transporte.set({ roca:fresh && r.estado === 'mal' ? '⚠️ ' + r.t : fresh && r.estado === 'ok' ? '✅ ' + r.t : '' });
  }
  const LAT = -34.8157, LON = -58.4687;
  async function clima() {
    if (wx && Date.now() - wxAt < 20 * 60e3) return wx;
    try {
      const q = new URLSearchParams({ latitude:LAT, longitude:LON, timezone:'America/Argentina/Buenos_Aires', forecast_days:'2',
        current:'temperature_2m,apparent_temperature,relative_humidity_2m,weather_code,wind_speed_10m,wind_gusts_10m',
        hourly:'temperature_2m,weather_code,precipitation_probability,relative_humidity_2m,wind_speed_10m',
        daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max,sunrise,sunset,uv_index_max' });
      wx = await (await fetch('https://api.open-meteo.com/v1/forecast?' + q)).json(); wxAt = Date.now();
    } catch {}
    return wx;
  }
  const WX = c => c === 0 ? '☀️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : c <= 48 ? '🌫️' : c <= 57 ? '🌦️' : c <= 67 ? '🌧️' : c <= 77 ? '🌨️' : c <= 82 ? '🌦️' : c <= 86 ? '🌨️' : '⛈️';
  const WXT = c => c === 0 ? 'Despejado' : c <= 2 ? 'Algo nublado' : c === 3 ? 'Nublado' : c <= 48 ? 'Niebla' : c <= 57 ? 'Llovizna' : c <= 67 ? 'Lluvia' : c <= 77 ? 'Nieve' : c <= 82 ? 'Chaparrones' : 'Tormentas';
  const hh = t => new Date(t).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  // ¿colgar la ropa? sin lluvia en las próximas 8 h, humedad razonable y algo de sol o viento
  function ropa(j) {
    const now = Date.now(), H = j.hourly.time.map((t, i) => ({ t:Date.parse(t), p:j.hourly.precipitation_probability[i], h:j.hourly.relative_humidity_2m[i], c:j.hourly.weather_code[i], w:j.hourly.wind_speed_10m[i] })).filter(x => x.t > now && x.t < now + 8 * 3600e3);
    if (!H.length) return null;
    const lluvia = H.find(x => x.p >= 40 || x.c >= 51), hum = H.reduce((a, x) => a + x.h, 0) / H.length, sol = H.filter(x => x.c <= 2).length, viento = H.reduce((a, x) => a + x.w, 0) / H.length;
    const noche = new Date().getHours() >= 18;
    if (lluvia) return `🧺 No cuelgues: puede llover a las ${hh(lluvia.t)} (${lluvia.p}%).`;
    if (noche) return '🧺 Ya es tarde para colgar; mañana te digo.';
    if (hum > 80 && sol < 2 && viento < 10) return '🧺 Se puede, pero va a tardar en secarse (mucha humedad).';
    return `🧺 ¡Colgala! ${sol >= 3 ? 'Sale el sol' : 'No llueve'}${viento >= 12 ? ' y corre viento' : ''}.`;
  }
  const ago = d => { const m = Math.round((Date.now() - Date.parse(d)) / 6e4); return m < 60 ? `hace ${m} min` : m < 1440 ? `hace ${Math.round(m / 60)} h` : `hace ${Math.round(m / 1440)} d`; };
  const efemHoy = () => { const n = new Date(), k = String(n.getMonth() + 1).padStart(2, '0') + '-' + String(n.getDate()).padStart(2, '0'); return data?.efem?.[k] || []; };

  async function render() {
    const v = $('v-mg'); if (!v) return;
    if (!data) v.innerHTML = '<div class="empty">Juntando lo de Monte Grande…</div>';
    const [d, j] = await Promise.all([load(), clima()]);
    if (!d && !j) { v.innerHTML = '<div class="empty">Todavía no hay datos de MG News. GitHub los junta cada media hora.</div>'; return; }
    const n = new Date(), r = d?.trenRoca, rFresh = r?.d && Date.now() - Date.parse(r.d) < 6 * 3600e3;
    const H = j ? j.hourly.time.map((t, i) => ({ t:Date.parse(t), T:j.hourly.temperature_2m[i], c:j.hourly.weather_code[i], p:j.hourly.precipitation_probability[i] })).filter(x => x.t > Date.now() - 36e5).slice(0, 12) : [];
    const luz = d?.luz, cortes = luz?.ok ? [...(luz.programados || []).map(x => ({ ...x, k:'programado' })), ...(luz.media || []), ...(luz.baja || []), ...(luz.preventivos || [])] : [];
    const ef = efemHoy();
    v.innerHTML = `
      <div class="mghero"><div class="mglogo">MG<span>NEWS</span></div><div><h2>Monte Grande</h2><p>${Franja.now().ic} ${Franja.now().n} · ${n.toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' })}</p></div></div>
      <div class="mggrid">
        ${j ? `<div class="mgcard mgwx"><h3>⛅ El clima</h3>
          <div class="mgnow"><span class="i">${WX(j.current.weather_code)}</span><b>${Math.round(j.current.temperature_2m)}°</b><div><span>${WXT(j.current.weather_code)}</span><small>Sensación ${Math.round(j.current.apparent_temperature)}° · 💧 ${j.current.relative_humidity_2m}% · 💨 ${Math.round(j.current.wind_speed_10m)} km/h${j.current.wind_gusts_10m > 40 ? ` (ráfagas ${Math.round(j.current.wind_gusts_10m)})` : ''}</small></div></div>
          <div class="mghrs">${H.map(x => `<div><small>${hh(x.t).slice(0, 2)}h</small><span>${WX(x.c)}</span><b>${Math.round(x.T)}°</b>${x.p >= 20 ? `<em>${x.p}%</em>` : '<em></em>'}</div>`).join('')}</div>
          <div class="mgdays">${[0, 1].map(i => `<span>${i ? 'Mañana' : 'Hoy'}: ${WX(j.daily.weather_code[i])} ${Math.round(j.daily.temperature_2m_max[i])}° / ${Math.round(j.daily.temperature_2m_min[i])}° · 💧${j.daily.precipitation_probability_max[i] ?? 0}%${!i ? ` · UV ${Math.round(j.daily.uv_index_max[0])} · 🌅 ${hh(j.daily.sunrise[0])} 🌇 ${hh(j.daily.sunset[0])}` : ''}</span>`).join('')}</div>
          ${ropa(j) ? `<p class="mgropa">${ropa(j)}</p>` : ''}</div>` : ''}
        <div class="mgcard"><h3>🚆 Tren Roca · ramal Ezeiza</h3>
          ${rFresh ? `<p class="mgroca ${r.estado}">${r.estado === 'mal' ? '⚠️' : r.estado === 'ok' ? '✅' : 'ℹ️'} ${esc(r.t)}</p><small class="mut">${esc(r.s || '')} · ${ago(r.d)}</small>`
            : '<p class="mgroca ok">✅ Sin novedades en las últimas horas</p><small class="mut">Según las noticias y los avisos de Trenes Argentinos. Si algo pasa, te aviso.</small>'}
          ${Dia.plan() === 'oficina' ? `<p class="mut" style="margin-top:8px">Tu tren: <b>${Dia.viaje(n)[0].t}</b> en Monte Grande · vuelta <b>${Dia.viaje(n)[3].t}</b> desde Constitución</p>` : ''}</div>
        <div class="mgcard"><h3>💡 Luz (Edesur)</h3>
          ${!luz?.ok ? '<p class="mut">Sin datos del ENRE ahora.</p>' : cortes.length ? `<ul class="mglist">${cortes.map(x => `<li><b>${esc(x.loc)}</b>: ${x.usuarios.toLocaleString('es-AR')} usuarios sin luz${x.k ? ' (programado)' : ''}${x.hasta && !/sin datos/i.test(x.hasta) ? ` · vuelve ${esc(x.hasta.slice(11) || x.hasta)}` : ''}</li>`).join('')}</ul>` : '<p class="mgroca ok">✅ Sin cortes en Esteban Echeverría</p>'}
          ${luz?.act ? `<small class="mut">ENRE · actualizado ${esc(luz.act)}</small>` : ''}</div>
        <div class="mgcard"><h3>🚧 Tránsito y cortes</h3>
          ${(d?.transito || []).length ? `<ul class="mglist">${d.transito.map(i => `<li><a href="${esc(i.l)}" target="_blank" rel="noopener">${esc(i.t)}</a> <small class="mut">${ago(i.d)}</small></li>`).join('')}</ul>` : '<p class="mgroca ok">✅ Nada raro en Camino de Cintura, la 205 ni la autopista</p>'}</div>
        ${ef.length ? `<div class="mgcard"><h3>📜 Un día como hoy en MG</h3>${ef.map(e => `<p><b>${e.y}</b> · ${esc(e.t)}</p>`).join('')}</div>` : ''}
        ${(d?.agenda || []).length ? `<div class="mgcard"><h3>📅 Agenda del Municipio</h3><ul class="mglist">${d.agenda.map(i => `<li><a href="${esc(i.l)}" target="_blank" rel="noopener">${esc(i.t)}</a> <small class="mut">${ago(i.d)}</small></li>`).join('')}</ul></div>` : ''}
      </div>
      <h2 class="sec">📰 Noticias de la zona</h2>
      <div class="news">${(d?.noticias || []).map(i => `<a class="nitem" href="${esc(i.l)}" target="_blank" rel="noopener"><b>${esc(i.t)}</b><span>${esc(i.s || '')} · ${ago(i.d)}</span></a>`).join('') || '<div class="empty">Sin noticias de la zona por ahora.</div>'}</div>
      <p class="mut" style="font-size:11px;margin-top:10px">Fuentes: Google Noticias, Municipio de Esteban Echeverría, ENRE, Open-Meteo, Wikipedia.</p>`;
  }

  /* 📍 en Ahora: lo justo */
  Inicio.add({ id:'mg', order:40, html() {
    if (!data) { load().then(() => { if (Nav.current === 'inicio') Inicio.render(); }); return ''; }
    const r = data.trenRoca, rFresh = r?.d && Date.now() - Date.parse(r.d) < 6 * 3600e3 && r.estado === 'mal';
    const L = data.noticias.slice(0, 3), cortes = data.luz?.ok ? [...(data.luz.media || []), ...(data.luz.baja || []), ...(data.luz.programados || [])] : [];
    return `<h2 class="sec">📍 MG News <button class="lnk" data-go="mg" style="font-size:12px;margin-left:8px">ver todo →</button></h2>
      ${rFresh ? `<p class="mgroca mal">⚠️ ${esc(r.t)}</p>` : ''}${cortes.length ? `<p class="mgroca mal">💡 Cortes de luz en ${esc([...new Set(cortes.map(x => x.loc))].join(', '))}</p>` : ''}
      <div class="news">${L.map(i => `<a class="nitem" href="${esc(i.l)}" target="_blank" rel="noopener"><b>${esc(i.t)}</b><span>${esc(i.s || '')}</span></a>`).join('')}</div>`; },
    bind(el) { el.querySelector('[data-go]')?.addEventListener('click', () => Nav.go('mg')); } });

  /* 📺 MG NEWS en la barra, a horarios al azar entre las 7 y las 22 */
  let nextAt = S.get('mgNext', 0);
  const shown = new Set(S.get('mgShown', []));
  function plan() { const m = 35 + Math.random() * 55; nextAt = Date.now() + m * 6e4; S.set('mgNext', nextAt); }
  function tick() {
    const h = new Date().getHours();
    if (!nextAt) plan();
    if (h < 7 || h >= 22 || Date.now() < nextAt || document.hidden) return;
    plan();
    if (!data) return;
    const ef = efemHoy(), pool = [...data.noticias.filter(i => !shown.has(i.l)).slice(0, 10).map(i => ({ k:i.l, h:`<b>${esc(i.t)}</b>${i.s ? `<small>${esc(i.s)}</small>` : ''}` })),
      ...ef.filter(e => !shown.has('ef' + e.y)).map(e => ({ k:'ef' + e.y, h:`<b>📜 Un día como hoy (${e.y})</b><span>${esc(e.t)}</span>` }))];
    const x = pool[Math.floor(Math.random() * pool.length)]; if (!x) return;
    shown.add(x.k); S.set('mgShown', [...shown].slice(-80));
    Grafismo.notify(x.h, { ms:14000, lbl:'📍 MG NEWS', cls:'mgn', onclick:() => Nav.go('mg') });
  }
  function init() { load(); setInterval(() => { load(); }, 20 * 60e3); setInterval(tick, 60e3); }
  return { init, render, load, data:() => data };
})();
