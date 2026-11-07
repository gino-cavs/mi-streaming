/* =========================================================
   Boxeo: actualidad al estilo Automovilismo.
   Boxeo de Primera (TyC Sports, lo junta GitHub cada 30 min), veladas en vivo de tus canales,
   lo que viene según las noticias, noticias de Argentina y del mundo, y tus boxeadores.
   ========================================================= */
const Boxeo = (() => {
  const BOX = /box|bdp|velada|pelea|nocaut|knock ?out|\bko\b|\bring\b|campe[oó]n (mundial|argentino|sudamericano)/i;
  const PROX = /vuelve|esta noche|\bhoy\b|este (viernes|s[aá]bado|domingo|lunes|martes|mi[eé]rcoles|jueves)|cartelera|se presenta|pesaje|enfrentar[aá]|buscar[aá]|ir[aá] por|chocan|se miden|expondr[aá]|debutar[aá]|regresa|previa|todo listo/i;
  const PASADO = /venci[oó]|gan[oó]|noque[oó]|retuvo|perdi[oó]|empat|derrot[oó]|se consagr[oó]|conquist[oó]|cay[oó]|cerr[oó]/i;
  let data = S.get('boxData', null), tab = 'ar', seenLive = new Set(S.get('boxSeen', []));
  const B = () => { db.boxeo = db.boxeo || { fav:[] }; if (!db.boxeo.fav) db.boxeo.fav = []; return db.boxeo; };

  async function load(force) {
    if (!force && data && Date.now() - data._at < 15 * 60e3) return;
    try { const j = await (await fetch(REPO.data + 'boxeo.json?t=' + Math.floor(Date.now() / 600e3))).json(); if (j && j.bdp) { j._at = Date.now(); data = j; S.set('boxData', j); } } catch {}
    if (Nav.current === 'boxeo') render();
  }
  const boxLives = () => db.chans.filter(c => { const s = Canales.status[c.uid] || {}; return s.st === 'live' && !s.prem && BOX.test(s.title || ''); });
  const boxSoon = () => db.chans.filter(c => { const s = Canales.status[c.uid] || {}; return s.st === 'soon' && BOX.test(s.title || ''); });
  const favRe = () => B().fav.length ? new RegExp(B().fav.map(f => norm(f).replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'i') : null;
  const isFav = t => { const r = favRe(); return !!(r && r.test(norm(t))); };
  const hl = t => { let h = esc(t); B().fav.forEach(f => { const re = new RegExp('(' + f.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + ')', 'ig'); h = h.replace(re, '<mark>$1</mark>'); }); return h; };
  const nitem = i => `<a class="nitem ${isFav(i.t) ? 'favn' : ''}" href="${esc(i.l)}" target="_blank" rel="noopener"><b>${hl(i.t)}</b><span>${esc(i.s || 'TyC Sports')} · ${ago(i.d)}</span></a>`;

  function render() {
    const v = $('v-boxeo');
    load();
    if (!Noticias.loaded) Noticias.load().then(() => { if (Nav.current === 'boxeo') render(); }).catch(() => {});
    const lives = boxLives(), soon = boxSoon();
    const bdp = (data && data.bdp) || [];
    const news = { ar:[...Noticias.byTopic('box-bdp'), ...Noticias.byTopic('box-ar')], mundo:Noticias.byTopic('box-mundo') };
    const uniq = a => { const s = new Set(); return a.filter(i => { const k = norm(i.t).slice(0, 60); if (s.has(k)) return false; s.add(k); return true; }).sort((a, b) => Date.parse(b.d) - Date.parse(a.d)); };
    news.ar = uniq(news.ar); news.mundo = uniq(news.mundo);
    news.fav = uniq([...news.ar, ...news.mundo, ...bdp.map(x => ({ t:x.t, l:x.l, d:x.d, s:'TyC Sports' }))].filter(i => isFav(i.t)));
    // lo que viene: previas de los últimos días (no crónicas de peleas ya hechas)
    const viene = uniq([...bdp.map(x => ({ t:x.t, l:x.l, d:x.d, s:'TyC Sports' })), ...news.ar])
      .filter(i => Date.now() - Date.parse(i.d) < 6 * 864e5 && PROX.test(i.t) && !PASADO.test(i.t)).slice(0, 6);
    v.innerHTML = `
      <div class="bxhero"><div class="bxg">🥊</div><div><h2>Boxeo</h2><p>Boxeo de Primera, veladas en vivo y la actualidad del boxeo.</p></div></div>
      <div class="vcols">
        <div>
          <h2 class="sec">🔴 Veladas en vivo</h2>
          ${lives.length ? `<div class="grid" id="bxLive">${lives.map(Canales.card).join('')}</div>`
            : `<div class="empty" style="padding:12px;text-align:left">Ahora no hay ninguna velada en vivo en tus canales.<br><span style="font-size:12px">Tip: sumá en 📺 Canales el YouTube de TyC Sports (o el canal donde la transmitan). Cuando un vivo tenga “Boxeo”, “BDP” o “velada” en el título, aparece acá solo y te aviso.</span></div>`}
          ${soon.length ? `<h2 class="sec" style="margin-top:12px">🕒 Próximas transmisiones</h2><div class="grid" id="bxSoon">${soon.map(Canales.card).join('')}</div>` : ''}
          ${viene.length ? `<h2 class="sec" style="margin-top:14px">🗓️ Lo que viene (según las noticias)</h2><div class="news">${viene.map(nitem).join('')}</div>` : ''}
          <h2 class="sec" style="margin-top:14px">🥊 Boxeo de Primera <span class="sp"></span><a class="sm lnk" href="https://www.tycsports.com/boxeo-de-primera.html" target="_blank" rel="noopener" style="font-size:12px;color:var(--mut)">TyC Sports ↗</a></h2>
          ${bdp.length ? `<div class="bxgrid">${bdp.slice(0, 10).map(x => `<a class="bxcard ${isFav(x.t) ? 'favn' : ''}" href="${esc(x.l)}" target="_blank" rel="noopener">
              <div class="bximg" style="${x.img ? `background-image:url('${esc(x.img)}')` : ''}">${x.img ? '' : '🥊'}${/promocional/i.test(x.t) ? '<span class="bxtag">BDP Promocional</span>' : ''}</div>
              <div class="bxtx"><b>${hl(x.t)}</b>${x.desc ? `<span>${esc(x.desc.slice(0, 140))}${x.desc.length > 140 ? '…' : ''}</span>` : ''}<small>${x.d ? ago(x.d) : ''}</small></div></a>`).join('')}</div>`
            : `<div class="empty" style="padding:12px">${data ? 'Sin notas por ahora.' : 'Cargando… (GitHub las junta cada 30 minutos; si recién lo activamos, esperá un rato).'}</div>`}
        </div>
        <div>
          <h2 class="sec">📰 Noticias</h2>
          <div class="chips"><button data-bt="ar" class="${tab === 'ar' ? 'on' : ''}">🇦🇷 Argentina</button><button data-bt="mundo" class="${tab === 'mundo' ? 'on' : ''}">🌎 Mundo</button><button data-bt="fav" class="${tab === 'fav' ? 'on' : ''}">⭐ Tus boxeadores</button></div>
          ${news[tab].length ? `<div class="news">${news[tab].slice(0, 25).map(nitem).join('')}</div>` : `<div class="empty" style="padding:12px">${tab === 'fav' ? (B().fav.length ? 'No hay noticias recientes de tus boxeadores.' : 'Agregá boxeadores abajo y te junto sus noticias.') : 'Sin noticias por ahora.'}</div>`}
          <h2 class="sec" style="margin-top:14px">⭐ Tus boxeadores</h2>
          <div class="chips">${B().fav.map(f => `<button class="sm" data-unf="${esc(f)}">★ ${esc(f)} ✕</button>`).join('') || '<span class="mut" style="font-size:13px">Ninguno todavía.</span>'}</div>
          <form id="bxFavF" class="rsearch"><input id="bxFavIn" placeholder="Ej: Fernando Martínez, Brian Castaño…"><button>Agregar</button></form>
        </div>
      </div>
      <p class="mut" style="font-size:12px;margin-top:12px">Fuentes: Boxeo de Primera de tycsports.com y noticias de Google Noticias.</p>`;
    ['bxLive', 'bxSoon'].forEach(id => { if ($(id)) Canales.bindGrid($(id)); });
    v.querySelectorAll('[data-bt]').forEach(b => b.onclick = () => { tab = b.dataset.bt; render(); });
    v.querySelectorAll('[data-unf]').forEach(b => b.onclick = () => { B().fav = B().fav.filter(f => f !== b.dataset.unf); save(); render(); });
    $('bxFavF').onsubmit = e => { e.preventDefault(); const n = $('bxFavIn').value.trim(); if (n && !B().fav.some(f => norm(f) === norm(n))) { B().fav.push(n); save(); } render(); };
  }
  // aviso cuando arranca una velada en tus canales
  function check() {
    boxLives().forEach(c => {
      const s = Canales.status[c.uid], k = s.vid || c.uid + s.title;
      if (seenLive.has(k)) return;
      seenLive.add(k); S.set('boxSeen', [...seenLive].slice(-100));
      toast(`<span class="g">🥊 En vivo: ${esc(c.name)}</span>${esc(s.title || '')}`, { cls:'race box', ms:20000, onclick:() => Player.play(c) });
    });
    Nav.badges();
  }
  function init() { load(); setInterval(load, 15 * 60e3); setInterval(check, 60e3); setTimeout(check, 8000); onChange(() => { if (Nav.current === 'boxeo') render(); }); }
  return { init, render, liveCount:() => boxLives().length };
})();
