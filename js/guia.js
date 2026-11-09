/* =========================================================
   📺 Guía estilo DirecTV (en Canales): tus canales de arriba para abajo por número, con su logo,
   y la grilla de horarios: qué están pasando, desde qué hora y hasta qué hora.
   - "En vivo / programado": lo dice YouTube (no dice hasta qué hora).
   - Programas y horario de fin: la grilla semanal de laguiadelstreaming.com (la lee GitHub).
   - 🔎 ¿Qué se habló?: abre la búsqueda en transcripciones de hagovusqueda.com.
   ========================================================= */
const Guia = (() => {
  let data = S.get('guiaData', null), at = 0;
  const SLOT = 30, SLOTS = 10;   // grilla de 5 horas en franjas de media hora
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  async function load() {
    if (data && Date.now() - at < 30 * 60e3) return data;
    try { const j = await (await fetch(REPO.data + 'guia.json?t=' + Math.floor(Date.now() / 1800e3))).json(); if (j?.canales) { data = j; at = Date.now(); try { S.set('guiaData', j); } catch {} } } catch {}
    return data;
  }
  // tu canal ↔ canal de la guía (por usuario de YouTube o por nombre)
  function match(c) {
    if (!data) return null;
    const h = norm((c.ref.handle || '').replace(/^@/, '')), n = norm(c.name);
    return data.canales.find(g => (h && norm(g.h) === h) || norm(g.n) === n) || null;
  }
  // programas de la guía que caen en [from, to] (fechas reales, con hora de Argentina = la de tu dispositivo)
  function shows(g, from, to) {
    const out = [];
    for (let d = -1; d <= 1; d++) {
      const day = new Date(from); day.setDate(day.getDate() + d); day.setHours(0, 0, 0, 0);
      for (const [dw, st, en, name, pan] of g.sch) {
        if (DOW[day.getDay()] !== dw) continue;
        const [sh, sm] = st.split(':').map(Number), [eh, em] = (en || st).split(':').map(Number);
        const s = new Date(day); s.setHours(sh, sm);
        let e = new Date(day); e.setHours(eh, em); if (!en || en === st) e = new Date(+s + 120 * 60e3); else if (e <= s) e.setDate(e.getDate() + 1);
        if (e > from && s < to) out.push({ s, e, name, pan });
      }
    }
    return out.sort((a, b) => a.s - b.s);
  }
  const hhmm = d => d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  const hv = q => 'https://hagovusqueda.com/busqueda?q=' + encodeURIComponent(q);

  function render(el, list) {
    if (!data) { el.innerHTML = '<div class="empty">Cargando la guía…</div>'; load().then(() => { if (Nav.current === 'canales') Canales.render(); }); }
    const now = new Date(), from = new Date(now); from.setMinutes(Math.floor(now.getMinutes() / SLOT) * SLOT - SLOT, 0, 0);
    const to = new Date(+from + SLOTS * SLOT * 60e3), span = to - from, pct = d => Math.max(0, Math.min(100, (d - from) / span * 100));
    const rows = list.map(c => {
      const g = match(c), st = Canales.status[c.uid] || {}, blocks = [];
      const progs = g ? shows(g, from, to) : [];
      if (st.st === 'live') {
        const s = st.when ? new Date(st.when) : new Date(+now - 30 * 60e3);
        const p = progs.find(x => x.s <= now && x.e > now);
        blocks.push({ s, e:p ? p.e : new Date(+now + 60 * 60e3), open:!p, live:true, prem:st.prem, t:st.title, sub:p?.name, pan:p?.pan });
        progs.forEach(x => { if (x !== p && x.s >= (p ? p.e : now)) blocks.push({ s:x.s, e:x.e, t:x.name, pan:x.pan, guide:true }); });
      } else {
        if (st.st === 'soon' && st.when) { const s = new Date(st.when), p = progs.find(x => Math.abs(x.s - s) < 45 * 60e3); blocks.push({ s, e:p ? p.e : new Date(+s + 120 * 60e3), open:!p, soon:true, prem:st.prem, t:st.title, sub:p?.name }); progs.forEach(x => { if (x !== p) blocks.push({ s:x.s, e:x.e, t:x.name, pan:x.pan, guide:true }); }); }
        else progs.forEach(x => blocks.push({ s:x.s, e:x.e, t:x.name, pan:x.pan, guide:true, onair:x.s <= now && x.e > now }));
      }
      const logo = c.avatar || g?.logo;
      return `<div class="eprow ${st.st === 'live' ? 'islive' : ''}" data-u="${c.uid}">
        <div class="epch" data-play="${c.uid}"><span class="epnum">${esc(Canales.numTxt(c))}</span><span class="eplogo" style="${logo ? `background-image:url('${esc(logo)}')` : ''}">${logo ? '' : esc(c.name[0] || '?')}</span><span class="epname">${esc(c.name)}</span></div>
        <div class="eptrack">${blocks.filter(b => b.e > from && b.s < to).map(b => {
          const L = pct(b.s), W = Math.max(pct(b.e) - L, 2.5);
          const time = `${b.s < from ? 'desde ' + hhmm(b.s) : hhmm(b.s)}${b.open ? (b.live ? ' · sin hora de fin' : '') : '–' + hhmm(b.e)}`;
          return `<div class="epb ${b.live ? 'live' : ''} ${b.soon ? 'soon' : ''} ${b.prem ? 'prem' : ''} ${b.guide ? 'guide' : ''} ${b.onair ? 'onair' : ''} ${b.open ? 'open' : ''}" style="left:${L}%;width:${W}%" data-play="${c.uid}" title="${esc(b.t + (b.sub ? ' · ' + b.sub : '') + (b.pan?.length ? ' · con ' + b.pan.join(', ') : '') + ' · ' + time)}">
            <b>${b.live ? (b.prem ? '🎬 ' : '● ') : ''}${esc(b.t)}</b><small>${esc(time)}${b.sub && b.sub !== b.t ? ' · ' + esc(b.sub) : ''}</small>
            ${b.guide && g ? `<button class="epbell ${Avisos.has('canal', g.id, b.t) ? 'on' : ''}" data-bell="${esc(String(g.id))}" data-bn="${esc(b.t)}" data-bw="${esc(c.name)}" title="Avisame cuando empiece">🔔</button>` : ''}
            ${b.guide || b.sub ? `<a class="ephv" href="${hv(b.sub || b.t)}" target="_blank" rel="noopener" title="¿Qué se habló? (búsqueda en transcripciones)">🔎</a>` : ''}</div>`; }).join('') || `<div class="epempty">${st.st === 'off' ? 'Sin programación cargada' : '…'}</div>`}</div></div>`;
    }).join('');
    const ticks = Array.from({ length:SLOTS }, (_, i) => new Date(+from + i * SLOT * 60e3));
    const missing = data ? data.canales.filter(g => !db.chans.some(c => match(c) === g)) : [];
    el.innerHTML = `<div class="epg">
        <div class="ephead"><div class="epch">${now.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short' })}</div><div class="eptrack">${ticks.map(t => `<span style="left:${pct(t)}%">${hhmm(t)}</span>`).join('')}</div></div>
        <div class="epbody"><div class="epnow" style="left:calc(var(--epw) + (100% - var(--epw)) * ${pct(now) / 100})"></div>${rows || '<div class="empty">No hay canales en esta pestaña.</div>'}</div>
      </div>
      <p class="mut" style="font-size:12px;margin-top:8px">● en vivo y 🕒 programados: YouTube. Programas y horarios de fin: <a class="lnk" href="https://laguiadelstreaming.com/" target="_blank" rel="noopener">La Guía del Streaming</a>${data ? ' (actualizada ' + ago(data.updated) + ')' : ''}. 🔎 = qué se habló en ese programa (<a class="lnk" href="https://hagovusqueda.com/" target="_blank" rel="noopener">Hagovusqueda</a>).</p>
      ${missing.length ? `<details class="epadd"><summary>➕ Canales de la guía que no tenés (${missing.length})</summary><div class="chips">${missing.map(g => `<button data-addg="${g.id}" title="${esc(g.cats.join(', '))}">${g.logo ? `<img src="${esc(g.logo)}" alt="">` : ''}${esc(g.n)} ＋</button>`).join('')}</div></details>` : ''}`;
    el.querySelectorAll('[data-bell]').forEach(b => b.onclick = e => { e.stopPropagation(); Avisos.toggle('canal', b.dataset.bell, b.dataset.bw, b.dataset.bn); b.classList.toggle('on', Avisos.has('canal', b.dataset.bell, b.dataset.bn)); });
    el.querySelectorAll('[data-play]').forEach(x => x.addEventListener('click', e => { if (e.target.closest('a,[data-bell]')) return; const c = db.chans.find(y => y.uid === x.dataset.play); if (c) Player.play(c); }));
    el.querySelectorAll('[data-addg]').forEach(b => b.onclick = () => add(data.canales.find(g => String(g.id) === b.dataset.addg)));
  }
  function add(g) {
    if (!g?.h) { toast('<b>Ese canal no tiene usuario de YouTube en la guía</b>', { cls:'info' }); return; }
    db.chans.push({ uid:uid(), platform:'youtube', ref:{ handle:'@' + g.h }, name:g.n, cat:db.cats[0] || '' });
    Canales.ensureNums(); save(); toast(`📺 ${esc(g.n)} agregado`, { ms:3000 }); $('btnRefresh')?.click(); Canales.render();
  }
  return { render, load, match, get data() { return data; } };
})();
