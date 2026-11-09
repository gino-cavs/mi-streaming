/* =========================================================
   Música: tus playlists, álbumes y temas de YouTube Music.
   Suena con un reproductor de YouTube chiquito en la barra de abajo.
   Si tenés la sesión de YouTube (Premium) iniciada en ese navegador, YouTube la reconoce.
   ========================================================= */
const Musica = (() => {
  let p = null, cur = null, track = null, ready = false, errs = 0, shuffle = S.get('musShuffle', false), poll = null, hidden = S.get('musHideVid', false);

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

  /* ---------- 💿 Álbum del día (lo elige GitHub: género al azar + álbum de Wikidata + temas oficiales de YouTube) ---------- */
  let album = S.get('albumDia', null), albAt = 0;
  async function loadAlbum() {
    if (Date.now() - albAt < 3600e3) return; albAt = Date.now();
    try { const j = await (await fetch(REPO.data + 'album.json?t=' + Math.floor(Date.now() / 3600e3))).json(); if (j?.ids?.length && j.date !== album?.date) { album = j; S.set('albumDia', j); if (Nav.current === 'musica') render(); } } catch {}
  }
  const albumItem = a => ({ id:'alb-' + a.date, kind:'list', ref:'alb-' + a.date, ids:a.ids, name:a.album, by:a.artist, count:a.ids.length, thumb:a.thumb });
  function albumCard() {
    if (!album) return '';
    const it = albumItem(album), on = cur && cur.id === it.id, saved = db.music.items.some(i => i.ref === it.ref);
    return `<div class="albdia">
      <div class="albcov" style="background-image:url('${esc(album.thumb)}')" data-alb="play" tabindex="0"><span class="muplay">${on && p && st() === 1 ? '❚❚' : '▶'}</span></div>
      <div class="albtx"><span class="albtag">💿 Álbum del día · ${esc(album.genre)}</span>
        <b>${esc(album.album)}</b><span>${esc(album.artist)}${album.year ? ' · ' + esc(album.year) : ''} · ${album.ids.length} temas</span>
        <div class="btns"><button class="pri" data-alb="play">${on ? '🎵 Sonando' : '▶ Escuchar'}</button>
          <button data-alb="ytm" title="Buscar el álbum completo en YouTube Music">↗ Completo en YouTube Music</button>
          ${album.wiki ? `<a class="lnk" href="${esc(album.wiki)}" target="_blank" rel="noopener">📖 Wikipedia</a>` : ''}
          <button data-alb="save" ${saved ? 'disabled' : ''}>${saved ? '✓ Guardado' : '＋ Guardar'}</button></div>
        <small class="mut">Mañana, otro género. Suenan los temas oficiales que encontré del álbum (pueden no estar todos ni en orden).</small></div></div>`;
  }
  function albumClicks(v) {
    v.querySelectorAll('[data-alb]').forEach(b => b.onclick = () => {
      const it = albumItem(album), a = b.dataset.alb;
      if (a === 'play') { if (cur && cur.id === it.id && p) toggle(); else play(it); }
      if (a === 'ytm') window.open(`https://music.youtube.com/search?q=${encodeURIComponent(album.artist + ' ' + album.album)}`, '_blank');
      if (a === 'save' && !db.music.items.some(i => i.ref === it.ref)) { db.music.items.unshift({ ...it, id:uid() }); save(); render(); toast('💿 Guardado en tu música', { ms:2000 }); }
    });
  }

  /* ---------- Pantalla ---------- */
  function render() {
    const v = $('v-musica');
    loadAlbum();
    v.innerHTML = albumCard() + `
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
          <b>${esc(it.name || it.ref)}</b><span>${esc([it.kind === 'playlist' || it.kind === 'list' ? (it.count ? it.count + ' temas' : 'Playlist') : 'Tema', it.by].filter(Boolean).join(' · '))}</span>
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
    albumClicks(v);
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = ev => { ev.stopPropagation(); db.music.items = db.music.items.filter(i => i.id !== b.dataset.del); save(); render(); });
    v.querySelectorAll('[data-mu]').forEach(c => c.onclick = () => { const it = db.music.items.find(i => i.id === c.dataset.mu); if (cur && cur.id === it.id && p) toggle(); else play(it); });
  }

  /* ---------- Reproductor ---------- */
  const st = () => { try { return p.getPlayerState(); } catch { return -1; } };
  function toggle() { if (!p) return; st() === 1 ? p.pauseVideo() : p.playVideo(); }
  async function play(it) {
    cur = it; track = null; lastErr = null; note('');
    document.body.classList.add('hasmusic');
    bar();
    try { await loadScript('https://www.youtube.com/iframe_api'); }
    catch { toast('<b>No se pudo cargar el reproductor de YouTube</b><small>Revisá la conexión o el bloqueador de anuncios.</small>', { cls:'info' }); return; }
    // espero a que YouTube esté listo (con tope: si no llega, aviso en vez de quedarme mudo)
    const okApi = await Promise.race([new Promise(r => { if (window.YT && YT.Player) return r(true); const prev = window.onYouTubeIframeAPIReady; window.onYouTubeIframeAPIReady = () => { prev && prev(); r(true); }; const t = setInterval(() => { if (window.YT && YT.Player) { clearInterval(t); r(true); } }, 300); }), new Promise(r => setTimeout(() => r(false), 12000))]);
    if (!okApi || cur !== it) { if (!okApi) { note('YouTube no respondió. Revisá la conexión o un bloqueador de anuncios.'); } return; }
    if (p) { try { p.destroy(); } catch {} p = null; }
    $('muVid').innerHTML = '<div id="muYT"></div>';
    const vars = { autoplay:1, playsinline:1, rel:0, origin:location.origin };
    // Las playlists por ID no le arrancan a YouTube desde afuera en algunos aparatos: si hay clave de YouTube,
    // leo los temas y las paso tema por tema (igual que el álbum del día, que sí anda).
    let ids = it.kind === 'list' ? it.ids : null;
    if (it.kind === 'playlist' && db.key) {
      ids = await playlistIds(it);
      if (cur !== it) return;
      if (ids && shuffle) ids = ids.map(v => [Math.random(), v]).sort((a, b) => a[0] - b[0]).map(x => x[1]);
    }
    if (ids?.length) vars.playlist = ids.slice(1, 150).join(',');   // armada tema por tema
    else if (it.kind === 'playlist') { vars.listType = 'playlist'; vars.list = it.ref; }
    p = new YT.Player('muYT', { width:'100%', height:'100%', videoId:it.kind === 'video' ? it.ref : ids?.length ? ids[0] : (it.first || undefined), playerVars:vars,
      events:{
        onReady:() => { ready = true; errs = 0; p.playVideo(); if (shuffle && it.kind === 'playlist' && !ids?.length) applyShuffle(true); kick(it); },
        onStateChange:e => { if (e.data === 1) { AudioMgr.focus('music'); errs = 0; note(''); } upd(); },
        onError:e => {
          lastErr = e.data; note(ERR[e.data] || 'YouTube dio el error ' + e.data);
          if (e.data === 101 || e.data === 150 || e.data === 100 || e.data === 153) {
            errs++;
            if (errs >= 3 || (it.kind !== 'playlist' && it.kind !== 'list')) {
              toast(`<b>${it.kind === 'playlist' ? 'Varios temas seguidos' : 'Este tema'} no se pueden escuchar fuera de YouTube</b><small>Los sellos bloquean algunos temas. Tocá acá para abrirlo en YouTube Music.</small>`, { cls:'info', ms:12000, onclick:() => window.open(ytmUrl(), '_blank') });
              if (errs >= 6 || (it.kind !== 'playlist' && it.kind !== 'list')) return;
            }
            try { p.nextVideo(); } catch {}
          }
        } } });
    clearInterval(poll); poll = setInterval(upd, 2000);
    if (Nav.current === 'musica') render();
  }
  /* Temas de una playlist (con tu clave de YouTube; 1 unidad cada 50 temas). Guardados un rato para no gastar. */
  const plCache = {};
  async function playlistIds(it) {
    const c = plCache[it.ref]; if (c && Date.now() - c.at < 30 * 60e3) return c.ids;
    const ids = []; let page = '';
    try {
      do {
        const j = await Canales.yt('playlistItems', { part:'contentDetails,status', playlistId:it.ref, maxResults:50, ...(page ? { pageToken:page } : {}) });
        (j.items || []).forEach(x => { if (x.status?.privacyStatus !== 'private' && x.contentDetails?.videoId) ids.push(x.contentDetails.videoId); });
        page = j.nextPageToken || '';
      } while (page && ids.length < 200);
    } catch (e) {
      note(/cannot be found|not.?found|404|private|forbidden/i.test(e.message || '') ? 'Esa playlist es privada: en YouTube Music ponela como "No listada" y va a sonar.' : e.message);
      return null;
    }
    if (it.kind === 'playlist' && ids.length && it.count !== ids.length) { it.count = ids.length; save(); }
    plCache[it.ref] = { ids, at:Date.now() }; return ids;
  }
  /* Si a los pocos segundos no suena: el navegador frenó el arranque automático. Pruebo arrancar en silencio
     (eso siempre se permite) y subir el volumen; si tampoco, te pido que toques ▶ y te digo qué pasa. */
  let lastErr = null;
  const ERR = { 2:'El link de la lista no es válido.', 5:'El reproductor de YouTube falló en este aparato.', 100:'Ese tema o lista ya no existe (o es privado).',
    101:'El sello no deja escuchar este tema fuera de YouTube.', 150:'El sello no deja escuchar este tema fuera de YouTube.', 153:'YouTube no reconoció desde dónde se pide (falta el origen).' };
  function note(t) { const n = $('muNote'); if (n) { n.textContent = t; n.hidden = !t; } }
  function kick(it) {
    setTimeout(() => {
      if (cur !== it || !p || st() === 1 || st() === 3) return;
      try { p.mute(); p.playVideo(); } catch {}
      setTimeout(() => {
        if (cur !== it || !p) return;
        if (st() === 1) { try { p.unMute(); } catch {} AudioMgr.focus('music'); return; }
        note(lastErr ? ERR[lastErr] || 'YouTube dio el error ' + lastErr : 'No arrancó solo: tocá ▶ para que suene.');
      }, 1800);
    }, 3500);
  }
  // el aleatorio necesita que YouTube ya haya cargado la lista: espero a que esté y arranco en un tema al azar
  function applyShuffle(start) {
    let n = 0;
    const t = setInterval(() => {
      let pl = null; try { pl = p && p.getPlaylist(); } catch {}
      if (pl && pl.length) { clearInterval(t); try { p.setShuffle(true); if (start) p.playVideoAt(Math.floor(Math.random() * pl.length)); } catch {} }
      else if (++n > 40) clearInterval(t);
    }, 250);
  }
  const ytmUrl = () => cur?.kind === 'list' && !track?.vid ? `https://music.youtube.com/search?q=${encodeURIComponent(cur.by + ' ' + cur.name)}` : track?.vid ? `https://music.youtube.com/watch?v=${track.vid}${cur?.kind === 'playlist' ? '&list=' + cur.ref : ''}` : cur?.kind === 'playlist' ? `https://music.youtube.com/playlist?list=${cur.ref}` : `https://music.youtube.com/watch?v=${cur?.ref}`;
  function upd() {
    if (!p || !p.getVideoData) return;
    try { const d = p.getVideoData(); if (d && d.title) track = { title:d.title, by:(d.author || '').replace(/ - Topic$/, ''), vid:d.video_id }; } catch {}
    const t = $('muT'); if (!t) return;
    t.innerHTML = `<b>${esc(track?.title || cur?.name || '')}</b><span>${esc(track?.by || cur?.by || '')}${cur && cur.kind === 'playlist' ? ' · ' + esc(cur.name || '') : ''}</span>`;
    $('muPlay').textContent = st() === 1 ? '❚❚' : '▶';
    if (track && track.vid && $('muLike').dataset.v !== track.vid) { $('muLike').dataset.v = track.vid; $('muLike').innerHTML = Likes.btn(track.vid, track.title); Likes.status(track.vid); }
    $('muSnd').textContent = p.isMuted && p.isMuted() ? '🔇' : '🔊';
    // las tarjetas de la sección muestran lo que suena de verdad
    document.querySelectorAll('#v-musica [data-mu]').forEach(c => { const on = cur && c.dataset.mu === cur.id; c.classList.toggle('playing', !!on); const pb = c.querySelector('.muplay'); if (pb) pb.textContent = on && st() === 1 ? '❚❚' : '▶'; });
  }
  function bar() {
    const b = $('musicbar');
    if (!cur) { b.classList.remove('show'); document.body.classList.remove('hasmusic'); return; }
    if (!b.dataset.built) {
      b.dataset.built = 1;
      b.innerHTML = `<div class="muvid" id="muVid"></div>
        <div class="tx" id="muT"></div><span class="munote" id="muNote" hidden></span>
        <button id="muPrev" title="Anterior">⏮</button><button id="muPlay">▶</button><button id="muNext" title="Siguiente">⏭</button>
        <button id="muShuf" title="Aleatorio">🔀</button><button id="muSnd" title="Escuchar esto">🔊</button>
        <input type="range" id="muVol" min="0" max="100" step="5" value="100">
        <button id="muHide" title="Mostrar u ocultar el video">🎬</button>
        <span id="muLike"></span><button id="muYtm" title="Abrir en YouTube Music">↗</button><button id="muStar" title="Guardar este momento">⭐</button><button id="muTv" title="Pantalla TV">📺</button><button id="muX" title="Cerrar">✕</button>`;
      $('muPrev').onclick = () => { try { p.previousVideo(); } catch {} };
      $('muNext').onclick = () => { try { p.nextVideo(); } catch {} };
      $('muPlay').onclick = toggle;
      $('muShuf').onclick = () => { shuffle = !shuffle; S.set('musShuffle', shuffle); $('muShuf').classList.toggle('on', shuffle); try { if (shuffle) { applyShuffle(false); } else p.setShuffle(false); } catch {} toast(shuffle ? '🔀 Aleatorio activado' : '➡️ En orden', { ms:2000 }); };
      $('muYtm').onclick = () => window.open(ytmUrl(), '_blank');
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
