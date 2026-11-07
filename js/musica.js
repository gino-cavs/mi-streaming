/* =========================================================
   Música: tus playlists, álbumes y temas de YouTube Music.
   Suena con un reproductor de YouTube chiquito en la barra de abajo.
   Si tenés la sesión de YouTube (Premium) iniciada en ese navegador, YouTube la reconoce.
   ========================================================= */
const Musica = (() => {
  let p = null, cur = null, track = null, ready = false, shuffle = S.get('musShuffle', false), poll = null, hidden = S.get('musHideVid', false);

  /* ---------- Leer links de YouTube Music / YouTube ---------- */
  function parse(raw) {
    let s = raw.trim(); if (!s) return null;
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    let u; try { u = new URL(s); } catch { return null; }
    const h = u.hostname.replace(/^(www|m)\./, '');
    if (!/(^|\.)youtube\.com$|^youtu\.be$/.test(h)) return null;
    const list = u.searchParams.get('list'), v = u.searchParams.get('v') || (h === 'youtu.be' ? u.pathname.slice(1) : null);
    if (list && !/^(RD|LM$|LL$)/.test(list)) return { kind:'playlist', ref:list, first:v || null };
    if (v) return { kind:'video', ref:v };
    if (u.pathname.startsWith('/browse/')) return { kind:'browse', ref:u.pathname.split('/')[2] };
    return null;
  }
  async function info(it) {
    // nombre y tapa: con la clave de YouTube (si está cargada)
    if (!db.key) return;
    try {
      if (it.kind === 'playlist') {
        const j = await Canales.yt('playlists', { part:'snippet,contentDetails', id:it.ref });
        const x = j.items?.[0]; if (!x) return;
        it.name = it.name || x.snippet.title.replace(/^Album - /, ''); it.by = x.snippet.channelTitle.replace(/ - Topic$/, ''); it.count = x.contentDetails.itemCount;
        it.thumb = (x.snippet.thumbnails.high || x.snippet.thumbnails.medium || x.snippet.thumbnails.default).url;
      } else {
        const j = await Canales.yt('videos', { part:'snippet', id:it.ref });
        const x = j.items?.[0]; if (!x) return;
        it.name = it.name || x.snippet.title; it.by = x.snippet.channelTitle.replace(/ - Topic$/, '');
        it.thumb = (x.snippet.thumbnails.high || x.snippet.thumbnails.medium).url;
      }
    } catch {}
  }

  /* ---------- Pantalla ---------- */
  function render() {
    const v = $('v-musica');
    v.innerHTML = `
      <div class="box">
        <form id="muForm" class="rsearch" style="margin:0">
          <input id="muUrl" placeholder="Pegá un link de YouTube Music: playlist, álbum o tema">
          <input id="muName" placeholder="Nombre (opcional)" style="max-width:220px">
          <button class="pri">Agregar</button>
        </form>
        <p class="mut" style="font-size:12px;margin-top:8px">En YouTube Music tocá <b>⋮ → Compartir → Copiar</b> sobre una playlist, un álbum o un tema y pegalo acá. Las listas “Me gusta” y las mixes automáticas no se pueden reproducir desde afuera de YouTube.</p>
        <div class="msg" id="muMsg"></div>
      </div>
      ${db.music.items.length ? `<div class="mugrid">${db.music.items.map(it => `
        <div class="mucard ${cur && cur.id === it.id ? 'playing' : ''}" tabindex="0" data-mu="${it.id}">
          <div class="mucover" style="${it.thumb ? `background-image:url('${esc(it.thumb)}')` : ''}">${it.thumb ? '' : '🎵'}<span class="muplay">${cur && cur.id === it.id && p && st() === 1 ? '❚❚' : '▶'}</span></div>
          <b>${esc(it.name || it.ref)}</b><span>${esc([it.kind === 'playlist' ? (it.count ? it.count + ' temas' : 'Playlist') : 'Tema', it.by].filter(Boolean).join(' · '))}</span>
          <button class="mudel" data-del="${it.id}" title="Quitar">✕</button>
        </div>`).join('')}</div>`
        : '<div class="empty">Todavía no agregaste música. Pegá arriba el link de una playlist o un álbum de YouTube Music.</div>'}`;
    $('muForm').onsubmit = async e => {
      e.preventDefault();
      const m = $('muMsg'), x = parse($('muUrl').value);
      if (!x) { m.className = 'msg err'; m.textContent = 'No reconocí ese link. Usá el de "Compartir" de una playlist, álbum o tema.'; return; }
      if (x.kind === 'browse') { m.className = 'msg err'; m.textContent = 'Ese es el link de la página del álbum. Abrí el álbum, tocá ⋮ → Compartir y pegá ese link (empieza con music.youtube.com/playlist?list=…).'; return; }
      if (db.music.items.some(i => i.ref === x.ref)) { m.className = 'msg'; m.textContent = 'Ya lo tenías.'; return; }
      const it = { id:uid(), ...x, name:$('muName').value.trim() };
      m.className = 'msg'; m.textContent = 'Agregando…';
      await info(it);
      db.music.items.unshift(it); save(); render();
    };
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = ev => { ev.stopPropagation(); db.music.items = db.music.items.filter(i => i.id !== b.dataset.del); save(); render(); });
    v.querySelectorAll('[data-mu]').forEach(c => c.onclick = () => { const it = db.music.items.find(i => i.id === c.dataset.mu); if (cur && cur.id === it.id && p) toggle(); else play(it); });
  }

  /* ---------- Reproductor ---------- */
  const st = () => { try { return p.getPlayerState(); } catch { return -1; } };
  function toggle() { if (!p) return; st() === 1 ? p.pauseVideo() : p.playVideo(); }
  async function play(it) {
    cur = it; track = null;
    document.body.classList.add('hasmusic');
    bar();
    try { await loadScript('https://www.youtube.com/iframe_api'); }
    catch { toast('<b>No se pudo cargar el reproductor de YouTube</b><small>Revisá la conexión o el bloqueador de anuncios.</small>', { cls:'info' }); return; }
    await new Promise(r => { if (window.YT && YT.Player) return r(); const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev && prev(); r(); }; });
    if (p) { try { p.destroy(); } catch {} p = null; }
    $('muVid').innerHTML = '<div id="muYT"></div>';
    const vars = { autoplay:1, playsinline:1, rel:0, origin:location.origin };
    if (it.kind === 'playlist') { vars.listType = 'playlist'; vars.list = it.ref; }
    p = new YT.Player('muYT', { width:'100%', height:'100%', videoId:it.kind === 'video' ? it.ref : (it.first || undefined), playerVars:vars,
      events:{
        onReady:() => { ready = true; if (shuffle && it.kind === 'playlist') { try { p.setShuffle(true); p.playVideoAt(0); } catch {} } p.playVideo(); },
        onStateChange:e => { if (e.data === 1) AudioMgr.focus('music'); upd(); },
        onError:e => {
          if (e.data === 101 || e.data === 150 || e.data === 100) {
            toast('<b>Ese tema no se puede escuchar fuera de YouTube</b><small>Paso al siguiente.</small>', { cls:'info', ms:5000 });
            try { p.nextVideo(); } catch {}
          }
        } } });
    clearInterval(poll); poll = setInterval(upd, 2000);
    if (Nav.current === 'musica') render();
  }
  function upd() {
    if (!p || !p.getVideoData) return;
    try { const d = p.getVideoData(); if (d && d.title) track = { title:d.title, by:(d.author || '').replace(/ - Topic$/, ''), vid:d.video_id }; } catch {}
    const t = $('muT'); if (!t) return;
    t.innerHTML = `<b>${esc(track?.title || cur?.name || '')}</b><span>${esc(track?.by || cur?.by || '')}${cur && cur.kind === 'playlist' ? ' · ' + esc(cur.name || '') : ''}</span>`;
    $('muPlay').textContent = st() === 1 ? '❚❚' : '▶';
    if (track && track.vid && $('muLike').dataset.v !== track.vid) { $('muLike').dataset.v = track.vid; $('muLike').innerHTML = Likes.btn(track.vid, track.title); Likes.status(track.vid); }
    $('muSnd').textContent = p.isMuted && p.isMuted() ? '🔇' : '🔊';
  }
  function bar() {
    const b = $('musicbar');
    if (!cur) { b.classList.remove('show'); document.body.classList.remove('hasmusic'); return; }
    if (!b.dataset.built) {
      b.dataset.built = 1;
      b.innerHTML = `<div class="muvid" id="muVid"></div>
        <div class="tx" id="muT"></div>
        <button id="muPrev" title="Anterior">⏮</button><button id="muPlay">▶</button><button id="muNext" title="Siguiente">⏭</button>
        <button id="muShuf" title="Aleatorio">🔀</button><button id="muSnd" title="Escuchar esto">🔊</button>
        <input type="range" id="muVol" min="0" max="100" step="5" value="100">
        <button id="muHide" title="Mostrar u ocultar el video">🎬</button>
        <span id="muLike"></span><button id="muStar" title="Guardar este momento">⭐</button><button id="muTv" title="Pantalla TV">📺</button><button id="muX" title="Cerrar">✕</button>`;
      $('muPrev').onclick = () => { try { p.previousVideo(); } catch {} };
      $('muNext').onclick = () => { try { p.nextVideo(); } catch {} };
      $('muPlay').onclick = toggle;
      $('muShuf').onclick = () => { shuffle = !shuffle; S.set('musShuffle', shuffle); $('muShuf').classList.toggle('on', shuffle); try { p.setShuffle(shuffle); } catch {} };
      $('muSnd').onclick = () => AudioMgr.focus('music');
      $('muVol').oninput = e => { try { p.setVolume(+e.target.value); if (p.isMuted()) AudioMgr.focus('music'); } catch {} };
      $('muHide').onclick = () => { hidden = !hidden; S.set('musHideVid', hidden); b.classList.toggle('novid', hidden); document.body.classList.toggle('musnovid', hidden); };
      $('muTv').onclick = () => TV.open();
      $('muStar').onclick = () => Momentos.capture('music');
      $('muX').onclick = stop;
    }
    $('muShuf').classList.toggle('on', shuffle);
    b.classList.toggle('novid', hidden); document.body.classList.toggle('musnovid', hidden);
    b.classList.add('show');
    upd();
  }
  function stop() {
    try { p && p.destroy(); } catch {}
    p = null; cur = null; track = null; clearInterval(poll);
    $('muVid').innerHTML = ''; bar();
    if (Nav.current === 'musica') render();
    TV.refresh();
  }

  function init() {
    AudioMgr.register('music', {
      mute() { try { p && p.mute(); } catch {} }, unmute() { try { p && p.unMute(); } catch {} },
      label:() => cur ? (track?.title || cur.name || 'Música') : '', music:true, live:() => false,
      paused:() => st() !== 1, toggle,
      muted:() => { try { return p.isMuted(); } catch { return false; } },
      getVol:() => { try { return p.getVolume() / 100; } catch { return 1; } },
      setVol:v => { try { p.setVolume(Math.round(v * 100)); if (v > 0 && p.isMuted()) AudioMgr.focus('music'); } catch {} }
    });
    onChange(() => { if (Nav.current === 'musica') render(); });
  }
  return { time:() => { try { return p.getCurrentTime(); } catch { return 0; } }, init, render, play, get current() { return cur; }, get track() { return track; }, get playing() { return st() === 1; } };
})();
