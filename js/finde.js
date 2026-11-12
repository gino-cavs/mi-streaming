/* =========================================================
   📄 El fin de semana en un PDF: F1, Moto3, Moto2, MotoGP (horarios de Argentina) y Huracán si juega.
   Horarios: APIs oficiales (motogp.com y la de la F1 que usa Jolpica) que junta GitHub.
   Partido: ESPN (fecha, cancha, árbitro, tabla, cómo viene, cruces) + la guía de TV de FUNVS.
   ========================================================= */
const Finde = (() => {
  const TZ = 'America/Argentina/Buenos_Aires';
  const dia = d => new Intl.DateTimeFormat('es-AR', { timeZone:TZ, weekday:'long', day:'numeric', month:'long' }).format(d);
  const hhmm = d => new Intl.DateTimeFormat('es-AR', { timeZone:TZ, hour:'2-digit', minute:'2-digit', hourCycle:'h23' }).format(d);
  const keyDay = d => new Intl.DateTimeFormat('en-CA', { timeZone:TZ }).format(d);
  const mins = (a, b) => b ? Math.round((Date.parse(b) - Date.parse(a)) / 60e3) : 0;

  // la ventana del finde: de jueves a lunes alrededor del próximo domingo (si hoy es lunes, el finde que viene)
  function ventana() {
    const now = new Date(), d = new Date(now); d.setHours(0, 0, 0, 0);
    const toSun = (7 - d.getDay()) % 7; const sun = new Date(d); sun.setDate(d.getDate() + toSun);
    const from = new Date(sun); from.setDate(sun.getDate() - 3); const to = new Date(sun); to.setDate(sun.getDate() + 1); to.setHours(23, 59, 59);
    return { from, to };
  }
  const inWin = (iso, w) => { const t = Date.parse(iso); return t >= +w.from && t <= +w.to; };

  // nombres como los querés vos
  const MOTO = { 'Free Practice Nr. 1':'Práctica libre 1', 'Practice':'Práctica libre', 'Free Practice Nr. 2':'Práctica libre 2', 'Free Practice Nr. 3':'Práctica libre 3',
    'Qualifying Nr. 1':'Clasificación', 'Qualifying Nr. 2':null, 'Qualifying':'Clasificación', 'Tissot Sprint':'Carrera sprint', 'Sprint':'Carrera sprint', 'Warm Up':'Warmup', 'Grand Prix':'CARRERA', 'Race':'CARRERA' };
  const F1N = { 'Libres 1':'Práctica libre 1', 'Libres 2':'Práctica libre 2', 'Libres 3':'Práctica libre 3', 'Clasificación Sprint':'Clasificación sprint', 'Sprint':'Carrera sprint', 'Clasificación':'Clasificación', 'Carrera':'CARRERA' };
  const motoName = x => { if (x.n in MOTO) return MOTO[x.n]; if (x.k === 'RACE') return /sprint/i.test(x.n) ? 'Carrera sprint' : 'CARRERA'; if (x.k === 'QUALIFYING') return /2/.test(x.n) ? null : 'Clasificación'; if (x.k === 'WARM_UP') return 'Warmup'; return x.n; };

  function bloque(titulo, gp, ses, conMin) {   // ses: [{s, e, n}] ya en orden
    const L = [{ h:1, t:titulo }, { h:3, t:`${gp || 'Gran Premio'} - horarios de Argentina` }]; let last = '';
    for (const x of ses) { const d = new Date(x.s), k = keyDay(d);
      if (k !== last) { last = k; L.push({ h:2, t:dia(d).toUpperCase().replace(/^([^\s,]+),?\s/, "$1 ").replace(/ DE (\S+)$/, (m, mes) => ' de ' + mes.toLowerCase()) }); }
      const m = mins(x.s, x.e); L.push({ t:`${hhmm(d)} hs  ${x.n}${conMin && m > 0 && m < 240 ? `  ${m} min` : ''}`, big:x.n === 'CARRERA' }); }
    return L;
  }

  async function motos(w) {
    const data = await Motor.data(), out = []; const nx = data?.cats?.motogp?.next; if (!nx) return out;
    const all = nx.all || {}, find = re => Object.entries(all).find(([k]) => re.test(k))?.[1];
    for (const [tit, re, conMin] of [['MOTO3', /^(MT3|M3|MOTO3)$/i, false], ['MOTO2', /^(MT2|M2|MOTO2)$/i, false], ['MOTOGP', /^(MGP|MOTOGP)$/i, true]]) {
      let l = find(re); if (!l && tit === 'MOTOGP') l = (nx.sessions || []).map(x => ({ n:x.name === 'Carrera' ? 'Grand Prix' : x.name, s:x.start, e:x.end, k:x.race ? 'RACE' : '' }));
      const ses = (l || []).filter(x => inWin(x.s, w)).map(x => ({ s:x.s, e:x.e, n:motoName(x) })).filter(x => x.n);
      if (ses.length) out.push(bloque(tit, nx.name, ses, conMin));
    }
    return out;
  }
  async function f1(w) {
    const data = await Motor.data(), nx = data?.cats?.f1?.next; if (!nx) return null;
    const ses = (nx.sessions || []).filter(x => inWin(x.start, w)).map(x => ({ s:x.start, n:F1N[x.name] || x.name }));
    return ses.length ? bloque('FÓRMULA 1', nx.name, ses, false) : null;
  }

  /* ⚽ Huracán (ESPN) */
  const ESPN = 'https://site.api.espn.com/apis/site/v2/sports/soccer/';
  const J = async u => { const r = await fetch(u); if (!r.ok) throw new Error(r.status); return r.json(); };
  const norm = s => (s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
  async function huracan(w) {
    const lg = 'arg.1';
    const teams = (await J(ESPN + lg + '/teams')).sports?.[0]?.leagues?.[0]?.teams?.map(t => t.team) || [];
    const me = teams.find(t => /hurac/i.test(norm(t.displayName))); if (!me) return null;
    const sch = await J(ESPN + lg + '/teams/' + me.id + '/schedule?fixture=true').catch(() => null);
    const ev = (sch?.events || []).find(e => inWin(e.date, w)); if (!ev) return null;
    const sum = await J(ESPN + lg + '/summary?event=' + ev.id).catch(() => ({}));
    const comp = sum.header?.competitions?.[0] || ev.competitions?.[0] || {}, cs = comp.competitors || [];
    const home = cs.find(c => c.homeAway === 'home') || cs[0], away = cs.find(c => c.homeAway === 'away') || cs[1];
    const nm = c => c?.team?.displayName || c?.team?.name || '';
    const d = new Date(comp.date || ev.date), L = [];
    L.push({ h:1, t:`${nm(home)} VS ${nm(away)}`.toUpperCase() });
    // tabla: zona y puesto
    const groups = (sum.standings?.groups || []).flatMap(g => g.standings?.entries ? [g] : (g.groups || []));
    const rowOf = c => { for (const g of groups) { const e = (g.standings?.entries || []).find(x => String(x.team?.id ?? x.id) === String(c?.team?.id) || norm(x.team?.displayName ?? x.team) === norm(nm(c)));
      if (e) { const st = k => e.stats?.find(s => s.name === k || s.abbreviation === k)?.displayValue; return { zona:g.header || g.name || '', pos:e.stats ? (st('rank') || (g.standings.entries.indexOf(e) + 1)) : g.standings.entries.indexOf(e) + 1, pts:st('points') || st('P') || '', n:g.standings.entries.length }; } } return null; };
    const rh = rowOf(home), ra = rowOf(away), meRow = rowOf(home?.team?.id === me.id ? home : away);
    L.push({ h:3, t:[sum.header?.league?.name || ev.league?.name || 'Liga Profesional', ev.week?.number ? 'Fecha ' + ev.week.number : '', meRow?.zona].filter(Boolean).join(' - ') });
    L.push({ h:2, t:'CUÁNDO Y DÓNDE' });
    L.push({ t:`Día  ${dia(d).replace(/^\w/, c => c.toUpperCase())}` });
    L.push({ t:`Hora  ${hhmm(d)} hs (hora de Argentina)` });
    const tv = await canal(nm(home), nm(away), d);
    L.push({ t:`Por TV  ${tv || 'a confirmar'}` });
    const venue = sum.gameInfo?.venue?.fullName || comp.venue?.fullName; if (venue) L.push({ t:`Cancha  ${venue} (${nm(home)} es local)` });
    const ref = (sum.gameInfo?.officials || []).find(o => /referee|árbitro/i.test(o.position?.name || o.position?.displayName || '') || o.order === 1); if (ref) L.push({ t:`Árbitro  ${ref.displayName || ref.fullName}` });
    L.push({ h:2, t:'CÓMO LLEGA CADA EQUIPO' });
    const form = c => { const f = (sum.boxscore?.form || []).find(x => String(x.team?.id) === String(c?.team?.id)); return f?.events || []; };
    const racha = evs => { if (!evs.length) return ''; const r = evs.map(e => e.gameResult); const f = r[0]; let n = 0; for (const x of r) { if (x === f) n++; else break; }
      const w = { W:['victoria', 'victorias'], L:['derrota', 'derrotas'], D:['empate', 'empates'] }[f]; return w ? `${n} ${n === 1 ? w[0] : w[1]} seguid${n === 1 ? (f === 'D' ? 'o' : 'a') : (f === 'D' ? 'os' : 'as')}` : ''; };
    const ultimo = (c, evs) => { const e = evs[0]; if (!e) return ''; const verb = { W:'Ganó', L:'Perdió', D:'Empató' }[e.gameResult] || ''; return `${verb} ${e.score || ''} contra ${e.opponent?.displayName || ''}`.trim(); };
    for (const [c, r] of [[home, rh], [away, ra]]) { const evs = form(c);
      L.push({ h:4, t:nm(c).toUpperCase() });
      if (r) L.push({ t:`Puesto en su zona  ${r.pos}°${r.pts ? ` (${r.pts} puntos)` : ''}` });
      if (racha(evs)) L.push({ t:`Cómo viene  ${racha(evs)}` });
      if (ultimo(c, evs)) L.push({ t:`Último partido  ${ultimo(c, evs)}` }); }
    if (meRow) { L.push({ h:2, t:'LO QUE SE JUEGA' });
      const cut = 8, mp = +meRow.pos; L.push({ t: mp <= cut ? `Huracán está ${mp === cut ? 'en el último lugar que' : 'en zona que'} clasifica a los playoffs (los ${cut} primeros de la zona).` : `Huracán está ${mp - cut} puesto${mp - cut === 1 ? '' : 's'} abajo del último que clasifica a los playoffs (los ${cut} primeros de la zona).` }); }
    const h2h = (sum.headToHeadGames || []).flatMap(x => x.events || []).slice(0, 5);
    if (h2h.length) { L.push({ h:2, t:'LOS ÚLTIMOS 5 CRUCES' });
      const hw = h2h.filter(e => (e.gameResult === 'W')).length, hl = h2h.filter(e => e.gameResult === 'L').length, hd = h2h.length - hw - hl, team = nm(sum.headToHeadGames?.[0]?.team ? { team:sum.headToHeadGames[0].team } : home);
      L.push({ t:`${team} ganó ${hw}, ${team === nm(home) ? nm(away) : nm(home)} ganó ${hl}, ${hd} empate${hd === 1 ? '' : 's'}.` });
      const u = h2h[0]; if (u) L.push({ t:`El último fue el ${new Intl.DateTimeFormat('es-AR', { day:'numeric', month:'long', year:'numeric', timeZone:TZ }).format(new Date(u.gameDate))}: ${u.homeTeamScore != null ? `${u.homeTeam?.displayName || ''} ${u.homeTeamScore} - ${u.awayTeamScore} ${u.awayTeam?.displayName || ''}` : (u.score || '')}.` }); }
    L.push({ small:true, t:'Datos de ESPN y de la guía de TV de FUNVS. Los horarios pueden cambiar: conviene confirmarlos antes del partido.' });
    return L;
  }
  async function canal(h, a, d) {
    try { const g = await (await fetch(REPO.data + 'tv.json?t=' + Math.floor(Date.now() / 600e3))).json();
      const w = s => new Set(norm(s).replace(/[^a-z0-9 ]/g, ' ').split(' ').filter(x => x.length > 2 && !['club', 'atletico', 'deportivo'].includes(x)));
      const same = (x, y) => [...w(x)].some(t => w(y).has(t));
      const m = (g.matches || []).find(m => Math.abs(Date.parse(m.date) - d) < 2 * 864e5 && ((same(m.home, h) && same(m.away, a)) || (same(m.home, a) && same(m.away, h))));
      return m?.channels?.join(', ') || ''; } catch { return ''; }
  }

  /* 📄 armar, mostrar y bajar */
  let lines = [];
  const asText = () => lines.map(b => b.map(x => x.t).join('\n')).join('\n\n');
  async function open() {
    const o = document.createElement('div'); o.id = 'findeDlg';
    o.innerHTML = `<div class="fdbox"><div class="btns"><b>📄 El finde: horarios de Argentina</b><span class="sp"></span><button data-fx>✕</button></div><div class="fdbody"><p class="mut">Armando los horarios…</p></div></div>`;
    document.body.appendChild(o); o.querySelector('[data-fx]').onclick = () => o.remove(); o.onclick = e => { if (e.target === o) o.remove(); };
    const w = ventana(), body = o.querySelector('.fdbody');
    const parts = await Promise.allSettled([motos(w), f1(w), huracan(w)]);
    lines = [...(parts[0].value || []), parts[1].value, parts[2].value].filter(Boolean);
    const fails = parts.filter(p => p.status === 'rejected').length;
    if (!lines.length) { body.innerHTML = `<p>No encontré carreras ni partido de Huracán entre el jueves y el lunes de este finde.</p>${fails ? '<p class="mut">Algunas fuentes no respondieron: probá en un rato.</p>' : ''}`; return; }
    body.innerHTML = `<div class="fdprev">${lines.map(b => `<section>${b.map(x => x.h === 1 ? `<h2>${esc(x.t)}</h2>` : x.h === 3 ? `<p class="fdsub">${esc(x.t)}</p>` : x.h === 2 ? `<h3>${esc(x.t)}</h3>` : x.h === 4 ? `<h4>${esc(x.t)}</h4>` : x.small ? `<p class="fdsmall">${esc(x.t)}</p>` : `<p class="${x.big ? 'fdbig' : ''}">${esc(x.t)}</p>`).join('')}</section>`).join('')}</div>
      <p class="mut fdsrc">Horarios de motogp.com y de la F1 (vía Jolpica), pasados a hora de Argentina. Partido: ESPN y la guía de TV. Para chequear la TV, mirá también Vuelta Rápida, Campeones y Carburando.</p>
      <div class="btns"><button class="pri" data-fpdf>📄 Bajar PDF</button><button data-fcp>📋 Copiar texto</button><button data-fpr>🖨️ Imprimir</button></div>`;
    body.querySelector('[data-fcp]').onclick = async () => { try { await navigator.clipboard.writeText(asText()); toast('📋 Copiado', { ms:1500 }); } catch { toast('No pude copiar', { cls:'info' }); } };
    body.querySelector('[data-fpr]').onclick = () => printIt();
    body.querySelector('[data-fpdf]').onclick = () => pdf().catch(e => toast(`<b>No pude armar el PDF</b><small>${esc(e.message)}</small>`, { cls:'info' }));
  }
  function printIt() {
    const w = window.open('', '_blank'); if (!w) return toast('El navegador bloqueó la ventana', { cls:'info' });
    w.document.write(`<!doctype html><meta charset="utf-8"><title>El finde</title><style>body{font:14px/1.45 system-ui;margin:28px;color:#111}h2{margin:22px 0 2px;font-size:20px;color:#1238b5}h3{margin:12px 0 2px;font-size:14px}h4{margin:8px 0 0}p{margin:2px 0}.fdsub{color:#555}.fdbig{font-weight:800}.fdsmall{color:#666;font-size:11px;margin-top:8px}section{break-inside:avoid}</style>${document.querySelector('.fdprev').innerHTML}`);
    w.document.close(); setTimeout(() => w.print(), 300);
  }
  let jsp = null;
  const loadJsPDF = () => jsp || (jsp = new Promise((ok, no) => { const s = document.createElement('script'); s.src = 'https://cdn.jsdelivr.net/npm/jspdf@2.5.1/dist/jspdf.umd.min.js'; s.onload = () => ok(window.jspdf.jsPDF); s.onerror = () => { jsp = null; no(new Error('No se pudo cargar el armador de PDF (¿sin internet?)')); }; document.head.appendChild(s); }));
  async function pdf() {
    const JS = await loadJsPDF(), doc = new JS({ unit:'pt', format:'a4' }), W = doc.internal.pageSize.getWidth(), H = doc.internal.pageSize.getHeight(), M = 48; let y = M;
    const need = h => { if (y + h > H - M) { doc.addPage(); y = M; } };
    const put = (t, size, style = 'normal', color = [20, 20, 20], gap = 4) => { doc.setFont('helvetica', style); doc.setFontSize(size); doc.setTextColor(...color);
      for (const ln of doc.splitTextToSize(t, W - 2 * M)) { need(size + gap); doc.text(ln, M, y + size); y += size + gap; } };
    for (const b of lines) {
      need(80); y += 10;
      for (const x of b) {
        if (x.h === 1) { y += 6; put(x.t, 17, 'bold', [18, 56, 181], 3); doc.setDrawColor(18, 56, 181); doc.line(M, y + 1, W - M, y + 1); y += 6; }
        else if (x.h === 3) put(x.t, 11, 'italic', [90, 90, 90]);
        else if (x.h === 2) { y += 4; put(x.t, 11.5, 'bold', [0, 0, 0]); }
        else if (x.h === 4) { y += 2; put(x.t, 11, 'bold', [18, 56, 181]); }
        else if (x.small) { y += 4; put(x.t, 8.5, 'normal', [110, 110, 110]); }
        else put(x.t, 11, x.big ? 'bold' : 'normal');
      }
    }
    const name = 'finde-' + keyDay(ventana().to).slice(0, 10) + '.pdf';
    if (/FUNVSApp/.test(navigator.userAgent)) { await navigator.clipboard?.writeText(asText()).catch(() => {}); return toast('<b>En la app no se pueden bajar archivos</b><small>Te copié el texto. Para el PDF, abrí FUNVS en Chrome o en la compu.</small>', { cls:'info', ms:8000 }); }
    doc.save(name); toast('📄 PDF listo', { ms:1800 });
  }
  return { open };
})();
