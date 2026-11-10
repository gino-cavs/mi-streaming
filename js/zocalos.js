/* 📰 Zócalos útiles: aparecen solos en la barra de abajo (Pantalla TV) cuando sirven, y se van.
   🚆 tren de la mañana · 🌧 lluvia cerca · 🗓 cómo es mañana · ⚽ partidos que se juegan · 😴 es tarde + apagado automático */
const Zocalos = (() => {
  const SALIDA = '04:35', TREN = '04:51';   // de casa a la estación de Monte Grande: 2,3 km
  const MG = [-34.8157, -58.4687];
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
      const q = new URLSearchParams({ latitude:MG[0], longitude:MG[1], minutely_15:'precipitation', forecast_minutely_15:8, past_minutely_15:1, timezone:'America/Argentina/Buenos_Aires', models:METEO_MODELS.join(',') });
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
      const j = await meteo({ latitude:MG[0], longitude:MG[1], daily:'temperature_2m_min,temperature_2m_max,weather_code,precipitation_probability_max', timezone:'America/Argentina/Buenos_Aires', forecast_days:2 });
      const D = j.daily; wxTom = { at:Date.now(), min:Math.round(D.temperature_2m_min[1]), max:Math.round(D.temperature_2m_max[1]), pp:D.precipitation_probability_max?.[1], code:D.weather_code[1] };
    } catch {}
    const [ic, name] = Dia.OPC[p] || ['', p];
    const w = wxTom ? ` · ${wxTom.min}° / ${wxTom.max}°${wxTom.pp >= 40 ? ` · 🌧 ${Math.round(wxTom.pp)}%` : ''}` : '';
    pop('🗓 MAÑANA', `${ic} <b>${esc(name)}</b>${p === 'oficina' ? ` · salís ${SALIDA} para el Roca de las ${TREN}` : ''}${w}`);
  }

  /* ⚽ 4) Partidos que se están jugando (de tus ligas; nunca Vélez, que lo ves en la tele aunque tenga delay; ni Boca ni River) */
  const NUNCA = ['velez', 'boca', 'river'];
  const nn = s => norm(s || '');
  function partidos() {
    if (!viendo() || !tv()) return;
    let L = []; try { L = Object.values(Fulbito.today()).flatMap(x => x.events); } catch { return; }
    const pick = (db.futbol?.zoc || []).map(nn);
    const ok2 = m => { const ts = [m.h.team, m.a.team].flatMap(t => [nn(t.displayName), nn(t.shortDisplayName)]);
      if (ts.some(x => NUNCA.some(b => x.includes(b)))) return false;
      return !pick.length || ts.some(x => pick.some(p => x.includes(p) || p.includes(x))); };
    const live = L.filter(m => m.state === 'in' && ok2(m)).slice(0, 4); if (!live.length || !ok('partidos', 4 * 60e3)) return;
    const n = t => esc(t.team.shortDisplayName || t.team.displayName);
    pop('⚽ PARTIDOS', live.map(m => `${n(m.h)} <b>${m.hs}-${m.as}</b> ${n(m.a)} <small>${esc(m.st)}</small>`).join(' &nbsp;·&nbsp; '), { ms:12000, onclick:() => Nav.go('fulbito') });
  }

  /* 😴 5) Es tarde y mañana es de oficina: aviso suave + apagado automático */
  let sleepAt = 0, sleepT = null;
  function setSleep(min) {
    clearTimeout(sleepT); sleepAt = min ? Date.now() + min * 60e3 : 0;
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

  function init() {
    const tick = () => { if (document.hidden) return; try { tren(); } catch {} try { manana(); } catch {} try { partidos(); } catch {} try { tarde(); } catch {} lluvia(); };
    setTimeout(tick, 20e3); setInterval(tick, 60e3);
  }
  return { init, setSleep, cycle, get sleepAt() { return sleepAt; } };
})();
