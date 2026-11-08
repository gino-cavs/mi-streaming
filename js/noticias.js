/* =========================================================
   Noticias: las junta GitHub cada 30 min (Google Noticias) en la rama "datos".
   Acá elegís temas y fuentes.
   ========================================================= */
const Noticias = (() => {
  let data = null, loading = null, filter = 'all', limit = 60, editing = false, srcQ = '';

  async function load(force) {
    if (data && !force && Date.now() - data._at < 10 * 60e3) return data;
    if (!loading) loading = fetch(REPO.data + 'news.json?t=' + Math.floor(Date.now() / 300e3))
      .then(r => { if (!r.ok) throw new Error(r.status); return r.json(); })
      .then(j => { j._at = Date.now(); data = j; return j; })
      .finally(() => { loading = null; });
    return loading;
  }
  const byTopic = id => data && data.items ? data.items.filter(i => i.tp.includes(id)) : [];
  function item(i) {
    return `<a class="nitem" href="${esc(i.l)}" target="_blank" rel="noopener"><b>${esc(i.t)}</b><span>${esc(i.s || '')} · ${ago(i.d)}</span></a>`;
  }
  const list = (items, n) => items.length ? `<div class="news">${items.slice(0, n).map(item).join('')}</div>` : '<div class="empty">No hay noticias para mostrar.</div>';

  function render() {
    const v = $('v-noticias');
    if (!data) {
      v.innerHTML = '<div class="empty">Cargando noticias…</div>';
      load().then(render).catch(() => {
        v.innerHTML = `<div class="empty">Todavía no hay noticias juntadas.<br>GitHub las busca cada 30 minutos: si recién lo activamos, esperá un rato.<br><button id="nRetry" style="margin-top:10px">Reintentar</button></div>`;
        $('nRetry').onclick = () => load(true).then(render).catch(() => {});
      });
      return;
    }
    if (!db.news.setup || editing) return renderSetup(v);
    const topics = data.topics.filter(t => db.news.topics.includes(t.id));
    const srcOk = i => !db.news.sources.length || db.news.sources.includes(i.s);
    let items = data.items.filter(i => srcOk(i) && i.tp.some(t => db.news.topics.includes(t)));
    if (filter !== 'all') items = items.filter(i => i.tp.includes(filter));
    v.innerHTML = `
      <div class="subbar">
        <div class="tabs" id="nTabs">
          <button data-f="all" class="${filter === 'all' ? 'on' : ''}">Todo</button>
          ${topics.map(t => `<button data-f="${t.id}" class="${filter === t.id ? 'on' : ''}">${esc(t.label)}</button>`).join('')}
        </div>
        <button id="nEdit">Temas y fuentes</button>
      </div>
      <p class="mut" style="font-size:12px;margin:-4px 2px 10px">${db.news.sources.length ? db.news.sources.length + ' fuentes elegidas' : 'Todas las fuentes'} · actualizado ${ago(data.updated)}</p>
      ${list(items, limit)}
      ${items.length > limit ? '<div class="btns"><button id="nMore">Ver más</button></div>' : ''}`;
    $('nTabs').onclick = e => { const b = e.target.closest('[data-f]'); if (b) { filter = b.dataset.f; limit = 60; render(); } };
    $('nEdit').onclick = () => { editing = true; render(); };
    if ($('nMore')) $('nMore').onclick = () => { limit += 60; render(); };
  }

  function renderSetup(v) {
    // las fuentes salen de lo que efectivamente publica cada tema, con cuántas noticias tiene cada una
    const count = {};
    data.items.forEach(i => { if (i.s) count[i.s] = (count[i.s] || 0) + 1; });
    const sources = Object.keys(count).sort((a, b) => count[b] - count[a]);
    const chosenT = new Set(db.news.topics.length ? db.news.topics : ['portada', 'deportes']);
    const chosenS = new Set(db.news.sources);
    v.innerHTML = `
      <div class="box">
        <h2 class="sec">1. ¿Qué temas te interesan?</h2>
        <div class="chips" id="nT">${data.topics.filter(t => !t.id.startsWith('prog:') && !t.hidden && !/^(box|motor|piloto)-/.test(t.id)).map(t => `<button data-t="${t.id}" class="${chosenT.has(t.id) ? 'on' : ''}">${esc(t.label)}</button>`).join('')}</div>
        <h2 class="sec" style="margin-top:14px">2. ¿De qué medios? <span class="sp"></span><button class="sm" id="nAll">Todos</button><button class="sm" id="nNone">Ninguno</button></h2>
        <p class="mut" style="font-size:13px;margin-bottom:8px">Si no marcás ninguno, se muestran todos.</p>
        <input id="nSrcQ" placeholder="Buscar medio (Olé, TyC, Clarín…)" style="width:100%;margin-bottom:8px" value="${esc(srcQ)}">
        <div class="srclist" id="nS">${sources.map(s => `<label data-name="${esc(norm(s))}"><input type="checkbox" value="${esc(s)}" ${chosenS.has(s) ? 'checked' : ''}> ${esc(s)} <small>${count[s]}</small></label>`).join('')}</div>
        <div class="btns"><span class="sp"></span>${db.news.setup ? '<button id="nCancel">Cancelar</button>' : ''}<button class="pri" id="nOk">Listo</button></div>
      </div>`;
    const filt = () => { const q = norm($('nSrcQ').value); srcQ = $('nSrcQ').value; $('nS').querySelectorAll('label').forEach(l => l.style.display = !q || l.dataset.name.includes(q) ? '' : 'none'); };
    $('nSrcQ').oninput = filt; filt();
    $('nT').onclick = e => { const b = e.target.closest('[data-t]'); if (b) b.classList.toggle('on'); };
    $('nAll').onclick = () => $('nS').querySelectorAll('label:not([style*="none"]) input').forEach(i => i.checked = true);
    $('nNone').onclick = () => $('nS').querySelectorAll('input').forEach(i => i.checked = false);
    if ($('nCancel')) $('nCancel').onclick = () => { editing = false; render(); };
    $('nOk').onclick = () => {
      const t = [...$('nT').querySelectorAll('.on')].map(b => b.dataset.t);
      if (!t.length) { toast('<b>Elegí al menos un tema</b>', { cls:'info', ms:4000 }); return; }
      db.news = { topics:t, sources:[...$('nS').querySelectorAll('input:checked')].map(i => i.value), setup:true };
      editing = false; filter = 'all'; save(); render();
    };
  }

  // titulares según tus temas y fuentes (para la barra de la Pantalla TV)
  function headlines(n) {
    if (!data) return [];
    const T = db.news.topics.length ? db.news.topics : ['portada'];
    return data.items.filter(i => (!db.news.sources.length || db.news.sources.includes(i.s)) && i.tp.some(t => T.includes(t) || t === 'velez'))
      .slice(0, n).map(i => i.t + (i.s ? ' (' + i.s + ')' : ''));
  }
  function init() { onChange(() => { if (Nav.current === 'noticias') render(); }); }
  return { init, render, load, byTopic, list, headlines, get loaded() { return !!data; } };
})();
