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
      <label>Volumen final <input type="range" id="alV" min="0.2" max="1" step="0.05" value="${a.vol}"></label>
      <p class="mut" style="font-size:12px">Arranca bajito y sube en 2 minutos. Tiene que estar FUNVS abierto en este aparato (en la compu, la pestaña; en la tele, la app). En el celu, con la pantalla apagada Android puede dormir la app.</p>
      <div class="btns"><button id="alTest">▶ Probar</button><span class="sp"></span><button id="alX">Cancelar</button><button class="pri" id="alOk">Guardar</button></div>`;
    d.showModal();
    const read = () => ({ on:$('alOn').checked, time:$('alT').value || '07:30', radio:$('alR').value, vol:+$('alV').value, days:[...d.querySelectorAll('[data-d]')].filter(c => c.checked).map(c => +c.dataset.d) });
    $('alX').onclick = () => d.close();
    $('alTest').onclick = () => { d.close(); ring(read(), true); };
    $('alOk').onclick = () => { const v = read(); if (v.on && !v.radio) return toast('Elegí una radio', { cls:'info' }); S.set('alarm', v); d.close(); toast(v.on ? `⏰ Despertador a las ${v.time}` : '⏰ Despertador apagado', { ms:2500 }); paint(); };
  }
  function ring(a, test) {
    const r = db.radios.find(x => x.url === a.radio) || db.radios[0]; if (!r) return;
    Radio.play(r);
    const s = AudioMgr.sink('radio'), t0 = Date.now();
    try { s.setVol(0.08); } catch {}
    const up = setInterval(() => { const k = Math.min(1, (Date.now() - t0) / 120e3); try { s.setVol(0.08 + (a.vol - 0.08) * k); } catch {} if (k >= 1) clearInterval(up); }, 2000);
    let d = $('dlgRing'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgRing'; d.className = 'rdlg ring'; document.body.appendChild(d); }
    const now = new Date();
    d.innerHTML = `<div class="ringt">${now.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' })}</div>
      <h3>${test ? 'Así va a sonar' : now.getHours() < 12 ? '☀️ ¡Buen día!' : '⏰ Arriba'}</h3><p>📻 ${esc(r.name)}${RadioGrilla.nowFor(r) ? ' · ' + esc(RadioGrilla.nowFor(r).name) : ''}</p>
      <div class="btns"><button id="rgSn">😴 10 minutos más</button><button class="pri" id="rgOk" autofocus>✓ Ya me levanté</button></div>`;
    d.showModal(); $('rgOk').focus();
    $('rgOk').onclick = () => { clearInterval(up); d.close(); };   // la radio sigue sonando
    $('rgSn').onclick = () => { clearInterval(up); d.close(); Radio.stop(); snoozeAt = Date.now() + 10 * 60e3; toast('😴 Te despierto en 10 minutos', { ms:3000 }); };
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
