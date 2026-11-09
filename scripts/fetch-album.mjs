// 💿 Álbum del día: un género al azar (bien ecléctico) y un álbum de ese género, elegidos por la fecha
// (el mismo en la compu, el celu y la tele). El álbum sale de Wikidata; los temas, del canal oficial "- Topic"
// del artista en YouTube (con tu clave de YouTube del Gist). Corre en cada pasada pero solo trabaja una vez por día.
// Uso: node scripts/fetch-album.mjs carpeta_salida [usuario/repo]     (TEST=1: prueba todos los géneros)
import { writeFile, mkdir } from 'node:fs/promises';
import { readDb } from './gist.mjs';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });

import { GENEROS } from './generos.mjs';
export { GENEROS };

const day = new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);   // fecha de Argentina
let seed = [...day].reduce((h, c) => Math.imul(h ^ c.charCodeAt(0), 2654435761) >>> 0, 7);
const rnd = n => { seed = Math.imul(seed ^ (seed >>> 15), 2246822507) >>> 0; seed = (seed ^ (seed >>> 13)) >>> 0; return seed % n; };

const UA = { 'User-Agent':'FUNVS/1.0 (uso personal; github.com/klasito7/mi-streaming)', Accept:'application/sparql-results+json' };
async function albums(labels) {
  const q = `SELECT ?a ?aL ?arL ?d ?sl ?w WHERE { VALUES ?gl { ${labels.map(l => JSON.stringify(l) + '@en').join(' ')} } ?g rdfs:label ?gl.
    VALUES ?t { wd:Q482994 wd:Q208569 } ?a wdt:P31 ?t; wdt:P136 ?g; wdt:P175 ?ar; wikibase:sitelinks ?sl. FILTER(?sl >= 2)
    OPTIONAL { ?a wdt:P577 ?d } OPTIONAL { ?w schema:about ?a; schema:isPartOf <https://es.wikipedia.org/> }
    SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". ?a rdfs:label ?aL. ?ar rdfs:label ?arL. } } LIMIT 400`;
  const j = await (await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), { headers:UA, signal:AbortSignal.timeout(40000) })).json();
  const seen = new Set();
  return j.results.bindings.filter(b => !/^Q\d+$/.test(b.aL.value) && !/^Q\d+$/.test(b.arL.value) && !seen.has(b.a.value) && seen.add(b.a.value))
    .map(b => ({ album:b.aL.value, artist:b.arL.value, year:(b.d?.value || '').slice(0, 4), sl:+b.sl.value, wiki:b.w?.value || '' }));
}

if (process.env.TEST) {
  let out = '';
  for (const [n, l] of GENEROS) { try { const a = await albums(l); out += `${n}: ${a.length} · ${a.slice(0, 2).map(x => x.artist + ' – ' + x.album).join(' | ')}\n`; } catch (e) { out += `${n}: ERROR ${e.message}\n`; } }
  await writeFile(dir + '/generos.txt', out); process.exit(0);
}

let prev = null;
try { const r = await fetch(`https://raw.githubusercontent.com/${repo}/datos/album.json?t=${Date.now()}`); if (r.ok) prev = await r.json(); } catch {}
if (prev?.date === day && prev.ids?.length) { await writeFile(dir + '/album.json', JSON.stringify(prev)); console.log('Álbum del día: ya está el de hoy'); process.exit(0); }

const key = process.env.YT_KEY || (await readDb())?.key;   // YT_KEY: clave aparte para GitHub (sin restricción de sitio)
if (!key) { console.log('Álbum del día: falta la clave de YouTube (Gist)'); if (prev) await writeFile(dir + '/album.json', JSON.stringify(prev)); process.exit(0); }
const yt = async (path, p) => { const u = new URL('https://www.googleapis.com/youtube/v3/' + path); Object.entries({ ...p, key }).forEach(([k, v]) => u.searchParams.set(k, v)); return (await fetch(u)).json(); };
const norm = s => (s || '').toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^a-z0-9]+/g, ' ').trim();

let pick = null;
for (let tries = 0; tries < 4 && !pick; tries++) {
  const [gen, labels] = GENEROS[rnd(GENEROS.length)];
  let list = []; try { list = await albums(labels); } catch (e) { console.log('Wikidata:', e.message); continue; }
  if (list.length < 3) continue;
  // prefiero los conocidos sin que salgan siempre los mismos: sorteo dentro de la mitad más citada
  list.sort((a, b) => b.sl - a.sl); const pool = list.slice(0, Math.max(10, Math.ceil(list.length / 2)));
  for (let k = 0; k < 3 && !pick; k++) {
    const a = pool[rnd(pool.length)];
    const s = await yt('search', { part:'snippet', type:'video', maxResults:50, q:`${a.artist} ${a.album}` });
    if (s.error) { console.log('YouTube:', s.error.message); break; }
    const s2 = await yt('search', { part:'snippet', type:'video', maxResults:50, q:`"${a.album}" ${a.artist} topic` });
    const ids0 = new Set(); s.items = [...(s.items || []), ...(s2.items || [])].filter(x => x.id?.videoId && !ids0.has(x.id.videoId) && ids0.add(x.id.videoId));
    // temas oficiales: canal "Artista - Topic" y la descripción nombra el álbum
    const na = norm(a.album).slice(0, 40), tracks = (s.items || []).filter(x => / - Topic$/.test(x.snippet.channelTitle) && norm(x.snippet.description).includes(na));
    if (tracks.length >= 3) pick = { ...a, genre:gen, ids:tracks.map(x => x.id.videoId), titles:tracks.map(x => x.snippet.title), thumb:`https://i.ytimg.com/vi/${tracks[0].id.videoId}/hqdefault.jpg` };
  }
}
if (!pick) { console.log('Álbum del día: no encontré uno escuchable hoy, dejo el anterior'); if (prev) await writeFile(dir + '/album.json', JSON.stringify(prev)); process.exit(0); }
await writeFile(dir + '/album.json', JSON.stringify({ date:day, ...pick }));
console.log(`Álbum del día (${pick.genre}): ${pick.artist} – ${pick.album} (${pick.year}), ${pick.ids.length} temas`);
