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
    pack:40, packVelez:60, packSize:5, buy:{ c:60, r:150, e:250, l:400 }, sell:{ c:3, r:10, e:20, l:40 }, odds:{ c:.62, r:.25, e:.09, l:.04 }, perfect:{ c:5, r:5, e:10, l:10 },
    covers:{ clasica:0, cuero:300, retro:300, neon:500 } };
  const STYLES = { panini:'🟨 Clásico Panini', retro:'📼 Retro 90s', neon:'💡 Neón', diario:'📰 Diario de papel', holo:'🌈 Holográfico' };
  // cómo se consiguen los sobres (independiente de qué trata el álbum)
  const KINDS = { canal:'🏪 Sobres en el kiosco', vaca:'🐶 Sobres solo paseando a Vaca', velez:'💙 Kiosco (más barato los días que juega Vélez)' };
  // de qué trata: son puntos de partida, después todo se cambia (páginas, ficha, diseño)
  const F = (k, l, ty = 'text', ic = '') => ({ k, l, ty, ic });
  const F_PROG = [F('area', 'Área', 'area'), F('horario', '🕒 Horario'), F('mule', 'Muletilla o frase célebre', 'quote'), F('bardo', 'Nivel de bardo', 'scale', '🔥'), F('extra', 'Algo más', 'long')];
  const THEMES = {
    programa:{ t:'📺 Programa o canal', d:'Conducción, panel e invitados, con la mesa del programa', kind:'canal', pages:[['El programa', 'mesa'], ['Invitados']], fields:F_PROG, story:'Contá la historia del canal: cuándo nació, quiénes están, qué lo hace especial…' },
    vaca:{ t:'🐶 Vaca', d:'Sus fotos, paseos, siestas y travesuras', kind:'vaca', pages:[['De cachorra', 'hero'], ['Paseos'], ['Siestas'], ['Travesuras'], ['Con la familia']], fields:[F('fecha', '📅 Cuándo'), F('lugar', '📍 Dónde'), F('que', 'Qué pasó', 'long'), F('ternura', 'Nivel de ternura', 'scale', '🥰')], story:'La historia de Vaca: cuándo llegó, cómo es, sus mañas…' },
    velez:{ t:'💙 Vélez', d:'Plantel, ídolos, el Amalfitani, partidos y títulos', kind:'velez', pages:[['Plantel 2026'], ['Ídolos', 'hero'], ['El Amalfitani'], ['Partidos inolvidables'], ['Títulos']], fields:[F('pos', '⚽ Posición'), F('num', '👕 Número'), F('epoca', '📅 Época'), F('dato', 'Dato', 'long'), F('idolo', 'Nivel de ídolo', 'scale', '💙')], story:'El Fortín: su historia, sus ídolos, sus noches…' },
    musica:{ t:'🎸 Música', d:'Bandas, discos, recitales', kind:'canal', pages:[['Bandas'], ['Discos'], ['Recitales']], fields:[F('anio', '📅 Año'), F('tema', '🎵 Tema favorito'), F('dato', 'Dato', 'long')], story:'' },
    pelis:{ t:'🎬 Series y pelis', d:'Personajes, villanos, escenas', kind:'canal', pages:[['Protagonistas'], ['Villanos'], ['Escenas']], fields:[F('de', '🎞️ De dónde'), F('frase', 'Frase', 'quote'), F('dato', 'Dato', 'long')], story:'' },
    gente:{ t:'👨‍👩‍👧 Familia y amigos', d:'La gente y los momentos', kind:'canal', pages:[['Familia'], ['Amigos'], ['Momentos', 'hero']], fields:[F('quien', '🙂 Quién es'), F('fecha', '📅 Cuándo'), F('recuerdo', 'Recuerdo', 'long')], story:'' },
    lugares:{ t:'🗺️ Lugares y viajes', d:'El barrio, la ciudad, los viajes', kind:'canal', pages:[['Monte Grande'], ['Buenos Aires'], ['Viajes']], fields:[F('donde', '📍 Dónde'), F('cuando', '📅 Cuándo'), F('dato', 'Dato', 'long')], story:'' },
    libre:{ t:'✨ Lo que quieras', d:'En blanco: armás páginas y ficha a tu gusto', kind:'canal', pages:[['Página 1']], fields:[F('dato', 'Dato', 'long')], story:'' } };
  const LAYS = { '':'▦ Grilla', hero:'🖼️ Foto grande + grilla', mesa:'🎙️ Mesa del programa (doble página)' };
  const FTY = { text:'Texto corto', long:'Texto largo', quote:'Frase (entre comillas)', scale:'Escala de 0 a 5', area:'Área (deportes, política…)' };
  const themeOf = a => THEMES[a.theme] ? a.theme : a.kind === 'vaca' ? 'vaca' : a.kind === 'velez' ? 'velez' : 'programa';
  const fieldsOf = a => a.fields || ((a.cards || []).some(c => c.ficha && Object.values(c.ficha).some(Boolean)) ? F_PROG : THEMES[themeOf(a)].fields);
  const RAR = { c:'Común', r:'Rara', e:'Épica', l:'Legendaria' };
  const RARL = { r:'◆ RARA', e:'✦ ÉPICA', l:'★ LEGENDARIA' };
  // 🎨 tapas para comprar con vaccoins (sirven para cualquier álbum, una vez compradas)
  const COVERS = { clasica:'📕 Clásica', cuero:'📜 Libro antiguo de cuero', retro:'📼 Retro de los 90', neon:'🌃 Neón cyberpunk' };
  const STK = ['⭐', '💙', '🐶', '🦴', '⚽', '🏆', '🔥', '👑', '✨', '🎸', '📺', '🏎️', '🏍️', '❤️', '🌙', '☀️', '💥', '🎉', '🍀', '🎙️', '📼', '🌈', '🐾', '😎'];
  const STICK_SINCE = Date.UTC(2026, 10, 11, 18, 0);   // lo que ya tenías antes de esto cuenta como pegado
  const pcDev = () => Device.mode !== 'tv' && Device.mode !== 'celu' && matchMedia('(pointer:fine)').matches;
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
  const blank = () => ({ v:1, since:Date.now(), albums:{}, ev:[], base:null, prefs:{ banner:[], upd:0 } });
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
    const exps = {}, posts = new Set(B.posts || []); let blends = B.blends || 0, expDone = B.expDone || 0;
    const stuck = new Set(B.stuck || []), covers = new Set(B.covers || ['clasica']); let perfects = B.perfects || 0, snap = (B.upTo || 0) >= STICK_SINCE;
    const sticks = [], snapNow = () => { Object.keys(have).forEach(k => have[k] > 0 && stuck.add(k)); snap = true; };
    for (const e of evs) {
      if (!snap && e.t >= STICK_SINCE) snapNow();
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
      else if (e.ty === 'blend') {   // 🌀 licuadora: 5 cosas que sobran → 1 de rareza superior
        const need = {}; (e.f || []).forEach(k => need[k] = (need[k] || 0) + 1);
        const okF = Object.entries(need).every(([k, n]) => (have[k] || 0) - n >= 1);
        const okP = (e.p || []).every(([m, p]) => (gar[m] || []).includes(p) && (gar[m] || []).length < 10);
        if (!okF || !okP) continue;
        Object.entries(need).forEach(([k, n]) => have[k] -= n); (e.p || []).forEach(([m, p]) => gar[m] = gar[m].filter(x => x !== p));
        if (e.out) have[e.out] = (have[e.out] || 0) + 1; blends++;
      }
      else if (e.ty === 'exp') exps[e.id] = { ...e };
      else if (e.ty === 'expok') { const x = exps[e.e]; if (!x || x.ok) continue; x.ok = true; const r = e.rw || {};
        coins += r.vc || 0; earned.exp = (earned.exp || 0) + (r.vc || 0); if (r.fig) have[r.fig] = (have[r.fig] || 0) + 1;
        if (r.part) { const g = gar[r.part[0]] = gar[r.part[0]] || []; if (!g.includes(r.part[1])) g.push(r.part[1]); } if (r.post) posts.add(r.post); expDone++; }
      else if (e.ty === 'stick') sticks.push(e);   // se resuelven al final (por si el reloj de un aparato anda atrasado)
      else if (e.ty === 'cover') { if (covers.has(e.d) || coins < e.cost) continue; coins -= e.cost; spent += e.cost; covers.add(e.d); }
    }
    if (!snap) snapNow();
    for (const e of sticks) { if (!(have[e.k] > 0) || stuck.has(e.k)) continue; stuck.add(e.k); const n = Math.min(10, e.n || 0); if (n) { coins += n; earned.stick = (earned.stick || 0) + n; perfects++; } }
    return D = { coins, have, toks, day, dailies, done, lastSlot, earned, spent, gar, wins, exps, posts, blends, expDone, stuck, covers, perfects };
  }
  // cuando el registro crece mucho, lo viejo (más de 60 días) se resume en una "base" (igual en todos los aparatos)
  function compact() {
    if (st.ev.length < 4000) return;
    const cut = Date.now() - 60 * 864e5, old = st.ev.filter(e => e.t <= cut); if (!old.length) return;
    const keep = st.ev.filter(e => e.t > cut); st.ev = old; D = null; const d = derive();
    st.base = { upTo:cut, coins:d.coins, have:d.have, toks:d.toks, dailies:[...d.dailies], done:[...d.done], lastSlot:d.lastSlot, gar:d.gar, wins:d.wins, posts:[...d.posts], blends:d.blends, expDone:d.expDone, stuck:[...d.stuck], covers:[...d.covers], perfects:d.perfects };
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
    if (r.prefs && (r.prefs.upd || 0) > (st.prefs?.upd || 0)) { st.prefs = r.prefs; ch = true; }
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
        const rid = new Set((r.ev || []).map(e => e.id)); need = need || (st.prefs?.upd || 0) > (r.prefs?.upd || 0) || st.ev.some(e => !rid.has(e.id)) || Object.values(st.albums).some(a => (a.upd || 0) > ((r.albums || {})[a.id]?.upd || 0)); }
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
    if (n && !tvDev()) toast(`<b>${VC} +${n} vaccoins del Prode</b><small>Se sumaron a tu Colección.</small>`, { cls:'info', ms:4000, onclick:() => Nav.go('figus') });
  }
  function velezTok() {   // 💙 los días que juega Vélez: un sobre de Vélez de regalo
    let m = null; try { m = Partido.match(); } catch {} if (!m || new Date(m.date).toDateString() !== new Date().toDateString()) return false;
    add({ id:'vz-' + today(), ty:'tok', k:'velez', why:'¡Hoy juega Vélez!' }); return true;
  }
  const velezDay = () => { try { const m = Partido.match(); return !!m && new Date(m.date).toDateString() === new Date().toDateString(); } catch { return false; } };
  // 🐶 Paseo completado → 1 sobre de Vaca (5 figus)
  function paseo(p) { if (!p || p.min < 15) return; if (add({ id:'v-' + p.s, ty:'tok', k:'vaca', why:`Paseo de ${p.min} min` })) toast('<b>🐶 ¡Sobre de Vaca!</b><small>Por el paseo. Abrilo en 🏛️ Colección.</small>', { cls:'info', ms:6000, onclick:() => { Nav.go('figus'); view = { tab:'inicio' }; render(); } }); }

  /* ---------------- 📦 sobres ---------------- */
  const albums = () => Object.values(st.albums).filter(a => !a.del).sort((a, b) => (a.ord ?? a.cr) - (b.ord ?? b.cr));
  const ready = a => (a.cards || []).filter(c => c.img);
  const albumOfKind = k => albums().find(a => a.kind === k && ready(a).length);
  function draw(a) {
    const R = ready(a), out = [];
    for (let i = 0; i < ECO.packSize; i++) {
      const x = Math.random(), O = ECO.odds, want = x < O.l ? 'l' : x < O.l + O.e ? 'e' : x < O.l + O.e + O.r ? 'r' : 'c';
      const pool = [want, 'c', 'r', 'e', 'l'].map(r => R.filter(c => (c.rar || 'c') === r)).find(p => p.length);
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
    const gold = derive().done.has(a.id);
    return `<div class="fig st-${a.style || 'panini'} rar-${r} ${gold ? 'gold' : ''} ${small ? 'sm' : ''} ${back ? 'back' : ''}" style="${cv(a)}" data-k="${esc(a.id + ':' + c.n)}"${tvDev() ? ' tabindex="0"' : ''}>
      <div class="fin"><div class="fimg" data-img="${esc(c.img || '')}"></div>
      <div class="fband"><span class="fnum">${c.n}</span><b>${esc(c.name || '')}</b></div>
      <span class="falb">${esc(a.name)}</span>${gold ? '<span class="frar fgold">👑 GOLDEN</span>' : r !== 'c' ? `<span class="frar">${RARL[r]}</span>` : ''}</div>
      ${n > 1 ? `<span class="fdup">×${n}</span>` : ''}</div>`;
  }

  /* ---------------- 🖥️ pantalla ---------------- */
  let view = { tab:'inicio' }, work = null;
  const TABS = [['inicio', '🏠 Inicio'], ['albumes', '📚 Álbumes'], ['garage', '🏎️ Garage'], ['expe', '🦴 Expediciones'], ['licua', '🌀 Licuadora'], ['trofeos', '🏆 Trofeos'], ['kiosco', '🏪 Kiosco'], ['repes', '🔁 Repetidas'], ['balance', '📒 Balance']];
  function header() {
    const d = derive(), hoy = Math.min(ECO.slotCap, d.day[today()] || 0), s = streakFor(today()) + (d.dailies.has(today()) ? 1 : 0);
    return `${bannerHtml()}<div class="fghead"><div class="fgcoins">${coinTxt(d.coins)}</div>
      <div class="fgstat"><span>Hoy por estar: <b>${hoy}/${ECO.slotCap}</b></span><span>🔥 Racha: <b>${s} día${s === 1 ? '' : 's'}</b></span><span>🏅 <b>${achList().filter(a => a.ok).length}</b>/${ACH.length} trofeos</span></div></div>
      <div class="fgtabs">${TABS.map(([k, t]) => `<button data-tab="${k}" class="${view.tab === k ? 'on' : ''}">${t}</button>`).join('')}</div>`;
  }
  function progress(a) { const h = derive().have, tot = (a.cards || []).length || a.size || 0, got = (a.cards || []).filter(c => h[a.id + ':' + c.n]).length; return { got, tot, pct:tot ? Math.round(got / tot * 100) : 0 }; }
  function albumTile(a) {
    const p = progress(a);
    return `<button class="fgalb st-${a.style || 'panini'}" style="${cv(a)}" data-alb="${esc(a.id)}">
      <div class="fgalogo" data-img="${esc(a.logo || '')}">${a.logo ? '' : esc((a.name || '?').slice(0, 2).toUpperCase())}</div>
      <div class="fgainfo"><b>${esc(a.name)}</b><small>${THEMES[themeOf(a)].t.split(' ')[0]} ${p.got}/${p.tot}${derive().done.has(a.id) ? ' · 🏆' : ''}</small>
      <div class="fgbar"><i style="width:${p.pct}%"></i></div></div></button>`;
  }
  function render() {
    const v = $('v-figus'); if (!v) return;
    if (!tvDev()) try { achCheck(); } catch {}
    v.classList.toggle('fgstatic', tvDev());
    if (tvDev()) {   // 📺 en la tele: solo mirar álbumes, pasar hojas y ver las fichas (sin animaciones)
      if (view.alb) return renderAlbum(v);
      v.innerHTML = `<div class="fghead tvh"><h2>🏛️ Colección</h2><small class="mut">En la tele se miran los álbumes. Para abrir sobres y pegar figus, usá la compu o el celu.</small></div>
        <div class="fgalbs">${albums().map(albumTile).join('') || '<div class="empty">Todavía no hay álbumes.</div>'}</div>`;
      v.querySelectorAll('[data-alb]').forEach(b => b.onclick = () => { view = { tab:'albumes', alb:b.dataset.alb }; render(); });
      hydrate(v); return;
    }
    if (view.nuevo) return renderNew(v);
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
      body = `<p class="mut">Cada sobre trae ${ECO.packSize} figus del álbum que elijas. Rara: 1 de cada 4 · épica: 1 de cada 11 · legendaria: 1 de cada 25. Completá un álbum y todas sus figus pasan a 👑 Golden.</p>
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
    } else if (view.tab === 'expe') {
      body = expeHtml();
    } else if (view.tab === 'licua') {
      body = licuaHtml();
    } else if (view.tab === 'trofeos') {
      body = trofeosHtml();
    } else if (view.tab === 'garage') {
      body = garageHtml();
    } else if (view.tab === 'balance') {
      const L = [...st.ev].sort((a, b) => b.t - a.t).filter(e => e.ty !== 'slot').slice(0, 40);
      const ic = e => e.ty === 'stick' ? `🎯 ¡Pegado perfecto! (${e.acc}%)` : e.ty === 'cover' ? `🎨 Tapa nueva: ${COVERS[e.d] || e.d}` : e.ty === 'exp' ? `🦴 Vaca salió a repartir a ${esc(e.dest)} (${e.h} h)` : e.ty === 'expok' ? `🦴 Volvió del reparto: +${e.rw?.vc || 0}${e.rw?.post ? ' · postal' : ''}${e.rw?.fig ? ' · figu' : ''}${e.rw?.part ? ' · repuesto' : ''}` : e.ty === 'blend' ? '🌀 Licuadora: 5 → 1 de rareza superior' : e.ty === 'ach' ? '🏅 Trofeo nuevo' : e.ty === 'part' ? `🔧 Piezas para el ${esc(modelOf(e.m)?.name || '')} (${(e.p || []).length})` : e.ty === 'win' ? `🏆 ${esc(modelOf(e.m)?.name || '')} ganó ${esc(e.gp)}` : e.ty === 'daily' ? `🎁 Regalo del día (racha ${e.s})${e.off ? ` · +${e.off} mientras no estabas` : ''}` : e.ty === 'prode' ? `🔮 Prode: ${esc(e.m || '')}` : e.ty === 'pack' ? `📦 Sobre de ${esc(st.albums[e.a]?.name || '?')}${e.tok ? ' (regalo)' : ''}` : e.ty === 'buy' ? `🛒 Compraste #${esc(e.k.split(':')[1])} de ${esc(st.albums[e.k.split(':')[0]]?.name || '?')}` : e.ty === 'sell' ? '🔁 Vendiste una repetida' : e.ty === 'tok' ? `🎁 Sobre de ${e.k === 'vaca' ? 'Vaca' : 'Vélez'}: ${esc(e.why || '')}` : e.ty === 'done' ? `🏆 Completaste ${esc(st.albums[e.a]?.name || '')}` : e.ty;
      const amt = e => e.ty === 'stick' ? `+${e.n || 0}` : e.ty === 'cover' ? `−${e.cost}` : e.ty === 'expok' ? `+${e.rw?.vc || 0}` : e.ty === 'daily' || e.ty === 'prode' ? `+${e.n}` : e.ty === 'sell' ? `+${e.n}` : e.ty === 'pack' && !e.tok || e.ty === 'buy' || e.ty === 'part' ? `−${e.cost}` : '';
      body = `<div class="psstats"><div><b>${d.earned.slot}</b><small>por estar</small></div><div><b>${d.earned.daily}</b><small>regalos</small></div><div><b>${d.earned.prode}</b><small>Prode</small></div><div><b>${d.earned.sell}</b><small>ventas</small></div><div><b>${d.spent}</b><small>gastadas</small></div></div>
        <div class="tdlist">${L.map(e => `<div class="tdrow"><div><b>${ic(e)}</b><small>${new Date(e.t).toLocaleString('es-AR', { day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit' })}</small></div><b class="fgamt">${amt(e)}</b></div>`).join('') || '<div class="empty">Todavía no hay movimientos.</div>'}</div>`;
    }
    v.innerHTML = header() + body;
    bindCommon(v); v.querySelectorAll('.fgbn-it .fig[data-k]').forEach(f => f.onclick = () => zoom(f));
    v.querySelectorAll('[data-alb]').forEach(b => b.onclick = () => { view = { tab:view.tab, alb:b.dataset.alb }; render(); });
    v.querySelectorAll('[data-new]').forEach(b => b.onclick = newAlbum);
    bindExpe(v); bindLicua(v);
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
  function newAlbum() { view = { tab:'albumes', nuevo:{ th:'', n:20, name:'', kind:'' } }; render(); }
  // ✨ asistente: de qué es, cómo se llama, cuántas figus y cómo se consiguen
  function renderNew(v) {
    const N = view.nuevo, T = THEMES[N.th];
    v.innerHTML = header() + `<div class="fgnuevo"><div class="btns"><button data-back>← Volver</button></div>
      <h2>📖 Álbum nuevo</h2><h3>1 · ¿De qué es?</h3>
      <div class="fgths">${Object.entries(THEMES).map(([k, t]) => `<button class="fgth ${N.th === k ? 'on' : ''}" data-th="${k}"><b>${t.t}</b><small>${t.d}</small></button>`).join('')}</div>
      ${T ? `<p class="mut">Arranca con las páginas ${T.pages.map(p => '«' + esc(p[0]) + '»').join(', ')} y una ficha con ${fieldsOf({ theme:N.th, cards:[] }).map(f => f.l.replace(/^\S+\s/, '')).join(', ').toLowerCase()}. Todo se cambia después.</p>
      <h3>2 · ¿Cómo se llama?</h3><input data-nn value="${esc(N.name)}" placeholder="${esc(T.t.replace(/^\S+\s/, ''))}" maxlength="40">
      <h3>3 · ¿Cuántas figus?</h3><div class="fgnn">${[10, 20, 30, 50, 100].map(n => `<button data-nc="${n}" class="${N.n === n ? 'on' : ''}">${n}</button>`).join('')}<input type="number" min="1" max="150" data-nc2 value="${N.n}"></div>
      <h3>4 · ¿Cómo se consiguen los sobres?</h3><select data-nk>${Object.entries(KINDS).map(([k, t]) => `<option value="${k}" ${(N.kind || T.kind) === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
      <div class="btns" style="margin-top:16px"><span class="sp"></span><button class="pri" data-mk>Crear y cargar las figus →</button></div>` : ''}</div>`;
    bindCommon(v);
    v.querySelector('[data-back]').onclick = () => { view = { tab:'albumes' }; render(); };
    v.querySelectorAll('[data-th]').forEach(b => b.onclick = () => { N.th = b.dataset.th; N.kind = ''; render(); });
    v.querySelector('[data-nn]')?.addEventListener('input', e => N.name = e.target.value);
    v.querySelectorAll('[data-nc]').forEach(b => b.onclick = () => { N.n = +b.dataset.nc; render(); });
    v.querySelector('[data-nc2]')?.addEventListener('change', e => { N.n = Math.max(1, Math.min(150, +e.target.value || 20)); render(); });
    v.querySelector('[data-nk]')?.addEventListener('change', e => N.kind = e.target.value);
    v.querySelector('[data-mk]')?.addEventListener('click', () => {
      const id = 'a' + uid(), k = albums().length, pages = T.pages.map(([t, lay]) => ({ t, txt:'', ...(lay ? { lay } : {}) }));
      const a = st.albums[id] = { id, name:N.name.trim() || T.t.replace(/^\S+\s/, ''), theme:N.th, kind:N.kind || T.kind, style:Object.keys(STYLES)[k % 5], colors:['#1238b5', '#ffffff'], per:6,
        story:'', pages, fields:JSON.parse(JSON.stringify(T.fields)), cards:[], cr:Date.now(), upd:Date.now() };
      for (let i = 1; i <= N.n; i++) a.cards.push({ n:i, name:'', page:Math.min(pages.length - 1, Math.floor((i - 1) * pages.length / N.n)), rar:i % 10 === 0 ? 'l' : i % 7 === 0 ? 'e' : i % 4 === 0 ? 'r' : 'c', img:'' });
      saveSt(); schedule(); view = { tab:'albumes', alb:id, edit:true }; work = null; render(); });
  }
  function checkDone(a) {
    if (derive().done.has(a.id)) return; const p = progress(a);
    if (p.tot && p.got === p.tot && (a.cards || []).every(c => c.img)) { add({ id:'done-' + a.id, ty:'done', a:a.id }); celebrate(a); }
  }
  /* ---------------- 📖 el álbum de papel: hojas que se pasan ---------------- */
  const narrow = () => innerWidth < 820;
  // en la compu, la figu nueva no se pega sola: queda la silueta hasta que la arrastrás
  const cellHtml = (a, c, h) => { const k = a.id + ':' + c.n, n = h[k] || 0, toStick = n && pcDev() && !derive().stuck.has(k);
    const ghost = figHtml(a, c, { ghost:true }).replace('<div class="fig ghost', `<div data-slotk="${esc(k)}" class="fig ghost${toStick ? ' tostick' : ''}`);
    return `<div class="fgcell ${c.role ? 'r-' + c.role : ''}">${n && !toStick ? figHtml(a, c, { n }) : ghost}${!n && c.img && a.kind !== 'vaca' && !tvDev() ? `<button class="fgbuy1" data-buy1="${c.n}">Comprar · ${coinTxt(ECO.buy[c.rar || 'c'])}</button>` : ''}</div>`; };
  const stkHtml = a => `<div class="bkstk">${(a.stk || []).map((x, i) => `<span data-si="${i}" style="left:${x.x}%;top:${x.y}%;--r:${x.r || 0}deg;--s:${x.s || 1}">${esc(x.e)}</span>`).join('')}</div>`;
  function leaves(a) {   // todas las hojas, en orden: tapa, presentación, páginas, contratapa
    const h = derive().have, p = progress(a), per = Math.max(1, +a.per || 6), pages = a.pages?.length ? a.pages : [{ t:'', txt:'' }];
    const L = [], idx = []; let num = 1;
    L.push({ kind:'cover', html:`<div class="bkcover cv-${esc(a.cover || 'clasica')} ${derive().done.has(a.id) ? 'golden' : ''}">${stkHtml(a)}<div class="fgalogo big" data-img="${esc(a.logo || '')}">${a.logo ? '' : esc((a.name || '?').slice(0, 2).toUpperCase())}</div>
      <h1>${esc(a.name)}</h1><span class="bkstamp">ÁLBUM DE FIGURITAS</span><small>${(a.cards || []).length} figus · ${p.got} pegadas${derive().done.has(a.id) ? ' · 👑 COMPLETO' : ''}</small></div>` });
    const intro = { kind:'page', n:num++ }; L.push(intro);
    pages.forEach((pg, i) => { const cards = (a.cards || []).filter(c => (c.page || 0) === i); if (!cards.length) return;
      idx.push({ t:pg.t || 'Página ' + (i + 1), n:num, got:cards.filter(c => h[a.id + ':' + c.n]).length, tot:cards.length, leaf:L.length });
      if (pg.lay === 'mesa') { L.push({ kind:'wide', n:num, html:pageHtml(a, pg, cards, h) }); num += 2; return; }
      const head = `${pg.t ? `<h3>${esc(pg.t)}</h3>` : ''}${pg.txt ? `<p>${esc(pg.txt).replace(/\n/g, '<br>')}</p>` : ''}`;
      for (let j = 0, k = 0; j < cards.length; k++) {
        const hero = pg.lay === 'hero' && k === 0, take = hero ? Math.max(1, Math.min(per, 5)) : per, ch = cards.slice(j, j + take); j += take;
        const grid = hero ? ch.slice(1) : ch, cols = grid.length <= 2 ? Math.max(1, grid.length) : grid.length <= 4 ? 2 : grid.length <= 9 ? 3 : 4, rows = Math.ceil(grid.length / cols) || 1;
        L.push({ kind:'page', n:num++, html:`<div class="bkhead">${k === 0 ? head : `<h4>${esc(pg.t || '')} <small>(sigue)</small></h4>`}</div>
          <div class="bkbody ${hero ? 'hero' : ''}">${hero ? `<div class="bkhero">${cellHtml(a, ch[0], h)}</div>` : ''}${grid.length ? `<div class="bkgrid" style="--cols:${hero ? Math.min(2, grid.length) : cols};--rows:${hero ? Math.ceil(grid.length / 2) : rows}">${grid.map(c => cellHtml(a, c, h)).join('')}</div>` : ''}</div>` }); } });
    intro.html = `<div class="bkhead"><h3>${esc(a.name)}</h3></div>${a.story ? `<div class="bkstory">${esc(a.story).replace(/\n/g, '<br>')}</div>` : ''}
      <h4 class="bkidxh">Índice</h4><div class="bkidx">${idx.map(x => `<button data-goto="${x.leaf}"><span>${esc(x.t)}</span><i></i><small>${x.got}/${x.tot}</small><b>${x.n}</b></button>`).join('')}</div>
      <div class="bkprog"><div class="fgbar"><i style="width:${p.pct}%"></i></div><small>${p.got} de ${p.tot} pegadas (${p.pct}%)</small></div>`;
    L.push({ kind:'back', html:`<div class="bkcover back"><span class="bkstamp">FUNVS</span><small>Colección de klasito7</small><div class="bkprog"><div class="fgbar"><i style="width:${p.pct}%"></i></div><small>${p.pct}% completo</small></div></div>` });
    return L;
  }
  function spreads(L) {   // en la compu: de a dos hojas (tapa y contratapa solas, la mesa ocupa las dos). En el celu: de a una
    const S = [];
    if (narrow()) { L.forEach((x, i) => S.push({ one:i })); return S; }
    let cur = null;
    L.forEach((x, i) => {
      if (x.kind === 'cover') return S.push({ solo:i });
      if (x.kind === 'back') { if (cur !== null) { S.push({ l:cur, r:-1 }); cur = null; } return S.push({ solo:i, back:true }); }
      if (x.kind === 'wide') { if (cur !== null) { S.push({ l:cur, r:-1 }); cur = null; } return S.push({ wide:i }); }
      if (cur === null) cur = i; else { S.push({ l:cur, r:i }); cur = null; } });
    return S;
  }
  const leafOf = sp => sp.one ?? sp.solo ?? sp.wide ?? sp.l;
  function pageBox(L, i, side) {
    if (i < 0) return `<div class="bkp ${side} blank"></div>`;
    const x = L[i]; if (x.kind === 'cover' || x.kind === 'back') return `<div class="bkp ${side} cov">${x.html}</div>`;
    return `<div class="bkp ${side}">${x.html}${x.n ? `<span class="bknum">${x.n}</span>` : ''}</div>`;
  }
  function spreadHtml(L, sp) {
    if (sp.wide !== undefined) return `<div class="bkspread wide">${L[sp.wide].html}<span class="bknum l">${L[sp.wide].n}</span><span class="bknum r">${L[sp.wide].n + 1}</span></div>`;
    if (sp.one !== undefined) return `<div class="bkspread one">${L[sp.one].kind === 'wide' ? `<div class="bkp one widep">${L[sp.one].html}</div>` : pageBox(L, sp.one, 'one')}</div>`;
    if (sp.solo !== undefined) return `<div class="bkspread solo ${sp.back ? 'atl' : 'atr'}">${sp.back ? pageBox(L, sp.solo, 'l') + '<div class="bkp r none"></div>' : '<div class="bkp l none"></div>' + pageBox(L, sp.solo, 'r')}</div>`;
    return `<div class="bkspread">${pageBox(L, sp.l, 'l')}${pageBox(L, sp.r, 'r')}</div>`;
  }
  function renderAlbum(v) {
    const a = st.albums[view.alb]; if (!a) { view = { tab:'albumes' }; return render(); }
    if (view.edit && !tvDev()) return renderEdit(v, a);
    const TV = tvDev(), PC = pcDev(), L = leaves(a), SP = spreads(L);
    let si = Math.max(0, SP.findIndex(sp => [sp.one, sp.solo, sp.wide, sp.l, sp.r].includes(view.leaf ?? 0)));
    const d = derive(), inv = PC ? (a.cards || []).filter(c => d.have[a.id + ':' + c.n] && !d.stuck.has(a.id + ':' + c.n)) : [];
    v.innerHTML = (TV ? `<div class="fghead tvh"><h2>🏛️ ${esc(a.name)}</h2><small class="mut">◀ ▶ pasan las hojas · ☰ Menú vuelve</small></div>` : header()) + `<div class="fgbook st-${a.style || 'panini'} ${PC ? 'pc' : ''}" style="${cv(a)}">
      <div class="btns"><button data-back>← Volver</button><span class="sp"></span>${PC ? `<button data-snd title="Sonidos">${S.get('figusSnd', true) ? '🔊' : '🔇'}</button><button data-cov>🎨 Tapa</button>` : ''}${TV ? '' : '<button data-edit>✎ Editar álbum</button>'}</div>
      <div class="bkstage"><button class="bknav" data-bk="-1" aria-label="Hoja anterior">‹</button><div class="bkview"></div><button class="bknav" data-bk="1" aria-label="Hoja siguiente">›</button>
      ${inv.length ? `<div class="bktray" title="Agarrala y soltala sobre su silueta. Justo encima = ¡pegado perfecto! y vaccoins. Un toque te lleva a su página."><b>✋ Para pegar</b><small>${inv.length} figu${inv.length === 1 ? '' : 's'} · arrastralas a su silueta</small>
        <div class="bktrayl">${inv.map(c => `<div class="bktit" data-drag="${esc(a.id + ':' + c.n)}">${figHtml(a, c, { small:true })}<small>#${c.n}</small></div>`).join('')}</div></div>` : ''}</div>
      <div class="bkfoot"><input type="range" min="0" max="${SP.length - 1}" value="${si}" data-bkr ${TV ? 'tabindex="-1"' : ''}><small data-bkn></small></div>
      <div class="bkcovp" hidden></div></div>`;
    if (!TV) bindCommon(v);
    const vw = v.querySelector('.bkview'), rng = v.querySelector('[data-bkr]');
    const paint = () => { vw.innerHTML = spreadHtml(L, SP[si]); bindPage(vw); hydrate(vw); rng.value = si; view.leaf = leafOf(SP[si]);
      v.querySelector('[data-bkn]').textContent = si === 0 ? 'Tapa' : si === SP.length - 1 ? 'Contratapa' : `Hoja ${si} de ${SP.length - 2}`;
      v.querySelector('[data-bk="-1"]').disabled = si === 0; v.querySelector('[data-bk="1"]').disabled = si === SP.length - 1; };
    const bindPage = root => {
      root.querySelectorAll('.fig[data-k]').forEach(f => f.onclick = () => zoom(f));
      root.querySelectorAll('[data-goto]').forEach(b => b.onclick = () => { const t = SP.findIndex(sp => [sp.one, sp.solo, sp.wide, sp.l, sp.r].includes(+b.dataset.goto)); if (t >= 0) turn(t); });
      root.querySelectorAll('[data-buy1]').forEach(b => b.onclick = () => {
        const c = a.cards.find(x => String(x.n) === b.dataset.buy1), cost = ECO.buy[c.rar || 'c'];
        if (derive().coins < cost) return toast(`<b>Te faltan vaccoins</b><small>Necesitás ${cost}.</small>`, { cls:'info' });
        if (!confirm(`¿Comprar la #${c.n}${c.name ? ' (' + c.name + ')' : ''} por ${cost} vaccoins?`)) return;
        add({ id:'b' + uid(), ty:'buy', k:a.id + ':' + c.n, cost }); pushSoon(); checkDone(a); render(); }); };
    const spreadOf = leaf => SP.findIndex(sp => [sp.one, sp.solo, sp.wide, sp.l, sp.r].includes(leaf));
    let busy = false;
    function turn(to) {   // pasar la hoja
      if (to < 0 || to >= SP.length || to === si || busy) return;
      const from = SP[si], dir = to > si ? 1 : -1, nx = SP[to]; si = to;
      if (TV || matchMedia('(prefers-reduced-motion: reduce)').matches) return paint();   // 📺 la tele: sin animaciones
      if (!PC) {   // 📱 celu: un deslizamiento simple y liviano
        paint(); const sp = vw.firstElementChild; sp.classList.add(dir > 0 ? 'in-r' : 'in-l'); return;
      }
      // 🖥️ compu: la hoja se levanta, se curva y cae, con su sombra y el ruido del papel
      const two = from.l !== undefined && nx.l !== undefined;
      paint(); busy = true; SND.flip();
      const sp = vw.querySelector('.bkspread'), flap = document.createElement('div');
      if (two) {
        const keep = vw.querySelector(dir > 0 ? '.bkp.l' : '.bkp.r'); keep.outerHTML = pageBox(L, dir > 0 ? from.l : from.r, dir > 0 ? 'l' : 'r');
        flap.className = 'bkflap half pc ' + (dir > 0 ? 'fwd' : 'bwd');
        flap.innerHTML = `<div class="bkf">${pageBox(L, dir > 0 ? from.r : from.l, dir > 0 ? 'r' : 'l')}<i class="bkshade"></i><i class="bkgloss"></i></div><div class="bkf backf">${pageBox(L, dir > 0 ? nx.l : nx.r, dir > 0 ? 'l' : 'r')}<i class="bkshade"></i><i class="bkgloss"></i></div>`;
        sp.insertAdjacentHTML('beforeend', `<i class="bkcast ${dir > 0 ? 'fwd' : 'bwd'}"></i>`);
      } else { flap.className = 'bkflap full pc ' + (dir > 0 ? 'fwd' : 'bwd'); flap.innerHTML = `<div class="bkf">${spreadHtml(L, from)}<i class="bkshade"></i></div>`; }
      sp.appendChild(flap); hydrate(vw);
      setTimeout(() => { busy = false; paint(); }, two ? 900 : 560);
    }
    v.querySelectorAll('[data-bk]').forEach(b => b.onclick = () => turn(si + +b.dataset.bk));
    rng.oninput = () => { si = +rng.value; paint(); };
    let x0 = null; vw.addEventListener('touchstart', e => x0 = e.touches[0].clientX, { passive:true });
    vw.addEventListener('touchend', e => { if (x0 === null) return; const dx = e.changedTouches[0].clientX - x0; x0 = null; if (Math.abs(dx) > 50) turn(si + (dx < 0 ? 1 : -1)); });
    bookKeys = e => { if (Nav.current !== 'figus' || !document.body.contains(vw) || $('fgZoom') || /INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) return;
      if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
      if (TV && vw.contains(document.activeElement)) return;   // 📺 parado sobre una figu: las flechas se mueven entre figus
      e.preventDefault(); e.stopImmediatePropagation(); turn(si + (e.key === 'ArrowRight' ? 1 : -1)); };
    v.querySelector('[data-back]').onclick = () => { view = { tab:view.tab || 'albumes' }; render(); };
    v.querySelector('[data-edit]')?.addEventListener('click', () => { view.edit = true; work = null; render(); });
    if (PC) {
      v.querySelector('[data-snd]').onclick = e => { const on = !S.get('figusSnd', true); S.set('figusSnd', on); e.target.textContent = on ? '🔊' : '🔇'; };
      tilt(vw); dragStick(v, a, vw, leaf => { const t = spreadOf(leaf); if (t >= 0) turn(t); }, () => SP[si]);
      v.querySelector('[data-cov]').onclick = () => { if (si !== 0) { si = 0; paint(); } coverPanel(v, a, vw); };
      if (view.cov) { view.cov = false; coverPanel(v, a, vw); }
    }
    wasNarrow = narrow(); paint(); ensureImgs(a.id);
    if (TV) setTimeout(() => v.querySelector('[data-bk="1"]')?.focus(), 50);
  }

  /* ---------------- 🔊 sonidos de papel (se generan acá mismo, sin archivos) ---------------- */
  let AC = null;
  const ac = () => { try { AC = AC || new (window.AudioContext || window.webkitAudioContext)(); if (AC.state === 'suspended') AC.resume(); return AC; } catch { return null; } };
  function noise(dur, { f0 = 800, f1 = 3000, q = 1, vol = .2, crackle = 0, delay = 0 } = {}) {
    if (!S.get('figusSnd', true) || !pcDev()) return; const c = ac(); if (!c) return;
    const n = Math.floor(c.sampleRate * dur), buf = c.createBuffer(1, n, c.sampleRate), x = buf.getChannelData(0);
    for (let i = 0; i < n; i++) { const env = Math.sin(Math.PI * i / n) ** 1.2; x[i] = (Math.random() * 2 - 1) * env * (crackle && Math.random() > 1 - crackle ? 3 : crackle ? .35 : 1); }
    const src = c.createBufferSource(), f = c.createBiquadFilter(), g = c.createGain(), t = c.currentTime + delay;
    src.buffer = buf; f.type = 'bandpass'; f.Q.value = q; f.frequency.setValueAtTime(f0, t); f.frequency.exponentialRampToValueAtTime(f1, t + dur); g.gain.value = vol;
    src.connect(f).connect(g).connect(c.destination); src.start(t);
  }
  function tone(fr, dur, vol = .15, delay = 0, type = 'sine') {
    if (!S.get('figusSnd', true) || !pcDev()) return; const c = ac(); if (!c) return;
    const o = c.createOscillator(), g = c.createGain(), t = c.currentTime + delay; o.type = type; o.frequency.setValueAtTime(fr, t); o.frequency.exponentialRampToValueAtTime(fr * .5, t + dur);
    g.gain.setValueAtTime(vol, t); g.gain.exponentialRampToValueAtTime(.001, t + dur); o.connect(g).connect(c.destination); o.start(t); o.stop(t + dur);
  }
  const SND = {
    flip:() => { noise(.42, { f0:500, f1:2600, q:.6, vol:.22 }); noise(.12, { f0:2500, f1:1200, q:.8, vol:.12, delay:.36 }); },
    peel:() => noise(.38, { f0:1800, f1:6000, q:1.4, vol:.2, crackle:.04 }),
    snap:() => { tone(1700, .05, .25, 0, 'triangle'); noise(.06, { f0:3000, f1:1500, q:1, vol:.25 }); },
    perfect:() => [880, 1109, 1319, 1760].forEach((f, i) => tone(f, .22, .1, i * .07)),
    nope:() => tone(220, .18, .12, 0, 'square') };

  /* ---------------- ✨ figu que se inclina siguiendo el mouse (brillo de cromo) ---------------- */
  function tilt(root) {
    let cur = null, raf = 0, ev = null;
    const reset = f => { f.classList.remove('tilting'); f.style.removeProperty('--rx'); f.style.removeProperty('--ry'); };
    root.addEventListener('mousemove', e => { ev = e; if (raf) return; raf = requestAnimationFrame(() => { raf = 0;
      const f = ev.target.closest?.('.fig:not(.ghost)'); if (cur && cur !== f) reset(cur); cur = f; if (!f) return;
      const r = f.getBoundingClientRect(), px = (ev.clientX - r.left) / r.width - .5, py = (ev.clientY - r.top) / r.height - .5;
      f.classList.add('tilting'); f.style.setProperty('--rx', (-py * 16).toFixed(2) + 'deg'); f.style.setProperty('--ry', (px * 18).toFixed(2) + 'deg');
      f.style.setProperty('--gx', ((px + .5) * 100).toFixed(1) + '%'); f.style.setProperty('--gy', ((py + .5) * 100).toFixed(1) + '%'); }); });
    root.addEventListener('mouseleave', () => { if (cur) reset(cur); cur = null; });
  }

  /* ---------------- ✋ pegar a mano: arrastrar de la pila a la silueta ---------------- */
  function dragStick(v, a, vw, goLeaf, curSp) {
    const tray = v.querySelector('.bktray'); if (!tray) return;
    tray.addEventListener('pointerdown', e => {
      const it = e.target.closest('[data-drag]'); if (!it || e.button !== 0) return; e.preventDefault();
      const k = it.dataset.drag, c = keyCard(k).c, x0 = e.clientX, y0 = e.clientY;
      let fl = null, moved = false, w = 0, h = 0, px = x0, py = y0, vx = 0, raf = 0, rot = 0;
      const start = () => {
        const sl = vw.querySelector('.fig.ghost[data-slotk]'), r = (sl || it).getBoundingClientRect(); w = r.width; h = r.height;
        fl = document.createElement('div'); fl.className = 'fgfloat'; fl.style.cssText = `width:${w}px;height:${h}px`;
        fl.innerHTML = figHtml(a, c); document.body.appendChild(fl); hydrate(fl); it.classList.add('away'); SND.peel(); moved = true; place(); };
      const place = () => { rot += (Math.max(-14, Math.min(14, vx * .9)) - rot) * .25; vx *= .8;
        fl.style.transform = `translate(${px - w / 2}px, ${py - h / 2}px) rotate(${rot.toFixed(2)}deg) scale(1.06)`;
        const tgt = vw.querySelector(`[data-slotk="${CSS.escape(k)}"]`); vw.querySelectorAll('.tostick.near').forEach(x => x !== tgt && x.classList.remove('near'));
        if (tgt) { const r = tgt.getBoundingClientRect(); tgt.classList.toggle('near', Math.abs(r.left + r.width / 2 - px) < r.width && Math.abs(r.top + r.height / 2 - py) < r.height); }
        if (Math.abs(rot) > .2 || Math.abs(vx) > .1) raf = requestAnimationFrame(place); else raf = 0; };
      const mv = m => { if (!moved && Math.hypot(m.clientX - x0, m.clientY - y0) < 6) return; if (!moved) start(); vx = m.clientX - px; px = m.clientX; py = m.clientY; if (!raf) raf = requestAnimationFrame(place); };
      const up = () => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); cancelAnimationFrame(raf);
        if (!moved) { const leaf = leaves(a).findIndex(x => x.html?.includes(`data-slotk="${esc(k)}"`)); if (leaf >= 0) goLeaf(leaf); return; }
        const tgt = vw.querySelector(`[data-slotk="${CSS.escape(k)}"]`), back = () => { const r = it.getBoundingClientRect();
          fl.style.transition = 'transform .35s cubic-bezier(.3,1.4,.5,1)'; fl.style.transform = `translate(${r.left}px, ${r.top}px) scale(${r.width / w})`; setTimeout(() => { fl.remove(); it.classList.remove('away'); }, 360); };
        const under = document.elementsFromPoint(px, py).find(x => x.matches?.('[data-slotk]'));
        if (!tgt) { SND.nope(); back(); return toast(`<b>Su lugar está en otra hoja</b><small>Tocá la figu (sin arrastrar) y te llevo a su página.</small>`, { cls:'info', ms:3000 }); }
        const r = tgt.getBoundingClientRect(), dx = px - (r.left + r.width / 2), dy = py - (r.top + r.height / 2), dist = Math.hypot(dx, dy);
        if (under && under !== tgt) { SND.nope(); back(); return toast('<b>Esa no va ahí</b><small>Fijate el número de la silueta.</small>', { cls:'info', ms:2200 }); }
        if (dist > r.width * .55) { SND.nope(); return back(); }
        const acc = Math.max(0, Math.min(100, Math.round(100 - dist / r.width * 40))), perfect = acc >= 99, bonus = perfect ? ECO.perfect[c.rar || 'c'] : 0;
        fl.style.transition = 'transform .16s cubic-bezier(.2,.9,.3,1.2)'; fl.style.transform = `translate(${r.left}px, ${r.top}px) scale(${r.width / w})`;
        setTimeout(() => { SND.snap(); if (perfect) SND.perfect();
          add({ id:'st-' + k, ty:'stick', k, acc, n:bonus }); pushSoon();
          const badge = document.createElement('div'); badge.className = 'fgacc' + (perfect ? ' perf' : '');
          badge.innerHTML = perfect ? `<b>¡PEGADO PERFECTO!</b><small>${acc}% · +${bonus} ${VC}</small>` : `<b>${acc}%</b><small>${acc >= 95 ? '¡Casi perfecto!' : acc >= 85 ? 'Bien pegada' : 'Medio torcida, pero entró'}</small>`;
          badge.style.cssText = `left:${r.left + r.width / 2}px;top:${r.top + r.height / 2}px`; document.body.appendChild(badge); setTimeout(() => badge.remove(), perfect ? 2200 : 1400);
          fl.remove(); checkDone(a); render();
          const nf = $('v-figus').querySelector(`.bkview .fig[data-k="${CSS.escape(k)}"]`); nf?.classList.add('justin'); }, 170); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up);
    });
  }

  /* ---------------- 🎨 la tapa: diseños que se compran y stickers que se pegan donde quieras ---------------- */
  function coverPanel(v, a, vw) {
    const P = v.querySelector('.bkcovp'), d = derive(), cur = a.cover || 'clasica';
    const saveA = () => { a.upd = Date.now(); st.albums[a.id] = a; saveSt(); pushSoon(); };
    P.hidden = false;
    P.innerHTML = `<div class="btns"><b>🎨 La tapa de «${esc(a.name)}»</b><span class="sp"></span><button data-cx>Listo</button></div>
      <div class="cvgrid">${Object.entries(COVERS).map(([k, t]) => { const own = d.covers.has(k), cost = ECO.covers[k];
        return `<div class="cvopt ${cur === k ? 'on' : ''}"><div class="cvsw cv-${k}"><span>Aa</span></div><b>${t}</b>${own ? `<button data-cuse="${k}" ${cur === k ? 'disabled' : ''}>${cur === k ? 'Puesta' : 'Usar'}</button>` : `<button data-cbuy="${k}">Comprar · ${coinTxt(cost)}</button>`}</div>`; }).join('')}</div>
      <p class="mut">Stickers: arrastralos a la tapa. Arriba de uno: la ruedita lo gira, Shift + ruedita lo agranda, doble clic lo saca.</p>
      <div class="cvstk">${STK.map(e => `<span data-snew="${e}">${e}</span>`).join('')}</div>`;
    P.querySelector('[data-cx]').onclick = () => { P.hidden = true; };
    P.querySelectorAll('[data-cuse]').forEach(b => b.onclick = () => { a.cover = b.dataset.cuse; saveA(); view.cov = true; render(); });
    P.querySelectorAll('[data-cbuy]').forEach(b => b.onclick = () => { const k = b.dataset.cbuy, cost = ECO.covers[k];
      if (derive().coins < cost) return toast(`<b>Te faltan vaccoins</b><small>Esa tapa sale ${cost}.</small>`, { cls:'info' });
      if (!confirm(`¿Comprar la tapa «${COVERS[k]}» por ${cost} vaccoins? Después la podés usar en todos tus álbumes.`)) return;
      add({ id:'cv-' + k, ty:'cover', d:k, cost }); a.cover = k; saveA(); view.cov = true; render(); });
    const coverRect = () => vw.querySelector('.bkcover')?.getBoundingClientRect();
    const drag = (e, emoji, idx) => { e.preventDefault(); const fl = document.createElement('div'); fl.className = 'fgstkfl'; fl.textContent = emoji; document.body.appendChild(fl);
      const sz = idx !== undefined ? a.stk[idx].s || 1 : 1; fl.style.fontSize = 44 * sz + 'px';
      const mv = m => fl.style.transform = `translate(${m.clientX}px, ${m.clientY}px) translate(-50%,-50%)`; mv(e);
      const up = u => { removeEventListener('pointermove', mv); removeEventListener('pointerup', up); fl.remove(); const r = coverRect(); a.stk = a.stk || [];
        const inside = r && u.clientX > r.left && u.clientX < r.right && u.clientY > r.top && u.clientY < r.bottom;
        const pos = inside ? { x:+((u.clientX - r.left) / r.width * 100).toFixed(1), y:+((u.clientY - r.top) / r.height * 100).toFixed(1) } : null;
        if (idx !== undefined) { if (pos) Object.assign(a.stk[idx], pos); else a.stk.splice(idx, 1); }
        else if (pos) { if (a.stk.length >= 40) return toast('<b>Máximo 40 stickers por tapa</b>', { cls:'info' }); a.stk.push({ e:emoji, ...pos, r:Math.round(Math.random() * 30 - 15), s:1 }); SND.snap(); }
        else return;
        saveA(); view.cov = true; render(); };
      addEventListener('pointermove', mv); addEventListener('pointerup', up); };
    P.querySelectorAll('[data-snew]').forEach(s => s.onpointerdown = e => drag(e, s.dataset.snew));
    vw.querySelectorAll('.bkstk [data-si]').forEach(s => {
      s.onpointerdown = e => { const i = +s.dataset.si; s.style.opacity = .2; drag(e, a.stk[i].e, i); };
      s.ondblclick = () => { a.stk.splice(+s.dataset.si, 1); saveA(); view.cov = true; render(); };
      s.onwheel = e => { e.preventDefault(); const x = a.stk[+s.dataset.si]; if (e.shiftKey) x.s = Math.max(.5, Math.min(3, +(((x.s || 1) - Math.sign(e.deltaY) * .1).toFixed(2)))); else x.r = ((x.r || 0) + Math.sign(e.deltaY) * 8) % 360;
        s.style.setProperty('--r', x.r + 'deg'); s.style.setProperty('--s', x.s || 1); clearTimeout(s._t); s._t = setTimeout(saveA, 600); }; });
    vw.querySelector('.bkcover')?.classList.add('editing');
  }
  let bookKeys = null, wasNarrow = null, pasteFn = null, pasteTo = null, hoverSlot = null;
  addEventListener('paste', e => Nav.current === 'figus' && pasteFn && pasteFn(e));
  addEventListener('keydown', e => bookKeys && bookKeys(e), true);
  addEventListener('resize', () => { const n = narrow(); if (wasNarrow !== null && n !== wasNarrow && Nav.current === 'figus' && view.alb && !view.edit) render(); wasNarrow = n; });
  // 📖 una página: grilla común, o "mesa" (doble página con la escenografía del programa: conducción al centro, panelistas a los costados)
  function pageHtml(a, pg, cards, h) {
    const cell = c => cellHtml(a, c, h);
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
    const f = c.ficha || {}, FS = fieldsOf(a), val = x => f[x.k];
    const chips = [...FS.filter(x => x.ty === 'area' && val(x)).map(x => `<span class="fchip">${AREAS[val(x)] || esc(val(x))}</span>`), c.role ? `<span class="fchip">${ROLES[c.role]}</span>` : ''].join('');
    const rows = FS.filter(x => x.ty !== 'area' && val(x)).map(x => {
      if (x.ty === 'scale') { const b = Math.max(0, Math.min(5, +val(x) || 0)); return b ? `<p><b>${esc(x.ic || '⭐')} ${esc(x.l)}:</b> <span class="fbardo">${(x.ic || '⭐').repeat(b)}${'·'.repeat(5 - b)}</span></p>` : ''; }
      if (x.ty === 'quote') return `<p class="fmule">“${esc(val(x))}”</p>`;
      if (x.ty === 'long') return `<p>${esc(val(x)).replace(/\n/g, '<br>')}</p>`;
      return `<p><b>${esc(x.l)}:</b> ${esc(val(x))}</p>`; }).join('');
    return `<div class="fgficha" style="${cv(a)}"><h3>${esc(c.name || 'Figu #' + c.n)}</h3><div>${chips}</div>${rows}
      ${!rows && !chips ? '<p class="mut">Todavía no le cargaste la ficha (✎ Editar álbum → 📝 Ficha).</p>' : ''}
      <small class="mut">#${c.n} · ${esc(a.name)} · ${RAR[c.rar || 'c']}</small></div>`;
  }
  function zoom(f) { let o = $('fgZoom'); if (!o) { o = document.createElement('div'); o.id = 'fgZoom'; o.onclick = () => o.remove(); }
    const x = keyCard(f.dataset.k || '');
    o.className = tvDev() ? 'fgstatic' : ''; o.innerHTML = `<div class="fgzwrap">${f.outerHTML}${x?.c ? fichaHtml(x.a, x.c) : ''}</div>${x?.c && !tvDev() ? pinBtn('fig', f.dataset.k) : ''}`; document.body.appendChild(o);
    const big = o.querySelector('.fig'); big.classList.add('big'); big.classList.remove('tilting', 'justin'); big.removeAttribute('tabindex'); bindPin(o); hydrate(o); if (pcDev()) tilt(o); }

  function renderEdit(v, a) {
    if (!work) work = JSON.parse(JSON.stringify(a));
    const W = work, pages = W.pages?.length ? W.pages : (W.pages = [{ t:'Página 1', txt:'' }]);
    if (!W.fields) W.fields = JSON.parse(JSON.stringify(fieldsOf(W))); if (!W.theme) W.theme = themeOf(W);
    const FS = W.fields, mesa = pages.some(p => p.lay === 'mesa');
    v.innerHTML = header() + `<div class="fgedit">
      <div class="btns"><button data-back>← Volver sin guardar</button><span class="sp"></span><span class="mut" id="fgDirty"></span><button class="pri" data-savealb>Guardar cambios</button></div>
      <div class="fgedgrid">
        <div class="box"><h3>El álbum</h3>
          <label>Nombre</label><input data-f="name" value="${esc(W.name)}">
          <label>De qué es</label><select data-f="theme">${Object.entries(THEMES).map(([k, t]) => `<option value="${k}" ${themeOf(W) === k ? 'selected' : ''}>${t.t}</option>`).join('')}</select>
          <label>Cómo se consiguen los sobres</label><select data-f="kind">${Object.entries(KINDS).map(([k, t]) => `<option value="${k}" ${(W.kind || 'canal') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <label>Estilo de plantilla</label><select data-f="style">${Object.entries(STYLES).map(([k, t]) => `<option value="${k}" ${W.style === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          <label>Colores <small class="mut">(pegá el código hex, hasta 3: el más llamativo primero)</small></label>
          <div class="fgcolors">${[0, 1, 2].map(i => `<span><input type="color" data-ci="${i}" value="${/^#[0-9a-f]{6}$/i.test(W.colors[i] || '') ? W.colors[i] : '#000000'}"><input data-ch="${i}" value="${esc(W.colors[i] || '')}" placeholder="#RRGGBB" maxlength="9"></span>`).join('')}</div>
          <label>Logo <small class="mut">(opcional)</small></label><div class="fglogoed"><div class="fgalogo ${pasteTo === 'logo' ? 'tgt' : ''}" data-img="${esc(W.logo || '')}" data-slot="logo"></div><label class="petadd"><input type="file" accept="image/*" data-logo hidden>＋ Subir</label><button type="button" class="petadd" data-paste="logo">📋 Pegar</button></div>
          <div class="fgnums"><span><label>Cantidad de figus</label><input type="number" min="1" max="150" data-f="size" value="${W.cards.length}"></span>
            <span><label>Figus por hoja</label><select data-f="per">${[1, 2, 4, 6, 8, 9, 12].map(n => `<option ${(+W.per || 6) === n ? 'selected' : ''}>${n}</option>`).join('')}</select></span></div>
          <div class="fgprev">${figHtml(W, W.cards.find(c => c.img) || { n:1, name:'Así se ve', rar:'r', img:'' })}${figHtml(W, { n:2, name:'Legendaria', rar:'l', img:W.cards.find(c => c.img && c.rar === 'l')?.img || '' })}</div>
        </div>
        <div class="box"><h3>La historia</h3><textarea data-f="story" rows="6" placeholder="${esc(THEMES[themeOf(W)].story || 'La presentación del álbum (va en la primera hoja)')}">${esc(W.story || '')}</textarea>
          <h3>Páginas <small class="mut">(cada una ocupa las hojas que necesite)</small></h3>
          <div class="fgpages">${pages.map((p, i) => `<div class="fgpg"><input data-pt="${i}" value="${esc(p.t)}" placeholder="Nombre de la página (ej: el programa)"><textarea data-px="${i}" rows="2" placeholder="Texto de esa página (opcional)">${esc(p.txt || '')}</textarea>
            <div class="fgpgopt"><select data-pl="${i}">${Object.entries(LAYS).map(([k, t]) => `<option value="${k}" ${(p.lay || '') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
              ${p.lay === 'mesa' ? `<label class="petadd fgbgup ${pasteTo === 'pbg:' + i ? 'tgt' : ''}" data-img="${esc(p.bg || '')}" data-slot="pbg:${i}"><input type="file" accept="image/*" data-pbg="${i}" hidden>🖼️ Escenografía</label><button type="button" class="petadd" data-paste="pbg:${i}">📋</button><input type="color" data-pc="${i}" value="${/^#[0-9a-f]{6}$/i.test(p.col || '') ? p.col : '#1238b5'}" title="Color de la mesa">` : ''}</div>
            ${pages.length > 1 ? `<button data-pdel="${i}" title="Borrar página">✕</button>` : ''}</div>`).join('')}</div>
          <button data-padd>＋ Página</button>
          <h3>📝 La ficha de cada figu <small class="mut">(lo que aparece al tocarla)</small></h3>
          <div class="fgflds">${FS.map((x, i) => `<div class="fgfld"><input data-fl="${i}" value="${esc(x.l)}" placeholder="Nombre del dato"><select data-ft="${i}">${Object.entries(FTY).map(([k, t]) => `<option value="${k}" ${x.ty === k ? 'selected' : ''}>${t}</option>`).join('')}</select>${x.ty === 'scale' ? `<input data-fi="${i}" value="${esc(x.ic || '⭐')}" maxlength="4" title="Emoji de la escala" class="fgfic">` : ''}<button data-fdel="${i}" title="Sacar">✕</button></div>`).join('')}</div>
          <button data-fadd>＋ Dato</button></div>
      </div>
      <h3>Las figus</h3><p class="mut fgpastehint">Para cada figu: tocá el cuadro para <b>subir</b> una imagen o gif, o copiá una imagen (de una página, WhatsApp, captura…) y apretá <b>📋 Pegar</b>. En la compu también podés hacer <b>Ctrl+V</b>: va al cuadro que tenés el mouse encima o, si no, a la próxima figu sin imagen (y sigue con la siguiente, así pegás varias seguidas).</p>
      <div class="fgcards">${W.cards.map((c, i) => `<div class="fgced rar-${c.rar || 'c'}">
          <label class="fgcimg ${pasteTo === 'cimg:' + i ? 'tgt' : ''}" data-img="${esc(c.img || '')}" data-slot="cimg:${i}"><input type="file" accept="image/*" data-cimg="${i}" hidden><span>#${c.n}<br>＋ subir</span><button type="button" class="fgpaste" data-paste="cimg:${i}" title="Pegar la imagen copiada">📋 Pegar</button></label>
          <input data-cn="${i}" value="${esc(c.name || '')}" placeholder="Nombre">
          <select data-cp="${i}">${pages.map((p, j) => `<option value="${j}" ${(c.page || 0) === j ? 'selected' : ''}>${esc(p.t || 'Página ' + (j + 1))}</option>`).join('')}</select>
          <select data-cr="${i}">${Object.entries(RAR).map(([k, t]) => `<option value="${k}" ${(c.rar || 'c') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>
          ${mesa ? `<select data-crol="${i}">${Object.entries(ROLES).map(([k, t]) => `<option value="${k}" ${(c.role || '') === k ? 'selected' : ''}>${t}</option>`).join('')}</select>` : ''}
          ${FS.length ? `<details class="fgfed"><summary>📝 Ficha</summary>${FS.map(x => { const val = c.ficha?.[x.k] ?? '', key = `${i}|${esc(x.k)}`;
            if (x.ty === 'area') return `<select data-ff="${key}">${Object.entries(AREAS).map(([k, t]) => `<option value="${k}" ${val === k ? 'selected' : ''}>${t}</option>`).join('')}</select>`;
            if (x.ty === 'scale') return `<label class="mut" style="font-size:12px">${esc(x.ic || '⭐')} ${esc(x.l)}: <input type="range" min="0" max="5" data-ff="${key}" value="${+val || 0}"></label>`;
            if (x.ty === 'long') return `<textarea data-ff="${key}" rows="2" placeholder="${esc(x.l)}">${esc(val)}</textarea>`;
            return `<input data-ff="${key}" value="${esc(val)}" placeholder="${esc(x.l)}">`; }).join('')}</details>` : ''}</div>`).join('')}</div>
      <div class="btns" style="margin-top:14px"><button data-delalb class="danger">🗑 Borrar álbum</button><span class="sp"></span><button class="pri" data-savealb>Guardar cambios</button></div></div>`;
    bindCommon(v);
    const dirty = () => { $('fgDirty').textContent = JSON.stringify(work) !== JSON.stringify(st.albums[a.id]) ? 'Hay cambios sin guardar' : ''; };
    const re = () => { renderEdit(v, a); };
    v.querySelectorAll('[data-f]').forEach(x => x.onchange = () => {
      const f = x.dataset.f;
      if (f === 'size') { const n = Math.max(1, Math.min(150, +x.value || 20)); if (n < W.cards.length && W.cards.slice(n).some(c => c.img) && !confirm(`Las figus de la ${n + 1} a la ${W.cards.length} se borran (algunas tienen imagen). ¿Seguro?`)) return re();
        while (W.cards.length < n) W.cards.push({ n:W.cards.length + 1, name:'', page:pages.length - 1, rar:'c', img:'' }); W.cards.length = n; return re(); }
      if (f === 'per') { W.per = +x.value; return dirty(); }
      W[f] = x.value; if (f === 'style' || f === 'kind' || f === 'theme') re(); else dirty(); });
    v.querySelectorAll('[data-fl]').forEach(x => x.oninput = () => { FS[+x.dataset.fl].l = x.value; dirty(); });
    v.querySelectorAll('[data-ft]').forEach(x => x.onchange = () => { FS[+x.dataset.ft].ty = x.value; re(); });
    v.querySelectorAll('[data-fi]').forEach(x => x.oninput = () => { FS[+x.dataset.fi].ic = x.value; dirty(); });
    v.querySelectorAll('[data-fdel]').forEach(x => x.onclick = () => { FS.splice(+x.dataset.fdel, 1); re(); });
    v.querySelector('[data-fadd]').onclick = () => { FS.push(F('f' + uid(), 'Dato nuevo')); re(); };
    v.querySelectorAll('[data-ch]').forEach(x => x.oninput = () => { W.colors[+x.dataset.ch] = x.value.trim(); W.colors = W.colors.map(c => c || ''); if (/^#[0-9a-f]{3,8}$/i.test(x.value.trim()) || !x.value) { const p = v.querySelector(`[data-ci="${x.dataset.ch}"]`); if (/^#[0-9a-f]{6}$/i.test(x.value)) p.value = x.value; v.querySelectorAll('.fgprev .fig').forEach(f => f.setAttribute('style', cv(W))); } dirty(); });
    v.querySelectorAll('[data-ci]').forEach(x => x.oninput = () => { W.colors[+x.dataset.ci] = x.value; v.querySelector(`[data-ch="${x.dataset.ci}"]`).value = x.value; v.querySelectorAll('.fgprev .fig').forEach(f => f.setAttribute('style', cv(W))); dirty(); });
    v.querySelectorAll('[data-pt]').forEach(x => x.oninput = () => { pages[+x.dataset.pt].t = x.value; dirty(); });
    v.querySelectorAll('[data-px]').forEach(x => x.oninput = () => { pages[+x.dataset.px].txt = x.value; dirty(); });
    v.querySelectorAll('[data-pdel]').forEach(x => x.onclick = () => { const i = +x.dataset.pdel; pages.splice(i, 1); W.cards.forEach(c => { if ((c.page || 0) === i) c.page = 0; else if (c.page > i) c.page--; }); re(); });
    v.querySelector('[data-padd]').onclick = () => { pages.push({ t:'Página ' + (pages.length + 1), txt:'' }); re(); };
    v.querySelectorAll('[data-cn]').forEach(x => x.oninput = () => { W.cards[+x.dataset.cn].name = x.value; dirty(); });
    v.querySelectorAll('[data-crol]').forEach(x => x.onchange = () => { W.cards[+x.dataset.crol].role = x.value; dirty(); });
    v.querySelectorAll('[data-ff]').forEach(x => x.oninput = x.onchange = () => { const [i, k] = x.dataset.ff.split('|'); const c = W.cards[+i]; c.ficha = c.ficha || {}; c.ficha[k] = x.type === 'range' ? +x.value : x.value; dirty(); });
    v.querySelectorAll('[data-pl]').forEach(x => x.onchange = () => { pages[+x.dataset.pl].lay = x.value; re(); });
    v.querySelectorAll('[data-pc]').forEach(x => x.oninput = () => { pages[+x.dataset.pc].col = x.value; dirty(); });
    v.querySelectorAll('[data-pbg]').forEach(x => x.onchange = () => x.files[0] && up(x.files[0], id => { pages[+x.dataset.pbg].bg = id; }, 1280));
    v.querySelectorAll('[data-cp]').forEach(x => x.onchange = () => { W.cards[+x.dataset.cp].page = +x.value; dirty(); });
    v.querySelectorAll('[data-cr]').forEach(x => x.onchange = () => { W.cards[+x.dataset.cr].rar = x.value; x.closest('.fgced').className = 'fgced rar-' + x.value; dirty(); });
    const up = async (file, set, max) => { try { const u = await readImg(file, max), id = 'i' + uid() + Date.now().toString(36); await imgPut(id, u); urlCache[id] = u; set(id); re(); } catch (e) { toast(`<b>${esc(e.message)}</b>`, { cls:'info' }); } };
    v.querySelectorAll('[data-cimg]').forEach(x => x.onchange = () => x.files[0] && up(x.files[0], id => { W.cards[+x.dataset.cimg].img = id; }));
    // 📋 pegar: a qué cuadro va, y después saltar a la próxima figu vacía
    const setFor = key => { const [t, i] = key.split(':'); return t === 'cimg' ? id => { W.cards[+i].img = id; } : t === 'logo' ? id => { W.logo = id; } : id => { pages[+i].bg = id; }; };
    const nextEmpty = (from = -1) => { const i = W.cards.findIndex((c, j) => j > from && !c.img); return i >= 0 ? 'cimg:' + i : null; };
    const pasteIn = (key, file) => { if (!key) return toast('<b>Todas las figus ya tienen imagen</b><small>Pasá el mouse por la que quieras cambiar y pegá.</small>', { cls:'info' });
      if (key.startsWith('cimg:')) pasteTo = nextEmpty(+key.split(':')[1]); up(file, setFor(key), key.startsWith('pbg') ? 1280 : undefined); };
    v.querySelectorAll('[data-slot]').forEach(x => x.addEventListener('mouseenter', () => { hoverSlot = x.dataset.slot; }));
    v.querySelectorAll('[data-slot]').forEach(x => x.addEventListener('mouseleave', () => { if (hoverSlot === x.dataset.slot) hoverSlot = null; }));
    v.querySelectorAll('[data-paste]').forEach(b => b.onclick = async e => { e.preventDefault(); e.stopPropagation();
      try { const [f] = await clipImages(); pasteIn(b.dataset.paste, f); } catch (er) { toast(`<b>${esc(er.message)}</b>`, { cls:'info' }); } });
    pasteFn = e => { if (!document.body.contains(v.querySelector('.fgedit'))) return; const [f] = pastedImages(e); if (!f) return;
      e.preventDefault(); pasteIn(hoverSlot || (pasteTo && !(pasteTo.startsWith('cimg:') && W.cards[+pasteTo.split(':')[1]]?.img) ? pasteTo : nextEmpty()), f); };
    v.querySelector('[data-logo]').onchange = e => e.target.files[0] && up(e.target.files[0], id => { W.logo = id; });
    v.querySelector('[data-back]').onclick = () => { if (JSON.stringify(work) !== JSON.stringify(st.albums[a.id]) && !confirm('¿Salir sin guardar los cambios?')) return; work = null; view.edit = false; render(); };
    v.querySelectorAll('[data-savealb]').forEach(b => b.onclick = () => { W.colors = (W.colors || []).filter(Boolean); W.upd = Date.now(); st.albums[a.id] = JSON.parse(JSON.stringify(W)); work = null; markDirty(a.id); saveSt(); pushSoon(); toast('🃏 Álbum guardado', { ms:1800 }); view.edit = false; checkDone(st.albums[a.id]); render(); });
    v.querySelector('[data-delalb]').onclick = () => { if (!confirm(`¿Borrar el álbum "${a.name}"? Las figus que tenías de ese álbum se pierden.`)) return; st.albums[a.id] = { id:a.id, del:true, upd:Date.now() }; work = null; saveSt(); pushSoon(); view = { tab:'albumes' }; render(); };
    dirty(); hydrate(v);
  }

  /* ---------------- 🏎️ el Garage: dibujo 2D (SVG, liviano), cajas y vitrina ---------------- */
  // cada pieza es una parte del dibujo: si la tenés va pintada con los colores del equipo; si no, solo el contorno
  // el número tiene que leerse siempre: blanco o negro según lo claro que sea el fondo
  const ink = hex => { const h = hex.replace('#', ''), n = parseInt(h.length === 3 ? h.split('').map(x => x + x).join('') : h, 16), r = n >> 16 & 255, g = n >> 8 & 255, b = n & 255; return (r * 299 + g * 587 + b * 114) / 1000 > 150 ? '#0b0b0b' : '#ffffff'; };
  const NUM = (x, y, size, fill, n, extra = '') => `<text x="${x}" y="${y}" fill="${fill}" font-size="${size}" font-weight="900" font-family="Oswald, Impact, system-ui, sans-serif" font-style="italic" text-anchor="middle" ${extra}>${n}</text>`;
  function carSvg(m, got) {
    const has = id => got.includes(id), P = (id, d, fill, extra = '') => has(id) ? `<path d="${d}" fill="${fill}" ${extra}/>` : `<path d="${d}" fill="none" stroke="#ffffff38" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    const W = (id, cx, cy, r) => has(id) ? `<circle cx="${cx}" cy="${cy}" r="${r}" fill="#121212"/><circle cx="${cx}" cy="${cy}" r="${r * .55}" fill="${m.c3}"/><circle cx="${cx}" cy="${cy}" r="${r * .2}" fill="#bbb"/>` : `<circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#ffffff38" stroke-width="1.5" stroke-dasharray="4 3"/>`;
    if (m.s === 'f1') return `<svg viewBox="0 0 400 124" class="gsvg">
      ${P('alerona', 'M328 26 L388 22 L390 38 L330 42 Z', m.c3)}${P('alerona', 'M352 40 L361 40 L350 68 L341 68 Z', m.c1)}
      ${P('chasis', 'M36 88 L60 79 L150 71 L190 59 L252 57 L302 61 L348 67 L352 86 L60 96 Z', m.c1)}
      ${has('chasis') ? `<path d="M60 85 L150 77 L190 66 L250 64 L300 67 L347 72 L348 77 L300 72 L250 70 L190 72 L150 82 L60 90 Z" fill="${m.c3}"/><path d="M36 88 L54 81 L58 95 L40 96 Z" fill="${m.c2}"/>` : ''}
      ${P('pontones', 'M174 73 L232 65 L302 67 L306 84 L180 88 Z', m.c2)}
      ${P('motor', 'M214 57 L234 33 L256 33 L302 59 L250 59 Z', m.c3)}
      ${has('motor') ? NUM(254, 54, 19, ink(m.c3), m.num) : ''}
      ${P('halo', 'M168 58 Q195 38 228 52 L224 55 Q196 44 172 60 Z', '#2a2a2a')}
      ${P('volante', 'M181 55 L193 55 L193 61 L181 61 Z', '#3a3a3a')}
      ${P('casco', 'M196 52 a11 11 0 1 1 22 0 L218 58 L196 58 Z', m.c2, `stroke="${m.c3}" stroke-width="2"`)}${has('casco') ? '<path d="M206 50 L218 50 L218 54 L206 54 Z" fill="#0b0b0b"/>' : ''}
      ${P('alerond', 'M6 94 L72 94 L68 102 L2 102 Z', m.c3)}${P('alerond', 'M8 82 L15 82 L13 102 L6 102 Z', m.c2)}
      ${W('ruedad', 96, 92, 22)}${W('ruedat', 318, 90, 25)}
      ${has('chasis') ? NUM(146, 87, 13, ink(m.c1), m.num) : ''}</svg>`;
    // 🏍️ moto de perfil (de frente a la izquierda): ruedas, basculante y chasis, motor, escape, horquilla, carenado con burbuja, tanque y colín, alerones y el casco apoyado en el asiento
    return `<svg viewBox="0 0 300 210" class="gsvg">
      ${W('ruedad', 70, 160, 34)}${W('ruedat', 232, 160, 36)}
      ${P('chasis', 'M150 72 L198 74 L234 156 L222 162 L186 98 L150 98 Z', '#6b6f78')}
      ${P('motor', 'M130 96 L178 96 L188 130 L140 136 Z', '#34363c')}
      ${P('escape', 'M188 106 L246 82 L252 92 L194 116 Z', '#b3b6bb')}
      ${has('horquilla') ? '<path d="M70 160 L102 78" stroke="#d7d9dd" stroke-width="8" stroke-linecap="round"/><path d="M70 160 L102 78" stroke="#ffd34d" stroke-width="3" stroke-linecap="round" opacity=".7"/>' : '<path d="M70 160 L102 78" stroke="#ffffff38" stroke-width="1.5" stroke-dasharray="4 3"/>'}
      ${P('carenado', 'M94 70 C102 52 126 44 150 48 L180 56 L192 92 L178 120 L120 124 C104 118 92 106 90 92 Z', m.c1)}
      ${has('carenado') ? `<path d="M118 120 L182 66 L190 78 L134 124 Z" fill="${m.c3}"/><path d="M104 64 C112 50 130 46 146 48 L140 57 C126 55 114 59 108 68 Z" fill="#bcd3e6" opacity=".55"/><ellipse cx="114" cy="64" rx="12" ry="10" fill="${ink(m.c1) === '#ffffff' ? '#ffffff' : '#0b0b0b'}"/>${NUM(114, 69, 13, m.c1, m.num)}` : ''}
      ${P('tanque', 'M150 50 C170 42 192 44 208 54 L252 62 L256 74 L210 78 L186 70 Z', m.c2)}
      ${P('alerones', 'M100 80 L78 74 L80 86 L102 92 Z', m.c3)}
      ${P('casco', 'M206 44 a15 15 0 1 1 30 0 L236 52 L206 52 Z', m.c2, `stroke="${m.c3}" stroke-width="2"`)}${has('casco') ? '<path d="M216 40 L236 40 L236 46 L216 46 Z" fill="#0b0b0b"/>' : ''}
      ${has('carenado') ? NUM(148, 106, 30, ink(m.c1), m.num, `stroke="${m.c3}" stroke-width="1.2" paint-order="stroke"`) : ''}${has('tanque') ? NUM(232, 72, 13, ink(m.c2), m.num) : ''}</svg>`;
  }
  const weekend = s => { try { return Motor.weekend(s); } catch { return { open:false }; } };
  const dt = t => new Date(t).toLocaleString('es-AR', { weekday:'short', day:'numeric', month:'numeric', hour:'2-digit', minute:'2-digit' });
  function garageHtml() {
    const s = view.gs || 'f1', G = GARAGE[s], d = derive(), w = weekend(s);
    const all = models(s), done = all.filter(m => (d.gar[m.key] || []).length >= 10).length;
    return `<div class="fgtabs">${Object.entries(GARAGE).map(([k, g]) => `<button data-gs="${k}" class="${k === s ? 'on' : ''}">${g.ic} ${g.n}</button>`).join('')}</div>
      <div class="gwk ${w.open ? 'on' : ''}">${w.open ? `🟢 <b>Fin de semana de carrera: ${esc(w.name)}</b> · cajas abiertas hasta el ${dt(w.to)}` : w.from ? `🔴 Cajas cerradas · abren el ${dt(w.from)} para el <b>${esc(w.name)}</b>` : '🔴 Cajas cerradas hasta el próximo fin de semana de carrera'}</div>
      <p class="mut">Temporada 2026 · escala 1:18 · ${done}/${all.length} modelos completos. Cada caja trae 2 piezas del piloto que elijas (sin repetir) por ${G.price} vaccoins.</p>
      ${G.teams.map(([team, c1, c2]) => `<div class="gteam" style="--t1:${c1};--t2:${c2}"><h3>${esc(team)}</h3><div class="gmods">${all.filter(m => m.team === team).map(m => { const got = d.gar[m.key] || [], full = got.length >= 10, wn = d.wins[m.key] || [];
        return `<div class="gmod ${full ? 'full' : ''}" style="--t1:${m.c1};--t2:${m.c2}"><button class="gview" data-gmod="${esc(m.key)}">${carSvg(m, got)}</button>
          <div class="ginfo"><span class="gnum" style="background:${m.c1};color:${ink(m.c1)};box-shadow:inset 0 -4px 0 ${m.c3}">${m.num}</span><b>${esc(m.name)}</b><small>${full ? '✅ Modelo completo' : `${got.length}/10 piezas`}${wn.length ? ` · 🏆×${wn.length}` : ''}</small></div>
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
      <h2><span class="gnum big" style="background:${m.c1};color:${ink(m.c1)};box-shadow:inset 0 -5px 0 ${m.c3}">${m.num}</span> ${esc(m.name)}</h2><p class="mut">${esc(m.team)} · ${G.n} · Temporada 2026 · escala 1:18</p>
      <div class="gparts">${G.parts.map(([id, n]) => `<span class="${got.includes(id) ? 'ok' : ''}">${got.includes(id) ? '✓' : '·'} ${n}</span>`).join('')}</div>
      ${wn.length ? `<div class="gwins">${wn.map(g => `<span>🏆 ${esc(g)}</span>`).join('')}</div>` : ''}
      <div class="btns">${got.length >= 10 ? pinBtn('car', key) : ''}<button data-x>Cerrar</button></div></div>`;
    document.body.appendChild(o); o.querySelector('[data-x]').onclick = () => o.remove(); bindPin(o);
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

  /* ---------------- 📌 Portada: tus 3 favoritas (figus o maquetas completas) fijas arriba ---------------- */
  const banner = () => (st.prefs?.banner || []);
  const pinned = (t, k) => banner().some(b => b.t === t && b.k === k);
  const pinBtn = (t, k) => `<button class="fgpin ${pinned(t, k) ? 'on' : ''}" data-pin="${t}|${esc(k)}">${pinned(t, k) ? '📌 Sacar de la portada' : '📌 Fijar en la portada'}</button>`;
  function bindPin(o) { o.querySelectorAll('[data-pin]').forEach(b => b.onclick = e => { e.stopPropagation(); const [t, k] = b.dataset.pin.split('|');
    st.prefs = st.prefs || { banner:[] }; let L = banner().filter(x => !(x.t === t && x.k === k));
    if (L.length === banner().length) { if (L.length >= 3) return toast('<b>Ya tenés 3 en la portada</b><small>Sacá una primero.</small>', { cls:'info' }); L = [...L, { t, k }]; }
    st.prefs.banner = L; st.prefs.upd = Date.now(); saveSt(); pushSoon(); b.outerHTML = pinBtn(t, k); bindPin(o); if (Nav.current === 'figus') render(); }); }
  function bannerHtml() {
    const L = banner(); if (!L.length) return '';
    const it = b => { if (b.t === 'fig') { const x = keyCard(b.k); return x?.c && derive().have[b.k] ? `<div class="fgbn-it">${figHtml(x.a, x.c)}</div>` : ''; }
      const m = modelOf(b.k); return m ? `<div class="fgbn-it car" style="--t1:${m.c1}">${carSvg(m, GARAGE[m.s].parts.map(p => p[0]))}<span class="gnum" style="background:${m.c1};color:${ink(m.c1)}">${m.num}</span></div>` : ''; };
    return `<div class="fgbanner"><div class="fgbn-t">🏛️ MI COLECCIÓN</div><div class="fgbn-row">${L.map(it).join('')}</div></div>`;
  }

  /* ---------------- 🦴 EXPEDICIONES: Vaca reparte huesos a domicilio ----------------
     Sale 2, 4 u 8 horas reales (sigue aunque cierres FUNVS). Vuelve con vaccoins y, según el viaje, una postal del lugar,
     una figu o un repuesto para tus maquetas. El premio sale "sorteado" con el número del viaje: es el mismo en todos tus aparatos. */
  const DEST = ['Monte Grande centro', 'Luis Guillón', 'El Jagüel', '9 de Abril', 'Canning', 'Ezeiza', 'Tristán Suárez', 'Lomas de Zamora', 'Adrogué', 'Temperley', 'Constitución', 'Liniers (Amalfitani)'];
  const TRIPS = { 2:{ vc:[6, 10], post:.25, fig:0, part:0, txt:'Unas cuadras por el barrio' }, 4:{ vc:[14, 22], post:.5, fig:.35, part:0, txt:'Reparto por la zona sur' }, 8:{ vc:[34, 46], post:1, fig:.6, part:.5, txt:'Viaje largo, hasta Liniers' } };
  const rng = seed => { let h = 1779033703; for (const c of seed) h = Math.imul(h ^ c.charCodeAt(0), 3432918353), h = h << 13 | h >>> 19; return () => { h = Math.imul(h ^ h >>> 16, 2246822507); h = Math.imul(h ^ h >>> 13, 3266489909); return ((h ^= h >>> 16) >>> 0) / 4294967296; }; };
  const activeExp = () => Object.values(derive().exps).find(x => !x.ok);
  function startExp(h) {
    if (activeExp()) return toast('<b>Vaca ya está repartiendo</b>', { cls:'info' });
    const r = rng('d' + Date.now()), dest = h === 8 ? DEST[DEST.length - 1 - Math.floor(r() * 4)] : DEST[Math.floor(r() * (h === 2 ? 4 : 8))];
    add({ id:'e' + uid() + Date.now().toString(36), ty:'exp', h, dest, end:Date.now() + h * 3600e3 }); pushSoon(); render();
  }
  function rewardOf(x) {   // sorteo fijo según el viaje
    const r = rng(x.id), T = TRIPS[x.h], d = derive(), out = { vc:Math.round(T.vc[0] + r() * (T.vc[1] - T.vc[0])) };
    if (r() < T.post) out.post = x.dest;
    if (r() < T.fig) { const pool = albums().filter(a => a.kind !== 'vaca').flatMap(a => ready(a).filter(c => (c.rar || 'c') !== 'l' || r() < .15).map(c => a.id + ':' + c.n)); if (pool.length) out.fig = pool[Math.floor(r() * pool.length)]; }
    if (r() < T.part) { const inc = Object.keys(GARAGE).flatMap(models).filter(m => (d.gar[m.key] || []).length < 10 && (d.gar[m.key] || []).length > 0);
      const m = inc.length ? inc[Math.floor(r() * inc.length)] : null; if (m) { const left = GARAGE[m.s].parts.map(p => p[0]).filter(p => !(d.gar[m.key] || []).includes(p)); out.part = [m.key, left[Math.floor(r() * left.length)]]; } }
    return out;
  }
  function claimExp() {
    const x = activeExp(); if (!x || Date.now() < x.end) return;
    const rw = rewardOf(x); add({ id:'ok-' + x.id, ty:'expok', e:x.id, rw }); pushSoon();
    const bits = [`${VC} +${rw.vc}`, rw.post ? `📮 postal de ${esc(rw.post)}` : '', rw.fig ? '🃏 una figu' : '', rw.part ? `🔧 ${esc(GARAGE[modelOf(rw.part[0]).s].parts.find(p => p[0] === rw.part[1])[1])} para el ${esc(modelOf(rw.part[0]).name)}` : ''].filter(Boolean);
    toast(`<b>🦴 ¡Vaca volvió del reparto!</b><small>${bits.join(' · ')}</small>`, { cls:'info', ms:7000 }); render();
  }
  const left = ms => { const m = Math.max(0, Math.ceil(ms / 60e3)); return m >= 60 ? `${Math.floor(m / 60)} h ${m % 60} min` : `${m} min`; };
  function expeHtml() {
    const x = activeExp(), d = derive();
    const now = x ? (Date.now() >= x.end
      ? `<div class="exnow done"><div class="exvaca">🐶🦴</div><div><b>¡Vaca volvió de ${esc(x.dest)}!</b><small>Viaje de ${x.h} h</small></div><button class="pri" data-exclaim>🎁 Cobrar</button></div>`
      : `<div class="exnow"><div class="exvaca run">🐶💨</div><div><b>Repartiendo huesos en ${esc(x.dest)}</b><small>Vuelve en ${left(x.end - Date.now())} (${new Date(x.end).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hour12:false })} h)</small><div class="fgbar"><i style="width:${Math.min(100, (1 - (x.end - Date.now()) / (x.h * 3600e3)) * 100)}%"></i></div></div></div>`)
      : `<div class="exnow idle"><div class="exvaca">🐶</div><div><b>Vaca está en casa, lista para repartir</b><small>Elegí cuánto tiempo sale. Sigue aunque cierres FUNVS.</small></div></div>`;
    return `${now}
      <div class="extrips">${[2, 4, 8].map(h => { const T = TRIPS[h]; return `<div class="extrip"><b>${h} horas</b><small>${T.txt}</small>
        <ul><li>${VC} ${T.vc[0]}–${T.vc[1]}</li><li>📮 postal: ${Math.round(T.post * 100)}%</li>${T.fig ? `<li>🃏 figu: ${Math.round(T.fig * 100)}%</li>` : ''}${T.part ? `<li>🔧 repuesto de maqueta: ${Math.round(T.part * 100)}%</li>` : ''}</ul>
        <button data-exgo="${h}" ${x ? 'disabled' : ''}>🦴 Salir ${h} h</button></div>`; }).join('')}</div>
      <h2 class="sec">📮 Postales de los repartos (${d.posts.size}/${DEST.length})</h2>
      <div class="expost">${DEST.map(p => `<div class="${d.posts.has(p) ? 'ok' : ''}"><span>${d.posts.has(p) ? '📮' : '❔'}</span><b>${d.posts.has(p) ? esc(p) : '???'}</b></div>`).join('')}</div>
      <p class="mut">El repuesto va para una maqueta que ya empezaste. Vaca reparte de a un viaje por vez.</p>`;
  }
  function bindExpe(v) { v.querySelectorAll('[data-exgo]').forEach(b => b.onclick = () => startExp(+b.dataset.exgo)); v.querySelector('[data-exclaim]')?.addEventListener('click', claimExp); }

  /* ---------------- 🌀 LICUADORA: 5 que te sobran → 1 de rareza superior ----------------
     Entran figus repetidas (te queda siempre una) y piezas de maquetas sin terminar. Sale una figu sorteada
     de una rareza más (común/pieza → rara, rara → legendaria, legendaria → legendaria). */
  let pick = [];
  const RANK = { c:1, r:2, e:3, l:4 };
  function blendOut(sel) {
    const avg = sel.reduce((a, x) => a + (x.t === 'f' ? RANK[keyCard(x.k)?.c?.rar || 'c'] : 1), 0) / sel.length, want = Math.min(4, Math.floor(avg) + 1);
    const pool = r => albums().filter(a => a.kind !== 'vaca').flatMap(a => ready(a).filter(c => RANK[c.rar || 'c'] === r).map(c => a.id + ':' + c.n));
    for (let r = want; r >= 1; r--) { const p = pool(r); if (p.length) return { k:p[Math.floor(Math.random() * p.length)], r }; }
    return null;
  }
  function licuaHtml() {
    const d = derive(), dup = Object.entries(d.have).filter(([k, n]) => n > 1 && keyCard(k)?.c).flatMap(([k, n]) => Array.from({ length:n - 1 }, (_, i) => ({ t:'f', k, i })));
    const parts = Object.entries(d.gar).filter(([, p]) => p.length && p.length < 10).flatMap(([m, P]) => P.map(p => ({ t:'p', m, p, k:m + '|' + p })));
    const sel = id => pick.includes(id), want = pick.length ? Math.min(4, Math.floor(pick.reduce((a, id) => { const [t, k] = id.split('§'); return a + (t === 'f' ? RANK[keyCard(k)?.c?.rar || 'c'] : 1); }, 0) / pick.length) + 1) : 0;
    return `<div class="licua"><div class="lcmix ${pick.length === 5 ? 'full' : ''}"><div class="lcjar">${pick.map(() => '<i></i>').join('')}</div><b>${pick.length}/5</b>
        ${pick.length ? `<small>Sale: ${['', 'Común', '◆ Rara', '✦ Épica', '★ Legendaria'][want]}</small>` : '<small>Elegí 5 cosas que te sobren</small>'}
        <button class="pri" data-lcgo ${pick.length === 5 ? '' : 'disabled'}>🌀 Licuar</button>${pick.length ? '<button data-lcclr>Vaciar</button>' : ''}</div>
      <div><h3>🔁 Figus repetidas</h3><div class="fggrid lcgrid">${dup.map(x => { const id = 'f§' + x.k + '§' + x.i, c = keyCard(x.k); return `<button class="lcit ${sel(id) ? 'on' : ''}" data-lc="${esc(id)}">${figHtml(c.a, c.c, { small:true })}</button>`; }).join('') || '<div class="empty">No tenés repetidas.</div>'}</div>
      <h3>🔧 Piezas de maquetas sin terminar</h3><div class="lcparts">${parts.map(x => { const id = 'p§' + x.k, m = modelOf(x.m); return `<button class="lcit lcp ${sel(id) ? 'on' : ''}" data-lc="${esc(id)}" style="--t1:${m.c1}"><span class="gnum" style="background:${m.c1};color:${ink(m.c1)}">${m.num}</span>${esc(GARAGE[m.s].parts.find(p => p[0] === x.p)[1])}</button>`; }).join('') || '<div class="empty">No tenés piezas sueltas.</div>'}</div></div></div>`;
  }
  function bindLicua(v) {
    v.querySelectorAll('[data-lc]').forEach(b => b.onclick = () => { const id = b.dataset.lc; if (pick.includes(id)) pick = pick.filter(x => x !== id); else if (pick.length < 5) pick.push(id); render(); });
    v.querySelector('[data-lcclr]')?.addEventListener('click', () => { pick = []; render(); });
    v.querySelector('[data-lcgo]')?.addEventListener('click', () => {
      const sel = pick.map(id => { const [t, a, b] = id.split('§'); return t === 'f' ? { t, k:a } : { t, m:a.split('|')[0], p:a.split('|')[1] }; });
      const out = blendOut(sel.map(x => x.t === 'f' ? x : { t:'p' }));
      if (!out) return toast('<b>No hay figus con imagen para que salga algo</b>', { cls:'info' });
      if (!confirm('¿Licuar estas 5? No vuelven.')) return;
      const before = { ...derive().have };
      add({ id:'l' + uid() + Date.now().toString(36), ty:'blend', f:sel.filter(x => x.t === 'f').map(x => x.k), p:sel.filter(x => x.t === 'p').map(x => [x.m, x.p]), out:out.k }); pushSoon(); pick = [];
      const x = keyCard(out.k); showPack(x.a, [out.k], before);
    });
  }

  /* ---------------- 🏆 Estante de trofeos (hitos) ---------------- */
  const ACH = [
    ['sobre1', '📦', 'Primer sobre', 'Abriste tu primer sobre', d => d.packs >= 1, 'bronce'],
    ['leg1', '✨', 'Primera legendaria', 'Te salió tu primera figu legendaria', d => d.legs >= 1, 'plata'],
    ['leg10', '🌟', 'Cazador de legendarias', '10 figus legendarias', d => d.legs >= 10, 'oro', d => [d.legs, 10]],
    ['alb1', '📗', 'Primer álbum completado', 'Completaste tu primer álbum', d => d.done.size >= 1, 'plata'],
    ['alb5', '📚', 'Biblioteca', '5 álbumes completos', d => d.done.size >= 5, 'oro', d => [d.done.size, 5]],
    ['alb10', '🏛️', 'Museo propio', '10 álbumes completos', d => d.done.size >= 10, 'platino', d => [d.done.size, 10]],
    ['car1', '🔧', 'Primera maqueta', 'Armaste tu primera maqueta 1:18', d => d.cars >= 1, 'bronce'],
    ['car10', '🏎️', 'Coleccionista de 10 maquetas 1:18', '10 maquetas completas', d => d.cars >= 10, 'oro', d => [d.cars, 10]],
    ['team', '🤝', 'Equipo completo', 'Los dos autos o motos de un mismo equipo', d => d.teams >= 1, 'plata'],
    ['grid', '🏁', 'Grilla completa', 'Los 22 de F1 o las 22 de MotoGP', d => d.grids >= 1, 'platino'],
    ['win1', '🏆', 'Plaquita de campeón', 'Uno de tus modelos ganó un GP', d => d.winsN >= 1, 'bronce'],
    ['vaca10', '🐶', 'Paseadora de Vaca', '10 sobres de Vaca (10 paseos)', d => d.vaca >= 10, 'plata', d => [d.vaca, 10]],
    ['vaca50', '🦮', 'Mejor amiga de Vaca', '50 sobres de Vaca', d => d.vaca >= 50, 'oro', d => [d.vaca, 50]],
    ['racha7', '🔥', 'Una semana seguida', 'Racha de 7 días', d => d.bestStreak >= 7, 'bronce', d => [d.bestStreak, 7]],
    ['racha30', '📅', 'Un mes seguido', 'Racha de 30 días', d => d.bestStreak >= 30, 'oro', d => [d.bestStreak, 30]],
    ['racha100', '💯', 'Cien días', 'Racha de 100 días', d => d.bestStreak >= 100, 'platino', d => [d.bestStreak, 100]],
    ['prode', '🔮', 'Pronosticador', '500 vaccoins ganados con el Prode', d => d.earned.prode >= 500, 'plata', d => [d.earned.prode, 500]],
    ['exp1', '🦴', 'Primer reparto', 'Vaca volvió de su primera expedición', d => d.expDone >= 1, 'bronce'],
    ['exp50', '🚚', 'Delivery profesional', '50 expediciones', d => d.expDone >= 50, 'oro', d => [d.expDone, 50]],
    ['post', '📮', 'Todas las postales', `Las ${12} postales de los repartos`, d => d.posts.size >= 12, 'platino', d => [d.posts.size, 12]],
    ['perf1', '🎯', 'Pulso de cirujano', 'Tu primer pegado perfecto', d => d.perfects >= 1, 'bronce'],
    ['perf25', '🎯', 'Mano de relojero', '25 pegados perfectos', d => d.perfects >= 25, 'oro', d => [d.perfects, 25]],
    ['gold1', '👑', 'Golden', 'Completaste un álbum y sus figus pasaron a Golden', d => d.done.size >= 1, 'platino'],
    ['blend1', '🌀', 'Primer licuado', 'Usaste la licuadora', d => d.blends >= 1, 'bronce'],
    ['vc1k', '🪙', 'Primeros 1.000', '1.000 vaccoins acumulados', d => d.totalEarned >= 1e3, 'bronce', d => [d.totalEarned, 1e3]],
    ['vc10k', '💰', 'Ahorrista', '10.000 vaccoins acumulados', d => d.totalEarned >= 1e4, 'plata', d => [d.totalEarned, 1e4]],
    ['vc100k', '🐮', 'Magnate de los vaccoins', '100.000 vaccoins acumulados', d => d.totalEarned >= 1e5, 'platino', d => [d.totalEarned, 1e5]],
  ];
  function stats() {
    const d = derive(), evs = st.ev;
    const packs = evs.filter(e => e.ty === 'pack').length + (st.base?.packs || 0);
    const legs = Object.entries(d.have).filter(([k]) => keyCard(k)?.c?.rar === 'l').length;
    const full = Object.entries(d.gar).filter(([, p]) => p.length >= 10).map(([k]) => k);
    const teams = Object.keys(GARAGE).reduce((n, s) => n + GARAGE[s].teams.filter(([t, , , , ds]) => ds.every(([num]) => full.includes(s + ':' + num))).length, 0);
    const grids = Object.keys(GARAGE).filter(s => models(s).every(m => full.includes(m.key))).length;
    const vaca = evs.filter(e => e.ty === 'tok' && e.k === 'vaca').length;
    const days = [...d.dailies].sort(); let best = 0, run = 0, prev = null;
    for (const x of days) { const t = Date.parse(x + 'T12:00:00'); run = prev && t - prev < 1.5 * 864e5 ? run + 1 : 1; best = Math.max(best, run); prev = t; }
    return { ...d, packs, legs, cars:full.length, teams, grids, vaca, bestStreak:best, winsN:Object.values(d.wins).flat().length,
      totalEarned:d.earned.slot + d.earned.daily + d.earned.prode + d.earned.sell + (d.earned.exp || 0) };
  }
  function achList() { const d = stats(); return ACH.map(([id, ic, n, txt, test, tier, prog]) => ({ id, ic, n, txt, tier, ok:test(d), prog:prog ? prog(d) : null, at:st.ev.find(e => e.id === 'ach-' + id)?.t })); }
  function achCheck() {   // anoto cuándo ganaste cada trofeo (para el recuerdo) y aviso
    for (const a of achList()) if (a.ok && !has('ach-' + a.id)) { add({ id:'ach-' + a.id, ty:'ach' }); if (!tvDev()) toast(`<b>🏆 Trofeo: ${esc(a.n)}</b><small>${esc(a.txt)}</small>`, { cls:'info', ms:6000, onclick:() => { Nav.go('figus'); view = { tab:'trofeos' }; render(); } }); }
  }
  function trofeosHtml() {
    const L = achList(), ok = L.filter(a => a.ok).length;
    return `<p class="mut">${ok}/${L.length} trofeos. Para la portada: abrí una figu pegada o una maqueta completa y tocá "📌 Fijar en la portada" (hasta 3).</p>
      <div class="fgshelf">${L.map(a => `<div class="fgtr ${a.ok ? 'ok t-' + a.tier : ''}" title="${esc(a.txt)}">
        <div class="fgmed">${a.ic}</div><b>${esc(a.n)}</b><small>${esc(a.txt)}</small>
        ${a.ok ? `<small class="fgdate">${a.at ? new Date(a.at).toLocaleDateString('es-AR') : ''}</small>` : a.prog ? `<div class="fgbar"><i style="width:${Math.min(100, a.prog[0] / a.prog[1] * 100)}%"></i></div><small>${Math.min(a.prog[0], a.prog[1]).toLocaleString('es-AR')} / ${a.prog[1].toLocaleString('es-AR')}</small>` : '<small>🔒</small>'}</div>`).join('')}</div>`;
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
    document.addEventListener('keydown', e => { if ((e.key === 'Enter' || e.key === ' ') && e.target.matches?.('#v-figus .fig[data-k]')) { e.preventDefault(); zoom(e.target); } });
    setInterval(slotTick, 60e3); setTimeout(slotTick, 5000);
    setInterval(() => { try { prode(); } catch {} velezTok(); try { wins(); } catch {} try { achCheck(); } catch {} }, 10 * 60e3);
    let avisado = '';   // 🦴 cuando Vaca vuelve del reparto, aviso (una vez)
    setInterval(() => { const x = activeExp(); if (!tvDev() && x && Date.now() >= x.end && avisado !== x.id) { avisado = x.id; toast('<b>🦴 ¡Vaca volvió del reparto!</b><small>Tocá para cobrar.</small>', { cls:'info', ms:9000, onclick:() => { Nav.go('figus'); view = { tab:'expe' }; render(); } }); }
      if (Nav.current === 'figus' && view.tab === 'expe' && !document.hidden) render(); }, 60e3);
    setTimeout(async () => {
      await pull();
      try { prode(); } catch {} velezTok(); try { wins(); } catch {}
      if (!tvDev()) { const g = daily(); if (g) { pushSoon(); toast(`<b>🎁 Regalo del día: +${g.n} vaccoins</b><small>Racha de ${g.s} día${g.s === 1 ? '' : 's'}${g.off ? ` · +${g.off} de mientras no estabas` : ''}. Están en 🏛️ Colección.</small>`, { cls:'info', ms:6000, onclick:() => Nav.go('figus') }); } }
    }, 6000);
    setInterval(pull, tvDev() ? 30 * 60e3 : 5 * 60e3);
    document.addEventListener('visibilitychange', () => { if (document.hidden) { bgHide(); if (pushT) pushNow(); } else { bgShow(); pull(); } });
    addEventListener('pagehide', bgHide);
  }
  // ☰ / Atrás: primero cierra la ficha, después sale del álbum
  function back() {
    if ($('fgZoom')) { $('fgZoom').remove(); return true; }
    if (Nav.current === 'figus' && view.alb && !view.edit) { view = { tab:view.tab || 'albumes' }; render(); setTimeout(() => $('v-figus')?.querySelector('[data-alb]')?.focus(), 50); return true; }
    return false;
  }
  return { init, render, paseo, back, ECO, get coins() { return derive().coins; } };
})();
