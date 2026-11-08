/* =========================================================
   📓 Diario 420: días, rachas, genéticas y vencimiento del REPROCANN.
   Se guarda en db.diario (Gist privado, sincronizado), nunca en el repo.
   ========================================================= */
const Diario = (() => {
  const FORMAS = ['🚬 Porro', '💨 Vapo', '🪈 Pipa', '🫧 Bong', '🍪 Comestible', '💧 Aceite', '✨ Otro'];
  const TIPOS = ['Índica', 'Sativa', 'Híbrida', 'CBD'];
  const D = () => { db.diario = db.diario || {}; const d = db.diario; d.log = d.log || {}; d.gens = d.gens || []; d.repro = d.repro || {}; d.notas = d.notas || {}; return d; };
  const ymd = (dt = new Date()) => `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
  const parse = s => { const [y, m, d] = s.split('-').map(Number); return new Date(y, m - 1, d); };
  const addDays = (s, n) => { const d = parse(s); d.setDate(d.getDate() + n); return ymd(d); };
  const dayDiff = (a, b) => Math.round((parse(b) - parse(a)) / 864e5);
  const fdate = s => parse(s).toLocaleDateString('es-AR', { day:'numeric', month:'short', year:'numeric' });
  let month = null, editGen = null;

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

  /* ---------- pantalla: todo por mes ---------- */
  const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];
  const mLabel = m => MESES[+m.slice(5) - 1] + ' ' + m.slice(0, 4);
  const addMonth = (m, n) => { const d = parse(m + '-01'); d.setMonth(d.getMonth() + n); return ymd(d).slice(0, 7); };
  function monthStats(m) {
    const L = D().log, days = Object.keys(L).filter(k => k.startsWith(m) && L[k].length).sort(), ents = days.flatMap(k => L[k].map(e => ({ ...e, day:k })));
    let best = 0, run = 0, prev = null; for (const k of days) { run = prev && dayDiff(prev, k) === 1 ? run + 1 : 1; best = Math.max(best, run); prev = k; }
    const g = {}; ents.forEach(e => { const k = e.g || 'Sin genética'; const x = g[k] = g[k] || { n:k, veces:0, rs:[], formas:{} }; x.veces++; if (e.r) x.rs.push(e.r); if (e.f) x.formas[e.f] = (x.formas[e.f] || 0) + 1; });
    const rank = Object.values(g).map(x => ({ ...x, avg:x.rs.length ? x.rs.reduce((a, b) => a + b, 0) / x.rs.length : 0, forma:Object.entries(x.formas).sort((a, b) => b[1] - a[1])[0]?.[0] }))
      .sort((a, b) => b.avg - a.avg || b.veces - a.veces);
    const total = new Date(+m.slice(0, 4), +m.slice(5), 0).getDate();
    return { days, ents, best, rank, total };
  }
  function render(el) {
    const s = stats(), r = repro(), d = D();
    month = month || s.today.slice(0, 7);
    const ms = monthStats(month), prevMs = monthStats(addMonth(month, -1)), year = month.slice(0, 4);
    const isNow = month === s.today.slice(0, 7), diasTot = isNow ? s.diasMes : ms.total;
    const delta = ms.days.length - prevMs.days.length;
    const yearMonths = Array.from({ length:12 }, (_, i) => `${year}-${String(i + 1).padStart(2, '0')}`);
    const maxY = Math.max(1, ...yearMonths.map(m => monthStats(m).days.length));
    d.notas = d.notas || {};
    el.innerHTML = `
      <div class="dmonth"><button class="sm" id="dPrev">‹</button><h2>${mLabel(month)}</h2><button class="sm" id="dNext" ${isNow ? 'disabled' : ''}>›</button>${isNow ? '' : '<button class="sm" id="dHoy">Este mes</button>'}</div>
      <div class="dtiles">
        <div class="dtile"><b>${ms.days.length}<em>/${diasTot}</em></b><span>📅 Días del mes</span><small>${prevMs.days.length || delta ? (delta > 0 ? '▲ ' + delta : delta < 0 ? '▼ ' + -delta : '=') + ' vs ' + MESES[+addMonth(month, -1).slice(5) - 1].toLowerCase() : ''}</small></div>
        <div class="dtile"><b>${ms.ents.length}</b><span>🍃 Registros</span></div>
        <div class="dtile"><b>${ms.best}</b><span>🔥 Racha del mes</span><small>${isNow ? 'actual: ' + s.cur + ' · récord: ' + s.best : 'récord general: ' + s.best}</small></div>
        <div class="dtile gen"><b>${ms.rank[0] ? esc(ms.rank[0].n) : '—'}</b><span>👑 Genética del mes</span><small>${ms.rank[0] ? (ms.rank[0].avg ? '⭐ ' + ms.rank[0].avg.toFixed(1) + ' · ' : '') + ms.rank[0].veces + (ms.rank[0].veces === 1 ? ' vez' : ' veces') : ''}</small></div>
        <div class="dtile repro ${r ? r.cls : ''}" id="dRepro"><b>${r ? (r.n < 0 ? '⚠️' : r.n) : '—'}</b><span>📄 REPROCANN</span><small>${r ? esc(r.txt) + ' · ' + fdate(d.repro.vence) : 'Tocá para cargar el vencimiento'}</small></div>
      </div>

      <div class="vcols" style="margin-top:14px">
        <div>
          <h2 class="sec">🏆 Ranking de ${MESES[+month.slice(5) - 1].toLowerCase()}</h2>
          ${ms.rank.length ? `<ol class="drank">${ms.rank.map((g, i) => `<li><span class="dpos">${i + 1}</span><b>${esc(g.n)}</b><span>${g.avg ? '⭐ ' + g.avg.toFixed(1) : '<span class="mut">sin puntaje</span>'}</span><small>${g.veces} ${g.veces === 1 ? 'vez' : 'veces'}${g.forma ? ' · ' + esc(g.forma) : ''}</small></li>`).join('')}</ol>`
            : '<p class="mut" style="font-size:13px">Todavía nada este mes.</p>'}
          <h2 class="sec" style="margin-top:12px">📝 Nota del mes</h2>
          <textarea id="dNotaMes" rows="3" placeholder="Cómo fue el mes, qué probaste, qué querés repetir…">${esc(d.notas[month] || '')}</textarea>
        </div>
        <div>
          <h2 class="sec">✍️ Registrar</h2>
          <form id="dForm" class="dform">
            <input type="date" id="dDate" value="${isNow ? s.today : month + '-01'}" max="${s.today}">
            <input id="dGen" list="dGens" placeholder="Genética (opcional)" autocomplete="off">
            <datalist id="dGens">${d.gens.map(g => `<option value="${esc(g.n)}">`).join('')}</datalist>
            <div class="chips" id="dFormas">${FORMAS.map((f, i) => `<button type="button" data-f="${esc(f)}" class="${i === (S.get('dForma', 0)) ? 'on' : ''}">${esc(f)}</button>`).join('')}</div>
            <div class="chips" id="dStars">${[1, 2, 3, 4, 5].map(n => `<button type="button" data-r="${n}">${'⭐'.repeat(n)}</button>`).join('')}</div>
            <input id="dNota" placeholder="Nota (opcional)">
            <button class="pri">＋ Registrar</button>
          </form>
          <details style="margin-top:10px"><summary style="cursor:pointer;font-size:14px">📓 Registros de ${MESES[+month.slice(5) - 1].toLowerCase()} (${ms.ents.length})</summary>
            ${ms.days.slice().reverse().map(k => d.log[k].map((e, i) => `<div class="dentry"><small>${parse(k).toLocaleDateString('es-AR', { weekday:'short', day:'numeric' })}</small><span>${esc(e.f || '')}</span><b>${esc(e.g || 'Sin genética')}</b>${e.r ? `<span>${'⭐'.repeat(e.r)}</span>` : ''}${e.n ? `<small>“${esc(e.n)}”</small>` : ''}<button class="sm" data-del="${k}|${i}" title="Borrar">✕</button></div>`).join('')).join('') || '<p class="mut" style="font-size:13px">Sin registros.</p>'}
          </details>
        </div>
      </div>

      <h2 class="sec" style="margin-top:16px">🗓️ Tu ${year}</h2>
      <div class="dyear">${yearMonths.map(m => { const n = monthStats(m).days.length, fut = m > s.today.slice(0, 7);
        return `<button class="${m === month ? 'on' : ''}" ${fut ? 'disabled' : `data-m="${m}"`}><span class="dbar"><i style="height:${Math.round(n / maxY * 100)}%"></i></span><b>${n || ''}</b><small>${MESES[+m.slice(5) - 1].slice(0, 3)}</small></button>`; }).join('')}</div>

      <h2 class="sec" style="margin-top:16px">🌿 Genéticas</h2>
      <div class="dgens">${d.gens.slice().sort((a, b) => (s.count[norm(b.n)] || 0) - (s.count[norm(a.n)] || 0) || a.n.localeCompare(b.n)).map(g => `<div class="dgen" data-g="${esc(g.n)}"><b>${esc(g.n)}</b><span>${esc([g.tipo, g.thc && 'THC ' + g.thc + '%', g.cbd && 'CBD ' + g.cbd + '%', g.banco].filter(Boolean).join(' · '))}</span>
          <small>${(c => c === 1 ? '1 vez' : c + ' veces')(s.count[norm(g.n)] || 0)} en total</small>${g.nota ? `<small>“${esc(g.nota)}”</small>` : ''}</div>`).join('') || '<p class="mut" style="font-size:13px">Las genéticas que escribís al registrar se agregan solas.</p>'}
        <button class="dgen add" id="dGenAdd">＋ Genética</button></div>`;

    $('dPrev').onclick = () => { month = addMonth(month, -1); render(el); };
    $('dNext').onclick = () => { if (!isNow) { month = addMonth(month, 1); render(el); } };
    if ($('dHoy')) $('dHoy').onclick = () => { month = s.today.slice(0, 7); render(el); };
    el.querySelectorAll('[data-m]').forEach(b => b.onclick = () => { month = b.dataset.m; render(el); });
    el.querySelectorAll('[data-del]').forEach(b => b.onclick = () => { const [k, i] = b.dataset.del.split('|'); d.log[k].splice(+i, 1); if (!d.log[k].length) delete d.log[k]; save(); render(el); });
    $('dNotaMes').onchange = e => { const t = e.target.value.trim(); if (t) d.notas[month] = t; else delete d.notas[month]; save(); };
    let forma = FORMAS[S.get('dForma', 0)] || FORMAS[0], stars = 0;
    $('dFormas').onclick = e => { const b = e.target.closest('[data-f]'); if (!b) return; forma = b.dataset.f; S.set('dForma', FORMAS.indexOf(forma)); $('dFormas').querySelectorAll('button').forEach(x => x.classList.toggle('on', x === b)); };
    $('dStars').onclick = e => { const b = e.target.closest('[data-r]'); if (!b) return; stars = stars === +b.dataset.r ? 0 : +b.dataset.r; $('dStars').querySelectorAll('button').forEach(x => x.classList.toggle('on', +x.dataset.r === stars)); };
    $('dForm').onsubmit = e => {
      e.preventDefault();
      const day = $('dDate').value || s.today, g = $('dGen').value.trim(), known = d.gens.find(x => norm(x.n) === norm(g));
      if (g && !known) d.gens.push({ n:g });
      (d.log[day] = d.log[day] || []).push({ g:known ? known.n : g, f:forma, r:stars || undefined, n:$('dNota').value.trim() || undefined, t:day === s.today ? new Date().toTimeString().slice(0, 5) : undefined });
      month = day.slice(0, 7); save(); render(el);
      toast(`<span class="g">🍃 Registrado</span>${esc(g || forma)} · ${esc(fdate(day))}`, { cls:'t420', ms:3500 });
    };
    $('dRepro').onclick = () => openRepro(el);
    el.querySelectorAll('[data-g]').forEach(b => b.onclick = () => openGen(el, d.gens.find(g => g.n === b.dataset.g)));
    $('dGenAdd').onclick = () => openGen(el, null);
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
