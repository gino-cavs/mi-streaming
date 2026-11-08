/* =========================================================
   ⚔️ Mundo Clásicos (dentro de Fulbito): próximos clásicos de todo el mundo, últimos resultados,
   clásicos por país, ficha de cada uno (historia, historial, jugadores que pasaron por los dos)
   y clásicos propios. Datos: GitHub los arma desde Wikipedia, Wikidata y ESPN.
   ========================================================= */
const Clasicos = (() => {
  let data = null, at = 0, view = S.get('clView', 'home'), q = '', hist = {}, sum = {};
  async function load(force) {
    if (!force && data && Date.now() - at < 15 * 60e3) return data;
    try { const j = await (await fetch(REPO.data + 'clasicos.json?t=' + Math.floor(Date.now() / 600e3))).json(); if (j && j.derbies) { data = j; at = Date.now(); data.by = Object.fromEntries(j.derbies.map(d => [d.id, d])); } } catch {}
    return data;
  }
  const flag = p => (data?.paises || []).find(x => x[0] === p)?.[1] || '⭐';
  const dName = d => d.es && !/rivalry|derby/i.test(d.es) ? d.es : d.n;
  const hora = t => new Date(t).toLocaleString('es-AR', { weekday:'short', day:'numeric', month:'short', hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
  const logo = s => s.logo ? `<img class="cllogo" src="${esc(s.logo)}" alt="" loading="lazy" onerror="this.style.visibility='hidden'">` : '<span class="cllogo">⚽</span>';
  const gcal = f => { const t = new Date(f.date), e = new Date(+t + 2 * 3600e3), z = x => x.toISOString().replace(/[-:]|\.\d{3}/g, '');
    return 'https://calendar.google.com/calendar/render?' + new URLSearchParams({ action:'TEMPLATE', text:`⚔️ ${f.h} vs ${f.a}`, dates:`${z(t)}/${z(e)}`, details:`${dName(data.by[f.d])} · ${f.lg}` }); };

  function render(v, back) {
    if (!data) { v.querySelector('#clBody').innerHTML = '<div class="empty">Cargando el mundo de los clásicos…</div>'; load().then(d => { if (d) render(v, back); else v.querySelector('#clBody').innerHTML = '<div class="empty">Todavía no están los datos: GitHub los arma en la próxima actualización (hasta 30 min).</div>'; }); return; }
    const B = v.querySelector('#clBody');
    if (view.startsWith('d:') && data.by[view.slice(2)]) return derby(B, data.by[view.slice(2)]);
    if (view.startsWith('p:')) return pais(B, view.slice(2));
    home(B);
  }
  const go = x => { view = x; S.set('clView', x); Fulbito.render(true); $('scroller').scrollTo(0, 0); };
  const fxRow = f => { const d = data.by[f.d]; if (!d) return '';
    const live = f.st === 'in', post = f.st === 'post';
    return `<div class="clfx ${live ? 'live' : ''}" data-go="d:${esc(d.id)}">
      <span class="clfl">${flag(d.pais)}</span>
      <div class="clfm"><small>${esc(dName(d))} · ${esc(f.lg)}</small><b>${esc(f.h)} ${post || live ? `<span class="clsc">${esc(f.hs ?? '')}-${esc(f.as ?? '')}</span>` : '<span class="mut">vs</span>'} ${esc(f.a)}</b></div>
      <span class="clwhen">${live ? '● ' + esc(f.det || 'EN VIVO') : post ? esc(new Date(f.date).toLocaleDateString('es-AR', { day:'numeric', month:'short' })) : esc(hora(f.date))}</span>
      ${post ? '' : `<span class="clact"><button class="sm" data-buscar="${esc(f.h + ' vs ' + f.a)}" title="Buscar en vivo">🔎</button><a class="sm lnk" href="${gcal(f)}" target="_blank" rel="noopener" title="Agendar en Google Calendar">📅</a></span>`}</div>`; };

  function home(B) {
    const fx = data.fixtures || [], live = fx.filter(f => f.st === 'in'), next = fx.filter(f => f.st === 'pre' && Date.parse(f.date) > Date.now() - 3 * 3600e3), past = fx.filter(f => f.st === 'post').reverse();
    const days = {}; next.forEach(f => { const k = new Date(f.date).toLocaleDateString('es-AR', { weekday:'long', day:'numeric', month:'long' }); (days[k] = days[k] || []).push(f); });
    const paises = (data.paises || []).map(([p, fl]) => [p, fl, data.derbies.filter(d => d.pais === p).length]).filter(x => x[2]);
    const mine = data.derbies.filter(d => d.custom);
    const found = q ? data.derbies.filter(d => norm(dName(d) + ' ' + d.n + ' ' + (d.alias || '') + ' ' + d.a.n + ' ' + d.b.n).includes(norm(q))).slice(0, 30) : [];
    B.innerHTML = `
      <div class="clhero"><div class="clx">⚔️</div><div><h2>Mundo Clásicos</h2><p>${data.derbies.length} clásicos de ${paises.length} países · ${next.length} en los próximos 21 días</p></div></div>
      <form class="rsearch" id="clQ"><input id="clQi" placeholder="Buscar un clásico o un equipo (ej: Celtic, Peñarol, Derby de Tokio)…" value="${esc(q)}"><button>Buscar</button></form>
      ${q ? `<h2 class="sec">🔍 Resultados</h2>${found.length ? `<div class="clgrid">${found.map(card).join('')}</div>` : '<div class="empty">No encontré clásicos con eso.</div>'}` : ''}
      ${live.length ? `<h2 class="sec">🔴 Jugándose ahora</h2>${live.map(fxRow).join('')}` : ''}
      <h2 class="sec">🔥 Próximos clásicos</h2>
      ${Object.keys(days).length ? Object.entries(days).map(([k, l]) => `<div class="clday">${esc(k[0].toUpperCase() + k.slice(1))}</div>${l.map(fxRow).join('')}`).join('') : '<div class="empty">No hay clásicos en los próximos 21 días en las ligas que sigue ESPN.</div>'}
      ${past.length ? `<h2 class="sec" style="margin-top:14px">📜 Últimos resultados</h2>${past.slice(0, 15).map(fxRow).join('')}` : ''}
      <h2 class="sec" style="margin-top:14px">🌎 Por país</h2>
      <div class="clpaises">${paises.map(([p, fl, n]) => `<button data-go="p:${esc(p)}"><span>${fl}</span><b>${esc(p)}</b><small>${n}</small></button>`).join('')}</div>
      <h2 class="sec" style="margin-top:14px">⭐ Tus clásicos</h2>
      ${mine.length ? `<div class="clgrid">${mine.map(card).join('')}</div>` : ''}
      <form class="clform" id="clAdd"><input id="clA" placeholder="Equipo 1 (ej: Vélez Sarsfield)"><span>vs</span><input id="clB" placeholder="Equipo 2 (ej: Ferro Carril Oeste)"><input id="clN" placeholder="Nombre (opcional)"><button class="pri">＋ Agregar</button></form>
      ${(db.futbol.clasicos || []).length ? `<div class="mut" style="font-size:12px;margin-top:6px">Agregados: ${db.futbol.clasicos.map((c, i) => `${esc(c.a)} vs ${esc(c.b)} <button class="sm" data-cldel="${i}">✕</button>`).join(' · ')} · se suman al catálogo en la próxima actualización (hasta 30 min, necesita el secreto GIST_ID).</div>` : ''}
      <p class="mut" style="font-size:12px;margin-top:14px">Fuentes: artículos de rivalidades de Wikipedia, Wikidata (jugadores) y ESPN (partidos). Catálogo actualizado ${ago(data.catAt)} · partidos ${ago(data.updated)}.</p>`;
    bind(B);
    $('clQ').onsubmit = e => { e.preventDefault(); q = $('clQi').value.trim(); home(B); };
    $('clAdd').onsubmit = e => { e.preventDefault(); const a = $('clA').value.trim(), b = $('clB').value.trim(); if (!a || !b) return; (db.futbol.clasicos = db.futbol.clasicos || []).push({ a, b, n:$('clN').value.trim() || undefined }); save(); home(B); toast('⚔️ Clásico agregado: se suma en la próxima actualización', { ms:5000 }); };
    B.querySelectorAll('[data-cldel]').forEach(x => x.onclick = () => { db.futbol.clasicos.splice(+x.dataset.cldel, 1); save(); home(B); });
  }
  const card = d => { const nx = (data.fixtures || []).find(f => f.d === d.id && f.st !== 'post');
    return `<button class="clcard" data-go="d:${esc(d.id)}"><div class="clteams">${logo(d.a)}<span>vs</span>${logo(d.b)}</div>
      <b>${esc(dName(d))}</b><span>${esc(d.a.n)} – ${esc(d.b.n)}</span>
      <small>${d.nboth ? `👥 ${d.nboth} jugaron en los dos` : ''}${nx ? ` · 🔥 ${esc(hora(nx.date))}` : ''}</small></button>`; };
  function pais(B, p) {
    const list = data.derbies.filter(d => d.pais === p);
    B.innerHTML = `<button class="sm jgback" data-go="home">← Mundo Clásicos</button>
      <div class="clhero"><div class="clx">${flag(p)}</div><div><h2>Clásicos de ${esc(p)}</h2><p>${list.length} clásicos</p></div></div>
      <div class="clgrid">${list.map(card).join('')}</div>`;
    bind(B);
  }
  function derby(B, d) {
    const fx = (data.fixtures || []).filter(f => f.d === d.id), nx = fx.find(f => f.st !== 'post'), last = fx.filter(f => f.st === 'post').pop();
    const I = d.info || {}, rows = [['📅 Primer partido', I.desde], ['🔢 Partidos jugados', I.total], ['📊 Historial', I.record], ['🏆 Más ganados', I.masGanados], ['⚽ Máximo goleador', I.goleador], ['👕 Más clásicos jugados', I.masPartidos], ['💥 Mayor goleada', I.goleada], ['🕒 Último', I.ultimo], ['🏟️ Estadios', I.estadios], ['📍 Dónde', I.lugar]].filter(r => r[1]);
    const wiki = d.es ? `https://es.wikipedia.org/wiki/${encodeURIComponent(d.es.replace(/ /g, '_'))}` : d.en ? `https://en.wikipedia.org/wiki/${encodeURIComponent(d.en.replace(/ /g, '_'))}` : null;
    B.innerHTML = `<button class="sm jgback" data-go="${d.pais ? 'p:' + esc(d.pais) : 'home'}">← ${d.pais ? 'Clásicos de ' + esc(d.pais) : 'Mundo Clásicos'}</button>
      <div class="cldh"><div class="clside">${logo(d.a)}<b>${esc(d.a.n)}</b></div><div class="clmid"><span>${flag(d.pais)}</span><h2>${esc(dName(d))}</h2>${d.alias ? `<small>${esc(d.alias)}</small>` : ''}</div><div class="clside">${logo(d.b)}<b>${esc(d.b.n)}</b></div></div>
      ${nx || last ? `<div class="vcols">${nx ? `<div><h2 class="sec">🔥 Próximo</h2>${fxRow(nx)}</div>` : ''}${last ? `<div><h2 class="sec">📜 Último</h2>${fxRow(last)}</div>` : ''}</div>` : ''}
      <div class="vcols" style="margin-top:10px">
        <div>
          <h2 class="sec">📖 La historia</h2><div id="clSum" class="clsum">Cargando…</div>${wiki ? `<a class="lnk" style="font-size:13px" href="${wiki}" target="_blank" rel="noopener">Leer más en Wikipedia ↗</a>` : ''}
          ${rows.length ? `<h2 class="sec" style="margin-top:12px">🗂️ La ficha</h2><table class="mtab clinfo">${rows.map(([k, x]) => `<tr><td>${k}</td><td>${esc(x)}</td></tr>`).join('')}</table>` : ''}
        </div>
        <div>
          <h2 class="sec">📊 Historial reciente</h2><div id="clHist">${d.a.espn && d.b.espn ? 'Cargando…' : '<p class="mut" style="font-size:13px">No tengo a los dos equipos en ESPN para armar el historial.</p>'}</div>
          <h2 class="sec" style="margin-top:12px">👥 Jugaron en los dos${d.nboth ? ` (${d.nboth})` : ''}</h2>
          ${d.both?.length ? `<div class="clboth">${d.both.map(n => `<span>${esc(n)}</span>`).join('')}${d.nboth > d.both.length ? `<span class="mut">y ${d.nboth - d.both.length} más</span>` : ''}</div>` : '<p class="mut" style="font-size:13px">Wikidata no tiene jugadores que hayan pasado por los dos.</p>'}
        </div>
      </div>`;
    bind(B);
    summary(d); history(d);
  }
  async function summary(d) {
    const el = () => $('clSum');
    if (!sum[d.id]) {
      const [lang, t] = d.es ? ['es', d.es] : d.en ? ['en', d.en] : [null, null];
      if (!t) { if (el()) el().innerHTML = '<p class="mut">Sin artículo en Wikipedia.</p>'; return; }
      try { const j = await (await fetch(`https://${lang}.wikipedia.org/api/rest_v1/page/summary/${encodeURIComponent(t.replace(/ /g, '_'))}`)).json(); sum[d.id] = { x:j.extract || '', lang }; } catch { sum[d.id] = { x:'' }; }
    }
    const s = sum[d.id]; if (el()) el().innerHTML = s.x ? `<p>${esc(s.x)}</p>${s.lang === 'en' ? '<small class="mut">(en inglés: no tiene artículo en castellano)</small>' : ''}` : '<p class="mut">No pude traer el resumen.</p>';
  }
  async function history(d) {
    if (!d.a.espn || !d.b.espn) return;
    if (!hist[d.id]) {
      const lg = d.a.lg || 'arg.1', y = new Date().getFullYear(), seen = new Map();
      for (let s = y; s > y - 6; s--) {
        try {
          const j = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/teams/${d.a.espn}/schedule?season=${s}`)).json();
          for (const ev of j.events || []) {
            const c = ev.competitions?.[0]; if (!c?.status?.type?.completed) continue;
            const A = c.competitors.find(x => x.team.id === d.a.espn), B2 = c.competitors.find(x => x.team.id === d.b.espn); if (!A || !B2) continue;
            const sa = +(A.score?.displayValue ?? A.score), sb = +(B2.score?.displayValue ?? B2.score);
            seen.set(ev.id, { date:ev.date, sa, sb, home:A.homeAway === 'home', comp:ev.season?.displayName || '' });
          }
        } catch {}
      }
      hist[d.id] = [...seen.values()].sort((a, b) => Date.parse(b.date) - Date.parse(a.date));
    }
    const h = hist[d.id], el = $('clHist'); if (!el) return;
    if (!h.length) { el.innerHTML = '<p class="mut" style="font-size:13px">ESPN no tiene partidos entre ellos en las últimas temporadas de la liga.</p>'; return; }
    const w = h.filter(x => x.sa > x.sb).length, dr = h.filter(x => x.sa === x.sb).length, l = h.length - w - dr;
    el.innerHTML = `<div class="clwdl"><div><b>${w}</b><span>${esc(d.a.n)}</span></div><div><b>${dr}</b><span>Empates</span></div><div><b>${l}</b><span>${esc(d.b.n)}</span></div></div>
      <div class="mut" style="font-size:12px;margin:4px 0 6px">Últimos ${h.length} partidos de liga que tiene ESPN</div>
      ${h.slice(0, 12).map(x => `<div class="clhrow"><small>${new Date(x.date).toLocaleDateString('es-AR', { day:'numeric', month:'short', year:'numeric' })}</small><span>${x.home ? `<b>${esc(d.a.n)}</b> ${x.sa}-${x.sb} ${esc(d.b.n)}` : `${esc(d.b.n)} ${x.sb}-${x.sa} <b>${esc(d.a.n)}</b>`}</span><i class="${x.sa > x.sb ? 'w' : x.sa < x.sb ? 'l' : 'd'}"></i></div>`).join('')}`;
  }
  function bind(B) { B.querySelectorAll('[data-go]').forEach(x => x.addEventListener('click', e => { if (e.target.closest('[data-buscar], a')) return; go(x.dataset.go); })); }

  /* ---------- avisos dentro de FUNVS ---------- */
  async function check() {
    await load(); if (!data || DND.active()) return;
    const done = new Set(S.get('clAvisos', [])), now = Date.now(), today = new Date().toDateString();
    const hoy = (data.fixtures || []).filter(f => f.st === 'pre' && new Date(f.date).toDateString() === today);
    if (hoy.length && new Date().getHours() >= 9 && !done.has('dia' + today)) {
      done.add('dia' + today);
      toast(`<span class="g">⚔️ Hoy hay ${hoy.length} clásico${hoy.length > 1 ? 's' : ''}</span>${hoy.slice(0, 4).map(f => `${esc(f.h)} vs ${esc(f.a)} · ${new Date(f.date).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' })}`).join('<br>')}`, { cls:'goal', ms:20000, onclick:() => { S.set('fMode', 'clasicos'); view = 'home'; S.set('clView', view); Nav.go('fulbito'); Fulbito.render(true); } });
    }
    for (const f of data.fixtures || []) {
      const t = Date.parse(f.date) - now;
      if (f.st === 'pre' && t > 0 && t < 15 * 60e3 && !done.has('15' + f.e)) { done.add('15' + f.e); toast(`<span class="g">⚔️ En ${Math.round(t / 60e3)} min: clásico</span>${esc(f.h)} vs ${esc(f.a)} · ${esc(dName(data.by[f.d]))}`, { cls:'goal', ms:20000, onclick:() => { S.set('fMode', 'clasicos'); view = 'd:' + f.d; S.set('clView', view); Nav.go('fulbito'); Fulbito.render(true); } }); }
    }
    S.set('clAvisos', [...done].slice(-100));
  }
  // resultados en vivo: los clásicos de hoy se actualizan desde ESPN mientras estás mirando
  async function live() {
    if (!data || Nav.current !== 'fulbito' || S.get('fMode', 'partidos') !== 'clasicos') return;
    const now = Date.now(), hot = (data.fixtures || []).filter(f => f.st === 'in' || (f.st === 'pre' && Math.abs(Date.parse(f.date) - now) < 3 * 3600e3) || (f.st === 'post' && now - Date.parse(f.date) < 4 * 3600e3 && f._live));
    if (!hot.length) return;
    const groups = {}; hot.forEach(f => { const k = f.slug + '|' + new Date(f.date).toISOString().slice(0, 10).replace(/-/g, ''); (groups[k] = groups[k] || []).push(f); });
    let changed = false;
    for (const k of Object.keys(groups)) {
      const [lg, day] = k.split('|');
      try {
        const j = await (await fetch(`https://site.api.espn.com/apis/site/v2/sports/soccer/${lg}/scoreboard?dates=${day}`)).json();
        for (const f of groups[k]) {
          const ev = (j.events || []).find(e => e.id === f.e); if (!ev) continue;
          const c = ev.competitions[0], H = c.competitors.find(x => x.homeAway === 'home'), A = c.competitors.find(x => x.homeAway === 'away');
          const n = { hs:H.score, as:A.score, st:ev.status.type.state, det:ev.status.type.shortDetail };
          if (n.hs !== f.hs || n.as !== f.as || n.st !== f.st || n.det !== f.det) { Object.assign(f, n, { _live:true }); changed = true; }
        }
      } catch {}
    }
    const typing = document.activeElement && /INPUT|TEXTAREA/.test(document.activeElement.tagName);
    if (changed && !typing && view === 'home') Fulbito.render(true);
  }
  function init() { load(); setTimeout(check, 15e3); setInterval(check, 5 * 60e3); setInterval(live, 90e3); }
  const todayCount = () => (data?.fixtures || []).filter(f => f.st === 'in' || (f.st === 'pre' && new Date(f.date).toDateString() === new Date().toDateString())).length;
  return { init, render, load, todayCount };
})();
