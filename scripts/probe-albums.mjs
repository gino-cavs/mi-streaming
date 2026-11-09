// Diagnóstico temporal 3: álbumes por género (Wikidata) + temas del álbum en YouTube (canal "- Topic"). No imprime la clave.
import { readDb } from './gist.mjs';
import { writeFile, mkdir } from 'node:fs/promises';
const db = await readDb(); const key = db?.key; await mkdir('out', { recursive:true });
let out = ''; const w = async s => { out += s + '\n'; await writeFile('out/r.txt', out); };
const UA = { 'User-Agent':'FUNVS/1.0 (uso personal; github.com/klasito7/mi-streaming)', Accept:'application/sparql-results+json' };
for (const g of ['dubstep', 'salsa music', 'progressive rock', 'cumbia', 'hardstyle', 'techno', 'tango music', 'bossa nova']) {
  const q = `SELECT ?a ?aL ?arL ?d ?sl WHERE { ?g rdfs:label "${g}"@en. VALUES ?t { wd:Q482994 wd:Q208569 } ?a wdt:P31 ?t; wdt:P136 ?g; wdt:P175 ?ar; wikibase:sitelinks ?sl. OPTIONAL { ?a wdt:P577 ?d } FILTER(?sl >= 2) SERVICE wikibase:label { bd:serviceParam wikibase:language "es,en". ?a rdfs:label ?aL. ?ar rdfs:label ?arL. } } ORDER BY DESC(?sl) LIMIT 300`;
  try { const j = await (await fetch('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), { headers:UA })).json(); const b = j.results.bindings;
    await w(`## ${g}: ${b.length} álbumes · ej: ${b.slice(0, 3).concat(b.slice(-3)).map(x => `${x.arL?.value} – ${x.aL?.value} (${(x.d?.value || '').slice(0, 4)}, ${x.sl.value})`).join(' | ')}`); }
  catch (e) { await w(g + ': wikidata falló ' + e.message); }
}
if (!key) { await w('sin clave'); process.exit(0); }
const yt = async (path, p) => { const u = new URL('https://www.googleapis.com/youtube/v3/' + path); Object.entries({ ...p, key }).forEach(([k, v]) => u.searchParams.set(k, v)); return (await fetch(u)).json(); };
for (const [ar, al] of [['Skrillex', 'Scary Monsters and Nice Sprites'], ['Héctor Lavoe', 'La Voz'], ['Galante el Emperador', ''], ['Pink Floyd', 'The Dark Side of the Moon']]) {
  const s = await yt('search', { part:'snippet', type:'video', maxResults:25, q:`${ar} ${al}`.trim() });
  const top = (s.items || []).filter(x => / - Topic$/.test(x.snippet.channelTitle));
  await w(`\n## ${ar} – ${al}: ${s.items?.length} videos, ${top.length} del canal Topic`);
  await w(top.slice(0, 6).map(x => `  ${x.snippet.title} | ${x.snippet.description.slice(0, 90)}`).join('\n'));
  const ch = top[0]?.snippet.channelId; if (!ch) continue;
  const pl = await yt('playlists', { part:'snippet,contentDetails', channelId:ch, maxResults:25 });
  await w(`  playlists del canal Topic: ${pl.items?.length ?? pl.error?.message} → ${(pl.items || []).slice(0, 5).map(x => x.id + ' ' + x.snippet.title + ' (' + x.contentDetails.itemCount + ')').join(' | ')}`);
  const cs = await yt('channelSections', { part:'snippet,contentDetails', channelId:ch });
  await w(`  secciones: ${(cs.items || []).map(x => x.snippet.type + ':' + (x.contentDetails?.playlists || []).slice(0, 3).join(',')).join(' | ')}`);
}
