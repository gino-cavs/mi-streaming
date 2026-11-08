/* =========================================================
   🎬 Resúmenes automáticos (los busca GitHub cuando termina cada evento): se muestran
   arriba en Mundo Vélez, Fulbito, Fórmula 1 y Boxeo, y se abren en el reproductor.
   ========================================================= */
const Resumenes = (() => {
  let data = S.get('resData', null), at = 0;
  async function load() {
    if (Date.now() - at < 10 * 60e3) return; at = Date.now();
    try { const j = await (await fetch(REPO.data + 'resumenes.json?t=' + Math.floor(Date.now() / 600e3))).json(); if (j && j.items) { const nuevo = JSON.stringify(j.items) !== JSON.stringify(data?.items); data = j; S.set('resData', j); if (nuevo) fireChange(); } } catch {}
  }
  const recent = it => it.video && Date.now() - Date.parse(it.date) < 7 * 864e5;
  // bloque listo para poner arriba de una sección; vacío si no hay nada
  function block(filter, title = '🎬 Resúmenes') {
    load();
    const list = (data?.items || []).filter(it => recent(it) && filter(it)).slice(0, 4);
    if (!list.length) return '';
    return `<div class="resb"><h2 class="sec">${title}</h2><div class="resl">${list.map(it => `
      <button class="resc" data-resv="${esc(it.video.id)}" data-resn="${esc(it.video.ch)}">
        <span class="rimg" style="background-image:url('https://i.ytimg.com/vi/${esc(it.video.id)}/mqdefault.jpg')"><i>▶</i></span>
        <span class="rtx"><b>${esc(it.title)}</b>${it.sub ? `<small>${esc(it.sub)}</small>` : ''}<small class="mut">${esc(it.video.ch)} · ${ago(it.video.at || it.date)}</small></span></button>`).join('')}</div></div>`;
  }
  function init() {
    document.addEventListener('click', e => { const b = e.target.closest('[data-resv]'); if (!b) return; Player.play({ uid:'res_' + b.dataset.resv, platform:'youtube', ref:{ video:b.dataset.resv }, name:b.dataset.resn }); });
    load(); setInterval(load, 15 * 60e3);
  }
  const isTeam = (it, t) => it.tipo === 'futbol' && norm(it.team || '').includes(norm(t));
  return { init, block, load, isTeam };
})();
