// 💙 Efemérides fortineras: "Un día como hoy…" de Vélez. Hitos con fecha de los artículos de Wikipedia
// (historia del club) + cumpleaños de jugadores que pasaron por Vélez (Wikidata). Se arma una vez por mes.
// Uso: node scripts/fetch-efemerides.mjs carpeta_salida [usuario/repo]
import { writeFile, mkdir } from 'node:fs/promises';
const dir = process.argv[2] || '.', repo = process.argv[3] || 'klasito7/mi-streaming';
await mkdir(dir, { recursive:true });
const UA = { 'User-Agent':'FUNVS/1.0 (uso personal; github.com/klasito7/mi-streaming)' };
const getJ = async (u, h = {}) => { try { const r = await fetch(u, { headers:{ ...UA, ...h }, signal:AbortSignal.timeout(60000) }); return r.ok ? r.json() : null; } catch { return null; } };
const prev = await getJ(`https://raw.githubusercontent.com/${repo}/datos/efemerides.json?t=${Date.now()}`);
if (prev?.dias && Date.now() - Date.parse(prev.updated) < 30 * 864e5) { await writeFile(dir + '/efemerides.json', JSON.stringify(prev)); console.log('Efemérides: reuso las del mes'); process.exit(0); }

const MES = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
const dias = {}, add = (md, x) => { (dias[md] = dias[md] || []).push(x); };
const md = (m, d) => String(m).padStart(2, '0') + '-' + String(d).padStart(2, '0');

// 1) hitos: frases con fecha completa de los artículos del club
let hitos = 0;
for (const a of ['Club Atlético Vélez Sarsfield', 'Historia del Club Atlético Vélez Sarsfield', 'Estadio José Amalfitani']) {
  const r = await getJ(`https://es.wikipedia.org/w/api.php?action=query&prop=extracts&explaintext=1&format=json&titles=${encodeURIComponent(a)}`);
  const txt = (Object.values(r?.query?.pages || {})[0]?.extract || '').replace(/[​‎]/g, '').replace(/\[\d+\]/g, '');
  const seen = new Set();
  for (const s of txt.split(/(?<=\.)\s+|\n+/)) {
    const m = s.match(/\b(\d{1,2}) de (enero|febrero|marzo|abril|mayo|junio|julio|agosto|septiembre|octubre|noviembre|diciembre) de (\d{4})/i);
    if (!m || s.length < 40 || s.length > 330) continue;
    const t = s.trim().replace(/\s+/g, ' '), k = md(MES.indexOf(m[2].toLowerCase()) + 1, m[1]) + m[3];
    if (seen.has(k)) continue; seen.add(k);
    add(md(MES.indexOf(m[2].toLowerCase()) + 1, m[1]), { y:+m[3], k:'hito', t }); hitos++;
  }
}
// 2) cumpleaños de los que jugaron en Vélez (los más conocidos)
const q = `SELECT ?p ?pL ?b ?sl (MIN(?s) AS ?ini) (MAX(?e) AS ?fin) WHERE { ?club rdfs:label "Club Atlético Vélez Sarsfield"@es. ?p p:P54 ?st. ?st ps:P54 ?club. OPTIONAL { ?st pq:P580 ?s } OPTIONAL { ?st pq:P582 ?e }
  ?p wdt:P569 ?b; wikibase:sitelinks ?sl. FILTER(?sl >= 6) SERVICE wikibase:label { bd:serviceParam wikibase:language "es". ?p rdfs:label ?pL. } } GROUP BY ?p ?pL ?b ?sl ORDER BY DESC(?sl) LIMIT 600`;
const w = await getJ('https://query.wikidata.org/sparql?query=' + encodeURIComponent(q), { Accept:'application/sparql-results+json' });
let cumples = 0;
for (const x of w?.results?.bindings || []) {
  const b = x.b.value.slice(0, 10), [y, m, d] = b.split('-').map(Number); if (!y || !m || !d || /^Q\d+$/.test(x.pL.value)) continue;
  const yrs = [x.ini?.value?.slice(0, 4), x.fin?.value?.slice(0, 4)].filter(Boolean);
  add(md(m, d), { y, k:'cumple', t:x.pL.value, v:yrs.length ? (yrs[0] === yrs[1] || yrs.length === 1 ? yrs[0] : yrs.join('–')) : '', sl:+x.sl.value }); cumples++;
}
for (const k of Object.keys(dias)) dias[k].sort((a, b) => (a.k === 'hito' ? 0 : 1) - (b.k === 'hito' ? 0 : 1) || (b.sl || 0) - (a.sl || 0));
if (hitos + cumples < 20) { console.log('Efemérides: muy pocos datos, dejo las anteriores'); if (prev) await writeFile(dir + '/efemerides.json', JSON.stringify(prev)); process.exit(0); }
await writeFile(dir + '/efemerides.json', JSON.stringify({ updated:new Date().toISOString(), fuente:'Wikipedia y Wikidata', dias }));
console.log(`Efemérides: ${hitos} hitos y ${cumples} cumpleaños en ${Object.keys(dias).length} días del año`);
