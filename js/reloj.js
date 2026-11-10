/* =========================================================
   🌙 Apagado automático y ⏰ Despertador con radio.
   - Dormir: en X minutos (o cuando termina el programa de la radio) baja el volumen de a poco y apaga todo.
   - Despertador: a la hora y los días que elijas arranca tu radio, subiendo el volumen despacito.
     Se guarda en cada aparato (no se sincroniza: no querés que suene la compu Y la tele).
     Necesita FUNVS abierto en ese aparato (en la tele, la app abierta; la pantalla no se apaga sola).
   ========================================================= */
const Reloj = (() => {
  let sleepAt = 0, sleepTotal = 0, fading = false, baseVol = null, snoozeAt = 0, lastFire = S.get('alarmLast', '');
  const alarm = () => S.get('alarm', { on:false, time:'07:30', days:[1, 2, 3, 4, 5], radio:'', vol:0.7 });
  const DAYS = ['D', 'L', 'M', 'M', 'J', 'V', 'S'];
  const sink = () => { const id = AudioMgr.active; return id ? AudioMgr.sink(id) : null; };

  /* ---------- 🌙 Dormir ---------- */
  function sleepIn(min) {
    if (!min) { sleepAt = 0; fading = false; restoreVol(); toast('🌙 Apagado automático cancelado', { ms:2000 }); return paint(); }
    sleepAt = Date.now() + min * 60e3; sleepTotal = min; fading = false;
    toast(`🌙 Se apaga en ${min} minutos`, { ms:2500 }); paint();
  }
  function untilShowEnds() {
    const r = Radio.current, p = r && RadioGrilla.nowFor(r);
    if (!p) { toast('Esta radio no tiene grilla: elegí minutos', { cls:'info', ms:2500 }); return; }
    sleepIn(Math.max(1, Math.round((p.e - Date.now()) / 60e3)));
  }
  function restoreVol() { const s = sink(); if (baseVol != null && s?.setVol) try { s.setVol(baseVol); } catch {} baseVol = null; }
  function allOff() {
    const s = sink(), v = baseVol; if (s?.setVol && v != null) try { s.setVol(v); } catch {}   // la próxima vez suena con el volumen de siempre
    try { Player.closeAll(); } catch {} try { Radio.stop(); } catch {} try { Musica.stop(); } catch {}
    try { if ($('player').classList.contains('tvmode')) TV.close(); } catch {}
    baseVol = null; toast('🌙 Buenas noches', { ms:4000 });
  }
  function sleepTick() {
    if (!sleepAt) return;
    const left = sleepAt - Date.now(), s = sink();
    if (left <= 60e3 && s?.setVol && s.getVol) {   // último minuto: fundido
      if (!fading) { fading = true; baseVol = s.getVol(); }
      try { s.setVol(Math.max(0, baseVol * left / 60e3)); } catch {}
    }
    if (left <= 0) { sleepAt = 0; fading = false; allOff(); }
    paint();
  }
  function openSleep() {
    let d = $('dlgSleep'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgSleep'; d.className = 'rdlg'; document.body.appendChild(d); }
    const p = Radio.current && RadioGrilla.nowFor(Radio.current);
    d.innerHTML = `<h3>🌙 Apagar en…</h3><div class="rgrid2">${[15, 30, 45, 60, 90, 120].map(m => `<button data-m="${m}">${m < 60 ? m + ' min' : m / 60 + (m === 60 ? ' hora' : ' horas')}</button>`).join('')}</div>
      ${p ? `<button class="rwide" data-end>📻 Cuando termine “${esc(p.name)}” (${p.e.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' })})</button>` : ''}
      <div class="btns">${sleepAt ? '<button data-m="0">Cancelar el apagado</button>' : ''}<span class="sp"></span><button data-x>Cerrar</button></div>`;
    d.showModal(); d.querySelector('button')?.focus();
    d.onclick = e => { const b = e.target.closest('button'); if (!b) return; if (b.dataset.m != null) sleepIn(+b.dataset.m); if (b.hasAttribute('data-end')) untilShowEnds(); d.close(); };
  }

  /* ---------- ⏰ Despertador ---------- */
  function openAlarm() {
    const a = alarm();
    let d = $('dlgAlarm'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgAlarm'; d.className = 'rdlg'; document.body.appendChild(d); }
    d.innerHTML = `<h3>⏰ Despertador con radio</h3>
      <label class="chk"><input type="checkbox" id="alOn" ${a.on ? 'checked' : ''}> Prendido en este aparato</label>
      <div class="alrow"><label>Hora<input type="time" id="alT" value="${a.time}"></label>
        <label>Radio<select id="alR">${db.radios.length ? db.radios.map(r => `<option value="${esc(r.url)}" ${r.url === a.radio ? 'selected' : ''}>${esc(r.name)}</option>`).join('') : '<option value="">(guardá radios en Radios)</option>'}</select></label></div>
      <div class="aldays">${[1, 2, 3, 4, 5, 6, 0].map(n => `<label class="chk"><input type="checkbox" data-d="${n}" ${a.days.includes(n) ? 'checked' : ''}> ${['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][n]}</label>`).join('')}</div>
      <label class="chk"><input type="checkbox" id="alSmart" ${a.smart !== false ? 'checked' : ''}> 🧠 Contame el día al despertar (clima y si juega Vélez)</label>
      <label>Volumen final <input type="range" id="alV" min="0.2" max="1" step="0.05" value="${a.vol}"></label>
      <p class="mut" style="font-size:12px">Arranca bajito y sube en 2 minutos. Tiene que estar FUNVS abierto en este aparato (en la compu, la pestaña; en la tele, la app). En el celu, con la pantalla apagada Android puede dormir la app.</p>
      <div class="btns"><button id="alTest">▶ Probar</button><span class="sp"></span><button id="alX">Cancelar</button><button class="pri" id="alOk">Guardar</button></div>`;
    d.showModal();
    const read = () => ({ on:$('alOn').checked, time:$('alT').value || '07:30', radio:$('alR').value, vol:+$('alV').value, smart:$('alSmart').checked, days:[...d.querySelectorAll('[data-d]')].filter(c => c.checked).map(c => +c.dataset.d) });
    $('alX').onclick = () => d.close();
    $('alTest').onclick = () => { d.close(); ring(read(), true); };
    $('alOk').onclick = () => { const v = read(); if (v.on && !v.radio) return toast('Elegí una radio', { cls:'info' }); S.set('alarm', v); d.close(); toast(v.on ? `⏰ Despertador a las ${v.time}` : '⏰ Despertador apagado', { ms:2500 }); paint(); };
  }
  /* 🧠 Despertador inteligente: antes de la radio te cuenta el día (clima de Monte Grande y si juega Vélez).
     Si llueve o hay tormenta, eso va primero. Si juega Vélez, te deja a mano la previa. */
  const WXT = c => c === 0 ? 'despejado' : c <= 2 ? 'algo nublado' : c === 3 ? 'nublado' : c <= 48 ? 'con niebla' : c <= 57 ? 'con llovizna' : c <= 67 ? 'con lluvia' : c <= 77 ? 'con nieve' : c <= 82 ? 'con chaparrones' : 'con tormentas';
  async function briefing() {
    const out = { lines:[], speak:[] }, n = new Date();
    try {
      const q = new URLSearchParams({ latitude:'-34.8157', longitude:'-58.4687', daily:'weather_code,temperature_2m_max,temperature_2m_min,precipitation_probability_max', current:'temperature_2m', forecast_days:'1', timezone:'America/Argentina/Buenos_Aires' });
      const j = await meteo(q, { signal:AbortSignal.timeout(8000) });
      const c = j.daily.weather_code[0], p = j.daily.precipitation_probability_max[0] ?? 0, mx = Math.round(j.daily.temperature_2m_max[0]), mn = Math.round(j.daily.temperature_2m_min[0]), now = Math.round(j.current.temperature_2m);
      const wet = c >= 95 ? '⛈️ Hoy hay tormentas: llevá paraguas y ojo al salir.' : (p >= 60 || (c >= 51 && c <= 82)) ? `☔ Hoy llueve (${p}%): llevá paraguas.` : '';
      if (wet) { out.lines.push(wet); out.speak.push(wet.replace(/^\S+\s/, '').replace(/\s*\(\d+%\)/, '')); }
      out.lines.push(`🌡️ Ahora ${now}°, máxima ${mx}° y mínima ${mn}°, ${WXT(c)}.`); out.speak.push(`Ahora hacen ${now} grados. Máxima de ${mx}, ${WXT(c)}.`);
    } catch {}
    try {   // 🗓 cómo es hoy
      const P = Dia.plan();
      if (P === 'oficina') { const v = Dia.viaje(new Date())[0], est = Transporte.estado('roca'); out.lines.unshift(`🏢 Hoy vas a la oficina: tren ${v.t} en Monte Grande.${est ? ' ' + est : ''}`); out.speak.unshift(`Hoy vas a la oficina. Tu tren sale a las ${v.t.replace(/^0/, '').replace(':', ' y ')}.${est ? ' ' + est : ''}`); }
      else if (P === 'home') { out.lines.unshift('🏠 Hoy es home office.'); out.speak.unshift('Hoy es home office.'); }
      else if (P === 'franco') { out.lines.unshift('🌴 Hoy tenés franco. ¡A disfrutar!'); out.speak.unshift('Hoy tenés franco.'); }
      else out.askPlan = true;
    } catch {}
    try {
      const m = Partido.match();
      if (m && m.state !== 'post') {
        const vel = [m.h, m.a].find(x => /v[eé]lez/i.test(x.team.displayName)), riv = [m.h, m.a].find(x => x !== vel);
        const hr = new Date(m.date).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
        out.lines.push(`💙 Hoy juega Vélez contra ${riv?.team.shortDisplayName || riv?.team.displayName} a las ${hr}${vel === m.h ? ', de local' : ''}. ¡Vamos Fortín!`);
        out.speak.push(`Y hoy juega Vélez contra ${riv?.team.displayName} a las ${hr}. Vamos Fortín.`); out.velez = true;
      }
    } catch {}
    return out;
  }
  function say(parts, done) {
    const t = parts.join(' ');
    if (!t || !('speechSynthesis' in window)) return done();
    try { const u = new SpeechSynthesisUtterance(t); u.lang = 'es-AR'; u.rate = 1; const v = speechSynthesis.getVoices().find(x => /^es/.test(x.lang)); if (v) u.voice = v;
      u.onend = u.onerror = () => done(); speechSynthesis.cancel(); speechSynthesis.speak(u); setTimeout(done, 25000); } catch { done(); }
  }
  async function ring(a, test) {
    const r = db.radios.find(x => x.url === a.radio) || db.radios[0]; if (!r) return;
    const b = a.smart !== false ? await briefing() : { lines:[], speak:[] };
    Radio.play(r);
    const s = AudioMgr.sink('radio'), t0 = Date.now();
    try { s.setVol(0.08); } catch {}
    let talking = b.speak.length > 0, up = null;
    const rise = () => { if (up) return; talking = false; const t1 = Date.now(); up = setInterval(() => { const k = Math.min(1, (Date.now() - t1) / 120e3); try { s.setVol(0.08 + (a.vol - 0.08) * k); } catch {} if (k >= 1) clearInterval(up); }, 2000); };
    if (talking) { try { s.setVol(0.03); } catch {} setTimeout(() => !$('dlgRing')?.open ? rise() : say([`${new Date().getHours() < 12 ? 'Buen día' : 'Hola'}. Son las ${new Date().getHours()} y ${new Date().getMinutes()}.`, ...b.speak], rise), 1500); }
    else rise();
    let d = $('dlgRing'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgRing'; d.className = 'rdlg ring'; document.body.appendChild(d); }
    const now = new Date();
    d.innerHTML = `<div class="ringt">${now.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' })}</div>
      <h3>${test ? 'Así va a sonar' : now.getHours() < 12 ? '☀️ ¡Buen día!' : '⏰ Arriba'}</h3>${b.lines.length ? `<div class="ringb">${b.lines.map(l => `<p>${esc(l)}</p>`).join('')}</div>` : ''}${b.askPlan ? `<p class="mut" style="margin:6px 0 2px">¿Cómo es hoy?</p><div class="dbtns">${Object.entries(Dia.OPC).map(([k, [ic, n]]) => `<button data-rplan="${k}">${ic} ${n}</button>`).join('')}</div>` : ''}<p>📻 ${esc(r.name)}${RadioGrilla.nowFor(r) ? ' · ' + esc(RadioGrilla.nowFor(r).name) : ''}</p>
      <div class="btns">${b.velez ? '<button id="rgVel">💙 Ver la previa</button>' : ''}<button id="rgSn">😴 10 minutos más</button><button class="pri" id="rgOk" autofocus>✓ Ya me levanté</button></div>`;
    d.showModal(); $('rgOk').focus();
    const stopTalk = () => { try { speechSynthesis.cancel(); } catch {} };
    d.querySelectorAll('[data-rplan]').forEach(x => x.onclick = () => { db.plan = db.plan || {}; const t = new Date(); db.plan[`${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`] = x.dataset.rplan; save();
      d.querySelectorAll('[data-rplan]').forEach(y => y.classList.toggle('on', y === x)); });
    $('rgOk').onclick = () => { stopTalk(); if (talking) rise(); d.close(); };   // la radio sigue sonando
    if ($('rgVel')) $('rgVel').onclick = () => { stopTalk(); if (talking) rise(); d.close(); Nav.go('velez'); };
    $('rgSn').onclick = () => { stopTalk(); clearInterval(up); d.close(); Radio.stop(); snoozeAt = Date.now() + 10 * 60e3; toast('😴 Te despierto en 10 minutos', { ms:3000 }); };
  }
  function alarmTick() {
    const a = alarm(), n = new Date();
    if (snoozeAt && Date.now() >= snoozeAt) { snoozeAt = 0; ring(a); return; }
    if (!a.on || !a.days.includes(n.getDay())) return;
    const hm = n.toTimeString().slice(0, 5), key = n.toISOString().slice(0, 10) + ' ' + a.time;
    // suena en su minuto (o hasta 5 min tarde si el aparato estaba dormido), una sola vez por día
    const [h, m] = a.time.split(':').map(Number), diff = (n.getHours() * 60 + n.getMinutes()) - (h * 60 + m);
    if (diff >= 0 && diff <= 5 && lastFire !== key) { lastFire = key; S.set('alarmLast', key); ring(a); }
  }

  /* ---------- en la barra de abajo ---------- */
  function paint() {
    const b = $('fSleep'); if (!b) return;
    const left = sleepAt ? Math.max(0, Math.ceil((sleepAt - Date.now()) / 60e3)) : 0, a = alarm();
    b.textContent = sleepAt ? `🌙 ${left}′` : '🌙'; b.classList.toggle('on', !!sleepAt);
    b.title = sleepAt ? `Se apaga en ${left} minutos` : 'Apagado automático';
    const al = $('fAlarm'); if (al) { al.textContent = a.on ? `⏰ ${a.time}` : '⏰'; al.classList.toggle('on', a.on); al.title = a.on ? `Despertador ${a.time} · ${a.days.map(x => DAYS[x]).join('')}` : 'Despertador'; }
  }
  function init() {
    const c = $('fCtl'); if (!c) return;
    c.insertAdjacentHTML('beforeend', '<button id="fSleep" class="fsl" title="Apagado automático">🌙</button>');
    $('fCtl').parentElement.querySelector('.fclock')?.insertAdjacentHTML('beforeend', '<button id="fAlarm" class="fal" title="Despertador">⏰</button>');
    $('fSleep').onclick = openSleep; $('fAlarm').onclick = openAlarm;
    setInterval(() => { sleepTick(); alarmTick(); }, 5000);
    paint();
  }
  Inicio.add({ id:'reloj', order:5, html() { const a = alarm(), left = sleepAt ? Math.ceil((sleepAt - Date.now()) / 60e3) : 0;
    return `<div class="inchips"><button data-r="sleep">🌙 ${sleepAt ? `Se apaga en ${left}′` : 'Apagar en…'}</button><button data-r="alarm">⏰ ${a.on ? `Despertador ${a.time} · ${a.days.map(x => DAYS[x]).join('')}` : 'Despertador'}</button></div>`; },
    bind(el) { el.querySelector('[data-r=sleep]').onclick = openSleep; el.querySelector('[data-r=alarm]').onclick = openAlarm; } });
  return { init, openSleep, openAlarm, sleepIn };
})();
