/* =========================================================
   Grafismo de canal de TV sobre el reproductor:
   arriba izq. qué suena · arriba der. logo FUNVS
   abajo izq. hora, día y clima · abajo der. controles de lo que suena
   ========================================================= */
const TV = (() => {
  const PLACES = [['Monte Grande', -34.8157, -58.4687], ['CABA', -34.6037, -58.3816]];
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  let weather = S.get('tvWeather', null), on = S.get('tvOn', true), dragging = false;

  function icon(code, day) {
    if (code === 0) return day ? '☀️' : '🌙';
    if (code <= 2) return day ? '🌤️' : '☁️';
    if (code === 3) return '☁️';
    if (code === 45 || code === 48) return '🌫️';
    if (code >= 95) return '⛈️';
    if ((code >= 71 && code <= 77) || code === 85 || code === 86) return '🌨️';
    if ((code >= 51 && code <= 57) || (code >= 80 && code <= 82)) return '🌦️';
    if (code >= 61 && code <= 67) return '🌧️';
    return '🌡️';
  }
  // Clima: Open-Meteo (gratis, sin clave). Cada 15 minutos.
  async function loadWeather() {
    try {
      const q = new URLSearchParams({ latitude:PLACES.map(p => p[1]).join(','), longitude:PLACES.map(p => p[2]).join(','),
        current:'temperature_2m,weather_code,is_day', timezone:'America/Argentina/Buenos_Aires' });
      const j = await (await fetch('https://api.open-meteo.com/v1/forecast?' + q)).json();
      const arr = Array.isArray(j) ? j : [j];
      weather = { at:Date.now(), list:arr.map((x, i) => ({ name:PLACES[i][0], t:Math.round(x.current.temperature_2m), ic:icon(x.current.weather_code, x.current.is_day) })) };
      S.set('tvWeather', weather); paintWeather();
    } catch {}
  }
  function paintWeather() {
    const el = $('tvWx'); if (!el) return;
    el.innerHTML = weather ? weather.list.map(w => `<span>${w.ic} ${esc(w.name)} <b>${w.t}°</b></span>`).join('') : '';
  }

  function build() {
    const st = $('stage');
    st.insertAdjacentHTML('beforeend', `
      <div class="hud" id="hud">
        <div class="hud-np" id="tvNp"></div>
        <div class="hud-logo">FUN<span>VS</span></div>
        <div class="hud-clock">
          <div class="hud-time" id="tvTime"></div>
          <div class="hud-date" id="tvDate"></div>
          <div class="hud-wx" id="tvWx"></div>
        </div>
        <div class="hud-ctl" id="tvCtl">
          <button id="tvPlay" title="Pausa / seguir">⏸</button>
          <button id="tvMute" title="Silenciar">🔊</button>
          <input type="range" id="tvVol" min="0" max="1" step="0.05" title="Volumen">
        </div>
      </div>`);
    // botones de la barra del reproductor: grafismo y pantalla completa
    $('btnHide').insertAdjacentHTML('beforebegin', `<button id="tvToggle" title="Mostrar u ocultar el grafismo de TV">📺 TV</button><button id="tvFull" title="Pantalla completa">⛶</button>`);
    $('tvToggle').onclick = () => { on = !on; S.set('tvOn', on); apply(); };
    $('tvFull').onclick = () => {
      const p = $('player');
      if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
      else (p.requestFullscreen || p.webkitRequestFullscreen || (() => Promise.reject())).call(p).catch(() => toast('<b>No se pudo poner pantalla completa</b>', { cls:'info', ms:4000 }));
    };
    $('tvPlay').onclick = () => { const s = AudioMgr.sink(AudioMgr.active); s && s.toggle && s.toggle(); tick(); };
    $('tvMute').onclick = () => {
      const id = AudioMgr.active, s = AudioMgr.sink(id); if (!s) return;
      const m = s.muted ? s.muted() : false;
      if (m) AudioMgr.focus(id); else s.mute();
      tick();
    };
    $('tvVol').oninput = e => { const s = AudioMgr.sink(AudioMgr.active); s && s.setVol && s.setVol(+e.target.value); };
    $('tvVol').onpointerdown = () => dragging = true;
    $('tvVol').onpointerup = () => dragging = false;
    apply(); paintWeather(); tick();
    setInterval(tick, 1000);
    if (!weather || Date.now() - weather.at > 15 * 60e3) loadWeather();
    setInterval(loadWeather, 15 * 60e3);
  }
  function apply() {
    $('hud').style.display = on ? '' : 'none';
    $('tvToggle').classList.toggle('on', on);
    $('stage').classList.toggle('tvon', on);
  }

  function tick() {
    if (!on || !$('player').classList.contains('show')) return;
    const d = new Date();
    $('tvTime').textContent = d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
    $('tvDate').textContent = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
    // el grafismo deja libre el chat de la derecha cuando hay una sola pantalla con chat
    const s0 = Player.slots[0];
    $('hud').style.right = Player.layout === 1 && s0 && s0.chat ? (window.innerWidth > 800 ? (window.innerWidth >= 1500 ? 388 : 348) + 'px' : '4px') : '4px';
    const id = AudioMgr.active, s = id && AudioMgr.sink(id);
    const name = s && s.label ? s.label() : '';
    $('tvNp').innerHTML = name
      ? `<span class="hud-tag">${s.radio ? '📻 RADIO' : s.live && s.live() ? '● EN VIVO' : '▶ SONANDO'}</span><span class="hud-name">${esc(name)}</span>`
      : '';
    const ctl = $('tvCtl');
    ctl.style.display = s ? '' : 'none';
    if (s) {
      $('tvPlay').style.display = s.toggle ? '' : 'none';
      $('tvPlay').textContent = s.paused && s.paused() ? '▶' : '⏸';
      const m = s.muted ? s.muted() : false;
      $('tvMute').textContent = m ? '🔇' : '🔊';
      $('tvVol').style.display = s.setVol ? '' : 'none';
      if (s.getVol && !dragging) $('tvVol').value = m ? 0 : s.getVol();
    }
  }
  return { build };
})();
