/* =========================================================
   Canales 24/7 ("Series", con el nombre que quieras): cada uno toma los videos de un canal
   o playlist de YouTube y los pasa al azar sin parar, como un canal en vivo.
   La grilla sale de la hora: si lo abrís en otro dispositivo, está pasando lo mismo.
   ========================================================= */
const Series = (() => {
  const EPOCH = Date.UTC(2026, 0, 1) / 1000;
  let cache = S.get('seriesCache', {}), busy = {}, grp = 'all', editing = null;
  const SR = () => { db.series = db.series || {}; const s = db.series; s.title = s.title || 'Series'; s.icon = s.icon || '📼'; s.groups = s.groups || ['Series']; s.chans = s.chans || []; return s; };
  const saveCache = () => { try { S.set('seriesCache', cache); } catch { cache = {}; } };

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
      let list = ch.kind === 'playlist' ? ch.ref : ch.uploads;
      if (!list) {
        const j = await Canales.yt('channels', { part:'snippet,contentDetails', ...(ch.channelId ? { id:ch.channelId } : { forHandle:ch.handle }) });
        const x = j.items?.[0]; if (!x) throw new Error('No encontré el canal');
        ch.channelId = x.id; ch.uploads = list = x.contentDetails.relatedPlaylists.uploads;
        if (!ch.name) ch.name = x.snippet.title;
      }
      const ids = []; let token = '', pages = 0;
      do {
        const j = await Canales.yt('playlistItems', { part:'contentDetails', playlistId:list, maxResults:50, ...(token ? { pageToken:token } : {}) });
        (j.items || []).forEach(i => i.contentDetails?.videoId && ids.push(i.contentDetails.videoId));
        token = j.nextPageToken; pages++;
      } while (token && pages < 6);
      const vids = [];
      for (let i = 0; i < ids.length; i += 50) {
        const j = await Canales.yt('videos', { part:'snippet,contentDetails,status', id:ids.slice(i, i + 50).join(',') });
        (j.items || []).forEach(v => {
          const d = secs(v.contentDetails.duration);
          // sin vivos, sin shorts y solo los que se pueden ver fuera de YouTube
          if (d >= 70 && v.snippet.liveBroadcastContent === 'none' && v.status?.embeddable !== false) vids.push({ v:v.id, t:v.snippet.title, d });
        });
      }
      if (!vids.length) throw new Error('No encontré videos que se puedan pasar');
      cache[ch.id] = { at:Date.now(), vids }; ch.err = '';
      saveCache();
    } catch (e) { ch.err = e instanceof TypeError ? 'Sin conexión con YouTube' : e.message; }
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
  function play(id) {
    const ch = SR().chans.find(x => x.id === id), n = now(id);
    if (!ch || !n) { toast('<b>Este canal todavía no tiene videos cargados</b><small>Esperá unos segundos y probá de nuevo.</small>', { cls:'info' }); return; }
    Player.play({ uid:'s247_' + id, platform:'youtube', ref:{ video:n.v }, name:ch.name, t247:id }, { start:n.off });
  }
  // el reproductor llama a esto cuando termina un video
  function nextFor(id) { return now(id); }
  function randomFor(id) { const ch = SR().chans.find(x => x.id === id), a = ch && order(ch); return a && a.length ? a[Math.floor(Math.random() * a.length)] : null; }

  /* ---------- Pantalla ---------- */
  const fmt = s => { s = Math.max(0, Math.round(s)); const h = Math.floor(s / 3600), m = Math.floor(s % 3600 / 60); return h ? `${h} h ${m} min` : `${m} min`; };
  function render() {
    const v = $('v-series'), s = SR();
    s.chans.forEach(ch => { if (db.key && (!cache[ch.id] || Date.now() - cache[ch.id].at > 24 * 3600e3) && !busy[ch.id]) fetchVids(ch).then(() => { saveLocal(); if (Nav.current === 'series') render(); }); });
    const list = s.chans.filter(ch => grp === 'all' || ch.group === grp);
    v.innerHTML = `
      <div class="srhero"><div class="srico">${esc(s.icon)}</div><div style="flex:1"><h2>${esc(s.title)}</h2><p>Canales 24/7: videos al azar sin parar, como un canal en vivo.</p></div>
        <button id="srRename" title="Cambiar el nombre de este apartado">✎ Renombrar</button></div>
      <div class="subbar">
        <div class="tabs"><button data-g="all" class="${grp === 'all' ? 'on' : ''}">Todos <span class="cnt">${s.chans.length}</span></button>
          ${s.groups.map(g => `<button data-g="${esc(g)}" class="${grp === g ? 'on' : ''}">${esc(g)} <span class="cnt">${s.chans.filter(c => c.group === g).length}</span></button>`).join('')}</div>
        <button class="pri" id="srAdd">＋ Canal 24/7</button><button id="srGroups">Apartados</button>
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
        : `<div class="empty">Todavía no armaste canales 24/7${grp !== 'all' ? ' en este apartado' : ''}.<br>Tocá <b>＋ Canal 24/7</b> y pegá el link de un canal de YouTube (por ejemplo, el de Policías en Acción).</div>`}`;
    v.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { grp = b.dataset.g; render(); });
    v.querySelectorAll('[data-play]').forEach(c => c.onclick = e => { if (!e.target.closest('[data-edit]')) play(c.dataset.play); });
    v.querySelectorAll('[data-edit]').forEach(b => b.onclick = () => openCh(b.dataset.edit));
    $('srAdd').onclick = () => openCh(null);
    $('srGroups').onclick = openGroups;
    $('srRename').onclick = () => { $('srTitle').value = s.title; $('srIcon').value = s.icon; $('dlgSrName').showModal(); };
  }

  /* ---------- Diálogos ---------- */
  function openCh(id) {
    editing = id ? SR().chans.find(c => c.id === id) : null;
    $('scTitle').textContent = editing ? 'Editar canal 24/7' : 'Nuevo canal 24/7';
    $('scUrl').value = ''; $('scUrl').disabled = !!editing; $('scName').value = editing ? editing.name : '';
    $('scGroup').innerHTML = SR().groups.map(g => `<option ${(editing ? editing.group : grp) === g ? 'selected' : ''}>${esc(g)}</option>`).join('');
    $('scDel').style.display = editing ? '' : 'none'; $('scMsg').textContent = '';
    $('dlgSr').showModal();
  }
  function openGroups() {
    const paint = () => {
      $('sgList').innerHTML = SR().groups.map((g, i) => `<div class="catrow"><input value="${esc(g)}" data-i="${i}"><button data-del="${i}" title="Borrar">✕</button></div>`).join('');
      $('sgList').querySelectorAll('input').forEach(inp => inp.onchange = () => {
        const old = SR().groups[inp.dataset.i], nu = inp.value.trim();
        if (!nu || (SR().groups.includes(nu) && nu !== old)) { inp.value = old; return; }
        SR().groups[inp.dataset.i] = nu; SR().chans.forEach(c => { if (c.group === old) c.group = nu; }); if (grp === old) grp = nu;
        save(); render();
      });
      $('sgList').querySelectorAll('[data-del]').forEach(b => b.onclick = () => {
        if (SR().groups.length === 1) { toast('<b>Tiene que quedar al menos un apartado</b>', { cls:'info', ms:3000 }); return; }
        const [g] = SR().groups.splice(+b.dataset.del, 1); SR().chans.forEach(c => { if (c.group === g) c.group = SR().groups[0]; });
        if (grp === g) grp = 'all'; save(); paint(); render();
      });
    };
    $('sgNew').value = ''; paint(); $('dlgSrGroups').showModal();
    $('sgAdd').onclick = () => { const g = $('sgNew').value.trim(); if (g && !SR().groups.includes(g)) { SR().groups.push(g); save(); paint(); render(); } $('sgNew').value = ''; };
  }
  function init() {
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="dlgSr"><h3 id="scTitle">Nuevo canal 24/7</h3>
        <label>Link del canal o playlist de YouTube</label><input id="scUrl" placeholder="youtube.com/@canal  ·  youtube.com/playlist?list=…">
        <label>Nombre del canal (opcional)</label><input id="scName" placeholder="Ej: Policías en Acción 24/7">
        <label>Apartado</label><select id="scGroup"></select>
        <p style="margin-top:6px">Toma hasta los últimos 300 videos (sin vivos ni shorts) y los pasa al azar sin parar.</p>
        <div class="msg" id="scMsg"></div>
        <div class="btns"><button id="scDel" style="color:#ff7b7b">Borrar</button><span class="sp"></span><button data-close>Cancelar</button><button class="pri" id="scSave">Guardar</button></div></dialog>
      <dialog id="dlgSrGroups"><h3>Apartados</h3><p>Renombrá, borrá o agregá apartados (por ejemplo: Series, Policiales, Documentales).</p>
        <div id="sgList" style="margin-top:10px"></div>
        <div class="catrow"><input id="sgNew" placeholder="Nuevo apartado"><button id="sgAdd">Agregar</button></div>
        <div class="btns"><span class="sp"></span><button class="pri" data-close>Listo</button></div></dialog>
      <dialog id="dlgSrName"><h3>Nombre de la sección</h3>
        <label>Ícono</label><input id="srIcon" maxlength="4" style="width:90px">
        <label>Nombre</label><input id="srTitle" placeholder="Series">
        <div class="btns"><span class="sp"></span><button data-close>Cancelar</button><button class="pri" id="srNameSave">Guardar</button></div></dialog>`);
    ['dlgSr', 'dlgSrGroups', 'dlgSrName'].forEach(id => $(id).querySelectorAll('[data-close]').forEach(b => b.onclick = () => $(id).close()));
    $('srNameSave').onclick = () => { const s = SR(); s.title = $('srTitle').value.trim() || 'Series'; s.icon = $('srIcon').value.trim() || '📼'; save(); $('dlgSrName').close(); Nav.badges(); Zap.render(); render(); };
    $('scDel').onclick = () => { SR().chans = SR().chans.filter(c => c !== editing); delete cache[editing.id]; saveCache(); save(); $('dlgSr').close(); render(); };
    $('scSave').onclick = async () => {
      const m = $('scMsg');
      if (editing) { editing.name = $('scName').value.trim() || editing.name; editing.group = $('scGroup').value; save(); $('dlgSr').close(); render(); return; }
      const x = parseSrc($('scUrl').value);
      if (!x) { m.className = 'msg err'; m.textContent = 'Pegá el link de un canal (youtube.com/@canal) o de una playlist.'; return; }
      if (!db.key) { m.className = 'msg err'; m.textContent = 'Primero cargá la clave de YouTube en ⚙.'; return; }
      const ch = { id:uid(), name:$('scName').value.trim(), group:$('scGroup').value, ...x };
      m.className = 'msg'; m.textContent = 'Leyendo los videos del canal…';
      await fetchVids(ch);
      if (!cache[ch.id]) { m.className = 'msg err'; m.textContent = ch.err || 'No se pudo leer el canal.'; return; }
      SR().chans.push(ch); save();
      m.className = 'msg ok'; m.textContent = `Listo: ${cache[ch.id].vids.length} videos en rotación.`;
      setTimeout(() => $('dlgSr').close(), 900); render();
    };
    setInterval(() => { if (Nav.current === 'series' && !document.hidden) render(); }, 30e3);
    onChange(() => { if (Nav.current === 'series') render(); });
  }
  return { init, render, play, now, nextFor, randomFor, label:() => `${SR().icon} ${SR().title}`, get chans() { return SR().chans; } };
})();
