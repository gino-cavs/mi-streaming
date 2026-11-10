/* =========================================================
   🎭 ¿Cómo estás? Perfiles de humor en Ahora: tocás cómo te sentís y FUNVS pone algo para ese momento.
   😂 Reírme (stand-up y "try not to laugh"; tus comediantes, de arranque Matt Rife) · 😴 Cansado (chill largo)
   💻 Para laburar (lo-fi en vivo) · 📰 Ponerme al día (un canal de noticias en vivo de los tuyos)
   🌙 Dormir (lluvia con pantalla negra: Pantalla TV sin carteles, todo a oscuras).
   ▲▼ / ⏭ pasan a otro video del mismo humor. Lo que se busca en YouTube se guarda (48 h lo de reírse, 7 días el resto) para cuidar la cuota.
   ========================================================= */
const Humor = (() => {
  const MOODS = {
    reir:   { ic:'😂', n:'Quiero reírme', q:[['stand up comedy completo', 'long'], ['try not to laugh challenge', 'medium'], ['stand up comedy en español', 'long']], handles:true },
    cansado:{ ic:'😴', n:'Estoy cansado', q:[['chill ambient music mix', 'long'], ['lofi rain sleep music', 'long']] },
    laburar:{ ic:'💻', n:'Fondo para laburar', q:[['lofi hip hop radio', 'live'], ['jazz cafe music live', 'live'], ['deep focus music', 'long']] },
    info:   { ic:'📰', n:'Ponerme al día', news:true },
    dormir: { ic:'🌙', n:'Dormir', q:[['sonido de lluvia pantalla negra', 'long'], ['rain sounds black screen 10 hours', 'long'], ['lluvia para dormir pantalla negra', 'long']], dark:true },
  };
  const comedians = () => (db.humor ||= { comedians:['MattRife'] }).comedians;
  const pools = S.get('humorPool', {}), seen = new Set(S.get('humorSeen', []));
  const isoMin = d => { const m = String(d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? (+m[1] || 0) * 60 + (+m[2] || 0) + (+m[3] || 0) / 60 : 0; };
  let cur = null;   // humor que está sonando

  async function pool(id) {
    const ttl = id === 'reir' ? 48 * 3600e3 : 7 * 864e5;   // lo de reírse cambia más; lluvia, chill y lo-fi duran una semana
    const p = pools[id]; if (p && Date.now() - p.at < ttl && p.v.length) return p.v;
    const M = MOODS[id], vids = [];
    if (!db.key) throw new Error('Para esto necesito tu clave de YouTube (⚙ Ajustes).');
    if (M.handles) for (const h of comedians()) try {
      const ch = await Canales.yt('channels', { part:'contentDetails,snippet', forHandle:h.replace(/^@/, '') });
      const up = ch.items?.[0]?.contentDetails.relatedPlaylists.uploads; if (!up) continue;
      const pl = await Canales.yt('playlistItems', { part:'contentDetails', playlistId:up, maxResults:50 });
      const ids = (pl.items || []).map(i => i.contentDetails.videoId);
      const vv = ids.length ? await Canales.yt('videos', { part:'snippet,contentDetails', id:ids.join(',') }) : { items:[] };
      (vv.items || []).filter(v => isoMin(v.contentDetails.duration) >= 4).forEach(v => vids.push({ id:v.id, t:v.snippet.title, by:v.snippet.channelTitle }));
    } catch {}
    for (const [q, dur] of M.q || []) try {
      const r = await Canales.yt('search', { part:'snippet', type:'video', maxResults:25, q, ...(dur === 'live' ? { eventType:'live' } : { videoDuration:dur }), safeSearch:'none', relevanceLanguage:/español/.test(q) ? 'es' : 'en' });
      (r.items || []).forEach(x => x.id?.videoId && vids.push({ id:x.id.videoId, t:x.snippet.title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'), by:x.snippet.channelTitle, live:dur === 'live' }));
    } catch {}
    pools[id] = { at:Date.now(), v:vids }; S.set('humorPool', pools);
    return vids;
  }
  async function play(id, d = 1) {
    const M = MOODS[id];
    if (M.news) {   // de tus canales: uno de noticias que esté en vivo
      const l = db.chans.filter(c => /noticia/i.test(c.cat || '') || /c5n|a24|tn|ln\+|cr[oó]nica|canal 26/i.test(c.name)).filter(c => Canales.isLive(c));
      if (!l.length) return toast('<b>No hay canales de noticias en vivo ahora</b>', { cls:'info' });
      cur = null; document.body.classList.remove('oscuro'); return Player.play(l[Math.floor(Math.random() * l.length)]);
    }
    toast(`${M.ic} <b>Buscando algo para "${esc(M.n)}"…</b>`, { cls:'info zapt', ms:2500 });
    let l; try { l = await pool(id); } catch (e) { return toast(`<b>${esc(e.message)}</b>`, { cls:'info' }); }
    if (!l.length) return toast('<b>No encontré nada ahora</b><small>Probá en un rato.</small>', { cls:'info' });
    let fresh = l.filter(v => !seen.has(v.id)); if (!fresh.length) { l.forEach(v => seen.delete(v.id)); fresh = l; }
    const v = fresh[Math.floor(Math.random() * fresh.length)];
    seen.add(v.id); S.set('humorSeen', [...seen].slice(-400));
    cur = id;
    Player.play({ uid:'humor-' + id, name:`${M.ic} ${v.t}`, platform:'youtube', ref:{ video:v.id }, cat:M.n, humor:id });
    if (M.dark) { if (!document.body.classList.contains('tvlock')) TV.open(); document.body.classList.add('oscuro'); return; }   // 🌙 sin carteles ni brillo
    document.body.classList.remove('oscuro');
    toast(`<b>${M.ic} ${esc(v.t)}</b><small>${esc(v.by)} · ▲▼ para otro</small>`, { cls:'info zapt', ms:4000 });
  }
  // ▲▼ mientras suena un humor: otro video del mismo
  function step(d) { const s = Player.slots[Player.sel ?? 0] || Player.slots.find(Boolean); if (!s?.c?.humor) return false; play(s.c.humor, d); return true; }

  Inicio.add({ id:'humor', order:5, html() {
    return `<h2 class="sec">🎭 ¿Cómo estás?</h2><div class="hmrow">${Object.entries(MOODS).map(([k, m]) => `<button class="hmb ${Franja.sug() === k ? 'sug' : ''}" data-hm="${k}"><span>${m.ic}</span>${esc(m.n)}</button>`).join('')}
      <button class="hmb hmcfg" data-hmcfg title="Tus comediantes">🎤 <small>${esc(comedians().map(h => '@' + h).join(', '))}</small> ✎</button></div>`; },
    bind(el) {
      el.querySelectorAll('[data-hm]').forEach(b => b.onclick = () => play(b.dataset.hm));
      el.querySelector('[data-hmcfg]').onclick = () => {
        const v = prompt('Tus comediantes de YouTube (los @ separados por coma). Ej: MattRife, ...', comedians().join(', ')); if (v == null) return;
        db.humor.comedians = v.split(/[,\s]+/).map(x => x.replace(/^@/, '').trim()).filter(Boolean); save(); delete pools.reir; S.set('humorPool', pools); Inicio.render();
      };
    } });
  return { play, step, MOODS };
})();
