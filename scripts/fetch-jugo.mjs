// Datos para "¿Jugó con?": jugadores que pasaron por clubes argentinos desde 2000, con cada etapa
// (club, desde, hasta). Todo de Wikidata; se renueva una vez por semana.
// Uso: node scripts/fetch-jugo.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'gino-cavs/mi-streaming';
const VER = 1;   // subir este número obliga a rearmar los datos
const UA = { 'User-Agent':'FUNVS-juegos/1.0 (https://github.com/' + repo + ')', Accept:'application/sparql-results+json' };
await mkdir(dir, { recursive:true });

try {
  const prev = await (await fetch(`https://raw.githubusercontent.com/${repo}/datos/jugo.json?t=${Date.now()}`)).json();
  if (prev && prev.v === VER && Date.now() - Date.parse(prev.updated) < 7 * 864e5 && prev.p?.length) { await writeFile(dir + '/jugo.json', JSON.stringify(prev)); console.log('Jugó con: reuso los datos de', prev.updated); process.exit(0); }
} catch {}

async function q(sparql, label) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql', { method:'POST', headers:{ ...UA, 'Content-Type':'application/x-www-form-urlencoded' }, body:'query=' + encodeURIComponent(sparql) });
      if (r.ok) { const j = await r.json(); console.log(label + ':', j.results.bindings.length, 'filas'); return j.results.bindings; }
      console.log(label, 'HTTP', r.status, (await r.text()).slice(0, 200));
    } catch (e) { console.log(label, e.message); }
    await new Promise(r => setTimeout(r, 8000));
  }
  return [];
}
const v = (b, k) => b[k] ? b[k].value : null;
const id = u => u.split('/').pop();
const yr = s => { if (!s || s.startsWith('-')) return null; const [y, m] = s.slice(0, 7).split('-'); return +y + (+m - 1) / 12; };

// 1) jugadores con alguna etapa en un club argentino que llegue a 2000 o después
const rows = await q(`SELECT DISTINCT ?p ?sl WHERE {
  ?club wdt:P17 wd:Q414. ?p p:P54 ?st. ?st ps:P54 ?club.
  OPTIONAL { ?st pq:P580 ?s } OPTIONAL { ?st pq:P582 ?e }
  FILTER(BOUND(?s) || BOUND(?e))
  FILTER((BOUND(?e) && YEAR(?e) >= 2000) || (!BOUND(?e) && YEAR(?s) >= 1990))
  ?p wdt:P106 wd:Q937857; wikibase:sitelinks ?sl. }`, 'Jugadores');
const ids = [...new Map(rows.map(b => [id(v(b, 'p')), +v(b, 'sl')])).entries()];
console.log('Jugadores distintos:', ids.length);

// 2) todas sus etapas (también afuera, para saber cuándo se fueron de un club argentino) + nombre
const players = new Map();   // id -> { n, sl, sp:[{c, arg, s, e}] }
const clubs = new Map();     // id -> nombre
for (const [k, sl] of ids) players.set(k, { n:null, sl, sp:[] });
for (let i = 0; i < ids.length; i += 250) {
  const vals = ids.slice(i, i + 250).map(([k]) => 'wd:' + k).join(' ');
  for (const b of await q(`SELECT ?p ?club ?s ?e ?arg ?nat WHERE { VALUES ?p { ${vals} }
      ?p p:P54 ?st. ?st ps:P54 ?club. OPTIONAL { ?st pq:P580 ?s } OPTIONAL { ?st pq:P582 ?e }
      BIND(EXISTS { ?club wdt:P17 wd:Q414 } AS ?arg) BIND(EXISTS { ?club wdt:P31/wdt:P279* wd:Q6979593 } AS ?nat) }`, 'Etapas ' + i)) {
    if (v(b, 'nat') === 'true') continue;
    const pl = players.get(id(v(b, 'p'))); if (!pl) continue;
    pl.sp.push({ c:id(v(b, 'club')), arg:v(b, 'arg') === 'true', s:yr(v(b, 's')), e:yr(v(b, 'e')) });
  }
  for (const b of await q(`SELECT ?p ?n WHERE { VALUES ?p { ${vals} } OPTIONAL { ?p rdfs:label ?es FILTER(LANG(?es) = "es") } OPTIONAL { ?p rdfs:label ?en FILTER(LANG(?en) = "en") } BIND(COALESCE(?es, ?en) AS ?n) }`, 'Nombres ' + i)) {
    const pl = players.get(id(v(b, 'p'))); if (pl && v(b, 'n')) pl.n = v(b, 'n');
  }
}
// nombres de los clubes argentinos
const argClubs = [...new Set([...players.values()].flatMap(p => p.sp.filter(s => s.arg).map(s => s.c)))];
for (let i = 0; i < argClubs.length; i += 300) {
  for (const b of await q(`SELECT ?c ?n WHERE { VALUES ?c { ${argClubs.slice(i, i + 300).map(c => 'wd:' + c).join(' ')} } OPTIONAL { ?c rdfs:label ?es FILTER(LANG(?es) = "es") } OPTIONAL { ?c rdfs:label ?en FILTER(LANG(?en) = "en") } BIND(COALESCE(?es, ?en) AS ?n) }`, 'Clubes'))
    if (v(b, 'n')) clubs.set(id(v(b, 'c')), v(b, 'n'));
}

// 3) completar las fechas que faltan: si no dice hasta cuándo, se toma hasta la siguiente etapa (o hasta hoy si es la última)
const NOW = new Date().getFullYear() + new Date().getMonth() / 12;
const out = { v:VER, updated:new Date().toISOString(), p:[], c:[], s:[] };
const ci = new Map(), short = n => n.replace(/^(Club Atlético|Club Social y Deportivo|Club Deportivo|Asociación Atlética|Club Atlético y Social|Club Social y Atlético|Club|Asociación Mutual Social y Deportiva|Corporación)\s+/i, '').replace(/\s+\(.*\)$/, '');
for (const pl of players.values()) {
  if (!pl.n || /^Q\d+$/.test(pl.n)) continue;
  const sp = pl.sp.filter(s => s.s != null || s.e != null).sort((a, b) => (a.s ?? a.e) - (b.s ?? b.e));
  const mine = [];
  sp.forEach((s, i) => {
    if (!s.arg || !clubs.has(s.c)) return;
    if (/reserva|juvenil|sub-?\d|\bB\b/i.test(clubs.get(s.c))) return;
    let st = s.s, en = s.e;
    if (en == null) { const nx = sp.slice(i + 1).find(x => (x.s ?? x.e) > st); en = nx ? (nx.s ?? nx.e) : (NOW - st < 25 ? NOW : null); }
    if (st == null) { const pv = sp.slice(0, i).reverse().find(x => (x.e ?? x.s) != null); st = pv ? (pv.e ?? pv.s) : null; }
    if (st == null || en == null || en < 2000 || en <= st) return;
    mine.push([s.c, Math.round(st * 100) / 100, Math.round(en * 100) / 100]);
  });
  if (!mine.length) continue;
  const pi = out.p.length; out.p.push([pl.n, pl.sl]);
  for (const [c, st, en] of mine) {
    if (!ci.has(c)) { ci.set(c, out.c.length); out.c.push(short(clubs.get(c))); }
    out.s.push([pi, ci.get(c), st, en]);
  }
}
for (const n of ['Javier Pastore', 'Juan Carlos Olave', 'Ricardo Gareca', 'Lucas Pratto']) {
  const i = out.p.findIndex(p => p[0] === n);
  console.log(n, i < 0 ? 'NO ESTÁ' : out.s.filter(s => s[0] === i).map(s => `${out.c[s[1]]} ${s[2]}-${s[3]}`).join(' | '));
}
await writeFile(dir + '/jugo.json', JSON.stringify(out));
console.log(`Jugó con: ${out.p.length} jugadores, ${out.c.length} clubes, ${out.s.length} etapas`);
