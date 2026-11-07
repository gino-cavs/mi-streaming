/* =========================================================
   Calendario: tus programas, qué hay hoy y la semana
   ========================================================= */
const Calendario = (() => {
  const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const ORDEN = [1, 2, 3, 4, 5, 6, 0];       // la semana arranca el lunes
  let editing = null, view = 'hoy';

  const SOC = [
    [/(^|\.)(x|twitter)\.com$/, '𝕏'], [/instagram\.com$/, '📷 Instagram'], [/tiktok\.com$/, '🎵 TikTok'],
    [/youtube\.com$|youtu\.be$/, '▶ YouTube'], [/twitch\.tv$/, '🟣 Twitch'], [/kick\.com$/, '🟢 Kick'],
    [/facebook\.com$|fb\.com$/, 'Facebook'], [/threads\.net$/, '@ Threads'], [/spotify\.com$/, '🎧 Spotify']
  ];
  function socLabel(url) {
    let h = ''; try { h = new URL(/^https?:/.test(url) ? url : 'https://' + url).hostname.replace(/^www\.|^m\./, ''); } catch {}
    return (SOC.find(([re]) => re.test(h)) || [0, '🌐 Web'])[1];
  }
  const fixUrl = u => /^https?:\/\//i.test(u) ? u : 'https://' + u;
  const mins = t => { const [h, m] = (t || '00:00').split(':').map(Number); return h * 60 + (m || 0); };
  const chanOf = p => db.chans.find(c => c.uid === p.chan);
  const sameDay = (a, b) => new Date(a).toDateString() === new Date(b).toDateString();

  // Estado de un programa hoy, cruzando con el canal vinculado
  function todayState(p) {
    const now = new Date(), nowM = now.getHours() * 60 + now.getMinutes();
    const c = chanOf(p), s = c ? Canales.status[c.uid] || {} : {};
    const start = mins(p.time), end = start + (+p.dur || 120);
    if (s.st === 'live' && s.prem) return { cls:'live', txt:'🎬 ESTRENO', title:s.title };
    if (s.st === 'live') return { cls:'live', txt:'● EN VIVO', title:s.title };
    if (s.st === 'soon' && sameDay(s.when, now)) return { cls:'soon', txt:(s.prem ? '🎬 Estreno ' : '🕒 Confirmado ') + fmtH(s.when), title:s.title };
    if (nowM >= end) return { cls:'off', txt:'Ya terminó' };
    if (nowM >= start) return { cls:'soon', txt: c ? 'Debería estar empezando' : 'En horario ahora' };
    return { cls:'', txt:'Hoy ' + p.time };
  }
  function progNews(p) {
    const items = Noticias.byTopic('prog:' + p.id);
    return items.slice(0, 3);
  }

  function progCard(p, withState) {
    const c = chanOf(p), st = withState ? todayState(p) : null, nw = progNews(p);
    const links = (p.links || []).map(u => `<a class="sm lnk" href="${esc(fixUrl(u))}" target="_blank" rel="noopener">${esc(socLabel(u))}</a>`).join('');
    return `<div class="prog ${st ? st.cls : ''}">
      <div class="ptime">${esc(p.time || '')}</div>
      <div class="pbody">
        <div class="pname">${esc(p.name)} ${st ? `<span class="pst ${st.cls}">${esc(st.txt)}</span>` : ''}</div>
        <div class="pmeta">${c ? esc(c.name) + ' · ' : ''}${p.days.length === 7 ? 'Todos los días' : ORDEN.filter(d => p.days.includes(d)).map(d => DIAS[d].slice(0, 3)).join(', ')}${p.dur ? ' · ' + p.dur + ' min' : ''}</div>
        ${st && st.title ? `<div class="ptitle">“${esc(st.title)}”</div>` : ''}
        ${p.notes ? `<div class="pmeta">${esc(p.notes)}</div>` : ''}
        ${nw.length ? `<div class="pnews">${nw.map(i => `<a href="${esc(i.l)}" target="_blank" rel="noopener">📰 ${esc(i.t)} <small>${esc(i.s || '')} · ${ago(i.d)}</small></a>`).join('')}</div>` : ''}
        <div class="plinks">${c ? `<button class="sm pri" data-play="${p.id}">▶ Ver</button><button class="sm" data-aud="${p.id}">🎧</button>` : ''}${links}<button class="sm" data-edit="${p.id}" title="Editar">✎</button></div>
      </div></div>`;
  }

  function render() {
    const v = $('v-calendario');
    const now = new Date(), dow = now.getDay();
    if (!Noticias.loaded) Noticias.load().then(() => { if (Nav.current === 'calendario') render(); }).catch(() => {});
    if (!db.programs.length) {
      v.innerHTML = `<div class="subbar"><span class="sp" style="flex:1"></span><button class="pri" id="pAdd">＋ Programa</button></div>
        <div class="empty">Todavía no cargaste programas.<br>Tocá <b>＋ Programa</b>: nombre, qué días y a qué hora sale, de qué canal es y sus redes.<br>Si lo vinculás con un canal de tu lista, te confirmo cuando está programado o en vivo.</div>`;
      bind(v); return;
    }
    const today = db.programs.filter(p => p.days.includes(dow)).sort((a, b) => mins(a.time) - mins(b.time));
    // vivos o programados de hoy en tus canales que no están en el calendario
    const used = new Set(db.programs.map(p => p.chan));
    const extra = db.chans.filter(c => !used.has(c.uid) || !today.some(p => p.chan === c.uid))
      .filter(c => { const s = Canales.status[c.uid] || {}; return s.st === 'live' || (s.st === 'soon' && sameDay(s.when, now)); });

    v.innerHTML = `
      <div class="subbar">
        <div class="tabs"><button data-v="hoy" class="${view === 'hoy' ? 'on' : ''}">Hoy</button><button data-v="semana" class="${view === 'semana' ? 'on' : ''}">Semana</button><button data-v="todos" class="${view === 'todos' ? 'on' : ''}">Mis programas</button></div>
        <button class="pri" id="pAdd">＋ Programa</button>
      </div>
      ${view === 'hoy' ? `
        <h2 class="sec">${DIAS[dow]} ${now.getDate()}/${now.getMonth() + 1}</h2>
        ${today.length ? `<div class="progs">${today.map(p => progCard(p, true)).join('')}</div>` : '<div class="empty">Hoy no sale ninguno de tus programas.</div>'}
        ${extra.length ? `<h2 class="sec" style="margin-top:18px">También hoy en tus canales</h2><div class="grid" id="pExtra">${Canales.sortChans(extra).map(Canales.card).join('')}</div>` : ''}`
      : view === 'semana' ? `
        <div class="week">${ORDEN.map(d => {
          const ps = db.programs.filter(p => p.days.includes(d)).sort((a, b) => mins(a.time) - mins(b.time));
          return `<div class="wday ${d === dow ? 'today' : ''}"><h4>${DIAS[d]}</h4>${ps.map(p => `<div class="wprog" data-edit="${p.id}"><b>${esc(p.time)}</b> ${esc(p.name)}</div>`).join('') || '<div class="mut" style="font-size:12px">—</div>'}</div>`;
        }).join('')}</div>`
      : `<div class="progs">${[...db.programs].sort((a, b) => a.name.localeCompare(b.name)).map(p => progCard(p, false)).join('')}</div>`}
      <p class="mut" style="font-size:12px;margin-top:14px">Las noticias de cada programa (invitados, cambios, si no sale) se buscan cada 30 min en Google Noticias. ${Noticias.byTopic('prog:' + db.programs[0].id).length || hasProgNews() ? '' : 'Para activarlas, pasale a Claude el código de sincronización que está en ⚙.'}</p>`;
    bind(v);
    if ($('pExtra')) Canales.bindGrid($('pExtra'));
  }
  const hasProgNews = () => db.programs.some(p => Noticias.byTopic('prog:' + p.id).length);

  function bind(v) {
    $('pAdd').onclick = () => open(null);
    v.querySelector('.tabs')?.addEventListener('click', e => { const b = e.target.closest('[data-v]'); if (b) { view = b.dataset.v; render(); } });
    v.onclick = e => {
      const ed = e.target.closest('[data-edit]'); if (ed) return open(db.programs.find(p => p.id === ed.dataset.edit));
      const pl = e.target.closest('[data-play]'), au = e.target.closest('[data-aud]');
      const p = db.programs.find(x => x.id === (pl || au)?.dataset[pl ? 'play' : 'aud']);
      if (p && chanOf(p)) Player.play(chanOf(p), { audio:!!au });
    };
  }

  /* ---------- Diálogo de programa ---------- */
  function open(p) {
    editing = p;
    const d = $('dlgProg');
    $('pgTitle').textContent = p ? 'Editar programa' : 'Nuevo programa';
    $('pgName').value = p ? p.name : '';
    $('pgChan').innerHTML = '<option value="">— Ninguno —</option>' + [...db.chans].sort((a, b) => a.name.localeCompare(b.name)).map(c => `<option value="${c.uid}" ${p && p.chan === c.uid ? 'selected' : ''}>${esc(c.name)}</option>`).join('');
    $('pgDays').innerHTML = ORDEN.map(i => `<label><input type="checkbox" value="${i}" ${p && p.days.includes(i) ? 'checked' : ''}> ${DIAS[i].slice(0, 3)}</label>`).join('');
    $('pgTime').value = p ? p.time : '';
    $('pgDur').value = p ? (p.dur || '') : '';
    $('pgLinks').value = p ? (p.links || []).join('\n') : '';
    $('pgNotes').value = p ? (p.notes || '') : '';
    $('pgDel').style.display = p ? '' : 'none';
    $('pgMsg').textContent = '';
    hint();
    d.showModal();
  }
  // si el canal tiene un vivo programado, ofrezco completar día y hora con eso
  function hint() {
    const c = db.chans.find(x => x.uid === $('pgChan').value), s = c ? Canales.status[c.uid] || {} : {};
    const b = $('pgFill');
    if (s.st === 'soon' && s.when) {
      const w = new Date(s.when);
      b.style.display = ''; b.textContent = `Usar su próximo vivo: ${DIAS[w.getDay()]} ${fmtH(w)}`;
      b.onclick = () => { $('pgDays').querySelector(`input[value="${w.getDay()}"]`).checked = true; $('pgTime').value = fmtH(w); if (!$('pgName').value) $('pgName').value = c.name; };
    } else b.style.display = 'none';
  }
  function init() {
    document.body.insertAdjacentHTML('beforeend', `
      <dialog id="dlgProg">
        <h3 id="pgTitle">Nuevo programa</h3>
        <label>Nombre del programa</label><input id="pgName" placeholder="Ej: Vélez a Fondo">
        <label>Canal donde sale (de tu lista, opcional)</label><select id="pgChan"></select>
        <button type="button" class="sm" id="pgFill" style="margin-top:6px;display:none"></button>
        <label>Días</label><div class="chips daypick" id="pgDays"></div>
        <div style="display:flex;gap:10px">
          <div style="flex:1"><label>Hora</label><input id="pgTime" type="time"></div>
          <div style="flex:1"><label>Duración (min, opcional)</label><input id="pgDur" type="number" min="10" step="10" placeholder="120"></div>
        </div>
        <label>Redes y links (uno por línea: X, Instagram, TikTok, web…)</label>
        <textarea id="pgLinks" style="height:90px" placeholder="https://x.com/programa&#10;https://instagram.com/programa"></textarea>
        <label>Notas (opcional)</label><input id="pgNotes" placeholder="Ej: conduce Fulano">
        <div class="msg" id="pgMsg"></div>
        <div class="btns"><button id="pgDel" style="display:none;color:#ff7b7b">Borrar</button><span class="sp"></span><button data-close>Cancelar</button><button class="pri" id="pgSave">Guardar</button></div>
      </dialog>`);
    $('dlgProg').querySelector('[data-close]').onclick = () => $('dlgProg').close();
    $('pgChan').onchange = hint;
    $('pgDel').onclick = () => { db.programs = db.programs.filter(p => p !== editing); save(); $('dlgProg').close(); render(); };
    $('pgSave').onclick = () => {
      const name = $('pgName').value.trim(), days = [...$('pgDays').querySelectorAll('input:checked')].map(i => +i.value), time = $('pgTime').value;
      const msg = $('pgMsg'); msg.className = 'msg err';
      if (!name) { msg.textContent = 'Poné el nombre del programa.'; return; }
      if (!days.length) { msg.textContent = 'Elegí al menos un día.'; return; }
      if (!time) { msg.textContent = 'Poné la hora.'; return; }
      const p = editing || { id:uid() };
      Object.assign(p, { name, days, time, dur:+$('pgDur').value || null, chan:$('pgChan').value || null,
        links:$('pgLinks').value.split(/\s+/).map(s => s.trim()).filter(Boolean), notes:$('pgNotes').value.trim() });
      if (!editing) db.programs.push(p);
      save(); $('dlgProg').close(); render();
    };
    onChange(() => { if (Nav.current === 'calendario') render(); });
  }
  // cantidad de programas de hoy en vivo (para el numerito de la pestaña)
  const liveCount = () => db.programs.filter(p => p.days.includes(new Date().getDay()) && todayState(p).cls === 'live').length;
  return { init, render, liveCount };
})();
