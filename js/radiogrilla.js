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

  /* ---------- ✏️ Grilla propia ----------
     Podés corregir o escribir la grilla de cualquier radio (también de las que no la publican).
     Se guarda en tu configuración (se sincroniza) y le gana a la de la web hasta que la borres. */
  const AB = ['dom', 'lun', 'mar', 'mie', 'jue', 'vie', 'sab'], ORD = [1, 2, 3, 4, 5, 6, 0];
  const keyOf = r => { const g = match(r); return g ? g.id : 'u:' + r.url; };
  const mine = r => (db.radEdit || {})[keyOf(r)];
  const effective = r => { const m = mine(r), g = match(r); return m ? { ...(g || { n:r.name, dial:'' }), sch:m, own:true } : g; };
  function daysTxt(ds) {
    const idx = ORD.map(d => ds.includes(d)), out = []; let i = 0;
    while (i < 7) { if (!idx[i]) { i++; continue; } let j = i; while (j + 1 < 7 && idx[j + 1]) j++; out.push(j - i >= 2 ? AB[ORD[i]] + '-' + AB[ORD[j]] : ORD.slice(i, j + 1).map(d => AB[d]).join(',')); i = j + 1; }
    return out.join(',');
  }
  function toText(sch) {
    const g = new Map();
    for (const [dw, s, e, n, pan] of sch) { const k = [s, e, n, (pan || []).join(', ')].join('|'); if (!g.has(k)) g.set(k, []); g.get(k).push(DOW.indexOf(dw)); }
    return [...g].map(([k, ds]) => { const [s, e, n, p] = k.split('|'); return { ds, s, line:`${daysTxt(ds)} ${s}-${e} ${n}${p ? ' | ' + p : ''}` }; })
      .sort((a, b) => Math.min(...a.ds.map(d => ORD.indexOf(d))) - Math.min(...b.ds.map(d => ORD.indexOf(d))) || a.s.localeCompare(b.s)).map(x => x.line).join('\n');
  }
  function parse(txt) {
    const sch = [], bad = [];
    txt.split('\n').forEach((raw, n) => {
      const l = raw.trim(); if (!l || l.startsWith('#')) return;
      const m = norm(l).match(/^([a-z,\-\s]+?)\s+(\d{1,2})(?:[:.](\d{2}))?\s*(?:-|a)\s*(\d{1,2})(?:[:.](\d{2}))?\s+/);
      if (!m) { bad.push(n + 1); return; }
      const days = new Set();
      for (const part of m[1].replace(/\s+/g, '').split(',').filter(Boolean)) {
        const [a, b] = part.split('-').map(x => AB.indexOf(x.slice(0, 3)));
        if (a < 0 || (b !== undefined && b < 0)) { bad.push(n + 1); return; }
        if (b === undefined) days.add(a); else { for (let k = ORD.indexOf(a); ; k = (k + 1) % 7) { days.add(ORD[k]); if (ORD[k] === b) break; } }
      }
      const rest = l.slice(m[0].length).trim(), [name, who] = rest.split('|').map(x => x.trim());
      if (!name) { bad.push(n + 1); return; }
      const hh = (h, mm) => String(+h % 24).padStart(2, '0') + ':' + (mm || '00');
      days.forEach(d => sch.push([DOW[d], hh(m[2], m[3]), hh(m[4], m[5]), name, who ? who.split(/,\s*/).filter(Boolean) : []]));
    });
    return { sch, bad };
  }
  function edit(r) {
    const g = match(r), cur = effective(r);
    let d = $('dlgRg'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgRg'; document.body.appendChild(d); }
    d.innerHTML = `<h3>✏️ Grilla de ${esc(g?.n || r.name)}</h3>
      <p class="mut" style="font-size:13px;margin:0 0 8px">Un programa por línea: <code>días inicio-fin Programa | conductores</code>. Días: lun mar mie jue vie sab dom, rangos con guion (lun-vie) y listas con coma (sab,dom).</p>
      <textarea id="rgTxt" rows="14" spellcheck="false" style="width:100%;font-family:monospace;font-size:13px" placeholder="lun-vie 06:00-10:00 Alguien tiene que decirlo | Eduardo Feinmann">${esc(cur ? toText(cur.sch) : '')}</textarea>
      <div class="msg" id="rgMsg"></div>
      <div class="btns" style="margin-top:10px">${mine(r) ? '<button id="rgReset">↩ Volver a la de la web</button>' : ''}<span class="sp"></span><button id="rgX">Cancelar</button><button class="pri" id="rgOk">Guardar</button></div>`;
    d.showModal();
    $('rgX').onclick = () => d.close();
    if ($('rgReset')) $('rgReset').onclick = () => { delete db.radEdit[keyOf(r)]; save(); d.close(); toast('↩ Volvió la grilla de la web', { ms:2000 }); Radio.render(); };
    $('rgOk').onclick = () => {
      const { sch, bad } = parse($('rgTxt').value);
      if (bad.length) { $('rgMsg').className = 'msg err'; $('rgMsg').textContent = `No entiendo la${bad.length > 1 ? 's líneas' : ' línea'} ${bad.join(', ')}. Ejemplo: lun-vie 06:00-10:00 Programa | Conductor`; return; }
      db.radEdit = db.radEdit || {};
      if (!sch.length) delete db.radEdit[keyOf(r)]; else db.radEdit[keyOf(r)] = sch;
      save(); d.close(); toast(`✏️ Grilla de ${esc(g?.n || r.name)} guardada`, { ms:2500 }); Radio.render();
    };
  }
  function ask() {
    db.radPedido = Date.now(); save();
    toast('🔄 Pedido enviado<small>GitHub vuelve a leer las webs de las radios en la próxima pasada (hasta ~30 min).</small>', { cls:'info', ms:5000 });
  }

  function render(el, onAdd) {
    if (!data) { el.innerHTML = '<div class="empty">Cargando la grilla de radios…</div>'; load().then(d => { if (d && Nav.current === 'radios') Radio.render(); }); return; }
    const now = new Date(), from = new Date(now); from.setMinutes(Math.floor(now.getMinutes() / SLOT) * SLOT - SLOT, 0, 0);
    const to = new Date(+from + SLOTS * SLOT * 60e3), span = to - from, pct = d => Math.max(0, Math.min(100, (d - from) / span * 100));
    const cur = Radio.current;
    const rows = db.radios.map((r, i) => {
      const g = effective(r), progs = g ? shows(g, from, to) : [], on = cur && cur.url === r.url;
      return `<div class="eprow rgrow ${on ? 'islive' : ''}">
        <div class="epch" data-ri="${i}" tabindex="0"><span class="rgdial">${esc(g?.dial || '📻')}</span><span class="epname">${on ? '🔊 ' : ''}${esc(g?.n || r.name)}${g?.own ? ' <small class="mut">✏️ tuya</small>' : ''}</span><button class="rgedit" data-ed="${i}" title="Editar la grilla de esta radio">✏️</button></div>
        <div class="eptrack">${progs.map(b => { const L = pct(b.s), W = Math.max(pct(b.e) - L, 2.5), air = b.s <= now && b.e > now, time = `${b.s < from ? 'desde ' : ''}${hhmm(b.s)}–${hhmm(b.e)}`;
          return `<div class="epb guide ${air ? 'onair' : ''}" style="left:${L}%;width:${W}%" data-ri="${i}" title="${esc(b.name + (b.pan?.length ? ' · con ' + b.pan.join(', ') : '') + ' · ' + time)}"><b>${esc(b.name)}</b><small>${esc(time)}${b.pan?.length ? ' · ' + esc(b.pan.slice(0, 2).join(', ')) : ''}</small></div>`; }).join('')
          || `<div class="epempty">${g ? 'Sin programas en este horario' : 'Esta radio no publica su grilla: tocá ✏️ para escribirla vos'}</div>`}</div></div>`;
    }).join('');
    const ticks = Array.from({ length:SLOTS / 2 }, (_, i) => new Date(+from + i * 2 * SLOT * 60e3));
    const missing = data.radios.filter(g => !db.radios.some(r => match(r) === g));
    el.innerHTML = `<div class="epg rgepg">
        <div class="ephead"><div class="epch">${now.toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'short' })}</div><div class="eptrack">${ticks.map(t => `<span style="left:${pct(t)}%">${hhmm(t)}</span>`).join('')}</div></div>
        <div class="epbody"><div class="epnow" style="left:calc(var(--epw) + (100% - var(--epw)) * ${pct(now) / 100})"></div>${rows || '<div class="empty">Todavía no guardaste radios. Buscalas abajo y tocá ☆.</div>'}</div>
      </div>
      <div class="rgfoot"><p class="mut" style="font-size:12px;margin:0">La programación sale de la web de cada radio y se actualiza una vez por mes (última: ${ago(data.updated)})${db.radPedido > Date.parse(data.updated) ? ' · <b>actualización pedida, en camino</b>' : ''}. Tocá una radio o un programa para escucharla; con ✏️ la corregís o escribís vos.</p>
        <button id="rgAsk">🔄 Actualizar desde las webs</button></div>
      ${missing.length ? `<details class="epadd"><summary>➕ Radios con grilla que no tenés (${missing.length})</summary><div class="chips">${missing.map(g => `<button data-rg="${g.id}">${esc(g.n)} <small>${esc(g.dial)}</small> ＋</button>`).join('')}</div></details>` : ''}`;
    el.querySelectorAll('[data-ri]').forEach(x => x.addEventListener('click', e => { if (e.target.closest('[data-ed]')) return; Radio.play(db.radios[+x.dataset.ri]); }));
    el.querySelectorAll('[data-ed]').forEach(b => b.onclick = e => { e.stopPropagation(); edit(db.radios[+b.dataset.ed]); });
    $('rgAsk').onclick = ask;
    el.querySelectorAll('[data-ri]').forEach(x => x.addEventListener('keydown', e => { if (e.key === 'Enter') x.click(); }));
    el.querySelectorAll('[data-rg]').forEach(b => b.onclick = () => onAdd?.(data.radios.find(g => g.id === b.dataset.rg)));
  }
  /** Qué programa va ahora en una radio tuya (o null). */
  function nowFor(r) { const g = data && effective(r); if (!g) return null; const n = new Date(); return shows(g, n, new Date(+n + 60e3)).find(x => x.s <= n && x.e > n) || null; }
  return { render, load, match, nowFor, get data() { return data; } };
})();
