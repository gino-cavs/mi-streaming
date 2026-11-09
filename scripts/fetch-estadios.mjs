// 🏟️ Estadios para el globo de Fulbito: equipos de las ligas de ESPN → su estadio → coordenadas.
// Coordenadas: Wikidata (P625 del estadio) y, si no está, OpenStreetMap (Nominatim, 1 pedido por segundo).
// Se arma una vez por mes y reusa lo que ya encontró antes (solo busca los equipos nuevos).
// Uso: node scripts/fetch-estadios.mjs carpeta_salida [usuario/repo] [ligas,separadas,por,coma]
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
const UA = { 'User-Agent':'FUNVS/1.0 (uso personal; github.com/klasito7/mi-streaming)' };
const sleep = ms => new Promise(r => setTimeout(r, ms));
const getJ = async (u, h = {}) => { try { const r = await fetch(u, { headers:{ ...UA, ...h }, signal:AbortSignal.timeout(30000) }); return r.ok ? r.json() : null; } catch { return null; } };
const LIGAS = (process.argv[4] || 'arg.1,arg.2,conmebol.libertadores,conmebol.sudamericana,esp.1,eng.1,ita.1,ger.1,fra.1,por.1,bra.1,uru.1,mex.1,usa.1,ksa.1').split(',');

const prev = await getJ(`https://raw.githubusercontent.com/${repo}/datos/estadios.json?t=${Date.now()}`);
if (!process.argv[4] && prev?.equipos && Date.now() - Date.parse(prev.updated) < 30 * 864e5) { await writeFile(dir + '/estadios.json', JSON.stringify(prev)); console.log('Estadios: reuso los del mes'); process.exit(0); }
const old = new Map((prev?.equipos || []).map(e => [e.id, e]));

// 1) equipos de cada liga
const teams = new Map();
for (const l of LIGAS) {
  const j = await getJ(`https://site.api.espn.com/apis/site/v2/sports/soccer/${l}/teams`);
  for (const t of j?.sports?.[0]?.leagues?.[0]?.teams || []) {
    const x = t.team; if (!x?.id) continue;
    const e = teams.get(x.id) || { id:x.id, n:x.displayName, c:x.shortDisplayName || x.displayName, logo:x.logos?.[0]?.href || '', ligas:[] };
    e.ligas.push(l); teams.set(x.id, e);
  }
  console.log(l, j ? 'ok' : 'sin datos');
}

// 2) el estadio de cada uno. Primero Wikidata (club → P115 estadio actual → P625), con UNA consulta por país;
//    si no aparece, el estadio que dice ESPN buscado en OpenStreetMap.
const PAIS = { arg:'Q414', uru:'Q77', bra:'Q155', chi:'Q298', col:'Q739', per:'Q419', ecu:'Q736', bol:'Q750', par:'Q733', ven:'Q717', esp:'Q29', eng:'Q145', ita:'Q38', ger:'Q183', fra:'Q142', por:'Q45', mex:'Q96', usa:'Q30', ksa:'Q851' };
const PAISN = { argentina:'Q414', uruguay:'Q77', brasil:'Q155', brazil:'Q155', chile:'Q298', colombia:'Q739', peru:'Q419', 'perú':'Q419', ecuador:'Q736', bolivia:'Q750', paraguay:'Q733', venezuela:'Q717' };
const SUDAM = ['Q414', 'Q77', 'Q155', 'Q298', 'Q739', 'Q419', 'Q736', 'Q750', 'Q733', 'Q717'];
const nrm = s => String(s || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9 ]/g, ' ');
const STOP = new Set('club atletico atletica deportivo deportiva sociedad social y de del la el los las fc cf ca cd sc ac afc sad futbol football fútbol esporte clube sport sporting association calcio ss us asociacion corporacion'.split(' '));
const toks = s => nrm(s).split(/\s+/).filter(w => w && !STOP.has(w));
const pool = {};
async function clubsOf(cc) {
  if (pool[cc]) return pool[cc];
  const body = sel => `SELECT ?club ?l ?v ?vl ?c ?sl WHERE { ${sel} ?club wdt:P17 wd:${cc}; wikibase:sitelinks ?sl; p:P115 ?st. FILTER(?sl >= 3)
    ?st ps:P115 ?v. FILTER NOT EXISTS { ?st pq:P582 [] } ?v wdt:P625 ?c.
    { ?club rdfs:label ?l } UNION { ?club skos:altLabel ?l } FILTER(LANG(?l) IN ("es","en","pt"))
    OPTIONAL { ?v rdfs:label ?vl FILTER(LANG(?vl) = "es") } }`;
  const ask = async q => { for (let i = 0; i < 3; i++) { const j = await getJ('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), { Accept:'application/sparql-results+json' }); if (j?.results) return j.results.bindings; await sleep(8000); } return []; };
  const rows = [...await ask(body('?club wdt:P31/wdt:P279* wd:Q476028.')), ...await ask(body('VALUES ?k { wd:Q847017 wd:Q2367225 } ?club wdt:P31 ?k.'))];
  const m = new Map();
  for (const x of rows) {
    const id = x.club.value; const o = m.get(id) || { names:new Set(), sl:+x.sl.value, v:x.vl?.value || '', c:x.c.value };
    o.names.add(x.l.value); m.set(id, o);
  }
  console.log('Wikidata', cc, m.size, 'clubes');
  return pool[cc] = [...m.values()].map(o => ({ ...o, toks:[...o.names].map(toks) }));
}
async function viaWikidata(t, city) {
  const lg = t.ligas.find(l => PAIS[l.split('.')[0]]), cc = lg ? PAIS[lg.split('.')[0]] : PAISN[nrm((city || '').split(',').pop()).trim()];
  const want = [toks(t.n), toks(t.c)].filter(x => x.length);
  for (const list of cc ? [[cc]] : [SUDAM]) {
    let best = null;
    for (const p of list) for (const k of await clubsOf(p)) {
      // todas las palabras del nombre de ESPN tienen que estar en algún nombre del club; gana el nombre completo y el más parecido
      want.forEach((w, wi) => k.toks.forEach(n => {
        if (!w.every(x => n.some(y => y === x || (x.length >= 4 && y.startsWith(x))))) return;
        const sc = (wi === 0 ? 1000 : 0) - (n.length - w.length) * 100 + Math.min(k.sl, 99);
        if (!best || sc > best.sc) best = { ...k, sc };
      }));
    }
    if (best) { const [lat, lng] = best.c.match(/Point\(([-\d.]+) ([-\d.]+)\)/).slice(1, 3).map(Number).reverse(); return { lat:+lat.toFixed(5), lng:+lng.toFixed(5), est:best.v, src:'wikidata' }; }
  }
  return null;
}
async function viaEspn(t) {
  const j = await getJ(`https://sports.core.api.espn.com/v2/sports/soccer/leagues/${t.ligas[0]}/teams/${t.id}?lang=es`);
  let v = j?.venue; if (v?.$ref && !v.fullName) v = await getJ(v.$ref.replace('http:', 'https:'));
  return v?.fullName ? { est:v.fullName, city:[v.address?.city, v.address?.country].filter(Boolean).join(', ') } : {};
}
const osm = async q => { await sleep(1100); const j = await getJ('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q)); return j?.[0] ? { lat:+(+j[0].lat).toFixed(5), lng:+(+j[0].lon).toFixed(5), src:'osm' } : null; };
let nuevos = 0, sin = 0;
const out = [];
for (const t of teams.values()) {
  const o = old.get(t.id);
  if (o?.lat != null) { out.push({ ...o, ...t, lat:o.lat, lng:o.lng, est:o.est, city:o.city }); continue; }
  const e = await viaEspn(t);
  let c = await viaWikidata(t, e.city);
  if (!c && e.est) c = await osm([e.est, e.city].filter(Boolean).join(', '));
  if (!c && e.city) { const x = await osm(e.city); if (x) c = { ...x, aprox:true }; }
  if (!c) sin++; else nuevos++;
  out.push({ ...t, est:c?.est || e.est || '', city:e.city || '', ...(c || {}) });
}
await writeFile(dir + '/estadios.json', JSON.stringify({ updated:new Date().toISOString(), equipos:out }));
console.log(`Estadios: ${out.length} equipos · ${nuevos} ubicados ahora · ${sin} sin ubicar`);
