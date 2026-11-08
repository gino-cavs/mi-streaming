/* =========================================================
   📼 Fútbol retro y 👣 Paso a Paso (dentro de Fulbito).
   - Fútbol Para Todos (@FutbolParaTodos): partidos completos por un lado, resúmenes y goles por otro.
   - Ascenso: 7 playlists, solo partidos completos.
   - Paso a Paso (TyC): informes de @ElClubdelPaso + búsqueda en YouTube, filtrados por título y duración.
   Se leen con tu clave de YouTube y quedan guardados en este dispositivo; lo que borrás se sincroniza.
   ========================================================= */
const Retro = (() => {
  const FPT = { handle:'@FutbolParaTodos' };
  const ASC = ['PLmuZuTH-bTuJzdJKGfTNbLXB9WV3j7W7i', 'PLmuZuTH-bTuKqPi2yMieX4BRyZ0zXwSfI', 'PLmuZuTH-bTuIUoZYzC-Bq3PD-CnGNuXbR', 'PLmuZuTH-bTuKkrGnCl44pQ6aqUuNJjMxF', 'PLmuZuTH-bTuKykO_A93BC3DCQOItUkNrf', 'PLmuZuTH-bTuIiA5XbVGL0sjnZh8E24N6U', 'PLmuZuTH-bTuLFvvT2cBphH9BNsE5Sm1zv'];
  const PAP = { handle:'@ElClubdelPaso' };
  // equipos para filtrar (se buscan en el título)
  const TEAMS = ['Vélez', 'Ferro', 'Boca', 'River', 'Racing', 'Independiente', 'San Lorenzo', 'Huracán', 'Estudiantes', 'Gimnasia', 'Newell\'s', 'Rosario Central', 'Talleres', 'Belgrano', 'Instituto',
    'Lanús', 'Banfield', 'Arsenal', 'Argentinos', 'Tigre', 'Colón', 'Unión', 'Godoy Cruz', 'Atlético Tucumán', 'San Martín de Tucumán', 'San Martín de San Juan', 'Olimpo', 'Quilmes', 'Defensa y Justicia',
    'Platense', 'Chacarita', 'All Boys', 'Nueva Chicago', 'Atlanta', 'Almagro', 'Temperley', 'Los Andes', 'Brown', 'Morón', 'Almirante Brown', 'Sarmiento', 'Patronato', 'Aldosivi', 'Central Córdoba',
    'Barracas Central', 'Deportivo Riestra', 'Estudiantes de Buenos Aires', 'Atlético de Rafaela', 'Crucero del Norte', 'Douglas Haig', 'Gimnasia de Jujuy', 'Boca Unidos', 'Guillermo Brown', 'Santamarina',
    'Villa Dálmine', 'Flandria', 'Tristán Suárez', 'Comunicaciones', 'Acassuso', 'Defensores de Belgrano', 'Excursionistas', 'Sportivo Italiano', 'Deportivo Morón', 'Mitre', 'Agropecuario', 'Alvarado',
    'Chaco For Ever', 'Juventud Unida', 'Talleres de Remedios de Escalada', 'Colegiales', 'Fénix', 'J.J. Urquiza', 'San Telmo', 'Dock Sud', 'Argentino de Quilmes', 'Deportivo Armenio', 'UAI Urquiza'];
  const hidden = () => (db.retro = db.retro || {}, db.retro.hidden = db.retro.hidden || [], db.retro.hidden);
  let cache = S.get('retroCache', {}), busy = null, prog = '', tab = S.get('retroTab', 'partidos'), team = S.get('retroTeam', ''), q = '', limit = 60, edit = null;
  const saveCache = () => { try { S.set('retroCache', cache); } catch { toast('<b>No entra todo en la memoria del navegador</b><small>Guardo solo lo más nuevo.</small>', { cls:'info' }); for (const k of Object.keys(cache)) cache[k].vids = cache[k].vids.slice(0, 2500); try { S.set('retroCache', cache); } catch {} } };
  const secs = d => { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || '') || []; return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0); };

  /* ---------- lectura de YouTube (con tu clave) ---------- */
  async function listIds(playlist, known, max = 200) {
    const ids = []; let token = '', pages = 0;
    do {
      const j = await Canales.yt('playlistItems', { part:'contentDetails', playlistId:playlist, maxResults:50, ...(token ? { pageToken:token } : {}) });
      const got = (j.items || []).map(i => i.contentDetails?.videoId).filter(Boolean);
      const fresh = got.filter(v => !known.has(v)); ids.push(...fresh);
      if (known.size && fresh.length < got.length) break;          // ya llegué a lo que tenía
      token = j.nextPageToken; pages++; prog = `leyendo… ${ids.length} videos`; paintProg();
    } while (token && pages < max);
    return ids;
  }
  async function details(ids) {
    const out = [];
    for (let i = 0; i < ids.length; i += 50) {
      const j = await Canales.yt('videos', { part:'snippet,contentDetails,status', id:ids.slice(i, i + 50).join(',') });
      for (const v of j.items || []) if (v.status?.embeddable !== false && v.snippet.liveBroadcastContent === 'none')
        out.push({ v:v.id, t:v.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'), d:secs(v.contentDetails.duration), y:v.snippet.publishedAt.slice(0, 10) });
      prog = `analizando… ${Math.min(i + 50, ids.length)}/${ids.length}`; paintProg();
    }
    return out;
  }
  async function uploadsOf(handle) { const j = await Canales.yt('channels', { part:'contentDetails', forHandle:handle }); const x = j.items?.[0]; if (!x) throw new Error('No encontré ' + handle); return x.contentDetails.relatedPlaylists.uploads; }
  async function refresh(key) {
    if (busy || !db.key) return; busy = key;
    try {
      const c = cache[key] = cache[key] || { vids:[] }, known = new Set(c.vids.map(x => x.v));
      let ids = [];
      if (key === 'fpt') ids = await listIds(await uploadsOf(FPT.handle), known);
      if (key === 'asc') for (const pl of ASC) ids.push(...await listIds(pl, known));
      if (key === 'pap') {
        ids = await listIds(await uploadsOf(PAP.handle), known);
        if (!c.searched || Date.now() - c.searched > 30 * 864e5) {   // también lo que esté subido en otros canales (cada 30 días)
          for (const qq of ['"paso a paso" tyc', 'paso a paso tyc sports informe', 'paso a paso tyc sports historia']) {
            let token = '';
            for (let p = 0; p < 2; p++) {
              const j = await Canales.yt('search', { part:'snippet', type:'video', q:qq, videoDuration:'medium', maxResults:50, ...(token ? { pageToken:token } : {}) });
              (j.items || []).forEach(i => { const v = i.id.videoId; if (v && !known.has(v) && !ids.includes(v) && /paso a paso/i.test(i.snippet.title)) ids.push(v); });
              token = j.nextPageToken; if (!token) break;
            }
          }
          c.searched = Date.now();
        }
      }
      const fresh = await details([...new Set(ids)]);
      c.vids = [...fresh, ...c.vids].sort((a, b) => b.y.localeCompare(a.y)); c.at = Date.now();
      saveCache();
      if (fresh.length) toast(`📼 ${fresh.length} video${fresh.length === 1 ? '' : 's'} nuevo${fresh.length === 1 ? '' : 's'}`, { ms:3000 });
    } catch (e) { toast(`<b>No pude leer YouTube</b><small>${esc(e.message || '')}</small>`, { cls:'info' }); }
    busy = null; prog = ''; if (Nav.current === 'fulbito') Fulbito.render(true);
  }

  /* ---------- clasificar ---------- */
  const RES = /resumen|goles|gol de|compacto|lo mejor|highlights|todos los goles|jugadas/i, NOT = /entrevista|conferencia|previa|programa completo|vestuario|declaraciones|f[uú]tbol para todos presenta/i;
  const isMatch = x => x.d >= 75 * 60 && !RES.test(x.t);
  const isRes = x => !isMatch(x) && x.d >= 40 && x.d < 45 * 60 && RES.test(x.t) && !NOT.test(x.t);
  const isPaP = x => /paso a paso/i.test(x.t) && x.d >= 9 * 60 && x.d <= 22 * 60;
  const lists = {
    partidos:() => (cache.fpt?.vids || []).filter(isMatch),
    resumenes:() => (cache.fpt?.vids || []).filter(isRes),
    ascenso:() => (cache.asc?.vids || []).filter(isMatch),
    pap:() => (cache.pap?.vids || []).filter(isPaP)
  };
  const keyOf = t => t === 'ascenso' ? 'asc' : t === 'pap' ? 'pap' : 'fpt';
  const teamRe = t => new RegExp('\\b' + norm(t).replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '\\b');

  /* ---------- pantalla ---------- */
  function paintProg() { const el = $('rtProg'); if (el) el.textContent = prog; }
  const dur = d => { const h = Math.floor(d / 3600), m = Math.round(d % 3600 / 60); return h ? `${h} h ${m} min` : `${m} min`; };
  function render(el, mode) {
    if (mode === 'pap') tab = 'pap'; else if (tab === 'pap') tab = 'partidos';
    const key = keyOf(tab), c = cache[key];
    if (db.key && !busy && (!c || Date.now() - (c.at || 0) > 7 * 864e5)) setTimeout(() => refresh(key), 50);
    const hid = new Set(hidden());
    let all = lists[tab]().filter(x => !hid.has(x.v));
    const counts = {}; if (tab !== 'pap') for (const x of all) { const n = norm(x.t); for (const tm of TEAMS) if (teamRe(tm).test(n)) counts[tm] = (counts[tm] || 0) + 1; }
    if (team && tab !== 'pap') all = all.filter(x => teamRe(team).test(norm(x.t)));
    if (q) all = all.filter(x => norm(x.t).includes(norm(q)));
    const teams = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    el.innerHTML = `
      ${mode === 'pap' ? `<div class="rthero"><div>👣</div><div><h2>Paso a Paso</h2><p>Los informes del programa de TyC Sports.</p></div></div>`
        : `<div class="rthero"><div>📼</div><div><h2>Fútbol retro</h2><p>Partidos completos y resúmenes de Fútbol Para Todos, y el ascenso.</p></div></div>
          <div class="chips" id="rtTabs"><button data-rt="partidos" class="${tab === 'partidos' ? 'on' : ''}">⚽ Partidos completos</button><button data-rt="resumenes" class="${tab === 'resumenes' ? 'on' : ''}">🎬 Resúmenes y goles</button><button data-rt="ascenso" class="${tab === 'ascenso' ? 'on' : ''}">🏟️ Ascenso</button></div>`}
      <div class="rtbar">
        ${tab !== 'pap' ? `<select id="rtTeam" style="width:auto"><option value="">Todos los equipos</option>${teams.map(([t, n]) => `<option ${t === team ? 'selected' : ''} value="${esc(t)}">${esc(t)} (${n})</option>`).join('')}${team && !counts[team] ? `<option selected value="${esc(team)}">${esc(team)}</option>` : ''}</select>` : ''}
        <input id="rtQ" placeholder="Buscar (rival, año, torneo…)" value="${esc(q)}">
        <button id="rtRand" title="Uno al azar">🎲</button>
        ${mode === 'pap' ? (edit ? `<button class="pri" id="rtSave">💾 Guardar cambios (${edit.size})</button><button id="rtCancel">Cancelar</button>` : '<button id="rtEdit" title="Sacar los videos que no son informes">✏️ Corregir lista</button>') : ''}
        <button id="rtRef" title="Buscar videos nuevos">⟳</button><span class="mut" id="rtProg" style="font-size:12px">${esc(prog)}</span>
      </div>
      ${!db.key ? '<div class="empty">Necesita la clave de YouTube (⚙) para leer los canales.</div>'
        : !c ? `<div class="empty">Leyendo ${tab === 'ascenso' ? 'las playlists del ascenso' : mode === 'pap' ? 'los informes de Paso a Paso' : 'el canal de Fútbol Para Todos'}… la primera vez tarda un poco.</div>`
        : all.length ? `<div class="mut" style="font-size:12px;margin:2px 0 8px">${all.length} video${all.length === 1 ? '' : 's'}${edit ? ' · tocá ✕ en los que no van y después “Guardar cambios”' : ''}</div>
          <div class="rtgrid">${all.slice(0, limit).map(x => `<div class="rtcard ${edit?.has(x.v) ? 'gone' : ''}" data-rv="${x.v}"><span class="rtimg" style="background-image:url('https://i.ytimg.com/vi/${x.v}/mqdefault.jpg')"><i>${dur(x.d)}</i></span>
            <b>${esc(x.t)}</b><small>${esc(x.y.slice(0, 4))}</small>${edit ? `<button class="rtdel" data-del="${x.v}" title="${edit.has(x.v) ? 'Volver a poner' : 'Sacar'}">${edit.has(x.v) ? '↺' : '✕'}</button>` : ''}</div>`).join('')}</div>
          ${all.length > limit ? '<div class="btns"><button id="rtMore">Ver más</button></div>' : ''}`
        : `<div class="empty">${busy ? 'Buscando…' : 'No encontré videos con ese filtro.'}</div>`}`;
    const re = () => Fulbito.render(true);
    if ($('rtTabs')) $('rtTabs').onclick = e => { const b = e.target.closest('[data-rt]'); if (b) { tab = b.dataset.rt; S.set('retroTab', tab); limit = 60; re(); } };
    if ($('rtTeam')) $('rtTeam').onchange = e => { team = e.target.value; S.set('retroTeam', team); limit = 60; re(); };
    $('rtQ').onchange = e => { q = e.target.value.trim(); limit = 60; re(); };
    $('rtRand').onclick = () => { if (all.length) play(all[Math.floor(Math.random() * all.length)]); };
    $('rtRef').onclick = () => refresh(key);
    if ($('rtMore')) $('rtMore').onclick = () => { limit += 60; re(); };
    if ($('rtEdit')) $('rtEdit').onclick = () => { edit = new Set(); re(); };
    if ($('rtCancel')) $('rtCancel').onclick = () => { edit = null; re(); };
    if ($('rtSave')) $('rtSave').onclick = () => { const h = hidden(); edit.forEach(v => { if (!h.includes(v)) h.push(v); }); const n = edit.size; edit = null; save(); toast(`🗑️ ${n} video${n === 1 ? '' : 's'} sacado${n === 1 ? '' : 's'} de la lista`, { ms:3000 }); re(); };
    el.querySelectorAll('[data-rv]').forEach(card => card.onclick = e => {
      const del = e.target.closest('[data-del]');
      if (del) { const v = del.dataset.del; edit.has(v) ? edit.delete(v) : edit.add(v); re(); return; }
      if (edit) return;
      const x = lists[tab]().find(y => y.v === card.dataset.rv); if (x) play(x);
    });
  }
  function play(x) { Player.play({ uid:'retro_' + x.v, platform:'youtube', ref:{ video:x.v }, name:tab === 'pap' ? 'Paso a Paso' : tab === 'ascenso' ? 'Ascenso retro' : 'Fútbol Para Todos' }); }
  return { render };
})();
