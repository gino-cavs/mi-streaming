/* =========================================================
   🌀 Flash del día (420 time): una teoría flashera por día, para leerla… y vivirla.
   Cada una tiene su experiencia a pantalla completa (animación liviana en canvas), narración en voz alta
   (la voz del navegador, en castellano) y una pregunta para debatir: "Flasheala".
   ========================================================= */
const Flash = (() => {
  const T = [
    { id:'huevo', ic:'🥚', t:'La Teoría del Huevo',
      p:['Te morís y te encontrás con una entidad en el vacío absoluto. Te explica la verdad: el universo entero fue creado para que nazcas, crezcas y madures. Pero no como vos: como todos.',
         'Cada persona que existió, existe o existirá sos vos en otra reencarnación. Fuiste Julio César, el que inventó la rueda, la víctima y el victimario de cada guerra.',
         'Toda la historia humana es una sola conciencia —vos— amándose, odiándose y matándose a sí misma miles de millones de veces, hasta aprender lo suficiente para nacer como algo superior. Cada bien que hacés, te lo hacés a vos. Cada daño, también.'],
      q:'Si sos todos… ¿quién está leyendo esto ahora, y quién lo escribió?' },
    { id:'jueves', ic:'⏱️', t:'El Jueves Pasado',
      p:['No hay forma de probar que el universo no fue creado hace exactamente cinco minutos.',
         'Pudo haber brotado hace 300 segundos, completo: con tus recuerdos de la infancia ya grabados, la comida a mitad de digerir, el desgaste de tus zapatillas y el polvo sobre la mesa.',
         'Las fotos viejas, los fósiles y tus cicatrices no prueban nada: habrían sido creados ya viejos, en el mismo instante cero. Toda tu vida antes de hace cinco minutos es una ilusión.'],
      q:'¿Qué recuerdo tuyo te parece demasiado perfecto para ser real?' },
    { id:'observador', ic:'👁️', t:'El Observador Tardío',
      p:['En la doble rendija, una partícula es una onda —está en todas partes— hasta que alguien la mira. En ese instante elige un lugar.',
         'Llevalo al cosmos: el Big Bang y los primeros miles de millones de años nunca tuvieron un estado definido. Una nube de infinitas posibilidades superpuestas, sin decidir.',
         'Hasta que apareció el primer ser capaz de mirar el cielo y preguntarse qué era eso. En ese segundo, el universo tuvo que elegir todo su pasado de golpe para que tuviera sentido. La conciencia no nació del universo: el universo se inventó un pasado porque apareció la conciencia.'],
      q:'¿Y si ahora mismo hay algo que solo existe porque lo estás mirando?' },
    { id:'boltzmann', ic:'🧠', t:'Cerebro de Boltzmann',
      p:['En un universo que dura para siempre, las partículas que chocan al azar pueden formar cualquier cosa por pura casualidad.',
         'Y es infinitamente más probable que unos átomos en el vacío se junten un instante formando un cerebro, que todo un universo con galaxias evolucione durante miles de millones de años.',
         'Ese cerebro flotante tendría exactamente tus recuerdos y la sensación de estar leyendo esto. La matemática sugiere que sos eso: un cerebro que se acaba de armar por accidente en la nada, alucinando esta charla. En un milisegundo te desarmás.'],
      q:'Si te desarmás en un segundo… ¿qué harías con ese segundo?' },
    { id:'inmortal', ic:'♾️', t:'La Inmortalidad Cuántica',
      p:['Si hay universos múltiples, cada vez que puede pasar más de una cosa, la realidad se divide.',
         'Cruzás distraído la avenida y casi te pisa un colectivo. En un universo te choca. Pero tu conciencia no puede experimentar no existir: siempre sigue viaje en la línea donde diste un paso atrás.',
         'Desde adentro, jamás vas a vivir tu propia muerte. Para los demás podés morir; para vos, sos un prisionero eterno que va a sobrevivir al universo entero.'],
      q:'¿Cuántas veces zafaste de milagro sin darte cuenta?' },
    { id:'zombi', ic:'🧍', t:'El Zombi Filosófico',
      p:['Viaje largo en colectivo. Mirás a los demás: cómo se visten, sus gestos, imaginás sus rutinas y sus problemas.',
         'La filosofía de la mente tiene un concepto: el zombi filosófico. Idéntico a un humano, habla, trabaja y reacciona igual… pero por dentro está apagado. Sin experiencia, sin nadie ahí.',
         'Es imposible comprobar que los demás tienen conciencia. Podrías ser la única luz encendida del planeta, y todos los demás, sistemas biológicos hipercomplejos: envases vacíos.'],
      q:'¿Cómo le probarías a alguien que vos no sos un zombi?' },
    // ---- estrenos de los viernes ----
    { id:'simulacion', exp:'simulacion', ic:'🕹️', t:'La Hipótesis de la Simulación',
      p:['Si alguna civilización llega a tener computadoras capaces de simular universos enteros, va a simular muchísimos: para estudiar su pasado, por curiosidad, por juego.',
         'Entonces habría un solo universo "real" y millones de simulados. Si elegís uno al azar, lo más probable es que caigas en uno simulado.',
         'Las leyes de la física serían el código, la velocidad de la luz el límite del procesador, y los déjà vu… glitches. Vos serías un personaje convencido de que es real.'],
      q:'Si encontraras la prueba de que es una simulación, ¿cambiarías algo de cómo vivís?' },
    { id:'fermi', exp:'cosmos', ic:'🌌', t:'El Bosque Oscuro',
      p:['Hay cientos de miles de millones de estrellas en nuestra galaxia, muchas con planetas. La vida debería estar por todos lados. Entonces, ¿dónde están todos? Es la paradoja de Fermi.',
         'Una respuesta helada: el universo es un bosque oscuro lleno de cazadores silenciosos. Cada civilización sabe que no puede confiar en las otras, y que la forma más segura de sobrevivir es no hacer ruido.',
         'El silencio del cosmos no es porque estemos solos. Es porque todos se están escondiendo. Y nosotros llevamos un siglo gritando por radio.'],
      q:'¿Mandarías un mensaje al espacio, sabiendo que alguien podría escucharlo?' },
    { id:'teseo', exp:'boltzmann', ic:'⛵', t:'El Barco de Teseo',
      p:['Un barco viejo va cambiando sus tablas podridas una por una. Cuando ya no queda ninguna tabla original, ¿sigue siendo el mismo barco?',
         'Y si alguien junta todas las tablas viejas y arma otro barco, ¿cuál es el verdadero?',
         'Ahora pensalo en vos: casi todas tus células se renovaron en los últimos años. El pibe de las fotos de la infancia no tiene ni un átomo en común con vos. ¿Sos la misma persona, o solo un barco al que le fueron cambiando las tablas?'],
      q:'¿Qué parte de vos tendría que cambiar para que dejes de ser vos?' },
    { id:'mandela', exp:'jueves', ic:'🧩', t:'El Efecto Mandela',
      p:['Miles de personas recuerdan con total seguridad cosas que nunca pasaron: frases de películas que nadie dijo, logos que nunca fueron así, noticias que no existieron.',
         'La explicación aburrida es que la memoria se reconstruye y se equivoca en grupo. La flashera: que esos recuerdos son de otra línea temporal, una que se cruzó o se reescribió con la nuestra.',
         'Si eso fuera cierto, cada recuerdo que no coincide con la realidad sería una cicatriz de un universo que ya no existe.'],
      q:'¿Tenés algún recuerdo que todos te dicen que no pasó?' },
    { id:'bloque', exp:'inmortal', ic:'🧊', t:'El Universo Bloque',
      p:['Para la relatividad, el tiempo es una dimensión más, como el ancho o el alto. Y el pasado, el presente y el futuro existen todos juntos, igual de reales.',
         'Tu nacimiento, este instante y tu último día están ahí, quietos, como las páginas de un libro ya escrito. Lo que llamamos "ahora" es solo dónde está parada tu conciencia.',
         'Nada pasa realmente: todo ya está. Cada momento de tu vida existe para siempre. El abrazo más lindo que diste lo seguís dando, en algún lugar del bloque.'],
      q:'Si cada momento existe para siempre, ¿cuál elegirías para vivir en loop?' },
    { id:'mariposa', exp:'observador', ic:'🦋', t:'El Sueño de la Mariposa',
      p:['Hace más de dos mil años, el filósofo chino Zhuangzi soñó que era una mariposa: volaba feliz, sin saber nada de Zhuangzi.',
         'Al despertar no supo si era Zhuangzi que había soñado ser una mariposa, o una mariposa que ahora estaba soñando ser Zhuangzi.',
         'No hay ninguna prueba, desde adentro, de que esta vida no sea el sueño de otra cosa. Y cuando te dormís y soñás… capaz que simplemente te despertás en otro lado.'],
      q:'¿Cómo sabés que ahora mismo no estás soñando?' },
    { id:'retorno', exp:'cosmos', ic:'🔁', t:'El Eterno Retorno',
      p:['Nietzsche propuso un experimento: imaginá que un demonio te dice que vas a vivir esta misma vida otra vez, y otra, infinitas veces. Exactamente igual, cada dolor, cada alegría, este mismo momento.',
         'Si el tiempo es infinito y la materia finita, en algún momento todas las combinaciones se repiten. Incluida esta.',
         'La pregunta no es si es verdad. Es cómo reaccionarías: ¿te tirarías al piso desesperado, o dirías "¡dale, de nuevo!"?'],
      q:'¿Firmarías vivir tu vida exactamente igual, infinitas veces?' },
    { id:'cubeta', exp:'boltzmann', ic:'🫙', t:'El Cerebro en una Cubeta',
      p:['Imaginá un cerebro en un frasco, conectado a una computadora que le manda exactamente los impulsos que mandarían los ojos, los oídos, la piel.',
         'Ese cerebro sentiría el sol, el sabor de una milanesa, el frío del invierno. No tendría ninguna forma de saber que es un cerebro en un frasco.',
         'Y vos tampoco. Todo lo que sabés del mundo te llega como señales eléctricas. Nunca tocaste la realidad: solo las señales.'],
      q:'Si te ofrecieran una cubeta con la vida perfecta, ¿te conectarías?' },
    { id:'holograma', exp:'observador', ic:'💠', t:'El Universo Holográfico',
      p:['Estudiando los agujeros negros, los físicos descubrieron algo raro: toda la información de lo que cae adentro parece quedar guardada en su superficie, no en su volumen.',
         'Si eso vale para todo, el universo entero podría ser como un holograma: una superficie plana de información, lejísimos, que se proyecta como algo de tres dimensiones.',
         'Vos, tu casa, el planeta, serían la proyección de un dibujo plano en el borde del cosmos. La profundidad sería una ilusión.'],
      q:'Si todo es una proyección, ¿qué está proyectándose ahora como vos?' },
    { id:'filtro', exp:'inmortal', ic:'🚧', t:'El Gran Filtro',
      p:['Si la vida inteligente fuera común, el universo estaría lleno de civilizaciones. No vemos ninguna. Entonces hay algo —un filtro— que casi nadie logra pasar.',
         'Puede que esté atrás nuestro: que la vida sea un milagro rarísimo y nosotros ya lo pasamos. O puede que esté adelante: que todas las civilizaciones se autodestruyan al llegar a cierto nivel.',
         'Por eso algunos científicos dicen que encontrar vida en Marte sería una mala noticia: significaría que la vida es fácil… y que el filtro todavía nos espera.'],
      q:'¿Creés que el filtro ya lo pasamos o lo tenemos adelante?' },
    { id:'panpsiquismo', exp:'zombi', ic:'🪨', t:'El Panpsiquismo',
      p:['Al revés del zombi filosófico: ¿y si todo tiene algo de conciencia? No solo las personas y los animales, también las plantas, las piedras, los átomos.',
         'No pensamientos como los tuyos, sino una chispa mínima de "ser algo". Y cuando la materia se organiza en un cerebro, esas chispas se juntan en una conciencia grande.',
         'El universo no sería un lugar muerto donde por casualidad apareció la vida. Sería algo que, de a poquito, se está dando cuenta de que existe.'],
      q:'Si tu silla tuviera una chispa de conciencia, ¿qué sentiría ahora?' },
    { id:'termica', exp:'cosmos', ic:'🕯️', t:'La Muerte Térmica',
      p:['El universo se expande y se enfría. Dentro de muchísimo tiempo, las estrellas se van a apagar una por una. Los agujeros negros se van a evaporar.',
         'Al final quedará todo a la misma temperatura, sin luz, sin movimiento, sin ningún cambio posible. Un silencio perfecto y eterno.',
         'Todo lo que existió —cada canción, cada gol, cada beso— habrá pasado en un instante luminoso entre la nada de antes y la nada de después. Y por eso mismo vale tanto.'],
      q:'Si todo se apaga al final, ¿qué hace que algo valga la pena hoy?' },
    { id:'mono', exp:'simulacion', ic:'🐒', t:'El Mono Infinito',
      p:['Un mono tecleando al azar en una máquina de escribir, durante un tiempo infinito, tarde o temprano va a escribir todas las obras de Shakespeare. Letra por letra.',
         'Y también va a escribir tu biografía completa. La de mañana. Y la versión donde Vélez gana diez Libertadores.',
         'Con infinito tiempo, todo lo posible pasa. Lo que nos parece un milagro sería, simplemente, una cuestión de esperar lo suficiente.'],
      q:'¿Qué te parece imposible que, con tiempo infinito, igual pasaría?' },
    { id:'antropico', exp:'huevo', ic:'🎯', t:'El Principio Antrópico',
      p:['Si la gravedad fuera apenas más fuerte, las estrellas se quemarían en un ratito. Si fuera apenas más débil, nunca se formarían. Y así con decenas de números del universo.',
         'Todo parece afinado al milímetro para que exista la vida. ¿Casualidad? ¿Diseño? ¿O hay infinitos universos y obvio que estamos en uno donde se pudo?',
         'Sea como sea, existís en el único tipo de universo donde alguien podría preguntarse por qué existe. Ganaste la lotería más difícil del cosmos.'],
      q:'¿Qué hacés con haber ganado la lotería de existir?' },
  ];
  /* Estrenos: cada viernes a las 00 (hora argentina) sale una teoría nueva, descubrible de viernes a domingo.
     Las que viste quedan en tu colección; las que te perdiste vuelven a salir cuando rota la lista. */
  const EPOCH = Date.parse('2026-11-13T03:00:00Z'), WEEK = 7 * 864e5, FIRST = 6;
  const ar = () => new Date(Date.now() - 3 * 3600e3 + new Date().getTimezoneOffset() * 6e4);   // reloj de Argentina
  const isOpen = () => [5, 6, 0].includes(ar().getDay());
  const weekIdx = () => Math.floor((Date.now() - EPOCH) / WEEK);
  const drop = () => { const w = weekIdx(); return w < 0 ? null : T[(FIRST + w) % T.length]; };
  const nextFriday = () => { const now = Date.now(); let w = weekIdx(); let t = EPOCH + (w + 1) * WEEK; if (w < 0) t = EPOCH; return new Date(t); };
  const seen = () => { db.flashSeen = db.flashSeen || T.slice(0, FIRST).map(x => x.id); return db.flashSeen; };
  const discover = th => { if (!seen().includes(th.id)) { seen().push(th.id); save(); } };
  let cur = null;
  const today = () => (isOpen() && drop()) || null;

  /* ---------- narración (voz del navegador) ---------- */
  let speakOn = S.get('flSpeak', true);
  function speak(th) {
    try { speechSynthesis.cancel(); } catch {} if (!speakOn || !('speechSynthesis' in window)) return;
    const vs = speechSynthesis.getVoices(), v = vs.find(x => /es-AR/i.test(x.lang)) || vs.find(x => /^es/i.test(x.lang));
    [th.t, ...th.p].forEach((t, i) => { const u = new SpeechSynthesisUtterance(t); u.lang = v?.lang || 'es-AR'; if (v) u.voice = v; u.rate = .92; u.pitch = .95; speechSynthesis.speak(u); });
  }

  /* ---------- tarjeta en 420 time ---------- */
  function render(el) {
    const d = today(); if (d) discover(d);
    const mine = T.filter(x => seen().includes(x.id));
    if (!cur || (!seen().includes(cur.id))) cur = d || null;
    const left = () => { const ms = nextFriday() - Date.now(), D = Math.floor(ms / 864e5), H = Math.floor(ms % 864e5 / 36e5), M = Math.floor(ms % 36e5 / 6e4); return `${D ? D + ' d ' : ''}${H} h ${M} min`; };
    const lock = !d ? `<div class="fllock"><div class="flic">🔒</div><small class="fltag">PRÓXIMO ESTRENO EXCLUSIVO</small><h3>Viernes 00:00</h3><p>Una teoría nueva, solo de viernes a domingo. Faltan <b>${left()}</b>.</p><p class="mut">Si la descubrís en el finde, queda para siempre en tu colección.</p></div>` : '';
    const card = cur ? `<div class="flcard">${cur === d ? '<div class="flestreno">🎬 ESTRENO EXCLUSIVO · hasta el domingo 23:59</div>' : ''}<div class="flic">${cur.ic}</div><small class="fltag">${cur === d ? '🌀 LA DE ESTE FINDE' : '🌀 DE TU COLECCIÓN'}</small><h3>${esc(cur.t)}</h3>${cur.p.map(x => `<p>${esc(x)}</p>`).join('')}
      <div class="btns"><button class="pri" id="flGo">▶ Vivirla</button><button id="flSpk">${speakOn ? '🔊 Con voz' : '🔇 Sin voz'}</button></div>
      <div class="flq"><b>🗣️ Flasheala:</b> ${esc(cur.q)}</div></div>` : '';
    el.innerHTML = `${lock}${card}
      <h4 class="flcol">🗂️ Tu colección · ${mine.length} de ${T.length} teorías descubiertas</h4>
      <div class="chips flchips">${mine.map(x => `<button data-fl="${x.id}" class="${x === cur ? 'on' : ''}">${x.ic} ${esc(x.t)}</button>`).join('')}${T.length - mine.length ? `<span class="mut flmiss">🔒 ${T.length - mine.length} por descubrir</span>` : ''}</div>`;
    if (!cur) { el.querySelector('.flchips').onclick = e => { const b = e.target.closest('[data-fl]'); if (b) { cur = T.find(x => x.id === b.dataset.fl); render(el); } }; return; }
    $('flGo').onclick = () => open(cur);
    $('flSpk').onclick = () => { speakOn = !speakOn; S.set('flSpeak', speakOn); render(el); };
    el.querySelector('.flchips').onclick = e => { const b = e.target.closest('[data-fl]'); if (b) { cur = T.find(x => x.id === b.dataset.fl); render(el); } };
  }

  /* ---------- la experiencia a pantalla completa ---------- */
  let stop = null;
  function open(th) {
    let d = $('dlgFlash'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgFlash'; d.className = 'fldlg'; document.body.appendChild(d); }
    d.innerHTML = `<canvas></canvas><div class="flhud" id="flHud"></div><div class="fltxt" id="flTxt"></div>
      <div class="flbar"><button data-f="prev">◀</button><button data-f="act" id="flAct">✨</button><button data-f="music">🎶</button><button data-f="voz">${speakOn ? '🔊' : '🔇'}</button><button data-f="next">▶</button><button data-f="x">✕</button></div>`;
    if (!d.open) d.showModal();
    const cv = d.querySelector('canvas'), cx = cv.getContext('2d'), lite = Lite.on;
    const size = () => { const k = lite ? 1 : Math.min(2, devicePixelRatio || 1); cv.width = innerWidth * k; cv.height = innerHeight * k; };
    size(); addEventListener('resize', size);
    const txt = $('flTxt'), hud = $('flHud');
    let i = 0; const say = () => { txt.classList.remove('in'); void txt.offsetWidth; txt.innerHTML = `<small>${th.ic} ${esc(th.t)}</small>${esc(th.p[i % th.p.length])}`; txt.classList.add('in'); i++; };
    say(); const it = setInterval(say, 16000); speak(th);
    const exp = EXP[th.exp || th.id](cx, cv, hud, lite);
    $('flAct').textContent = exp.label || '✨';
    let raf; const t0 = performance.now(); const loop = now => { exp.frame((now - t0) / 1000); raf = requestAnimationFrame(loop); }; raf = requestAnimationFrame(loop);
    const pool = T.filter(x => seen().includes(x.id)), idx = Math.max(0, pool.indexOf(th));
    const close = () => { cancelAnimationFrame(raf); clearInterval(it); exp.end?.(); removeEventListener('resize', size); try { speechSynthesis.cancel(); } catch {} stop = null; };
    stop = close;
    d.onclose = close;
    d.querySelector('.flbar').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; const a = b.dataset.f;
      if (a === 'x') d.close();
      if (a === 'act') exp.act?.();
      if (a === 'music') { const l = db.music.items; if (l.length) Musica.play(l[Math.floor(Math.random() * l.length)]); else Musica.playAlbum(); }
      if (a === 'voz') { speakOn = !speakOn; S.set('flSpeak', speakOn); b.textContent = speakOn ? '🔊' : '🔇'; speakOn ? speak(th) : speechSynthesis?.cancel(); }
      if (a === 'prev' || a === 'next') { close(); open(pool[(idx + (a === 'next' ? 1 : -1) + pool.length) % pool.length]); } };
    cv.onclick = () => exp.act?.();
    $('flAct').focus();
  }

  /* ---------- las seis experiencias ---------- */
  const rnd = (a, b) => a + Math.random() * (b - a);
  const EXP = {
    // 🌌 viaje entre estrellas (OK: salto a velocidad luz)
    cosmos(cx, cv, hud, lite) {
      const st = Array.from({ length:lite ? 160 : 600 }, () => ({ x:rnd(-1, 1), y:rnd(-1, 1), z:rnd(.05, 1) })); let warp = 0;
      hud.innerHTML = '<div class="flsub">El cosmos, en silencio.</div>';
      return { label:'🚀 Saltar', act:() => { warp = 1; }, frame() {
        const W = cv.width, H = cv.height; warp = Math.max(0, warp - .006); cx.fillStyle = `rgba(2,2,10,${.35 - warp * .25})`; cx.fillRect(0, 0, W, H);
        st.forEach(s => { const pz = s.z; s.z -= .0025 + warp * .03; if (s.z < .02) { s.x = rnd(-1, 1); s.y = rnd(-1, 1); s.z = 1; return; }
          const k = Math.min(W, H) * .5, x = W / 2 + s.x / s.z * k, y = H / 2 + s.y / s.z * k, px = W / 2 + s.x / pz * k, py = H / 2 + s.y / pz * k;
          cx.strokeStyle = `rgba(200,220,255,${1 - s.z})`; cx.lineWidth = (1 - s.z) * 2.5; cx.beginPath(); cx.moveTo(px, py); cx.lineTo(x, y); cx.stroke(); });
      } };
    },
    // 🕹️ una grilla de código que de vez en cuando se "glitchea"
    simulacion(cx, cv, hud, lite) {
      const cols = lite ? 40 : 90, drops = Array.from({ length:cols }, () => rnd(0, 50)); let glitch = 0;
      hud.innerHTML = '<div class="flsub">Cargando realidad… 99%</div>';
      return { label:'⚡ Glitch', act:() => { glitch = 1; hud.innerHTML = '<div class="flsub">ERROR: render.vos() no responde</div>'; setTimeout(() => hud.innerHTML = '<div class="flsub">Todo normal. Seguí con lo tuyo.</div>', 1500); }, frame() {
        const W = cv.width, H = cv.height, fs = W / cols; cx.fillStyle = 'rgba(0,8,4,.18)'; cx.fillRect(0, 0, W, H); cx.font = `${fs}px monospace`;
        drops.forEach((d, k) => { cx.fillStyle = Math.random() < .1 ? '#cfffe0' : '#24d36b'; cx.fillText(String.fromCharCode(0x30A0 + Math.random() * 96), k * fs, d * fs); drops[k] = d * fs > H && Math.random() > .97 ? 0 : d + 1; });
        if (glitch > 0) { glitch -= .03; for (let k = 0; k < 6; k++) { const y = rnd(0, H), h = rnd(4, 40); cx.drawImage(cv, 0, y, W, h, rnd(-40, 40), y, W, h); } cx.fillStyle = `rgba(255,0,80,${glitch * .3})`; cx.fillRect(0, 0, W, H); }
      } };
    },
    // 🥚 un huevo que late; las estrellas (todas tus vidas) caen adentro; contador de vidas vividas
    huevo(cx, cv, hud, lite) {
      const S0 = 117e9, t0 = Date.now(), stars = Array.from({ length:lite ? 90 : 260 }, () => ({ a:rnd(0, 6.3), r:rnd(.3, 1), s:rnd(.0006, .002) }));
      const vos = ['alguien en Tokio comiendo ramen', 'un pescador en Chiloé', 'tu vecino del 4°B', 'el árbitro del próximo partido de Vélez', 'una abuela en Kiev regando plantas', 'un pibe aprendiendo a andar en bici en Rosario', 'el que inventó la rueda', 'Julio César', 'el que te vendió la última birra', 'un monje en el Tíbet', 'la que está naciendo ahora en Lagos', 'el que escribió esta frase'];
      let k = 0;
      const show = () => { hud.innerHTML = `<div class="flbig">${(S0 + Math.floor((Date.now() - t0) / 1000 * 4.3)).toLocaleString('es-AR')}</div><div class="flsub">vidas que ya viviste</div><div class="flnow">ahora mismo sos <b>${vos[k++ % vos.length]}</b></div>`; };
      show(); const iv = setInterval(show, 4000);
      return { label:'🥚 Otra vida', act:show, end:() => clearInterval(iv), frame(t) {
        const W = cv.width, H = cv.height, cxm = W / 2, cym = H * .46, R = Math.min(W, H) * .16 * (1 + .04 * Math.sin(t * 2));
        cx.fillStyle = 'rgba(5,4,14,.25)'; cx.fillRect(0, 0, W, H);
        stars.forEach(s => { s.r -= s.s; if (s.r < .05) { s.r = 1; s.a = rnd(0, 6.3); } const d = s.r * Math.max(W, H) * .7; cx.fillStyle = `rgba(255,240,200,${.9 - s.r * .6})`; cx.fillRect(cxm + Math.cos(s.a + t * .05) * d, cym + Math.sin(s.a + t * .05) * d, 2, 2); });
        const g = cx.createRadialGradient(cxm, cym - R * .3, R * .1, cxm, cym, R * 1.6); g.addColorStop(0, '#fff8e0'); g.addColorStop(.5, '#ffd27a'); g.addColorStop(1, 'rgba(255,170,60,0)');
        cx.fillStyle = g; cx.beginPath(); cx.ellipse(cxm, cym, R * .8, R, 0, 0, 7); cx.fill();
      } };
    },
    // ⏱️ el universo fue creado hace… (desde que abriste) + tus recuerdos implantados
    jueves(cx, cv, hud, lite) {
      const t0 = Date.now(), mem = [Musica.track?.title && `🎵 la última canción: “${Musica.track.title}”`, Radio.current && `📻 que estabas con ${Radio.current.name}`,
        (() => { const g = Object.values(db.stats || {}).flatMap(d => Object.values(d).flatMap(q => q.goles || [])).sort((a, b) => b.t - a.t)[0]; return g && `⚽ ese gol: ${g.line}`; })(),
        '🍝 la comida a mitad de digerir', '👟 el desgaste de tus zapatillas', '🧹 el polvo sobre la mesa', '🩹 cada cicatriz que tenés', '🦖 los fósiles de dinosaurios'].filter(Boolean);
      const show = () => { const s = Math.floor((Date.now() - t0) / 1000); hud.innerHTML = `<div class="flsub">El universo fue creado hace</div><div class="flbig">${String(Math.floor(s / 3600)).padStart(2, '0')}:${String(Math.floor(s / 60) % 60).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}</div><div class="flmem">Recuerdos implantados:<br>${mem.slice(0, 5).map(esc).join('<br>')}</div>`; };
      show(); const iv = setInterval(show, 1000);
      return { label:'🔀 Mezclar recuerdos', act:() => mem.sort(() => Math.random() - .5), end:() => clearInterval(iv), frame(t) {
        const W = cv.width, H = cv.height; cx.fillStyle = '#0b0a10'; cx.fillRect(0, 0, W, H);
        const n = lite ? 500 : 1800; for (let k = 0; k < n; k++) { const v = Math.random() * 60; cx.fillStyle = `rgb(${v},${v},${v + 10})`; cx.fillRect(Math.random() * W, Math.random() * H, 2, 2); }   // grano de película
      } };
    },
    // 👁️ todo superpuesto hasta que mirás (tocás / OK): colapsa a una sola realidad
    observador(cx, cv, hud, lite) {
      let seen = 0, col = 0; const stars = Array.from({ length:lite ? 120 : 400 }, () => [Math.random(), Math.random(), rnd(.5, 2)]);
      hud.innerHTML = '<div class="flsub">Nada está decidido.<br>Tocá la pantalla (o OK) para mirar.</div>';
      return { label:'👁️ Mirar', act:() => { seen = performance.now(); hud.innerHTML = '<div class="flsub">Tuviste que mirar para que existiera.</div>'; }, frame(t) {
        const W = cv.width, H = cv.height; col = seen ? Math.min(1, (performance.now() - seen) / 1800) : Math.max(0, col - .01);
        if (seen && performance.now() - seen > 20000) { seen = 0; hud.innerHTML = '<div class="flsub">Dejaste de mirar… todo vuelve a ser posible.</div>'; }
        cx.fillStyle = `rgba(4,4,12,${.15 + col * .5})`; cx.fillRect(0, 0, W, H);
        const waves = lite ? 6 : 14;
        for (let w = 0; w < waves * (1 - col) + 1; w++) { cx.strokeStyle = `hsla(${(w * 40 + t * 20) % 360},90%,60%,${.12 * (1 - col)})`; cx.lineWidth = 3; cx.beginPath();
          for (let x = 0; x <= W; x += 12) { const y = H / 2 + Math.sin(x / (60 + w * 9) + t * (1 + w * .2)) * H * .3 * Math.sin(t * .3 + w); x ? cx.lineTo(x, y) : cx.moveTo(x, y); } cx.stroke(); }
        if (col > 0) { stars.forEach(([x, y, r]) => { cx.fillStyle = `rgba(255,255,255,${col})`; cx.fillRect(x * W, y * H, r, r); });
          const R = Math.min(W, H) * .12; const g = cx.createRadialGradient(W * .5, H * .45, R * .2, W * .5, H * .45, R); g.addColorStop(0, `rgba(120,170,255,${col})`); g.addColorStop(1, `rgba(20,40,120,${col * .9})`);
          cx.fillStyle = g; cx.beginPath(); cx.arc(W * .5, H * .45, R, 0, 7); cx.fill(); }
      } };
    },
    // 🧠 partículas que se ensamblan en un cerebro un instante y se desarman
    boltzmann(cx, cv, hud, lite) {
      const N = lite ? 260 : 900, pts = Array.from({ length:N }, () => ({ x:Math.random(), y:Math.random(), vx:rnd(-.001, .001), vy:rnd(-.001, .001), tx:0, ty:0 }));
      const target = () => pts.forEach((p, k) => { const lobe = k % 2 ? 1 : -1, a = Math.random() * 6.3, r = Math.sqrt(Math.random()), wig = .02 * Math.sin(a * 9);
        p.tx = .5 + lobe * .085 + Math.cos(a) * (.13 + wig) * r * .9; p.ty = .46 + Math.sin(a) * (.16 + wig) * r * .75; });
      let phase = 'caos', tp = performance.now();
      const go = () => { target(); phase = 'arma'; tp = performance.now(); hud.innerHTML = '<div class="flsub">Ensamblándote…</div>'; };
      setTimeout(go, 2500);
      return { label:'🧠 Ensamblarme', act:go, frame() {
        const W = cv.width, H = cv.height, el = performance.now() - tp;
        if (phase === 'arma' && el > 4000) { phase = 'vivo'; tp = performance.now(); hud.innerHTML = '<div class="flsub">Existís. Tenés recuerdos. Estás leyendo esto.</div>'; }
        if (phase === 'vivo' && el > 6000) { phase = 'caos'; tp = performance.now(); pts.forEach(p => { p.vx = rnd(-.004, .004); p.vy = rnd(-.004, .004); }); hud.innerHTML = '<div class="flsub">…y te desarmaste.</div>'; }
        cx.fillStyle = 'rgba(3,3,10,.3)'; cx.fillRect(0, 0, W, H);
        pts.forEach(p => {
          if (phase === 'caos') { p.x += p.vx; p.y += p.vy; p.vx *= .995; p.vy *= .995; p.vx += rnd(-.0002, .0002); p.vy += rnd(-.0002, .0002); }
          else { p.x += (p.tx - p.x) * .05; p.y += (p.ty - p.y) * .05; }
          cx.fillStyle = phase === 'vivo' ? '#ff9ad5' : '#9fc0ff'; cx.fillRect(p.x * W, p.y * H, 2.5, 2.5);
        });
      } };
    },
    // ♾️ líneas de tiempo que se abren: las ramas mueren, la tuya siempre sigue
    inmortal(cx, cv, hud, lite) {
      let zaf = Math.floor(rnd(3, 9)), tips = [], dead = [];
      const reset = () => { tips = [{ x:.5, y:.95, a:-Math.PI / 2, me:true }]; dead = []; };
      reset(); const paint = () => { hud.innerHTML = `<div class="flbig">${zaf}</div><div class="flsub">veces que zafaste hoy (en esta línea)</div>`; }; paint();
      let last = 0;
      return { label:'⏭️ Seguir viviendo', act:() => { zaf++; paint(); }, frame(t) {
        const W = cv.width, H = cv.height; cx.fillStyle = 'rgba(2,6,14,.04)'; cx.fillRect(0, 0, W, H);
        if (t - last > .05) { last = t;
          tips.forEach(p => { const nx = p.x + Math.cos(p.a) * .004, ny = p.y + Math.sin(p.a) * .004; cx.strokeStyle = p.me ? '#7fe0ff' : 'rgba(160,160,180,.5)'; cx.lineWidth = p.me ? 3 : 1.5;
            cx.beginPath(); cx.moveTo(p.x * W, p.y * H); cx.lineTo(nx * W, ny * H); cx.stroke(); p.x = nx; p.y = ny; p.a += rnd(-.06, .06); });
          if (Math.random() < .04 && tips.length < (lite ? 20 : 60)) { const me = tips.find(p => p.me); tips.push({ x:me.x, y:me.y, a:me.a + rnd(-.8, .8), me:false, life:rnd(40, 160) }); if (Math.random() < .5) { zaf++; paint(); } }
          tips = tips.filter(p => { if (!p.me && (p.life -= 1) < 0) { cx.fillStyle = '#ff4d5e'; cx.beginPath(); cx.arc(p.x * W, p.y * H, 4, 0, 7); cx.fill(); return false; } return true; });
          const me = tips.find(p => p.me); if (me.y < .05 || me.x < .03 || me.x > .97) { cx.fillStyle = '#02060e'; cx.fillRect(0, 0, W, H); reset(); }
        }
      } };
    },
    // 🧍 un colectivo lleno de siluetas apagadas; una sola encendida: vos
    zombi(cx, cv, hud, lite) {
      const cols = lite ? 9 : 14, rows = lite ? 4 : 6, ppl = []; for (let r = 0; r < rows; r++) for (let c = 0; c < cols; c++) ppl.push({ c, r, lit:0 });
      const me = ppl[Math.floor(ppl.length / 2) + Math.floor(cols / 2)]; me.me = true;
      hud.innerHTML = '<div class="flsub">La única luz encendida… ¿sos vos?</div>';
      return { label:'🔦 Mirar a alguien', act:() => { const p = ppl[Math.floor(Math.random() * ppl.length)]; if (p.me) return; p.lit = Math.random() < .35 ? 1 : -1; hud.innerHTML = `<div class="flsub">${p.lit > 0 ? '…¿se prendió? ¿o te pareció?' : 'Nada. Apagado por dentro.'}</div>`; }, frame(t) {
        const W = cv.width, H = cv.height, sx = W / (cols + 1), sy = H * .7 / (rows + 1);
        cx.fillStyle = '#07070b'; cx.fillRect(0, 0, W, H);
        ppl.forEach(p => { const x = sx * (p.c + 1), y = H * .12 + sy * (p.r + 1), s = Math.min(sx, sy) * .35, on = p.me || p.lit > 0;
          if (p.lit) p.lit *= .985; if (Math.abs(p.lit) < .05) p.lit = 0;
          if (on) { const g = cx.createRadialGradient(x, y, 0, x, y, s * 3); g.addColorStop(0, `rgba(255,214,120,${p.me ? .5 + .2 * Math.sin(t * 2) : p.lit * .5})`); g.addColorStop(1, 'rgba(255,214,120,0)'); cx.fillStyle = g; cx.fillRect(x - s * 3, y - s * 3, s * 6, s * 6); }
          cx.fillStyle = on ? (p.me ? '#ffd678' : `rgba(255,214,120,${p.lit})`) : '#2a2a33';
          cx.beginPath(); cx.arc(x, y - s * .9, s * .45, 0, 7); cx.fill(); cx.beginPath(); cx.ellipse(x, y + s * .3, s * .6, s * .8, 0, 0, 7); cx.fill(); });
      } };
    },
  };
  return { render, open, today, close:() => stop?.() };
})();
