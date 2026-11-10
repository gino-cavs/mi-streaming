/* 📺 24/7 → Novelas: catálogo de novelas argentinas (Pol-ka/eltrece, Telefe y otras).
   Solo playlists de los canales oficiales (las arma el robot de GitHub una vez por mes, sin gastar tu cuota).
   Elegís cuáles querés y cada una queda como canal 24/7 en Series → apartado "Novelas". */
const Novelas = (() => {
  let data = null, loading = false;
  const GRP = 'Novelas';
  const chans = () => (db.series?.chans || []);
  const loaded = t => chans().find(c => c.novela === t);
  async function load() {
    if (data || loading) return; loading = true;
    try { data = await (await fetch(REPO.data + 'novelas.json?t=' + Math.floor(Date.now() / 3600e3))).json(); } catch { data = { novelas:[] }; }
    loading = false; if (Nav.current === 'novelas') render();
  }
  function add(nv, ids) {
    db.series = db.series || {}; const s = db.series; s.groups = s.groups || ['Series']; s.chans = s.chans || [];
    if (!s.groups.includes(GRP)) s.groups.push(GRP);
    const ch = { id:uid(), name:`📺 ${nv.t}`, group:GRP, novela:nv.t, ...(ids.length === 1 ? { kind:'playlist', ref:ids[0] } : { kind:'multi', refs:ids }) };
    s.chans.push(ch); return ch;
  }
  const BLOQ = [['Pol-ka y eltrece', n => n.canal === 'eltrece'], ['Telefe', n => n.canal === 'Telefe'], ['Otras (América y más)', n => n.canal !== 'eltrece' && n.canal !== 'Telefe']];
  function render() {
    const v = $('v-novelas'); if (!v) return;
    if (!data) { v.innerHTML = '<div class="empty">Cargando el catálogo de novelas…</div>'; load(); return; }
    const L = data.novelas || [];
    const card = (n, i) => {
      const ya = loaded(n.t);
      if (!n.ops?.length) return `<div class="nvcard off"><div class="nvimg">📺</div><div><b>${esc(n.t)}</b><small>${n.y} · ${esc(n.canal)} · ${esc(n.prod)}</small><small class="nvno">No está subida por un canal oficial</small></div></div>`;
      return `<div class="nvcard ${ya ? 'ya' : ''}"><div class="nvimg" style="background-image:url('${esc(n.ops[0].img)}')"></div><div><b>${esc(n.t)}</b><small>${n.y} · ${esc(n.canal)} · ${esc(n.prod)}</small>
        ${ya ? `<small class="nvok">✓ Ya está en 24/7 → Series</small><div class="btns"><button data-ver="${esc(ya.id)}">▶ Ver</button></div>`
        : n.ops.map((o, j) => `<label class="nvop"><input type="checkbox" data-nv="${i}" data-op="${esc(o.id)}" style="width:auto"><span>${esc(o.t)}</span><a href="https://www.youtube.com/playlist?list=${esc(o.id)}" target="_blank" rel="noopener">↗</a><small>${o.n} videos · ${esc(o.ch)}</small></label>`).join('')}</div></div>`;
    };
    v.innerHTML = `<div class="porhero"><div class="porlogo">📺</div><div><h2>Novelas argentinas</h2><p>Tildá las que quieras (si una tiene varias playlists, por ejemplo por temporada, podés tildar más de una y se mezclan). Cada novela queda como canal 24/7 en Series → "${GRP}". Solo uso lo que subieron los canales oficiales.</p>
        <div class="btns"><button class="pri" id="nvAdd">＋ Cargar las elegidas</button><span id="nvCount" style="color:var(--mut)"></span></div></div></div>
      ${L.length ? BLOQ.map(([h, f]) => { const xs = L.map((n, i) => [n, i]).filter(([n]) => f(n)); return xs.length ? `<h2 class="sec">${h}</h2><div class="nvgrid">${xs.sort(([a], [b]) => (b.ops?.length ? 1 : 0) - (a.ops?.length ? 1 : 0) || a.y - b.y).map(([n, i]) => card(n, i)).join('')}</div>` : ''; }).join('')
        : '<div class="empty">El catálogo todavía se está armando (lo hace el robot de GitHub). Volvé en un rato.</div>'}
      ${data.updated ? `<p style="color:var(--mut);font-size:12px">Catálogo actualizado el ${new Date(data.updated).toLocaleDateString('es-AR')}. ¿Falta alguna? Pedímela y la sumo.</p>` : ''}`;
    const count = () => { const n = new Set([...v.querySelectorAll('[data-nv]:checked')].map(c => c.dataset.nv)).size; $('nvCount').textContent = n ? `${n} elegida${n > 1 ? 's' : ''}` : ''; };
    v.querySelectorAll('[data-nv]').forEach(c => c.onchange = count);
    v.querySelectorAll('[data-ver]').forEach(b => b.onclick = () => Series.play(b.dataset.ver));
    $('nvAdd').onclick = () => {
      const pick = {}; v.querySelectorAll('[data-nv]:checked').forEach(c => (pick[c.dataset.nv] = pick[c.dataset.nv] || []).push(c.dataset.op));
      const ks = Object.keys(pick); if (!ks.length) return toast('<b>Tildá al menos una novela</b>', { cls:'info' });
      ks.forEach(i => add(L[i], pick[i])); save();
      toast(`<b>📺 ${ks.length} novela${ks.length > 1 ? 's' : ''} sumada${ks.length > 1 ? 's' : ''}</b><small>Están en 24/7 → Series → ${GRP}. Tocá para ir.</small>`, { ms:5000, onclick:() => Nav.go('series') });
      render(); try { Zap.render(); } catch {}
    };
  }
  return { render };
})();
