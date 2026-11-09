/* =========================================================
   Mundo Vélez: partidos, streams, noticias, goles y ex-Vélez
   ========================================================= */
const Velez = (() => {
  let sched = S.get('velezSched', null), vids = S.get('velezVids', null), loadingS = false, loadingV = false;

  // Fixture y últimos resultados (ESPN). Se guarda una hora.
  async function loadSchedule() {
    if (loadingS || (sched && Date.now() - sched.at < 3600e3)) return;
    loadingS = true;
    try {
      const t = await (await fetch('https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/teams')).json();
      const team = (t.sports?.[0]?.leagues?.[0]?.teams || []).map(x => x.team).find(x => norm(x.displayName).includes('velez'));
      if (!team) throw 0;
      const [past, next] = await Promise.all([
        fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/teams/${team.id}/schedule`).then(r => r.json()).catch(() => ({})),
        fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/teams/${team.id}/schedule?fixture=true`).then(r => r.json()).catch(() => ({}))
      ]);
      const ev = j => Fulbito.evs(j);
      const all = [...new Map([...ev(past), ...ev(next)].map(m => [m.id, m])).values()];
      const done = all.filter(m => m.state === 'post').sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 4);
      const up = all.filter(m => m.state === 'pre' && Date.parse(m.date) > Date.now() - 3 * 3600e3).sort((a, b) => Date.parse(a.date) - Date.parse(b.date)).slice(0, 3);
      sched = { at:Date.now(), done, up, logo:team.logos?.[0]?.href };
      S.set('velezSched', sched);
    } catch { sched = { at:Date.now(), done:[], up:[], failed:true }; }
    loadingS = false;
    if (Nav.current === 'velez') render();
  }
  // Videos de goles y resúmenes (YouTube). Se buscan cada 12 horas para cuidar la cuota.
  async function loadVideos() {
    if (loadingV || !db.key || (vids && Date.now() - vids.at < 12 * 3600e3)) return;
    loadingV = true;
    try {
      const after = new Date(Date.now() - 21 * 864e5).toISOString();
      const j = await Canales.yt('search', { part:'snippet', q:'Vélez Sarsfield goles|resumen|highlights', type:'video', order:'date',
        maxResults:25, publishedAfter:after, regionCode:'AR', relevanceLanguage:'es' });
      const items = j.items.filter(i => norm(i.snippet.title).includes('velez')).slice(0, 12)
        .map(i => ({ vid:i.id.videoId, title:i.snippet.title.replace(/&quot;/g, '"').replace(/&#39;/g, "'").replace(/&amp;/g, '&'),
                     ch:i.snippet.channelTitle, d:i.snippet.publishedAt, thumb:i.snippet.thumbnails.medium?.url }));
      vids = { at:Date.now(), items }; S.set('velezVids', vids);
    } catch (e) { vids = { at:Date.now(), items:[], err:e.message }; }
    loadingV = false;
    if (Nav.current === 'velez') render();
  }
  const playVideo = (vid, title) => Player.play({ uid:'v_' + vid, platform:'youtube', ref:{ video:vid }, name:title });
  function vcard(v) {
    return `<div class="card" tabindex="0" data-vid="${esc(v.vid)}" data-title="${esc(v.title)}">
      <div class="thumb" style="background-image:url('${esc(v.thumb || '')}')"></div>
      <div class="info"><div class="n" style="font-size:13px">${esc(v.title)}</div><div class="t" style="min-height:0">${esc(v.ch || '')}${v.ch ? ' · ' : ''}${ago(v.d || v.end)}</div></div></div>`;
  }
  function matchesBlock() {
    const today = Fulbito.todayFor('velez');
    const s = sched || {};
    const row = (m, withDate) => (withDate ? `<div class="mut" style="font-size:12px;padding:8px 12px 0">${new Date(m.date).toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'numeric' })}</div>` : '') + Fulbito.matchRow(m);
    let h = '';
    if (today.length) h += `<div class="league"><h3>Hoy</h3>${today.map(m => row(m)).join('')}</div>`;
    if (s.up?.length) h += `<div class="league"><h3>Próximos partidos</h3>${s.up.filter(m => !today.some(t => t.id === m.id)).map(m => row(m, true)).join('')}</div>`;
    if (s.done?.length) h += `<div class="league"><h3>Últimos resultados</h3>${s.done.map(m => row(m, true)).join('')}</div>`;
    return h || `<div class="empty" style="padding:12px">${s.failed ? 'No pude traer el fixture ahora.' : 'Cargando partidos…'}</div>`;
  }

  function render() {
    const v = $('v-velez');
    loadSchedule(); loadVideos();
    const cat = db.velez.streamCat || db.cats.find(k => norm(k).includes('velez')) || '';
    const chans = Canales.sortChans(db.chans.filter(c => c.cat === cat));
    const past = chans.flatMap(c => (Canales.status[c.uid]?.past || []).map(p => ({ ...p, ch:c.name }))).sort((a, b) => Date.parse(b.end) - Date.parse(a.end)).slice(0, 6);
    const news = Noticias.byTopic('velez'), ex = Noticias.byTopic('exvelez');
    if (!Noticias.byTopic('velez').length) Noticias.load().then(() => { if (Nav.current === 'velez' && Noticias.byTopic('velez').length) render(); }).catch(() => {});

    v.innerHTML = `
      <div class="vhero"><div class="v">V</div><div><h2>Mundo Vélez</h2><p>Partidos, streams, noticias, goles y cómo les va a los ex-Vélez.</p></div></div>
      ${Resumenes.block(it => Resumenes.isTeam(it, 'velez'), '🎬 Resumen del último partido')}
      <div class="vcols">
        <div>
          <div class="vblock"><h2 class="sec">⚽ Partidos</h2>${matchesBlock()}</div>
          <div class="vblock">
            <h2 class="sec">📺 Streams de Vélez <span class="sp"></span>
              <select id="vCat" class="sm" style="font-size:13px;padding:4px 8px">
                <option value="">Elegir categoría…</option>${db.cats.map(k => `<option ${k === cat ? 'selected' : ''}>${esc(k)}</option>`).join('')}
              </select></h2>
            ${cat ? (chans.length ? `<div class="grid" id="vGrid">${chans.map(Canales.card).join('')}</div>` : '<div class="empty" style="padding:12px">No hay canales en esa categoría.</div>')
                  : '<div class="empty" style="padding:12px">Elegí la categoría donde tenés los canales de Vélez (ej: Vélez a Fondo).</div>'}
            ${past.length ? `<h2 class="sec">Últimos directos</h2><div class="vids" id="vPast">${past.map(vcard).join('')}</div>` : ''}
            <p class="mut" style="font-size:12px;margin-top:8px">🔜 Resumen de lo que se habló en cada directo: lo armamos en la próxima etapa.</p>
          </div>
          <div class="vblock"><h2 class="sec">🎥 Goles y resúmenes</h2>
            ${!db.key ? '<div class="empty" style="padding:12px">Necesita la clave de YouTube (⚙).</div>'
              : !vids ? '<div class="empty" style="padding:12px">Buscando videos…</div>'
              : vids.items.length ? `<div class="vids" id="vVids">${vids.items.map(vcard).join('')}</div>`
              : `<div class="empty" style="padding:12px">${vids.err ? esc(vids.err) : 'No encontré videos recientes.'}</div>`}
          </div>
        </div>
        <div>
          <div class="vblock"><h2 class="sec">📰 Últimas noticias</h2>${Noticias.list(news, 15)}</div>
          <div class="vblock"><h2 class="sec">🔁 Ex-Vélez</h2>${Noticias.list(ex, 12)}</div>
        </div>
      </div>`;
    $('vCat').onchange = e => { db.velez.streamCat = e.target.value; save(); render(); };
    if ($('vGrid')) Canales.bindGrid($('vGrid'));
    v.querySelectorAll('[data-vid]').forEach(el => el.onclick = () => playVideo(el.dataset.vid, el.dataset.title));
  }
  function init() { onChange(() => { if (Nav.current === 'velez') render(); }); }
  return { init, render };
})();
