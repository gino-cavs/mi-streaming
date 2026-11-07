/* =========================================================
   🎮 Juegos: ¿Quién es mayor?, ¿Quién murió antes?, Wikirace, ¿Quién soy? (fútbol) y Quiz Dragon Ball.
   Fechas y datos de futbolistas: Wikidata (los junta GitHub una vez por semana).
   ========================================================= */
const Juegos = (() => {
  let data = S.get('juegosData', null), game = null, state = {};
  const J = () => { db.juegos = db.juegos || {}; db.juegos.rec = db.juegos.rec || {}; db.juegos.wiki = db.juegos.wiki || {}; return db.juegos; };
  const pick = a => a[Math.floor(Math.random() * a.length)];
  const shuffle = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
  const fecha = d => { const [y, m, dd] = d.split('-'); return `${+dd}/${+m}/${y}`; };
  const edad = (b, d) => { const e = new Date(d || Date.now()), n = new Date(b); let a = e.getFullYear() - n.getFullYear(); if (e.getMonth() < n.getMonth() || (e.getMonth() === n.getMonth() && e.getDate() < n.getDate())) a--; return a; };
  const record = (k, v) => { const r = J().rec; if (v > (r[k] || 0)) { r[k] = v; save(); return true; } return false; };

  async function load() {
    if (data && Date.now() - data._at < 12 * 3600e3) return data;
    try { const j = await (await fetch(REPO.data + 'juegos.json?t=' + Math.floor(Date.now() / 3600e3))).json(); if (j && j.ar) { j._at = Date.now(); data = j; try { S.set('juegosData', j); } catch {} } } catch {}
    return data;
  }

  /* ---------- Menú ---------- */
  const GAMES = [
    ['mayor', '🎂', '¿Quién es mayor?', 'Dos famosos: elegí al más grande. ¿Hasta dónde llega tu racha?'],
    ['murio', '🕯️', '¿Quién murió antes?', 'Dos famosos que ya no están: ¿cuál se fue primero?'],
    ['wiki', '🏁', 'Wikirace', 'De un artículo de Wikipedia a otro solo con links. Contra reloj.'],
    ['quien', '⚽', '¿Quién soy? Fútbol', 'Pistas de a una: país, puesto, clubes… adiviná el jugador.'],
    ['db', '🐉', 'Quiz Dragon Ball', 'Hasta Dragon Ball Z. Versión normal o difícil.']
  ];
  function render() {
    const v = $('v-juegos');
    if (game) return (VIEWS[game] || menu)(v);
    menu(v);
  }
  function menu(v) {
    const r = J().rec;
    const best = id => ({ mayor:Math.max(r['mayor-ar'] || 0, r['mayor-pop'] || 0), murio:Math.max(r['murio-ar'] || 0, r['murio-pop'] || 0), quien:r.quien || 0, db:Math.max(r['db-normal'] || 0, r['db-dificil'] || 0), wiki:Object.keys(J().wiki).length })[id];
    v.innerHTML = `<div class="jghero"><div class="jgi">🎮</div><div><h2>Juegos</h2><p>Para pasar el rato. Tus récords se guardan y se sincronizan.</p></div></div>
      <div class="jgrid">${GAMES.map(([id, ic, t, d]) => `<button class="jgcard" data-g="${id}"><span class="ic">${ic}</span><b>${t}</b><span>${d}</span>
        ${best(id) ? `<small>${id === 'wiki' ? '🏆 ' + best(id) + ' carrera(s) completada(s)' : '🏆 Récord: ' + best(id)}</small>` : ''}</button>`).join('')}</div>`;
    v.querySelectorAll('[data-g]').forEach(b => b.onclick = () => { game = b.dataset.g; state = {}; render(); });
  }
  const back = () => `<button class="sm jgback" id="jgBack">← Juegos</button>`;
  const bindBack = () => { $('jgBack').onclick = () => { game = null; state = {}; render(); }; };
  const needData = v => { v.innerHTML = back() + '<div class="empty">Cargando datos de Wikidata…<br><small>GitHub los junta una vez por semana; si recién lo activamos, esperá unos minutos.</small></div>'; bindBack(); load().then(d => { if (d && game) render(); }); };

  /* ---------- ¿Quién es mayor? / ¿Quién murió antes? ---------- */
  function duel(v, kind) {
    if (!data) return needData(v);
    const ver = state.ver || S.get('jgVer', 'ar');
    const pool = (data[ver] || []).filter(p => kind === 'murio' ? p.d && !p.d.startsWith('-') : true);
    const key = kind + '-' + ver, field = kind === 'murio' ? 'd' : 'b';
    if (!state.a || state.ver !== ver) {
      state.ver = ver; state.streak = 0;
      state.a = pick(pool);
      do { state.b = pick(pool); } while (state.b === state.a || state.b[field] === state.a[field]);
    }
    const { a, b } = state, rev = state.rev;
    const winner = a[field] < b[field] ? a : b;         // el que nació / murió primero
    const card = (p, side) => `<button class="duel ${rev ? (p === winner ? 'ok' : 'no') : ''}" data-side="${side}" ${rev ? 'disabled' : ''}>
        <div class="dimg" style="${p.img ? `background-image:url('${esc(p.img)}')` : ''}">${p.img ? '' : '👤'}</div>
        <b>${esc(p.n)}</b><span>${esc((p.desc || '').slice(0, 70))}</span>
        ${rev ? `<div class="dres">${kind === 'murio' ? `Murió el ${fecha(p.d)}<br><small>a los ${edad(p.b, p.d)} años</small>` : `Nació el ${fecha(p.b)}<br><small>${p.d ? 'murió a los ' + edad(p.b, p.d) : edad(p.b) + ' años'}</small>`}</div>` : ''}</button>`;
    v.innerHTML = `${back()}
      <div class="jgbar"><h2>${kind === 'murio' ? '🕯️ ¿Quién murió antes?' : '🎂 ¿Quién es mayor?'}</h2>
        <div class="chips" style="margin:0"><button data-ver="ar" class="${ver === 'ar' ? 'on' : ''}">🇦🇷 Argentina</button><button data-ver="pop" class="${ver === 'pop' ? 'on' : ''}">🌎 Cultura popular</button></div>
        <span class="jgsc">Racha <b>${state.streak}</b> · Récord ${J().rec[key] || 0}</span></div>
      <div class="duels">${card(a, 'a')}<div class="vsx">VS</div>${card(b, 'b')}</div>
      <div class="jgmsg" id="jgMsg">${rev ? state.msg : (kind === 'murio' ? 'Tocá al que murió primero' : 'Tocá al que es (o era) más grande')}</div>
      ${rev ? `<div class="btns" style="justify-content:center"><button class="pri" id="jgNext">${state.lost ? '↻ Jugar de nuevo' : 'Siguiente →'}</button></div>` : ''}`;
    bindBack();
    v.querySelectorAll('[data-ver]').forEach(x => x.onclick = () => { S.set('jgVer', x.dataset.ver); state = { ver:x.dataset.ver }; state.a = null; render(); });
    v.querySelectorAll('.duel').forEach(x => x.onclick = () => {
      const chosen = x.dataset.side === 'a' ? a : b;
      state.rev = true;
      if (chosen === winner) { state.streak++; state.lost = false; state.msg = pick(['¡Bien ahí! ✅', '¡Exacto! 🔥', '¡Clavada! 🎯', '¡Sabés mucho! 👏']); }
      else { state.lost = true; state.msg = `❌ No era. Racha final: <b>${state.streak}</b>` + (record(key, state.streak) ? ' · ¡Nuevo récord! 🏆' : ''); }
      if (!state.lost) record(key, state.streak);
      render();
    });
    if (rev) $('jgNext').onclick = () => {
      if (state.lost) { state = { ver }; render(); return; }
      // el ganador queda y entra uno nuevo (como en los "higher or lower")
      const keep = winner; let nb; do { nb = pick(pool); } while (nb === keep || nb[field] === keep[field] || nb === a || nb === b);
      Object.assign(state, { a:keep, b:nb, rev:false }); render();
    };
  }

  /* ---------- ¿Quién soy? Fútbol ---------- */
  function quien(v) {
    if (!data) return needData(v);
    const ver = state.ver || S.get('jgQVer', 'ar');
    const pool = (data.futbol || []).filter(p => ver === 'all' || p.pais.some(x => /argentin/i.test(x)));
    if (!state.p || state.ver !== ver) {
      state.ver = ver; state.p = pick(pool); state.shown = 1; state.done = false; state.score = state.score || 0;
      const p = state.p, cl = p.clubs.slice();
      const famous = cl.pop();              // el último club, que suele ser el más conocido, queda para el final
      state.clues = shuffle([
        p.pais.length && `🌍 Soy de ${p.pais.join(' / ')}`,
        p.pos.length && `🧩 Juego (o jugaba) de ${p.pos.join(' / ').toLowerCase()}`,
        `🎂 Nací en ${p.b.slice(0, 4)}`,
        p.sel.length && `🏳️ Jugué para ${p.sel[0]}`
      ].filter(Boolean)).concat(shuffle(cl).slice(0, 4).map(c => `👕 Pasé por ${c}`), [`👕 Pasé por ${famous}`, `🔤 Mis iniciales: ${p.n.split(/\s+/).map(w => w[0]).join('. ')}.`]);
    }
    const p = state.p, pts = Math.max(1, 10 - (state.shown - 1));
    v.innerHTML = `${back()}
      <div class="jgbar"><h2>⚽ ¿Quién soy?</h2>
        <div class="chips" style="margin:0"><button data-ver="ar" class="${ver === 'ar' ? 'on' : ''}">🇦🇷 Argentinos</button><button data-ver="all" class="${ver === 'all' ? 'on' : ''}">🌎 Todo el mundo</button></div>
        <span class="jgsc">Puntos <b>${state.score}</b> · Récord ${J().rec.quien || 0}</span></div>
      <div class="qbox">
        ${state.done ? `<div class="qans">${p.img ? `<div class="dimg" style="background-image:url('${esc(p.img)}')"></div>` : ''}<div><b>${esc(p.n)}</b><div class="jgmsg" style="margin:4px 0 0">${state.msg}</div></div></div>` : ''}
        <ol class="qclues">${state.clues.slice(0, state.done ? state.clues.length : state.shown).map(c => `<li>${esc(c)}</li>`).join('')}</ol>
        ${state.done ? `<div class="btns"><button class="pri" id="qNext">Otro jugador →</button></div>`
          : `<form id="qForm" class="rsearch"><input id="qIn" list="qList" placeholder="¿Quién es? Escribí el nombre…" autocomplete="off"><button class="pri">Arriesgar</button></form>
             <datalist id="qList">${pool.map(x => `<option value="${esc(x.n)}">`).join('')}</datalist>
             <div class="btns" style="margin-top:6px">${state.shown < state.clues.length ? `<button id="qMore">💡 Otra pista (valés ${pts - 1} pts)</button>` : ''}<button id="qGive">🏳️ Me rindo</button><span class="sp"></span><span class="mut" style="font-size:13px">Si acertás ahora: <b>${pts} pts</b></span></div>`}
      </div>`;
    bindBack();
    v.querySelectorAll('[data-ver]').forEach(x => x.onclick = () => { S.set('jgQVer', x.dataset.ver); state = { ver:x.dataset.ver, score:state.score }; render(); });
    if (state.done) { $('qNext').onclick = () => { state = { ver, score:state.score }; render(); }; return; }
    const ok = g => { const a = norm(g), n = norm(p.n); if (!a) return false; if (a === n) return true; const last = n.split(' ').pop(); return a === last && pool.filter(x => norm(x.n).split(' ').pop() === last).length === 1; };
    $('qForm').onsubmit = e => {
      e.preventDefault();
      if (ok($('qIn').value)) { state.score += pts; state.done = true; state.msg = `✅ ¡Correcto! +${pts} pts` + (record('quien', state.score) ? ' · ¡Nuevo récord! 🏆' : ''); }
      else { $('qIn').value = ''; $('qIn').placeholder = '❌ No es. Probá de nuevo o pedí otra pista'; if (state.shown < state.clues.length) state.shown++; else { state.done = true; state.msg = 'Se terminaron las pistas 😅'; } }
      render(); if (!state.done) $('qIn').focus();
    };
    if ($('qMore')) $('qMore').onclick = () => { state.shown++; render(); $('qIn').focus(); };
    $('qGive').onclick = () => { state.done = true; state.msg = 'Era este. ¡La próxima sale! 💪'; render(); };
  }

  /* ---------- Quiz Dragon Ball (hasta Z) ---------- */
  const DB = {
    normal:[
      ['¿Cómo se llama el hijo mayor de Goku?', 'Gohan', ['Goten', 'Trunks', 'Krilin']],
      ['¿Cuántas Esferas del Dragón hay en la Tierra?', '7', ['5', '6', '9']],
      ['¿Cómo se llama el dragón de las esferas de la Tierra?', 'Shenlong', ['Porunga', 'Shenron Oscuro', 'Kibito']],
      ['¿Cuál es el nombre saiyajin de Goku?', 'Kakarotto', ['Bardock', 'Raditz', 'Tarble']],
      ['¿Quién es la esposa de Goku?', 'Milk', ['Bulma', 'Videl', 'Lunch']],
      ['¿Quién inventó el radar del dragón?', 'Bulma', ['Dr. Gero', 'Dr. Brief', 'Krilin']],
      ['¿Cómo se llama la nube en la que vuela Goku de chico?', 'Nube Kinton', ['Nube Kaio', 'Nube Ozaru', 'Nube Karin']],
      ['¿Quién fue el primer maestro de Goku y Krilin, que vive en la Kame House?', 'El Maestro Roshi', ['Kaiosama', 'El Maestro Karin', 'Mr. Popo']],
      ['¿Cómo se llama la técnica que se carga gritando "Ka-me-ha-me…"?', 'Kamehameha', ['Genkidama', 'Kienzan', 'Taiyoken']],
      ['¿Qué técnica junta energía de todos los seres vivos?', 'Genkidama', ['Kaioken', 'Makankosappo', 'Final Flash']],
      ['¿Quién es el hermano mayor de Goku que llega a la Tierra?', 'Raditz', ['Nappa', 'Vegeta', 'Turles']],
      ['¿En qué planeta Goku se convierte por primera vez en Super Saiyajin?', 'Namek', ['Vegeta', 'Yardrat', 'La Tierra']],
      ['¿Qué villano mata a Krilin en Namek y hace enojar a Goku?', 'Freezer', ['Cell', 'Majin Buu', 'Zarbon']],
      ['¿Quién es el padre de Trunks?', 'Vegeta', ['Goku', 'Yamcha', 'Krilin']],
      ['¿Quién es la madre de Trunks?', 'Bulma', ['Milk', 'N°18', 'Videl']],
      ['¿Cómo se llama la fusión de Goten y Trunks?', 'Gotenks', ['Vegetto', 'Gogeta', 'Trunten']],
      ['¿Cómo se llama la fusión de Goku y Vegeta con los aretes Potara?', 'Vegetto', ['Gogeta', 'Gotenks', 'Kakavege']],
      ['¿Quién derrota a Cell en los Juegos de Cell?', 'Gohan', ['Goku', 'Vegeta', 'Trunks del futuro']],
      ['¿Qué villano rosa sale de la bola de Babidi?', 'Majin Buu', ['Dabura', 'Zarbon', 'Cell']],
      ['¿Quién creó a los androides N°17 y N°18?', 'El Dr. Gero', ['Bulma', 'El Dr. Brief', 'Babidi']],
      ['¿Con qué androide se casa Krilin?', 'N°18', ['N°17', 'N°16', 'N°19']],
      ['¿Cómo se llama la hija de Krilin y N°18?', 'Marron', ['Pan', 'Bra', 'Videl']],
      ['¿De qué raza es Piccolo?', 'Namekiano', ['Saiyajin', 'Terrícola', 'Kaioshin']],
      ['¿Cómo se llama la hija de Mr. Satán?', 'Videl', ['Milk', 'Lunch', 'Marron']],
      ['¿Qué alias usa Gohan cuando se disfraza de superhéroe?', 'El Gran Saiyaman', ['Super Gohan', 'El Guerrero Dorado', 'Saiyaman Z']],
      ['¿Quién es el mejor amigo de Goku desde chicos, pelado y con puntos en la frente?', 'Krilin', ['Yamcha', 'Ten Shin Han', 'Chaos']]
    ],
    dificil:[
      ['¿Cómo se llama el padre de Goku?', 'Bardock', ['Paragus', 'Nappa', 'Rey Vegeta']],
      ['¿Cómo se llama el planeta natal de los saiyajin?', 'Vegeta', ['Sadala', 'Namek', 'Yardrat']],
      ['¿Contra quién pierde Goku la final del 21° Torneo de Artes Marciales?', 'Jackie Chun', ['Ten Shin Han', 'Piccolo', 'Krilin']],
      ['¿En qué edición del Torneo de Artes Marciales Goku sale campeón por primera vez?', 'El 23°', ['El 21°', 'El 22°', 'El 25°']],
      ['¿Quién se transforma en tijeras para cortarle la cola a Goku la primera vez que se convierte en mono gigante?', 'Puar', ['Oolong', 'Yamcha', 'Bulma']],
      ['¿Quién era el líder del Ejército de la Patrulla Roja?', 'El Comandante Red', ['El General Blue', 'Tao Pai Pai', 'El Dr. Gero']],
      ['¿Quién fue el primer maestro de Ten Shin Han y Chaos?', 'El Maestro Tsuru (Grulla)', ['El Maestro Roshi', 'Tao Pai Pai', 'Kaiosama']],
      ['¿Qué técnica le enseña Kaiosama a Goku además de la Genkidama?', 'Kaioken', ['Kamehameha', 'Taiyoken', 'Teletransportación']],
      ['¿Cómo se llaman las mascotas de Kaiosama?', 'Bubbles y Gregory', ['Puar y Oolong', 'Bubbles y Karin', 'Gregory y Popo']],
      ['¿Hasta qué nivel usa Goku el Kaioken para ganar el choque de poderes contra Vegeta en la Tierra?', 'x4', ['x2', 'x10', 'x20']],
      ['¿Cómo se llama el ataque que usa Vegeta en ese choque contra el Kamehameha?', 'Galick Ho', ['Final Flash', 'Big Bang', 'Resplandor Final']],
      ['¿Qué integrante de las Fuerzas Especiales Ginyu puede detener el tiempo?', 'Guldo', ['Recoome', 'Burter', 'Jeice']],
      ['¿En qué animal termina el Capitán Ginyu después de cambiar de cuerpo?', 'Una rana', ['Un mono', 'Un pez', 'Un perro']],
      ['¿Cómo se llama el dragón de Namek?', 'Porunga', ['Shenlong', 'Toronbo', 'Kibito']],
      ['¿Cuántos deseos concede Porunga?', '3', ['1', '2', '7']],
      ['¿Con qué namekiano se fusiona Piccolo en Namek?', 'Nail', ['Dende', 'Moori', 'Kamisama']],
      ['¿Quién mata a Freezer y a su padre al llegar a la Tierra?', 'Trunks del futuro', ['Goku', 'Vegeta', 'Gohan']],
      ['¿Cómo se llama el padre de Freezer?', 'Rey Cold', ['Cooler', 'Zarbon', 'Kuriza']],
      ['¿Qué número tiene el androide que en realidad es el Dr. Gero?', 'N°20', ['N°19', 'N°16', 'N°8']],
      ['¿Quién destruye a N°19?', 'Vegeta', ['Goku', 'Piccolo', 'Trunks del futuro']],
      ['¿Dónde aprende Goku la Teletransportación?', 'En el planeta Yardrat', ['Con Kaiosama', 'En la Habitación del Tiempo', 'En Namek']],
      ['¿Quién se convierte en el nuevo Dios de la Tierra?', 'Dende', ['Piccolo', 'Mr. Popo', 'Nail']],
      ['¿Quién es el asistente del Kaioshin?', 'Kibito', ['Babidi', 'Dabura', 'Mr. Popo']],
      ['¿Quién creó a Majin Buu?', 'Bibidi', ['Babidi', 'Dabura', 'Kaioshin']],
      ['¿Qué espada saca Gohan en el planeta de los Kaioshin?', 'La Espada Z', ['La Espada del Dragón', 'La Espada de Trunks', 'La Espada Kai']],
      ['¿Quién se autodestruye para intentar frenar a Majin Buu?', 'Vegeta', ['Piccolo', 'Krilin', 'N°16']]
    ]
  };
  function quiz(v) {
    const lvl = state.lvl;
    if (!lvl) {
      v.innerHTML = `${back()}<div class="jgbar"><h2>🐉 Quiz Dragon Ball</h2></div>
        <p class="mut" style="margin-bottom:12px">10 preguntas de Dragon Ball y Dragon Ball Z.</p>
        <div class="jgrid"><button class="jgcard" data-l="normal"><span class="ic">🟠</span><b>Normal</b><span>Para el que vio la serie.</span><small>🏆 Récord: ${J().rec['db-normal'] || 0}/10</small></button>
        <button class="jgcard" data-l="dificil"><span class="ic">🔥</span><b>Difícil</b><span>Para fanáticos de verdad.</span><small>🏆 Récord: ${J().rec['db-dificil'] || 0}/10</small></button></div>`;
      bindBack();
      v.querySelectorAll('[data-l]').forEach(b => b.onclick = () => { state = { lvl:b.dataset.l, qs:shuffle(DB[b.dataset.l]).slice(0, 10), i:0, ok:0 }; render(); });
      return;
    }
    if (state.i >= state.qs.length) {
      const nr = record('db-' + lvl, state.ok);
      v.innerHTML = `${back()}<div class="qbox" style="text-align:center"><div style="font-size:48px">${state.ok >= 9 ? '🐉' : state.ok >= 6 ? '💪' : '🥚'}</div>
        <h2 style="margin:6px 0">${state.ok}/10</h2><p>${state.ok === 10 ? '¡Nivel Super Saiyajin! Perfecto.' : state.ok >= 7 ? '¡Muy bien, guerrero Z!' : state.ok >= 4 ? 'Nada mal, pero a la Habitación del Tiempo.' : 'Te falta entrenar con Kaiosama 😅'}${nr ? '<br>🏆 ¡Nuevo récord!' : ''}</p>
        <div class="btns" style="justify-content:center"><button class="pri" id="dbAgain">↻ Otra vez</button><button id="dbLvl">Cambiar nivel</button></div></div>`;
      bindBack();
      $('dbAgain').onclick = () => { state = { lvl, qs:shuffle(DB[lvl]).slice(0, 10), i:0, ok:0 }; render(); };
      $('dbLvl').onclick = () => { state = {}; render(); };
      return;
    }
    const [q, ans, wrong] = state.qs[state.i];
    if (!state.opts) state.opts = shuffle([ans, ...wrong]);
    v.innerHTML = `${back()}<div class="jgbar"><h2>🐉 ${lvl === 'normal' ? 'Normal' : 'Difícil'}</h2><span class="jgsc">Pregunta <b>${state.i + 1}</b>/10 · Aciertos ${state.ok}</span></div>
      <div class="qbox"><div class="dbq">${esc(q)}</div>
        <div class="dbopts">${state.opts.map(o => `<button class="dbo ${state.pick ? (o === ans ? 'ok' : o === state.pick ? 'no' : '') : ''}" ${state.pick ? 'disabled' : ''}>${esc(o)}</button>`).join('')}</div>
        ${state.pick ? `<div class="btns" style="justify-content:center"><button class="pri" id="dbNext">${state.i === 9 ? 'Ver resultado' : 'Siguiente →'}</button></div>` : ''}</div>`;
    bindBack();
    v.querySelectorAll('.dbo').forEach(b => b.onclick = () => { state.pick = b.textContent; if (state.pick === ans) state.ok++; render(); });
    if (state.pick) $('dbNext').onclick = () => { state.i++; state.pick = null; state.opts = null; render(); };
  }

  /* ---------- Wikirace ---------- */
  const API = 'https://es.wikipedia.org/w/api.php?format=json&formatversion=2&origin=*&';
  async function resolve(t) {
    const j = await (await fetch(API + 'action=query&redirects=1&titles=' + encodeURIComponent(t))).json();
    const p = j.query.pages[0]; return p.missing ? null : p.title;
  }
  async function randomTitle() { const j = await (await fetch(API + 'action=query&list=random&rnnamespace=0&rnlimit=1')).json(); return j.query.random[0].title; }
  // deja solo texto y links internos (sin fotos, tablas ni referencias): carga liviana
  function clean(html) {
    const t = document.createElement('template'); t.innerHTML = html;
    t.content.querySelectorAll('table, figure, img, style, sup, .reflist, .references, .navbox, .mw-editsection, .infobox, .thumb, .gallery, .hatnote, .noprint, .metadata, .mw-empty-elt, .reference, link').forEach(n => n.remove());
    const out = document.createElement('div'), ALLOW = new Set(['P', 'UL', 'OL', 'LI', 'B', 'I', 'H2', 'H3', 'DL', 'DD', 'DT', 'BLOCKQUOTE']);
    let stop = false;
    const walk = (src, dst) => {
      for (const n of src.childNodes) {
        if (stop) return;
        if (n.nodeType === 3) { dst.appendChild(document.createTextNode(n.textContent)); continue; }
        if (n.nodeType !== 1) continue;
        if (/^H[23]$/.test(n.tagName) || n.classList.contains('mw-heading')) {
          const h = n.textContent.trim(); if (/^(Referencias|Notas|Bibliografía|Enlaces externos|Véase también|Fuentes)$/i.test(h)) { stop = true; return; }
        }
        if (n.tagName === 'A') {
          const href = n.getAttribute('href') || '';
          const m = href.match(/^\/wiki\/([^#?]+)/);
          const title = m ? decodeURIComponent(m[1]).replace(/_/g, ' ') : null;
          if (title && !title.includes(':')) { const a = document.createElement('a'); a.dataset.t = title; a.textContent = n.textContent; dst.appendChild(a); }
          else dst.appendChild(document.createTextNode(n.textContent));
          continue;
        }
        if (ALLOW.has(n.tagName)) { const e = document.createElement(n.tagName === 'H3' ? 'h4' : n.tagName === 'H2' ? 'h3' : n.tagName); walk(n, e); if (e.textContent.trim()) dst.appendChild(e); }
        else walk(n, dst);
      }
    };
    walk(t.content, out);
    return out;
  }
  function wiki(v) {
    const W = state;
    if (!W.phase) {
      W.from = W.from || 'Flavio Mendoza'; W.to = W.to || 'Chili Parker';
      const recs = Object.entries(J().wiki).sort((a, b) => b[1].at - a[1].at).slice(0, 8);
      v.innerHTML = `${back()}<div class="jgbar"><h2>🏁 Wikirace</h2></div>
        <div class="qbox"><p class="mut" style="margin-bottom:10px">Llegá de un artículo de Wikipedia al otro tocando solo los links, lo más rápido posible. Sin buscador.</p>
          <div class="wrow"><label>Salida</label><input id="wFrom" value="${esc(W.from)}"><label>Llegada</label><input id="wTo" value="${esc(W.to)}"></div>
          <div class="btns"><button id="wRand">🎲 Carrera al azar</button><span class="sp"></span><button class="pri" id="wGo">¡Largar! 🏁</button></div>
          <div class="msg" id="wMsg"></div></div>
        ${recs.length ? `<h2 class="sec" style="margin-top:14px">🏆 Tus mejores tiempos</h2><div class="news">${recs.map(([k, r]) => `<div class="nitem"><b>${esc(k)}</b><span>${r.secs} s · ${r.clicks} clics</span></div>`).join('')}</div>` : ''}`;
      bindBack();
      $('wRand').onclick = async () => { $('wMsg').textContent = 'Buscando artículos al azar…'; try { $('wFrom').value = await randomTitle(); $('wTo').value = await randomTitle(); $('wMsg').textContent = ''; } catch { $('wMsg').textContent = 'No pude conectar con Wikipedia.'; } };
      $('wGo').onclick = async () => {
        const m = $('wMsg'); m.className = 'msg'; m.textContent = 'Revisando los artículos…';
        try {
          const [a, b] = await Promise.all([resolve($('wFrom').value.trim()), resolve($('wTo').value.trim())]);
          if (!a || !b) {
            m.className = 'msg err';
            m.innerHTML = `${!a ? `“${esc($('wFrom').value)}”` : `“${esc($('wTo').value)}”`} no tiene artículo en Wikipedia en español. Probá con otro${!b && /chili parker/i.test($('wTo').value) ? ' (por ejemplo “Aczino” o “Batalla de gallos”)' : ''}.`;
            return;
          }
          Object.assign(W, { phase:'run', from:a, to:b, path:[a], t0:Date.now(), clicks:0 }); render(); go(a);
        } catch { m.className = 'msg err'; m.textContent = 'No pude conectar con Wikipedia.'; }
      };
      return;
    }
    if (W.phase === 'win') {
      const secs = Math.round((W.t1 - W.t0) / 1000), k = `${W.from} → ${W.to}`, prev = J().wiki[k];
      if (!W.saved) { W.saved = true; if (!prev || secs < prev.secs) { J().wiki[k] = { secs, clicks:W.clicks, at:Date.now() }; save(); W.rec = true; } }
      v.innerHTML = `${back()}<div class="qbox" style="text-align:center"><div style="font-size:48px">🏁</div><h2>¡Llegaste!</h2>
        <p style="font-size:20px;margin:8px 0"><b>${secs} s</b> · ${W.clicks} clics ${W.rec ? '· 🏆 ¡Récord de esta carrera!' : prev ? `· récord: ${prev.secs} s` : ''}</p>
        <div class="wpath">${W.path.map(esc).join(' → ')}</div>
        <div class="btns" style="justify-content:center"><button class="pri" id="wAgain">↻ Otra carrera</button></div></div>`;
      bindBack(); $('wAgain').onclick = () => { state = { from:W.from, to:W.to }; render(); };
      return;
    }
    v.innerHTML = `${back()}
      <div class="wbar"><span>🏁 <b>${esc(W.from)}</b> → 🎯 <b>${esc(W.to)}</b></span><span class="sp"></span>
        <span class="wclk" id="wClock">0 s</span><span>· ${W.clicks} clics</span><button class="sm" id="wBack" ${W.path.length < 2 ? 'disabled' : ''}>↶ Atrás</button><button class="sm" id="wQuit">🏳️ Me rindo</button></div>
      <div class="wpath">${W.path.map(esc).join(' → ')}</div>
      <article class="wart" id="wArt"><div class="empty">Cargando…</div></article>`;
    bindBack();
    clearInterval(W.tick); W.tick = setInterval(() => { if ($('wClock')) $('wClock').textContent = Math.round((Date.now() - W.t0) / 1000) + ' s'; else clearInterval(W.tick); }, 500);
    $('wQuit').onclick = () => { clearInterval(W.tick); state = { from:W.from, to:W.to }; render(); };
    $('wBack').onclick = () => { if (W.path.length > 1) { W.path.pop(); W.clicks++; render(); go(W.path[W.path.length - 1], true); } };
  }
  async function go(title, noPush) {
    const W = state;
    try {
      const j = await (await fetch(API + 'action=parse&prop=text&redirects=1&disableeditsection=1&disabletoc=1&page=' + encodeURIComponent(title))).json();
      const real = j.parse.title;
      if (!noPush && W.path[W.path.length - 1] !== real) W.path[W.path.length - 1] = real;
      if (norm(real) === norm(W.to)) { W.phase = 'win'; W.t1 = Date.now(); clearInterval(W.tick); render(); return; }
      const art = $('wArt'); if (!art) return;
      art.innerHTML = `<h2>${esc(real)}</h2>`; art.appendChild(clean(j.parse.text));
      $('scroller').scrollTo(0, 0);
      art.querySelectorAll('a[data-t]').forEach(a => a.onclick = () => { W.clicks++; W.path.push(a.dataset.t); render(); go(a.dataset.t); });
    } catch { const art = $('wArt'); if (art) art.innerHTML = '<div class="empty">No pude cargar el artículo. Probá “Atrás”.</div>'; }
  }

  const VIEWS = { mayor:v => duel(v, 'mayor'), murio:v => duel(v, 'murio'), quien, db:quiz, wiki };
  function init() { onChange(() => { if (Nav.current === 'juegos' && !game) render(); }); }
  return { init, render: () => { load(); render(); } };
})();
