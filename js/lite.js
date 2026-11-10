/* =========================================================
   ⚡ Modo liviano (pensado para el Fire Stick). Se elige por aparato en ⚙ Ajustes y NO se sincroniza:
   en modo Tele arranca prendido, en la compu y el celu apagado.
   - Sin animaciones, sombras ni transiciones.
   - Mientras suena un video o una radio, se frenan las actualizaciones de fondo (Fulbito, Prode, Motor…).
   - Video hasta 720p y efecto de zapping sin nieve.
   Va antes que todo lo demás para poder frenar los relojes de fondo.
   ========================================================= */
/* =========================================================
   📟 Modo de este aparato: 🖥️ Compu · 📺 Tele (Fire Stick) · 📱 Celu. Se elige en ⚙ Ajustes y queda guardado
   SOLO en ese aparato (no se sincroniza). Si nunca lo elegiste, se adivina: Fire Stick → Tele, app o pantalla táctil chica → Celu.
   Celu: deja un margen en los bordes (las esquinas redondas del Moto G72 tapaban la hora), regulable.
   ========================================================= */
const Device = (() => {
  const UA = navigator.userAgent, MODES = { pc:'🖥️ Compu', tv:'📺 Tele (Fire Stick)', celu:'📱 Celu' };
  const guess = () => /FUNVSTV|AFT[A-Z]|Silk.*TV/.test(UA) ? 'tv' : (/FUNVSApp|Android|iPhone/.test(UA) || (matchMedia('(pointer:coarse)').matches && Math.min(screen.width, screen.height) < 700)) ? 'celu' : 'pc';
  const get = k => { try { return JSON.parse(localStorage.getItem(k)); } catch { return null; } };
  const chosen = get('device'), mode = MODES[chosen] ? chosen : guess();
  const edge = get('deviceEdge') ?? 18;
  const h = document.documentElement;
  h.classList.add('dev-' + mode);
  if (mode === 'tv') h.classList.add('tvapp', 'dpad');
  if (mode === 'celu') { h.style.setProperty('--edge', edge + 'px'); h.style.setProperty('--edgeb', Math.round(edge * .6) + 'px'); }
  function set(m) { try { localStorage.setItem('device', JSON.stringify(m)); } catch {} location.reload(); }
  function setEdge(px) { try { localStorage.setItem('deviceEdge', JSON.stringify(+px)); } catch {} h.style.setProperty('--edge', px + 'px'); h.style.setProperty('--edgeb', Math.round(px * .6) + 'px'); }
  return { mode, MODES, chosen:!!MODES[chosen], set, setEdge, get edge() { return get('deviceEdge') ?? 18; } };
})();

const Lite = (() => {
  const tv = Device.mode === 'tv';
  let on; try { const v = localStorage.getItem('lite'); on = v == null ? tv : JSON.parse(v); } catch { on = tv; }
  const apply = () => document.documentElement.classList.toggle('lite', on);
  apply();
  // ¿está sonando algo? (video en Canales o radio)
  const busy = () => { try { return Player.slots.some(Boolean) || (!!Radio.current && !document.getElementById('radioAudio').paused); } catch { return false; } };
  // relojes de fondo: los del reproductor, la pantalla TV, el zapping, la radio y la música siguen; el resto espera
  const KEEP = /\/(player|tv|zapping|radio|radiogrilla|musica|core|app|lite|reloj|avisos|partido|grafismo|tanda|flash420|zocalos)\.js/;
  const _si = window.setInterval.bind(window);
  window.setInterval = function (fn, ms, ...a) {
    if (typeof fn !== 'function') return _si(fn, ms, ...a);
    const keep = fn.keep || KEEP.test((new Error().stack || '').split('\n').slice(2).join('\n'));   // quién lo pidió (salteo esta función)
    return _si(function () { if (!keep && on && busy()) return; return fn.apply(this, arguments); }, ms, ...a);
  };
  function set(v) { on = !!v; try { localStorage.setItem('lite', JSON.stringify(on)); } catch {} apply(); }
  return { get on() { return on; }, set, tv, busy };
})();
