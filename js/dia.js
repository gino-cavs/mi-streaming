/* =========================================================
   🗓 Mi día: a la noche FUNVS te pregunta cómo es mañana (🏢 oficina · 🏠 home office · 🌴 franco) y se prepara.
   Oficina → tu viaje: tren Roca 4:51 en Monte Grande, el 28 de Constitución (calle Brasil) a Corrientes y Alem,
   y la vuelta (28 a las 15 / 14 los viernes, tren 15:24 / 14:24 los viernes desde Constitución), con avisos antes de cada uno.
   Home office o franco → nada de transporte, solo el clima.
   ========================================================= */
const Dia = (() => {
  const OPC = { oficina:['🏢', 'Oficina'], home:['🏠', 'Home office'], franco:['🌴', 'Franco'] };
  const ymd = d => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const plus = n => { const d = new Date(); d.setDate(d.getDate() + n); return d; };
  const finde = d => d.getDay() === 0 || d.getDay() === 6;   // sábados y domingos: siempre franco (salvo que lo cambies)
  const plan = d => (db.plan || {})[ymd(d)] || (finde(d) ? 'franco' : undefined);
  function setPlan(d, v) {
    db.plan = db.plan || {}; db.plan[ymd(d)] = v;
    Object.keys(db.plan).forEach(k => { if (Date.parse(k) < Date.now() - 7 * 864e5) delete db.plan[k]; });
    save(); try { Inicio.render(); } catch {}
  }
  // el viaje de un día (los viernes la vuelta es una hora antes)
  function viaje(d) {
    const vie = d.getDay() === 5;
    return [
      { t:'04:51', ic:'🚆', n:'Tren Roca', s:'Monte Grande → Constitución', k:'roca' },
      { t:'05:35', ic:'🚌', n:'Colectivo 28', s:'Constitución (calle Brasil) → Corrientes y Alem', k:'c28', hasta:'05:40' },
      { t:vie ? '14:00' : '15:00', ic:'🚌', n:'Colectivo 28', s:'Corrientes y Alem → Constitución', k:'c28' },
      { t:vie ? '14:24' : '15:24', ic:'🚆', n:'Tren Roca', s:'Constitución → Monte Grande', k:'roca' },
    ];
  }
  const at = (d, hm) => { const [h, m] = hm.split(':').map(Number); const x = new Date(d); x.setHours(h, m, 0, 0); return x; };

  /* ---------- la pregunta de la noche ---------- */
  function ask(d = plus(1), why = 'mañana') {
    const dia = d.toLocaleDateString('es-AR', { weekday:'long' });
    const btns = Object.entries(OPC).map(([k, [ic, n]]) => `<button data-plan="${k}">${ic} ${n}</button>`).join('');
    const onPick = el => el.querySelectorAll('[data-plan]').forEach(b => b.onclick = e => { e.stopPropagation(); setPlan(d, b.dataset.plan);
      const [ic, n] = OPC[b.dataset.plan]; toast(`${ic} <b>Anotado: ${why} ${n.toLowerCase()}</b><small>${b.dataset.plan === 'oficina' ? 'Te preparo el viaje y los avisos.' : 'Nada de transporte: solo el clima.'}</small>`, { ms:4000 });
      document.body.classList.remove('bpon'); $('dlgDia')?.close(); });
    if (document.body.classList.contains('tvlock')) {   // en la tele: en la barra de abajo, sin tapar
      Grafismo.barPop('🗓 ' + (why === 'hoy' ? 'HOY' : 'MAÑANA'), `<span>¿Cómo es tu ${dia}?</span><span class="dbtns">${btns}</span>`, { ms:90e3, max:90e3 });
      setTimeout(() => { const el = $('barpop'); if (el) { onPick(el); el.querySelector('[data-plan]')?.focus(); } }, 50);
      return;
    }
    let dl = $('dlgDia'); if (!dl) { dl = document.createElement('dialog'); dl.id = 'dlgDia'; dl.className = 'rdlg'; document.body.appendChild(dl); }
    dl.innerHTML = `<h3>🗓 ¿Cómo es tu ${dia}${why === 'hoy' ? ' (hoy)' : ''}?</h3><p class="mut">Así FUNVS se prepara: si vas a la oficina te sigo el viaje; si no, solo el clima.</p>
      <div class="dbtns big">${btns}</div><div class="btns"><span class="sp"></span><button id="diaX">Después</button></div>`;
    dl.showModal(); onPick(dl); $('diaX').onclick = () => dl.close(); dl.querySelector('[data-plan]')?.focus();
  }

  /* ---------- avisos del viaje (oficina) ---------- */
  let fired = new Set(S.get('diaFired', []));
  function tick() {
    const n = new Date(), h = n.getHours();
    // a la noche (20 a 23:59), una vez: ¿cómo es mañana?
    if (h >= 20 && !plan(plus(1)) && !document.hidden && S.get('diaAsked', '') !== ymd(n)) { S.set('diaAsked', ymd(n)); ask(); }
    if (plan(n) !== 'oficina') return;
    for (const v of viaje(n)) {
      const t = at(n, v.t), mins = Math.round((t - n) / 6e4), key = ymd(n) + v.t + v.k;
      if (mins === 15 && !fired.has(key)) {
        fired.add(key); S.set('diaFired', [...fired].slice(-30));
        const est = v.k === 'roca' ? Transporte.estado('roca') : null;
        Grafismo.notify(`${v.ic} <b>${esc(v.n)} ${v.t}${v.hasta ? '–' + v.hasta : ''}: en 15 minutos</b><span>${esc(v.s)}</span>${est ? `<small>${esc(est)}</small>` : ''}`, { ms:15000, lbl:'🗓 TU VIAJE', kind:'viaje' });
      }
    }
  }

  /* ---------- en Ahora ---------- */
  Inicio.add({ id:'dia', order:3, html() {
    const n = new Date(), hoyP = plan(n), manP = plan(plus(1)), late = n.getHours() >= 16;
    const P = late ? manP : hoyP, D = late ? plus(1) : n, quien = late ? 'Mañana' : 'Hoy';
    if (!P) return `<h2 class="sec">🗓 ${quien}</h2><div class="hmrow">${Object.entries(OPC).map(([k, [ic, nn]]) => `<button class="hmb" data-dplan="${k}"><span>${ic}</span>${nn}</button>`).join('')}</div>`;
    const [ic, nn] = OPC[P];
    let body = '';
    if (P === 'oficina') {
      const legs = viaje(D).map(v => { const t = at(D, v.t), past = !late && t < n - 5 * 6e4, mins = Math.round((t - n) / 6e4);
        return `<div class="dleg ${past ? 'past' : ''}"><b>${v.t}${v.hasta ? '–' + v.hasta : ''}</b><span>${v.ic} ${esc(v.n)}</span><small>${esc(v.s)}</small>${!late && mins > 0 && mins < 120 ? `<em>en ${mins} min</em>` : ''}</div>`; }).join('');
      const est = Transporte.estado('roca');
      body = `<div class="dlegs">${legs}</div><p class="mut" style="font-size:12px">${est ? '🚆 ' + esc(est) : '🚆 Roca sin novedades en las últimas horas (según las noticias). El 28 en vivo, cuando salga la API nueva de la Ciudad.'}</p>`;
    } else body = `<p class="mut">${P === 'home' ? 'Trabajás desde casa: nada de transporte, solo el clima.' : 'Día libre: nada de transporte. ¡A disfrutar! 🍃'}</p>`;
    return `<h2 class="sec">🗓 ${quien}: ${ic} ${nn} <button class="lnk" data-dchg style="margin-left:8px;font-size:12px">cambiar</button></h2>${body}`;
  }, bind(el) {
    const late = new Date().getHours() >= 16, D = late ? plus(1) : new Date();
    el.querySelectorAll('[data-dplan]').forEach(b => b.onclick = () => setPlan(D, b.dataset.dplan));
    el.querySelector('[data-dchg]')?.addEventListener('click', () => ask(D, late ? 'mañana' : 'hoy'));
  } });

  function init() { setInterval(tick, 30e3); setTimeout(tick, 15e3); }
  return { init, ask, plan:d => plan(d || new Date()), viaje, OPC };
})();

/* 🚆 Estado del transporte (lo llena la API de Transporte de la Ciudad cuando esté conectada) */
const Transporte = (() => {
  let data = null;
  return { estado:k => data?.[k] || '', set:d => { data = d; } };
})();
