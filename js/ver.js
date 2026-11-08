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
  // tus servicios: qué canales trae cada uno (en el orden en que se prefieren)
  const SERV = [
    ['dgo', 'DGO', 'https://www.directvgo.com/', /espn|tnt|d\s*sports|directv|dgo|fox|tyc|telefe|tv p[uú]blica|el trece|canal 13|america tv|hbo|\bmax\b|deportv|tn\b/i, 'ESPN 1-4, ESPN Premium y TNT Sports (pack fútbol), DSports 1, 2 y +, TyC, Fox, aire'],
    ['disney', 'Disney+', 'https://www.disneyplus.com/', /espn|disney|star\s*\+/i, 'ESPN (con Disney+ Premium)'],
    ['prime', 'Prime Video', 'https://www.primevideo.com/', /prime|amazon/i, 'lo que pase Prime Video'],
    ['hbo', 'HBO Max', 'https://play.hbomax.com/', /tnt|hbo|\bmax\b/i, 'TNT Sports'],
    ['flow', 'Flow', 'https://web.flow.com.ar/', /espn|tnt|tyc|fox|telefe|tv p[uú]blica|el trece|deportv|tn\b|dsports/i, 'canales del cable'],
    ['tycplay', 'TyC Sports Play', 'https://www.tycsportsplay.com/', /tyc/i, 'TyC Sports'],
    ['paramount', 'Paramount+', 'https://www.paramountplus.com/', /paramount/i, 'Paramount+'],
    ['fanatiz', 'Fanatiz', 'https://www.fanatiz.com/', /fanatiz/i, 'Fanatiz']
  ];
  const mine = () => db.servicios || ['dgo', 'disney', 'prime'];
  const servOf = ch => mine().map(k => SERV.find(s => s[0] === k)).find(s => s && s[3].test(ch));
  const gUrl = q => 'https://www.google.com/search?q=' + encodeURIComponent(q + ' en vivo dónde ver');
  const ytUrl = q => 'https://www.youtube.com/results?search_query=' + encodeURIComponent(q) + '&sp=EgJAAQ%253D%253D';   // filtro "En vivo"

  // HTML de los botones: canales (con link a su plataforma) + buscar en vivo
  function chips(channels, query, opts = {}) {
    const ch = (channels || []).map(c => {
      const s = servOf(c);
      if (s) return `<a class="vch own" href="${esc(s[2])}" target="_blank" rel="noopener" title="Lo tenés en ${esc(s[1])}">📺 ${esc(c)} · <b>${esc(s[1])} ✓</b></a>`;
      const p = platOf(c);
      return p && p.u ? `<a class="vch" href="${esc(p.u)}" target="_blank" rel="noopener" title="No lo tenés en tus servicios · oficial: ${esc(p.n)}">📺 ${esc(c)} ↗</a>` : `<span class="vch">📺 ${esc(c)}</span>`; }).join('');
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
  // elegir tus servicios (se guarda y se sincroniza)
  function servPicker(el) {
    el.innerHTML = `<div class="chips">${SERV.map(s => `<button data-sv="${s[0]}" class="${mine().includes(s[0]) ? 'on' : ''}" title="${esc(s[4])}">${mine().includes(s[0]) ? '✓ ' : ''}${esc(s[1])}</button>`).join('')}</div>
      <p class="mut" style="font-size:12px">Con lo que marques, cada canal de la guía te lleva a donde lo podés ver vos y se marca con ✓.</p>`;
    el.querySelector('.chips').onclick = e => { const b = e.target.closest('[data-sv]'); if (!b) return; const k = b.dataset.sv, m = mine(); db.servicios = m.includes(k) ? m.filter(x => x !== k) : [...m, k]; save(); servPicker(el); };
  }
  return { init, chips, open, platOf, servPicker, SERV };
})();
