/* =========================================================
   🔥 Actualidad (pestaña de Noticias): los temas que cubren todos los medios.
   Ahora · Lo que marcó la semana · El mes. Avisa cuando aparece un tema grande.
   ========================================================= */
const Actualidad = (() => {
  let data = null, at = 0;
  async function load() {
    if (data && Date.now() - at < 10 * 60e3) return data;
    try { const j = await (await fetch(REPO.data + 'actualidad.json?t=' + Math.floor(Date.now() / 600e3))).json(); if (j && j.topics) { j.topics = j.topics.filter(t => !muted(t.t)); j.ahora = (j.ahora || []).filter(id => j.topics.some(t => t.id === id)); data = j; at = Date.now(); data.by = Object.fromEntries(j.topics.map(t => [t.id, t])); } } catch {}
    return data;
  }
  const desde = t => { const h = (Date.now() - Date.parse(t.first)) / 3600e3; return h < 1 ? 'hace menos de 1 hora' : h < 24 ? `hace ${Math.round(h)} h` : `hace ${Math.round(h / 24)} día${Math.round(h / 24) === 1 ? '' : 's'}`; };
  const fecha = t => new Date(t.first).toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short' });
  const card = (t, big) => `<a class="acard ${big ? 'big' : ''} ${t.big ? 'hot' : ''}" href="${esc(t.l)}" target="_blank" rel="noopener">
      <span class="aic">${t.ic}</span><span class="atx"><b>${esc(t.t)}</b>
      <small>${t.n ? `📣 lo ${t.n === 1 ? 'cubre 1 medio' : 'cubren ' + t.n + ' medios'} · ` : ''}${big ? 'empezó ' + desde(t) : fecha(t)}${t.horas >= 2 ? ` · ${Math.round(t.horas)} h en tapa` : ''}</small>
      ${big && t.medios?.length ? `<span class="amed">${t.medios.slice(0, 8).map(m => `<i>${esc(m)}</i>`).join('')}</span>` : ''}</span></a>`;
  async function render(el) {
    if (!data) { el.innerHTML = '<div class="empty">Cargando lo que está pasando…</div>'; await load(); if (!data) { el.innerHTML = '<div class="empty">Todavía no está: GitHub lo arma en la próxima actualización (hasta 30 min).</div>'; return; } }
    const now = (data.ahora || []).map(id => data.by[id]).filter(Boolean);
    const sem = data.topics.filter(t => t.big && Date.now() - Date.parse(t.first) < 7 * 864e5 && !data.ahora.includes(t.id)).sort((a, b) => b.score - a.score).slice(0, 12);
    const mes = data.topics.filter(t => t.big && Date.now() - Date.parse(t.first) >= 7 * 864e5).sort((a, b) => b.score - a.score).slice(0, 15);
    el.innerHTML = `
      <div class="ahero"><div>🔥</div><div><h2>Actualidad</h2><p>Lo que están cubriendo todos los medios. Actualizado ${ago(data.updated)}.</p></div></div>
      <h2 class="sec">🔴 Ahora</h2>
      ${now.length ? `<div class="alist">${now.slice(0, 3).map(t => card(t, true)).join('')}</div><div class="alist small">${now.slice(3).map(t => card(t, false)).join('')}</div>` : '<div class="empty">Sin temas por ahora.</div>'}
      ${sem.length ? `<h2 class="sec" style="margin-top:14px">📌 Lo que marcó la semana</h2><div class="alist small">${sem.map(t => card(t)).join('')}</div>` : ''}
      ${mes.length ? `<h2 class="sec" style="margin-top:14px">🗓️ Lo que marcó el mes</h2><div class="alist small">${mes.map(t => card(t)).join('')}</div>` : ''}
      <p class="mut" style="font-size:12px;margin-top:12px">Sale de la portada de Google Noticias (Argentina y mundo) y de cuántos medios distintos publican sobre cada tema. “Marcó” = muchos medios o muchas horas en tapa.</p>`;
  }
  // aviso de temas grandes dentro de FUNVS
  async function check() {
    await load(); if (!data || DND.active()) return;
    const done = new Set(S.get('actAvisos', [])), first = !done.size;
    for (const id of data.ahora || []) {
      const t = data.by[id]; if (!t?.big || done.has(id)) continue;
      done.add(id);
      if (!first && Date.now() - Date.parse(t.first) < 12 * 3600e3) toast(`<span class="g">${t.ic} Tema del momento</span>${esc(t.t)}<small>Lo cubren ${t.n} medios</small>`, { cls:'info', ms:20000, onclick:() => { S.set('newsFilter', 'actualidad'); Nav.go('noticias'); } });
    }
    S.set('actAvisos', [...done].slice(-200));
  }
  function init() { setTimeout(check, 20e3); setInterval(check, 15 * 60e3); }
  return { init, render, load };
})();
