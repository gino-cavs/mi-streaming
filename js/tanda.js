/* =========================================================
   📼 Tanda retro: las publicidades argentinas de 2000-2011 (playlist de YouTube).
   - Botón "Tanda retro": 3-4 publicidades al azar y después vuelve a lo que estabas mirando.
   - En los canales 24/7, cada ~30 minutos entra una tanda corta, como en la tele de antes (se apaga en Ajustes).
   - Además es un canal 24/7 más ("Tandas retro 2000s") para dejarlo de fondo.
   ========================================================= */
const Tanda = (() => {
  const PL = 'PLW2SmGPb8T2UONtqBR19yof_tTpa3HGjT';
  let ids = S.get('tandaIds', null), busy = false, lastT247 = 0;
  async function load() {
    if (ids && Date.now() - ids.at < 7 * 864e5 && ids.l.length) return ids.l;
    if (!db.key || busy) return ids?.l || [];
    busy = true; const l = []; let page = '';
    try { do { const j = await Canales.yt('playlistItems', { part:'contentDetails,status', playlistId:PL, maxResults:50, ...(page ? { pageToken:page } : {}) });
      (j.items || []).forEach(x => x.status?.privacyStatus !== 'private' && x.contentDetails?.videoId && l.push(x.contentDetails.videoId)); page = j.nextPageToken || ''; } while (page && l.length < 400); } catch {}
    busy = false; if (l.length) { ids = { at:Date.now(), l }; S.set('tandaIds', ids); }
    return ids?.l || [];
  }
  const shuffle = a => a.map(v => [Math.random(), v]).sort((x, y) => x[0] - y[0]).map(x => x[1]);
  /** Tanda corta y vuelta a lo que había */
  async function play(n = 3 + Math.floor(Math.random() * 2), auto = false) {
    const l = await load(); if (!l.length) return toast('<b>Para la tanda retro necesito tu clave de YouTube</b><small>Cargala en ⚙ Ajustes.</small>', { cls:'info' });
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
  function init() {
    seed();
    Inicio.add({ id:'tanda', order:6, html:() => `<div class="inchips"><button data-tanda>📼 Tanda retro</button></div>`, bind(el) { el.querySelector('[data-tanda]').onclick = () => play(); } });
    $('tvCtl')?.insertAdjacentHTML('beforeend', '<button id="tvTanda" title="Tanda retro">📼</button>'); $('tvTanda') && ($('tvTanda').onclick = () => play());
    $('setLite')?.closest('label')?.insertAdjacentHTML('afterend', `<label style="display:flex;gap:6px;align-items:center;color:var(--txt)"><input type="checkbox" id="setTanda" style="width:auto" ${S.get('tandaAuto', true) ? 'checked' : ''}> 📼 Tanda retro cada ~30 minutos en los canales 24/7</label>`);
    $('setTanda') && ($('setTanda').onchange = e => S.set('tandaAuto', e.target.checked));
  }
  return { init, play, load };
})();
