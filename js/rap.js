/* =========================================================
   Rap Battle: Freestyle y Escritas. Feed por competencia y guía de cada competidor.
   Los videos salen de las fuentes (canales o playlists de YouTube) que cargás vos.
   ========================================================= */
// Saca los competidores de un título de batalla. Devuelve null si no parece una batalla.
function parseBattle(title) {
  let t = ' ' + String(title).replace(/🆚/g, ' vs ').replace(/[\u{1F000}-\u{1FAFF}\u{2600}-\u{27BF}\u{FE0F}]/gu, ' ').replace(/\s+/g, ' ') + ' ';
  const VS = /\s(?:vs\.?|v\.s\.?|versus|contra)\s/i;
  const parts = t.split(new RegExp(VS.source, 'gi'));
  if (parts.length < 2) return null;
  const SEP = /\s[|\-–—•:]\s|\s?[|•]\s?|[\[\]()"“”«»]|[!¡?¿]+|\s\/\s/;
  const left = parts[0].split(SEP).filter(s => s.trim()).pop() || '';
  const lastRaw = parts[parts.length - 1], lastSegs = lastRaw.split(SEP);
  const last = lastSegs.find(s => s.trim()) || '';
  const rest = lastRaw.slice(lastRaw.indexOf(last) + last.length).replace(/^[\s|\-–—•:]+/, '').trim();
  const STOPW = /^(de|del|la|el|los|las|en|con|que|y|a|al|por|para|su|sus|una|un|the|of|in|at)$/i;
  // si el nombre quedó metido en una frase ("La batalla de Kaiser"), me quedo con las palabras en mayúscula pegadas al "vs"
  const trim = (s, fromEnd) => {
    const w = s.trim().split(/\s+/);
    if (w.length <= 2 && !w.some(x => STOPW.test(x))) return s;
    const cap = x => /^[\p{Lu}\d]/u.test(x) && !STOPW.test(x);
    const out = [];
    for (const x of (fromEnd ? [...w].reverse() : w)) { if (!cap(x)) break; out.push(x); if (out.length === 3) break; }
    return (fromEnd ? out.reverse() : out).join(' ');
  };
  const clean = s => s.replace(/^(?:la |el )?(?:batalla|final|semifinal|semi|cuartos|octavos|exhibici[oó]n|r[eé]plica)\s+(?:de\s+)?/i, '')
    .replace(/\b\d{4}\b/g, '').replace(/\s{2,}/g, ' ').replace(/^[\s,.;'’`*_~]+|[\s,.;'’`*_~]+$/g, '').trim();
  const team = (s, fromEnd) => s.split(/\s(?:&|and|\+|ft\.?)\s|\s*&\s*|\sy\s(?=[\p{Lu}])/iu).map(x => clean(trim(x, fromEnd))).filter(x => x && x.length <= 30 && !/^\d+$/.test(x));
  const sides = [team(left, true), ...parts.slice(1, -1).map(p => team(p.split(SEP).find(s => s.trim()) || '', false)), team(last, false)];
  if (sides.some(s => !s.length) || sides.some(s => s.join(' ').length > 45)) return null;
  return { sides, info:rest.replace(/\s{2,}/g, ' ').slice(0, 80) };
}

const Rap = (() => {
  const DISC = { free:['🎤', 'Freestyle'], escrita:['✍️', 'Escritas'] };
  let disc = S.get('rapDisc', 'free'), view = 'feed', comp = 'all', q = '', limit = 60, busy = false;
  let cache = S.get('rapCache', {});
  const saveCache = () => { try { S.set('rapCache', cache); } catch {} };
  const R = () => { db.rap = db.rap || { sources:[], alias:{}, fixes:{} }; ['sources', 'alias', 'fixes'].forEach(k => { if (!db.rap[k]) db.rap[k] = k === 'sources' ? [] : {}; }); return db.rap; };

  /* ---------- Fuentes ---------- */
  function parseSrc(raw) {
    let s = raw.trim(); if (!s) return null;
    if (/^@[\w.\-]+$/.test(s)) return { kind:'channel', handle:s };
    if (!/^https?:\/\//i.test(s)) s = 'https://' + s;
    let u; try { u = new URL(s); } catch { return null; }
    if (!/youtube\.com$|youtu\.be$/.test(u.hostname.replace(/^(www|m|music)\./, ''))) return null;
    const list = u.searchParams.get('list'); if (list) return { kind:'playlist', ref:list };
    const p = u.pathname.split('/').filter(Boolean).map(decodeURIComponent);
    if (p[0] === 'channel' && p[1]) return { kind:'channel', channelId:p[1] };
    if (p[0] && p[0].startsWith('@')) return { kind:'channel', handle:p[0] };
    return null;
  }
  async function resolve(src) {
    if (src.kind === 'playlist') {
      if (!src.title) { try { const j = await Canales.yt('playlists', { part:'snippet', id:src.ref }); const x = j.items?.[0]; if (x) { src.title = x.snippet.title; src.thumb = x.snippet.thumbnails.default?.url; } } catch {} }
      return src.ref;
    }
    if (src.uploads) return src.uploads;
    const j = await Canales.yt('channels', { part:'snippet,contentDetails', ...(src.channelId ? { id:src.channelId } : { forHandle:src.handle }) });
    const ch = j.items?.[0]; if (!ch) throw new Error('No encontré el canal');
    src.channelId = ch.id; src.uploads = ch.contentDetails.relatedPlaylists.uploads;
    src.title = ch.snippet.title; src.thumb = ch.snippet.thumbnails.default?.url;
    return src.uploads;
  }
  // primera vez: hasta 500 videos para armar el historial; después, solo lo nuevo
  async function fetchSrc(src, full) {
    const list = await resolve(src);
    const c = cache[src.id] || { items:[] }, known = new Set(c.items.map(i => i.v));
    let token = '', pages = 0, fresh = [];
    do {
      const j = await Canales.yt('playlistItems', { part:'snippet,contentDetails', playlistId:list, maxResults:50, ...(token ? { pageToken:token } : {}) });
      let hitKnown = false;
      for (const it of j.items || []) {
        const v = it.contentDetails?.videoId || it.snippet?.resourceId?.videoId;
        if (!v || it.snippet.title === 'Private video' || it.snippet.title === 'Deleted video') continue;
        if (known.has(v)) { hitKnown = true; continue; }
        fresh.push({ v, t:it.snippet.title, d:it.contentDetails?.videoPublishedAt || it.snippet.publishedAt, th:(it.snippet.thumbnails?.medium || it.snippet.thumbnails?.default || {}).url });
      }
      token = j.nextPageToken; pages++;
      if (hitKnown && !full) break;
    } while (token && pages < (c.items.length && !full ? 3 : 10));
    c.items = [...fresh, ...c.items].sort((a, b) => Date.parse(b.d) - Date.parse(a.d)).slice(0, 1500);
    c.at = Date.now(); cache[src.id] = c;
  }
  async function refresh(force) {
    if (busy || !db.key) return;
    const todo = R().sources.filter(s => force || !cache[s.id] || Date.now() - cache[s.id].at > 60 * 60e3);
    if (!todo.length) return;
    busy = true; render();
    for (const s of todo) { try { await fetchSrc(s); } catch (e) { s.err = e instanceof TypeError ? 'Sin conexión con YouTube' : e.message; } }
    saveCache(); saveLocal(); busy = false; build(); render();
  }

  /* ---------- Batallas y competidores ---------- */
  let battles = [], people = {};
  const key = n => { const k = norm(n).replace(/[^a-z0-9ñ ]/g, '').replace(/\s+/g, ' ').trim(); return R().alias[k] || k; };
  function build() {
    const seen = new Set(), forms = {};
    battles = [];
    R().sources.forEach(src => (cache[src.id]?.items || []).forEach(it => {
      if (seen.has(it.v)) return;
      const fx = R().fixes[it.v];
      if (fx === 'hide') return;
      const p = parseBattle(fx || it.t); if (!p) return;
      seen.add(it.v);
      const sides = p.sides.map(side => side.map(n => { const k = key(n); (forms[k] = forms[k] || {})[n] = (forms[k][n] || 0) + 1; return k; }));
      const compName = src.comp || src.title || '';
      // el detalle sin repetir el nombre de la competencia ("Jornada 3", "Final"…)
      const info = fx ? '' : p.info.replace(/[()]/g, '').split(/\s*[|\-–—•]\s*/).map(x => x.trim()).filter(x => x && !norm(compName).includes(norm(x)) && !norm(x).includes(norm(compName))).join(' · ');
      battles.push({ v:it.v, title:it.t, date:it.d, th:it.th, comp:compName, disc:src.disc, src:src.id, sides, info });
    }));
    battles.sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    // nombre que se muestra: la forma más usada (prefiriendo la que no está toda en mayúsculas si empatan)
    people = {};
    Object.entries(forms).forEach(([k, f]) => { people[k] = { key:k, name:Object.entries(f).sort((a, b) => b[1] - a[1] || (a[0] === a[0].toUpperCase()) - (b[0] === b[0].toUpperCase()))[0][0] }; });
  }
  const nm = k => (people[k] || { name:k }).name;
  const vsHtml = b => b.sides.map(side => side.map(k => `<a class="rp" data-p="${esc(k)}">${esc(nm(k))}</a>`).join(' & ')).join(' <span class="vs">vs</span> ');

  /* ---------- Pantalla ---------- */
  function card(b) {
    return `<div class="rbc">
      <div class="thumb" data-play="${b.v}" style="background-image:url('${esc(b.th || '')}')"><span class="rbplay">▶</span></div>
      <div class="info"><div class="n">${vsHtml(b)}</div>
        <div class="t" style="min-height:0">${esc(b.comp)}${b.info ? ' · ' + esc(b.info) : ''}</div>
        <div class="mut" style="font-size:12px;display:flex;justify-content:space-between">${ago(b.date)}<button class="rfix" data-fix="${b.v}" title="Corregir competidores">✎</button></div></div></div>`;
  }
  function render() {
    const v = $('v-rap'); build();
    const mine = battles.filter(b => b.disc === disc);
    const srcs = R().sources.filter(s => s.disc === disc);
    const comps = {}; mine.forEach(b => comps[b.comp] = (comps[b.comp] || 0) + 1);
    let body;
    if (!db.key) body = '<div class="empty">Para leer los videos de las competencias hace falta la clave de YouTube (⚙).</div>';
    else if (!srcs.length) body = `<div class="empty">Todavía no cargaste fuentes de ${DISC[disc][1]}.<br>Tocá <b>Fuentes</b> y pegá el link del canal (o de una playlist) donde suben las batallas.</div>`;
    else if (view.startsWith('p:')) body = profile(view.slice(2), mine);
    else if (view === 'people') body = peopleView(mine);
    else {
      const list = mine.filter(b => comp === 'all' || b.comp === comp);
      body = `<div class="chips">${[['all', 'Todas', mine.length], ...Object.entries(comps).sort((a, b) => b[1] - a[1]).map(([c, n]) => [c, c, n])]
          .map(([id, n, c]) => `<button data-comp="${esc(id)}" class="${comp === id ? 'on' : ''}">${esc(n)} <span class="mut">${c}</span></button>`).join('')}</div>
        ${list.length ? `<div class="rbgrid">${list.slice(0, limit).map(card).join('')}</div>${list.length > limit ? '<div class="btns"><button id="rMore">Ver más</button></div>' : ''}`
          : `<div class="empty">${busy ? 'Buscando batallas…' : 'No encontré batallas en estas fuentes todavía.'}</div>`}`;
    }
    v.innerHTML = `
      <div class="subbar">
        <div class="tabs">${Object.entries(DISC).map(([id, [ic, n]]) => `<button data-disc="${id}" class="${disc === id ? 'on' : ''}">${ic} ${n}</button>`).join('')}</div>
        <div class="tabs" style="flex:none"><button data-view="feed" class="${view === 'feed' ? 'on' : ''}">Feed</button><button data-view="people" class="${view !== 'feed' ? 'on' : ''}">Competidores</button></div>
        <button id="rRef" title="Buscar videos nuevos">${busy ? '…' : '⟳'}</button><button id="rSrc">Fuentes</button>
      </div>${body}
      <p class="mut" style="font-size:12px;margin-top:12px">Los competidores salen del título de cada video (“A vs B”). Si alguno quedó mal, tocá ✎ en la batalla. Los resultados (quién ganó) no figuran en los títulos, así que no los muestro.</p>`;
    v.querySelectorAll('[data-disc]').forEach(b => b.onclick = () => { disc = b.dataset.disc; S.set('rapDisc', disc); comp = 'all'; view = 'feed'; limit = 60; render(); });
    v.querySelectorAll('[data-view]').forEach(b => b.onclick = () => { view = b.dataset.view; render(); });
    v.querySelectorAll('[data-comp]').forEach(b => b.onclick = () => { comp = b.dataset.comp; limit = 60; render(); });
    v.querySelectorAll('[data-p]').forEach(a => a.onclick = e => { e.stopPropagation(); view = 'p:' + a.dataset.p; render(); $('scroller').scrollTo(0, 0); });
    v.querySelectorAll('[data-play]').forEach(t => t.onclick = () => { const b = battles.find(x => x.v === t.dataset.play); Player.play({ uid:'rb_' + b.v, platform:'youtube', ref:{ video:b.v }, name:b.sides.map(s => s.map(nm).join(' & ')).join(' vs ') }); });
    v.querySelectorAll('[data-fix]').forEach(b => b.onclick = () => openFix(b.dataset.fix));
    if ($('rMore')) $('rMore').onclick = () => { limit += 60; render(); };
    $('rRef').onclick = () => refresh(true);
    $('rSrc').onclick = openSrc;
    const qi = $('rQ'); if (qi) qi.oninput = () => { q = qi.value; const pos = qi.selectionStart; render(); $('rQ').focus(); $('rQ').setSelectionRange(pos, pos); };
    const mg = $('rMerge'); if (mg) mg.onchange = () => {
      if (!mg.value) return;
      const from = view.slice(2), to = mg.value;   // une "from" dentro de "to"
      R().alias[from] = to; Object.keys(R().alias).forEach(k => { if (R().alias[k] === from) R().alias[k] = to; });
      save(); view = 'p:' + to; render();
    };
  }
  function stats(mine) {
    const P = {};
    mine.forEach(b => b.sides.forEach((side, i) => side.forEach(k => {
      const p = P[k] = P[k] || { key:k, n:0, comps:{}, rivals:{}, last:b.date };
      p.n++; p.comps[b.comp] = (p.comps[b.comp] || 0) + 1;
      b.sides.forEach((o, j) => { if (j !== i) o.forEach(r => p.rivals[r] = (p.rivals[r] || 0) + 1); });
    })));
    return P;
  }
  function peopleView(mine) {
    const P = Object.values(stats(mine)).filter(p => !q || norm(nm(p.key)).includes(norm(q))).sort((a, b) => b.n - a.n || nm(a.key).localeCompare(nm(b.key)));
    return `<input id="rQ" placeholder="Buscar competidor…" value="${esc(q)}" style="width:100%;max-width:360px;margin-bottom:10px">
      <div class="rpgrid">${P.slice(0, 300).map(p => `<button class="rpc" data-p="${esc(p.key)}"><b>${esc(nm(p.key))}</b><span>${p.n} batalla${p.n === 1 ? '' : 's'} · ${esc(Object.keys(p.comps).slice(0, 2).join(', '))}</span></button>`).join('') || '<div class="empty">Sin resultados.</div>'}</div>`;
  }
  function profile(k, mine) {
    const p = stats(mine)[k];
    if (!p) return '<div class="empty">No hay batallas de este competidor en esta disciplina.</div>';
    const list = mine.filter(b => b.sides.some(s => s.includes(k)));
    const yrs = list.map(b => new Date(b.date).getFullYear());
    const others = Object.keys(people).filter(x => x !== k).sort((a, b) => nm(a).localeCompare(nm(b)));
    return `<div class="rprof">
        <button class="sm" data-view="people">← Competidores</button>
        <h2>${esc(nm(k))}</h2>
        <div class="mut">${p.n} batalla${p.n === 1 ? '' : 's'} · ${Math.min(...yrs) === Math.max(...yrs) ? Math.max(...yrs) : Math.min(...yrs) + '–' + Math.max(...yrs)}</div>
        <div class="chips" style="margin-top:8px">${Object.entries(p.comps).sort((a, b) => b[1] - a[1]).map(([c, n]) => `<span class="rchip">${esc(c)} · ${n}</span>`).join('')}</div>
        <div class="mut" style="font-size:13px;margin-top:6px">Rivales más frecuentes: ${Object.entries(p.rivals).sort((a, b) => b[1] - a[1]).slice(0, 6).map(([r, n]) => `<a class="rp" data-p="${esc(r)}">${esc(nm(r))}</a>${n > 1 ? ' (' + n + ')' : ''}`).join(', ')}</div>
        <label class="mut" style="font-size:12px;display:flex;gap:6px;align-items:center;margin-top:8px">¿Es el mismo que otro nombre? Unir con:
          <select id="rMerge" style="max-width:220px;font-size:12px;padding:3px 6px"><option value="">— elegir —</option>${others.map(o => `<option value="${esc(o)}">${esc(nm(o))}</option>`).join('')}</select></label>
      </div>
      <h2 class="sec" style="margin-top:12px">Batallas</h2><div class="rbgrid">${list.map(card).join('')}</div>`;
  }

  /* ---------- Diálogos: fuentes y corrección ---------- */
  function openSrc() {
    const d = $('dlgRap');
    const paint = () => {
      $('rsList').innerHTML = R().sources.filter(s => s.disc === $('rsDisc').value).map(s => `<div class="catrow" style="align-items:center">
        <span style="flex:1;font-size:14px"><b>${esc(s.comp || s.title || '…')}</b><br><span class="mut" style="font-size:12px">${esc(s.title || s.handle || s.ref || '')} · ${(cache[s.id]?.items || []).length} videos${s.err ? ' · ⚠ ' + esc(s.err) : ''}</span></span>
        <button data-rs="${s.id}" title="Quitar">✕</button></div>`).join('') || '<p>Todavía no hay fuentes en esta disciplina.</p>';
      $('rsList').querySelectorAll('[data-rs]').forEach(b => b.onclick = () => { R().sources = R().sources.filter(s => s.id !== b.dataset.rs); delete cache[b.dataset.rs]; saveCache(); save(); paint(); render(); });
    };
    $('rsDisc').value = disc; $('rsDisc').onchange = paint; $('rsUrl').value = ''; $('rsComp').value = ''; $('rsMsg').textContent = '';
    $('rsAdd').onclick = async () => {
      const m = $('rsMsg'), x = parseSrc($('rsUrl').value);
      if (!x) { m.className = 'msg err'; m.textContent = 'Pegá el link de un canal (youtube.com/@canal) o de una playlist de YouTube.'; return; }
      if (!db.key) { m.className = 'msg err'; m.textContent = 'Primero cargá la clave de YouTube en ⚙.'; return; }
      const src = { id:uid(), disc:$('rsDisc').value, comp:$('rsComp').value.trim(), ...x };
      m.className = 'msg'; m.textContent = 'Leyendo los videos (puede tardar unos segundos)…';
      try { await fetchSrc(src, true); } catch (e) { m.className = 'msg err'; m.textContent = e instanceof TypeError ? 'Sin conexión con YouTube.' : e.message; return; }
      if (!src.comp) src.comp = src.title;
      R().sources.push(src); saveCache(); save();
      build(); const n = battles.filter(b => b.src === src.id).length;
      m.className = 'msg ok'; m.textContent = `Listo: ${(cache[src.id]?.items || []).length} videos, ${n} batallas reconocidas.`;
      $('rsUrl').value = ''; $('rsComp').value = ''; paint(); disc = src.disc; S.set('rapDisc', disc); render();
    };
    paint(); d.showModal();
  }
  function openFix(v) {
    const b = battles.find(x => x.v === v); if (!b) return;
    $('rfTitle').textContent = b.title;
    $('rfIn').value = R().fixes[v] && R().fixes[v] !== 'hide' ? R().fixes[v] : b.sides.map(s => s.map(nm).join(' & ')).join(' vs ');
    $('rfSave').onclick = () => { const t = $('rfIn').value.trim(); if (parseBattle(t)) { R().fixes[v] = t; save(); $('dlgRapFix').close(); render(); } else $('rfIn').style.borderColor = 'var(--live)'; };
    $('rfHide').onclick = () => { R().fixes[v] = 'hide'; save(); $('dlgRapFix').close(); render(); };
    $('dlgRapFix').showModal();
  }
  function init() {
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="dlgRap"><h3>🎤 Fuentes de Rap Battle</h3>
        <label>Disciplina</label><select id="rsDisc"><option value="free">🎤 Freestyle</option><option value="escrita">✍️ Escritas</option></select>
        <div id="rsList" style="margin-top:10px"></div>
        <label>Link del canal o de una playlist de YouTube</label><input id="rsUrl" placeholder="youtube.com/@canal  ·  youtube.com/playlist?list=…">
        <label>Nombre de la competencia (opcional)</label><input id="rsComp" placeholder="Ej: FMS Argentina, Red Bull Batalla, God Level…">
        <p style="margin-top:6px">Si un canal sube varias competencias, podés cargar cada playlist por separado con su nombre.</p>
        <div class="msg" id="rsMsg"></div>
        <div class="btns"><span class="sp"></span><button data-close>Cerrar</button><button class="pri" id="rsAdd">Agregar fuente</button></div></dialog>
      <dialog id="dlgRapFix"><h3>✎ Corregir batalla</h3><p id="rfTitle"></p>
        <label>Competidores (formato “A vs B”, equipos con “&”)</label><input id="rfIn">
        <div class="btns"><button id="rfHide" style="color:#ff7b7b">No es una batalla</button><span class="sp"></span><button data-close>Cancelar</button><button class="pri" id="rfSave">Guardar</button></div></dialog>`);
    ['dlgRap', 'dlgRapFix'].forEach(id => $(id).querySelector('[data-close]').onclick = () => $(id).close());
    onChange(() => { if (Nav.current === 'rap') render(); });
  }
  return { init, render: () => { render(); refresh(); } };
})();
