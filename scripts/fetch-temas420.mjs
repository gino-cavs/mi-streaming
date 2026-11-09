// 🍃🎶 Temas de 420 time: 3 por día, cada uno de un género distinto al azar (bien ecléctico).
// Álbum de Wikidata → un tema oficial del canal "Artista - Topic" en YouTube (lo que usa YouTube Music).
// Solo trabaja una vez por día (3 búsquedas de YouTube = 300 unidades de la cuota).
// Uso: node scripts/fetch-temas420.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
import { GENEROS } from './generos.mjs';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
const day = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
let prev = null;
try { const r = await fetch(`https://raw.githubusercontent.com/${repo}/datos/temas420.json?t=${Date.now()}`); if (r.ok) prev = await r.json(); } catch {}
if (prev?.date === day && prev.cand?.length) { await writeFile(dir + '/temas420.json', JSON.stringify(prev)); console.log('Temas 420: ya están los de hoy'); process.exit(0); }
const keep = () => prev && writeFile(dir + '/temas420.json', JSON.stringify(prev));
// Acá solo elijo los álbumes (Wikidata). El tema de YouTube lo busca tu navegador con tu clave
// (la clave está limitada a tu página, así que desde GitHub YouTube la rechaza).
let seed = [...(day + '420')].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 11);
const rnd = n => { seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0; seed = (seed ^ (seed >>> 13)) >>> 0; return seed % n; };
const UA = { 'User-Agent':'FUNVS/1.0 (uso personal; github.com/klasito7/mi-streaming)', Accept:'application/sparql-results+json' };
async function albums(labels) {
  const q = `SELECT ?a ?aL ?arL ?d ?sl WHERE { VALUES ?gl { ${labels.map(l => JSON.stringify(l) + '@en').join(' ')} } ?g rdfs:label ?gl.
    VALUES ?t { wd:Q482994 wd:Q208569 wd:Q134556 wd:Q7366 } ?a wdt:P31 ?t; wdt:P136 ?g; wdt:P175 ?ar; wikibase:sitelinks ?sl. FILTER(?sl >= 2)
    OPTIONAL { ?a wdt:P577 ?d } SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". ?a rdfs:label ?aL. ?ar rdfs:label ?arL. } } LIMIT 400`;
  const j = await (await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), { headers:UA, signal:AbortSignal.timeout(40000) })).json();
  const seen = new Set();
  return j.results.bindings.filter(b => !/^Q\d+$/.test(b.aL.value) && !/^Q\d+$/.test(b.arL.value) && !seen.has(b.a.value) && seen.add(b.a.value))
    .map(b => ({ album:b.aL.value, artist:b.arL.value, year:(b.d?.value || '').slice(0, 4) }));
}
// 6 candidatos de géneros distintos (si alguno no aparece en YouTube, el navegador pasa al siguiente)
const cand = [], used = new Set();
for (let tries = 0; tries < 12 && cand.length < 6; tries++) {
  let gi; do gi = rnd(GENEROS.length); while (used.has(gi)); used.add(gi);
  const [gen, labels] = GENEROS[gi];
  let list = []; try { list = await albums(labels); } catch (e) { console.log('Wikidata:', e.message); continue; }
  if (list.length < 3) continue;
  cand.push({ genre:gen, ...list[rnd(list.length)] });
}
if (!cand.length) { console.log('Temas 420: Wikidata no respondió'); await keep(); process.exit(0); }
await writeFile(dir + '/temas420.json', JSON.stringify({ date:day, cand }));
console.log('Temas 420:', cand.map(t => `${t.genre}: ${t.artist} – ${t.album}`).join(' | '));
