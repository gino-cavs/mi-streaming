/* =========================================================
   Calidad de video según la velocidad de tu conexión (por dispositivo)
   Mide la velocidad bajando un archivo chico y usa también lo que informa el navegador.
   Twitch: se aplica la calidad elegida. YouTube y Kick ajustan la calidad solos según la conexión.
   ========================================================= */
const Calidad = (() => {
  const OPTS = [['auto', 'Automática (según tu conexión)'], ['max', 'Máxima'], ['720', '720p'], ['480', '480p'], ['360', '360p'], ['min', 'Mínima (ahorro de datos)']];
  let pref = S.get('quality', 'auto'), mbps = S.get('netMbps', null), measuring = false;

  async function measure() {
    if (measuring) return mbps; measuring = true;
    let est = null;
    try {
      const url = 'https://cdn.jsdelivr.net/npm/hls.js@1.5.13/dist/hls.min.js?r=' + Math.random();
      const t0 = performance.now(); const buf = await (await fetch(url, { cache:'no-store' })).arrayBuffer(); const s = (performance.now() - t0) / 1000;
      if (s > 0 && buf.byteLength > 50000) est = buf.byteLength * 8 / s / 1e6;
    } catch {}
    const nav = navigator.connection && navigator.connection.downlink;     // Chrome/Edge/Android
    if (est && nav) est = Math.max(est, nav); else est = est || nav || null;
    if (est) { mbps = Math.round(est * 10) / 10; S.set('netMbps', mbps); }
    measuring = false; paint(); applyAll();
    return mbps;
  }
  // la altura de video que conviene
  function target() { const t = target0(); return Lite.on ? Math.min(t, 720) : t; }
  function target0() {
    if (pref === 'max') return 9999;
    if (pref === 'min') return 160;
    if (pref !== 'auto') return +pref;
    if (!mbps) return 9999;
    if (mbps >= 15) return 1080; if (mbps >= 7) return 720; if (mbps >= 3.5) return 480; if (mbps >= 1.8) return 360; return 160;
  }
  const label = () => { const t = target(); return t >= 9999 ? 'máxima' : t >= 1080 ? '1080p' : t + 'p'; };
  // aplica a un reproductor de Twitch
  function applyTwitch(p) {
    try {
      const qs = (p.getQualities() || []).filter(q => q.group !== 'audio_only' && q.group !== 'auto');
      if (!qs.length) return;
      const h = q => parseInt(q.name) || (q.group === 'chunked' ? 1080 : 0);
      const t = target();
      if (pref === 'auto' && !mbps) return p.setQuality('auto');
      const pick = qs.filter(q => h(q) <= t).sort((a, b) => h(b) - h(a))[0] || qs.sort((a, b) => h(a) - h(b))[0];
      p.setQuality(pick.group);
    } catch {}
  }
  function applyYouTube(p) {   // YouTube hoy elige solo; esto es solo una sugerencia
    const map = { 160:'tiny', 360:'medium', 480:'large', 720:'hd720', 1080:'hd1080' }, t = target();
    try { p.setPlaybackQuality(t >= 9999 ? 'highres' : map[t] || 'default'); } catch {}
  }
  function applyAll() { Player.slots.forEach(s => { if (!s || !s.api || !s.api.p || s.audio) return; s.e.kind === 'twitch' ? applyTwitch(s.api.p) : s.e.kind === 'youtube' ? applyYouTube(s.api.p) : 0; }); }
  function paint() {
    const el = $('qInfo'); if (!el) return;
    const net = mbps ? `~${String(mbps).replace('.', ',')} Mbps` : 'sin medir';
    el.textContent = pref === 'auto' ? (mbps ? `Tu conexión: ${net} → calidad ${label()}.` : 'Todavía no medí tu conexión: por ahora, calidad automática.')
      : `Calidad fija: ${label()} (tu conexión: ${net}).`;
  }
  function init() {
    $('setQuality').innerHTML = OPTS.map(([v, n]) => `<option value="${v}">${n}</option>`).join('');
    $('setQuality').value = pref;
    $('setQuality').onchange = e => { pref = e.target.value; S.set('quality', pref); paint(); applyAll(); };
    $('qMeasure').onclick = async () => { $('qInfo').textContent = 'Midiendo…'; await measure(); };
    paint();
    setTimeout(measure, 6000); setInterval(measure, 15 * 60e3);
    if (navigator.connection) navigator.connection.addEventListener('change', () => measure());
  }
  return { init, applyTwitch, applyYouTube, measure };
})();
