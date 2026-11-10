/* =========================================================
   FUNVS · Grafismo de canal de TV + Pantalla TV (estilo TuneIn)
   arriba izq. qué suena · arriba der. logo FUNVS
   abajo izq. hora, día y clima · abajo der. controles · zócalo de noticias
   ========================================================= */
const TV = (() => {
  const PLACES = [['Monte Grande', -34.8157, -58.4687], ['CABA', -34.6037, -58.3816]];
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const MESES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  let weather = S.get('tvWeather', null), on = S.get('tvOn', true), dragging = false, lastNp = '', uiTimer = null, tickerText = '';

  /* ---------- Clima (Open-Meteo, gratis) ---------- */
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
  async function loadWeather() {
    try {
      const q = new URLSearchParams({ latitude:PLACES.map(p => p[1]).join(','), longitude:PLACES.map(p => p[2]).join(','),
        current:'temperature_2m,weather_code,is_day', timezone:'America/Argentina/Buenos_Aires' });
      const j = await meteo(q);
      const arr = Array.isArray(j) ? j : [j];
      weather = { at:Date.now(), list:arr.map((x, i) => ({ name:PLACES[i][0], t:Math.round(x.current.temperature_2m), ic:icon(x.current.weather_code, x.current.is_day) })) };
      S.set('tvWeather', weather); paintWeather();
    } catch {}
  }
  function paintWeather() {
    const el = $('tvWx'); if (!el) return;
    el.innerHTML = weather ? weather.list.map(w => `<span><i>${w.ic}</i>${esc(w.name)} <b>${w.t}°</b></span>`).join('') : '';
    if ($('fWx')) $('fWx').innerHTML = el.innerHTML;
  }

  /* ---------- Armado ---------- */
  function build() {
    $('stage').insertAdjacentHTML('beforeend', `
      <div class="tvart" id="tvArt">
        <div class="tvart-bg" id="tvArtBg"></div>
        <div class="tvart-c" id="tvArtC"></div>
      </div>
`);
    // el grafismo va sobre toda la página (esquinas de la pantalla), no sobre el reproductor
    document.body.insertAdjacentHTML('beforeend', `<div class="hud" id="hud">
        <div class="hud-np" id="tvNp"></div>
        <div class="hud-logo"><img class="pet" src="img/vaca.jpg" alt=""><span class="f">FUN</span><span class="v">VS</span><i></i></div>
        <div class="hud-clock">
          <div class="hud-time" id="tvTime"></div>
          <div class="hud-date" id="tvDate"></div>
          <div class="hud-wx" id="tvWx"></div>
        </div>
        <div class="hud-ctl" id="tvCtl">
          <button id="tvPrev" title="Canal anterior">⏮</button>
          <button id="tvBack" title="Atrás 10 segundos">⏪</button>
          <button id="tvPlay" title="Pausa / seguir">⏸</button>
          <button id="tvFwd" title="Adelante 10 segundos">⏩</button>
          <button id="tvLive" class="tolive" title="Volver al vivo">● VIVO</button>
          <button id="tvNext" title="Canal siguiente">⏭</button>
          <button id="tvList" title="Lista de canales">☰</button>
          <button id="tvMute" title="Silenciar">🔊</button>
          <input type="range" id="tvVol" min="0" max="1" step="0.05" title="Volumen">
          <button id="tvStar" title="Guardar este momento">⭐</button>
        </div>
        <div class="hud-ticker" id="tvTicker"><span class="tk-lbl">FUNVS <b>AL MINUTO</b></span><div class="tk-wrap"><div class="tk-run" id="tvRun"></div></div><b class="tk-time" id="tvTime2"></b></div>
        <button class="hud-exit" id="tvExit">✕ Salir de pantalla TV</button>
      </div>`);
    // en la página: arriba, dentro del encabezado; abajo, una franja propia (como un canal de TV)
    document.querySelector('header .top').insertAdjacentHTML('afterbegin', '<div class="nph" id="npHead"></div>');
    document.querySelector('header .top').insertAdjacentHTML('beforeend', '<div class="hlogo" id="hLogo"><img class="pet" src="img/vaca.jpg" alt=""><span class="f">FUN</span><span class="v">VS</span><i></i></div>');
    $('bottom').insertAdjacentHTML('beforeend', `<footer id="tvfoot">
        <div class="fclock"><div class="ftime" id="fTime"></div><div><div class="fdate" id="fDate"></div><div class="fwx" id="fWx"></div></div></div>
        <div class="fnow" id="fNow"></div>
        <div class="fctl" id="fCtl"><button data-c="prev" title="Anterior">⏮</button><button data-c="back" title="Atrás 10 segundos">⏪</button><button data-c="play" title="Pausa / seguir">❚❚</button><button data-c="fwd" title="Adelante 10 segundos">⏩</button><button data-c="live" class="tolive" title="Volver al vivo">● VIVO</button><button data-c="next" title="Siguiente">⏭</button><button data-c="mute" title="Silenciar">🔊</button>
          <input type="range" data-c="vol" min="0" max="1" step="0.05" title="Volumen"><button data-c="vid" title="Mostrar u ocultar el video">🎬</button><button data-c="star" title="Guardar este momento">⭐</button><button data-c="tv" title="Pantalla TV">📺</button><button data-c="x" title="Cerrar lo que suena">✕</button></div>
      </footer>`);
    $('btnHide').insertAdjacentHTML('beforebegin', `<button id="tvFull" title="Pantalla completa">⛶</button>`);
    $('btnGraf').onclick = () => { on = !on; S.set('tvOn', on); apply(); };
    $('fCtl').querySelector('[data-c=play]').onclick = () => $('tvPlay').click();
    $('fCtl').querySelector('[data-c=mute]').onclick = () => $('tvMute').click();
    $('fCtl').querySelector('[data-c=star]').onclick = () => Momentos.capture(AudioMgr.active);
    // barra única: anterior / siguiente / cerrar según lo que suene (canal, radio o música)
    const act = a => { const id = AudioMgr.active; if (!id) return;
      if (id === 'music') { if (a === 'x') Musica.stop(); else Musica.skip(a === 'next' ? 1 : -1); }
      else if (id === 'radio') { if (a === 'x') Radio.stop(); else Radio.skip(a === 'next' ? 1 : -1); }
      else { if (a === 'x') Player.closeAll(); else Zap.step(a === 'next' ? 1 : -1); }
      setTimeout(tick, 200); };
    ['prev', 'next', 'x'].forEach(a => $('fCtl').querySelector(`[data-c=${a}]`).onclick = () => act(a));
    const seek = d => { const k = AudioMgr.sink(AudioMgr.active); k?.seek?.(d); showUi(); setTimeout(tick, 250); };
    const live = () => { AudioMgr.sink(AudioMgr.active)?.toLive?.(); setTimeout(tick, 400); };
    $('tvBack').onclick = () => seek(-10); $('tvFwd').onclick = () => seek(10); $('tvLive').onclick = live;
    $('fCtl').querySelector('[data-c=back]').onclick = () => seek(-10); $('fCtl').querySelector('[data-c=fwd]').onclick = () => seek(10); $('fCtl').querySelector('[data-c=live]').onclick = live;
    $('tvPrev').onclick = () => act('prev'); $('tvNext').onclick = () => act('next');
    $('tvList').onclick = () => { if (Device.mode === 'pc') { const on = $('player').classList.toggle('zappin'); if (on && !Zap.open) Zap.listOpen(true); } else Zap.listOpen(!Zap.open); };
    $('fCtl').querySelector('[data-c=tv]').onclick = () => open(false);
    $('fCtl').querySelector('[data-c=vid]').onclick = () => { const on = !document.body.classList.contains('muvidshow'); document.body.classList.toggle('muvidshow', on); S.set('musHideVid', !on); };
    document.body.classList.toggle('muvidshow', !S.get('musHideVid', false));
    $('fNow').onclick = e => { const o = e.target.closest('[data-other]'); if (o) { AudioMgr.focus(o.dataset.other); setTimeout(tick, 150); return; } const id = AudioMgr.active; if (!id) return;
      Nav.go(id === 'radio' ? 'radios' : id === 'music' ? 'musica' : 'canales'); };
    const fv = $('fCtl').querySelector('[data-c=vol]');
    fv.oninput = e => { const s = AudioMgr.sink(AudioMgr.active); s && s.setVol && s.setVol(+e.target.value); S.set('vol', +e.target.value); };
    fv.onpointerdown = () => dragging = true; fv.onpointerup = () => dragging = false;
    $('tvFull').onclick = () => {   // pantalla completa del reproductor: ahí el grafismo no aparece
      const p = $('player');
      if (document.fullscreenElement) return document.exitFullscreen().catch(() => {});
      const fn = p.requestFullscreen || p.webkitRequestFullscreen; if (fn) fn.call(p).catch(() => {});
    };
    $('btnTv').onclick = () => open(false);
    $('tvExit').onclick = close;
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && $('player').classList.contains('tvmode') && !document.fullscreenElement) close(); });
    document.addEventListener('fullscreenchange', () => { if (!document.fullscreenElement && $('player').dataset.fs) { delete $('player').dataset.fs; } });
    $('player').addEventListener('pointermove', showUi);
    // compu: la lista de canales sale solo si llevás el mouse al borde izquierdo (y se queda mientras estés encima)
    $('player').addEventListener('pointermove', e => { if (Device.mode !== 'pc' || e.pointerType === 'touch') return;
      const p = $('player'), w = $('zap')?.offsetWidth || 260; p.classList.toggle('zaphot', e.clientX < (p.classList.contains('zaphot') ? w + 20 : 36)); });
    $('player').addEventListener('pointerleave', () => $('player').classList.remove('zaphot'));
    $('player').addEventListener('touchstart', showUi, { passive:true });
    document.addEventListener('keydown', () => { if (document.body.classList.contains('tvlock')) showUi(); }, true);
    $('tvCtl').addEventListener('focusin', showUi);

    $('tvPlay').onclick = () => { const s = AudioMgr.sink(AudioMgr.active); s && s.toggle && s.toggle(); setTimeout(tick, 150); };
    $('tvMute').onclick = () => {
      const id = AudioMgr.active, s = AudioMgr.sink(id); if (!s) return;
      if (s.muted && s.muted()) AudioMgr.focus(id); else s.mute();
      tick();
    };
    $('tvStar').onclick = () => Momentos.capture(AudioMgr.active);
    $('tvVol').oninput = e => { const s = AudioMgr.sink(AudioMgr.active); s && s.setVol && s.setVol(+e.target.value); S.set('vol', +e.target.value); };
    $('tvVol').onpointerdown = () => dragging = true;
    $('tvVol').onpointerup = () => dragging = false;
    $('tvArtC').onclick = e => {
      const r = e.target.closest('[data-radio]'), c = e.target.closest('[data-chan]'), big = e.target.closest('.tvart-play');
      if (r) Radio.play(db.radios[+r.dataset.radio]);
      if (c) Player.play(db.chans.find(x => x.uid === c.dataset.chan));
      if (big) { const s = AudioMgr.sink('radio'); s && s.toggle(); setTimeout(refresh, 200); }
    };
    apply(); paintWeather(); tick();
    setInterval(tick, 1000);
    if (!weather || Date.now() - weather.at > 15 * 60e3) loadWeather();
    setInterval(loadWeather, 15 * 60e3);
    setInterval(updateTicker, 2 * 60e3);
  }
  function apply() {
    $('hud').classList.toggle('off', !on);
    document.body.classList.toggle('hudon', on);
    $('btnGraf').classList.toggle('on', on);
    if ($('setHud')) $('setHud').checked = on;
    $('stage').classList.toggle('tvon', on);
  }
  function showUi() {
    $('player').classList.add('ui'); document.body.classList.add('tvui');
    clearTimeout(uiTimer);
    uiTimer = setTimeout(() => { $('player').classList.remove('ui'); document.body.classList.remove('tvui'); }, 3500);
  }

  /* ---------- Pantalla TV ---------- */
  function open(full) {
    const p = $('player');
    if (!document.body.classList.contains('tvlock')) try { Grafismo.separator(); } catch {}
    p.classList.add('show', 'tvmode');
    document.body.classList.add('tvlock');
    if (!on) { on = true; S.set('tvOn', on); apply(); }
    if (full) {
      const fn = p.requestFullscreen || p.webkitRequestFullscreen;
      if (fn) fn.call(p).then(() => { p.dataset.fs = 1; }).catch(() => {});
    }
    showUi(); refresh(); updateTicker();
  }
  function close() {
    document.body.classList.remove('oscuro');
    const p = $('player');
    if (document.fullscreenElement) document.exitFullscreen().catch(() => {});
    p.classList.remove('tvmode');
    document.body.classList.remove('tvlock');
    if (Player.slots.every(s => !s)) p.classList.remove('show');
  }
  // qué se ve en la pantalla TV cuando no hay video: la radio en grande (estilo TuneIn) o accesos rápidos
  function refresh() {
    const p = $('player'); if (!p) return;
    const noVideo = Player.slots.every(s => !s);
    p.classList.toggle('novideo', noVideo);
    if (!noVideo || !p.classList.contains('tvmode')) return;
    const mu = Musica.current && (AudioMgr.active === 'music' || !Radio.current) ? Musica.current : null;
    if (mu) {
      const t = Musica.track || {}, img = t.vid ? `https://i.ytimg.com/vi/${t.vid}/hqdefault.jpg` : mu.thumb || '';
      $('tvArtBg').style.backgroundImage = img ? `url('${img}')` : '';
      $('tvArtC').innerHTML = `<div class="tvart-logo cover" style="${img ? `background-image:url('${esc(img)}')` : ''}">${img ? '' : '🎵'}</div>
        <div class="tvart-kicker">MÚSICA${mu.kind === 'playlist' ? ' · ' + esc((mu.name || '').toUpperCase()) : ''}</div>
        <div class="tvart-name">${esc(t.title || mu.name || '')}</div><div class="tvart-sub">${esc(t.by || mu.by || '')}</div>
        <div class="eq big"><i></i><i></i><i></i><i></i><i></i></div>`;
      $('tvArt').classList.toggle('paused', !Musica.playing);
      return;
    }
    const r = Radio.current, a = $('radioAudio');
    $('tvArtBg').style.backgroundImage = r && r.logo ? `url('${r.logo}')` : '';
    const live = db.chans.filter(c => Canales.status[c.uid]?.st === 'live');
    const picks = `
      ${db.radios.length ? `<div class="tvart-row"><span>📻 Tus radios</span>${db.radios.slice(0, 10).map((x, i) => `<button data-radio="${i}" class="${r && r.url === x.url ? 'on' : ''}">${esc(x.name)}</button>`).join('')}</div>` : ''}
      ${live.length ? `<div class="tvart-row"><span>● En vivo ahora</span>${live.slice(0, 8).map(c => `<button data-chan="${c.uid}">${esc(c.name)}</button>`).join('')}</div>` : ''}`;
    $('tvArtC').innerHTML = r ? `
        <div class="tvart-logo" style="${r.logo ? `background-image:url('${esc(r.logo)}')` : ''}">${r.logo ? '' : '📻'}</div>
        <div class="tvart-kicker">RADIO EN VIVO</div>
        <div class="tvart-name">${esc(r.name)}</div>
        <div class="tvart-sub">${esc(r.tags || r.place || '')}</div>
        <button class="tvart-play">${a.paused ? '▶' : '❚❚'}</button>
        <div class="eq big"><i></i><i></i><i></i><i></i><i></i></div>
        ${picks}`
      : `<div class="tvart-logo idle"><img class="pet" src="img/vaca.jpg" alt=""><span class="f">FUN</span><span class="v">VS</span></div>
        <div class="tvart-name">¿Qué ponemos?</div>
        <div class="tvart-sub">Elegí una radio o un canal en vivo</div>
        ${picks || '<div class="tvart-sub">Guardá radios en la sección Radios o canales en Canales.</div>'}`;
    $('tvArt').classList.toggle('paused', !r || a.paused);
  }

  /* ---------- Zócalo que corre abajo ---------- */
  async function updateTicker() {
    if (!$('player').classList.contains('tvmode')) return;
    if (!Noticias.loaded) { try { await Noticias.load(); } catch {} }
    const items = [...Fulbito.ticker(), ...Motor.ticker(), ...Noticias.headlines(18)];
    const txt = items.length ? items.map(esc).join('<i>◆</i>') : 'FUNVS · Tu centro de entretenimiento';
    if (txt === tickerText) return;
    tickerText = txt;
    const run = $('tvRun');
    run.innerHTML = `<span>${txt}</span><span>${txt}</span>`;
    run.style.animationDuration = Math.max(30, run.firstChild.textContent.length * 0.16) + 's';
  }

  /* ---------- Cada segundo: reloj, qué suena y controles ---------- */
  function tick() {
    if (!on) return;
    // deja lugar a las barras de radio y música de abajo
    document.body.style.setProperty('--botH', $('bottom').offsetHeight + 'px');
    const d = new Date();
    $('tvTime').textContent = d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
    $('tvDate').textContent = `${DIAS[d.getDay()]} ${d.getDate()} de ${MESES[d.getMonth()]}`;
    $('fTime').textContent = $('tvTime2').textContent = $('tvTime').textContent; $('fDate').textContent = $('tvDate').textContent;
    // FUNVS AL MINUTO: entra a las y 00 y a las y 30, se queda 10 minutos; el resto del tiempo, hora, día y clima
    const news = d.getMinutes() % 30 < 10;
    if (news !== document.body.classList.contains('tknews')) { document.body.classList.toggle('tknews', news); if (news) updateTicker(); }
    const id = AudioMgr.active, s = id && AudioMgr.sink(id);
    const name = s && s.label ? s.label() : '';
    const tag = !s ? '' : s.radio ? 'RADIO' : s.music ? 'MÚSICA' : s.prem && s.prem() ? 'ESTRENO' : s.live && s.live() ? 'EN VIVO' : 'AHORA';
    document.body.classList.toggle('npon', !!name);
    const key = tag + '|' + name;
    if (key !== lastNp) {          // cuando cambia lo que suena, el zócalo entra animado
      lastNp = key;
      $('tvNp').innerHTML = name ? `<span class="hud-tag ${tag === 'EN VIVO' ? 'live' : ''}">${tag === 'EN VIVO' ? '● ' : ''}${tag}</span><span class="hud-name">${esc(name)}</span>` : '';
      $('npHead').innerHTML = $('tvNp').innerHTML;
      [$('tvNp'), $('npHead')].forEach(x => { x.classList.remove('in'); void x.offsetWidth; x.classList.add('in'); });
      refresh();
    }
    $('tvCtl').style.display = s ? '' : 'none'; $('fCtl').style.visibility = s ? '' : 'hidden';
    document.body.classList.toggle('playing', !!s);
    // qué suena, en la barra única (y si hay otra cosa cargada, un botón para pasar a esa)
    const sub = !s ? '' : id === 'radio' ? (Radio.current && (RadioGrilla.nowFor(Radio.current)?.name || Radio.current.tags || '')) : id === 'music' ? (Musica.track?.by || '') : (Canales.status[Player.slots[Player.sel]?.c.uid]?.title || '');
    const others = ['radio', 'music'].filter(k => k !== id && AudioMgr.sink(k)?.label?.());
    const nk = [id, name, sub, others.join()].join('|');
    if ($('fNow').dataset.k !== nk) { $('fNow').dataset.k = nk;
      $('fNow').innerHTML = s ? `<span class="fic">${id === 'radio' ? '📻' : id === 'music' ? '🎵' : '📺'}</span><div><b>${esc(name)}</b><small>${esc(sub)}</small></div>${others.map(k => `<button class="fother" data-other="${k}" title="Pasar a esto">⇄ ${k === 'radio' ? '📻' : '🎵'} ${esc(AudioMgr.sink(k).label())}</button>`).join('')}` : ''; }
    $('fCtl').querySelector('[data-c=vid]').style.display = id === 'music' ? '' : 'none';
    if (s) {
      $('tvPlay').style.display = s.toggle ? '' : 'none';
      $('tvList').style.display = id === 'radio' || id === 'music' ? 'none' : '';
      const sk = !!s.seek, bh = s.behind ? s.behind() : 0, fc0 = $('fCtl');
      [$('tvBack'), $('tvFwd'), fc0.querySelector('[data-c=back]'), fc0.querySelector('[data-c=fwd]')].forEach(b => b.style.display = sk ? '' : 'none');
      [$('tvLive'), fc0.querySelector('[data-c=live]')].forEach(b => { b.style.display = s.behind && s.live?.() ? '' : 'none'; b.classList.toggle('behind', bh > 25); b.textContent = bh > 25 ? `● VIVO −${bh >= 3600 ? Math.floor(bh / 3600) + 'h' : ''}${Math.floor(bh % 3600 / 60)}m` : '● VIVO'; });
      $('tvPlay').textContent = s.paused && s.paused() ? '▶' : '❚❚';
      const m = s.muted ? s.muted() : false;
      $('tvMute').textContent = m ? '🔇' : '🔊';
      $('tvVol').style.display = s.setVol ? '' : 'none';
      if (s.getVol && !dragging) $('tvVol').value = m ? 0 : s.getVol();
      const fc = $('fCtl');
      fc.querySelector('[data-c=play]').style.display = s.toggle ? '' : 'none'; fc.querySelector('[data-c=play]').textContent = $('tvPlay').textContent;
      fc.querySelector('[data-c=mute]').textContent = $('tvMute').textContent;
      fc.querySelector('[data-c=vol]').style.display = s.setVol ? '' : 'none';
      if (s.getVol && !dragging) fc.querySelector('[data-c=vol]').value = $('tvVol').value;
    }
  }
  const setOn = v => { on = v; S.set('tvOn', on); apply(); };
  return { build, open, close, refresh, setOn, get on() { return on; } };
})();
