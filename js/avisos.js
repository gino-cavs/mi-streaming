/* =========================================================
   🔔 Avisame cuando empieza: tocás 🔔 en un programa (guía de canales o de radios) y FUNVS te avisa
   cada vez que arranca: en pantalla (con ▶ para ponerlo) y por Telegram unos 10 minutos antes.
   Para la TV de cable: avisos a mano (nombre, canal, días y hora), con el link a la grilla de mi.tv.
   Se guardan en tu configuración (db.recs, sincronizada) para que GitHub pueda mandar el Telegram.
   ========================================================= */
const Avisos = (() => {
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  const list = () => (db.recs = db.recs || []);
  const key = (k, ref, name) => `${k}|${ref}|${norm(name)}`;
  const has = (k, ref, name) => list().some(r => key(r.k, r.ref, r.name) === key(k, ref, name));
  const slug = s => norm(s).replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');
  const mitv = ch => 'https://mi.tv/ar/canales/' + slug(ch);
  function toggle(k, ref, where, name) {
    if (has(k, ref, name)) { db.recs = list().filter(r => key(r.k, r.ref, r.name) !== key(k, ref, name)); toast(`🔕 Ya no te aviso de ${esc(name)}`, { ms:2000 }); }
    else { list().push({ id:uid(), k, ref, where, name }); toast(`🔔 Te aviso cuando empiece <b>${esc(name)}</b><small>${esc(where)}${db.tg?.chat ? ' · también por Telegram' : ''}</small>`, { ms:3500 }); }
    save(); Inicio.render?.();
  }
  /** horarios semanales [día, inicio] del aviso */
  function slots(r) {
    if (r.k === 'tv') return (r.days || []).map(d => [DOW[d], r.time]);
    if (r.k === 'canal') { const g = Guia.data?.canales.find(x => String(x.id) === String(r.ref)); return g ? g.sch.filter(x => norm(x[3]) === norm(r.name)).map(x => [x[0], x[1]]) : []; }
    if (r.k === 'radio') { const own = Object.entries(db.radEdit || {}).find(([k]) => k === r.ref)?.[1], g = RadioGrilla.data?.radios.find(x => x.id === r.ref);
      return (own || g?.sch || []).filter(x => norm(x[3]) === norm(r.name)).map(x => [x[0], x[1]]); }
    return [];
  }
  function next(r, from = new Date()) {
    let best = null;
    for (const [dw, t] of slots(r)) { if (!t) continue; const [h, m] = t.split(':').map(Number);
      for (let d = 0; d < 8; d++) { const x = new Date(from); x.setDate(x.getDate() + d); x.setHours(h, m, 0, 0); if (DOW[x.getDay()] === dw && x > new Date(+from - 60e3)) { if (!best || x < best) best = x; break; } } }
    return best;
  }
  function play(r) {
    if (r.k === 'canal') { const g = Guia.data?.canales.find(x => String(x.id) === String(r.ref)), c = g && db.chans.find(c => Guia.match(c) === g); if (c) return Player.play(c); return Nav.go('canales'); }
    if (r.k === 'radio') { const x = db.radios.find(x => (RadioGrilla.match(x)?.id || 'u:' + x.url) === r.ref || 'u:' + x.url === r.ref); if (x) return Radio.play(x); return Nav.go('radios'); }
    window.open(mitv(r.where), '_blank');
  }
  // en pantalla, justo cuando arranca
  const shown = new Set(S.get('recShown', []));
  function tick() {
    const now = new Date();
    for (const r of list()) { const n = next(r, new Date(+now - 90e3)); if (!n) continue;
      const k = r.id + '@' + n.toISOString().slice(0, 16), dt = n - now;
      if (dt <= 30e3 && dt > -120e3 && !shown.has(k)) { shown.add(k); S.set('recShown', [...shown].slice(-50));
        Grafismo.notify(`🔔 <b>Empieza ${esc(r.name)}</b><small>${esc(r.where)} · tocá para ${r.k === 'tv' ? 'ver en mi.tv' : 'ponerlo'}</small>`, { cls:'info', ms:20000, kind:'avisos', onclick:() => play(r) }); } }
  }
  function openTv(ed) {
    Guia.load();
    let d = $('dlgRec'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgRec'; document.body.appendChild(d); }
    d.innerHTML = `<h3>📺 Aviso de un programa de TV</h3>
      <p class="mut" style="font-size:13px;margin-top:0">Fijate el horario en <a class="lnk" href="https://mi.tv/ar/programacion" target="_blank" rel="noopener">la grilla de mi.tv</a> o en <a class="lnk" href="https://www.telered.com.ar/buscador-grilla" target="_blank" rel="noopener">el buscador de TeleRed</a> y cargalo acá.</p>
      ${(() => { const tv = (Guia.data?.canales || []).filter(g => String(g.id).startsWith('tv-')); if (!tv.length) return '';
        return `<div class="rctv"><b>De la grilla de la TV de aire</b><div class="alrow"><select id="rcG">${tv.map(g => `<option value="${esc(String(g.id))}">${esc(g.n)}</option>`).join('')}</select><select id="rcP"></select><button type="button" id="rcGo" class="pri">🔔 Avisame</button></div><small class="mut">Te aviso cada vez que lo den, con el horario de la web del canal.</small></div><p class="mut" style="margin:10px 0 4px">…o cargalo a mano:</p>`; })()}
      <label>Programa<input id="rcN" placeholder="Ej: Fútbol de Primera"></label>
      <label>Canal<input id="rcC" placeholder="Ej: ESPN Premium"></label>
      <div class="alrow"><label>Hora<input type="time" id="rcT" value="21:00"></label></div>
      <div class="aldays">${[1, 2, 3, 4, 5, 6, 0].map(n => `<label class="chk"><input type="checkbox" data-d="${n}"> ${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][n]}</label>`).join('')}</div>
      <div class="btns"><span class="sp"></span><button id="rcX">Cancelar</button><button class="pri" id="rcOk">Guardar</button></div>`;
    d.showModal();
    if ($('rcG')) { const fillP = () => { const g = Guia.data.canales.find(x => String(x.id) === $('rcG').value); $('rcP').innerHTML = [...new Set(g.sch.map(x => x[3]))].sort().map(n => `<option>${esc(n)}</option>`).join(''); };
      $('rcG').onchange = fillP; fillP();
      $('rcGo').onclick = () => { const g = Guia.data.canales.find(x => String(x.id) === $('rcG').value); toggle('canal', g.id, g.n, $('rcP').value); d.close(); }; }
    $('rcX').onclick = () => d.close();
    $('rcOk').onclick = () => { const name = $('rcN').value.trim(), where = $('rcC').value.trim(), days = [...d.querySelectorAll('[data-d]')].filter(c => c.checked).map(c => +c.dataset.d);
      if (!name || !where || !days.length) return toast('Completá programa, canal y al menos un día', { cls:'info' });
      list().push({ id:uid(), k:'tv', ref:slug(where), where, name, days, time:$('rcT').value || '21:00' }); save(); d.close(); toast(`🔔 Te aviso de ${esc(name)}`, { ms:2500 }); Inicio.render(); };
  }
  setInterval(tick, 20e3);
  Inicio.add({ id:'avisos', order:20, html() {
    const l = list().map(r => ({ r, n:next(r) })).sort((a, b) => (a.n || 9e15) - (b.n || 9e15));
    const fmt = n => n ? n.toLocaleDateString('es-AR', { weekday:'short' }) + ' ' + n.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' }) : 'sin horario en la grilla';
    return `<h2 class="sec">🔔 Tus avisos</h2>${l.length ? `<div class="inlist">${l.slice(0, 8).map(({ r, n }) => `<div class="recrow"><button data-rp="${r.id}"><b>${esc(r.name)}</b><span>${esc(r.where)} · ${fmt(n)}</span></button><button class="recx" data-rx="${r.id}" title="Sacar">✕</button></div>`).join('')}</div>` : '<p class="mut" style="margin:0 0 6px">Tocá 🔔 en un programa de la guía de canales o de radios y te aviso cuando empiece.</p>'}
      <button class="lnk" data-rtv>➕ Aviso de un programa de TV (con mi.tv)</button>`; },
    bind(el) {
      el.querySelectorAll('[data-rp]').forEach(b => b.onclick = () => play(list().find(r => r.id === b.dataset.rp)));
      el.querySelectorAll('[data-rx]').forEach(b => b.onclick = () => { db.recs = list().filter(r => r.id !== b.dataset.rx); save(); Inicio.render(); });
      el.querySelector('[data-rtv]').onclick = () => openTv();
    } });
  return { toggle, has, next, mitv, openTv };
})();
