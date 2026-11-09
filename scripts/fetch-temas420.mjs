// 🍃🎶 Temas de 420 time: 3 por día, cada uno de un género distinto al azar (bien ecléctico).
// Álbum de Wikidata → un tema oficial del canal "Artista - Topic" en YouTube (lo que usa YouTube Music).
// Solo trabaja una vez por día (3 búsquedas de YouTube = 300 unidades de la cuota).
// Uso: node scripts/fetch-temas420.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
import { readDb } from './gist.mjs';
import { GENEROS } from './generos.mjs';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
const day = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);
let prev = null;
try { const r = await fetch(`https://raw.githubusercontent.com/${repo}/datos/temas420.json?t=${Date.now()}`); if (r.ok) prev = await r.json(); } catch {}
if (prev?.date === day && prev.temas?.length >= 3) { await writeFile(dir + '/temas420.json', JSON.stringify(prev)); console.log('Temas 420: ya están los de hoy'); process.exit(0); }
const keep = () => prev && writeFile(dir + '/temas420.json', JSON.stringify(prev));
const key = (await readDb())?.key; if (!key) { console.log('Temas 420: falta la clave de YouTube'); await keep(); process.exit(0); }

let seed = [...(day + '420')].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 11);
const rnd = n => { seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0; seed = (seed ^ (seed >>> 13)) >>> 0; return seed % n; };
const UA = { 'User-Agent':'FUNVS/1.0 (uso personal; github.com/klasito7/mi-streaming)', Accept:'application/sparql-results+json' };
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();
const yt = async (path, p) => { const u = new URL('https://www.googleapis.com/youtube/v3/' + path); Object.entries({ ...p, key }).forEach(([k, v]) => u.searchParams.set(k, v)); return (await fetch(u)).json(); };
async function albums(labels) {
  const q = `SELECT ?a ?aL ?arL ?d ?sl WHERE { VALUES ?gl { ${labels.map(l => JSON.stringify(l) + '@en').join(' ')} } ?g rdfs:label ?gl.
    VALUES ?t { wd:Q482994 wd:Q208569 wd:Q134556 wd:Q7366 } ?a wdt:P31 ?t; wdt:P136 ?g; wdt:P175 ?ar; wikibase:sitelinks ?sl. FILTER(?sl >= 2)
    OPTIONAL { ?a wdt:P577 ?d } SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". ?a rdfs:label ?aL. ?ar rdfs:label ?arL. } } LIMIT 400`;
  const j = await (await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), { headers:UA, signal:AbortSignal.timeout(40000) })).json();
  const seen = new Set();
  return j.results.bindings.filter(b => !/^Q\d+$/.test(b.aL.value) && !/^Q\d+$/.test(b.arL.value) && !seen.has(b.a.value) && seen.add(b.a.value))
    .map(b => ({ album:b.aL.value, artist:b.arL.value, year:(b.d?.value || '').slice(0, 4), sl:+b.sl.value }));
}
const temas = [], used = new Set();
for (let tries = 0; tries < 9 && temas.length < 3; tries++) {
  let gi; do gi = rnd(GENEROS.length); while (used.has(gi)); used.add(gi);
  const [gen, labels] = GENEROS[gi];
  let list = []; try { list = await albums(labels); } catch (e) { console.log('Wikidata:', e.message); continue; }
  if (list.length < 3) continue;
  const a = list[rnd(list.length)];   // cualquiera del género: también los menos conocidos
  const s = await yt('search', { part:'snippet', type:'video', videoCategoryId:'10', maxResults:25, q:`${a.artist} ${a.album}` });
  if (s.error) { console.log('YouTube:', s.error.message); break; }
  const na = norm(a.artist).split(' ')[0];
  const tr = (s.items || []).filter(x => x.id?.videoId && / - Topic$/.test(x.snippet.channelTitle) && norm(x.snippet.channelTitle).startsWith(na));
  if (!tr.length) continue;
  const t = tr[rnd(tr.length)];
  temas.push({ genre:gen, artist:a.artist, album:a.album, year:a.year, title:t.snippet.title.replace(/&amp;/g, '&').replace(/&#39;/g, "'").replace(/&quot;/g, '"'), id:t.id.videoId, thumb:`https://i.ytimg.com/vi/${t.id.videoId}/hqdefault.jpg` });
}
if (!temas.length) { console.log('Temas 420: no encontré temas hoy'); await keep(); process.exit(0); }
await writeFile(dir + '/temas420.json', JSON.stringify({ date:day, temas }));
console.log('Temas 420:', temas.map(t => `${t.genre}: ${t.artist} – ${t.title}`).join(' | '));
