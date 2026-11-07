// Datos para Juegos: famosos (Argentina y cultura popular) con nacimiento/muerte y foto, y futbolistas
// con país, puesto y clubes. Todo sale de Wikidata. Se renueva una vez por semana.
// Uso: node scripts/fetch-juegos.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
const UA = { 'User-Agent':'FUNVS-juegos/1.0 (https://github.com/' + repo + ')', Accept:'application/sparql-results+json' };
await mkdir(dir, { recursive:true });

// si ya hay datos de menos de 7 días, los reuso
try {
  const prev = await (await fetch(`https://raw.githubusercontent.com/${repo}/datos/juegos.json?t=${Date.now()}`)).json();
  if (prev && Date.now() - Date.parse(prev.updated) < 7 * 864e5 && prev.ar?.length) { await writeFile(dir + '/juegos.json', JSON.stringify(prev)); console.log('Juegos: reuso los datos de', prev.updated); process.exit(0); }
} catch {}

async function q(sparql, label) {
  for (let i = 0; i < 3; i++) {
    try {
      const r = await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(sparql), { headers:UA });
      if (r.ok) { const j = await r.json(); console.log(label + ':', j.results.bindings.length, 'filas'); return j.results.bindings; }
      console.log(label, 'HTTP', r.status);
    } catch (e) { console.log(label, e.message); }
    await new Promise(r => setTimeout(r, 5000));
  }
  return [];
}
const v = (b, k) => b[k] ? b[k].value : null;
const id = u => u.split('/').pop();
const img = u => u ? 'https://commons.wikimedia.org/wiki/Special:FilePath/' + encodeURIComponent(decodeURIComponent(u.split('/').pop())) + '?width=320' : null;
const day = s => s ? s.slice(0, 10) : null;
function people(rows) {
  const m = new Map();
  for (const b of rows) {
    const k = id(v(b, 'p')); if (m.has(k)) continue;
    const n = v(b, 'pLabel'); if (!n || /^Q\d+$/.test(n)) continue;
    const birth = day(v(b, 'b')); if (!birth || birth.startsWith('-')) continue;
    m.set(k, { id:k, n, b:birth, d:day(v(b, 'd')), img:img(v(b, 'img')), desc:v(b, 'desc') || '', sl:+v(b, 'sl') });
  }
  return [...m.values()];
}
const PEOPLE = (where, min, limit) => `SELECT ?p ?pLabel ?b ?d ?img ?desc ?sl WHERE {
  ${where} ?p wdt:P31 wd:Q5; wdt:P569 ?b; wikibase:sitelinks ?sl. FILTER(?sl >= ${min}) FILTER(YEAR(?b) >= 1880)
  OPTIONAL { ?p wdt:P570 ?d } OPTIONAL { ?p wdt:P18 ?img } OPTIONAL { ?p schema:description ?desc FILTER(LANG(?desc) = "es") }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". } } ORDER BY DESC(?sl) LIMIT ${limit}`;

const ar = people(await q(PEOPLE('?p wdt:P27 wd:Q414.', 15, 700), 'Argentinos'));
const OCC = ['Q33999', 'Q177220', 'Q639669', 'Q2252262', 'Q937857', 'Q3665646', 'Q10833314', 'Q2066131', 'Q245068', 'Q2405480', 'Q36180', 'Q4610556', 'Q11774891', 'Q10843402'];
let pop = [];
for (const o of OCC) pop.push(...people(await q(PEOPLE(`?p wdt:P106 wd:${o}.`, 90, 120), 'Oficio ' + o)));
pop = [...new Map(pop.map(p => [p.id, p])).values()].sort((a, b) => b.sl - a.sl).slice(0, 900);

// futbolistas: los más conocidos (y un buen grupo de argentinos)
const FB = (extra, min, limit) => `SELECT ?p ?pLabel ?b ?img ?sl WHERE { ?p wdt:P106 wd:Q937857; wdt:P569 ?b; wikibase:sitelinks ?sl. ${extra}
  FILTER(?sl >= ${min}) FILTER(YEAR(?b) >= 1930) OPTIONAL { ?p wdt:P18 ?img }
  SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". } } ORDER BY DESC(?sl) LIMIT ${limit}`;
let fb = [...people(await q(FB('', 70, 350), 'Futbolistas')), ...people(await q(FB('?p wdt:P27 wd:Q414.', 25, 250), 'Futbolistas argentinos'))];
fb = [...new Map(fb.map(p => [p.id, p])).values()];
const details = new Map(fb.map(p => [p.id, { pais:new Set(), pos:new Set(), clubs:[], sel:new Set() }]));
for (let i = 0; i < fb.length; i += 100) {
  const ids = fb.slice(i, i + 100).map(p => 'wd:' + p.id).join(' ');
  for (const b of await q(`SELECT ?p ?paisLabel ?posLabel WHERE { VALUES ?p { ${ids} } OPTIONAL { ?p wdt:P27 ?pais } OPTIONAL { ?p wdt:P413 ?pos }
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". } }`, 'Países/puestos')) {
    const d = details.get(id(v(b, 'p'))); if (!d) continue;
    if (v(b, 'paisLabel')) d.pais.add(v(b, 'paisLabel')); if (v(b, 'posLabel')) d.pos.add(v(b, 'posLabel'));
  }
  for (const b of await q(`SELECT ?p ?club ?clubLabel ?start ?nat WHERE { VALUES ?p { ${ids} } ?p p:P54 ?st. ?st ps:P54 ?club. OPTIONAL { ?st pq:P580 ?start }
      BIND(EXISTS { ?club wdt:P31 wd:Q6979593 } AS ?nat)
      SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". } }`, 'Clubes')) {
    const d = details.get(id(v(b, 'p'))); if (!d) continue;
    const name = v(b, 'clubLabel'); if (!name || /^Q\d+$/.test(name)) continue;
    if (v(b, 'nat') === 'true') { if (!/sub-|olímpic|olympic|U-?\d/i.test(name)) d.sel.add(name); }
    else if (!/sub-|reserva|juvenil|\bB\b|\bII\b|U-?\d|youth|academy/i.test(name) && !d.clubs.some(c => c.n === name)) d.clubs.push({ n:name, y:v(b, 'start') ? +v(b, 'start').slice(0, 4) : null });
  }
}
const futbol = fb.map(p => { const d = details.get(p.id); return { n:p.n, b:p.b, img:p.img, sl:p.sl, pais:[...d.pais].slice(0, 2), pos:[...d.pos].slice(0, 2), sel:[...d.sel].slice(0, 1),
  clubs:d.clubs.sort((a, b) => (a.y || 9999) - (b.y || 9999)).map(c => c.n).slice(0, 12) }; }).filter(p => p.clubs.length >= 2);

// Wikirace: ¿existen los artículos de la carrera propuesta?
const wiki = {};
for (const t of ['Flavio Mendoza', 'Chili Parker', 'Liga Bazooka', 'Aczino']) {
  try { const j = await (await fetch('https://es.wikipedia.org/w/api.php?action=query&format=json&redirects=1&titles=' + encodeURIComponent(t), { headers:UA })).json();
    const pg = Object.values(j.query.pages)[0]; wiki[t] = pg.missing === undefined ? pg.title : null; } catch { wiki[t] = null; }
}
console.log('Wikipedia:', JSON.stringify(wiki));
const slim = p => ({ n:p.n, b:p.b, d:p.d, img:p.img, desc:p.desc });
await writeFile(dir + '/juegos.json', JSON.stringify({ updated:new Date().toISOString(), ar:ar.map(slim), pop:pop.map(slim), futbol, wiki }));
console.log(`Juegos: ${ar.length} argentinos, ${pop.length} de cultura popular, ${futbol.length} futbolistas`);
