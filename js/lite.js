/* =========================================================
   ⚡ Modo liviano (pensado para el Fire Stick). Se elige por aparato en ⚙ Ajustes y NO se sincroniza:
   en el Fire Stick arranca prendido, en la compu y el celu apagado.
   - Sin animaciones, sombras ni transiciones.
   - Mientras suena un video o una radio, se frenan las actualizaciones de fondo (Fulbito, Prode, Motor…).
   - Video hasta 720p y efecto de zapping sin nieve.
   Va antes que todo lo demás para poder frenar los relojes de fondo.
   ========================================================= */
const Lite = (() => {
  const tv = /FUNVSTV|AFT[A-Z]/.test(navigator.userAgent);
  let on; try { const v = localStorage.getItem('lite'); on = v == null ? tv : JSON.parse(v); } catch { on = tv; }
  const apply = () => document.documentElement.classList.toggle('lite', on);
  apply();
  // ¿está sonando algo? (video en Canales o radio)
  const busy = () => { try { return Player.slots.some(Boolean) || (!!Radio.current && !document.getElementById('radioAudio').paused); } catch { return false; } };
  // relojes de fondo: los del reproductor, la pantalla TV, el zapping, la radio y la música siguen; el resto espera
  const KEEP = /\/(player|tv|zapping|radio|radiogrilla|musica|core|app|lite|reloj)\.js/;
  const _si = window.setInterval.bind(window);
  window.setInterval = function (fn, ms, ...a) {
    if (typeof fn !== 'function') return _si(fn, ms, ...a);
    const keep = KEEP.test((new Error().stack || '').split('\n').slice(2).join('\n'));   // quién lo pidió (salteo esta función)
    return _si(function () { if (!keep && on && busy()) return; return fn.apply(this, arguments); }, ms, ...a);
  };
  function set(v) { on = !!v; try { localStorage.setItem('lite', JSON.stringify(on)); } catch {} apply(); }
  return { get on() { return on; }, set, tv, busy };
})();
