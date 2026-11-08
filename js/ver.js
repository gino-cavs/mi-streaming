/* =========================================================
   📺 Dónde verlo: el canal de la guía lleva a su plataforma oficial,
   y "🔎 Buscar en vivo" busca transmisiones en vivo del evento en YouTube
   para abrirlas en el reproductor de FUNVS (más atajos a YouTube y Google).
   ========================================================= */
const Ver = (() => {
  // canal de la guía -> plataforma oficial donde verlo online
  const PLAT = [
    [/espn|disney|star\s*\+/i, 'Disney+ / ESPN', 'https://www.disneyplus.com/'],
    [/tnt|hbo|max\b/i, 'HBO Max (TNT Sports)', 'https://play.hbomax.com/'],
    [/tyc/i, 'TyC Sports Play', 'https://www.tycsportsplay.com/'],
    [/fox/i, 'Fox Sports', 'https://www.foxsports.com.ar/'],
    [/d\s*sports|directv|dgo/i, 'DGO (DSports)', 'https://www.directvgo.com/'],
    [/telefe/i, 'Telefe en vivo', 'https://mitelefe.com/vivo'],
    [/tv p[uú]blica|dxtv|deportv/i, 'TV Pública', 'https://www.tvpublica.com.ar/'],
    [/paramount/i, 'Paramount+', 'https://www.paramountplus.com/'],
    [/flow/i, 'Flow', 'https://web.flow.com.ar/'],
    [/telecentro/i, 'Telecentro Play', 'https://www.telecentro.com.ar/'],
    [/dazn/i, 'DAZN', 'https://www.dazn.com/'],
    [/f1\s*tv/i, 'F1 TV', 'https://f1tv.formula1.com/'],
    [/motogp/i, 'MotoGP VideoPass', 'https://www.motogp.com/'],
    [/carburando/i, 'Carburando', 'https://www.youtube.com/@carburando/streams'],
    [/youtube/i, 'YouTube', null]
  ];
  const platOf = ch => { const p = PLAT.find(([re]) => re.test(ch)); return p ? { n:p[1], u:p[2] } : null; };
  const gUrl = q => 'https://www.google.com/search?q=' + encodeURIComponent(q + ' en vivo dónde ver');
  const ytUrl = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&sp=EgJAAQ%253D%253D';   // filtro "En vivo"

  // HTML de los botones: canales (con link a su plataforma) + buscar en vivo
  function chips(channels, query, opts = {}) {
    const ch = (channels || []).map(c => { const p = platOf(c);
      return p && p.u ? `<a class="vch" href="${esc(p.u)}" target="_blank" rel="noopener" title="Ver en ${esc(p.n)}">📺 ${esc(c)} ↗</a>` : `<span class="vch">📺 ${esc(c)}</span>`; }).join('');
    return `<div class="tvch ver">${ch}${query ? `<button class="vbus" data-buscar="${esc(query)}" title="Buscar transmisiones en vivo">🔎 ${esc(opts.label || 'Buscar en vivo')}</button>` : ''}</div>`;
  }

  const cache = {};
  async function search(q) {
    const k = norm(q); if (cache[k] && Date.now() - cache[k].at < 5 * 60e3) return cache[k].items;
    const j = await Canales.yt('search', { part:'snippet', type:'video', eventType:'live', q, maxResults:10, regionCode:'AR', relevanceLanguage:'es', safeSearch:'none' });
    const items = (j.items || []).map(x => ({ id:x.id.videoId, t:x.snippet.title, ch:x.snippet.channelTitle, img:x.snippet.thumbnails?.medium?.url || '' }));
    cache[k] = { at:Date.now(), items }; return items;
  }
  function dlg() {
    let d = $('dlgVer'); if (d) return d;
    d = document.createElement('dialog'); d.id = 'dlgVer';
    d.innerHTML = `<h3 id="verT">🔎 Buscar en vivo</h3><form class="rsearch" id="verF"><input id="verQ"><button class="pri">Buscar</button></form>
      <div id="verL" class="verl"></div>
      <div class="btns" style="margin-top:10px"><a class="sm lnk" id="verYT" target="_blank" rel="noopener">▶ Ver más en YouTube ↗</a><a class="sm lnk" id="verG" target="_blank" rel="noopener">🌐 Buscar en Google ↗</a><span class="sp"></span><button id="verX">Cerrar</button></div>`;
    document.body.appendChild(d);
    $('verX').onclick = () => d.close();
    $('verF').onsubmit = e => { e.preventDefault(); run($('verQ').value.trim()); };
    d.addEventListener('click', e => { if (e.target === d) d.close(); });
    return d;
  }
  async function run(q) {
    if (!q) return;
    $('verQ').value = q; $('verYT').href = ytUrl(q); $('verG').href = gUrl(q);
    const L = $('verL');
    if (!db.key) { L.innerHTML = '<div class="empty" style="padding:10px">Para buscar acá adentro hace falta la clave de YouTube (⚙). Mientras, usá los botones de abajo.</div>'; return; }
    L.innerHTML = '<div class="empty" style="padding:10px">Buscando vivos…</div>';
    try {
      const it = await search(q);
      L.innerHTML = it.length ? it.map(x => `<button class="veri" data-v="${esc(x.id)}" data-ch="${esc(x.ch)}"><span class="vimg" style="background-image:url('${esc(x.img)}')"><i>● VIVO</i></span><span><b>${esc(x.t)}</b><small>${esc(x.ch)}</small></span></button>`).join('')
        : '<div class="empty" style="padding:10px">No encontré vivos en YouTube con esa búsqueda. Probá con menos palabras, o con los botones de abajo.</div>';
      L.querySelectorAll('.veri').forEach(b => b.onclick = () => { $('dlgVer').close(); Player.play({ uid:'ver_' + b.dataset.v, platform:'youtube', ref:{ video:b.dataset.v }, name:b.dataset.ch }); });
    } catch (e) { L.innerHTML = `<div class="empty" style="padding:10px">${esc(e.message)}</div>`; }
  }
  function open(q) { const d = dlg(); if (!d.open) d.showModal(); run(q); }
  function init() { document.addEventListener('click', e => { const b = e.target.closest('[data-buscar]'); if (b) { e.preventDefault(); e.stopPropagation(); open(b.dataset.buscar); } }, true); }
  return { init, chips, open, platOf };
})();
