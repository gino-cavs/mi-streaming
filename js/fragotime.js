/* =========================================================
   🎙️ Fragotime: el modo para cuando te juntás con Ulises a hacer el podcast.
   Cada programa tiene: ✍️ guion (escribir), 🖍️ pizarra (dibujar), 📌 marcas con el minuto
   de la grabación (anotar), ❓ preguntas con su respuesta (preguntar/responder) y ⭐ muro (admirar).
   Arriba: ⏺ cronómetro de grabación, 🔎 buscar/encontrar (en los programas y en la web),
   🎲 algo al azar, 🙈 ocultar (pantalla negra al toque), 📺 mostrar en grande, 🍃 modo 420.
   Todo se guarda solo y se sincroniza entre aparatos (db.frago).
   ========================================================= */
const Frago = (() => {
  const TABS = [['guion', '✍️ Guion'], ['pizarra', '🖍️ Pizarra'], ['marcas', '📌 Marcas'], ['preg', '❓ Preguntas'], ['muro', '⭐ Muro']];
  const WHO = ['Yo', 'Ulises', 'Oyente'];
  const QUICK = [['⭐', 'Momento épico'], ['😂', 'Risa'], ['✂️', 'Para cortar'], ['🔁', 'Volver a esto'], ['🎵', 'Va música']];
  const PENS = ['#ffffff', '#1238b5', '#000000', '#ff4d4d', '#ffd400', '#3ccf7a'];
  const IDEAS = ['¿Cuál fue la mejor compra que hiciste este año?', '¿Qué opinión impopular bancás a muerte?', 'Contá la peor vergüenza de la semana.', '¿Qué personaje de la tele de los 90 volverías a ver?',
    'Si mañana te dan un programa de radio, ¿cómo se llama?', '¿Qué comida te sobrevalora la gente?', '¿Cuál es tu “no lo cuento en ningún lado”… que sí se puede contar?', 'Ranking rápido: tres cosas que te alegraron el mes.',
    '¿Qué harías con un día libre sin celular?', '¿Qué canción ponés para levantar una juntada?', 'El mejor partido que viste en la cancha.', '¿Qué famoso invitarías al podcast y qué le preguntarías?'];
  let tab = S.get('fragoTab', 'guion'), q = '', wiki = null, saveT = 0;
  const uidx = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 6);
  const D = () => { if (!db.frago || !Array.isArray(db.frago.eps)) db.frago = { eps:[], cur:'' }; return db.frago; };
  const ep = () => { const d = D(); let e = d.eps.find(x => x.id === d.cur) || d.eps[0]; if (!e) { e = newEp(); } d.cur = e.id; return e; };
  function newEp() { const d = D(), n = d.eps.length + 1, e = { id:uidx(), t:`Programa ${n}`, date:new Date().toISOString().slice(0, 10), guion:'', marcas:[], qs:[], muro:[], draw:[] }; d.eps.unshift(e); d.cur = e.id; return e; }
  const persist = (soon) => { clearTimeout(saveT); if (soon) saveT = setTimeout(save, 600); else save(); };
  const m420 = () => S.get('frago420', false);
  const pick = a => a[Math.floor(Math.random() * a.length)];
  // ⏺ cronómetro de la grabación (sobrevive a recargar)
  const T = () => S.get('fragoT', { on:false, t0:0, acc:0 });
  const secs = () => { const t = T(); return Math.floor((t.acc + (t.on ? Date.now() - t.t0 : 0)) / 1000); };
  const mmss = s => `${Math.floor(s / 3600) ? Math.floor(s / 3600) + ':' : ''}${String(Math.floor(s / 60) % 60).padStart(Math.floor(s / 3600) ? 2 : 1, '0')}:${String(s % 60).padStart(2, '0')}`;
  let tick = 0;

  function render() {
    const v = $('v-fragotime'); if (!v) return;
    const d = D(), e = ep(), t = T();
    v.classList.toggle('f420', m420());
    v.innerHTML = `<div class="frhead">
        <h2 class="sec">🎙️ Fragotime <small class="mut">el podcast con Ulises</small></h2>
        <div class="frep"><select id="frEp">${d.eps.map(x => `<option value="${esc(x.id)}" ${x.id === e.id ? 'selected' : ''}>${esc(x.t)} · ${x.date.slice(8)}/${x.date.slice(5, 7)}</option>`).join('')}</select>
          <button data-fr="new" title="Programa nuevo">＋</button><button data-fr="ren" title="Cambiarle el nombre">✎</button><button data-fr="del" title="Borrar programa">🗑</button></div>
      </div>
      <div class="frbar">
        <div class="frrec ${t.on ? 'on' : ''}"><button data-fr="rec">${t.on ? '⏸' : '⏺'}</button><b id="frClock">${mmss(secs())}</b>${secs() ? '<button data-fr="r0" title="Volver a cero">↺</button>' : ''}</div>
        <div class="frsearch"><input id="frQ" placeholder="🔎 Buscar o preguntar algo…" value="${esc(q)}"><button data-fr="find">Encontrar</button></div>
        <button data-fr="rand">🎲 Al azar</button><button data-fr="hide" title="Pantalla negra al toque (H)">🙈 Ocultar</button><button data-fr="show" title="Mostrar en grande">📺 Mostrar</button>
        <button data-fr="420" class="${m420() ? 'on' : ''}">🍃 Modo 420</button>
      </div>
      <div id="frFound">${foundHtml()}</div>
      <div class="frtabs">${TABS.map(([k, n]) => `<button data-frt="${k}" class="${tab === k ? 'on' : ''}">${n}${badge(e, k)}</button>`).join('')}</div>
      <div class="frbody">${body(e)}</div>`;
    bind(v, e);
    clearInterval(tick); tick = setInterval(() => { const c = $('frClock'); if (!c) return clearInterval(tick); c.textContent = mmss(secs()); }, 1000);
  }
  const badge = (e, k) => { const n = k === 'marcas' ? e.marcas.length : k === 'preg' ? e.qs.filter(x => !x.done).length : k === 'muro' ? e.muro.length : 0; return n ? ` <small>${n}</small>` : ''; };

  function body(e) {
    if (tab === 'guion') return `<textarea id="frGuion" class="frguion" placeholder="Escribí el guion, los temas, lo que no te podés olvidar…&#10;&#10;Tip: cada línea que empiece con # queda como título.">${esc(e.guion)}</textarea>
      <p class="mut frsm">Se guarda solo. ${e.guion ? `${e.guion.split(/\s+/).filter(Boolean).length} palabras.` : ''}</p>`;
    if (tab === 'pizarra') return `<div class="frpz"><div class="frpztools">${PENS.map((c, i) => `<button class="frpen ${pen.c === c && !pen.er ? 'on' : ''}" data-pen="${c}" style="background:${c}" title="Color ${i + 1}"></button>`).join('')}
        <button data-pen="er" class="${pen.er ? 'on' : ''}" title="Goma">🧽</button><input type="range" min="2" max="40" value="${pen.w}" id="frW" title="Grosor">
        <span class="sp"></span><button data-pz="undo" title="Deshacer">↶</button><button data-pz="clr" title="Borrar todo">🗑</button><button data-pz="png" title="Bajar PNG">⬇</button><button data-pz="show" title="Mostrar en grande">📺</button></div>
        <canvas id="frCv" class="frcv"></canvas></div>`;
    if (tab === 'marcas') return `<div class="frmk"><div class="frmkin"><input id="frMk" placeholder="${T().on ? `Anotar en el ${mmss(secs())}…` : 'Anotar (prendé ⏺ para que quede el minuto)'}"><button data-fr="mk" class="pri">📌</button></div>
        <div class="frquick">${QUICK.map(([i, t]) => `<button data-qk="${i} ${t}">${i} ${t}</button>`).join('')}</div>
        <ol class="frlist">${e.marcas.map(m => `<li><b class="frts">${m.s != null ? mmss(m.s) : '—'}</b><span>${esc(m.txt)}</span><button data-mkd="${m.id}" title="Borrar">✕</button></li>`).join('') || '<li class="mut">Todavía no anotaste nada. Durante la grabación, cada marca queda con su minuto para editar después.</li>'}</ol>
        ${e.marcas.length ? '<button data-fr="mkcopy">📋 Copiar todas (para editar el audio)</button>' : ''}</div>`;
    if (tab === 'preg') return `<div class="frq"><div class="frmkin"><select id="frWho">${WHO.map(w => `<option>${w}</option>`).join('')}</select><input id="frQin" placeholder="Escribí una pregunta…"><button data-fr="qadd" class="pri">❓</button></div>
        <div class="frlistq">${e.qs.map(x => `<div class="frqi ${x.done ? 'done' : ''} ${x.hid ? 'hid' : ''}" data-qid="${x.id}">
          <div class="frqq"><small>${esc(x.by || 'Yo')}</small><b data-reveal>${esc(x.q)}</b></div>
          <textarea data-qa="${x.id}" placeholder="Respuesta…" rows="${x.a ? 3 : 1}">${esc(x.a || '')}</textarea>
          <div class="btns"><button data-qdone="${x.id}">${x.done ? '↩ Pendiente' : '✓ Respondida'}</button><button data-qhid="${x.id}">${x.hid ? '👁 Mostrar' : '🙈 Ocultar'}</button><button data-qshow="${x.id}">📺</button><span class="sp"></span><button data-qdel="${x.id}">✕</button></div></div>`).join('') || '<p class="mut">Cargá preguntas para el programa: tuyas, de Ulises o de los oyentes. Las que ocultás quedan tapadas hasta que las tocás (sirve para sorpresas).</p>'}</div></div>`;
    return `<div class="frmuro"><div class="frmkin"><input id="frMu" placeholder="Una frase épica, un link, algo para admirar…"><button data-fr="muadd" class="pri">⭐</button></div>
      <div class="frgrid">${e.muro.map(m => `<div class="frcard"><p>${linky(m.txt)}</p><div class="btns"><button data-mustar="${m.id}" class="frstar">👏 ${m.n || 0}</button><button data-mushow="${m.id}">📺</button><span class="sp"></span><button data-mudel="${m.id}">✕</button></div></div>`).join('') || '<p class="mut">El muro de las cosas que admiramos: frases que quedaron, links, momentos. Cada 👏 suma.</p>'}</div></div>`;
  }
  const linky = t => esc(t).replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');

  // 🔎 buscar/encontrar: en todos los programas + resumen de Wikipedia + atajos a la web
  function foundHtml() {
    if (!q.trim()) return '';
    const n = norm(q), hits = [];
    for (const e of D().eps) {
      e.guion.split('\n').forEach(l => norm(l).includes(n) && hits.push([e, '✍️', l]));
      e.marcas.forEach(m => norm(m.txt).includes(n) && hits.push([e, '📌', (m.s != null ? mmss(m.s) + ' · ' : '') + m.txt]));
      e.qs.forEach(x => norm(x.q + ' ' + (x.a || '')).includes(n) && hits.push([e, '❓', x.q + (x.a ? ' → ' + x.a : '')]));
      e.muro.forEach(m => norm(m.txt).includes(n) && hits.push([e, '⭐', m.txt]));
    }
    const web = encodeURIComponent(q.trim());
    return `<div class="frfound box"><div class="btns"><b>🔎 «${esc(q)}»</b><span class="sp"></span>
        <a class="btn" href="https://www.google.com/search?q=${web}" target="_blank" rel="noopener">Google</a><a class="btn" href="https://es.wikipedia.org/w/index.php?search=${web}" target="_blank" rel="noopener">Wikipedia</a><a class="btn" href="https://www.youtube.com/results?search_query=${web}" target="_blank" rel="noopener">YouTube</a><button data-fr="qx">✕</button></div>
      ${wiki ? `<div class="frwiki">${wiki.img ? `<img src="${esc(wiki.img)}" alt="">` : ''}<div><b>${esc(wiki.t)}</b><p>${esc(wiki.x)}</p><div class="btns"><button data-fr="wikiq">❓ Pasar a pregunta</button><button data-fr="wikishow">📺 Mostrar</button></div></div></div>` : wiki === false ? '<p class="mut">Wikipedia no tiene nada con ese nombre exacto.</p>' : ''}
      ${hits.length ? `<ul class="frhits">${hits.slice(0, 30).map(([e, i, t]) => `<li data-goep="${esc(e.id)}"><small>${esc(e.t)}</small> ${i} ${esc(t.slice(0, 160))}</li>`).join('')}</ul>` : '<p class="mut">No está en tus programas.</p>'}</div>`;
  }
  async function find() {
    wiki = null; const t = q.trim(); if (!t) return render();
    render();
    try { const r = await fetch('https://es.wikipedia.org/api/rest_v1/page/summary/' + encodeURIComponent(t.replace(/\s+/g, '_')));
      if (r.ok) { const j = await r.json(); wiki = j.extract ? { t:j.title, x:j.extract, img:j.thumbnail?.source || '' } : false; } else wiki = false; } catch { wiki = false; }
    if (norm(q) === norm(t)) { const box = $('frFound'); if (box) { box.innerHTML = foundHtml(); bindFound(box); } }
  }

  // 📺 mostrar en grande · 🙈 ocultar
  function show(html, kind = '') {
    document.getElementById('frShow')?.remove();
    const o = document.createElement('div'); o.id = 'frShow'; o.className = 'frshow ' + kind + (m420() ? ' f420' : ''); o.tabIndex = 0;
    o.innerHTML = `<div class="frshowin">${html}</div><small class="frshowx">Tocá o apretá cualquier tecla para volver</small>`;
    const close = () => { o.remove(); document.removeEventListener('keydown', k, true); if (document.fullscreenElement) document.exitFullscreen?.().catch(() => {}); };
    const k = e => { e.preventDefault(); e.stopPropagation(); close(); };
    o.onclick = close; document.addEventListener('keydown', k, true); document.body.appendChild(o); o.focus();
    o.requestFullscreen?.().catch(() => {});
    if (kind === 'cv') { const c = o.querySelector('canvas'), w = Math.min(innerWidth, innerHeight * 16 / 9); paint(c, ep().draw, w, Math.round(w * 9 / 16)); }
  }
  const hide = () => show('', 'black');
  const showText = (t, small = '') => show(`<p class="frbig ${t.length > 140 ? 'long' : ''}">${esc(t)}</p>${small ? `<small>${esc(small)}</small>` : ''}`);

  // 🎲 algo al azar: preguntas pendientes, ideas, y con 🍃 lo del 420
  function random() {
    const e = ep(), pend = e.qs.filter(x => !x.done), B = typeof T420 !== 'undefined' ? T420.bank : null, opts = [];
    if (pend.length) opts.push(() => { const x = pick(pend); return ['❓ ' + (x.by || 'Pregunta'), x.q]; });
    opts.push(() => ['💡 Para tirar en el aire', pick(IDEAS)]);
    if (m420() && B) { opts.push(() => ['🌀 Para pensar un rato', pick(B.PENSAR)], () => ['🧠 ¿Sabías que…?', pick(B.DATOS)], () => { const [a, b] = pick(B.PREFERIS); return ['⚖️ ¿Qué preferís?', `${a}  o  ${b}`]; }); }
    const [t, x] = pick(opts)();
    showText(x, t);
  }

  // 🖍️ pizarra: trazos en coordenadas 0..1000 (livianos, se sincronizan) — se redibuja al tamaño que haga falta
  const pen = S.get('fragoPen', { c:'#ffffff', w:6, er:false });
  function paint(cv, strokes, w, h) {
    const k = devicePixelRatio || 1; cv.width = w * k; cv.height = h * k; cv.style.width = w + 'px'; cv.style.height = h + 'px';
    const g = cv.getContext('2d'); g.setTransform(k, 0, 0, k, 0, 0); g.fillStyle = '#05091a'; g.fillRect(0, 0, w, h);
    for (const s of strokes) line(g, s, w, h);
    return { g };
  }
  function line(g, s, w, h) {
    const p = s.p; if (!p || p.length < 2) return;
    g.save(); g.lineCap = g.lineJoin = 'round'; g.lineWidth = s.w * w / 1000; g.strokeStyle = s.er ? '#05091a' : s.c;
    g.beginPath(); g.moveTo(p[0] * w / 1000, p[1] * h / 1000); for (let i = 2; i < p.length; i += 2) g.lineTo(p[i] * w / 1000, p[i + 1] * h / 1000);
    if (p.length === 2) g.lineTo(p[0] * w / 1000 + .1, p[1] * h / 1000); g.stroke(); g.restore();
  }
  function bindPizarra(v, e) {
    const cv = $('frCv'); if (!cv) return;
    const size = () => { const w = cv.parentElement.clientWidth, h = Math.round(w * 9 / 16); return [w, h]; };
    let [w, h] = size(); const { g } = paint(cv, e.draw, w, h); let cur = null;
    const pt = ev => { const r = cv.getBoundingClientRect(); return [Math.round((ev.clientX - r.left) / r.width * 1000), Math.round((ev.clientY - r.top) / r.height * 1000)]; };
    cv.onpointerdown = ev => { cv.setPointerCapture(ev.pointerId); cur = { c:pen.c, w:pen.er ? pen.w * 3 : pen.w, er:pen.er || undefined, p:pt(ev) }; line(g, cur, w, h); };
    cv.onpointermove = ev => { if (!cur) return; cur.p.push(...pt(ev)); const n = cur.p.length; line(g, { ...cur, p:cur.p.slice(n - 4) }, w, h); };
    cv.onpointerup = cv.onpointercancel = () => { if (!cur) return; e.draw.push(cur); cur = null; if (e.draw.length > 600) e.draw.splice(0, e.draw.length - 600); persist(true); };
    v.querySelectorAll('[data-pen]').forEach(b => b.onclick = () => { if (b.dataset.pen === 'er') pen.er = !pen.er; else { pen.c = b.dataset.pen; pen.er = false; } S.set('fragoPen', pen); render(); });
    $('frW').oninput = ev => { pen.w = +ev.target.value; S.set('fragoPen', pen); };
    v.querySelector('[data-pz="undo"]').onclick = () => { e.draw.pop(); persist(true); render(); };
    v.querySelector('[data-pz="clr"]').onclick = () => { if (e.draw.length && confirm('¿Borrar toda la pizarra?')) { e.draw = []; persist(); render(); } };
    v.querySelector('[data-pz="png"]').onclick = () => { const c = document.createElement('canvas'); paint(c, e.draw, 1920, 1080); c.toBlob(b => b && saveFile(b, `fragotime-pizarra-${e.date}.png`), 'image/png'); };
    v.querySelector('[data-pz="show"]').onclick = () => show('<canvas></canvas>', 'cv');
  }

  function bindFound(box) {
    box.querySelector('[data-fr="qx"]')?.addEventListener('click', () => { q = ''; wiki = null; render(); });
    box.querySelector('[data-fr="wikiq"]')?.addEventListener('click', () => { ep().qs.unshift({ id:uidx(), q:`¿${wiki.t}?`, a:wiki.x, by:'Yo' }); persist(); tab = 'preg'; render(); });
    box.querySelector('[data-fr="wikishow"]')?.addEventListener('click', () => show(`${wiki.img ? `<img src="${esc(wiki.img)}" alt="">` : ''}<p class="frbig long">${esc(wiki.x)}</p><small>${esc(wiki.t)} · Wikipedia</small>`));
    box.querySelectorAll('[data-goep]').forEach(li => li.onclick = () => { D().cur = li.dataset.goep; persist(); render(); });
  }

  function bind(v, e) {
    const on = (sel, fn) => v.querySelector(sel)?.addEventListener('click', fn);
    $('frEp').onchange = ev => { D().cur = ev.target.value; persist(); render(); };
    on('[data-fr="new"]', () => { newEp(); persist(); tab = 'guion'; render(); });
    on('[data-fr="ren"]', () => { const t = prompt('Nombre del programa', e.t); if (t?.trim()) { e.t = t.trim(); persist(); render(); } });
    on('[data-fr="del"]', () => { if (!confirm(`¿Borrar «${e.t}» con todo lo que tiene?`)) return; const d = D(); d.eps = d.eps.filter(x => x.id !== e.id); d.cur = d.eps[0]?.id || ''; persist(); render(); });
    on('[data-fr="rec"]', () => { const t = T(); if (t.on) S.set('fragoT', { on:false, t0:0, acc:t.acc + Date.now() - t.t0 }); else S.set('fragoT', { on:true, t0:Date.now(), acc:t.acc }); render(); });
    on('[data-fr="r0"]', () => { if (confirm('¿Cronómetro a cero?')) { S.set('fragoT', { on:false, t0:0, acc:0 }); render(); } });
    const qi = $('frQ'); qi.onkeydown = ev => { if (ev.key === 'Enter') { q = qi.value; find(); } };
    on('[data-fr="find"]', () => { q = qi.value; find(); });
    on('[data-fr="rand"]', random); on('[data-fr="hide"]', hide);
    on('[data-fr="show"]', () => { if (tab === 'pizarra') return show('<canvas></canvas>', 'cv'); const txt = tab === 'guion' ? (getSelection().toString() || $('frGuion')?.value.split('\n').find(l => l.trim()) || '') : ''; if (txt) showText(txt); else random(); });
    on('[data-fr="420"]', () => { S.set('frago420', !m420()); toast(m420() ? '🍃 Modo 420 prendido: el 🎲 también tira datos, preguntas para pensar y “¿qué preferís?”' : 'Modo 420 apagado', { ms:3000 }); render(); });
    bindFound(v.querySelector('#frFound'));
    v.querySelectorAll('[data-frt]').forEach(b => b.onclick = () => { tab = b.dataset.frt; S.set('fragoTab', tab); render(); });
    // ✍️ guion
    const gu = $('frGuion'); if (gu) gu.oninput = () => { e.guion = gu.value; persist(true); };
    // 📌 marcas
    const addMk = txt => { if (!txt.trim()) return; const t = T(); e.marcas.push({ id:uidx(), s:t.on || t.acc ? secs() : null, txt:txt.trim() }); persist(); render(); setTimeout(() => $('frMk')?.focus(), 0); };
    const mk = $('frMk'); if (mk) { mk.onkeydown = ev => { if (ev.key === 'Enter') addMk(mk.value); }; on('[data-fr="mk"]', () => addMk(mk.value)); }
    v.querySelectorAll('[data-qk]').forEach(b => b.onclick = () => addMk(b.dataset.qk));
    v.querySelectorAll('[data-mkd]').forEach(b => b.onclick = () => { e.marcas = e.marcas.filter(m => m.id !== b.dataset.mkd); persist(); render(); });
    on('[data-fr="mkcopy"]', () => { const t = `${e.t} (${e.date})\n` + e.marcas.map(m => `${m.s != null ? mmss(m.s) : '--:--'}  ${m.txt}`).join('\n'); navigator.clipboard?.writeText(t).then(() => toast('📋 Marcas copiadas', { ms:1800 }), () => toast('<b>No pude copiar</b>', { cls:'info' })); });
    // ❓ preguntas
    const qin = $('frQin'); if (qin) { const add = () => { if (!qin.value.trim()) return; e.qs.push({ id:uidx(), q:qin.value.trim(), a:'', by:$('frWho').value }); persist(); render(); setTimeout(() => $('frQin')?.focus(), 0); }; qin.onkeydown = ev => { if (ev.key === 'Enter') add(); }; on('[data-fr="qadd"]', add); }
    const Q = id => e.qs.find(x => x.id === id);
    v.querySelectorAll('[data-qa]').forEach(t => t.oninput = () => { Q(t.dataset.qa).a = t.value; persist(true); });
    v.querySelectorAll('[data-qdone]').forEach(b => b.onclick = () => { const x = Q(b.dataset.qdone); x.done = !x.done; persist(); render(); });
    v.querySelectorAll('[data-qhid]').forEach(b => b.onclick = () => { const x = Q(b.dataset.qhid); x.hid = !x.hid; persist(); render(); });
    v.querySelectorAll('.frqi.hid [data-reveal]').forEach(b => b.onclick = () => b.closest('.frqi').classList.remove('hid'));
    v.querySelectorAll('[data-qshow]').forEach(b => b.onclick = () => { const x = Q(b.dataset.qshow); showText(x.q, (x.by || '') + (x.a ? ' — ' + x.a : '')); });
    v.querySelectorAll('[data-qdel]').forEach(b => b.onclick = () => { e.qs = e.qs.filter(x => x.id !== b.dataset.qdel); persist(); render(); });
    // ⭐ muro
    const mu = $('frMu'); if (mu) { const add = () => { if (!mu.value.trim()) return; e.muro.unshift({ id:uidx(), txt:mu.value.trim(), n:0 }); persist(); render(); }; mu.onkeydown = ev => { if (ev.key === 'Enter') add(); }; on('[data-fr="muadd"]', add); }
    const M = id => e.muro.find(x => x.id === id);
    v.querySelectorAll('[data-mustar]').forEach(b => b.onclick = () => { const m = M(b.dataset.mustar); m.n = (m.n || 0) + 1; b.textContent = '👏 ' + m.n; b.classList.remove('pop'); void b.offsetWidth; b.classList.add('pop'); persist(true); });
    v.querySelectorAll('[data-mushow]').forEach(b => b.onclick = () => showText(M(b.dataset.mushow).txt, '⭐ Muro de Fragotime'));
    v.querySelectorAll('[data-mudel]').forEach(b => b.onclick = () => { e.muro = e.muro.filter(x => x.id !== b.dataset.mudel); persist(); render(); });
    if (tab === 'pizarra') bindPizarra(v, e);
  }

  // H = ocultar al toque (si no estás escribiendo)
  document.addEventListener('keydown', ev => {
    if (ev.key.toLowerCase() !== 'h' || ev.ctrlKey || ev.metaKey || ev.altKey || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName) || document.getElementById('frShow')) return;
    if (!$('v-fragotime')?.classList.contains('show')) return; ev.preventDefault(); hide();
  });

  return { render };
})();
