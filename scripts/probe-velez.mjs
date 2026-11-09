// Diagnóstico temporal: datos para la previa (ESPN) y las efemérides (Wikidata / Wikipedia)
import { writeFile, mkdir } from 'node:fs/promises';
await mkdir('out', { recursive:true });
const j = async (u, o) => { try { const r = await fetch(u, o); return await r.json(); } catch (e) { return { err:e.message }; } };
let log = '';
const t = await j('https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/teams');
const team = (t.sports?.[0]?.leagues?.[0]?.teams || []).map(x => x.team).find(x => /v[eé]lez/i.test(x.displayName));
const sc = await j(`https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/teams/${team.id}/schedule`);
const ev = (sc.events || []).filter(e => e.competitions?.[0]?.status?.type?.state === 'post').pop();
const fx = await j(`https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/teams/${team.id}/schedule?fixture=true`);
const nx = (fx.events || [])[0];
for (const [lbl, e] of [['pasado', ev], ['proximo', nx]]) {
  if (!e) continue; const s = await j(`https://site.api.espn.com/apis/site/v2/sports/soccer/arg.1/summary?event=${e.id}`);
  await writeFile(`out/summary_${lbl}.json`, JSON.stringify(s, null, 1));
  log += `${lbl} ${e.id} ${e.name}: keys=${Object.keys(s).join(',')} h2h=${JSON.stringify(s.headToHeadGames || null).slice(0, 300)}\n`;
}
const UA = { 'User-Agent':'FUNVS/1.0 (uso personal; github.com/klasito7/mi-streaming)', Accept:'application/sparql-results+json' };
const q = `SELECT ?p ?pL ?b ?sl ?s ?e WHERE { ?club rdfs:label "Club Atlético Vélez Sarsfield"@es. ?p p:P54 ?st. ?st ps:P54 ?club. OPTIONAL { ?st pq:P580 ?s } OPTIONAL { ?st pq:P582 ?e } ?p wdt:P569 ?b; wikibase:sitelinks ?sl. FILTER(?sl >= 8) SERVICE wikibase:label { bd:serviceParam wikibase:language "es". ?p rdfs:label ?pL. } } ORDER BY DESC(?sl) LIMIT 400`;
const w = await j('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), { headers:UA });
log += `wikidata jugadores: ${w.results?.bindings?.length} · ${(w.results?.bindings || []).slice(0, 8).map(x => `${x.pL.value} ${x.b.value.slice(0, 10)} (${(x.s?.value || '').slice(0, 4)}-${(x.e?.value || '').slice(0, 4)})`).join(' | ')}\n`;
for (const a of ['Club Atlético Vélez Sarsfield', 'Historia del Club Atlético Vélez Sarsfield']) {
  const r = await j(`https://es.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(a)}`, { headers:UA });
  const txt = Object.values(r.query?.pages || {})[0]?.extract || ''; await writeFile('out/wiki_' + a.replace(/\W+/g, '_') + '.txt', txt);
  const m = txt.match(/[^.\n]*\b\d{1,2} de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) de \d{4}[^.\n]*\./g) || [];
  log += `wiki "${a}": ${txt.length} letras, ${m.length} frases con fecha · ej: ${m.slice(0, 3).join(' || ').slice(0, 500)}\n`;
}
await writeFile('out/log.txt', log);
