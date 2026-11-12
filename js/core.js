/* =========================================================
   Núcleo: datos guardados, sincronización, utilidades, avisos
   ========================================================= */
const HOST = location.hostname || 'localhost';
const $ = id => document.getElementById(id);
const S = {
  get(k, d) { try { const v = localStorage.getItem(k); return v ? JSON.parse(v) : d; } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
// 📋 imágenes copiadas: del evento "pegar" (Ctrl+V) o leyendo el portapapeles (botón Pegar, sirve en el celu)
// bajar un archivo: en la app del celu va a Descargas/FUNVS (la app no baja blobs); en el navegador, descarga normal
async function saveFile(blob, name) {
  const N = window.FUNVSNative;
  if (N && N.save) { const b64 = await new Promise(ok => { const r = new FileReader(); r.onload = () => ok(String(r.result).split(',')[1] || ''); r.readAsDataURL(blob); });
    const where = N.save(b64, name, blob.type || 'application/octet-stream'); if (where) { toast(`<b>💾 Guardado</b><small>${esc(where)}</small>`, { ms:5000 }); return true; } toast('<b>No pude guardar el archivo</b>', { cls:'info' }); return false; }
  const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = name; document.body.appendChild(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(a.href), 4000); return true;
}
function pastedImages(e) { return [...(e.clipboardData?.items || [])].filter(i => i.kind === 'file' && i.type.startsWith('image/')).map(i => i.getAsFile()).filter(Boolean); }
async function clipImages() {
  if (!navigator.clipboard?.read) throw new Error('Este navegador no deja leer el portapapeles: usá Ctrl+V o mantené apretado y Pegar');
  const out = [];
  for (const it of await navigator.clipboard.read()) { const ty = it.types.find(t => t.startsWith('image/')); if (ty) { const b = await it.getType(ty); out.push(new File([b], 'pegada.' + ty.split('/')[1], { type:ty })); } }
  if (!out.length) throw new Error('No hay ninguna imagen copiada');
  return out;
}
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
const SYNC_KEYS = ['cats', 'chans', 'key', 'refresh', 'radios', 'futbol', 'news', 'velez', 'programs', 'motor', 'music', 'prode', 'moments', 'stats', 'rap', 'oauth', 'boxeo', 'series', 'juegos', 'diario', 'tg', 'servicios', 'nav', 'peliculas', 'retro', 'radEdit', 'radPedido', 'secUse', 'secUseSince', 'resume', 'recs', 'remote', 'flashSeen', 'radGeo', 'geo', 'estGeo', 'resWidgets', 'grillaIcal', 't420m', 'humor', 'ytq', 'ytShare', 'plan', 'tandas', 'vacaFotos', 'grafStyle', 'paseos', 'vaca', 'fechas', 'figusGist', 'vistos', 'notifs', 'nichos'];
// 🔔 qué avisos querés ver (se elige en Ajustes → Notificaciones)
const NOTIFS = { fulbito:['⚽', 'Goles y resultados de los partidos que elegiste', true], avisos:['🔔', 'Programas, radios y cosas que marcaste con la campanita', true], viaje:['🚆', 'Avisos del viaje (tren y colectivo)', true], efem:['💙', 'Efemérides de Vélez (a las 13)', true], porteno:['🎻', 'Modo porteño: datos de Buenos Aires', true], figus:['🦴', 'Colección: cuando Vaca vuelve del reparto', true], mg:['📍', 'MG News (las noticias de Monte Grande igual quedan en su sección)', false] };
const notifOn = k => !k || !NOTIFS[k] ? true : ((db.notifs || {})[k] ?? NOTIFS[k][2]);
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
  const t = !db.sync.token ? '' : syncInfo.ok ? '☁ Sincronizado' : syncInfo.ok === false ? '☁ ⚠ ' + niceErr(syncInfo.err) : '☁ Conectando…';
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
// 🧯 los errores técnicos, en criollo (nada de "Unexpected end of JSON input")
function niceErr(t) {
  t = String(t ?? '');
  const R = [[/Failed to execute 'json'[^.]*|Unexpected end of JSON input|Unexpected token[^.]*|JSON\.parse[^.]*/gi, 'la respuesta llegó vacía o cortada (probá en un rato)'],
    [/Failed to fetch|NetworkError[^.]*|Load failed|net::ERR_[A-Z_]+/gi, 'no hay conexión con el servidor'], [/quota(Exceeded)?|exceeded your quota[^.]*/gi, 'se terminó la cuota de YouTube de hoy (mañana vuelve)'],
    [/(?:HTTP|status|→)\s*403\b/g, 'no hay permiso (403)'], [/(?:HTTP|status|→)\s*404\b/g, 'no se encontró (404)'], [/(?:HTTP|status|→)\s*5\d\d\b/g, 'el servidor anda mal'],
    [/TypeError: |Error: /g, ''], [/Cannot read properties of (undefined|null)[^.]*/gi, 'faltan datos']];
  for (const [re, x] of R) t = t.replace(re, x);
  return t;
}
function warn(t) { $('warns').innerHTML = `<div class="warn">${esc(niceErr(t))}<button onclick="this.parentNode.remove()">OK</button></div>`; }
/* ⛅ Clima: Open-Meteo combinando tres modelos (ECMWF europeo, GFS de EE.UU. e ICON alemán) y promediándolos.
   El promedio de varios modelos suele acertar más que uno solo. Si algo falla, cae al pronóstico normal de Open-Meteo. */
const METEO_MODELS = ['ecmwf_ifs025', 'gfs_seamless', 'icon_seamless'];
// ⛅ Íconos de clima precisos: el "código de tiempo" de un solo modelo a veces dice nublado con sol pleno.
// Si hay lluvia/tormenta/niebla en la mayoría de los modelos, uso ese código; si no, lo saco de la nubosidad PROMEDIO.
// La nubosidad "total" cuenta los cirros altos y finitos, que con sol pleno igual dan 60-80 %: por eso uso nubes bajas y
// medias (las que tapan el sol) y los altos con poco peso, y la MEDIANA de los modelos (si uno delira, no manda).
// Para el día entero: qué parte del día hubo sol (horas de sol / horas de luz).
const CLOUD_OF = { current:['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high'], hourly:['cloud_cover_low', 'cloud_cover_mid', 'cloud_cover_high'], daily:['sunshine_duration', 'daylight_duration'] };
const median = a => { const n = a.filter(x => typeof x === 'number').sort((x, y) => x - y); return n.length ? (n.length % 2 ? n[n.length >> 1] : (n[n.length / 2 - 1] + n[n.length / 2]) / 2) : null; };
function wxCode(codes, cover) {
  const c = codes.filter(x => x != null); if (!c.length) return null;
  const wet = c.filter(x => x >= 45), need = c.length >= 2 ? 2 : 1;
  if (wet.length >= need) { const f = {}; wet.forEach(x => f[x] = (f[x] || 0) + 1); return +Object.entries(f).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0][0]; }
  if (cover == null) return Math.min(...c);
  return cover < 25 ? 0 : cover < 50 ? 1 : cover < 80 ? 2 : 3;
}
// "cuánto tapa" cada modelo (0-100)
const coverOf = (sec, get) => sec === 'daily'
  ? (() => { const s = get('sunshine_duration'), d = get('daylight_duration'); return s != null && d ? Math.max(0, Math.min(100, 100 - s / d * 100 * 1.15)) : null; })()
  : (() => { const l = get('cloud_cover_low'), m = get('cloud_cover_mid'), h = get('cloud_cover_high'); return l == null && m == null ? null : Math.min(100, Math.max(l || 0, (m || 0) * .8) + (h || 0) * .15); })();
async function meteo(q, opts = {}) {
  const base = 'https://api.open-meteo.com/v1/forecast?';
  const p = new URLSearchParams(q);
  for (const sec of ['current', 'hourly', 'daily']) { const v = p.get(sec); if (v && /weather_code/.test(v)) p.set(sec, [...new Set([...v.split(','), ...CLOUD_OF[sec]])].join(',')); }
  const fix = (o, sec, want, models) => {
    for (const k of want) {
      const vals = models ? models.map(m => o[k + '_' + m]).filter(v => v != null && !(Array.isArray(v) && v.every(x => x == null))) : [o[k]];
      if (!vals.length || vals[0] == null) continue;
      if (/weather_code/.test(k)) continue;
      const pick = /sunrise|sunset/.test(k);
      const avg = arr => { const n = arr.filter(x => typeof x === 'number'); return n.length ? Math.round(n.reduce((a, x) => a + x, 0) / n.length * 10) / 10 : (arr.find(x => x != null) ?? null); };
      o[k] = Array.isArray(vals[0]) ? vals[0].map((_, i) => pick ? (vals.map(v => v[i]).find(x => x != null) ?? null) : avg(vals.map(v => v[i]))) : (pick ? vals[0] : avg(vals));
    }
    if (want.includes('weather_code')) {
      const M = models || [null], raw = (k, m) => o[m ? k + '_' + m : k];
      const codes = M.map(m => raw('weather_code', m)).filter(v => v != null); if (!codes.length) return;
      const at = (v, i) => Array.isArray(v) ? v[i] : v;
      const cov = i => median(M.map(m => coverOf(sec, k => at(raw(k, m), i))));
      o.weather_code = Array.isArray(codes[0]) ? codes[0].map((_, i) => wxCode(codes.map(v => v?.[i]), cov(i))) : wxCode(codes, cov(0));
      o._cover = Array.isArray(codes[0]) ? codes[0].map((_, i) => cov(i)) : cov(0);
    }
  };
  const run = (j, models) => { for (const L of Array.isArray(j) ? j : [j]) for (const sec of ['current', 'hourly', 'daily']) { const o = L[sec]; if (o) fix(o, sec, (p.get(sec) || '').split(',').filter(Boolean), models); } return j; };
  try {
    p.set('models', METEO_MODELS.join(','));
    const j = await (await fetch(base + p, opts)).json(); if (j.error) throw 0;
    run(j, METEO_MODELS);
    const first = Array.isArray(j) ? j[0] : j;
    if (first.current && first.current.temperature_2m == null && p.get('current')) throw 0;
    if (!Array.isArray(j)) j._models = METEO_MODELS; return j;
  } catch { p.delete('models'); return run(await (await fetch(base + p, opts)).json(), null); }
}
/* 🙈 Temas silenciados en las noticias (FUNVS al minuto, Noticias, Último momento, Actualidad). Se editan en ⚙ Ajustes. */
const MUTE_DEF = ['boca', 'river', 'xeneize', 'millonario', 'millonarios', 'riquelme', 'bombonera'];
function muted(text) {
  const L = db.news?.mute ?? MUTE_DEF; if (!L.length || !text) return false;
  const t = ' ' + norm(text).replace(/[^a-z0-9ñ]+/g, ' ') + ' ';
  return L.some(w => { const k = norm(w).replace(/[^a-z0-9ñ ]+/g, ' ').trim(); return k && t.includes(' ' + k + ' '); });
}
function toast(html, { cls = '', ms = 9000, onclick, force } = {}) {
  html = niceErr(html);
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
// ⚡ partes que casi nunca se usan: se cargan recién cuando las abrís (así FUNVS arranca más rápido)
const need = name => loadScript('js/' + name + '.js?v=' + ((document.querySelector('script[src^="js/core.js"]')?.getAttribute('src') || '').split('v=')[1] || Date.now()));
function loadScript(src) {
  if (!libs[src]) libs[src] = new Promise((res, rej) => {
    const s = document.createElement('script'); s.src = src; s.async = true;
    s.onload = () => res(); s.onerror = () => { delete libs[src]; rej(new Error('No cargó ' + src)); };
    document.head.appendChild(s);
  });
  return libs[src];
}
