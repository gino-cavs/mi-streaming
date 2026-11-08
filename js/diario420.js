/* =========================================================
   📓 Diario 420: días, rachas, genéticas y vencimiento del REPROCANN.
   Se guarda en db.diario (Gist privado, sincronizado), nunca en el repo.
   ========================================================= */
const Diario = (() => {
  const FORMAS = ['🚬 Porro', '💨 Vapo', '🪈 Pipa', '🫧 Bong', '🍪 Comestible', '💧 Aceite', '✨ Otro'];
  const TIPOS = ['Índica', 'Sativa', 'Híbrida', 'CBD'];
  const D = () => { db.diario = db.diario || {}; const d = db.diario; d.log = d.log || {}; d.gens = d.gens || []; d.repro = d.repro || {}; return d; };
  const ymd = (dt = new Date()) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const dayDiff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const fdate = s => parse(s).toLocaleDateString('es-AR', { day:'numeric', month:'short', year:'numeric' });
  let month = null, sel = null, editGen = null;

  /* ---------- números ---------- */
  function stats() {
    const L = D().log, days = Object.keys(L).filter(k => L[k].length).sort(), today = ymd();
    let cur = 0, d = L[today]?.length ? today : addDays(today, -1);
    while (L[d]?.length) { cur++; d = addDays(d, -1); }
    let best = 0, run = 0, prev = null;
    for (const k of days) { run = prev && dayDiff(prev, k) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = k; }
    const last = days[days.length - 1], sin = last && last !== today ? dayDiff(last, today) : 0;
    const now = new Date(), mPrefix = today.slice(0, 7), yPrefix = today.slice(0, 4);
    const enMes = days.filter(k => k.startsWith(mPrefix)).length, enAnio = days.filter(k => k.startsWith(yPrefix)).length;
    const diaAnio = dayDiff(yPrefix + '-01-01', today) + 1;
    let maxSin = 0; for (let i = 1; i < days.length; i++) maxSin = Math.max(maxSin, dayDiff(days[i - 1], days[i]) - 1);
    const count = {}; days.forEach(k => L[k].forEach(e => { if (e.g) count[norm(e.g)] = (count[norm(e.g)] || 0) + 1; }));
    return { cur, best, sin, last, enMes, enAnio, diaAnio, diasMes:now.getDate(), maxSin, total:days.length, count, today };
  }
  function repro() {
    const r = D().repro; if (!r.vence) return null;
    const n = dayDiff(ymd(), r.vence);
    return { n, cls:n < 0 ? 'bad' : n <= 30 ? 'warn' : 'ok', txt:n < 0 ? `Venció hace ${-n} día${n === -1 ? '' : 's'}` : n === 0 ? 'Vence HOY' : `Vence en ${n} día${n === 1 ? '' : 's'}` };
  }

  /* ---------- pantalla ---------- */
  function render(el) {
    const s = stats(), r = repro(), d = D();
    month = month || s.today.slice(0, 7); sel = sel || s.today;
    const gensSorted = d.gens.slice().sort((a, b) => (s.count[norm(b.n)] || 0) - (s.count[norm(a.n)] || 0) || a.n.localeCompare(b.n));
    const avg = g => { const rs = Object.values(d.log).flat().filter(e => norm(e.g || '') === norm(g.n) && e.r).map(e => e.r); return rs.length ? (rs.reduce((a, b) => a + b, 0) / rs.length).toFixed(1) : null; };
    el.innerHTML = `
      <div class="dtiles">
        <div class="dtile"><b>${s.cur}</b><span>🔥 Racha actual</span><small>días seguidos</small></div>
        <div class="dtile"><b>${s.best}</b><span>🏆 Mejor racha</span></div>
        <div class="dtile"><b>${s.sin}</b><span>🌱 Días sin</span><small>${s.maxSin ? 'récord: ' + s.maxSin : s.last ? 'último: ' + fdate(s.last) : 'todavía sin registros'}</small></div>
        <div class="dtile"><b>${s.enMes}<em>/${s.diasMes}</em></b><span>📅 Este mes</span></div>
        <div class="dtile"><b>${s.enAnio}<em>/${s.diaAnio}</em></b><span>🗓️ Este año</span><small>${s.total} en total</small></div>
        <div class="dtile repro ${r ? r.cls : ''}" id="dRepro"><b>${r ? (r.n < 0 ? '⚠️' : r.n) : '—'}</b><span>📄 REPROCANN</span><small>${r ? esc(r.txt) + ' · ' + fdate(d.repro.vence) : 'Tocá para cargar el vencimiento'}</small></div>
      </div>

      <div class="vcols" style="margin-top:14px">
        <div>
          <div class="dcalh"><button class="sm" id="dPrev">‹</button><b>${(m => m[0].toUpperCase() + m.slice(1))(parse(month + '-01').toLocaleDateString('es-AR', { month:'long', year:'numeric' }))}</b><button class="sm" id="dNext">›</button></div>
          <div class="dcal">${['L', 'M', 'M', 'J', 'V', 'S', 'D'].map(x => `<span class="dh">${x}</span>`).join('')}${calCells(s.today)}</div>
          <div class="mut" style="font-size:12px;margin-top:6px">Tocá un día para ver o cargar. 🟩 = registrado</div>
        </div>
        <div>
          <h2 class="sec">${sel === s.today ? '✍️ Hoy' : '✍️ ' + esc(fdate(sel))}</h2>
          ${(d.log[sel] || []).map((e, i) => `<div class="dentry"><span>${esc(e.f || '')}</span><b>${esc(e.g || 'Sin genética')}</b>${e.r ? `<span>${'⭐'.repeat(e.r)}</span>` : ''}${e.t ? `<small>${esc(e.t)}</small>` : ''}${e.n ? `<small>“${esc(e.n)}”</small>` : ''}<button class="sm" data-del="${i}" title="Borrar">✕</button></div>`).join('') || '<p class="mut" style="font-size:13px">Nada registrado este día.</p>'}
          <form id="dForm" class="dform">
            <input id="dGen" list="dGens" placeholder="Genética (opcional)" autocomplete="off">
            <datalist id="dGens">${d.gens.map(g => `<option value="${esc(g.n)}">`).join('')}</datalist>
            <div class="chips" id="dFormas">${FORMAS.map((f, i) => `<button type="button" data-f="${esc(f)}" class="${i === (S.get('dForma', 0)) ? 'on' : ''}">${esc(f)}</button>`).join('')}</div>
            <div class="chips" id="dStars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-r="${n}">${'⭐'.repeat(n)}</button>`).join('')}</div>
            <input id="dNota" placeholder="Nota (opcional): cómo pegó, con quién, etc.">
            <button class="pri">＋ Registrar</button>
          </form>
        </div>
      </div>

      <h2 class="sec" style="margin-top:16px">🌿 Genéticas</h2>
      <div class="dgens">${gensSorted.map(g => `<div class="dgen" data-g="${esc(g.n)}"><b>${esc(g.n)}</b><span>${esc([g.tipo, g.thc && 'THC ' + g.thc + '%', g.cbd && 'CBD ' + g.cbd + '%', g.banco].filter(Boolean).join(' · '))}</span>
          <small>${(c => c === 1 ? "1 vez" : c + " veces")(s.count[norm(g.n)] || 0)}${avg(g) ? ' · ⭐ ' + avg(g) : ''}</small>${g.nota ? `<small>“${esc(g.nota)}”</small>` : ''}</div>`).join('') || '<p class="mut" style="font-size:13px">Todavía no cargaste genéticas. Las que escribís al registrar se agregan solas.</p>'}
        <button class="dgen add" id="dGenAdd">＋ Genética</button></div>`;

    $('dPrev').onclick = () => { month = addDays(month + '-01', -1).slice(0, 7); render(el); };
    $('dNext').onclick = () => { const n = addDays(month + '-28', 5).slice(0, 7); if (n <= s.today.slice(0, 7)) { month = n; render(el); } };
    el.querySelectorAll('[data-day]').forEach(b => b.onclick = () => { sel = b.dataset.day; render(el); });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { d.log[sel].splice(+b.dataset.del, 1); if (!d.log[sel].length) delete d.log[sel]; save(); render(el); });
    let forma = FORMAS[S.get('dForma', 0)] || FORMAS[0], stars = 0;
    $('dFormas').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; forma = b.dataset.f; S.set('dForma', FORMAS.indexOf(forma)); $('dFormas').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
    $('dStars').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; stars = stars === +b.dataset.r ? 0 : +b.dataset.r; $('dStars').querySelectorAll('button').forEach(x => x.classList.toggle('on', +x.dataset.r === stars)); };
    $('dForm').onsubmit = e => {
      e.preventDefault();
      const g = $('dGen').value.trim(), known = d.gens.find(x => norm(x.n) === norm(g));
      if (g && !known) d.gens.push({ n:g });
      const t = sel === s.today ? new Date().toTimeString().slice(0, 5) : '';
      (d.log[sel] = d.log[sel] || []).push({ g:known ? known.n : g, f:forma, r:stars || undefined, n:$('dNota').value.trim() || undefined, t:t || undefined });
      save(); render(el);
      if (sel === s.today) { const ns = stats(); if (ns.cur > 1 && ns.cur === ns.best) toast(`<span class="g">🔥 Racha récord</span>${ns.cur} días seguidos`, { cls:'t420', ms:6000 }); }
    };
    $('dRepro').onclick = () => openRepro(el);
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => openGen(el, d.gens.find(g => g.n === b.dataset.g)));
    $('dGenAdd').onclick = () => openGen(el, null);
  }
  function calCells(today) {
    const L = D().log, first = parse(month + '-01'), pad = (first.getDay() + 6) % 7, n = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate();
    let h = '<span></span>'.repeat(pad);
    for (let i = 1; i <= n; i++) {
      const k = month + '-' + String(i).padStart(2, '0'), c = (L[k] || []).length, fut = k > today;
      h += `<button class="dday ${c ? 'on' : ''} ${k === today ? 'today' : ''} ${k === sel ? 'sel' : ''}" ${fut ? 'disabled' : `data-day="${k}"`} title="${c ? c + ' registro(s)' : ''}">${i}${c > 1 ? `<i>${c}</i>` : ''}</button>`;
    }
    return h;
  }

  /* ---------- diálogos ---------- */
  function dlg(id, html) {
    let d = $(id); if (!d) { d = document.createElement('dialog'); d.id = id; document.body.appendChild(d); d.addEventListener('click', e => { if (e.target === d) d.close(); }); }
    d.innerHTML = html; d.showModal(); return d;
  }
  function openRepro(el) {
    const r = D().repro;
    const d = dlg('dlgRepro', `<h3>📄 REPROCANN</h3>
      <label>Fecha de vencimiento<input type="date" id="rVence" value="${esc(r.vence || '')}"></label>
      <label class="chk"><input type="checkbox" id="rAviso" ${r.aviso !== false ? 'checked' : ''}> Avisarme 60, 30, 15, 7 y 1 día antes (y por Telegram si está conectado)</label>
      <p class="mut" style="font-size:12px">Solo se guarda la fecha. Se sincroniza en tu Gist privado.</p>
      <div class="btns"><button id="rDel">Borrar</button><span class="sp"></span><button id="rX">Cancelar</button><button class="pri" id="rOk">Guardar</button></div>`);
    $('rX').onclick = () => d.close();
    $('rDel').onclick = () => { D().repro = {}; save(); d.close(); render(el); };
    $('rOk').onclick = () => { D().repro = { vence:$('rVence').value || undefined, aviso:$('rAviso').checked }; save(); d.close(); render(el); };
  }
  function openGen(el, g) {
    editGen = g;
    const d = dlg('dlgGen', `<h3>🌿 ${g ? 'Editar' : 'Nueva'} genética</h3>
      <label>Nombre<input id="gN" value="${esc(g?.n || '')}"></label>
      <label>Tipo<select id="gT"><option value="">—</option>${TIPOS.map(t => `<option ${g?.tipo === t ? 'selected' : ''}>${t}</option>`).join('')}</select></label>
      <div class="wrow" style="grid-template-columns:auto 1fr auto 1fr"><label>THC %</label><input id="gTHC" type="number" step="0.1" value="${esc(g?.thc || '')}"><label>CBD %</label><input id="gCBD" type="number" step="0.1" value="${esc(g?.cbd || '')}"></div>
      <label>Banco / de dónde viene<input id="gB" value="${esc(g?.banco || '')}"></label>
      <label>Notas<input id="gNo" value="${esc(g?.nota || '')}" placeholder="Sabor, efecto, para qué momento…"></label>
      <div class="btns">${g ? '<button id="gDel">Borrar</button>' : ''}<span class="sp"></span><button id="gX">Cancelar</button><button class="pri" id="gOk">Guardar</button></div>`);
    $('gX').onclick = () => d.close();
    if (g) $('gDel').onclick = () => { D().gens = D().gens.filter(x => x !== g); save(); d.close(); render(el); };
    $('gOk').onclick = () => {
      const n = $('gN').value.trim(); if (!n) return;
      const o = { n, tipo:$('gT').value || undefined, thc:$('gTHC').value || undefined, cbd:$('gCBD').value || undefined, banco:$('gB').value.trim() || undefined, nota:$('gNo').value.trim() || undefined };
      if (g) { // si cambió el nombre, actualizo también los registros
        if (g.n !== n) Object.values(D().log).flat().forEach(e => { if (e.g === g.n) e.g = n; });
        Object.assign(g, o);
      } else if (!D().gens.some(x => norm(x.n) === norm(n))) D().gens.push(o);
      save(); d.close(); render(el);
    };
  }

  /* ---------- aviso del vencimiento dentro de FUNVS ---------- */
  function check() {
    const r = repro(), d = D().repro; if (!r || d.aviso === false) return;
    const marks = [60, 30, 15, 7, 1, 0], hit = marks.find(m => r.n === m) ?? (r.n < 0 ? -1 : null); if (hit == null) return;
    const k = 'repro' + d.vence + hit, done = S.get('diarioAvisos', []);
    if (done.includes(k) || DND.active()) return;
    S.set('diarioAvisos', [...done, k].slice(-20));
    toast(`<span class="g">📄 REPROCANN</span>${esc(r.txt)} (${esc(fdate(d.vence))})`, { cls:'t420', ms:20000, onclick:() => Nav.go('420') });
  }
  function init() { setTimeout(check, 10e3); setInterval(check, 3600e3); }
  return { render, init, stats, repro };
})();
