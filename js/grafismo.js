/* =========================================================
   📡 Grafismo de canal: Último momento, zócalos, clima completo y separadores.
   ========================================================= */
const Grafismo = (() => {
  const inTv = () => document.body.classList.contains('tvlock');
  const hm = d => new Date(d).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });

  /* ---------- 🟥 ÚLTIMO MOMENTO: abajo, en el lugar del minuto a minuto; manda sobre todo y dura 1 minuto ---------- */
  let shownB = new Set(S.get('breakShown', [])), bTimer = null;
  async function checkBreaking() {
    let a = null; try { a = await (await fetch(REPO.data + 'actualidad.json?t=' + Math.floor(Date.now() / 600e3))).json(); } catch {}
    const t = (a?.topics || []).find(t => (a.ahora || []).includes(t.id) && t.big && Date.now() - Date.parse(t.first) < 6 * 3600e3 && !shownB.has(t.id));
    if (t) breaking(t.t, t.id);
  }
  function breaking(text, id) {
    if (id) { shownB.add(id); S.set('breakShown', [...shownB].slice(-40)); }
    let el = $('breaking'); if (!el) { el = document.createElement('div'); el.id = 'breaking'; document.body.appendChild(el); }
    el.innerHTML = `<span class="bk-lbl">ÚLTIMO MOMENTO</span><div class="bk-txt"><span>${esc(text)}</span></div><b class="bk-time">${hm(Date.now())}</b>`;
    document.body.classList.add('bkon');
    clearTimeout(bTimer); bTimer = setTimeout(() => document.body.classList.remove('bkon'), 60e3);
    el.onclick = () => { document.body.classList.remove('bkon'); Nav.go('noticias'); };
  }

  /* ---------- Avisos en la barra de abajo: en la Pantalla TV todo sale en la franja de la hora (no tapa el video).
     Uno por vez; si hay Último momento, espera. Afuera de la Pantalla TV, el cartelito de siempre. ---------- */
  let zq = [], zBusy = false;
  function notify(html, opts = {}) {
    if (!inTv()) return toast(html, opts);
    barPop(opts.lbl || (/goal/.test(opts.cls || '') ? '⚽ GOL' : 'FUNVS'), html, opts);
  }
  function barPop(lbl, html, opts = {}) { zq.push({ lbl, html, opts }); if (!zBusy) nextZ(); }
  function nextZ() {
    if (document.body.classList.contains('bkon')) { setTimeout(nextZ, 3000); return; }   // primero termina el Último momento
    const x = zq.shift(); if (!x) { zBusy = false; return; } zBusy = true;
    let el = $('barpop'); if (!el) { el = document.createElement('div'); el.id = 'barpop'; document.body.appendChild(el); }
    el.className = (x.opts.cls || '').replace(/\binfo\b/, '');
    el.innerHTML = `<span class="bp-lbl">${x.lbl}</span><div class="bp-txt">${x.html}</div><b class="bp-time">${hm(Date.now())}</b>`;
    let done = false; const off = () => { if (done) return; done = true; clearTimeout(t); document.body.classList.remove('bpon'); setTimeout(nextZ, 700); };
    el.onclick = () => { x.opts.onclick?.(); off(); };
    void el.offsetWidth; document.body.classList.add('bpon');
    const t = setTimeout(off, Math.min(x.opts.ms || 8000, x.opts.max || 12000));
  }

  /* ---------- ⛅ Clima completo a las 8, 18 y 22 (en la Pantalla TV, 30 segundos) ---------- */
  const WX = c => c === 0 ? '☀️' : c <= 2 ? '🌤️' : c === 3 ? '☁️' : c <= 48 ? '🌫️' : c <= 57 ? '🌦️' : c <= 67 ? '🌧️' : c <= 77 ? '🌨️' : c <= 82 ? '🌦️' : c <= 86 ? '🌨️' : '⛈️';
  const WXT = c => c === 0 ? 'Despejado' : c <= 2 ? 'Algo nublado' : c === 3 ? 'Nublado' : c <= 48 ? 'Niebla' : c <= 57 ? 'Llovizna' : c <= 67 ? 'Lluvia' : c <= 77 ? 'Nieve' : c <= 82 ? 'Chaparrones' : c <= 86 ? 'Nieve' : 'Tormentas';
  async function weather() {
    try {
      const q = new URLSearchParams({ latitude:'-34.8157', longitude:'-58.4687', daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', hourly:'weather_code,precipitation_probability', current:'temperature_2m,weather_code', forecast_days:'2', timezone:'America/Argentina/Buenos_Aires' });
      const j = await (await fetch('https://api.open-meteo.com/v1/forecast?' + q)).json();
      const now = Date.now(), hrs = j.hourly.time.map((t, i) => ({ t:Date.parse(t), c:j.hourly.weather_code[i], p:j.hourly.precipitation_probability[i] })).filter(h => h.t > now && h.t < now + 12 * 3600e3);
      const storm = hrs.find(h => h.c >= 95), rain = hrs.find(h => h.p >= 70);
      const day = i => `<div class="wxd"><small>${i ? 'MAÑANA' : 'HOY'}</small><span class="wxi">${WX(j.daily.weather_code[i])}</span><b>${Math.round(j.daily.temperature_2m_max[i])}° <em>${Math.round(j.daily.temperature_2m_min[i])}°</em></b><span>${WXT(j.daily.weather_code[i])}</span><span>💧 ${j.daily.precipitation_probability_max[i] ?? 0}%</span></div>`;
      const d = i => `<span class="bp-it"><small>${i ? 'MAÑANA' : 'HOY'}</small> ${WX(j.daily.weather_code[i])} <b>${Math.round(j.daily.temperature_2m_max[i])}°</b>/${Math.round(j.daily.temperature_2m_min[i])}° ${WXT(j.daily.weather_code[i])} · 💧${j.daily.precipitation_probability_max[i] ?? 0}%</span>`;
      const al = storm ? `<span class="bp-al">⚠️ Tormentas ${hm(storm.t)} h</span>` : rain ? `<span class="bp-al rain">☔ Lluvia ${hm(rain.t)} h (${rain.p}%)</span>` : '';
      barPop('⛅ EL CLIMA', `<span class="bp-it"><small>MONTE GRANDE</small> ${WX(j.current.weather_code)} <b>${Math.round(j.current.temperature_2m)}°</b></span>${d(0)}${d(1)}${al}`, { ms:30e3, max:30e3, cls:'bpwx' });
    } catch {}
  }
  let lastWx = S.get('wxShown', '');
  function wxTick() {
    const n = new Date(), k = n.toISOString().slice(0, 10) + '-' + n.getHours();
    if ([8, 18, 22].includes(n.getHours()) && n.getMinutes() < 15 && inTv() && lastWx !== k) { lastWx = k; S.set('wxShown', k); weather(); }
  }

  /* ---------- Separador: 2-3 s con el logo de FUNVS (al prender la app en la tele, al entrar a la Pantalla TV, antes de Vélez) ---------- */
  let sepAt = 0;
  function separator(sub) {
    if (Date.now() - sepAt < 20e3) return; sepAt = Date.now();
    const o = document.createElement('div'); o.className = 'sep';
    o.innerHTML = `<div class="sep-logo"><img src="img/vaca.jpg" alt=""><span class="f">FUN</span><span class="v">VS</span></div><i class="sep-line"></i>${sub ? `<div class="sep-sub">${esc(sub)}</div>` : ''}`;
    document.body.appendChild(o); setTimeout(() => o.classList.add('out'), sub ? 2600 : 1900); setTimeout(() => o.remove(), sub ? 3200 : 2500);
  }

  function init() {
    setTimeout(checkBreaking, 8000); setInterval(checkBreaking, 5 * 60e3);
    setInterval(wxTick, 60e3); setTimeout(wxTick, 10e3);
    if (Lite.tv) separator();
  }
  return { init, breaking, notify, barPop, weather, separator };
})();
