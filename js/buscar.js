/* =========================================================
   🔎 Buscador para todo: canales, programas (de canales y de radios), radios, música, fútbol retro,
   seguir viendo y secciones. Se abre con 🔎 arriba o tocando "/" en el teclado.
   ========================================================= */
const Buscar = (() => {
  const DW = { sun:'dom', mon:'lun', tue:'mar', wed:'mié', thu:'jue', fri:'vie', sat:'sáb' };
  const has = (txt, q) => norm(txt).includes(q);
  const ORD = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'];
  const daysTxt = ds => { const ix = ORD.map(d => ds.includes(d)); if (ix.every(Boolean)) return 'todos los días'; const out = []; let i = 0;
    while (i < 7) { if (!ix[i]) { i++; continue; } let j = i; while (j < 6 && ix[j + 1]) j++; out.push(j - i >= 2 ? DW[ORD[i]] + '–' + DW[ORD[j]] : ORD.slice(i, j + 1).map(d => DW[d]).join(', ')); i = j + 1; } return out.join(', '); };
  const when = (ds, s, e) => `${daysTxt([].concat(ds))} ${s}${e ? '–' + e : ''}`;
  /** junta el mismo programa en distintos días: [[dueño, días[], inicio, fin, nombre, panel]] */
  function merge(list, own) { const m = new Map(); for (const [o, dw, s, e, n, pan] of list) { const k = own(o) + '|' + n + '|' + s; if (!m.has(k)) m.set(k, [o, [], s, e, n, pan]); m.get(k)[1].push(dw); } return [...m.values()]; }
  let acts = [];
  const item = (ic, t, sub, fn) => { acts.push(fn); return `<button class="bres" data-a="${acts.length - 1}"><span class="bic">${ic}</span><span><b>${esc(t)}</b>${sub ? `<small>${esc(sub)}</small>` : ''}</span></button>`; };

  function results(qq) {
    const q = norm(qq); acts = []; if (q.length < 2) return '<p class="mut">Escribí al menos 2 letras: un canal, un programa, un conductor, una radio, un equipo…</p>';
    const G = [];
    const grp = (title, arr) => { if (arr.length) G.push(`<h4>${title}</h4>` + arr.slice(0, 6).join('')); };
    // secciones
    grp('Secciones', ['deportes', 'tv247', 'sonido', 'mas', 'inicio', 'canales', 'radios', 'calendario', 'fulbito', 'prode', 'motor', 'boxeo', 'series', 'peliculas', 'musica', 'rap', '420', 'momentos', 'noticias', 'velez', 'juegos', 'wrapped']
      .filter(id => has(Nav.label(id), q)).map(id => item('➡️', Nav.label(id), '', () => Nav.go(id))));
    // canales
    grp('Canales', db.chans.filter(c => has(c.name + ' ' + (c.ref.handle || '') + ' ' + (Canales.status[c.uid]?.title || ''), q)).map(c => { const s = Canales.status[c.uid] || {};
      return item(s.st === 'live' ? '🔴' : '📺', `${Canales.numTxt(c)} ${c.name}`, s.st === 'live' ? 'en vivo · ' + (s.title || '') : s.title || c.platform, () => Player.play(c)); }));
    // programas de canales (guía de streaming)
    const gd = Guia.data, pc = [];
    for (const g of gd?.canales || []) for (const [dw, s, e, n, pan] of g.sch) if (has(n + ' ' + (pan || []).join(' '), q)) { pc.push([g, dw, s, e, n, pan]); if (pc.length > 30) break; }
    grp('Programas (streaming y TV de aire)', merge(pc, g => g.n).map(([g, dw, s, e, n, pan]) => { const mine = db.chans.find(c => Guia.match(c) === g);
      return item('🎙️', n, `${g.n} · ${when(dw, s, e)}${pan?.length ? ' · ' + pan.slice(0, 3).join(', ') : ''}${mine ? '' : ' · (no lo tenés)'}`, () => mine ? Player.play(mine) : (S.set('canView', 'guia'), Nav.go('canales'))); }));
    // radios y sus programas
    grp('Radios', db.radios.filter(r => has(r.name, q)).map(r => item('📻', r.name, RadioGrilla.nowFor(r)?.name || '', () => Radio.play(r))));
    const rd = RadioGrilla.data, pr = [];
    for (const g of rd?.radios || []) for (const [dw, s, e, n, pan] of g.sch) if (has(n + ' ' + (pan || []).join(' '), q)) pr.push([g, dw, s, e, n, pan]);
    grp('Programas de radio', merge(pr, g => g.id).map(([g, dw, s, e, n, pan]) => { const mine = db.radios.find(r => RadioGrilla.match(r) === g);
      return item('🎙️', n, `${g.n} ${g.dial} · ${when(dw, s, e)}${pan?.length ? ' · ' + pan.slice(0, 3).join(', ') : ''}`, () => mine ? Radio.play(mine) : Nav.go('radios')); }));
    // música
    const al = Musica.album();
    grp('Música', [...db.music.items.filter(i => has((i.name || '') + ' ' + (i.by || ''), q)).map(i => item('🎵', i.name || i.ref, i.by || '', () => Musica.play(i))),
      ...(al && has(al.album + ' ' + al.artist + ' ' + al.genre, q) ? [item('💿', al.album, 'Álbum del día · ' + al.artist, () => Musica.playAlbum())] : [])]);
    // seguir viendo
    grp('Seguir viendo', Object.entries(db.resume || {}).filter(([, r]) => has(r.title + ' ' + r.n, q)).map(([v, r]) => item('⏯', r.title, r.n, () => Player.play({ uid:'sv_' + v, platform:'youtube', ref:{ video:v }, name:r.n }))));
    // fútbol retro (lo que ya está leído)
    const rc = S.get('retroCache', {}), rv = [];
    for (const k of Object.keys(rc)) for (const x of rc[k].vids || []) if (has(x.t, q)) { rv.push(x); if (rv.length > 6) break; }
    grp('Fútbol retro', rv.map(x => item('📼', x.t, x.y || '', () => Player.play({ uid:'retro_' + x.v, platform:'youtube', ref:{ video:x.v }, name:'Fútbol retro' }))));
    // fútbol de hoy
    let tk = []; try { tk = Fulbito.ticker().filter(t => has(t, q)); } catch {}
    grp('Fútbol hoy', tk.map(t => item('⚽', t, '', () => Nav.go('fulbito'))));
    G.push(`<h4>Afuera</h4>` + item('▶️', `Buscar “${qq}” en YouTube`, '', () => window.open('https://www.youtube.com/results?search_query=' + encodeURIComponent(qq), '_blank'))
      + item('🎵', `Buscar “${qq}” en YouTube Music`, '', () => window.open('https://music.youtube.com/search?q=' + encodeURIComponent(qq), '_blank'))
      + item('🗓', 'Grilla de TV de cable (mi.tv)', 'Para ver qué dan hoy y cargar un aviso', () => window.open('https://mi.tv/ar/programacion', '_blank')));
    return G.join('');
  }
  function open() {
    Guia.load(); RadioGrilla.load();
    let d = $('dlgBuscar'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgBuscar'; d.className = 'bdlg'; document.body.appendChild(d); }
    d.innerHTML = `<div class="bhead"><input id="bQ" placeholder="🔎 Buscar en todo FUNVS…" autocomplete="off"><button id="bX">✕</button></div><div class="bres-list" id="bR"></div>`;
    d.showModal(); $('bQ').focus();
    let t = null; $('bQ').oninput = () => { clearTimeout(t); t = setTimeout(() => { $('bR').innerHTML = results($('bQ').value); }, 120); };
    $('bR').innerHTML = results('');
    $('bX').onclick = () => d.close();
    $('bR').onclick = e => { const b = e.target.closest('[data-a]'); if (!b) return; d.close(); try { acts[+b.dataset.a](); } catch {} };
  }
  function init() {
    $('btnGraf').insertAdjacentHTML('beforebegin', '<button id="btnBuscar" title="Buscar en todo (tecla /)">🔎</button>');
    $('btnBuscar').onclick = open;
    document.addEventListener('keydown', e => { if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(document.activeElement?.tagName)) { e.preventDefault(); open(); } });
  }
  return { init, open, results };
})();
