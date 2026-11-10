/* =========================================================
   🎻 Modo porteño: La 2x4 (FM 92.7, tango las 24 h) sonando y, de fondo, Buenos Aires DE NOCHE:
   caminatas nocturnas por Almagro, Boedo, San Telmo, Corrientes y los barrios tangueros, sin sonido.
   ▲▼ cambia de caminata; la radio sigue (y si se corta, se reconecta sola).
   Las búsquedas de YouTube se guardan una semana (cuida la cuota).
   ========================================================= */
const Porteno = (() => {
  const Q = ['Almagro Buenos Aires night walk', 'Boedo Buenos Aires de noche caminata', 'San Telmo night walk 4K', 'Avenida Corrientes de noche walking tour 4K',
    'Buenos Aires night walk tango', 'Buenos Aires by night walking 4K', 'Abasto Buenos Aires noche', 'milonga Buenos Aires de noche'];
  const NOCHE = /(night|noche|nocturn|nightlife|by night|madrugada|after dark|luces)/i, DIA = /(\bday\b|daytime|d[ií]a soleado|\bde d[ií]a\b|morning|ma[ñn]ana|sunny|sunset|atardecer|amanecer)/i;
  const R2X4 = { id:'la2x4', name:'La 2x4 · FM 92.7', url:'https://media.radios.ar:9270/', logo:'', tags:'tango', place:'Buenos Aires' };   // la que anda bien en radio-browser
  let pool = S.get('portPool', null), seen = new Set(S.get('portSeen', [])), on = false;

  async function videos() {
    if (pool && Date.now() - pool.at < 7 * 864e5 && pool.v.length) return pool.v;
    if (!db.key) throw new Error('Para los videos necesito tu clave de YouTube (⚙ Ajustes → YouTube y cuota).');
    const v = [], ids = new Set();
    for (const q of Q) try {
      const r = await Canales.yt('search', { part:'snippet', type:'video', maxResults:25, q, videoDuration:'long', videoEmbeddable:'true' });
      (r.items || []).forEach(x => { const t = x.snippet.title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"');
        if (!x.id?.videoId || ids.has(x.id.videoId) || !NOCHE.test(t) || DIA.test(t)) return;   // solo de noche
        ids.add(x.id.videoId); v.push({ id:x.id.videoId, t, by:x.snippet.channelTitle, img:x.snippet.thumbnails?.medium?.url || '' }); });
    } catch {}
    pool = { at:Date.now(), v }; S.set('portPool', pool);
    return v;
  }
  async function radio() {
    const ok = r => r && /2\s*x\s*4/i.test(r.name) && !/storage\.googleapis|webchat|\.mp3(\?|$)/i.test(r.url);
    let r = db.radios.find(ok);
    if (!r) try { r = (await Radio.find('2x4')).find(ok); } catch {}
    return r || R2X4;
  }
  async function play(vid) {
    let l; try { l = await videos(); } catch (e) { return toast(`<b>${esc(e.message)}</b>`, { cls:'info' }); }
    if (!l.length) return toast('<b>No encontré caminatas de noche ahora</b><small>Probá en un rato.</small>', { cls:'info' });
    let v = vid ? l.find(x => x.id === vid) : null;
    if (!v) { let fresh = l.filter(x => !seen.has(x.id)); if (!fresh.length) { seen.clear(); fresh = l; } v = fresh[Math.floor(Math.random() * fresh.length)]; }
    seen.add(v.id); S.set('portSeen', [...seen].slice(-300));
    on = true;
    Player.play({ uid:'porteno', name:'🎻 ' + v.t, platform:'youtube', ref:{ video:v.id }, cat:'Modo porteño', porteno:true });
    if (!document.body.classList.contains('tvlock')) TV.open();
    const r = await radio();
    if (Radio.current?.url !== r.url) Radio.play(r);
    const hold = () => { if (on) try { AudioMgr.focus('radio'); } catch {} };   // el video mudo; suena el tango
    [1200, 3000, 6000].forEach(t => setTimeout(hold, t));
    Grafismo.notify(`<b>🎻 ${esc(r.name)}</b><span>${esc(v.t)}</span>`, { ms:9000, lbl:'🎻 BUENOS AIRES' });
  }
  // ▲▼ mientras está el modo porteño: otra caminata
  function step() { const s = Player.slots[Player.sel ?? 0] || Player.slots.find(Boolean); if (!s?.c?.porteno) { on = false; return false; } play(); return true; }

  async function render() {
    const v = $('v-porteno'); if (!v) return;
    v.innerHTML = `<div class="porhero"><div class="porlogo">2<span>x</span>4</div><div><h2>Modo porteño</h2><p>La 2x4 · FM 92.7 sonando y Buenos Aires de noche en la pantalla: Almagro, Boedo, San Telmo, Corrientes.</p>
        <div class="btns"><button class="pri" id="porGo">▶ Empezar</button><button id="porRadio">📻 Solo La 2x4</button></div></div></div>
      <h2 class="sec">🌃 Caminatas de noche <small class="mut" style="font-weight:400">· tocá una para arrancar con esa</small></h2><div class="porgrid" id="porGrid"><div class="empty">Buscando…</div></div>`;
    $('porGo').onclick = () => play();
    $('porRadio').onclick = async () => Radio.play(await radio());
    try { const l = await videos();
      $('porGrid').innerHTML = l.map(x => `<button class="porv" data-v="${x.id}"><img src="${esc(x.img)}" alt="" loading="lazy"><b>${esc(x.t)}</b><small>${esc(x.by)}</small></button>`).join('') || '<div class="empty">No encontré caminatas de noche.</div>';
      $('porGrid').querySelectorAll('[data-v]').forEach(b => b.onclick = () => play(b.dataset.v));
    } catch (e) { $('porGrid').innerHTML = `<div class="empty">${esc(e.message)}</div>`; }
  }
  return { play, step, render };
})();
