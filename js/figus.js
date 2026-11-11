/* =========================================================
   🃏 FIGUS — tu idle game de figuritas (solo para vos, sin plata de verdad). Celu y compu; la tele solo suma vaccoins (las monedas de FUNVS).
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
  const ROLES = { '':'Figu común', conductor:'🎙️ Conducción', panel:'💬 Panelista', invitado:'⭐ Invitado' };
  const AREAS = { '':'—', deportes:'⚽ Deportes', politica:'🏛️ Política', espectaculos:'🎬 Espectáculos', humor:'😂 Humor', economia:'💼 Economía', policiales:'🚨 Policiales', musica:'🎸 Música', tecnologia:'💻 Tecnología', otra:'📌 Otra' };
  const tvDev = () => Device.mode === 'tv';
  const ymdOf = t => { const d = new Date(t); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; };
  const today = () => ymdOf(Date.now());
  // 🐮 la moneda: los vaccoins (una moneda dorada con la V de Vaca, hecha con CSS para que se vea en todos lados)
  const VC = '<i class="vc" aria-label="vaccoins">V</i>';
  const coinTxt = n => `${VC} ${Math.round(n).toLocaleString('es-AR')}`;

  /* ---------------- 🏎️ GARAGE: F1 y MotoGP 2026 a escala ----------------
     Grilla oficial de la temporada 2026 (lista de inscriptos). Cada modelo tiene 10 piezas; las cajas
     (2 piezas del piloto que elijas, sin repetir hasta completarlo) solo se venden los fines de semana de carrera. */
  const GARAGE = {
    f1:{ n:'Fórmula 1', ic:'🏎️', price:35, teams:[
      ['McLaren', '#FF8000', '#111111', '#47C7FC', [[1, 'Lando Norris'], [81, 'Oscar Piastri']]],
      ['Mercedes', '#C8CCCE', '#0A0A0A', '#00D2BE', [[63, 'George Russell'], [12, 'Kimi Antonelli']]],
      ['Red Bull', '#1E2A5A', '#E10600', '#FFC906', [[3, 'Max Verstappen'], [6, 'Isack Hadjar']]],
      ['Ferrari', '#DC0000', '#FFFFFF', '#111111', [[16, 'Charles Leclerc'], [44, 'Lewis Hamilton']]],
      ['Williams', '#005AFF', '#0A1A3C', '#FFFFFF', [[23, 'Alexander Albon'], [55, 'Carlos Sainz']]],
      ['Racing Bulls', '#F5F5F5', '#2B4BFF', '#E10600', [[30, 'Liam Lawson'], [41, 'Arvid Lindblad']]],
      ['Aston Martin', '#006F62', '#CEDC00', '#0A0A0A', [[14, 'Fernando Alonso'], [18, 'Lance Stroll']]],
      ['Haas', '#F0F0F0', '#1A1A1A', '#E10600', [[31, 'Esteban Ocon'], [87, 'Oliver Bearman']]],
      ['Audi', '#B6BABD', '#1A1A1A', '#E4002B', [[27, 'Nico Hülkenberg'], [5, 'Gabriel Bortoleto']]],
      ['Alpine', '#0090FF', '#FF87BC', '#0A1A3C', [[10, 'Pierre Gasly'], [43, 'Franco Colapinto']]],
      ['Cadillac', '#111111', '#F5F5F5', '#C9A227', [[11, 'Sergio Pérez'], [77, 'Valtteri Bottas']]]],
      parts:[['chasis', 'Monocasco'], ['motor', 'Unidad de potencia'], ['pontones', 'Pontones'], ['alerond', 'Alerón delantero'], ['alerona', 'Alerón trasero'], ['halo', 'Halo'], ['ruedad', 'Rueda delantera'], ['ruedat', 'Rueda trasera'], ['volante', 'Volante'], ['casco', 'Casco']] },
    motogp:{ n:'MotoGP', ic:'🏍️', price:35, teams:[
      ['Ducati Lenovo', '#CC0000', '#FFFFFF', '#111111', [[93, 'Marc Márquez'], [63, 'Francesco Bagnaia']]],
      ['Aprilia Racing', '#1A1A1A', '#A6192E', '#7A3FA0', [[89, 'Jorge Martín'], [72, 'Marco Bezzecchi']]],
      ['Gresini', '#7EC8E3', '#E2001A', '#0A1A3C', [[73, 'Álex Márquez'], [54, 'Fermín Aldeguer']]],
      ['VR46', '#FFED00', '#111111', '#00A651', [[49, 'Fabio Di Giannantonio'], [21, 'Franco Morbidelli']]],
      ['KTM Factory', '#FF6600', '#0A1E3C', '#FFFFFF', [[37, 'Pedro Acosta'], [33, 'Brad Binder']]],
      ['KTM Tech3', '#FF6600', '#1C2B4A', '#E10600', [[12, 'Maverick Viñales'], [23, 'Enea Bastianini']]],
      ['Trackhouse', '#1C3F94', '#FFFFFF', '#E10600', [[25, 'Raúl Fernández'], [79, 'Ai Ogura']]],
      ['Yamaha', '#0033A0', '#111111', '#FFFFFF', [[20, 'Fabio Quartararo'], [42, 'Álex Rins']]],
      ['Pramac Yamaha', '#6A1B9A', '#00B5E2', '#FFFFFF', [[43, 'Jack Miller'], [7, 'Toprak Razgatlıoğlu']]],
      ['Honda HRC', '#C8102E', '#FFFFFF', '#0A0A0A', [[36, 'Joan Mir'], [10, 'Luca Marini']]],
      ['LCR Honda', '#F5F5F5', '#C8102E', '#00843D', [[5, 'Johann Zarco'], [11, 'Diogo Moreira']]]],
      parts:[['chasis', 'Chasis'], ['motor', 'Motor'], ['carenado', 'Carenado'], ['tanque', 'Tanque y colín'], ['escape', 'Escape'], ['horquilla', 'Horquilla'], ['alerones', 'Alerones'], ['ruedad', 'Rueda delantera'], ['ruedat', 'Rueda trasera'], ['casco', 'Casco']] } };
  const models = s => GARAGE[s].teams.flatMap(([team, c1, c2, c3, ds]) => ds.map(([num, name]) => ({ s, team, c1, c2, c3, num, name, key:s + ':' + num })));
  const modelOf = key => { const [s] = key.split(':'); return models(s).find(m => m.key === key); };

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
    const gar = JSON.parse(JSON.stringify(B.gar || {})), wins = JSON.parse(JSON.stringify(B.wins || {}));
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
      else if (e.ty === 'part') { if (coins < e.cost) continue; coins -= e.cost; spent += e.cost; const g = gar[e.m] = gar[e.m] || []; (e.p || []).forEach(x => { if (!g.includes(x)) g.push(x); }); }
      else if (e.ty === 'win') (wins[e.m] = wins[e.m] || []).push(e.gp);
    }
    return D = { coins, have, toks, day, dailies, done, lastSlot, earned, spent, gar, wins };
  }
  // cuando el registro crece mucho, lo viejo (más de 60 días) se resume en una "base" (igual en todos los aparatos)
  function compact() {
    if (st.ev.length < 4000) return;
    const cut = Date.now() - 60 * 864e5, old = st.ev.filter(e => e.t <= cut); if (!old.length) return;
    const keep = st.ev.filter(e => e.t > cut); st.ev = old; D = null; const d = derive();
    st.base = { upTo:cut, coins:d.coins, have:d.have, toks:d.toks, dailies:[...d.dailies], done:[...d.done], lastSlot:d.lastSlot, gar:d.gar, wins:d.wins };
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
  const imgIds = a => [a.logo, ...(a.cards || []).map(c => c.img), ...(a.pages || []).map(p => p.bg)].filter(Boolean);
  async function imgsOf(aid) {   // todas las imágenes de un álbum (para subirlas)
    const a = st.albums[aid]; if (!a) return {}; const o = {};
    for (const id of imgIds(a)) { const v = await imgGet(id); if (v) o[id] = v; }
    return o;
  }
  const fetched = new Set();
  async function ensureImgs(aid) {   // si faltan en este aparato, las bajo del Gist
    const a = st.albums[aid]; if (!a || fetched.has(aid) || !online()) return;
    const ids = imgIds(a); let miss = false;
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
  function readImg(file, max = 360) {
    return new Promise((ok, no) => {
      const fr = new FileReader();
      fr.onload = () => {
        const u = fr.result;
        if (/^data:image\/gif/.test(u)) return file.size <= 700e3 ? ok(u) : no(new Error('Ese gif pesa mucho (más de 700 KB). Probá uno más corto o más chico.'));
        const im = new Image(); im.onload = () => { const z = max, k = Math.min(1, z / Math.max(im.width, im.height)), c = document.createElement('canvas'); c.width = Math.round(im.width * k); c.height = Math.round(im.height * k);
          c.getContext('2d').drawImage(im, 0, 0, c.width, c.height); let out = c.toDataURL('image/webp', .82); if (!/^data:image\/webp/.test(out)) out = c.toDataURL('image/jpeg', .85); ok(out); };
        im.onerror = () => no(new Error('No pude leer esa imagen.')); im.src = u;
      };
      fr.onerror = () => no(new Error('No pude leer el archivo.')); fr.readAsDataURL(file);
    });
  }

  /* ---------------- 🪙 cómo se ganan ---------------- */
  let lastInput = Date.now();
  ['pointerdown', 'keydown', 'wheel', 'touchstart'].forEach(ev => addEventListener(ev, () => lastInput = Date.now(), { passive:true, capture:true }));
  // ¿está sonando algo de verdad? (video, solo audio, radio o música; no cuenta si está en pausa)
  const sonando = () => { try { const id = AudioMgr.active; if (!id) return false; const k = AudioMgr.sink(id); return !!k && !(k.paused && k.paused()); } catch { return false; } };
  const slotAt = n => add({ id:'s' + n, ty:'slot', t:n * ECO.slotMs + 1000 });
  function slotTick() {   // un "turno" de 5 min compartido entre aparatos (mismo id en todos → cuenta una vez)
    const playing = sonando();
    if (document.hidden && !playing) return;   // de fondo cuenta solo si está sonando (solo audio, radio, ventanita)
    const active = tvDev() ? playing : (playing || Date.now() - lastInput < 10 * 60e3);
    if (!active) return;
    slotAt(Math.floor(Date.now() / ECO.slotMs));
  }
  // 🎧 de fondo (pantalla apagada, ventanita, otra app): el celu frena FUNVS, así que anoto desde cuándo sonaba
  // y al volver, si sigue sonando, sumo esos turnos de una (máx. 4 h por vez; el tope de 60 por día sigue igual)
  function bgHide() { if (sonando()) S.set('figBg', Date.now()); else S.set('figBg', 0); }
  function bgShow() {
    const from = S.get('figBg', 0); S.set('figBg', 0); if (!from || !sonando()) return;
    const a = Math.floor(Math.max(from, Date.now() - 4 * 3600e3) / ECO.slotMs), b = Math.floor(Date.now() / ECO.slotMs);
    let n = 0; for (let k = a; k <= b; k++) if (slotAt(k)) n++;
    if (n >= 3 && !tvDev()) toast(`<b>🎧 +${n} turnos mientras sonaba de fondo</b><small>Se sumaron a tus vaccoins (con el tope del día).</small>`, { cls:'info', ms:4000 });
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
    if (n && !tvDev()) toast(`<b>${VC} +${n} vaccoins del Prode</b><small>Se sumaron a Figus.</small>`, { cls:'info', ms:4000, onclick:() => Nav.go('figus') });
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
    if (!tok && derive().coins < cost) return toast(`<b>Te faltan vaccoins</b><small>Necesitás ${cost} y tenés ${derive().coins}.</small>`, { cls:'info' });
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
  const TABS = [['inicio', '🏠 Inicio'], ['albumes', '📚 Álbumes'], ['garage', '🏎️ Garage'], ['kiosco', '🏪 Kiosco'], ['repes', '🔁 Repetidas'], ['balance', '📒 Balance']];
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
    if (tvDev()) { v.innerHTML = '<div class="empty">🃏 Figus se juega desde el celu o la compu. Acá en la tele igual vas sumando vaccoins.</div>'; return; }
    if (view.alb) return renderAlbum(v);
    const d = derive(), A = albums(); let body = '';
    if (view.tab === 'inicio') {
      const toks = Object.values(d.toks);
      body = `${!online() ? '<div class="fgwarn">⚠ Para que Figus se guarde y se comparta entre la compu y el celu, conectá la sincronización con GitHub en ⚙ Ajustes.</div>' : ''}
        ${toks.length ? `<h2 class="sec">🎁 Sobres para abrir</h2><div class="fgtoks">${toks.map(t => { const a = albumOfKind(t.k); return `<button class="fgtok" data-tok="${esc(t.id)}" ${a ? '' : 'disabled'}>${t.k === 'vaca' ? '🐶' : '💙'} <b>Sobre de ${t.k === 'vaca' ? 'Vaca' : 'Vélez'}</b><small>${esc(t.why || '')}${a ? '' : ` · primero creá un álbum de ${t.k === 'vaca' ? 'Vaca' : 'Vélez'} con figus`}</small></button>`; }).join('')}</div>` : ''}
        <h2 class="sec">📚 Tus álbumes</h2>
        <div class="fgalbs">${A.map(albumTile).join('')}<button class="fgalb fgnew" data-new>＋ Nuevo álbum</button></div>
        <h2 class="sec">¿Cómo se ganan vaccoins?</h2>
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
    } else if (view.tab === 'garage') {
      body = garageHtml();
    } else if (view.tab === 'balance') {
      const L = [...st.ev].sort((a, b) => b.t - a.t).filter(e => e.ty !== 'slot').slice(0, 40);
      const ic = e => e.ty === 'part' ? `🔧 Piezas para el ${esc(modelOf(e.m)?.name || '')} (${(e.p || []).length})` : e.ty === 'win' ? `🏆 ${esc(modelOf(e.m)?.name || '')} ganó ${esc(e.gp)}` : e.ty === 'daily' ? `🎁 Regalo del día (racha ${e.s})${e.off ? ` · +${e.off} mientras no estabas` : ''}` : e.ty === 'prode' ? `🔮 Prode: ${esc(e.m || '')}` : e.ty === 'pack' ? `📦 Sobre de ${esc(st.albums[e.a]?.name || '?')}${e.tok ? ' (regalo)' : ''}` : e.ty === 'buy' ? `🛒 Compraste #${esc(e.k.split(':')[1])} de ${esc(st.albums[e.k.split(':')[0]]?.name || '?')}` : e.ty === 'sell' ? '🔁 Vendiste una repetida' : e.ty === 'tok' ? `🎁 Sobre de ${e.k === 'vaca' ? 'Vaca' : 'Vélez'}: ${esc(e.why || '')}` : e.ty === 'done' ? `🏆 Completaste ${esc(st.albums[e.a]?.name || '')}` : e.ty;
      const amt = e => e.ty === 'daily' || e.ty === 'prode' ? `+${e.n}` : e.ty === 'sell' ? `+${e.n}` : e.ty === 'pack' && !e.tok || e.ty === 'buy' || e.ty === 'part' ? `−${e.cost}` : '';
      body = `<div class="psstats"><div><b>${d.earned.slot}</b><small>por estar</small></div><div><b>${d.earned.daily}</b><small>regalos</small></div><div><b>${d.earned.prode}</b><small>Prode</small></div><div><b>${d.earned.sell}</b><small>ventas</small></div><div><b>${d.spent}</b><small>gastadas</small></div></div>
        <div class="tdlist">${L.map(e => `<div class="tdrow"><div><b>${ic(e)}</b><small>${new Date(e.t).toLocaleString('es-AR', { day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit' })}</small></div><b class="fgamt">${amt(e)}</b></div>`).join('') || '<div class="empty">Todavía no hay movimientos.</div>'}</div>`;
    }
    v.innerHTML = header() + body;
    bindCommon(v);
    v.querySelectorAll('[data-alb]').forEach(b => b.onclick = () => { view = { tab:view.tab, alb:b.dataset.alb }; render(); });
    v.querySelectorAll('[data-new]').forEach(b => b.onclick = newAlbum);
    v.querySelectorAll('[data-gs]').forEach(b => b.onclick = () => { view.gs = b.dataset.gs; render(); });
    v.querySelectorAll('[data-gbox]').forEach(b => b.onclick = () => buyBox(b.dataset.gbox));
    v.querySelectorAll('[data-gmod]').forEach(b => b.onclick = () => modelZoom(b.dataset.gmod));
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
      ${byPage.map(({ pg, cards }) => cards.length ? pageHtml(a, pg, cards, h) : '').join('')}
      </div>`;
    bindCommon(v);
    v.querySelector('[data-back]').onclick = () => { view = { tab:view.tab || 'albumes' }; render(); };
    v.querySelector('[data-edit]').onclick = () => { view.edit = true; work = null; render(); };
    v.querySelectorAll('[data-buy1]').forEach(b => b.onclick = () => {
      const c = a.cards.find(x => String(x.n) === b.dataset.buy1), cost = ECO.buy[c.rar || 'c'];
      if (derive().coins < cost) return toast(`<b>Te faltan vaccoins</b><small>Necesitás ${cost}.</small>`, { cls:'info' });
      if (!confirm(`¿Comprar la #${c.n}${c.name ? ' (' + c.name + ')' : ''} por ${cost} vaccoins?`)) return;
      add({ id:'b' + uid(), ty:'buy', k:a.id + ':' + c.n, cost }); pushSoon(); checkDone(a); render(); });
    v.querySelectorAll('.fig[data-k]').forEach(f => f.onclick = () => zoom(f));
    hydrate(v); ensureImgs(a.id);
  }
  // 📖 una página: grilla común, o "mesa" (doble página con la escenografía del programa: conducción al centro, panelistas a los costados)
  function pageHtml(a, pg, cards, h) {
    const cell = c => { const n = h[a.id + ':' + c.n] || 0; return `<div class="fgcell ${c.role ? 'r-' + c.role : ''}">${n ? figHtml(a, c, { n }) : figHtml(a, c, { ghost:true })}${!n && c.img && a.kind !== 'vaca' ? `<button class="fgbuy1" data-buy1="${c.n}">Comprar · ${coinTxt(ECO.buy[c.rar || 'c'])}</button>` : ''}</div>`; };
    const head = `${pg.t ? `<h3>${esc(pg.t)}</h3>` : ''}${pg.txt ? `<p>${esc(pg.txt).replace(/\n/g, '<br>')}</p>` : ''}`;
    if (pg.lay !== 'mesa') return `<div class="fgpage">${head}<div class="fggrid">${cards.map(cell).join('')}</div></div>`;
    const cond = cards.filter(c => c.role === 'conductor'), resto = cards.filter(c => c.role !== 'conductor');
    const izq = resto.filter((_, i) => i % 2 === 0), der = resto.filter((_, i) => i % 2 === 1);
    return `<div class="fgpage fgmesa" style="${pg.col ? `--pc:${esc(pg.col)};` : ''}">
      <div class="fgspread"><div class="fgbg" data-img="${esc(pg.bg || '')}"></div>
        <div class="fgmesahead">${head}</div>
        <div class="fgdesk"><div class="fgside">${izq.map(cell).join('')}</div><div class="fgcenter">${cond.map(cell).join('') || ''}</div><div class="fgside">${der.map(cell).join('')}</div></div>
        <div class="fgtable"></div></div></div>`;
  }
  // 🪪 la ficha del personaje (al tocar una figu pegada)
  function fichaHtml(a, c) {
    const f = c.ficha || {}, b = Math.max(0, Math.min(5, +f.bardo || 0));
    const rows = [f.area ? `<span class="fchip">${AREAS[f.area] || esc(f.area)}</span>` : '', c.role ? `<span class="fchip">${ROLES[c.role]}</span>` : ''].join('');
    return `<div class="fgficha" style="${cv(a)}"><h3>${esc(c.name || 'Figu #' + c.n)}</h3><div>${rows}</div>
      ${f.horario ? `<p>🕒 <b>Horario:</b> ${esc(f.horario)}</p>` : ''}
      ${f.mule ? `<p class="fmule">“${esc(f.mule)}”</p>` : ''}
      ${b ? `<p>🔥 <b>Nivel de bardo:</b> <span class="fbardo">${'🔥'.repeat(b)}${'·'.repeat(5 - b)}</span></p>` : ''}
      ${f.extra ? `<p>${esc(f.extra).replace(/\n/g, '<br>')}</p>` : ''}
      ${!f.horario && !f.mule && !b && !f.extra && !f.area ? '<p class="mut">Todavía no le cargaste la ficha (✎ Editar álbum → 📝 Ficha).</p>' : ''}
      <small class="mut">#${c.n} · ${esc(a.name)} · ${RAR[c.rar || 'c']}</small></div>`;
  }
  function zoom(f) { let o = $('fgZoom'); if (!o) { o = document.createElement('div'); o.id = 'fgZoom'; o.onclick = () => o.remove(); }
    const x = keyCard(f.dataset.k || '');
    o.innerHTML = `<div class="fgzwrap">${f.outerHTML}${x?.c ? fichaHtml(x.a, x.c) : ''}</div>`; document.body.appendChild(o); o.querySelector('.fig').classList.add('big'); hydrate(o); }

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
          <div class="fgpages">${pages.map((p, i) => `<div class="fgpg"><input data-pt="${i}" value="${esc(p.t)}" placeholder="Nombre de la página (ej: el programa)"><textarea data-px="${i}" rows="2" placeholder="Texto de esa página (opcional)">${esc(p.txt || '')}</textarea>
            <div class="fgpgopt"><select data-pl="${i}"><option value="">▦ Grilla</option><option value="mesa" ${p.lay === 'mesa' ? 'selected' : ''}>🎙️ Mesa del programa (doble página)</option></select>
              ${p.lay === 'mesa' ? `<label class="petadd fgbgup" data-img="${esc(p.bg || '')}"><input type="file" accept="image/*" data-pbg="${i}" hidden>🖼️ Escenografía</label><input type="color" data-pc="${i}" value="${/^#[0-9a-f]{6}$/i.test(p.col || '') ? p.col : '#1238b5'}" title="Color de la mesa">` : ''}</div>
            ${pages.length > 1 ? `<button data-pdel="${i}" title="Borrar página">✕</button>` : ''}</div>`).join('')}</div>
          <button data-padd>＋ Página</button></div>
      </div>
      <h3>Las figus <small class="mut">(tocá el cuadro para subir la imagen o el gif)</small></h3>
      <div class="fgcards">${W.cards.map((c, i) => `<div class="fgced rar-${c.rar || 'c'}">
          <label class="fgcimg" data-img="${esc(c.img || '')}"><input type="file" accept="image/*" data-cimg="${i}" hidden><span>#${c.n}<br>＋ imagen</span></label>
          <input data-cn="${i}" value="${esc(c.name || '')}" placeholder="Nombre">
          <select data-cp="${i}">${pages.map((p, j) => `<option value="${j}" ${(c.page || 0) === j ? 'selected' : ''}>${esc(p.t || 'Página ' + (j + 1))}</option>`).join('')}</select>
          <select data-cr="${i}">${Object.entries(RAR).map(([k, t]) => `<option value="${k}" ${(c.rar || 'c') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <select data-crol="${i}">${Object.entries(ROLES).map(([k, t]) => `<option value="${k}" ${(c.role || '') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <details class="fgfed"><summary>📝 Ficha</summary>
            <select data-ff="${i}|area">${Object.entries(AREAS).map(([k, t]) => `<option value="${k}" ${(c.ficha?.area || '') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
            <input data-ff="${i}|horario" value="${esc(c.ficha?.horario || '')}" placeholder="Horario (ej: lun a vie 20 h)">
            <input data-ff="${i}|mule" value="${esc(c.ficha?.mule || '')}" placeholder="Muletilla o frase célebre">
            <label class="mut" style="font-size:12px">🔥 Nivel de bardo: <input type="range" min="0" max="5" data-ff="${i}|bardo" value="${+c.ficha?.bardo || 0}"></label>
            <textarea data-ff="${i}|extra" rows="2" placeholder="Algo más (opcional)">${esc(c.ficha?.extra || '')}</textarea></details></div>`).join('')}</div>
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
    v.querySelectorAll('[data-crol]').forEach(x => x.onchange = () => { W.cards[+x.dataset.crol].role = x.value; dirty(); });
    v.querySelectorAll('[data-ff]').forEach(x => x.oninput = x.onchange = () => { const [i, k] = x.dataset.ff.split('|'); const c = W.cards[+i]; c.ficha = c.ficha || {}; c.ficha[k] = k === 'bardo' ? +x.value : x.value; dirty(); });
    v.querySelectorAll('[data-pl]').forEach(x => x.onchange = () => { pages[+x.dataset.pl].lay = x.value; re(); });
    v.querySelectorAll('[data-pc]').forEach(x => x.oninput = () => { pages[+x.dataset.pc].col = x.value; dirty(); });
    v.querySelectorAll('[data-pbg]').forEach(x => x.onchange = () => x.files[0] && up(x.files[0], id => { pages[+x.dataset.pbg].bg = id; }, 1280));
    v.querySelectorAll('[data-cp]').forEach(x => x.onchange = () => { W.cards[+x.dataset.cp].page = +x.value; dirty(); });
    v.querySelectorAll('[data-cr]').forEach(x => x.onchange = () => { W.cards[+x.dataset.cr].rar = x.value; x.closest('.fgced').className = 'fgced rar-' + x.value; dirty(); });
    const up = async (file, set, max) => { try { const u = await readImg(file, max), id = 'i' + uid() + Date.now().toString(36); await imgPut(id, u); urlCache[id] = u; set(id); re(); } catch (e) { toast(`<b>${esc(e.message)}</b>`, { cls:'info' }); } };
    v.querySelectorAll('[data-cimg]').forEach(x => x.onchange = () => x.files[0] && up(x.files[0], id => { W.cards[+x.dataset.cimg].img = id; }));
    v.querySelector('[data-logo]').onchange = e => e.target.files[0] && up(e.target.files[0], id => { W.logo = id; });
    v.querySelector('[data-back]').onclick = () => { if (JSON.stringify(work) !== JSON.stringify(st.albums[a.id]) && !confirm('¿Salir sin guardar los cambios?')) return; work = null; view.edit = false; render(); };
    v.querySelectorAll('[data-savealb]').forEach(b => b.onclick = () => { W.colors = (W.colors || []).filter(Boolean); W.upd = Date.now(); st.albums[a.id] = JSON.parse(JSON.stringify(W)); work = null; markDirty(a.id); saveSt(); pushSoon(); toast('🃏 Álbum guardado', { ms:1800 }); view.edit = false; checkDone(st.albums[a.id]); render(); });
    v.querySelector('[data-delalb]').onclick = () => { if (!confirm(`¿Borrar el álbum "${a.name}"? Las figus que tenías de ese álbum se pierden.`)) return; st.albums[a.id] = { id:a.id, del:true, upd:Date.now() }; work = null; saveSt(); pushSoon(); view = { tab:'albumes' }; render(); };
    dirty(); hydrate(v);
  }

  /* ---------------- 🏎️ el Garage: dibujo 2D (SVG, liviano), cajas y vitrina ---------------- */
  // cada pieza es una parte del dibujo: si la tenés va pintada con los colores del equipo; si no, solo el contorno
  function carSvg(m, got) {
    const has = id => got.includes(id), P = (id, d, fill, extra = '') => has(id) ? `<path d="${d}" fill="${fill}" ${extra}/>` : `<path d="${d}" fill="none" stroke="#ffffff38" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    const W = (id, cx, cy, r) => has(id) ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#121212"/><circle cx="${cx}" cy="${cy}" r="${r * .55}" fill="${m.c3}"/><circle cx="${cx}" cy="${cy}" r="${r * .2}" fill="#bbb"/>` : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ffffff38" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    if (m.s === 'f1') return `<svg viewBox="0 0 400 124" class="gsvg">
      ${P('alerona', 'M328 26 L388 22 L390 38 L330 42 Z', m.c3)}${P('alerona', 'M352 40 L361 40 L350 68 L341 68 Z', m.c1)}
      ${P('chasis', 'M36 88 L60 79 L150 71 L190 59 L252 57 L302 61 L348 67 L352 86 L60 96 Z', m.c1)}
      ${P('pontones', 'M174 73 L232 65 L302 67 L306 84 L180 88 Z', m.c2)}
      ${P('motor', 'M214 57 L234 33 L256 33 L302 59 L250 59 Z', m.c3)}
      ${P('halo', 'M168 58 Q195 38 228 52 L224 55 Q196 44 172 60 Z', '#2a2a2a')}
      ${P('volante', 'M181 55 L193 55 L193 61 L181 61 Z', '#3a3a3a')}
      ${P('casco', 'M196 52 a11 11 0 1 1 22 0 L218 58 L196 58 Z', m.c2, `stroke="${m.c3}" stroke-width="2"`)}${has('casco') ? '<path d="M206 50 L218 50 L218 54 L206 54 Z" fill="#0b0b0b"/>' : ''}
      ${P('alerond', 'M6 94 L72 94 L68 102 L2 102 Z', m.c3)}${P('alerond', 'M8 82 L15 82 L13 102 L6 102 Z', m.c2)}
      ${W('ruedad', 96, 92, 22)}${W('ruedat', 318, 90, 25)}
      ${has('chasis') ? `<text x="130" y="88" fill="${m.c2}" font-size="15" font-weight="900" font-family="Oswald, system-ui, sans-serif" font-style="italic">${m.num}</text>` : ''}</svg>`;
    // 🏍️ moto de perfil (de frente a la izquierda): ruedas, basculante y chasis, motor, escape, horquilla, carenado con burbuja, tanque y colín, alerones y el casco apoyado en el asiento
    return `<svg viewBox="0 0 300 210" class="gsvg">
      ${W('ruedad', 70, 160, 34)}${W('ruedat', 232, 160, 36)}
      ${P('chasis', 'M150 72 L198 74 L234 156 L222 162 L186 98 L150 98 Z', '#6b6f78')}
      ${P('motor', 'M130 96 L178 96 L188 130 L140 136 Z', '#34363c')}
      ${P('escape', 'M188 106 L246 82 L252 92 L194 116 Z', '#b3b6bb')}
      ${has('horquilla') ? '<path d="M70 160 L102 78" stroke="#d7d9dd" stroke-width="8" stroke-linecap="round"/><path d="M70 160 L102 78" stroke="#ffd34d" stroke-width="3" stroke-linecap="round" opacity=".7"/>' : '<path d="M70 160 L102 78" stroke="#ffffff38" stroke-width="1.5" stroke-dasharray="4 3"/>'}
      ${P('carenado', 'M94 70 C102 52 126 44 150 48 L180 56 L192 92 L178 120 L120 124 C104 118 92 106 90 92 Z', m.c1)}
      ${has('carenado') ? '<path d="M104 64 C112 50 130 46 146 48 L140 57 C126 55 114 59 108 68 Z" fill="#bcd3e6" opacity=".55"/>' : ''}
      ${P('tanque', 'M150 50 C170 42 192 44 208 54 L252 62 L256 74 L210 78 L186 70 Z', m.c2)}
      ${P('alerones', 'M100 80 L78 74 L80 86 L102 92 Z', m.c3)}
      ${P('casco', 'M206 44 a15 15 0 1 1 30 0 L236 52 L206 52 Z', m.c2, `stroke="${m.c3}" stroke-width="2"`)}${has('casco') ? '<path d="M216 40 L236 40 L236 46 L216 46 Z" fill="#0b0b0b"/>' : ''}
      ${has('carenado') ? `<text x="120" y="102" fill="${m.c2}" font-size="22" font-weight="900" font-family="Oswald, system-ui, sans-serif" font-style="italic">${m.num}</text>` : ''}</svg>`;
  }
  const weekend = s => { try { return Motor.weekend(s); } catch { return { open:false }; } };
  const dt = t => new Date(t).toLocaleString('es-AR', { weekday:'short', day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit' });
  function garageHtml() {
    const s = view.gs || 'f1', G = GARAGE[s], d = derive(), w = weekend(s);
    const all = models(s), done = all.filter(m => (d.gar[m.key] || []).length >= 10).length;
    return `<div class="fgtabs">${Object.entries(GARAGE).map(([k, g]) => `<button data-gs="${k}" class="${k === s ? 'on' : ''}">${g.ic} ${g.n}</button>`).join('')}</div>
      <div class="gwk ${w.open ? 'on' : ''}">${w.open ? `🟢 <b>Fin de semana de carrera: ${esc(w.name)}</b> · cajas abiertas hasta el ${dt(w.to)}` : w.from ? `🔴 Cajas cerradas · abren el ${dt(w.from)} para el <b>${esc(w.name)}</b>` : '🔴 Cajas cerradas hasta el próximo fin de semana de carrera'}</div>
      <p class="mut">Temporada 2026 · escala 1:43 · ${done}/${all.length} modelos completos. Cada caja trae 2 piezas del piloto que elijas (sin repetir) por ${G.price} vaccoins.</p>
      ${G.teams.map(([team, c1, c2]) => `<div class="gteam" style="--t1:${c1};--t2:${c2}"><h3>${esc(team)}</h3><div class="gmods">${all.filter(m => m.team === team).map(m => { const got = d.gar[m.key] || [], full = got.length >= 10, wn = d.wins[m.key] || [];
        return `<div class="gmod ${full ? 'full' : ''}" style="--t1:${m.c1};--t2:${m.c2}"><button class="gview" data-gmod="${esc(m.key)}">${carSvg(m, got)}</button>
          <div class="ginfo"><b>#${m.num} ${esc(m.name)}</b><small>${full ? '✅ Modelo completo' : `${got.length}/10 piezas`}${wn.length ? ` · 🏆×${wn.length}` : ''}</small></div>
          ${full ? '' : `<button data-gbox="${esc(m.key)}" ${w.open && d.coins >= G.price ? '' : 'disabled'}>📦 Caja · ${coinTxt(G.price)}</button>`}</div>`; }).join('')}</div></div>`).join('')}`;
  }
  function buyBox(key) {
    const m = modelOf(key), G = GARAGE[m.s], d = derive(), got = d.gar[key] || [];
    if (!weekend(m.s).open) return toast('<b>Las cajas solo se venden el fin de semana de carrera</b>', { cls:'info' });
    if (d.coins < G.price) return toast(`<b>Te faltan vaccoins</b><small>La caja cuesta ${G.price}.</small>`, { cls:'info' });
    const left = G.parts.map(p => p[0]).filter(p => !got.includes(p)).sort(() => Math.random() - .5).slice(0, 2);
    if (!left.length) return;
    add({ id:'g' + uid() + Date.now().toString(36), ty:'part', m:key, p:left, cost:G.price }); pushSoon();
    const names = left.map(p => G.parts.find(x => x[0] === p)[1]), now = derive().gar[key] || [];
    let o = $('fgPack'); if (!o) { o = document.createElement('div'); o.id = 'fgPack'; document.body.appendChild(o); }
    o.innerHTML = `<div class="fgpk"><div class="gbig ${now.length >= 10 ? 'full' : ''}" style="--t1:${m.c1};--t2:${m.c2}">${carSvg(m, now)}</div>
      <h2>📦 ${names.map(esc).join(' + ')}</h2><p>${now.length >= 10 ? `🎉 ¡Completaste el ${esc(m.name)} #${m.num}!` : `${esc(m.name)}: ${now.length}/10 piezas`}</p>
      <div class="btns"><button class="pri" data-close>Listo</button></div></div>`;
    o.classList.add('on'); o.querySelector('[data-close]').onclick = () => { o.classList.remove('on'); o.innerHTML = ''; render(); };
  }
  function modelZoom(key) {
    const m = modelOf(key), G = GARAGE[m.s], got = derive().gar[key] || [], wn = derive().wins[key] || [];
    let o = $('fgZoom'); if (!o) { o = document.createElement('div'); o.id = 'fgZoom'; o.onclick = e => { if (e.target === o) o.remove(); }; }
    o.innerHTML = `<div class="gzoom" style="--t1:${m.c1};--t2:${m.c2}"><div class="gbig ${got.length >= 10 ? 'full' : ''}">${carSvg(m, got)}</div>
      <h2>#${m.num} ${esc(m.name)}</h2><p class="mut">${esc(m.team)} · ${G.n} · Temporada 2026 · escala 1:43</p>
      <div class="gparts">${G.parts.map(([id, n]) => `<span class="${got.includes(id) ? 'ok' : ''}">${got.includes(id) ? '✓' : '·'} ${n}</span>`).join('')}</div>
      ${wn.length ? `<div class="gwins">${wn.map(g => `<span>🏆 ${esc(g)}</span>`).join('')}</div>` : ''}
      <button data-x>Cerrar</button></div>`;
    document.body.appendChild(o); o.querySelector('[data-x]').onclick = () => o.remove();
  }
  // 🏆 cuando gana uno de la grilla, queda la plaquita en su modelo (para el recuerdo)
  function wins() {
    for (const s of Object.keys(GARAGE)) {
      let L; try { L = Motor.lastRace(s); } catch { continue; } if (!L?.results?.length || !/^2026/.test(L.date || '')) continue;
      const w = L.results.find(r => r.pos === 1); if (!w) continue;
      const tk = norm(w.name).split(' '), m = models(s).find(m => norm(m.name).split(' ').every(x => tk.includes(x)));   // "Kimi Antonelli" ⊂ "Andrea Kimi Antonelli"; Marc ≠ Álex Márquez
      if (m) add({ id:`w-${s}-${norm(L.name).replace(/\s+/g, '')}-${L.date.slice(0, 10)}`, ty:'win', m:m.key, gp:L.name });
    }
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
    setInterval(() => { try { prode(); } catch {} velezTok(); try { wins(); } catch {} }, 10 * 60e3);
    setTimeout(async () => {
      await pull();
      try { prode(); } catch {} velezTok(); try { wins(); } catch {}
      if (!tvDev()) { const g = daily(); if (g) { pushSoon(); toast(`<b>🎁 Regalo del día: +${g.n} vaccoins</b><small>Racha de ${g.s} día${g.s === 1 ? '' : 's'}${g.off ? ` · +${g.off} de mientras no estabas` : ''}. Están en 🃏 Figus.</small>`, { cls:'info', ms:6000, onclick:() => Nav.go('figus') }); } }
    }, 6000);
    setInterval(pull, tvDev() ? 30 * 60e3 : 5 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { bgHide(); if (pushT) pushNow(); } else { bgShow(); pull(); } });
    addEventListener('pagehide', bgHide);
  }
  return { init, render, paseo, ECO, get coins() { return derive().coins; } };
})();
