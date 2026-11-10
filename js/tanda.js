/* =========================================================
   📼 Tanda retro: las publicidades argentinas de 2000-2011 (playlist de YouTube).
   - Botón "Tanda retro": 3-4 publicidades al azar y después vuelve a lo que estabas mirando.
   - En los canales 24/7, cada ~30 minutos entra una tanda corta, como en la tele de antes (se apaga en Ajustes).
   - Además es un canal 24/7 más ("Tandas retro 2000s") para dejarlo de fondo.
   ========================================================= */
const Tanda = (() => {
  const PL = 'PLW2SmGPb8T2UONtqBR19yof_tTpa3HGjT';
  let busy = false, lastT247 = 0;
  const cache = S.get('tandaCache', {});
  // tus playlists de tandas (se cargan en 24/7 → 📼 Tandas); la de siempre viene de arranque
  // la lista arranca vacía: las playlists las cargás vos (una vez se saca la que venía de arranque)
  const lists = () => { if (!Array.isArray(db.tandas)) db.tandas = []; if (!db.series?.tandaDefOut) { db.tandas = db.tandas.filter(t => t.ref !== PL); db.series = db.series || {}; db.series.tandaDefOut = true; save(); } return db.tandas; };
  async function one(ref) {
    const c = cache[ref]; if (c && Date.now() - c.at < 7 * 864e5 && c.l.length) return c.l;
    if (!db.key) return c?.l || [];
    const l = []; let page = '';
    try { do { const j = await Canales.yt('playlistItems', { part:'contentDetails,status', playlistId:ref, maxResults:50, ...(page ? { pageToken:page } : {}) });
      (j.items || []).forEach(x => x.status?.privacyStatus !== 'private' && x.contentDetails?.videoId && l.push(x.contentDetails.videoId)); page = j.nextPageToken || ''; } while (page && l.length < 400); } catch {}
    if (l.length) { cache[ref] = { at:Date.now(), l }; S.set('tandaCache', cache); }
    return cache[ref]?.l || [];
  }
  async function load() {
    if (busy) return [];
    busy = true; const all = [];
    try { for (const t of lists().filter(t => t.on !== false)) all.push(...await one(t.ref)); } finally { busy = false; }
    return [...new Set(all)];
  }
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  /** Tanda corta y vuelta a lo que había */
  async function play(n = 3 + Math.floor(Math.random() * 2), auto = false) {
    const l = await load(); if (!l.length) return toast(!lists().some(t => t.on !== false) ? '<b>📼 Todavía no hay tandas</b><small>Cargá tus playlists en 24/7 → Tandas.</small>' : '<b>Para la tanda retro necesito tu clave de YouTube</b><small>Cargala en ⚙ Ajustes.</small>', { cls:'info', onclick:() => Nav.go('tandas') });
    const s = Player.slots[Player.sel], pick = shuffle(l).slice(0, n);
    let prev = s?.c && s.c.uid !== 'tanda' ? s.c : null, at = null;
    // lo que estabas mirando queda en pausa: al volver sigue desde el mismo segundo (en los 24/7, el mismo capítulo)
    if (prev && s.e?.kind === 'youtube' && s.api?.p) { try { at = Math.max(0, Math.floor(s.api.p.getCurrentTime()) - 2); } catch {} if (prev.t247 && s.e.id) prev = { ...prev, ref:{ ...prev.ref, video:s.e.id } }; }
    if (auto) try { Grafismo.separator('Tanda retro · ya volvemos'); } catch {}
    Player.play({ uid:'tanda', platform:'youtube', ref:{ video:pick[0], more:pick.slice(1) }, name:'📼 Tanda retro', noResume:true, onEnd:() => { if (prev) Player.play(prev, at != null && (prev.t247 || prev.ref?.video) ? { start:at } : {}); } });
  }
  // en los 24/7 (nunca en los vivos): cada ~30 minutos de mirar, una tanda de 2-3 publicidades; lo que mirabas queda en pausa y sigue al volver
  setInterval(() => {
    if (!S.get('tandaAuto', true)) return;
    const c = Player.slots[Player.sel]?.c, playing = c?.t247 && !document.hidden && AudioMgr.sink('slot' + Player.sel)?.paused?.() === false;
    if (!playing) { if (!c?.t247) lastT247 = 0; return; }
    if (!lastT247) lastT247 = Date.now();
    if (Date.now() - lastT247 > 30 * 60e3) { lastT247 = Date.now(); play(2 + Math.floor(Math.random() * 2), true); }
  }, 30e3);
  // la primera vez, el canal 24/7 de tandas aparece solo en Series (si lo borrás, no vuelve)
  function seed() {
    db.series = db.series || {}; if (db.series.tandaSeeded) return;
    db.series.tandaSeeded = true; db.series.chans = db.series.chans || [];
    if (!db.series.chans.some(c => c.ref === PL)) db.series.chans.push({ id:uid(), name:'Tandas retro 2000s', group:(db.series.groups || ['Series'])[0], kind:'playlist', ref:PL });
    save();
  }
  /* 📼 24/7 → Tandas: tus playlists de publicidades (las usan el botón Tanda retro y las tandas automáticas de los 24/7) */
  const plId = t => (String(t).match(/[?&]list=([\w-]+)/) || [])[1] || (/^(PL|UU|OL|FL|RD)[\w-]{10,}$/.test(String(t).trim()) ? String(t).trim() : null);
  async function render() {
    const v = $('v-tandas'); if (!v) return;
    const L = lists();
    v.innerHTML = `<div class="porhero"><div class="porlogo">📼</div><div><h2>Tandas retro</h2><p>Tus playlists de publicidades argentinas. De acá salen el botón 📼 Tanda retro y las tandas que cortan los canales 24/7 cada ~30 minutos.</p>
        <div class="btns"><button class="pri" id="tdPlay">▶ Ver una tanda</button><label style="display:flex;gap:6px;align-items:center;margin:0"><input type="checkbox" id="tdAuto" style="width:auto" ${S.get('tandaAuto', true) ? 'checked' : ''}> Tandas automáticas en los 24/7</label></div></div></div>
      <h2 class="sec">Tus playlists de tandas</h2>
      <div class="tdlist">${L.length ? '' : '<div class="empty">Todavía no cargaste ninguna. Pegá abajo el link de una playlist de YouTube.</div>'}${L.map((t, i) => `<div class="tdrow ${t.on === false ? 'off' : ''}"><label><input type="checkbox" data-on="${i}" ${t.on !== false ? 'checked' : ''} style="width:auto"></label>
        <div><b>${esc(t.name)}</b><small>${cache[t.ref]?.l?.length ? cache[t.ref].l.length + ' publicidades' : 'todavía sin cargar'} · <a href="https://www.youtube.com/playlist?list=${esc(t.ref)}" target="_blank" rel="noopener">ver en YouTube ↗</a></small></div>
        <button data-ch="${i}" title="Sumarla como canal 24/7">📺 Como canal 24/7</button><button data-del="${i}" title="Quitar">✕</button></div>`).join('')}</div>
      <h2 class="sec">➕ Agregar una playlist</h2>
      <div style="display:flex;gap:8px;flex-wrap:wrap"><input id="tdUrl" placeholder="Link de la playlist de YouTube (…list=PL…)" style="flex:2;min-width:240px"><input id="tdName" placeholder="Nombre (ej. Tandas 90s)" style="flex:1;min-width:160px"><button class="pri" id="tdAdd">Agregar</button></div>`;
    $('tdPlay').onclick = () => play();
    $('tdAuto').onchange = e => { S.set('tandaAuto', e.target.checked); if ($('setTanda')) $('setTanda').checked = e.target.checked; };
    v.querySelectorAll('[data-on]').forEach(c => c.onchange = () => { L[+c.dataset.on].on = c.checked; save(); render(); });
    v.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const t = L[+b.dataset.del]; if (!confirm(`¿Quitar "${t.name}"?`)) return; L.splice(+b.dataset.del, 1); save(); render(); });
    v.querySelectorAll('[data-ch]').forEach(b => b.onclick = () => { const t = L[+b.dataset.ch]; db.series = db.series || {}; db.series.chans = db.series.chans || [];
      if (db.series.chans.some(c => c.ref === t.ref)) return toast('Ya está como canal 24/7', { ms:2500 });
      db.series.chans.push({ id:uid(), name:'📼 ' + t.name, group:(db.series.groups || ['Series'])[0], kind:'playlist', ref:t.ref }); save(); toast(`<b>📺 "${esc(t.name)}" ya es un canal 24/7</b><small>Lo encontrás en 24/7 → Series.</small>`, { ms:4000 }); });
    $('tdAdd').onclick = async () => {
      const ref = plId($('tdUrl').value); if (!ref) return toast('<b>No encontré una playlist en ese link</b><small>Tiene que tener "list=" en la dirección.</small>', { cls:'info' });
      if (L.some(t => t.ref === ref)) return toast('Esa playlist ya está', { ms:2500 });
      L.push({ ref, name:$('tdName').value.trim() || 'Tandas ' + (L.length + 1), on:true }); save();
      const n = (await one(ref)).length; render();
      toast(n ? `<b>📼 Lista: ${n} publicidades</b><small>Ya entran en las tandas.</small>` : '<b>La agregué, pero no pude leerla</b><small>Revisá que sea pública o "no listada".</small>', { ms:4000, cls:n ? '' : 'info' });
    };
  }
  function init() {
    seed();
    Inicio.add({ id:'tanda', order:6, html:() => `<div class="inchips"><button data-tanda>📼 Tanda retro</button></div>`, bind(el) { el.querySelector('[data-tanda]').onclick = () => play(); } });
    $('tvCtl')?.insertAdjacentHTML('beforeend', '<button id="tvTanda" title="Tanda retro">📼</button>'); $('tvTanda') && ($('tvTanda').onclick = () => play());
    $('setZfxS')?.closest('label')?.insertAdjacentHTML('afterend', `<label style="display:flex;gap:6px;align-items:center;color:var(--txt)"><input type="checkbox" id="setTanda" style="width:auto" ${S.get('tandaAuto', true) ? 'checked' : ''}> 📼 Tanda retro cada ~30 minutos en los canales 24/7</label>`);
    $('setTanda') && ($('setTanda').onchange = e => S.set('tandaAuto', e.target.checked));
  }
  return { init, play, load, render };
})();
