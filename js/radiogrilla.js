/* =========================================================
   📻 Grilla de radios: tus radios de arriba para abajo, sin imágenes, con qué programa va
   y de qué hora a qué hora. La programación sale de la web de cada radio (la lee GitHub una vez por mes).
   ========================================================= */
const RadioGrilla = (() => {
  let data = S.get('radGrilla', null), at = 0;
  const SLOT = 30, SLOTS = 12;   // 6 horas en franjas de media hora
  const DOW = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'];
  async function load() {
    if (data && Date.now() - at < 6 * 3600e3) return data;
    try { const j = await (await fetch(REPO.data + 'radios.json?t=' + Math.floor(Date.now() / 86400e3))).json(); if (j?.radios) { data = j; at = Date.now(); try { S.set('radGrilla', j); } catch {} } } catch {}
    return data;
  }
  // tu radio guardada ↔ radio con grilla (por nombre: "Radio Mitre AM 790" → Mitre)
  const match = r => { const n = ' ' + norm(r.name) + ' '; return data?.radios.find(g => g.alias.some(a => n.includes(' ' + norm(a) + ' ') || n.replace(/ /g, '').includes(norm(a).replace(/ /g, '')))) || null; };
  function shows(g, from, to) {
    const out = [];
    for (let d = -1; d <= 1; d++) {
      const day = new Date(from); day.setDate(day.getDate() + d); day.setHours(0, 0, 0, 0);
      for (const [dw, st, en, name, pan] of g.sch) {
        if (DOW[day.getDay()] !== dw) continue;
        const [sh, sm] = st.split(':').map(Number), [eh, em] = (en || st).split(':').map(Number);
        const s = new Date(day); s.setHours(sh, sm);
        let e = new Date(day); e.setHours(eh, em); if (en === '23:59') e.setMinutes(60); if (!en || en === st) e = new Date(+s + 120 * 60e3); else if (e <= s) e.setDate(e.getDate() + 1);
        if (e > from && s < to) out.push({ s, e, name, pan });
      }
    }
    return out.sort((a, b) => a.s - b.s);
  }
  const hhmm = d => d.toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });

  function render(el, onAdd) {
    if (!data) { el.innerHTML = '<div class="empty">Cargando la grilla de radios…</div>'; load().then(d => { if (d && Nav.current === 'radios') Radio.render(); }); return; }
    const now = new Date(), from = new Date(now); from.setMinutes(Math.floor(now.getMinutes() / SLOT) * SLOT - SLOT, 0, 0);
    const to = new Date(+from + SLOTS * SLOT * 60e3), span = to - from, pct = d => Math.max(0, Math.min(100, (d - from) / span * 100));
    const cur = Radio.current;
    const rows = db.radios.map((r, i) => {
      const g = match(r), progs = g ? shows(g, from, to) : [], on = cur && cur.url === r.url;
      return `<div class="eprow rgrow ${on ? 'islive' : ''}">
        <div class="epch" data-ri="${i}" tabindex="0"><span class="rgdial">${esc(g?.dial || '📻')}</span><span class="epname">${on ? '🔊 ' : ''}${esc(g?.n || r.name)}</span></div>
        <div class="eptrack">${progs.map(b => { const L = pct(b.s), W = Math.max(pct(b.e) - L, 2.5), air = b.s <= now && b.e > now, time = `${b.s < from ? 'desde ' : ''}${hhmm(b.s)}–${hhmm(b.e)}`;
          return `<div class="epb guide ${air ? 'onair' : ''}" style="left:${L}%;width:${W}%" data-ri="${i}" title="${esc(b.name + (b.pan?.length ? ' · con ' + b.pan.join(', ') : '') + ' · ' + time)}"><b>${esc(b.name)}</b><small>${esc(time)}${b.pan?.length ? ' · ' + esc(b.pan.slice(0, 2).join(', ')) : ''}</small></div>`; }).join('')
          || `<div class="epempty">${g ? 'Sin programas en este horario' : 'Esta radio no publica su grilla (o todavía no la leo)'}</div>`}</div></div>`;
    }).join('');
    const ticks = Array.from({ length:SLOTS / 2 }, (_, i) => new Date(+from + i * 2 * SLOT * 60e3));
    const missing = data.radios.filter(g => !db.radios.some(r => match(r) === g));
    el.innerHTML = `<div class="epg rgepg">
        <div class="ephead"><div class="epch">${now.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short' })}</div><div class="eptrack">${ticks.map(t => `<span style="left:${pct(t)}%">${hhmm(t)}</span>`).join('')}</div></div>
        <div class="epbody"><div class="epnow" style="left:calc(var(--epw) + (100% - var(--epw)) * ${pct(now) / 100})"></div>${rows || '<div class="empty">Todavía no guardaste radios. Buscalas abajo y tocá ☆.</div>'}</div>
      </div>
      <p class="mut" style="font-size:12px;margin-top:8px">La programación sale de la web de cada radio y se actualiza una vez por mes (última: ${ago(data.updated)}). Tocá una radio o un programa para escucharla.</p>
      ${missing.length ? `<details class="epadd"><summary>➕ Radios con grilla que no tenés (${missing.length})</summary><div class="chips">${missing.map(g => `<button data-rg="${g.id}">${esc(g.n)} <small>${esc(g.dial)}</small> ＋</button>`).join('')}</div></details>` : ''}`;
    el.querySelectorAll('[data-ri]').forEach(x => x.addEventListener('click', () => Radio.play(db.radios[+x.dataset.ri])));
    el.querySelectorAll('[data-ri]').forEach(x => x.addEventListener('keydown', e => { if (e.key === 'Enter') x.click(); }));
    el.querySelectorAll('[data-rg]').forEach(b => b.onclick = () => onAdd?.(data.radios.find(g => g.id === b.dataset.rg)));
  }
  return { render, load, match };
})();
