/* =========================================================
   Prode personal + Llave de gol (Liga Profesional Argentina)
   Prode: resultado exacto 3 pts · acertar ganador o empate 1 pt
   Llave de gol: un jugador por equipo que creés que hace un gol · 2 pts por cada uno que convierte
   El objetivo: superarte mes a mes.
   ========================================================= */
const Prode = (() => {
  const LIGA = 'arg.1', PTS = { exact:3, winner:1, scorer:2 };
  let matches = {}, loading = false, lastLoad = 0, rosters = S.get('rosters', {});
  const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
  const monthKey = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0'); };
  const monthName = k => { const [y, m] = k.split('-'); return MES[+m - 1] + (y != new Date().getFullYear() ? ' ' + y : ''); };
  const ymd = d => { const x = new Date(d); return x.getFullYear() + String(x.getMonth() + 1).padStart(2, '0') + String(x.getDate()).padStart(2, '0'); };

  /* ---------- Datos: partidos de la liga (de 3 días atrás a 10 adelante) ---------- */
  async function load(force) {
    if (loading || (!force && Date.now() - lastLoad < 5 * 60e3)) return;
    loading = true;
    const days = new Set();
    for (let o = -3; o <= 10; o++) { const d = new Date(); d.setDate(d.getDate() + o); days.add(ymd(d)); }
    // también los días de pronósticos que todavía no tienen resultado
    Object.values(db.prode.preds).forEach(p => { if (!db.prode.res[p.id] && Date.parse(p.date) < Date.now() - 2 * 3600e3) days.add(ymd(p.date)); });
    await Promise.all([...days].map(async day => {
      try {
        const j = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${LIGA}/scoreboard?dates=${day}`)).json();
        Fulbito.evs(j).forEach(m => { matches[m.id] = m; });
      } catch {}
    }));
    // guardo los resultados finales de lo que pronosticaste (para no depender de que la fuente los siga mostrando)
    let changed = false;
    Object.values(matches).forEach(m => {
      if (m.state === 'post' && db.prode.preds[m.id] && !db.prode.res[m.id]) {
        db.prode.res[m.id] = { hs:m.hs, as:m.as, sc:m.goals.filter(g => !g.og).map(g => g.whoId).filter(Boolean), names:m.goals.filter(g => !g.og).map(g => g.who) };
        changed = true;
      }
    });
    if (changed) save();
    lastLoad = Date.now(); loading = false;
    if (Nav.current === 'prode') render();
  }
  async function roster(teamId) {
    const r = rosters[teamId];
    if (r && Date.now() - r.at < 7 * 864e5) return r.list;
    try {
      const j = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${LIGA}/teams/${teamId}/roster`)).json();
      const ORDER = { F:0, M:1, D:2, G:3 };
      const list = (j.athletes || []).map(a => ({ id:a.id, name:a.displayName, pos:(a.position?.abbreviation || '').charAt(0) }))
        .filter(a => a.pos !== 'G').sort((a, b) => (ORDER[a.pos] ?? 4) - (ORDER[b.pos] ?? 4) || a.name.localeCompare(b.name));
      rosters[teamId] = { at:Date.now(), list }; S.set('rosters', rosters);
      return list;
    } catch { return r ? r.list : []; }
  }

  /* ---------- Puntos ---------- */
  function score(pred) {
    const r = db.prode.res[pred.id]; if (!r) return null;
    const out = { prode:0, llave:0, detail:[] };
    if (pred.h !== '' && pred.a !== '' && pred.h != null && pred.a != null) {
      const sign = (x, y) => Math.sign(x - y);
      if (+pred.h === r.hs && +pred.a === r.as) { out.prode = PTS.exact; out.detail.push('🎯 Resultado exacto +' + PTS.exact); }
      else if (sign(+pred.h, +pred.a) === sign(r.hs, r.as)) { out.prode = PTS.winner; out.detail.push('✅ Acertaste ' + (r.hs === r.as ? 'el empate' : 'el ganador') + ' +' + PTS.winner); }
      else out.detail.push('❌ Pronóstico errado');
    }
    [pred.ph, pred.pa].forEach(pk => {
      if (!pk) return;
      const hit = r.sc.includes(pk.id) || r.names.some(n => norm(n) === norm(pk.name));
      if (hit) { out.llave += PTS.scorer; out.detail.push(`⚽ ${pk.name} convirtió +${PTS.scorer}`); }
      else out.detail.push(`· ${pk.name} no convirtió`);
    });
    return out;
  }
  function months() {
    const m = {};
    Object.values(db.prode.preds).forEach(p => {
      const s = score(p); if (!s) return;
      const k = monthKey(p.date); m[k] = m[k] || { prode:0, llave:0, n:0, exact:0, goals:0 };
      m[k].prode += s.prode; m[k].llave += s.llave; m[k].n++;
      if (s.prode === PTS.exact) m[k].exact++; m[k].goals += s.llave / PTS.scorer;
    });
    return m;
  }
  const monthTotal = k => { const x = months()[k]; return x ? x.prode + x.llave : 0; };

  /* ---------- Pantalla ---------- */
  function pickSel(m, side, pred) {
    const team = side === 'h' ? m.h.team : m.a.team, cur = pred && pred['p' + side];
    return `<select class="pksel" data-pk="${m.id}" data-side="${side}" data-team="${team.id}">
      <option value="">⚽ Goleador de ${esc(team.shortDisplayName || team.displayName)}…</option>
      ${cur ? `<option value="${esc(cur.id)}" selected>${esc(cur.name)}</option>` : ''}</select>`;
  }
  function matchCard(m) {
    const p = db.prode.preds[m.id], locked = Date.now() >= Date.parse(m.date) || m.state !== 'pre';
    const s = p && score(p);
    const t = (c, cls) => `<div class="pteam ${cls}">${c.team.logo ? `<img src="${esc(c.team.logo)}" alt="">` : ''}<span>${esc(c.team.shortDisplayName || c.team.displayName)}</span></div>`;
    const inp = side => locked ? `<span class="pv">${p && p[side] !== '' && p[side] != null ? p[side] : '–'}</span>`
      : `<input class="pin" type="number" min="0" max="15" inputmode="numeric" data-pi="${m.id}" data-side="${side}" value="${p && p[side] != null ? p[side] : ''}">`;
    return `<div class="pmatch ${locked ? 'locked' : ''} ${s ? 'scored' : ''}">
      <div class="pmeta">${m.state === 'in' ? '<span class="lv">● EN VIVO ' + esc(m.st) + '</span>' : m.state === 'post' ? 'Final' : new Date(m.date).toLocaleDateString('es-AR', { weekday:'short', day:'numeric', month:'numeric' }) + ' ' + fmtH(m.date)}
        ${m.state !== 'pre' ? `<b class="real">${m.hs} - ${m.as}</b>` : ''}${locked && !p ? ' · <span class="mut">sin pronóstico</span>' : ''}</div>
      <div class="prow">${t(m.h, 'h')}<div class="pscore">${inp('h')}<span>-</span>${inp('a')}</div>${t(m.a, 'a')}</div>
      <div class="pkeys">${locked ? [p?.ph, p?.pa].map((pk, i) => `<span class="pk ${pk && s && (db.prode.res[m.id].sc.includes(pk.id) || db.prode.res[m.id].names.some(n => norm(n) === norm(pk.name))) ? 'hit' : ''}">⚽ ${pk ? esc(pk.name) : '<span class="mut">—</span>'}</span>`).join('')
        : pickSel(m, 'h', p) + pickSel(m, 'a', p)}</div>
      ${s ? `<div class="pres"><b>+${s.prode + s.llave}</b> ${s.detail.map(esc).join(' · ')}</div>` : ''}
    </div>`;
  }

  function render() {
    const v = $('v-prode');
    load();
    const all = Object.values(matches).sort((a, b) => Date.parse(a.date) - Date.parse(b.date));
    const upcoming = all.filter(m => m.state !== 'post' && Date.parse(m.date) < Date.now() + 10 * 864e5);
    const done = Object.values(db.prode.preds).filter(p => db.prode.res[p.id]).sort((a, b) => Date.parse(b.date) - Date.parse(a.date)).slice(0, 20)
      .map(p => matches[p.id] || fakeMatch(p));
    const M = months(), now = monthKey(Date.now()), keys = Object.keys(M).sort();
    const prev = keys.filter(k => k < now).slice(-1)[0], best = keys.filter(k => k !== now).sort((a, b) => monthTotal(b) - monthTotal(a))[0];
    const cur = M[now] || { prode:0, llave:0, n:0, exact:0, goals:0 };
    const tot = cur.prode + cur.llave, max = Math.max(1, ...keys.map(monthTotal));
    v.innerHTML = `
      <div class="phero">
        <div><div class="mut" style="font-size:12px;letter-spacing:1px">TU MES · ${esc(monthName(now).toUpperCase())}</div>
          <div class="pbig">${tot} <small>pts</small></div>
          <div class="mut" style="font-size:13px">🎯 Prode ${cur.prode} · ⚽ Llave ${cur.llave} · ${cur.n} ${cur.n === 1 ? "partido jugado" : "partidos jugados"}</div>
          <div style="margin-top:6px;font-size:14px">${prev ? (tot > monthTotal(prev) ? `🔥 Ya superaste ${esc(monthName(prev))} (${monthTotal(prev)} pts)` : `Te faltan <b>${monthTotal(prev) - tot + 1}</b> pts para superar ${esc(monthName(prev))} (${monthTotal(prev)})`) : 'Primer mes: ¡a marcar la vara!'}
          ${best && best !== prev ? `<br><span class="mut">Récord: ${esc(monthName(best))} con ${monthTotal(best)} pts</span>` : ''}</div></div>
        <div class="pbars">${keys.slice(-6).map(k => `<div title="${monthTotal(k)} pts"><i style="height:${Math.round(monthTotal(k) / max * 100)}%" class="${k === now ? 'now' : ''}"></i><span>${esc(monthName(k).slice(0, 3))}</span><b>${monthTotal(k)}</b></div>`).join('') || ''}</div>
      </div>
      <h2 class="sec">📝 Próximos partidos de la Liga Profesional</h2>
      ${upcoming.length ? `<div class="pgrid">${upcoming.map(matchCard).join('')}</div>` : `<div class="empty">${loading || !lastLoad ? 'Cargando partidos…' : 'No hay partidos de la Liga en los próximos días.'}</div>`}
      ${done.length ? `<h2 class="sec" style="margin-top:18px">✅ Tus resultados</h2><div class="pgrid">${done.map(matchCard).join('')}</div>` : ''}
      <p class="mut" style="font-size:12px;margin-top:12px">Puntaje: resultado exacto ${PTS.exact} pts · ganador o empate ${PTS.winner} pt · cada goleador acertado de tu Llave ${PTS.scorer} pts. Los pronósticos se cierran cuando arranca el partido. Los goles en contra no cuentan para la Llave.</p>`;
    v.querySelectorAll('.pin').forEach(i => i.onchange = () => setPred(i.dataset.pi, { [i.dataset.side]:i.value === '' ? '' : Math.max(0, Math.min(15, +i.value)) }));
    v.querySelectorAll('.pksel').forEach(sel => {
      const fill = async () => {
        if (sel.dataset.filled) return; sel.dataset.filled = 1;
        const cur = sel.value, list = await roster(sel.dataset.team);
        sel.innerHTML = sel.options[0].outerHTML + list.map(a => `<option value="${esc(a.id)}" ${a.id === cur ? 'selected' : ''}>${esc(a.name)}${a.pos ? ' (' + ({ F:'DEL', M:'VOL', D:'DEF' }[a.pos] || a.pos) + ')' : ''}</option>`).join('');
        if (!list.length) sel.insertAdjacentHTML('beforeend', '<option disabled>No pude traer el plantel</option>');
      };
      sel.addEventListener('focus', fill); sel.addEventListener('pointerdown', fill);
      sel.onchange = () => { const o = sel.selectedOptions[0]; setPred(sel.dataset.pk, { ['p' + sel.dataset.side]:sel.value ? { id:sel.value, name:o.textContent.replace(/ \(\w+\)$/, '') } : null }); };
    });
  }
  function fakeMatch(p) {   // partido viejo que la fuente ya no muestra: lo reconstruyo con lo guardado
    const r = db.prode.res[p.id];
    return { id:p.id, date:p.date, state:'post', st:'Final', hs:r.hs, as:r.as, goals:[],
      h:{ team:{ id:p.homeId, displayName:p.home, shortDisplayName:p.home } }, a:{ team:{ id:p.awayId, displayName:p.away, shortDisplayName:p.away } } };
  }
  function setPred(id, patch) {
    const m = matches[id]; if (!m || Date.now() >= Date.parse(m.date)) { toast('<b>Ese partido ya arrancó</b><small>Los pronósticos se cierran al comienzo.</small>', { cls:'info', ms:4000 }); render(); return; }
    const p = db.prode.preds[id] || { id, date:m.date, home:m.h.team.shortDisplayName || m.h.team.displayName, away:m.a.team.shortDisplayName || m.a.team.displayName, homeId:m.h.team.id, awayId:m.a.team.id, h:'', a:'', ph:null, pa:null };
    Object.assign(p, patch); db.prode.preds[id] = p; save();
  }

  function init() {
    setTimeout(() => load(), 4000); setInterval(() => load(), 30 * 60e3);
    onChange(() => { if (Nav.current === 'prode') render(); });
  }
  const pendingCount = () => Object.values(matches).filter(m => m.state === 'pre' && Date.parse(m.date) - Date.now() < 864e5 && Date.parse(m.date) > Date.now() && !db.prode.preds[m.id]).length;
  return { init, render, months, monthTotal, score, pendingCount };
})();
