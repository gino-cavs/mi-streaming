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

// 2) el estadio de cada uno (ESPN) y sus coordenadas
const wdCoord = async q => {
  const s = await getJ(`https://www.wikidata.org/w/api.php?action=wbsearchentities&format=json&language=es&uselang=es&type=item&limit=5&search=${encodeURIComponent(q)}`);
  const ids = (s?.search || []).map(x => x.id); if (!ids.length) return null;
  const e = await getJ(`https://www.wikidata.org/w/api.php?action=wbgetentities&format=json&props=claims&ids=${ids.join('|')}`);
  for (const id of ids) { const c = e?.entities?.[id]?.claims?.P625?.[0]?.mainsnak?.datavalue?.value; if (c) return { lat:+c.latitude.toFixed(5), lng:+c.longitude.toFixed(5), src:'wikidata' }; }
  return null;
};
const osm = async q => { await sleep(1100); const j = await getJ('https://nominatim.openstreetmap.org/search?format=json&limit=1&q=' + encodeURIComponent(q)); return j?.[0] ? { lat:+(+j[0].lat).toFixed(5), lng:+(+j[0].lon).toFixed(5), src:'osm' } : null; };
let nuevos = 0, sin = 0;
const out = [];
for (const t of teams.values()) {
  const o = old.get(t.id);
  if (o?.lat != null) { out.push({ ...o, ...t, lat:o.lat, lng:o.lng, est:o.est, city:o.city }); continue; }
  const d = await getJ(`https://site.api.espn.com/apis/site/v2/sports/soccer/${t.ligas[0]}/teams/${t.id}`);
  const v = d?.team?.franchise?.venue || d?.team?.venue || {};
  const est = v.fullName || '', city = [v.address?.city, v.address?.country].filter(Boolean).join(', ');
  let c = null;
  if (est) c = await wdCoord(est) || await osm([est, city].filter(Boolean).join(', '));
  if (!c) c = await wdCoord('Estadio ' + t.n);
  if (!c && city) c = { ...(await osm(city) || {}), aprox:true };
  if (c?.lat == null) { sin++; c = null; } else nuevos++;
  out.push({ ...t, est, city, ...(c || {}) });
}
await writeFile(dir + '/estadios.json', JSON.stringify({ updated:new Date().toISOString(), equipos:out }));
console.log(`Estadios: ${out.length} equipos · ${nuevos} ubicados ahora · ${sin} sin ubicar`);
