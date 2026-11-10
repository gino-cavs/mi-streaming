/* =========================================================
   Canales 24/7 ("Series", con el nombre que quieras): cada uno toma los videos de un canal
   o playlist de YouTube y los pasa al azar sin parar, como un canal en vivo.
   La grilla sale de la hora: si lo abrís en otro dispositivo, está pasando lo mismo.
   ========================================================= */
const T247 = {};   // todas las secciones 24/7 (Series, Películas…), por clave
function make247(C) {
  const EPOCH = Date.UTC(2026, 0, 1) / 1000, P = C.p, SEC = C.key;
  let cache = S.get(C.key + 'Cache', {}), busy = {}, grp = 'all', editing = null;
  const SR = () => { db[C.key] = db[C.key] || {}; const s = db[C.key]; s.title = s.title || C.title; s.icon = s.icon || C.icon; s.groups = s.groups || [C.title]; s.chans = s.chans || []; return s; };
  const saveCache = () => { try { S.set(C.key + 'Cache', cache); } catch { cache = {}; } };

  /* ---------- Videos de la fuente, con su duración ---------- */
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
  const secs = d => { const m = /P(?:(\d+)D)?T?(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/.exec(d || '') || []; return (+m[1] || 0) * 86400 + (+m[2] || 0) * 3600 + (+m[3] || 0) * 60 + (+m[4] || 0); };
  async function fetchVids(ch) {
    if (busy[ch.id]) return; busy[ch.id] = true;
    try {
      let list = ch.kind === 'playlist' ? ch.ref : ch.kind === 'multi' ? (ch.refs || [])[0] : ch.uploads;
      if (!list && ch.kind !== 'multi') {
        const j = await Canales.yt('channels', { part:'snippet,contentDetails', ...(ch.channelId ? { id:ch.channelId } : { forHandle:ch.handle }) });
        const x = j.items?.[0]; if (!x) throw new Error('No encontré el canal');
        ch.channelId = x.id; ch.uploads = list = x.contentDetails.relatedPlaylists.uploads;
        if (!ch.name) ch.name = x.snippet.title;
      }
      const ids = [];
      for (const pl of ch.kind === 'multi' ? (ch.refs || []) : [list]) {   // 'multi': varias playlists juntas (ej. todas las tandas mezcladas)
        let token = '', pages = 0;
        do {
          const j = await Canales.yt('playlistItems', { part:'contentDetails', playlistId:pl, maxResults:50, ...(token ? { pageToken:token } : {}) });
          (j.items || []).forEach(i => i.contentDetails?.videoId && ids.push(i.contentDetails.videoId));
          token = j.nextPageToken; pages++;
        } while (token && pages < 20);
      }
      const vids = [];
      for (let i = 0; i < ids.length; i += 50) {
        const j = await Canales.yt('videos', { part:'snippet,contentDetails,status', id:ids.slice(i, i + 50).join(',') });
        (j.items || []).forEach(v => {
          const d = secs(v.contentDetails.duration);
          // sin vivos, sin shorts y solo los que se pueden ver fuera de YouTube
          if ((d >= 70 || (ch.tandasMix && d >= 5)) && v.snippet.liveBroadcastContent === 'none' && v.status?.embeddable !== false) vids.push({ v:v.id, t:v.snippet.title, d });
        });
      }
      if (!vids.length) throw new Error('No encontré videos que se puedan pasar');
      cache[ch.id] = { at:Date.now(), vids }; ch.err = '';
      saveCache();
    } catch (e) { ch.err = e instanceof TypeError ? 'Sin conexión con YouTube' : e.message; ch.errAt = Date.now(); }
    busy[ch.id] = false;
  }
  // orden al azar pero fijo para cada canal (así la "grilla" es la misma en todos lados)
  function order(ch) {
    const c = cache[ch.id]; if (!c) return null;
    if (c.ordId === ch.id + c.vids.length) return c.ord;
    let seed = [...ch.id].reduce((a, x) => (a * 31 + x.charCodeAt(0)) >>> 0, 7);
    const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
    const a = c.vids.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    c.ord = a; c.ordId = ch.id + c.vids.length; return a;
  }
  // qué está "al aire" ahora
  function now(id) {
    const ch = SR().chans.find(x => x.id === id); if (!ch) return null;
    const a = order(ch); if (!a || !a.length) return null;
    const total = a.reduce((s, x) => s + x.d, 0);
    let t = (Date.now() / 1000 - EPOCH) % total;
    for (let i = 0; i < a.length; i++) {
      if (t < a[i].d) return { ...a[i], off:Math.floor(t), left:a[i].d - t, next:a[(i + 1) % a.length] };
      t -= a[i].d;
    }
    return { ...a[0], off:0, left:a[0].d, next:a[1] || a[0] };
  }
  async function play(id) {
    const ch = SR().chans.find(x => x.id === id); let n = now(id);
    if (ch && !n && !busy[id]) { toast('<b>Cargando ' + esc(ch.name) + '…</b>', { cls:'info' }); await fetchVids(ch); n = now(id); }
    if (!ch || !n) { toast('<b>Este canal todavía no tiene videos cargados</b><small>Esperá unos segundos y probá de nuevo.</small>', { cls:'info' }); return; }
    Player.play({ uid:C.uidp + id, platform:'youtube', ref:{ video:n.v }, name:ch.name, t247:id }, { start:n.off });
  }
  // el reproductor llama a esto cuando termina un video
  function nextFor(id) { return now(id); }
  function randomFor(id) { const ch = SR().chans.find(x => x.id === id), a = ch && order(ch); return a && a.length ? a[Math.floor(Math.random() * a.length)] : null; }

  /* ---------- 🎲 Capítulo al azar en tus servicios (solo en Series) ---------- */
  const SHOWS = [
    { id:'simpsons', n:'Los Simpson', where:'Disney+', ic:'🍩', url:'https://www.disneyplus.com/es-419/series/los-simpson/3ZoBZ52QHb4x', tvmaze:83 },
    { id:'icarly', n:'iCarly', where:'Pluto TV (gratis)', ic:'💻', url:'https://pluto.tv/latam/on-demand', tvq:'iCarly' },
    { id:'drakejosh', n:'Drake & Josh', where:'Pluto TV (gratis)', ic:'🎸', url:'https://pluto.tv/latam/on-demand', tvq:'Drake & Josh' },
    { id:'zoey', n:'Zoey 101', where:'Pluto TV (gratis)', ic:'🏫', url:'https://pluto.tv/latam/on-demand', tvq:'Zoey 101' },
    { id:'kenankel', n:'Kenan & Kel', where:'Pluto TV (gratis)', ic:'🍊', url:'https://pluto.tv/latam/on-demand', tvq:'Kenan & Kel' },
    { id:'simuladores', n:'Los Simuladores', where:'mitelefe', ic:'🕵️', seasons:[13, 11], ep:(s, e) => `https://www.mitelefe.com/los-simuladores/temporada-${s}/capitulo-${String(e).padStart(2, '0')}` }
  ];
  let picks = S.get('azarPicks', {});
  async function pickEp(sh) {
    if (sh.tvq && !sh.tvmaze) { const id = S.get('tvmz_' + sh.id, null) || await fetch('https://api.tvmaze.com/singlesearch/shows?q=' + encodeURIComponent(sh.tvq)).then(r => r.json()).then(j => j.id).catch(() => null); if (!id) return toast('<b>No pude traer la lista de capítulos</b>', { cls:'info' }); S.set('tvmz_' + sh.id, id); sh.tvmaze = id; }
    if (sh.tvmaze) {
      let eps = S.get('eps' + sh.tvmaze, null);
      if (!eps || Date.now() - eps.at > 14 * 864e5) {
        try { const j = await (await fetch(`https://api.tvmaze.com/shows/${sh.tvmaze}/episodes`)).json(); eps = { at:Date.now(), l:j.filter(e => e.season > 0 && e.number && (!e.airdate || Date.parse(e.airdate) < Date.now())).map(e => [e.season, e.number, e.name, e.image?.medium || '']) }; S.set('eps' + sh.tvmaze, eps); }
        catch { toast('<b>No pude traer la lista de capítulos</b>', { cls:'info' }); return; }
      }
      const [s, e, name, img] = eps.l[Math.floor(Math.random() * eps.l.length)];
      picks[sh.id] = { s, e, name, img, url:sh.url };
    } else {
      const s = 1 + Math.floor(Math.random() * sh.seasons.length), e = 1 + Math.floor(Math.random() * sh.seasons[s - 1]);
      picks[sh.id] = { s, e, url:sh.ep(s, e) };
    }
    S.set('azarPicks', picks); render();
  }
  const azarBlock = () => SEC !== 'series' ? '' : `<h2 class="sec">🎲 Capítulo al azar en tus servicios</h2><div class="azgrid">${SHOWS.map(sh => { const p = picks[sh.id];
    return `<div class="azcard"><div class="azimg" style="${p?.img ? `background-image:url('${esc(p.img)}')` : ''}">${p?.img ? '' : sh.ic}</div>
      <div class="aztx"><b>${esc(sh.n)}</b><small>en ${esc(sh.where)}</small>
        ${p ? `<span class="azep">Temporada ${p.s} · Capítulo ${p.e}${p.name ? ` · <i>${esc(p.name)}</i>` : ''}</span>` : '<span class="mut" style="font-size:13px">Tocá 🎲 para que te elija uno.</span>'}
        <div class="btns" style="margin-top:6px"><button data-az="${sh.id}">🎲 ${p ? 'Otro' : 'Elegir'}</button>${p ? `<a class="pri lnk btnl" href="${esc(p.url)}" target="_blank" rel="noopener">▶ Ver en ${esc(sh.where)} ↗</a>` : ''}</div>
        ${p && (sh.tvmaze || sh.tvq) ? `<small class="mut">${esc(sh.where.replace(/ \(.*/, ''))} no deja abrir un capítulo directo: entrá a la serie y elegí T${p.s} E${p.e}.</small>` : ''}</div></div>`; }).join('')}</div>
    <div class="nickpluto"><b>🧡 Nick de los 2000 en Pluto TV</b> <span class="mut">gratis y oficial: iCarly, Drake & Josh, Zoey 101, Kenan & Kel, Big Time Rush… a demanda y en canales 24/7.</span>
      <div class="btns"><a class="lnk btnl" href="https://pluto.tv/latam/on-demand" target="_blank" rel="noopener">📚 A demanda ↗</a><a class="lnk btnl" href="https://pluto.tv/latam/live-tv" target="_blank" rel="noopener">📺 Canales en vivo ↗</a></div>
      <small class="mut">En la tele: instalá la app gratis de Pluto TV en el Fire Stick y los links se abren ahí.</small></div>`;

  /* ---------- Pantalla ---------- */
  const fmt = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${m} min` : `${m} min`; };
  function render() {
    const v = $('v-' + SEC), s = SR();
    s.chans.forEach(ch => { if (db.key && !cache[ch.id] && !busy[ch.id] && !(ch.errAt && Date.now() - ch.errAt < 30 * 60e3)) fetchVids(ch).then(() => { saveLocal(); if (Nav.current === SEC) render(); }); });   // se lee una sola vez: son series que ya no suben capítulos
    const list = s.chans.filter(ch => grp === 'all' || ch.group === grp);
    v.innerHTML = `
      <div class="srhero"><div class="srico">${esc(s.icon)}</div><div style="flex:1"><h2>${esc(s.title)}</h2><p>${esc(C.sub)}</p></div>
        <button id="${P}srRename" title="Cambiar el nombre de este apartado">✎ Renombrar</button></div>
      ${azarBlock()}
      <div class="subbar">
        <div class="tabs"><button data-g="all" class="${grp === 'all' ? 'on' : ''}">Todos <span class="cnt">${s.chans.length}</span></button>
          ${s.groups.map(g => `<button data-g="${esc(g)}" class="${grp === g ? 'on' : ''}">${esc(g)} <span class="cnt">${s.chans.filter(c => c.group === g).length}</span></button>`).join('')}</div>
        <button class="pri" id="${P}srAdd">＋ Canal 24/7</button><button id="${P}srGroups">Apartados</button>
      </div>
      ${!db.key ? '<div class="empty">Necesita la clave de YouTube (⚙) para leer los videos.</div>'
        : list.length ? `<div class="srgrid">${list.map(ch => {
            const n = now(ch.id);
            return `<div class="srcard" data-play="${ch.id}">
              <div class="thumb" style="${n ? `background-image:url('https://i.ytimg.com/vi/${n.v}/mqdefault.jpg')` : ''}">${n ? '<span class="badge onair">● AL AIRE</span>' : `<span class="badge">${busy[ch.id] ? 'Cargando videos…' : ch.err ? '⚠ ' + esc(ch.err) : 'Sin videos'}</span>`}
                <button class="sredit" data-edit="${ch.id}" title="Editar">✎</button></div>
              <div class="info"><div class="n">${esc(ch.name || '…')}</div>
                ${n ? `<div class="t" style="min-height:0">Ahora: ${esc(n.t)}</div>
                  <div class="srprog"><i style="width:${Math.round(n.off / n.d * 100)}%"></i></div>
                  <div class="mut" style="font-size:12px">Quedan ${fmt(n.left)} · Después: ${esc(n.next.t)}</div>` : ''}
              </div></div>`; }).join('')}</div>`
        : `<div class="empty">Todavía no armaste canales 24/7${grp !== 'all' ? ' en este apartado' : ''}.<br>Tocá <b>＋ Canal 24/7</b> y pegá el link de un canal o una playlist de YouTube ${esc(C.ej)}.</div>`}`;
    v.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { grp = b.dataset.g; render(); });
    v.querySelectorAll('[data-az]').forEach(b => b.onclick = () => pickEp(SHOWS.find(x => x.id === b.dataset.az)));
    v.querySelectorAll('[data-play]').forEach(c => c.onclick = e => { if (!e.target.closest('[data-edit]')) play(c.dataset.play); });
    v.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openCh(b.dataset.edit));
    $(P + 'srAdd').onclick = () => openCh(null);
    $(P + 'srGroups').onclick = openGroups;
    $(P + 'srRename').onclick = () => { $(P + 'srTitle').value = s.title; $(P + 'srIcon').value = s.icon; $(P + 'dlgSrName').showModal(); };
  }

  /* ---------- Diálogos ---------- */
  // links de un canal, para mostrarlos al editar
  const plUrl = r => 'youtube.com/playlist?list=' + r;
  const links = c => c.links || (c.kind === 'multi' ? (c.refs || []).map(plUrl) : c.kind === 'playlist' ? [plUrl(c.ref)] : [c.handle ? 'youtube.com/' + c.handle : 'youtube.com/channel/' + c.channelId]);
  // de varios links a una fuente: si es uno solo queda igual que antes; si son varios, 'multi' con las playlists (los canales usan sus subidas)
  async function srcFrom(raw) {
    const lines = raw.split(/[\n\s]+/).map(x => x.trim()).filter(Boolean);
    const xs = lines.map(parseSrc); if (!xs.length || xs.some(x => !x)) return null;
    if (xs.length === 1) return { ...xs[0], links:lines };
    const refs = [];
    for (const x of xs) {
      if (x.kind === 'playlist') { refs.push(x.ref); continue; }
      const j = await Canales.yt('channels', { part:'contentDetails', ...(x.channelId ? { id:x.channelId } : { forHandle:x.handle }) });
      const up = j.items?.[0]?.contentDetails?.relatedPlaylists?.uploads; if (!up) throw new Error('No encontré el canal ' + (x.handle || x.channelId)); refs.push(up);
    }
    return { kind:'multi', refs:[...new Set(refs)], links:lines };
  }
  function openCh(id) {
    editing = id ? SR().chans.find(c => c.id === id) : null;
    $(P + 'scTitle').textContent = editing ? 'Editar canal 24/7' : 'Nuevo canal 24/7';
    $(P + 'scUrl').value = editing ? links(editing).join('\n') : ''; $(P + 'scUrl').disabled = !!editing?.tandasMix; $(P + 'scName').value = editing ? editing.name : '';
    $(P + 'scGroup').innerHTML = SR().groups.map(g => `<option ${(editing ? editing.group : grp) === g ? 'selected' : ''}>${esc(g)}</option>`).join('');
    $(P + 'scSec').innerHTML = Object.values(T247).map(t => `<option value="${t.key}" ${t.key === SEC ? 'selected' : ''}>${esc(t.label())}</option>`).join('');
    $(P + 'scDel').style.display = editing ? '' : 'none'; $(P + 'scMsg').textContent = '';
    $(P + 'dlgSr').showModal();
  }
  function openGroups() {
    const paint = () => {
      $(P + 'sgList').innerHTML = SR().groups.map((g, i) => `<div class="catrow"><input value="${esc(g)}" data-i="${i}"><button data-del="${i}" title="Borrar">✕</button></div>`).join('');
      $(P + 'sgList').querySelectorAll('input').forEach(inp => inp.onchange = () => {
        const old = SR().groups[inp.dataset.i], nu = inp.value.trim();
        if (!nu || (SR().groups.includes(nu) && nu !== old)) { inp.value = old; return; }
        SR().groups[inp.dataset.i] = nu; SR().chans.forEach(c => { if (c.group === old) c.group = nu; }); if (grp === old) grp = nu;
        save(); render();
      });
      $(P + 'sgList').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        if (SR().groups.length === 1) { toast('<b>Tiene que quedar al menos un apartado</b>', { cls:'info', ms:3000 }); return; }
        const [g] = SR().groups.splice(+b.dataset.del, 1); SR().chans.forEach(c => { if (c.group === g) c.group = SR().groups[0]; });
        if (grp === g) grp = 'all'; save(); paint(); render();
      });
    };
    $(P + 'sgNew').value = ''; paint(); $(P + 'dlgSrGroups').showModal();
    $(P + 'sgAdd').onclick = () => { const g = $(P + 'sgNew').value.trim(); if (g && !SR().groups.includes(g)) { SR().groups.push(g); save(); paint(); render(); } $(P + 'sgNew').value = ''; };
  }
  function init() {
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="${P}dlgSr"><h3 id="${P}scTitle">Nuevo canal 24/7</h3>
        <label>Links de canales o playlists de YouTube <small style="opacity:.7">(uno por renglón, podés poner varios y se mezclan)</small></label><textarea id="${P}scUrl" rows="3" style="width:100%;resize:vertical" placeholder="youtube.com/playlist?list=…&#10;youtube.com/@canal&#10;otra playlist…"></textarea>
        <label>Nombre del canal (opcional)</label><input id="${P}scName" placeholder="Ej: Policías en Acción 24/7">
        <label>Apartado</label><select id="${P}scGroup"></select>
        <label>Sección</label><select id="${P}scSec"></select>
        <p style="margin-top:6px">Toma todos los videos (hasta 1000, sin vivos ni shorts) una sola vez y los pasa al azar sin parar.</p>
        <div class="msg" id="${P}scMsg"></div>
        <div class="btns"><button id="${P}scDel" style="color:#ff7b7b">Borrar</button><span class="sp"></span><button data-close>Cancelar</button><button class="pri" id="${P}scSave">Guardar</button></div></dialog>
      <dialog id="${P}dlgSrGroups"><h3>Apartados</h3><p>Renombrá, borrá o agregá apartados (por ejemplo: Series, Policiales, Documentales).</p>
        <div id="${P}sgList" style="margin-top:10px"></div>
        <div class="catrow"><input id="${P}sgNew" placeholder="Nuevo apartado"><button id="${P}sgAdd">Agregar</button></div>
        <div class="btns"><span class="sp"></span><button class="pri" data-close>Listo</button></div></dialog>
      <dialog id="${P}dlgSrName"><h3>Nombre de la sección</h3>
        <label>Ícono</label><input id="${P}srIcon" maxlength="4" style="width:90px">
        <label>Nombre</label><input id="${P}srTitle" placeholder="Series">
        <div class="btns"><span class="sp"></span><button data-close>Cancelar</button><button class="pri" id="${P}srNameSave">Guardar</button></div></dialog>`);
    ['dlgSr', 'dlgSrGroups', 'dlgSrName'].forEach(id => $(P + id).querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(P + id).close()));
    $(P + 'srNameSave').onclick = () => { const s = SR(); s.title = $(P + 'srTitle').value.trim() || C.title; s.icon = $(P + 'srIcon').value.trim() || C.icon; save(); $(P + 'dlgSrName').close(); Nav.badges(); Zap.render(); render(); };
    $(P + 'scDel').onclick = () => { SR().chans = SR().chans.filter(c => c !== editing); delete cache[editing.id]; saveCache(); save(); $(P + 'dlgSr').close(); render(); };
    $(P + 'scSave').onclick = async () => {
      const m = $(P + 'scMsg');
      if (editing && !editing.tandasMix && $(P + 'scUrl').value.trim() && $(P + 'scUrl').value.trim() !== links(editing).join('\n')) {   // cambiaron los links: vuelvo a leer
        let x; try { x = await srcFrom($(P + 'scUrl').value); } catch (e) { m.className = 'msg err'; m.textContent = e.message; return; }
        if (!x) { m.className = 'msg err'; m.textContent = 'Hay un renglón que no es un link de canal o playlist de YouTube.'; return; }
        const test = { ...editing, kind:undefined, ref:undefined, refs:undefined, uploads:undefined, channelId:undefined, handle:undefined, ...x, id:editing.id + '_t' };
        m.className = 'msg'; m.textContent = 'Leyendo los videos…'; await fetchVids(test);
        if (!cache[test.id]) { m.className = 'msg err'; m.textContent = test.err || 'No se pudo leer.'; return; }
        ['kind', 'ref', 'refs', 'uploads', 'channelId', 'handle', 'links'].forEach(k => delete editing[k]); Object.assign(editing, x, test.uploads ? { uploads:test.uploads, channelId:test.channelId } : {});
        cache[editing.id] = cache[test.id]; delete cache[test.id]; delete cache[editing.id].ordId; saveCache();
        toast(`<b>${esc(editing.name)}</b><small>${cache[editing.id].vids.length} videos en rotación</small>`, { ms:3000 });
      }
      if (editing) {
        editing.name = $(P + 'scName').value.trim() || editing.name; editing.group = $(P + 'scGroup').value;
        const to = $(P + 'scSec').value;
        if (to && to !== SEC && T247[to]) { SR().chans = SR().chans.filter(c => c !== editing); T247[to].adopt(editing, cache[editing.id]); delete cache[editing.id]; saveCache(); toast(`Movido a ${esc(T247[to].label())}`, { ms:3000 }); }
        save(); $(P + 'dlgSr').close(); render(); Zap.render(); return;
      }
      if (!db.key) { m.className = 'msg err'; m.textContent = 'Primero cargá la clave de YouTube en ⚙.'; return; }
      let x; try { x = await srcFrom($(P + 'scUrl').value); } catch (e) { m.className = 'msg err'; m.textContent = e.message; return; }
      if (!x) { m.className = 'msg err'; m.textContent = 'Pegá links de canales (youtube.com/@canal) o de playlists, uno por renglón.'; return; }
      const ch = { id:uid(), name:$(P + 'scName').value.trim(), group:$(P + 'scGroup').value, ...x };
      m.className = 'msg'; m.textContent = 'Leyendo los videos del canal…';
      await fetchVids(ch);
      if (!cache[ch.id]) { m.className = 'msg err'; m.textContent = ch.err || 'No se pudo leer el canal.'; return; }
      const to = $(P + 'scSec').value; if (to && to !== SEC && T247[to]) T247[to].adopt(ch, cache[ch.id]); else SR().chans.push(ch); save();
      m.className = 'msg ok'; m.textContent = `Listo: ${cache[ch.id].vids.length} videos en rotación.`;
      setTimeout(() => $(P + 'dlgSr').close(), 900); render();
    };
    setInterval(() => { if (Nav.current === SEC && !document.hidden) render(); }, 30e3);
    onChange(() => { if (Nav.current === SEC) render(); });
  }
  // recibir un canal que viene de otra sección 24/7
  function adopt(ch, c) { ch.group = SR().groups[0]; SR().chans.push(ch); if (c) { cache[ch.id] = c; saveCache(); } }
  const owns = id => SR().chans.some(c => c.id === id);
  const forget = id => { delete cache[id]; saveCache(); };   // volver a leer los videos de un canal
  const setTitle = t => { const s = SR(); const m = t.match(/^(\p{Extended_Pictographic}\uFE0F?)\s*(.*)$/u); if (m) { s.icon = m[1]; s.title = m[2] || s.title; } else s.title = t; save(); };
  const api = { key:SEC, init, render, play, now, nextFor, randomFor, adopt, owns, forget, setTitle, label:() => `${SR().icon} ${SR().title}`, get chans() { return SR().chans; }, uidp:C.uidp };
  T247[SEC] = api; return api;
}
const Series = make247({ key:'series', p:'', title:'Series', icon:'📼', uidp:'s247_', sub:'Canales 24/7: capítulos al azar sin parar, como un canal en vivo.', ej:'(por ejemplo, el de Policías en Acción)' });
const Peliculas = make247({ key:'peliculas', p:'pe', title:'Películas', icon:'🎬', uidp:'p247_', sub:'Películas 24/7: películas al azar sin parar, como un canal de cine.', ej:'con películas completas' });
// el reproductor pregunta por el siguiente video sin saber de qué sección es
const T247any = { now:id => (Object.values(T247).find(t => t.owns(id)) || Series).now(id), nextFor:id => (Object.values(T247).find(t => t.owns(id)) || Series).nextFor(id), randomFor:id => (Object.values(T247).find(t => t.owns(id)) || Series).randomFor(id) };
