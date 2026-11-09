/* =========================================================
   🌍 Mapa-globo: un globo terráqueo que se gira y se acerca hasta la calle (MapLibre + OpenFreeMap, gratis, sin cuenta).
   Lo usan las Radios (cada una en su dirección pública) y Fulbito (cada equipo en su estadio).
   Direcciones → coordenadas con Nominatim (OpenStreetMap): una por segundo como pide su regla, y quedan guardadas.
   ========================================================= */
const Mapa = (() => {
  const LIB = 'https://unpkg.com/maplibre-gl@5/dist/maplibre-gl', STYLE = 'https://tiles.openfreemap.org/styles/liberty';
  let ready = null;
  const loadLib = () => ready || (ready = new Promise((res, rej) => {
    if (window.maplibregl) return res();
    const l = document.createElement('link'); l.rel = 'stylesheet'; l.href = LIB + '.css'; document.head.appendChild(l);
    loadScript(LIB + '.js').then(res, rej);
  }));

  /* ---------- direcciones → coordenadas (cache sincronizada en db.geo) ---------- */
  let q = Promise.resolve();
  function geocode(addr) {
    db.geo = db.geo || {}; const k = norm(addr);
    if (db.geo[k]) return Promise.resolve(db.geo[k]);
    q = q.then(async () => {
      if (db.geo[k]) return db.geo[k];
      try {
        const j = await (await fetch('https://nominatim.openstreetmap.org/search?format=json&limit=1&accept-language=es&q=' + encodeURIComponent(addr))).json();
        if (j[0]) { db.geo[k] = { lat:+j[0].lat, lng:+j[0].lon }; save(); }
      } catch {}
      await new Promise(r => setTimeout(r, 1100));   // regla de Nominatim: como mucho 1 pedido por segundo
      return db.geo[k] || null;
    });
    return q;
  }

  /* ---------- la ventana del mapa ---------- */
  let map = null, markers = [];
  /** pts: [{ id, lat, lng, label, sub, html (marcador), pop (html del popup), act() }]  · extra: html para el panel */
  async function open({ title, pts, side = '', center = [-60, -34], zoom = 1.6, fit = true, onReady }) {
    let d = $('dlgMapa'); if (!d) { d = document.createElement('dialog'); d.id = 'dlgMapa'; d.className = 'mapdlg'; document.body.appendChild(d); }
    d.innerHTML = `<div class="maphead"><b>${esc(title)}</b><span class="sp"></span><button id="mapGlobe" title="Ver el globo entero">🌍</button><button id="mapX">✕</button></div>
      <div class="mapbody"><div class="mapside" id="mapSide"></div><div class="mapbox" id="mapBox"><div class="empty">Cargando el globo…</div></div></div>`;
    if (!d.open) d.showModal();
    $('mapX').onclick = () => d.close();
    d.onclose = () => { try { map?.remove(); } catch {} map = null; markers = []; };
    try { await loadLib(); } catch { $('mapBox').innerHTML = '<div class="empty">No pude cargar el mapa (¿sin conexión?).</div>'; return; }
    $('mapBox').innerHTML = '';
    map = new maplibregl.Map({ container:'mapBox', style:STYLE, center, zoom, attributionControl:{ compact:true } });
    map.addControl(new maplibregl.NavigationControl({ visualizePitch:true }), 'top-right');
    map.on('style.load', () => { try { map.setProjection({ type:'globe' }); } catch {} });
    paint(pts, side, fit);
    $('mapGlobe').onclick = () => map.flyTo({ center, zoom:1.6, speed:1.2 });
    onReady?.(map);
  }
  function paint(pts, side = '', fit = false) {
    if (!map) return;
    markers.forEach(m => m.remove()); markers = [];
    for (const p of pts.filter(p => p.lat != null)) {
      const el = document.createElement('div'); el.className = 'mapmk ' + (p.cls || ''); el.innerHTML = p.html || `<span>${esc(p.label)}</span>`; el.title = p.label;
      const pop = new maplibregl.Popup({ offset:18, closeButton:false }).setHTML(`<div class="mappop"><b>${esc(p.label)}</b>${p.sub ? `<small>${esc(p.sub)}</small>` : ''}${p.pop || ''}</div>`);
      pop.on('open', () => pop.getElement().querySelectorAll('[data-mact]').forEach(b => b.onclick = () => p.act?.(b.dataset.mact)));
      markers.push(new maplibregl.Marker({ element:el }).setLngLat([p.lng, p.lat]).setPopup(pop).addTo(map));
    }
    const s = $('mapSide');
    if (s) { s.innerHTML = `${pts.map((p, i) => `<button class="mapli ${p.lat == null ? 'nogeo' : ''}" data-i="${i}">${p.icon || ''}<span><b>${esc(p.label)}</b><small>${esc(p.lat == null ? 'sin ubicar · tocá para ubicarla' : p.sub || '')}</small></span></button>`).join('')}${side}`;
      s.querySelectorAll('[data-i]').forEach(b => b.onclick = () => { const p = pts[+b.dataset.i]; if (p.lat == null) return p.locate?.(); map.flyTo({ center:[p.lng, p.lat], zoom:15.5, speed:1.4 }); markers.find(m => { const l = m.getLngLat(); return Math.abs(l.lat - p.lat) < 1e-6 && Math.abs(l.lng - p.lng) < 1e-6; })?.togglePopup(); }); }
    const g = pts.filter(p => p.lat != null);
    if (fit && g.length) { const b = new maplibregl.LngLatBounds(); g.forEach(p => b.extend([p.lng, p.lat])); setTimeout(() => map?.fitBounds(b, { padding:80, maxZoom:12, duration:2500 }), 900); }
  }
  return { open, paint, geocode, get map() { return map; } };
})();

/* =========================================================
   📻 Mis radios en el globo
   ========================================================= */
const RadioMapa = (() => {
  // direcciones públicas verificadas (por id de la grilla de radios)
  const ADDR = { mitre:'Mansilla 2668, Ciudad Autónoma de Buenos Aires', la100:'Mansilla 2668, Ciudad Autónoma de Buenos Aires', lared:'Gorriti 5554, Ciudad Autónoma de Buenos Aires',
    vorterix:'Avenida Federico Lacroze 3455, Ciudad Autónoma de Buenos Aires', radio10:'Uriarte 1899, Ciudad Autónoma de Buenos Aires', cadena3:'Alvear 139, Córdoba, Argentina' };
  async function where(r) {
    const own = db.radGeo?.[r.url]; if (own) return { ...own, src:'tu dirección' };
    const g = RadioGrilla.match(r), a = g && ADDR[g.id];
    if (a) { const c = await Mapa.geocode(a); if (c) return { ...c, addr:a.split(',')[0], src:'dirección pública' }; }
    if (r.geo) return { ...r.geo, src:'radio-browser' };
    if (r.place) { const c = await Mapa.geocode(r.place); if (c) return { ...c, addr:r.place + ' (aprox.)', src:'ciudad' }; }
    return null;
  }
  async function locate(r) {
    const a = prompt(`¿Dónde queda ${r.name}? Escribí la dirección (calle y número, ciudad)`); if (!a) return;
    const c = await Mapa.geocode(a); if (!c) return toast('<b>No encontré esa dirección</b><small>Probá con "calle número, ciudad".</small>', { cls:'info' });
    db.radGeo = { ...(db.radGeo || {}), [r.url]:{ ...c, addr:a } }; save(); open();
  }
  async function open() {
    if (!db.radios.length) return toast('Guardá radios primero (en Radios, tocá ☆).', { cls:'info' });
    await RadioGrilla.load();
    const pts = [];
    for (const r of db.radios) {
      const w = await where(r), g = RadioGrilla.match(r), now = RadioGrilla.nowFor(r);
      pts.push({ id:r.url, lat:w?.lat, lng:w?.lng, label:g?.n || r.name, sub:[w?.addr, now?.name && '🎙️ ' + now.name].filter(Boolean).join(' · '), icon:`<i class="mapdial">${esc(g?.dial || '📻')}</i>`,
        html:`<span class="mkdial ${Radio.current?.url === r.url ? 'on' : ''}">${esc(g?.dial?.replace(/^(AM|FM) /, '') || '📻')}</span><span class="mkname">${esc(g?.n || r.name)}</span>`,
        pop:`${now ? `<p>Ahora: ${esc(now.name)}</p>` : ''}<div class="btns"><button class="pri" data-mact="play">▶ Escuchar</button><button data-mact="move">📍 Mover</button></div>`,
        act:a => a === 'play' ? Radio.play(r) : locate(r), locate:() => locate(r) });
    }
    Mapa.open({ title:'📻 Mis radios en el globo', pts, side:'<p class="mut mapnote">Direcciones públicas de cada radio. Con 📍 corregís o ubicás las que faltan. Mapa: © OpenStreetMap · OpenFreeMap.</p>' });
  }
  return { open };
})();

/* =========================================================
   ⚽ Fulbito en el globo: cada equipo de tus ligas en su estadio. Los que juegan hoy, resaltados con el partido.
   ========================================================= */
const FulbitoMapa = (() => {
  let data = null;
  async function open() {
    if (!data) try { data = await (await fetch(REPO.data + 'estadios.json?t=' + Math.floor(Date.now() / 36e5))).json(); } catch { data = null; }
    if (!data?.equipos?.length) return toast('<b>Todavía no están los estadios</b><small>Se arman solos en GitHub; probá en un rato.</small>', { cls:'info' });
    const L = db.futbol.leagues.length ? db.futbol.leagues : null;
    const games = {}; Object.values(Fulbito.today() || {}).forEach(x => (x.events || []).forEach(m => { games[m.h.team.id] = m; games[m.a.team.id] = m; }));
    const fav = t => db.futbol.teams.some(f => { const a = norm(f), b = norm(t.n), c = norm(t.c); return b.includes(a) || a.includes(b) || (c && a === c); });
    const fix = db.estGeo || {};
    const eq = data.equipos.map(t => fix[t.id] ? { ...t, ...fix[t.id], aprox:false } : t).filter(t => !L || t.ligas.some(l => L.includes(l)) || games[t.id] || fav(t));
    const rank = t => games[t.id] ? 0 : fav(t) ? 1 : 2;
    eq.sort((a, b) => rank(a) - rank(b) || a.c.localeCompare(b.c));
    const pts = eq.map(t => {
      const m = games[t.id], vs = m && `${m.h.team.shortDisplayName} ${m.state === 'pre' ? 'vs' : m.hs + '-' + m.as} ${m.a.team.shortDisplayName}`;
      const local = m && m.h.team.id === t.id;
      return { id:t.id, lat:t.lat, lng:t.lng, label:t.c, cls:(m ? 'hoy' : '') + (fav(t) ? ' fav' : ''),
        sub:m ? `⚽ ${vs} · ${m.st}` : [t.est, t.city].filter(Boolean).join(' · ') + (t.aprox ? ' (aprox.)' : ''),
        icon:`<img src="${esc(t.logo)}" alt="" style="width:26px;height:26px;object-fit:contain" loading="lazy">`,
        html:`<img src="${esc(t.logo)}" alt="" loading="lazy">${m || fav(t) ? `<span class="mkname">${esc(t.c)}</span>` : ''}`,
        pop:`<p>🏟️ ${esc(t.est || 'Estadio sin dato')}${t.city ? `<br><small>${esc(t.city)}</small>` : ''}</p>${m ? `<p><b>Hoy ${local ? 'juega acá' : 'juega de visitante'}:</b> ${esc(vs)} · ${esc(m.st)}</p>` : ''}<div class="btns"><button data-mact="fav">${fav(t) ? '★ Favorito' : '☆ Favorito'}</button><button data-mact="move" title="Si está mal ubicado">📍 Corregir</button></div>`,
        act:async a => {
          if (a === 'fav' && !fav(t)) { db.futbol.teams.push(t.c); save(); toast(`★ ${esc(t.c)} agregado a favoritos`); }
          if (a === 'move') { const q = prompt(`¿Dónde juega ${t.c}? Escribí el estadio o la dirección (con la ciudad)`, t.est ? `${t.est}, ${t.city || ''}` : ''); if (!q) return;
            const c = await Mapa.geocode(q); if (!c) return toast('<b>No encontré ese lugar</b>', { cls:'info' });
            db.estGeo = { ...(db.estGeo || {}), [t.id]:{ ...c, est:q.split(',')[0] } }; save(); open(); }
        } };
    });
    const hoy = new Set(eq.filter(t => games[t.id]).map(t => games[t.id].id)).size;
    Mapa.open({ title:`⚽ Estadios de tus ligas${hoy ? ` · ${hoy} partido${hoy > 1 ? 's' : ''} hoy` : ''}`, pts, fit:false, center:[-58.5, -34.6], zoom:2.2,
      side:'<p class="mut mapnote">En verde: los que juegan hoy. Ubicación de estadios: Wikidata y OpenStreetMap. Escudos: ESPN.</p>' });
  }
  return { open };
})();
