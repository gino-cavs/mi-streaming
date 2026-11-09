/* =========================================================
   Audio: cuando algo empieza a sonar, todo lo demás se silencia (no se pausa)
   ========================================================= */
const AudioMgr = (() => {
  const sinks = {};          // id -> { mute(), unmute(), onState?() }
  let current = null;
  return {
    register(id, sink) { sinks[id] = sink; },
    unregister(id) { delete sinks[id]; if (current === id) current = null; },
    focus(id) {
      current = id;
      Object.entries(sinks).forEach(([k, s]) => { try { k === id ? s.unmute() : s.mute(); } catch {} });
      try { Player.paintActs(); } catch {}
    },
    get current() { return current; },
    sink(id) { return sinks[id]; },
    // lo que suena es lo enfocado; si no hay, la radio o la primera pantalla con video
    get active() { return current && sinks[current] ? current : (sinks.radio && sinks.radio.label && sinks.radio.label() ? 'radio' : Object.keys(sinks).find(k => k.startsWith('slot')) || null); }
  };
})();

/* =========================================================
   Reproductor de video: 1, 2 o 4 pantallas, chat, solo audio, ventana flotante
   ========================================================= */
const Player = (() => {
  let layout = 1, sel = 0, seq = 0, chatOn = S.get('chatOn', true), focus = 0;   // focus = pantalla que manejan los botones de la barra
  const slots = [null, null, null, null];   // {c, e, chat, audio, api, kind, mutedByApp, pip}
  const els = [];

  const YT_API = () => loadScript('https://www.youtube.com/iframe_api').then(() => new Promise(r => {
    if (window.YT && YT.Player) return r();
    const prev = window.onYouTubeIframeAPIReady;
    window.onYouTubeIframeAPIReady = () => { prev && prev(); r(); };
  }));
  const TW_API = () => loadScript('https://player.twitch.tv/js/embed/v1.js');
  const PIP_OK = 'documentPictureInPicture' in window;
  const ANDROID = /Android/i.test(navigator.userAgent);

  // v = video, ch = chat embebido oscuro, out = chat en ventana aparte
  // sin la barra ni el título de YouTube (se maneja todo con los botones de FUNVS). Se apaga en Ajustes.
  const clean = () => S.get('ytClean', true) ? '&controls=0&rel=0&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=0' : '&rel=0';
  function embedOf(c) {
    const s = Canales.status[c.uid] || {};
    if (c.platform === 'twitch') return { kind:'twitch', id:c.ref.name,
      v:`https://player.twitch.tv/?channel=${c.ref.name}&parent=${HOST}&autoplay=true`,
      ch:`https://www.twitch.tv/embed/${c.ref.name}/chat?parent=${HOST}&darkpopout`, out:`https://www.twitch.tv/popout/${c.ref.name}/chat?darkpopout` };
    if (c.platform === 'kick') return { kind:'kick', id:c.ref.name,
      v:`https://player.kick.com/${c.ref.name}?autoplay=true`,
      ch:`https://kick.com/popout/${c.ref.name}/chat`, out:`https://kick.com/popout/${c.ref.name}/chat` };
    const isLive = s.st === 'live' || s.st === 'soon';
    const vid = isLive ? s.vid : (c.ref.video || s.vid);
    if (vid) return { kind:'youtube', id:vid,
      v:`https://www.youtube.com/embed/${vid}?autoplay=1&playsinline=1&enablejsapi=1${clean()}&origin=${encodeURIComponent(location.origin)}${c.ref.more?.length && !isLive ? '&playlist=' + c.ref.more.join(',') : ''}`,
      ch: isLive || c.ref.video ? `https://www.youtube.com/live_chat?v=${vid}&embed_domain=${HOST}&dark_theme=1` : null,
      out:`https://www.youtube.com/live_chat?v=${vid}&dark_theme=1` };
    if (c.ref.channelId) return { kind:'youtube', id:null,
      v:`https://www.youtube.com/embed/live_stream?channel=${c.ref.channelId}&autoplay=1&playsinline=1&enablejsapi=1${clean()}&origin=${encodeURIComponent(location.origin)}`, ch:null };
    return { kind:'none', v:'about:blank', ch:null };
  }

  function build() {
    const st = $('stage');
    for (let i = 0; i < 4; i++) {
      const d = document.createElement('div');
      d.className = 'slot';
      d.innerHTML = `<span class="lbl"></span><div class="bar"></div><div class="vw"></div>
        <div class="face"><div class="big">🎧</div><div class="nm"></div><div class="mut" style="font-size:13px">Modo solo audio</div><div class="eq"><i></i><i></i><i></i><i></i></div></div>
        <span class="muted-ic">🔇 Silenciado · tocá para escuchar</span>`;
      d.onclick = e => {
        if (e.target.closest('.bar') || e.target.closest('.muted-ic')) return;
        if (sel !== i || focus !== i) { sel = i; focus = i; paintSel(); paintActs(); }
        else if (e.target.closest('.vw.ytclean')) { const k = AudioMgr.sink('slot' + i); k?.toggle?.(); }   // sin la barra de YouTube: tocar el video pausa / sigue
      };
      d.querySelector('.muted-ic').onclick = ev => { ev.stopPropagation(); AudioMgr.focus('slot' + i); };
      st.appendChild(d); els.push(d);
    }
    document.querySelectorAll('.pbar [data-l]').forEach(b => b.onclick = () => setLayout(+b.dataset.l));

    $('btnHide').onclick = closeAll;
    setLayout(1);
  }
  function paintSel() { els.forEach((d, i) => { d.classList.toggle('sel', i === sel && layout > 1); d.classList.toggle('foc', i === focus && layout > 1 && !!slots[i]); }); }
  function setLayout(n) {
    layout = n;
    for (let i = n; i < 4; i++) clear(i);    // las pantallas que sobran se apagan
    sel = Math.min(sel, n - 1);
    ['l1', 'l2', 'l4'].forEach(c => $('stage').classList.remove(c)); $('stage').classList.add('l' + n);
    els.forEach((d, i) => d.classList.toggle('hide', i >= n));
    document.querySelectorAll('.pbar [data-l]').forEach(b => b.classList.toggle('on', +b.dataset.l === n));
    paintSel(); paintActs();
  }

  function clear(i) {
    const s = slots[i]; if (!s) { paintEmpty(i); return; }
    AudioMgr.unregister('slot' + i);
    try { s.api && s.api.destroy && s.api.destroy(); } catch {}
    if (s.pip) { try { s.pip.close(); } catch {} }
    slots[i] = null;
    const d = els[i];
    d.querySelector('.vw').innerHTML = '';
    d.querySelector('.chat')?.remove();
    paintEmpty(i); paintChatBtn();
  }
  function paintEmpty(i) {
    const d = els[i]; if (!d) return;
    d.className = 'slot' + (i >= layout ? ' hide' : '') + (i === sel && layout > 1 ? ' sel' : '');
    d.querySelector('.lbl').textContent = '';
    d.querySelector('.bar').innerHTML = '';
    d.querySelector('.vw').innerHTML = `<div class="ph">Pantalla ${i + 1}<br>${layout > 1 ? 'Tocala y elegí un canal' : 'Elegí un canal'}</div>`;
  }

  function mountVideo(i) {
    const s = slots[i], d = els[i], vw = d.querySelector('.vw'), my = ++seq;
    s.seq = my; s.api = null; s.mutedByApp = false;
    d.classList.remove('mutedbyapp');
    vw.innerHTML = '';
    const sid = 'slot' + i;
    const setMutedUI = m => { s.mutedByApp = m; d.classList.toggle('mutedbyapp', m); };

    if (s.e.kind === 'twitch') {
      const div = document.createElement('div'); div.id = 'tw' + my; vw.appendChild(div);
      TW_API().then(() => {
        if (s.seq !== my) return;
        const p = new Twitch.Player(div.id, { channel:s.e.id, parent:[HOST], width:'100%', height:'100%', autoplay:true, muted:false });
        s.api = { destroy() { div.innerHTML = ''; } , p };
        p.addEventListener(Twitch.Player.READY, () => { if (s.audio) setAudioQuality(s, true); else Calidad.applyTwitch(p); });
        p.addEventListener(Twitch.Player.PLAY, () => { if (!s.mutedByApp) AudioMgr.focus(sid); });
        AudioMgr.register(sid, { mute() { p.setMuted(true); setMutedUI(true); }, unmute() { p.setMuted(false); setMutedUI(false); },
          label:() => s.c.name, live:() => { const x = Canales.status[s.c.uid] || {}; return x.st === 'live' && !x.prem; }, prem:() => !!(Canales.status[s.c.uid] || {}).prem && (Canales.status[s.c.uid] || {}).st === 'live',
          paused:() => p.isPaused(), toggle:() => p.isPaused() ? p.play() : p.pause(),
          muted:() => p.getMuted(), getVol:() => p.getVolume(), setVol:v => { p.setVolume(v); if (v > 0 && p.getMuted()) AudioMgr.focus(sid); } });
      }).catch(() => { vw.innerHTML = `<iframe src="${s.e.v}" allow="autoplay; fullscreen" allowfullscreen></iframe>`; });
    } else if (s.e.kind === 'youtube') {
      const f = document.createElement('iframe');
      f.src = s.e.v; f.allow = 'autoplay; fullscreen; encrypted-media; picture-in-picture'; f.allowFullscreen = true;
      vw.appendChild(f); vw.classList.toggle('ytclean', S.get('ytClean', true));
      let last = null;
      YT_API().then(() => {
        if (s.seq !== my) return;
        const p = new YT.Player(f, { events:{ onStateChange:e => {
          // solo cuenta como "empezó a sonar" si veníamos de pausa/inicio (no al terminar de cargar)
          if (e.data === 3) return;
          if (e.data === 1 && last === null) Calidad.applyYouTube(p);
          if (e.data === 0 && s.c.t247) {          // canal 24/7: termina un video y sigue la grilla
            const n = T247any.nextFor(s.c.t247);
            if (n) { s.e.id = n.v; try { p.loadVideoById({ videoId:n.v, startSeconds:n.off }); } catch {} paintActs(); }
          }
          if (e.data === 1 && last !== 1) AudioMgr.focus(sid);
          last = e.data; s.yst = e.data; s.ystAt = Date.now();
          if (e.data === 0 && !s.c.t247) s.dead = true; if (e.data === 1) s.dead = false;
          if (e.data === 0 && s.c.onEnd) { let last = true; try { const pl = p.getPlaylist?.(); if (pl && p.getPlaylistIndex() < pl.length - 1) last = false; } catch {} if (last) { const f = s.c.onEnd; s.c.onEnd = null; setTimeout(f, 300); } }
          d.classList.toggle('paused', e.data === 2);
        }, onError:() => { s.dead = true; s.ystAt = Date.now(); } } });
        s.api = { p, destroy() {} };
        AudioMgr.register(sid, { mute() { try { p.mute(); } catch {} setMutedUI(true); }, unmute() { try { p.unMute(); } catch {} setMutedUI(false); },
          label:() => s.c.name, live:() => { const x = Canales.status[s.c.uid] || {}; return x.st === 'live' && !x.prem; }, prem:() => !!(Canales.status[s.c.uid] || {}).prem && (Canales.status[s.c.uid] || {}).st === 'live',
          paused:() => { try { return p.getPlayerState() !== 1; } catch { return false; } },
          toggle:() => { try { p.getPlayerState() === 1 ? p.pauseVideo() : p.playVideo(); } catch {} },
          muted:() => { try { return p.isMuted(); } catch { return false; } },
          getVol:() => { try { return p.getVolume() / 100; } catch { return 1; } },
          setVol:v => { try { p.setVolume(Math.round(v * 100)); if (v > 0 && p.isMuted()) AudioMgr.focus(sid); } catch {} } });
      }).catch(() => {});
    } else if (s.e.kind === 'kick') {
      // Kick no tiene controles para otras páginas: para silenciar hay que recargar el reproductor
      const f = document.createElement('iframe');
      f.src = s.e.v; f.allow = 'autoplay; fullscreen'; f.allowFullscreen = true; vw.appendChild(f);
      AudioMgr.register(sid, {
        mute() { if (!s.mutedByApp) { f.src = s.e.v + '&muted=true'; setMutedUI(true); } },
        unmute() { if (s.mutedByApp) { f.src = s.e.v + '&muted=false'; setMutedUI(false); } }
        , label:() => s.c.name, live:() => { const x = Canales.status[s.c.uid] || {}; return x.st === 'live' && !x.prem; }, prem:() => !!(Canales.status[s.c.uid] || {}).prem && (Canales.status[s.c.uid] || {}).st === 'live', muted:() => s.mutedByApp
      });
      setTimeout(() => AudioMgr.focus(sid), 0);
    }
  }
  function setAudioQuality(s, on) {
    const p = s.api && s.api.p; if (!p || !p.setQuality) return;
    try {
      if (on) { s.prevQ = p.getQuality(); const q = (p.getQualities() || []).find(q => q.group === 'audio_only' || q.name === 'audio_only'); p.setQuality(q ? q.group : 'audio_only'); }
      else { p.setQuality(s.prevQ || 'auto'); Calidad.applyTwitch(p); }
    } catch {}
  }

  function paintBar(i) {
    const s = slots[i], d = els[i];
    d.className = 'slot' + (i === sel && layout > 1 ? ' sel' : '') + (s.chat ? ' withchat' : '') + (s.audio ? ' audio' : '') + (s.mutedByApp ? ' mutedbyapp' : '');
    d.querySelector('.lbl').textContent = s.c.name;
    d.querySelector('.face .nm').textContent = s.c.name;
    d.querySelector('.bar').innerHTML = '';
    paintSel(); paintActs();
  }
  // botones de la pantalla elegida, en la barra del reproductor (a la derecha de "Pantallas")
  /* ---------- Control remoto abajo del video: canal ▲▼, pausa, mute y número ---------- */
  function paintRemote() {
    const r = $('remote'); if (!r || (document.activeElement?.id === 'rcIn' && $('rcIn').value)) return;   // no borrar el número mientras lo escribís
    const i = slots[focus] ? focus : slots.findIndex(Boolean), s = slots[i];
    if (!s) { r.innerHTML = ''; r.dataset.sig = ''; return; }
    const sk = AudioMgr.sink('slot' + i), muted = sk?.muted?.(), paused = sk?.paused?.();
    const inList = db.chans.includes(s.c);
    const sig = [i, s.c.uid, s.c.name, muted, paused, !!sk?.toggle].join('|'); if (r.dataset.sig === sig && r.firstChild) return; r.dataset.sig = sig;   // nada cambió: no redibujo
    r.innerHTML = `<button data-rc="up" title="Canal anterior (▲)">▲<small>CH</small></button><button data-rc="dn" title="Canal siguiente (▼)">▼<small>CH</small></button>
      <span class="rcnow">${inList ? `<b>${esc(Canales.numTxt(s.c))}</b>` : ''}${esc(s.c.name || '')}</span>
      <button data-rc="pp" title="Pausa / seguir" ${sk?.toggle ? '' : 'disabled'}>${paused ? '▶' : '❚❚'}</button>
      <button data-rc="mu" title="Silenciar / con sonido">${muted ? '🔇' : '🔊'}</button>
      <form class="rcnum" id="rcNum"><input id="rcIn" inputmode="numeric" pattern="[0-9]*" maxlength="3" placeholder="N°" autocomplete="off"><button title="Ir a ese canal">Ir</button></form>`;
    r.onclick = e => {
      const b = e.target.closest('[data-rc]'); if (!b) return;
      const a = b.dataset.rc, k = AudioMgr.sink('slot' + i);
      if (a === 'up') Zap.step(-1);
      if (a === 'dn') Zap.step(1);
      if (a === 'pp' && k?.toggle) k.toggle();
      if (a === 'mu' && k) { k.muted?.() ? AudioMgr.focus('slot' + i) : k.mute(); }
      setTimeout(() => { paintRemote(); paintActs(); }, 250);
    };
    $('rcNum').onsubmit = e => {
      e.preventDefault();
      const n = +$('rcIn').value, c = db.chans.find(x => +x.num === n);
      if (!c) { toast(`<b>No hay canal ${esc($('rcIn').value)}</b>`, { cls:'info zapt', ms:1500 }); $('rcIn').value = ''; return; }
      $('rcIn').value = ''; $('rcIn').blur(); play(c);
    };
  }
  setInterval(() => { if ($('player')?.classList.contains('show') && !document.hidden) paintRemote(); }, 1500);   // pausa / mute al día
  function paintActs() {
    paintRemote();
    const box = $('pbarActs'); if (!box) return;
    if (!slots[focus]) { const f = slots.findIndex(Boolean); if (f >= 0) focus = f; }
    const s = slots[focus];
    if (!s) { box.innerHTML = ''; return; }
    const pip = PIP_OK || ANDROID ? `<button data-a="pip" title="Ventana flotante">⧉ Flotante</button>` : '';
    box.innerHTML = `${layout > 1 ? `<span class="pa-lbl">Pantalla ${focus + 1}:</span>` : ''}
      <button data-a="snd" class="${AudioMgr.current === 'slot' + focus ? 'on' : ''}" title="Escuchar esta pantalla">🔊</button>
      ${s.e.kind === 'youtube' && s.e.id ? Likes.btn(s.e.id, s.c.name) : ''}
      <button data-a="audio" class="${s.audio ? 'on' : ''}" title="Solo audio (sin video)">🎧 Solo audio</button>
      ${s.e.ch ? `<button data-a="chat" class="${s.chat ? 'on' : ''}" title="Mostrar u ocultar el chat">💬 ${s.chat ? 'Ocultar chat' : 'Mostrar chat'}</button>` : ''}
      ${s.e.out ? `<button data-a="out" title="Abrir el chat en otra ventana">↗ Chat aparte</button>` : ''}
      ${s.c.t247 ? '<button data-a="skip" title="Pasar a otro video al azar">⏭ Otro video</button>' : ''}
      ${pip}<button data-a="star" title="Guardar este momento">⭐ Momento</button>
      <button data-a="x" title="Cerrar esta pantalla">✕</button>`;
    box.querySelectorAll('button[data-a]').forEach(b => b.onclick = () => action(focus, b.dataset.a));
    if (s.e.kind === 'youtube' && s.e.id) Likes.status(s.e.id);
  }
  const paintChatBtn = () => paintActs();
  function setChat(i, on) {
    const s = slots[i], d = els[i];
    s.chat = on;
    d.querySelector('.chat')?.remove();
    if (on && s.e.ch) {
      const f = document.createElement('iframe'); f.className = 'chat'; f.src = s.e.ch;
      d.appendChild(f);
    }
    paintBar(i); paintChatBtn();
  }
  function action(i, a) {
    const s = slots[i]; if (!s) return;
    if (a === 'x') { clear(i); if (slots.every(x => !x)) closeAll(); TV.refresh(); Zap.render(); return; }
    if (a === 'snd') { AudioMgr.focus('slot' + i); paintActs(); return; }
    if (a === 'chat') { setChat(i, !s.chat); chatOn = s.chat; S.set('chatOn', chatOn); return; }
    if (a === 'out') { window.open(s.e.out, '_blank', 'noopener,width=420,height=720'); return; }
    if (a === 'audio') { s.audio = !s.audio; setAudioQuality(s, s.audio); if (s.audio && s.chat) setChat(i, false); }
    if (a === 'pip') return openPip(i);
    if (a === 'star') return Momentos.capture('slot' + i);
    if (a === 'skip' && s.c.t247) { const n = T247any.randomFor(s.c.t247); if (n && s.api && s.api.p) { s.e.id = n.v; try { s.api.p.loadVideoById({ videoId:n.v }); } catch {} paintActs(); } return; }
    paintBar(i);
  }

  async function openPip(i) {
    const s = slots[i];
    if (!PIP_OK) {
      toast('<b>Ventana flotante en Android</b><small>Poné el video en pantalla completa y tocá el botón de inicio (o deslizá hacia arriba): el video queda flotando.</small>', { cls:'info', ms:12000 });
      return;
    }
    try {
      const w = await documentPictureInPicture.requestWindow({ width:s.chat ? 900 : 640, height:360 });
      const st = w.document.createElement('style');
      st.textContent = 'html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}';
      w.document.head.appendChild(st);
      w.document.title = s.c.name;
      // la ventana flotante carga pip.html (una página nuestra) y esa página muestra el video:
      // así YouTube sabe desde qué sitio se abre y no da el "error 153"
      const base = location.origin + location.pathname.replace(/[^/]*$/, '');
      const pip = base + 'pip.html?v=' + encodeURIComponent(s.e.v) + (s.chat && s.e.ch ? '&ch=' + encodeURIComponent(s.e.ch) : '');
      w.document.body.innerHTML = `<iframe src="${esc(pip)}" allow="autoplay; fullscreen; encrypted-media; picture-in-picture"></iframe>`;
      // en la página dejo un aviso en lugar del video (para que no suene doble)
      AudioMgr.unregister('slot' + i);
      try { s.api && s.api.destroy && s.api.destroy(); } catch {}
      s.seq = ++seq; s.pip = w;
      els[i].querySelector('.vw').innerHTML = `<div class="ph">⧉ Mirando en ventana flotante<br><button class="sm" style="margin-top:8px">Volver acá</button></div>`;
      els[i].querySelector('.vw button').onclick = () => w.close();
      els[i].querySelector('.chat')?.remove(); s.chat = false; paintBar(i);
      AudioMgr.register('slot' + i, { mute() {}, unmute() {}, label:() => s.c.name + ' (ventana flotante)' });
      AudioMgr.focus('slot' + i);
      w.addEventListener('pagehide', () => { if (slots[i] === s) { s.pip = null; mountVideo(i); paintBar(i); } });
    } catch (e) { toast('<b>No se pudo abrir la ventana flotante</b><small>' + esc(e.message) + '</small>', { cls:'info' }); }
  }

  /* ---------- Efecto de tele vieja al cambiar de canal: la imagen se cierra en una línea, nieve, y el número del canal en verde ---------- */
  const fxPrefs = () => S.get('zapFx', { on:true, sound:false });
  let fxAudio = null;
  function zapSound() {
    try {
      fxAudio = fxAudio || new (window.AudioContext || window.webkitAudioContext)();
      const len = fxAudio.sampleRate * 0.35, buf = fxAudio.createBuffer(1, len, fxAudio.sampleRate), d = buf.getChannelData(0);
      for (let i = 0; i < len; i++) d[i] = (Math.random() * 2 - 1) * (1 - i / len);
      const src = fxAudio.createBufferSource(), g = fxAudio.createGain(), f = fxAudio.createBiquadFilter();
      f.type = 'bandpass'; f.frequency.value = 3000; g.gain.value = 0.12; src.buffer = buf; src.connect(f).connect(g).connect(fxAudio.destination); src.start();
    } catch {}
  }
  function zapFx(i, c) {
    const p = fxPrefs(), d = els[i]; if (!p.on || !d) return;
    // se dibuja sobre la parte del video (no encima del chat)
    const vw = d.querySelector('.vw'), box = vw ? `left:${vw.offsetLeft}px;top:${vw.offsetTop}px;width:${vw.offsetWidth}px;height:${vw.offsetHeight}px` : 'inset:0';
    d.querySelectorAll('.zfx, .zosd').forEach(x => x.remove());
    const fx = document.createElement('div'); fx.className = 'zfx'; fx.style.cssText = box;
    const cv = document.createElement('canvas'); cv.width = 160; cv.height = 90; fx.appendChild(cv); d.appendChild(fx);
    const ctx = cv.getContext('2d'), img = ctx.createImageData(160, 90), t0 = performance.now() - (Lite.on ? 9999 : 0);   // liviano: sin nieve, solo el número
    const snow = now => {
      if (!fx.isConnected) return;
      for (let k = 0; k < img.data.length; k += 4) { const v = Math.random() * 255 | 0; img.data[k] = img.data[k + 1] = img.data[k + 2] = v; img.data[k + 3] = 255; }
      ctx.putImageData(img, 0, 0);
      if (now - t0 < 650) requestAnimationFrame(snow); else { fx.classList.add('out'); setTimeout(() => fx.remove(), 300); }
    };
    requestAnimationFrame(snow);
    if (p.sound) zapSound();
    const num = c && db.chans.includes(c) ? Canales.numTxt(c) : '';
    const osd = document.createElement('div'); osd.className = 'zosd'; if (vw) osd.style.right = (d.offsetWidth - vw.offsetLeft - vw.offsetWidth) + vw.offsetWidth * 0.05 + 'px';
    osd.innerHTML = `${num ? `<b>${esc(num)}</b>` : ''}<span>${esc((c?.name || '').toUpperCase())}</span>`;
    d.appendChild(osd); setTimeout(() => osd.classList.add('out'), 2600); setTimeout(() => osd.remove(), 3200);
  }
  /* ---------- 📡 Seguir el vivo ----------
     A veces YouTube corta el vivo y el canal arranca otro con un video nuevo: el reproductor se quedaba en el viejo.
     Si el video termina, da error o se tranca, (y cada 4 minutos por las dudas) busco el vivo actual del canal y me paso solo. */
  async function follow() {
    for (let i = 0; i < 4; i++) {
      const s = slots[i]; if (!s || s.e.kind !== 'youtube' || s.c.platform !== 'youtube' || s.c.ref.video || s.c.t247 || s.following) continue;
      const now = Date.now(), stuck = (s.yst === 3 || s.yst === -1) && now - (s.ystAt || now) > 30e3;
      const due = s.dead || stuck ? now - (s.chkAt || 0) > (s.gone ? 60e3 : 15e3) : now - (s.chkAt || s.t0 || now) > 4 * 60e3;
      if (!due) continue;
      s.following = true; s.chkAt = now;
      try {
        const st = await Canales.checkOne(s.c);
        if (slots[i] !== s) continue;
        if (st.st === 'live' && st.vid && st.vid !== s.e.id) {
          const chat = s.chat; s.e = embedOf(s.c); s.dead = s.gone = false; s.yst = null; s.t0 = Date.now();
          mountVideo(i); if (chat) { setChat(i, false); setChat(i, true); } paintBar(i);
          toast(`📡 <b>${esc(s.c.name)}</b>: el vivo se reinició, ya te pasé al nuevo`, { cls:'info', ms:4000 });
        } else if (s.dead && st.st !== 'live' && !s.gone) {
          s.gone = true;
          toast(`📴 <b>${esc(s.c.name)}</b> terminó el vivo<small>Sigo atento: si vuelve, lo pongo solo.</small>`, { cls:'info', ms:5000 });
        } else if ((s.dead || stuck) && !db.key && s.c.ref.channelId) {   // sin clave de YouTube: el reproductor "vivo del canal" de YouTube
          s.e = { ...s.e, id:null, v:`https://www.youtube.com/embed/live_stream?channel=${s.c.ref.channelId}&autoplay=1&playsinline=1&enablejsapi=1${clean()}&origin=${encodeURIComponent(location.origin)}` }; s.dead = false; mountVideo(i);
        }
      } catch {} finally { s.following = false; }
    }
  }
  setInterval(() => { if (!document.hidden || slots.some(Boolean)) follow(); }, 10e3);

  /* ---------- ⏯ Seguir viendo: los videos largos (retro, resúmenes, Vélez…) recuerdan dónde quedaste ---------- */
  let resumeSaved = 0;
  function remember() {
    let changed = false; db.resume = db.resume || {};
    for (const s of slots) {
      if (!s || s.e.kind !== 'youtube' || !s.c.ref.video || s.c.t247 || s.c.noResume || !s.api?.p) continue;
      let t = 0, d = 0, title = ''; try { t = s.api.p.getCurrentTime(); d = s.api.p.getDuration(); title = s.api.p.getVideoData?.().title || ''; } catch {}
      const v = s.c.ref.video;
      if (!(d > 300) || t < 60) continue;                       // solo videos largos y ya empezados
      if (t > d * 0.95) { if (db.resume[v]) { delete db.resume[v]; changed = true; } continue; }   // terminado
      db.resume[v] = { t:Math.floor(t), d:Math.floor(d), n:s.c.name, title:title || db.resume[v]?.title || s.c.name, at:Date.now() }; changed = true;
    }
    if (!changed) return;
    const keep = Object.entries(db.resume).sort((a, b) => b[1].at - a[1].at).slice(0, 24); db.resume = Object.fromEntries(keep);
    if (Date.now() - resumeSaved > 120e3) { resumeSaved = Date.now(); save(); } else saveLocal();
  }
  setInterval(remember, 15e3);

  function play(c, opts = {}) {
    const r = c.ref?.video && !c.t247 && !c.noResume && opts.start == null && db.resume?.[c.ref.video];
    if (r && r.t > 30) { opts = { ...opts, start:Math.max(0, r.t - 5) }; toast(`⏯ Seguís desde ${Math.floor(r.t / 60)}:${String(r.t % 60).padStart(2, '0')}`, { ms:2500 }); }
    const e = embedOf(c), st = Canales.status[c.uid] || {};
    const target = sel;
    if (opts.start && e.kind === 'youtube') e.v += '&start=' + Math.floor(opts.start);
    clear(sel);
    const liveish = st.st === 'live' || st.st === 'soon' || (c.platform !== 'youtube' && st.st !== 'off');
    slots[sel] = { c, e, chat:false, audio:!!opts.audio, t0:Date.now() }; focus = sel;
    $('player').classList.add('show');
    mountVideo(sel); paintBar(sel);
    // con una sola pantalla, el chat se abre solo al lado si es un vivo
    if (layout === 1 && e.ch && liveish && !opts.audio && chatOn && !Lite.on) setChat(sel, true);   // liviano: el chat (pesadísimo) solo si lo pedís
    if (Lite.tv && !opts.audio && !$('player').classList.contains('tvmode')) TV.open();   // en la tele: directo a pantalla completa
    zapFx(target, c);
    try { InfoBar.forChannel(c); } catch {}
    if (layout > 1) { const empty = slots.findIndex((x, j) => !x && j < layout); if (empty >= 0) sel = empty; paintSel(); }
    $('scroller').scrollTo({ top:0, behavior:'smooth' });
    TV.refresh(); Zap.render(); paintChatBtn();
  }
  function closeAll() { for (let i = 0; i < 4; i++) clear(i); if (!$('player').classList.contains('tvmode')) $('player').classList.remove('show'); TV.refresh(); }

  return { zapFx, paintActs, build, play, closeAll, embedOf, get layout() { return layout; }, get slots() { return slots; }, get sel() { return sel; } };
})();
