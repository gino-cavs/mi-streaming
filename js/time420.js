/* =========================================================
   420 time 🍃: cosas al azar para colgarse. Datos curiosos, preguntas para pensar,
   "¿qué preferís?", un tema random de tu música o radios, y el Modo viaje (visuales).
   ========================================================= */
const T420 = (() => {
  const DATOS = [
    'Los pulpos tienen tres corazones y la sangre azul.',
    'Las bananas, botánicamente, son bayas. Las frutillas no.',
    'Los tiburones existen desde antes que los árboles.',
    'Las nutrias marinas se agarran de las patas para dormir y no separarse con la corriente.',
    'En Venus un día dura más que un año: tarda más en girar sobre sí mismo que en dar la vuelta al Sol.',
    'La luz del Sol tarda unos 8 minutos en llegar a la Tierra: lo ves como era hace 8 minutos.',
    'Cuando mirás las estrellas, ves el pasado: algunas ni siquiera existen ya.',
    'La Luna se aleja de la Tierra unos 3,8 cm por año.',
    'Hay más árboles en la Tierra que estrellas en la Vía Láctea.',
    'Un rayo es unas cinco veces más caliente que la superficie del Sol.',
    'Una nube cúmulo común pesa alrededor de 500 toneladas. Y flota igual.',
    'En el espacio no hay sonido: no hay aire que lo transporte.',
    'Los delfines duermen con medio cerebro por vez; la otra mitad queda atenta.',
    'Las jirafas tienen la misma cantidad de vértebras en el cuello que nosotros: siete.',
    'Las mariposas sienten el gusto con las patas.',
    'Los wombats hacen caca en forma de cubito.',
    'En los caballitos de mar, el que queda embarazado es el macho.',
    'Los koalas pueden dormir unas 20 horas por día.',
    'Los cuervos reconocen caras humanas y se acuerdan de quién los trató mal.',
    'Los gatos no sienten el sabor dulce.',
    'Los flamencos son rosados por lo que comen; al nacer son grises.',
    'Las vacas tienen un estómago dividido en cuatro compartimentos. 🐄',
    'Un estudio de 2001 encontró que las vacas daban más leche escuchando música tranquila. 🐄🎶',
    'Las abejas pueden aprender a reconocer rostros humanos.',
    'La Antártida es el desierto más grande del mundo: casi no llueve.',
    'La Gran Muralla China no se ve a simple vista desde el espacio.',
    'La Torre Eiffel puede crecer unos 15 cm en verano por el calor.',
    'Cleopatra vivió más cerca en el tiempo de la llegada a la Luna que de la construcción de la Gran Pirámide.',
    'La Universidad de Oxford es más antigua que el Imperio azteca.',
    'Un año luz son unos 9,46 billones de kilómetros.',
    'La Tierra no es una esfera perfecta: está un poco achatada en los polos.',
    'Compartimos alrededor del 98% del ADN con los chimpancés.',
    'Según algunos estudios, en Júpiter y Saturno podrían llover diamantes.',
    'El mate es la infusión nacional de Argentina por ley desde 2013.',
    'El Obelisco de Buenos Aires se construyó en solo 31 días, en 1936.',
    'El Aconcagua es la montaña más alta del mundo fuera de Asia.',
    'Las Cataratas del Iguazú tienen alrededor de 275 saltos.',
    'El tango es Patrimonio Cultural Inmaterial de la Humanidad desde 2009.',
    'En 1994 Vélez le ganó 2 a 0 al Milan en Tokio y fue campeón Intercontinental. 💙',
    '"Ojalá" viene del árabe y significa algo así como "si Dios quiere".',
    '"Almohada", "aceite" y "azúcar" son palabras que el español heredó del árabe.',
    'El "420" nació en 1971 con unos pibes de una secundaria de California que se juntaban a las 4:20. 🍃',
    'Los pulpos son casi daltónicos, pero igual cambian de color para camuflarse.',
    'Las hormigas no tienen pulmones: respiran por agujeritos en el cuerpo.',
    'El corazón de una ballena azul es del tamaño de un auto chico.',
    'Los elefantes son de los pocos mamíferos que no pueden saltar.',
    'La miel bien guardada prácticamente no se echa a perder.',
    'Hay más combinaciones posibles de un mazo de 52 cartas que átomos en la Tierra.',
    'Los astronautas crecen unos centímetros en el espacio porque la columna se estira.',
    'El Sol representa más del 99% de la masa de todo el sistema solar.'
  ];
  const PENSAR = [
    'Si un árbol cae en el bosque y nadie lo escucha… ¿hace ruido?',
    '¿Los peces tienen sed?',
    'Si viajás a la velocidad de la luz y prendés las luces del auto, ¿qué pasa?',
    'Nunca viste tu propia cara: solo reflejos y fotos.',
    'El "ahora" que estás viviendo ya pasó cuando terminaste de leer esto.',
    '¿El color que vos llamás rojo es el mismo que ve otra persona?',
    'Cada vez que te acordás de algo, en realidad te acordás de la última vez que lo recordaste.',
    'En algún momento tus papás te alzaron por última vez y nadie se dio cuenta.',
    'Si el agua moja, ¿el agua está mojada?',
    'El cero fue un invento. Hubo una época en que "nada" no tenía número.',
    'Tus ojos ven tu nariz todo el tiempo; el cerebro decide ignorarla.',
    'Somos polvo de estrellas que se puso a pensar en las estrellas.',
    '¿Por qué "separado" se escribe todo junto y "todo junto" se escribe separado?',
    'Un pez no sabe que está mojado.',
    'Dormimos un tercio de la vida y no nos acordamos de casi nada.',
    'Las sillas de las salas de espera saben más secretos que nadie.',
    'Si mañana te despertás sin recuerdos, ¿seguís siendo vos?',
    'Las nubes son agua flotando sobre tu cabeza. Toneladas.',
    'En algún lugar del mundo, alguien está viendo el mismo partido que vos y gritando el mismo gol.',
    'El universo tiene unos 13.800 millones de años y te tocó justo ahora.'
  ];
  const PREFERIS = [
    ['Tener mate infinito', 'Tener asado infinito'],
    ['Poder volar', 'Poder ser invisible'],
    ['Ver todos los partidos de Vélez en la cancha', 'Jugar 5 minutos en primera'],
    ['Saber todos los idiomas', 'Hablar con los animales'],
    ['Vivir en una isla con Wi-Fi', 'Vivir en una ciudad sin internet'],
    ['Que te persiga una vaca gigante', 'Que te persigan 100 vacas chiquitas 🐄'],
    ['Volver al pasado', 'Ir al futuro'],
    ['Comer solo pizza para siempre', 'Comer solo empanadas para siempre'],
    ['Ganar una batalla de freestyle', 'Ganar una carrera de TC'],
    ['Tener un botón de pausa para la vida', 'Tener un botón de rebobinar'],
    ['Dormir 4 horas y estar fresco', 'Dormir 12 y que el día dure igual'],
    ['Que tu vida tenga música de fondo', 'Que tenga relator de fútbol'],
    ['Poder teletransportarte pero solo a lugares que ya conocés', 'Poder volar pero a paso de hombre'],
    ['Leer mentes durante un día', 'Ser invisible durante un día'],
    ['Que todo lo que digas rime', 'Que todo lo que pienses se escuche']
  ];
  const BIEN = ['💧 Pausa para tomar un vaso de agua.', '🍫 Momento snack. Te lo ganaste.', '🧘 Respirá hondo tres veces. Ya está.', '🪟 Abrí un poco la ventana, que entre aire.'];
  let last = null, local = S.get('t420', { alert:true }), viaje = null;

  const pick = a => a[Math.floor(Math.random() * a.length)];
  function anything() {
    const kinds = ['dato', 'dato', 'dato', 'pensar', 'pensar', 'preferis', 'musica', 'bien'];
    let k; do { k = pick(kinds); } while (k === last && Math.random() < .7);
    last = k;
    if (k === 'dato') return { k, ic:'🧠', t:'¿Sabías que…?', body:pick(DATOS) };
    if (k === 'pensar') return { k, ic:'🌀', t:'Para pensar un rato', body:pick(PENSAR) };
    if (k === 'preferis') { const [a, b] = pick(PREFERIS); return { k, ic:'⚖️', t:'¿Qué preferís?', a, b }; }
    if (k === 'bien') return { k, ic:'🍃', t:'Recordatorio buena onda', body:pick(BIEN) };
    return { k:'musica', ic:'🎶', t:'Tema al azar', body:'Pongo algo random de tu música o tus radios.' };
  }
  function randomPlay() {
    const opts = [...(db.music.items || []).map(it => ['m', it]), ...(db.radios || []).map(r => ['r', r])];
    if (!opts.length) { toast('<b>No tenés música ni radios guardadas</b><small>Agregá algo en 🎵 Música o 📻 Radios y vuelvo a sortear.</small>', { cls:'info' }); return null; }
    const [t, x] = pick(opts);
    if (t === 'm') { S.set('musShuffle', true); Musica.play(x); } else Radio.play(x);
    return x.name;
  }

  function render() {
    const v = $('v-420');
    v.innerHTML = `
      <div class="t4hero"><div class="t4leaf">🍃</div><div><h2>420 time</h2><p>Cosas al azar para colgarse un rato.</p></div></div>
      <div class="t4btns">
        <button class="pri t4big" id="t4Any">🎲 Dame algo</button>
        <button class="t4big" id="t4Dato">🧠 Dato curioso</button>
        <button class="t4big" id="t4Pensar">🌀 Para pensar</button>
        <button class="t4big" id="t4Pref">⚖️ ¿Qué preferís?</button>
        <button class="t4big" id="t4Music">🎶 Tema al azar</button>
        <button class="t4big" id="t4Viaje">🌈 Modo viaje</button>
      </div>
      <div id="t4Card" class="t4card"></div>
      <label class="mut" style="font-size:13px;display:flex;gap:6px;align-items:center;margin-top:14px"><input type="checkbox" id="t4Alert" ${local.alert ? 'checked' : ''}> Avisarme a las 4:20 y a las 16:20 (respeta No molestar)</label>`;
    const show = c => {
      const el = $('t4Card');
      el.innerHTML = `<div class="t4ic">${c.ic}</div><div class="t4t">${esc(c.t)}</div>` +
        (c.a ? `<div class="t4pref"><button>${esc(c.a)}</button><span>o</span><button>${esc(c.b)}</button></div>` : `<div class="t4body">${esc(c.body)}</div>`);
      el.classList.remove('in'); void el.offsetWidth; el.classList.add('in');
      if (c.a) el.querySelectorAll('.t4pref button').forEach(b => b.onclick = () => { el.querySelectorAll('.t4pref button').forEach(x => x.classList.toggle('on', x === b)); });
      if (c.k === 'musica') { const n = randomPlay(); if (n) el.querySelector('.t4body').textContent = '▶ Sonando: ' + n; }
    };
    $('t4Any').onclick = () => show(anything());
    $('t4Dato').onclick = () => show({ k:'dato', ic:'🧠', t:'¿Sabías que…?', body:pick(DATOS) });
    $('t4Pensar').onclick = () => show({ k:'pensar', ic:'🌀', t:'Para pensar un rato', body:pick(PENSAR) });
    $('t4Pref').onclick = () => { const [a, b] = pick(PREFERIS); show({ k:'preferis', ic:'⚖️', t:'¿Qué preferís?', a, b }); };
    $('t4Music').onclick = () => show({ k:'musica', ic:'🎶', t:'Tema al azar', body:'' });
    $('t4Viaje').onclick = startViaje;
    $('t4Alert').onchange = e => { local.alert = e.target.checked; S.set('t420', local); };
    if (!$('t4Card').innerHTML) show(anything());
  }

  /* ---------- Modo viaje: visuales a pantalla completa + datos que van pasando ---------- */
  function startViaje() {
    if (viaje) return;
    const o = document.createElement('div'); o.className = 't4viaje';
    o.innerHTML = `<canvas></canvas><div class="t4vtxt"></div><div class="t4vbar"><button data-v="music">🎶 Tema al azar</button><button data-v="next">🎲 Otra cosa</button><button data-v="x">✕ Salir</button></div>`;
    document.body.appendChild(o);
    const cv = o.querySelector('canvas'), cx = cv.getContext('2d');
    const size = () => { cv.width = innerWidth * devicePixelRatio; cv.height = innerHeight * devicePixelRatio; };
    size(); addEventListener('resize', size);
    const blobs = Array.from({ length:7 }, (_, i) => ({ x:Math.random(), y:Math.random(), r:.25 + Math.random() * .3, h:i * 50, sx:(Math.random() - .5) * .0009, sy:(Math.random() - .5) * .0009 }));
    let raf, t0 = performance.now();
    const draw = now => {
      const t = (now - t0) / 1000, W = cv.width, H = cv.height;
      cx.globalCompositeOperation = 'source-over'; cx.fillStyle = 'rgba(8,6,20,.18)'; cx.fillRect(0, 0, W, H);
      cx.globalCompositeOperation = 'lighter';
      blobs.forEach(b => {
        b.x += b.sx; b.y += b.sy; if (b.x < -.2 || b.x > 1.2) b.sx *= -1; if (b.y < -.2 || b.y > 1.2) b.sy *= -1;
        const R = b.r * Math.min(W, H) * (1 + .15 * Math.sin(t * .7 + b.h)), hue = (b.h + t * 12) % 360;
        const g = cx.createRadialGradient(b.x * W, b.y * H, 0, b.x * W, b.y * H, R);
        g.addColorStop(0, `hsla(${hue},85%,55%,.15)`); g.addColorStop(1, `hsla(${hue},90%,50%,0)`);
        cx.fillStyle = g; cx.beginPath(); cx.arc(b.x * W, b.y * H, R, 0, 7); cx.fill();
      });
      raf = requestAnimationFrame(draw);
    };
    raf = requestAnimationFrame(draw);
    const txt = o.querySelector('.t4vtxt');
    const say = () => { const c = Math.random() < .6 ? pick(DATOS) : pick(PENSAR); txt.classList.remove('in'); void txt.offsetWidth; txt.textContent = c; txt.classList.add('in'); };
    say(); const it = setInterval(say, 18000);
    const close = () => { cancelAnimationFrame(raf); clearInterval(it); removeEventListener('resize', size); document.removeEventListener('keydown', key); o.remove(); viaje = null; if (document.fullscreenElement) document.exitFullscreen().catch(() => {}); };
    const key = e => { if (e.key === 'Escape') close(); if (e.key === ' ') { e.preventDefault(); say(); } };
    document.addEventListener('keydown', key);
    o.querySelector('[data-v=x]').onclick = close;
    o.querySelector('[data-v=next]').onclick = say;
    o.querySelector('[data-v=music]').onclick = () => { const n = randomPlay(); if (n) { txt.textContent = '🎶 ' + n; } };
    o.requestFullscreen && o.requestFullscreen().catch(() => {});
    viaje = { close };
  }

  // aviso a las 4:20 y 16:20
  function check() {
    const d = new Date(), k = d.toDateString() + d.getHours();
    if (!local.alert || d.getMinutes() !== 20 || (d.getHours() !== 4 && d.getHours() !== 16) || local.last === k || DND.active()) return;
    local.last = k; S.set('t420', local);
    toast(`<span class="g">🍃 Son las ${d.getHours()}:20</span>${esc(pick(DATOS))}`, { cls:'t420', ms:20000, onclick:() => Nav.go('420') });
  }
  function init() { setInterval(check, 30e3); }
  return { init, render };
})();
