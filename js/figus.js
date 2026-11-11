/* =========================================================
   🃏 FIGUS — tu idle game de figuritas (solo para vos, sin plata de verdad). Celu y compu; la tele solo suma monedas.
   • Monedas por estar en FUNVS: 1 cada 5 min, máx. 60 por día. Se cuentan por "turnos" de 5 minutos compartidos entre
     todos tus aparatos: si lo tenés abierto en la compu, el celu y la tele a la vez, cuenta UNA sola vez.
   • Regalo del día (con racha y lo que juntaste mientras no estabas), Prode de Fulbito, sobres de Vaca por cada paseo,
     sobre de Vélez gratis los días que juega.
   • Álbumes que armás vos: colores (hex), estilo de plantilla, historia, páginas (programas) y las figus (imagen o gif,
     nombre, rareza: común, rara, legendaria). Kiosco, repetidas, comprar una puntual, balance.
   Todo se guarda en un Gist privado aparte ("FUNVS figus"), como un registro de movimientos que se suma entre aparatos
   (nadie pisa lo de otro). Las imágenes van en un archivo por álbum y en el aparato quedan guardadas (IndexedDB).
   ========================================================= */
const Figus = (() => {
  // ⚖️ la economía (si se siente lenta o rápida, se toca acá)
  const ECO = { slotMs:5 * 60e3, slotCap:60, daily:20, streakStep:5, streakMax:7, offPerH:2, offMax:30,
    prodeWin:15, prodeExact:40, prodeScorer:10, velezX:2,
    pack:40, packVelez:60, packSize:5, buy:{ c:60, r:150, l:400 }, sell:{ c:3, r:10, l:40 }, odds:{ c:.70, r:.25, l:.05 } };
  const STYLES = { panini:'🟨 Clásico Panini', retro:'📼 Retro 90s', neon:'💡 Neón', diario:'📰 Diario de papel', holo:'🌈 Holográfico' };
  const KINDS = { canal:'📺 Canal o temática', vaca:'🐶 Vaca (solo sale paseándola)', velez:'💙 Vélez (días de partido o kiosco)' };
  const RAR = { c:'Común', r:'Rara', l:'Legendaria' };
  const tvDev = () => Device.mode === 'tv';
  const ymdOf = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const today = () => ymdOf(Date.now());
  const coinTxt = n => `🪙 ${Math.round(n).toLocaleString('es-AR')}`;

  /* ---------------- estado (registro de movimientos) ---------------- */
  const blank = () => ({ v:1, since:Date.now(), albums:{}, ev:[], base:null });
  let st = S.get('figus', null) || blank();
  let D = null;   // estado calculado
  const saveSt = () => { S.set('figus', st); D = null; };
  const has = id => st.ev.some(e => e.id === id);
  function add(e) { if (has(e.id)) return false; st.ev.push({ t:Date.now(), ...e }); saveSt(); schedule(); return true; }

  // todo sale de recorrer los movimientos en orden: así dos aparatos siempre llegan a lo mismo
  function derive() {
    if (D) return D;
    const B = st.base || {}, evs = [...st.ev].sort((a, b) => a.t - b.t || (a.id < b.id ? -1 : 1));
    let coins = B.coins || 0; const have = { ...(B.have || {}) }, toks = { ...(B.toks || {}) }, day = {}, dailies = new Set(B.dailies || []), done = new Set(B.done || []);
    let lastSlot = B.lastSlot || 0, earned = { slot:0, daily:0, prode:0, sell:0 }, spent = 0;
    for (const e of evs) {
      if (e.ty === 'slot') { const d = ymdOf(e.t); day[d] = (day[d] || 0) + 1; if (day[d] <= ECO.slotCap) { coins++; earned.slot++; } lastSlot = Math.max(lastSlot, e.t); }
      else if (e.ty === 'daily') { coins += e.n; earned.daily += e.n; dailies.add(e.d); }
      else if (e.ty === 'prode') { coins += e.n; earned.prode += e.n; }
      else if (e.ty === 'tok') toks[e.id] = e;
      else if (e.ty === 'pack') {
        if (e.tok) { if (!toks[e.tok]) continue; delete toks[e.tok]; }
        else { if (coins < e.cost) continue; coins -= e.cost; spent += e.cost; }
        (e.c || []).forEach(k => have[k] = (have[k] || 0) + 1);
      }
      else if (e.ty === 'buy') { if (coins < e.cost) continue; coins -= e.cost; spent += e.cost; have[e.k] = (have[e.k] || 0) + 1; }
      else if (e.ty === 'sell') { if ((have[e.k] || 0) < 2) continue; have[e.k]--; coins += e.n; earned.sell += e.n; }
      else if (e.ty === 'done') done.add(e.a);
    }
    return D = { coins, have, toks, day, dailies, done, lastSlot, earned, spent };
  }
  // cuando el registro crece mucho, lo viejo (más de 60 días) se resume en una "base" (igual en todos los aparatos)
  function compact() {
    if (st.ev.length < 4000) return;
    const cut = Date.now() - 60 * 864e5, old = st.ev.filter(e => e.t <= cut); if (!old.length) return;
    const keep = st.ev.filter(e => e.t > cut); st.ev = old; D = null; const d = derive();
    st.base = { upTo:cut, coins:d.coins, have:d.have, toks:d.toks, dailies:[...d.dailies], done:[...d.done], lastSlot:d.lastSlot };
    st.ev = keep; saveSt();
  }
  function merge(r) {
    if (!r || !r.ev) return false; let ch = false;
    if (r.base && (!st.base || r.base.upTo > st.base.upTo)) { st.base = r.base; ch = true; }
    const ids = new Set(st.ev.map(e => e.id));
    r.ev.forEach(e => { if (!ids.has(e.id)) { st.ev.push(e); ids.add(e.id); ch = true; } });
    if (st.base) { const n = st.ev.length; st.ev = st.ev.filter(e => e.t > st.base.upTo); if (st.ev.length !== n) ch = true; }
    Object.entries(r.albums || {}).forEach(([id, a]) => { const m = st.albums[id]; if (!m || (a.upd || 0) > (m.upd || 0)) { st.albums[id] = a; ch = true; } });
    if (r.since && r.since < st.since) st.since = r.since;
    if (ch) saveSt();
    return ch;
  }

  /* ---------------- ☁ Gist privado aparte ---------------- */
  let pushT = null, gmeta = null, busy = false;
  const online = () => !!db.sync?.token;
  async function gistId() {
    if (db.figusGist) return db.figusGist;
    for (let p = 1; p <= 3; p++) { const L = await gh(`/gists?per_page=100&page=${p}`); const g = L.find(g => g.files?.['figus.json']); if (g) { db.figusGist = g.id; save(); return g.id; } if (L.length < 100) break; }
    const g = await gh('/gists', { method:'POST', body:JSON.stringify({ description:'FUNVS figus (no borrar)', public:false, files:{ 'figus.json':{ content:JSON.stringify(st) } } }) });
    db.figusGist = g.id; save(); return g.id;
  }
  async function pull() {
    if (!online() || busy) return; busy = true;
    try {
      const id = await gistId();
      let g; try { g = await gh('/gists/' + id); } catch (e) { if (e.status === 404) { db.figusGist = null; save(); } throw e; }
      gmeta = g; const f = g.files['figus.json'];
      let need = !f || dirtyImg.size > 0;
      if (f) { const r = JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content); if (merge(r) && Nav.current === 'figus') render();
        // ¿tengo algo que allá no está? (movimientos o álbumes más nuevos) → subo
        const rid = new Set((r.ev || []).map(e => e.id)); need = need || st.ev.some(e => !rid.has(e.id)) || Object.values(st.albums).some(a => (a.upd || 0) > ((r.albums || {})[a.id]?.upd || 0)); }
      if (need) await pushNow(true);
    } catch {} busy = false;
  }
  async function pushNow(already) {
    if (!online()) return; clearTimeout(pushT); pushT = null;
    try {
      const id = await gistId();
      if (!already) { const g = await gh('/gists/' + id); gmeta = g; const f = g.files['figus.json']; if (f) merge(JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content)); }
      compact();
      const files = { 'figus.json':{ content:JSON.stringify(st) } };
      const sent = [...dirtyImg];
      for (const a of sent) files[`img-${a}.json`] = { content:JSON.stringify(await imgsOf(a)) };
      gmeta = await gh('/gists/' + id, { method:'PATCH', body:JSON.stringify({ files }) });
      sent.forEach(a => dirtyImg.delete(a)); S.set('figusDirty', [...dirtyImg]);
    } catch {}
  }
  function schedule() { if (!online()) return; clearTimeout(pushT); pushT = setTimeout(pushNow, tvDev() ? 15 * 60e3 : 20e3); }

  /* ---------------- 🖼️ imágenes (IndexedDB + un archivo por álbum en el Gist) ---------------- */
  // qué álbumes tienen imágenes sin subir (queda guardado por si cerrás antes de que suba)
  const dirtyImg = new Set(S.get('figusDirty', [])), urlCache = {};
  const markDirty = id => { dirtyImg.add(id); S.set('figusDirty', [...dirtyImg]); };
  let idbP = null;
  const idb = () => idbP || (idbP = new Promise((ok, no) => { const r = indexedDB.open('funvs-figus', 1); r.onupgradeneeded = () => r.result.createObjectStore('img'); r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error); }));
  const tx = async (mode, fn) => { const d = await idb(); return new Promise((ok, no) => { const t = d.transaction('img', mode), s = t.objectStore('img'); const r = fn(s); t.oncomplete = () => ok(r?.result); t.onerror = () => no(t.error); }); };
  const imgGet = id => tx('readonly', s => s.get(id));
  const imgPut = (id, v) => tx('readwrite', s => s.put(v, id));
  async function imgsOf(aid) {   // todas las imágenes de un álbum (para subirlas)
    const a = st.albums[aid]; if (!a) return {}; const o = {};
    for (const id of [a.logo, ...(a.cards || []).map(c => c.img)].filter(Boolean)) { const v = await imgGet(id); if (v) o[id] = v; }
    return o;
  }
  const fetched = new Set();
  async function ensureImgs(aid) {   // si faltan en este aparato, las bajo del Gist
    const a = st.albums[aid]; if (!a || fetched.has(aid) || !online()) return;
    const ids = [a.logo, ...(a.cards || []).map(c => c.img)].filter(Boolean); let miss = false;
    for (const id of ids) if (!urlCache[id] && !(await imgGet(id))) { miss = true; break; }
    if (!miss) return; fetched.add(aid);
    try { if (!gmeta) gmeta = await gh('/gists/' + await gistId()); const f = gmeta.files[`img-${aid}.json`]; if (!f) return;
      const o = JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content); for (const [k, v] of Object.entries(o)) await imgPut(k, v);
      if (Nav.current === 'figus') hydrate(); } catch { fetched.delete(aid); }
  }
  async function hydrate(root = $('v-figus')) {
    if (!root) return;
    for (const el of root.querySelectorAll('[data-img]')) { const id = el.dataset.img; if (!id) continue;
      let u = urlCache[id]; if (!u) { const v = await imgGet(id).catch(() => null); if (v) u = urlCache[id] = v; }
      if (u) { if (el.tagName === 'IMG') { if (el.src !== u) el.src = u; } else el.style.backgroundImage = `url("${u}")`; el.classList.add('ok'); } }
  }
  // achico al subir: fotos a 360 px (webp/jpeg); los gif quedan como están si pesan menos de 700 KB
  function readImg(file) {
    return new Promise((ok, no) => {
      const fr = new FileReader();
      fr.onload = () => {
        const u = fr.result;
        if (/^data:image\/gif/.test(u)) return file.size <= 700e3 ? ok(u) : no(new Error('Ese gif pesa mucho (más de 700 KB). Probá uno más corto o más chico.'));
        const im = new Image(); im.onload = () => { const z = 360, k = Math.min(1, z / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); let out = c.toDataURL('image/webp', .82); if (!/^data:image\/webp/.test(out)) out = c.toDataURL('image/jpeg', .85); ok(out); };
        im.onerror = () => no(new Error('No pude leer esa imagen.')); im.src = u;
      };
      fr.onerror = () => no(new Error('No pude leer el archivo.')); fr.readAsDataURL(file);
    });
  }

  /* ---------------- 🪙 cómo se ganan ---------------- */
  let lastInput = Date.now();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => lastInput = Date.now(), { passive:true, capture:true }));
  function slotTick() {   // un "turno" de 5 min compartido entre aparatos (mismo id en todos → cuenta una vez)
    if (document.hidden) return;
    const playing = !!AudioMgr.active, active = tvDev() ? playing : (playing || Date.now() - lastInput < 10 * 60e3);
    if (!active) return;
    const n = Math.floor(Date.now() / ECO.slotMs); add({ id:'s' + n, ty:'slot', t:n * ECO.slotMs + 1000 });
  }
  function streakFor(d) { const ds = derive().dailies; let n = 0; const t = new Date(d + 'T12:00:00'); for (;;) { t.setDate(t.getDate() - 1); if (ds.has(ymdOf(t))) n++; else break; if (n > 400) break; } return n; }
  function daily() {   // regalo del día: 20 + racha (hasta +35) + lo de mientras no estabas (2 por hora, hasta 30)
    const d = today(); if (has('d-' + d) || tvDev()) return null;
    const s = streakFor(d), x = derive(), away = x.lastSlot ? Math.max(0, (Date.now() - x.lastSlot) / 3600e3) : 0;
    const off = Math.min(ECO.offMax, Math.floor(away) * ECO.offPerH), bonus = Math.min(s, ECO.streakMax) * ECO.streakStep;
    const n = ECO.daily + bonus + off;
    add({ id:'d-' + d, ty:'daily', d, n, s:s + 1, off, bonus });
    return { n, s:s + 1, off, bonus };
  }
  function prode() {   // monedas por el Prode (solo partidos desde que existe Figus)
    let n = 0;
    Object.values(db.prode?.preds || {}).forEach(p => {
      const r = db.prode.res?.[p.id]; if (!r || Date.parse(p.date) < st.since - 864e5 || has('p-' + p.id)) return;
      let c = 0; const sg = (x, y) => Math.sign(x - y);
      if (p.h !== '' && p.a !== '' && p.h != null && p.a != null) { if (+p.h === r.hs && +p.a === r.as) c += ECO.prodeExact; else if (sg(+p.h, +p.a) === sg(r.hs, r.as)) c += ECO.prodeWin; }
      [p.ph, p.pa].forEach(pk => { if (pk && (r.sc || []).includes(pk.id) || pk && (r.names || []).some(x => norm(x) === norm(pk.name))) c += ECO.prodeScorer; });
      if (/v[eé]lez/i.test(`${p.home} ${p.away}`)) c *= ECO.velezX;
      add({ id:'p-' + p.id, ty:'prode', n:c, m:`${p.home} ${r.hs}-${r.as} ${p.away}` }); if (c) n += c;
    });
    if (n && !tvDev()) toast(`<b>🪙 +${n} del Prode</b><small>Se sumaron a Figus.</small>`, { cls:'info', ms:4000, onclick:() => Nav.go('figus') });
  }
  function velezTok() {   // 💙 los días que juega Vélez: un sobre de Vélez de regalo
    let m = null; try { m = Partido.match(); } catch {} if (!m || new Date(m.date).toDateString() !== new Date().toDateString()) return false;
    add({ id:'vz-' + today(), ty:'tok', k:'velez', why:'¡Hoy juega Vélez!' }); return true;
  }
  const velezDay = () => { try { const m = Partido.match(); return !!m && new Date(m.date).toDateString() === new Date().toDateString(); } catch { return false; } };
  // 🐶 Paseo completado → 1 sobre de Vaca (5 figus)
  function paseo(p) { if (!p || p.min < 15) return; if (add({ id:'v-' + p.s, ty:'tok', k:'vaca', why:`Paseo de ${p.min} min` })) toast('<b>🐶 ¡Sobre de Vaca!</b><small>Por el paseo. Abrilo en Figus.</small>', { cls:'info', ms:6000, onclick:() => { Nav.go('figus'); view = { tab:'inicio' }; render(); } }); }

  /* ---------------- 📦 sobres ---------------- */
  const albums = () => Object.values(st.albums).filter(a => !a.del).sort((a, b) => (a.ord ?? a.cr) - (b.ord ?? b.cr));
  const ready = a => (a.cards || []).filter(c => c.img);
  const albumOfKind = k => albums().find(a => a.kind === k && ready(a).length);
  function draw(a) {
    const R = ready(a), out = [];
    for (let i = 0; i < ECO.packSize; i++) {
      const x = Math.random(), want = x < ECO.odds.l ? 'l' : x < ECO.odds.l + ECO.odds.r ? 'r' : 'c';
      const pool = [want, 'c', 'r', 'l'].map(r => R.filter(c => (c.rar || 'c') === r)).find(p => p.length);
      if (pool) out.push(a.id + ':' + pool[Math.floor(Math.random() * pool.length)].n);
    }
    return out;
  }
  function openPack(a, { tok, cost = 0 } = {}) {
    if (!a || ready(a).length < 1) return toast('<b>Ese álbum todavía no tiene figus con imagen</b>', { cls:'info' });
    const before = { ...derive().have };
    if (!tok && derive().coins < cost) return toast(`<b>Te faltan monedas</b><small>Necesitás ${cost} y tenés ${derive().coins}.</small>`, { cls:'info' });
    const c = draw(a); add({ id:'k' + uid() + Date.now().toString(36), ty:'pack', a:a.id, c, cost:tok ? 0 : cost, ...(tok ? { tok } : {}) });
    showPack(a, c, before); pushSoon();
  }
  const pushSoon = () => { if (online()) { clearTimeout(pushT); pushT = setTimeout(pushNow, 2500); } };
  function priceFor(a) { return a.kind === 'velez' && !velezDay() ? ECO.packVelez : ECO.pack; }
  const keyCard = k => { const [aid, n] = k.split(':'); const a = st.albums[aid]; return a && { a, c:(a.cards || []).find(x => String(x.n) === n) }; };

  /* ---------------- 🎨 cómo se ve una figu ---------------- */
  const cv = a => { const [c1 = '#1238b5', c2 = '#ffffff', c3 = '#000000'] = (a.colors || []).filter(x => /^#[0-9a-f]{3,8}$/i.test(x)); return `--c1:${c1};--c2:${c2};--c3:${c3}`; };
  function figHtml(a, c, { n = 0, back = false, small = false, ghost = false } = {}) {
    const r = c?.rar || 'c';
    if (ghost || !c) return `<div class="fig ghost st-${a.style || 'panini'} ${small ? 'sm' : ''}" style="${cv(a)}"><span class="fnum">${c ? c.n : '?'}</span>${c?.name ? `<small>${esc(c.name)}</small>` : ''}</div>`;
    return `<div class="fig st-${a.style || 'panini'} rar-${r} ${small ? 'sm' : ''} ${back ? 'back' : ''}" style="${cv(a)}" data-k="${esc(a.id + ':' + c.n)}">
      <div class="fin"><div class="fimg" data-img="${esc(c.img || '')}"></div>
      <div class="fband"><span class="fnum">${c.n}</span><b>${esc(c.name || '')}</b></div>
      <span class="falb">${esc(a.name)}</span>${r !== 'c' ? `<span class="frar">${r === 'l' ? '★ LEGENDARIA' : '◆ RARA'}</span>` : ''}</div>
      ${n > 1 ? `<span class="fdup">×${n}</span>` : ''}</div>`;
  }

  /* ---------------- 🖥️ pantalla ---------------- */
  let view = { tab:'inicio' }, work = null;
  const TABS = [['inicio', '🏠 Inicio'], ['albumes', '📚 Álbumes'], ['kiosco', '🏪 Kiosco'], ['repes', '🔁 Repetidas'], ['balance', '📒 Balance']];
  function header() {
    const d = derive(), hoy = Math.min(ECO.slotCap, d.day[today()] || 0), s = streakFor(today()) + (d.dailies.has(today()) ? 1 : 0);
    return `<div class="fghead"><div class="fgcoins">${coinTxt(d.coins)}</div>
      <div class="fgstat"><span>Hoy por estar: <b>${hoy}/${ECO.slotCap}</b></span><span>🔥 Racha: <b>${s} día${s === 1 ? '' : 's'}</b></span><span>🏆 <b>${d.done.size}</b> completo${d.done.size === 1 ? '' : 's'}</span></div></div>
      <div class="fgtabs">${TABS.map(([k, t]) => `<button data-tab="${k}" class="${view.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  }
  function progress(a) { const h = derive().have, tot = (a.cards || []).length || a.size || 0, got = (a.cards || []).filter(c => h[a.id + ':' + c.n]).length; return { got, tot, pct:tot ? Math.round(got / tot * 100) : 0 }; }
  function albumTile(a) {
    const p = progress(a);
    return `<button class="fgalb st-${a.style || 'panini'}" style="${cv(a)}" data-alb="${esc(a.id)}">
      <div class="fgalogo" data-img="${esc(a.logo || '')}">${a.logo ? '' : esc((a.name || '?').slice(0, 2).toUpperCase())}</div>
      <div class="fgainfo"><b>${esc(a.name)}</b><small>${KINDS[a.kind || 'canal'].split(' ')[0]} ${p.got}/${p.tot}${derive().done.has(a.id) ? ' · 🏆' : ''}</small>
      <div class="fgbar"><i style="width:${p.pct}%"></i></div></div></button>`;
  }
  function render() {
    const v = $('v-figus'); if (!v) return;
    if (tvDev()) { v.innerHTML = '<div class="empty">🃏 Figus se juega desde el celu o la compu. Acá en la tele igual vas sumando monedas.</div>'; return; }
    if (view.alb) return renderAlbum(v);
    const d = derive(), A = albums(); let body = '';
    if (view.tab === 'inicio') {
      const toks = Object.values(d.toks);
      body = `${!online() ? '<div class="fgwarn">⚠ Para que Figus se guarde y se comparta entre la compu y el celu, conectá la sincronización con GitHub en ⚙ Ajustes.</div>' : ''}
        ${toks.length ? `<h2 class="sec">🎁 Sobres para abrir</h2><div class="fgtoks">${toks.map(t => { const a = albumOfKind(t.k); return `<button class="fgtok" data-tok="${esc(t.id)}" ${a ? '' : 'disabled'}>${t.k === 'vaca' ? '🐶' : '💙'} <b>Sobre de ${t.k === 'vaca' ? 'Vaca' : 'Vélez'}</b><small>${esc(t.why || '')}${a ? '' : ` · primero creá un álbum de ${t.k === 'vaca' ? 'Vaca' : 'Vélez'} con figus`}</small></button>`; }).join('')}</div>` : ''}
        <h2 class="sec">📚 Tus álbumes</h2>
        <div class="fgalbs">${A.map(albumTile).join('')}<button class="fgalb fgnew" data-new>＋ Nuevo álbum</button></div>
        <h2 class="sec">¿Cómo se ganan monedas?</h2>
        <div class="fghow"><div>⏱️ <b>1 cada 5 min</b> en FUNVS (hasta ${ECO.slotCap} por día, una sola vez aunque esté abierto en varios aparatos)</div>
          <div>🎁 <b>Regalo del día</b>: ${ECO.daily} + racha (hasta +${ECO.streakMax * ECO.streakStep}) + lo de mientras no estabas</div>
          <div>🔮 <b>Prode</b>: ${ECO.prodeWin} por acertar el ganador, ${ECO.prodeExact} el resultado exacto, +${ECO.prodeScorer} por goleador. Vélez ×2</div>
          <div>🐶 <b>Paseo de Vaca</b>: 1 sobre de Vaca por paseo · 💙 <b>Día de Vélez</b>: 1 sobre de Vélez de regalo</div></div>`;
    } else if (view.tab === 'albumes') {
      body = `<div class="fgalbs">${A.map(albumTile).join('')}<button class="fgalb fgnew" data-new>＋ Nuevo álbum</button></div>`;
    } else if (view.tab === 'kiosco') {
      const L = A.filter(a => a.kind !== 'vaca');
      body = `<p class="mut">Cada sobre trae ${ECO.packSize} figus del álbum que elijas. Rara: 1 de cada 4 · legendaria: 1 de cada 20.</p>
        <div class="fgkiosco">${L.map(a => { const pr = priceFor(a), ok = ready(a).length; return `<div class="fgsobre st-${a.style || 'panini'}" style="${cv(a)}">
          <div class="fgsob"><span>FIGUS</span><b>${esc(a.name)}</b><small>${ECO.packSize} figuritas</small></div>
          <button class="pri" data-buy="${esc(a.id)}" ${ok && d.coins >= pr ? '' : 'disabled'}>${coinTxt(pr)}</button>
          ${a.kind === 'velez' ? `<small class="mut">${velezDay() ? '💙 Hoy juega Vélez: precio normal' : 'Fuera del día de partido: más caro'}</small>` : ''}${ok ? '' : '<small class="mut">Cargale imágenes a las figus primero</small>'}</div>`; }).join('') || '<div class="empty">Creá un álbum para que aparezcan sus sobres.</div>'}</div>
        <p class="mut">🐶 Los sobres de Vaca no se venden: salen solo paseándola.</p>`;
    } else if (view.tab === 'repes') {
      const R = Object.entries(d.have).filter(([, n]) => n > 1).map(([k, n]) => ({ k, n, x:keyCard(k) })).filter(o => o.x?.c);
      const tot = R.reduce((s, o) => s + (o.n - 1) * ECO.sell[o.x.c.rar || 'c'], 0);
      body = `${R.length ? `<div class="btns"><span class="mut">Vendiendo todas las repetidas (te quedás con una de cada): ${coinTxt(tot)}</span><span class="sp"></span><button data-sellall>Vender todas</button></div>` : ''}
        <div class="fggrid">${R.map(o => `<div class="fgcell">${figHtml(o.x.a, o.x.c, { n:o.n, small:true })}<button data-sell="${esc(o.k)}">Vender 1 · ${coinTxt(ECO.sell[o.x.c.rar || 'c'])}</button></div>`).join('') || '<div class="empty">No tenés repetidas.</div>'}</div>`;
    } else if (view.tab === 'balance') {
      const L = [...st.ev].sort((a, b) => b.t - a.t).filter(e => e.ty !== 'slot').slice(0, 40);
      const ic = e => e.ty === 'daily' ? `🎁 Regalo del día (racha ${e.s})${e.off ? ` · +${e.off} mientras no estabas` : ''}` : e.ty === 'prode' ? `🔮 Prode: ${esc(e.m || '')}` : e.ty === 'pack' ? `📦 Sobre de ${esc(st.albums[e.a]?.name || '?')}${e.tok ? ' (regalo)' : ''}` : e.ty === 'buy' ? `🛒 Compraste #${esc(e.k.split(':')[1])} de ${esc(st.albums[e.k.split(':')[0]]?.name || '?')}` : e.ty === 'sell' ? '🔁 Vendiste una repetida' : e.ty === 'tok' ? `🎁 Sobre de ${e.k === 'vaca' ? 'Vaca' : 'Vélez'}: ${esc(e.why || '')}` : e.ty === 'done' ? `🏆 Completaste ${esc(st.albums[e.a]?.name || '')}` : e.ty;
      const amt = e => e.ty === 'daily' || e.ty === 'prode' ? `+${e.n}` : e.ty === 'sell' ? `+${e.n}` : e.ty === 'pack' && !e.tok || e.ty === 'buy' ? `−${e.cost}` : '';
      body = `<div class="psstats"><div><b>${d.earned.slot}</b><small>por estar</small></div><div><b>${d.earned.daily}</b><small>regalos</small></div><div><b>${d.earned.prode}</b><small>Prode</small></div><div><b>${d.earned.sell}</b><small>ventas</small></div><div><b>${d.spent}</b><small>gastadas</small></div></div>
        <div class="tdlist">${L.map(e => `<div class="tdrow"><div><b>${ic(e)}</b><small>${new Date(e.t).toLocaleString('es-AR', { day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit' })}</small></div><b class="fgamt">${amt(e)}</b></div>`).join('') || '<div class="empty">Todavía no hay movimientos.</div>'}</div>`;
    }
    v.innerHTML = header() + body;
    bindCommon(v);
    v.querySelectorAll('[data-alb]').forEach(b => b.onclick = () => { view = { tab:view.tab, alb:b.dataset.alb }; render(); });
    v.querySelectorAll('[data-new]').forEach(b => b.onclick = newAlbum);
    v.querySelectorAll('[data-tok]').forEach(b => b.onclick = () => { const t = derive().toks[b.dataset.tok]; const a = t && albumOfKind(t.k); if (a) openPack(a, { tok:t.id }); });
    v.querySelectorAll('[data-buy]').forEach(b => b.onclick = () => { const a = st.albums[b.dataset.buy]; openPack(a, { cost:priceFor(a) }); });
    v.querySelectorAll('[data-sell]').forEach(b => b.onclick = () => { const x = keyCard(b.dataset.sell); add({ id:'x' + uid(), ty:'sell', k:b.dataset.sell, n:ECO.sell[x.c.rar || 'c'] }); pushSoon(); render(); });
    v.querySelector('[data-sellall]')?.addEventListener('click', () => { if (!confirm('¿Vender todas las repetidas? Te quedás con una de cada.')) return;
      Object.entries(derive().have).forEach(([k, n]) => { const x = keyCard(k); if (!x?.c) return; for (let i = 1; i < n; i++) st.ev.push({ id:'x' + uid() + i, t:Date.now() + i, ty:'sell', k, n:ECO.sell[x.c.rar || 'c'] }); });
      saveSt(); pushSoon(); render(); });
    hydrate(v); albums().forEach(a => ensureImgs(a.id));
  }
  function bindCommon(v) { v.querySelectorAll('[data-tab]').forEach(b => b.onclick = () => { view = { tab:b.dataset.tab }; render(); }); }

  /* ---------------- 📖 un álbum: verlo y editarlo ---------------- */
  function newAlbum() {
    const id = 'a' + uid(), n = albums().length;
    st.albums[id] = { id, name:'Nuevo álbum', kind:'canal', style:Object.keys(STYLES)[n % 5], colors:['#1238b5', '#ffffff'], size:20, story:'', pages:[{ t:'Página 1', txt:'' }], cards:[], cr:Date.now(), upd:Date.now() };
    for (let i = 1; i <= 20; i++) st.albums[id].cards.push({ n:i, name:'', page:0, rar:i % 10 === 0 ? 'l' : i % 4 === 0 ? 'r' : 'c', img:'' });
    saveSt(); schedule(); view = { tab:'albumes', alb:id, edit:true }; work = null; render();
  }
  function checkDone(a) {
    if (derive().done.has(a.id)) return; const p = progress(a);
    if (p.tot && p.got === p.tot && (a.cards || []).every(c => c.img)) { add({ id:'done-' + a.id, ty:'done', a:a.id }); celebrate(a); }
  }
  function renderAlbum(v) {
    const a = st.albums[view.alb]; if (!a) { view = { tab:'albumes' }; return render(); }
    if (view.edit) return renderEdit(v, a);
    const h = derive().have, p = progress(a), pages = a.pages?.length ? a.pages : [{ t:'', txt:'' }];
    const byPage = pages.map((pg, i) => ({ pg, cards:(a.cards || []).filter(c => (c.page || 0) === i) }));
    v.innerHTML = header() + `<div class="fgalbum st-${a.style || 'panini'}" style="${cv(a)}">
      <div class="fgcover"><div class="fgalogo big" data-img="${esc(a.logo || '')}">${a.logo ? '' : esc((a.name || '?').slice(0, 2).toUpperCase())}</div>
        <div><h2>${esc(a.name)}</h2><small>${KINDS[a.kind || 'canal']} · ${p.got}/${p.tot} (${p.pct}%)${derive().done.has(a.id) ? ' · 🏆 COMPLETO' : ''}</small>
        <div class="fgbar"><i style="width:${p.pct}%"></i></div></div>
        <div class="btns"><button data-back>← Volver</button><button data-edit>✎ Editar álbum</button></div></div>
      ${a.story ? `<div class="fgstory">${esc(a.story).replace(/\n/g, '<br>')}</div>` : ''}
      ${byPage.map(({ pg, cards }) => cards.length ? `<div class="fgpage">${pg.t ? `<h3>${esc(pg.t)}</h3>` : ''}${pg.txt ? `<p>${esc(pg.txt).replace(/\n/g, '<br>')}</p>` : ''}
        <div class="fggrid">${cards.map(c => { const n = h[a.id + ':' + c.n] || 0; return `<div class="fgcell">${n ? figHtml(a, c, { n }) : figHtml(a, c, { ghost:true })}${!n && c.img && a.kind !== 'vaca' ? `<button class="fgbuy1" data-buy1="${c.n}">Comprar · ${coinTxt(ECO.buy[c.rar || 'c'])}</button>` : ''}</div>`; }).join('')}</div></div>` : '').join('')}
      </div>`;
    bindCommon(v);
    v.querySelector('[data-back]').onclick = () => { view = { tab:view.tab || 'albumes' }; render(); };
    v.querySelector('[data-edit]').onclick = () => { view.edit = true; work = null; render(); };
    v.querySelectorAll('[data-buy1]').forEach(b => b.onclick = () => {
      const c = a.cards.find(x => String(x.n) === b.dataset.buy1), cost = ECO.buy[c.rar || 'c'];
      if (derive().coins < cost) return toast(`<b>Te faltan monedas</b><small>Necesitás ${cost}.</small>`, { cls:'info' });
      if (!confirm(`¿Comprar la #${c.n}${c.name ? ' (' + c.name + ')' : ''} por ${cost} monedas?`)) return;
      add({ id:'b' + uid(), ty:'buy', k:a.id + ':' + c.n, cost }); pushSoon(); checkDone(a); render(); });
    v.querySelectorAll('.fig[data-k]').forEach(f => f.onclick = () => zoom(f));
    hydrate(v); ensureImgs(a.id);
  }
  function zoom(f) { let o = $('fgZoom'); if (!o) { o = document.createElement('div'); o.id = 'fgZoom'; o.onclick = () => o.remove(); }
    o.innerHTML = f.outerHTML; document.body.appendChild(o); o.querySelector('.fig').classList.add('big'); hydrate(o); }

  function renderEdit(v, a) {
    if (!work) work = JSON.parse(JSON.stringify(a));
    const W = work, pages = W.pages?.length ? W.pages : (W.pages = [{ t:'Página 1', txt:'' }]);
    v.innerHTML = header() + `<div class="fgedit">
      <div class="btns"><button data-back>← Volver sin guardar</button><span class="sp"></span><span class="mut" id="fgDirty"></span><button class="pri" data-savealb>Guardar cambios</button></div>
      <div class="fgedgrid">
        <div class="box"><h3>El álbum</h3>
          <label>Nombre</label><input data-f="name" value="${esc(W.name)}">
          <label>Tipo</label><select data-f="kind">${Object.entries(KINDS).map(([k, t]) => `<option value="${k}" ${W.kind === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <label>Estilo de plantilla</label><select data-f="style">${Object.entries(STYLES).map(([k, t]) => `<option value="${k}" ${W.style === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <label>Colores del canal <small class="mut">(pegá el código hex, hasta 3: el más llamativo primero)</small></label>
          <div class="fgcolors">${[0, 1, 2].map(i => `<span><input type="color" data-ci="${i}" value="${/^#[0-9a-f]{6}$/i.test(W.colors[i] || '') ? W.colors[i] : '#000000'}"><input data-ch="${i}" value="${esc(W.colors[i] || '')}" placeholder="#RRGGBB" maxlength="9"></span>`).join('')}</div>
          <label>Logo <small class="mut">(opcional)</small></label><div class="fglogoed"><div class="fgalogo" data-img="${esc(W.logo || '')}"></div><label class="petadd"><input type="file" accept="image/*" data-logo hidden>Elegir imagen</label></div>
          <label>Cantidad de figus</label><input type="number" min="5" max="80" data-f="size" value="${W.cards.length}" style="width:90px">
          <div class="fgprev">${figHtml(W, W.cards.find(c => c.img) || { n:1, name:'Así se ve', rar:'r', img:'' })}${figHtml(W, { n:2, name:'Legendaria', rar:'l', img:W.cards.find(c => c.img && c.rar === 'l')?.img || '' })}</div>
        </div>
        <div class="box"><h3>La historia</h3><textarea data-f="story" rows="6" placeholder="Contá la historia del canal: cuándo nació, quiénes están, qué lo hace especial…">${esc(W.story || '')}</textarea>
          <h3>Páginas (programas o secciones)</h3>
          <div class="fgpages">${pages.map((p, i) => `<div class="fgpg"><input data-pt="${i}" value="${esc(p.t)}" placeholder="Nombre de la página"><textarea data-px="${i}" rows="2" placeholder="Texto de esa página (opcional)">${esc(p.txt || '')}</textarea>${pages.length > 1 ? `<button data-pdel="${i}" title="Borrar página">✕</button>` : ''}</div>`).join('')}</div>
          <button data-padd>＋ Página</button></div>
      </div>
      <h3>Las figus <small class="mut">(tocá el cuadro para subir la imagen o el gif)</small></h3>
      <div class="fgcards">${W.cards.map((c, i) => `<div class="fgced rar-${c.rar || 'c'}">
          <label class="fgcimg" data-img="${esc(c.img || '')}"><input type="file" accept="image/*" data-cimg="${i}" hidden><span>#${c.n}<br>＋ imagen</span></label>
          <input data-cn="${i}" value="${esc(c.name || '')}" placeholder="Nombre">
          <select data-cp="${i}">${pages.map((p, j) => `<option value="${j}" ${(c.page || 0) === j ? 'selected' : ''}>${esc(p.t || 'Página ' + (j + 1))}</option>`).join('')}</select>
          <select data-cr="${i}">${Object.entries(RAR).map(([k, t]) => `<option value="${k}" ${(c.rar || 'c') === k ? 'selected' : ''}>${t}</option>`).join('')}</select></div>`).join('')}</div>
      <div class="btns" style="margin-top:14px"><button data-delalb class="danger">🗑 Borrar álbum</button><span class="sp"></span><button class="pri" data-savealb>Guardar cambios</button></div></div>`;
    bindCommon(v);
    const dirty = () => { $('fgDirty').textContent = JSON.stringify(work) !== JSON.stringify(st.albums[a.id]) ? 'Hay cambios sin guardar' : ''; };
    const re = () => { renderEdit(v, a); };
    v.querySelectorAll('[data-f]').forEach(x => x.onchange = () => {
      const f = x.dataset.f;
      if (f === 'size') { const n = Math.max(5, Math.min(80, +x.value || 20)); while (W.cards.length < n) W.cards.push({ n:W.cards.length + 1, name:'', page:0, rar:'c', img:'' }); W.cards.length = n; return re(); }
      W[f] = x.value; if (f === 'style' || f === 'kind') re(); else dirty(); });
    v.querySelectorAll('[data-ch]').forEach(x => x.oninput = () => { W.colors[+x.dataset.ch] = x.value.trim(); W.colors = W.colors.map(c => c || ''); if (/^#[0-9a-f]{3,8}$/i.test(x.value.trim()) || !x.value) { const p = v.querySelector(`[data-ci="${x.dataset.ch}"]`); if (/^#[0-9a-f]{6}$/i.test(x.value)) p.value = x.value; v.querySelectorAll('.fgprev .fig').forEach(f => f.setAttribute('style', cv(W))); } dirty(); });
    v.querySelectorAll('[data-ci]').forEach(x => x.oninput = () => { W.colors[+x.dataset.ci] = x.value; v.querySelector(`[data-ch="${x.dataset.ci}"]`).value = x.value; v.querySelectorAll('.fgprev .fig').forEach(f => f.setAttribute('style', cv(W))); dirty(); });
    v.querySelectorAll('[data-pt]').forEach(x => x.oninput = () => { pages[+x.dataset.pt].t = x.value; dirty(); });
    v.querySelectorAll('[data-px]').forEach(x => x.oninput = () => { pages[+x.dataset.px].txt = x.value; dirty(); });
    v.querySelectorAll('[data-pdel]').forEach(x => x.onclick = () => { const i = +x.dataset.pdel; pages.splice(i, 1); W.cards.forEach(c => { if ((c.page || 0) === i) c.page = 0; else if (c.page > i) c.page--; }); re(); });
    v.querySelector('[data-padd]').onclick = () => { pages.push({ t:'Página ' + (pages.length + 1), txt:'' }); re(); };
    v.querySelectorAll('[data-cn]').forEach(x => x.oninput = () => { W.cards[+x.dataset.cn].name = x.value; dirty(); });
    v.querySelectorAll('[data-cp]').forEach(x => x.onchange = () => { W.cards[+x.dataset.cp].page = +x.value; dirty(); });
    v.querySelectorAll('[data-cr]').forEach(x => x.onchange = () => { W.cards[+x.dataset.cr].rar = x.value; x.closest('.fgced').className = 'fgced rar-' + x.value; dirty(); });
    const up = async (file, set) => { try { const u = await readImg(file), id = 'i' + uid() + Date.now().toString(36); await imgPut(id, u); urlCache[id] = u; set(id); re(); } catch (e) { toast(`<b>${esc(e.message)}</b>`, { cls:'info' }); } };
    v.querySelectorAll('[data-cimg]').forEach(x => x.onchange = () => x.files[0] && up(x.files[0], id => { W.cards[+x.dataset.cimg].img = id; }));
    v.querySelector('[data-logo]').onchange = e => e.target.files[0] && up(e.target.files[0], id => { W.logo = id; });
    v.querySelector('[data-back]').onclick = () => { if (JSON.stringify(work) !== JSON.stringify(st.albums[a.id]) && !confirm('¿Salir sin guardar los cambios?')) return; work = null; view.edit = false; render(); };
    v.querySelectorAll('[data-savealb]').forEach(b => b.onclick = () => { W.colors = (W.colors || []).filter(Boolean); W.upd = Date.now(); st.albums[a.id] = JSON.parse(JSON.stringify(W)); work = null; markDirty(a.id); saveSt(); pushSoon(); toast('🃏 Álbum guardado', { ms:1800 }); view.edit = false; checkDone(st.albums[a.id]); render(); });
    v.querySelector('[data-delalb]').onclick = () => { if (!confirm(`¿Borrar el álbum "${a.name}"? Las figus que tenías de ese álbum se pierden.`)) return; st.albums[a.id] = { id:a.id, del:true, upd:Date.now() }; work = null; saveSt(); pushSoon(); view = { tab:'albumes' }; render(); };
    dirty(); hydrate(v);
  }

  /* ---------------- 🎉 abrir el sobre y completar ---------------- */
  function showPack(a, cards, before) {
    let o = $('fgPack'); if (!o) { o = document.createElement('div'); o.id = 'fgPack'; document.body.appendChild(o); }
    const seen = { ...before };
    o.innerHTML = `<div class="fgpk st-${a.style || 'panini'}" style="${cv(a)}">
      <div class="fgsob big" data-tear><span>FIGUS</span><b>${esc(a.name)}</b><small>Tocá para abrir</small></div>
      <div class="fgpkrow" hidden>${cards.map((k, i) => { const x = keyCard(k); const nueva = !seen[k]; seen[k] = (seen[k] || 0) + 1;
        return `<div class="fgflip" data-i="${i}"><div class="fgfront">${figHtml(x.a, x.c)}<span class="fgtag ${nueva ? 'new' : ''}">${nueva ? '¡NUEVA!' : 'Repetida'}</span></div><div class="fgbackc"><span>FIGUS</span></div></div>`; }).join('')}</div>
      <div class="btns" hidden><button data-all>Ver todas</button><span class="sp"></span><button class="pri" data-close>Listo</button></div></div>`;
    o.classList.add('on');
    const row = o.querySelector('.fgpkrow'), bt = o.querySelector('.btns');
    o.querySelector('[data-tear]').onclick = e => { const t = e.currentTarget; t.classList.add('torn'); setTimeout(() => { t.remove(); row.hidden = false; bt.hidden = false; hydrate(o); }, 450); };
    o.addEventListener('click', e => { const f = e.target.closest('.fgflip'); if (f && !f.classList.contains('up')) { f.classList.add('up'); if (f.querySelector('.rar-l')) f.classList.add('legend'); } });
    o.querySelector('[data-all]').onclick = () => o.querySelectorAll('.fgflip').forEach(f => { f.classList.add('up'); if (f.querySelector('.rar-l')) f.classList.add('legend'); });
    o.querySelector('[data-close]').onclick = () => { o.classList.remove('on'); o.innerHTML = ''; checkDone(a); if (Nav.current === 'figus') render(); };
  }
  function celebrate(a) {
    let o = $('fgDone'); if (!o) { o = document.createElement('div'); o.id = 'fgDone'; document.body.appendChild(o); }
    o.innerHTML = `<div class="fgdn" style="${cv(a)}"><div class="fgtro">🏆</div><h2>¡Completaste ${esc(a.name)}!</h2><p>Tu álbum número ${derive().done.size}.</p><button class="pri">¡Vamos!</button></div>`;
    o.classList.add('on'); o.querySelector('button').onclick = () => o.classList.remove('on');
  }

  /* ---------------- arranque ---------------- */
  function init() {
    if (!st.since) { st.since = Date.now(); saveSt(); }
    setInterval(slotTick, 60e3); setTimeout(slotTick, 5000);
    setInterval(() => { try { prode(); } catch {} velezTok(); }, 10 * 60e3);
    setTimeout(async () => {
      await pull();
      try { prode(); } catch {} velezTok();
      if (!tvDev()) { const g = daily(); if (g) { pushSoon(); toast(`<b>🎁 Regalo del día: +${g.n} monedas</b><small>Racha de ${g.s} día${g.s === 1 ? '' : 's'}${g.off ? ` · +${g.off} de mientras no estabas` : ''}. Están en 🃏 Figus.</small>`, { cls:'info', ms:6000, onclick:() => Nav.go('figus') }); } }
    }, 6000);
    setInterval(pull, tvDev() ? 30 * 60e3 : 5 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { if (pushT) pushNow(); } else pull(); });
  }
  return { init, render, paseo, ECO, get coins() { return derive().coins; } };
})();
