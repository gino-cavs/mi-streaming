// Datos para "¿Jugó con?": jugadores que pasaron por clubes argentinos desde 2000, con cada etapa (club, desde, hasta).
// Lista de jugadores, nombres y fotos: Wikidata. Trayectoria: la ficha ("Senior career") de Wikipedia en inglés,
// que está mucho mejor cuidada que la de Wikidata. Se renueva una vez por semana.
// Uso: node scripts/fetch-jugo.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'gino-cavs/mi-streaming';
const VER = 5;   // subir este número obliga a rearmar los datos
const UA = { 'User-Agent':'FUNVS-juegos/1.0 (https://github.com/' + repo + ')' };
await mkdir(dir, { recursive:true });

try {
  const prev = await (await fetch(`https://raw.githubusercontent.com/${repo}/datos/jugo.json?t=${Date.now()}`)).json();
  if (prev && prev.v === VER && Date.now() - Date.parse(prev.updated) < 7 * 864e5 && prev.p?.length) { await writeFile(dir + '/jugo.json', JSON.stringify(prev)); console.log('Jugó con: reuso los datos de', prev.updated); process.exit(0); }
} catch {}

const sleep = ms => new Promise(r => setTimeout(r, ms));
async function q(sparql, label) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql', { method:'POST', headers:{ ...UA, Accept:'application/sparql-results+json', 'Content-Type':'application/x-www-form-urlencoded' }, body:'query=' + encodeURIComponent(sparql) });
      if (r.ok) { const j = await r.json(); console.log(label + ':', j.results.bindings.length, 'filas'); return j.results.bindings; }
      console.log(label, 'HTTP', r.status, (await r.text()).slice(0, 200));
    } catch (e) { console.log(label, e.message); }
    await sleep(8000);
  }
  return [];
}
async function wp(params) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('https://en.wikipedia.org/w/api.php', { method:'POST', headers:{ ...UA, 'Content-Type':'application/x-www-form-urlencoded' },
        body:new URLSearchParams({ format:'json', formatversion:'2', maxlag:'5', ...params }) });
      if (r.ok) { const j = await r.json(); if (!j.error) return j; console.log('WP', j.error.code); }
      else console.log('WP HTTP', r.status);
    } catch (e) { console.log('WP', e.message); }
    await sleep(5000);
  }
  return null;
}
const v = (b, k) => b[k] ? b[k].value : null;
const id = u => u.split('/').pop();
const enTitle = u => decodeURIComponent(u.split('/wiki/').pop()).replace(/_/g, ' ');

// 1) clubes argentinos (los que tienen jugadores cargados), con su artículo en inglés
const clubRows = await q(`SELECT DISTINCT ?club ?art ?es ?en WHERE {
  ?p wdt:P106 wd:Q937857; wdt:P54 ?club. ?club wdt:P17 wd:Q414.
  ?art schema:about ?club; schema:isPartOf <https://en.wikipedia.org/>.
  OPTIONAL { ?club rdfs:label ?es FILTER(LANG(?es) = "es") } OPTIONAL { ?club rdfs:label ?en FILTER(LANG(?en) = "en") } }`, 'Clubes argentinos');
const short = n => n.replace(/^(Club Atlético y Social|Club Social y Atlético|Club Social y Deportivo|Club Atlético|Club Deportivo|Asociación Atlética|Asociación Mutual Social y Deportiva|Corporación|Club)\s+/i, '').replace(/\s+\(.*\)$/, '').replace(/^de\s+/i, '');
const clubByTitle = new Map();   // título en inglés -> nombre corto en castellano
for (const b of clubRows) {
  const n = v(b, 'es') || v(b, 'en'); if (!n || /reserva|juvenil|femenin|women|\bB\b/i.test(n)) continue;
  clubByTitle.set(enTitle(v(b, 'art')), short(n));
}
console.log('Clubes con artículo:', clubByTitle.size);

// 2) jugadores que alguna vez jugaron en un club argentino, nacidos desde 1962, con artículo en inglés
const rows = await q(`SELECT DISTINCT ?p ?art ?sl ?b WHERE {
  ?club wdt:P17 wd:Q414. ?p wdt:P54 ?club; wdt:P106 wd:Q937857; wdt:P569 ?b; wikibase:sitelinks ?sl.
  FILTER(YEAR(?b) >= 1962) ?art schema:about ?p; schema:isPartOf <https://en.wikipedia.org/>. }`, 'Jugadores');
const players = new Map();
for (const b of rows) { const k = id(v(b, 'p')); if (!players.has(k)) players.set(k, { title:enTitle(v(b, 'art')), sl:+v(b, 'sl'), b:+v(b, 'b').slice(0, 4), n:null, img:null, sp:[] }); }
console.log('Jugadores distintos:', players.size);
const ids = [...players.keys()];
for (let i = 0; i < ids.length; i += 300) {
  const vals = ids.slice(i, i + 300).map(k => 'wd:' + k).join(' ');
  for (const b of await q(`SELECT ?p ?n ?img WHERE { VALUES ?p { ${vals} } OPTIONAL { ?p wdt:P18 ?img }
      OPTIONAL { ?p rdfs:label ?es FILTER(LANG(?es) = "es") } OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en) = "en") } BIND(COALESCE(?es, ?en) AS ?n) }`, 'Nombres ' + i)) {
    const pl = players.get(id(v(b, 'p'))); if (!pl) continue;
    if (v(b, 'n')) pl.n = v(b, 'n'); if (v(b, 'img') && !pl.img) pl.img = decodeURIComponent(v(b, 'img').split('/').pop());
  }
}

// 3) la ficha de Wikipedia en inglés de cada uno: years1/clubs1, years2/clubs2…
const byTitle = new Map([...players.values()].map(p => [p.title, p]));
const linkTargets = new Set();
const titles = [...byTitle.keys()];
let fichas = 0;
for (let i = 0; i < titles.length; i += 50) {
  const j = await wp({ action:'query', prop:'revisions', rvprop:'content', rvslots:'main', redirects:'1', titles:titles.slice(i, i + 50).join('|') });
  if (!j) continue;
  const back = new Map(); for (const x of [...(j.query.normalized || []), ...(j.query.redirects || [])]) back.set(x.to, x.from);
  for (const pg of j.query.pages) {
    let t = pg.title; while (!byTitle.has(t) && back.has(t)) t = back.get(t);
    const pl = byTitle.get(t); const txt = pg.revisions?.[0]?.slots?.main?.content; if (!pl || !txt) continue;
    // la ficha está antes del texto (que empieza con el nombre en negrita); "youthyears" y "nationalyears" no matchean con "| years"
    const cut = txt.indexOf("\n'''"), box = txt.slice(0, cut > 0 ? cut : 15000).replace(/\{\{\s*(snd|ndash|spaced ndash)\s*\}\}|&ndash;/gi, '–');
    const years = {}, clubs = {};
    for (const m of box.matchAll(/\|\s*years(\d+)\s*=\s*([^\n|]*)/g)) years[m[1]] = m[2];
    for (const m of box.matchAll(/\|\s*clubs(\d+)\s*=\s*([^\n]*)/g)) clubs[m[1]] = m[2];
    for (const k of Object.keys(clubs)) {
      const link = clubs[k].match(/\[\[([^\]|#]+)/); const y = (years[k] || '').match(/(\d{4})\s*(?:([–—-])\s*(\d{4})?)?/);
      if (!link || !y) continue;
      const s = +y[1], e = y[3] ? +y[3] : y[2] ? null : s;            // "2016–" = sigue (o se retiró ahí)
      pl.sp.push({ t:link[1].trim(), s, e, loan:/→|\(loan\)/i.test(clubs[k]) });
      linkTargets.add(link[1].trim());
    }
    if (pl.sp.length) fichas++;
  }
  await sleep(300);
}
console.log('Fichas con trayectoria:', fichas);

// 4) los links de la ficha a veces apuntan a redirecciones: los llevo al título real
const canon = new Map(), lt = [...linkTargets];
for (let i = 0; i < lt.length; i += 50) {
  const j = await wp({ action:'query', redirects:'1', titles:lt.slice(i, i + 50).join('|') }); if (!j) continue;
  const fwd = new Map(); for (const x of [...(j.query.normalized || []), ...(j.query.redirects || [])]) fwd.set(x.from, x.to);
  for (const t of lt.slice(i, i + 50)) { let c = t, n = 0; while (fwd.has(c) && n++ < 3) c = fwd.get(c); canon.set(t, c); }
  await sleep(200);
}

// 5) etapas: los años de la ficha se toman de mitad de año a mitad de año; los préstamos se descuentan del club dueño del pase
const NOW = new Date().getFullYear() + new Date().getMonth() / 12;
const out = { v:VER, updated:new Date().toISOString(), p:[], c:[], s:[] }, ci = new Map();
for (const pl of players.values()) {
  if (!pl.n || /^Q\d+$/.test(pl.n) || !pl.sp.length) continue;
  const sp = pl.sp.map((x, i) => {
    let st = x.s === x.e ? x.s : x.s + 0.5, en = x.e == null ? null : x.s === x.e ? x.s + 1 : x.e + 0.5;
    if (en == null) { const nx = pl.sp.slice(i + 1).find(o => o.s >= x.s); en = nx ? nx.s + 0.5 : Math.min(NOW, pl.b + 40); }
    return { ...x, club:clubByTitle.get(canon.get(x.t) || x.t), st, en };
  });
  const mine = [];
  for (const s of sp) {
    if (!s.club || s.en <= s.st) continue;
    let segs = [[s.st, s.en]];
    for (const o of sp) if (o !== s && o.loan && !s.loan && o.st >= s.st - 0.01 && o.en <= s.en + 0.01) segs = segs.flatMap(([a, b]) => o.st >= b || o.en <= a ? [[a, b]] : [[a, o.st], [o.en, b]].filter(([x, y]) => y - x > 0.05));
    for (const [a, b] of segs) if (b > 2000) mine.push([s.club, a, b]);
  }
  if (!mine.length) continue;
  const pi = out.p.length; out.p.push(pl.img ? [pl.n, pl.sl, pl.img] : [pl.n, pl.sl]);
  for (const [c, a, b] of mine) { if (!ci.has(c)) { ci.set(c, out.c.length); out.c.push(c); } out.s.push([pi, ci.get(c), Math.round(a * 100) / 100, Math.round(b * 100) / 100]); }
}
for (const n of ['Mariano Pavone', 'Javier Pastore', 'Juan Carlos Olave', 'Mario Bolatti', 'Lucas Pratto', 'Leandro Somoza']) {
  const i = out.p.findIndex(p => p[0] === n);
  console.log(n, i < 0 ? 'NO ESTÁ' : out.s.filter(s => s[0] === i).map(s => `${out.c[s[1]]} ${s[2]}-${s[3]}`).join(' | '));
}
await writeFile(dir + '/jugo.json', JSON.stringify(out));
console.log(`Jugó con: ${out.p.length} jugadores (${out.p.filter(p => p[2]).length} con foto), ${out.c.length} clubes, ${out.s.length} etapas`);
