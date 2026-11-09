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

// 2) el estadio de cada uno: ESPN (API "core", trae el estadio) y si no, Wikidata (club → P115 estadio → P625)
const ents = async ids => (await getJ(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims|labels&languages=es|en&ids=${ids.join('|')}`))?.entities || {};
const coordOf = e => { const c = e?.claims?.P625?.[0]?.mainsnak?.datavalue?.value; return c ? { lat:+c.latitude.toFixed(5), lng:+c.longitude.toFixed(5) } : null; };
const lab = e => e?.labels?.es?.value || e?.labels?.en?.value || '';
const search = async (q, lang = 'es') => ((await getJ(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=${lang}&uselang=${lang}&type=item&limit=7&search=${encodeURIComponent(q)}`))?.search || []).map(x => x.id);
async function viaWikidata(t) {
  for (const q of [t.n, t.c]) for (const lang of ['es', 'en']) {
    const ids = await search(q, lang); if (!ids.length) continue;
    const E = await ents(ids);
    for (const id of ids) {
      const v = (E[id]?.claims?.P115 || []).sort((a, b) => (b.rank === 'preferred') - (a.rank === 'preferred') || !!a.qualifiers?.P582 - !!b.qualifiers?.P582).map(x => x.mainsnak?.datavalue?.value?.id).filter(Boolean); if (!v?.length) continue;
      const V = await ents(v.slice(0, 3));
      for (const vid of v) { const c = coordOf(V[vid]); if (c) return { ...c, est:lab(V[vid]), src:'wikidata' }; }
    }
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
  let c = await viaWikidata(t);
  if (!c && e.est) c = await osm([e.est, e.city].filter(Boolean).join(', '));
  if (!c && e.city) { const x = await osm(e.city); if (x) c = { ...x, aprox:true }; }
  if (!c) sin++; else nuevos++;
  out.push({ ...t, est:c?.est || e.est || '', city:e.city || '', ...(c || {}) });
}
await writeFile(dir + '/estadios.json', JSON.stringify({ updated:new Date().toISOString(), equipos:out }));
console.log(`Estadios: ${out.length} equipos · ${nuevos} ubicados ahora · ${sin} sin ubicar`);
