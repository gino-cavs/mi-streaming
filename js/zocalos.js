/* 📰 Zócalos útiles: aparecen solos en la barra de abajo (Pantalla TV) cuando sirven, y se van.
   🚆 tren de la mañana · 🌧 lluvia cerca · 🗓 cómo es mañana · ⚽ partidos que se juegan · 😴 es tarde + apagado automático */
const Zocalos = (() => {
  const SALIDA = '04:35', TREN = '04:51';   // de casa a la estación de Monte Grande: 2,3 km
  const MGc = [-34.8157, -58.4687];   // Monte Grande (ojo: MG es el módulo de MG News)
  const hm = d => d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  const at = (hhmm, d = new Date()) => { const [h, m] = hhmm.split(':').map(Number), x = new Date(d); x.setHours(h, m, 0, 0); return x; };
  const tv = () => document.body.classList.contains('tvlock');
  const viendo = () => tv() || $('player')?.classList.contains('show') || !!AudioMgr.active;
  const once = {};   // para no repetir: clave → cuándo se mostró
  const ok = (k, every) => { if (Date.now() - (once[k] || 0) < every) return false; once[k] = Date.now(); return true; };
  // en la Pantalla TV va a la barra de abajo; afuera, como aviso común (solo lo importante)
  function pop(lbl, html, { important = false, ms = 11000, onclick } = {}) {
    if (tv()) return Grafismo.barPop(lbl, html, { ms, onclick });
    if (important) toast(`<b>${lbl}</b> ${html}`, { cls:'info', ms, onclick });
  }
  const mins = ms => Math.max(0, Math.round(ms / 60e3));

  /* 🚆 1) Días de oficina: de 4:05 a 4:40, cuánto falta para salir hacia el Roca de las 4:51 */
  function tren() {
    const n = new Date(), p = Dia.plan(n); if (p !== 'oficina') return;
    const sal = at(SALIDA), dif = sal - n; if (dif > 30 * 60e3 || dif < -5 * 60e3) return;
    const est = (() => { try { return Transporte.estado('roca'); } catch { return ''; } })();
    const txt = dif > 60e3 ? `Salí en <b>${mins(dif)} min</b> (a las ${SALIDA}) para el Roca de las ${TREN}` : dif > -60e3 ? `<b>¡Es hora de salir!</b> El Roca pasa a las ${TREN}` : `Si todavía no saliste, vas justo: el Roca pasa a las ${TREN}`;
    if (ok('tren', dif > 10 * 60e3 ? 5 * 60e3 : 2 * 60e3)) pop('🚆 TREN', `${txt}${est ? ` · <small>${esc(est)}</small>` : ''}`, { important:true, ms:15000 });
  }

  /* 🌧 2) Lluvia: solo avisa si los 3 modelos (o 2 de 3) coinciden en que llueve en Monte Grande en la próxima hora y media */
  let rainAt = 0;
  async function lluvia() {
    if (Date.now() - rainAt < 10 * 60e3) return; rainAt = Date.now();
    try {
      const q = new URLSearchParams({ latitude:MGc[0], longitude:MGc[1], minutely_15:'precipitation', forecast_minutely_15:8, past_minutely_15:1, timezone:'America/Argentina/Buenos_Aires', models:METEO_MODELS.join(',') });
      const j = await (await fetch('https://api.open-meteo.com/v1/forecast?' + q)).json(); const m = j.minutely_15; if (!m) return;
      const t = m.time.map(x => Date.parse(x + ':00-03:00')), now = Date.now();
      const first = mod => { const a = m['precipitation_' + mod]; if (!a) return null; const i = t.findIndex((x, k) => x > now - 15 * 60e3 && a[k] >= .2); return i < 0 ? null : t[i]; };
      const hits = METEO_MODELS.map(first).filter(x => x != null), raining = hits.some(x => x <= now);
      if (hits.length >= 2 && !raining) {
        const when = Math.min(...hits); if (!ok('lluvia', 3 * 3600e3)) return;
        pop('🌧 LLUVIA', `Se viene agua en Monte Grande en <b>~${mins(when - now)} min</b> <small>(${hits.length} de ${METEO_MODELS.length} modelos coinciden)</small>`, { important:true, ms:14000 });
      }
    } catch {}
  }

  /* 🗓 3) A la noche: cómo es mañana (plan, tren y clima) */
  let wxTom = null;
  async function manana() {
    const n = new Date(); if (n.getHours() < 21 || !viendo()) return;
    const d = new Date(n); d.setDate(d.getDate() + 1);
    const p = Dia.plan(d); if (!p || !ok('manana', 45 * 60e3)) return;
    if (!wxTom || Date.now() - wxTom.at > 3 * 3600e3) try {
      const j = await meteo({ latitude:MGc[0], longitude:MGc[1], daily:'temperature_2m_min,temperature_2m_max,weather_code,precipitation_probability_max', timezone:'America/Argentina/Buenos_Aires', forecast_days:2 });
      const D = j.daily; wxTom = { at:Date.now(), min:Math.round(D.temperature_2m_min[1]), max:Math.round(D.temperature_2m_max[1]), pp:D.precipitation_probability_max?.[1], code:D.weather_code[1] };
    } catch {}
    const [ic, name] = Dia.OPC[p] || ['', p];
    const w = wxTom ? ` · ${wxTom.min}° / ${wxTom.max}°${wxTom.pp >= 40 ? ` · 🌧 ${Math.round(wxTom.pp)}%` : ''}` : '';
    let fe = []; try { fe = Fechas.manana(); } catch {}
    pop('🗓 MAÑANA', `${ic} <b>${esc(name)}</b>${p === 'oficina' ? ` · salís ${SALIDA} para el Roca de las ${TREN}` : ''}${w}${fe.length ? ` · ${fe.map(esc).join(' · ')}` : ''}`);
  }

  /* ⚽ 4) Partidos en juego: los que marcaste con 🔔 en Fulbito (o tus favoritos/todos, según cómo lo tengas ahí).
        Si no elegiste ninguno, los de tus ligas menos Vélez, Boca y River. */
  const NUNCA = ['velez', 'boca', 'river'];
  function partidos() {
    if (!viendo() || !tv()) return;
    let L = []; try { L = Object.values(Fulbito.today()).flatMap(x => x.events).filter(m => m.state === 'in'); } catch { return; }
    let live = L.filter(m => Fulbito.wants(m));
    if (!live.length && db.futbol?.scope !== 'none') live = L.filter(m => ![m.h.team, m.a.team].some(t => NUNCA.some(b => norm(t.displayName).includes(b))));
    live = live.slice(0, 4); if (!live.length || !ok('partidos', 4 * 60e3)) return;
    const n = t => esc(t.team.shortDisplayName || t.team.displayName);
    pop('⚽ PARTIDOS', live.map(m => `${n(m.h)} <b>${m.hs}-${m.as}</b> ${n(m.a)} <small>${esc(m.st)}</small>`).join(' &nbsp;·&nbsp; '), { ms:12000, onclick:() => Nav.go('fulbito') });
  }

  /* 😴 5) Es tarde y mañana es de oficina: aviso suave + apagado automático */
  let sleepAt = 0, sleepT = null;
  function setSleep(min) {
    clearTimeout(sleepT); sleepAt = min ? Date.now() + min * 60e3 : 0; setTimeout(rincon, 0);
    if (min) sleepT = setTimeout(apagar, min * 60e3);
    toast(min ? `<b>😴 Se apaga a las ${hm(new Date(sleepAt))}</b><small>En ${min} min. Z (o tocar acá) para cambiarlo.</small>` : '<b>😴 Apagado automático cancelado</b>', { cls:'info', ms:3500, onclick:cycle });
  }
  const STEPS = [15, 30, 60, 90, 0]; let sIdx = -1;
  function cycle() { sIdx = (sIdx + 1) % STEPS.length; setSleep(STEPS[sIdx]); }   // Z: 15 → 30 → 60 → 90 min → apagado
  function apagar() {   // baja el volumen de a poco y apaga
    sleepAt = 0; const s = AudioMgr.active && AudioMgr.sink(AudioMgr.active); let v = 1; try { v = s?.getVol?.() ?? 1; } catch {}
    const v0 = v, t = setInterval(() => { v -= v0 / 20; try { s?.setVol?.(Math.max(0, v)); } catch {}
      if (v <= 0) { clearInterval(t); try { Player.closeAll(); } catch {} try { Radio.stop(); } catch {} try { Musica.stop(); } catch {} try { TV.close(); } catch {} try { s?.setVol?.(v0); } catch {} S.set('vol', v0); } }, 1000);
  }
  function tarde() {
    const n = new Date(), h = n.getHours(); if (h < 0 || h >= 4 || sleepAt || !viendo() || !AudioMgr.active) return;
    if (Dia.plan(n) !== 'oficina' || !ok('tarde', 40 * 60e3)) return;
    const hasta = Math.max(0, at(SALIDA) - n);
    pop('😴 ES TARDE', `A las ${SALIDA} salís para el tren (faltan ${Math.floor(hasta / 3600e3)} h ${mins(hasta % 3600e3)} min). <b>¿Apago en 30 min?</b> <small>Tocá acá o Z</small>`, { important:true, ms:14000, onclick:() => { sIdx = 1; setSleep(30); } });
  }

  /* 🎬 Separador de franja: al pasar a mañana, mediodía, tarde, noche o madrugada, la cortina FUNVS con el nombre */
  let franja = null;
  function separadorFranja() {
    const f = Franja.now(); if (franja === null) { franja = f.id; return; }
    if (f.id === franja) return; franja = f.id;
    if (tv() && AudioMgr.active) Grafismo.separator(`${f.ic} ${f.n.toUpperCase()}`);
  }
  /* 💙 Día de partido de Vélez: el grafismo pasa a la versión especial (con el escudo) todo el día */
  function velezDay() {
    let m = null; try { m = Partido.match(); } catch {}
    const hoy = m && new Date(m.date).toDateString() === new Date().toDateString();
    document.body.classList.toggle('velezday', !!hoy);
    const logo = hoy ? (norm(m.h.team.displayName).includes('velez') ? m.h.team.logo : m.a.team.logo) : '';
    document.querySelectorAll('.hud-logo, #hLogo').forEach(el => { let c = el.querySelector('.vcrest');
      if (hoy && logo) { if (!c) { c = document.createElement('img'); c.className = 'vcrest'; c.alt = ''; el.prepend(c); } if (c.src !== logo) c.src = logo; } else c?.remove(); });
  }
  /* 🚗 Vélez de local: cómo está el camino a la cancha (Camino Negro, Riccheri, General Paz y cortes en Liniers).
        Desde 4 h antes, cada 30 min. Sale de las noticias de las últimas horas (no es tráfico en tiempo real). */
  function cancha() {
    let m = null; try { m = Partido.match(); } catch {} if (!m || m.state !== 'pre') return;
    if (!norm(m.h.team.displayName).includes('velez')) return;   // solo de local (en el Amalfitani)
    const d = Date.parse(m.date) - Date.now(); if (d > 4 * 3600e3 || d < 0) return;
    const C = (() => { try { return MG.data()?.cancha || []; } catch { return []; } })(); if (!C.length || !ok('cancha', 30 * 60e3)) return;
    const parts = C.map(r => r.items.length ? `⚠️ <b>${esc(r.k)}</b>: ${esc(r.items[0].t.replace(/\s+-\s+[^-]+$/, '').slice(0, 90))}` : `✅ ${esc(r.k)}`);
    pop('🚗 A LA CANCHA', parts.join(' &nbsp;·&nbsp; ') + ' <small>según las noticias de las últimas horas</small>', { important:true, ms:16000 });
  }

  /* 🧥 10) Clima al despertar: los días de oficina, la primera vez que FUNVS se usa a la mañana: cómo está para ir y para volver */
  let wakeAt = S.get('wakeShown', '');
  async function despertar() {
    const n = new Date(), k = n.toDateString(); if (wakeAt === k || n.getHours() < 3 || n.getHours() >= 10 || Dia.plan(n) !== 'oficina' || !viendo()) return;
    wakeAt = k; S.set('wakeShown', k);
    try {
      const j = await meteo({ latitude:MGc[0], longitude:MGc[1], hourly:'temperature_2m,apparent_temperature,precipitation_probability', timezone:'America/Argentina/Buenos_Aires', forecast_days:1 });
      const H = j.hourly.time.map((t, i) => ({ h:+t.slice(11, 13), T:j.hourly.temperature_2m[i], F:j.hourly.apparent_temperature?.[i] ?? j.hourly.temperature_2m[i], p:j.hourly.precipitation_probability?.[i] ?? 0 }));
      const ida = H.filter(x => x.h >= 4 && x.h <= 6), vuelta = H.filter(x => x.h >= 14 && x.h <= 16);
      const fI = Math.round(Math.min(...ida.map(x => x.F))), tV = Math.round(Math.max(...vuelta.map(x => x.T))), pp = Math.max(...[...ida, ...vuelta].map(x => x.p));
      const tips = [fI <= 10 ? '🧥 llevá campera' : fI <= 15 ? '🧶 algo de abrigo' : '', pp >= 50 ? '☂️ llevá paraguas' : pp >= 30 ? '🌂 por las dudas, paraguas' : '', tV - fI >= 10 ? '🧅 vestite en capas' : ''].filter(Boolean);
      pop('🧥 PARA SALIR', `A las 4:35 se sienten <b>${fI}°</b> · a la vuelta <b>${tV}°</b>${pp >= 30 ? ` · lluvia ${pp}%` : ''}${tips.length ? ' · ' + tips.join(' · ') : ''}`, { important:true, ms:16000 });
    } catch {}
  }

  /* ↘ Rincón de abajo a la derecha: la cuenta regresiva a lo próximo que te importa (si falta poco),
       y si pusiste el apagado automático, eso manda */
  const dur = ms => { const m = Math.max(0, Math.round(ms / 60e3)); return m >= 60 ? `${Math.floor(m / 60)}:${String(m % 60).padStart(2, '0')} h` : `${m} min`; };
  function rincon() {
    const el = $('hudBr'); if (!el) return;
    const n = Date.now(), c = [];
    if (sleepAt) c.push({ p:0, h:`😴 Se apaga en <b>${dur(sleepAt - n)}</b>`, cls:'sleep' });
    else {
      try { if (Dia.plan(new Date()) === 'oficina') { const sal = at(SALIDA), d = sal - n; if (d > -5 * 60e3 && d < 90 * 60e3) c.push({ p:1, t:+sal, h:d > 0 ? `🚆 Salís en <b>${dur(d)}</b> · Roca ${TREN}` : `🚆 <b>¡Salí!</b> Roca ${TREN}` }); } } catch {}
      try { const m = Partido.match(); if (m && m.state === 'pre') { const d = Date.parse(m.date) - n, riv = norm(m.h.team.displayName).includes('velez') ? m.a.team : m.h.team;
        if (d > 0 && d < 6 * 3600e3) c.push({ p:2, t:Date.parse(m.date), h:`💙 Vélez vs ${esc(riv.shortDisplayName || riv.displayName)} en <b>${dur(d)}</b>`, cls:'velez' }); } } catch {}
      try { const x = Motor.upcoming(); if (x && x.t - n > 0 && x.t - n < 60 * 60e3) c.push({ p:3, t:x.t, h:`🏁 ${esc(x.cat)} · ${esc(x.name)} en <b>${dur(x.t - n)}</b>` }); } catch {}
      try { for (const r of db.recs || []) { const t = Avisos.next(r); if (t && t - n > 0 && t - n < 30 * 60e3) c.push({ p:4, t:+t, h:`🔔 ${esc(r.name)} en <b>${dur(t - n)}</b>` }); } } catch {}
    }
    c.sort((a, b) => a.p - b.p || (a.t || 0) - (b.t || 0));
    const x = c[0], html = x ? x.h : '';
    if (el.dataset.h !== html) { el.dataset.h = html; el.innerHTML = html; el.className = 'hud-br' + (x?.cls ? ' ' + x.cls : '') + (html ? ' on' : ''); }
  }
  function init() {
    setInterval(rincon, 15e3); setTimeout(rincon, 3000);
    const tick = () => { try { cancha(); } catch {} try { despertar(); } catch {} try { velezDay(); } catch {} try { separadorFranja(); } catch {} if (document.hidden) return; try { tren(); } catch {} try { manana(); } catch {} try { partidos(); } catch {} try { tarde(); } catch {} lluvia(); };
    setTimeout(tick, 20e3); setInterval(tick, 60e3);
  }
  return { init, setSleep, cycle, get sleepAt() { return sleepAt; } };
})();
