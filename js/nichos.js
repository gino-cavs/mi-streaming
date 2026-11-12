/* =========================================================
   🧭 Nichos: para cuando estás aburrido y no sabés qué ver o escuchar.
   - Elegís cuánto tiempo tenés y qué tan raro lo querés, y te abre algo al azar
     de tu propia base de links (videos perdidos, discos raros, artículos viejos, curiosidades).
   - La base la vas llenando vos (pegás un link y listo); se sincroniza entre aparatos (db.nichos).
   - Prefiere lo que nunca abriste o hace mucho que no abrís.
   ========================================================= */
const Nichos = (() => {
  const KIND = { video:['🎬', 'Video'], disco:['💿', 'Disco'], articulo:['📜', 'Artículo'], curio:['🦉', 'Curiosidad'] };
  const TIME = [['5', '⚡ 5 min', 7], ['15', '☕ 15 min', 20], ['30', '🍿 Media hora', 40], ['60', '🛋️ Una hora o más', 1e9]];
  const RARE = [['1', '🟢 Conocido'], ['2', '🟡 Raro'], ['3', '🔴 Rarísimo'], ['', '🎲 Me da igual']];
  const WHAT = [['', 'Todo'], ['ver', '👀 Ver'], ['escuchar', '🎧 Escuchar'], ['leer', '📖 Leer']];
  const WHATK = { ver:['video', 'curio'], escuchar:['disco'], leer:['articulo', 'curio'] };
  const tv = () => Device.mode === 'tv';
  let pick = null, edit = null, q = '', got = {};
  const L = () => { if (!Array.isArray(db.nichos)) db.nichos = []; return db.nichos; };
  const f = () => ({ t:'15', r:'', w:'', ...S.get('nichosF', {}) });
  const ytId = u => (String(u).match(/(?:youtu\.be\/|v=|\/shorts\/|\/live\/|\/embed\/)([\w-]{11})/) || [])[1] || '';
  const guessKind = u => /youtu|vimeo|twitch|kick\.com/.test(u) ? 'video' : /spotify\.com\/album|bandcamp|music\.apple|deezer|soundcloud|discogs|rateyourmusic/.test(u) ? 'disco' : 'articulo';
  const isoMin = d => { const m = String(d || '').match(/PT(?:(\d+)H)?(?:(\d+)M)?(?:(\d+)S)?/); return m ? Math.max(1, Math.round((+m[1] || 0) * 60 + (+m[2] || 0) + (+m[3] || 0) / 60)) : 0; };
  const dur = m => !m ? '' : m < 60 ? m + ' min' : Math.floor(m / 60) + ' h' + (m % 60 ? ' ' + (m % 60) + ' min' : '');

  // lo que entra con los filtros; el que hace más que no abrís pesa más
  function matches(F = f()) {
    const tmax = TIME.find(x => x[0] === F.t)?.[2] ?? 1e9, ks = WHATK[F.w];
    return L().filter(x => (!F.r || String(x.r || 2) === F.r) && (!ks || ks.includes(x.k)) && (!x.min || x.min <= tmax || F.t === '60'));
  }
  function roll(not) {
    const M = matches().filter(x => x.id !== not); if (!M.length) return null;
    const w = M.map(x => !x.seen ? 6 : Math.min(5, 1 + (Date.now() - (x.last || 0)) / 6048e5)), tot = w.reduce((a, b) => a + b, 0);
    let r = Math.random() * tot; for (let i = 0; i < M.length; i++) { r -= w[i]; if (r <= 0) return M[i]; } return M[M.length - 1];
  }
  function open(x) {
    x.seen = (x.seen || 0) + 1; x.last = Date.now(); save();
    const v = ytId(x.url);
    if (v) return Player.play({ uid:'sv_' + v, platform:'youtube', ref:{ video:v }, name:x.t || 'Nicho' });
    if (tv()) return toast(`<b>Este link se abre en el celu o la compu</b><small>${esc(x.url)}</small>`, { cls:'info', ms:8000 });
    window.open(x.url, '_blank', 'noopener');
  }

  async function lookup(u) {   // título y duración solos (YouTube con tu clave; si no, noembed)
    const v = ytId(u), o = {};
    if (v && db.key) try { const j = await Canales.yt('videos', { part:'snippet,contentDetails', id:v }); const it = j.items?.[0]; if (it) { o.t = it.snippet.title; o.min = isoMin(it.contentDetails.duration); o.by = it.snippet.channelTitle; } } catch {}
    if (!o.t) try { const j = await (await fetch('https://noembed.com/embed?url=' + encodeURIComponent(u))).json(); if (j.title) { o.t = j.title; o.by = j.author_name || ''; } } catch {}
    return o;
  }

  function card(x, big) {
    const [ic, kn] = KIND[x.k] || KIND.articulo, r = +x.r || 2;
    return `<div class="nchit ${big ? 'big' : ''}"><div class="nchic">${ic}</div><div class="nchtx"><b>${esc(x.t || x.url)}</b>
      <small>${kn}${x.min ? ' · ⏱ ' + dur(x.min) : ''} · ${['', '🟢 conocido', '🟡 raro', '🔴 rarísimo'][r]}${x.by ? ' · ' + esc(x.by) : ''}${x.seen ? ` · visto ${x.seen}×` : ' · 🆕 sin abrir'}</small>
      ${x.note ? `<p>${esc(x.note)}</p>` : ''}</div></div>`;
  }

  function render() {
    const v = $('v-nichos'); if (!v) return;
    const F = f(), M = matches(F), all = L();
    const chips = (list, key) => list.map(([k, t]) => `<button class="chip ${F[key] === k ? 'on' : ''}" data-nf="${key}|${k}">${t}</button>`).join('');
    const shown = all.filter(x => !q || norm(x.t + ' ' + x.url + ' ' + (x.note || '') + ' ' + (x.by || '')).includes(norm(q)));
    v.innerHTML = `<h2 class="sec">🧭 Nichos <small class="mut">para cuando no sabés qué ver o escuchar</small></h2>
      <div class="nchpick">
        <div class="nchrow"><span>¿Cuánto tiempo tenés?</span><div class="chips">${chips(TIME, 't')}</div></div>
        <div class="nchrow"><span>¿Qué tan raro?</span><div class="chips">${chips(RARE, 'r')}</div></div>
        <div class="nchrow sm"><span>¿Qué?</span><div class="chips">${chips(WHAT, 'w')}</div></div>
        <button class="pri nchgo" data-ngo ${M.length ? '' : 'disabled'}>🎲 Sorprendeme <small>${M.length} posible${M.length === 1 ? '' : 's'}</small></button>
        ${!all.length ? '<p class="mut">Tu base está vacía: pegá abajo links de cosas raras que encuentres (videos perdidos, discos, artículos, curiosidades) y después el 🎲 te elige.</p>' : !M.length ? '<p class="mut">Nada entra con esos filtros. Probá con más tiempo o “Me da igual”.</p>' : ''}
      </div>
      ${pick ? `<div class="nchres">${card(pick, true)}<div class="btns"><button class="pri" data-nopen>${ytId(pick.url) ? '▶ Ver ahora' : tv() ? '📱 Ver el link' : '↗ Abrir'}</button><button data-nagain>🎲 Otro</button><button data-nedit="${esc(pick.id)}">✎</button><span class="sp"></span><button data-nx>✕</button></div></div>` : ''}
      <h2 class="sec">➕ Sumar a la base</h2>
      <div class="nchadd box">
        <div class="nchf"><input id="nchUrl" placeholder="Pegá un link (YouTube, Spotify, Bandcamp, un artículo…)" value="${esc(edit?.url || '')}"><button data-nlook>🔎</button></div>
        <div class="nchf"><input id="nchT" placeholder="Título (se completa solo si se puede)" value="${esc(edit?.t || '')}"></div>
        <div class="nchf3">
          <label>Tipo<select id="nchK">${Object.entries(KIND).map(([k, [ic, n]]) => `<option value="${k}" ${(edit?.k || '') === k ? 'selected' : ''}>${ic} ${n}</option>`).join('')}</select></label>
          <label>Duración (min)<input id="nchMin" type="number" min="0" max="999" value="${edit?.min || ''}" placeholder="¿?"></label>
          <label>Rareza<select id="nchR">${RARE.slice(0, 3).map(([k, t]) => `<option value="${k}" ${String(edit?.r || 2) === k ? 'selected' : ''}>${t}</option>`).join('')}</select></label></div>
        <div class="nchf"><input id="nchNote" placeholder="Por qué vale la pena (opcional)" value="${esc(edit?.note || '')}"></div>
        <div class="btns">${edit?.id ? '<button data-ncancel>Cancelar</button>' : ''}<span class="sp"></span><button class="pri" data-nsave>${edit?.id ? 'Guardar cambios' : '＋ Sumar'}</button></div>
      </div>
      ${all.length ? `<h2 class="sec">📚 Tu base <small class="mut">${all.length}</small></h2>
        <input class="nchq" id="nchQ" placeholder="Buscar en la base…" value="${esc(q)}">
        <div class="nchlist">${shown.map(x => `<div class="nchli">${card(x)}<div class="btns"><button data-nopen1="${esc(x.id)}" title="Abrir">▶</button><button data-nedit="${esc(x.id)}" title="Editar">✎</button><button data-ndel="${esc(x.id)}" title="Borrar">🗑</button></div></div>`).join('') || '<div class="empty">Nada con esa búsqueda.</div>'}</div>` : ''}`;
    bind(v);
  }

  function bind(v) {
    const byId = id => L().find(x => x.id === id);
    v.querySelectorAll('[data-nf]').forEach(b => b.onclick = () => { const [k, val] = b.dataset.nf.split('|'); S.set('nichosF', { ...f(), [k]:val }); pick = null; render(); });
    v.querySelector('[data-ngo]')?.addEventListener('click', () => { pick = roll(); render(); v.querySelector('.nchres [data-nopen]')?.focus(); });
    v.querySelector('[data-nagain]')?.addEventListener('click', () => { pick = roll(pick?.id) || pick; render(); v.querySelector('.nchres [data-nopen]')?.focus(); });
    v.querySelector('[data-nopen]')?.addEventListener('click', () => { open(pick); render(); });
    v.querySelector('[data-nx]')?.addEventListener('click', () => { pick = null; render(); });
    v.querySelectorAll('[data-nopen1]').forEach(b => b.onclick = () => { const x = byId(b.dataset.nopen1); if (x) { open(x); render(); } });
    v.querySelectorAll('[data-nedit]').forEach(b => b.onclick = () => { edit = { ...byId(b.dataset.nedit) }; render(); $('nchUrl')?.scrollIntoView({ block:'center' }); });
    v.querySelectorAll('[data-ndel]').forEach(b => b.onclick = () => { const x = byId(b.dataset.ndel); if (!x || !confirm(`¿Borrar «${x.t || x.url}» de la base?`)) return; db.nichos = L().filter(y => y.id !== x.id); if (pick?.id === x.id) pick = null; save(); render(); });
    v.querySelector('[data-ncancel]')?.addEventListener('click', () => { edit = null; render(); });
    const url = $('nchUrl');
    const look = async () => { const u = url.value.trim(); if (!/^https?:\/\//.test(u)) return; const o = await lookup(u);
      if (o.t && !$('nchT').value) $('nchT').value = o.t; if (o.min && !$('nchMin').value) $('nchMin').value = o.min; if (!edit?.k) $('nchK').value = guessKind(u); got = { u, by:o.by || '' }; };
    url.onchange = look; url.onpaste = () => setTimeout(look, 30); v.querySelector('[data-nlook]').onclick = look;
    $('nchQ')?.addEventListener('input', e => { q = e.target.value; const p = e.target.selectionStart; render(); const n = $('nchQ'); n.focus(); n.setSelectionRange(p, p); });
    v.querySelector('[data-nsave]').onclick = () => {
      const u = url.value.trim(); if (!/^https?:\/\//.test(u)) return toast('<b>Pegá un link que empiece con http</b>', { cls:'info' });
      const x = { id:edit?.id || 'n' + uid(), url:u, t:$('nchT').value.trim(), k:$('nchK').value, min:+$('nchMin').value || 0, r:+$('nchR').value || 2, note:$('nchNote').value.trim(),
        by:(got.u === u && got.by) || edit?.by || '', seen:edit?.seen || 0, last:edit?.last || 0, at:edit?.at || Date.now() };
      const i = L().findIndex(y => y.id === x.id);
      if (i < 0 && L().some(y => y.url === u)) return toast('<b>Ese link ya está en tu base</b>', { cls:'info' });
      if (i >= 0) L()[i] = x; else L().unshift(x);
      if (pick?.id === x.id) pick = x; edit = null; save(); toast(`🧭 ${i >= 0 ? 'Guardado' : 'Sumado a tus nichos'}`, { ms:1800 }); render(); };
  }

  return { render, roll, count:() => L().length };
})();
