/* =========================================================
   Núcleo: datos guardados, sincronización, utilidades, avisos
   ========================================================= */
const HOST = location.hostname || 'localhost';
const $ = id => document.getElementById(id);
const S = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
function uid() { return Math.random().toString(36).slice(2, 10); }
function esc(s) { return String(s ?? '').replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c])); }
const norm = s => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().trim();
const fmtH = d => new Date(d).toLocaleTimeString('es-AR', { hour:'2-digit', minute:'2-digit', hourCycle:'h23' });
function ago(d) {
  const m = Math.round((Date.now() - new Date(d)) / 60000);
  if (m < 1) return 'recién';
  if (m < 60) return 'hace ' + m + ' min';
  const h = Math.round(m / 60);
  if (h < 24) return 'hace ' + h + ' h';
  const dd = Math.round(h / 24);
  return dd === 1 ? 'ayer' : 'hace ' + dd + ' días';
}

// Dirección de los datos que junta GitHub (noticias): https://raw.githubusercontent.com/<usuario>/<repo>/datos/
const REPO = (() => {
  const owner = HOST.endsWith('.github.io') ? HOST.split('.')[0] : 'klasito7';
  const repo = HOST.endsWith('.github.io') ? (location.pathname.split('/')[1] || 'mi-streaming') : 'mi-streaming';
  return { owner, repo, data:`https://raw.githubusercontent.com/${owner}/${repo}/datos/` };
})();

/* ---------- Datos ---------- */
const DEVICE = S.get('deviceId', null) || (() => { const d = 'd' + Math.random().toString(36).slice(2, 8); S.set('deviceId', d); return d; })();
const SYNC_KEYS = ['cats', 'chans', 'key', 'refresh', 'radios', 'futbol', 'news', 'velez', 'programs', 'motor', 'music', 'prode', 'moments', 'stats', 'rap', 'oauth', 'boxeo', 'series', 'juegos', 'diario', 'tg', 'servicios', 'nav', 'peliculas', 'retro', 'radEdit', 'radPedido', 'secUse', 'secUseSince', 'resume', 'recs', 'remote', 'flashSeen', 'radGeo', 'geo', 'estGeo', 'resWidgets', 'grillaIcal', 't420m', 'humor', 'ytq', 'ytShare', 'plan'];
const DEFAULTS = () => ({
  cats:['Fútbol', 'Streamers'], chans:[], key:'', refresh:5,
  radios:[], radEdit:{}, radPedido:0, radGeo:{}, geo:{}, estGeo:{},
  futbol:{ leagues:['arg.1', 'arg.copa', 'conmebol.libertadores', 'conmebol.sudamericana'],
           teams:['Vélez Sarsfield'], scope:'teams', sound:false, notif:false },
  news:{ topics:[], sources:[], setup:false },
  velez:{ streamCat:'' },
  programs:[],
  motor:{ drivers:['Canapino', 'Colapinto', 'Jorge Martín'], practice:false },
  music:{ items:[] },
  prode:{ preds:{}, res:{} },
  moments:[],
  stats:{},
  rap:{ sources:[], alias:{}, fixes:{} },
  oauth:{ clientId:'' },
  boxeo:{ fav:[] },
  series:{ title:'Series', icon:'📼', groups:['Series'], chans:[] },
  juegos:{ rec:{}, wiki:{} },
  diario:{ log:{}, gens:[], repro:{} },
  servicios:['dgo', 'disney', 'prime']
});
let db = S.get('hub2', null);
if (!db) {
  db = DEFAULTS();
  S.get('favs', []).forEach(f => db.chans.push({ uid:uid(), platform:f.platform, ref:f.platform === 'youtube' ? { video:f.id } : { name:f.id }, name:f.name || f.id, cat:f.cat || '' }));
  db.chans.forEach(c => { if (c.cat && !db.cats.includes(c.cat)) db.cats.push(c.cat); });
}
(function fill() {
  const D = DEFAULTS();
  SYNC_KEYS.forEach(k => { if (db[k] === undefined) db[k] = D[k]; });
  ['futbol', 'news', 'velez', 'motor', 'music', 'prode'].forEach(k => Object.keys(D[k]).forEach(x => { if (db[k][x] === undefined) db[k][x] = D[k][x]; }));
  if (!db.sync) db.sync = { token:'', gistId:null };
})();

const changeHooks = [];             // funciones que redibujan cuando cambian los datos
const onChange = f => changeHooks.push(f);
const fireChange = () => changeHooks.forEach(f => { try { f(); } catch (e) { console.error(e); } });
const saveLocal = () => S.set('hub2', db);
// Guardar un cambio hecho por vos: lo marca como nuevo y lo sube a la nube
const save = () => { db.updatedAt = Date.now(); saveLocal(); schedulePush(); };

/* ---------- Sincronización entre dispositivos (Gist privado de GitHub) ---------- */
const SYNC_FILE = 'mi-streaming.json';
let pushTimer = null, syncInfo = { ok:null, at:null, err:'' };
async function gh(path, opts = {}) {
  const r = await fetch('https://api.github.com' + path, { ...opts, headers:{
    Authorization:'Bearer ' + db.sync.token, Accept:'application/vnd.github+json',
    ...(opts.body ? { 'Content-Type':'application/json' } : {}) } });
  if (!r.ok) {
    const e = new Error(r.status === 401 ? 'El token de GitHub no es válido o venció.'
      : r.status === 403 || (r.status === 404 && path === '/gists') ? 'El token no tiene permiso de "gist".'
      : 'GitHub respondió con error ' + r.status + '.');
    e.status = r.status; throw e;
  }
  return r.json();
}
const payload = () => { const o = { v:2, updatedAt:db.updatedAt || 0 }; SYNC_KEYS.forEach(k => o[k] = db[k]); return JSON.stringify(o, null, 1); };
function sameCh(a, b) {
  if (a.platform !== b.platform) return false;
  const A = a.ref, B = b.ref;
  return !!((A.name && A.name === B.name) || (A.video && A.video === B.video) || (A.channelId && A.channelId === B.channelId)
    || (A.handle && B.handle && A.handle.toLowerCase() === B.handle.toLowerCase()));
}
// Suma lo de otro lado a lo tuyo sin borrar nada (al conectar por primera vez y al importar)
function mergeInto(r) {
  let n = 0;
  (r.cats || []).forEach(k => { if (!db.cats.includes(k)) db.cats.push(k); });
  (r.chans || []).forEach(c => {
    if (!c || !c.platform || !c.ref) return;
    if (!db.chans.some(x => sameCh(x, c))) { db.chans.push({ ...c, uid:c.uid || uid() }); n++; }
  });
  (r.radios || []).forEach(x => { if (x && x.url && !db.radios.some(y => y.url === x.url)) { db.radios.push(x); n++; } });
  if (r.futbol) {
    (r.futbol.leagues || []).forEach(l => { if (!db.futbol.leagues.includes(l)) db.futbol.leagues.push(l); });
    (r.futbol.teams || []).forEach(t => { if (!db.futbol.teams.some(x => norm(x) === norm(t))) db.futbol.teams.push(t); });
  }
  if (r.news && r.news.setup && !db.news.setup) db.news = r.news;
  if (r.velez && r.velez.streamCat && !db.velez.streamCat) db.velez = r.velez;
  ((r.music && r.music.items) || []).forEach(x => { if (x && x.ref && !db.music.items.some(y => y.ref === x.ref)) { db.music.items.push(x); n++; } });
  (r.programs || []).forEach(x => { if (x && x.name && !db.programs.some(y => y.id === x.id || norm(y.name) === norm(x.name))) { db.programs.push(x); n++; } });
  if (r.prode) { Object.assign(db.prode.res, r.prode.res || {}); Object.entries(r.prode.preds || {}).forEach(([k, v]) => { if (!db.prode.preds[k]) db.prode.preds[k] = v; }); }
  if (r.rap) { (r.rap.sources || []).forEach(x => { if (!db.rap.sources.some(y => y.id === x.id)) db.rap.sources.push(x); }); Object.assign(db.rap.alias, r.rap.alias || {}); Object.assign(db.rap.fixes, r.rap.fixes || {}); }
  (r.moments || []).forEach(x => { if (x && x.id && !db.moments.some(y => y.id === x.id)) { db.moments.push(x); n++; } });
  Object.entries(r.stats || {}).forEach(([d, v]) => { if (d !== DEVICE) db.stats[d] = v; });
  if (r.series) { (r.series.chans || []).forEach(x => { if (!db.series.chans.some(y => y.id === x.id)) db.series.chans.push(x); }); (r.series.groups || []).forEach(g => { if (!db.series.groups.includes(g)) db.series.groups.push(g); }); }
  if (r.boxeo) (r.boxeo.fav || []).forEach(f => { if (!db.boxeo.fav.some(x => norm(x) === norm(f))) db.boxeo.fav.push(f); });
  if (r.oauth && r.oauth.clientId && !db.oauth.clientId) db.oauth = r.oauth;
  if (r.key && !db.key) db.key = r.key;
  return n;
}
async function findGist() {
  for (let p = 1; p <= 5; p++) {
    const list = await gh(`/gists?per_page=100&page=${p}`);
    const g = list.find(g => g.files && g.files[SYNC_FILE]);
    if (g) return { id:g.id, created:false };
    if (list.length < 100) break;
  }
  if (!db.updatedAt) db.updatedAt = Date.now();
  const g = await gh('/gists', { method:'POST', body:JSON.stringify({
    description:'Mi Centro de Streaming – sincronización (no borrar)', public:false,
    files:{ [SYNC_FILE]:{ content:payload() } } }) });
  return { id:g.id, created:true };
}
async function pull(firstTime = false) {
  if (!db.sync.token) return;
  try {
    if (!db.sync.gistId) {
      const f = await findGist();
      db.sync.gistId = f.id; saveLocal();
      if (f.created) { syncDone(); return; }
      firstTime = true;
    }
    let g;
    try { g = await gh('/gists/' + db.sync.gistId); }
    catch (e) { if (e.status === 404) { db.sync.gistId = null; saveLocal(); return pull(true); } throw e; }
    const f = g.files[SYNC_FILE];
    if (!f) { await push(); return; }
    const r = JSON.parse(f.truncated ? await (await fetch(f.raw_url)).text() : f.content);
    if (firstTime) {
      mergeInto(r); if (r.refresh) db.refresh = r.refresh;
      db.updatedAt = Date.now(); saveLocal(); await push(); fireChange();
    } else if ((r.updatedAt || 0) > (db.updatedAt || 0)) {
      const D = DEFAULTS(), mine = db.stats && db.stats[DEVICE];
      SYNC_KEYS.forEach(k => { db[k] = r[k] !== undefined ? r[k] : (db[k] ?? D[k]); });
      if (mine) { db.stats = db.stats || {}; db.stats[DEVICE] = mine; }
      db.updatedAt = r.updatedAt;
      saveLocal(); fireChange();
    } else if ((db.updatedAt || 0) > (r.updatedAt || 0)) {
      await push();
    }
    syncDone();
  } catch (e) { syncFail(e); }
}
async function push() {
  if (!db.sync.token) return;
  clearTimeout(pushTimer); pushTimer = null;
  try {
    if (!db.sync.gistId) { await pull(); return; }
    await gh('/gists/' + db.sync.gistId, { method:'PATCH', body:JSON.stringify({ files:{ [SYNC_FILE]:{ content:payload() } } }) });
    syncDone();
  } catch (e) { syncFail(e); }
}
function schedulePush() { if (db.sync && db.sync.token) { clearTimeout(pushTimer); pushTimer = setTimeout(push, 1500); } }
function syncDone() { syncInfo = { ok:true, at:new Date(), err:'' }; showSync(); }
function syncFail(e) { syncInfo = { ok:false, at:new Date(), err: e instanceof TypeError ? 'Sin conexión con GitHub.' : e.message }; showSync(); }
function showSync() {
  const t = !db.sync.token ? '' : syncInfo.ok ? '☁ Sincronizado' : syncInfo.ok === false ? '☁ ⚠ ' + syncInfo.err : '☁ Conectando…';
  $('sync').textContent = t;
  $('sync').style.color = syncInfo.ok === false ? '#ffb020' : '';
  const s = $('syncState');
  if (s) { s.textContent = !db.sync.token ? 'No conectado: cada dispositivo tiene su propia lista.' : t; s.className = 'msg ' + (syncInfo.ok ? 'ok' : syncInfo.ok === false ? 'err' : ''); }
}

/* ---------- No molestar (por dispositivo) ---------- */
/* ---------- Barras horizontales: flechas ◀ ▶ y rueda del mouse sin Shift ---------- */
const HScroll = (() => {
  function update(el) {
    const w = el && el.parentElement; if (!w || !w.classList.contains('hsw')) return;
    w.classList.toggle('canL', el.scrollLeft > 4);
    w.classList.toggle('canR', el.scrollLeft + el.clientWidth < el.scrollWidth - 4);
  }
  function attach(el) {
    if (!el || el.parentElement.classList.contains('hsw')) return;
    const w = document.createElement('div'); w.className = 'hsw'; el.parentElement.insertBefore(w, el); w.appendChild(el);
    const mk = (cls, dir, t) => { const b = document.createElement('button'); b.type = 'button'; b.className = 'hsa ' + cls; b.textContent = t; b.title = dir < 0 ? 'Ver anteriores' : 'Ver más';
      b.onclick = () => el.scrollBy({ left:dir * Math.max(160, el.clientWidth * .7), behavior:'smooth' }); w.appendChild(b); };
    mk('l', -1, '‹'); mk('r', 1, '›');
    el.addEventListener('wheel', e => { if (Math.abs(e.deltaY) > Math.abs(e.deltaX) && el.scrollWidth > el.clientWidth) { e.preventDefault(); el.scrollBy({ left:e.deltaY, behavior:'instant' }); } }, { passive:false });
    el.addEventListener('scroll', () => update(el), { passive:true });
    new ResizeObserver(() => update(el)).observe(el);
    new MutationObserver(() => update(el)).observe(el, { childList:true });
    setTimeout(() => update(el), 50);
  }
  return { attach, update };
})();

const DND = (() => {
  let st = S.get('dnd', { on:false, sched:false, from:'00:00', to:'08:00' }), missed = [];
  const mins = t => { const [h, m] = t.split(':').map(Number); return h * 60 + m; };
  function inSched() {
    if (!st.sched) return false;
    const n = new Date(), now = n.getHours() * 60 + n.getMinutes(), a = mins(st.from), b = mins(st.to);
    return a <= b ? now >= a && now < b : now >= a || now < b;     // ej: 23:00 a 08:00
  }
  const active = () => st.on || inSched();
  function paint() {
    const b = $('btnDnd'); if (!b) return;
    b.textContent = active() ? '🔕' + (missed.length ? ' ' + missed.length : '') : '🔔';
    b.title = active() ? 'No molestar activado (tocá para desactivar)' : 'Activar No molestar';
    b.classList.toggle('on', active());
  }
  function toggle() {
    const was = active();
    st.on = !was; if (was && inSched()) st.sched = false;   // si lo apagás a mano dentro del horario, se apaga el horario
    S.set('dnd', st); paint();
    if (was && missed.length) {
      const list = missed.slice(-6).map(h => `<div class="dndi">${h}</div>`).join('');
      missed = []; paint();
      toast(`<b>Mientras estabas en No molestar</b>${list}`, { cls:'info dndsum', ms:25000, force:true });
    }
  }
  return { active, toggle, paint, add(h) { missed.push(h); paint(); }, get st() { return st; }, set(v) { st = { ...st, ...v }; S.set('dnd', st); paint(); } };
})();
setInterval(() => DND.paint(), 60e3);

/* ---------- Avisos ---------- */
function warn(t) { $('warns').innerHTML = `<div class="warn">${esc(t)}<button onclick="this.parentNode.remove()">OK</button></div>`; }
/* ⛅ Clima: Open-Meteo combinando tres modelos (ECMWF europeo, GFS de EE.UU. e ICON alemán) y promediándolos.
   El promedio de varios modelos suele acertar más que uno solo. Si algo falla, cae al pronóstico normal de Open-Meteo. */
const METEO_MODELS = ['ecmwf_ifs025', 'gfs_seamless', 'icon_seamless'];
async function meteo(q, opts = {}) {
  const base = 'https://api.open-meteo.com/v1/forecast?';
  const p = new URLSearchParams(q);
  try {
    p.set('models', METEO_MODELS.join(','));
    const j = await (await fetch(base + p, opts)).json(); if (j.error) throw 0;
    for (const sec of ['current', 'hourly', 'daily']) {
      const want = (p.get(sec) || '').split(',').filter(Boolean), o = j[sec]; if (!o) continue;
      for (const k of want) {
        const vals = METEO_MODELS.map(m => o[k + '_' + m]).filter(v => v != null && !(Array.isArray(v) && v.every(x => x == null)));
        if (!vals.length) continue;
        const pick = /weather_code|sunrise|sunset/.test(k);
        const avg = arr => { const n = arr.filter(x => typeof x === 'number'); return n.length ? Math.round(n.reduce((a, x) => a + x, 0) / n.length * 10) / 10 : (arr.find(x => x != null) ?? null); };
        o[k] = Array.isArray(vals[0]) ? vals[0].map((_, i) => pick ? (vals.map(v => v[i]).find(x => x != null) ?? null) : avg(vals.map(v => v[i]))) : (pick ? vals[0] : avg(vals));
      }
    }
    if (!j.current?.temperature_2m && p.get('current')) throw 0;
    j._models = METEO_MODELS; return j;
  } catch { p.delete('models'); return (await fetch(base + p, opts)).json(); }
}
/* 🙈 Temas silenciados en las noticias (FUNVS al minuto, Noticias, Último momento, Actualidad). Se editan en ⚙ Ajustes. */
const MUTE_DEF = ['boca', 'river', 'xeneize', 'millonario', 'millonarios', 'riquelme', 'bombonera'];
function muted(text) {
  const L = db.news?.mute ?? MUTE_DEF; if (!L.length || !text) return false;
  const t = ' ' + norm(text).replace(/[^a-z0-9ñ]+/g, ' ') + ' ';
  return L.some(w => { const k = norm(w).replace(/[^a-z0-9ñ ]+/g, ' ').trim(); return k && t.includes(' ' + k + ' '); });
}
function toast(html, { cls = '', ms = 9000, onclick, force } = {}) {
  if (!force && /goal|race/.test(cls) && DND.active()) { DND.add(html); return; }   // No molestar: se guarda para después
  // en la Pantalla TV los avisos salen en la barra de abajo (no tapan el video); el cartelito del zapping sigue igual
  if (document.body.classList.contains('tvlock') && !/zapt/.test(cls) && typeof Grafismo !== 'undefined') return Grafismo.barPop(/goal/.test(cls) ? '⚽ GOL' : 'FUNVS', html, { cls, ms:Math.min(ms, 12000), onclick });
  const d = document.createElement('div');
  d.className = 'toast ' + cls; d.innerHTML = html;
  d.onclick = () => { if (onclick) onclick(); d.remove(); };
  $('toasts').appendChild(d);
  while ($('toasts').children.length > 4) $('toasts').firstChild.remove();
  setTimeout(() => d.remove(), ms);
}
// Sonido corto generado (no necesita archivos). El navegador lo habilita después de tu primer toque.
let actx = null;
document.addEventListener('pointerdown', () => { try { actx = actx || new (window.AudioContext || window.webkitAudioContext)(); actx.resume(); } catch {} }, { once:true });
function beep() {
  if (!actx) return;
  const t = actx.currentTime;
  [[880, 0], [1175, .16], [1568, .32]].forEach(([f, d]) => {
    const o = actx.createOscillator(), g = actx.createGain();
    o.frequency.value = f; o.type = 'triangle';
    g.gain.setValueAtTime(0, t + d); g.gain.linearRampToValueAtTime(.25, t + d + .02); g.gain.exponentialRampToValueAtTime(.001, t + d + .35);
    o.connect(g).connect(actx.destination); o.start(t + d); o.stop(t + d + .4);
  });
}

/* ---------- Carga de librerías externas, una sola vez ---------- */
const libs = {};
function loadScript(src) {
  if (!libs[src]) libs[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = () => res(); s.onerror = () => { delete libs[src]; rej(new Error('No cargó ' + src)); };
    document.head.appendChild(s);
  });
  return libs[src];
}
