/* =========================================================
   Radios: buscador (Radio Browser, gratis) + mis radios + reproductor abajo
   ========================================================= */
const Radio = (() => {
  const SERVERS = ['de1', 'de2', 'fi1', 'nl1', 'at1'];
  let audio, hls = null, cur = null, results = [], searching = false;

  async function rb(path) {
    for (const s of SERVERS) {
      try {
        const r = await fetch(`https://${s}.api.radio-browser.info/json/${path}`);
        if (r.ok) return await r.json();
      } catch {}
    }
    throw new Error('No pude conectarme con el buscador de radios.');
  }
  const toRadio = s => ({ id:s.stationuuid, name:s.name.trim(), url:s.url_resolved || s.url, logo:s.favicon || '',
    tags:(s.tags || '').split(',').filter(Boolean).slice(0, 3).join(' · '), place:[s.state, s.country].filter(Boolean).join(', '), hls:!!s.hls,
    ...(s.geo_lat != null && s.geo_long != null ? { geo:{ lat:+s.geo_lat, lng:+s.geo_long } } : {}) });

  function rcard(r, saved) {
    const playing = cur && cur.url === r.url;
    return `<div class="rcard ${playing ? 'playing' : ''}" tabindex="0" data-url="${esc(r.url)}">
      <div class="lg" style="${r.logo ? `background-image:url('${esc(r.logo)}')` : ''}">${r.logo ? '' : '📻'}</div>
      <div class="tx"><b>${esc(r.name)}</b><span>${esc(r.tags || r.place || '')}</span></div>
      ${saved ? `<button class="act" data-edr="${esc(r.url)}" title="Editar (nombre, link, logo)">✎</button><button class="act" data-del="${esc(r.url)}" title="Quitar de mis radios">✕</button>`
              : `<button class="act" data-add="${esc(r.url)}" title="Guardar en mis radios">☆</button>`}</div>`;
  }
  /* ---------- ＋ Agregar (o editar) una radio con su link ---------- */
  function linkForm(r) {
    const el = $('rAdd'); el.hidden = false;
    el.innerHTML = `<div class="radd"><h3>${r ? '✎ Editar radio' : '＋ Agregar una radio con su link'}</h3>
      <label>Link del audio<input id="raU" value="${esc(r?.url || '')}" placeholder="https://…/stream.mp3, .aac, .m3u8 o .pls"></label>
      <label>Nombre<input id="raN" value="${esc(r?.name || '')}" placeholder="Ej: Radio del barrio"></label>
      <label>Logo (opcional)<input id="raL" value="${esc(r?.logo || '')}" placeholder="Link de una imagen"></label>
      <small class="mut">Tiene que ser el link del audio (el que suena), no la página de la radio. Si pegás la página, te busco la radio por el nombre.</small>
      <div class="btns"><button type="button" id="raT">▶ Probar</button><span class="sp"></span><button type="button" id="raX">Cancelar</button><button type="button" class="pri" id="raS">💾 Guardar cambios</button></div><div id="raMsg" class="mut"></div></div>`;
    const msg = t => $('raMsg').innerHTML = t;
    const read = () => { let u = $('raU').value.trim(); if (u && !/^https?:\/\//i.test(u)) u = 'https://' + u; return u; };
    const isPage = u => { try { const x = new URL(u); return !/\.(mp3|aac|aacp|m3u8?|pls|ogg|opus|flac)(\?|$)/i.test(x.pathname) && !/stream|listen|live|icecast|shoutcast|radio\.|\/;$|:\d{2,5}/i.test(u) && (x.pathname === '/' || /\.(html?|php)$/i.test(x.pathname)); } catch { return false; } };
    async function resolve(u) {   // .pls / .m3u: adentro viene el link real
      if (!/\.(pls|m3u)(\?|$)/i.test(u)) return u;
      try { const t = await (await fetch(u)).text(); const m = t.match(/(?:File\d+=)?(https?:\/\/[^\s]+)/i); return m ? m[1] : u; } catch { return u; }
    }
    $('raX').onclick = () => { el.hidden = true; el.innerHTML = ''; };
    $('raT').onclick = async () => { const u = read(); if (!u) return msg('Pegá el link.');
      if (isPage(u)) { msg('Eso parece la página de la radio. Te la busco…'); try { const name = new URL(u).hostname.replace(/^www\./, '').split('.')[0]; $('rQ').value = name; search(name); msg(`Busqué «${esc(name)}» abajo: tocá ☆ en la que sea.`); } catch {} return; }
      const real = await resolve(u); msg('Probando…'); play({ name:$('raN').value.trim() || 'Prueba', url:real, logo:$('raL').value.trim(), hls:/\.m3u8/i.test(real) });
      setTimeout(() => msg(audio && !audio.paused && audio.currentTime > 0 ? '✅ ¡Suena! Ponele nombre y guardala.' : 'Si no suena en unos segundos, el link no es de audio o la radio no deja escucharla desde otras páginas.'), 5000); };
    $('raS').onclick = async () => { const u = read(), n = $('raN').value.trim(); if (!u || !n) return msg('Poné el link y el nombre.');
      if (isPage(u) && !confirm('Ese link parece una página web, no el audio. ¿La guardo igual?')) return;
      const real = await resolve(u), x = { ...(r || {}), id:r?.id || 'link-' + Date.now(), name:n, url:real, logo:$('raL').value.trim(), hls:/\.m3u8/i.test(real), tags:r?.tags || 'agregada con link' };
      if (r) { const i = db.radios.findIndex(y => y.url === r.url); if (i >= 0) db.radios[i] = x; } else if (db.radios.some(y => y.url === real)) return msg('Esa radio ya la tenés.'); else db.radios.push(x);
      save(); el.hidden = true; el.innerHTML = ''; toast(`<b>📻 ${esc(n)}</b><small>${r ? 'Cambios guardados.' : 'Guardada en tus radios.'}</small>`, { ms:2500 }); render(); };
    el.scrollIntoView({ block:'nearest', behavior:'smooth' }); $('raU').focus();
  }
  function render() {
    const v = $('v-radios');
    if (!v.dataset.built) {
      v.dataset.built = 1;
      v.innerHTML = `
        <div class="secrow"><h2 class="sec">Mis radios</h2><div class="seg" id="rView"><button data-rv="lista">📻 Radios</button><button data-rv="grilla">🗓 Grilla</button><button id="rMap" title="Tus radios en un globo terráqueo">🌍 Mapa</button><button id="rLink" title="Agregar una radio pegando su link">＋ Con link</button></div></div><div id="rAdd" hidden></div><div id="rMine"></div>
        <h2 class="sec">Buscar radios</h2>
        <form class="rsearch" id="rForm">
          <input id="rQ" placeholder="Nombre de la radio: Mitre, La 100, Rivadavia, Metro…">
          <select id="rCountry"><option value="AR">Argentina</option><option value="">Todo el mundo</option><option value="UY">Uruguay</option><option value="ES">España</option></select>
          <button class="pri">Buscar</button>
          <button type="button" id="rTop">Más escuchadas</button>
        </form>
        <div id="rRes"></div>
        <p class="mut" style="font-size:12px;margin-top:10px">Las radios salen de radio-browser.info, una lista comunitaria y gratuita. Si alguna no suena, probá con otra versión de la misma radio.</p>`;
      $('rForm').onsubmit = e => { e.preventDefault(); search($('rQ').value.trim()); };
      $('rTop').onclick = () => search('');
      $('rMap').onclick = e => { e.stopPropagation(); RadioMapa.open(); };
      $('rLink').onclick = e => { e.stopPropagation(); linkForm(null); };
      $('rView').onclick = e => { const b = e.target.closest('[data-rv]'); if (b) { S.set('radView', b.dataset.rv); render(); } };
      v.addEventListener('click', e => {
        const add = e.target.closest('[data-add]'), del = e.target.closest('[data-del]');
        if (add) { const r = results.find(x => x.url === add.dataset.add); if (r && !db.radios.some(x => x.url === r.url)) { db.radios.push(r); save(); render(); } return; }
        if (del) { db.radios = db.radios.filter(x => x.url !== del.dataset.del); save(); render(); return; }
        const edr = e.target.closest('[data-edr]'); if (edr) { linkForm(db.radios.find(x => x.url === edr.dataset.edr)); return; }
        const c = e.target.closest('[data-url]');
        if (c) { const r = db.radios.find(x => x.url === c.dataset.url) || results.find(x => x.url === c.dataset.url); if (r) play(r); }
      });
      v.addEventListener('keydown', e => { if (e.key === 'Enter' && e.target.dataset.url) e.target.click(); });
    }
    const view = S.get('radView', 'lista');
    $('rView').querySelectorAll('[data-rv]').forEach(b => b.classList.toggle('on', b.dataset.rv === view));
    if (view === 'grilla') RadioGrilla.render($('rMine'), g => { $('rQ').value = g.alias[0]; $('rCountry').value = 'AR'; search(g.alias[0]); $('rForm').scrollIntoView({ behavior:'smooth' }); });
    else $('rMine').innerHTML = db.radios.length ? `<div class="rgrid">${db.radios.map(r => rcard(r, true)).join('')}</div>`
      : `<div class="empty" style="padding:12px">Todavía no guardaste radios. Buscalas abajo y tocá ☆.</div>`;
    $('rRes').innerHTML = searching ? '<div class="empty">Buscando…</div>'
      : results.length ? `<div class="rgrid">${results.map(r => rcard(r, db.radios.some(x => x.url === r.url))).join('')}</div>` : '';
  }
  async function search(q) {
    searching = true; render();
    const cc = $('rCountry').value;
    const params = new URLSearchParams({ hidebroken:'true', order:'clickcount', reverse:'true', limit:'40' });
    if (q) params.set('name', q);
    if (cc) params.set('countrycode', cc);
    try {
      const list = await rb('stations/search?' + params);
      // primero las que ya vienen en https (andan seguro desde la página)
      results = list.map(toRadio).sort((a, b) => (b.url.startsWith('https') - a.url.startsWith('https')));
      if (!results.length) $('rRes').innerHTML = '<div class="empty">No encontré radios con ese nombre.</div>';
    } catch (e) { results = []; $('rRes').innerHTML = `<div class="empty">${esc(e.message)}</div>`; searching = false; return; }
    searching = false; render();
  }

  /* ---------- Reproductor de abajo ---------- */
  function bar() {
    const b = $('radiobar');
    if (!cur) { b.classList.remove('show'); return; }
    b.classList.add('show');
    b.innerHTML = `<div class="lg" style="${cur.logo ? `background-image:url('${esc(cur.logo)}')` : ''}"></div>
      <div class="tx"><b>${esc(cur.name)}</b><span id="rbSt">${audio.paused ? 'En pausa' : audio.muted ? '🔇 Silenciada (está sonando otra cosa)' : '<span class="st-live">●</span> Sonando'}</span></div>
      <button id="rbSnd" title="Escuchar la radio">🔊</button>
      <button id="rbPlay">${audio.paused ? '▶' : '⏸'}</button>
      <input type="range" id="rbVol" min="0" max="1" step="0.05" value="${audio.volume}">
      <button id="rbStar" title="Guardar este momento">⭐</button>
      <button id="rbTv" title="Pantalla TV">📺</button>
      <button id="rbX" title="Cerrar">✕</button>`;
    $('rbTv').onclick = () => TV.open();
    $('rbStar').onclick = () => Momentos.capture('radio');
    $('rbPlay').onclick = () => audio.paused ? (userPaused = false, audio.play().catch(err)) : (userPaused = true, audio.pause());
    $('rbSnd').onclick = () => AudioMgr.focus('radio');
    $('rbVol').oninput = e => { audio.volume = +e.target.value; };
    $('rbX').onclick = stop;
  }
  function err() { toast(`<b>No pude reproducir ${esc(cur?.name || 'la radio')}</b><small>Puede que esté caída o que no permita escucharse desde otra página. Probá otra versión de la misma radio.</small>`, { cls:'info' }); }
  let userPaused = false;   // si la pausaste vos, el vigilante no la vuelve a prender
  async function play(r) {
    cur = r; userPaused = false;
    if (hls) { hls.destroy(); hls = null; }
    audio.muted = false;
    const isHls = /\.m3u8(\?|$)/i.test(r.url) || r.hls;
    if (isHls && !audio.canPlayType('application/vnd.apple.mpegurl')) {
      try {
        await loadScript('https://cdn.jsdelivr.net/npm/hls.js@1/dist/hls.min.js');
        // más colchón para los datos móviles (si la señal tiembla, no se corta enseguida)
        hls = new Hls({ maxBufferLength:40, liveSyncDurationCount:4, liveMaxLatencyDurationCount:12, manifestLoadingMaxRetry:6, levelLoadingMaxRetry:6, fragLoadingMaxRetry:6 });
        hls.on(Hls.Events.ERROR, (e, d) => { if (d.fatal) { if (d.type === Hls.ErrorTypes.NETWORK_ERROR) hls.startLoad(); else if (d.type === Hls.ErrorTypes.MEDIA_ERROR) hls.recoverMediaError(); } });
        hls.loadSource(r.url); hls.attachMedia(audio);
      } catch { audio.src = r.url; }
    } else audio.src = r.url;
    audio.play().catch(err);
    bar(); render(); TV.refresh();
    try { InfoBar.forRadio(r); } catch {}
  }
  function stop() { userPaused = true; audio.pause(); audio.removeAttribute('src'); audio.load(); if (hls) { hls.destroy(); hls = null; } cur = null; bar(); if ($('v-radios').dataset.built) render(); TV.refresh(); }

  function init() {
    audio = $('radioAudio');
    audio.addEventListener('play', () => AudioMgr.focus('radio'));
    ['pause', 'playing'].forEach(ev => audio.addEventListener(ev, () => { if (cur) bar(); }));
    audio.addEventListener('volumechange', () => {   // solo actualizo el texto (para no cortar el arrastre del volumen)
      const st = $('rbSt'); if (st && cur) st.innerHTML = audio.paused ? 'En pausa' : audio.muted ? '🔇 Silenciada (está sonando otra cosa)' : '<span class="st-live">●</span> Sonando';
    });
    // 🔁 si una radio en vivo "termina" o se traba, se reconecta sola. Con datos móviles la señal va y viene:
    // reintenta con espera creciente (hasta 30 s) y sin rendirse mientras la estés escuchando; solo avisa después de 8 seguidos
    let retries = 0, lastOk = 0, recT = null;
    const reconnect = why => { if (!cur || userPaused) return; if (Date.now() - lastOk > 60e3 && retries > 8) retries = 0; retries++;
      if (retries === 8) err();
      clearTimeout(recT); recT = setTimeout(() => { if (!cur || userPaused) return; const r = cur; if (hls) { try { hls.destroy(); } catch {} hls = null; } audio.src = ''; play(r); }, Math.min(30e3, 1200 * retries)); };
    audio.addEventListener('playing', () => { lastOk = Date.now(); retries = 0;
      // 🎧 que no arranque muda (pasaba con los auriculares: había que mover el volumen para que suene)
      if (audio.muted && !Player.slots.some(s => s && !s.audio && !s.mutedByApp)) audio.muted = false;
      if (audio.volume < .05) audio.volume = 1; });
    // si se pausó sola por falta de datos (o en la tele), la retomo; si fue por sacarte los auriculares, NO (no quiero que suene por el parlante)
    audio.addEventListener('pause', () => { if (!userPaused && cur && (audio.readyState < 3 || Lite.tv)) setTimeout(() => { if (cur && audio.paused && !userPaused) audio.play().catch(() => reconnect('pause')); }, 1500); });
    // vigilante: si dice que suena pero el tiempo no avanza (se quedó sin datos), reconecto
    let lastT = 0, still = 0;
    setInterval(() => { if (!cur || userPaused || audio.paused) { still = 0; return; }
      if (audio.currentTime === lastT) { if (++still >= 3) { still = 0; reconnect('trabada'); } } else { still = 0; lastT = audio.currentTime; } }, 5000);
    addEventListener('online', () => { if (cur && !userPaused) { retries = 0; reconnect('online'); } });
    try { navigator.connection?.addEventListener('change', () => { if (cur && !userPaused && (audio.paused || audio.readyState < 3)) reconnect('red'); }); } catch {}
    audio.addEventListener('ended', () => reconnect('ended'));
    audio.addEventListener('stalled', () => setTimeout(() => { if (cur && audio.readyState < 3 && !audio.paused) reconnect('stalled'); }, 8000));
    audio.addEventListener('error', () => { if (cur && audio.getAttribute('src')) { if (retries < 2) reconnect('ended'); else err(); } });
    AudioMgr.register('radio', { mute() { audio.muted = true; }, unmute() { audio.muted = false; },
      label:() => cur ? cur.name : '', live:() => !!cur && !audio.paused, radio:true,
      paused:() => audio.paused, toggle:() => audio.paused ? (userPaused = false, audio.play().catch(() => {})) : (userPaused = true, audio.pause()),
      muted:() => audio.muted, getVol:() => audio.volume, setVol:v => { audio.volume = v; if (v > 0 && audio.muted) AudioMgr.focus('radio'); } });
    onChange(() => { if ($('v-radios').dataset.built) render(); });
  }
  function skip(d) { if (!db.radios.length) return; const i = db.radios.findIndex(x => x.url === cur?.url); play(db.radios[(i + d + db.radios.length) % db.radios.length]); }
  // buscar una radio por nombre (para el Modo porteño y otros atajos)
  const trucha = s => /storage\.googleapis\.com|\/webchat\/|\.(mp3|wav|ogg|m4a)(\?|$)/i.test(s.url_resolved || s.url || '') && !(+s.bitrate > 0);
  async function find(q, country = 'Argentina') { const l = await rb(`stations/search?name=${encodeURIComponent(q)}&country=${encodeURIComponent(country)}&hidebroken=true&order=clickcount&reverse=true&limit=15`);
    return (l || []).filter(s => !trucha(s) && s.lastcheckok !== 0).sort((a, b) => (+b.bitrate > 0) - (+a.bitrate > 0)).map(toRadio); }
  return { init, render, play, stop, skip, find, get current() { return cur; } };
})();
