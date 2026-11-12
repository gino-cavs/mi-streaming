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
  const NATIVE = () => { try { return !!window.FUNVSNative?.hasPip?.(); } catch { return false; } };
  const ANDROID = /Android/i.test(navigator.userAgent);

  // v = video, ch = chat embebido oscuro, out = chat en ventana aparte
  // sin la barra ni el título de YouTube (se maneja todo con los botones de FUNVS). Se apaga en Ajustes.
  const clean = () => S.get('ytClean', true) ? '&controls=0&rel=0&iv_load_policy=3&disablekb=1&fs=0&cc_load_policy=0' : '&rel=0&cc_load_policy=0';
  // 📼 videos y vivos ya emitidos: con la barra de YouTube para adelantar y atrasar (on demand)
  const cleanVod = () => '&controls=1&rel=0&iv_load_policy=3&fs=0&cc_load_policy=0';
  // 💬 sin subtítulos: YouTube los prende solo si tu cuenta los tiene activados
  const noCC = p => { try { p.unloadModule('captions'); } catch {} try { p.unloadModule('cc'); } catch {} try { p.setOption('captions', 'track', {}); } catch {} };
  function embedOf(c) {
    const s = Canales.status[c.uid] || {};
    if (c.platform === 'twitch') return { kind:'twitch', id:c.ref.name,
      v:`https://player.twitch.tv/?channel=${c.ref.name}&parent=${HOST}&autoplay=true`,
      ch:`https://www.twitch.tv/embed/${c.ref.name}/chat?parent=${HOST}&darkpopout`, out:`https://www.twitch.tv/popout/${c.ref.name}/chat?darkpopout` };
    if (c.platform === 'kick') return { kind:'kick', id:c.ref.name,
      v:`https://player.kick.com/${c.ref.name}?autoplay=true`,
      ch:`https://kick.com/popout/${c.ref.name}/chat`, out:`https://kick.com/popout/${c.ref.name}/chat` };
    const isLive = s.st === 'live' || s.st === 'soon';
    // canal que figura apagado: primero pruebo "el vivo del canal" de YouTube (por si tiene uno que FUNVS no vio);
    // si en unos segundos no arranca, paso a su último video
    if (!isLive && !c.ref.video && c.ref.channelId && !c._noTry)
      return { kind:'youtube', id:null, tryLive:true, fallback:s.vid || null,
        v:`https://www.youtube.com/embed/live_stream?channel=${c.ref.channelId}&autoplay=1&playsinline=1&enablejsapi=1${clean()}&origin=${encodeURIComponent(location.origin)}`, ch:null };
    const vid = isLive ? s.vid : (c.ref.video || s.vid);
    if (vid) return { kind:'youtube', id:vid,
      v:`https://www.youtube.com/embed/${vid}?autoplay=1&playsinline=1&enablejsapi=1${isLive ? clean() : cleanVod()}&origin=${encodeURIComponent(location.origin)}${c.ref.more?.length && !isLive ? '&playlist=' + c.ref.more.join(',') : ''}`,
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
    s.loading = true; clearTimeout(s.snowT); s.snowT = setTimeout(() => snowOff(s, my), 15000);   // la nieve del cambio de canal sigue hasta que se ve (máx. 15 s)
    const sid = 'slot' + i;
    const setMutedUI = m => { s.mutedByApp = m; d.classList.toggle('mutedbyapp', m); };

    if (s.e.kind === 'twitch') {
      const div = document.createElement('div'); div.id = 'tw' + my; vw.appendChild(div);
      TW_API().then(() => {
        if (s.seq !== my) return;
        const p = new Twitch.Player(div.id, { channel:s.e.id, parent:[HOST], width:'100%', height:'100%', autoplay:true, muted:false });
        s.api = { destroy() { div.innerHTML = ''; } , p };
        p.addEventListener(Twitch.Player.READY, () => { try { p.setVolume(S.get('vol', 1)); } catch {} if (s.audio) setAudioQuality(s, true); else Calidad.applyTwitch(p); });
        p.addEventListener(Twitch.Player.PLAY, () => { snowOff(s, my); try { p.setVolume(S.get('vol', 1)); } catch {} if (!s.mutedByApp) AudioMgr.focus(sid); });
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
        // 🔊 el volumen se mantiene al cambiar de canal: lo pongo apenas el reproductor está listo y lo vuelvo a fijar
        // los primeros segundos (YouTube a veces lo resetea solo al arrancar el vivo o al cambiar de calidad)
        const wantVol = () => Math.round(S.get('vol', 1) * 100);
        // 🎧 y que no quede muda: si este es el que tiene que sonar y YouTube lo dejó silenciado (pasaba en el celu con auriculares), lo destrabo
        const pinVol = () => { let n = 0; const t = setInterval(() => { if (s.seq !== my || ++n > 16) return clearInterval(t); try { if (Math.abs(p.getVolume() - wantVol()) > 2) p.setVolume(wantVol());
          if (AudioMgr.active === sid && !s.mutedByApp && !s.audioOff && p.isMuted()) { p.unMute(); if (p.getVolume() < 5) p.setVolume(wantVol() || 100); } } catch {} }, 500); };
        const p = new YT.Player(f, { events:{ onReady:() => { try { p.setVolume(wantVol()); } catch {} pinVol(); noCC(p); }, onApiChange:() => noCC(p), onStateChange:e => {
          // solo cuenta como "empezó a sonar" si veníamos de pausa/inicio (no al terminar de cargar)
          if (e.data === 1 || e.data === 2) snowOff(s, my);
          if (e.data === 3) return;
          if (e.data === 1 && last === null) { noCC(p); Calidad.applyYouTube(p); try { p.setVolume(wantVol()); } catch {} pinVol(); }   // YouTube recuerda el último volumen (ej. el del despertador): siempre arranca con el tuyo
          if (e.data === 0 && s.c.t247) {          // canal 24/7: termina un video y sigue la grilla
            const n = T247any.nextFor(s.c.t247);
            if (n) { s.e.id = n.v; try { p.loadVideoById({ videoId:n.v, startSeconds:n.off }); } catch {} paintActs(); }
          }
          // 📼 fútbol retro / Paso a Paso: subtítulos siempre apagados (YouTube a veces los prende solo por la cuenta o los automáticos)
          if (e.data === 1 && /^retro_/.test(s.c.uid)) { try { p.setOption('captions', 'track', {}); p.unloadModule('captions'); p.unloadModule('cc'); } catch {} }
          if (e.data === 1 && s.e.tryLive) {   // ¡tenía vivo! lo aprendo para la grilla y el chat
            s.e.tryLive = false; clearTimeout(s.tryT);
            let id = null; try { id = p.getVideoData()?.video_id; } catch {}
            if (id) { s.e.id = id; Canales.learn(s.c, id); s.e.ch = `https://www.youtube.com/live_chat?v=${id}&embed_domain=${HOST}&dark_theme=1`; s.e.out = `https://www.youtube.com/live_chat?v=${id}&dark_theme=1`; try { paintBar(i); } catch {} }
          }
          if (e.data === 1 && last !== 1) AudioMgr.focus(sid);
          last = e.data; s.yst = e.data; s.ystAt = Date.now(); nativePlaying();
          if (e.data === 0 && !s.c.t247) s.dead = true; if (e.data === 1) s.dead = false;
          if (e.data === 0 && s.c.onEnd) { let last = true; try { const pl = p.getPlaylist?.(); if (pl && p.getPlaylistIndex() < pl.length - 1) last = false; } catch {} if (last) { const f = s.c.onEnd; s.c.onEnd = null; setTimeout(f, 300); } }
          d.classList.toggle('paused', e.data === 2);
        }, onError:() => { if (s.e.tryLive) return noLive(); s.dead = true; s.ystAt = Date.now(); } } });
        // sin vivo: al último video del canal (o queda el aviso de YouTube si no conozco ninguno)
        const noLive = () => { if (!s.e.tryLive || s.seq !== my) return; clearTimeout(s.tryT); s.c._noTry = true; const fb = s.e.fallback; s.e = embedOf(s.c); delete s.c._noTry; if (fb || s.e.id) { s.e.tryLive = false; mountVideo(i); try { paintBar(i); } catch {} } };
        if (s.e.tryLive) s.tryT = setTimeout(noLive, 9000);
        s.api = { p, destroy() {} };
        // 📺 en la tele (de fondo todo el día): si se pausó sola, se quedó cargando o sin arrancar, la retomo / recargo
        if (Device.mode === 'tv') { let bad = 0; const w = setInterval(() => { if (s.seq !== my) return clearInterval(w);
          let st; try { st = p.getPlayerState(); } catch { return; }
          if (st === 2 && !s.userPause && !document.hidden) { try { p.playVideo(); } catch {} }
          if (st === 3 || st === -1 || st === 5) { if (++bad >= 4) { bad = 0; if (!s.dead) mountVideo(i); } } else bad = 0; }, 15e3); }
        AudioMgr.register(sid, { mute() { try { p.mute(); } catch {} setMutedUI(true); }, unmute() { try { p.unMute(); } catch {} setMutedUI(false); },
          label:() => s.c.name, live:() => { const x = Canales.status[s.c.uid] || {}; return x.st === 'live' && !x.prem; }, prem:() => !!(Canales.status[s.c.uid] || {}).prem && (Canales.status[s.c.uid] || {}).st === 'live',
          paused:() => { try { return p.getPlayerState() !== 1; } catch { return false; } },
          toggle:() => { try { if (p.getPlayerState() === 1) { s.userPause = true; p.pauseVideo(); } else { s.userPause = false; p.playVideo(); } } catch {} },
          // ⏪ ⏩ (también en los vivos con DVR: YouTube deja volver atrás hasta unas horas) y volver al vivo
          seek:d => { try { const t = p.getCurrentTime(), D = p.getDuration(); p.seekTo(Math.max(0, D ? Math.min(t + d, D - 1) : t + d), true); if (p.getPlayerState() === 2) p.playVideo(); } catch {} },
          behind:() => { try { const x = Canales.status[s.c.uid] || {}; if (x.st !== 'live') return 0; return Math.max(0, p.getDuration() - p.getCurrentTime()); } catch { return 0; } },
          toLive:() => { try { p.seekTo(p.getDuration() + 60, true); p.playVideo(); } catch {} },
          muted:() => { try { return p.isMuted(); } catch { return false; } },
          getVol:() => { try { return p.getVolume() / 100; } catch { return 1; } },
          setVol:v => { try { p.setVolume(Math.round(v * 100)); if (v > 0 && p.isMuted()) AudioMgr.focus(sid); } catch {} } });
      }).catch(() => {});
    } else if (s.e.kind === 'kick') {
      // Kick no tiene controles para otras páginas: para silenciar hay que recargar el reproductor
      const f = document.createElement('iframe');
      f.src = s.e.v; f.allow = 'autoplay; fullscreen'; f.allowFullscreen = true; vw.appendChild(f);
      f.onload = () => setTimeout(() => snowOff(s, my), 1800);   // Kick no avisa cuándo arranca
      AudioMgr.register(sid, {
        mute() { if (!s.mutedByApp) { f.src = s.e.v + '&muted=true'; setMutedUI(true); } },
        unmute() { if (s.mutedByApp) { f.src = s.e.v + '&muted=false'; setMutedUI(false); } }
        , label:() => s.c.name, live:() => { const x = Canales.status[s.c.uid] || {}; return x.st === 'live' && !x.prem; }, prem:() => !!(Canales.status[s.c.uid] || {}).prem && (Canales.status[s.c.uid] || {}).st === 'live', muted:() => s.mutedByApp
      });
      setTimeout(() => AudioMgr.focus(sid), 0);
    }
  }
  function snowOff(s, my) {
    if (s.seq !== my) return; clearTimeout(s.snowT); s.loading = false;
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
    const pip = Device.mode !== 'tv' && (PIP_OK || ANDROID || NATIVE()) ? `<button data-a="pip" title="Ventana flotante">⧉ Flotante</button>` : '';
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

  // 🪟 en la app de Android: la ventana flotante del sistema (solo el video, con play/pausa)
  let pipI = -1;
  function nativePlaying() { try { window.FUNVSNative?.playing?.(slots.some(s => s && s.yst === 1 && !s.pip)); } catch {} }
  function pipSlot() { if (pipI >= 0 && slots[pipI]) return pipI; const k = slots.findIndex(s => s && s.yst === 1); return k >= 0 ? k : slots.findIndex(Boolean); }
  function pipToggle() { const s = slots[pipSlot()]; const p = s?.api?.p; if (!p) return false;
    try { if (p.getPlayerState() === 1) { s.userPause = true; p.pauseVideo(); return false; } s.userPause = false; p.playVideo(); return true; } catch { return false; } }
  async function openPip(i) {
    const s = slots[i];
    if (NATIVE()) { pipI = i; window.FUNVSNative.pip(); return; }
    if (!PIP_OK) {
      toast('<b>Ventana flotante en Android</b><small>Poné el video en pantalla completa y tocá el botón de inicio (o deslizá hacia arriba): el video queda flotando.</small>', { cls:'info', ms:12000 });
      return;
    }
    try {
      const w = await documentPictureInPicture.requestWindow({ width:480, height:270 });   // como la ventanita clásica: solo el video
      const st = w.document.createElement('style');
      st.textContent = 'html,body{margin:0;height:100%;background:#000;overflow:hidden}iframe{border:0;width:100%;height:100%;display:block}';
      w.document.head.appendChild(st);
      w.document.title = s.c.name;
      // la ventana flotante carga pip.html (una página nuestra) y esa página muestra el video:
      // así YouTube sabe desde qué sitio se abre y no da el "error 153"
      const base = location.origin + location.pathname.replace(/[^/]*$/, '');
      const pip = base + 'pip.html?v=' + encodeURIComponent(s.e.v);
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
      if (!S.get('pipTip')) { S.set('pipTip', 1); toast('<b>🪟 Ventana flotante</b><small>Se queda arriba de todo y la podés achicar o mover. Si preferís la del navegador (con sus botones propios): en Chrome tocá el ícono ♫ de arriba a la derecha y después el botón de pantalla en pantalla, o hacé clic derecho dos veces sobre el video.</small>', { cls:'info', ms:14000 }); }
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
    // liviano (Fire Stick): nieve más gruesa y a menos cuadros, que casi no gasta; así tampoco queda en negro mientras carga
    const W = Lite.on ? 96 : 160, H = Lite.on ? 54 : 90, FPS = Lite.on ? 80 : 40;
    const cv = document.createElement('canvas'); cv.width = W; cv.height = H; fx.appendChild(cv); d.appendChild(fx);
    const ctx = cv.getContext('2d'), img = ctx.createImageData(W, H), px = new Uint32Array(img.data.buffer), t0 = performance.now();
    let last = 0;
    const snow = now => {
      if (!fx.isConnected) return;
      if (now - last > FPS) { last = now; for (let k = 0; k < px.length; k++) { const v = Math.random() * 255 | 0; px[k] = 0xff000000 | v << 16 | v << 8 | v; } ctx.putImageData(img, 0, 0); }
      // sigue nevando mientras el canal carga (así no queda en negro), y como mínimo el efecto corto de siempre
      if (now - t0 < 650 || (slots[i]?.loading && now - t0 < 15650)) requestAnimationFrame(snow); else { fx.classList.add('out'); setTimeout(() => fx.remove(), 300); }
    };
    requestAnimationFrame(snow);
    if (p.sound) zapSound();
    const num = c && db.chans.includes(c) ? Canales.numTxt(c) : '';
    const osd = document.createElement('div'); osd.className = 'zosd'; if (vw) osd.style.right = (d.offsetWidth - vw.offsetLeft - vw.offsetWidth) + vw.offsetWidth * 0.05 + 'px';
    osd.innerHTML = `${num ? `<b>${esc(num)}</b>` : ''}<span>${esc((c?.name || '').toUpperCase())}</span>`;
    d.appendChild(osd);
    const osdOut = () => { if (!osd.isConnected) return; if (slots[i]?.loading) return setTimeout(osdOut, 400); osd.classList.add('out'); setTimeout(() => osd.remove(), 600); };
    setTimeout(osdOut, 2600);   // el número queda mientras carga
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
      if (t > d * 0.92) { if (db.resume[v]) delete db.resume[v]; db.vistos = db.vistos || {}; if (!db.vistos[v]) { db.vistos[v] = Date.now(); changed = true; } continue; }   // terminado (y queda como visto)
      db.resume[v] = { t:Math.floor(t), d:Math.floor(d), n:s.c.name, title:title || db.resume[v]?.title || s.c.name, at:Date.now() }; changed = true;
    }
    if (!changed) return;
    const keep = Object.entries(db.resume).sort((a, b) => b[1].at - a[1].at).slice(0, 24); db.resume = Object.fromEntries(keep);
    if (Date.now() - resumeSaved > 120e3) { resumeSaved = Date.now(); save(); } else saveLocal();
  }
  setInterval(remember, 15e3);

  let prevC = null;
  function play(c, opts = {}) {
    if (!c?.humor) document.body.classList.remove('oscuro');   // otro canal: chau pantalla negra (pasar a otro video del modo dormir la mantiene)
    const r = c.ref?.video && !c.t247 && !c.noResume && opts.start == null && db.resume?.[c.ref.video];
    if (r && r.t > 30) { opts = { ...opts, start:Math.max(0, r.t - 5) }; toast(`⏯ Seguís desde ${Math.floor(r.t / 60)}:${String(r.t % 60).padStart(2, '0')}`, { ms:2500 }); }
    const e = embedOf(c), st = Canales.status[c.uid] || {};
    const target = sel;
    if (slots[sel]?.c && slots[sel].c.uid !== c.uid && !slots[sel].c.humor) prevC = slots[sel].c;   // para "volver al anterior" (⌫ en el teclado)
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

  return { zapFx, paintActs, build, play, closeAll, embedOf, action, setChat, pipSlot, pipToggle, pipEl:i => els[i],  get prev() { return prevC; }, get layout() { return layout; }, get slots() { return slots; }, get sel() { return sel; } };
})();
